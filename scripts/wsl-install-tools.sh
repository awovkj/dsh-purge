#!/usr/bin/env bash
# Explicit pinned deployment inside the selected WSL distribution.
# Set DSH_HOME to the operator's intended profile home before invoking this script.
# Optional --apt-lock=/path/packages.lock contains one package=exact-version per line.
set -euo pipefail

if [ -z "${DSH_HOME:-}" ]; then
  printf '%s\n' 'Set DSH_HOME to the intended profile home; the root user home is not selected automatically.' >&2
  exit 2
fi
PURGE_WSL_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PURGE_APT_LOCK=""
PURGE_SYSTEM_LINKS=0
PURGE_WSL_INVENTORY=0
PURGE_WSL_TOOLKIT="$DSH_HOME/redteam/toolkit"
PURGE_SETUP_ARGS=(--yes)
for arg in "$@"; do
  case "$arg" in
    --apt-lock=*) PURGE_APT_LOCK="${arg#--apt-lock=}" ;;
    --system-links) PURGE_SYSTEM_LINKS=1 ;;
    --check|--inventory) PURGE_WSL_INVENTORY=1; PURGE_SETUP_ARGS+=("$arg") ;;
    --toolkit=*) PURGE_WSL_TOOLKIT="${arg#--toolkit=}"; PURGE_SETUP_ARGS+=("$arg") ;;
    --force|--tool=*|--lock=*) PURGE_SETUP_ARGS+=("$arg") ;;
    --help|-h) sed -n '2,4p' "$0"; exit 0 ;;
    *) printf 'Unknown argument: %s\n' "$arg" >&2; exit 2 ;;
  esac
done
if [ -n "$PURGE_APT_LOCK" ]; then
  [ "$PURGE_WSL_INVENTORY" = 0 ] || { printf '%s\n' 'Inventory does not install apt packages; omit --apt-lock.' >&2; exit 2; }
  [ "$(id -u)" = 0 ] || { printf '%s\n' 'An explicit apt lock requires root in the selected distribution.' >&2; exit 2; }
  [ -f "$PURGE_APT_LOCK" ] && [ ! -L "$PURGE_APT_LOCK" ] || { printf '%s\n' 'Expected a regular operator-owned apt lock.' >&2; exit 2; }
  PURGE_PACKAGES=()
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in ''|\#*) continue ;; esac
    if [[ ! "$line" =~ ^[a-z0-9][a-z0-9+.-]*=[a-zA-Z0-9][a-zA-Z0-9:+.~_-]*$ ]]; then
      printf '%s\n' 'Every apt lock line must contain one package=exact-version; no floating or extra apt options.' >&2
      exit 2
    fi
    PURGE_PACKAGES+=("$line")
  done < "$PURGE_APT_LOCK"
  [ "${#PURGE_PACKAGES[@]}" -gt 0 ] || { printf '%s\n' 'The apt lock is empty.' >&2; exit 2; }
  # Reuse the operator's existing repository/proxy configuration and indexes.
  # No source replacement, update, proxy override or unpinned fallback.
  DEBIAN_FRONTEND=noninteractive apt-get install --no-install-recommends -y "${PURGE_PACKAGES[@]}"
fi
PURGE_WSL_SETUP="$PURGE_WSL_DIR/setup.sh"
[ -f "$PURGE_WSL_SETUP" ] || PURGE_WSL_SETUP="$PURGE_WSL_DIR/redteam-setup.sh"
bash "$PURGE_WSL_SETUP" "${PURGE_SETUP_ARGS[@]}"
if [ "$PURGE_SYSTEM_LINKS" = 1 ]; then
  [ "$PURGE_WSL_INVENTORY" = 0 ] || { printf '%s\n' 'Inventory does not create system links.' >&2; exit 2; }
  [ "$(id -u)" = 0 ] || { printf '%s\n' 'System links require root.' >&2; exit 2; }
  python3 - "$PURGE_WSL_TOOLKIT" <<'PY'
