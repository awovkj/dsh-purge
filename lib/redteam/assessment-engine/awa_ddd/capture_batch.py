"""One bounded worker for explicit read-only captures, with durable per-item runs."""
from __future__ import annotations

import json
import re
import sqlite3
import time
from urllib.parse import urlsplit

from . import engine
from .store import EngineError, Project, contained

REQUEST_FIELDS = {"operation_id", "url", "headers", "session_id", "resource_id", "idempotency_key", "timeout", "max_bytes", "effect"}


def validate(args):
    if not isinstance(args, dict) or set(args) - {"project_id", "requests", "stop_on_error"} \
            or not isinstance(args.get("requests"), list) or not 1 <= len(args["requests"]) <= 20 \
            or "stop_on_error" in args and type(args["stop_on_error"]) is not bool:
        raise EngineError("capture_batch_fields", "Supply 1..20 explicit read-only requests and a boolean stop_on_error")
    keys = set()
    for request in args["requests"]:
        if not isinstance(request, dict) or set(request) - REQUEST_FIELDS \
                or not isinstance(request.get("operation_id"), str) \
                or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{0,199}", request["operation_id"]) \
                or not isinstance(request.get("idempotency_key"), str) \
                or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}", request["idempotency_key"]) \
                or request.get("effect", "read_only") != "read_only" or request["idempotency_key"] in keys:
            raise EngineError("capture_batch_request", "Each request needs one exact operation, unique idempotency key and read-only fields")
        keys.add(request["idempotency_key"])
    return args["requests"]


def run(project, args):
    requests = validate(args)
    started, rows, stopped, attempts = time.monotonic(), [], None, 0
    for index, request in enumerate(requests):
        capture_started = False
        try:
            check_context = getattr(project, "check_batch_context", None)
            if check_context is not None:
                check_context()
            prepared = engine.preflight_capture(project, request)
            if prepared["operation"]["method"] not in {"GET", "HEAD", "OPTIONS"}:
                raise EngineError("capture_batch_method", "The actual operation must declare GET, HEAD or OPTIONS")
            capture_started = True
            attempts += 1
            evidence = engine.capture(project, request)
            reused = prepared["existing"] is not None
            receipt = evidence.get("execution_receipt") or {}
            sent = 0 if reused else receipt.get("requests_sent")
            responses = 0 if reused else receipt.get("responses_received")
            rows.append({"index": index, "state": "captured", "evidence_id": evidence["id"],
                         "run_id": evidence["run_id"], "operation_id": evidence["operation_id"],
                         "status_code": evidence.get("status_code"), "capture_complete": evidence["complete"],
                         "preflight_state": "checked", "reused": reused, "requests_sent": sent,
                         "responses_received": responses, "response_bytes": 0 if reused else evidence.get("response_bytes"),
                         "dispatch_attempts": 0 if reused else receipt.get("dispatch_attempts"),
                         "automatic_retry_allowed": False})
            if not evidence["complete"]:
                stopped = "capture_incomplete"
                break
        except EngineError as error:
            uncertain = capture_started and error.details.get("requests_sent") != 0 or error.code in {"run_uncertain", "run_active"}
            rows.append({"index": index, "state": "uncertain" if uncertain else "rejected", "error_code": error.code,
                         **{name: value for name, value in error.details.items() if name in {"run_id", "evidence_id", "operation_id"}},
                         "requests_sent": None if capture_started and uncertain else 0,
                         "responses_received": None if capture_started and uncertain else 0,
                         "response_bytes": None if capture_started and uncertain else 0,
                         "dispatch_attempts": None if capture_started and uncertain else 0,
                         "automatic_retry_allowed": False})
            if uncertain or args.get("stop_on_error", True):
                stopped = "dispatch_uncertain" if uncertain else "item_rejected"
                break
    def total(field):
        values = [row.get(field) for row in rows]
        return sum(values) if all(type(value) is int and value >= 0 for value in values) else None

    next_index = len(rows)
    result = {"state": "partial" if stopped else "completed", "results": rows, "total": len(requests),
              "captured": sum(row["state"] == "captured" for row in rows),
              "reused": sum(row.get("reused") is True for row in rows),
              "rejected": sum(row["state"] == "rejected" for row in rows),
              "uncertain": sum(row["state"] == "uncertain" or row.get("capture_complete") is False for row in rows),
              "incomplete": sum(row.get("capture_complete") is False for row in rows),
              "remaining": len(requests) - next_index, "next_index": next_index if next_index < len(requests) else None,
              "stopped_reason": stopped, "capture_attempts": attempts, "requests_sent": total("requests_sent"),
              "responses_received": total("responses_received"), "response_bytes": total("response_bytes"),
              "dispatch_attempts": total("dispatch_attempts"), "request_count_known": total("requests_sent") is not None,
              "elapsed_ms": round((time.monotonic() - started) * 1000, 3), "execution_strategy": "single_native_worker",
              "can_confirm": False, "security_coverage_granted": False, "automatic_retry_allowed": False}
    project.event("http.batch_completed", {key: value for key, value in result.items() if key != "results"})
    return result


