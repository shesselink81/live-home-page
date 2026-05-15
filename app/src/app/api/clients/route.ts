import { NextResponse } from 'next/server'
import { getClients } from '@/lib/unifi'

export async function GET() {
  try {
    return NextResponse.json(await getClients())
  } catch (e) {
    void e
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
  }
}
