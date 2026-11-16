"""Build a single controlled input mutation without discarding the baseline."""
from __future__ import annotations

import base64
from copy import deepcopy
import json
import re
from urllib.parse import quote, urlencode, urlsplit, urlunsplit

from ..store import EngineError

TRANSPORT_HEADERS = frozenset({"host", "content-length", "transfer-encoding", "connection", "accept-encoding"})
AUTH_HEADERS = frozenset({"authorization", "proxy-authorization", "cookie", "x-api-key", "x-auth-token", "x-session-token"})


def protected_headers(project):
    from ..engine import credential_header_names
    names = set(TRANSPORT_HEADERS | AUTH_HEADERS)
    for session in project.list("session"):
        names.update(credential_header_names(session))
    return names


def baseline_request(project, operation, session, *, evidence_id=None):
    from ..engine import verify_current_evidence
    protected = protected_headers(project)
    for evidence in reversed(project.list("evidence")):
        if evidence_id is not None and evidence.get("id") != evidence_id:
            continue
        if evidence.get("kind") != "http" or evidence.get("operation_id") != operation["id"]:
            continue
        if evidence.get("actor_id") != (session or {}).get("actor_id"):
            continue
        if evidence.get("session_id") != (session or {}).get("id") or evidence.get("auth_mode") == "anonymous_cookie":
            continue
        try:
            _, artifact = verify_current_evidence(project, evidence["id"])
            request = deepcopy(artifact.get("request") or {})
            if not request.get("url"):
                continue
            headers = request.get("headers") or {}
            if isinstance(headers, list):
                headers = dict(headers)
            # The verified session applies authentication; captured auth bytes
            # must not bypass its Cookie/path/expiry/identity restrictions.
            request["headers"] = {key: val for key, val in headers.items() if key.lower() not in protected}
            return request
        except (EngineError, ValueError, KeyError, TypeError, OSError):
            continue
    return None


def _body(request):
    if "body" in request:
        return deepcopy(request["body"])
    encoded = request.get("body_base64")
    if not encoded:
        return {}
    try:
        from ..inputs import json_document
        return json_document(base64.b64decode(encoded, validate=True))
    except (ValueError, UnicodeError, TypeError) as exc:
        raise EngineError("v2_request_body", "The selected JSON input needs a real JSON baseline body") from exc


def _set_pointer(document, selector, value):
    if selector in {"", "$"}:
        return value
    if not selector.startswith("/"):
        selector = "/" + selector.replace("~", "~0").replace("/", "~1")
    parts = selector[1:].split("/")
    if len(parts) > 32 or any(re.search(r"~(?![01])", part) for part in parts):
        raise EngineError("v2_request_pointer", "Invalid or oversized JSON input pointer")
    parts = [part.replace("~1", "/").replace("~0", "~") for part in parts]
    current = document
    for index, part in enumerate(parts):
        last = index == len(parts) - 1
        child = value if last else ([] if parts[index + 1].isdigit() else {})
        if isinstance(current, dict):
            if last:
                current[part] = value
            else:
                current = current.setdefault(part, child)
        elif isinstance(current, list):
            if not part.isdigit() or str(int(part)) != part or int(part) > 1000:
                raise EngineError("v2_request_pointer", "Array input requires a bounded exact index")
            at = int(part)
            if at > len(current):
                raise EngineError("v2_request_pointer", "JSON input pointer cannot create an array gap")
            if at == len(current):
                current.append(child)
            if last:
                current[at] = value
            else:
                current = current[at]
        else:
            raise EngineError("v2_request_pointer", "JSON input pointer crosses a scalar baseline field")
    return document


def _mutate_path(template, actual, name, value, has_baseline):
    tokens = list(re.finditer(r"\{([^/{}]+)\}|(?<=/):([^/]+)(?=/|$)", template))
    selected = [token for token in tokens if (token.group(1) or token.group(2)) == name]
    if len(selected) != 1:
        raise EngineError("v2_request_input", "Path input needs one exact registered template binding")
    if not has_baseline:
        if len(tokens) != 1:
            raise EngineError("v2_request_baseline", "Other path inputs require a complete actual baseline")
        return template[:selected[0].start()] + quote(str(value), safe="") + template[selected[0].end():]
    pieces, cursor = ["^"], 0
    for token in tokens:
        pieces.append(re.escape(template[cursor:token.start()]))
        pieces.append("(?P<selected>[^/]+)" if token is selected[0] else "[^/]+")
        cursor = token.end()
    pieces.extend([re.escape(template[cursor:]), "$"])
    match = re.fullmatch("".join(pieces), actual)
    if match is None:
        raise EngineError("v2_request_baseline", "Actual baseline path does not match the registered operation template")
    return actual[:match.start("selected")] + quote(str(value), safe="") + actual[match.end("selected"):]


