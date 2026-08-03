<#
.SYNOPSIS
    Crea sul Desktop un collegamento a Mondo Image Studio.

.DESCRIPTION
    Il percorso del Desktop non si costruisce come "$env:USERPROFILE\Desktop":
    con OneDrive attivo — impostazione predefinita su molti Windows 11 — quella
    cartella continua a esistere ma non e' piu' quella mostrata a schermo, e il
    collegamento finirebbe dove non lo si vede mai. Va chiesto a Windows.

    Questo file esiste separato dal .bat che lo richiama perche' lo stesso
    codice scritto in linea, dentro le virgolette di cmd, richiederebbe tre
    livelli di escape: illeggibile e impossibile da verificare.

.PARAMETER Destinazione
    Il file da lanciare. Per impostazione predefinita avvia.bat accanto a
    questo script.
#>

[CmdletBinding()]
param(
    [string]$Destinazione = (Join-Path (Split-Path -Parent $PSScriptRoot) "avvia.bat"),
    [string]$Nome = "Mondo Image Studio"
)

$ErrorActionPreference = "Continue"

if (-not (Test-Path $Destinazione)) {
    Write-Host "  Non trovo $Destinazione" -ForegroundColor Yellow
    exit 1
}

$desktop = [Environment]::GetFolderPath("Desktop")
if (-not $desktop -or -not (Test-Path $desktop)) {
    Write-Host "  Non riesco a determinare la cartella Desktop." -ForegroundColor Yellow
    exit 1
}

$collegamento = Join-Path $desktop "$Nome.lnk"

$completo = (Resolve-Path $Destinazione).Path

try {
    $shell = New-Object -ComObject WScript.Shell
    $scorciatoia = $shell.CreateShortcut($collegamento)
    # Il bersaglio e' cmd.exe, non il .bat direttamente: se l'estensione .bat
    # risulta associata a un editor di testo — capita a chi una volta ha scelto
    # "Apri con, Blocco note, usa sempre" — un collegamento al file lo
    # aprirebbe invece di eseguirlo. Passando per cmd /c l'associazione non
    # viene nemmeno consultata.
    $scorciatoia.TargetPath = (Join-Path $env:SystemRoot "System32\cmd.exe")
    $scorciatoia.Arguments = '/c "' + $completo + '"'
    $scorciatoia.WorkingDirectory = (Split-Path -Parent $completo)
    $scorciatoia.Description = "Generazione immagini in locale su GPU Intel Arc"
    # Icona di sistema: una macchina fotografica, senza file esterni da spedire.
    $scorciatoia.IconLocation = (Join-Path $env:SystemRoot "System32\imageres.dll") + ",109"
    $scorciatoia.Save()
} catch {
    Write-Host "  Creazione non riuscita: $($_.Exception.Message)" -ForegroundColor Yellow
    exit 1
}

if (Test-Path $collegamento) {
    Write-Host ""
    Write-Host "  Collegamento creato in:" -ForegroundColor Green
    Write-Host "  $collegamento" -ForegroundColor Green
    Write-Host ""
    exit 0
}

Write-Host "  Il collegamento non risulta creato." -ForegroundColor Yellow
exit 1
