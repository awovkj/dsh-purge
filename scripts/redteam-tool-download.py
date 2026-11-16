#!/usr/bin/env python3
"""Explicit pinned tool deployment. No target traffic or downloaded-code execution.

The shipped lock fixes reviewed versions where known. Missing pins/digests remain
blocked. An operator lock may replace individual entries; it is never rewritten.
"""
from __future__ import annotations

import argparse
from contextlib import closing
from datetime import datetime, timezone
import fcntl
import gzip
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import platform
import re
import shutil
import stat
import sys
import tarfile
import tempfile
import time
from urllib.parse import quote, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
import uuid
import zipfile

MAX_ARCHIVE = 256 * 1024 * 1024
MAX_FILE = 128 * 1024 * 1024
SHA = re.compile(r"[a-fA-F0-9]{64}")


class Blocked(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def relative(value):
    if not isinstance(value, str) or not value or "\\" in value or re.search(r"[\x00-\x20:]", value):
        raise Blocked("path", "Tool paths require bounded relative POSIX names")
    parts = value.split("/")
    if len(value) > 1024 or len(parts) > 32 or any(part in {"", ".", ".."} for part in parts):
        raise Blocked("path", "Tool paths cannot contain absolute or parent components")
    return PurePosixPath(value)


def owned(root, name):
    path = root.joinpath(*relative(name).parts)
    for item in [path, *path.parents]:
        if item == root:
            break
        if item.is_symlink():
            raise Blocked("linked_path", "Tool deployment preserves linked paths; select an unlinked toolkit directory")
    if not path.resolve().is_relative_to(root):
        raise Blocked("path", "Tool path escapes the selected toolkit")
    if path.exists() and (not path.is_file() or path.stat().st_nlink != 1):
        raise Blocked("existing_path", "A deployment target is not an unaliased regular file")
    return path


def sha_file(path):
    result = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(65536), b""):
            result.update(chunk)
    return result.hexdigest()


def read_json(path):
    if path.is_symlink() or path.stat().st_size > 2 * 1024 * 1024:
        raise Blocked("lock_shape", "Tool lock/receipt must be a bounded regular JSON file")
    def unique(pairs):
        document = {}
        for key, value in pairs:
            if key in document:
                raise Blocked("lock_shape", "Duplicate JSON lock keys are ambiguous")
            document[key] = value
        return document
    with path.open(encoding="utf-8-sig") as stream:
        return json.load(stream, object_pairs_hook=unique)


def load_lock(default, override):
    document = read_json(default)
    if document.get("schema") != "dsh-purge-tool-lock/v1" or document.get("platform") != "linux-amd64" \
            or not isinstance(document.get("tools"), dict):
        raise Blocked("lock_shape", "Expected the shipped linux-amd64 tool lock schema")
    if override:
        supplied = read_json(override)
        if supplied.get("schema") != document["schema"] or supplied.get("platform") != document["platform"] \
                or not isinstance(supplied.get("tools"), dict) or set(supplied["tools"]) - set(document["tools"]):
            raise Blocked("lock_shape", "Operator lock must contain explicit overrides for known tools on the same platform")
        document["tools"] = {**document["tools"], **supplied["tools"]}
    return document


class ReleaseRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        parsed = urlsplit(newurl)
        if parsed.scheme != "https" or parsed.hostname not in {
                "github.com", "codeload.github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com"}:
            raise Blocked("download_origin", "Release redirect left the allowed HTTPS asset hosts")
        # API credentials are never forwarded to a release/CDN request.
        return super().redirect_request(Request(req.full_url, headers={"User-Agent": "dsh-purge-pinned-tools"}), fp, code, msg, headers, newurl)


OPENER = build_opener(ReleaseRedirects())


