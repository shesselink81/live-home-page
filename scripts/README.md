# scripts/

Operational helper scripts for the home network. None of them are part of the app image.

| Script | What it does | Runs where |
|---|---|---|
| [`refresh-spamhaus-drop.sh`](#refresh-spamhaus-dropsh) | Refreshes the UniFi firewall group `Threat-Block Spamhaus DROP v4` from the live Spamhaus DROP list | This PC (Git Bash + Docker Desktop), weekly via Task Scheduler |
| [`download-unifi-backup.sh`](#download-unifi-backupsh) | Downloads a UniFi Network autobackup (`.unf`) to Nextcloud | This PC (Git Bash + Docker Desktop) |
| [`update-cf-home-ips.py`](#update-cf-home-ipspy) | Keeps the Cloudflare `home_ips` IP list, and optionally Hetzner Cloud firewalls, in sync with the current home WAN IPv4 and IPv6 prefix | A host on the home network (e.g. docker-server), every few minutes |

---

## Running from PowerShell

The `.sh` scripts need **Git Bash**. In PowerShell a bare `bash` can resolve to WSL's
`C:\Windows\System32\bash.exe`, which can't reach Docker Desktop the same way. So call Git Bash by its full path:

```powershell
cd D:\Users\Sander\repos\unifi-ai
$gitbash = 'C:\Program Files\Git\bin\bash.exe'

& $gitbash scripts/refresh-spamhaus-drop.sh --dry-run
```

Optional: add a shortcut to your PowerShell profile (`notepad $PROFILE`):

```powershell
function gbash { & 'C:\Program Files\Git\bin\bash.exe' @args }
# then:  gbash scripts/refresh-spamhaus-drop.sh --dry-run
```

**Environment overrides.** Set them in the session, run the script, then remove them. Child processes inherit `$env:` variables:

```powershell
$env:MIN_ENTRIES = '400'
& $gitbash scripts/refresh-spamhaus-drop.sh --dry-run
Remove-Item Env:MIN_ENTRIES
```

**Requirements for both `.sh` scripts:**
- Docker Desktop is running, with the container `unifi-ai-unifi-mcp-1` up (`docker ps`).
- The container's UniFi API key is valid. It comes from `UNIFI_LOCAL_API_KEY` in `.env`.
  - **Gotcha:** your PowerShell profile also sets `UNIFI_LOCAL_API_KEY`, and `docker compose` gives shell variables priority over `.env`. After a key rotation, update both places (and `.claude/settings.local.json`), then recreate the container:
    ```powershell
    docker compose -f docker-compose.mcp.yaml up -d unifi-mcp
    ```
- The API key never leaves the container. The scripts run their controller calls through `docker exec`.

---

## refresh-spamhaus-drop.sh

Downloads the [Spamhaus DROP](https://www.spamhaus.org/drop/) list and updates the UniFi
address group `Threat-Block Spamhaus DROP v4`. Firewall policies `EGR-03 Block Spamhaus DROP - *`
block outbound traffic to it from Internal, IoT, Hotspot, VPN and DMZ.

```powershell
& $gitbash scripts/refresh-spamhaus-drop.sh              # refresh; writes only if the list changed
& $gitbash scripts/refresh-spamhaus-drop.sh --dry-run    # show the diff, write nothing
& $gitbash scripts/refresh-spamhaus-drop.sh --restore D:/Users/Sander/nextcloud/Backup/Unifi/spamhaus-drop/drop-group-YYYYMMDD_HHMMSS.json
```

**What it does:**
1. Downloads `drop_v4.json`, validates every CIDR strictly, and merges overlapping ranges.
2. Drops entries that overlap private or reserved space, your WAN IP, or members of any **other** address group on the controller (Hetzner IPs, trusted SSH sources, and so on). These are read live from the controller, so nothing is hard-coded.
3. Aborts if fewer than `MIN_ENTRIES` remain, or if more than `MAX_CHANGE_PCT` changes at once.
4. Saves the current group members to `SNAPSHOT_DIR` before writing; that's your rollback point for `--restore`.
5. Writes the group, reads it back to verify, then checks over SSH that the gateway's ipset (`UBIOS4fw_group_<short_id>`) matches.

| Env var | Default | Meaning |
|---|---|---|
| `CONTAINER` | `unifi-ai-unifi-mcp-1` | Container that holds the API key |
| `SITE` | `default` | UniFi site |
| `GROUP_NAME` | `Threat-Block Spamhaus DROP v4` | Group to manage |
| `SNAPSHOT_DIR` | `D:/Users/Sander/nextcloud/Backup/Unifi/spamhaus-drop` | Where snapshots are kept |
| `KEEP_SNAPSHOTS` | `12` | Snapshots to keep |
| `MIN_ENTRIES` | `500` | Abort below this number of entries |
| `MAX_CHANGE_PCT` | `30` | Abort above this % change |
| `FORCE` | `0` | `1` = ignore the `MAX_CHANGE_PCT` check |
| `GATEWAY_SSH` | `root@192.168.178.1` | For the ipset check; set to empty to skip it |

**Exit code:** `0` means up to date or updated and verified. Anything else means it aborted, and the group was not changed (or the message says how to restore).

**Schedule:** Windows Task Scheduler task **`unifi-ai Spamhaus DROP refresh`** runs every Sunday at 03:00. If the PC was off, it runs at the next opportunity. It only runs while you're logged in, because Docker Desktop needs your session. The log is in
`D:\Users\Sander\nextcloud\Backup\Unifi\spamhaus-drop\refresh.log`.

```powershell
Start-ScheduledTask -TaskName 'unifi-ai Spamhaus DROP refresh'      # run now
Get-ScheduledTaskInfo -TaskName 'unifi-ai Spamhaus DROP refresh'    # last result / next run
Get-Content D:\Users\Sander\nextcloud\Backup\Unifi\spamhaus-drop\refresh.log -Tail 20
```

> SSH to the gateway is only allowed from the admin laptop (MAC `98:fc:84:e3:f7:c2`) and VPN
> 192.168.2.2-.4. From any other machine the ipset check prints "Skipped" (harmless).

---

## download-unifi-backup.sh

Downloads a UniFi Network **autobackup** to `D:/Users/Sander/nextcloud/Backup/Unifi`. It checks the sha256
and skips the download if an identical copy is already there.

```powershell
& $gitbash scripts/download-unifi-backup.sh                         # latest autobackup
& $gitbash scripts/download-unifi-backup.sh autobackup_11.1.50_20261120_2330_1795217400004.unf
$env:OVERWRITE = '1'; & $gitbash scripts/download-unifi-backup.sh; Remove-Item Env:OVERWRITE
```

| Env var | Default | Meaning |
|---|---|---|
| `DEST` | `D:/Users/Sander/nextcloud/Backup/Unifi` | Target folder |
| `CONTAINER` | `unifi-ai-unifi-mcp-1` | Container that holds the API key |
| `SITE` | `default` | UniFi site |
| `OVERWRITE` | `0` | `1` = download again even if an identical file exists |

> This only covers **autobackups**. A **manual** backup made through the API
> (`unifi_create_backup`) can't be downloaded with the API key (the API returns 401). Copy it from the gateway over SSH instead:
> ```powershell
> scp root@192.168.178.1:/data/unifi/data/backup/11.1.50.unf D:\Users\Sander\nextcloud\Backup\Unifi\manual_<date>.unf
> ```

---

## update-cf-home-ips.py

Keeps the Cloudflare account IP list `home_ips` in sync with the current home WAN addresses.
It only touches list items whose comment starts with `[auto]`:
- **IPv4 items** are replaced by the current public IPv4.
- **IPv6 items** keep their host/subnet bits but get the current delegated prefix (`V6_PREFIX_LEN`, Ziggo = 56).

The public addresses come from Cloudflare's `/cdn-cgi/trace` (over 1.1.1.1 and 2606:4700:4700::1111).
Private and CGNAT addresses are never written. If IPv6 can't be detected, the IPv6 items are left as they are.
Nothing is written if nothing changed.

**Optional: Hetzner Cloud firewall sync.** If `HCLOUD_FIREWALL_IDS` is set, the script also rewrites the
source IPs of those Hetzner firewalls (for example `k8s-fw`). It uses the `[auto]` items of the list as the record of the
**previous** home addresses:
- a source that is the old home IPv4 as `/32` becomes the new IPv4 `/32`
- a source inside the old delegated IPv6 prefix gets the new prefix, with its host bits kept
- every other source (Cloudflare ranges, `::/0`, server subnets) is left untouched

The firewalls are written **before** the list. If the firewall update fails, the list stays as it was, so the
next run still knows the old addresses and tries again.

It has to run **on the home network** (normally docker-server via cron), because it detects the
public IP of the host it runs on. To try it from PowerShell on this PC:

```powershell
$env:CF_API_TOKEN        = '<token: Account > Account Filter Lists > Edit>'
$env:CF_ACCOUNT_ID       = '<account id>'
$env:CF_LIST_ID          = '<home_ips list id>'
$env:HCLOUD_TOKEN        = '<Hetzner Cloud token, read & write>'   # only for the firewall sync
$env:HCLOUD_FIREWALL_IDS = '11876231'                              # k8s-fw; comma-separated for several
$env:DRY_RUN             = '1'                                     # show the diff only
python scripts\update-cf-home-ips.py
Remove-Item Env:CF_API_TOKEN, Env:CF_ACCOUNT_ID, Env:CF_LIST_ID, Env:HCLOUD_TOKEN, Env:HCLOUD_FIREWALL_IDS, Env:DRY_RUN
```

| Env var | Required | Meaning |
|---|---|---|
| `CF_API_TOKEN` | yes | Cloudflare API token with *Account Filter Lists: Edit* |
| `CF_ACCOUNT_ID` | yes | Cloudflare account ID |
| `CF_LIST_ID` | yes | ID of the `home_ips` list |
| `V6_PREFIX_LEN` | no (56) | Delegated IPv6 prefix length |
| `HCLOUD_TOKEN` | with `HCLOUD_FIREWALL_IDS` | Hetzner Cloud API token (read & write) |
| `HCLOUD_FIREWALL_IDS` | no | Comma-separated Hetzner firewall IDs to keep in sync (e.g. `11876231` = k8s-fw) |
| `DRY_RUN` | no | `1` = print the diff for the list and firewalls, don't write |

**Exit code:** `0` means everything is up to date or was updated. `1` means an error (missing variable, no public IP detected, or a failed API call or bulk operation), with the message on stderr.

Cron example (docker-server):
```
*/5 * * * * CF_API_TOKEN=... CF_ACCOUNT_ID=... CF_LIST_ID=... HCLOUD_TOKEN=... HCLOUD_FIREWALL_IDS=11876231 /usr/bin/python3 /opt/scripts/update-cf-home-ips.py
```
