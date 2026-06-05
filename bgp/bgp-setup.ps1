#Requires -RunAsAdministrator
# BGP setup helper for Windows + kind/Calico -> UCG Ultra
#
# UCG Ultra FRR runs in PASSIVE mode: it never initiates BGP.
# Calico BIRD initiates the connection to 192.168.30.1:179 (outbound from Docker
# through Windows NAT), so no port-proxy is needed. This script only ensures
# Windows Firewall allows the return traffic and verifies reachability.
#
# Usage:
#   .\bgp-setup.ps1 [-KindLbNodeIp <ip>] [-Remove]

param(
    [string]$KindLbNodeIp = "",
    [switch]$Remove
)

$FwRuleName = "Calico-BGP-179"
$UcgIp      = "192.168.30.1"
$Port       = 179

if ($Remove) {
    Write-Host "==> Removing firewall rule '$FwRuleName'..."
    Remove-NetFirewallRule -DisplayName $FwRuleName -ErrorAction SilentlyContinue
    Write-Host "Done."
    exit 0
}

# --- Firewall: allow inbound BGP replies from UCG Ultra ---
Write-Host "==> Adding firewall rule for BGP (TCP $Port inbound from $UcgIp)..."
$existing = Get-NetFirewallRule -DisplayName $FwRuleName -ErrorAction SilentlyContinue
if (-not $existing) {
    New-NetFirewallRule `
        -DisplayName $FwRuleName `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort $Port `
        -RemoteAddress $UcgIp `
        -Action Allow | Out-Null
    Write-Host "  Rule created."
} else {
    Write-Host "  Rule already exists, skipping."
}

# --- Verify Docker can reach UCG Ultra port 179 ---
if ($KindLbNodeIp -ne "") {
    Write-Host ""
    Write-Host "==> Testing TCP reachability $KindLbNodeIp -> ${UcgIp}:${Port} via docker exec..."
    $result = docker exec $KindLbNodeIp `
        bash -c "timeout 3 bash -c 'echo > /dev/tcp/$UcgIp/$Port' 2>&1 && echo OK || echo FAILED" 2>&1
    Write-Host "  Result: $result"
} else {
    Write-Host ""
    Write-Host "Tip: pass -KindLbNodeIp <container-name-or-ip> to test connectivity, e.g.:"
    Write-Host "  .\bgp-setup.ps1 -KindLbNodeIp kind-platform-load-balancer"
}

Write-Host ""
Write-Host "==> Next steps:"
Write-Host "  1. ssh root@192.168.178.1 'bash -s' < bgp\ucg-setup.sh"
Write-Host "  2. kubectl apply -f bgp\calico-bgp-config.yaml"
Write-Host "  3. kubectl apply -f bgp\calico-bgp-peer.yaml"
Write-Host "  4. Check session:"
Write-Host "       kubectl exec -n calico-system ds/calico-node -- birdcl show protocols"
Write-Host "       ssh root@192.168.178.1 ""vtysh -c 'show bgp summary'"""
