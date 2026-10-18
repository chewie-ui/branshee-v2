@echo off
chcp 65001 >nul
title Branshee (local, rapide)
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n'est pas installe. Telechargez la version LTS sur https://nodejs.org puis relancez ce fichier.
  pause
  exit /b 1
)
echo Mise a jour des dependances...
call npm install --no-audit --no-fund
if errorlevel 1 ( pause & exit /b 1 )
start "" cmd /c "timeout /t 200 >nul & start http://localhost:3000"
call npm run local -- --rapide
pause
