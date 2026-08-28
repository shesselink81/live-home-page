import { collectIsp } from './collectors/isp.js'
import { collectKubernetes } from './collectors/kubernetes.js'
import { collectHomeAssistant } from './collectors/homeassistant.js'
import { collectDocker } from './collectors/docker.js'

// Same cadence the dashboard itself used to poll at (see REFRESH in
// Dashboard.tsx / CloudAppsTab.tsx). This is now the ONLY thing that ever
// calls the collectors — HTTP handlers in server.ts just read the latest
// cached snapshot below, decoupling "how often we hit upstream" from
// "how often a browser tab asks for data".
const ISP_INTERVAL_MS = 10_000
const CLOUD_INTERVAL_MS = 30_000

let latestIsp: Awaited<ReturnType<typeof collectIsp>> | null = null
let latestKubernetes: Awaited<ReturnType<typeof collectKubernetes>> | null = null
let latestHomeAssistant: Awaited<ReturnType<typeof collectHomeAssistant>> | null = null
let latestDocker: Awaited<ReturnType<typeof collectDocker>> | null = null

export function getLatestIsp() {
  return latestIsp
}
export function getLatestKubernetes() {
  return latestKubernetes
}
export function getLatestHomeAssistant() {
  return latestHomeAssistant
}
export function getLatestDocker() {
  return latestDocker
}

function loop(name: string, intervalMs: number, run: () => Promise<void>): void {
  const tick = async () => {
    try {
      await run()
    } catch (e) {
      console.error(`[poller] ${name} failed:`, e instanceof Error ? e.message : e)
    } finally {
      setTimeout(tick, intervalMs)
    }
  }
  // Fire immediately on startup instead of waiting a full interval, so the
  // first request right after boot isn't stuck on a "warming up" state.
  tick()
}

let started = false

export function startPolling(): void {
  if (started) return
  started = true

  loop('isp', ISP_INTERVAL_MS, async () => {
    latestIsp = await collectIsp()
  })
  loop('kubernetes', CLOUD_INTERVAL_MS, async () => {
    latestKubernetes = await collectKubernetes()
  })
  loop('homeassistant', CLOUD_INTERVAL_MS, async () => {
    latestHomeAssistant = await collectHomeAssistant()
  })
  loop('docker', CLOUD_INTERVAL_MS, async () => {
    latestDocker = await collectDocker()
  })

  console.log('[poller] started (isp 10s, kubernetes/homeassistant/docker 30s)')
}
