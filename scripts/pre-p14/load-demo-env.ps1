# Loads .env.demo.session then fills missing keys from .env.local (Auth).
# Never prints secret values. Intended for PATH B demo process starts.
$prevEap = $ErrorActionPreference
$ErrorActionPreference = 'Stop'
try {
  $root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

  function Import-EnvFile([string]$path, [string[]]$skipKeys = @()) {
    if (-not (Test-Path $path)) { return }
    Get-Content $path | ForEach-Object {
      $line = $_.Trim()
      if (-not $line -or $line.StartsWith('#')) { return }
      $eq = $line.IndexOf('=')
      if ($eq -lt 1) { return }
      $k = $line.Substring(0, $eq).Trim()
      $v = $line.Substring($eq + 1).Trim()
      if ($skipKeys -contains $k) { return }
      Set-Item -Path "env:$k" -Value $v
    }
  }

  Import-EnvFile (Join-Path $root '.env.demo.session')
  $env:DEMO_FORCE_LOCAL_DB = '1'
  Import-EnvFile (Join-Path $root '.env.local') @(
    'DATABASE_URL',
    'MIGRATION_DATABASE_URL',
    'REDIS_URL',
    'DEMO_FORCE_LOCAL_DB',
    'ZERO_COST_DEMO',
    'AI_ALLOW_FAKE',
    'BOOKING_SLOT_TOKEN_SECRET',
    'DEMO_SERVICE_ID',
    'DEMO_ORG_ID'
  )
  # Session wins again for demo overlay
  Import-EnvFile (Join-Path $root '.env.demo.session')
  $env:DEMO_FORCE_LOCAL_DB = '1'
  # Prefer asymmetric JWKS for hosted Auth (PATH B). HS256 secret breaks ECC-signed access tokens.
  Remove-Item Env:SUPABASE_JWT_SECRET -ErrorAction SilentlyContinue
  Write-Host "DEMO_DB_TARGET=LOCAL DEMO_REDIS_TARGET=LOCAL ZERO_COST_DEMO=$env:ZERO_COST_DEMO"
}
finally {
  $ErrorActionPreference = $prevEap
}
