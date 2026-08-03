@echo off
REM Avvia il motore ComfyUI con i parametri giusti per una Intel Arc.
REM
REM   --use-pytorch-cross-attention : su Intel non esiste xformers, l'attenzione
REM       nativa di PyTorch e' l'implementazione corretta e piu' veloce.
REM   --reserve-vram 1.5 : margine tenuto libero. Serve a due cose: Windows
REM       disegna il desktop sulla stessa scheda, e un margine piu' ampio spinge
REM       ComfyUI a spostare da solo parte dei pesi fuori dalla VRAM invece di
REM       tentare il caricamento completo e fallire. Con 0.6 il virtual staging
REM       esauriva la memoria (UR_RESULT_ERROR_OUT_OF_RESOURCES) perche' modello
REM       e ControlNet insieme superano lo spazio disponibile su 12 GB.
REM   --fp32-vae : lo stadio che converte il risultato in pixel visibili, su Arc,
REM       in precisione ridotta produce valori non numerici e l'immagine esce
REM       tutta nera. Osservato su B580 con torch 2.13+xpu: la generazione
REM       completa i suoi passi senza errori e solo alla conversione finale
REM       compare "invalid value encountered in cast". In precisione piena il
REM       problema sparisce; costa circa 2 secondi a immagine e 170 MB di VRAM,
REM       un prezzo trascurabile per un'immagine che si vede.
REM
REM Questo file inoltra al motore gli argomenti che gli passi, quindi puoi
REM provare un'impostazione senza modificarlo:  avvia-comfyui.bat --lowvram
REM
REM Se la memoria si esaurisce comunque, in ordine di severita':
REM   --lowvram              tiene in VRAM solo la parte di modello in uso.
REM                          Piu' lento ma regge qualsiasi combinazione.
REM   --cpu-vae              sposta sul processore lo stadio finale, liberando
REM                          altra VRAM. Da usare al posto di --fp32-vae.
REM   --disable-smart-memory serve quando l'errore compare passando da un tipo
REM                          di modello a un altro nella stessa sessione.

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
"%PYTHON%" main.py --use-pytorch-cross-attention --reserve-vram 1.5 --fp32-vae %*

endlocal
