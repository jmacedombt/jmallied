@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo ==========================================
echo   Sistema Allied - Publicar no GitHub
echo ==========================================
echo.

where git >nul 2>&1
if errorlevel 1 (
    echo O Git nao foi encontrado neste computador.
    echo Instale em https://git-scm.com/download/win e rode este arquivo de novo.
    echo.
    pause
    exit /b 1
)

if not exist ".git" (
    echo Inicializando repositorio Git pela primeira vez...
    git init
    git branch -M main
    echo.
)

git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo Conectando ao repositorio do GitHub ^(jmacedombt/jmallied^)...
    git remote add origin https://github.com/jmacedombt/jmallied.git
    echo.
)

echo Verificando arquivos alterados...
git add .

set MENSAGEM=
set /p MENSAGEM="Descreva rapidamente o que mudou (ou so aperte Enter): "
if "%MENSAGEM%"=="" set MENSAGEM=Atualizacao do sistema Allied

echo.
git commit -m "%MENSAGEM%"
if errorlevel 1 (
    echo.
    echo Nao havia nada novo para enviar ^(ou o commit nao pode ser feito -
    echo confira a mensagem do Git acima^).
    echo.
    pause
    exit /b 0
)

echo.
echo Enviando para o GitHub...
git push -u origin main

if errorlevel 1 (
    echo.
    echo Algo deu errado ao enviar. Confira a mensagem do Git acima
    echo ^(pode ser login pendente, ou nenhuma conexao com a internet^).
    echo.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo   Enviado com sucesso!
echo   Se o site ja estiver publicado na Vercel,
echo   ele atualiza sozinho em 1 a 2 minutos.
echo ==========================================
echo.
pause
