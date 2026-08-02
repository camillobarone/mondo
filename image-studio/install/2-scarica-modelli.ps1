<#
.SYNOPSIS
    Scarica i modelli nella cartella ComfyUI registrata dall'installer.

.DESCRIPTION
    Il lavoro vero lo fa download_models.py, che risolve i nomi dei file
    interrogando Hugging Face e riprende i download interrotti. Questo script
    serve solo a trovare l'ambiente giusto e a passargli i parametri.

.PARAMETER RequiredOnly
    Scarica solo l'indispensabile: circa 10 GB invece di 24.

.PARAMETER Only
    Scarica solo i modelli indicati, per id (vedi install\models.json).

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\2-scarica-modelli.ps1
    powershell -ExecutionPolicy Bypass -File .\2-scarica-modelli.ps1 -Only juggernaut-xl
#>

[CmdletBinding()]
param(
    [switch]$RequiredOnly,
    [string[]]$Only,
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$pathFile = Join-Path $RepoRoot "comfy-path.txt"

if (-not (Test-Path $pathFile)) {
    throw "comfy-path.txt non trovato. Esegui prima install\1-installa.ps1."
}
$comfyPath = (Get-Content $pathFile -Raw).Trim()
$pythonExe = Join-Path $comfyPath "venv\Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
    throw "Ambiente Python non trovato in $comfyPath. Rilancia install\1-installa.ps1."
}

$arguments = @((Join-Path $PSScriptRoot "download_models.py"), "--comfy", $comfyPath)
if ($RequiredOnly) { $arguments += "--required-only" }
if ($Force)        { $arguments += "--force" }
foreach ($id in $Only) { $arguments += @("--only", $id) }

Write-Host "Scarico i modelli in $comfyPath\models" -ForegroundColor Cyan
Write-Host "Puoi interrompere con Ctrl+C: al riavvio i download riprendono." -ForegroundColor DarkGray

& $pythonExe @arguments
$code = $LASTEXITCODE

if ($code -eq 0) {
    Write-Host "`nModelli pronti. Avvia il motore con avvia-comfyui.bat" -ForegroundColor Green
} else {
    Write-Host "`nAlcuni modelli obbligatori non sono stati scaricati (vedi sopra)." -ForegroundColor Yellow
}
exit $code
