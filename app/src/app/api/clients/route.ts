import { NextResponse } from 'next/server'
import { getClients } from '@/lib/unifi'

export async function GET() {
  try {
    return NextResponse.json(await getClients())
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
