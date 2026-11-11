"""Private owner configuration for the physically embedded dsh-purge engine."""
from __future__ import annotations

from .assessment_mode import normalize_mode
from .contracts import _validate_json
from .scope import normalize_url, validate_config
from .store import EngineError, Project

MAX_RULES = 256
MAX_URL_BYTES = 8192
FIELDS = frozenset({"project_id", "assessment_mode", "scope", "exclude",
                    "required_assessment_mode"})
REQUIRED_FIELDS = FIELDS - {"required_assessment_mode"}


def _rules(value, *, nonempty=False):
    if not isinstance(value, list) or (nonempty and not value):
        raise EngineError("dsh_context_shape", "Owner scope must be a nonempty URL array and exclude must be a URL array")
    if len(value) > MAX_RULES:
        raise EngineError("dsh_context_budget", "Owner scope and exclude each permit at most 256 URL rules")
    normalized = []
    for rule in value:
        if not isinstance(rule, str):
            raise EngineError("dsh_context_shape", "Owner scope and exclude must contain only HTTP(S) URL strings")
        if len(rule.encode("utf-8")) > MAX_URL_BYTES:
            raise EngineError("dsh_context_budget", "Owner URL rules must not exceed 8192 UTF-8 bytes")
        normalized.append(normalize_url(rule))
    return normalized


def _merge(old, incoming):
    _rules(old)
    merged = list(old)
    known = {normalize_url(rule) for rule in old}
    for rule in incoming:
        if rule not in known:
            merged.append(rule)
            known.add(rule)
    if len(merged) > MAX_RULES:
        raise EngineError("dsh_context_budget", "Merged owner scope and exclude each permit at most 256 URL rules")
    return merged, len(merged) - len(old)


def _configure(workspace, args):
    if not isinstance(args, dict):
        raise EngineError("dsh_context_shape", "Owner configuration requires a JSON object")
    _validate_json(args)
    if set(args) - FIELDS or not REQUIRED_FIELDS.issubset(args):
        raise EngineError("dsh_context_shape", "Owner configuration accepts only project_id, assessment_mode, scope, exclude and optional required_assessment_mode")
    if args["project_id"] != "assessment":
        raise EngineError("dsh_context_project", "Owner configuration requires the internal assessment project")
    selected = args["assessment_mode"]
    if not isinstance(selected, str) or selected not in {"assessment", "src"}:
        raise EngineError("assessment_mode", "assessment_mode must be assessment or src")
    required = args.get("required_assessment_mode", selected)
    if not isinstance(required, str) or required not in {"assessment", "src"}:
        raise EngineError("assessment_mode", "required_assessment_mode must be assessment or src")
    scope = _rules(args["scope"], nonempty=True)
    exclude = _rules(args["exclude"])
    with Project(workspace, args["project_id"]) as project, project.transaction():
        current = project.config
        if not current:
            raise EngineError("dsh_context_project", "The internal assessment project must be initialized before owner configuration")
        actual = normalize_mode(current.get("assessment_mode"))
        if selected != actual or required != actual:
            raise EngineError("assessment_mode_mismatch", "Owner context and persisted project assessment modes must match",
                              {"assessment_mode": actual, "required_assessment_mode": required})
        merged_scope, added_scope = _merge(current.get("scope", []), scope)
        merged_exclude, added_exclude = _merge(current.get("exclude", []), exclude)
        proposed = {**current, "scope": merged_scope, "exclude": merged_exclude}
        # Validate the target without rewriting it or any unrelated owner state.
        validate_config(proposed)
        result = {"project_id": project.project_id, "assessment_mode": actual,
                  "changed": bool(added_scope or added_exclude),
                  "added_scope_count": added_scope, "added_exclude_count": added_exclude,
                  "scope_total": len(merged_scope), "exclude_total": len(merged_exclude),
                  "requests_sent": 0}
        if result["changed"]:
            project.set_config(proposed)
            project.event("dsh.context.configured", result)
        return result


def configure(workspace, args):
    """Merge authorized rules monotonically; never execute requests or change mode."""
    try:
        return _configure(workspace, args)
    except EngineError as exc:
        exc.details = {**exc.details, "requests_sent": 0}
        raise
