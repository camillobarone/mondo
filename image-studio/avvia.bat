@echo off
REM ============================================================
REM  Mondo Image Studio — doppio clic e basta.
REM
REM  Accende il motore, apre la dashboard nel browser e resta in
REM  ascolto. Chiudendo questa finestra si spegne tutto.
REM
REM  Non serve PowerShell: questo file si lancia con un doppio clic
REM  da Esplora file.
REM ============================================================

setlocal
cd /d "%~dp0"
title Mondo Image Studio - non chiudere

if not exist "comfy-path.txt" (
    echo.
    echo   Installazione non completata: manca comfy-path.txt
    echo.
    echo   Esegui prima, da PowerShell in questa cartella:
    echo     powershell -ExecutionPolicy Bypass -File .\install\1-installa.ps1
    echo.
    pause
    exit /b 1
)

set /p COMFY=<comfy-path.txt
set "PYTHON=%COMFY%\venv\Scripts\python.exe"

if not exist "%PYTHON%" (
    echo.
    echo   Ambiente Python non trovato in %COMFY%
    echo   Rilancia install\1-installa.ps1
    echo.
    pause
    exit /b 1
)

echo.
echo   Avvio in corso. Il primo caricamento richiede circa un minuto.
echo   Il browser si apre da solo quando e' tutto pronto.
echo.
echo   LASCIA APERTA QUESTA FINESTRA mentre lavori.
echo.

set "PYTHONPATH=%~dp0src"
"%PYTHON%" -m mondo_image.dashboard

REM Se si chiude subito c'e' stato un errore: tienilo visibile.
if errorlevel 1 (
    echo.
    echo   La dashboard si e' chiusa con un errore. Il dettaglio e' qui sopra,
    echo   e il registro del motore in motore.log
    echo.
    pause
)

endlocal
