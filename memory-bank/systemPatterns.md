# System patterns

## High-level layout

```
repo root
├── app/                   # Next.js 15 monitor (port 4000)
│   └── src/
│       ├── app/           # Next.js App Router (layout, page, api routes)
│       ├── components/    # React UI components
│       └── lib/           # API clients, formatters, history store
├── docker-compose.yaml         # Production monitor
├── docker-compose.dev.yaml     # Dev monitor (hot-reload)
└── docker-compose.mcp.yaml     # MCP servers (cloud:3000, local:3001)
```

## Data flow

1. Browser polls `/api/isp`, `/api/devices`, `/api/clients` every 10 s via SWR.
2. Each API route in `app/src/app/api/` calls `src/lib/unifi.ts` (local or cloud client).
3. `/api/isp` additionally calls `pushPoint()` in `src/lib/history.ts` to record a `HistoryPoint`.
4. `/api/isp/history` returns the ring buffer for chart rendering.

## Patterns to follow

- **API clients in `lib/unifi.ts`** — all UniFi HTTP calls live here; components never fetch UniFi directly.
- **Path alias `@/*`** — always use `@/lib/...`, `@/components/...` (never relative `../`).
- **In-memory singleton** — `history.ts` exports module-level state; do not refactor into a class or external store unless persistence is explicitly required.
- **Tailwind only** — no CSS modules or inline styles; dark theme via `gray-*` palette.
- **SWR at page level** — data fetching belongs in `page.tsx`; components receive typed props.

## Patterns to avoid

- Do not add a database or persistent store for history (in-memory is intentional).
- Do not expose write/config operations to the dashboard (read-only).
- Do not add authentication layers (trusted LAN assumption).
