import { NextRequest, NextResponse } from 'next/server'
import { auth, SSO_ENABLED } from '@/auth'

const TOKEN = process.env.DASHBOARD_TOKEN

// Empty/unset ALLOWED_NETWORKS disables the IP check entirely (e.g. when
// running behind SSO alone, or a reverse proxy that already restricts access).
const ALLOWED_NETWORKS =
  process.env.ALLOWED_NETWORKS?.split(',').map((s) => s.trim()).filter(Boolean) ?? []

function ipv4ToInt(ip: string): bigint | null {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return null
  return (
    (BigInt(parts[0]) << BigInt(24)) |
    (BigInt(parts[1]) << BigInt(16)) |
    (BigInt(parts[2]) << BigInt(8)) |
    BigInt(parts[3])
  )
}

// Expands "::" shorthand and returns the eight 16-bit groups, or null if malformed.
// No node:net here — middleware runs in the Edge runtime, which can't bundle
// Node built-ins. Colon-presence is enough of a gate; the group-count check
// below does the real structural validation.
function ipv6Groups(ip: string): string[] | null {
  if (!ip.includes(':')) return null
  const [addr] = ip.split('%') // strip zone id, e.g. "fe80::1%eth0"
  const doubleColonIdx = addr.indexOf('::')
  if (doubleColonIdx === -1) {
    const groups = addr.split(':')
    return groups.length === 8 ? groups : null
  }
  const head = addr.slice(0, doubleColonIdx)
  const tail = addr.slice(doubleColonIdx + 2)
  const headParts = head ? head.split(':') : []
  const tailParts = tail ? tail.split(':') : []
  const missing = 8 - headParts.length - tailParts.length
  if (missing < 0) return null
  return [...headParts, ...Array(missing).fill('0'), ...tailParts]
}

function ipv6ToInt(ip: string): bigint | null {
  const groups = ipv6Groups(ip)
  if (!groups) return null
  let result = BigInt(0)
  for (const g of groups) {
    const n = parseInt(g, 16)
    if (Number.isNaN(n) || n < 0 || n > 0xffff) return null
    result = (result << BigInt(16)) | BigInt(n)
  }
  return result
}

function ipToInt(ip: string): { value: bigint; bits: 32 | 128 } | null {
  const v4 = ipv4ToInt(ip)
  if (v4 !== null) return { value: v4, bits: 32 }
  const v6 = ipv6ToInt(ip)
  if (v6 !== null) return { value: v6, bits: 128 }
  return null
}

function isInCidr(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split('/')
  const prefixBits = Number(bitsStr)
  const parsedIp = ipToInt(ip)
  const parsedRange = ipToInt(range)
  if (!parsedIp || !parsedRange || parsedIp.bits !== parsedRange.bits || Number.isNaN(prefixBits)) {
    return false
  }
  const { bits } = parsedIp
  if (prefixBits < 0 || prefixBits > bits) return false
  const fullMask = (BigInt(1) << BigInt(bits)) - BigInt(1)
  const mask = prefixBits === 0 ? BigInt(0) : (fullMask << BigInt(bits - prefixBits)) & fullMask
  return (parsedIp.value & mask) === (parsedRange.value & mask)
}

const LOOPBACK = new Set(['::1', '127.0.0.1'])

// Node reports IPv4 clients on a dual-stack socket as IPv4-mapped IPv6
// (e.g. "::ffff:172.19.0.1" for the Docker bridge gateway on Windows/Mac
// Docker Desktop) — strip the prefix so CIDR/loopback checks below still work.
function normalizeIp(ip: string): string {
  return ip.replace(/^::ffff:/i, '')
}

function clientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return normalizeIp(forwarded.split(',')[0].trim())
  const real = req.headers.get('x-real-ip')
  return real ? normalizeIp(real.trim()) : null
}

/** LAN/VPN restriction — always applies first, including to the sign-in flow itself. */
function checkNetwork(req: NextRequest): NextResponse | null {
  if (ALLOWED_NETWORKS.length === 0) return null

  // Next.js itself sets x-forwarded-for to the raw socket address (::1 for a
  // direct loopback connection) even with no reverse proxy in front, so
  // loopback is always allowed. Real deployments sit behind Traefik, which
  // overwrites this header with the actual client IP before it reaches here.
  const ip = clientIp(req)
  if (ip && !LOOPBACK.has(ip) && !ALLOWED_NETWORKS.some((cidr) => isInCidr(ip, cidr))) {
    return new NextResponse('Forbidden: access restricted to the local network', { status: 403 })
  }
  return null
}

function hasValidDashboardToken(req: NextRequest): boolean {
  return !!TOKEN && req.headers.get('authorization') === `Bearer ${TOKEN}`
}

// SSO (optional, see auth.ts) layers ON TOP of the network restriction above —
// both must pass. DASHBOARD_TOKEN remains a separate non-interactive bypass
// for /api/* automation, same as when SSO is disabled.
export const middleware = SSO_ENABLED
  ? auth((req) => {
      const denied = checkNetwork(req)
      if (denied) return denied

      const { pathname } = req.nextUrl

      // NextAuth's own routes (sign-in, callback, session, csrf, …).
      if (pathname.startsWith('/api/auth/')) return NextResponse.next()

      if (pathname.startsWith('/api/') && hasValidDashboardToken(req)) {
        return NextResponse.next()
      }

      if (!req.auth) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const signInUrl = new URL('/api/auth/signin', req.nextUrl.origin)
        signInUrl.searchParams.set('callbackUrl', pathname)
        return NextResponse.redirect(signInUrl)
      }

      return NextResponse.next()
    })
  : function middleware(req: NextRequest) {
      const denied = checkNetwork(req)
      if (denied) return denied

      if (req.nextUrl.pathname.startsWith('/api/') && TOKEN && !hasValidDashboardToken(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      return NextResponse.next()
    }

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
