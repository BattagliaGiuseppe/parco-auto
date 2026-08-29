param(
  [string]$Url = "https://www.aim-sportline.com/aim-software-betas/DLL/TestMatLabXRK.zip"
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$vendor = Join-Path $root "vendor"
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("mm-aim-dll-" + [guid]::NewGuid().ToString("N"))
$zip = Join-Path $tmp "aim-official.zip"
New-Item -ItemType Directory -Force -Path $vendor,$tmp | Out-Null
try {
  Write-Host "Download DLL ufficiale AiM..."
  Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $zip
  Expand-Archive -LiteralPath $zip -DestinationPath $tmp -Force
  $dll = Get-ChildItem -Path $tmp -Recurse -File -Filter "*.dll" |
    Where-Object { $_.Name -match 'MatLabXRK' -and $_.Name -match '64' } |
    Select-Object -First 1
  if (-not $dll) { throw "Nessuna DLL AiM x64 trovata nell'archivio ufficiale." }
  $dest = Join-Path $vendor "MatLabXRK.dll"
  Copy-Item -LiteralPath $dll.FullName -Destination $dest -Force
  Write-Host "DLL AiM installata: $dest"
  Write-Host "Origine: $Url"
}
finally { Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue }
