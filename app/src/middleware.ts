import { NextRequest, NextResponse } from 'next/server'
import { auth, SSO_ENABLED } from '@/auth'

const TOKEN = process.env.DASHBOARD_TOKEN

// No CIDRs by default — only loopback (see LOOPBACK below) is allowed unless
// ALLOWED_NETWORKS is explicitly set.
const ALLOWED_NETWORKS =
  process.env.ALLOWED_NETWORKS?.split(',').map((s) => s.trim()).filter(Boolean) ?? []

function ipToInt(ip: string): number | null {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return null
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

function isInCidr(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split('/')
  const bits = Number(bitsStr)
  const ipInt = ipToInt(ip)
  const rangeInt = ipToInt(range)
  if (ipInt === null || rangeInt === null || Number.isNaN(bits)) return false
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
  return (ipInt & mask) === (rangeInt & mask)
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
