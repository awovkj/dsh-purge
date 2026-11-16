"""Read-only authorization controls with verified identities and exact object assertions."""
from __future__ import annotations

import base64
import re

from .. import engine
from ..domain import new_recipe
from ..domain.common import digest
from ..inputs import json_document, locate_json
from ..store import EngineError
from .request_builder import baseline_request, protected_headers, request_for


def validate(value):
    if not isinstance(value, dict) or set(value) - {"resource_selector", "protected_selector", "owner_selector", "tenant_selector"}:
        raise EngineError("authorization_contract", "Authorization contracts accept only exact resource/protected response selectors")
    if not isinstance(value.get("protected_selector"), str) or not value["protected_selector"].startswith("/"):
        raise EngineError("authorization_contract", "Select the actual protected JSON object or value")
    for name in ("resource_selector", "owner_selector", "tenant_selector"):
        if value.get(name) is not None and (not isinstance(value[name], str) or not value[name].startswith("/")):
            raise EngineError("authorization_contract", "Resource, owner and tenant selectors must be exact JSON Pointers")
    if any("~" in selector and re.search(r"~(?![01])", selector) for selector in value.values()):
        raise EngineError("authorization_contract", "Selectors must use valid JSON Pointer escaping")
    if any(len(selector) > 512 for selector in value.values()):
        raise EngineError("authorization_contract", "Authorization selectors exceed the bounded contract")
    return dict(value)


def session_binding(project, session, *, live=False):
    actor = engine.session_valid(project, session) if live else engine._verified_session_actor(project, session)
    verification, unused_artifact = engine.verify_current_evidence(project, session["verification_evidence_id"])
    return {"session_id": session["id"], "generation": session["generation"], "actor_id": actor["id"],
            "actor_signature": engine.actor_signature(actor), "credential_signature": engine.credential_signature(session),
            "verification_evidence_id": verification["id"], "verification_sha256": verification["sha256"]}


def _allowed_baseline(project, operation, session, contract):
    for evidence in reversed(project.list("evidence")):
        if evidence.get("kind") != "http" or evidence.get("operation_id") != operation["id"] \
                or evidence.get("session_id") != session["id"] or evidence.get("auth_mode") == "anonymous_cookie":
            continue
        try:
            current, artifact = engine.verify_current_evidence(project, evidence["id"])
            response = artifact["response"]
            if response["status"] != 200:
                continue
            value, unused_tokens = locate_json(json_document(base64.b64decode(response["body_base64"], validate=True)),
                                               contract["protected_selector"])
            if value in (None, "", [], {}):
                continue
            request = baseline_request(project, operation, session, evidence_id=current["id"])
            if request is not None:
                return current, request
        except (EngineError, OSError, ValueError, KeyError, TypeError):
            continue
    return None


