"""Small declared consumer contracts and fixed mechanism-specific controls."""
from __future__ import annotations

import base64
import json
import re

from ..store import EngineError

FIELDS = {"response_selector", "template_dialect", "sql_context", "baseline_evidence_id", "consumer_url", "xss_context"}


def validate(value):
    if not isinstance(value, dict) or set(value) - FIELDS:
        raise EngineError("input_test_contract", "Test contracts accept only an exact response selector, supported context and source references")
    result = dict(value)
    selector = result.get("response_selector")
    if selector is not None and (not isinstance(selector, str) or len(selector) > 512
                                 or not (selector == "body" or selector.startswith("/") or selector.startswith("json:/"))
                                 or re.search(r"~(?![01])", selector)):
        raise EngineError("input_test_contract", "Response selector must identify a real JSON Pointer or the complete body")
    if result.get("template_dialect") not in {None, "jinja_expression"}:
        raise EngineError("input_test_contract", "Only the bounded Jinja expression profile is implemented")
    if result.get("sql_context") not in {None, "quoted_string_equality"}:
        raise EngineError("input_test_contract", "Only the bounded quoted string equality SQL profile is implemented")
    if result.get("xss_context") not in {None, "html_markup"}:
        raise EngineError("input_test_contract", "Only read-only reflected HTML markup XSS controls are implemented")
    if "baseline_evidence_id" in result and not re.fullmatch(r"E-[a-f0-9]{32}", str(result["baseline_evidence_id"])):
        raise EngineError("input_test_contract", "Baseline must reference a real complete E-ID")
    if "consumer_url" in result:
        from ..scope import normalize_url
        result["consumer_url"] = normalize_url(result["consumer_url"])
    return result


def controls(project, operation, entry, family, session):
    contract = validate((entry or {}).get("test_contract") or {})
    selector = contract.get("response_selector")
    if family == "template_injection":
        if contract.get("template_dialect") != "jinja_expression" or selector is None:
            raise EngineError("input_test_contract", "Declare the actual response selector and supported template dialect before expression controls")
        values = [("normal", "normal", "13*17"), ("attack", "attack", "{{13*17}}"),
                  ("negative", "negative", "{{13*17"), ("sensitivity", "sensitivity", "{{19*23}}")]
        oracle = {"type": "unexpected_expression_evaluation", "version": "2",
                  "proof_scope": "unexpected_expression_evaluation", "selector": selector,
                  "expected_value": "221", "sensitivity_expected": "437",
                  "declared_formula_field": False, "template_dialect": "jinja_expression"}
        return values, oracle, None
    if family != "sql_injection":
        return None
    if not selector or contract.get("sql_context") != "quoted_string_equality" or not contract.get("baseline_evidence_id"):
        raise EngineError("input_test_contract", "SQL controls need the actual selector, quoted equality context and a complete nonempty baseline E-ID")
    from ..engine import verify_current_evidence
    from ..inputs import input_view
    evidence, artifact = verify_current_evidence(project, contract["baseline_evidence_id"])
    if evidence.get("operation_id") != operation["id"] or evidence.get("session_id") != (session or {}).get("id") \
            or evidence.get("actor_id") != (session or {}).get("actor_id") or evidence.get("auth_mode") == "anonymous_cookie":
        raise EngineError("input_test_contract", "SQL baseline must belong to this exact operation and verified identity")
    request = artifact["request"]
    item = {"input_location": entry["location"], "input_selector": entry.get("selector", entry.get("name")),
            "schema_branch": entry.get("schema_branch")}
    value, unused_context = input_view(request, item, operation)
    if not isinstance(value, str) or not value or len(value) > 128 or any(character in value for character in "'\\\r\n\x00"):
        raise EngineError("input_test_contract", "The quoted equality profile needs a short actual ordinary string baseline")
    baseline_value = _response_value(artifact, selector)
    if type(baseline_value) not in {int, float} or baseline_value <= 0:
        raise EngineError("input_test_contract", "The chosen baseline selector must contain a real nonempty numeric result")
    values = [("normal", "normal", value), ("attack", "attack", value + "' AND '13'='13"),
              ("negative", "negative", value + "' AND '13'='17"),
              ("sensitivity", "sensitivity", value + "' AND '19'='19"),
              ("second_false", "negative", value + "' AND '19'='23")]
    oracle = {"type": "sql_boolean", "version": "1", "proof_scope": "sql_boolean_difference",
              "selector": selector, "sql_context": "quoted_string_equality",
              "baseline_evidence_id": evidence["id"], "baseline_sha256": evidence["sha256"]}
    return values, oracle, request


def _response_value(artifact, selector):
    raw = base64.b64decode(artifact["response"]["body_base64"], validate=True).decode("utf-8")
    if selector == "body":
        return raw
    from ..transport import pointer
    return pointer(json.loads(raw), selector[5:] if selector.startswith("json:") else selector)
