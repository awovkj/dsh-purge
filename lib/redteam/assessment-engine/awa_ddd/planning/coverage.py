"""Engine-computed multi-dimensional coverage for 2.0 campaigns."""
from __future__ import annotations

from collections import Counter

from ..domain import DIMENSIONS
from ..domain.coverage_claim import consumer as consumer_claim
from ..domain.coverage_claim import delivery as delivery_claim
from ..domain.coverage_claim import discovery as discovery_claim
from ..domain.coverage_claim import hypothesis as hypothesis_claim
from ..domain.coverage_claim import known_case as known_case_claim
from ..domain.coverage_claim import machine_proof as machine_claim
from ..domain.repository import Repository
from ..store import EngineError
from .hypotheses import family_applicability

TERMINAL_HYPOTHESIS = {"supported", "refuted"}


def _page_visited(page):
    return bool(page.get("page_visit_id") or page.get("visit_id"))


def compute(project, campaign_id):
    repository = Repository(project)
    campaign = repository.get("campaign", campaign_id)
    universe = repository.get("universe", campaign.get("universe_id"))
    from .membership import rows as member_rows, view as membership_view
    membership = membership_view(project, campaign)
    hypotheses = member_rows(project, campaign, "hypothesis")
    hypotheses = [row for row in hypotheses if not row.get("superseded")]
    known_cases = member_rows(project, campaign, "known_case")
    findings = member_rows(project, campaign, "finding")
    gaps = member_rows(project, campaign, "gap")
    runs = member_rows(project, campaign, "run")
    current_runs = {}
    for run in runs:
        if run.get("mode") == "test":
            current_runs[run["hypothesis_id"]] = run
    projected = []
    pending_results = []
    from ..execution.test_runner import verify_saved_run
    for row in hypotheses:
        run = current_runs.get(row["id"])
        if row.get("status") == "not_applicable":
            row = {**row, "status": "blocked", "declared_status": "not_applicable",
                   "state_reason": "unverified_applicability", "applicability_review_required": True}
        if row.get("status") in TERMINAL_HYPOTHESIS or run and run.get("outcome") in TERMINAL_HYPOTHESIS:
            try:
                outcome = verify_saved_run(project, run)["outcome"] if run else None
                if outcome not in TERMINAL_HYPOTHESIS:
                    raise ValueError()
                row = {**row, "status": outcome}
            except (EngineError, ValueError, OSError, KeyError, TypeError):
                row = {**row, "status": "inconclusive"}
                pending_results.append(row["id"])
        projected.append(row)
    hypotheses = projected
    known_cases = [{**case, "status": "reported" if any(row.get("known_case_id") == case["id"] and row.get("status") == "supported" for row in hypotheses)
                   else "verified" if any(row.get("known_case_id") == case["id"] and row.get("status") == "refuted" for row in hypotheses)
                   else "planned" if case.get("status") in {"verified", "reported"} else case.get("status")}
                  for case in known_cases]
    from ..domain.known_case import summary as known_summary
    case_summary = known_summary(known_cases)
    known_claims = []
    for track, bucket in case_summary["by_track"].items():
        known_claims.append(known_case_claim(track=track, total=bucket["total"],
                                              verified=bucket["verified"] + bucket["reported"],
                                              blocked=bucket["blocked"]))
    pages = universe.get("pages", [])
    operations = universe.get("operations", [])
    known_total = len(universe.get("routes", []))
    registered = sum(bool(row.get("page_ids") or row.get("operation_ids")) for row in universe.get("routes", []))
    visited = sum(_page_visited(page) for page in pages)
    discovery = discovery_claim(known_total=known_total, registered=registered, visited=visited,
                                unknown_counts=universe.get("unknown_counts", {}),
                                site_wide_allowed=bool(universe.get("site_wide_discovery_allowed")))
    inputs = universe.get("inputs", [])
    declared = sum(row.get("consumer_status") == "declared" for row in inputs)
    consumer = consumer_claim(inputs=len(inputs), declared=declared)
    applicable = [row for row in hypotheses if row.get("status") != "not_applicable"]
    tested = [row for row in applicable if row.get("status") in TERMINAL_HYPOTHESIS]
    dispositioned = [row for row in hypotheses if row.get("status") not in {"unplanned", "ready", "running"}]
    outcomes = Counter(row.get("status") for row in hypotheses)
    hypothesis = hypothesis_claim(total=len(hypotheses), applicable=len(applicable), tested=len(tested),
                                  dispositioned=len(dispositioned), outcomes=dict(outcomes),
                                  attempted=sum(row["id"] in current_runs for row in applicable))
    from ..proof_claim import finding_proof_state
    classified = [{**row, **finding_proof_state(project, row, model="v2")} for row in findings if row.get("current")]
    pending_machine = [row for row in classified if row.get("proof_pending")]
    reviewed_drafts = [row for row in pending_machine if row.get("mode") != "machine"]
    current_findings = [row for row in classified if not row.get("proof_pending")]
    machine = machine_claim(current_findings=len(current_findings),
                            machine_confirmed=sum(row.get("mode") == "machine" for row in current_findings))
    family_matrix = family_applicability(hypotheses)
    status_by_family = {row["test_family"]: row for row in family_matrix}
    unplanned_family_count = sum(row["status"] == "not_planned" for row in family_matrix)
    route_matrix = []
    unregistered_routes = 0
    for route in universe.get("routes", []):
        registered_route = bool(route.get("page_ids") or route.get("operation_ids"))
        if not registered_route:
            unregistered_routes += 1
        route_matrix.append({
            "route_id": route.get("route_id"),
            "path_template": route.get("path_template"),
            "source_kind": route.get("source_kind"),
            "registered": registered_route,
            "page_total": len(route.get("page_ids", [])),
            "operation_total": len(route.get("operation_ids", [])),
            "unresolved": bool(route.get("unresolved")),
        })
    consumer_matrix = [{
        "input_key": row.get("input_key"), "operation_id": row.get("operation_id"),
        "location": row.get("location"), "selector": row.get("selector"),
        "consumer": row.get("consumer"), "status": row.get("consumer_status"),
    } for row in inputs]
    known_case_matrix = [{
        "id": case.get("id"), "source_group": case.get("source_group"), "family": case.get("family"),
        "track": case.get("track"), "status": case.get("status"), "dedupe_key": case.get("dedupe_key"),
    } for case in known_cases]
    open_hypotheses = [row for row in hypotheses if row.get("status") in {"unplanned", "ready", "running", "blocked"}]
    family_status = {row["test_family"]: row["status"] for row in family_matrix}
    effective_gaps = []
    for gap in gaps:
        if gap.get("status", "open") != "open":
            continue
        if gap.get("kind") == "family" and family_status.get(gap.get("scope")) != "not_planned":
            continue
        if gap.get("kind") == "consumer":
            matching = next((row for row in inputs if row.get("input_key") == gap.get("scope")), None)
            if matching is not None and matching.get("consumer_status") != "unknown":
                continue
        effective_gaps.append(gap)
    open_gaps = effective_gaps
    remaining = []
    if unplanned_family_count:
        remaining.append({"kind": "family", "count": unplanned_family_count})
    if unregistered_routes:
        remaining.append({"kind": "route", "count": unregistered_routes})
    if open_hypotheses:
        remaining.append({"kind": "hypothesis", "count": len(open_hypotheses)})
    if open_gaps:
        remaining.append({"kind": "gap", "count": len(open_gaps)})
    # Delivery acceptance is independent of coverage ratios; only zero remaining
    # work plus at least one confirmed/refuted hypothesis and no unresolved
    # inconclusive result grants exhaustion authority. Blocked/N/A/inconclusive
    # states never become a completed assessment by themselves.
    tested_count = sum(row.get("status") in {"supported", "refuted"} for row in hypotheses)
    inconclusive_count = sum(row.get("status") == "inconclusive" for row in hypotheses)
    if inconclusive_count:
        remaining.append({"kind": "inconclusive", "count": inconclusive_count})
    if pending_machine:
        remaining.append({"kind": "finding_proof", "count": len(pending_machine)})
    if pending_results:
        remaining.append({"kind": "result_proof", "count": len(pending_results)})
    unverified_applicability = [row for row in hypotheses if row.get("applicability_review_required")]
    if unverified_applicability:
        remaining.append({"kind": "unverified_applicability", "count": len(unverified_applicability)})
    if membership["state"] != "frozen":
        remaining.append({"kind": "legacy_membership_unknown", "count": 1})
    recovery = []
    for row in hypotheses:
        if row.get("applicability_review_required"):
            recovery.append({"hypothesis_id": row["id"], "status": "blocked", "reason": "unverified_applicability",
                             "next": {"action": "surface.inspect", "input": {"operation_id": row["operation_id"]}},
                             "offline_only": True, "automatic_retry_allowed": False, "denominator_retained": True})
            continue
        if row.get("status") != "inconclusive":
            continue
        run_id = (current_runs.get(row["id"]) or {}).get("id")
        recovery.append({"hypothesis_id": row["id"], "run_id": run_id, "status": "inconclusive",
                         "reason": "current_result_proof_required" if row["id"] in pending_results else (row.get("attempt") or {}).get("blocked_reason"),
                         "next": {"action": "test.inspect", "input": {"run_id": run_id}} if run_id else
                                 {"action": "surface.inspect", "input": {"operation_id": row["operation_id"]}},
                         "offline_only": True, "automatic_retry_allowed": False, "denominator_retained": True})
    exhausted = bool(hypotheses) and not remaining and tested_count > 0 and inconclusive_count == 0
    delivery = delivery_claim(exhausted=exhausted, partial_accepted=campaign.get("state") == "delivered_partial",
                              remaining=remaining)
    tool_yield = _tool_yield(project, campaign, hypotheses, runs, current_findings)
    dependency = {"scope_epoch": universe.get("scope_epoch"),
                  "universe_snapshot_hash": universe.get("snapshot_hash"),
                  "target_build": universe.get("target_build")}
    for claim in [discovery, consumer, hypothesis, machine, *known_claims]:
        claim["dependency"].update(dependency)
    return {
        "campaign": campaign,
        "universe": {key: universe.get(key) for key in (
            "id", "snapshot_hash", "completeness_level", "site_wide_discovery_allowed", "unknown_counts")},
        "dimensions": {
            "discovery": discovery,
            "consumer": consumer,
            "hypothesis": hypothesis,
            "known_case": known_claims,
            "machine_proof": machine,
        },
        "family_matrix": family_matrix,
        "route_matrix": route_matrix,
        "consumer_matrix": consumer_matrix,
        "known_case_matrix": known_case_matrix,
        "known_case_summary": case_summary,
        "tool_yield": tool_yield,
        "delivery": delivery,
        "unplanned_family_count": unplanned_family_count,
        "unregistered_route_count": unregistered_routes,
        "open_hypothesis_count": len(open_hypotheses),
        "open_gap_count": len(open_gaps),
        "finding_summary": {
            "current_total": len(current_findings),
            "machine": sum(row.get("mode") == "machine" for row in current_findings),
            "reviewed": sum(row.get("mode") == "reviewed" for row in current_findings),
            "pending_machine": len(pending_machine),
            "reviewed_drafts": len(reviewed_drafts), "pending_results": len(pending_results),
        },
        "computed_by": "engine",
        "membership": {"state": membership["state"], "membership_hash": membership.get("membership_hash"),
                       "hypothesis_total": len(hypotheses)},
        "recovery": recovery,
        "dimension_order": list(DIMENSIONS),
    }


