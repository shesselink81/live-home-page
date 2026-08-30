'use client'

import { useState } from 'react'
import useSWR from 'swr'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import type { K8sNode, K8sPod, FluxSource, FluxHelmRelease } from '@/app/api/cloud/kubernetes/route'
import type { HaIntegrations, HaApps, HaSystem, HaBackups, HaHacs } from '@/app/api/cloud/homeassistant/route'
import type { DockerInfo, DockerContainer } from '@/app/api/cloud/docker/route'
import type {
  CloudflareTotals,
  CloudflareZoneStats,
  CloudflareHourPoint,
  CloudflareCountBreakdown,
  CloudflareStatusBuckets,
} from '@/app/api/cloud/cloudflare/route'
import { formatBytes } from '@/lib/format'

const regionNames =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['en'], { type: 'region' }) : null

function countryName(code: string): string {
  if (!code) return 'Unknown'
  try {
    return regionNames?.of(code) ?? code
  } catch {
    return code
  }
}

const DEVICE_COLORS: Record<string, string> = {
  desktop: '#60a5fa',
  mobile: '#f97316',
  tablet: '#f472b6',
}

const STATUS_COLORS: Record<string, string> = {
  '2xx': '#34d399',
  '3xx': '#60a5fa',
  '4xx': '#facc15',
  '5xx': '#ef4444',
  other: '#9ca3af',
}

const REFRESH = 30_000

interface MetricPoint {
  ts: number
  values: Record<string, number | null>
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
    return r.json()
  })

const CHART_COLORS = ['#f97316', '#60a5fa', '#34d399', '#a78bfa', '#f472b6', '#facc15']

const SUB_TABS = ['kubernetes', 'homeassistant', 'docker', 'cloudflare'] as const
type SubTab = (typeof SUB_TABS)[number]
const SUB_TAB_LABEL: Record<SubTab, string> = {
  kubernetes: 'Kubernetes',
  homeassistant: 'Home Assistant',
  docker: 'Docker',
  cloudflare: 'Cloudflare',
}

interface KubernetesData {
  ok: boolean
  error?: string
  nodes?: K8sNode[]
  nodesHistory?: MetricPoint[]
  nodeNames?: string[]
  unhealthyPods?: K8sPod[]
  fluxSources?: FluxSource[]
  fluxSourcesError?: string
  fluxHelmReleases?: FluxHelmRelease[]
  fluxHelmReleasesError?: string
}

interface HomeAssistantData {
  ok: boolean
  error?: string
  integrations?: HaIntegrations | null
  apps?: HaApps | null
  system?: HaSystem | null
  backups?: HaBackups | null
  hacs?: HaHacs | null
  hostMetricsHistory?: MetricPoint[]
}

interface DockerData {
  ok: boolean
  error?: string
  info?: DockerInfo | null
  infoError?: string
  containers?: DockerContainer[] | null
  containersError?: string
  hostMetricsHistory?: MetricPoint[]
}

interface CloudflareData {
  ok: boolean
  error?: string
  totals?: CloudflareTotals
  zones?: CloudflareZoneStats[]
  timeseries?: CloudflareHourPoint[]
  cacheStatus?: CloudflareCountBreakdown[]
  byCountry?: CloudflareCountBreakdown[]
  byDevice?: CloudflareCountBreakdown[]
  byHost?: CloudflareCountBreakdown[]
  byPath?: CloudflareCountBreakdown[]
  statusCodes?: CloudflareStatusBuckets
}

