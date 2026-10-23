@echo off
setlocal
cd /d "%~dp0"
echo ==========================================
echo   Sistema Allied - Agendar atualizacao da Base de Pecas
echo ==========================================
echo.
echo Cria (ou atualiza) a tarefa "Allied - Base de Pecas" no Agendador de
echo Tarefas do Windows: roda todo dia as 12:00 o arquivo
echo   %~dp0sincronizar-pecas.bat
echo O computador precisa estar ligado nesse horario. Se estiver desligado,
echo roda assim que for ligado.
echo.
schtasks /create /tn "Allied - Base de Pecas" /tr "\"%~dp0sincronizar-pecas.bat\"" /sc daily /st 12:00 /f
if errorlevel 1 (
    echo.
    echo Nao foi possivel criar a tarefa. Confira a mensagem acima.
    pause
    exit /b 1
)
powershell -NoProfile -Command "$t = Get-ScheduledTask -TaskName \"Allied - Base de Pecas\"; $t.Settings.StartWhenAvailable = $true; Set-ScheduledTask -InputObject $t | Out-Null" >nul 2>&1
echo.
echo Tarefa criada! Ela roda todo dia as 12:00.
echo O resultado de cada execucao fica em: %~dp0logs\sincronizar-pecas.log
echo.
pause
