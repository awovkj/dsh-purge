"""Attempt-aware, fair hypothesis scheduling with persistent claims and cursors."""
from __future__ import annotations

from datetime import datetime, timezone
from statistics import median

from ..domain.hypothesis import requires_preparation
from ..domain.repository import Repository
from ..domain.common import digest, fail, integer, text, utc_now

FAMILY_COST = {
    "sql_injection": 1.0, "xss": 1.4, "ssrf": 1.2, "xxe": 1.1,
    "path_traversal": 1.0, "command_injection": 1.3, "template_injection": 1.2,
    "deserialization": 1.3, "file_upload": 1.4, "business_logic": 1.5,
    "access_control": 1.1, "generic": 0.8,
}
EXPLOITABILITY = {
    "sql_injection": 1.6, "command_injection": 1.5, "template_injection": 1.5,
    "deserialization": 1.4, "xss": 1.35, "ssrf": 1.3, "xxe": 1.2,
    "file_upload": 1.2, "path_traversal": 1.25, "access_control": 1.2,
    "business_logic": 1.1, "generic": 0.75,
}
_PREP_ACTIONS = {
    "actual_input_consumer": ("surface.declare_consumer", "确认并声明该输入的实际消费点"),
    "verified_principal_and_roles": ("identity.verify", "核验独立主体的服务端角色与租户"),
    "verified_tenant_membership": ("identity.verify", "核验服务端租户成员关系"),
    "owned_test_fixture": ("identity.resource", "创建并绑定可回退的自有测试资源"),
    "state_readback": ("review.disposition", "准备同身份只读读回绑定"),
    "exact_authorized_url": ("recon.snapshot", "绑定精确的授权 URL 与请求方法"),
    "current_http_observation": ("recon.snapshot", "收集当前正常业务观察"),
    "dedicated_control_provider": ("action.help", "当前族缺少自动控制 provider；保留受阻分母，读取专门测试契约"),
    "exact_input_request_binding": ("http.capture", "提供同操作、同身份的完整实际基线并绑定精确输入"),
}


def _now():
    return datetime.now(timezone.utc)


def _age_days(value):
    try:
        parsed = datetime.fromisoformat(value)
        if parsed.tzinfo is None:
            return 0.0
        return max(0.0, (_now() - parsed).total_seconds() / 86400)
    except (TypeError, ValueError):
        return 0.0


def _cooldown_active(hypothesis):
    attempt = hypothesis.get("attempt") or {}
    if attempt.get("consecutive_failures", 0) < 2:
        return False
    until = attempt.get("cooldown_until")
    if not until:
        return False
    try:
        return datetime.fromisoformat(until) > _now()
    except (TypeError, ValueError):
        return False


def score(hypothesis, *, family_totals, family_tested, operation_importance=1.0, provider_cost=1.0):
    family = hypothesis.get("family", "generic")
    total = max(1, family_totals.get(family, 1))
    tested = min(total, family_tested.get(family, 0))
    gap_weight = 1.0 + (1.0 - tested / total)
    readiness = 0.2 if requires_preparation(hypothesis) else 1.0
    aging = min(1.5, 1.0 + _age_days(hypothesis.get("created_at")) * 0.05)
    cost = max(0.2, FAMILY_COST.get(family, 1.0) * provider_cost)
    value = (gap_weight * EXPLOITABILITY.get(family, 0.8) * operation_importance
             * readiness * aging / cost)
    return {
        "score": round(value, 6),
        "family_gap_weight": round(gap_weight, 6),
        "exploitability": EXPLOITABILITY.get(family, 0.8),
        "operation_importance": operation_importance,
        "readiness": readiness,
        "aging": round(aging, 6),
        "cost": round(cost, 6),
    }


def _operation_importance(universe, hypothesis):
    operation = next((row for row in universe.get("operations", [])
                      if row.get("operation_id") == hypothesis.get("operation_id")), None)
    if not operation:
        return 1.2 if str(hypothesis.get("operation_id", "")).startswith("PAGE:") else 1.0
    value = 1.0
    if operation.get("method") not in {"GET", "HEAD", "OPTIONS"}:
        value += 0.4
    if operation.get("auth") in {"authenticated", "restricted"}:
        value += 0.2
    if operation.get("ownership"):
        value += 0.2
    return value


