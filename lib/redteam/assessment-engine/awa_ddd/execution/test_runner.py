"""Durable 2.0 test runner: one call performs preflight, controlled execution,
evidence persistence, oracle evaluation and coverage delta — while keeping each
durable step separate and never replaying uncertain writes.
"""
from __future__ import annotations

import base64
import json
import math
import time

from .. import engine
from ..domain import new_finding, new_run
from ..domain.common import digest, fail, text, utc_now
from ..domain.repository import Repository
from ..domain.test_recipe import assert_current, public_view as recipe_public, render
from ..domain.test_run import add_step, claim as claim_run, mark_effect_unknown, public_view as run_public, transition as run_transition
from ..store import EngineError
from . import oracle_profiles


def _campaign(project, campaign_id):
    campaign = Repository(project).get("campaign", campaign_id)
    if campaign.get("state") != "active":
        fail("v2_campaign_state", "Campaign is not active")
    return campaign


def _operation(project, recipe):
    operation = project.get("operation", recipe["bindings"]["operation_id"], required=False)
    if operation is None:
        fail("v2_recipe_stale", "Recipe operation no longer exists")
    return operation


def _session_context(project, recipe):
    session = recipe.get("bindings", {}).get("session")
    if not session:
        return None
    current = project.get("session", session["session_id"], required=False)
    if current is None:
        fail("v2_recipe_stale", "Recipe session no longer exists")
    return {"session_id": current["id"], "generation": current.get("generation", 1),
            "actor_id": current.get("actor_id")}


def _resource_context(project, recipe):
    resource = recipe.get("bindings", {}).get("resource")
    if not resource:
        return None
    current = project.get("resource", resource["resource_id"], required=False)
    if current is None:
        fail("v2_recipe_stale", "Recipe resource no longer exists")
    return {"resource_id": current["id"], "revision": current.get("revision", 1)}


def _fixture_context(project, recipe):
    binding = recipe.get("bindings", {}).get("fixture")
    if not binding:
        return None
    row = Repository(project).get("fixture", binding["fixture_id"], required=False)
    if row is None:
        fail("v2_recipe_stale", "Recipe fixture no longer exists")
    return {"fixture_id": row["id"], "revision": row.get("revision", 1), "state": row.get("state")}


def context(project, campaign, recipe):
    operation = _operation(project, recipe)
    selected = (recipe.get("bindings", {}).get("consumer_context") or {}).get("input")
    if selected is not None and selected not in operation.get("inputs", []):
        fail("v2_recipe_stale", "The exact input consumer or mechanism contract changed; prepare a new recipe")
    universe = Repository(project).get("universe", campaign.get("universe_id"), required=False)
    result = {
        "scope_epoch": campaign.get("scope_epoch"),
        "target_build": (universe or {}).get("target_build"),
        "operation_signature": engine.operation_signature(operation),
        "session": _session_context(project, recipe),
        "resource": _resource_context(project, recipe),
        "fixture": _fixture_context(project, recipe),
    }
    if recipe.get("bindings", {}).get("sessions") is not None:
        from .authorization_provider import session_binding
        result["sessions"] = [session_binding(project, project.get("session", row["session_id"]))
                              for row in recipe["bindings"]["sessions"]]
        resource = (recipe["bindings"].get("resource") or {}).get("resource_id")
        result["resource_signature"] = engine.resource_signature(project.get("resource", resource)) if resource else None
        baseline, unused_artifact = engine.verify_current_evidence(project, recipe["bindings"]["baseline_evidence_id"])
        if baseline["sha256"] != recipe["bindings"].get("baseline_sha256"):
            fail("v2_recipe_stale", "The exact allowed-principal baseline changed")
    return result


def _existing(project, idempotency_key):
    for row in Repository(project).list("run", limit=None)[0]:
        if row.get("idempotency_key") == idempotency_key:
            return row
    return None


def _capture_args(recipe, control, *, idempotency_key):
    request = control["request"]
    args = {
        "operation_id": recipe["bindings"]["operation_id"],
        "url": request["url"],
        "method": request.get("method"),
        "headers": request.get("headers") or {},
        "idempotency_key": idempotency_key,
        "timeout": 30,
    }
    if "body" in request:
        args["body"] = request["body"]
    if "body_base64" in request:
        args["body_base64"] = request["body_base64"]
    session = control.get("session") if "session" in control else recipe["bindings"].get("session")
    if session:
        args["session_id"] = session["session_id"]
    resource = recipe["bindings"].get("resource")
    if resource:
        args["resource_id"] = resource["resource_id"]
    effect = recipe.get("limits", {}).get("effect", "read_only")
    args["effect"] = effect
    return args


