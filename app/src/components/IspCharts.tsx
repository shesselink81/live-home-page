'use client'

import useSWR from 'swr'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceArea, Legend,
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
  ts: number
  latencyAvg: number | null
  latencyMax: number | null
  wanUpPct: number | null
  hasIssue: boolean
}

export default function IspCharts() {
  const { data: raw } = useSWR<HistoryPoint[]>('/api/isp/history', fetcher, {
    refreshInterval: 10_000,
  })

  const points: ChartPoint[] = (raw ?? []).map((p) => ({
    time: formatTime(p.ts),
    ts: p.ts,
    latencyAvg: p.latencyAvg,
    latencyMax: p.latencyMax,
    wanUpPct: p.wanUpPct !== null ? Number(p.wanUpPct.toFixed(3)) : null,
    hasIssue: p.packetLoss || p.highLatency || p.wanDowntime,
  }))

  // Find contiguous issue ranges for background shading
  const issueRanges: { start: number; end: number }[] = []
  let rangeStart: number | null = null
  for (let i = 0; i < points.length; i++) {
    if (points[i].hasIssue && rangeStart === null) rangeStart = i
    if (!points[i].hasIssue && rangeStart !== null) {
      issueRanges.push({ start: rangeStart, end: i - 1 })
      rangeStart = null
    }
  }
  if (rangeStart !== null) issueRanges.push({ start: rangeStart, end: points.length - 1 })

  const noData = points.length === 0
  const collecting = points.length < 3

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 uppercase tracking-widest">ISP History</p>
        <span className="text-xs text-gray-600">
          {noData ? 'Waiting for data…' : `${points.length} points · ~${Math.round(points.length / 6)} min`}
        </span>
      </div>

      {collecting && (
        <p className="text-gray-600 text-sm text-center py-6">
          Collecting data — charts appear after a few polls.
        </p>
      )}

      {!collecting && (
        <>
          {/* Latency chart */}
          <div>
            <p className="text-xs text-gray-500 mb-3">Latency (ms)</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="time" stroke="#374151" tick={{ fill: '#6b7280', fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis stroke="#374151" tick={{ fill: '#6b7280', fontSize: 10 }} unit=" ms" width={48} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#9ca3af', fontSize: 11 }}
                  itemStyle={{ fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                {issueRanges.map((r, i) => (
                  <ReferenceArea
                    key={i}
                    x1={points[r.start]?.time}
                    x2={points[r.end]?.time}
                    fill="#ef4444"
                    fillOpacity={0.08}
                  />
                ))}
                <Line
                  type="monotone" dataKey="latencyAvg" name="Avg"
                  stroke="#34d399" dot={false} strokeWidth={1.5}
                  connectNulls
                />
                <Line
                  type="monotone" dataKey="latencyMax" name="Max"
                  stroke="#fbbf24" dot={false} strokeWidth={1.5} strokeDasharray="4 2"
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* WAN uptime chart */}
          <div>
            <p className="text-xs text-gray-500 mb-3">WAN Uptime (%, 15 min rolling)</p>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="time" stroke="#374151" tick={{ fill: '#6b7280', fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis stroke="#374151" tick={{ fill: '#6b7280', fontSize: 10 }} domain={['auto', 100]} width={48} unit="%" />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#9ca3af', fontSize: 11 }}
                  itemStyle={{ fontSize: 12 }}
                />
                {issueRanges.map((r, i) => (
                  <ReferenceArea
                    key={i}
                    x1={points[r.start]?.time}
                    x2={points[r.end]?.time}
                    fill="#ef4444"
                    fillOpacity={0.08}
                  />
                ))}
                <Line
                  type="monotone" dataKey="wanUpPct" name="Uptime"
                  stroke="#818cf8" dot={false} strokeWidth={1.5} connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {issueRanges.length > 0 && (
            <p className="text-xs text-red-400/70">
              Red shading = active issue (high latency / packet loss / WAN downtime)
            </p>
          )}
        </>
      )}
    </div>
  )
}
