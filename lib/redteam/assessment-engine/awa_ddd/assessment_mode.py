"""Persisted discovery-only policy; a session prompt cannot widen this boundary."""
from __future__ import annotations

import hashlib
import json
import re
from ipaddress import ip_address
from urllib.parse import urlsplit, urlunsplit, unquote, quote

from .store import EngineError, now, contained

MODES = {"assessment", "src"}
SRC_MAX_RESPONSE = 64 * 1024
SRC_MAX_TIMEOUT = 15
SOURCE_STOP_FILE = "dsh-source-stops.json"
SOURCE_STOP_SCHEMA = "dsh-purge-source-stops/v1"
SOURCE_STOP_MAX_BYTES = 2 * 1024 * 1024
SRC_DENIED_ACTIONS = frozenset({
    "tool.sqlmap", "tool.yakit_replay", "tool.tscanplus_request",
    "test.run_external", "scenario.run", "test.run_scenario",
})


def normalize_mode(value):
    selected = "assessment" if value is None else value
    if not isinstance(selected, str) or selected not in MODES:
        raise EngineError("assessment_mode", "assessment_mode must be assessment or src")
    return selected


def mode(project):
    return normalize_mode(project.config.get("assessment_mode"))


def require_mode(project, args):
    required = args.get("required_assessment_mode")
    if required is not None and normalize_mode(required) != mode(project):
        raise EngineError("assessment_mode_mismatch",
                          "The session requires a project created in the same assessment mode; existing project mode is immutable",
                          {"assessment_mode": mode(project), "required_assessment_mode": required,
                           "next_action": "project.create", "requests_sent": 0})


def require_action(project, action, args):
    require_mode(project, args)
    if mode(project) == "src" and action in SRC_DENIED_ACTIONS:
        raise EngineError("src_action_denied",
                          "SRC uses bounded read-only discovery and offline evidence review; this execution action is unavailable",
                          {"action": action, "assessment_mode": "src", "requests_sent": 0,
                           "next_action": "assessment.prepare"})


def _stop_id(operation_id):
    return "SRC-" + hashlib.sha256(operation_id.encode("utf-8")).hexdigest()[:24]


def _endpoint(url):
    from .scope import normalize_url
    parsed = urlsplit(normalize_url(url))
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))


def _url_rule(url, **extra):
    parsed = urlsplit(_endpoint(url))
    host = parsed.hostname
    try:
        host = str(ip_address(host))
    except ValueError:
        pass
    authority = "[" + host + "]" if ":" in host else host
    if parsed.port and parsed.port != (443 if parsed.scheme == "https" else 80):
        authority += ":" + str(parsed.port)
    return {**extra, "kind": "url", "origin": parsed.scheme + "://" + authority,
            "path": unquote(parsed.path)}


