import { NextResponse } from 'next/server'
import { backendGet } from '@/lib/backend'

export interface HaIntegration {
  title: string
  version: string | null
  upToDate: boolean | null
}

export interface HaIntegrations {
  total: number
  loaded: number
  notLoaded: number
  entries: HaIntegration[]
}

export interface HaApp {
  name: string
  slug: string
  version: string
  state: string
  updateAvailable: boolean
}

export interface HaApps {
  totalInstalled: number
  running: number
  stopped: number
  updatesAvailable: number
  entries: HaApp[]
}

export interface HaSystem {
  coreVersion?: string
  installationType?: string
  osName?: string
  osVersion?: string
  arch?: string
  timezone?: string
  hostOs?: string
  supervisorVersion?: string
  dockerVersion?: string
  diskUsed?: string
  diskTotal?: string
  healthy?: boolean
  dbEngine?: string
  dbSize?: string
  updatesAvailable?: number
}

export interface HaBackups {
  managerState?: string
  lastSuccessful?: string
  lastAttempted?: string
  nextScheduled?: string
}

export interface HaHacsPlugin {
  name: string
  domain: string | null
  category: string
  installedVersion: string
  availableVersion: string
  pendingUpdate: boolean
}

export interface HaHacs {
  total: number
  entries: HaHacsPlugin[]
}

export async function GET() {
  try {
    return NextResponse.json(await backendGet('/cloud/homeassistant'))
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Backend unreachable' })
  }
}
