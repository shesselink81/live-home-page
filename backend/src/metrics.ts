import { Counter, Gauge, Registry, collectDefaultMetrics } from 'prom-client'
import { getLatestIsp, getLatestUnifiMetrics, getPollStatus } from './poller.js'
import type { Device } from './lib/unifi.js'

// Prometheus exporter for UniFi metrics, served on GET /metrics (server.ts)
// when METRICS_ENABLED=true. Every metric is rebuilt from the poller's latest
// cached snapshot in its collect() hook, so a scrape never calls UniFi and a
// device/client that disappears also disappears from the output (reset()).
//
// Byte counters come from UniFi as absolute, ever-increasing totals, so they
// are exposed as Counters (reset + inc to the absolute value) — rate() then
// works as usual and handles device reboots as counter resets.

const PER_CLIENT = !/^(0|false|no)$/i.test(process.env.METRICS_PER_CLIENT ?? 'true')

export const registry = new Registry()
collectDefaultMetrics({ register: registry, prefix: 'unifi_exporter_' })

const devLabels = ['mac', 'name', 'type', 'model'] as const
const clientLabels = ['mac', 'name', 'network', 'connection'] as const

function devLabelValues(d: Device) {
  return { mac: d.mac, name: d.name || d.mac, type: d.type ?? '', model: d.model ?? '' }
}
const ok = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v)
const bool = (b: boolean) => (b ? 1 : 0)

// ---------- WAN / ISP (from the existing 10s ISP poll) ----------
// All WAN metrics carry a `wan` label (currently always "WAN" — the
// collector only reads the primary WAN). Besides being future-proof for
// multi-WAN, it matters for correctness: prom-client renders an unlabelled
// gauge as 0 after reset(), which before the first poll would read as
// "WAN down" and fire alerts. A labelled gauge renders nothing instead.
const WAN = { wan: 'WAN' }

new Gauge({
  name: 'unifi_wan_up',
  help: 'WAN status from the local controller (1 = up, 0 = down)',
  labelNames: ['wan'],
  registers: [registry],
  collect() {
    this.reset()
    const isp = getLatestIsp()
    if (isp) this.set(WAN, bool(isp.wanUp))
  },
})

new Gauge({
  name: 'unifi_wan_latency_ms',
  help: 'Current WAN latency in milliseconds (average)',
  labelNames: ['wan'],
  registers: [registry],
  collect() {
    this.reset()
    const v = getLatestIsp()?.latencyAvgMs
    if (ok(v)) this.set(WAN, v)
  },
})

new Gauge({
  name: 'unifi_wan_latency_max_ms',
  help: 'WAN latency max in milliseconds (cloud high-latency event, or rolling 5-min max)',
  labelNames: ['wan'],
  registers: [registry],
  collect() {
    this.reset()
    const v = getLatestIsp()?.latencyMaxMs
    if (ok(v)) this.set(WAN, v)
  },
})

new Gauge({
  name: 'unifi_wan_uptime_seconds',
  help: 'Continuous WAN uptime in seconds as reported by the local controller',
  labelNames: ['wan'],
  registers: [registry],
  collect() {
    this.reset()
    const v = getLatestIsp()?.wanUptimeSeconds
    if (ok(v)) this.set(WAN, v)
  },
})

new Gauge({
  name: 'unifi_wan_uptime_ratio_24h',
  help: 'WAN uptime over the last 24h (0-1), computed from the backend poll history',
  labelNames: ['wan'],
  registers: [registry],
  collect() {
    this.reset()
    const v = getLatestIsp()?.wanUptimePercent24h
    if (ok(v)) this.set(WAN, v / 100)
  },
})

