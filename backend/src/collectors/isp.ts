import { getWanHealth, getGateway } from '../lib/unifi.js'
import { pushPoint, getRollingMaxLatency, getUptimePercent24h } from '../history.js'

// Called on a timer by poller.ts — the sole source of ISP polling now (no
// per-request fetching); server.ts just serves the latest cached result.
export async function collectIsp() {
  const [wanResult, gwResult] = await Promise.allSettled([getWanHealth(), getGateway()])
  if (wanResult.status === 'rejected') throw wanResult.reason

  const data = wanResult.value
  const gw = gwResult.status === 'fulfilled' ? gwResult.value : null

  if (data) {
    // Cloud API only provides latencyMaxMs during active high-latency events.
    // Fall back to a rolling 5-min max computed from recent history points.
    const latencyMaxMs = data.latencyMaxMs ?? (await getRollingMaxLatency())
    await pushPoint({
      ts: Date.now(),
      latencyAvg: data.latencyAvgMs,
      latencyMax: latencyMaxMs,
      wanUptime: data.wanUptime,
      packetLoss: data.issues.some((i) => i.packetLoss),
      highLatency: data.issues.some((i) => i.highLatency),
      wanDowntime: data.issues.some((i) => i.wanDowntime),
      wanUp: data.wanUp,
      wanTxBytes: gw?.tx_bytes ?? null,
      wanRxBytes: gw?.rx_bytes ?? null,
      gatewayCpu: gw?.cpu ?? null,
      gatewayMem: gw?.mem ?? null,
    })
    // Own rolling 24h uptime % from actual poll history — the cloud API's
    // wanUptime field has been observed stuck at 0 despite a healthy WAN.
    const uptime = await getUptimePercent24h()
    return { ...data, latencyMaxMs, wanUptimePercent24h: uptime.percent, wanUptimeWindowMs: uptime.windowMs }
  }
  return data
}
