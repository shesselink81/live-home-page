#!/usr/bin/env bash
# Refresh the UniFi firewall group "Threat-Block Spamhaus DROP v4" from the
# live Spamhaus DROP list (https://www.spamhaus.org/drop/).
#
# Controller calls run inside the unifi-mcp container, so its API key never
# leaves the container (same pattern as download-unifi-backup.sh).
#
# Safety:
#   - downloaded data is parsed with `python -I`, every CIDR validated strictly
#   - entries overlapping private/reserved space, the WAN IP or any member of
#     another address group on the controller are dropped (and reported)
#   - aborts if the list is suspiciously small or changes more than MAX_CHANGE_PCT
#   - snapshots the current group members before every write (--restore to roll back)
#   - verifies the stored group afterwards, and the enforced ipset on the gateway if SSH works
#
# Usage:
#   scripts/refresh-spamhaus-drop.sh              # refresh (writes only if changed)
#   scripts/refresh-spamhaus-drop.sh --dry-run    # show what would change, write nothing
#   scripts/refresh-spamhaus-drop.sh --restore <snapshot.json>
#
# Env overrides:
#   CONTAINER       (default: unifi-ai-unifi-mcp-1)
#   SITE            (default: default)
#   GROUP_NAME      (default: Threat-Block Spamhaus DROP v4)
#   SNAPSHOT_DIR    (default: D:/Users/Sander/nextcloud/Backup/Unifi/spamhaus-drop)
#   KEEP_SNAPSHOTS  (default: 12)
#   MIN_ENTRIES     (default: 500)    abort if fewer CIDRs remain
#   MAX_CHANGE_PCT  (default: 30)     abort if added+removed exceeds this % (FORCE=1 overrides)
#   GATEWAY_SSH     (default: root@192.168.178.1, empty = skip ipset check)
set -euo pipefail
export MSYS_NO_PATHCONV=1   # Git Bash: don't rewrite /paths passed to docker exec

CONTAINER="${CONTAINER:-unifi-ai-unifi-mcp-1}"
SITE="${SITE:-default}"
GROUP_NAME="${GROUP_NAME:-Threat-Block Spamhaus DROP v4}"
SNAPSHOT_DIR="${SNAPSHOT_DIR:-D:/Users/Sander/nextcloud/Backup/Unifi/spamhaus-drop}"
KEEP_SNAPSHOTS="${KEEP_SNAPSHOTS:-12}"
MIN_ENTRIES="${MIN_ENTRIES:-500}"
MAX_CHANGE_PCT="${MAX_CHANGE_PCT:-30}"
FORCE="${FORCE:-0}"
GATEWAY_SSH="${GATEWAY_SSH-root@192.168.178.1}"
DROP_URL="https://www.spamhaus.org/drop/drop_v4.json"

MODE="refresh"; RESTORE_FILE=""
case "${1:-}" in
  --dry-run) MODE="dry-run" ;;
  --restore) MODE="restore"; RESTORE_FILE="${2:-}"; [[ -f "$RESTORE_FILE" ]] || { echo "ERROR: snapshot not found: $RESTORE_FILE" >&2; exit 1; } ;;
  "") ;;
  *) echo "Usage: $0 [--dry-run | --restore <snapshot.json>]" >&2; exit 1 ;;
esac

die() { echo "ERROR: $*" >&2; exit 1; }
PY="$(command -v python3 || command -v python)" || die "python not found"

# --- controller helper, runs inside the container ---------------------------
# Modes: state            -> prints {"group":{...},"protected":[...],"wan_ip":...}
#        put <group_id>   -> reads member list (JSON) on stdin, PUTs it, prints stored count
read -r -d '' CPY <<'EOF' || true
import json, os, ssl, sys, urllib.request
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
base = "https://" + os.environ["UNIFI_LOCAL_HOST"] + "/proxy/network/api/s/" + os.environ.get("SITE", "default")
hdr = {"X-API-KEY": os.environ["UNIFI_API_KEY"], "Content-Type": "application/json"}
def call(path, method="GET", body=None):
    req = urllib.request.Request(base + path, headers=hdr, method=method,
                                 data=json.dumps(body).encode() if body is not None else None)
    return json.load(urllib.request.urlopen(req, context=ctx, timeout=60))["data"]
