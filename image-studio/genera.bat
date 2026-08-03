@echo off
REM Wrapper della CLI. Usa l'interprete del venv di ComfyUI, dove sono gia'
REM presenti requests e Pillow: nessun secondo ambiente da mantenere.
REM
REM   genera.bat doctor
REM   genera.bat text "masseria in Salento al tramonto" --preset exterior
REM   genera.bat staging C:\foto\salone.jpg "soggiorno moderno, divano grigio"
REM   genera.bat retouch C:\foto\cucina.jpg C:\foto\maschera.png "parete bianca"
REM   genera.bat upscale C:\foto\salone.jpg

setlocal
cd /d "%~dp0"

if not exist "comfy-path.txt" (
    echo comfy-path.txt non trovato.
    echo Esegui prima:  powershell -ExecutionPolicy Bypass -File .\install\1-installa.ps1
    exit /b 1
)

set /p COMFY=<comfy-path.txt
set "PYTHON=%COMFY%\venv\Scripts\python.exe"

if not exist "%PYTHON%" (
    echo Ambiente Python non trovato in %COMFY%
    exit /b 1
)

set "PYTHONPATH=%~dp0src"
"%PYTHON%" -m mondo_image %*

endlocal
