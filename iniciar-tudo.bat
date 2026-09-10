@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion
title NightWave - Web + App em rede
cd /d "%~dp0"

echo.
echo  ============================================
echo    NightWave - web + app em rede
echo  ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js nao foi encontrado.
    echo Instale o Node.js LTS em: https://nodejs.org
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Instalando dependencias do projeto...
    call npm install
    if errorlevel 1 (
        echo Falha na instalacao das dependencias.
        pause
        exit /b 1
    )
)

for /f "usebackq delims=" %%i in (`ipconfig ^| findstr /R /C:"IPv4"`) do (
    set IPLINE=%%i
    goto :ipfound
)
:ipfound

if not defined IPLINE (
    echo Nao foi possivel detectar o IP da rede.
    set SERVER_URL=http://SEU-IP-DA-MAQUINA:8000
) else (
    for /f "tokens=2 delims=:" %%a in ("%IPLINE%") do set IP=%%a
    set IP=%IP: =%
    set SERVER_URL=http://%IP%:8000
)

set HOST=0.0.0.0
set PORT=8000

echo Iniciando o servidor em segundo plano...
start "NightWave-servidor" /min cmd /c "set HOST=0.0.0.0 && set PORT=8000 && npm start"

echo Aguardando o servidor ficar pronto...
timeout /t 4 /nobreak >nul

echo.
echo URL do servidor para PC, celular e navegador: %SERVER_URL%
echo.
echo Abrindo a versao WEB no navegador...
start "" "%SERVER_URL%"

echo Abrindo a versao APP no computador...
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app=%SERVER_URL% --window-size=1280,800
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app=%SERVER_URL% --window-size=1280,800
) else if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    start "" "%LocalAppData%\Google\Chrome\Application\chrome.exe" --app=%SERVER_URL% --window-size=1280,800
) else if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app=%SERVER_URL% --window-size=1280,800
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app=%SERVER_URL% --window-size=1280,800
) else (
    start "" "%SERVER_URL%"
)

echo.
echo O servidor esta rodando em segundo plano.
echo URL do aplicativo: %SERVER_URL%
echo Para desligar: feche a janela "NightWave-servidor".
echo.
pause
