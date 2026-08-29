$ErrorActionPreference = "SilentlyContinue"
$installRoot = Join-Path $env:LOCALAPPDATA "MotorsportManagement\AiMBridge"
$statusPath = Join-Path $installRoot "data\status.json"
if (-not (Test-Path -LiteralPath $statusPath)) {
  Write-Host "AiM Bridge: nessuno status file presente."
  exit 0
}
$status = Get-Content -LiteralPath $statusPath -Raw | ConvertFrom-Json
$pidValue = [int]$status.pid
if ($pidValue -gt 0) {
  $p = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
  if ($null -ne $p -and $p.ProcessName -match '^node$') {
    Stop-Process -Id $pidValue -Force
    Write-Host "AiM Bridge arrestato (PID $pidValue)."
    exit 0
  }
}
Write-Host "AiM Bridge non risulta in esecuzione."