def candidates(project, campaign, universe):
    """Return (ready, preparation) lists; never mutates attempt history."""
    repository = Repository(project)
    from .membership import rows as member_rows
    hypotheses = [row for row in member_rows(project, campaign, "hypothesis") if not row.get("superseded")]
    own_runs = {row["hypothesis_id"]: row for row in member_rows(project, campaign, "run") if row.get("mode") == "test"}
    measured_costs = {}
    from ..runtime import execution_backend
    samples = [row for row in repository.list("run", limit=None)[0]
               if isinstance(row.get("execution_receipt"), dict)
               and row["execution_receipt"].get("execution_backend") == execution_backend()
               and type(row["execution_receipt"].get("elapsed_ms")) in {int, float}
               and row["execution_receipt"]["elapsed_ms"] > 0 and row.get("mode") == "test"]
    reference = median([row["execution_receipt"]["elapsed_ms"] for row in samples]) if samples else None
    for sample in samples:
        related = repository.get("hypothesis", sample["hypothesis_id"], required=False)
        if related:
            measured_costs.setdefault(related["family"], []).append(sample["execution_receipt"]["elapsed_ms"])
    family_totals, family_tested = {}, {}
    for row in hypotheses:
        family_totals[row["family"]] = family_totals.get(row["family"], 0) + 1
        if row.get("status") in {"supported", "refuted"}:
            family_tested[row["family"]] = family_tested.get(row["family"], 0) + 1
    by_family = {}
    preparation = []
    for hypothesis in hypotheses:
        if hypothesis.get("status") == "not_applicable":
            preparation.append({"hypothesis_id": hypothesis["id"], "family": hypothesis["family"],
                                "operation_id": hypothesis["operation_id"], "status": "blocked",
                                "reason": "unverified_applicability", "next_action": "surface.inspect",
                                "next": {"action": "surface.inspect", "input": {"operation_id": hypothesis["operation_id"]}},
                                "offline_only": True, "automatic_retry_allowed": False, "denominator_retained": True})
            continue
        own_run = own_runs.get(hypothesis["id"])
        if hypothesis.get("shared_prior_run_id") or hypothesis.get("status") in {"supported", "refuted", "inconclusive"} and own_run is None:
            prior = [row for row in repository.list("run", limit=None)[0] if row.get("hypothesis_id") == hypothesis["id"] and row.get("mode") == "test"]
            preparation.append({"hypothesis_id": hypothesis["id"], "family": hypothesis["family"],
                                "operation_id": hypothesis["operation_id"], "reason": "shared_prior_result_not_campaign_proof",
                                "next_action": "test.inspect", "next": {"action": "test.inspect", "input": {"run_id": prior[-1]["id"]}} if prior else None,
                                "offline_only": True, "automatic_retry_allowed": False, "denominator_retained": True})
            continue
        from ..assessment_mode import mode as project_mode, stop_receipt
        operation = project.get("operation", hypothesis.get("operation_id"), required=False)
        stopped = stop_receipt(project, operation) if operation is not None else None
        if project_mode(project) == "src" and operation is not None \
                and (stopped or operation["method"] not in {"GET", "HEAD", "OPTIONS"}):
            preparation.append({"hypothesis_id": hypothesis["id"], "family": hypothesis["family"],
                                "operation_id": operation["id"], "reason": "stopped_at_evidence" if stopped else "src_write_denied",
                                "next_action": "review.evidence" if stopped else "recon.snapshot",
                                "automatic_execution_allowed": False,
                                "detail": "SRC 保留直接证据与未测范围，不为补齐覆盖度而继续利用。"})
            continue
        if hypothesis.get("status") not in {"ready", "unplanned"}:
            if hypothesis.get("status") == "inconclusive":
                last_run = (hypothesis.get("run_ids") or [None])[-1]
                preparation.append({"hypothesis_id": hypothesis["id"], "family": hypothesis["family"],
                                    "operation_id": hypothesis.get("operation_id"), "status": "inconclusive",
                                    "reason": (hypothesis.get("attempt") or {}).get("blocked_reason") or "Controls were inconclusive",
                                    "next_action": "test.inspect", "next": {"action": "test.inspect", "input": {"run_id": last_run}},
                                    "offline_only": True, "automatic_execution_allowed": False,
                                    "automatic_retry_allowed": False, "denominator_retained": True})
            elif requires_preparation(hypothesis):
                preparation.append(_preparation_entry(hypothesis))
            continue
        lease = hypothesis.get("lease")
        if lease and lease.get("expires_at"):
            try:
                if datetime.fromisoformat(lease["expires_at"]) > _now():
                    continue
            except (TypeError, ValueError):
                pass
        if _cooldown_active(hypothesis):
            preparation.append({
                "hypothesis_id": hypothesis["id"], "family": hypothesis["family"],
                "reason": "attempt_cooldown",
                "next_action": "campaign.next",
                "detail": "连续两次无进展；换族/换操作或修复前提后再试，不重复同一任务。",
            })
            continue
        history = measured_costs.get(hypothesis["family"], [])
        provider_cost = min(8.0, max(0.25, median(history) / reference)) if history and reference else 1.0
        score_row = score(hypothesis, family_totals=family_totals, family_tested=family_tested,
                          operation_importance=_operation_importance(universe, hypothesis), provider_cost=provider_cost)
        score_row.update(cost_source="measured_family_wall_time" if history else "heuristic_no_runtime_samples",
                         cost_samples=len(history), measured_median_ms=median(history) if history else None,
                         exploitability_source="uncalibrated_heuristic_not_precision")
        by_family.setdefault(hypothesis["family"], []).append((score_row, hypothesis))
    for family_rows in by_family.values():
        family_rows.sort(key=lambda item: (-item[0]["score"], item[1]["id"]))
    return by_family, preparation


