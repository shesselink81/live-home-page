// GitHub account overview, compiled via the GitHub MCP server on 2026-08-20.
// Unlike the other content/ pages, this isn't a WordPress export — it's pulled
// straight from the GitHub API (repo metadata + each repo's README).
export const title = 'GitHub Repositories'
export const sourceUrl = ''
export const lastModified = ''

export const html = `
<h2 class="wp-block-heading">Overview</h2>

<p>Reference page for the <a href="https://github.com/shesselink81">shesselink81</a> GitHub account: 9 repositories (4 public, 5 private), spanning homelab infrastructure, Home Assistant, and this UniFi dashboard itself.</p>

<h2 class="wp-block-heading">Repositories</h2>

<figure class="wp-block-table"><table class="has-fixed-layout"><thead><tr><th>Repo</th><th>Visibility</th><th>Language</th><th>What it is</th></tr></thead><tbody><tr><td>script-repo</td><td>Private</td><td>Rust</td><td>Homelab ops scripts — git-sync/auto-update crons, AKS start/stop scheduler, Nextcloud dedupe via rmlint, a k3s memory-watchdog</td></tr><tr><td>kube-config</td><td>Private</td><td>PowerShell</td><td>Flux CD + Kustomize GitOps for the home k3s cluster — HelmReleases for ~6 self-hosted sites, Velero backup/restore, a local Kind dev cluster</td></tr><tr><td>homeassistent-ai</td><td>Private</td><td>PowerShell</td><td>Home Assistant automation/dashboard workspace driven by Claude Code via the ha-mcp MCP server</td></tr><tr><td>wordpress-apache</td><td>Public</td><td>PowerShell</td><td>Custom WordPress 7.0 / PHP 8.5 image (Apache &amp; Alpine variants), Docker Bake, published as an OCI Helm chart</td></tr><tr><td>unifi-ai</td><td>Public</td><td>TypeScript</td><td>This app — a Next.js UniFi dashboard plus two MCP servers (local &amp; cloud UniFi API)</td></tr><tr><td>k3s-cluster-scripts</td><td>Public</td><td>Shell</td><td>Bootstrap &amp; join scripts for a multi-node k3s cluster, config via per-stack <code>.env.example</code></td></tr><tr><td>static-sites</td><td>Public</td><td>HTML</td><td>Two Nginx static sites, multi-arch built via GitHub Actions Buildx, pushed to Quay.io, each with its own Helm chart</td></tr><tr><td>iac-azure</td><td>Private</td><td>PowerShell</td><td>Terraform (OpenTofu-compatible) for an Azure AKS cluster, with aztfexport for importing existing resources</td></tr><tr><td>ha-supervisor</td><td>Private</td><td>Python</td><td>A fork of the upstream Home Assistant Supervisor with an experimental Kubernetes runtime backend</td></tr></tbody></table></figure>

<h2 class="wp-block-heading">Primary Language</h2>

<ul class="wp-block-list"><li><strong>PowerShell</strong> — 4 of 9 repos</li>

<li><strong>HTML, Python, Rust, Shell, TypeScript</strong> — 1 repo each</li></ul>

<h2 class="wp-block-heading">Cross-Repo Technology Patterns</h2>

<p>Counted from each repo's root files and README, not just GitHub's single dominant-language tag.</p>

<ul class="wp-block-list"><li><strong>AI-assisted dev tooling</strong> (<code>.claude</code>, <code>.cursorrules</code>, <code>.mcp.json</code>) — 8 of 9 repos</li>

<li><strong>Docker &amp; Compose</strong> — 7 of 9 repos</li>

<li><strong>Kubernetes ecosystem</strong> (k3s / AKS / Helm) — 6 of 9 repos</li>

<li><strong>PowerShell as ops glue</strong> — 4 of 9 repos</li>

<li><strong>Home automation / networking</strong> (Home Assistant, UniFi) — 3 of 9 repos</li>

<li><strong>Infra-as-code</strong> (Terraform) — 1 of 9 repos</li></ul>

<p><em>Compiled via the GitHub MCP server; repos with no description had one inferred from their README/file tree.</em></p>
`
