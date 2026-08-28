import http from 'node:http'

// Docker Engine remote API, DOCKER_HOST-style tcp://host:port — plain HTTP,
// no TLS, no auth (served by a docker-socket-proxy on docker-server, not the
// Portainer agent — that requires TLS + Portainer's own key-exchange auth).
// Only safe to expose on a trusted LAN (see .env.example).
const API_URL = process.env.DOCKER_API_URL ?? 'tcp://192.168.50.3:2375'
const { hostname, port } = new URL(API_URL.replace(/^tcp:/, 'http:'))

function dockerGet(path: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname, port: port || 2375, path, method: 'GET', headers: { Accept: 'application/json' } },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Docker API ${path} → ${res.statusCode}`))
          res.resume()
          return
        }
        let raw = ''
        res.on('data', (chunk: string) => { raw += chunk })
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw))
          } catch (e) { reject(e) }
        })
      }
    )
    req.on('error', reject)
    req.end()
  })
}

export interface DockerInfo {
  version?: string
  os?: string
  arch?: string
  cpus?: number
  memTotal?: number
  containersRunning: number
  containersStopped: number
  containersPaused: number
  images: number
}

export interface DockerContainer {
  id: string
  name: string
  image: string
  state: string
  status: string
  ports: string[]
}

interface RawInfo {
  ServerVersion?: string
  OperatingSystem?: string
  Architecture?: string
  NCPU?: number
  MemTotal?: number
  ContainersRunning?: number
  ContainersStopped?: number
  ContainersPaused?: number
  Images?: number
}

interface RawPort {
  PrivatePort: number
  PublicPort?: number
  Type: string
}

interface RawContainer {
  Id: string
  Names: string[]
  Image: string
  State: string
  Status: string
  Ports: RawPort[]
}

export async function getDockerInfo(): Promise<DockerInfo> {
  const raw = (await dockerGet('/info')) as RawInfo
  return {
    version: raw.ServerVersion,
    os: raw.OperatingSystem,
    arch: raw.Architecture,
    cpus: raw.NCPU,
    memTotal: raw.MemTotal,
    containersRunning: raw.ContainersRunning ?? 0,
    containersStopped: raw.ContainersStopped ?? 0,
    containersPaused: raw.ContainersPaused ?? 0,
    images: raw.Images ?? 0,
  }
}

export async function getDockerContainers(): Promise<DockerContainer[]> {
  const raw = (await dockerGet('/containers/json?all=true')) as RawContainer[]
  return raw.map((c) => ({
    id: c.Id.slice(0, 12),
    name: (c.Names[0] ?? c.Id).replace(/^\//, ''),
    image: c.Image,
    state: c.State,
    status: c.Status,
    ports: (c.Ports ?? []).map((p) => (p.PublicPort ? `${p.PublicPort}:${p.PrivatePort}/${p.Type}` : `${p.PrivatePort}/${p.Type}`)),
  }))
}

interface RawCpuStats {
  cpu_usage: { total_usage: number; percpu_usage?: number[] }
  system_cpu_usage?: number
  online_cpus?: number
}

interface RawStats {
  cpu_stats: RawCpuStats
  precpu_stats: RawCpuStats
  memory_stats: { usage?: number; stats?: { cache?: number } }
}

export interface DockerHostUsage {
  cpuPct: number | null
  memPct: number | null
}

// Docker's API has no single "host usage" endpoint — it's approximated the
// same way `docker stats` does, by summing per-container cgroup stats from
// /containers/{id}/stats?stream=false across all running containers. This
// reflects container-attributed CPU/mem only, not the whole OS (no
// node-exporter/Glances-style host agent is available through this proxy).
export async function getDockerHostUsage(runningContainerIds: string[], info: DockerInfo): Promise<DockerHostUsage> {
  const results = await Promise.allSettled(
    runningContainerIds.map((id) => dockerGet(`/containers/${id}/stats?stream=false`) as Promise<RawStats>)
  )

  let cpuSum = 0
  let memSum = 0
  for (const r of results) {
    if (r.status !== 'fulfilled') continue
    const s = r.value
    const cpuDelta = s.cpu_stats.cpu_usage.total_usage - s.precpu_stats.cpu_usage.total_usage
    const systemDelta = (s.cpu_stats.system_cpu_usage ?? 0) - (s.precpu_stats.system_cpu_usage ?? 0)
    const cpus = s.cpu_stats.online_cpus ?? s.cpu_stats.cpu_usage.percpu_usage?.length ?? info.cpus ?? 1
    if (systemDelta > 0 && cpuDelta > 0) {
      cpuSum += (cpuDelta / systemDelta) * cpus * 100
    }
    memSum += Math.max((s.memory_stats.usage ?? 0) - (s.memory_stats.stats?.cache ?? 0), 0)
  }

  const cpuPct = info.cpus ? Math.min(100, cpuSum / info.cpus) : null
  const memPct = info.memTotal ? Math.min(100, (memSum / info.memTotal) * 100) : null
  return {
    cpuPct: cpuPct === null ? null : Math.round(cpuPct * 10) / 10,
    memPct: memPct === null ? null : Math.round(memPct * 10) / 10,
  }
}
