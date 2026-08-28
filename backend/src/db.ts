import mysql from 'mysql2/promise'

export const pool = mysql.createPool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'unifi',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'unifi_metrics',
  waitForConnections: true,
  connectionLimit: 5,
})

async function initSchema(): Promise<void> {
  const maxAttempts = 15
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS metric_points (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          series VARCHAR(191) NOT NULL,
          ts BIGINT NOT NULL,
          data JSON NOT NULL,
          INDEX idx_series_ts (series, ts)
        ) ENGINE=InnoDB
      `)
      console.log('[db] schema ready')
      return
    } catch (e) {
      console.error(`[db] not ready (attempt ${attempt}/${maxAttempts}):`, e instanceof Error ? e.message : e)
      if (attempt === maxAttempts) throw e
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
}

// Top-level await — any module importing this one (directly or transitively)
// waits for the schema to be ready before it finishes evaluating, so the
// server never starts accepting requests/polling before the DB is usable.
await initSchema()