new Gauge({
  name: 'unifi_wan_issue',
  help: 'Active internet issue reported by the UniFi cloud API (1 = active)',
  labelNames: ['wan', 'type'],
  registers: [registry],
  collect() {
    this.reset()
    const isp = getLatestIsp()
    if (!isp) return
    this.set({ ...WAN, type: 'packet_loss' }, bool(isp.issues.some((i) => i.packetLoss)))
    this.set({ ...WAN, type: 'high_latency' }, bool(isp.issues.some((i) => i.highLatency)))
    this.set({ ...WAN, type: 'downtime' }, bool(isp.issues.some((i) => i.wanDowntime)))
  },
})

new Gauge({
  name: 'unifi_isp_info',
  help: 'ISP information (always 1)',
  labelNames: ['isp', 'organization', 'asn', 'external_ip'],
  registers: [registry],
  collect() {
    this.reset()
    const isp = getLatestIsp()
    if (!isp) return
    this.set(
      { isp: isp.isp.name, organization: isp.isp.organization, asn: String(isp.isp.asn), external_ip: isp.externalIp },
      1
    )
  },
})

// ---------- Devices ----------

function deviceGauge(name: string, help: string, pick: (d: Device) => number | null | undefined) {
  return new Gauge({
    name,
    help,
    labelNames: devLabels,
    registers: [registry],
    collect() {
      this.reset()
      for (const d of getLatestUnifiMetrics()?.devices ?? []) {
        const v = pick(d)
        if (ok(v)) this.set(devLabelValues(d), v)
      }
    },
  })
}

function deviceCounter(name: string, help: string, pick: (d: Device) => number | null | undefined) {
  return new Counter({
    name,
    help,
    labelNames: devLabels,
    registers: [registry],
    collect() {
      this.reset()
      for (const d of getLatestUnifiMetrics()?.devices ?? []) {
        const v = pick(d)
        if (ok(v) && v >= 0) this.inc(devLabelValues(d), v)
      }
    },
  })
}

new Gauge({
  name: 'unifi_device_info',
  help: 'UniFi device information (always 1)',
  labelNames: [...devLabels, 'version', 'ip'],
  registers: [registry],
  collect() {
    this.reset()
    for (const d of getLatestUnifiMetrics()?.devices ?? []) {
      this.set({ ...devLabelValues(d), version: d.version ?? '', ip: d.ip ?? '' }, 1)
    }
  },
})

deviceGauge('unifi_device_up', 'Device connected to the controller (1 = state connected)', (d) => bool(d.state === 1))
deviceGauge('unifi_device_state', 'Raw UniFi device state code (1 = connected, 0 = disconnected, 4/5 = upgrading/provisioning, ...)', (d) => d.state)
deviceGauge('unifi_device_uptime_seconds', 'Device uptime in seconds', (d) => d.uptime)
deviceGauge('unifi_device_cpu_ratio', 'Device CPU utilisation (0-1)', (d) => (ok(d.cpu) ? d.cpu / 100 : null))
deviceGauge('unifi_device_mem_ratio', 'Device memory utilisation (0-1)', (d) => (ok(d.mem) ? d.mem / 100 : null))
deviceGauge('unifi_device_load1', 'Device 1-minute load average', (d) => d.loadAvg1)
deviceGauge('unifi_device_temperature_celsius', 'Hottest device temperature sensor in °C', (d) => d.temperatureC)
deviceGauge('unifi_device_clients', 'Clients connected to/through this device', (d) => d.numClients)
deviceCounter('unifi_device_transmit_bytes_total', 'Bytes transmitted by the device (gateway: WAN upload)', (d) => d.tx_bytes)
deviceCounter('unifi_device_receive_bytes_total', 'Bytes received by the device (gateway: WAN download)', (d) => d.rx_bytes)

// ---------- Clients ----------

