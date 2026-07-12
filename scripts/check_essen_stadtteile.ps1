param(
  [switch]$NoBrowser,
  [switch]$NonInteractive,
  [switch]$KeepServices
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$dockerDesktop = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
$netlifyProcess = $null
$supabaseStarted = $false
$dockerStartedByScript = $false
$exitCode = 0
$stdoutLog = Join-Path $env:TEMP "essen-stadtteile-netlify.out.log"
$stderrLog = Join-Path $env:TEMP "essen-stadtteile-netlify.err.log"
$supabaseLog = Join-Path $env:TEMP "essen-stadtteile-supabase.log"

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments
  )

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$FilePath failed with exit code $LASTEXITCODE"
  }
}

function Wait-ForDocker {
  for ($attempt = 0; $attempt -lt 24; $attempt++) {
    if (Test-DockerReady) { return }
    Start-Sleep -Seconds 5
  }
  throw "Docker Desktop did not become ready within 120 seconds"
}

function Test-DockerReady {
  & cmd.exe /d /c "docker info >nul 2>nul"
  return $LASTEXITCODE -eq 0
}

function Get-LocalSupabaseEnvironment {
  $values = @{}
  $lines = & cmd.exe /d /c "npx.cmd --no-install supabase status -o env 2>nul"
  if ($LASTEXITCODE -ne 0) { throw "Unable to read local Supabase status" }

  foreach ($line in $lines) {
    if ($line -match '^([A-Z_]+)="(.*)"$') {
      $values[$matches[1]] = $matches[2]
    }
  }

  foreach ($required in @("API_URL", "DB_URL", "ANON_KEY")) {
    if (-not $values.ContainsKey($required)) {
      throw "Supabase status did not provide $required"
    }
  }
  if ($values.API_URL -notmatch '^http://127\.0\.0\.1:54321$') {
    throw "Refusing unexpected Supabase API URL: $($values.API_URL)"
  }
  if ($values.DB_URL -notmatch '^postgresql://[^@]+@127\.0\.0\.1:54322/postgres$') {
    throw "Refusing unexpected Supabase database URL"
  }
  return $values
}

