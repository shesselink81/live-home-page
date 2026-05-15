# Progress

**What works**

- Next.js dashboard with live WAN health card, device grid, clients table, and ISP latency/uptime charts.
- 10-second SWR auto-refresh with in-memory rolling history (~2 hr).
- Docker Compose setup for dev (hot-reload) and production (multi-stage standalone).
- GitHub Actions CI/CD publishing multi-arch images on `v*` tags.
- Two MCP servers (cloud + local) wired to Claude Code via `.mcp.json`.
- `CLAUDE.md` and memory bank in place.

**Not started / backlog**

- Test runner (no jest/vitest configured).
- Persistent history (survive container restarts).

**Known issues**

- History resets on every container restart (by design for now, but noted).
- Local API TLS is bypassed unconditionally (`rejectUnauthorized: false`).
