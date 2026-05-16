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
    cache: 'no-store',
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
}

export interface Client {
  mac: string
  ip: string
  name: string | null
  hostname: string
  is_wired: boolean
  is_guest: boolean
  network: string
  vlan: number
  signal: number | null
  uptime: number
  tx_bytes: number | null
  rx_bytes: number | null
  tx_rate: number | null
  rx_rate: number | null
  essid: string | null
  oui: string
  ap_mac: string | null
  sw_mac: string | null
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
  latencyAvgMs: number | null
  latencyMaxMs: number | null
  txRetryPct: number | null
  issues: Array<{ highLatency?: boolean; packetLoss?: boolean; wanDowntime?: boolean }>
}

function mapDevice(r: Record<string, unknown>): Device {
  const sys = r['system-stats'] as { cpu?: string; mem?: string } | undefined
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
  }
}

function mapClient(r: Record<string, unknown>): Client {
  return {
    mac: r.mac as string,
    ip: r.ip as string,
    name: (r.name ?? null) as string | null,
    hostname: r.hostname as string,
    is_wired: r.is_wired as boolean,
    is_guest: r.is_guest as boolean,
    network: r.network as string,
    vlan: r.vlan as number,
    signal: (r.signal ?? null) as number | null,
    uptime: r.uptime as number,
    tx_bytes: (r.tx_bytes ?? null) as number | null,
    rx_bytes: (r.rx_bytes ?? null) as number | null,
    tx_rate: (r.tx_rate ?? null) as number | null,
    rx_rate: (r.rx_rate ?? null) as number | null,
    essid: (r.essid ?? null) as string | null,
    oui: (r.oui ?? '') as string,
    ap_mac: (r.ap_mac ?? null) as string | null,
    sw_mac: (r.sw_mac ?? null) as string | null,
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

export async function getClients(): Promise<Client[]> {
  const raw = await localGet('/api/s/default/stat/sta') as Record<string, unknown>[]
  return raw.map(mapClient)
}

interface LocalHealthEntry {
  subsystem: string
  latency?: number
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

  return {
    isp: stats.ispInfo ?? { asn: 0, name: 'Unknown', organization: 'Unknown' },
    externalIp: stats.wans?.WAN?.externalIp ?? '',
    wanUptime: stats.percentages?.wanUptime ?? 0,
    txRetryPct: stats.percentages?.txRetry ?? null,
    latencyAvgMs,
    latencyMaxMs,
    issues,
  }
}
