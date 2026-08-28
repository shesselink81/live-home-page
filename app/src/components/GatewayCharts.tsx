'use client'

import useSWR from 'swr'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import type { HistoryPoint } from '@/app/api/isp/history/route'

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${r.status}`)
    return r.json()
  })

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

interface ChartPoint {
  time: string
  txMbps: number | null
  rxMbps: number | null
  cpu: number | null
  mem: number | null
}

function toMbps(bytes: number, dtSec: number): number {
  return Math.max(0, (bytes * 8) / (dtSec * 1_000_000))
}

export default function GatewayCharts() {
  const { data: raw } = useSWR<HistoryPoint[]>('/api/isp/history', fetcher, {
    refreshInterval: 10_000,
  })

  const hasGatewayData = (raw ?? []).some((p) => p.wanTxBytes !== null)

  const points: ChartPoint[] = (raw ?? []).map((p, i) => {
    const prev = raw![i - 1]
    let txMbps: number | null = null
    let rxMbps: number | null = null
    if (prev && p.wanTxBytes != null && prev.wanTxBytes != null && prev.wanRxBytes != null && p.wanRxBytes != null) {
      const dtSec = (p.ts - prev.ts) / 1000
      if (dtSec > 0) {
        txMbps = toMbps(p.wanTxBytes - prev.wanTxBytes, dtSec)
        rxMbps = toMbps(p.wanRxBytes - prev.wanRxBytes, dtSec)
      }
    }
    return {
      time: formatTime(p.ts),
      txMbps: txMbps !== null ? Number(txMbps.toFixed(2)) : null,
      rxMbps: rxMbps !== null ? Number(rxMbps.toFixed(2)) : null,
      cpu: p.gatewayCpu,
      mem: p.gatewayMem,
    }
  })

  const hasCpuData = points.some((p) => p.cpu !== null)
  const collecting = points.length < 3

  if (!hasGatewayData && !collecting) return null

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 uppercase tracking-widest">Gateway History</p>
        <span className="text-xs text-gray-600">
          {collecting ? 'Waiting for data…' : `${points.length} points · ~${Math.round(points.length / 6)} min`}
        </span>
      </div>

      {collecting && (
        <p className="text-gray-600 text-sm text-center py-6">
          Collecting data — charts appear after a few polls.
        </p>
      )}

      {!collecting && (
        <>
          {/* WAN throughput */}
          <div>
            <p className="text-xs text-gray-500 mb-3">WAN Throughput (Mbps)</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="time" stroke="#374151" tick={{ fill: '#6b7280', fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis stroke="#374151" tick={{ fill: '#6b7280', fontSize: 10 }} unit=" Mb" width={52} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#9ca3af', fontSize: 11 }}
                  itemStyle={{ fontSize: 12 }}
                  formatter={(v) => [`${v} Mbps`] as [string]}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                <Line type="monotone" dataKey="txMbps" name="Upload" stroke="#34d399" dot={false} strokeWidth={1.5} connectNulls />
                <Line type="monotone" dataKey="rxMbps" name="Download" stroke="#60a5fa" dot={false} strokeWidth={1.5} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* CPU + memory */}
          {hasCpuData && (
            <div>
              <p className="text-xs text-gray-500 mb-3">Gateway CPU &amp; Memory (%)</p>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="time" stroke="#374151" tick={{ fill: '#6b7280', fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis stroke="#374151" tick={{ fill: '#6b7280', fontSize: 10 }} domain={[0, 100]} unit="%" width={40} />
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                    labelStyle={{ color: '#9ca3af', fontSize: 11 }}
                    itemStyle={{ fontSize: 12 }}
                    formatter={(v) => [`${v}%`] as [string]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                  <Line type="monotone" dataKey="cpu" name="CPU" stroke="#f97316" dot={false} strokeWidth={1.5} connectNulls />
                  <Line type="monotone" dataKey="mem" name="Memory" stroke="#a78bfa" dot={false} strokeWidth={1.5} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}
