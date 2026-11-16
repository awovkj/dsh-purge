"""Capability registry: installed is not configured, and configured is not ready.

Readiness is evaluated per recipe profile (method, body, identity, fixture,
effect, proof scope), not as a global checkmark.  Missing adapters stay visible
as ``unavailable`` with a concrete configuration field.
"""
from __future__ import annotations

from datetime import datetime, timezone

from ..domain.repository import Repository
from ..store import EngineError

PROBE_MAX_AGE_SECONDS = 1800

PROVIDERS = ("playwright", "yakit", "tscanplus", "sqlmap")
PROFILES = {
    "playwright": {
        "profiles": ["native_page_visit", "native_reflected_xss", "host_mcp_page_visit", "multi_role_xss"],
        "limitations": ["native cannot upload", "native cannot arbitrary evaluate", "host tabs are not isolated contexts"],
        "configuration": ["host Playwright MCP tools or local Chromium/Playwright runtime"],
    },
    "yakit": {
        "profiles": ["public_get_replay"],
        "limitations": ["no scanning", "no POC", "no authenticated replay in the current adapter"],
        "configuration": ["tool.probe adapter:yakit with absolute yak_path"],
    },
    "tscanplus": {
        "profiles": ["existing_results_read", "route_candidate_read", "project_summary_read", "bounded_http_request"],
        "limitations": ["no scan execution", "no POC", "no cracking", "no JWT", "no route execution"],
        "configuration": ["loopback MCP URL and nondefault scanner_project"],
    },
    "sqlmap": {
        "profiles": ["metadata_only_single_parameter"],
        "limitations": ["no crawl", "no dump", "no stacked queries", "no time techniques", "single parameter"],
        "configuration": ["tool.probe with absolute sqlmap.py path"],
    },
}


def _row(provider, *, installed, configured, catalog_verified, profile_supported,
         authorized, ready, evidence=None, reasons=None):
    return {
        "provider": provider,
        "installed": bool(installed),
        "configured": bool(configured),
        "catalog_verified": bool(catalog_verified),
        "profile_supported": bool(profile_supported),
        "authorized": bool(authorized),
        "ready": bool(ready and installed and configured and catalog_verified and profile_supported and authorized),
        "unavailable_reasons": list(reasons or []),
        "evidence": evidence or {},
        "profiles": PROFILES[provider]["profiles"],
        "limitations": PROFILES[provider]["limitations"],
        "configuration": PROFILES[provider]["configuration"],
    }


