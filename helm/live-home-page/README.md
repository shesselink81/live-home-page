# live-home-page Helm chart

Deploys the [live-home-page](https://github.com/shesselink81/live-home-page) monitoring dashboard on Kubernetes.

## Architecture

Three pods, one Helm release:

- **monitor** — the frontend (Next.js). The only pod with a Service meant to
  be exposed externally (Ingress/HTTPRoute/NodePort).
- **backend** — owns ISP/Kubernetes/Home Assistant/Docker polling and
  history. Talks to UniFi, the MCP servers, and the Docker Engine API
  directly; the monitor pod reaches it over its ClusterIP Service
  (`BACKEND_URL`). Never exposed outside the cluster.
- **db** — MariaDB storing the backend's metric/chart history, so it
  survives pod restarts. Bundled as a single-replica Deployment + PVC by
  default (`db.enabled: true`); set `db.enabled: false` and point `db.host`
  at your own server to use an external MariaDB/MySQL instance instead.

## Requirements

- Kubernetes 1.25+
- Helm 3.x
- A UniFi local API key and cloud API key
- A `ReadWriteOnce`-capable StorageClass (for the bundled MariaDB PVC), unless `db.enabled=false`
- (for HTTPRoute) Gateway API CRDs installed and a Gateway resource present

## Installing

```sh
helm install live-home-page . \
  --set unifi.localIp=192.168.1.1 \
  --set unifi.localApiKey=YOUR_LOCAL_KEY \
  --set unifi.cloudApiKey=YOUR_CLOUD_KEY \
  --set db.password=YOUR_DB_PASSWORD
```

`db.password` is required whenever the bundled MariaDB is used (the
default, `db.enabled: true`) — Helm fails fast with a clear error if it's
left unset, rather than the db pod crash-looping on a missing secret key.

Then port-forward to verify:

```sh
kubectl port-forward svc/live-home-page 4000:4000
# open http://localhost:4000
```

## Values

| Key | Default | Description |
|-----|---------|-------------|
| `replicaCount` | `1` | Number of pod replicas |
| `image.repository` | `ghcr.io/shesselink81/live-home-page` | Container image |
| `image.tag` | `""` | Image tag; defaults to `Chart.appVersion` |
| `image.pullPolicy` | `IfNotPresent` | Image pull policy |
| `host` | `""` | Externally-reachable hostname of this app, e.g. `unifi.example.com` (exposed to the container as `HOST`; also sets `AUTH_URL=https://<host>` when `sso.clientId` is set — see [Using SSO behind a proxy](#using-sso-behind-a-proxy)) |
| `unifi.localIp` | `192.168.1.1` | IP or hostname of the local UniFi controller |
| `unifi.localUrl` | `""` | Override full local API URL (constructed from `localIp` when empty) |
| `unifi.cloudUrl` | `https://api.ui.com` | UniFi cloud API base URL |
| `unifi.localApiKey` | `""` | Local API key (stored in a Secret) |
| `unifi.cloudApiKey` | `""` | Cloud API key (stored in a Secret) |
| `unifi.existingSecret` | `""` | Name of a pre-existing Secret to use instead of the one this chart creates (keys: `local-api-key`, `cloud-api-key`, `dashboard-token`, `mcp-github-token`, `cloudflare-api-token`, `db-password`, `sso-client-secret`, `sso-auth-secret` — populate whichever your config needs) |
| `unifi.dashboardToken` | `""` | Optional bearer token to protect `/api/*` routes |
| `mcp.host` | `""` | Shortcut host for building `mcp.kubernetesUrl`/`mcp.githubUrl`/`mcp.homeassistantUrl`/`mcp.dockerApiUrl` when a specific one is left empty |
| `mcp.kubernetesUrl` / `mcp.homeassistantUrl` / `mcp.dockerApiUrl` | `""` | Read by the **backend** pod (Platforms Monitor tab sources) |
| `mcp.githubUrl` / `mcp.githubToken` | `""` | Read by the **monitor** pod (GitHub tab stays there) |
| `cloudflare.apiToken` | `""` | Cloudflare API token (stored in a Secret) for the Cloudflare section of the Platforms Monitor tab. No host/URL needed — zones are auto-discovered. Read by the **backend** pod |
| `backend.image.repository` | `ghcr.io/shesselink81/live-home-page-backend` | Backend container image |
| `backend.image.tag` | `""` | Backend image tag; defaults to `Chart.appVersion` |
| `backend.service.port` | `4100` | Backend ClusterIP Service port (internal-only, no Ingress/HTTPRoute) |
| `backend.resources` | `{}` | Backend pod resource requests/limits |
| `metrics.enabled` | `false` | Enable the backend's Prometheus exporter (`:4100/metrics`). See [Prometheus & Grafana](#prometheus--grafana) |
| `metrics.pollInterval` | `30` | Seconds between UniFi device/client polls for the exporter (min 5). Scrapes only read the cached snapshot |
| `metrics.perClient` | `true` | Export per-client series (signal, traffic, uptime, info). Disable for large networks |
| `metrics.podAnnotations` | `false` | Add `prometheus.io/scrape`/`port`/`path` annotations to the backend pod (annotation-based scraping, no Operator) |
| `metrics.serviceMonitor.enabled` | `false` | Create a Prometheus Operator `ServiceMonitor` (fails clearly if the CRD isn't installed) |
| `metrics.serviceMonitor.namespace` | `""` | ServiceMonitor namespace; defaults to the release namespace |
| `metrics.serviceMonitor.interval` / `.scrapeTimeout` | `30s` / `10s` | Scrape interval / timeout |
| `metrics.serviceMonitor.labels` | `{}` | Extra labels, e.g. `release: prometheus` if your Prometheus' `serviceMonitorSelector` needs it |
| `metrics.serviceMonitor.jobLabel` / `.relabelings` / `.metricRelabelings` | `""` / `[]` / `[]` | Passed through to the ServiceMonitor |
| `metrics.grafanaDashboard.enabled` | `false` | Create a ConfigMap with the "UniFi Overview" dashboard for the Grafana sidecar |
| `metrics.grafanaDashboard.namespace` | `""` | ConfigMap namespace; defaults to the release namespace (set it to Grafana's namespace if the sidecar doesn't search all namespaces) |
| `metrics.grafanaDashboard.labels` | `grafana_dashboard: "1"` | Labels the Grafana sidecar selects on |
| `metrics.grafanaDashboard.annotations` | `{}` | e.g. `grafana_folder: UniFi` (with the sidecar's `folderAnnotation` set) |
| `metrics.prometheusRule.enabled` | `false` | Create a `PrometheusRule` with UniFi alerts. See [Alert rules](#alert-rules) |
| `metrics.prometheusRule.namespace` | `""` | PrometheusRule namespace; defaults to the release namespace |
| `metrics.prometheusRule.labels` | `{}` | Labels on the PrometheusRule object; must match your Prometheus' `ruleSelector` (kube-prometheus-stack: `release: <release>`) |
| `metrics.prometheusRule.alertLabels` | `{}` | Extra labels on every alert, e.g. for Alertmanager routing |
| `metrics.prometheusRule.thresholds.*` | see values.yaml | `wanLatencyMs` 100, `wanUptimeRatio` 0.99, `deviceCpuRatio` 0.9, `deviceMemRatio` 0.9, `deviceLoad1` 4, `deviceTemperatureC` 80 |
| `metrics.prometheusRule.disabled` | `[]` | Alert names to leave out, e.g. `[UnifiDeviceRebooted]` |
| `metrics.prometheusRule.extraRules` | `[]` | Extra Prometheus rules, rendered as a `unifi-extra` group |
| `db.enabled` | `true` | Bundle a single-replica MariaDB Deployment + PVC. Set `false` to use an external server via `db.host` |
| `db.host` | `""` | External MariaDB/MySQL host; only used when `db.enabled: false` |
| `db.port` | `3306` | DB port |
| `db.user` | `unifi` | DB user the backend connects as (never root) |
| `db.password` | `""` | DB password (stored in a Secret). **Required** when `db.enabled: true` and `unifi.existingSecret` is unset |
| `db.name` | `unifi_metrics` | Database name |
| `db.image.repository` / `db.image.tag` | `mariadb` / `11` | Bundled MariaDB image (only used when `db.enabled: true`) |
| `db.storage.size` | `2Gi` | Bundled MariaDB PVC size |
| `db.storage.storageClassName` | `""` | Bundled MariaDB PVC StorageClass; empty uses the cluster default |
| `db.resources` | `{}` | Bundled MariaDB pod resource requests/limits |
| `network.allowedNetworks` | `""` | Comma-separated CIDRs allowed to reach the whole app (pages + `/api/*`), see `app/src/middleware.ts`. Empty disables this check entirely — rely on `sso.*`/`unifi.dashboardToken`/an ingress-level allowlist instead |
| `service.type` | `ClusterIP` | monitor Kubernetes Service type |
| `service.port` | `4000` | monitor Service port |
| `ingress.enabled` | `false` | Enable Ingress |
| `ingress.className` | `""` | Ingress class name |
| `ingress.annotations` | `{}` | Ingress annotations |
| `ingress.hosts` | see values.yaml | Ingress host/path rules |
| `ingress.tls` | `[]` | Ingress TLS config |
| `httpRoute.enabled` | `false` | Enable Gateway API HTTPRoute |
| `httpRoute.parentRefs` | `[]` | Gateway parentRefs (see below) |
| `httpRoute.hostnames` | `[]` | Hostnames to match; omit to match all |
| `traefik.middlewares` | `[]` | Traefik `Middleware` CRD refs to attach to the exposed route (see [Attaching Traefik middleware](#attaching-traefik-middleware)) |
| `resources` | `{}` | Pod resource requests/limits |
| `podSecurityContext` | non-root 1000:1000 | Pod-level security context |
| `securityContext` | drop ALL caps | Container-level security context |
| `nodeSelector` | `{}` | Node selector |
| `tolerations` | `[]` | Pod tolerations |
| `affinity` | `{}` | Pod affinity rules |

## Exposing the dashboard

### Ingress

```sh
helm upgrade live-home-page . \
  --set ingress.enabled=true \
  --set ingress.className=nginx \
  --set ingress.hosts[0].host=unifi.example.com \
  --set ingress.hosts[0].paths[0].path=/ \
  --set ingress.hosts[0].paths[0].pathType=Prefix
```

### Gateway API HTTPRoute

Requires the [Gateway API CRDs](https://gateway-api.sigs.k8s.io/guides/) and an existing `Gateway` resource.

```sh
helm upgrade live-home-page . \
  --set httpRoute.enabled=true \
  --set httpRoute.parentRefs[0].name=my-gateway \
  --set httpRoute.parentRefs[0].namespace=gateway \
  --set httpRoute.parentRefs[0].sectionName=https \
  --set httpRoute.hostnames[0]=unifi.example.com
```

`parentRefs[].namespace` and `parentRefs[].sectionName` are optional.

## Attaching Traefik middleware

If your cluster's ingress controller / Gateway API provider is
[Traefik](https://doc.traefik.io/traefik/), you can attach existing
`Middleware` CRDs (auth, rate-limiting, redirects, header manipulation, …) to
this app's route. The chart only references middleware by name — it doesn't
create `Middleware` resources itself, so define them separately first.

```sh
helm upgrade live-home-page . \
  --set ingress.enabled=true \
  --set ingress.className=traefik \
  --set traefik.middlewares[0].name=my-middleware \
  --set traefik.middlewares[0].namespace=traefik
```

With `ingress.enabled`, this renders as the
`traefik.ingress.kubernetes.io/router.middlewares` annotation
(`<namespace>-<name>@kubernetescrd`), so `namespace` can point at a
middleware in any namespace.

With `httpRoute.enabled` instead, each entry renders as an `ExtensionRef`
filter referencing the `traefik.io/v1alpha1` `Middleware` kind. Traefik's
Gateway API provider only resolves these within the HTTPRoute's own
namespace (no cross-namespace refs without a `ReferenceGrant`), so
`namespace` is ignored in that case — the `Middleware` must live in this
release's namespace.

## Using an existing Secret

Create the Secret yourself, then reference it. Include `db-password` too if
`db.enabled` is left at its default (`true`):

```sh
kubectl create secret generic live-home-page-keys \
  --from-literal=local-api-key=YOUR_LOCAL_KEY \
  --from-literal=cloud-api-key=YOUR_CLOUD_KEY \
  --from-literal=db-password=YOUR_DB_PASSWORD \
  --from-literal=cloudflare-api-token=YOUR_CLOUDFLARE_API_TOKEN

helm install live-home-page . \
  --set unifi.localIp=192.168.1.1 \
  --set unifi.existingSecret=live-home-page-keys
```

## Using an external database

By default the chart bundles a single-replica MariaDB (see [Architecture](#architecture)).
To point the backend at your own MariaDB/MySQL server instead:

```sh
helm upgrade live-home-page . \
  --set db.enabled=false \
  --set db.host=mysql.example.com \
  --set db.user=unifi \
  --set db.password=YOUR_DB_PASSWORD \
  --set db.name=unifi_metrics
```

No PVC, Deployment, or Service is created for `db` when `db.enabled: false`.

## Using SSO behind a proxy

When `sso.clientId` (Entra ID) is set, also set `host` to the app's public
hostname (matching `httpRoute.hostnames` / `ingress.hosts`):

```sh
helm upgrade live-home-page . \
  --set host=unifi.example.com \
  --set sso.clientId=... \
  --set sso.clientSecret=... \
  --set sso.issuer=...
```

Without `host`, Auth.js falls back to detecting the request host from
`X-Forwarded-Host`/`Host` headers (`trustHost: true` in `auth.ts`). Behind a
Gateway API `HTTPRoute` (or any proxy that doesn't forward those headers
reliably), this can misdetect the pod's own bind address and redirect to
something like `https://0.0.0.0:4000/api/auth/signin/microsoft-entra-id`
instead of the public URL. Setting `host` makes the chart set
`AUTH_URL=https://<host>`, which Auth.js reads directly and skips header-based
detection entirely.

## Prometheus & Grafana

The backend pod can expose UniFi metrics in Prometheus format on
`:4100/metrics`, and the chart can deploy a `ServiceMonitor` and a Grafana
dashboard to go with it. All three are off by default. With
kube-prometheus-stack:

```sh
helm upgrade live-home-page ./helm/live-home-page --reuse-values \
  --set metrics.enabled=true \
  --set metrics.serviceMonitor.enabled=true \
  --set metrics.grafanaDashboard.enabled=true
```

If your Prometheus only selects ServiceMonitors with a specific label (the
kube-prometheus-stack default while `serviceMonitorSelectorNilUsesHelmValues`
is true), also set `metrics.serviceMonitor.labels.release=<your prometheus release>`.

The backend polls the controller on its own timer (`metrics.pollInterval`),
and scrapes only read that cached snapshot, so the Prometheus scrape interval
doesn't change how often UniFi gets hit. The dashboard JSON is at
`dashboards/unifi-overview.json` in this chart and can also be imported into
any Grafana by hand. It has a data source picker and `job`/`device`/`network`
filters.

| Metric | Labels | Notes |
|---|---|---|
| `unifi_wan_up`, `unifi_wan_latency_ms`, `unifi_wan_latency_max_ms`, `unifi_wan_uptime_seconds`, `unifi_wan_uptime_ratio_24h` | `wan` | From the existing 10s ISP poll |
| `unifi_wan_issue` | `wan`, `type` (`packet_loss`/`high_latency`/`downtime`) | UniFi cloud API internet issues |
| `unifi_isp_info` | `isp`, `organization`, `asn`, `external_ip` | Always 1 |
| `unifi_device_info` | `mac`, `name`, `type`, `model`, `version`, `ip` | Always 1 |
| `unifi_device_up`, `unifi_device_state`, `unifi_device_uptime_seconds`, `unifi_device_cpu_ratio`, `unifi_device_mem_ratio`, `unifi_device_load1`, `unifi_device_temperature_celsius`, `unifi_device_clients` | `mac`, `name`, `type`, `model` | Only emitted when the model reports the value |
| `unifi_device_transmit_bytes_total`, `unifi_device_receive_bytes_total` | `mac`, `name`, `type`, `model` | Counters, so use `rate()`. For the gateway these are WAN upload/download |
| `unifi_clients` | `connection` (`wired`/`wireless`), `network` | Client counts |
| `unifi_client_info` | `mac`, `name`, `network`, `connection`, `ip`, `essid`, `uplink`, `guest` | Per client (`metrics.perClient`) |
| `unifi_client_signal_dbm`, `unifi_client_uptime_seconds`, `unifi_client_transmit_bytes_total`, `unifi_client_receive_bytes_total` | `mac`, `name`, `network`, `connection` | Per client (`metrics.perClient`) |
| `unifi_exporter_poll_success`, `unifi_exporter_poll_duration_seconds`, `unifi_exporter_last_success_timestamp_seconds` | `source` | Health of every backend poll loop |
| `unifi_exporter_process_*`, `unifi_exporter_nodejs_*` | | Node.js process metrics |

### Alert rules

`metrics.prometheusRule.enabled=true` (together with `metrics.enabled`)
creates a `PrometheusRule`. kube-prometheus-stack only loads rules whose
labels match its `ruleSelector`, usually `release: <your prometheus release>`:

```sh
--set metrics.prometheusRule.enabled=true \
--set metrics.prometheusRule.labels.release=prometheus
```

| Alert | Fires when | for | Severity |
|---|---|---|---|
| `UnifiWanDown` | Controller reports the WAN down | 2m | critical |
| `UnifiWanHighLatency` | 5-min average WAN latency > `wanLatencyMs` (100 ms) | 10m | warning |
| `UnifiWanPacketLoss` | UniFi cloud API reports packet loss in the last 15 min | 5m | warning |
| `UnifiWanUptimeLow` | Rolling 24h WAN uptime < `wanUptimeRatio` (99%) | 15m | warning |
| `UnifiGatewayDown` | Gateway not in the connected state | 2m | critical |
| `UnifiDeviceDown` | AP/switch not in the connected state | 5m | warning |
| `UnifiDeviceHighCpu` | 5-min average CPU > `deviceCpuRatio` (90%) | 15m | warning |
| `UnifiDeviceHighMemory` | Memory > `deviceMemRatio` (90%) | 15m | warning |
| `UnifiDeviceHighLoad` | 5-min average load1 > `deviceLoad1` (4) | 15m | warning |
| `UnifiDeviceHighTemperature` | Hottest sensor > `deviceTemperatureC` (80 °C) | 10m | warning |
| `UnifiDeviceRebooted` | Device uptime < 10 min | – | info |
| `UnifiExporterDown` | Backend `/metrics` target down or missing | 5m | warning |
| `UnifiPollFailing` | Backend's ISP or UniFi device/client poll failing | 10m | warning |

The CPU and load alerts use 5-minute averages held for 15 minutes, so short
spikes don't fire them. A UCG Ultra briefly reaching about 87% CPU or a load
of about 4 is normal. Every alert has `summary`, `description` and
`dashboard_url` annotations. The "UniFi Overview" dashboard has an Alerts row
at the top that lists firing and pending `Unifi*` alerts.

## Uninstalling

```sh
helm uninstall live-home-page
```
