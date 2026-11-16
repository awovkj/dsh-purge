"""Build a frozen recipe from a ready hypothesis and the current ledger.

Only hypotheses whose prerequisites are present become executable recipes.  A
blocked hypothesis returns a preparation row instead; the builder never invents
a session, fixture or URL authorization.
"""
from __future__ import annotations

from .request_builder import baseline_request, request_for, protected_headers

from .. import engine
from ..domain import new_recipe
from ..domain.repository import Repository

FAMILY_ORACLE = {
    "sql_injection": "sql_metadata",
    "xss": "browser_runtime",
    "ssrf": "extraction",
    "xxe": "extraction",
    "path_traversal": "extraction",
    "command_injection": "bounded_side_effect",
    "template_injection": "unexpected_expression_evaluation",
    "deserialization": "unsafe_type_instantiation",
    "file_upload": "upload_path_escape",
    "business_logic": "state_transition",
    "access_control": "authorization",
    "generic": "semantic_negative",
}

PAYLOADS = {
    "sql_injection": ("AWA-NORMAL", "AWA' OR '1'='1", "AWA-NORMAL-2"),
    "xss": ("AWA-NORMAL", "AWA-XSS-<svg/onload=alert(1)>", "AWA-NORMAL-2"),
    "template_injection": ("AWA-NORMAL", "7*7", "AWA-NORMAL-2"),
    "command_injection": ("AWA-NORMAL", "AWA-CANARY", "AWA-NORMAL-2"),
    "deserialization": ("AWA-NORMAL", '{"@type":"AWA-Canary"}', "AWA-NORMAL-2"),
    "file_upload": ("AWA-NORMAL.txt", "AWA-ATTACK.txt", "AWA-NORMAL-2.txt"),
    "ssrf": ("https://awa.invalid/normal", "http://127.0.0.1:9/awa-canary", "https://awa.invalid/normal-2"),
    "path_traversal": ("AWA-NORMAL", "../../awa-canary", "AWA-NORMAL-2"),
    "business_logic": ("AWA-NORMAL", "AWA-ATTACK", "AWA-NORMAL-2"),
    "access_control": ("AWA-NORMAL", "AWA-ATTACK", "AWA-NORMAL-2"),
    "generic": ("AWA-NORMAL", "AWA-ATTACK", "AWA-NORMAL-2"),
}


def _first_session(project, operation):
    sessions = []
    for row in project.list("session"):
        if not row.get("actor_id") or not row.get("verified_at"):
            continue
        try:
            engine.session_valid(project, row)
            engine.require_session_origin(project, row, operation["url"])
        except engine.EngineError:
            continue
        sessions.append(row)
    if operation.get("auth") == "public":
        return None
    for session in sessions:
        if operation.get("auth") == "restricted" and session.get("actor_id"):
            actor = project.get("actor", session["actor_id"], required=False) or {}
            if set(actor.get("roles") or []) & set(operation.get("allowed_roles") or []):
                return session
        elif operation.get("auth") != "restricted":
            return session
    return None


def _resource(project, operation, session):
    for resource in project.list("resource"):
        if resource.get("operation_id") == operation.get("id") and (
                not session or resource.get("owner_actor_id") == session.get("actor_id")):
            return resource
    return None


def _input(operation, input_key):
    from ..domain.common import stable_id
    for entry in operation.get("inputs", []):
        key = stable_id("IN", {"operation": operation["id"], "location": entry.get("location"),
                               "selector": entry.get("selector", entry.get("name")),
                               "branch": entry.get("schema_branch")})
        if key == input_key:
            return entry
    return None


def _request_for(operation, entry, value):
    return request_for(operation, entry, value)


def automatic_provider(family):
    supported = family in {"sql_injection", "template_injection", "generic", "access_control", "xss"}
    return {"family": family, "supported": supported,
            "provider": "browser" if family == "xss" else "native_http_controls" if supported else None,
            "reason": None if supported else "dedicated_control_provider_not_implemented",
            "alternative": None if supported else "Use the dedicated scenario/browser/external test contract when available."}


