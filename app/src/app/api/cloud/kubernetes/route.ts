import { NextResponse } from 'next/server'
import { callMcpTool, toolText, toolItems, parseTable, type McpToolResult } from '@/lib/mcp'
import { pushMetric, getMetricHistory, type MetricPoint } from '@/lib/metricsHistory'

const URL_ = process.env.MCP_KUBERNETES_URL ?? 'http://localhost:8087/mcp'

export interface K8sNode {
  name: string
  cpuCores: string
  cpuPct: string
  memBytes: string
  memPct: string
}

export interface K8sPod {
  namespace: string
  name: string
  status: string
  restarts: string
  age: string
  node: string
}

export interface FluxSource {
  kind: string
  name: string
  namespace: string
  ready: string | null
  status: string | null
  age: string
  url: string
}

export interface FluxHelmRelease {
  name: string
  namespace: string
  ready: string | null
  status: string | null
  chart: string | null
  age: string
}

interface FluxItem {
  Name?: string
  Namespace?: string
  Ready?: string | null
  Status?: string | null
  Age?: string
  URL?: string
}

function mapSources(items: FluxItem[], kind: string): FluxSource[] {
  return items.map((i) => ({
    kind,
    name: i.Name ?? '',
    namespace: i.Namespace ?? '',
    ready: i.Ready ?? null,
    status: i.Status ?? null,
    age: i.Age ?? '',
    url: i.URL ?? '',
  }))
}

function mapReleases(items: FluxItem[]): FluxHelmRelease[] {
  return items.map((i) => {
    const status = i.Status ?? null
    const chartMatch = status?.match(/chart\s+(\S+)\s*$/)
    return {
      name: i.Name ?? '',
      namespace: i.Namespace ?? '',
      ready: i.Ready ?? null,
      status,
      chart: chartMatch?.[1] ?? null,
      age: i.Age ?? '',
    }
  })
}

export async function GET() {
  let nodes: K8sNode[]
  try {
    const nodesResult = await callMcpTool<McpToolResult>(URL_, 'nodes_top', {})
    nodes = parseTable(toolText(nodesResult)).map((r) => ({
      name: r['NAME'] ?? '',
      cpuCores: r['CPU(cores)'] ?? '',
      cpuPct: r['CPU(%)'] ?? '',
      memBytes: r['MEMORY(bytes)'] ?? '',
      memPct: r['MEMORY(%)'] ?? '',
    }))
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Kubernetes MCP server unreachable' })
  }

  const metricValues: Record<string, number | null> = {}
  for (const n of nodes) {
    const cpu = Number(n.cpuPct.replace('%', ''))
    const mem = Number(n.memPct.replace('%', ''))
    metricValues[`${n.name}_cpu`] = Number.isFinite(cpu) ? cpu : null
    metricValues[`${n.name}_mem`] = Number.isFinite(mem) ? mem : null
  }
  pushMetric('k8s-nodes', metricValues)
  const nodesHistory: MetricPoint[] = getMetricHistory('k8s-nodes')
  const nodeNames = nodes.map((n) => n.name)

  const [podsSettled, gitSettled, helmRepoSettled, helmReleaseSettled] = await Promise.allSettled([
    callMcpTool<McpToolResult>(URL_, 'pods_list', {
      fieldSelector: 'status.phase!=Running,status.phase!=Succeeded',
    }),
    callMcpTool<McpToolResult>(URL_, 'resources_list', {
      apiVersion: 'source.toolkit.fluxcd.io/v1',
      kind: 'GitRepository',
    }),
    callMcpTool<McpToolResult>(URL_, 'resources_list', {
      apiVersion: 'source.toolkit.fluxcd.io/v1',
      kind: 'HelmRepository',
    }),
    callMcpTool<McpToolResult>(URL_, 'resources_list', {
      apiVersion: 'helm.toolkit.fluxcd.io/v2',
      kind: 'HelmRelease',
    }),
  ])

  const unhealthyPods: K8sPod[] =
    podsSettled.status === 'fulfilled'
      ? parseTable(toolText(podsSettled.value)).map((r) => ({
          namespace: r['NAMESPACE'] ?? '',
          name: r['NAME'] ?? '',
          status: r['STATUS'] ?? '',
          restarts: r['RESTARTS'] ?? '',
          age: r['AGE'] ?? '',
          node: r['NODE'] ?? '',
        }))
      : []

  const fluxSources: FluxSource[] = [
    ...(gitSettled.status === 'fulfilled' ? mapSources(toolItems<FluxItem>(gitSettled.value), 'GitRepository') : []),
    ...(helmRepoSettled.status === 'fulfilled'
      ? mapSources(toolItems<FluxItem>(helmRepoSettled.value), 'HelmRepository')
      : []),
  ]
  const fluxSourcesError =
    gitSettled.status === 'rejected' && helmRepoSettled.status === 'rejected'
      ? 'Flux sources not available (Flux may not be installed on this cluster)'
      : undefined

  const fluxHelmReleases: FluxHelmRelease[] =
    helmReleaseSettled.status === 'fulfilled' ? mapReleases(toolItems<FluxItem>(helmReleaseSettled.value)) : []
  const fluxHelmReleasesError =
    helmReleaseSettled.status === 'rejected'
      ? 'Flux Helm releases not available (Flux may not be installed on this cluster)'
      : undefined

  return NextResponse.json({
    ok: true,
    nodes,
    nodesHistory,
    nodeNames,
    unhealthyPods,
    fluxSources,
    fluxSourcesError,
    fluxHelmReleases,
    fluxHelmReleasesError,
  })
}
