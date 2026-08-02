@echo off
REM Avvia il motore ComfyUI con i parametri giusti per una Intel Arc.
REM
REM   --use-pytorch-cross-attention : su Intel non esiste xformers, l'attenzione
REM       nativa di PyTorch e' l'implementazione corretta e piu' veloce.
REM   --reserve-vram 0.6 : lascia mezzo giga alla grafica di Windows, che sulla
REM       stessa scheda continua a disegnare il desktop. Senza questo margine si
REM       vedono crash per esaurimento VRAM proprio a fine generazione.
REM
REM Se ti capitano errori di memoria passando da un tipo di modello a un altro
REM nella stessa sessione, aggiungi --disable-smart-memory alla riga sotto.

setlocal
cd /d "%~dp0"

if not exist "comfy-path.txt" (
    echo comfy-path.txt non trovato.
    echo Esegui prima:  powershell -ExecutionPolicy Bypass -File .\install\1-installa.ps1
    pause
    exit /b 1
)

set /p COMFY=<comfy-path.txt
set "PYTHON=%COMFY%\venv\Scripts\python.exe"

if not exist "%PYTHON%" (
    echo Ambiente Python non trovato in %COMFY%
    echo Rilancia:  powershell -ExecutionPolicy Bypass -File .\install\1-installa.ps1
    pause
    exit /b 1
)

echo Avvio ComfyUI da %COMFY%
echo Interfaccia web: http://127.0.0.1:8188
echo Lascia questa finestra aperta mentre generi.
echo.

REM ComfyUI ricava i propri percorsi da __file__, ma alcuni componenti danno per
REM scontata la working directory: ci spostiamo nella sua cartella prima di partire.
cd /d "%COMFY%"
"%PYTHON%" main.py --use-pytorch-cross-attention --reserve-vram 0.6 %*

endlocal
