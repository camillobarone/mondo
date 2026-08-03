@echo off
REM Mette sul Desktop un collegamento a Mondo Image Studio.
REM Si esegue una volta sola, con un doppio clic.

setlocal
cd /d "%~dp0"

set "DESTINAZIONE=%~dp0avvia.bat"
set "COLLEGAMENTO=%USERPROFILE%\Desktop\Mondo Image Studio.lnk"

REM Il collegamento si crea tramite l'oggetto di sistema che Windows espone a
REM questo scopo: e' l'unico modo per produrre un .lnk vero, con icona e
REM cartella di lavoro corrette.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$s = (New-Object -ComObject WScript.Shell).CreateShortcut('%COLLEGAMENTO%');" ^
  "$s.TargetPath = '%DESTINAZIONE%';" ^
  "$s.WorkingDirectory = '%~dp0';" ^
  "$s.Description = 'Generazione immagini in locale';" ^
  "$s.IconLocation = '%SystemRoot%\System32\imageres.dll,109';" ^
  "$s.Save()"

if errorlevel 1 (
    echo.
    echo   Non sono riuscito a creare il collegamento.
    echo   Puoi farlo a mano: tasto destro su avvia.bat, Invia a, Desktop.
    echo.
) else (
    echo.
    echo   Fatto. Sul Desktop trovi "Mondo Image Studio".
    echo   Da adesso ti basta quello: doppio clic e parte tutto.
    echo.
)

pause
endlocal
