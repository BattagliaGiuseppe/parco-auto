$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

$installRoot = Join-Path $env:LOCALAPPDATA "MotorsportManagement\AiMBridge"
$appRoot = Join-Path $installRoot "app"
$dataRoot = Join-Path $installRoot "data"
$runtimeRoot = Join-Path $installRoot "runtime"
$secretPath = Join-Path $dataRoot "device-key.dpapi"
$configPath = Join-Path $dataRoot "config.json"
$logPath = Join-Path $dataRoot "bridge.log"
$nodeExe = Join-Path $runtimeRoot "node.exe"
$src = Join-Path $appRoot "src.mjs"

New-Item -ItemType Directory -Force -Path $dataRoot | Out-Null

$created = $false
$mutex = New-Object System.Threading.Mutex($false, "Local\MotorsportManagementAiMBridge", [ref]$created)
if (-not $created) { exit 0 }

function Rotate-Log {
  if ((Test-Path -LiteralPath $logPath) -and ((Get-Item -LiteralPath $logPath).Length -gt 5MB)) {
    $old = Join-Path $dataRoot "bridge.previous.log"
    Remove-Item -LiteralPath $old -Force -ErrorAction SilentlyContinue
    Move-Item -LiteralPath $logPath -Destination $old -Force
  }
}

try {
  if (-not (Test-Path -LiteralPath $nodeExe)) { throw "Runtime Node non trovato: $nodeExe" }
  if (-not (Test-Path -LiteralPath $src)) { throw "Bridge non trovato: $src" }
  if (-not (Test-Path -LiteralPath $configPath)) { throw "Config non trovato: $configPath" }
  if (-not (Test-Path -LiteralPath $secretPath)) { throw "Device Key cifrata non trovata: $secretPath" }

  $encrypted = (Get-Content -LiteralPath $secretPath -Raw).Trim()
  $secure = ConvertTo-SecureString $encrypted
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    if ([string]::IsNullOrWhiteSpace($plain)) { throw "Device Key DPAPI non decifrabile." }
    $env:MM_DEVICE_KEY = $plain
  }
  finally {
    if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
    $plain = $null
  }

  Rotate-Log
  Set-Location $appRoot
  "[$([DateTime]::Now.ToString('s'))] START bridge" | Add-Content -LiteralPath $logPath -Encoding UTF8
  & $nodeExe $src --config $configPath 2>&1 | Tee-Object -FilePath $logPath -Append
  $exit = $LASTEXITCODE
  "[$([DateTime]::Now.ToString('s'))] STOP bridge exit=$exit" | Add-Content -LiteralPath $logPath -Encoding UTF8
  exit $exit
}
catch {
  "[$([DateTime]::Now.ToString('s'))] FATAL $($_.Exception.Message)" | Add-Content -LiteralPath $logPath -Encoding UTF8
  exit 1
}
finally {
  $env:MM_DEVICE_KEY = $null
  if ($null -ne $mutex) { $mutex.ReleaseMutex(); $mutex.Dispose() }
}
