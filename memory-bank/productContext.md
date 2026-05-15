# Product context

- **Problem**: UniFi's own mobile/web app is heavy and doesn't surface WAN health trends or latency history at a glance. There's no built-in way to query the network from an AI assistant.
- **Primary users**: Home-lab owner / network admin (single user, self-hosted).
- **UX principles**:
  - Dark theme (Tailwind `gray-950` base), compact information density.
  - No login — trusted LAN deployment only.
  - Data is always fresh: SWR polling every 10 s with visual stale handling.
  - Charts show ≈ 2 hours of rolling history without a database.
- **Constraints**:
  - Local UniFi controller uses a self-signed TLS cert → bypass required in API client.
  - Cloud API (`api.ui.com`) is optional; WAN metrics degrade gracefully when unavailable.
  - History is in-memory only; a container restart resets it.
