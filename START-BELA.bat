@echo off
title BELA store
cd /d "%~dp0"
where node >/dev/null 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo 1. Go to https://nodejs.org and install the LTS version.
  echo 2. Then double-click this file again.
  start https://nodejs.org
  pause
  exit /b
)
echo Starting BELA store. Keep this window open while you use the store.
echo.
start "" http://localhost:3000
node server.js
pause
