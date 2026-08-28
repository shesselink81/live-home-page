import {
  getDockerInfo,
  getDockerContainers,
  getDockerHostUsage,
  type DockerInfo,
  type DockerContainer,
} from '../lib/docker.js'
import { pushMetric, getMetricHistory, type MetricPoint } from '../metricsHistory.js'

export type { DockerInfo, DockerContainer }

async function tryCall<T>(fn: () => Promise<T>): Promise<{ data: T | null; error?: string }> {
  try {
    return { data: await fn() }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : String(e) }
  }
}

// Called on a timer by poller.ts — the sole source of Docker polling now (no
// per-request fetching); server.ts just serves the latest cached result.
export async function collectDocker() {
  const [infoResult, containersResult] = await Promise.all([
    tryCall(() => getDockerInfo()),
    tryCall(() => getDockerContainers()),
  ])

  if (!infoResult.data && !containersResult.data) {
    return { ok: false as const, error: infoResult.error ?? containersResult.error ?? 'Docker host unreachable' }
  }

  if (infoResult.data && containersResult.data) {
    const runningIds = containersResult.data.filter((c) => c.state === 'running').map((c) => c.id)
    const usage = await tryCall(() => getDockerHostUsage(runningIds, infoResult.data as DockerInfo))
    if (usage.data) {
      await pushMetric('docker-host', { cpu: usage.data.cpuPct, mem: usage.data.memPct })
    }
  }
  const hostMetricsHistory: MetricPoint[] = await getMetricHistory('docker-host')

  return {
    ok: true as const,
    info: infoResult.data,
    infoError: infoResult.error,
    containers: containersResult.data,
    containersError: containersResult.error,
    hostMetricsHistory,
  }
}