def _source_snapshot(project):
    """The owner refreshes this fixed file from its immutable source ledger, never from action input."""
    try:
        path = contained(project.workspace / SOURCE_STOP_FILE, project.workspace)
        if not path.exists():
            return None, [], None  # Standalone upstream SRC projects have no source ledger.
        if not path.is_file() or path.stat().st_size > SOURCE_STOP_MAX_BYTES:
            raise ValueError()
        document = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(document, dict) or set(document) != {"schema", "project_id", "source_engagement_id", "rules"} \
                or document["schema"] != SOURCE_STOP_SCHEMA or document["project_id"] != project.project_id \
                or re.fullmatch(r"rt-[a-f0-9]{24}", str(document["source_engagement_id"])) is None \
                or not isinstance(document["rules"], list) or len(document["rules"]) > 10000:
            raise ValueError()
        rules = document["rules"]
        for rule in rules:
            if not isinstance(rule, dict) or not isinstance(rule.get("id"), str) \
                    or re.fullmatch(r"source-[0-9]+-[a-f0-9]{16}", rule["id"]) is None \
                    or not isinstance(rule.get("evidence_ids"), list) or len(rule["evidence_ids"]) > 32 \
                    or any(not isinstance(item, str) or re.fullmatch(r"ev_[a-f0-9]{64}", item) is None for item in rule["evidence_ids"]):
                raise ValueError()
            fields = {"id", "evidence_ids", "kind"}
            if rule.get("kind") == "url":
                if set(rule) != fields | {"origin", "path"} or not isinstance(rule["origin"], str) \
                        or not isinstance(rule["path"], str) or not rule["path"].startswith("/"):
                    raise ValueError()
                normalized = _url_rule(rule["origin"] + quote(rule["path"], safe="/{}:!$&'()*+,;=@-._~"))
                if normalized["origin"] != rule["origin"] or normalized["path"] != rule["path"]:
                    raise ValueError()
            elif rule.get("kind") == "host":
                if set(rule) != fields | {"host", "port"} or not isinstance(rule["host"], str) \
                        or not rule["host"] or len(rule["host"]) > 256 \
                        or re.search(r"[\s\\/?#@]", rule["host"]) \
                        or rule["port"] is not None and (type(rule["port"]) is not int or not 1 <= rule["port"] <= 65535):
                    raise ValueError()
            else:
                raise ValueError()
        return str(path), rules, document["source_engagement_id"]
    except (OSError, ValueError, TypeError, KeyError, EngineError) as exc:
        raise EngineError("src_stop_snapshot", "The fixed SRC source-stop snapshot is invalid; preserve it and use offline diagnosis",
                          {"requests_sent": 0, "automatic_retry_allowed": False, "next_action": "evidence.inspect"}) from exc


def _rule_matches(rule, url, method):
    from .scope import normalize_url
    parsed = urlsplit(normalize_url(url))
    if rule.get("method") and rule["method"] != method.upper():
        return False
    if rule["kind"] == "host":
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        host = parsed.hostname
        try:
            host = str(ip_address(host))
        except ValueError:
            pass
        return host == rule["host"] and (rule["port"] is None or port == rule["port"])
    if _url_rule(url)["origin"] != rule["origin"]:
        return False
    expression = "".join(r"[^/]+" if re.fullmatch(r"\{[A-Za-z_][\w-]*\}", part)
                         else re.escape(part) for part in re.split(r"(\{[A-Za-z_][\w-]*\})", rule["path"]))
    return re.fullmatch(expression, unquote(parsed.path)) is not None


def browser_stop_rules(project):
    if mode(project) != "src":
        return {"sourceStopFile": None, "sourceStopIdentity": None, "stopRules": []}
    path, _, identity = _source_snapshot(project)
    native = [_url_rule(row["endpoint"], id=row["id"], method=row["method"])
              for row in project.list("src_stop")]
    return {"sourceStopFile": path, "sourceStopIdentity": identity,
            "stopRules": native}


