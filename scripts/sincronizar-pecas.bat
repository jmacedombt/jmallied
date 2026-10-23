@echo off
rem Sistema Allied - atualizacao diaria da Base de Pecas (ver sincronizar-pecas.mjs)
rem Rodado pelo Agendador de Tarefas do Windows (ver agendar-sincronizacao-pecas.bat).
rem Pode rodar na mao tambem: dois cliques. Para forcar: sincronizar-pecas.bat --forcar
cd /d "%~dp0"
if not exist "logs" mkdir "logs"
where node >nul 2>&1
if errorlevel 1 (
    echo O Node.js nao foi encontrado neste computador. >> "logs\sincronizar-pecas.log"
    exit /b 1
)
node "%~dp0sincronizar-pecas.mjs" %* >> "logs\sincronizar-pecas.log" 2>&1
exit /b %errorlevel%