def _evidence_value(project, evidence_id, selector):
    evidence = project.get("evidence", evidence_id)
    artifact = project.read_artifact(evidence)
    response = artifact.get("response", {})
    try:
        body = base64.b64decode(response.get("body_base64", ""), validate=True)
    except (ValueError, TypeError):
        body = b""
    content_type = ""
    for pair in response.get("headers", []):
        if isinstance(pair, (list, tuple)) and len(pair) == 2 and str(pair[0]).lower() == "content-type":
            content_type = str(pair[1]).lower()
    text_body = body.decode("utf-8", errors="replace")
    parsed = None
    if "json" in content_type or text_body.lstrip()[:1] in "[{":
        try:
            parsed = json.loads(text_body)
        except json.JSONDecodeError:
            parsed = None
    if selector == "status":
        return response.get("status")
    if selector == "body":
        return text_body
    if selector.startswith("header:"):
        name = selector.split(":", 1)[1].lower()
        for pair in response.get("headers", []):
            if len(pair) == 2 and str(pair[0]).lower() == name:
                return pair[1]
        return None
    if selector.startswith("text:"):
        return selector.split(":", 1)[1] in text_body
    pointer_path = selector[5:] if selector.startswith("json:") else selector
    if parsed is not None and isinstance(pointer_path, str) and pointer_path.startswith("/"):
        from ..transport import pointer as resolve_pointer
        try:
            return resolve_pointer(parsed, pointer_path)
        except EngineError as error:
            if error.code != "selector":
                raise
            return None
        except (KeyError, IndexError, TypeError):
            return None
    return text_body


def _observation_map(recipe, control_results):
    observations = {}
    by_id = {control["id"]: result for control, result in control_results}
    observations["independent_controls"] = len({result.get("evidence_id") for control, result in control_results}) == len(control_results)
    for control, result in control_results:
        role = control["role"]
        actual = result.get("actual")
        if control.get("observe_as"):
            observations[control["observe_as"]] = actual
        observations[role + "_actual"] = actual
        observations[role + "_matched"] = result.get("matched")
        observations[role + "_expected"] = control.get("expected", {}).get("value")
    family = recipe.get("family")
    oracle = recipe.get("oracle", {})
    if family == "sql_injection":
        by_role = {control["role"]: result for control, result in control_results}
        if all(role in by_role for role in ("normal", "attack", "negative")):
            values = [by_role[role].get("actual") for role in ("normal", "attack", "negative")]
            numeric = all(isinstance(value, (int, float)) and not isinstance(value, bool)
                          and math.isfinite(value) and value >= 0 for value in values)
            identities = [by_role[role].get("identity") for role in ("normal", "attack", "negative")]
            expected_actor = ((recipe.get("bindings") or {}).get("session") or {}).get("actor_id")
            observations.update(baseline=values[0], attack=values[1], negative_control=values[2],
                                business_count_change=values[1] - values[0] if numeric else None,
                                same_identity=all(isinstance(identity, dict) and identity.get("actor_id") == expected_actor
                                                  for identity in identities) and identities[0] == identities[1] == identities[2],
                                controls_complete=all(by_role[role].get("complete") is True for role in by_role))
        if oracle.get("type") == "sql_boolean":
            observations.update(baseline=by_id.get("normal", {}).get("actual"),
                                true_control=by_id.get("attack", {}).get("actual"),
                                false_control=by_id.get("negative", {}).get("actual"),
                                second_true=by_id.get("sensitivity", {}).get("actual"),
                                second_false=by_id.get("second_false", {}).get("actual"),
                                sql_context=oracle.get("sql_context"))
    if family == "access_control":
        observations.setdefault("allowed_role_result", observations.get("normal_actual"))
        observations.setdefault("forbidden_role_result", observations.get("attack_actual"))
        observations.setdefault("anonymous_result", observations.get("negative_actual"))
        observations.setdefault("server_role_evidence", bool((recipe.get("bindings") or {}).get("session")))
        if recipe.get("provider", {}).get("profile") == "native_authorization_read":
            observations["allowed_role_result"] = by_id.get("normal", {}).get("authorization")
            observations["forbidden_role_result"] = by_id.get("attack", {}).get("authorization")
            observations["anonymous_result"] = by_id.get("negative", {}).get("authorization")
            observations["server_role_evidence"] = bool(recipe["bindings"].get("sessions"))
            observations["policy_kind"] = recipe["oracle"]["policy_kind"]
    if family == "template_injection":
        attack_payload = observations.get("attack_expected")
        observations.setdefault("declared_formula_field", oracle.get("declared_formula_field"))
        observations.setdefault("normal_plain_value", observations.get("normal_actual"))
        observations.setdefault("attack_arithmetic_value", observations.get("attack_actual"))
        observations.setdefault("negative_literal_value", observations.get("negative_actual"))
        observations.setdefault("expected_arithmetic_result", oracle.get("expected_value"))
        observations.setdefault("reflection_exclusion", observations.get("attack_actual") != attack_payload)
        observations["template_dialect"] = oracle.get("template_dialect")
        observations["sensitivity_value"] = by_id.get("sensitivity", {}).get("actual")
        observations["sensitivity_expected"] = oracle.get("sensitivity_expected")
    if family == "deserialization":
        observations.setdefault("attack_type_marker", observations.get("attack_actual"))
        observations.setdefault("bounded_canary_effect", observations.get("canary_effect"))
        observations.setdefault("negative_unknown_type", observations.get("negative_actual"))
    if family == "file_upload":
        observations.setdefault("stored_path", observations.get("attack_actual"))
        observations.setdefault("allowed_root", oracle.get("allowed_root"))
    return observations