def record_stop(project, *, operation_id, evidence_ids, decision_id=None, finding_id=None,
                oracle_type=None):
    """Freeze an accepted direct finding; later evidence changes never reopen execution."""
    if mode(project) != "src":
        return None
    operation = project.get("operation", operation_id)
    identity = _stop_id(operation_id)
    existing = project.get("src_stop", identity, required=False)
    if existing:
        return existing
    if not evidence_ids:
        raise EngineError("evidence_binding", "A SRC stopping receipt requires direct evidence")
    if finding_id:
        finding = project.get("v2_finding", finding_id, required=False)
        if finding is not None:
            if finding.get("mode") != "machine" or finding.get("status") != "machine_confirmed":
                raise EngineError("src_stop_proof", "A new SRC stop requires a current trusted machine verdict")
            from .integration import _v2_machine
            proof = _v2_machine(project, finding)
            if proof.get("operation_id") != operation_id or proof.get("evidence_ids") != list(evidence_ids) \
                    or proof.get("decision_id") != decision_id:
                raise EngineError("src_stop_proof", "The stopping proof belongs to another operation or control group")
        else:
            finding = project.get("finding", finding_id)
            if finding.get("status") != "confirmed" or finding.get("superseded_by") \
                    or finding.get("decision_id") != decision_id or finding.get("evidence_ids") != list(evidence_ids):
                raise EngineError("src_stop_proof", "The legacy finding does not bind these exact current controls")
            decision = project.get("decision", decision_id)
            if finding.get("mode") == "machine":
                from .proof_claim import finding_proof_state
                if finding_proof_state(project, finding).get("machine_proof") is not True:
                    raise EngineError("src_stop_proof", "The legacy machine finding requires current bounded proof")
            else:
                oracle = decision.get("oracle") or {}
                if decision.get("mode") != "analyst" or oracle.get("type") != "analyst_runtime" \
                        or oracle.get("test_family") != "xss" or not decision.get("obligation_id"):
                    raise EngineError("src_stop_proof", "A review draft cannot authorize a new SRC stop")
                from .assessment import _bound_xss_proof, validate_confirmation
                proof = _bound_xss_proof(project, decision)
                validate_confirmation(project, decision, finding.get("category"))
                if proof.get("source") != "local_playwright":
                    raise EngineError("src_stop_proof", "Imported or freely declared runtime labels cannot authorize a new SRC stop")
            if decision.get("operation_id") != operation_id or decision.get("evidence_ids") != list(evidence_ids):
                raise EngineError("src_stop_proof", "The legacy decision belongs to another operation or control group")
    elif decision_id:
        decision = project.get("decision", decision_id)
        item = project.get("obligation", decision.get("obligation_id"))
        from .assessment import current_machine_proof
        family = "access_control" if item.get("kind") in {"access", "ownership"} else item.get("test_family") or "generic"
        current_machine_proof(project, decision_id, family)
        if decision.get("operation_id") != operation_id or decision.get("evidence_ids") != list(evidence_ids):
            raise EngineError("src_stop_proof", "The stopping decision does not bind these exact captures")
    else:
        raise EngineError("src_stop_proof", "Evidence completeness alone cannot authorize a new SRC stop")
    from .engine import verify_current_evidence
    evidence = [verify_current_evidence(project, identity)[0] for identity in evidence_ids]
    with project.transaction():
        existing = project.get("src_stop", identity, required=False)
        if existing:
            return existing
        receipt = {"id": identity, "operation_id": operation_id,
                   "endpoint": _endpoint(operation["url"]), "method": operation["method"],
                   "decision_id": decision_id, "finding_id": finding_id,
                   "oracle_type": oracle_type, "evidence_ids": list(evidence_ids),
                   "evidence_hashes": [{"evidence_id": row["id"], "sha256": row["sha256"]} for row in evidence],
                   "policy": "stop_at_direct_evidence", "created_at": now()}
        project.put("src_stop", receipt, create_only=True)
        project.event("src.stopped_at_evidence", {"operation_id": operation_id,
                                                 "decision_id": decision_id, "finding_id": finding_id,
                                                 "evidence_ids": list(evidence_ids)})
        return receipt


def record_decision(project, decision):
    if mode(project) != "src" or decision.get("outcome") != "confirmed" \
            or decision.get("mode") != "machine" or (decision.get("oracle") or {}).get("type") == "baseline":
        return None
    from .engine import _decision_valid
    _decision_valid(project, decision)
    return record_stop(project, operation_id=decision["operation_id"],
                       evidence_ids=decision["evidence_ids"], decision_id=decision["id"],
                       oracle_type=(decision.get("oracle") or {}).get("type"))


def stop_receipt(project, operation):
    if mode(project) != "src":
        return None
    receipt = project.get("src_stop", _stop_id(operation["id"]), required=False)
    _, source, _ = _source_snapshot(project)
    if receipt is None:
        receipt = next((row for row in project.list("src_stop") if _rule_matches(
            _url_rule(row["endpoint"], method=row["method"]), operation["url"], operation["method"])), None)
    if receipt is None:
        receipt = next((row for row in source if _rule_matches(row, operation["url"], operation["method"])), None)
    return receipt


