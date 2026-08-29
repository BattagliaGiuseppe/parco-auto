param(
  [Parameter(Mandatory=$true)][string]$FilePath,
  [Parameter(Mandatory=$true)][string]$DllPath
)

$ErrorActionPreference = "Stop"

function Normalize-Key([string]$Value) {
  if ($null -eq $Value) { return "" }
  return (($Value.ToLowerInvariant()) -replace '[^a-z0-9]', '')
}

$source = @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public static class AimNative {
  [DllImport("kernel32", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern bool SetDllDirectory(string lpPathName);

  [DllImport("MatLabXRK.dll", CallingConvention=CallingConvention.Cdecl)] public static extern IntPtr get_library_date();
  [DllImport("MatLabXRK.dll", CallingConvention=CallingConvention.Cdecl)] public static extern IntPtr get_library_time();
  [DllImport("MatLabXRK.dll", CallingConvention=CallingConvention.Cdecl, CharSet=CharSet.Ansi)] public static extern int open_file(string path);
  [DllImport("MatLabXRK.dll", CallingConvention=CallingConvention.Cdecl)] public static extern int close_file_i(int idx);
  [DllImport("MatLabXRK.dll", CallingConvention=CallingConvention.Cdecl)] public static extern IntPtr get_vehicle_name(int idx);
  [DllImport("MatLabXRK.dll", CallingConvention=CallingConvention.Cdecl)] public static extern IntPtr get_track_name(int idx);
  [DllImport("MatLabXRK.dll", CallingConvention=CallingConvention.Cdecl)] public static extern IntPtr get_racer_name(int idx);
  [DllImport("MatLabXRK.dll", CallingConvention=CallingConvention.Cdecl)] public static extern int get_laps_count(int idx);
  [DllImport("MatLabXRK.dll", CallingConvention=CallingConvention.Cdecl)] public static extern int get_lap_info(int idxf, int idxl, out double start, out double duration);

  [DllImport("MatLabXRK.dll", CallingConvention=CallingConvention.Cdecl)] public static extern int get_channels_count(int idx);
  [DllImport("MatLabXRK.dll", CallingConvention=CallingConvention.Cdecl)] public static extern IntPtr get_channel_name(int idxf, int idxc);
  [DllImport("MatLabXRK.dll", CallingConvention=CallingConvention.Cdecl)] public static extern IntPtr get_channel_units(int idxf, int idxc);
  [DllImport("MatLabXRK.dll", CallingConvention=CallingConvention.Cdecl)] public static extern int get_channel_samples_count(int idxf, int idxc);
  [DllImport("MatLabXRK.dll", CallingConvention=CallingConvention.Cdecl)] public static extern int get_channel_samples(int idxf, int idxc, [Out] double[] times, [Out] double[] values, int cnt);

  [DllImport("MatLabXRK.dll", CallingConvention=CallingConvention.Cdecl)] public static extern int get_GPS_channels_count(int idx);
  [DllImport("MatLabXRK.dll", CallingConvention=CallingConvention.Cdecl)] public static extern IntPtr get_GPS_channel_name(int idxf, int idxc);
  [DllImport("MatLabXRK.dll", CallingConvention=CallingConvention.Cdecl)] public static extern IntPtr get_GPS_channel_units(int idxf, int idxc);
  [DllImport("MatLabXRK.dll", CallingConvention=CallingConvention.Cdecl)] public static extern int get_GPS_channel_samples_count(int idxf, int idxc);
  [DllImport("MatLabXRK.dll", CallingConvention=CallingConvention.Cdecl)] public static extern int get_GPS_channel_samples(int idxf, int idxc, [Out] double[] times, [Out] double[] values, int cnt);

  public static string PtrString(IntPtr ptr) { return ptr == IntPtr.Zero ? null : Marshal.PtrToStringAnsi(ptr); }
}
'@

try {
  if (-not [System.Environment]::Is64BitProcess) { throw "Il bridge richiede PowerShell/Windows x64." }
  $resolvedFile = [System.IO.Path]::GetFullPath($FilePath)
  $resolvedDll = [System.IO.Path]::GetFullPath($DllPath)
  if (-not (Test-Path -LiteralPath $resolvedFile)) { throw "File XRK/XRZ non trovato: $resolvedFile" }
  if (-not (Test-Path -LiteralPath $resolvedDll)) { throw "DLL AiM non trovata: $resolvedDll" }

  $dllDir = Split-Path -Parent $resolvedDll
  $fixedDll = Join-Path $dllDir "MatLabXRK.dll"
  if ($resolvedDll -ne $fixedDll) { Copy-Item -LiteralPath $resolvedDll -Destination $fixedDll -Force }

  # Rende visibili anche eventuali dipendenze native distribuite nel pacchetto AiM.
  $officialRoot = Join-Path (Split-Path -Parent $dllDir) "official"
  $searchDirs = @($dllDir)
  if (Test-Path -LiteralPath $officialRoot) {
    $searchDirs += @(Get-ChildItem -LiteralPath $officialRoot -Directory -Recurse | Select-Object -ExpandProperty FullName)
  }
  $searchDirs = @($searchDirs | Select-Object -Unique)
  $env:PATH = (($searchDirs -join ';') + ';' + $env:PATH)

  # Diagnostica runtime VC++: errore Win32 126 spesso significa dipendenza nativa mancante.
  $vcNames = @('vcruntime140.dll','vcruntime140_1.dll','msvcp140.dll')
  $vcMissing = @()
  foreach ($n in $vcNames) { if (-not (Test-Path -LiteralPath (Join-Path $env:WINDIR "System32\$n"))) { $vcMissing += $n } }

  Add-Type -TypeDefinition $source -Language CSharp
  [void][AimNative]::SetDllDirectory($dllDir)

  try {
    $idx = [AimNative]::open_file($resolvedFile)
  } catch {
    $msg = $_.Exception.Message
    if ($msg -match '0x8007007E|modulo specificato|module could not be found') {
      $extra = if ($vcMissing.Count -gt 0) { " Runtime VC++ mancanti rilevati: " + ($vcMissing -join ', ') + "." } else { " I runtime VC++ principali risultano presenti; probabile altra dipendenza nativa mancante." }
      throw ("Caricamento DLL AiM fallito (Win32 126)." + $extra + " DLL: " + $fixedDll)
    }
    throw
  }
  if ($idx -le 0) { throw "AiM DLL open_file ha restituito $idx" }
  try {
    $laps = @()
    $lapCount = [AimNative]::get_laps_count($idx)
    if ($lapCount -lt 0) { throw "get_laps_count ha restituito $lapCount" }
    for ($i=0; $i -lt $lapCount; $i++) {
      [double]$start = 0; [double]$duration = 0
      $ok = [AimNative]::get_lap_info($idx, $i, [ref]$start, [ref]$duration)
      if ($ok -gt 0 -and $duration -gt 0) {
        $laps += [pscustomobject]@{
          num = $i
          startTime = [math]::Round($start * 1000.0, 6)
          endTime = [math]::Round(($start + $duration) * 1000.0, 6)
          duration_seconds = $duration
        }
      }
    }

    $rpmAliases = @('rsv4rpm','rpm','enginerpm','obdiirpm','obdrpm')
    $speedAliases = @('gpsspeed','speed','vehiclespeed','rsv4bkspeed')
    $channels = @()

    function Read-Channel([int]$channelIndex, [bool]$gps) {
      if ($gps) {
        $name = [AimNative]::PtrString([AimNative]::get_GPS_channel_name($idx,$channelIndex))
        $units = [AimNative]::PtrString([AimNative]::get_GPS_channel_units($idx,$channelIndex))
        $count = [AimNative]::get_GPS_channel_samples_count($idx,$channelIndex)
      } else {
        $name = [AimNative]::PtrString([AimNative]::get_channel_name($idx,$channelIndex))
        $units = [AimNative]::PtrString([AimNative]::get_channel_units($idx,$channelIndex))
        $count = [AimNative]::get_channel_samples_count($idx,$channelIndex)
      }
      if ($count -le 0) { return $null }
      $times = New-Object double[] $count
      $values = New-Object double[] $count
      if ($gps) { $read = [AimNative]::get_GPS_channel_samples($idx,$channelIndex,$times,$values,$count) }
      else { $read = [AimNative]::get_channel_samples($idx,$channelIndex,$times,$values,$count) }
      if ($read -le 0) { return $null }

      [double]$min = [double]::PositiveInfinity; [double]$max = [double]::NegativeInfinity
      for ($j=0; $j -lt $count; $j++) {
        $v=$values[$j]; if ([double]::IsNaN($v) -or [double]::IsInfinity($v)) { continue }
        if ($v -lt $min) {$min=$v}; if ($v -gt $max) {$max=$v}
      }
      return [pscustomobject]@{ name=$name; units=$units; count=$count; min=$min; max=$max; times=$times; values=$values; gps=$gps }
    }

    $regularCount = [AimNative]::get_channels_count($idx)
    if ($regularCount -gt 0) {
      for ($i=0; $i -lt $regularCount; $i++) {
        $name=[AimNative]::PtrString([AimNative]::get_channel_name($idx,$i)); $k=Normalize-Key $name
        if ($rpmAliases -contains $k -or $speedAliases -contains $k) { $c=Read-Channel $i $false; if ($null -ne $c) {$channels += $c} }
      }
    }
    $gpsCount = [AimNative]::get_GPS_channels_count($idx)
    if ($gpsCount -gt 0) {
      for ($i=0; $i -lt $gpsCount; $i++) {
        $name=[AimNative]::PtrString([AimNative]::get_GPS_channel_name($idx,$i)); $k=Normalize-Key $name
        if ($speedAliases -contains $k) { $c=Read-Channel $i $true; if ($null -ne $c) {$channels += $c} }
      }
    }

    $rpm = $channels | Where-Object { $rpmAliases -contains (Normalize-Key $_.name) -and $_.max -ge 1000 -and $_.max -le 30000 } | Sort-Object @{Expression={$_.max};Descending=$true} | Select-Object -First 1
    $speed = $channels | Where-Object { $speedAliases -contains (Normalize-Key $_.name) -and $_.max -gt 5 } | Sort-Object @{Expression={ if ($_.gps) {1} else {0} };Descending=$true}, @{Expression={$_.max};Descending=$true} | Select-Object -First 1

    $engineSeconds = $null
    if ($null -ne $rpm -and $rpm.count -gt 1) {
      $gaps=@(); for($i=1;$i -lt $rpm.count;$i++){ $dt=$rpm.times[$i]-$rpm.times[$i-1]; if($dt -gt 0 -and $dt -lt 10){$gaps += $dt} }
      if ($gaps.Count -gt 0) {
        $sorted=$gaps|Sort-Object; $median=[double]$sorted[[int]([math]::Floor($sorted.Count/2))]; $maxDt=[math]::Max(1.0,$median*3.0); [double]$sum=0
        for($i=1;$i -lt $rpm.count;$i++){ $dt=$rpm.times[$i]-$rpm.times[$i-1]; if($dt -gt 0 -and $dt -le $maxDt -and ($rpm.values[$i-1] -gt 500 -or $rpm.values[$i] -gt 500)){$sum += $dt} }
        $engineSeconds=$sum
      }
    }

    function Speed-To-Kph([double]$value,[string]$unit) {
      $u=(Normalize-Key $unit)
      if ($u -eq 'kmh' -or $u -eq 'kph') { return $value }
      if ($u -eq 'ms' -or $u -eq 'mps') { return $value*3.6 }
      if ($u -eq 'mph') { return $value*1.609344 }
      return $null
    }
    $maxSpeedKph=$null; if($null -ne $speed){$maxSpeedKph=Speed-To-Kph $speed.max $speed.units}

    $result = [ordered]@{
      ok = $true
      provider = 'aim_official_dll'
      dll = [ordered]@{
        path = $resolvedDll
        library_date = [AimNative]::PtrString([AimNative]::get_library_date())
        library_time = [AimNative]::PtrString([AimNative]::get_library_time())
      }
      metadata = [ordered]@{
        track = [AimNative]::PtrString([AimNative]::get_track_name($idx))
        vehicle = [AimNative]::PtrString([AimNative]::get_vehicle_name($idx))
        racer = [AimNative]::PtrString([AimNative]::get_racer_name($idx))
      }
      laps = $laps
      selected_channels = [ordered]@{
        rpm = if($null -ne $rpm){$rpm.name}else{$null}
        speed = if($null -ne $speed){$speed.name}else{$null}
        speed_unit = if($null -ne $speed){$speed.units}else{$null}
      }
      max_rpm = if($null -ne $rpm){$rpm.max}else{$null}
      max_speed_kph = $maxSpeedKph
      engine_seconds = $engineSeconds
    }
    $result | ConvertTo-Json -Depth 8 -Compress
  }
  finally { [void][AimNative]::close_file_i($idx) }
}
catch {
  [ordered]@{ ok=$false; provider='aim_official_dll'; error=$_.Exception.Message } | ConvertTo-Json -Compress
  exit 1
}