def _eval_from_results(recipe, control_results):
    observations = _observation_map(recipe, control_results)
    oracle_type = recipe.get("oracle", {}).get("type")
    profile = oracle_profiles.profile(oracle_type)
    if recipe.get("oracle", {}).get("version") != profile["version"]:
        fail("v2_oracle_version", "The frozen oracle version is no longer current; preserve old materials and prepare a new recipe")
    if recipe.get("oracle", {}).get("proof_scope") != profile["proof_scope"]:
        fail("v2_oracle_scope", "Frozen oracle scope does not match its mechanism contract")
    result = oracle_profiles.evaluate(oracle_type, observations)
    result["oracle_type"] = oracle_type
    result["oracle_version"] = profile["version"]
    result["proof_scope"] = recipe.get("oracle", {}).get("proof_scope") if result.get("outcome") == "supported" else None
    result["observations"] = observations
    result["severity_cap"] = profile["severity_cap"]
    return result


def _control_result(project, recipe, control, evidence_id):
    from .request_builder import verify_control_evidence
    meta, _ = verify_control_evidence(project, recipe, control, evidence_id)
    actual = _evidence_value(project, evidence_id, control.get("expected", {}).get("selector", "body"))
    expected = control.get("expected", {}).get("value")
    result = {"evidence_id": evidence_id, "actual": actual,
            "matched": str(actual).strip() == str(expected).strip() if expected is not None else None,
            "complete": meta.get("complete") is True,
            "identity": {"actor_id": meta.get("actor_id"), "session_id": meta.get("session_id"),
                         "generation": meta.get("session_generation")}}
    if recipe.get("provider", {}).get("profile") == "native_authorization_read":
        resource = (recipe["bindings"].get("resource") or {}).get("resource_id")
        contract = recipe["bindings"]["authorization_contract"]
        selector = contract.get("resource_selector")
        actual_resource = _evidence_value(project, evidence_id, selector) if selector else None
        expected_resource = project.get("resource", resource)["external_id"] if resource else None
        owner = project.get("actor", project.get("resource", resource)["owner_actor_id"]) if resource else None
        owner_matches = not resource or engine._same_binding_value(_evidence_value(project, evidence_id, contract["owner_selector"]), owner["subject"])
        tenant_matches = not owner or not owner.get("tenant_id") or engine._same_binding_value(
            _evidence_value(project, evidence_id, contract["tenant_selector"]), owner["tenant_id"])
        result["authorization"] = {"status": _evidence_value(project, evidence_id, "status"),
                                   "protected_value": actual, "resource_matches": engine._same_binding_value(actual_resource, expected_resource)
                                   and owner_matches and tenant_matches if resource and selector else True}
    return result


def _execution_receipt(run_row, recipe, started, receipts, *, unresolved=False):
    from ..runtime import execution_backend
    def measured(name):
        values = [row.get(name) for row in receipts]
        return sum(values) if not unresolved and all(type(value) is int and value >= 0 for value in values) else None
    run_row["execution_receipt"] = {"schema": "awa-test-execution/v1", "execution_backend": execution_backend(),
                                    "provider": recipe["provider"]["name"], "profile": recipe["provider"]["profile"],
                                    "elapsed_ms": round((time.monotonic() - started) * 1000, 3),
                                    **{name: measured(name) for name in ("requests_sent", "responses_received", "dispatch_attempts", "response_bytes")},
                                    "http_receipts": len(receipts), "browser_navigations": len(run_row.get("browser_visit_ids") or []),
                                    "all_target_requests_known": recipe["provider"]["name"] != "browser" and measured("requests_sent") is not None,
                                    "tokens": None}


