# unifi-ai

UniFi network monitoring stack — dashboard app + MCP servers for AI tooling.

## What's inside

| Component | Description | Port |
|-----------|-------------|------|
| **monitor** | Next.js dashboard (devices, clients, WAN health) | 4000 |

## Requirements

- Docker with Compose
- Unifi MCP Server installed
- UniFi gateway reachable on the local network
- A UniFi local API key and a cloud API key

## Setup

1. Copy `.env.example` to `.env` and fill in your API keys:

```env
UNIFI_CLOUD_API_KEY=your-cloud-api-key
UNIFI_LOCAL_API_KEY=your-local-api-key
UNIFI_LOCAL_IP=local-ip-of-unifi-controller
```

> Local API key: UniFi console → Settings → Control Plane → Integrations
> Cloud API key: [unifi.ui.com](https://unifi.ui.com) → Settings → Control Plane → Integrations

2. Install the MCP servers:

```sh
pip install unifi-mcp-server
```

3. (Optional for DEV) Start the MCP servers and monitor app:

```sh
docker compose -f docker-compose.dev.yaml up -d
```

3. Start the monitor app:

```sh
docker compose up -d
```

Open **http://localhost:4000** for the dashboard.

## MCP servers

Configured in `.mcp.json` for Claude Code. Enable via `/mcp` in Claude Code.

| Server | Mode | Tools |
|--------|------|-------|
| `unifi-cloud` | cloud-v1 | `get_isp_metrics`, `list_sites`, `get_site_health_summary` |
| `unifi-local` | local | `list_active_clients`, `search_devices`, `list_sites`, firewall, DNS, WiFi, … |

## Dashboard

Auto-refreshes every 10 seconds. Shows:

- **WAN / ISP health** — ISP name, uptime %, latency, active issues
- **Infrastructure devices** — gateway, switch, access point status, firmware, TX/RX, and CPU + memory usage bars (color-coded: blue → yellow → red)
- **Active clients** — name, IP, VLAN, connection type, signal, TX/RX
- **ISP history charts** — latency (avg + rolling max) and WAN uptime over the last ~2 hours, with red shading on issue periods
- **Gateway history charts** — WAN upload/download throughput (Mbps) and gateway CPU & memory % over the last ~2 hours

## Helm repository

Hosted via GitHub Pages. Add the repo and install:

```sh
helm repo add unifi-ai https://shesselink81.github.io/unifi-ai
helm repo update
helm install unifi-ai unifi-ai/unifi-ai \
  --set unifi.localIp=192.168.1.1 \
  --set unifi.localApiKey=YOUR_LOCAL_KEY \
  --set unifi.cloudApiKey=YOUR_CLOUD_KEY
```

## Kubernetes (Helm)

The chart lives in `helm/unifi-ai/`.

```sh
helm install unifi-ai ./helm/unifi-ai \
  --set unifi.localIp=192.168.1.1 \
  --set unifi.localApiKey=YOUR_LOCAL_KEY \
  --set unifi.cloudApiKey=YOUR_CLOUD_KEY
```

Then port-forward or enable an Ingress:

```sh
# Quick access
kubectl port-forward svc/unifi-ai 4000:4000

# Ingress (nginx example)
helm upgrade unifi-ai ./helm/unifi-ai \
  --set ingress.enabled=true \
  --set ingress.className=nginx \
  --set ingress.hosts[0].host=unifi.example.com \
  --set ingress.hosts[0].paths[0].path=/ \
  --set ingress.hosts[0].paths[0].pathType=Prefix
```

Use an HTTPRoute (Gateway API) instead of Ingress:

```sh
helm upgrade unifi-ai ./helm/unifi-ai \
  --set httpRoute.enabled=true \
  --set httpRoute.parentRefs[0].name=my-gateway \
  --set httpRoute.parentRefs[0].namespace=gateway \
  --set httpRoute.parentRefs[0].sectionName=https \
  --set httpRoute.hostnames[0]=unifi.example.com
```

Use `existingSecret` to supply API keys from a pre-created Secret (keys: `local-api-key`, `cloud-api-key`).

## Project structure

```
.
├── app/                    # Next.js monitor app
│   ├── src/
│   │   ├── app/api/        # API routes (proxies to UniFi)
│   │   ├── components/     # Dashboard UI components
│   │   └── lib/            # UniFi API client, history buffer, formatters
│   ├── Dockerfile          # Dev image (hot-reload)
│   └── Dockerfile.prod     # Production image (multi-stage, standalone build)
├── helm/unifi-ai/          # Helm chart for Kubernetes
├── docker-compose.yaml     # Monitor app (uses Dockerfile.prod)
├── docker-compose.dev.yaml # DEV Monitor app (uses Dockerfile)
├── docker-compose.mcp.yaml # MCP servers
├── .mcp.json               # Claude Code MCP config
└── .env                    # API keys (not committed)
```
