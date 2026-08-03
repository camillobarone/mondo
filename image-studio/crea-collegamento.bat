@echo off
REM Mette sul Desktop un collegamento a Mondo Image Studio.
REM Si esegue una volta sola, con un doppio clic.
REM
REM Il lavoro vero lo fa install\crea-collegamento.ps1: scritto in linea qui
REM dentro richiederebbe tre livelli di virgolette annidate, illeggibili e
REM impossibili da verificare.

setlocal
cd /d "%~dp0"

if not exist "avvia.bat" (
    echo.
    echo   Non trovo avvia.bat: questo file va eseguito dalla cartella
    echo   image-studio, non copiato altrove.
    echo.
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install\crea-collegamento.ps1"

if errorlevel 1 (
    echo   Puoi farlo a mano: tasto destro su avvia.bat, "Mostra altre opzioni",
    echo   "Invia a", "Desktop (crea collegamento)".
    echo.
) else (
    echo   Da adesso ti basta quello: doppio clic e parte tutto.
    echo.
)

pause
endlocal