def run(project, args):
    """Execute observe/test/verify under one durable run record."""
    mode = args.get("mode", "test")
    campaign = _campaign(project, args.get("campaign_id"))
    repository = Repository(project)
    recipe = None
    hypothesis = None
    from ..planning.membership import hypothesis as member_hypothesis
    if args.get("recipe_id"):
        recipe = repository.get("recipe", args["recipe_id"])
        hypothesis = member_hypothesis(project, campaign, recipe["hypothesis_id"])
    elif args.get("hypothesis_id"):
        hypothesis = member_hypothesis(project, campaign, args["hypothesis_id"])
        if mode != "verify":
            from .recipe_builder import build
            universe = repository.get("universe", campaign.get("universe_id"))
            built = build(project, campaign, universe, hypothesis)
            if built["status"] != "ready":
                fail("v2_recipe_blocked", built.get("reason", "Hypothesis prerequisites are missing"),
                     missing=built.get("missing", []), next_action="campaign.next")
            recipe = built["recipe"]
            existing_recipe = repository.get("recipe", recipe["id"], required=False)
            if existing_recipe is not None:
                recipe = existing_recipe
            else:
                repository.add("recipe", recipe, immutable=True)
    elif mode == "verify" and args.get("run_id"):
        prior = repository.get("run", args["run_id"])
        if prior.get("campaign_id") != campaign["id"]:
            fail("v2_run_verify", "The prior run belongs to another campaign")
        recipe = repository.get("recipe", prior["recipe_id"])
        hypothesis = member_hypothesis(project, campaign, prior["hypothesis_id"])
    if hypothesis is None:
        fail("v2_run_recipe", "test.run requires recipe_id or hypothesis_id")
    from ..planning.membership import require_hypothesis
    require_hypothesis(project, campaign, hypothesis["id"])
    if mode == "verify":
        if recipe is None and not args.get("run_id"):
            recipe_ids = {row.get("recipe_id") for row in repository.list("run", limit=None)[0]
                          if row.get("hypothesis_id") == hypothesis["id"] and row.get("campaign_id") == campaign["id"]
                          and row.get("mode") == "test" and row.get("status") in {"evaluated", "published"}}
            recipe_ids.discard(None)
            if len(recipe_ids) > 1:
                fail("v2_run_verify", "Multiple frozen recipes were tested in this campaign; provide the exact recipe_id or run_id")
            recipe = repository.get("recipe", next(iter(recipe_ids)), required=False) if recipe_ids else None
        return _verify(project, args, campaign, hypothesis, recipe)
    idempotency_key = text(args.get("idempotency_key") or ("run:" + hypothesis["id"] + ":" + utc_now()),
                           "idempotency_key", maximum=256)
    existing = _existing(project, idempotency_key)
    if existing:
        if existing.get("campaign_id") != campaign["id"] or recipe is not None and existing.get("recipe_id") != recipe["id"]:
            fail("idempotency_conflict", "Idempotency key already belongs to a different recipe")
        return {"run": run_public(existing), "replayed": False,
                "notice": "Idempotency key already belongs to a durable run; no request was sent again."}
    if recipe is None:
        fail("v2_run_recipe", "No recipe is available")
    assert_current(recipe, context(project, campaign, recipe))
    from ..assessment_mode import capture_policy
    capture_policy(project, _operation(project, recipe),
                   {"effect": recipe.get("limits", {}).get("effect", "read_only")})
    fixture_id = _execution_prerequisites(project, repository, campaign, hypothesis, recipe, args, mode)
    from ..domain.hypothesis import transition as hypothesis_transition
    if hypothesis.get("status") == "unplanned":
        hypothesis_transition(hypothesis, "ready", reason="scheduler selected the hypothesis")
    run_row = new_run(recipe=recipe, campaign_id=campaign["id"], idempotency_key=idempotency_key,
                      actor_id=(recipe["bindings"].get("session") or {}).get("actor_id"), mode=mode)
    if fixture_id:
        run_row["fixture_id"] = fixture_id
    repository.add("run", run_row, immutable=False)
    claim_run(run_row, args.get("worker_id", "local"), ttl_seconds=args.get("lease_seconds", 300))
    if mode == "test" and hypothesis.get("status") == "ready":
        hypothesis_transition(hypothesis, "running", reason="durable test run started")
        repository.save("hypothesis", hypothesis)
    run_transition(run_row, "dispatch_started", note="first control dispatch")
    run_row["dispatch_started_at"] = utc_now()
    repository.save("run", run_row)
    effect = recipe.get("limits", {}).get("effect", "read_only")
    control_results = []
    evidence_ids = []
    browser_visits = []
    execution_started, receipts, current_capture_saved = time.monotonic(), [], True
    dispatched = False
    try:
        executable = render(recipe, args.get("variables"))
        groups = executable.get("control_groups") or recipe.get("control_groups", [])
        if len(groups) != 1:
            fail("v2_control_provider", "The automatic HTTP runner requires one complete control group; use a dedicated provider for multiple identities")
        planned = groups[0].get("controls", []) if groups else []
        if mode == "observe":
            planned = [control for control in planned if control.get("role") == "normal"][:1]
        if not planned:
            fail("v2_run_controls", "Recipe has no executable controls")
        for control in planned:
            capture_args = _capture_args(recipe, control, idempotency_key=idempotency_key + ":" + control["id"])
            prepared = engine.preflight_capture(project, capture_args)
            dispatched = True
            current_capture_saved = False
            evidence = engine.capture(project, capture_args)
            evidence_ids.append(evidence["id"])
            current_capture_saved = True
            reused = prepared["existing"] is not None
            receipt = evidence.get("execution_receipt") or {}
            receipts.append({name: 0 if reused else receipt.get(name)
                             for name in ("requests_sent", "responses_received", "dispatch_attempts", "response_bytes")})
            control_results.append((control, _control_result(project, recipe, control, evidence["id"])))
            add_step(run_row, step_id=control["id"], action="http.capture",
                     response_digest=evidence.get("sha256"), status="completed")
            if recipe["provider"]["name"] == "browser":
                from .browser_provider import observe_control
                browser_visits.append(observe_control(project, recipe, control))
                run_row["browser_visit_ids"] = list(browser_visits)
                run_row["evidence_ids"] = list(evidence_ids)
                add_step(run_row, step_id=control["id"] + "-browser", action="browser.visit",
                         response_digest=project.get("page_visit", browser_visits[-1])["sha256"], status="completed")
            _execution_receipt(run_row, recipe, execution_started, receipts)
            repository.save("run", run_row)
    except Exception as error:
        exc = error if isinstance(error, EngineError) else EngineError("v2_control_execution", "Control processing failed; inspect its saved run before another execution")
        _execution_receipt(run_row, recipe, execution_started, receipts,
                           unresolved=not current_capture_saved and exc.details.get("requests_sent") != 0)
        if effect == "test_resource_write" and dispatched:
            mark_effect_unknown(run_row, reason=str(exc))
            run_row["evidence_ids"] = evidence_ids
            repository.save("run", run_row)
            _failure_outcome(project, repository, hypothesis, run_row, "effect_unknown", "Actual fixture readback and reconciliation are required")
            return {"run": run_public(run_row), "outcome": "effect_unknown", "requires_reconciliation": True,
                    "notice": "A write may have reached the target; inspect its run and read back fixture state before any retry."}
        run_transition(run_row, "failed", note=str(exc))
        run_row["error"] = {"code": exc.code, "message": str(exc)}
        run_row["evidence_ids"] = evidence_ids
        repository.save("run", run_row)
        if mode == "test":
            _failure_outcome(project, repository, hypothesis, run_row, "execution_failed", "Inspect the saved control and repair its actual request prerequisites")
        exc.details = {**exc.details, "run_id": run_row["id"], "hypothesis_id": hypothesis["id"],
                       "next_action": "test.inspect", "automatic_retry_allowed": False}
        if exc is error:
            raise
        raise exc from error
    run_row["evidence_ids"] = evidence_ids
    _execution_receipt(run_row, recipe, execution_started, receipts)
    run_transition(run_row, "response_saved", note="all planned controls captured")
    if mode == "observe":
        run_row["evaluation"] = {"outcome": "observed", "finding_allowed": False,
                                 "limitations": ["Observe mode records evidence but does not test a hypothesis."]}
        run_row["outcome"] = "observed"
        run_transition(run_row, "evaluation_pending", note="observation evaluation")
        run_transition(run_row, "evaluated", note="observation only")
        repository.save("run", run_row)
        return {"run": run_public(run_row), "outcome": "observed", "coverage_delta": {"tested": 0}}
    run_transition(run_row, "evaluation_pending", note="oracle evaluation")
    repository.save("run", run_row)
    try:
        if recipe["provider"]["name"] == "browser":
            from .browser_provider import evaluate_recipe
            evaluation = evaluate_recipe(project, recipe, run_row)
        else:
            evaluation = _eval_from_results(recipe, control_results)
    except Exception as error:
        run_transition(run_row, "failed", note="offline oracle processing failed")
        run_row["error"] = {"code": getattr(error, "code", "v2_oracle_processing"),
                            "message": "Captured controls are saved; inspect and re-evaluate offline"}
        repository.save("run", run_row)
        _failure_outcome(project, repository, hypothesis, run_row, "execution_failed", "Re-evaluate the saved complete controls offline; do not repeat target requests")
        raise EngineError("v2_oracle_processing", run_row["error"]["message"],
                          {"run_id": run_row["id"], "next_action": "test.inspect", "automatic_retry_allowed": False}) from error
    finding = None
    if evaluation["outcome"] == "supported" and evaluation.get("finding_allowed"):
        claim = _machine_claim(recipe)
        finding = new_finding(
            hypothesis_id=hypothesis["id"], run_id=run_row["id"], mode="machine",
            severity=_severity(recipe.get("family"), recipe.get("oracle", {}).get("type")), title=claim["title"],
            category=claim["category"], impact=claim["impact"],
            remediation="Apply the mechanism-specific fix and re-run the same frozen recipe.",
            evidence_ids=evidence_ids, proof_scope=evaluation.get("proof_scope") or recipe["oracle"]["proof_scope"],
            decision_id=run_row["id"], limitations=list(dict.fromkeys(claim["limitations"] + (evaluation.get("limitations") or []))))
        finding["claim_contract"] = claim
        repository.add("finding", finding, immutable=False)
        run_row["finding_ids"] = [finding["id"]]
        hypothesis["finding_ids"] = sorted(set(hypothesis.get("finding_ids", []) + [finding["id"]]))
    _apply_outcome(project, repository, hypothesis, run_row, evaluation, mode=mode)
    run_row["evaluation"] = evaluation
    run_row["outcome"] = evaluation.get("outcome")
    run_transition(run_row, "evaluated", note="oracle evaluated")
    repository.save("run", run_row)
    if finding is not None:
        from ..assessment_mode import record_stop
        record_stop(project, operation_id=hypothesis["operation_id"], evidence_ids=evidence_ids,
                    decision_id=run_row["id"], finding_id=finding["id"],
                    oracle_type=recipe.get("oracle", {}).get("type"))
    return {"run": run_public(run_row), "outcome": evaluation["outcome"], "finding": finding,
            "coverage_delta": {"tested": 1 if evaluation["outcome"] in {"supported", "refuted"} else 0,
                               "attempted": 1, "conclusive": int(evaluation["outcome"] in {"supported", "refuted"}),
                               "finding_created": bool(finding), "family": hypothesis["family"]}}


