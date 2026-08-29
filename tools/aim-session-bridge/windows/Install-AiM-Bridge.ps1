param(
  [string]$WatchFolder = "",
  [string]$ApiBaseUrl = "https://motorsportmanagement.vercel.app",
  [switch]$NoAutostart
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

if (-not [Environment]::Is64BitOperatingSystem) {
  throw "Motorsport Management AiM Bridge richiede Windows x64."
}

$sourceRoot = Split-Path -Parent $PSScriptRoot
$installRoot = Join-Path $env:LOCALAPPDATA "MotorsportManagement\AiMBridge"
$appRoot = Join-Path $installRoot "app"
$dataRoot = Join-Path $installRoot "data"
$runtimeRoot = Join-Path $installRoot "runtime"
$secretPath = Join-Path $dataRoot "device-key.dpapi"
$configPath = Join-Path $dataRoot "config.json"
$statePath = Join-Path $dataRoot "state.json"
$statusPath = Join-Path $dataRoot "status.json"
$logPath = Join-Path $dataRoot "bridge.log"
$nodeVersion = "22.16.0"

function Write-Step([string]$Text) {
  Write-Host ""
  Write-Host "==> $Text" -ForegroundColor Cyan
}

function Copy-BridgeApp {
  Write-Step "Installazione file bridge"
  New-Item -ItemType Directory -Force -Path $installRoot,$appRoot,$dataRoot,$runtimeRoot | Out-Null
  $sourceFull = [IO.Path]::GetFullPath($sourceRoot).TrimEnd('\')
  $appFull = [IO.Path]::GetFullPath($appRoot).TrimEnd('\')
  if ($sourceFull -ne $appFull) {
    if (Test-Path -LiteralPath $appRoot) {
      Get-ChildItem -LiteralPath $appRoot -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    }
    Get-ChildItem -LiteralPath $sourceRoot -Force |
      Where-Object { $_.Name -notin @('node_modules','config.json','.mm-aim-bridge-state.json','.mm-aim-bridge-status.json','runtime') } |
      ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $appRoot -Recurse -Force }
  }
}

function Ensure-PortableNode {
  $nodeExe = Join-Path $runtimeRoot "node.exe"
  $npmCmd = Join-Path $runtimeRoot "npm.cmd"
  if ((Test-Path -LiteralPath $nodeExe) -and (Test-Path -LiteralPath $npmCmd)) { return }

  Write-Step "Download runtime Node.js portabile x64"
  $tmp = Join-Path ([IO.Path]::GetTempPath()) ("mm-node-" + [guid]::NewGuid().ToString('N'))
  $zip = Join-Path $tmp "node.zip"
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  try {
    $url = "https://nodejs.org/dist/v$nodeVersion/node-v$nodeVersion-win-x64.zip"
    Write-Host "Origine: $url"
    Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $zip
    Expand-Archive -LiteralPath $zip -DestinationPath $tmp -Force
    $expanded = Get-ChildItem -LiteralPath $tmp -Directory | Where-Object { $_.Name -like 'node-v*-win-x64' } | Select-Object -First 1
    if ($null -eq $expanded) { throw "Runtime Node x64 non trovato nell'archivio." }
    Get-ChildItem -LiteralPath $runtimeRoot -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    Copy-Item -Path (Join-Path $expanded.FullName '*') -Destination $runtimeRoot -Recurse -Force
  }
  finally {
    Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
  }
}

function Ensure-Dependencies {
  Write-Step "Installazione dipendenze bridge"
  $npm = Join-Path $runtimeRoot "npm.cmd"
  if (-not (Test-Path -LiteralPath (Join-Path $appRoot "node_modules\aim-xrk"))) {
    Push-Location $appRoot
    try {
      & $npm install --omit=dev --no-audit --no-fund
      if ($LASTEXITCODE -ne 0) { throw "npm install fallito con codice $LASTEXITCODE" }
    }
    finally { Pop-Location }
  }
}

function Ensure-AimDll {
  Write-Step "Installazione provider DLL ufficiale AiM"
  $installer = Join-Path $appRoot "native\install-aim-official-dll.ps1"
  if (-not (Test-Path -LiteralPath $installer)) { throw "Installer DLL AiM non trovato: $installer" }
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer
  if ($LASTEXITCODE -ne 0) { throw "Installazione provider DLL AiM fallita." }
}

function Select-WatchFolder {
  if ($WatchFolder) {
    $resolved = [IO.Path]::GetFullPath($WatchFolder)
    if (-not (Test-Path -LiteralPath $resolved -PathType Container)) { throw "Cartella Race Studio non trovata: $resolved" }
    return $resolved
  }
  Add-Type -AssemblyName System.Windows.Forms
  $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
  $dialog.Description = "Seleziona la cartella Race Studio che contiene i file XRK/XRZ"
  $dialog.ShowNewFolderButton = $false
  $result = $dialog.ShowDialog()
  if ($result -ne [System.Windows.Forms.DialogResult]::OK) { throw "Installazione annullata: cartella Race Studio non selezionata." }
  return [IO.Path]::GetFullPath($dialog.SelectedPath)
}

function Save-DeviceKey {
  Write-Step "Configurazione Device Key"
  Write-Host "La Device Key viene cifrata con Windows DPAPI e resta leggibile solo dal tuo account Windows."
  $secure = Read-Host "Incolla la Device Key di Logger Test / device associato" -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    if ([string]::IsNullOrWhiteSpace($plain) -or $plain.Length -lt 20) { throw "Device Key non valida o troppo corta." }
  }
  finally {
    if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
    $plain = $null
  }
  $secure | ConvertFrom-SecureString | Set-Content -LiteralPath $secretPath -Encoding ASCII
}

function Write-Config([string]$Folder) {
  Write-Step "Scrittura configurazione produzione"
  $config = [ordered]@{
    apiBaseUrl = $ApiBaseUrl.TrimEnd('/')
    watchFolders = @($Folder)
    recursive = $true
    stableSeconds = 15
    scanIntervalSeconds = 5
    ignoreExistingOnFirstRun = $true
    retryBaseSeconds = 60
    retryMaxSeconds = 3600
    stateFile = $statePath
    statusFile = $statusPath
    deviceKey = ""
    deviceKeyEnv = "MM_DEVICE_KEY"
    timingProvider = "auto"
    aimDllPath = ""
    allowUnvalidatedTimingProvider = $false
    productionImportPolicy = "aim_track_session_strict_v1"
  }
  $config | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $configPath -Encoding UTF8
}

function Register-Autostart {
  if ($NoAutostart) { return }
  Write-Step "Attivazione avvio automatico Windows"
  $runner = Join-Path $appRoot "windows\Run-AiM-Bridge.ps1"
  $command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$runner`""
  $runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
  New-Item -Path $runKey -Force | Out-Null
  New-ItemProperty -Path $runKey -Name "MotorsportManagementAiMBridge" -Value $command -PropertyType String -Force | Out-Null
}

function Create-StartMenuShortcuts {
  Write-Step "Creazione collegamenti Motorsport Management"
  $programs = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Motorsport Management"
  New-Item -ItemType Directory -Force -Path $programs | Out-Null
  $shell = New-Object -ComObject WScript.Shell
  $items = @(
    @{ Name='AiM Bridge - Stato.lnk'; Script='Status-AiM-Bridge.ps1' },
    @{ Name='AiM Bridge - Avvia.lnk'; Script='Start-AiM-Bridge.ps1' },
    @{ Name='AiM Bridge - Arresta.lnk'; Script='Stop-AiM-Bridge.ps1' },
    @{ Name='AiM Bridge - Disinstalla.lnk'; Script='Uninstall-AiM-Bridge.ps1' }
  )
  foreach ($item in $items) {
    $shortcut = $shell.CreateShortcut((Join-Path $programs $item.Name))
    $shortcut.TargetPath = "powershell.exe"
    $script = Join-Path $appRoot ("windows\" + $item.Script)
    $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$script`""
    $shortcut.WorkingDirectory = $appRoot
    $shortcut.Save()
  }
}

function Start-Bridge {
  Write-Step "Avvio bridge in background"
  $starter = Join-Path $appRoot "windows\Start-AiM-Bridge.ps1"
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $starter
}

Write-Host "============================================================"
Write-Host " Motorsport Management - AiM Bridge Setup P2.9.5.1"
Write-Host "============================================================"
Write-Host "Installazione per utente Windows: $env:USERNAME"
Write-Host "Cartella: $installRoot"

Copy-BridgeApp
Ensure-PortableNode
Ensure-Dependencies
Ensure-AimDll
$selectedFolder = Select-WatchFolder
Save-DeviceKey
Write-Config $selectedFolder
Register-Autostart
Create-StartMenuShortcuts
Start-Bridge

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " INSTALLAZIONE COMPLETATA" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host "Cartella monitorata: $selectedFolder"
Write-Host "I file XRK/XRZ gia' presenti vengono registrati come BASELINE e NON importati."
Write-Host "Da ora in poi verranno importate automaticamente solo nuove sessioni valide."
Write-Host "Device Key: cifrata con DPAPI (non presente nel config in chiaro)."
Write-Host "Log: $logPath"
Write-Host "Stato: cerca 'AiM Bridge - Stato' nel menu Start."
