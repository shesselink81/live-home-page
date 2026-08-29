import { pool } from './db.js'
import type { RowDataPacket } from 'mysql2'

export interface HistoryPoint {
  ts: number
  latencyAvg: number | null
  latencyMax: number | null
  wanUptime: number
  packetLoss: boolean
  highLatency: boolean
  wanDowntime: boolean
  // Best-effort per-poll up/down signal (see WanHealth.wanUp) — used to
  // compute a rolling uptime % independent of the cloud API's uptime field.
  wanUp: boolean
  // gateway device metrics (null when no gateway found)
  wanTxBytes: number | null
  wanRxBytes: number | null
  gatewayCpu: number | null
  gatewayMem: number | null
}

// Retention covers slightly over 24h so a rolling 24h uptime % always has a
// full window once the app has been running that long. Chart endpoints
// (IspCharts/GatewayCharts) still only ever see the most recent CHART_POINTS
// — expanding retention here doesn't change what they display.
const POLL_INTERVAL_MS = 10_000
const RETENTION_POINTS = Math.ceil((25 * 60 * 60 * 1000) / POLL_INTERVAL_MS) // ~25h
const CHART_POINTS = 720 // ~2 hours at 10 s polling interval
const UPTIME_WINDOW_MS = 24 * 60 * 60 * 1000
// Trailing window each chart point's rolling uptime % is computed over —
// smooths individual poll noise into a readable trend line. Can look back
// before the chart's own start since retention covers ~25h.
const ROLLING_UPTIME_WINDOW_MS = 15 * 60 * 1000
const SERIES = 'isp-wan'

// In-memory cache for fast reads, lazily hydrated from MySQL on first
// access so history survives a restart/redeploy.
let store: HistoryPoint[] | null = null

interface HistoryRow extends RowDataPacket {
  data: string | HistoryPoint
}

function parseData(data: string | HistoryPoint): HistoryPoint {
  return typeof data === 'string' ? JSON.parse(data) : data
}

async function loadStore(): Promise<HistoryPoint[]> {
  const [rows] = await pool.query<HistoryRow[]>(
    'SELECT data FROM metric_points WHERE series = ? ORDER BY ts DESC LIMIT ?',
    [SERIES, RETENTION_POINTS]
  )
  store = rows.reverse().map((r) => parseData(r.data))
  return store
}

export async function pushPoint(point: HistoryPoint): Promise<void> {
  const s = store ?? (await loadStore())
  s.push(point)
  if (s.length > RETENTION_POINTS) s.shift()
  store = s

  await pool.execute('INSERT INTO metric_points (series, ts, data) VALUES (?, ?, ?)', [
    SERIES,
    point.ts,
    JSON.stringify(point),
  ])
  await pool.query(
    `DELETE FROM metric_points
     WHERE series = ? AND id NOT IN (
       SELECT id FROM (
         SELECT id FROM metric_points WHERE series = ? ORDER BY ts DESC LIMIT ?
       ) AS keep
     )`,
    [SERIES, SERIES, RETENTION_POINTS]
  )
}

export interface ChartPoint extends HistoryPoint {
  // Rolling uptime % over the trailing ROLLING_UPTIME_WINDOW_MS ending at
  // this point, computed from wanUp flags (see WanHealth.wanUp) — replaces
  // the legacy wanUptime field for charting, since the cloud API's
  // wanUptime has been observed stuck at 0 despite a healthy WAN.
  wanUpPct: number | null
}

// Recent-window history for charts (IspCharts/GatewayCharts) — unchanged
// ~2h behavior even though retention now covers ~25h for the uptime % calc.
export async function getHistory(): Promise<ChartPoint[]> {
  const s = store ?? (await loadStore())
  const chartPoints = s.slice(-CHART_POINTS)

  return chartPoints.map((p) => {
    const cutoff = p.ts - ROLLING_UPTIME_WINDOW_MS
    const windowPoints = s.filter((q) => q.ts > cutoff && q.ts <= p.ts)
    const wanUpPct = windowPoints.length > 0
      ? (windowPoints.filter((q) => q.wanUp).length / windowPoints.length) * 100
      : null
    return { ...p, wanUpPct }
  })
}

export async function getRollingMaxLatency(windowMs = 5 * 60 * 1000): Promise<number | null> {
  const s = store ?? (await loadStore())
  const cutoff = Date.now() - windowMs
  const vals = s
    .filter((p) => p.ts >= cutoff && p.latencyAvg !== null)
    .map((p) => p.latencyAvg as number)
  return vals.length > 0 ? Math.max(...vals) : null
}

export interface UptimeStats {
  percent: number | null
  windowMs: number
}

export async function getUptimePercent24h(): Promise<UptimeStats> {
  const s = store ?? (await loadStore())
  const cutoff = Date.now() - UPTIME_WINDOW_MS
  const windowPoints = s.filter((p) => p.ts >= cutoff)
  if (windowPoints.length === 0) return { percent: null, windowMs: 0 }

  const upCount = windowPoints.filter((p) => p.wanUp).length
  const percent = (upCount / windowPoints.length) * 100
  const windowMs = windowPoints[windowPoints.length - 1].ts - windowPoints[0].ts
  return { percent, windowMs }
}