def _severity(family, oracle_type):
    proposed = {"sql_injection": "high", "command_injection": "critical", "template_injection": "high",
            "deserialization": "high", "xss": "medium", "ssrf": "medium", "xxe": "medium",
            "file_upload": "high", "path_traversal": "medium", "access_control": "high",
            "business_logic": "medium", "generic": "low"}.get(family, "low")
    ranks = ["info", "low", "medium", "high", "critical"]
    cap = oracle_profiles.profile(oracle_type)["severity_cap"]
    return ranks[min(ranks.index(proposed), ranks.index(cap))] if cap in ranks else "info"


def _machine_claim(recipe):
    from ..proof_claim import machine_claim
    entry = (recipe.get("bindings", {}).get("consumer_context") or {}).get("input") or {}
    return machine_claim(family=recipe.get("family", "generic"), oracle_type=recipe["oracle"]["type"],
                         operation_id=recipe["bindings"]["operation_id"], input_location=entry.get("location"),
                         input_selector=entry.get("selector", entry.get("name")), model="v2")


def _execution_prerequisites(project, repository, campaign, hypothesis, recipe, args, mode):
    from ..domain.common import integer
    text(args.get("worker_id", "local"), "worker_id", maximum=128)
    integer(args.get("lease_seconds", 300), "lease_seconds", minimum=1, maximum=86400)
    effect = recipe.get("limits", {}).get("effect", "read_only")
    if mode not in {"test", "observe"}:
        fail("v2_run_mode", "Execution mode must be test or observe")
    if mode == "test":
        if hypothesis.get("status") not in {"ready", "unplanned"} or hypothesis.get("missing_context"):
            fail("v2_run_prerequisite", "The hypothesis is not ready; resolve its actual prerequisites before execution", next_action="campaign.next")
        from ..planning.scheduler import _cooldown_active
        if _cooldown_active(hypothesis):
            fail("v2_attempt_cooldown", "This exact task is cooling down after repeated failures; preserve its failure history", next_action="test.inspect")
    if recipe["provider"]["name"] == "browser":
        from .capabilities import ready_for
        ready = ready_for(project, provider="playwright", profile=recipe["provider"]["profile"],
                          authenticated=bool(recipe["bindings"].get("session")))
        if not ready["ready"]:
            fail("browser_unavailable", "Current profile readiness is required before the first browser control",
                 reasons=ready["reasons"], requests_sent=0)
    for prior in repository.list("run", limit=None)[0]:
        if prior.get("hypothesis_id") != hypothesis["id"]:
            continue
        if (prior.get("effect") or {}).get("unknown") and not (prior.get("effect") or {}).get("reconciled"):
            fail("v2_effect_unreconciled", "This task has an uncertain write; inspect the run and reconcile actual fixture state before another execution", run_id=prior["id"], next_action="test.inspect")
        if prior.get("status") in {"prepared", "claimed", "dispatch_started", "response_saved", "evaluation_pending"}:
            fail("v2_run_inflight", "This exact task already has an unfinished durable run; inspect it before executing again", run_id=prior["id"], next_action="test.inspect")
    if mode == "observe" and effect != "read_only":
        fail("v2_observe_effect", "Observe mode is read-only; writes require an authorized test fixture")
    if effect != "test_resource_write":
        return None
    if not (campaign.get("allow_mutation") and project.config.get("allow_mutation")):
        fail("v2_write_authorization", "Write recipe requires campaign and project allow_mutation")
    fixture = repository.get("fixture", (recipe.get("bindings", {}).get("fixture") or {}).get("fixture_id"), required=False)
    if fixture is None or fixture.get("state") not in {"verified", "leased", "readback_ok"}:
        fail("v2_fixture_state", "Write recipe requires a current verified and leaseable fixture")
    if fixture.get("state") == "leased" and (fixture.get("lease") or {}).get("worker_id") != args.get("worker_id", "local"):
        fail("v2_fixture_lease", "Fixture is leased by another worker")
    return fixture["id"]


