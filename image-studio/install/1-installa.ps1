<#
.SYNOPSIS
    Installa ComfyUI con PyTorch XPU per GPU Intel Arc su Windows.

.DESCRIPTION
    Ordine delle operazioni scelto apposta: PyTorch XPU va installato PRIMA dei
    requisiti di ComfyUI. In requirements.txt 'torch' non ha un vincolo di
    versione, quindi pip lo considera gia' soddisfatto e non sostituisce la build
    XPU con quella CPU. Alla fine si verifica comunque che la GPU sia visibile.

    Non si usa intel-extension-for-pytorch: e' in end-of-life da marzo 2026 e il
    supporto Intel e' ormai dentro PyTorch.

.PARAMETER ComfyPath
    Dove installare ComfyUI. Servono circa 15 GB fra ambiente e modelli
    indispensabili, circa 30 GB scaricando tutti i checkpoint opzionali.

.PARAMETER Nightly
    Usa le build nightly di PyTorch XPU: a volte piu' veloci, ma meno stabili.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\1-installa.ps1
#>

[CmdletBinding()]
param(
    [string]$ComfyPath = "$env:USERPROFILE\ComfyUI",
    [switch]$Nightly
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot

function Write-Step { param([string]$Text) Write-Host "`n=== $Text ===" -ForegroundColor Cyan }
function Write-Ok   { param([string]$Text) Write-Host "  [ok] $Text" -ForegroundColor Green }
function Write-Warn { param([string]$Text) Write-Host "  [!]  $Text" -ForegroundColor Yellow }

# --------------------------------------------------------------- prerequisiti

Write-Step "Controllo del sistema"

$gpus = @(Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue |
          Select-Object -ExpandProperty Name)
$intel = @($gpus | Where-Object { $_ -match "Intel" })
if ($intel.Count -gt 0) {
    Write-Ok "GPU Intel rilevata: $($intel -join ', ')"
} else {
    Write-Warn "Nessuna GPU Intel rilevata. Trovate: $($gpus -join ', ')"
    Write-Warn "L'installazione prosegue, ma la generazione andra' su CPU (molto lenta)."
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "git non trovato. Installalo da https://git-scm.com/download/win e riapri il terminale."
}
Write-Ok "git presente"

# Il launcher 'py' e' il modo affidabile di scegliere la versione su Windows.
# Comando e argomenti restano separati per poterli splattare senza indici fragili.
$pythonCmd = $null
$pythonArgs = @()
if (Get-Command py -ErrorAction SilentlyContinue) {
    foreach ($version in @("3.12", "3.11", "3.13", "3.10")) {
        & py "-$version" --version *> $null
        if ($LASTEXITCODE -eq 0) { $pythonCmd = "py"; $pythonArgs = @("-$version"); break }
    }
}
if (-not $pythonCmd -and (Get-Command python -ErrorAction SilentlyContinue)) {
    $reported = (& python --version 2>&1)
    if ($reported -match "3\.(1[0-3])\b") { $pythonCmd = "python" }
}
if (-not $pythonCmd) {
    throw @"
Python 3.10-3.13 non trovato.
Installalo da https://www.python.org/downloads/ (spunta 'Add python.exe to PATH')
oppure con:  winget install Python.Python.3.12
"@
}
Write-Ok "Python: $(& $pythonCmd @pythonArgs --version 2>&1)"

# ------------------------------------------------------------------- ComfyUI

Write-Step "Installazione di ComfyUI in $ComfyPath"

if (Test-Path (Join-Path $ComfyPath ".git")) {
    Write-Ok "gia' presente, aggiorno"
    git -C $ComfyPath pull --ff-only
} else {
    if ((Test-Path $ComfyPath) -and (Get-ChildItem $ComfyPath -Force | Measure-Object).Count -gt 0) {
        throw "$ComfyPath esiste e non e' vuota. Scegli un'altra cartella con -ComfyPath."
    }
    git clone https://github.com/comfyanonymous/ComfyUI.git $ComfyPath
}
Write-Ok "sorgente pronto"

Write-Step "Creazione dell'ambiente Python isolato"
$venv = Join-Path $ComfyPath "venv"
$pythonExe = Join-Path $venv "Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
    & $pythonCmd @pythonArgs -m venv $venv
    if ($LASTEXITCODE -ne 0) { throw "creazione del venv fallita" }
}
& $pythonExe -m pip install --upgrade pip --quiet
Write-Ok "ambiente pronto: $venv"

# ---------------------------------------------------------------- PyTorch XPU

Write-Step "Installazione di PyTorch con supporto Intel (XPU)"
Write-Host "  Circa 3 GB di download, puo' richiedere parecchi minuti." -ForegroundColor DarkGray

if ($Nightly) {
    $torchArgs = @("--pre", "torch", "torchvision", "torchaudio",
                   "--index-url", "https://download.pytorch.org/whl/nightly/xpu")
} else {
    $torchArgs = @("torch", "torchvision", "torchaudio",
                   "--index-url", "https://download.pytorch.org/whl/xpu")
}
& $pythonExe -m pip install @torchArgs
if ($LASTEXITCODE -ne 0) { throw "installazione di PyTorch XPU fallita" }

Write-Step "Installazione dei requisiti di ComfyUI"
& $pythonExe -m pip install -r (Join-Path $ComfyPath "requirements.txt")
if ($LASTEXITCODE -ne 0) { throw "installazione dei requisiti fallita" }

# ------------------------------------------------------------------- verifica

Write-Step "Verifica della GPU"
$probe = @'
import torch
print("torch", torch.__version__)
if hasattr(torch, "xpu") and torch.xpu.is_available():
    print("XPU_OK", torch.xpu.get_device_name(0))
    props = torch.xpu.get_device_properties(0)
    print("VRAM_GB", round(props.total_memory / 1024**3, 1))
else:
    print("XPU_ASSENTE")
'@
$probeFile = Join-Path $env:TEMP "mondo_xpu_probe.py"
Set-Content -Path $probeFile -Value $probe -Encoding UTF8
$result = & $pythonExe $probeFile 2>&1
Remove-Item $probeFile -ErrorAction SilentlyContinue
$result | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }

if ($result -match "XPU_OK") {
    Write-Ok "la GPU Intel e' utilizzabile da PyTorch"
} else {
    Write-Warn "PyTorch non vede la GPU Intel."
    Write-Warn "Aggiorna i driver Arc: https://www.intel.com/content/www/us/en/download/785597/"
    Write-Warn "Poi riavvia il PC e rilancia questo script."
}

# -------------------------------------------------------------- collegamento

Write-Step "Configurazione di Mondo Image Studio"
Set-Content -Path (Join-Path $RepoRoot "comfy-path.txt") -Value $ComfyPath -Encoding ASCII -NoNewline
foreach ($folder in @("checkpoints", "vae", "controlnet", "upscale_models", "loras")) {
    New-Item -ItemType Directory -Force -Path (Join-Path $ComfyPath "models\$folder") | Out-Null
}
Write-Ok "percorso registrato in comfy-path.txt"

Write-Host @"

============================================================
Installazione completata.

Prossimo passo, i modelli. Aggiungi -RequiredOnly per fermarti a 10 GB
invece di 24, il fotorealistico lo scarichi quando vuoi:
    powershell -ExecutionPolicy Bypass -File .\install\2-scarica-modelli.ps1

Poi avvia il motore con:
    avvia-comfyui.bat

E genera la prima immagine con:
    genera.bat text "masseria in Salento al tramonto" --preset exterior
============================================================
"@ -ForegroundColor Cyan