def snapshot(project):
    """Compose current readiness from local configuration/probe records; no target traffic."""
    repository = Repository(project, read_only=True)
    configured_rows = {row["provider"]: row for row in repository.list("capability", limit=None)[0]}
    tool_configs = {row["id"]: row for row in project.list("tool_config")}
    probe_runs = [row for row in project.list("run") if row.get("action") == "probe"]
    by_adapter = {}
    for run in probe_runs:
        by_adapter[run.get("adapter")] = run
    rows = []
    for provider in PROVIDERS:
        configured = configured_rows.get(provider)
        if provider == "playwright":
            current = bool(configured and _fresh(configured.get("checked_at"))
                           and configured.get("runtime_binding") == runtime_binding((configured.get("evidence") or {}).get("executable_path"))
                           and configured.get("source") == "native_browser_probe")
            ready = current and configured.get("ready") is True
            row = _row(provider, installed=bool(configured and configured.get("installed")),
                       configured=bool(configured and configured.get("configured")), catalog_verified=current,
                       profile_supported=True, authorized=True, ready=ready,
                       evidence=(configured or {}).get("evidence"),
                       reasons=[] if ready else ["browser_probe_required" if not current else "browser_runtime_unavailable"])
            row["profile_readiness"] = {profile: {"ready": ready if profile in {"native_page_visit", "native_reflected_xss"} else False,
                "reasons": [] if ready and profile in {"native_page_visit", "native_reflected_xss"} else
                    ["profile_not_implemented" if profile in {"host_mcp_page_visit", "multi_role_xss"} else "browser_probe_required"]}
                for profile in PROFILES[provider]["profiles"]}
            rows.append(row)
        elif provider in {"yakit", "sqlmap"}:
            config = tool_configs.get(provider)
            run = by_adapter.get(provider)
            from ..runtime import execution_backend, tool_path_reason, tool_file_binding
            valid = bool(config and run and run.get("available") and run.get("status") == "succeeded"
                         and config.get("probe_run_id") == run.get("id")
                         and config.get("execution_backend") == execution_backend()
                         and config.get("executable_binding") is not None
                         and config.get("executable_binding") == run.get("executable_binding") == tool_file_binding(config.get("executable"))
                         and _fresh(run.get("finished_at"))
                         and tool_path_reason(config.get("executable"), "yak_path" if provider == "yakit" else "sqlmap_path") is None)
            supported = {}
            try:
                artifact = project.read_artifact(run) if valid else {}
                if valid and artifact.get("executable_binding") != config["executable_binding"]:
                    valid = False
                if valid and any(run.get(key) != value for key, value in artifact.get("execution", {}).items()):
                    valid = False
                if provider == "yakit" and valid:
                    from ..external import _yak_arguments
                    for https in (False, True):
                        _yak_arguments(artifact.get("tools") or [], "GET / HTTP/1.1\r\nHost: probe.invalid\r\n\r\n", https, 10)
                    supported["public_get_replay"] = True
                elif valid:
                    supported["metadata_only_single_parameter"] = True
            except (EngineError, OSError, ValueError, TypeError, KeyError):
                supported = {}
            authorized = _allowed(project, provider)
            row = _row(provider, installed=bool(run and run.get("available")), configured=bool(config),
                       catalog_verified=valid, profile_supported=bool(supported), authorized=authorized,
                       ready=valid and bool(supported) and authorized,
                       evidence={"probe_run_id": (run or {}).get("id"), "sha256": (run or {}).get("sha256"),
                                 "checked_at": (run or {}).get("finished_at")},
                       reasons=[] if valid and supported and authorized else
                           ["mode_profile_denied" if not authorized else "profile_schema_unsupported" if valid else "current_probe_required"])
            row["profile_readiness"] = {profile: {"ready": row["ready"] and supported.get(profile, False),
                                                  "reasons": row["unavailable_reasons"]}
                                         for profile in PROFILES[provider]["profiles"]}
            rows.append(row)
        else:
            from ..tscanplus import _settings, _gate
            support, state, valid = {}, {}, False
            try:
                state, catalog = _settings(project)
                run = project.get("run", state["probe_run_id"])
                valid = _fresh(run.get("finished_at"))
                tests = {"project_summary_read": ("project_summary", {"project": state["scanner_project"]}),
                         "existing_results_read": ("query_results", {"project": state["scanner_project"], "table": "poccheck", "result_limit": 20}),
                         "route_candidate_read": ("route_candidates", {"project": state["scanner_project"]}),
                         "bounded_http_request": ("http_request", {"url": "http://probe.invalid/", "method": "GET", "headers": "{}", "cookie": "", "body": "",
                             "follow_redirect": False, "path_as_is": True, "max_bytes": 8192, "max_lines": 80, "timeout": 15})}
                for profile_name, (tool_name, values) in tests.items():
                    try:
                        _gate(catalog, catalog, tool_name, values)
                        support[profile_name] = valid
                    except EngineError:
                        support[profile_name] = False
            except (EngineError, OSError, ValueError, TypeError, KeyError):
                valid = False
            row = _row(provider, installed=bool(state), configured=bool(project.config.get("external_tools", {}).get("tscanplus")),
                       catalog_verified=valid, profile_supported=any(support.values()), authorized=True,
                       ready=valid and any(support.values()), evidence={"probe_run_id": state.get("probe_run_id"),
                           "catalog_sha256": state.get("catalog_sha256")},
                       reasons=[] if valid and any(support.values()) else ["current_loopback_probe_required"])
            row["profile_readiness"] = {profile: {"ready": bool(support.get(profile)),
                "reasons": [] if support.get(profile) else ["profile_schema_unsupported" if valid else "current_probe_required"]}
                for profile in PROFILES[provider]["profiles"]}
            if not _allowed(project, "tscanplus"):
                row["profile_readiness"]["bounded_http_request"] = {"ready": False, "reasons": ["mode_profile_denied"]}
            rows.append(row)
    from .recipe_builder import automatic_provider
    return {"providers": rows, "automatic_recipes": [automatic_provider(family) for family in
            ("sql_injection", "template_injection", "generic", "access_control", "xss", "business_logic",
             "command_injection", "deserialization", "file_upload", "ssrf", "xxe", "path_traversal")],
            "policy": "installed != configured != ready; recipe-specific readiness is checked before execution.",
            "requests_sent": 0}