def _source_rule(target):
    from .assessment_mode import _url_rule
    if target.startswith(("http://", "https://")):
        return _url_rule(target)
    parsed = urlsplit("http://" + ("[" + target + "]" if target.count(":") > 1 and not target.startswith("[") else target))
    if not parsed.hostname or parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment:
        raise ValueError()
    return {"kind": "host", "host": parsed.hostname, "port": parsed.port}


def _source_guard(project, expected, request):
    from .assessment_mode import _rule_matches
    source = contained(project.workspace.parent / "assets.db", project.workspace.parent)
    if not source.is_file() or source.stat().st_nlink != 1:
        raise EngineError("capture_batch_source", "The fixed engagement ledger is unavailable; preserve existing runs")
    try:
        with sqlite3.connect(source.as_uri() + "?mode=ro", uri=True, timeout=5) as database:
            database.row_factory = sqlite3.Row
            policy = database.execute("SELECT assessment_mode, scope_json, exclude_json FROM engagement_policy WHERE singleton=1").fetchone()
            if policy is None or {"assessment_mode": policy["assessment_mode"], "scope": json.loads(policy["scope_json"]),
                                  "exclude": json.loads(policy["exclude_json"])} != expected["source_policy"]:
                raise EngineError("capture_batch_source", "The immutable engagement policy differs from this worker context")
            if policy["assessment_mode"] == "src":
                stops = database.execute("SELECT target FROM src_source_stop ORDER BY vuln_id LIMIT 10001").fetchall()
                if len(stops) > 10000:
                    raise EngineError("capture_batch_source", "The SRC source-stop inventory exceeds its bounded guard")
                if any(_rule_matches(_source_rule(row["target"]), request["url"], request["method"]) for row in stops):
                    raise EngineError("stopped_at_evidence", "The source target stopped before dispatch; use offline review", {"requests_sent": 0})
            session_id = request.get("session_id")
            table = database.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='assessment_cookie_session'").fetchone()
            row = database.execute("SELECT document FROM assessment_cookie_session WHERE session_id=?", (session_id,)).fetchone() if table and session_id else None
            if row:
                cookie_policy = json.loads(row["document"])
                session = project.get("session", session_id)
                if session["generation"] == cookie_policy["generation"]:
                    target, at = urlsplit(request["url"]), time.time() * 1000
                    origin = target.scheme + "://" + target.netloc
                    for cookie in cookie_policy["cookies"]:
                        path = cookie["path"]
                        if origin != cookie_policy["origin"] or cookie["secure"] and target.scheme != "https" \
                                or cookie["expires"] is not None and cookie["expires"] <= at \
                                or not (target.path == path or target.path.startswith(path if path.endswith("/") else path + "/")):
                            raise EngineError("capture_batch_cookie", "Captured session cookies cannot escape their origin/path/Secure/expiry", {"requests_sent": 0})
    except (OSError, sqlite3.Error, ValueError, KeyError, TypeError) as error:
        if isinstance(error, EngineError):
            raise
        raise EngineError("capture_batch_source", "The fixed engagement guard cannot be read; no new dispatch is allowed", {"requests_sent": 0}) from error


def private_dispatch(workspace, args):
    if not isinstance(args, dict) or set(args) - {"project_id", "requests", "stop_on_error", "context", "required_assessment_mode"}:
        raise EngineError("capture_batch_fields", "Private batch context has a fixed shape")
    expected = args.get("context")
    if not isinstance(expected, dict) or set(expected) != {"target", "scope", "exclude", "assessment_mode", "assessment_model", "source_policy"}:
        raise EngineError("capture_batch_source", "A fixed current engagement context is required")
    if args.get("required_assessment_mode", expected["assessment_mode"]) != expected["assessment_mode"]:
        raise EngineError("assessment_mode_mismatch", "The required mode cannot replace the fixed batch context", {"requests_sent": 0})
    native_args = {key: value for key, value in args.items() if key not in {"context", "required_assessment_mode"}}
    validate(native_args)
    with Project(workspace, args["project_id"]) as project:
        def check_context():
            config = project.config
            if any(config.get(name, "v1" if name == "assessment_model" else None) != expected[name]
                   for name in ("target", "scope", "exclude", "assessment_mode", "assessment_model")):
                raise EngineError("capture_batch_context", "The current internal context changed; do not dispatch", {"requests_sent": 0})
        def guard(request):
            check_context()
            _source_guard(project, expected, request)
        project.before_http_dispatch = guard
        project.check_batch_context = check_context
        from .publication import invoke
        return invoke(project, "http.capture_batch", native_args, lambda current, action, inputs: run(current, inputs))
