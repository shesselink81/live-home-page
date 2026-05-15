export interface HistoryPoint {
  ts: number
  latencyAvg: number | null
  latencyMax: number | null
  wanUptime: number
  packetLoss: boolean
  highLatency: boolean
  wanDowntime: boolean
  // gateway device metrics (null when no gateway found)
  wanTxBytes: number | null
  wanRxBytes: number | null
  gatewayCpu: number | null
  gatewayMem: number | null
}

const MAX_POINTS = 720 // ~2 hours at 10 s polling interval

// Module-level singleton — persists across requests within the same Node.js process.
const store: HistoryPoint[] = []

export function pushPoint(point: HistoryPoint): void {
  store.push(point)
  if (store.length > MAX_POINTS) store.shift()
}

export function getHistory(): HistoryPoint[] {
  return [...store]
}

export function getRollingMaxLatency(windowMs = 5 * 60 * 1000): number | null {
  const cutoff = Date.now() - windowMs
  const vals = store
    .filter((p) => p.ts >= cutoff && p.latencyAvg !== null)
    .map((p) => p.latencyAvg as number)
  return vals.length > 0 ? Math.max(...vals) : null
}