def _failure_outcome(project, repository, hypothesis, run_row, outcome, reason):
    from ..domain.hypothesis import record_attempt, transition
    if hypothesis.get("status") in {"running", "ready", "unplanned", "inconclusive"}:
        transition(hypothesis, "blocked", reason=reason)
    hypothesis["execution_blocker"] = {"run_id": run_row["id"], "outcome": outcome,
                                       "automatic_retry_allowed": False}
    from .recipe_builder import prerequisite_fingerprint
    try:
        fingerprint = prerequisite_fingerprint(project, hypothesis)
    except (EngineError, OSError, ValueError, KeyError, TypeError):
        fingerprint = None
    hypothesis["automatic_preparation"] = {"prerequisite_fingerprint": fingerprint, "provider_supported": True}
    record_attempt(hypothesis, outcome=outcome, run_id=run_row["id"], reason=reason)
    repository.save("hypothesis", hypothesis)


def _apply_outcome(project, repository, hypothesis, run_row, evaluation, *, mode):
    from ..domain.hypothesis import record_attempt, transition
    outcome = evaluation.get("outcome")
    if outcome == "supported":
        transition(hypothesis, "supported", reason="oracle supported")
    elif outcome == "refuted":
        transition(hypothesis, "refuted", reason="oracle refuted")
    elif outcome == "inconclusive":
        transition(hypothesis, "inconclusive", reason="oracle inconclusive")
    record_attempt(hypothesis, outcome=outcome, run_id=run_row["id"],
                   reason="; ".join(evaluation.get("limitations") or []))
    from .recipe_builder import prerequisite_fingerprint
    hypothesis["automatic_preparation"] = {**(hypothesis.get("automatic_preparation") or {}),
        "prerequisite_fingerprint": prerequisite_fingerprint(project, hypothesis)}
    repository.save("hypothesis", hypothesis)
    known_case_id = hypothesis.get("known_case_id")
    if known_case_id:
        known_case = repository.get("known_case", known_case_id, required=False)
        if known_case is not None and outcome in {"supported", "refuted", "inconclusive"}:
            known_case["status"] = "reported" if outcome == "supported" and run_row.get("finding_ids") else \
                "verified" if outcome in {"supported", "refuted"} else "blocked"
            repository.save("known_case", known_case)
    run_row["hypothesis_status"] = hypothesis["status"]
    return hypothesis


