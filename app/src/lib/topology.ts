import type { Device, Client } from './unifi'

export type TopologyNodeType = 'internet' | 'gateway' | 'switch' | 'ap' | 'client'

export interface TopologyNode {
  id: string
  type: TopologyNodeType
  label: string
  sublabel: string | null
  ip: string | null
  online: boolean
  isWired: boolean | null
  signal: number | null
  children: TopologyNode[]
}

const GATEWAY_TYPES = new Set(['udm', 'ugw', 'uxg'])
const AP_TYPES = new Set(['uap'])

export function buildTopology(devices: Device[], clients: Client[]): TopologyNode | null {
  const gateway = devices.find((d) => GATEWAY_TYPES.has(d.type))
  if (!gateway) return null

  const visitedDevices = new Set<string>()
  const visitedClients = new Set<string>()

  function clientNode(c: Client): TopologyNode {
    visitedClients.add(c.mac)
    return {
      id: c.mac,
      type: 'client',
      label: c.name || c.hostname || c.mac,
      sublabel: c.network || null,
      ip: c.ip,
      online: true,
      isWired: c.is_wired,
      signal: c.signal,
      children: [],
    }
  }

  function deviceNode(d: Device): TopologyNode {
    visitedDevices.add(d.mac)
    const type: TopologyNodeType = GATEWAY_TYPES.has(d.type) ? 'gateway' : AP_TYPES.has(d.type) ? 'ap' : 'switch'

    const children: TopologyNode[] = []
    for (const child of devices) {
      if (child.mac !== d.mac && child.uplinkMac === d.mac && !visitedDevices.has(child.mac)) {
        children.push(deviceNode(child))
      }
    }
    for (const c of clients) {
      const parentMac = c.is_wired ? c.sw_mac : c.ap_mac
      if (parentMac === d.mac && !visitedClients.has(c.mac)) children.push(clientNode(c))
    }
    children.sort((a, b) => (a.type === b.type ? a.label.localeCompare(b.label) : a.type.localeCompare(b.type)))

    return {
      id: d.mac,
      type,
      label: d.name || d.model,
      sublabel: d.model,
      ip: d.ip,
      online: d.state === 1,
      isWired: null,
      signal: null,
      children,
    }
  }

  const gatewayNode = deviceNode(gateway)

  // Anything the controller didn't report an uplink for still gets shown, attached
  // directly under the gateway, so devices/clients never silently disappear.
  for (const d of devices) {
    if (!visitedDevices.has(d.mac)) gatewayNode.children.push(deviceNode(d))
  }
  for (const c of clients) {
    if (!visitedClients.has(c.mac)) gatewayNode.children.push(clientNode(c))
  }

  return {
    id: 'internet',
    type: 'internet',
    label: 'Internet',
    sublabel: null,
    ip: null,
    online: true,
    isWired: null,
    signal: null,
    children: [gatewayNode],
  }
}
