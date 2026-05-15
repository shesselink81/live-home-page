import { NextResponse } from 'next/server'
import { getHistory } from '@/lib/history'

export async function GET() {
  return NextResponse.json(getHistory())
}
