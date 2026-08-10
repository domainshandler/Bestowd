# Bestowd dev server
# Usage: .\dev.ps1
#   Starts the API on http://localhost:3000 (hot-reload via tsx watch)

$env:PATH = "C:\Program Files\nodejs;$env:APPDATA\npm;" + $env:PATH

$envFile = Join-Path $PSScriptRoot "apps\api\.env"
if (-not (Test-Path $envFile)) {
    Write-Error "Missing apps\api\.env — copy .env.example and fill in your credentials"
    exit 1
}

# Load .env into current process so tsx inherits it
Get-Content $envFile | Where-Object { $_ -match '^\s*[^#]' -and $_ -match '=' } | ForEach-Object {
    $parts = $_ -split '=', 2
    [System.Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), 'Process')
}

Write-Host "Starting Bestowd API..." -ForegroundColor Cyan
Write-Host "  http://localhost:3000/health`n" -ForegroundColor DarkGray

& "$env:APPDATA\npm\pnpm.cmd" --filter api dev
