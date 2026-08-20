import type { Device, Client, NetworkConf } from '@/lib/unifi'
import type { TopologyNode } from '@/lib/topology'
import DeviceCard from './DeviceCard'
import ClientsTable from './ClientsTable'
import NetworksTable from './NetworksTable'
import NetworkTopology from './NetworkTopology'

interface Props {
  devices: Device[] | undefined
  devError?: string
  clients: Client[] | undefined
  cliError?: string
  networks: NetworkConf[] | undefined
  netError?: string
  topology: TopologyNode | null | undefined
  topoError?: string
}

export default function HomeNetworkTab({
  devices, devError, clients, cliError, networks, netError, topology, topoError,
}: Props) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Hardware Devices</p>
        {devError && <p className="text-red-400 text-sm">{devError}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(devices ?? []).map((d) => (
            <DeviceCard key={d.mac} device={d} />
          ))}
          {!devices && !devError && [0, 1, 2].map((i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 animate-pulse h-40" />
          ))}
        </div>
      </div>

      <NetworksTable networks={networks} error={netError} />

      <NetworkTopology root={topology} error={topoError} />

      <ClientsTable clients={clients} error={cliError} />
    </div>
  )
}