def prerequisite_fingerprint(project, hypothesis):
    """Relevant material only; timestamps, cursors and dispositions are omitted."""
    from ..domain.common import digest
    operation = project.get("operation", hypothesis.get("operation_id"), required=False)
    if operation is None:
        return digest({"operation": None})
    session = _first_session(project, operation)
    baseline = baseline_request(project, operation, session)
    identity = None
    if session:
        evidence = project.get("evidence", session.get("verification_evidence_id"), required=False) or {}
        try:
            artifact = project.read_artifact(evidence)
            identity = {"session": session["id"], "generation": session.get("generation"),
                        "actor": engine.actor_signature(project.get("actor", session["actor_id"])),
                        "credentials": engine.credential_signature(session),
                        "assertion": session.get("verification_assertion"),
                        "identity_body": (artifact.get("response") or {}).get("body_sha256")}
        except (engine.EngineError, OSError, ValueError, KeyError, TypeError):
            identity = None
    resources = [{"id": row["id"], "signature": engine.resource_signature(row)}
                 for row in project.list("resource") if row.get("operation_id") == operation["id"]]
    fixtures = [{key: row.get(key) for key in ("id", "operation_id", "resource_id", "revision", "state")}
                for row in Repository(project).list("fixture", limit=None)[0]
                if row.get("operation_id") == operation["id"]]
    identities = []
    if hypothesis.get("family") == "access_control":
        from .authorization_provider import session_binding
        for candidate in project.list("session"):
            try:
                engine.require_session_origin(project, candidate, operation["url"])
                identities.append(session_binding(project, candidate, live=True))
            except (engine.EngineError, OSError, ValueError, KeyError, TypeError):
                continue
    browser_runtime = None
    if hypothesis.get("family") == "xss":
        from .capabilities import runtime_binding
        candidate = Repository(project, read_only=True).get("capability", "CAP-playwright", required=False) or {}
        browser_runtime = {"binding": runtime_binding(), "ready": candidate.get("ready"),
                           "evidence": candidate.get("evidence")}
    return digest({"operation": engine.operation_signature(operation), "input": _input(operation, hypothesis.get("input_key")),
                   "identity": identity, "identities": identities, "browser": browser_runtime,
                   "baseline": baseline, "resources": resources, "fixtures": fixtures})


def refresh_preparation(project, campaign, universe):
    """Recompile blocked automatic work only after relevant prerequisites change.

    This performs no requests and preserves attempts/cooldowns. Manual blockers
    and uncertain writes require their own explicit reconciliation path.
    """
    from ..domain.hypothesis import transition
    repository = Repository(project)
    from ..planning.membership import rows as member_rows
    for hypothesis in member_rows(project, campaign, "hypothesis"):
        if hypothesis.get("superseded") or hypothesis.get("status") != "blocked" \
                or hypothesis.get("blocked_prerequisite") or hypothesis.get("automatic_preparation", {}).get("shared_prior_result"):
            continue
        blocker = hypothesis.get("execution_blocker") or {}
        if blocker.get("outcome") == "effect_unknown":
            continue
        old = (hypothesis.get("automatic_preparation") or {}).get("prerequisite_fingerprint")
        current = prerequisite_fingerprint(project, hypothesis)
        if old == current:
            continue
        built = build(project, campaign, universe, hypothesis)
        automatic = {"provider_supported": built.get("provider_supported"), "capability": built.get("capability"),
                     "preparation": built.get("preparation"), "prerequisite_fingerprint": current}
        if built["status"] == "ready":
            # A preexisting execution failure without a recorded prerequisite
            # snapshot cannot be erased by a restart or administrative edit.
            if blocker and old is None:
                continue
            transition(hypothesis, "ready", reason="Relevant actual prerequisites now compile into a frozen control recipe", missing_context=[])
            hypothesis.pop("execution_blocker", None)
        else:
            hypothesis["state_reason"] = built.get("reason")
            hypothesis["missing_context"] = built.get("missing") or hypothesis.get("missing_context") or []
        hypothesis["automatic_preparation"] = automatic
        repository.save("hypothesis", hypothesis)


