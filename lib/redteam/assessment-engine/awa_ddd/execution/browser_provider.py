"""Browser provider: real Playwright visits and application-triggered XSS evidence.

Imported MCP observations never satisfy authenticated typed closure; only a
locally verified visit with application-triggered dialogs and same-identity
controls can feed the ``browser_runtime`` oracle.
"""
from __future__ import annotations

import base64
import hashlib

from .. import browser, engine
from ..domain import new_recipe
from ..domain.common import digest, fail
from ..scope import normalize_url, require_scope
from ..engine import stamp
from ..store import EngineError
from ..transport import headers_map
from . import oracle_profiles
from .request_builder import protected_headers, request_for, verify_control_evidence


def visit(project, args):
    result = browser.visit(project, args)
    return result


def evaluate_xss(project, *, consumer_url, marker, attack_visit_id, normal_visit_id,
                 writer_attack_evidence_id, writer_normal_evidence_id):
    return {"outcome": "inconclusive", "finding_allowed": False, "proof_scope": None,
            "limitations": ["Loose visit/writer references do not freeze an exact input source, negative control or managed run."],
            "next": {"action": "action.help", "input": {"name": "test.run_browser"}}}


def build_recipe(project, campaign, universe, hypothesis, operation, entry, session):
    from .input_contract import validate
    from .capabilities import ready_for
    contract = validate((entry or {}).get("test_contract") or {})
    if operation["method"] != "GET" or not entry or entry.get("location") != "query" \
            or contract.get("xss_context") != "html_markup" or not contract.get("baseline_evidence_id"):
        raise EngineError("v2_browser_source", "Reflected XSS needs a query input, HTML context and exact complete baseline E-ID")
    readiness = ready_for(project, provider="playwright", profile="native_reflected_xss", authenticated=bool(session))
    if not readiness["ready"]:
        raise EngineError("browser_unavailable", "A current local Playwright probe is required before a browser recipe", {"reasons": readiness["reasons"]})
    meta, raw = engine.verify_current_evidence(project, contract["baseline_evidence_id"])
    if meta.get("operation_id") != operation["id"] or meta.get("session_id") != (session or {}).get("id") \
            or meta.get("resource_id") or meta.get("auth_mode") == "anonymous_cookie" \
            or raw["response"]["status"] != 200 or base64.b64decode(raw["request"].get("body_base64", ""), validate=True):
        raise EngineError("v2_browser_source", "Use a current body-free HTML baseline for this exact operation and identity")
    content_type = headers_map(dict(raw["response"].get("headers") or [])).get("content-type", "").split(";", 1)[0].lower()
    if content_type != "text/html":
        raise EngineError("v2_browser_source", "A JSON/API response needs a separately implemented consumption chain, not a reflected HTML label")
    baseline = dict(raw["request"])
    baseline["headers"] = {key: value for key, value in headers_map(baseline.get("headers") or {}).items()
                           if key not in protected_headers(project)}
    if set(baseline["headers"]) - browser._SAFE_EXTRA_HEADERS:
        raise EngineError("v2_browser_source", "Browser controls cannot reproduce these business headers; preserve the source and use a dedicated provider")
    marker = "AWA-XSS-" + digest({"hypothesis": hypothesis["id"], "baseline": meta["sha256"], "context": contract})[:32]
    if marker.encode() in base64.b64decode(raw["response"]["body_base64"], validate=True):
        raise EngineError("v2_browser_marker", "The independent baseline already contains this runtime marker")
    attack = '<svg onload=alert("' + marker + '")>'
    values = [("normal", "normal", marker), ("attack", "attack", attack),
              ("negative", "negative", attack.replace("<", "&lt;").replace(">", "&gt;"))]
    controls = [{"id": identity, "role": role, "request": request_for(operation, entry, value, baseline,
                 protected=protected_headers(project)), "expected": {"selector": "body", "value": None}}
                for identity, role, value in values]
    from ..domain.common import stable_id
    input_key = stable_id("IN", {"operation": operation["id"], "location": entry["location"],
                                 "selector": entry.get("selector", entry.get("name")), "branch": entry.get("schema_branch")})
    bindings = {"scope_epoch": campaign["scope_epoch"], "target_build": universe["target_build"],
                "operation_id": operation["id"], "operation_signature": engine.operation_signature(operation),
                "session": {"session_id": session["id"], "generation": session["generation"], "actor_id": session["actor_id"]} if session else None,
                "resource": None, "consumer_context": {"input_key": input_key, "input": entry},
                "browser_source": {"baseline_evidence_id": meta["id"], "baseline_sha256": meta["sha256"],
                                   "context": "html_markup", "marker": marker}}
    recipe = new_recipe(hypothesis=hypothesis, provider={"name": "browser", "profile": "native_reflected_xss", "version": "1"},
        bindings=bindings, control_groups=[{"id": "primary", "identity_role": "same_verified_or_anonymous", "controls": controls}],
        oracle={"type": "browser_runtime", "version": "2", "proof_scope": "browser_runtime_xss", "marker": marker},
        steps=["Capture and render plain marker", "Capture and render HTML marker", "Capture and render escaped marker"],
        limits={"step_total": 6, "time_ms": 240000, "effect": "read_only", "max_writes": 0})
    return {"status": "ready", "recipe": recipe}


