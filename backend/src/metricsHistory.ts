import { pool } from './db.js'
import type { RowDataPacket } from 'mysql2'

export interface MetricPoint {
  ts: number
  values: Record<string, number | null>
}

const MAX_POINTS = 120 // ~1 hour at 30 s polling interval

// In-memory per-series cache for fast reads, lazily hydrated from MySQL on
// first access per series so history survives a restart/redeploy.
const stores = new Map<string, MetricPoint[]>()

interface MetricRow extends RowDataPacket {
  ts: number
  data: string | Record<string, number | null>
}

function parseData(data: string | Record<string, number | null>): Record<string, number | null> {
  return typeof data === 'string' ? JSON.parse(data) : data
}

async function loadStore(key: string): Promise<MetricPoint[]> {
  // .query() (not .execute()) — binding LIMIT as a prepared-statement param
  // throws "Incorrect arguments to mysqld_stmt_execute" on some MySQL
  // versions; .query() does safe client-side substitution instead.
  const [rows] = await pool.query<MetricRow[]>(
    'SELECT ts, data FROM metric_points WHERE series = ? ORDER BY ts DESC LIMIT ?',
    [key, MAX_POINTS]
  )
  const points = rows.reverse().map((r) => ({ ts: Number(r.ts), values: parseData(r.data) }))
  stores.set(key, points)
  return points
}

export async function pushMetric(key: string, values: Record<string, number | null>): Promise<void> {
  const store = stores.get(key) ?? (await loadStore(key))
  const point: MetricPoint = { ts: Date.now(), values }
  store.push(point)
  if (store.length > MAX_POINTS) store.shift()
  stores.set(key, store)

  await pool.execute('INSERT INTO metric_points (series, ts, data) VALUES (?, ?, ?)', [
    key,
    point.ts,
    JSON.stringify(values),
  ])
  // MySQL/MariaDB disallow selecting from the table you're deleting from
  // directly — wrapping the keep-list in a derived table works around that.
  await pool.query(
    `DELETE FROM metric_points
     WHERE series = ? AND id NOT IN (
       SELECT id FROM (
         SELECT id FROM metric_points WHERE series = ? ORDER BY ts DESC LIMIT ?
       ) AS keep
     )`,
    [key, key, MAX_POINTS]
  )
}

export async function getMetricHistory(key: string): Promise<MetricPoint[]> {
  return [...(stores.get(key) ?? (await loadStore(key)))]
}
