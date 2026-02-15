param(
  [switch]$SkipNpmInstall
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = Join-Path $root "backend"
$frontendPath = Join-Path $root "frontend"

Write-Host "Starting backend and frontend..."

if (-not $SkipNpmInstall) {
  Write-Host "Installing frontend dependencies..."
  Push-Location $frontendPath
  npm install
  Pop-Location
}

$backendProc = Start-Process powershell -PassThru -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$backendPath'; python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
)

$frontendProc = Start-Process powershell -PassThru -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$frontendPath'; npm run dev"
)

Write-Host "Backend PID: $($backendProc.Id)"
Write-Host "Frontend PID: $($frontendProc.Id)"
Write-Host "Backend: http://localhost:8000"
Write-Host "Frontend: http://localhost:5173"
Write-Host "Close the spawned terminals to stop services."

Wait-Process -Id $backendProc.Id, $frontendProc.Id
