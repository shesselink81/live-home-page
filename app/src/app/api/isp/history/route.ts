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