try:
    groups = call("/rest/firewallgroup")
    name = os.environ["GROUP_NAME"]
    if sys.argv[1] == "state":
        g = [x for x in groups if x["name"] == name]
        if len(g) != 1: sys.exit(f"expected exactly 1 group named {name!r}, found {len(g)}")
        prot = [m for x in groups if x["name"] != name and x["group_type"] in ("address-group", "ipv6-address-group")
                for m in x.get("group_members", [])]
        wan = [h.get("wan_ip") for h in call("/stat/health") if h.get("subsystem") == "wan"]
        print(json.dumps({"group": g[0], "protected": prot, "wan_ip": wan[0] if wan else None}))
    elif sys.argv[1] == "put":
        gid = sys.argv[2]; members = json.load(sys.stdin)
        cur = [x for x in groups if x["_id"] == gid][0]
        body = {k: cur[k] for k in ("name", "group_type", "site_id") if k in cur}
        body["group_members"] = members
        call("/rest/firewallgroup/" + gid, "PUT", body)
        stored = [x for x in call("/rest/firewallgroup") if x["_id"] == gid][0]["group_members"]
        print(json.dumps(stored))
except urllib.error.HTTPError as e:
    sys.exit(f"HTTP {e.code} {e.reason} ({sys.argv[1]})")
EOF
cpy() { docker exec -i -e SITE="$SITE" -e GROUP_NAME="$GROUP_NAME" "$CONTAINER" python -c "$CPY" "$@"; }

# --- host-side helper (untrusted download is only ever parsed here) ---------
# Modes: build <drop.json> <state.json> <out.json>   -> validate, filter, diff; prints summary
#        same  <a.json> <b.json>                     -> exit 0 if same set
read -r -d '' HPY <<'EOF' || true
import ipaddress as ip, json, os, sys
mode = sys.argv[1]
def nets(xs): return set(ip.ip_network(x, strict=False) for x in xs)
if mode == "same":
    a, b = (nets(json.load(open(p))) for p in sys.argv[2:4])
    sys.exit(0 if a == b else 1)
drop_path, state_path, out_path = sys.argv[2:5]
cidrs, meta = [], None
for n, line in enumerate(open(drop_path, encoding="utf-8"), 1):
    line = line.strip()
    if not line: continue
    o = json.loads(line)
    if "cidr" in o:
        net = ip.ip_network(o["cidr"], strict=True)          # raises on garbage
        if net.version != 4: sys.exit(f"line {n}: non-IPv4 entry {net}")
        cidrs.append(net)
    elif o.get("type") == "metadata":
        meta = o
if meta is None: sys.exit("no metadata record - not a Spamhaus DROP file?")
state = json.load(open(state_path))
protected = [ip.ip_network(x if "/" in x else x + "/32", strict=False) for x in state["protected"]
             if "-" not in x] + ([ip.ip_network(state["wan_ip"] + "/32")] if state.get("wan_ip") else [])
for x in state["protected"]:                                  # ranges like a.b.c.d-e.f.g.h
    if "-" in x:
        lo, hi = (ip.ip_address(p) for p in x.split("-"))
        protected += list(ip.summarize_address_range(lo, hi))
dropped = []
keep = []
for net in ip.collapse_addresses(cidrs):
    bad = (net.prefixlen < 8 or not net.is_global or net.is_multicast or net.is_reserved
           or any(net.overlaps(p) for p in protected if p.version == 4))
    (dropped if bad else keep).append(net)
min_entries, max_pct, force = int(os.environ["MIN_ENTRIES"]), float(os.environ["MAX_CHANGE_PCT"]), os.environ["FORCE"] == "1"
if len(keep) < min_entries: sys.exit(f"only {len(keep)} entries after filtering (< MIN_ENTRIES={min_entries}) - aborting")
cur = nets(state["group"]["group_members"]); new = set(keep)
added, removed = new - cur, cur - new
pct = 100.0 * (len(added) + len(removed)) / max(len(cur), 1)
print(f"Spamhaus DROP: {meta.get('records')} records (timestamp {meta.get('timestamp')}) -> {len(keep)} after collapse/filter")
print(f"Current group: {len(cur)}  |  +{len(added)} added  -{len(removed)} removed  ({pct:.1f}% change)")
for d in dropped: print(f"  filtered out (protected/non-global): {d}")
for a in sorted(added)[:10]: print(f"  + {a}")
for r in sorted(removed)[:10]: print(f"  - {r}")
if len(added) > 10 or len(removed) > 10: print("  ...")
if cur and pct > max_pct and not force:
    sys.exit(f"change {pct:.1f}% exceeds MAX_CHANGE_PCT={max_pct} - rerun with FORCE=1 if intended")