new Gauge({
  name: 'unifi_clients',
  help: 'Active clients by connection type and network',
  labelNames: ['connection', 'network'],
  registers: [registry],
  collect() {
    this.reset()
    const snap = getLatestUnifiMetrics()
    if (!snap) return
    const counts = new Map<string, number>()
    for (const c of snap.clients) {
      const key = `${c.isWired ? 'wired' : 'wireless'}\u0000${c.network ?? ''}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    for (const [key, n] of counts) {
      const [connection, network] = key.split('\u0000')
      this.set({ connection, network }, n)
    }
  },
})

if (PER_CLIENT) {
  type C = NonNullable<ReturnType<typeof getLatestUnifiMetrics>>['clients'][number]
  const clientLabelValues = (c: C) => ({
    mac: c.mac,
    name: c.name || c.hostname || c.mac,
    network: c.network ?? '',
    connection: c.isWired ? 'wired' : 'wireless',
  })
  const clientGauge = (name: string, help: string, pick: (c: C) => number | null) =>
    new Gauge({
      name,
      help,
      labelNames: clientLabels,
      registers: [registry],
      collect() {
        this.reset()
        for (const c of getLatestUnifiMetrics()?.clients ?? []) {
          const v = pick(c)
          if (ok(v)) this.set(clientLabelValues(c), v)
        }
      },
    })
  const clientCounter = (name: string, help: string, pick: (c: C) => number | null) =>
    new Counter({
      name,
      help,
      labelNames: clientLabels,
      registers: [registry],
      collect() {
        this.reset()
        for (const c of getLatestUnifiMetrics()?.clients ?? []) {
          const v = pick(c)
          if (ok(v) && v >= 0) this.inc(clientLabelValues(c), v)
        }
      },
    })

  new Gauge({
    name: 'unifi_client_info',
    help: 'Client information incl. the AP/switch it is attached to (always 1)',
    labelNames: [...clientLabels, 'ip', 'essid', 'uplink', 'guest'],
    registers: [registry],
    collect() {
      this.reset()
      const snap = getLatestUnifiMetrics()
      if (!snap) return
      const deviceName = new Map(snap.devices.map((d) => [d.mac, d.name || d.mac]))
      for (const c of snap.clients) {
        const uplinkMac = c.apMac ?? c.swMac
        this.set(
          {
            ...clientLabelValues(c),
            ip: c.ip,
            essid: c.essid ?? '',
            uplink: uplinkMac ? (deviceName.get(uplinkMac) ?? uplinkMac) : '',
            guest: String(c.isGuest),
          },
          1
        )
      }
    },
  })
  clientGauge('unifi_client_signal_dbm', 'Wireless client signal strength in dBm', (c) => (c.isWired ? null : c.signal))
  clientGauge('unifi_client_uptime_seconds', 'Client connection uptime in seconds', (c) => c.uptime)
  // Note: from the client's perspective — tx = uploaded by the client.
  clientCounter('unifi_client_transmit_bytes_total', 'Bytes sent by the client', (c) => c.txBytes)
  clientCounter('unifi_client_receive_bytes_total', 'Bytes received by the client', (c) => c.rxBytes)
}

// ---------- Exporter / poller health ----------

new Gauge({
  name: 'unifi_exporter_poll_success',
  // Note: a source counts as failed only when its collector throws — the
  // Platforms collectors (kubernetes/homeassistant/docker/cloudflare) report
  // unreachable upstreams as { ok: false } data rather than throwing.
  help: 'Whether the last backend poll for this source succeeded (1/0)',
  labelNames: ['source'],
  registers: [registry],
  collect() {
    this.reset()
    for (const [source, s] of getPollStatus()) this.set({ source }, bool(s.success))
  },
})

new Gauge({
  name: 'unifi_exporter_poll_duration_seconds',
  help: 'Duration of the last backend poll for this source',
  labelNames: ['source'],
  registers: [registry],
  collect() {
    this.reset()
    for (const [source, s] of getPollStatus()) this.set({ source }, s.durationMs / 1000)
  },
})

new Gauge({
  name: 'unifi_exporter_last_success_timestamp_seconds',
  help: 'Unix time of the last successful backend poll for this source',
  labelNames: ['source'],
  registers: [registry],
  collect() {
    this.reset()
    for (const [source, s] of getPollStatus()) {
      if (s.lastSuccessTs != null) this.set({ source }, s.lastSuccessTs / 1000)
    }
  },
})
