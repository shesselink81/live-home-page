export interface MetricPoint {
  ts: number
  values: Record<string, number | null>
}

const MAX_POINTS = 120 // ~1 hour at 30 s polling interval

// Module-level singletons — persist across requests within the same Node.js
// process, one ring buffer per named series. Only accumulates while
// something is actually polling the owning route (e.g. the Platforms
// Monitor tab being open), same limitation as the topology/ISP history.
const stores = new Map<string, MetricPoint[]>()

export function pushMetric(key: string, values: Record<string, number | null>): void {
  const store = stores.get(key) ?? []
  store.push({ ts: Date.now(), values })
  if (store.length > MAX_POINTS) store.shift()
  stores.set(key, store)
}

export function getMetricHistory(key: string): MetricPoint[] {
  return [...(stores.get(key) ?? [])]
}
