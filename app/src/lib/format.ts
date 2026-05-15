export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '—'
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`
  return `${bytes} B`
}

export function formatRate(kbps: number | null): string {
  if (kbps === null || kbps === undefined) return '—'
  if (kbps >= 1e6) return `${(kbps / 1e6).toFixed(0)} Gbps`
  if (kbps >= 1e3) return `${(kbps / 1e3).toFixed(0)} Mbps`
  return `${kbps} Kbps`
}

export function deviceLabel(type: string): string {
  const map: Record<string, string> = { udm: 'Gateway', usw: 'Switch', uap: 'Access Point' }
  return map[type] ?? type.toUpperCase()
}
