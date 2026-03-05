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
  npm.cmd install
  Pop-Location
}

$backendProc = Start-Process powershell -PassThru -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$backendPath'; $env:RELOAD='1'; python run.py"
)

$frontendProc = Start-Process powershell -PassThru -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$frontendPath'; npm.cmd run dev"
)

Write-Host "Backend PID: $($backendProc.Id)"
Write-Host "Frontend PID: $($frontendProc.Id)"
Write-Host "Backend: http://localhost:8000"
Write-Host "Frontend: http://localhost:5173"
Write-Host "Close the spawned terminals to stop services."

Wait-Process -Id $backendProc.Id, $frontendProc.Id
