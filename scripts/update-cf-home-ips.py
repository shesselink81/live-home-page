#!/usr/bin/env python3
"""Keep the Cloudflare `home_ips` IP list in sync with the current home WAN addresses.

Run from a host on the home network (e.g. docker-server) every few minutes.
Only list items whose comment starts with "[auto]" are managed:
  - IPv4 items   -> replaced by the current public IPv4
  - IPv6 items   -> keep their host/subnet bits, but get the current delegated
                    prefix (first V6_PREFIX_LEN bits) of this host's public IPv6
All other items are left untouched. Nothing is written when nothing changed.

Optionally also keeps Hetzner Cloud firewalls in sync (HCLOUD_FIREWALL_IDS). The
[auto] items of the list hold the last synced home addresses, so before the list
is updated, every firewall rule source that is:
  - the old home IPv4 as /32       -> replaced by the new public IPv4 /32
  - inside the old delegated prefix -> gets the new prefix, host bits kept
is rewritten. Other sources (Cloudflare ranges, ::/0, server subnets) are kept.
Firewalls are written first: if that fails the list isn't touched, so the next
run still knows the old addresses and retries.

Public addresses come from Cloudflare's /cdn-cgi/trace over 1.1.1.1 (IPv4) and
2606:4700:4700::1111 (IPv6). If IPv6 can't be detected, IPv6 items are kept as-is.

Env:
  CF_API_TOKEN         API token with Account -> Account Filter Lists -> Edit (required)
  CF_ACCOUNT_ID        Cloudflare account ID (required)
  CF_LIST_ID           ID of the home_ips list (required)
  V6_PREFIX_LEN        delegated IPv6 prefix length (default: 56, Ziggo)
  HCLOUD_TOKEN         Hetzner Cloud API token, read & write (required with HCLOUD_FIREWALL_IDS)
  HCLOUD_FIREWALL_IDS  comma-separated Hetzner firewall IDs to sync (optional, e.g. k8s-fw: 11876231)
  DRY_RUN              1 = print the diff, don't write

Example cron (docker-server):
  */5 * * * * CF_API_TOKEN=... CF_ACCOUNT_ID=... CF_LIST_ID=... HCLOUD_TOKEN=... HCLOUD_FIREWALL_IDS=11876231 /usr/bin/python3 /opt/scripts/update-cf-home-ips.py
"""
import ipaddress
import json
import os
import sys
import time
import urllib.error
import urllib.request

API = "https://api.cloudflare.com/client/v4"
HCLOUD_API = "https://api.hetzner.cloud/v1"
MARKER = "[auto]"
TIMEOUT = 15


def die(msg):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def trace_ip(url):
    try:
        with urllib.request.urlopen(url, timeout=TIMEOUT) as r:
            for line in r.read().decode().splitlines():
                if line.startswith("ip="):
                    return ipaddress.ip_address(line[3:].strip())
    except OSError:
        return None
    return None


