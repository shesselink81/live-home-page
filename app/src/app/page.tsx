'use client'

import { useState } from 'react'
import useSWR from 'swr'
import type { Device, Client, WanHealth } from '@/lib/unifi'
import type { TopologyNode } from '@/lib/topology'
import WanHealthCard from '@/components/WanHealthCard'
import DeviceCard from '@/components/DeviceCard'
import ClientsTable from '@/components/ClientsTable'
import IspCharts from '@/components/IspCharts'
import GatewayCharts from '@/components/GatewayCharts'
import NetworkTopology from '@/components/NetworkTopology'

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
    return r.json()
  })
const REFRESH = 10_000
const TABS = ['overview', 'topology'] as const
type Tab = (typeof TABS)[number]
const TAB_LABEL: Record<Tab, string> = { overview: 'Overview', topology: 'Topology' }

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('overview')

  const { data: isp, error: ispErr } = useSWR<WanHealth>('/api/isp', fetcher, { refreshInterval: REFRESH })
  const { data: devices, error: devErr } = useSWR<Device[]>('/api/devices', fetcher, { refreshInterval: REFRESH })
  const { data: clients, error: cliErr } = useSWR<Client[]>('/api/clients', fetcher, { refreshInterval: REFRESH })
  const { data: topology, error: topoErr } = useSWR<TopologyNode | null>(
    tab === 'topology' ? '/api/topology' : null,
    fetcher,
    { refreshInterval: REFRESH }
  )

  const now = new Date().toLocaleTimeString()

  return (
    <div className={`min-h-screen p-6 mx-auto ${tab === 'topology' ? 'max-w-[1800px]' : 'max-w-7xl'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">UniFi Monitor</h1>
          <p className="text-gray-500 text-sm mt-0.5" suppressHydrationWarning>Refreshes every 10 s · Last update: {now}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-400 text-sm">Live</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-800">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-blue-500 text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
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
        </>
      )}

      {tab === 'topology' && (
        <NetworkTopology root={topology} error={topoErr ? String(topoErr) : undefined} />
      )}
    </div>
  )
}
