import { NextResponse } from 'next/server'
import { backendGet } from '@/lib/backend'

export interface DockerInfo {
  version?: string
  os?: string
  arch?: string
  cpus?: number
  memTotal?: number
  containersRunning: number
  containersStopped: number
  containersPaused: number
  images: number
}

export interface DockerContainer {
  id: string
  name: string
  image: string
  state: string
  status: string
  ports: string[]
}

export async function GET() {
  try {
    return NextResponse.json(await backendGet('/cloud/docker'))
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Backend unreachable' })
  }
}
