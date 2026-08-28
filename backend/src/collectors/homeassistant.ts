import { callMcpTool, toolText, type McpToolResult } from '../lib/mcp.js'
import { pushMetric, getMetricHistory, type MetricPoint } from '../metricsHistory.js'

const URL_ = process.env.MCP_HOMEASSISTANT_URL ?? 'http://localhost:8086/mcp'

const BACKUP_ENTITIES = [
  'sensor.backup_backup_manager_state',
  'sensor.backup_last_successful_automatic_backup',
  'sensor.backup_last_attempted_automatic_backup',
  'sensor.backup_next_scheduled_automatic_backup',
]

// Host CPU/memory usage %, exposed via the Glances integration monitoring
// the HAOS host itself (no built-in HA tool returns host metrics directly).
const HOST_METRIC_ENTITIES = ['sensor.pi4_glances_cpu_gebruik', 'sensor.pi4_glances_geheugengebruik']

export interface HaIntegration {
  title: string
  version: string | null
  upToDate: boolean | null
}

export interface HaIntegrations {
  total: number
  loaded: number
  notLoaded: number
  entries: HaIntegration[]
}

export interface HaApp {
  name: string
  slug: string
  version: string
  state: string
  updateAvailable: boolean
}

export interface HaApps {
  totalInstalled: number
  running: number
  stopped: number
  updatesAvailable: number
  entries: HaApp[]
}

export interface HaSystem {
  coreVersion?: string
  installationType?: string
  osName?: string
  osVersion?: string
  arch?: string
  timezone?: string
  hostOs?: string
  supervisorVersion?: string
  dockerVersion?: string
  diskUsed?: string
  diskTotal?: string
  healthy?: boolean
  dbEngine?: string
  dbSize?: string
  updatesAvailable?: number
}

export interface HaBackups {
  managerState?: string
  lastSuccessful?: string
  lastAttempted?: string
  nextScheduled?: string
}

export interface HaHacsPlugin {
  name: string
  domain: string | null
  category: string
  installedVersion: string
  availableVersion: string
  pendingUpdate: boolean
}

export interface HaHacs {
  total: number
  entries: HaHacsPlugin[]
}

async function tryCall<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn()
  } catch {
    return null
  }
}