def build(project, campaign, universe, hypothesis, operation):
    from ..assessment_mode import mode
    if mode(project) == "src":
        return _blocked("verified_principal_and_roles", "SRC does not prepare credential-based authorization controls")
    if operation["method"] != "GET" or operation.get("auth") == "unknown" \
            or operation.get("auth") == "public" and not operation.get("ownership"):
        return _blocked("property_specific_controls", "This provider supports declared-policy, read-only GET object access")
    policy_kind = {"authentication_enforcement": "authentication", "principal_tenant_boundary": "ownership",
                   "role_authorization": "role"}.get(hypothesis.get("security_property"))
    if policy_kind is None:
        return _blocked("dedicated_control_provider", "This security property is not an object-read authorization boundary")
    try:
        contract = validate(operation.get("authorization_contract"))
    except EngineError as error:
        return _blocked("property_specific_controls", str(error))
    sessions = []
    for session in project.list("session"):
        try:
            engine.require_session_origin(project, session, operation["url"])
            binding = session_binding(project, session, live=True)
            actor = project.get("actor", binding["actor_id"])
            assertion = session.get("verification_assertion") or {}
            if operation.get("auth") == "restricted" and not assertion.get("roles_selector"):
                continue
            if actor.get("tenant_id") and not assertion.get("tenant_selector"):
                continue
            sessions.append((session, actor, binding))
        except (EngineError, OSError, ValueError, KeyError):
            continue
    resources = [resource for resource in project.list("resource") if resource.get("operation_id") == operation["id"]]
    resource = resources[0] if len(resources) == 1 and policy_kind == "ownership" else None
    if policy_kind == "ownership" and (resource is None or not contract.get("resource_selector") or not contract.get("owner_selector")
                                        or resource.get("tenant_id") and not contract.get("tenant_selector")):
        return _blocked("owned_test_fixture", "Ownership proof needs one exact owned test resource and its actual response identity selector")
    allowed, source = None, None
    for row in sessions:
        if resource is not None and resource.get("owner_actor_id") != row[1]["id"] \
                or operation.get("auth") == "restricted" and not set(row[1].get("roles") or []) & set(operation["allowed_roles"]):
            continue
        baseline = _allowed_baseline(project, operation, row[0], contract)
        if baseline is not None:
            allowed, source = row, baseline
            break
    if allowed is None:
        return _blocked("current_http_observation", "A verified allowed principal needs a complete successful baseline of the exact protected object")
    forbidden = None
    if policy_kind in {"ownership", "role"}:
        forbidden = next((row for row in sessions if (row[1].get("subject"), row[1].get("tenant_id")) !=
                          (allowed[1].get("subject"), allowed[1].get("tenant_id"))
                          and {name: row[0]["headers"][name] for name in engine.credential_header_names(row[0])} !=
                              {name: allowed[0]["headers"][name] for name in engine.credential_header_names(allowed[0])}
                          and (policy_kind != "role" or not set(row[1].get("roles") or []) & set(operation["allowed_roles"]))) , None)
        if forbidden is None:
            return _blocked("verified_principal_and_roles", "An independently verified forbidden principal is required")
    source_evidence, baseline = source
    try:
        request = request_for(operation, None, None, baseline, protected=protected_headers(project))
        if resource is not None:
            from ..scope import bind_operation
            engine._resource_binding(resource, bind_operation(operation, request["url"], operation["method"]),
                                     request["url"], request.get("body"), content_type=operation.get("content_type", ""))
    except EngineError as error:
        return _blocked("current_http_observation", str(error))
    controls = []
    identities = [("normal", "normal", allowed), ("attack", "attack", forbidden),
                  ("negative", "negative", None if forbidden else allowed)]
    for control_id, role, identity in identities:
        controls.append({"id": control_id, "role": role, "request": dict(request),
                         "session": identity[2] if identity else None,
                         "expected": {"selector": contract["protected_selector"], "value": None}})
    bindings = {"scope_epoch": campaign["scope_epoch"], "target_build": universe["target_build"],
                "operation_id": operation["id"], "operation_signature": engine.operation_signature(operation),
                "session": {key: allowed[2][key] for key in ("session_id", "generation", "actor_id")},
                "sessions": [row[2] for row in (allowed, forbidden) if row is not None],
                "resource": {"resource_id": resource["id"], "revision": resource.get("revision", 1)} if resource else None,
                "resource_signature": engine.resource_signature(resource) if resource else None,
                "consumer_context": {"input_key": hypothesis.get("input_key"), "input": None},
                "authorization_contract": contract, "policy_kind": policy_kind,
                "baseline_evidence_id": source_evidence["id"], "baseline_sha256": source_evidence["sha256"]}
    recipe = new_recipe(hypothesis=hypothesis,
        provider={"name": "http", "profile": "native_authorization_read", "version": "1"}, bindings=bindings,
        control_groups=[{"id": "primary", "identity_role": "individually_verified", "controls": controls}],
        oracle={"type": "authorization", "version": "2", "proof_scope": "authorization_boundary",
                "selector": contract["protected_selector"], "policy_kind": policy_kind},
        steps=["Allowed principal", "Forbidden principal", "Anonymous or allowed recovery"],
        limits={"step_total": 3, "time_ms": 120000, "max_writes": 0, "effect": "read_only"})
    return {"status": "ready", "recipe": recipe}


def _blocked(missing, reason):
    return {"status": "blocked", "missing": [missing], "reason": reason, "provider_supported": True,
            "preparation": {"action": "action.help", "input": {"name": "identity.resource" if missing == "owned_test_fixture" else
                                                               "identity.verify" if missing == "verified_principal_and_roles" else "surface.register"}}}
