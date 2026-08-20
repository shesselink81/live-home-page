import type { NetworkConf } from '@/lib/unifi'

interface Props { networks: NetworkConf[] | undefined; error?: string }

const PURPOSE_LABEL: Record<string, string> = {
  corporate: 'LAN',
  guest: 'Guest',
  wan: 'WAN',
  'vlan-only': 'VLAN-only',
  remote_user_vpn: 'VPN',
  'site-vpn': 'Site VPN',
}

export default function NetworksTable({ networks, error }: Props) {
  const loading = networks === undefined && !error

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500 uppercase tracking-widest">Networks &amp; VLANs</p>
        <span className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded-full">
          {loading ? '—' : networks!.length}
        </span>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!loading && !error && networks!.length === 0 && <p className="text-gray-500 text-sm">No networks configured</p>}

      {!loading && !error && networks!.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-gray-800">
                <th className="text-left pb-2 font-normal">Network</th>
                <th className="text-left pb-2 font-normal">VLAN</th>
                <th className="text-left pb-2 font-normal">Subnet</th>
                <th className="text-left pb-2 font-normal">Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {networks!.map((n) => (
                <tr key={n.id} className="hover:bg-gray-800/40 transition-colors">
                  <td className="py-2 pr-3 text-white font-medium">{n.name}</td>
                  <td className="py-2 pr-3 font-mono text-gray-300 text-xs">{n.vlan ?? '— (untagged)'}</td>
                  <td className="py-2 pr-3 font-mono text-gray-300 text-xs">{n.subnet ?? '—'}</td>
                  <td className="py-2 pr-3 text-xs text-gray-400">{PURPOSE_LABEL[n.purpose] ?? n.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
