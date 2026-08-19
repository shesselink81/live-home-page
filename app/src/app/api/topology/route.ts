import { NextResponse } from 'next/server'
import { getDevices, getClients } from '@/lib/unifi'
import { buildTopology } from '@/lib/topology'

export async function GET() {
  try {
    const [devices, clients] = await Promise.all([getDevices(), getClients()])
    const tree = buildTopology(devices, clients)
    return NextResponse.json(tree)
  } catch (e) {
    void e
    return NextResponse.json({ error: 'Failed to fetch topology' }, { status: 500 })
  }
}
