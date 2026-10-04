---
name: unifi
description: >
  Manage UniFi network infrastructure via the UniFi MCP Server. Use this skill
  for any task involving UniFi devices, clients, networks, VLANs, WiFi, firewall
  rules, zone-based firewall, VPNs, traffic monitoring, backups, RADIUS, QoS,
  DPI, port forwarding, ACLs, DHCP, DNS, or site management. Triggers when the
  user mentions UniFi, Ubiquiti, network clients, APs, switches, gateways,
  firewall policies, or traffic flows in a network management context.
triggers:
  - UniFi
  - Ubiquiti
  - network clients
  - access point
  - UniFi switch
  - UniFi gateway
  - firewall policy
  - VLAN management
  - traffic flows
  - SSID
  - WiFi network
  - site controller
---

# UniFi MCP Server Skill

Interact with your UniFi Network Controller using 86+ MCP tools across six
capability domains. The server supports three API modes (local gateway,
cloud-v1, cloud-ea) and requires UniFi Network 9.0+ for zone-based firewall
features.

## Quick Setup

### Via MCP (recommended for full tool access)

Add to your MCP client config (`~/.claude/mcp.json` or equivalent):

```json
{
  "mcpServers": {
    "unifi": {
      "command": "uvx",
      "args": ["unifi-mcp-server"],
      "env": {
        "UNIFI_API_KEY": "your-api-key",
        "UNIFI_API_TYPE": "local",
        "UNIFI_LOCAL_HOST": "192.168.2.1"
      }
    }
  }
}
```

### Via CLI (scoped invocation without loading all tools into context)

```bash
# Install
pip install unifi-mcp-server
# or: uvx unifi-mcp-server --help

# Set credentials once
export UNIFI_API_KEY=your-api-key
export UNIFI_API_TYPE=local
export UNIFI_LOCAL_HOST=192.168.2.1

# Run any tool directly
unifi-cli list-clients --site default
unifi-cli get-device-details --site default --device-id <id>
```

### Scoped MCP profiles (reduce context footprint)

Start the server with only the tools you need:

```bash
unifi-mcp-server --profile network    # clients, VLANs, WiFi, DHCP, DNS
unifi-mcp-server --profile devices    # device management and control
unifi-mcp-server --profile security   # firewall, VPN, ACLs, content filtering
unifi-mcp-server --profile system     # backups, QoS, traffic flows, sites
```

---

## Capability Domains

### Network Operations (`skills/unifi-network.md`)
Clients · VLANs · WiFi (SSIDs) · DHCP reservations · DNS · WAN · Vouchers

### Device Management (`skills/unifi-devices.md`)
Inventory · Adoption · Restarts/upgrades · Radio config · Port profiles ·
Switching/stacks · Topology · Diagnostics

### Security (`skills/unifi-security.md`)
Firewall rules · Firewall groups · Zone-based firewall (ZBF) · ACLs ·
Port forwarding · VPN · Site-to-site VPN · Content filtering

### System & Monitoring (`skills/unifi-system.md`)
Sites · Multi-site aggregation · Backups · QoS / traffic routes ·
Traffic flow analytics · DPI · RADIUS · Guest portal · Hotspot packages

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `UNIFI_API_KEY` | API key from UniFi controller or unifi.ui.com | required |
| `UNIFI_API_TYPE` | `local`, `cloud-v1`, or `cloud-ea` | `cloud-v1` |
| `UNIFI_LOCAL_HOST` | Gateway IP (local mode only) | — |
| `UNIFI_SITE` | Default site ID | `default` |
| `UNIFI_VERIFY_SSL` | Verify TLS certificates | `true` |

## API Mode Feature Matrix

| Feature | local | cloud-v1 | cloud-ea |
|---|---|---|---|
| Zone-based firewall | ✅ | ❌ | ❌ |
| Traffic flows | ✅ | ❌ | ❌ |
| Firewall rules/zones | ✅ | ❌ | ❌ |
| ACLs | ❌ | ✅ | ✅ |
| Traffic matching lists | ❌ | ✅ | ✅ |
| Site aggregation | ✅ | ✅ | ✅ |
| Device management | ✅ | ✅ | ✅ |

## Usage Examples

```
# Check what clients are online on the main site
List all active clients on site "default"

# Investigate a device
Get details for the device with MAC aa:bb:cc:dd:ee:ff

# Firewall audit
List all firewall policies in zone-based firewall

# Bandwidth troubleshooting
Show top traffic flows for the last hour

# Backup before a change
Trigger a backup on site "default", then update the guest SSID password
```