param(
  [Parameter(Mandatory=$true)][string]$DllPath,
  [Parameter(Mandatory=$true)][string]$OfficialRoot,
  [Parameter(Mandatory=$true)][string]$StagingDir
)
$ErrorActionPreference='Stop'
function Get-PeMachine([string]$Path){
  $fs=[IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite)
  try{$br=New-Object IO.BinaryReader($fs);$fs.Position=0x3c;$pe=$br.ReadInt32();$fs.Position=$pe+4;return $br.ReadUInt16()}finally{$fs.Dispose()}
}
if(Test-Path -LiteralPath $StagingDir){Remove-Item -LiteralPath $StagingDir -Recurse -Force}
New-Item -ItemType Directory -Force -Path $StagingDir|Out-Null
Copy-Item -LiteralPath $DllPath -Destination (Join-Path $StagingDir 'MatLabXRK.dll') -Force
$copied=0;$skipped=0;$collisions=0
Get-ChildItem -LiteralPath $OfficialRoot -Recurse -File -Filter '*.dll' -ErrorAction SilentlyContinue | ForEach-Object {
  try{
    if((Get-PeMachine $_.FullName) -eq 0x8664){
      $dest=Join-Path $StagingDir $_.Name
      if(Test-Path -LiteralPath $dest){
        if($_.Name -ieq 'MatLabXRK.dll'){$skipped++}else{$collisions++}
      } else {Copy-Item -LiteralPath $_.FullName -Destination $dest -Force;$copied++}
    } else {$skipped++}
  } catch {$skipped++}
}
[pscustomobject]@{StagingDir=$StagingDir;CopiedX64Dependencies=$copied;Skipped=$skipped;Collisions=$collisions}