def _verify(project, args, campaign, hypothesis, recipe):
    """Zero-request re-evaluation of existing evidence or a persisted run."""
    evidence_ids = args.get("evidence_ids") or []
    if args.get("run_id"):
        prior = Repository(project).get("run", args["run_id"])
        if prior.get("campaign_id") != campaign["id"] or prior.get("hypothesis_id") != hypothesis["id"]:
            fail("v2_run_verify", "The prior run must belong to this campaign and exact hypothesis")
        evidence_ids = evidence_ids or prior.get("evidence_ids") or []
        recipe = recipe or Repository(project).get("recipe", prior["recipe_id"], required=False)
    if not recipe:
        fail("v2_run_verify", "verify requires recipe_id or a run_id with a recipe")
    if not evidence_ids:
        fail("v2_run_verify", "verify requires existing evidence IDs; it never sends requests")
    assert_current(recipe, context(project, campaign, recipe))
    groups = render(recipe, {}).get("control_groups") or recipe.get("control_groups") or []
    controls = groups[0].get("controls", []) if groups else []
    if not controls or len(evidence_ids) != len(controls) or len(set(evidence_ids)) != len(evidence_ids):
        fail("v2_run_verify", "Verification needs one distinct complete capture for every frozen control, in control order")
    results = [(control, _control_result(project, recipe, control, evidence_id))
               for control, evidence_id in zip(controls, evidence_ids)]
    if recipe["provider"]["name"] == "browser":
        if not args.get("run_id") or prior.get("evidence_ids") != evidence_ids:
            fail("v2_run_verify", "Browser verification must reuse the exact source and visit references of its existing managed run")
        from .browser_provider import evaluate_recipe
        evaluation = evaluate_recipe(project, recipe, prior)
    else:
        evaluation = _eval_from_results(recipe, results)
    run_row = new_run(recipe=recipe, campaign_id=campaign["id"],
                      idempotency_key="verify:" + digest(evidence_ids), mode="verify")
    existing = Repository(project).get("run", run_row["id"], required=False)
    if existing:
        return {"run": run_public(existing), "outcome": evaluation["outcome"], "requests_sent": 0,
                "replayed": False, "notice": "Existing offline verification retained; no duplicate attempt was added."}
    run_row["evidence_ids"] = evidence_ids
    if recipe["provider"]["name"] == "browser":
        run_row["browser_visit_ids"] = list(prior["browser_visit_ids"])
    run_row["status"] = "evaluated"
    run_row["evaluation"] = evaluation
    run_row["outcome"] = evaluation.get("outcome")
    Repository(project).add("run", run_row, immutable=False)
    # Re-evaluation cannot rewrite a completed security task or unknown write.
    # It records its own result; native review still checks the original run.
    return {"run": run_public(run_row), "outcome": evaluation["outcome"], "requests_sent": 0}


