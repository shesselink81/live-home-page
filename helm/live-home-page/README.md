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
| `unifi.existingSecret` | `""` | Name of a pre-existing Secret to use instead of the one this chart creates (keys: `local-api-key`, `cloud-api-key`, `dashboard-token`, `mcp-github-token`, `db-password`, `sso-client-secret`, `sso-auth-secret` — populate whichever your config needs) |
| `unifi.dashboardToken` | `""` | Optional bearer token to protect `/api/*` routes |
| `mcp.host` | `""` | Shortcut host for building `mcp.kubernetesUrl`/`mcp.githubUrl`/`mcp.homeassistantUrl`/`mcp.dockerApiUrl` when a specific one is left empty |
| `mcp.kubernetesUrl` / `mcp.homeassistantUrl` / `mcp.dockerApiUrl` | `""` | Read by the **backend** pod (Platforms Monitor tab sources) |
| `mcp.githubUrl` / `mcp.githubToken` | `""` | Read by the **monitor** pod (GitHub tab stays there) |
| `backend.image.repository` | `ghcr.io/shesselink81/live-home-page-backend` | Backend container image |
| `backend.image.tag` | `""` | Backend image tag; defaults to `Chart.appVersion` |
| `backend.service.port` | `4100` | Backend ClusterIP Service port (internal-only, no Ingress/HTTPRoute) |
| `backend.resources` | `{}` | Backend pod resource requests/limits |
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

## Using an existing Secret

Create the Secret yourself, then reference it. Include `db-password` too if
`db.enabled` is left at its default (`true`):

```sh
kubectl create secret generic live-home-page-keys \
  --from-literal=local-api-key=YOUR_LOCAL_KEY \
  --from-literal=cloud-api-key=YOUR_CLOUD_KEY \
  --from-literal=db-password=YOUR_DB_PASSWORD

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

## Uninstalling

```sh
helm uninstall live-home-page
```
