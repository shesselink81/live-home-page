import type { Client } from '@/lib/unifi'
import { formatUptime, formatBytes, formatRate } from '@/lib/format'

interface Props { clients: Client[] | undefined; error?: string }

const VLAN_COLOR: Record<number, string> = {
  30: 'text-blue-400',
  40: 'text-orange-400',
  50: 'text-purple-400',
}

export default function ClientsTable({ clients, error }: Props) {
  const loading = clients === undefined && !error

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500 uppercase tracking-widest">Active Clients</p>
        <span className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded-full">
          {loading ? '—' : clients!.length}
        </span>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!loading && !error && clients!.length === 0 && <p className="text-gray-500 text-sm">No active clients</p>}

      {!loading && !error && clients!.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-gray-800">
                <th className="text-left pb-2 font-normal">Name</th>
                <th className="text-left pb-2 font-normal">IP</th>
                <th className="text-left pb-2 font-normal">Network</th>
                <th className="text-left pb-2 font-normal">Conn</th>
                <th className="text-right pb-2 font-normal">Signal</th>
                <th className="text-right pb-2 font-normal">TX / RX</th>
                <th className="text-right pb-2 font-normal">Uptime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {clients!.map((c) => (
                <tr key={c.mac} className="hover:bg-gray-800/40 transition-colors">
                  <td className="py-2 pr-3">
                    <p className="text-white font-medium truncate max-w-[140px]">
                      {c.name ?? c.hostname ?? c.mac}
                    </p>
                    <p className="text-gray-600 text-xs font-mono">{c.oui || c.mac}</p>
                  </td>
                  <td className="py-2 pr-3 font-mono text-gray-300 text-xs">{c.ip}</td>
                  <td className="py-2 pr-3">
                    <span className={`text-xs ${VLAN_COLOR[c.vlan] ?? 'text-gray-400'}`}>
                      {c.network}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    {c.is_wired ? (
                      <span className="text-xs text-gray-400">Wired</span>
                    ) : (
                      <span className="text-xs text-cyan-400">
                        WiFi {c.essid ? `· ${c.essid}` : ''}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {c.signal !== null ? (
                      <SignalBadge signal={c.signal} />
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right text-xs text-gray-400 font-mono">
                    {formatBytes(c.tx_bytes)} / {formatBytes(c.rx_bytes)}
                  </td>
                  <td className="py-2 text-right text-xs text-gray-400">
                    {formatUptime(c.uptime)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SignalBadge({ signal }: { signal: number }) {
  const cls =
    signal >= -60 ? 'text-green-400' :
    signal >= -75 ? 'text-yellow-400' :
    'text-red-400'
  return <span className={`text-xs font-mono ${cls}`}>{signal} dBm</span>
}
