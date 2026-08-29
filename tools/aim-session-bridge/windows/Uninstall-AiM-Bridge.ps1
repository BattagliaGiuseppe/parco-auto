$ErrorActionPreference = "SilentlyContinue"
$installRoot = Join-Path $env:LOCALAPPDATA "MotorsportManagement\AiMBridge"
$appRoot = Join-Path $installRoot "app"
$stopper = Join-Path $appRoot "windows\Stop-AiM-Bridge.ps1"
if (Test-Path -LiteralPath $stopper) { & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $stopper | Out-Null }
Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "MotorsportManagementAiMBridge" -ErrorAction SilentlyContinue
$programs = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Motorsport Management"
Remove-Item -LiteralPath $programs -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "Avvio automatico rimosso e bridge arrestato."
$answer = Read-Host "Vuoi eliminare anche configurazione, Device Key cifrata, stato e log? Scrivi ELIMINA"
if ($answer -ceq "ELIMINA") {
  Start-Process -FilePath "cmd.exe" -ArgumentList @('/c',"ping 127.0.0.1 -n 2 > nul & rmdir /s /q `"$installRoot`"") -WindowStyle Hidden
  Write-Host "Disinstallazione completa programmata."
} else {
  Write-Host "Dati locali conservati in: $installRoot"
}