def build(project, campaign, universe, hypothesis):
    """Return {status:ready, recipe} or {status:blocked, missing, preparation}."""
    operation = next((row for row in project.list("operation")
                      if row.get("id") == hypothesis.get("operation_id")), None)
    if operation is None:
        return {"status": "blocked", "missing": ["exact_authorized_url"],
                "reason": "No registered operation matches this hypothesis; bind the operation first."}
    if hypothesis.get("source_kind") == "known_case" and not hypothesis.get("input_key"):
        return {"status": "blocked", "missing": ["exact_input_request_binding"],
                "reason": "The reference case must identify one unambiguous actual input; case hashes are not input identities."}
    entry = _input(operation, hypothesis.get("input_key"))
    if entry is None and hypothesis.get("input_key"):
        return {"status": "blocked", "missing": ["actual_input_consumer"],
                "reason": "The hypothesis input no longer exists in the current operation signature."}
    if entry is not None and str(entry.get("consumer") or "").strip().lower() in {"", "unknown", "other", "untraced", "unspecified"}:
        return {"status": "blocked", "missing": ["actual_input_consumer"], "provider_supported": True,
                "reason": "Bind the actual input consumer before preparing security controls."}
    session = _first_session(project, operation)
    resource = _resource(project, operation, session)
    capability = automatic_provider(hypothesis.get("family", "generic"))
    if not capability["supported"]:
        return {"status": "blocked", "missing": ["dedicated_control_provider"],
                "provider_supported": False, "capability": capability,
                "reason": "This family has no automatic control provider; adding identities alone cannot make this recipe executable.",
                "preparation": {"action": "action.help", "input": {"name": "test.run_scenario"}}}
    if hypothesis.get("family") == "access_control":
        from .authorization_provider import build as authorization_recipe
        return authorization_recipe(project, campaign, universe, hypothesis, operation)
    if hypothesis.get("family") == "xss":
        from .browser_provider import build_recipe
        try:
            return build_recipe(project, campaign, universe, hypothesis, operation, entry, session)
        except (engine.EngineError, ValueError, KeyError, TypeError) as error:
            return {"status": "blocked", "missing": ["browser_consumer_context"], "provider_supported": True,
                    "reason": str(error), "preparation": {"action": "action.help", "input": {
                        "name": "browser.probe" if getattr(error, "code", None) == "browser_unavailable" else "surface.declare_consumer"}}}
    from ..domain.repository import Repository
    fixture = next((row for row in Repository(project).list("fixture", limit=None)[0]
                    if row.get("operation_id") == operation["id"]
                    and row.get("state") in {"verified", "leased"}), None)
    if operation.get("auth") != "public" and session is None:
        return {"status": "blocked", "missing": ["verified_principal_and_roles"],
                "reason": "No verified session exists for this operation."}
    if hypothesis.get("family") in {"business_logic"} and resource is None and operation.get("method") not in {"GET", "HEAD", "OPTIONS"}:
        return {"status": "blocked", "missing": ["owned_test_fixture"],
                "reason": "A writable business-logic test requires an owned, reversible fixture."}
    family = hypothesis.get("family", "generic")
    oracle_type = FAMILY_ORACLE.get(family, "semantic_negative")
    normal, attack, negative = PAYLOADS.get(family, PAYLOADS["generic"])
    if family == "template_injection":
        consumer = str((entry or {}).get("consumer") or "").strip().lower()
        if consumer not in {"template", "server_template", "template_rendering", "template-rendering", "template_engine"}:
            return {"status": "blocked", "missing": ["actual_input_consumer"], "provider_supported": True,
                    "reason": "Expression controls require an explicit non-calculator template consumer; arithmetic output alone does not establish an unexpected evaluation."}
        oracle = {"id": "OR-EXPR-1", "type": "unexpected_expression_evaluation", "version": "2",
                  "proof_scope": "unexpected_expression_evaluation", "selector": "/value",
                  "expected_value": "49", "declared_formula_field": False}
        normal, attack, negative = "AWA-NORMAL", "7*7", "AWA-NORMAL-2"
    elif family == "deserialization":
        oracle = {"id": "OR-PARSE-1", "type": "unsafe_type_instantiation", "version": "1",
                  "proof_scope": "unsafe_type_instantiation", "selector": "/type", "expected_value": "AWA-Canary"}
    elif family == "file_upload":
        oracle = {"id": "OR-UPLOAD-1", "type": "upload_path_escape", "version": "1",
                  "proof_scope": "upload_path_escape", "selector": "/path", "expected_value": "outside_root"}
    else:
        selector = "/count" if oracle_type in {"sql_metadata", "semantic_negative", "state_invariant", "baseline"} else "status"
        oracle = {"id": "OR-" + oracle_type.upper(), "type": oracle_type, "version": "1",
                  "proof_scope": "authorization_boundary" if oracle_type == "authorization" else
                                 "semantic_refutation" if oracle_type == "semantic_negative" else
                                 "baseline_observation" if oracle_type == "baseline" else
                                 "state_transition" if oracle_type == "state_transition" else
                                 "sql_metadata_observation" if oracle_type == "sql_metadata" else
                                 "extraction_observation" if oracle_type == "extraction" else
                                 "browser_runtime_xss" if oracle_type == "browser_runtime" else
                                 "bounded_side_effect",
                  "selector": selector, "expected_value": "AWA-ATTACK"}
    controls = []
    baseline = baseline_request(project, operation, session)
    protected = protected_headers(project)
    mechanism_values = None
    if family in {"sql_injection", "template_injection"}:
        try:
            from .input_contract import controls as mechanism_controls
            mechanism_values, oracle, source_request = mechanism_controls(project, operation, entry, family, session)
            if source_request is not None:
                baseline = {**source_request, "headers": {key: value for key, value in (source_request.get("headers") or {}).items()
                                                          if key.lower() not in protected}}
        except (engine.EngineError, KeyError, TypeError, ValueError) as exc:
            return {"status": "blocked", "missing": ["property_specific_controls"], "provider_supported": True,
                    "reason": str(exc), "preparation": {"action": "action.help", "input": {"name": "surface.declare_consumer"}}}
    from .oracle_profiles import profile
    oracle["version"] = profile(oracle["type"])["version"]
    if baseline is None and (operation.get("method") not in {"GET", "HEAD", "OPTIONS"}
                             or len(operation.get("inputs") or []) > 1):
        return {"status": "blocked", "missing": ["current_http_observation"], "provider_supported": True,
                "reason": "Multi-input and body/write recipes need a complete actual baseline; other business values are not invented.",
                "preparation": {"action": "action.help", "input": {"name": "http.capture"}}}
    for control_id, role, value in mechanism_values or [(role, role, value) for role, value in
                                                      (("normal", normal), ("attack", attack), ("negative", negative))]:
        try:
            request = request_for(operation, entry, value, baseline, protected=protected)
        except Exception as exc:
            from ..store import EngineError
            if not isinstance(exc, EngineError):
                raise
            return {"status": "blocked", "missing": ["exact_input_request_binding"],
                    "reason": str(exc), "provider_supported": True,
                    "preparation": {"action": "action.help", "input": {"name": "http.capture"}}}
        controls.append({"id": control_id, "role": role, "request": request,
                         "expected": {"selector": oracle["selector"], "value": value},
                         "observe_as": {"normal": "normal_control", "attack": "attack_control",
                                        "negative": "negative_control", "sensitivity": "sensitivity_control"}[role]})
    bindings = {
        "scope_epoch": campaign.get("scope_epoch") or universe.get("scope_epoch"),
        "target_build": universe.get("target_build") or universe.get("snapshot_hash", "")[:16],
        "operation_id": operation["id"],
        "operation_signature": engine.operation_signature(operation),
        "session": None if session is None else {
            "session_id": session["id"], "generation": session.get("generation", 1),
            "actor_id": session.get("actor_id")},
        "resource": None if resource is None else {
            "resource_id": resource["id"], "revision": resource.get("revision", 1)},
        "fixture": None if fixture is None else {
            "fixture_id": fixture["id"], "revision": fixture.get("revision", 1)},
        "consumer_context": {"input_key": hypothesis.get("input_key"), "input": entry},
    }
    effect = "read_only" if operation.get("method") in {"GET", "HEAD", "OPTIONS"} else "test_resource_write"
    if effect == "test_resource_write" and (resource is None or fixture is None):
        missing = []
        if resource is None:
            missing.append("owned_test_fixture")
        if fixture is None:
            missing.append("owned_test_fixture")
        return {"status": "blocked", "missing": sorted(set(missing)),
                "reason": "Write recipes require an owned disposable resource and a verified fixture."}
    recipe = new_recipe(
        hypothesis=hypothesis,
        provider={"name": "http", "profile": "native_http_read" if effect == "read_only" else "native_http_fixture_write", "version": "1"},
        bindings=bindings,
        control_groups=[{"id": "primary", "identity_role": session.get("actor_id") if session else "anonymous",
                         "controls": controls}],
        oracle=oracle,
        steps=["发送 " + control["id"] + " 对照" for control in controls] + ["按 oracle 读取证据"],
        limits={"step_total": len(controls), "time_ms": 120000, "max_writes": len(controls) if effect == "test_resource_write" else 0,
                "effect": effect},
        variables={"label": {"source": "caller", "max_length": 128}},
        private_manifest={"control_groups": [{"id": "primary", "controls": controls}], "bindings": bindings},
    )
    return {"status": "ready", "recipe": recipe}