// Called on a timer by poller.ts — the sole source of Home Assistant polling
// now (no per-request fetching); server.ts just serves the latest cached result.
export async function collectHomeAssistant() {
  const [integrationsResult, appsResult, healthResult, updatesResult, backupResult, hacsResult, hostMetricsResult] =
    await Promise.all([
      tryCall(() => callMcpTool<McpToolResult>(URL_, 'ha_get_integration', {})),
      tryCall(() => callMcpTool<McpToolResult>(URL_, 'ha_get_addon', {})),
      tryCall(() => callMcpTool<McpToolResult>(URL_, 'ha_get_system_health', {})),
      tryCall(() => callMcpTool<McpToolResult>(URL_, 'ha_get_updates', {})),
      tryCall(() =>
        callMcpTool<McpToolResult>(URL_, 'ha_get_state', { entity_id: BACKUP_ENTITIES, fields: ['state'] })
      ),
      tryCall(() =>
        callMcpTool<McpToolResult>(URL_, 'ha_get_hacs_info', { action: 'search', installed_only: true, max_results: 100 })
      ),
      tryCall(() =>
        callMcpTool<McpToolResult>(URL_, 'ha_get_state', { entity_id: HOST_METRIC_ENTITIES, fields: ['state'] })
      ),
    ])

  // If every single call failed, treat the whole source as unreachable.
  if (
    !integrationsResult &&
    !appsResult &&
    !healthResult &&
    !updatesResult &&
    !backupResult &&
    !hacsResult &&
    !hostMetricsResult
  ) {
    return { ok: false as const, error: 'Home Assistant MCP server unreachable' }
  }

  let hacs: HaHacs | null = null
  if (hacsResult) {
    const raw = JSON.parse(toolText(hacsResult))
    const results = raw.data?.results ?? []
    hacs = {
      total: raw.data?.total_matches ?? results.length,
      entries: results.map((r: Record<string, unknown>) => ({
        name: r.name,
        domain: (r.domain as string | null) ?? null,
        category: r.category,
        installedVersion: r.installed_version,
        availableVersion: r.available_version,
        pendingUpdate: Boolean(r.pending_update),
      })),
    }
  }
  const hacsByDomain = new Map((hacs?.entries ?? []).filter((p) => p.domain).map((p) => [p.domain as string, p]))

  let integrations: HaIntegrations | null = null
  if (integrationsResult) {
    const raw = JSON.parse(toolText(integrationsResult))
    // "Self installed" = added by the user (Settings > Devices & Services > Add
    // Integration), excluding system/auto-discovered/imported/ignored entries.
    const userEntries = (raw.entries ?? []).filter((e: Record<string, unknown>) => e.source === 'user')
    const entries: HaIntegration[] = userEntries.map((e: Record<string, unknown>) => {
      const domain = e.domain as string
      const hacsPlugin = hacsByDomain.get(domain)
      return {
        title: (e.title as string) || domain,
        version: hacsPlugin?.installedVersion ?? null,
        upToDate: hacsPlugin ? !hacsPlugin.pendingUpdate : null,
      }
    })
    integrations = {
      total: entries.length,
      loaded: userEntries.filter((e: Record<string, unknown>) => e.state === 'loaded').length,
      notLoaded: userEntries.filter((e: Record<string, unknown>) => e.state !== 'loaded').length,
      entries,
    }
  }

  let apps: HaApps | null = null
  if (appsResult) {
    const raw = JSON.parse(toolText(appsResult))
    if (raw.success !== false) {
      apps = {
        totalInstalled: raw.summary?.total_installed ?? 0,
        running: raw.summary?.running ?? 0,
        stopped: raw.summary?.stopped ?? 0,
        updatesAvailable: raw.summary?.updates_available ?? 0,
        entries: (raw.addons ?? []).map((a: Record<string, unknown>) => ({
          name: a.name,
          slug: a.slug,
          version: a.version,
          state: a.state,
          updateAvailable: Boolean(a.update_available),
        })),
      }
    }
  }

  let system: HaSystem | null = null
  if (healthResult) {
    const raw = JSON.parse(toolText(healthResult))
    const data = raw.health_info?.data ?? {}
    const ha = data.homeassistant?.info ?? {}
    const hassio = data.hassio?.info ?? {}
    const recorder = data.recorder?.info ?? {}
    system = {
      coreVersion: ha.version,
      installationType: ha.installation_type,
      osName: ha.os_name,
      osVersion: ha.os_version,
      arch: ha.arch,
      timezone: ha.timezone,
      hostOs: hassio.host_os,
      supervisorVersion: hassio.supervisor_version,
      dockerVersion: hassio.docker_version,
      diskUsed: hassio.disk_used,
      diskTotal: hassio.disk_total,
      healthy: hassio.healthy,
      dbEngine: recorder.database_engine,
      dbSize: recorder.estimated_db_size,
    }
  }
  if (updatesResult) {
    const raw = JSON.parse(toolText(updatesResult))
    system = { ...(system ?? {}), updatesAvailable: raw.updates_available ?? 0 }
  }

  let backups: HaBackups | null = null
  if (backupResult) {
    const raw = JSON.parse(toolText(backupResult))
    const states = raw.data?.states ?? {}
    backups = {
      managerState: states['sensor.backup_backup_manager_state']?.state,
      lastSuccessful: states['sensor.backup_last_successful_automatic_backup']?.state,
      lastAttempted: states['sensor.backup_last_attempted_automatic_backup']?.state,
      nextScheduled: states['sensor.backup_next_scheduled_automatic_backup']?.state,
    }
  }

  if (hostMetricsResult) {
    const raw = JSON.parse(toolText(hostMetricsResult))
    const states = raw.data?.states ?? {}
    const cpu = Number(states['sensor.pi4_glances_cpu_gebruik']?.state)
    const mem = Number(states['sensor.pi4_glances_geheugengebruik']?.state)
    await pushMetric('ha-host', {
      cpu: Number.isFinite(cpu) ? cpu : null,
      mem: Number.isFinite(mem) ? mem : null,
    })
  }
  const hostMetricsHistory: MetricPoint[] = await getMetricHistory('ha-host')

  return { ok: true as const, integrations, apps, system, backups, hacs, hostMetricsHistory }
}
