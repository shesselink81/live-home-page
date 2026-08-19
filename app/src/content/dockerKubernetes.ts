// Static export of a WordPress page (source is marked private on WordPress; this
// snapshot is intentionally committed to this public repo).
export const title = 'Web Apps, Docker & Kubernetes'
export const sourceUrl = ''
export const lastModified = ''
export const html = `
<h2 class="wp-block-heading">Overview</h2>

<p>Reference page for the self-hosted web apps running on the home lab, and the Docker / Kubernetes infrastructure that runs them.</p>

<h2 class="wp-block-heading">Self-Hosted Web Apps</h2>

<figure class="wp-block-table"><table class="has-fixed-layout"><thead><tr><th>App</th><th>What it does</th><th>Runs on</th><th>Notes</th></tr></thead><tbody><tr><td>Technitium DNS Server</td><td>Secondary/authoritative DNS with block lists</td><td>Docker (docker-server)</td><td>Host networking, block list from StevenBlack/hosts</td></tr><tr><td>Nextcloud</td><td>Personal cloud storage &amp; file sync</td><td>Docker (docker-server)</td><td>MariaDB + Redis backend, AppAPI daemon for app integrations, nightly dedupe via <code>nc-dedupe.sh</code></td></tr><tr><td>Home Assistant</td><td>Smart home automation &amp; dashboard</td><td>ha-server (192.168.50.2, Servers VLAN)</td><td>Dedicated host, separate from docker-server; see below</td></tr></tbody></table></figure>

<h2 class="wp-block-heading">Docker Host</h2>

<p>Docker workloads run on a dedicated host, <strong>docker-server</strong> (192.168.50.3, Servers VLAN). Each app lives in its own folder under <code>/docker</code> with a <code>docker-compose.yaml</code>/<code>compose.yaml</code>.</p>

<ul class="wp-block-list"><li><strong>Provisioning:</strong> <code>docker-install.sh</code> installs Docker on a fresh host</li>

<li><strong>Backups:</strong> nightly cron runs <code>docker-backup.sh</code> (00:00) and <code>backup.sh</code> (00:30), with logs to <code>/var/log</code></li>

<li><strong>Updates:</strong> <code>ubuntu-auto-update.sh</code> installed as a cron job via <code>install-auto-update-cron.sh</code>, staggered against the k3s nodes' reboot windows</li>

<li><strong>Resilience:</strong> <code>mem-reboot-check.sh</code> runs every 5 minutes, restarts k3s and its workloads if memory usage exceeds 90% (with a 15-minute cooldown)</li>
</ul>

<h2 class="wp-block-heading">Home Assistant</h2>

<p>Home Assistant runs on its own dedicated host, <strong>ha-server</strong> (192.168.50.2, Servers VLAN, wired), separate from the Docker host. It's the hub for smart home automation and talks to devices on the IoT VLAN (thermostat, TV, Hue Bridge, Harmony Hub, Somfy Bridge).</p>

<p>Automations and dashboards are managed as code from a companion repo, <code>homeassistant-ai</code>, using Claude Code together with the <a href="https://github.com/homeassistant-ai/ha-mcp">ha-mcp</a> MCP server (runs locally via Docker Compose, talks to the HA instance over its REST/WebSocket API with a long-lived access token).</p>

<ul class="wp-block-list"><li><strong>Version control:</strong> automation YAML is tracked in <code>automations/</code>; PowerShell scripts (<code>ha_automations_backup_restore.ps1</code>, <code>ha_dashboards_backup.ps1</code>) pull automations and Lovelace dashboards out of HA into <code>backups/</code> for versioning and restore</li>

<li><strong>Living room screen/cover control:</strong> closes <code>cover.screen_woonkamer</code> around midday if the Buienradar forecast high exceeds 15°C, and opens it again 30 minutes before sunset</li>

<li><strong>UniFi integration:</strong> nightly reload of the UniFi Insights and UniFi Network config entries (randomized 02:00–02:30 to avoid thundering-herd reconnects); a WAN-IP-change automation notifies and pushes the new IP to a No-IP dynamic DNS update; a sync automation keeps the UniFi allow/block firewall-rule switches mirrored onto a custom Lovelace dashboard</li>

<li><strong>Housekeeping:</strong> a nightly job clears "zombie" entities reported by the system health-score sensor via the entity registry API, with a persistent notification summarizing what was removed</li>
</ul>

<h3 class="wp-block-heading">Installed Integrations &amp; HACS Plugins</h3>

<p>Pulled live from the instance (<code>home.hessel.cloud</code>, HA core 2026.8.2) via the home-assistant MCP server, 2026-08-19.</p>

<figure class="wp-block-table"><table class="has-fixed-layout"><thead><tr><th>Name</th><th>Repo</th><th>Category</th><th>Version</th></tr></thead><tbody><tr><td>HACS</td><td>hacs/integration</td><td>integration</td><td>2.0.5</td></tr><tr><td>HAGHS (Home Assistant Global Health Score)</td><td>HA-Pulse/home-assistant-global-health-score</td><td>integration</td><td>v2.3.0</td></tr><tr><td>IDX theme</td><td>veniplex/hass-idx-theme</td><td>theme</td><td>1.1.1</td></tr><tr><td>Tado Hijack</td><td>banter240/tado_hijack</td><td>integration</td><td>v5.7.1</td></tr><tr><td>TechnitiumDNS</td><td>Atlas-Commons/home-assistant-technitiumdns</td><td>integration</td><td>v3.0.0-Beta.1</td></tr><tr><td>UniFi Insights</td><td>ruaan-deysel/ha-unifi-insights</td><td>integration</td><td>v2026.6.4</td></tr></tbody></table></figure>

<p>Other core/add-on integrations in active use, inferred from entity domains present on the instance:</p>

<ul class="wp-block-list"><li><strong>UniFi Network</strong> — gateway/switch/AP sensors, buttons, device trackers (separate from the HACS UniFi Insights integration above)</li>

<li><strong>Tado°</strong> — native integration, alongside the HACS Tado Hijack add-on</li>

<li><strong>Philips Hue</strong> — Hue Bridge, Hue dimmer switch events</li>

<li><strong>Harmony</strong> — remote/activities</li>

<li><strong>Buienradar</strong> — weather entity</li>

<li><strong>Glances</strong> — <code>pi4-glances</code> system sensors</li>

<li><strong>Google TV / Android TV</strong> — <code>googletv</code>/<code>tv-sander</code> media player &amp; device tracker</li>

<li><strong>Spotify</strong> — media player</li>

<li>Supervisor add-ons visible via <code>update</code> entities: Nginx Proxy Manager, Portainer, Advanced SSH &amp; Web Terminal</li>
</ul>

<p><em>Note: the automations/dashboards section above was compiled from the tracked automation files and docs in the <code>homeassistant-ai</code> repo, not a live query. The integrations/HACS table above it, however, is from a live home-assistant MCP query.</em></p>

<h2 class="wp-block-heading">Kubernetes (k3s)</h2>

<p>A lightweight k3s cluster handles the container workloads that benefit from orchestration (scaling, self-healing, GitOps-managed deployments), separate from the single-host Docker Compose apps above.</p>

<figure class="wp-block-table"><table class="has-fixed-layout"><thead><tr><th>Component</th><th>Purpose</th></tr></thead><tbody><tr><td>k3s</td><td>Lightweight Kubernetes distribution; installed with Flannel/Traefik/local-storage disabled in favor of the components below</td></tr><tr><td>Cilium</td><td>CNI (pod networking), replacing the default Flannel + kube-proxy</td></tr><tr><td>Traefik</td><td>Ingress via the Kubernetes Gateway API, exposed as a LoadBalancer service</td></tr><tr><td>Gateway API</td><td>CRDs for routing, installed from upstream kubernetes-sigs release</td></tr><tr><td>FluxCD</td><td>GitOps controller; bootstrapped from a separate <code>kube-config</code> repo (path <code>clusters/docker-server</code>), auto-deploys manifests to the <code>websites</code> namespace</td></tr><tr><td>WireGuard</td><td>VPN mesh for secure node-to-node / remote-access traffic</td></tr></tbody></table></figure>

<ul class="wp-block-list"><li><strong>High availability:</strong> cluster supports migrating a worker to a control-plane node (<code>upgrade-worker-to-cp.sh</code>) and moving control-plane state to etcd (<code>migrate-cp-to-etcd.sh</code>)</li>

<li><strong>Networking migrations:</strong> scripts exist for moving from MetalLB to Cilium's LB (<code>migrate-metallb-to-cilium-lb.sh</code>) and enabling IPv6 services</li>

<li><strong>Storage:</strong> NFS-backed persistent storage available via an NFS provisioner (install script in <code>k3s/nfs</code>)</li>

<li><strong>App deployment:</strong> actual web app manifests/Helm releases live in the separate <code>kube-config</code> GitOps repo, not in this repo — Flux reconciles them automatically</li>
</ul>

<h3 class="wp-block-heading">Flux-Managed Apps (live)</h3>

<p>Pulled live from the cluster via the Kubernetes MCP server, 2026-08-19. Flux reconciles four top-level Kustomizations from the <code>kube-config</code> repo (<code>flux-system</code>, <code>infrastructure-prod</code>, <code>tools</code>, <code>apps</code>), which in turn manage the HelmReleases below.</p>

<figure class="wp-block-table"><table class="has-fixed-layout"><thead><tr><th>Namespace</th><th>HelmRelease</th><th>Chart</th><th>Version</th><th>Managing Kustomization</th></tr></thead><tbody><tr><td>cert-manager</td><td>cert-manager</td><td>cert-manager</td><td>v1.21.1</td><td>tools</td></tr><tr><td>cert-manager</td><td>external-dns</td><td>external-dns</td><td>1.21.1</td><td>tools</td></tr><tr><td>default</td><td>nfs-subdir-external-provisioner</td><td>nfs-subdir-external-provisioner</td><td>4.0.18</td><td>infrastructure-prod</td></tr><tr><td>flux-system</td><td>csi-driver-nfs</td><td>csi-driver-nfs</td><td>4.13.3</td><td>infrastructure-prod</td></tr><tr><td>metallb-system</td><td>metallb</td><td>metallb</td><td>0.16.1</td><td>infrastructure-prod</td></tr><tr><td>traefik</td><td>traefik</td><td>traefik</td><td>41.2.0</td><td>infrastructure-prod</td></tr><tr><td>monitoring</td><td>alloy</td><td>alloy</td><td>1.11.1</td><td>apps</td></tr><tr><td>monitoring</td><td>loki</td><td>loki</td><td>7.3.0</td><td>apps</td></tr><tr><td>monitoring</td><td>prometheus</td><td>kube-prometheus-stack</td><td>88.5.0</td><td>apps</td></tr><tr><td>monitoring</td><td>unifi-ai</td><td>unifi-ai</td><td>1.2.3</td><td>apps</td></tr><tr><td>velero</td><td>velero</td><td>velero</td><td>12.1.0</td><td>apps</td></tr><tr><td>websites</td><td>annamaniacs</td><td>anna-nginx</td><td>1.31.6</td><td>apps</td></tr><tr><td>websites</td><td>hesselinkme</td><td>hesselinkme-nginx</td><td>1.31.6</td><td>apps</td></tr><tr><td>websites</td><td>sanderhesselinknl</td><td>hesselinkme-nginx</td><td>1.31.6</td><td>apps</td></tr><tr><td>websites</td><td>phpmyadmin</td><td>phpmyadmin</td><td>0.2.2</td><td>apps</td></tr><tr><td>websites</td><td>playlists</td><td>wordpress-alpine</td><td>1.5.17</td><td>apps</td></tr><tr><td>websites</td><td>tuinkamer</td><td>wordpress-alpine</td><td>1.5.17</td><td>apps</td></tr></tbody></table></figure>

<p>A few other namespaces exist in the cluster (<code>vault</code>, <code>headlamp</code>, <code>external-secrets</code>, <code>velero-ui</code>, <code>cluster-config</code>) that carry the <code>infrastructure-prod</code> Kustomization label but currently have no running pods or HelmRelease — likely reserved/config-only or not yet deployed.</p>

<p><em>Credentials, tokens, and API keys used by these services are intentionally omitted from this page.</em></p>
`
