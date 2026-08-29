$ErrorActionPreference = "SilentlyContinue"
$installRoot = Join-Path $env:LOCALAPPDATA "MotorsportManagement\AiMBridge"
$dataRoot = Join-Path $installRoot "data"
$statusPath = Join-Path $dataRoot "status.json"
$logPath = Join-Path $dataRoot "bridge.log"

Write-Host "============================================================"
Write-Host " Motorsport Management - AiM Bridge Status"
Write-Host "============================================================"
if (-not (Test-Path -LiteralPath $statusPath)) {
  Write-Host "Stato: NON AVVIATO / NON INSTALLATO"
  Write-Host "Status file: $statusPath"
} else {
  $s = Get-Content -LiteralPath $statusPath -Raw | ConvertFrom-Json
  $running = $false
  if ($s.pid) {
    $p = Get-Process -Id ([int]$s.pid) -ErrorAction SilentlyContinue
    $running = ($null -ne $p -and $p.ProcessName -match '^node$')
  }
  Write-Host ("Processo       : " + $(if ($running) { "ATTIVO" } else { "NON ATTIVO" }))
  Write-Host "Bridge version : $($s.bridgeVersion)"
  Write-Host "Stato interno  : $($s.state)"
  Write-Host "Ultima scansione: $($s.lastScanAt)"
  Write-Host "Ultimo successo: $($s.lastSuccessAt)"
  Write-Host "Ultimo errore  : $($s.lastError)"
  Write-Host "File rilevati  : $($s.discoveredFiles)"
  Write-Host "Baseline ignorati: $($s.baselineIgnoredFiles)"
  Write-Host "Importati      : $($s.uploadedFiles)"
  Write-Host "In attesa      : $($s.waitingFiles)"
  Write-Host "Errori         : $($s.errorFiles)"
  Write-Host "Ultimo file    : $($s.lastFile)"
}

if (Test-Path -LiteralPath $logPath) {
  Write-Host ""
  Write-Host "---------------- ultimi log ----------------"
  Get-Content -LiteralPath $logPath -Tail 18
}
Write-Host ""
Write-Host "Premi INVIO per chiudere."
Read-Host | Out-Null
