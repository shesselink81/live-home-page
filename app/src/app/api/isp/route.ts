import { NextResponse } from 'next/server'
import { getWanHealth } from '@/lib/unifi'
import { pushPoint, getRollingMaxLatency } from '@/lib/history'

export async function GET() {
  try {
    const data = await getWanHealth()
    if (data) {
      // Cloud API only provides latencyMaxMs during active high-latency events.
      // Fall back to a rolling 5-min max computed from recent history points.
      const latencyMaxMs = data.latencyMaxMs ?? getRollingMaxLatency()
      pushPoint({
        ts: Date.now(),
        latencyAvg: data.latencyAvgMs,
        latencyMax: latencyMaxMs,
        wanUptime: data.wanUptime,
        packetLoss: data.issues.some((i) => i.packetLoss),
        highLatency: data.issues.some((i) => i.highLatency),
        wanDowntime: data.issues.some((i) => i.wanDowntime),
      })
      return NextResponse.json({ ...data, latencyMaxMs })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Upstream error' }, { status: 500 })
  }
}