def ready_for(project, *, provider, profile, effect="read_only", method="GET", authenticated=False, fixture_id=None):
    """Recipe-specific readiness check used before a provider is named in a recipe."""
    if provider not in PROVIDERS:
        raise EngineError("capability_provider", "Unknown provider")
    if profile not in PROFILES[provider]["profiles"]:
        raise EngineError("capability_profile", "Unsupported provider profile")
    row = next((item for item in snapshot(project)["providers"] if item["provider"] == provider), None)
    status = (row or {}).get("profile_readiness", {}).get(profile, {})
    reasons = list(status.get("reasons") or [])
    if provider == "yakit" and (method != "GET" or authenticated):
        reasons.append("public_body_free_get_required")
    if provider == "playwright" and method != "GET":
        reasons.append("browser_navigation_requires_get")
    if provider == "sqlmap" and method not in {"GET", "POST"}:
        reasons.append("unsupported_method")
    if provider == "tscanplus" and profile == "bounded_http_request" and method not in {"GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"}:
        reasons.append("unsupported_method")
    if effect != "read_only" and provider in {"yakit", "playwright", "sqlmap"}:
        reasons.append("profile_is_read_only")
    if effect == "test_resource_write":
        fixture = Repository(project, read_only=True).get("fixture", fixture_id, required=False)
        if not fixture or fixture.get("state") not in {"verified", "leased", "readback_ok"}:
            reasons.append("write_profile_requires_disposable_fixture")
        if provider == "yakit" or not _allowed(project, provider):
            reasons.append("mode_or_profile_write_denied")
    ready = status.get("ready") is True and not reasons
    return {"provider": provider, "profile": profile, "ready": ready,
            "reasons": sorted(set(reasons)), "row": row}


def record(project, provider, **states):
    """Record an actual probe result for tests and local adapters."""
    if provider not in PROVIDERS:
        raise EngineError("capability_provider", "Unknown provider")
    repository = Repository(project)
    existing = repository.find_one("capability", provider=provider)
    row = existing or {"id": "CAP-" + provider, "provider": provider,
                       "created_at": __import__("datetime").datetime.now(
                           __import__("datetime").timezone.utc).isoformat()}
    for key in ("installed", "configured", "catalog_verified", "profile_supported", "authorized"):
        row[key] = bool(states.get(key, row.get(key, False)))
    row["ready"] = all(row[key] for key in ("installed", "configured", "catalog_verified",
                                            "profile_supported", "authorized"))
    row["unavailable_reasons"] = list(states.get("unavailable_reasons") or [])
    row["evidence"] = states.get("evidence") or {}
    row["source"] = "native_browser_probe" if provider == "playwright" else "native_tool_probe"
    row["checked_at"] = datetime.now(timezone.utc).isoformat()
    row["runtime_binding"] = runtime_binding(row["evidence"].get("executable_path"))
    if existing:
        repository.save("capability", row)
    else:
        repository.add("capability", row, immutable=False)
    return row


def runtime_binding(executable_path=None):
    from ..runtime import execution_backend
    from ..domain.common import digest
    from ..browser import available
    from pathlib import Path
    state = available()

    def fingerprint(value):
        try:
            path = Path(value)
            info = path.stat()
            return {"path": str(path.resolve()), "size": info.st_size, "mtime_ns": info.st_mtime_ns,
                    "device": info.st_dev, "inode": info.st_ino}
        except (OSError, ValueError, TypeError):
            return None

    return digest({"backend": execution_backend(), **{key: state.get(key) for key in ("node", "module_root", "module_path")},
                   "node_file": fingerprint(state.get("node")), "browser_file": fingerprint(executable_path),
                   "module_manifest": fingerprint(str(Path(state["module_path"]) / "package.json")) if state.get("module_path") else None})


def _fresh(value):
    try:
        elapsed = (datetime.now(timezone.utc) - datetime.fromisoformat(value)).total_seconds()
        return 0 <= elapsed <= PROBE_MAX_AGE_SECONDS
    except (TypeError, ValueError):
        return False


def _allowed(project, provider):
    from ..assessment_mode import mode
    return mode(project) != "src" or provider == "playwright"
