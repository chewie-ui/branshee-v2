@echo off
chcp 65001 >nul
title Branshee (local)
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n'est pas installe. Telechargez la version LTS sur https://nodejs.org puis relancez ce fichier.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installation des dependances, premiere fois uniquement...
  call npm install
  if errorlevel 1 ( pause & exit /b 1 )
)
start "" cmd /c "timeout /t 25 >nul & start http://localhost:3000"
call npm run local
pause
