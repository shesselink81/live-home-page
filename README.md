# unifi-ai

UniFi network monitoring stack — dashboard app + MCP servers for AI tooling.

## What's inside

| Component | Description | Port |
|-----------|-------------|------|
| **monitor** | Next.js dashboard (devices, clients, WAN health) | 4000 |
| **unifi-mcp-cloud** | MCP server — cloud-v1 API (ISP metrics, site health) | 3000 |
| **unifi-mcp-local** | MCP server — local API (devices, clients, firewall, WiFi) | 3001 |

## Requirements

- Docker with Compose
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

2. (Optional for DEV) Start the MCP servers and monitor app:

```sh
docker compose -f docker-compose.mcp.yaml up -d
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
- **Infrastructure devices** — gateway, switch, access point status and stats
- **Active clients** — name, IP, VLAN, connection type, signal, TX/RX
- **ISP history charts** — latency (avg + rolling max) and WAN uptime over the last ~2 hours, with red shading on issue periods

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
├── docker-compose.yaml     # Monitor app (uses Dockerfile.prod)
├── docker-compose.dev.yaml # DEV Monitor app (uses Dockerfile)
├── docker-compose.mcp.yaml # MCP servers
├── .mcp.json               # Claude Code MCP config
└── .env                    # API keys (not committed)
```
