'use client'

import useSWR from 'swr'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import type { K8sNode, K8sPod, FluxSource, FluxHelmRelease } from '@/app/api/cloud/kubernetes/route'
import type { HaIntegrations, HaApps, HaSystem, HaBackups, HaHacs } from '@/app/api/cloud/homeassistant/route'
import type { MetricPoint } from '@/lib/metricsHistory'

const REFRESH = 30_000

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
    return r.json()
  })

const CHART_COLORS = ['#f97316', '#60a5fa', '#34d399', '#a78bfa', '#f472b6', '#facc15']

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

export default function CloudAppsTab() {
  const { data: k8s } = useSWR<KubernetesData>('/api/cloud/kubernetes', fetcher, { refreshInterval: REFRESH })
  const { data: ha } = useSWR<HomeAssistantData>('/api/cloud/homeassistant', fetcher, { refreshInterval: REFRESH })

  return (
    <div className="space-y-6">
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
