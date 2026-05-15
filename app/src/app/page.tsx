'use client'

import useSWR from 'swr'
import type { Device, Client, WanHealth } from '@/lib/unifi'
import WanHealthCard from '@/components/WanHealthCard'
import DeviceCard from '@/components/DeviceCard'
import ClientsTable from '@/components/ClientsTable'
import IspCharts from '@/components/IspCharts'
import GatewayCharts from '@/components/GatewayCharts'

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
    return r.json()
  })
const REFRESH = 10_000

export default function Dashboard() {
  const { data: isp, error: ispErr } = useSWR<WanHealth>('/api/isp', fetcher, { refreshInterval: REFRESH })
  const { data: devices, error: devErr } = useSWR<Device[]>('/api/devices', fetcher, { refreshInterval: REFRESH })
  const { data: clients, error: cliErr } = useSWR<Client[]>('/api/clients', fetcher, { refreshInterval: REFRESH })

  const now = new Date().toLocaleTimeString()

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">UniFi Monitor</h1>
          <p className="text-gray-500 text-sm mt-0.5">Refreshes every 10 s · Last update: {now}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-400 text-sm">Live</span>
        </div>
      </div>

      {/* WAN / ISP */}
      <WanHealthCard data={isp ?? null} error={ispErr ? String(ispErr) : undefined} />

      {/* Devices */}
      <div className="mt-6">
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Infrastructure Devices</p>
        {devErr && <p className="text-red-400 text-sm">{String(devErr)}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(devices ?? []).map((d) => (
            <DeviceCard key={d.mac} device={d} />
          ))}
          {!devices && !devErr && [0, 1, 2].map((i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 animate-pulse h-40" />
          ))}
        </div>
      </div>

      {/* Clients */}
      <div className="mt-6">
        <ClientsTable
          clients={clients}
          error={cliErr ? String(cliErr) : undefined}
        />
      </div>

      {/* ISP Charts */}
      <div className="mt-6">
        <IspCharts />
      </div>

      {/* Gateway Charts */}
      <div className="mt-6">
        <GatewayCharts />
      </div>
    </div>
  )
}