def source_of(entry):
    repo, tag = entry.get("repo"), entry.get("tag")
    if not isinstance(repo, str) or not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repo) \
            or not isinstance(tag, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}", tag) \
            or tag.lower() in {"latest", "master", "main", "head"}:
        raise Blocked("operator_pin_required", "This tool needs an operator-reviewed exact release tag and asset pin")
    locked = entry.get("sha256")
    if locked is not None and (not isinstance(locked, str) or not SHA.fullmatch(locked)):
        raise Blocked("lock_digest", "sha256 must contain 64 hexadecimal digits; missing is not a checksum")
    if entry.get("source_archive") is True:
        if not locked:
            raise Blocked("operator_digest_required", "Tagged source archives need an operator-reviewed SHA256 in the override lock")
        return {"url": f"https://codeload.github.com/{repo}/tar.gz/refs/tags/{quote(tag, safe='')}",
                "sha256": locked.lower(), "size": None, "asset_id": None,
                "asset": f"{repo.split('/')[1]}-{tag}.tar.gz", "digest_source": "operator_lock"}
    asset_name = entry.get("asset")
    if not isinstance(asset_name, str) or len(asset_name) > 256 or "/" in asset_name or "\\" in asset_name:
        raise Blocked("operator_pin_required", "Pin one exact release asset name; regex/latest discovery is not supported")
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "dsh-purge-pinned-tools"}
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        headers["Authorization"] = "Bearer " + token
    url = f"https://api.github.com/repos/{repo}/releases/tags/{quote(tag, safe='')}"
    with OPENER.open(Request(url, headers=headers), timeout=30) as response:
        raw = response.read(2 * 1024 * 1024 + 1)
    if len(raw) > 2 * 1024 * 1024:
        raise Blocked("release_budget", "Exact release metadata exceeds its budget")
    release = json.loads(raw)
    assets = [item for item in release.get("assets", []) if item.get("name") == asset_name]
    if release.get("tag_name") != tag or release.get("draft") or len(assets) != 1:
        raise Blocked("release_binding", "The exact tag must contain one matching published asset")
    asset = assets[0]
    size, asset_id = asset.get("size"), asset.get("id")
    if type(size) is not int or not 1 <= size <= MAX_ARCHIVE or type(asset_id) is not int or asset_id <= 0:
        raise Blocked("asset_metadata", "The selected asset needs a bounded size and a concrete official asset ID")
    official = asset.get("digest") or ""
    official = official[7:].lower() if official.startswith("sha256:") and SHA.fullmatch(official[7:]) else None
    if locked and official and locked.lower() != official:
        raise Blocked("release_digest_changed", "The official asset digest differs from the reviewed lock; preserve the existing installation")
    expected = locked.lower() if locked else official
    if not expected:
        raise Blocked("operator_digest_required", "The exact official asset supplies no SHA256; add a reviewed digest to the operator lock")
    wanted_url = f"https://github.com/{repo}/releases/download/{quote(tag, safe='')}/{quote(asset_name, safe='')}"
    if asset.get("browser_download_url") != wanted_url:
        raise Blocked("asset_url", "Asset URL does not bind the pinned repository, tag and name")
    return {"url": wanted_url, "sha256": expected, "size": size, "asset_id": asset_id,
            "asset": asset_name, "digest_source": "operator_lock" if locked else "exact_official_asset_digest"}


def download(source, destination):
    digest, total, started = hashlib.sha256(), 0, time.monotonic()
    with OPENER.open(Request(source["url"], headers={"User-Agent": "dsh-purge-pinned-tools"}), timeout=30) as response, destination.open("xb") as output:
        while True:
            chunk = response.read(65536)
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_ARCHIVE or time.monotonic() - started > 600:
                raise Blocked("download_budget", "Pinned asset exceeded its byte or time budget")
            digest.update(chunk)
            output.write(chunk)
    if source["size"] is not None and total != source["size"] or digest.hexdigest() != source["sha256"]:
        raise Blocked("download_integrity", "Downloaded bytes differ from the pinned SHA256 or official asset size")


def stage_stream(stream, destination, maximum=MAX_FILE):
    destination.parent.mkdir(parents=True, exist_ok=True)
    total = 0
    with destination.open("xb") as output:
        while True:
            chunk = stream.read(65536)
            if not chunk:
                break
            total += len(chunk)
            if total > maximum:
                raise Blocked("extraction_budget", "Selected archive file exceeds its byte budget")
            output.write(chunk)
    return total


