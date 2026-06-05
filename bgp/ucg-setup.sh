#!/bin/bash
# Install and configure FRR BGP on UCG Ultra (UDRULT / UCG Ultra)
# Run via: ssh root@192.168.178.1 'bash -s' < ucg-setup.sh
set -euo pipefail

UCG_AS=65000
UCG_ROUTER_ID=192.168.178.1
PEER_IP=192.168.30.177
PEER_AS=64512   # Calico default AS

echo "==> Checking FRR..."
if ! command -v vtysh &>/dev/null; then
  echo "==> Installing FRR..."
  apt-get update -qq
  apt-get install -y frr
fi

echo "==> Enabling bgpd daemon..."
if grep -q "^bgpd=no" /etc/frr/daemons; then
  sed -i 's/^bgpd=no/bgpd=yes/' /etc/frr/daemons
fi
if grep -q "^zebra=no" /etc/frr/daemons; then
  sed -i 's/^zebra=no/zebra=yes/' /etc/frr/daemons
fi

echo "==> Writing /etc/frr/frr.conf..."
cat > /etc/frr/frr.conf << EOF
frr version 9.1
frr defaults traditional
hostname ucg-ultra
log syslog informational
!
router bgp ${UCG_AS}
 bgp router-id ${UCG_ROUTER_ID}
 no bgp ebgp-requires-policy
 !
 neighbor ${PEER_IP} remote-as ${PEER_AS}
 neighbor ${PEER_IP} description calico-kind
 neighbor ${PEER_IP} timers 10 30
 neighbor ${PEER_IP} passive
 !
 address-family ipv4 unicast
  neighbor ${PEER_IP} activate
  neighbor ${PEER_IP} soft-reconfiguration inbound
 exit-address-family
!
line vty
!
EOF

chown frr:frr /etc/frr/frr.conf
chmod 640 /etc/frr/frr.conf

echo "==> Allowing BGP (TCP 179) from peer in firewall..."
if ! iptables -C INPUT -s "${PEER_IP}" -p tcp --dport 179 -j ACCEPT 2>/dev/null; then
  iptables -I INPUT -s "${PEER_IP}" -p tcp --dport 179 -j ACCEPT
fi
# Persist across reboots if iptables-save is available
if command -v iptables-save &>/dev/null; then
  iptables-save > /etc/iptables/rules.v4 2>/dev/null || true
fi

echo "==> Starting / restarting FRR..."
systemctl enable frr
systemctl restart frr
sleep 3

echo "==> FRR status:"
systemctl is-active frr

echo ""
echo "Done. To check BGP session once peer is up:"
echo "  vtysh -c 'show bgp summary'"
echo "  vtysh -c 'show ip route bgp'"
