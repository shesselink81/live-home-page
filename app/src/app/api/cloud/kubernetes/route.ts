import { NextResponse } from 'next/server'
import { backendGet } from '@/lib/backend'

export interface K8sNode {
  name: string
  cpuCores: string
  cpuPct: string
  memBytes: string
  memPct: string
}

export interface K8sPod {
  namespace: string
  name: string
  status: string
  restarts: string
  age: string
  node: string
}

export interface FluxSource {
  kind: string
  name: string
  namespace: string
  ready: string | null
  status: string | null
  age: string
  url: string
}

export interface FluxHelmRelease {
  name: string
  namespace: string
  ready: string | null
  status: string | null
  chart: string | null
  age: string
}

export async function GET() {
  try {
    return NextResponse.json(await backendGet('/cloud/kubernetes'))
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Backend unreachable' })
  }
}
