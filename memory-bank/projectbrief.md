# Project brief

**unifi-ai** is a self-hosted UniFi network monitoring stack for a home/small-office network. It consists of a Next.js dashboard and two MCP servers that expose UniFi data to AI assistants.

- **Goal**: Provide a real-time, dark-mode dashboard showing WAN health, device status, and client activity from a UniFi controller — plus AI-accessible tools via Claude Code MCP.
- **Non-goals**: Multi-site management UI, UniFi configuration/write operations, public/multi-tenant hosting.
- **Success criteria**: Dashboard auto-refreshes at 10 s, shows WAN uptime/latency trends for ~2 hours, device and client tables are accurate. MCP servers expose live network data to Claude Code.

_Paths in this memory bank: `./memory-bank/`._
