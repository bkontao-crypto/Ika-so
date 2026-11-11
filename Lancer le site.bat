@echo off
chcp 65001 >nul
title IKA SO - Lancement
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n'est pas installe. Installez la version LTS ^(22 ou plus^) depuis https://nodejs.org puis relancez ce fichier.
  pause
  exit /b 1
)

for /f %%v in ('node -p "process.versions.node.split('.')[0]"') do set NODEMAJOR=%%v
if %NODEMAJOR% LSS 22 (
  echo Node.js %NODEMAJOR% detecte : ce projet demande Node.js 22 ou plus. Mettez Node.js a jour puis relancez.
  pause
  exit /b 1
)

if not exist ".env" (
  if exist ".env.example" (
    copy ".env.example" ".env" >nul
    echo Le fichier .env n'existait pas : il vient d'etre cree a partir de .env.example.
    echo Ouvrez-le, renseignez DATABASE_URL ^(et PORT=3000 par exemple, NODE_ENV=development^), enregistrez, puis appuyez sur une touche.
    pause
  ) else (
    echo Fichier .env introuvable : "npm run dev" en a besoin. Creez-le puis relancez.
    pause
    exit /b 1
  )
)

echo.
echo === Installation des dependances ^(npm install^) ===
call npm install
if errorlevel 1 (
  echo.
  echo L'installation a echoue. Verifiez votre connexion Internet.
  pause
  exit /b 1
)

echo.
echo === Execution des migrations ===
if exist "server\migrate.js" (
  call node --env-file=.env server/migrate.js
  if errorlevel 1 (
    echo.
    echo Les migrations ont echoue. Verifiez votre configuration de base de donnees dans .env.
    pause
    exit /b 1
  )
) else (
  echo Fichier de migration introuvable, etape ignoree.
)

echo.
echo === Demarrage ^(npm run dev^) ===
echo Pour arreter le serveur : Ctrl + C
echo.
call npm run dev

pause