def staged_files(entry, archive, staging):
    mappings, kind = entry.get("files"), entry.get("format")
    if not isinstance(mappings, list) or not 1 <= len(mappings) <= 32 or kind not in {"raw", "gzip", "zip", "tar"}:
        raise Blocked("lock_files", "Pin the archive format and explicit output members")
    result, names, total = [], set(), 0
    def stage(mapping, source, target):
        nonlocal total
        target = str(relative(target))
        if target in names or len(names) >= 10000:
            raise Blocked("archive_ambiguous", "Archive outputs must be distinct and bounded")
        names.add(target)
        output = staging.joinpath(*PurePosixPath(target).parts)
        written = stage_stream(source, output)
        if not written and mapping.get("executable") is True:
            raise Blocked("empty_file", "An empty binary cannot be installed as a tool")
        total += written
        if total > MAX_ARCHIVE:
            raise Blocked("extraction_budget", "Selected archive outputs exceed their total budget")
        result.append({"path": target, "sha256": sha_file(output), "executable": mapping.get("executable") is True})
    if kind in {"raw", "gzip"}:
        if len(mappings) != 1 or mappings[0].get("tree"):
            raise Blocked("lock_files", "A direct binary requires one exact target")
        with (gzip.open(archive, "rb") if kind == "gzip" else archive.open("rb")) as source:
            stage(mappings[0], source, mappings[0]["target"])
        return result
    container = zipfile.ZipFile(archive) if kind == "zip" else tarfile.open(archive, "r:*")
    with container:
        members = container.infolist() if kind == "zip" else container.getmembers()
        if len(members) > 10000:
            raise Blocked("archive_budget", "Too many archive members")
        files = {}
        for member in members:
            name = member.filename if kind == "zip" else member.name
            if name.endswith("/"):
                name = name[:-1]
            relative(name)
            is_dir = member.is_dir() if kind == "zip" else member.isdir()
            regular = (stat.S_IFMT(member.external_attr >> 16) in {0, stat.S_IFREG}) if kind == "zip" else member.isfile()
            if not is_dir and not regular:
                raise Blocked("archive_link", "Linked or special archive members are not deployed")
            if is_dir:
                continue
            size = member.file_size if kind == "zip" else member.size
            if name in files or not 0 <= size <= MAX_FILE:
                raise Blocked("archive_ambiguous", "Duplicate or oversized archive member")
            files[name] = member
        for mapping in mappings:
            target = str(relative(mapping["target"]))
            if mapping.get("tree"):
                prefix = str(relative(mapping["tree"])) + "/"
                selected = [(name, target + "/" + name[len(prefix):]) for name in files if name.startswith(prefix)]
            else:
                source = str(relative(mapping["source"]))
                matches = [name for name in files if name == source or "/" not in source and PurePosixPath(name).name == source]
                if len(matches) != 1:
                    raise Blocked("archive_binding", "Each pinned binary must select one exact archive member")
                selected = [(matches[0], target)]
            if not selected:
                raise Blocked("archive_binding", "Pinned source subtree is absent from this archive")
            for name, output in selected:
                stream = container.open(files[name]) if kind == "zip" else container.extractfile(files[name])
                with closing(stream):
                    stage(mapping, stream, output)
    return result


def receipt_path(root, name):
    return owned(root, ".receipts/" + name + ".json")


def existing_state(root, name, entry):
    receipt = receipt_path(root, name)
    if receipt.exists():
        document = read_json(receipt)
        files = document.get("installed_files") or []
        if not isinstance(files, list) or not 1 <= len(files) <= 10000:
            raise Blocked("receipt_shape", "Existing deployment receipt has no bounded file manifest")
        matched = all(owned(root, row["path"]).exists() and sha_file(owned(root, row["path"])) == row["sha256"] for row in files)
        same = document.get("repo") == entry.get("repo") and document.get("tag") == entry.get("tag") \
            and (entry.get("source_archive") is True or document.get("asset") == entry.get("asset")) \
            and (entry.get("sha256") is None or document.get("archive_sha256") == entry["sha256"].lower())
        return {"state": "installed_pinned" if matched and same else "changed_or_different_pin", "runtime_probed": False,
                "tag": document.get("tag"), "receipt": str(receipt), "capability_ready": False}
    paths = [root.joinpath(*relative(row["target"]).parts) for row in entry.get("files") or []]
    return {"state": "present_unattested" if any(path.exists() or path.is_symlink() for path in paths) else "missing",
            "runtime_probed": False, "capability_ready": False}


