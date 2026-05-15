import { NextResponse } from 'next/server'
import { getDevices } from '@/lib/unifi'

const DEVICE_TYPES = new Set(['udm', 'usw', 'uap', 'ugw', 'uxg'])

export async function GET() {
  try {
    const all = await getDevices()
    return NextResponse.json(all.filter((d) => DEVICE_TYPES.has(d.type)))
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