def observe_control(project, recipe, control):
    request = control["request"]
    args = {"url": request["url"], "headers": request.get("headers") or {}, "allow_write": False,
            "headless": True, "timeout": 15, "settle_ms": 500, "actions": []}
    session = recipe["bindings"].get("session")
    if session:
        args["session_id"] = session["session_id"]
    result = browser.visit(project, args)
    if not result.get("complete") or result.get("run_status") != "succeeded":
        fail("v2_browser_visit", "Browser control did not finish; inspect its existing run, never automatically replay")
    return result["id"]


def _source_visit(project, recipe, control, evidence_id, visit_id):
    meta, artifact = verify_control_evidence(project, recipe, control, evidence_id)
    url = require_scope(project.config, artifact["request"]["url"])
    record, raw = browser._verified_visit(project, visit_id, url)
    if record.get("source") != "local_playwright" or record.get("machine_authenticated") is not True \
            or raw.get("write_requests") or raw.get("write_authorized") or raw.get("actions"):
        fail("v2_browser_source", "Only isolated native read-only observations without synthetic execution actions can prove this source")
    identity_fields = ("actor_id", "session_id", "session_generation")
    if any(meta.get(key) != record.get(key) for key in identity_fields) \
            or any(row["url"] != url for row in browser._navigation_trail(raw)):
        fail("v2_browser_source", "The browser document or actual identity differs from its exact source capture")
    if stamp(artifact["completed_at"]) > stamp(raw["started_at"]):
        fail("v2_browser_source", "The source capture must complete before its bound runtime observation")
    expected_headers = headers_map(artifact["request"].get("headers") or {})
    protected = protected_headers(project) - {"host", "content-length", "transfer-encoding", "connection", "accept-encoding"}
    documents = [row for row in browser._network(raw) if row.get("type") == "document"]
    if len(documents) != 1:
        fail("v2_browser_source", "The exact source requires one unambiguous complete document response")
    document = documents[0]
    request = document.get("request", document)
    actual_headers = headers_map(document.get("request_headers") or request.get("headers") or {})
    if normalize_url(request["url"]) != url or request.get("method") != "GET" \
            or document.get("status") != 200 or document.get("response_body_complete") is not True \
            or document.get("response_body_sha256") != artifact["response"]["body_sha256"] \
            or document.get("response_body_bytes") != artifact["response"]["length"] \
            or document.get("request_body_bytes") != 0 \
            or document.get("request_body_sha256") != digest_bytes(b"") \
            or {key: value for key, value in actual_headers.items() if key in protected} != \
               {key: value for key, value in expected_headers.items() if key in protected} \
            or any(actual_headers.get(key) != value for key, value in control["request"].get("headers", {}).items()):
        fail("v2_browser_source", "Actual browser request, credentials or consumed response bytes do not match the source control")
    marker = recipe["oracle"]["marker"]
    dialogs = [row for row in raw.get("dialogs") or [] if isinstance(row, dict) and row.get("type") == "alert"
               and row.get("message") == marker and row.get("document_url") == url and row.get("action_index") is None]
    return {"dialog": bool(dialogs), "visit_id": visit_id, "visit_sha256": record["sha256"],
            "evidence_id": evidence_id, "evidence_sha256": meta["sha256"],
            "identity": {key: meta.get(key) for key in identity_fields}, "url": url,
            "started_at": raw["started_at"], "completed_at": raw["completed_at"]}


def digest_bytes(value):
    return hashlib.sha256(value).hexdigest()


def evaluate_recipe(project, recipe, run):
    source = recipe["bindings"]["browser_source"]
    baseline, unused = engine.verify_current_evidence(project, source["baseline_evidence_id"])
    if baseline["sha256"] != source["baseline_sha256"]:
        fail("v2_browser_source", "The original browser baseline changed")
    controls = recipe["control_groups"][0]["controls"]
    ids, visits = run.get("evidence_ids") or [], run.get("browser_visit_ids") or []
    if len(ids) != 3 or len(visits) != 3 or len(set(ids)) != 3 or len(set(visits)) != 3:
        fail("v2_browser_source", "Every frozen source and runtime control needs an independent current observation")
    observed = [_source_visit(project, recipe, control, identity, visit)
                for control, identity, visit in zip(controls, ids, visits)]
    if any(stamp(left["completed_at"]) > stamp(right["started_at"]) for left, right in zip(observed, observed[1:])):
        fail("v2_browser_source", "Runtime controls must finish in their exact non-overlapping frozen order")
    observations = {"trigger_source": "application" if observed[1]["dialog"] else "none",
        "application_triggered": observed[1]["dialog"], "attack_dialog": observed[1]["dialog"],
        "normal_dialog": observed[0]["dialog"], "negative_dialog": observed[2]["dialog"],
        "consumer_page": observed[1]["url"], "same_identity": observed[0]["identity"] == observed[1]["identity"] == observed[2]["identity"],
        "content_version": digest(observed), "source_binding_verified": True, "independent_controls": True}
    result = oracle_profiles.evaluate("browser_runtime", observations)
    result.update(observations=observations, oracle_type="browser_runtime", oracle_version="2",
                  proof_scope="browser_runtime_xss" if result["outcome"] == "supported" else None,
                  severity_cap=oracle_profiles.profile("browser_runtime")["severity_cap"])
    return result
