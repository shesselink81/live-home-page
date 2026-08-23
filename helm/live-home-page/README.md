# live-home-page Helm chart

Deploys the [live-home-page](https://github.com/shesselink81/live-home-page) monitoring dashboard on Kubernetes.

## Requirements

- Kubernetes 1.25+
- Helm 3.x
- A UniFi local API key and cloud API key
- (for HTTPRoute) Gateway API CRDs installed and a Gateway resource present

## Installing

```sh
helm install live-home-page . \
  --set unifi.localIp=192.168.1.1 \
  --set unifi.localApiKey=YOUR_LOCAL_KEY \
  --set unifi.cloudApiKey=YOUR_CLOUD_KEY
```

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
| `unifi.existingSecret` | `""` | Name of a pre-existing Secret (keys: `local-api-key`, `cloud-api-key`, `dashboard-token`) |
| `unifi.dashboardToken` | `""` | Optional bearer token to protect `/api/*` routes |
| `service.type` | `ClusterIP` | Kubernetes Service type |
| `service.port` | `4000` | Service port |
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

Create the Secret yourself, then reference it:

```sh
kubectl create secret generic live-home-page-keys \
  --from-literal=local-api-key=YOUR_LOCAL_KEY \
  --from-literal=cloud-api-key=YOUR_CLOUD_KEY

helm install live-home-page . \
  --set unifi.localIp=192.168.1.1 \
  --set unifi.existingSecret=live-home-page-keys
```

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
