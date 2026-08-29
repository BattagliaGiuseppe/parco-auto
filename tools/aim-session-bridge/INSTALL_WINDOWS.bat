@echo off
setlocal
cd /d "%~dp0"
echo ============================================================
echo  Motorsport Management - AiM Bridge Setup P2.9.5.1
echo ============================================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\Install-AiM-Bridge.ps1"
echo.
if errorlevel 1 (
  echo INSTALLAZIONE NON COMPLETATA.
) else (
  echo Setup terminato.
)
pause