def install(root, name, entry, force):
    state = existing_state(root, name, entry)
    if state["state"] == "installed_pinned" and not force:
        return state
    if state["state"] != "missing" and not force:
        raise Blocked("existing_preserved", "Existing tool bytes lack the selected matching receipt; preserve them or explicitly choose --force with backups")
    source = source_of(entry)
    transaction = uuid.uuid4().hex
    with tempfile.TemporaryDirectory(prefix=".tool-stage-", dir=root) as temporary:
        stage = Path(temporary)
        archive = stage / "asset"
        download(source, archive)
        files = staged_files(entry, archive, stage / "files")
        targets = [(row, owned(root, row["path"])) for row in files]
        if not force and any(target.exists() for _, target in targets):
            raise Blocked("concurrent_change", "A target appeared during download; existing bytes were preserved")
        backups, published = {}, []
        try:
            for row, target in targets:
                if target.exists():
                    backup = owned(root, ".download-backups/" + transaction + "/" + row["path"])
                    backup.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(target, backup)
                    backups[row["path"]] = backup
            current_receipt = receipt_path(root, name)
            if current_receipt.exists():
                backup = owned(root, ".download-backups/" + transaction + "/receipt.json")
                backup.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(current_receipt, backup)
            for row, target in targets:
                target.parent.mkdir(parents=True, exist_ok=True)
                staged = stage / "files" / row["path"]
                staged.chmod(0o755 if row["executable"] else 0o644)
                os.replace(staged, target)
                published.append((row, target))
            document = {"schema": "dsh-purge-tool-receipt/v1", "tool": name, "repo": entry["repo"], "tag": entry["tag"],
                        "asset": source["asset"], "asset_id": source["asset_id"], "archive_sha256": source["sha256"],
                        "digest_source": source["digest_source"], "installed_files": files,
                        "deployed_at": datetime.now(timezone.utc).isoformat(), "runtime_probed": False,
                        "capability_ready": False, "backup_id": transaction if backups else None}
            staged_receipt = stage / "receipt.json"
            staged_receipt.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            current_receipt.parent.mkdir(parents=True, exist_ok=True)
            os.replace(staged_receipt, current_receipt)
        except Exception:
            for row, target in reversed(published):
                if row["path"] in backups:
                    shutil.copy2(backups[row["path"]], target)
                elif target.exists() and sha_file(target) == row["sha256"]:
                    target.unlink()
            raise
    return {"state": "installed_pinned", "tag": entry["tag"], "receipt": str(current_receipt),
            "digest_source": source["digest_source"], "runtime_probed": False, "capability_ready": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--lock", type=Path, default=Path(__file__).with_name("redteam-tools.lock.json"))
    parser.add_argument("--override", type=Path)
    parser.add_argument("--toolkit", type=Path, required=True)
    parser.add_argument("--tool", action="append")
    parser.add_argument("--inventory", action="store_true", help="offline file/receipt inventory; no executable is launched")
    parser.add_argument("--force", action="store_true", help="explicitly replace selected tool files with backups; keep unrelated files")
    args = parser.parse_args()
    if platform.system() != "Linux" or platform.machine().lower() not in {"x86_64", "amd64"}:
        raise Blocked("platform", "This lock targets Linux/WSL x86_64; reuse the operator's native tools on other platforms")
    root = args.toolkit.expanduser().absolute()
    if root == Path("/") or any(path.is_symlink() for path in [root, *root.parents]):
        raise Blocked("toolkit_path", "Select an explicit unlinked toolkit directory")
    lock = load_lock(args.lock, args.override)
    selected = args.tool or list(lock["tools"])
    if len(set(selected)) != len(selected) or set(selected) - set(lock["tools"]):
        raise Blocked("tool_selection", "Select distinct tool IDs from the lock")
    if args.inventory and not root.exists():
        print(json.dumps({"schema": "dsh-purge-tool-inventory/v1", "tools": {name: {"state": "missing"} for name in selected}, "runtime_probed": False}))
        return 0
    if not args.inventory:
        root.mkdir(parents=True, exist_ok=True)
    root = root.resolve()
    results = {}
    def collect():
        for name in selected:
            try:
                results[name] = existing_state(root, name, lock["tools"][name]) if args.inventory else install(root, name, lock["tools"][name], args.force)
            except Exception as error:
                results[name] = {"state": "blocked", "code": getattr(error, "code", "deployment_failed"),
                                 "reason": str(error) if isinstance(error, Blocked) else "Deployment failed; inspect the pinned local lock and preserve the existing files",
                                 "runtime_probed": False, "capability_ready": False}
    if args.inventory:
        collect()
    else:
        fd = os.open(owned(root, ".deployment.lock"), os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, "w") as guard:
            try:
                fcntl.flock(guard, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError as error:
                raise Blocked("deployment_busy", "Another deployment owns this toolkit; no tool files were changed") from error
            collect()
    print(json.dumps({"schema": "dsh-purge-tool-inventory/v1", "toolkit": str(root), "tools": results,
                      "runtime_probed": False, "capability_ready": False}, ensure_ascii=False))
    return 0 if all(row["state"] == "installed_pinned" for row in results.values()) else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        print(json.dumps({"state": "blocked", "code": getattr(error, "code", "deployment_failed"),
                          "reason": str(error) if isinstance(error, Blocked) else "Pinned tool deployment could not start"}), file=sys.stderr)
        sys.exit(2)