def request_for(operation, entry, value, baseline=None, *, protected=None):
    request = deepcopy(baseline or {})
    parsed = urlsplit(request.get("url") or operation["url"])
    if parsed.scheme not in {"http", "https"} or not parsed.netloc or parsed.username or parsed.password:
        raise EngineError("v2_request_url", "A controlled request requires an explicit HTTP(S) origin")
    from ..inputs import parse_form
    query = parse_form(parsed.query)
    headers = dict(request.get("headers") or {})
    location = (entry or {}).get("location")
    selector = (entry or {}).get("selector", (entry or {}).get("name"))
    if location == "query":
        if not isinstance(selector, str) or not selector:
            raise EngineError("v2_request_input", "Query input name is required")
        found = False
        for index, (name, existing) in enumerate(query):
            if name == selector:
                query[index] = (name, str(value))
                found = True
        if not found:
            query.append((selector, str(value)))
    elif location == "body":
        if not isinstance(selector, str):
            raise EngineError("v2_request_input", "JSON body input pointer is required")
        request["body"] = _set_pointer(_body(request), selector, value)
        request.pop("body_base64", None)
        if not any(name.lower() == "content-type" for name in headers):
            headers["Content-Type"] = "application/json"
    elif location == "header":
        if not isinstance(selector, str) or not selector or any(char in str(value) for char in "\r\n\x00"):
            raise EngineError("v2_request_input", "Header input requires a valid name and value")
        if selector.lower() in ((protected or (TRANSPORT_HEADERS | AUTH_HEADERS)) | {"content-type"}):
            raise EngineError("v2_request_identity", "Authentication/transport headers require a dedicated provider")
        headers = {key: item for key, item in headers.items() if key.lower() != selector.lower()}
        headers[selector] = str(value)
    elif location == "path":
        name = (entry or {}).get("name") or selector
        if not name:
            raise EngineError("v2_request_input", "Path input name is required")
        template = urlsplit(operation["url"]).path
        parsed = parsed._replace(path=_mutate_path(template, parsed.path, str(name), value, baseline is not None))
    elif entry:
        raise EngineError("v2_request_provider", "No automatic provider for this input location")
    if re.search(r"\{[^/{}]+\}|(?<=/):[^/]+(?=/|$)", parsed.path):
        raise EngineError("v2_request_baseline", "Resolve every non-test path input from a complete actual baseline")
    request["url"] = urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(query, doseq=True), ""))
    request["method"] = operation.get("method", "GET").upper()
    from ..transport import headers_map
    headers_map(headers)
    request["headers"] = headers
    return request


def verify_control_evidence(project, recipe, control, evidence_id):
    """Bind a complete current capture to every frozen request and identity field.

    No target request or session renewal occurs here; historical TTL expiry is
    handled by verify_current_evidence independently of proof integrity.
    """
    from ..engine import verify_current_evidence
    from ..scope import normalize_url
    from ..transport import headers_map, request_parts
    meta, artifact = verify_current_evidence(project, evidence_id)
    bindings = recipe.get("bindings") or {}
    session_binding = (control.get("session") or {}) if "session" in control else bindings.get("session") or {}
    resource_binding = bindings.get("resource") or {}
    if meta.get("kind") != "http" or meta.get("operation_id") != bindings.get("operation_id") \
            or meta.get("session_id") != session_binding.get("session_id") \
            or meta.get("session_generation") != session_binding.get("generation") \
            or meta.get("actor_id") != session_binding.get("actor_id") \
            or meta.get("resource_id") != resource_binding.get("resource_id") \
            or not session_binding and (meta.get("credential_header_names") or meta.get("auth_mode") == "anonymous_cookie"):
        raise EngineError("control_identity", "Control capture belongs to another operation, identity or resource")
    operation = project.get("operation", bindings["operation_id"])
    request, actual = control.get("request") or {}, artifact.get("request") or {}
    headers = headers_map(request.get("headers") or {})
    if session_binding:
        session = project.get("session", session_binding["session_id"])
        headers = {**headers_map(session.get("headers") or {}), **headers}
    body = request.get("body")
    if "body_base64" in request:
        if body is not None:
            raise EngineError("control_request", "Frozen control contains ambiguous body sources")
        body = base64.b64decode(request["body_base64"], validate=True)
    if isinstance(body, (dict, list)):
        headers.setdefault("content-type", "application/json")
    if operation.get("content_type"):
        headers.setdefault("content-type", operation["content_type"])
    expected_headers, expected_body = request_parts(request["url"], headers, body)
    if normalize_url(actual.get("url")) != normalize_url(request["url"]) \
            or actual.get("method") != request.get("method", operation["method"]).upper() \
            or base64.b64decode(actual.get("body_base64", ""), validate=True) != (expected_body or b"") \
            or headers_map(actual.get("headers") or {}) != expected_headers:
        raise EngineError("control_request", "Capture differs from the exact frozen request, body or executor headers")
    return meta, artifact
