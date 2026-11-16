"""Frozen campaign membership shared by planning, execution and reporting."""
from __future__ import annotations

from ..domain.common import digest, fail, utc_now
from ..domain.repository import Repository

STATE_FIELDS = ("status", "state_reason", "missing_context", "applicability_basis", "blocked_prerequisite",
                "execution_blocker", "automatic_preparation")


def freeze(project, campaign, universe, hypotheses, known_cases, gaps):
    record = {"id": "MEM-" + campaign["id"], "schema": 2, "campaign_id": campaign["id"],
              "universe_id": universe["id"], "snapshot_hash": universe["snapshot_hash"],
              "hypothesis_ids": sorted(row["id"] for row in hypotheses),
              "known_case_ids": sorted(row["id"] for row in known_cases),
              "gap_ids": sorted(row["id"] for row in gaps), "created_at": utc_now()}
    record["hypothesis_initial"] = {row["id"]: {key: row.get(key) for key in STATE_FIELDS} for row in hypotheses}
    record["membership_hash"] = digest({key: value for key, value in record.items() if key != "created_at"})
    Repository(project).add("membership", record, immutable=True)
    campaign["membership_id"] = record["id"]
    campaign["membership_hash"] = record["membership_hash"]
    Repository(project).save("campaign", campaign)
    return record


def view(project, campaign):
    record = Repository(project, read_only=True).get("membership", campaign.get("membership_id"), required=False)
    if record is None:
        return {"state": "legacy_unknown", "hypothesis_ids": [], "known_case_ids": [], "gap_ids": [],
                "reason": "Historical campaign membership was not frozen; current project inventory cannot reconstruct it."}
    expected = digest({key: value for key, value in record.items() if key not in {"created_at", "membership_hash"}})
    if record.get("campaign_id") != campaign["id"] or record.get("universe_id") != campaign.get("universe_id") \
            or record.get("membership_hash") != expected or campaign.get("membership_hash") != expected:
        fail("v2_membership_integrity", "The immutable campaign member projection is inconsistent")
    return {**record, "state": "frozen"}


def rows(project, campaign, kind):
    members = view(project, campaign)
    repository = Repository(project, read_only=True)
    if kind == "hypothesis":
        runs = repository.list("run", limit=None)[0]
        return [_hypothesis(project, campaign, members, identity, runs) for identity in members["hypothesis_ids"]]
    if kind in {"known_case", "gap"}:
        return [repository.get(kind, identity) for identity in members[kind + "_ids"]]
    identities = set(members["hypothesis_ids"])
    if kind == "run":
        return [row for row in repository.list("run", limit=None)[0]
                if row.get("campaign_id") == campaign["id"] and row.get("hypothesis_id") in identities]
    if kind == "finding":
        runs = {row["id"] for row in rows(project, campaign, "run")}
        return [row for row in repository.list("finding", limit=None)[0]
                if row.get("hypothesis_id") in identities and row.get("run_id") in runs]
    fail("v2_membership_kind", "Unsupported campaign member projection")


def _state_id(campaign_id, hypothesis_id):
    return "CH-" + digest([campaign_id, hypothesis_id])[:32]


def _hypothesis(project, campaign, members, identity, runs):
    repository = Repository(project, read_only=True)
    row = repository.get("hypothesis", identity)
    shared_preparation = row.get("automatic_preparation") or {}
    state = repository.get("campaign_hypothesis", _state_id(campaign["id"], identity), required=False)
    initial = members.get("hypothesis_initial", {}).get(identity)
    if state or initial:
        values = state.get("state", {}) if state else initial
        row = {key: value for key, value in row.items() if key not in STATE_FIELDS}
        row.update({key: value for key, value in values.items() if value is not None})
    own = [run for run in runs if run.get("hypothesis_id") == identity and run.get("campaign_id") == campaign["id"] and run.get("mode") == "test"]
    prior = [run for run in runs if run.get("hypothesis_id") == identity and run.get("campaign_id") != campaign["id"] and run.get("mode") == "test"]
    if not state and own:
        last = own[-1]
        row["status"] = last.get("hypothesis_status") or last.get("outcome") or "blocked"
    elif not state and prior:
        row.update(status="blocked", state_reason="shared_prior_result_not_campaign_proof", shared_prior_run_id=prior[-1]["id"])
        row["automatic_preparation"] = {"shared_prior_result": True,
                                        "prerequisite_fingerprint": shared_preparation.get("prerequisite_fingerprint")}
    row["_campaign_id"] = campaign["id"]
    return row


def hypothesis(project, campaign, hypothesis_id):
    require_hypothesis(project, campaign, hypothesis_id)
    return _hypothesis(project, campaign, view(project, campaign), hypothesis_id,
                       Repository(project, read_only=True).list("run", limit=None)[0])


def state_record(project, row):
    campaign = Repository(project, read_only=True).get("campaign", row["_campaign_id"])
    require_hypothesis(project, campaign, row["id"])
    return {"id": _state_id(campaign["id"], row["id"]), "campaign_id": campaign["id"], "hypothesis_id": row["id"],
            "state": {key: row.get(key) for key in STATE_FIELDS}, "updated_at": utc_now()}


def require_hypothesis(project, campaign, hypothesis_id):
    members = view(project, campaign)
    if members["state"] != "frozen" or hypothesis_id not in members["hypothesis_ids"]:
        fail("v2_campaign_membership", "This hypothesis is not a frozen member of the selected campaign")