def _tool_yield(project, campaign, hypotheses, runs, findings):
    inventory = project.list("run")
    adapters = Counter()
    for run in inventory:
        adapter = run.get("adapter")
        if adapter:
            adapters[adapter] += 1
    operations = {row["operation_id"] for row in hypotheses}
    candidates = [row for row in project.list("candidate") if row.get("operation_id") in operations]
    candidate_ids = {row["id"] for row in candidates}
    promoted = {row["id"] for row in hypotheses if row.get("candidate_id") in candidate_ids or row.get("source_ref") in candidate_ids}
    tests = [row for row in runs if row.get("mode") == "test"]
    receipts = [row.get("execution_receipt") for row in tests]
    calls = Counter()
    for run in tests:
        recipe = Repository(project, read_only=True).get("recipe", run.get("recipe_id"), required=False) or {}
        provider = recipe.get("provider", {}).get("name")
        if provider:
            calls["playwright" if provider == "browser" else provider] += 1
    def measured(name):
        values = [row.get(name) if isinstance(row, dict) else None for row in receipts]
        return sum(values) if all(type(value) in {int, float} and value >= 0 for value in values) else None
    return {
        "calls": {adapter: calls.get(adapter, 0) for adapter in ("http", "yakit", "tscanplus", "sqlmap", "playwright")},
        "project_inventory_calls": {adapter: adapters.get(adapter, 0) for adapter in ("yakit", "tscanplus", "sqlmap")},
        "attribution": "campaign_test_runs_only; unrelated project tools are inventory, not attributed yield",
        "campaign_id": campaign["id"], "attempted_tests": len(tests),
        "candidates": len(candidates),
        "promoted_hypotheses": len(promoted) if promoted or not candidates else None,
        "explicit_candidate_promotions": len(promoted),
        "findings": len(findings),
        "measured_http_requests": measured("requests_sent"), "measured_http_responses": measured("responses_received"),
        "measured_response_bytes": measured("response_bytes"), "measured_execution_ms": measured("elapsed_ms"),
        "all_target_requests_known": all(isinstance(row, dict) and row.get("all_target_requests_known") is True for row in receipts),
        "tokens": None, "unavailable_reasons": ["candidate_promotion_linkage_unknown"] if candidates and not promoted else [],
        "note": "Current proof yield is not precision. Legacy/missing receipts, browser subrequests, unlinked promotions and host tokens remain unknown.",
    }


def summary(project, campaign_id):
    matrix = compute(project, campaign_id)
    return {
        "campaign_id": campaign_id,
        "dimensions": matrix["dimensions"],
        "delivery": matrix["delivery"],
        "unplanned_family_count": matrix["unplanned_family_count"],
        "unregistered_route_count": matrix["unregistered_route_count"],
        "open_hypothesis_count": matrix["open_hypothesis_count"],
        "finding_summary": matrix["finding_summary"],
        "family_matrix": matrix["family_matrix"],
    }
