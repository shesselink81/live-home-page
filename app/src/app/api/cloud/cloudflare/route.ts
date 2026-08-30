import { NextResponse } from 'next/server'
import { backendGet } from '@/lib/backend'

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

export async function GET() {
  try {
    return NextResponse.json(await backendGet('/cloud/cloudflare'))
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Backend unreachable' })
  }
}
