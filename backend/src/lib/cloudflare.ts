const REST_BASE = 'https://api.cloudflare.com/client/v4'
const GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql'
const CALL_TIMEOUT_MS = 10_000

function token(): string {
  const t = process.env.CLOUDFLARE_API_TOKEN
  if (!t) throw new Error('CLOUDFLARE_API_TOKEN is not configured')
  return t
}

export interface CloudflareZone {
  id: string
  name: string
}

// Lists every zone the token can see — a scoped token naturally limits this
// to the zones it was granted, so no separate account ID config is needed.
export async function listZones(): Promise<CloudflareZone[]> {
  const res = await fetch(`${REST_BASE}/zones?per_page=50`, {
    headers: { Authorization: `Bearer ${token()}` },
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  })
  const body = (await res.json()) as {
    success: boolean
    errors?: { message: string }[]
    result: { id: string; name: string }[]
  }
  if (!res.ok || body.success === false) {
    throw new Error(body.errors?.[0]?.message ?? `Cloudflare /zones → ${res.status}`)
  }
  return body.result.map((z) => ({ id: z.id, name: z.name }))
}

// The legacy REST Zone Analytics Dashboard endpoint is sunset; Cloudflare
// replaced it with this GraphQL Analytics API for all traffic/threat data.
export async function cloudflareGraphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  })
  const body = (await res.json()) as { errors?: { message: string }[]; data: T }
  if (!res.ok || body.errors?.length) {
    throw new Error(body.errors?.[0]?.message ?? `Cloudflare GraphQL → ${res.status}`)
  }
  return body.data
}
