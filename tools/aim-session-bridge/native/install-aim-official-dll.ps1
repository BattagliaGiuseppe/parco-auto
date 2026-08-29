param(
  [string]$Url = "https://www.aim-sportline.com/aim-software-betas/DLL/TestMatLabXRK.zip"
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$vendor = Join-Path $root "vendor"
$official = Join-Path $vendor "official"
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("mm-aim-dll-" + [guid]::NewGuid().ToString("N"))
$zip = Join-Path $tmp "aim-official.zip"

function Get-PeMachine([string]$Path) {
  $fs = [System.IO.File]::Open($Path,[System.IO.FileMode]::Open,[System.IO.FileAccess]::Read,[System.IO.FileShare]::ReadWrite)
  try {
    $br = New-Object System.IO.BinaryReader($fs)
    $fs.Position = 0x3C
    $pe = $br.ReadInt32()
    $fs.Position = $pe + 4
    return $br.ReadUInt16()
  } finally { $fs.Dispose() }
}

New-Item -ItemType Directory -Force -Path $vendor,$tmp | Out-Null
try {
  Write-Host "Download pacchetto ufficiale AiM..."
  Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $zip
  Expand-Archive -LiteralPath $zip -DestinationPath $tmp -Force

  if (Test-Path -LiteralPath $official) { Remove-Item -LiteralPath $official -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $official | Out-Null

  # Conserva l'intero pacchetto ufficiale: alcune DLL native possono dipendere
  # da file presenti accanto alla DLL principale o in sottocartelle del progetto.
  Get-ChildItem -LiteralPath $tmp -Force |
    Where-Object { $_.FullName -ne $zip } |
    ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $official -Recurse -Force }

  $candidates = @(Get-ChildItem -Path $official -Recurse -File -Filter "*.dll" |
    Where-Object { $_.Name -match 'MatLabXRK' })
  if ($candidates.Count -eq 0) { throw "Nessuna MatLabXRK DLL trovata nell'archivio ufficiale." }

  $x64 = @()
  foreach ($c in $candidates) {
    try {
      $machine = Get-PeMachine $c.FullName
      if ($machine -eq 0x8664) { $x64 += $c }
    } catch {}
  }
  if ($x64.Count -eq 0) {
    $list = ($candidates | ForEach-Object { $_.FullName }) -join "`n"
    throw "Nessuna MatLabXRK DLL x64 trovata. Candidate:`n$list"
  }

  # Preferisci una DLL con x64/64 nel nome/percorso, ma verifica sempre il PE header.
  $dll = $x64 | Sort-Object @{Expression={ if ($_.FullName -match '(?i)(x64|64bit|_64|64\\)') {0} else {1} }}, FullName | Select-Object -First 1
  $dllDir = Split-Path -Parent $dll.FullName
  $fixed = Join-Path $dllDir "MatLabXRK.dll"
  if ($dll.FullName -ne $fixed) { Copy-Item -LiteralPath $dll.FullName -Destination $fixed -Force }

  $stageScript = Join-Path $root "prepare-x64-staging.ps1"
  $staging = Join-Path $root "staging-x64"
  if (-not (Test-Path -LiteralPath $stageScript)) { throw "Helper staging x64 non trovato: $stageScript" }
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $stageScript -DllPath $fixed -OfficialRoot $official -StagingDir $staging | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Preparazione staging x64 AiM fallita." }
  $stagedDll = Join-Path $staging "MatLabXRK.dll"
  if (-not (Test-Path -LiteralPath $stagedDll)) { throw "DLL AiM staged non trovata: $stagedDll" }

  Set-Content -LiteralPath (Join-Path $vendor "dll-path.txt") -Value $stagedDll -Encoding ASCII
  Set-Content -LiteralPath (Join-Path $vendor "source-url.txt") -Value $Url -Encoding ASCII

  Write-Host "DLL AiM x64 selezionata: $fixed"
  Write-Host "Staging runtime x64: $staging"
  Write-Host "DLL runtime: $stagedDll"
  Write-Host "Pacchetto ufficiale conservato in: $official"
  Write-Host "Origine: $Url"
}
finally { Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue }
