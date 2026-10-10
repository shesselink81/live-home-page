#!/usr/bin/env bash
# Download a UniFi Network autobackup (.unf) to a local folder.
#
# Runs the HTTP calls inside the unifi-mcp container so its API key never
# leaves the container, then copies the file out with `docker cp`.
#
# Usage:
#   scripts/download-unifi-backup.sh              # latest autobackup
#   scripts/download-unifi-backup.sh <filename>   # specific autobackup
#
# Env overrides:
#   DEST       target folder   (default: D:/Users/Sander/nextcloud/Backup/Unifi)
#   CONTAINER  container name  (default: unifi-ai-unifi-mcp-1)
#   SITE       UniFi site      (default: default)
#   OVERWRITE  1 = re-download even if an identical file already exists
set -euo pipefail
export MSYS_NO_PATHCONV=1   # Git Bash: don't rewrite /tmp/... args passed to docker exec

DEST="${DEST:-D:/Users/Sander/nextcloud/Backup/Unifi}"
CONTAINER="${CONTAINER:-unifi-ai-unifi-mcp-1}"
SITE="${SITE:-default}"
OVERWRITE="${OVERWRITE:-0}"
FILE="${1:-}"

die() { echo "ERROR: $*" >&2; exit 1; }

# Small Python helper executed inside the container. Modes: auth | latest | fetch <file> <out>
read -r -d '' PY <<'EOF' || true
import json, os, ssl, sys, urllib.request
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
base = "https://" + os.environ["UNIFI_LOCAL_HOST"] + "/proxy/network"
hdr = {"X-API-KEY": os.environ["UNIFI_API_KEY"], "Content-Type": "application/json"}
site = os.environ.get("SITE", "default")
def call(path, body=None):
    req = urllib.request.Request(base + path, headers=hdr,
                                 data=json.dumps(body).encode() if body else None,
                                 method="POST" if body else "GET")
    return urllib.request.urlopen(req, context=ctx, timeout=60)
mode = sys.argv[1]
try:
    if mode == "auth":
        call(f"/api/s/{site}/stat/health")
    elif mode == "latest":
        data = json.load(call(f"/api/s/{site}/cmd/backup", {"cmd": "list-backups"}))["data"]
        auto = [b for b in data if b.get("filename", "").startswith("autobackup_")]
        if not auto: sys.exit("no autobackups found on controller")
        print(max(auto, key=lambda b: b.get("time", 0))["filename"])
    elif mode == "fetch":
        blob = call("/dl/autobackup/" + sys.argv[2]).read()
        open(sys.argv[3], "wb").write(blob)
        print(len(blob))
except urllib.error.HTTPError as e:
    sys.exit(f"HTTP {e.code} {e.reason} ({mode})")
EOF

cpy() { docker exec -e SITE="$SITE" "$CONTAINER" python -c "$PY" "$@"; }

# 1. Preflight
docker ps --format '{{.Names}}' | grep -qx "$CONTAINER" || die "container '$CONTAINER' is not running"
cpy auth || die "UniFi API login failed — check UNIFI_API_KEY in .env and restart the container"
mkdir -p "$DEST"

# 2. Pick the backup
[[ -n "$FILE" ]] || FILE="$(cpy latest)" || die "could not list backups"
[[ "$FILE" =~ ^[A-Za-z0-9._-]+\.unf$ ]] || die "invalid backup filename: $FILE"
TMP="/tmp/$FILE"
trap 'docker exec "$CONTAINER" rm -f "$TMP" >/dev/null 2>&1 || true' EXIT

# 3. Download inside the container
echo "Downloading $FILE ..."
SIZE="$(cpy fetch "$FILE" "$TMP")" || die "download failed"
REMOTE_SHA="$(docker exec "$CONTAINER" python -c "import hashlib,sys;print(hashlib.sha256(open(sys.argv[1],'rb').read()).hexdigest())" "$TMP")"

# 4. Skip if an identical copy already exists
if [[ -f "$DEST/$FILE" && "$OVERWRITE" != "1" ]]; then
  if [[ "$(sha256sum "$DEST/$FILE" | cut -d' ' -f1)" == "$REMOTE_SHA" ]]; then
    echo "Already present, checksum OK: $DEST/$FILE"
    exit 0
  fi
  echo "Existing file differs — overwriting."
fi

# 5. Copy out and verify
docker cp "$CONTAINER:$TMP" "$DEST/$FILE" >/dev/null
LOCAL_SHA="$(sha256sum "$DEST/$FILE" | cut -d' ' -f1)"
[[ "$LOCAL_SHA" == "$REMOTE_SHA" ]] || die "checksum mismatch for $DEST/$FILE"
echo "Saved $DEST/$FILE ($SIZE bytes, sha256 $LOCAL_SHA)"