def cf(method, path, body=None):
    req = urllib.request.Request(
        API + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {os.environ['CF_API_TOKEN']}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        res = json.load(r)
    if not res.get("success"):
        die(f"{method} {path}: {res.get('errors')}")
    return res["result"]


def hc(method, path, body=None):
    req = urllib.request.Request(
        HCLOUD_API + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {os.environ['HCLOUD_TOKEN']}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        die(f"hcloud {method} {path}: HTTP {e.code} {e.read().decode(errors='replace')}")


def with_prefix(item_ip, prefix):
    """Replace the leading prefix bits of an IPv6 address/network, keep the rest."""
    net = ipaddress.ip_network(item_ip, strict=False)
    host_mask = (1 << (128 - prefix.prefixlen)) - 1
    addr = int(prefix.network_address) | (int(net.network_address) & host_mask)
    new = ipaddress.IPv6Network((addr, net.prefixlen))
    return str(new.network_address) if net.prefixlen == 128 else str(new)


def desired_items(items, v4, v6_prefix):
    out = []
    for it in items:
        ip, comment = it["ip"], it.get("comment", "")
        if comment.startswith(MARKER):
            version = ipaddress.ip_network(ip, strict=False).version
            if version == 4 and v4:
                ip = str(v4)
            elif version == 6 and v6_prefix:
                ip = with_prefix(ip, v6_prefix)
        out.append({"ip": ip, "comment": comment})
    return out


def last_synced(items, prefix_len):
    """Old home IPv4 (/32 network) and delegated IPv6 prefix, from the list's [auto] items."""
    old_v4 = old_v6_prefix = None
    for it in items:
        if not it["comment"].startswith(MARKER):
            continue
        net = ipaddress.ip_network(it["ip"], strict=False)
        if net.version == 4 and not old_v4:
            old_v4 = ipaddress.IPv4Network((int(net.network_address), 32))
        elif net.version == 6 and not old_v6_prefix:
            old_v6_prefix = ipaddress.IPv6Network((int(net.network_address), prefix_len), strict=False)
    return old_v4, old_v6_prefix


def new_source(src, old_v4, v4, old_v6_prefix, v6_prefix):
    net = ipaddress.ip_network(src, strict=False)
    if net.version == 4 and v4 and old_v4 and net == old_v4:
        return f"{v4}/32"
    if (net.version == 6 and v6_prefix and old_v6_prefix
            and net.prefixlen >= old_v6_prefix.prefixlen and net.subnet_of(old_v6_prefix)):
        new = with_prefix(src, v6_prefix)
        return new if "/" in new else f"{new}/128"
    return src


def sync_firewalls(ids, old_v4, v4, old_v6_prefix, v6_prefix, dry_run):
    for fw_id in ids:
        fw = hc("GET", f"/firewalls/{fw_id}")["firewall"]
        rules, changed = [], False
        for rule in fw["rules"]:
            sources = [new_source(s, old_v4, v4, old_v6_prefix, v6_prefix) for s in rule.get("source_ips", [])]
            for old, new in zip(rule.get("source_ips", []), sources):
                if old != new:
                    changed = True
                    print(f"firewall {fw['name']}: {rule['protocol']}/{rule.get('port') or '-'} {old} -> {new}")
            # set_rules wants the full rule list; drop nulls the GET returns (port on icmp, description)
            rules.append({k: v for k, v in {**rule, "source_ips": sources}.items() if v is not None})
        if not changed:
            print(f"firewall {fw['name']} up to date")
            continue
        if dry_run:
            print("DRY_RUN=1, not writing")
            continue
        actions = hc("POST", f"/firewalls/{fw_id}/actions/set_rules", {"rules": rules})["actions"]
        for action in actions:
            for _ in range(30):
                status = hc("GET", f"/actions/{action['id']}")["action"]
                if status["status"] == "success":
                    break
                if status["status"] == "error":
                    die(f"firewall {fw['name']} {action['command']} failed: {status.get('error')}")
                time.sleep(2)
            else:
                die(f"firewall {fw['name']} action {action['id']} still running")
        print(f"firewall {fw['name']} updated")


def main():
    for var in ("CF_API_TOKEN", "CF_ACCOUNT_ID", "CF_LIST_ID"):
        if not os.environ.get(var):
            die(f"{var} is not set")
    path = f"/accounts/{os.environ['CF_ACCOUNT_ID']}/rules/lists/{os.environ['CF_LIST_ID']}/items"
    prefix_len = int(os.environ.get("V6_PREFIX_LEN", "56"))

    v4 = trace_ip("https://1.1.1.1/cdn-cgi/trace")
    v6 = trace_ip("https://[2606:4700:4700::1111]/cdn-cgi/trace")
    # Sanity: never write private/CGNAT/garbage addresses into an allow-list.
    if v4 and (v4.version != 4 or not v4.is_global):
        v4 = None
    if v6 and (v6.version != 6 or not v6.is_global):
        v6 = None
    if not v4 and not v6:
        die("could not detect any public IP; leaving the list unchanged")
    v6_prefix = ipaddress.IPv6Network((int(v6), prefix_len), strict=False) if v6 else None
    print(f"detected ipv4={v4} ipv6-prefix={v6_prefix}")

    items = cf("GET", path)
    current = [{"ip": i["ip"], "comment": i.get("comment", "")} for i in items]
    wanted = desired_items(current, v4, v6_prefix)
    dry_run = os.environ.get("DRY_RUN") == "1"

    # Firewalls before the list: the list's [auto] items are the only record of the old addresses.
    fw_ids = [i.strip() for i in os.environ.get("HCLOUD_FIREWALL_IDS", "").split(",") if i.strip()]
    if fw_ids:
        if not os.environ.get("HCLOUD_TOKEN"):
            die("HCLOUD_FIREWALL_IDS is set but HCLOUD_TOKEN is not")
        old_v4, old_v6_prefix = last_synced(current, prefix_len)
        sync_firewalls(fw_ids, old_v4, v4, old_v6_prefix, v6_prefix, dry_run)

    changes = [(a["ip"], b["ip"], a["comment"]) for a, b in zip(current, wanted) if a["ip"] != b["ip"]]
    if not changes:
        print("home_ips up to date")
        return
    for old, new, comment in changes:
        print(f"{comment}: {old} -> {new}")
    if dry_run:
        print("DRY_RUN=1, not writing")
        return

    # PUT replaces the whole list; it is async, so wait for the bulk operation.
    op = cf("PUT", path, wanted)["operation_id"]
    for _ in range(30):
        status = cf("GET", f"/accounts/{os.environ['CF_ACCOUNT_ID']}/rules/lists/bulk_operations/{op}")
        if status["status"] == "completed":
            print("home_ips updated")
            return
        if status["status"] == "failed":
            die(f"bulk operation failed: {status.get('error')}")
        time.sleep(2)
    die(f"bulk operation {op} still pending")


if __name__ == "__main__":
    main()
