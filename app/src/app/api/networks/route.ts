import { NextResponse } from 'next/server'
import { getNetworks } from '@/lib/unifi'

export async function GET() {
  try {
    const networks = await getNetworks()
    return NextResponse.json(networks)
  } catch (e) {
    void e
    return NextResponse.json({ error: 'Failed to fetch networks' }, { status: 500 })
  }
}
