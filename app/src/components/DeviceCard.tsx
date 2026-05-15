import type { Device } from '@/lib/unifi'
import { formatUptime, formatBytes, deviceLabel } from '@/lib/format'

const TYPE_ICON: Record<string, string> = {
  udm: '🌐',
  usw: '🔀',
  uap: '📡',
}

interface Props { device: Device }

export default function DeviceCard({ device }: Props) {
  const online = device.state === 1
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{TYPE_ICON[device.type] ?? '📦'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold truncate">{device.name}</p>
          <p className="text-gray-500 text-xs">{deviceLabel(device.type)} · {device.model}</p>
        </div>
        <span className={`flex-shrink-0 text-xs px-2 py-1 rounded-full border ${online ? 'bg-green-900/40 text-green-300 border-green-700' : 'bg-red-900/40 text-red-300 border-red-700'}`}>
          {online ? 'Online' : 'Offline'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <Row label="IP" value={device.ip} mono />
        <Row label="Uptime" value={formatUptime(device.uptime)} />
        <Row label="Firmware" value={device.version} mono />
        <Row label="MAC" value={device.mac} mono />
        <Row label="TX" value={formatBytes(device.tx_bytes)} />
        <Row label="RX" value={formatBytes(device.rx_bytes)} />
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-gray-500 text-xs">{label}</p>
      <p className={`text-gray-200 text-xs truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}
