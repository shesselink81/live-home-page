import { listZones, cloudflareGraphql } from '../lib/cloudflare.js'

export interface CloudflareTotals {
  requests: number
  visits: number
  bytes: number
  cachedRequests: number
}

export interface CloudflareHourPoint {
  ts: number
  requests: number
}

export interface CloudflareCountBreakdown {
  key: string
  count: number
}

export interface CloudflareStatusBuckets {
  '2xx': number
  '3xx': number
  '4xx': number
  '5xx': number
  other: number
}

export interface CloudflareZoneStats {
  zoneTag: string
  name: string
  requests: number
}

// Cache statuses that Cloudflare's own dashboard counts as "cached" for the
// cache-hit-rate metric — notably excludes "revalidated" (still round-trips
// to origin). See developers.cloudflare.com/glossary "cached requests".
const CACHED_STATUSES = new Set(['hit', 'stale', 'updating', 'ignored'])

interface CountGroup<D extends Record<string, unknown>> {
  count: number
  dimensions: D
}

interface ZoneResult {
  zoneTag: string
  totals: { count: number; sum: { visits: number; edgeResponseBytes: number } }[]
  hourly: CountGroup<{ datetimeHour: string }>[]
  byCache: CountGroup<{ cacheStatus: string }>[]
  byCountry: CountGroup<{ clientCountryName: string }>[]
  byDevice: CountGroup<{ clientDeviceType: string }>[]
  byHost: CountGroup<{ clientRequestHTTPHost: string }>[]
  byStatus: CountGroup<{ edgeResponseStatus: number }>[]
  byPath: CountGroup<{ clientRequestPath: string }>[]
}

interface GraphQLResponse {
  viewer: { zones: ZoneResult[] }
}

// httpRequestsAdaptiveGroups is the GraphQL Analytics dataset backing
// Cloudflare's own dashboards (including custom "Traffic overview"-style
// dashboards) — the old REST zone-analytics-dashboard endpoint is sunset.
// Field names/shape confirmed against the live GraphQL API + schema
// introspection at graphql.cloudflare.com/explorer: notably there is no
// `threats` or `cachedBytes`/`cachedRequests` sum field on this dataset —
// cache/threat breakdowns have to be derived from the `cacheStatus` /
// `edgeResponseStatus` dimensions instead.
const QUERY = `
  query TrafficOverview($zoneTags: [string!], $since: Time!, $until: Time!) {
    viewer {
      zones(filter: { zoneTag_in: $zoneTags }) {
        zoneTag
        totals: httpRequestsAdaptiveGroups(
          limit: 1
          filter: { datetime_geq: $since, datetime_leq: $until }
        ) {
          count
          sum { visits edgeResponseBytes }
        }
        hourly: httpRequestsAdaptiveGroups(
          limit: 24
          filter: { datetime_geq: $since, datetime_leq: $until }
          orderBy: [datetimeHour_ASC]
        ) {
          count
          dimensions { datetimeHour }
        }
        byCache: httpRequestsAdaptiveGroups(
          limit: 12
          filter: { datetime_geq: $since, datetime_leq: $until }
          orderBy: [count_DESC]
        ) {
          count
          dimensions { cacheStatus }
        }
        byCountry: httpRequestsAdaptiveGroups(
          limit: 15
          filter: { datetime_geq: $since, datetime_leq: $until }
          orderBy: [count_DESC]
        ) {
          count
          dimensions { clientCountryName }
        }
        byDevice: httpRequestsAdaptiveGroups(
          limit: 5
          filter: { datetime_geq: $since, datetime_leq: $until }
          orderBy: [count_DESC]
        ) {
          count
          dimensions { clientDeviceType }
        }
        byHost: httpRequestsAdaptiveGroups(
          limit: 15
          filter: { datetime_geq: $since, datetime_leq: $until }
          orderBy: [count_DESC]
        ) {
          count
          dimensions { clientRequestHTTPHost }
        }
        byStatus: httpRequestsAdaptiveGroups(
          limit: 30
          filter: { datetime_geq: $since, datetime_leq: $until }
          orderBy: [count_DESC]
        ) {
          count
          dimensions { edgeResponseStatus }
        }
        byPath: httpRequestsAdaptiveGroups(
          limit: 15
          filter: { datetime_geq: $since, datetime_leq: $until }
          orderBy: [count_DESC]
        ) {
          count
          dimensions { clientRequestPath }
        }
      }
    }
  }
`