def _preparation_entry(hypothesis):
    missing = hypothesis.get("missing_context") or []
    actions = []
    for item in missing:
        if item in _PREP_ACTIONS:
            action, reason = _PREP_ACTIONS[item]
            actions.append({"missing_context": item, "action": action, "reason": reason})
    automatic = hypothesis.get("automatic_preparation") or {}
    preparation = automatic.get("preparation") or {}
    if automatic.get("provider_supported") is False:
        actions = [{"missing_context": "dedicated_control_provider", "action": "action.help",
                    "input": preparation.get("input") or {"name": "test.run_scenario"},
                    "reason": hypothesis.get("state_reason") or "No automatic provider implements this family."}]
    return {
        "hypothesis_id": hypothesis["id"],
        "family": hypothesis["family"],
        "operation_id": hypothesis.get("operation_id"),
        "missing_context": missing,
        "status": hypothesis.get("status"),
        "next_action": actions[0]["action"] if actions else "review.disposition",
        "preparation_actions": actions,
        "automatic_execution_allowed": False,
        "state_reason": hypothesis.get("state_reason"),
        "provider_supported": automatic.get("provider_supported"),
        "capability": automatic.get("capability"),
        "denominator_retained": True,
    }


def next_hypotheses(project, campaign, universe, *, limit=3):
    """Return complete scheduling rows in fair family order.

    If only one family is ready the result contains one family; diversity is
    never fabricated.  ``next`` does not increment attempt counts.
    """
    integer(limit, "limit", minimum=1, maximum=25)
    by_family, preparation = candidates(project, campaign, universe)
    families = sorted(by_family)
    if not families:
        return [], preparation, {"families_ready": 0, "diversity": 0, "score_model": "family_gap_v1"}
    cursor = (campaign.get("cursor") or {}).get("family_index", 0)
    # Start round-robin at the persisted cursor so long histories do not starve later families.
    ordered = families[cursor % len(families):] + families[:cursor % len(families)]
    selected = []
    depth = 0
    while len(selected) < limit:
        # One hypothesis per family is the default breadth guarantee. Only
        # take a second hypothesis from a family when there are enough
        # families to preserve the requested diversity; never pad a short
        # ready set with same-family duplicates.
        if depth > 0 and len(families) < limit:
            break
        progressed = False
        for family in ordered:
            rows = by_family.get(family, [])
            if depth < len(rows):
                selected.append(rows[depth])
                progressed = True
                if len(selected) >= limit:
                    break
        if not progressed:
            break
        depth += 1
    families_selected = []
    for _, hypothesis in selected:
        if hypothesis["family"] not in families_selected:
            families_selected.append(hypothesis["family"])
    campaign["cursor"] = {"family_index": (cursor + len(families_selected)) % len(families),
                          "operation_index": 0, "offset": 0}
    return selected, preparation[:max(20, limit * 2)], {
        "families_ready": len(families),
        "diversity": len(families_selected),
        "score_model": "family_gap_v1",
    }


def claim(project, hypothesis_id, *, worker_id, ttl_seconds=300):
    repository = Repository(project)
    hypothesis = repository.get("hypothesis", hypothesis_id)
    lease = hypothesis.get("lease")
    if lease and lease.get("expires_at"):
        try:
            expires_at = datetime.fromisoformat(lease["expires_at"])
        except (TypeError, ValueError):
            expires_at = None
        if expires_at is not None and expires_at > _now() and lease.get("worker_id") != worker_id:
            fail("v2_scheduler_lease", "Hypothesis is already claimed by another worker")
    from datetime import timedelta
    hypothesis["lease"] = {"worker_id": text(worker_id, "worker_id", maximum=128),
                           "claimed_at": utc_now(),
                           "expires_at": (_now() + timedelta(seconds=integer(
                               ttl_seconds, "ttl_seconds", minimum=1, maximum=86400))).isoformat()}
    repository.save("hypothesis", hypothesis)
    return hypothesis["lease"]


def release(project, hypothesis_id, *, worker_id):
    repository = Repository(project)
    hypothesis = repository.get("hypothesis", hypothesis_id)
    lease = hypothesis.get("lease") or {}
    if lease.get("worker_id") != worker_id:
        fail("v2_scheduler_lease", "Only the claiming worker can release this hypothesis")
    hypothesis["lease"] = None
    repository.save("hypothesis", hypothesis)
    return {"hypothesis_id": hypothesis_id, "released": True}
