@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion
title NightWave - Servidor Web em rede
cd /d "%~dp0"

echo.
echo  ============================================
echo    NightWave - servidor web em rede
echo  ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERRO] O Node.js nao foi encontrado no seu computador.
    echo.
    echo Instale o Node.js primeiro em: https://nodejs.org
    echo ^(baixe a versao LTS, instale normalmente e rode este arquivo de novo^)
    echo.
    start https://nodejs.org
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Primeira vez rodando aqui - instalando as pecas necessarias...
    echo Isso pode levar um minuto, so acontece uma vez.
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERRO] Falha ao instalar as dependencias. Veja a mensagem acima.
        pause
        exit /b 1
    )
    echo.
    echo Instalacao concluida!
    echo.
)

for /f "usebackq delims=" %%i in (`ipconfig ^| findstr /R /C:"IPv4"`) do (
    set IPLINE=%%i
    goto :ipfound
)
:ipfound

if not defined IPLINE (
    echo Nao foi possivel detectar o IP da rede.
    echo Conecte o PC e o celular na mesma Wi-Fi ou use um dominio publico.
    echo.
    set SERVER_URL=http://SEU-IP-DA-MAQUINA:8000
) else (
    for /f "tokens=2 delims=:" %%a in ("%IPLINE%") do set IP=%%a
    set IP=%IP: =%
    set SERVER_URL=http://%IP%:8000
)

set HOST=0.0.0.0
set PORT=8000

echo IP da maquina: %SERVER_URL%

echo.
echo Abrindo o navegador em alguns segundos...
start "" cmd /c "timeout /t 2 >nul && start %SERVER_URL%"

echo.
echo Servidor rodando em rede! NAO FECHE esta janela enquanto quiser usar o app.
echo URL para celular: %SERVER_URL%
echo URL para navegador: %SERVER_URL%
echo Para parar o servidor, feche esta janela ou aperte Ctrl+C.
echo.

call npm start

pause