function mergeCounts<D extends Record<string, unknown>>(
  zones: ZoneResult[],
  pick: (z: ZoneResult) => CountGroup<D>[],
  keyOf: (d: D) => string
): Map<string, number> {
  const merged = new Map<string, number>()
  for (const z of zones) {
    for (const g of pick(z)) {
      const key = keyOf(g.dimensions)
      merged.set(key, (merged.get(key) ?? 0) + g.count)
    }
  }
  return merged
}

function topN(counts: Map<string, number>, n: number): CloudflareCountBreakdown[] {
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n)
}

// Called on a timer by poller.ts. Pulls the last 24h of traffic across every
// zone the API token can see, via Cloudflare's GraphQL Analytics API.
export async function collectCloudflare() {
  let zoneList: { id: string; name: string }[]
  try {
    zoneList = await listZones()
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : 'Cloudflare API unreachable' }
  }
  if (zoneList.length === 0) {
    return { ok: false as const, error: 'No zones visible to this Cloudflare API token' }
  }

  const until = new Date()
  const since = new Date(until.getTime() - 24 * 60 * 60 * 1000)

  let data: GraphQLResponse
  try {
    data = await cloudflareGraphql<GraphQLResponse>(QUERY, {
      zoneTags: zoneList.map((z) => z.id),
      since: since.toISOString(),
      until: until.toISOString(),
    })
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : 'Cloudflare GraphQL Analytics API unreachable',
    }
  }

  const zones = data.viewer.zones
  const nameByTag = new Map(zoneList.map((z) => [z.id, z.name]))

  const totals = zones.reduce(
    (acc, z) => {
      const t = z.totals[0]
      return {
        requests: acc.requests + (t?.count ?? 0),
        visits: acc.visits + (t?.sum.visits ?? 0),
        bytes: acc.bytes + (t?.sum.edgeResponseBytes ?? 0),
      }
    },
    { requests: 0, visits: 0, bytes: 0 }
  )

  const cacheStatusCounts = mergeCounts(zones, (z) => z.byCache, (d) => d.cacheStatus)
  const cachedRequests = [...cacheStatusCounts.entries()]
    .filter(([status]) => CACHED_STATUSES.has(status))
    .reduce((sum, [, count]) => sum + count, 0)

  const hourly = mergeCounts(
    zones,
    (z) => z.hourly,
    (d) => d.datetimeHour
  )
  const timeseries: CloudflareHourPoint[] = [...hourly.entries()]
    .map(([iso, requests]) => ({ ts: new Date(iso).getTime(), requests }))
    .sort((a, b) => a.ts - b.ts)

  const statusCodes: CloudflareStatusBuckets = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, other: 0 }
  for (const z of zones) {
    for (const g of z.byStatus) {
      const bucket = Math.floor(g.dimensions.edgeResponseStatus / 100)
      if (bucket === 2) statusCodes['2xx'] += g.count
      else if (bucket === 3) statusCodes['3xx'] += g.count
      else if (bucket === 4) statusCodes['4xx'] += g.count
      else if (bucket === 5) statusCodes['5xx'] += g.count
      else statusCodes.other += g.count
    }
  }

  const zoneStats: CloudflareZoneStats[] = zones
    .map((z) => ({
      zoneTag: z.zoneTag,
      name: nameByTag.get(z.zoneTag) ?? z.zoneTag,
      requests: z.totals[0]?.count ?? 0,
    }))
    .sort((a, b) => b.requests - a.requests)

  return {
    ok: true as const,
    totals: { ...totals, cachedRequests },
    timeseries,
    cacheStatus: topN(cacheStatusCounts, 12),
    byCountry: topN(mergeCounts(zones, (z) => z.byCountry, (d) => d.clientCountryName), 10),
    byDevice: topN(mergeCounts(zones, (z) => z.byDevice, (d) => d.clientDeviceType), 5),
    byHost: topN(mergeCounts(zones, (z) => z.byHost, (d) => d.clientRequestHTTPHost), 10),
    byPath: topN(mergeCounts(zones, (z) => z.byPath, (d) => d.clientRequestPath), 10),
    statusCodes,
    zones: zoneStats,
  }
}