import fcntl, hashlib, json, os, re, sys
from pathlib import Path
root = Path(sys.argv[1]).expanduser().absolute()
if not root.is_dir() or any(part.is_symlink() for part in [root, *root.parents]):
    raise SystemExit('System links require the explicit existing unlinked toolkit.')
root = root.resolve()
bin_dir = Path('/usr/local/bin')
if not bin_dir.is_dir() or bin_dir.is_symlink():
    raise SystemExit('Preserve the existing system directory layout; no links were created.')
mapping = {'fscan': ('fscan', 'fscan/fscan'), 'gogo': ('gogo', 'gogo/gogo'),
           'suo5': ('suo5', 'suo5/suo5-linux-amd64'), 'frpc': ('frp', 'frp/frpc'),
           'frps': ('frp', 'frp/frps'), 'ksubdomain': ('ksubdomain', 'ksubdomain/ksubdomain')}

def regular(relative):
    path = root / relative
    if any(part.is_symlink() for part in [path, *path.parents] if part != root) \
            or not path.resolve().is_relative_to(root) or not path.is_file() or path.stat().st_nlink != 1:
        raise ValueError('Expected one unlinked regular deployment file')
    return path

def receipt_source(tool, relative):
    receipt = regular('.receipts/' + tool + '.json')
    if receipt.stat().st_size > 2 * 1024 * 1024:
        raise ValueError('Deployment receipt exceeds its budget')
    document = json.loads(receipt.read_text(encoding='utf-8-sig'))
    if document.get('schema') != 'dsh-purge-tool-receipt/v1' or document.get('tool') != tool \
            or not re.fullmatch(r'[a-f0-9]{64}', document.get('archive_sha256', '')):
        raise ValueError('A matching deployment receipt is required')
    files = document.get('installed_files')
    if not isinstance(files, list) or not 1 <= len(files) <= 10000:
        raise ValueError('A bounded installed file manifest is required')
    selected = None
    names = set()
    for row in files:
        name, digest = row.get('path'), row.get('sha256')
        if not isinstance(name, str) or not name or name.startswith('/') or '\\' in name \
                or any(part in {'', '.', '..'} for part in name.split('/')) or name in names \
                or not isinstance(digest, str) or not re.fullmatch(r'[a-f0-9]{64}', digest):
            raise ValueError('Ambiguous deployment file manifest')
        names.add(name)
        source = regular(name)
        checksum = hashlib.sha256()
        with source.open('rb') as stream:
            for chunk in iter(lambda: stream.read(65536), b''):
                checksum.update(chunk)
        if checksum.hexdigest() != digest:
            raise ValueError('Existing tool bytes changed; preserve the system entry')
        if name == relative and row.get('executable') is True and os.access(source, os.X_OK):
            selected = source
    if selected is None:
        raise ValueError('Selected executable is absent from the deployment receipt')
    return selected

lock_path = root / '.deployment.lock'
if lock_path.exists() and (lock_path.is_symlink() or not lock_path.is_file() or lock_path.stat().st_nlink != 1):
    raise SystemExit('Preserve the existing deployment lock; no system links were created.')
fd = os.open(lock_path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
with os.fdopen(fd, 'w') as guard:
    try:
        fcntl.flock(guard, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        raise SystemExit('Another deployment owns this toolkit; no system links were created.')
    for name, (tool, relative) in mapping.items():
        target = bin_dir / name
        if target.exists() or target.is_symlink():
            print(name + ': existing system entry preserved')
            continue
        try:
            source = receipt_source(tool, relative)
            target.symlink_to(source)
            print(name + ': created link to ' + str(source) + '; runtime not probed')
        except (ValueError, TypeError, AttributeError, OSError, json.JSONDecodeError):
            print(name + ': matching deployment receipt unavailable; no link created')
PY
fi
