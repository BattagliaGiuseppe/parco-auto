$ErrorActionPreference = "Stop"
$installRoot = Join-Path $env:LOCALAPPDATA "MotorsportManagement\AiMBridge"
$runner = Join-Path $installRoot "app\windows\Run-AiM-Bridge.ps1"
if (-not (Test-Path -LiteralPath $runner)) { throw "AiM Bridge non installato: $runner" }
Start-Process -FilePath "powershell.exe" -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File',('"'+$runner+'"')) -WindowStyle Hidden
Start-Sleep -Seconds 2
& (Join-Path $installRoot "app\windows\Status-AiM-Bridge.ps1")
