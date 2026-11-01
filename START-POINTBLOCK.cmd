@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [PointBlock] Node.js 22.12+ or 20.19+ is required.
  echo Official download: https://nodejs.org/
  pause
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  echo [PointBlock] First run: installing pinned packages from npm...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo [PointBlock] Installation failed. No game source was changed.
    pause
    exit /b 1
  )
)
echo [PointBlock] Starting local Vite game server...
call npm run dev -- --open
if errorlevel 1 pause
