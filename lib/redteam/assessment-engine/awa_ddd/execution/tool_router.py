"""Demand-driven tool advice from current local facts, never automatic dispatch."""
from __future__ import annotations

import base64
import json

from .. import engine
from ..domain.repository import Repository
from ..scope import require_scope
from ..store import EngineError
from . import capabilities

PURPOSES = {"auto", "frontend", "browser", "request_replay", "scanner_results", "sql_verification"}


def route(project, args):
    allowed = {"project_id", "purpose", "operation_id", "evidence_ids", "campaign_id", "limit"}
    if not isinstance(args, dict) or set(args) - allowed or args.get("purpose", "auto") not in PURPOSES:
        raise EngineError("tool_route_arguments", "Select a literal purpose and current IDs; mode, tools, readiness and runtime are not writable inputs")
    limit, ids = args.get("limit", 5), args.get("evidence_ids") or []
    if type(limit) is not int or not 1 <= limit <= 10 or not isinstance(ids, list) or len(ids) > 32 \
            or any(not isinstance(identity, str) for identity in ids) or len(set(ids)) != len(ids):
        raise EngineError("tool_route_arguments", "Routing accepts 1..10 suggestions and at most 32 distinct actual E-IDs")
    operation = project.get("operation", args["operation_id"]) if args.get("operation_id") else None
    if operation:
        require_scope(project.config, operation["url"])
    materials = []
    for identity in ids:
        meta, artifact = engine.verify_current_evidence(project, identity)
        if operation and meta.get("operation_id") != operation["id"]:
            raise EngineError("tool_route_evidence", "Routing evidence must belong to the selected exact operation")
        materials.append((meta, artifact))
    snapshot = capabilities.snapshot(project)
    by_provider = {row["provider"]: row for row in snapshot["providers"]}
    advice = []

    def add(provider, profile, reason, action, input, *, offline=True, ready=True, missing=None, fallback=None):
        advice.append({"provider": provider, "profile": profile, "reason": reason,
                       "state": "ready" if ready else "preparation_required", "ready": ready,
                       "missing": list(missing or []), "next": {"action": action, "input": input},
                       "offline_only": offline, "automatic_dispatch": False, "fallback": fallback, "can_confirm": False})

    purpose, scripts, maps, html_seen = args.get("purpose", "auto"), [], [], False
    from ..assessment_mode import stop_receipt
    stopped = stop_receipt(project, operation) if operation else None
    if stopped and purpose in {"browser", "request_replay", "sql_verification"}:
        add("native", "stopped_at_evidence", "This exact SRC target already stopped; inspect existing material instead of preparing new target requests",
            "evidence.inspect" if materials else "surface.inspect",
            {"evidence_id": materials[0][0]["id"]} if materials else {"operation_id": operation["id"]})
        return _result(project, purpose, advice, limit, snapshot)
    for meta, artifact in materials:
        response = artifact["response"]
        mime = dict((str(key).lower(), str(value).lower()) for key, value in response.get("headers") or []).get("content-type", "")
        if artifact["request"]["method"] != "GET" or response["status"] != 200:
            continue
        if "javascript" in mime or "ecmascript" in mime:
            scripts.append(meta["id"])
        elif "text/html" in mime:
            html_seen = True
        elif "json" in mime and response.get("length", 0) <= 2 * 1024 * 1024:
            try:
                document = json.loads(base64.b64decode(response["body_base64"], validate=True))
                if isinstance(document, dict) and document.get("version") == 3 and isinstance(document.get("sources"), list) \
                        and isinstance(document.get("mappings"), str):
                    maps.append(meta["id"])
            except (ValueError, TypeError, KeyError):
                pass
    if purpose in {"auto", "frontend"}:
        if scripts:
            add("native", "javascript_ast", "Complete JavaScript already exists; parse offline before another HTTP request or browser launch",
                "surface.from_evidence", {"evidence_ids": scripts})
        if maps:
            add("native", "sourcemap_discovery", "A complete source map already exists; analyze offline with its exact provenance",
                "surface.from_sourcemap", {"evidence_id": maps[0]})
    browser_needed = purpose == "browser" or purpose == "frontend" and not (scripts or maps) \
        or purpose == "auto" and html_seen and not (scripts or maps)
    if browser_needed:
        if stopped:
            add("native", "stopped_at_evidence", "SRC direct evidence stops this page; browser observation cannot reopen its target traffic",
                "surface.inspect", {"operation_id": operation["id"]})
            browser_needed = False
    if browser_needed:
        ready = capabilities.ready_for(project, provider="playwright", profile="native_page_visit")
        from .recipe_builder import _first_session
        session = _first_session(project, operation) if operation else None
        concrete = bool(operation and "{" not in operation["url"] and operation["method"] == "GET"
                        and (operation.get("auth") == "public" or session is not None))
        if ready["ready"] and concrete:
            add("playwright", "native_page_visit", "Rendering, dynamic routes or DOM behavior needs an isolated real browser; HTTP text is not runtime proof",
                "browser.visit", {"url": operation["url"], "allow_write": False, "headless": True, "timeout": 15,
                                  **({"session_id": session["id"]} if session else {})}, offline=False)
        else:
            add("playwright", "native_page_visit", "Do not infer a DOM result while the exact page, runtime or identity is missing",
                "browser.probe" if not ready["ready"] else "action.help", {} if not ready["ready"] else {"name": "browser.visit"},
                missing=ready["reasons"] + ([] if concrete else ["exact_get_consumer_and_verified_identity"]), ready=False)
    if purpose == "request_replay":
        ready = capabilities.ready_for(project, provider="yakit", profile="public_get_replay",
            method=(operation or {}).get("method", "GET"), authenticated=bool(operation and operation.get("auth") != "public"))
        concrete = bool(operation and "{" not in operation["url"])
        if ready["ready"] and concrete:
            add("yakit", "public_get_replay", "Use the current verified fuzzer schema with exact packet, TLS and no-follow controls for this public GET",
                "tool.yakit_replay", {"operation_id": operation["id"], "url": operation["url"], "effect": "read_only"}, offline=False)
        else:
            add("yakit", "public_get_replay", "Installed Yak or a codec handshake is not a replay-ready fuzzer profile",
                "action.help", {"name": "tool.probe"}, ready=False, missing=ready["reasons"] + ([] if concrete else ["exact_public_get"]),
                fallback={"action": "http.preflight", "input": {"operation_id": operation["id"]}} if concrete else None)
    configured_scanner = isinstance(project.config.get("external_tools", {}).get("tscanplus"), dict)
    if purpose == "scanner_results" or purpose == "auto" and configured_scanner:
        for profile, action in (("project_summary_read", "tool.tscanplus_summary"), ("existing_results_read", "tool.tscanplus_results"),
                                ("route_candidate_read", "tool.tscanplus_routes")):
            current = by_provider["tscanplus"]["profile_readiness"][profile]
            add("tscanplus", profile, "Reuse the recorded nondefault scanner namespace; existing result reads are not active scans or vulnerability proof",
                action if current["ready"] else "action.help", {"table": "poccheck", "result_limit": 20} if current["ready"] and profile == "existing_results_read"
                else {} if current["ready"] else {"name": "tool.probe"}, ready=current["ready"], missing=current["reasons"], offline=True)
    if purpose == "sql_verification":
        sql_inputs = [entry for entry in (operation or {}).get("inputs", []) if "sql_injection" in (entry.get("test_families") or [])]
        repository = Repository(project, read_only=True)
        from ..planning.membership import rows as member_rows
        campaigns = [row for row in repository.list("campaign", limit=None)[0] if row.get("state") == "active"
                     and any(member.get("operation_id") == (operation or {}).get("id") and member.get("family") == "sql_injection"
                             for member in member_rows(project, row, "hypothesis"))]
        if args.get("campaign_id"):
            campaigns = [row for row in campaigns if row["id"] == args["campaign_id"]]
            if not campaigns:
                raise EngineError("tool_route_campaign", "The selected campaign has no frozen SQL task for this exact operation")
        campaign = campaigns[0] if len(campaigns) == 1 else None
        if len(sql_inputs) == 1 and project.config.get("assessment_model", "v1") == "v1":
            add("native", "sql_boolean_controls", "Read the current v1 input obligation and exact fixed control contract; do not silently switch assessment models",
                "assessment.prepare", {"operation_id": operation["id"]})
        elif len(sql_inputs) == 1 and (sql_inputs[0].get("test_contract") or {}).get("sql_context") == "quoted_string_equality" and campaign:
            add("native", "sql_boolean_controls", "Prefer two true/false controls on the actual baseline; count-only differences cannot confirm SQL injection",
                "campaign.next", {"campaign_id": campaign["id"], "limit": 3})
        else:
            ready = by_provider["sqlmap"]["profile_readiness"]["metadata_only_single_parameter"]
            add("sqlmap", "metadata_only_single_parameter", "Use a bounded metadata channel after selecting one actual parameter; no dump, crawl or timing escalation",
                "action.help", {"name": "tool.sqlmap" if ready["ready"] else "tool.probe"}, ready=False,
                missing=ready["reasons"] + ["exact_parameter_and_normal_metadata_control"])
    if not advice:
        add("native", "evidence_first", "No runtime-specific need is established; inspect local surface and prepare precise security controls",
            "surface.inspect" if operation else "surface.list", {"operation_id": operation["id"]} if operation else {"limit": 10})
    return _result(project, purpose, advice, limit, snapshot)


def _result(project, purpose, advice, limit, snapshot):
    from ..runtime import execution_backend
    from ..assessment_mode import mode
    return {"purpose": purpose, "assessment_mode": mode(project), "execution_backend": execution_backend(),
            "backend_selection": "operator_fixed_no_model_switch", "items": advice[:limit], "total": len(advice),
            "remaining": max(0, len(advice) - limit), "readiness": snapshot, "requests_sent": 0,
            "target_traffic_sent": False, "automatic_dispatch": False,
            "host_mcp_visibility": "not_inspected_by_native_route", "notice": "Advice selects a bounded profile; actual execution still rechecks every prerequisite."}
