<#
.SYNOPSIS
    Porta una copia dell'archivio dal server a un disco di questo computer.

.DESCRIPTION
    Fa tre cose, in ordine:
      1. sul server, genera il CSV con tutte le schede (scripts/esporta-tutto.mjs)
         e mette da parte l'ultima copia notturna del database;
      2. crea la cartella di destinazione, se non c'e';
      3. scarica database e CSV, datandoli con il giorno di oggi.

    Chiede la password del server tre volte, una per collegamento. Per non
    digitarla piu': ssh-keygen, poi la chiave pubblica dentro
    /root/.ssh/authorized_keys sul server.

.EXAMPLE
    .\copia-su-disco.ps1
    Copia in F:\backup-mondo

.EXAMPLE
    .\copia-su-disco.ps1 -Destinazione D:\archivio -ConLeFoto
    Copia altrove, portandosi via anche le foto degli immobili.
#>

[CmdletBinding()]
param(
    [string] $Destinazione = 'F:\backup-mondo',
    [string] $Server       = 'root@77.81.234.151',
    [string] $Cartella     = '/opt/mondo-crm',
    [switch] $ConLeFoto
)

$ErrorActionPreference = 'Stop'
$oggi = Get-Date -Format 'yyyy-MM-dd'

# Il disco deve esistere: F: non c'e' se la chiavetta non e' infilata, e senza
# questo controllo PowerShell creerebbe la cartella da un'altra parte senza
# dire niente.
$disco = Split-Path -Qualifier $Destinazione
if (-not (Test-Path $disco)) {
    throw "Il disco $disco non risulta collegato. Infila il disco e rilancia."
}

Write-Host "== 1/3  Preparo la copia sul server ====================================="
# Due lavori in una sola connessione: il CSV con tutte le schede, e l'ultima
# copia notturna messa sotto un nome fisso, cosi' la riga dopo sa cosa chiedere.
# Apici singoli: il $(...) deve eseguirlo bash sul server, non PowerShell qui.
$comando = 'cd ' + $Cartella + ' && sudo -u mondo node scripts/esporta-tutto.mjs backup/clienti-completo.csv && cp -f $(ls -t backup/mondo-*.db | head -1) backup/ultimo-archivio.db && echo PRONTO'
ssh $Server $comando
if ($LASTEXITCODE -ne 0) { throw 'Il server non ha completato la preparazione: niente e'' stato copiato.' }

Write-Host "== 2/3  Cartella di destinazione ========================================"
New-Item -ItemType Directory -Force -Path $Destinazione | Out-Null
Write-Host "   $Destinazione"

Write-Host "== 3/3  Scarico =========================================================" 
$archivio = Join-Path $Destinazione "mondo-$oggi.db"
$schede   = Join-Path $Destinazione "clienti-completo-$oggi.csv"

scp "${Server}:$Cartella/backup/ultimo-archivio.db" $archivio
if ($LASTEXITCODE -ne 0) { throw 'Copia del database non riuscita.' }

scp "${Server}:$Cartella/backup/clienti-completo.csv" $schede
if ($LASTEXITCODE -ne 0) { throw 'Copia del CSV non riuscita.' }

if ($ConLeFoto) {
    Write-Host '   e le foto degli immobili...'
    scp -r "${Server}:$Cartella/backup/foto" $Destinazione
    if ($LASTEXITCODE -ne 0) { throw 'Copia delle foto non riuscita.' }
}

Write-Host ''
Write-Host 'Fatto. In ' -NoNewline; Write-Host $Destinazione -ForegroundColor Green
Get-ChildItem $Destinazione | Sort-Object LastWriteTime -Descending |
    Select-Object -First 5 Name, @{n='MB';e={[math]::Round($_.Length/1MB,2)}}, LastWriteTime |
    Format-Table -AutoSize

Write-Host 'Il CSV contiene dati personali in chiaro: codici fiscali, date di'
Write-Host 'nascita ed estremi dei documenti. Tienilo dove tieni l''archivio.'
