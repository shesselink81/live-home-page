# Active context

**Current focus**: Gateway security hardening — UCG Ultra analyse en firewall cleanup (2026-06-07).

**Completed this session**:

- [x] Volledige gateway-analyse uitgevoerd (hardware, VLANs, clients, firewall, DNS, port forwards)
- [x] Logging aangezet op alle 4 custom BLOCK-regels zonder logging
- [x] IoT firewall regels aangepast door gebruiker (details niet in sessie zichtbaar)

**Open hardening items (prioriteit volgorde)**:

- [ ] **Hoog** — DNS fallback toevoegen aan Default-netwerk (192.168.178.0/24): nu alleen 192.168.50.3 (docker-server), geen fallback
- [ ] **Hoog** — Dubbele "Allow DNS to DMZ" regel verwijderen (twee identieke custom regels)
- [ ] **Gemiddeld** — "Allow SSH to External" beperken: nu vanuit Servers VLAN naar ANY poort 22; inperken tot specifieke jump hosts
- [ ] **Gemiddeld** — "Allow SNMP" logging aanzetten + destination scope verkleinen (nu naar ANY zonder logging)
- [ ] **Check** — IPv6 bereikbaarheid ha-server (192.168.50.2) via Ziggo — hostname resolvet naar publiek IPv6-adres

**Gateway facts (voor volgende sessie)**:

- Model: UCG Ultra (model-id UDRULT), firmware 5.1.15.33416
- WAN IP: 217.120.215.226 (Ziggo kabel), WAN uptime ~42 uur t.t.v. analyse
- VLANs: Default (178.x), HoneyPot (VLAN5), Mgmt (VLAN10), Untrusted (VLAN20), Trusted (VLAN30), IoT (VLAN40), Servers (VLAN50), WG-VPN (192.168.2.x)
- DNS primary voor bijna alle VLANs: 192.168.50.3 (docker-server); fallback: 192.168.50.2 (ha-server, Raspberry Pi)
- Port forward: 80+443 → ha-server (192.168.50.2), logged
- WireGuard VPN: WG-Server-Hessel, 192.168.2.0/24

**Open questions**:

- Waarvoor dienen de IP-blokken 192.168.50.2 ↔ 139.5.1.103? (specifiek geblokkeerd verkeer — context onduidelijk)
- Is de HoneyPot VLAN actief gemonitord?

_Update when the task or branch focus changes._
