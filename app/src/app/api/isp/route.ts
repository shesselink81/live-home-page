import { NextResponse } from 'next/server'
import { backendGet } from '@/lib/backend'

export async function GET() {
  try {
    return NextResponse.json(await backendGet('/isp'))
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Upstream error' }, { status: 500 })
  }
}
