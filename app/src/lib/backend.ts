const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4100'

// The frontend no longer polls upstream sources itself for these routes —
// the backend service (see /backend) owns polling + MySQL-backed history.
// This just proxies the backend's already-cached latest snapshot.
export async function backendGet(path: string): Promise<unknown> {
  const res = await fetch(`${BACKEND_URL}${path}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Backend ${path} → ${res.status}`)
  return res.json()
}
