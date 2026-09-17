<#
.SYNOPSIS
    Porta una copia dell'archivio dal server a un disco di questo computer.

.DESCRIPTION
    Fa tre cose, in ordine:
      1. sul server, genera il CSV con tutte le schede (scripts/esporta-tutto.mjs)
         e mette da parte l'ultima copia notturna del database;
      2. crea la cartella di destinazione, se non c'e';
      3. scarica database e CSV, datandoli con il giorno di oggi.

    A mano chiede la password del server tre volte, una per collegamento.
    Per la copia settimanale automatica serve invece una chiave SSH, che
    programma-copia-settimanale.ps1 crea e insegna a installare.

    Ogni corsa lascia una riga nel registro, che sta fuori dal disco di
    destinazione di proposito: se il disco non e' collegato, e' proprio quella
    la cosa da poter leggere.

.EXAMPLE
    .\copia-su-disco.ps1
    Copia in F:\backup-mondo

.EXAMPLE
    .\copia-su-disco.ps1 -Destinazione D:\archivio -ConLeFoto
    Copia altrove, portandosi via anche le foto degli immobili.

.EXAMPLE
    .\copia-su-disco.ps1 -NonInterattivo
    Come la lancia l'attivita' settimanale: non chiede niente, non si ferma
    mai ad aspettare, e scrive tutto nel registro.
#>

[CmdletBinding()]
param(
    [string] $Destinazione = 'F:\backup-mondo',
    [string] $Server       = 'root@77.81.234.151',
    [string] $Cartella     = '/opt/mondo-crm',
    [switch] $ConLeFoto,
    # Senza nessuno davanti allo schermo: niente password da digitare, nessuna
    # domanda, e un'uscita diversa da zero quando qualcosa non va.
    [switch] $NonInterattivo,
    [string] $Registro = (Join-Path $env:LOCALAPPDATA 'mondo-copia.log')
)

$ErrorActionPreference = 'Stop'
$oggi = Get-Date -Format 'yyyy-MM-dd'

# Un comando esterno che scrive su stderr, in Windows PowerShell 5.1, diventa
# un errore BLOCCANTE quando $ErrorActionPreference vale 'Stop' — anche quando
# quella scrittura e' la risposta normale che stiamo aspettando. Il
# "Permission denied (publickey,password)" di una chiave non ancora
# autorizzata e' esattamente questo caso: e' la risposta giusta alla domanda
# «sono gia' dentro?», e faceva morire lo script invece di far proseguire.
#
# PowerShell 7 non si comporta cosi', ed e' il motivo per cui la prova non
# l'aveva visto. Qui si abbassa la preferenza attorno a ogni comando esterno e
# si guarda $LASTEXITCODE, che e' l'unica cosa che dice davvero com'e' andata.
function Esegui {
    param([scriptblock] $Comando, [switch] $Interattivo)
    $prima = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        # -Interattivo quando il comando deve poter chiedere qualcosa a
        # schermo: catturandogli i flussi si porterebbe via la richiesta
        # della password, e resterebbe li' a aspettare un'accettazione muta.
        if ($Interattivo) { & $Comando } else { & $Comando 2>&1 }
    } finally { $ErrorActionPreference = $prima }
}


function Scrivi([string] $testo) {
    $riga = '{0}  {1}' -f (Get-Date -Format 's'), $testo
    try { Add-Content -Path $Registro -Value $riga -Encoding UTF8 } catch { }
    if (-not $NonInterattivo) { Write-Host $testo }
}

# Senza nessuno davanti, ssh non deve MAI fermarsi ad aspettare una password:
# resterebbe li' per sempre e l'attivita' non finirebbe piu'. BatchMode la fa
# fallire subito, e il registro dice perche'.
$opzioni = @()
if ($NonInterattivo) { $opzioni = @('-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20') }

function Fermati([string] $motivo) {
    Scrivi "NON RIUSCITA: $motivo"
    if ($NonInterattivo) { exit 1 }
    throw $motivo
}

Scrivi "--- copia verso $Destinazione"

# Il disco deve esistere: F: non c'e' se il disco non e' collegato, e senza
# questo controllo PowerShell creerebbe la cartella da un'altra parte senza
# dire niente. A PC acceso ma disco staccato la copia salta, e la riga nel
# registro e' l'unico modo di accorgersene.
# Solo quando la destinazione e' su una lettera di unita': con un percorso di
# rete o relativo non c'e' nessun disco da controllare, e Split-Path -Qualifier
# si fermerebbe con un errore invece di lasciar proseguire.
if ($Destinazione -match '^[A-Za-z]:') {
    $disco = $Matches[0]
    if (-not (Test-Path ($disco + '\'))) {
        Fermati "il disco $disco non risulta collegato."
    }
}

Scrivi '1/3  preparo la copia sul server'
# Due lavori in una sola connessione: il CSV con tutte le schede, e l'ultima
# copia notturna messa sotto un nome fisso, cosi' la riga dopo sa cosa chiedere.
# Apici singoli: il $(...) deve eseguirlo bash sul server, non PowerShell qui.
$comando = 'cd ' + $Cartella + ' && sudo -u mondo node scripts/esporta-tutto.mjs backup/clienti-completo.csv && cp -f $(ls -t backup/mondo-*.db | head -1) backup/ultimo-archivio.db && echo PRONTO'
$esito = Esegui { & ssh @opzioni $Server $comando }
if ($LASTEXITCODE -ne 0) {
    Fermati "il server non ha completato la preparazione ($esito)."
}

Scrivi '2/3  cartella di destinazione'
New-Item -ItemType Directory -Force -Path $Destinazione | Out-Null

Scrivi '3/3  scarico'
$archivio = Join-Path $Destinazione "mondo-$oggi.db"
$schede   = Join-Path $Destinazione "clienti-completo-$oggi.csv"

Esegui { & scp @opzioni "${Server}:$Cartella/backup/ultimo-archivio.db" $archivio } | Out-Null
if ($LASTEXITCODE -ne 0) { Fermati 'copia del database non riuscita.' }

Esegui { & scp @opzioni "${Server}:$Cartella/backup/clienti-completo.csv" $schede } | Out-Null
if ($LASTEXITCODE -ne 0) { Fermati 'copia del CSV non riuscita.' }

if ($ConLeFoto) {
    Scrivi '     e le foto degli immobili'
    Esegui { & scp -r @opzioni "${Server}:$Cartella/backup/foto" $Destinazione } | Out-Null
    if ($LASTEXITCODE -ne 0) { Fermati 'copia delle foto non riuscita.' }
}

$peso = [math]::Round(((Get-Item $archivio).Length + (Get-Item $schede).Length) / 1MB, 2)
Scrivi "FATTA: mondo-$oggi.db e clienti-completo-$oggi.csv ($peso MB) in $Destinazione"

if (-not $NonInterattivo) {
    Write-Host ''
    Get-ChildItem $Destinazione -File | Sort-Object LastWriteTime -Descending |
        Select-Object -First 5 Name, @{n='MB';e={[math]::Round($_.Length/1MB,2)}}, LastWriteTime |
        Format-Table -AutoSize
    Write-Host 'Il CSV contiene dati personali in chiaro: codici fiscali, date di'
    Write-Host 'nascita ed estremi dei documenti. Tienilo dove tieni l''archivio.'
}
