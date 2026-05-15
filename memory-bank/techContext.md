# Tech context

## Stack

- **Language / runtime**: TypeScript, Node.js 26 (Alpine 3.23 in Docker)
- **Framework**: Next.js 15.3.2 (App Router, `output: standalone`)
- **Package manager**: npm (lockfile at `app/package-lock.json`)
- **Major dependencies**: React 19, Tailwind CSS 3.4, Recharts 3.8, SWR 2.3

## Environment

- **Required env vars** (defined in `.env` at repo root, loaded via Docker Compose):
  - `UNIFI_CLOUD_API_KEY`
  - `UNIFI_LOCAL_API_KEY`
  - `UNIFI_LOCAL_IP` (default falls back to `192.168.178.1`)
- **Optional overrides**: `UNIFI_LOCAL_URL`, `UNIFI_CLOUD_URL`
- Template: `.env.example`

## Build & run

```bash
# From app/
npm run dev        # Dev server, port 4000
npm run build      # Next.js standalone build
npm start          # Production server, port 4000

# Docker (from repo root)
docker compose -f docker-compose.dev.yaml up -d    # Dev with hot-reload
docker compose up -d                               # Production
docker compose -f docker-compose.mcp.yaml up -d   # MCP servers
```

## Constraints

- No test runner configured (no jest/vitest).
- Local UniFi API uses self-signed TLS → `rejectUnauthorized: false` in `src/lib/unifi.ts`.
- History buffer max 720 points; resets on container restart.
- CI/CD: GitHub Actions builds `linux/amd64` + `linux/arm64` Docker images on `v*` tags → `ghcr.io/shesselink81/unifi-ai`.
