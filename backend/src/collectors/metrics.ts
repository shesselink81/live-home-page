import { getDevices, getClients, type Device, type Client } from '../lib/unifi.js'

// Poll target for the Prometheus exporter (see ../metrics.ts). Only runs when
// METRICS_ENABLED=true — started by poller.ts. Scrapes never call UniFi
// directly; they render whatever the latest snapshot here holds, same
// decoupling as the rest of the poller.
export interface UnifiSnapshot {
  ts: number
  devices: Device[]
  clients: Client[]
}

export async function collectUnifiMetrics(): Promise<UnifiSnapshot> {
  const [devices, clients] = await Promise.all([getDevices(), getClients()])
  return { ts: Date.now(), devices, clients }
}
