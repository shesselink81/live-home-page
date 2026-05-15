import { NextRequest, NextResponse } from 'next/server'

const TOKEN = process.env.DASHBOARD_TOKEN

export function middleware(req: NextRequest) {
  if (!TOKEN) return NextResponse.next()

  const auth = req.headers.get('authorization')
  if (auth === `Bearer ${TOKEN}`) return NextResponse.next()

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export const config = {
  matcher: '/api/:path*',
}