json.dump([str(n) for n in sorted(keep)], open(out_path, "w"))
print("NOCHANGE" if not added and not removed else "CHANGED")
EOF
hpy() { MIN_ENTRIES="$MIN_ENTRIES" MAX_CHANGE_PCT="$MAX_CHANGE_PCT" FORCE="$FORCE" "$PY" -I -c "$HPY" "$@"; }

# --- 1. preflight + current state -------------------------------------------
docker ps --format '{{.Names}}' | grep -qx "$CONTAINER" || die "container '$CONTAINER' is not running"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
command -v cygpath >/dev/null && WORK="$(cygpath -m "$WORK")"   # Windows python needs a native path
mkdir -p "$WORK/dl"
cpy state > "$WORK/state.json" || die "could not read controller state (API key valid?)"
GID="$("$PY" -I -c "import json,sys;print(json.load(open(sys.argv[1]))['group']['_id'])" "$WORK/state.json")"
SHORT_ID="$("$PY" -I -c "import json,sys;print(json.load(open(sys.argv[1]))['group'].get('short_id',''))" "$WORK/state.json")"

# --- 2. decide the new member list ------------------------------------------
if [[ "$MODE" == "restore" ]]; then
  cp "$RESTORE_FILE" "$WORK/new.json"
  "$PY" -I -c "import json,sys,ipaddress as i;[i.ip_network(x,strict=False) for x in json.load(open(sys.argv[1]))]" "$WORK/new.json" \
    || die "snapshot is not a valid CIDR list"
  echo "Restoring $(grep -o ',' "$WORK/new.json" | wc -l | awk '{print $1+1}') entries from $RESTORE_FILE"
else
  echo "Downloading $DROP_URL ..."
  curl -fsS -A "unifi-ai-drop-refresh/1.0" -o "$WORK/dl/drop_v4.json" "$DROP_URL" || die "download failed"
  SUMMARY="$(hpy build "$WORK/dl/drop_v4.json" "$WORK/state.json" "$WORK/new.json")" || { echo "$SUMMARY"; die "validation failed"; }
  echo "$SUMMARY"
  if [[ "$SUMMARY" == *NOCHANGE ]]; then echo "Group already up to date - nothing to do."; exit 0; fi
  [[ "$MODE" == "dry-run" ]] && { echo "Dry run - nothing written."; exit 0; }
fi

# --- 3. snapshot current members (rollback point) ----------------------------
mkdir -p "$SNAPSHOT_DIR"
SNAP="$SNAPSHOT_DIR/drop-group-$(date +%Y%m%d_%H%M%S).json"
"$PY" -I -c "import json,sys;json.dump(json.load(open(sys.argv[1]))['group']['group_members'],open(sys.argv[2],'w'))" "$WORK/state.json" "$SNAP"
echo "Snapshot of current group: $SNAP"
ls -1t "$SNAPSHOT_DIR"/drop-group-*.json 2>/dev/null | tail -n +"$((KEEP_SNAPSHOTS + 1))" | xargs -r rm -f

# --- 4. write + verify --------------------------------------------------------
cpy put "$GID" < "$WORK/new.json" > "$WORK/stored.json" || die "update failed - group unchanged, snapshot: $SNAP"
hpy same "$WORK/new.json" "$WORK/stored.json" || die "stored group differs from intended list - restore with: $0 --restore $SNAP"
echo "Controller group updated and verified ($("$PY" -I -c "import json,sys;print(len(json.load(open(sys.argv[1]))))" "$WORK/stored.json") entries)."

if [[ -n "$GATEWAY_SSH" && -n "$SHORT_ID" ]]; then
  sleep 15   # give the gateway time to re-provision the ipset
  if ssh -o BatchMode=yes -o ConnectTimeout=8 "$GATEWAY_SSH" "ipset list UBIOS4fw_group_$SHORT_ID" > "$WORK/ipset.txt" 2>/dev/null; then
    sed -n '/Members:/,$p' "$WORK/ipset.txt" | tail -n +2 | awk 'NF{print $1}' \
      | "$PY" -I -c "import json,sys;json.dump([l.strip() for l in sys.stdin if l.strip()],open(sys.argv[1],'w'))" "$WORK/enforced.json"
    if hpy same "$WORK/new.json" "$WORK/enforced.json"; then echo "Gateway ipset UBIOS4fw_group_$SHORT_ID matches."
    else echo "WARNING: gateway ipset does not (yet) match - check again in a minute."; fi
  else
    echo "Skipped ipset check (SSH to $GATEWAY_SSH not available)."
  fi
fi
