import express from 'express'
import { getHistory } from './history.js'
import {
  getLatestIsp,
  getLatestKubernetes,
  getLatestHomeAssistant,
  getLatestDocker,
  getLatestCloudflare,
  startPolling,
  METRICS_ENABLED,
} from './poller.js'

const PORT = Number(process.env.PORT ?? 4100)

const app = express()

app.get('/healthz', (_req, res) => {
  res.json({ ok: true })
})

app.get('/isp', (_req, res) => {
  res.json(getLatestIsp())
})

app.get('/isp/history', async (_req, res) => {
  res.json(await getHistory())
})

app.get('/cloud/kubernetes', (_req, res) => {
  res.json(getLatestKubernetes() ?? { ok: false, error: 'Warming up — waiting for first poll' })
})

app.get('/cloud/homeassistant', (_req, res) => {
  res.json(getLatestHomeAssistant() ?? { ok: false, error: 'Warming up — waiting for first poll' })
})

app.get('/cloud/docker', (_req, res) => {
  res.json(getLatestDocker() ?? { ok: false, error: 'Warming up — waiting for first poll' })
})

app.get('/cloud/cloudflare', (_req, res) => {
  res.json(getLatestCloudflare() ?? { ok: false, error: 'Warming up — waiting for first poll' })
})

// Prometheus exporter — only registered when METRICS_ENABLED=true (404
// otherwise). metrics.ts is imported lazily so its metric definitions and
// default process collectors don't exist at all when the exporter is off.
if (METRICS_ENABLED) {
  const { registry } = await import('./metrics.js')
  app.get('/metrics', async (_req, res) => {
    try {
      res.set('Content-Type', registry.contentType)
      res.send(await registry.metrics())
    } catch (e) {
      res.status(500).send(e instanceof Error ? e.message : String(e))
    }
  })
}

startPolling()

app.listen(PORT, () => {
  console.log(`[backend] listening on :${PORT}`)
})
