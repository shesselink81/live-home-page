import type { WanHealth } from '@/lib/unifi'
import { formatUptime } from '@/lib/format'

interface Props { data: WanHealth | null; error?: string }

export default function WanHealthCard({ data, error }: Props) {
  if (error) return <Card><p className="text-red-400 text-sm">{error}</p></Card>
  if (!data) return <Card><p className="text-gray-500 text-sm">Loading…</p></Card>

  const highLatency = data.issues.some((i) => i.highLatency)
  const packetLoss  = data.issues.some((i) => i.packetLoss)
  const wanDowntime = data.issues.some((i) => i.wanDowntime)
  const hasIssues   = highLatency || packetLoss || wanDowntime

  // The cloud API's wanUptime percentage has been observed stuck at 0
  // despite a healthy WAN — this is instead computed from our own poll
  // history (backend/src/history.ts), independent of that broken field.
  // Windows shorter than ~23h just mean the app hasn't been running that
  // long yet; the label reflects the actual window until it fills in.
  const uptimePercent = data.wanUptimePercent24h
  const uptimeLabel = uptimePercent === null
    ? 'WAN Uptime'
    : data.wanUptimeWindowMs < 23 * 60 * 60 * 1000
      ? `WAN Uptime (${formatUptime(Math.round(data.wanUptimeWindowMs / 1000))})`
      : 'WAN Uptime (24h)'
  const uptimeValue = uptimePercent === null ? '—' : `${uptimePercent.toFixed(2)}%`
  const uptimeColor = uptimePercent === null
    ? 'text-gray-500'
    : uptimePercent >= 99.9 ? 'text-green-400' : uptimePercent >= 99 ? 'text-yellow-400' : 'text-red-400'
  const uptimeSub = data.wanUptimeSeconds !== null ? `up ${formatUptime(data.wanUptimeSeconds)}` : undefined

  return (
    <Card>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">ISP</p>
          <p className="text-white font-semibold text-lg">{data.isp.name}</p>
          <p className="text-gray-400 text-sm">{data.isp.organization}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">ASN {data.isp.asn}</p>
          <p className="text-gray-300 text-sm font-mono">{data.externalIp}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label={uptimeLabel} value={uptimeValue} valueClass={uptimeColor} sub={uptimeSub} />
        <Stat label="Avg Latency" value={data.latencyAvgMs !== null ? `${data.latencyAvgMs} ms` : '—'} />
        <Stat label="Max Latency" value={data.latencyMaxMs !== null ? `${data.latencyMaxMs} ms` : '—'} />
      </div>

      {hasIssues && (
        <div className="mt-4 flex flex-wrap gap-2">
          {highLatency && <Badge color="yellow">High Latency</Badge>}
          {packetLoss  && <Badge color="red">Packet Loss</Badge>}
          {wanDowntime && <Badge color="red">WAN Downtime</Badge>}
        </div>
      )}
      {!hasIssues && (
        <p className="mt-4 text-green-400 text-sm">No active issues</p>
      )}
    </Card>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">WAN / ISP Health</p>
      {children}
    </div>
  )
}

function Stat({ label, value, valueClass = 'text-white', sub }: { label: string; value: string; valueClass?: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`font-semibold text-sm ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function Badge({ children, color }: { children: React.ReactNode; color: 'yellow' | 'red' }) {
  const cls = color === 'yellow'
    ? 'bg-yellow-900/40 text-yellow-300 border-yellow-700'
    : 'bg-red-900/40 text-red-300 border-red-700'
  return (
    <span className={`text-xs px-2 py-1 rounded border ${cls}`}>{children}</span>
  )
}
