// Static export of a WordPress page (source is marked private on WordPress; this
// snapshot is intentionally committed to this public repo).
export const title = 'Home Network Overview'
export const sourceUrl = ''
export const lastModified = ''

export const html = `
<h2 class="wp-block-heading">Overview</h2>

<p>Reference page for the home network: gateway, switch, access point, VLAN layout, and connected devices.</p>

<ul class="wp-block-list"><li><strong>Gateway:</strong> Ubiquiti UCG Ultra</li>

<li><strong>ISP:</strong> Ziggo (Vodafone Libertel B.V.)</li>

<li><strong>Site:</strong> Default</li>

<li><strong>UniFi controller </a></li>
</ul>

<h2 class="wp-block-heading">Hardware Devices</h2>

<figure class="wp-block-table"><table class="has-fixed-layout"><thead><tr><th>Device</th><th>Model</th><th>Role</th><th>Management IP</th><th>Notes</th></tr></thead><tbody><tr><td>unifi-gateway</td><td>UCG Ultra</td><td>Gateway / router</td><td>—</td><td>Ziggo WAN, IPS enabled</td></tr><tr><td>unifi-switch</td><td>USW-Lite-8-PoE</td><td>Switch</td><td>192.168.10.8</td><td>Firmware 7.5.10.17129</td></tr><tr><td>unify-ap</td><td>U7 Pro XG</td><td>Access point</td><td>192.168.10.2</td><td>Firmware 8.6.11.18870, SSID “Hessel-Wifi”</td></tr></tbody></table></figure>

<h2 class="wp-block-heading">Network Layout (VLANs)</h2>

<figure class="wp-block-table"><table class="has-fixed-layout"><thead><tr><th>Network</th><th>VLAN</th><th>Subnet</th><th>Purpose</th></tr></thead><tbody><tr><td>Default</td><td>— (untagged)</td><td>192.168.178.0/24</td><td>Original LAN</td></tr><tr><td>Management</td><td>10</td><td>192.168.10.0/28</td><td>Switch &amp; AP management</td></tr><tr><td>Servers</td><td>50</td><td>192.168.50.0/24</td><td>Home Assistant, Docker host</td></tr><tr><td>IoT</td><td>40</td><td>192.168.40.0/24</td><td>Smart home devices</td></tr><tr><td>Trusted</td><td>30</td><td>192.168.30.0/24</td><td>Personal devices (laptop, phone)</td></tr><tr><td>Untrusted</td><td>20</td><td>192.168.20.0/24</td><td>Isolated / guest-style devices</td></tr><tr><td>HoneyPot</td><td>5</td><td>192.168.3.0/24</td><td>Decoy/guest network</td></tr><tr><td>WG-Server-Hessel</td><td>—</td><td>192.168.2.0/24</td><td>WireGuard remote-access VPN</td></tr></tbody></table></figure>

<h2 class="wp-block-heading">Topology</h2>

<p>Internet → <strong>UCG Ultra</strong> gateway → <strong>USW-Lite-8-PoE</strong> switch, which feeds the wired IoT and server devices and uplinks the <strong>U7 Pro XG</strong> access point. One device (work laptop) is plugged directly into the gateway’s own switch port. The access point serves wireless clients on the Trusted and IoT VLANs over the “Hessel-Wifi” SSID.</p>

<h2 class="wp-block-heading">Connected Clients</h2>

<figure class="wp-block-table"><table class="has-fixed-layout"><thead><tr><th>Device</th><th>Network</th><th>IP</th><th>Connection</th></tr></thead><tbody><tr><td>ha-server (Home Assistant)</td><td>Servers</td><td>192.168.50.2</td><td>Wired</td></tr><tr><td>docker-server</td><td>Servers</td><td>192.168.50.3</td><td>Wired</td></tr><tr><td>tado thermostat</td><td>IoT</td><td>192.168.40.4</td><td>Wired</td></tr><tr><td>tv-sander</td><td>IoT</td><td>192.168.40.3</td><td>Wired</td></tr><tr><td>HueBridge</td><td>IoT</td><td>192.168.40.5</td><td>Wired</td></tr><tr><td>HarmonyHub</td><td>IoT</td><td>192.168.40.2</td><td>Wi-Fi</td></tr><tr><td>Somfy Bridge</td><td>IoT</td><td>192.168.40.16</td><td>Wi-Fi</td></tr><tr><td>laptop-sander-dock</td><td>Trusted</td><td>192.168.30.177</td><td>Wired (on gateway)</td></tr><tr><td>A55-van-Sander (phone)</td><td>Trusted</td><td>192.168.30.110</td><td>Wi-Fi</td></tr></tbody></table></figure>

<p><em>WAN external IP and device MAC addresses are intentionally omitted from this page.</em></p>
`
