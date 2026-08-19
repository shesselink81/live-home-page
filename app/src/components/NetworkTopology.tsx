import type { TopologyNode } from '@/lib/topology'

interface Props { root: TopologyNode | null | undefined; error?: string }

const TYPE_ICON: Record<string, string> = {
  internet: '🌍',
  gateway: '🌐',
  switch: '🔀',
  ap: '📡',
}

export default function NetworkTopology({ root, error }: Props) {
  const loading = root === undefined && !error

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500 uppercase tracking-widest">Network Topology</p>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-400 text-xs">Live</span>
        </div>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!loading && !error && !root && <p className="text-gray-500 text-sm">No gateway found</p>}

      {root && (
        <div className="overflow-x-auto pb-4">
          <div className="flex justify-center min-w-max px-6 pt-2">
            <TopologyBranch node={root} />
          </div>
        </div>
      )}
    </div>
  )
}

function TopologyBranch({ node }: { node: TopologyNode }) {
  const hasChildren = node.children.length > 0
  return (
    <div className="flex flex-col items-center">
      <NodeCard node={node} />
      {hasChildren && (
        <>
          <div className="w-px h-5 bg-gray-700" />
          <div className="flex">
            {node.children.map((child, i) => (
              <div key={child.id} className="flex flex-col items-center px-3 relative">
                <div
                  className="absolute top-0 h-px bg-gray-700"
                  style={{
                    left: i === 0 ? '50%' : 0,
                    right: i === node.children.length - 1 ? '50%' : 0,
                  }}
                />
                <div className="w-px h-5 bg-gray-700" />
                <TopologyBranch node={child} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function NodeCard({ node }: { node: TopologyNode }) {
  const isClient = node.type === 'client'
  const icon = isClient ? (node.isWired ? '💻' : '📶') : TYPE_ICON[node.type]
  const signalColor =
    node.signal !== null && node.signal !== undefined
      ? node.signal >= -60 ? 'text-green-400' : node.signal >= -75 ? 'text-yellow-400' : 'text-red-400'
      : ''

  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-lg border px-3 py-2 w-32 ${
        node.online ? 'bg-gray-800 border-gray-700' : 'bg-red-950/30 border-red-900'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-lg leading-none">{icon}</span>
        {node.type !== 'internet' && (
          <span className={`w-1.5 h-1.5 rounded-full ${node.online ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />
        )}
      </div>
      <p className="text-white text-xs font-medium text-center truncate w-full" title={node.label}>
        {node.label}
      </p>
      {node.sublabel && (
        <p className="text-gray-500 text-[10px] text-center truncate w-full">{node.sublabel}</p>
      )}
      {node.ip && <p className="text-gray-600 text-[10px] font-mono">{node.ip}</p>}
      {isClient && node.signal !== null && (
        <p className={`text-[10px] font-mono ${signalColor}`}>{node.signal} dBm</p>
      )}
    </div>
  )
}