def verify_saved_run(project, run_row):
    repository = Repository(project, read_only=True)
    campaign = repository.get("campaign", run_row["campaign_id"])
    recipe = repository.get("recipe", run_row["recipe_id"])
    from ..planning.membership import require_hypothesis
    require_hypothesis(project, campaign, run_row["hypothesis_id"])
    if run_row.get("status") not in {"evaluated", "published"} or run_row.get("recipe_spec_hash") != recipe.get("spec_hash") \
            or recipe.get("hypothesis_id") != run_row.get("hypothesis_id"):
        fail("finding_proof_current", "The saved result does not bind a complete current managed run")
    assert_current(recipe, context(project, campaign, recipe))
    groups = render(recipe, {}).get("control_groups") or recipe.get("control_groups") or []
    controls = groups[0].get("controls", []) if len(groups) == 1 else []
    evidence_ids = run_row.get("evidence_ids") or []
    if not controls or len(evidence_ids) != len(controls) or len(set(evidence_ids)) != len(evidence_ids):
        fail("evidence_binding", "The saved result requires every distinct frozen control")
    results = [(control, _control_result(project, recipe, control, identity))
               for control, identity in zip(controls, evidence_ids)]
    if recipe["provider"]["name"] == "browser":
        from .browser_provider import evaluate_recipe
        evaluation = evaluate_recipe(project, recipe, run_row)
    else:
        evaluation = _eval_from_results(recipe, results)
    if evaluation != run_row.get("evaluation") or evaluation.get("outcome") != run_row.get("outcome"):
        fail("finding_proof_current", "The stored result no longer reproduces its current controls and oracle")
    return evaluation


def inspect(project, args):
    repository = Repository(project)
    if args.get("run_id"):
        run_row = repository.get("run", args["run_id"])
        return {"run": run_public(run_row),
                "recipe": recipe_public(repository.get("recipe", run_row["recipe_id"])) if run_row.get("recipe_id") else None}
    if args.get("recipe_id"):
        recipe = repository.get("recipe", args["recipe_id"])
        return {"recipe": recipe_public(recipe), "private_capsule_available": True,
                "control_count": sum(len(group.get("controls", [])) for group in recipe.get("control_groups", []))}
    fail("v2_run_inspect", "Inspect requires run_id or recipe_id")
