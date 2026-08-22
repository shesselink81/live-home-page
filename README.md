# live-home-page

UniFi network monitoring stack — dashboard app + MCP servers for AI tooling.

## What's inside

| Component | Description | Port |
|-----------|-------------|------|
| **monitor** | Next.js dashboard (UniFi health, live Kubernetes/GitHub/Home Assistant data, optional SSO) | 4000 |

## Features

Four auto-refreshing tabs, all in one single-page dashboard:

### Home

- Quick-launch tiles for your own links, grouped by title, fully configurable via env vars (no rebuild needed) — see [Installation step 4](#4-optional-home-tab-links)
- A live GitHub repositories list (pulled through `github-mcp-server`)

### Network Monitor (Unifi)

- WAN/ISP health — ISP name, uptime %, latency, active issues
- Infrastructure devices — gateway/switch/AP status, firmware, TX/RX, CPU + memory usage bars
- Active clients — name, IP, VLAN, connection type, signal, TX/RX
- ISP history charts — latency (avg + rolling max) and WAN uptime over the last ~2 hours
- Gateway history charts — WAN upload/download throughput and gateway CPU/memory % over the last ~2 hours

### Network Topology (Unifi)

Live tree view: Internet → gateway → switches/APs → clients.

### Platforms Monitor

Live data pulled through MCP servers (see [Installation step 3](#3-optional-live-platforms-monitor-tab)) — every source degrades independently to "not reachable" if its server isn't configured or reachable, the rest of the tab keeps working:

- **Kubernetes** — node CPU/memory table *and* rolling charts, pods not in a healthy state, Flux sources (`GitRepository`/`HelmRepository`), Flux Helm releases with parsed chart/version and Ready status
- **Home Assistant** — system status (Core/OS/Supervisor/Docker versions, disk usage, pending updates) with a rolling CPU/memory chart for the host, backup status (manager state, last/next scheduled backup), your self-installed integrations (version + up-to-date status, cross-referenced against HACS), installed HACS plugins, and Supervisor add-ons (HAOS/Supervised installs only)

### Cross-cutting

- **Network access control** — the whole app (pages + API) is restricted to `ALLOWED_NETWORKS` (comma-separated CIDRs). Unset = only `localhost` can reach it. Application-level defense-in-depth, not a substitute for a real ingress-level allowlist in production.
- **Optional Microsoft Entra ID SSO** — layers *on top of* the network restriction above (both must pass, not either/or). Fully optional: disabled entirely unless all three `AUTH_MICROSOFT_ENTRA_ID_*` values are set. Restrict sign-in to specific accounts with `AUTH_ALLOWED_EMAILS`. JWT/in-memory sessions only — no database. See [Installation step 5](#5-optional-microsoft-entra-id-sso).
- **Optional `DASHBOARD_TOKEN`** — bearer-token protection for `/api/*`, independent of SSO (meant for scripts/automation, not browser use). Still works as a bypass for API callers even when SSO is enabled.
- **Customizable branding** — `APP_TITLE` overrides the dashboard header and browser tab title (default: "Used IT Tech @ Home").
- No database anywhere — history/metrics are in-memory ring buffers, reset on container restart by design.

## Requirements

- Docker with Compose v2
- A UniFi console/controller reachable on your network
- A UniFi local API key (optionally also a cloud API key, for `api.ui.com` metrics)

## Installation (Docker Compose)

### 1. Clone and configure

```sh
git clone https://github.com/shesselink81/live-home-page.git
cd live-home-page
cp .env.example .env
```

Fill in your values in `.env`:

```env
UNIFI_CLOUD_API_KEY=your-cloud-api-key
UNIFI_LOCAL_API_KEY=your-local-api-key
UNIFI_LOCAL_IP=local-ip-of-unifi-controller
```

> Local API key: UniFi console → Settings → Control Plane → Integrations
> Cloud API key: [unifi.ui.com](https://unifi.ui.com) → Settings → Control Plane → Integrations

### 2. Allow your network in

By default the app accepts requests from `localhost` only — nothing else can reach it until `ALLOWED_NETWORKS` is set:

```env
ALLOWED_NETWORKS=192.168.1.0/24
```

Browsing to it from the same machine that's running Docker Desktop? Also add `172.16.0.0/12` — Docker's own bridge-network range. Published-port traffic arrives at the container looking like it came from Docker's gateway, not `localhost`:

```env
ALLOWED_NETWORKS=192.168.1.0/24,172.16.0.0/12
```

### 3. Optional: live Platforms Monitor tab

The Platforms Monitor tab can show live Kubernetes, GitHub, and Home Assistant data, but needs its own MCP servers running somewhere reachable — see [`docker-compose.mcp.yaml`](./docker-compose.mcp.yaml) (meant to run as a dedicated stack, e.g. on a separate docker host) for `kubernetes-mcp-server`, `github-mcp-server`, and `ha-mcp`. Point the app at them:

```env
MCP_HOST=host.docker.internal
MCP_GITHUB_TOKEN=your-github-pat
HOMEASSISTANT_URL=https://your-home-assistant-url
HOMEASSISTANT_TOKEN=your-home-assistant-long-lived-token
KUBECONFIG_PATH=./kubeconfig
```

`MCP_HOST` is used to build all three `MCP_*_URL`s automatically; set `MCP_KUBERNETES_URL`/`MCP_GITHUB_URL`/`MCP_HOMEASSISTANT_URL` individually only if a source lives somewhere other than `MCP_HOST`. Everything else in the app works fine without any of this — the tab just shows "not reachable" per source until it's configured.

### 4. Optional: Home tab links

The dashboard's Home tab shows no links by default. Add your own:

```env
HOME_LINK_0_TITLE=My links
HOME_LINK_0_LABEL=Google
HOME_LINK_0_URL=https://google.com
HOME_LINK_0_NOTE=Search
```

Add more with `HOME_LINK_1_*`, `HOME_LINK_2_*`, etc. Entries sharing the same `TITLE` are grouped together on the tab.

### 5. Optional: Microsoft Entra ID SSO

Gate the whole app behind Microsoft sign-in, on top of the network restriction from step 2. Register an app in the Entra admin center (redirect URI: `<your-app-url>/api/auth/callback/microsoft-entra-id`) and set:

```env
AUTH_MICROSOFT_ENTRA_ID_ID=your-app-registration-client-id
AUTH_MICROSOFT_ENTRA_ID_SECRET=your-app-registration-client-secret
AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/your-tenant-id/v2.0
AUTH_SECRET=generate-a-random-value
AUTH_ALLOWED_EMAILS=you@example.com
```

> Generate `AUTH_SECRET` with: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

Leave any of the three `AUTH_MICROSOFT_ENTRA_ID_*` values unset to keep SSO fully disabled — the app then behaves exactly as if this section didn't exist. `AUTH_ALLOWED_EMAILS` is optional too; leave it empty to allow any account in the tenant.

### 6. Run

```sh
## Start MCP Servers local
docker compose -f docker-compose.mcp.yaml up -d
docker compose up -d
```

Open **http://localhost:4000**.

For local development with hot-reload instead:

```sh
docker compose -f docker-compose.dev.yaml up -d
```

See `.env.example` for the full list of options, including `DASHBOARD_TOKEN` (bearer-token protection for `/api/*`) and `APP_TITLE` (rename the dashboard).

## MCP servers (for Claude Code)

Configured in `.mcp.json` (see `.mcp.json.example` for a template). Enable via `/mcp` in Claude Code.

| Server | Type | Purpose |
|--------|------|---------|
| `unifi Local` | stdio | UniFi local-controller tools — devices, clients, firewall, DNS, WiFi, … |
| `unifi Cloud` | stdio | UniFi cloud API tools — `get_isp_metrics`, `list_sites`, `get_site_health_summary` |
| `Home Assistant` | http | Home Assistant tools — same server the Platforms Monitor tab uses |
| `kubernetes` | http | Kubernetes cluster tools — same server the Platforms Monitor tab uses |
| `github` | http | GitHub repository tools — same server the Home tab uses |

## Helm repository

Hosted via GitHub Pages. Add the repo and install:

```sh
helm repo add live-home-page https://shesselink81.github.io/live-home-page
helm repo update
helm install live-home-page live-home-page/live-home-page \
  --set unifi.localIp=192.168.1.1 \
  --set unifi.localApiKey=YOUR_LOCAL_KEY \
  --set unifi.cloudApiKey=YOUR_CLOUD_KEY
```

## Kubernetes (Helm)

The chart lives in `helm/live-home-page/`.

```sh
helm install live-home-page ./helm/live-home-page \
  --set unifi.localIp=192.168.1.1 \
  --set unifi.localApiKey=YOUR_LOCAL_KEY \
  --set unifi.cloudApiKey=YOUR_CLOUD_KEY
```

Then port-forward or enable an Ingress:

```sh
# Quick access
kubectl port-forward svc/live-home-page 4000:4000

# Ingress (nginx example)
helm upgrade live-home-page ./helm/live-home-page \
  --set ingress.enabled=true \
  --set ingress.className=nginx \
  --set ingress.hosts[0].host=unifi.example.com \
  --set ingress.hosts[0].paths[0].path=/ \
  --set ingress.hosts[0].paths[0].pathType=Prefix
```

Use an HTTPRoute (Gateway API) instead of Ingress:

```sh
helm upgrade live-home-page ./helm/live-home-page \
  --set httpRoute.enabled=true \
  --set httpRoute.parentRefs[0].name=my-gateway \
  --set httpRoute.parentRefs[0].namespace=gateway \
  --set httpRoute.parentRefs[0].sectionName=https \
  --set httpRoute.hostnames[0]=unifi.example.com
```

Use `existingSecret` to supply API keys from a pre-created Secret (keys: `local-api-key`, `cloud-api-key`, plus `dashboard-token`/`mcp-github-token`/`sso-client-secret`/`sso-auth-secret` for the optional features above).

The chart mirrors every env var described in this README as a `values.yaml` field — see the comments in `helm/live-home-page/values.yaml` for the full list (`appTitle`, `mcp.*`, `network.allowedNetworks`, `homeLinks.links`, `sso.*`).

## Project structure

```
.
├── app/                    # Next.js monitor app
│   ├── src/
│   │   ├── app/api/        # API routes (proxies to UniFi, MCP servers, auth)
│   │   ├── components/     # Dashboard UI components
│   │   └── lib/            # UniFi API client, MCP client, history buffers, formatters
│   ├── Dockerfile          # Production image (multi-stage, standalone build)
│   ├── Dockerfile.dev      # Dev image (hot-reload)
│   └── .env.local          # Local env for running app/ directly, not via Docker (not committed)
├── helm/live-home-page/    # Helm chart for Kubernetes
├── docker-compose.yaml     # Monitor app, production (uses Dockerfile)
├── docker-compose.dev.yaml # Monitor app, dev with hot-reload (uses Dockerfile.dev)
├── docker-compose.mcp.yaml # Optional: MCP servers for the Platforms Monitor tab
├── .mcp.json               # Claude Code MCP config (not committed)
├── .env.example            # Template — copy to .env and fill in
└── .env                    # API keys and config (not committed)
```