export default function CloudAppsTab() {
  const [subTab, setSubTab] = useState<SubTab>('kubernetes')

  const { data: k8s } = useSWR<KubernetesData>('/api/cloud/kubernetes', fetcher, { refreshInterval: REFRESH })
  const { data: ha } = useSWR<HomeAssistantData>('/api/cloud/homeassistant', fetcher, { refreshInterval: REFRESH })
  const { data: docker } = useSWR<DockerData>('/api/cloud/docker', fetcher, { refreshInterval: REFRESH })
  const { data: cloudflare } = useSWR<CloudflareData>('/api/cloud/cloudflare', fetcher, { refreshInterval: REFRESH })

  return (
    <div>
      <div className="flex gap-1 mb-6 border-b border-gray-800">
        {SUB_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              subTab === t ? 'border-blue-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {SUB_TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {subTab === 'kubernetes' && (
      <Section title="Kubernetes">
        {!k8s ? (
          <Loading />
        ) : !k8s.ok ? (
          <NotReachable detail={k8s.error} />
        ) : (
          <div className="space-y-5">
            <SubSection title="Nodes">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs border-b border-gray-800">
                    <th className="text-left pb-2 font-normal">Node</th>
                    <th className="text-left pb-2 font-normal">CPU</th>
                    <th className="text-left pb-2 font-normal">Memory</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {(k8s.nodes ?? []).map((n) => (
                    <tr key={n.name}>
                      <td className="py-2 pr-3 text-white font-medium">{n.name}</td>
                      <td className="py-2 pr-3 text-gray-300 font-mono text-xs">
                        {n.cpuCores} ({n.cpuPct})
                      </td>
                      <td className="py-2 pr-3 text-gray-300 font-mono text-xs">
                        {n.memBytes} ({n.memPct})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!!k8s.nodesHistory?.length && !!k8s.nodeNames?.length && (
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-500 text-xs mb-2">CPU (%)</p>
                    <MetricsChart
                      points={k8s.nodesHistory}
                      series={k8s.nodeNames.map((name, idx) => ({
                        key: `${name}_cpu`,
                        name,
                        color: CHART_COLORS[idx % CHART_COLORS.length],
                      }))}
                    />
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-2">Memory (%)</p>
                    <MetricsChart
                      points={k8s.nodesHistory}
                      series={k8s.nodeNames.map((name, idx) => ({
                        key: `${name}_mem`,
                        name,
                        color: CHART_COLORS[idx % CHART_COLORS.length],
                      }))}
                    />
                  </div>
                </div>
              )}
            </SubSection>

            <SubSection title="Pods not Running or Succeeded">
              {!k8s.unhealthyPods?.length ? (
                <p className="text-green-400 text-sm">All pods healthy</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs border-b border-gray-800">
                      <th className="text-left pb-2 font-normal">Namespace</th>
                      <th className="text-left pb-2 font-normal">Pod</th>
                      <th className="text-left pb-2 font-normal">Status</th>
                      <th className="text-left pb-2 font-normal">Restarts</th>
                      <th className="text-left pb-2 font-normal">Age</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {k8s.unhealthyPods.map((p) => (
                      <tr key={`${p.namespace}/${p.name}`}>
                        <td className="py-2 pr-3 text-gray-400 text-xs">{p.namespace}</td>
                        <td className="py-2 pr-3 text-white">{p.name}</td>
                        <td className="py-2 pr-3 text-yellow-400 text-xs">{p.status}</td>
                        <td className="py-2 pr-3 text-gray-300 text-xs">{p.restarts}</td>
                        <td className="py-2 pr-3 text-gray-500 text-xs">{p.age}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </SubSection>

            <SubSection title="Flux sources">
              {k8s.fluxSourcesError ? (
                <p className="text-gray-500 text-sm">{k8s.fluxSourcesError}</p>
              ) : !k8s.fluxSources?.length ? (
                <p className="text-gray-500 text-sm">No Flux sources found</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs border-b border-gray-800">
                      <th className="text-left pb-2 font-normal">Kind</th>
                      <th className="text-left pb-2 font-normal">Name</th>
                      <th className="text-left pb-2 font-normal">Namespace</th>
                      <th className="text-left pb-2 font-normal">Ready</th>
                      <th className="text-left pb-2 font-normal">URL</th>
                      <th className="text-left pb-2 font-normal">Age</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {k8s.fluxSources.map((s) => (
                      <tr key={`${s.kind}/${s.namespace}/${s.name}`}>
                        <td className="py-2 pr-3 text-gray-400 text-xs">{s.kind}</td>
                        <td className="py-2 pr-3 text-white">{s.name}</td>
                        <td className="py-2 pr-3 text-gray-400 text-xs">{s.namespace}</td>
                        <td className="py-2 pr-3"><ReadyBadge ready={s.ready} /></td>
                        <td className="py-2 pr-3 text-gray-500 text-xs truncate max-w-[280px]" title={s.url}>{s.url}</td>
                        <td className="py-2 pr-3 text-gray-500 text-xs">{s.age}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </SubSection>

            <SubSection title="Flux Helm releases">
              {k8s.fluxHelmReleasesError ? (
                <p className="text-gray-500 text-sm">{k8s.fluxHelmReleasesError}</p>
              ) : !k8s.fluxHelmReleases?.length ? (
                <p className="text-gray-500 text-sm">No Helm releases found</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs border-b border-gray-800">
                      <th className="text-left pb-2 font-normal">Release</th>
                      <th className="text-left pb-2 font-normal">Namespace</th>
                      <th className="text-left pb-2 font-normal">Ready</th>
                      <th className="text-left pb-2 font-normal">Chart</th>
                      <th className="text-left pb-2 font-normal">Age</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {k8s.fluxHelmReleases.map((r) => (
                      <tr key={`${r.namespace}/${r.name}`}>
                        <td className="py-2 pr-3 text-white">{r.name}</td>
                        <td className="py-2 pr-3 text-gray-400 text-xs">{r.namespace}</td>
                        <td className="py-2 pr-3"><ReadyBadge ready={r.ready} title={r.status ?? undefined} /></td>
                        <td className="py-2 pr-3 text-gray-300 font-mono text-xs">{r.chart ?? '—'}</td>
                        <td className="py-2 pr-3 text-gray-500 text-xs">{r.age}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </SubSection>
          </div>
        )}
      </Section>
      )}

      {subTab === 'homeassistant' && (
      <Section title="Home Assistant">
        {!ha ? (
          <Loading />
        ) : !ha.ok ? (
          <NotReachable detail={ha.error} />
        ) : (
          <div className="space-y-5">
            <SubSection title="System status">
              {!ha.system ? (
                <p className="text-gray-500 text-sm">Not available</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  <Stat label="Core version" value={ha.system.coreVersion} />
                  <Stat label="Installation" value={ha.system.installationType} />
                  <Stat label="Host OS" value={ha.system.hostOs} />
                  <Stat
                    label="Healthy"
                    value={ha.system.healthy === undefined ? undefined : ha.system.healthy ? 'Yes' : 'No'}
                    warn={ha.system.healthy === false}
                  />
                  <Stat label="Supervisor" value={ha.system.supervisorVersion} />
                  <Stat label="Docker" value={ha.system.dockerVersion} />
                  <Stat label="Disk used" value={ha.system.diskUsed && ha.system.diskTotal ? `${ha.system.diskUsed} / ${ha.system.diskTotal}` : undefined} />
                  <Stat label="Database" value={ha.system.dbSize ? `${ha.system.dbSize} (${ha.system.dbEngine})` : undefined} />
                  <Stat
                    label="Updates available"
                    value={ha.system.updatesAvailable}
                    warn={(ha.system.updatesAvailable ?? 0) > 0}
                  />
                </div>
              )}
              {!!ha.hostMetricsHistory?.length && (
                <div className="mt-4">
                  <p className="text-gray-500 text-xs mb-2">Host CPU &amp; Memory (%)</p>
                  <MetricsChart
                    points={ha.hostMetricsHistory}
                    series={[
                      { key: 'cpu', name: 'CPU', color: '#f97316' },
                      { key: 'mem', name: 'Memory', color: '#a78bfa' },
                    ]}
                  />
                </div>
              )}
            </SubSection>

            <SubSection title="Backups">
              {!ha.backups ? (
                <p className="text-gray-500 text-sm">Not available</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Stat
                    label="Manager state"
                    value={ha.backups.managerState}
                    warn={!!ha.backups.managerState && ha.backups.managerState !== 'idle'}
                  />
                  <Stat label="Last successful" value={formatDate(ha.backups.lastSuccessful)} />
                  <Stat label="Last attempted" value={formatDate(ha.backups.lastAttempted)} />
                  <Stat label="Next scheduled" value={formatDate(ha.backups.nextScheduled)} />
                </div>
              )}
            </SubSection>

            <SubSection title="Integrations">
              {!ha.integrations ? (
                <p className="text-gray-500 text-sm">Not available</p>
              ) : (
                <>
                  <p className="text-gray-500 text-xs mb-2">
                    {ha.integrations.total} total · {ha.integrations.loaded} loaded · {ha.integrations.notLoaded} not loaded
                  </p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs border-b border-gray-800">
                        <th className="text-left pb-2 font-normal">Title</th>
                        <th className="text-left pb-2 font-normal">Version</th>
                        <th className="text-left pb-2 font-normal">State</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                      {ha.integrations.entries.map((i, idx) => (
                        <tr key={`${i.title}-${idx}`}>
                          <td className="py-2 pr-3 text-white">{i.title}</td>
                          <td className="py-2 pr-3 text-gray-300 font-mono text-xs">{i.version ?? '—'}</td>
                          <td className="py-2 pr-3">
                            {i.upToDate === null ? (
                              <span className="text-xs px-2 py-0.5 rounded-full border bg-gray-800 text-gray-400 border-gray-700">
                                Built-in
                              </span>
                            ) : (
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full border ${
                                  i.upToDate
                                    ? 'bg-green-900/40 text-green-300 border-green-700'
                                    : 'bg-yellow-900/40 text-yellow-300 border-yellow-700'
                                }`}
                              >
                                {i.upToDate ? 'Up to date' : 'Update available'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </SubSection>

            <SubSection title="HACS plugins">
              {!ha.hacs ? (
                <p className="text-gray-500 text-sm">Not available (HACS not installed)</p>
              ) : !ha.hacs.entries.length ? (
                <p className="text-gray-500 text-sm">No HACS plugins installed</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs border-b border-gray-800">
                      <th className="text-left pb-2 font-normal">Plugin</th>
                      <th className="text-left pb-2 font-normal">Category</th>
                      <th className="text-left pb-2 font-normal">Version</th>
                      <th className="text-left pb-2 font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {ha.hacs.entries.map((p) => (
                      <tr key={p.name}>
                        <td className="py-2 pr-3 text-white">{p.name}</td>
                        <td className="py-2 pr-3 text-gray-400 text-xs">{p.category}</td>
                        <td className="py-2 pr-3 text-gray-300 font-mono text-xs">
                          {p.installedVersion}
                          {p.pendingUpdate && <span className="ml-2 text-gray-500">→ {p.availableVersion}</span>}
                        </td>
                        <td className="py-2 pr-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full border ${
                              p.pendingUpdate
                                ? 'bg-yellow-900/40 text-yellow-300 border-yellow-700'
                                : 'bg-green-900/40 text-green-300 border-green-700'
                            }`}
                          >
                            {p.pendingUpdate ? 'Update available' : 'Up to date'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </SubSection>

            <SubSection title="Apps (add-ons)">
              {!ha.apps ? (
                <p className="text-gray-500 text-sm">Not available (only Home Assistant OS / Supervised installs expose add-ons)</p>
              ) : (
                <>
                  <p className="text-gray-500 text-xs mb-2">
                    {ha.apps.totalInstalled} installed · {ha.apps.running} running · {ha.apps.stopped} stopped ·{' '}
                    {ha.apps.updatesAvailable} updates available
                  </p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs border-b border-gray-800">
                        <th className="text-left pb-2 font-normal">Add-on</th>
                        <th className="text-left pb-2 font-normal">Version</th>
                        <th className="text-left pb-2 font-normal">State</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                      {ha.apps.entries.map((a) => (
                        <tr key={a.slug}>
                          <td className="py-2 pr-3 text-white">{a.name}</td>
                          <td className="py-2 pr-3 text-gray-300 font-mono text-xs">
                            {a.version}
                            {a.updateAvailable && <span className="ml-2 text-yellow-400">update available</span>}
                          </td>
                          <td className="py-2 pr-3">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full border ${
                                a.state === 'started'
                                  ? 'bg-green-900/40 text-green-300 border-green-700'
                                  : 'bg-gray-800 text-gray-400 border-gray-700'
                              }`}
                            >
                              {a.state}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </SubSection>
          </div>
        )}
      </Section>
      )}

      {subTab === 'docker' && (
      <Section title="Docker">
        {!docker ? (
          <Loading />
        ) : !docker.ok ? (
          <NotReachable detail={docker.error} />
        ) : (
          <div className="space-y-5">
            <SubSection title="Host">
              {!docker.info ? (
                <div className="text-sm">
                  <p className="text-gray-500">Not available</p>
                  {docker.infoError && <p className="text-gray-600 text-xs mt-1 font-mono">{docker.infoError}</p>}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  <Stat label="Version" value={docker.info.version} />
                  <Stat label="OS" value={docker.info.os} />
                  <Stat label="Arch" value={docker.info.arch} />
                  <Stat label="CPUs" value={docker.info.cpus} />
                  <Stat label="Memory" value={docker.info.memTotal ? formatBytes(docker.info.memTotal) : undefined} />
                  <Stat label="Running" value={docker.info.containersRunning} />
                  <Stat label="Stopped" value={docker.info.containersStopped} warn={docker.info.containersStopped > 0} />
                  <Stat label="Images" value={docker.info.images} />
                </div>
              )}
              {!!docker.hostMetricsHistory?.length && (
                <div className="mt-4">
                  <p className="text-gray-500 text-xs mb-2">Host CPU &amp; Memory (%)</p>
                  <MetricsChart
                    points={docker.hostMetricsHistory}
                    series={[
                      { key: 'cpu', name: 'CPU', color: '#f97316' },
                      { key: 'mem', name: 'Memory', color: '#a78bfa' },
                    ]}
                  />
                </div>
              )}
            </SubSection>

            <SubSection title="Containers">
              {!docker.containers?.length ? (
                <div className="text-sm">
                  <p className="text-gray-500">Not available</p>
                  {docker.containersError && <p className="text-gray-600 text-xs mt-1 font-mono">{docker.containersError}</p>}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs border-b border-gray-800">
                      <th className="text-left pb-2 font-normal">Name</th>
                      <th className="text-left pb-2 font-normal">Image</th>
                      <th className="text-left pb-2 font-normal">State</th>
                      <th className="text-left pb-2 font-normal">Status</th>
                      <th className="text-left pb-2 font-normal">Ports</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {docker.containers.map((c) => (
                      <tr key={c.id}>
                        <td className="py-2 pr-3 text-white font-medium">{c.name}</td>
                        <td className="py-2 pr-3 text-gray-300 font-mono text-xs">{c.image}</td>
                        <td className="py-2 pr-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full border ${
                              c.state === 'running'
                                ? 'bg-green-900/40 text-green-300 border-green-700'
                                : c.state === 'exited' || c.state === 'dead'
                                  ? 'bg-red-900/40 text-red-300 border-red-700'
                                  : c.state === 'restarting'
                                    ? 'bg-yellow-900/40 text-yellow-300 border-yellow-700'
                                    : 'bg-gray-800 text-gray-400 border-gray-700'
                            }`}
                          >
                            {c.state}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-gray-500 text-xs">{c.status}</td>
                        <td className="py-2 pr-3 text-gray-300 font-mono text-xs">{c.ports.join(', ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </SubSection>
          </div>
        )}
      </Section>
      )}

      {subTab === 'cloudflare' && (
      <Section title="Cloudflare — Traffic overview (last 24h)">
        {!cloudflare ? (
          <Loading />
        ) : !cloudflare.ok ? (
          <NotReachable detail={cloudflare.error} />
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Total requests" value={cloudflare.totals?.requests?.toLocaleString()} />
              <Stat label="Total visits" value={cloudflare.totals?.visits?.toLocaleString()} />
              <Stat
                label="Cache hit rate"
                value={
                  cloudflare.totals && cloudflare.totals.requests > 0
                    ? `${((cloudflare.totals.cachedRequests / cloudflare.totals.requests) * 100).toFixed(2)}%`
                    : undefined
                }
              />
              <Stat label="Total data transfer" value={cloudflare.totals ? formatBytes(cloudflare.totals.bytes) : undefined} />
            </div>

            {!!cloudflare.timeseries?.length && (
              <SubSection title="Requests over time">
                <RequestsChart points={cloudflare.timeseries} />
              </SubSection>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SubSection title="Requests by device type">
                <DeviceDonut data={cloudflare.byDevice ?? []} />
              </SubSection>
              <SubSection title="Status codes">
                <StatusCodesBar buckets={cloudflare.statusCodes} />
              </SubSection>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SubSection title="Requests by country">
                <CountBarList items={cloudflare.byCountry ?? []} labelFor={countryName} />
              </SubSection>
              <SubSection title="Top hosts">
                <CountBarList items={cloudflare.byHost ?? []} />
              </SubSection>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SubSection title="Top paths">
                <CountBarList items={cloudflare.byPath ?? []} mono />
              </SubSection>
              <SubSection title="Cache status">
                <CountBarList items={cloudflare.cacheStatus ?? []} capitalize />
              </SubSection>
            </div>

            <SubSection title="Zones">
              {!cloudflare.zones?.length ? (
                <p className="text-gray-500 text-sm">No zones visible to this API token</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs border-b border-gray-800">
                      <th className="text-left pb-2 font-normal">Zone</th>
                      <th className="text-left pb-2 font-normal">Requests</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {cloudflare.zones.map((z) => (
                      <tr key={z.zoneTag}>
                        <td className="py-2 pr-3 text-white font-medium">{z.name}</td>
                        <td className="py-2 pr-3 text-gray-300 font-mono text-xs">{z.requests.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </SubSection>
          </div>
        )}
      </Section>
      )}
    </div>
  )
}

function formatDate(iso: string | undefined): string | undefined {
  if (!iso) return undefined
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

function Stat({ label, value, warn }: { label: string; value: string | number | undefined; warn?: boolean }) {
  return (
    <div className="bg-black/30 rounded-lg p-3">
      <p className="text-gray-500 text-xs">{label}</p>
      <p className={`text-lg font-semibold truncate ${warn ? 'text-yellow-400' : 'text-white'}`} title={String(value ?? '')}>
        {value ?? '—'}
      </p>
    </div>
  )
}

interface ChartSeries {
  key: string
  name: string
  color: string
}

function MetricsChart({ points, series, unit = '%' }: { points: MetricPoint[]; series: ChartSeries[]; unit?: string }) {
  if (points.length < 3) {
    return <p className="text-gray-600 text-xs text-center py-6">Collecting data — chart appears after a few polls.</p>
  }
  const data = points.map((p) => ({
    time: new Date(p.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    ...p.values,
  }))
  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis dataKey="time" stroke="#374151" tick={{ fill: '#6b7280', fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis stroke="#374151" tick={{ fill: '#6b7280', fontSize: 10 }} domain={[0, 100]} unit={unit} width={40} />
        <Tooltip
          contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#9ca3af', fontSize: 11 }}
          itemStyle={{ fontSize: 12 }}
          formatter={(v) => [`${v}${unit}`] as [string]}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
        {series.map((s) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} dot={false} strokeWidth={1.5} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function RequestsChart({ points }: { points: CloudflareHourPoint[] }) {
  if (points.length < 3) {
    return <p className="text-gray-600 text-xs text-center py-6">Collecting data — chart appears after a few polls.</p>
  }
  const data = points.map((p) => ({
    time: new Date(p.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    requests: p.requests,
  }))
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis dataKey="time" stroke="#374151" tick={{ fill: '#6b7280', fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis
          stroke="#374151"
          tick={{ fill: '#6b7280', fontSize: 10 }}
          width={44}
          tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
        />
        <Tooltip
          contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#9ca3af', fontSize: 11 }}
          itemStyle={{ fontSize: 12 }}
          formatter={(v) => [Number(v).toLocaleString(), 'Requests'] as [string, string]}
        />
        <Line type="monotone" dataKey="requests" stroke="#f97316" dot={false} strokeWidth={1.5} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function CountBarList({
  items,
  labelFor,
  mono,
  capitalize,
}: {
  items: CloudflareCountBreakdown[]
  labelFor?: (key: string) => string
  mono?: boolean
  capitalize?: boolean
}) {
  if (!items.length) return <p className="text-gray-500 text-sm">No data</p>
  const max = Math.max(...items.map((i) => i.count), 1)
  return (
    <div className="space-y-1.5">
      {items.map((item) => {
        const label = labelFor ? labelFor(item.key) : item.key
        return (
          <div key={item.key} className="flex items-center gap-2 text-sm">
            <span
              className={`w-40 shrink-0 truncate text-gray-300 ${mono ? 'font-mono text-xs' : ''} ${capitalize ? 'capitalize' : ''}`}
              title={label}
            >
              {label}
            </span>
            <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500/70 rounded-full" style={{ width: `${(item.count / max) * 100}%` }} />
            </div>
            <span className="w-16 shrink-0 text-right text-gray-400 font-mono text-xs">{item.count.toLocaleString()}</span>
          </div>
        )
      })}
    </div>
  )
}

function DeviceDonut({ data }: { data: CloudflareCountBreakdown[] }) {
  if (!data.length) return <p className="text-gray-500 text-sm">No data</p>
  const total = data.reduce((s, d) => s + d.count, 0)
  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width={140} height={140}>
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="key" innerRadius={40} outerRadius={65} paddingAngle={2}>
            {data.map((d) => (
              <Cell key={d.key} fill={DEVICE_COLORS[d.key] ?? '#9ca3af'} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
            formatter={(v, n) => {
              const num = Number(v)
              return [`${num.toLocaleString()} (${((num / total) * 100).toFixed(1)}%)`, String(n)]
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-1 text-sm">
        {data.map((d) => (
          <div key={d.key} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: DEVICE_COLORS[d.key] ?? '#9ca3af' }} />
            <span className="text-gray-300 capitalize">{d.key}</span>
            <span className="text-gray-500 font-mono text-xs">{d.count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatusCodesBar({ buckets }: { buckets?: CloudflareStatusBuckets }) {
  if (!buckets) return <p className="text-gray-500 text-sm">No data</p>
  const entries = (['2xx', '3xx', '4xx', '5xx', 'other'] as const)
    .map((key) => ({ key, count: buckets[key] }))
    .filter((e) => e.count > 0)
  if (!entries.length) return <p className="text-gray-500 text-sm">No data</p>
  const max = Math.max(...entries.map((e) => e.count), 1)
  return (
    <div className="space-y-1.5">
      {entries.map((e) => (
        <div key={e.key} className="flex items-center gap-2 text-sm">
          <span className="w-10 shrink-0 text-gray-300 font-mono text-xs">{e.key}</span>
          <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(e.count / max) * 100}%`, background: STATUS_COLORS[e.key] }} />
          </div>
          <span className="w-16 shrink-0 text-right text-gray-400 font-mono text-xs">{e.count.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

function ReadyBadge({ ready, title }: { ready: string | null; title?: string }) {
  const style =
    ready === 'True'
      ? 'bg-green-900/40 text-green-300 border-green-700'
      : ready === 'False'
        ? 'bg-red-900/40 text-red-300 border-red-700'
        : 'bg-gray-800 text-gray-400 border-gray-700'
  return (
    <span title={title} className={`text-xs px-2 py-0.5 rounded-full border ${style}`}>
      {ready ?? 'Unknown'}
    </span>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">{title}</p>
      {children}
    </div>
  )
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-gray-400 text-xs font-medium mb-2">{title}</p>
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

function Loading() {
  return <div className="animate-pulse h-16 bg-gray-800/50 rounded-lg" />
}

function NotReachable({ detail }: { detail?: string }) {
  return (
    <div className="text-sm">
      <p className="text-yellow-400">Not reachable from this environment</p>
      {detail && <p className="text-gray-600 text-xs mt-1 font-mono">{detail}</p>}
    </div>
  )
}
