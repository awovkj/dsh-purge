#!/usr/bin/env bash
# Deploy pinned Linux/WSL toolkit files without running downloaded executables.
# bash "$DSH_HOME/redteam/setup.sh" --yes [--tool=fscan] [--lock=/operator/tools-lock.json]
# --check is an offline file/receipt inventory; --force preserves replaced bytes in backups.
set -uo pipefail

PURGE_SETUP_HOME="${DSH_HOME:-$HOME/.dsh}"
PURGE_SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PURGE_TOOLKIT="$PURGE_SETUP_HOME/redteam/toolkit"
PURGE_OVERRIDE="${PURGE_TOOL_LOCK:-}"
PURGE_INVENTORY=0
PURGE_ASSUME_YES=0
PURGE_FORCE=0
PURGE_SELECTION=()
for arg in "$@"; do
  case "$arg" in
    --yes|-y) PURGE_ASSUME_YES=1 ;;
    --check|--inventory) PURGE_INVENTORY=1 ;;
    --force) PURGE_FORCE=1 ;;
    --tool=*) PURGE_SELECTION+=(--tool "${arg#--tool=}") ;;
    --lock=*) PURGE_OVERRIDE="${arg#--lock=}" ;;
    --toolkit=*) PURGE_TOOLKIT="${arg#--toolkit=}" ;;
    --help|-h) sed -n '2,4p' "$0"; exit 0 ;;
    *) printf 'Unknown argument: %s\n' "$arg" >&2; exit 2 ;;
  esac
done
if ! command -v python3 >/dev/null 2>&1; then
  printf '%s\n' 'Python 3.10+ is required for pinned deployment; existing tools were preserved.' >&2
  exit 2
fi
if [ ! -f "$PURGE_SCRIPT_DIR/redteam-tool-download.py" ] || [ ! -f "$PURGE_SCRIPT_DIR/redteam-tools.lock.json" ]; then
  printf '%s\n' 'The shipped download helper or version lock is missing; reinstall the plugin source files.' >&2
  exit 2
fi
if [ "$PURGE_INVENTORY" = 0 ] && [ "$PURGE_ASSUME_YES" = 0 ]; then
  if [ ! -t 0 ]; then
    printf '%s\n' 'Use --yes to explicitly deploy pinned files, or --check for an offline inventory.' >&2
    exit 2
  fi
  printf 'Deploy pinned toolkit files into %s? [y/N] ' "$PURGE_TOOLKIT"
  read -r PURGE_ANSWER
  case "$PURGE_ANSWER" in y|Y|yes|YES) ;; *) exit 0 ;; esac
fi
PURGE_ARGS=(--lock "$PURGE_SCRIPT_DIR/redteam-tools.lock.json" --toolkit "$PURGE_TOOLKIT")
[ -n "$PURGE_OVERRIDE" ] && PURGE_ARGS+=(--override "$PURGE_OVERRIDE")
[ "$PURGE_INVENTORY" = 1 ] && PURGE_ARGS+=(--inventory)
[ "$PURGE_FORCE" = 1 ] && PURGE_ARGS+=(--force)
PURGE_ARGS+=("${PURGE_SELECTION[@]}")
PURGE_RESULT="$(python3 "$PURGE_SCRIPT_DIR/redteam-tool-download.py" "${PURGE_ARGS[@]}")"
PURGE_STATUS=$?
printf '%s\n' "$PURGE_RESULT"

# Configuration is metadata only. Do not copy keys, rewrite .env, test accounts,
# connect to VPS, update nuclei templates or install unpinned Python packages.
python3 - "$PURGE_SETUP_HOME/.env" <<'PY'
from pathlib import Path
import os, sys
path = Path(sys.argv[1])
values = {}
if path.is_file() and not path.is_symlink() and path.stat().st_size <= 1024 * 1024:
    for line in path.read_text(encoding='utf-8-sig').splitlines():
        key, sep, value = line.partition('=')
        if sep and key in {'FOFA_KEY', 'REDTEAM_VPS_HOST', 'REDTEAM_VPS_KEY'}:
            values[key] = bool(value.strip())
for key in ('FOFA_KEY', 'REDTEAM_VPS_HOST', 'REDTEAM_VPS_KEY'):
    print(key + ': ' + ('configured_metadata' if os.environ.get(key) or values.get(key) else 'missing'))
print('Configuration presence is not authentication, connectivity or execution proof.')
PY
if [ "$PURGE_INVENTORY" = 0 ] && [ -n "$PURGE_RESULT" ]; then
  mkdir -p "$PURGE_SETUP_HOME/redteam"
  printf '%s' "$PURGE_RESULT" | python3 -c '
import json, os, sys, tempfile
from datetime import datetime, timezone
from pathlib import Path
result = json.load(sys.stdin)
rows = result.get("tools", {})
folder = Path(sys.argv[1])
state = "files_deployed" if rows and all(row.get("state") == "installed_pinned" for row in rows.values()) else "partial"
text = "\n".join(["# Deployment metadata only; no executable or target was probed",
    "completed_at=" + datetime.now(timezone.utc).isoformat(), "state=" + state,
    "runtime_probed=false", "toolkit=" + str(result.get("toolkit", "")),
    "missing_tools=" + ",".join(name for name, row in rows.items() if row.get("state") != "installed_pinned")]) + "\n"
fd, temporary = tempfile.mkstemp(prefix=".setup-", dir=folder)
with os.fdopen(fd, "w", encoding="utf-8") as stream:
    stream.write(text)
os.replace(temporary, folder / ".setup-complete")
' "$PURGE_SETUP_HOME/redteam"
fi
printf '%s\n' 'Existing PATH tools remain available. Complete missing pins/digests in an operator lock; capability probing is a separate explicit operation.'
exit "$PURGE_STATUS"
