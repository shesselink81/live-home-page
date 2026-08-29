import fs from 'node:fs'
import https from 'node:https'

const LOCAL_BASE = process.env.UNIFI_LOCAL_URL ?? 'https://192.168.178.1/proxy/network'
const LOCAL_KEY = process.env.UNIFI_LOCAL_API_KEY ?? ''
const CLOUD_BASE = process.env.UNIFI_CLOUD_URL ?? 'https://api.ui.com'
const CLOUD_KEY = process.env.UNIFI_CLOUD_API_KEY ?? ''

// Set UNIFI_LOCAL_CA to the path of your controller's CA cert (PEM) for proper TLS verification.
// Without it, verification is disabled — acceptable on a private LAN but not ideal.
const localCa = process.env.UNIFI_LOCAL_CA ? fs.readFileSync(process.env.UNIFI_LOCAL_CA) : undefined
const localAgent = new https.Agent(localCa ? { ca: localCa } : { rejectUnauthorized: false })

function localRequest(path: string): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${LOCAL_BASE}${path}`)
    const req = https.request(
      { hostname: url.hostname, port: url.port || 443, path: url.pathname, method: 'GET',
        headers: { 'X-API-KEY': LOCAL_KEY }, agent: localAgent },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`UniFi local ${path} → ${res.statusCode}`))
          res.resume()
          return
        }
        let raw = ''
        res.on('data', (chunk: string) => { raw += chunk })
        res.on('end', () => {
          try {
            resolve((JSON.parse(raw) as { data: unknown[] }).data)
          } catch (e) { reject(e) }
        })
      }
    )
    req.on('error', reject)
    req.end()
  })
}

async function localGet(path: string) {
  return localRequest(path)
}

async function cloudGet(path: string) {
  const res = await fetch(`${CLOUD_BASE}${path}`, {
    headers: { 'X-API-KEY': CLOUD_KEY, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`UniFi cloud ${path} → ${res.status}`)
  return res.json()
}

export interface Device {
  mac: string
  name: string
  model: string
  type: 'udm' | 'usw' | 'uap' | string
  ip: string
  state: number
  version: string
  uptime: number
  tx_bytes: number
  rx_bytes: number
  bytes: number
  cpu: number | null
  mem: number | null
  uplinkMac: string | null
  uplinkPortIdx: number | null
  switchDepth: number
}

export interface IspInfo {
  asn: number
  name: string
  organization: string
}

export interface WanHealth {
  isp: IspInfo
  externalIp: string
  wanUptime: number
  // Continuous-uptime seconds from the local controller (stat/health "www"
  // subsystem) — the cloud API's wanUptime percentage has been observed
  // stuck at 0 despite a healthy WAN, so this is used as a fallback display.
  wanUptimeSeconds: number | null
  // Best-effort up/down signal for this single poll — prefers the local
  // controller's own subsystem status (more reliable than the cloud API's
  // uptime%/issue detection); falls back to the cloud's wanDowntime flag
  // only when local health couldn't be reached this poll.
  wanUp: boolean
  // Rolling uptime % computed from our own poll history (see history.ts) —
  // getWanHealth() can't compute this itself (no history access), so it's
  // always overridden by the ISP collector after calling this function.
  wanUptimePercent24h: number | null
  wanUptimeWindowMs: number
  latencyAvgMs: number | null
  latencyMaxMs: number | null
  txRetryPct: number | null
  issues: Array<{ highLatency?: boolean; packetLoss?: boolean; wanDowntime?: boolean }>
}

function mapDevice(r: Record<string, unknown>): Device {
  const sys = r['system-stats'] as { cpu?: string; mem?: string } | undefined
  const uplink = r.uplink as { uplink_mac?: string; port_idx?: number } | undefined
  return {
    mac: r.mac as string,
    name: r.name as string,
    model: r.model as string,
    type: r.type as string,
    ip: r.ip as string,
    state: r.state as number,
    version: r.version as string,
    uptime: r.uptime as number,
    tx_bytes: r.tx_bytes as number,
    rx_bytes: r.rx_bytes as number,
    bytes: r.bytes as number,
    cpu: sys?.cpu != null ? parseFloat(sys.cpu) : null,
    mem: sys?.mem != null ? parseFloat(sys.mem) : null,
    uplinkMac: uplink?.uplink_mac ?? (r.uplink_mac as string | undefined) ?? null,
    uplinkPortIdx: uplink?.port_idx ?? null,
    switchDepth: (r.switch_depth as number | undefined) ?? 0,
  }
}

const GATEWAY_TYPES = new Set(['udm', 'ugw', 'uxg'])

export async function getDevices(): Promise<Device[]> {
  const raw = await localGet('/api/s/default/stat/device') as Record<string, unknown>[]
  return raw.map(mapDevice)
}

export async function getGateway(): Promise<Device | null> {
  const devices = await getDevices()
  return devices.find((d) => GATEWAY_TYPES.has(d.type)) ?? null
}

interface LocalHealthEntry {
  subsystem: string
  status?: string
  latency?: number
  uptime?: number
}

export async function getWanHealth(): Promise<WanHealth | null> {
  const [cloudBody, localHealth] = await Promise.allSettled([
    cloudGet('/v1/sites'),
    localGet('/api/s/default/stat/health'),
  ])

  if (cloudBody.status === 'rejected') throw cloudBody.reason

  const sites: Record<string, unknown>[] = (cloudBody.value as { data?: [] }).data ?? []
  const site = sites[0] as {
    statistics?: {
      ispInfo?: IspInfo
      percentages?: { wanUptime?: number; txRetry?: number }
      internetIssues?: Array<{ highLatency?: boolean; packetLoss?: boolean; wanDowntime?: boolean; latencyAvgMs?: number; latencyMaxMs?: number }>
      wans?: { WAN?: { externalIp?: string } }
    }
  }
  const stats = site?.statistics
  if (!stats) return null

  const issues = (stats.internetIssues ?? []).filter(
    (i) => i.highLatency || i.packetLoss || i.wanDowntime
  )

  // Prefer real-time latency from local health (always present); fall back to cloud issue data.
  const wwwEntry = localHealth.status === 'fulfilled'
    ? (localHealth.value as LocalHealthEntry[]).find((e) => e.subsystem === 'www')
    : undefined
  const latencyAvgMs = wwwEntry?.latency ?? stats.internetIssues?.find((i) => i.highLatency)?.latencyAvgMs ?? null
  const latencyMaxMs = stats.internetIssues?.find((i) => i.highLatency)?.latencyMaxMs ?? null
  const wanUp = wwwEntry?.status ? wwwEntry.status === 'ok' : !issues.some((i) => i.wanDowntime)

  return {
    isp: stats.ispInfo ?? { asn: 0, name: 'Unknown', organization: 'Unknown' },
    externalIp: stats.wans?.WAN?.externalIp ?? '',
    wanUptime: stats.percentages?.wanUptime ?? 0,
    wanUptimeSeconds: wwwEntry?.uptime ?? null,
    wanUp,
    wanUptimePercent24h: null, // overridden by the ISP collector
    wanUptimeWindowMs: 0, // overridden by the ISP collector
    txRetryPct: stats.percentages?.txRetry ?? null,
    latencyAvgMs,
    latencyMaxMs,
    issues,
  }
}
