$version="1.1.7" # --- UPDATE THIS VERSION NUMBER ---

# Update .env so docker compose picks up the new version locally
$envFile = Join-Path $PSScriptRoot ".env"
$content = Get-Content $envFile -ErrorAction SilentlyContinue | Where-Object { $_ -notmatch '^VERSION=' }
($content + "VERSION=$version") | Set-Content $envFile -Encoding utf8

git tag -a v$version -m "Release version $version"
git push origin v$version
Write-Host "Tag v$version created and pushed to origin."