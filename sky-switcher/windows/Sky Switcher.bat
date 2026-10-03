@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File "%~dp0SkySwitcher.ps1"
if errorlevel 1 (
  echo.
  echo Sky Switcher could not start.
  echo Right-click this file, open Properties, check Unblock, then try again.
  pause
)
