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
  // gateway device metrics (null when no gateway found)
  wanTxBytes: number | null
  wanRxBytes: number | null
  gatewayCpu: number | null
  gatewayMem: number | null
}

const MAX_POINTS = 720 // ~2 hours at 10 s polling interval
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
    [SERIES, MAX_POINTS]
  )
  store = rows.reverse().map((r) => parseData(r.data))
  return store
}

export async function pushPoint(point: HistoryPoint): Promise<void> {
  const s = store ?? (await loadStore())
  s.push(point)
  if (s.length > MAX_POINTS) s.shift()
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
    [SERIES, SERIES, MAX_POINTS]
  )
}

export async function getHistory(): Promise<HistoryPoint[]> {
  return [...(store ?? (await loadStore()))]
}

export async function getRollingMaxLatency(windowMs = 5 * 60 * 1000): Promise<number | null> {
  const s = store ?? (await loadStore())
  const cutoff = Date.now() - windowMs
  const vals = s
    .filter((p) => p.ts >= cutoff && p.latencyAvg !== null)
    .map((p) => p.latencyAvg as number)
  return vals.length > 0 ? Math.max(...vals) : null
}