def require_not_stopped(project, operation):
    receipt = stop_receipt(project, operation)
    if receipt:
        raise EngineError("stopped_at_evidence",
                          "SRC already has direct evidence for this operation; continue with offline review/reporting or a different candidate",
                          {"operation_id": receipt.get("operation_id"), "stop_id": receipt["id"], "decision_id": receipt.get("decision_id"),
                           "evidence_ids": receipt["evidence_ids"], "assessment_mode": "src",
                           "requests_sent": 0, "next_action": "evidence.inspect"})


def capture_policy(project, operation, args, *, existing=False):
    if mode(project) != "src":
        return
    if operation["method"] not in {"GET", "HEAD", "OPTIONS"} or args.get("effect", "read_only") != "read_only":
        raise EngineError("src_write_denied", "SRC does not submit writes or create mutation fixtures",
                          {"operation_id": operation["id"], "requests_sent": 0, "assessment_mode": "src"})
    if not existing:
        require_not_stopped(project, operation)
        if args.get("url"):
            require_not_stopped(project, {**operation, "url": args["url"]})


def browser_policy(project, url, args):
    if mode(project) != "src":
        return
    if args.get("allow_write") is True:
        raise EngineError("src_write_denied", "SRC browser visits remain read-only", {"requests_sent": 0})
    allowed = {"wait", "waitForSelector", "waitForDialog", "waitForURL"}
    for action in args.get("actions", []):
        if not isinstance(action, dict) or action.get("type", action.get("action")) not in allowed:
            raise EngineError("src_action_denied", "SRC browser actions support observation and waits only",
                              {"requests_sent": 0, "assessment_mode": "src"})
    require_not_stopped(project, {"id": "browser-entry", "url": url, "method": "GET"})


def work_policy(project, row, operation):
    """Do not schedule prohibited controls to fill discovery-only coverage gaps."""
    if mode(project) != "src":
        return row
    receipt = stop_receipt(project, operation)
    reason = "stopped_at_evidence" if receipt else "src_write_denied" if operation["method"] not in {"GET", "HEAD", "OPTIONS"} else None
    if reason is None:
        return row
    row.update(execution_blocked=True, stop_reason=reason,
               note_zh="SRC 仅保留已发现问题的直接证据；本操作的后续测试保留为未测范围，继续离线复核或处理其他候选。")
    if "queue_status" in row:
        row["queue_status"] = "blocked"
        row["missing_prerequisites"] = list(dict.fromkeys(row.get("missing_prerequisites", []) + [reason]))
    if "preparation_state" in row:
        row["preparation_state"] = "stopped_at_evidence" if receipt else "src_discovery_only"
    row["suggested_action"] = "evidence.inspect" if receipt else "surface.inspect"
    native_refs = [value for value in receipt.get("evidence_ids", []) if value.startswith("E-")] if receipt else []
    row["input_template"] = {"evidence_id": native_refs[0]} if native_refs else {"operation_id": operation["id"]}
    if receipt and not native_refs:
        row["suggested_action"] = "surface.inspect"
    row["help_input"] = {"name": row["suggested_action"]}
    row["recommended_tools"] = []
    row["preparation_actions"] = []
    browser = row.get("browser_testing")
    if isinstance(browser, dict):
        browser.update(stage="blocked", call_needed=False, invoke_now=False, execution_blocked=True,
                       required_input_fields=[reason])
        browser.pop("native_visit_input", None)
    return row


def status(project):
    selected = mode(project)
    return {"assessment_mode": selected,
            "stop_policy": "stop_at_direct_evidence" if selected == "src" else "existing_assessment_policy",
            "allow_mutation": False if selected == "src" else bool(project.config.get("allow_mutation")),
            "stopped_operations": [{"operation_id": row["operation_id"], "decision_id": row.get("decision_id"),
                                    "evidence_ids": row["evidence_ids"]} for row in project.list("src_stop")],
            "max_response_bytes": SRC_MAX_RESPONSE if selected == "src" else None}
