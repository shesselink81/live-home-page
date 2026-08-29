import { NextResponse } from 'next/server'
import { backendGet } from '@/lib/backend'

export interface HistoryPoint {
  ts: number
  latencyAvg: number | null
  latencyMax: number | null
  wanUptime: number
  packetLoss: boolean
  highLatency: boolean
  wanDowntime: boolean
  wanUp: boolean
  // Rolling uptime % over a trailing window ending at this point — see
  // backend/src/history.ts. Replaces wanUptime for charting since the cloud
  // API's wanUptime has been observed stuck at 0 despite a healthy WAN.
  wanUpPct: number | null
  wanTxBytes: number | null
  wanRxBytes: number | null
  gatewayCpu: number | null
  gatewayMem: number | null
}

export async function GET() {
  try {
    return NextResponse.json(await backendGet('/isp/history'))
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Upstream error' }, { status: 500 })
  }
}