function Start-LocalSupabase {
  & cmd.exe /d /c "npx.cmd --no-install supabase start >`"$supabaseLog`" 2>&1"
  if ($LASTEXITCODE -ne 0) {
    throw "Supabase failed to start. Log: $supabaseLog"
  }
}

function Stop-Netlify {
  if ($null -eq $netlifyProcess) { return }
  & taskkill.exe /PID $netlifyProcess.Id /T /F *> $null
  $script:netlifyProcess = $null
  Start-Sleep -Seconds 2
}

function Remove-GeneratedArtifacts {
  foreach ($relativePath in @(".netlify", "deno.lock", "supabase\.branches", "supabase\.temp")) {
    $target = Join-Path $projectRoot $relativePath
    if (-not (Test-Path -LiteralPath $target)) { continue }

    $resolvedRoot = [IO.Path]::GetFullPath($projectRoot).TrimEnd('\') + '\'
    $resolvedTarget = [IO.Path]::GetFullPath($target)
    if (-not $resolvedTarget.StartsWith($resolvedRoot, [StringComparison]::OrdinalIgnoreCase)) {
      throw "Refusing to remove unsafe path: $resolvedTarget"
    }
    Remove-Item -LiteralPath $resolvedTarget -Recurse -Force -ErrorAction Stop
  }
}

Push-Location $projectRoot
try {
  Write-Host "`n=== Essen Stadtteile local verification ===" -ForegroundColor Cyan
  Write-Host "Project: $projectRoot"
  Write-Host "Warning: Supabase development ports may be reachable on the local network while this script runs." -ForegroundColor Yellow

  if (-not (Test-DockerReady)) {
    if (-not (Test-Path -LiteralPath $dockerDesktop)) {
      throw "Docker Desktop is not installed at $dockerDesktop"
    }
    Write-Host "[1/8] Starting Docker Desktop..."
    Start-Process -FilePath $dockerDesktop -WindowStyle Hidden
    $dockerStartedByScript = $true
    Wait-ForDocker
  } else {
    Write-Host "[1/8] Docker Desktop is already running."
  }

  Write-Host "[2/8] Running Node tests..."
  Invoke-Checked npm.cmd test

  Write-Host "[3/8] Starting local Supabase..."
  Start-LocalSupabase
  $supabaseStarted = $true

  $local = Get-LocalSupabaseEnvironment

  Write-Host "[4/8] Applying migration and resetting the local database..."
  Invoke-Checked npx.cmd --no-install supabase db reset

  Write-Host "[5/8] Importing the official Essen snapshot twice..."
  Invoke-Checked npm.cmd run import:stadtteile
  Invoke-Checked npm.cmd run import:stadtteile

  Write-Host "[6/8] Verifying PostGIS data..."
  $env:DATABASE_URL = $local.DB_URL
  Invoke-Checked node scripts\verify_stadtteilgrenzen.js

  Write-Host "[7/8] Verifying PostgREST with the local anon role..."
  $headers = @{ apikey = $local.ANON_KEY; Authorization = "Bearer $($local.ANON_KEY)" }
  $restRows = Invoke-RestMethod -Uri "$($local.API_URL)/rest/v1/stadtteilgrenzen_geojson?select=*" -Headers $headers
  if ($restRows.Count -ne 50) { throw "PostgREST returned $($restRows.Count) rows instead of 50" }
  Write-Host "PostgREST verified: HTTP 200, 50 rows."

  Write-Host "[8/8] Starting Netlify and verifying the proxy..."
  $env:SUPABASE_URL = $local.API_URL
  $env:SUPABASE_KEY = $local.ANON_KEY
  $netlifyProcess = Start-Process -FilePath "npm.cmd" `
    -ArgumentList @("run", "netlify:dev", "--", "--offline", "--port", "8888", "--no-open") `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -PassThru `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog

  $proxyRows = $null
  for ($attempt = 0; $attempt -lt 45; $attempt++) {
    Start-Sleep -Seconds 2
    try {
      $proxyRows = Invoke-RestMethod -Uri "http://127.0.0.1:8888/.netlify/functions/supabaseProxy?type=stadtteile"
      if ($proxyRows.Count -eq 50) { break }
    } catch {
      $proxyRows = $null
    }
  }
  if ($null -eq $proxyRows -or $proxyRows.Count -ne 50) {
    throw "Netlify proxy did not return 50 rows. Logs: $stdoutLog and $stderrLog"
  }
  Write-Host "Netlify proxy verified: HTTP 200, 50 rows." -ForegroundColor Green

  if (-not $NoBrowser) {
    Start-Process "http://127.0.0.1:8888/map.html"
  }

  Write-Host "`nVerification passed." -ForegroundColor Green
  Write-Host "In the map: open the menu, enable Stadtteile, and click a boundary."
  if (-not $NonInteractive) {
    Read-Host "Press Enter to stop local services and clean up"
  }
} catch {
  $exitCode = 1
  Write-Host "`nVerification failed: $($_.Exception.Message)" -ForegroundColor Red
  if (Test-Path -LiteralPath $stderrLog) {
    Write-Host "Netlify error log: $stderrLog"
  }
} finally {
  if (-not $KeepServices) {
    try { Stop-Netlify } catch { Write-Warning "Could not stop Netlify: $($_.Exception.Message)" }
    if ($supabaseStarted) {
      try { & npx.cmd --no-install supabase stop --no-backup } catch { Write-Warning "Could not stop Supabase" }
    }
    try { Remove-GeneratedArtifacts } catch { Write-Warning "Could not remove generated artifacts: $($_.Exception.Message)" }
    if ($dockerStartedByScript) {
      try { & docker desktop stop } catch { Write-Warning "Could not stop Docker Desktop" }
    }
  }

  foreach ($name in @("DATABASE_URL", "SUPABASE_URL", "SUPABASE_KEY")) {
    Remove-Item "Env:$name" -ErrorAction SilentlyContinue
  }
  foreach ($log in @($stdoutLog, $stderrLog, $supabaseLog)) {
    Remove-Item -LiteralPath $log -Force -ErrorAction SilentlyContinue
  }
  Pop-Location
}

exit $exitCode
