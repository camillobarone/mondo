<#
.SYNOPSIS
    Rende automatica e settimanale la copia dell'archivio su un disco locale.

.DESCRIPTION
    Da lanciare UNA VOLTA SOLA. Fa tre cose:

      1. crea una chiave SSH, se non c'e' gia', e la installa sul server —
         serve perche' un'attivita' pianificata non puo' digitare la password;
      2. verifica che il collegamento senza password funzioni davvero;
      3. registra l'attivita' settimanale di Windows che lancia
         copia-su-disco.ps1.

    L'attivita' gira quando sei collegato al computer. Se all'ora prevista il
    PC era spento, parte appena si riaccende: non salta la settimana.

.PARAMETER Giorno
    Giorno della settimana, in inglese come lo vuole Windows: Monday, Tuesday,
    Wednesday, Thursday, Friday, Saturday, Sunday.

.EXAMPLE
    .\programma-copia-settimanale.ps1

.EXAMPLE
    .\programma-copia-settimanale.ps1 -Giorno Friday -Ora 18:00 -ConLeFoto
#>

[CmdletBinding()]
param(
    [string] $Script      = (Join-Path $env:USERPROFILE 'copia-su-disco.ps1'),
    [string] $Destinazione = 'F:\backup-mondo',
    [string] $Server      = 'root@77.81.234.151',
    [ValidateSet('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')]
    [string] $Giorno      = 'Monday',
    [string] $Ora         = '09:00',
    [switch] $ConLeFoto,
    [string] $Nome        = 'Mondo CRM - copia settimanale'
)

$ErrorActionPreference = 'Stop'

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

if (-not (Test-Path $Script)) {
    throw "Non trovo $Script. Scaricalo prima, o indica dov'e' con -Script."
}

# ------------------------------------------------------------ 1. la chiave
Write-Host '== 1/3  Chiave SSH ======================================================'

$cartellaChiavi = Join-Path $env:USERPROFILE '.ssh'
$chiave = Join-Path $cartellaChiavi 'id_ed25519'
New-Item -ItemType Directory -Force -Path $cartellaChiavi | Out-Null

if (Test-Path $chiave) {
    Write-Host "   Ne hai gia' una: $chiave"
} else {
    # Senza passphrase, ed e' una scelta, non una dimenticanza: una chiave
    # protetta da passphrase va sbloccata a mano, e un'attivita' pianificata
    # non ha nessuno che possa farlo.
    #
    # Il '""' non e' un refuso: passando -N '' PowerShell butta via
    # l'argomento vuoto prima che ssh-keygen lo veda, e la chiave finirebbe
    # protetta da una passphrase chiesta a schermo — cioe' inservibile per
    # un'attivita' pianificata.
    Esegui { & ssh-keygen -t ed25519 -f $chiave -N '""' -C 'mondo-crm-copia' -q } | Out-Null
    if (-not (Test-Path $chiave)) {
        throw "ssh-keygen non ha creato la chiave. Provala a mano: ssh-keygen -t ed25519"
    }

    # E che sia davvero senza passphrase lo si verifica, invece di sperarlo:
    # con la passphrase l'attivita' settimanale resterebbe ferma ogni volta,
    # e il motivo non si vedrebbe da nessuna parte.
    Esegui { & ssh-keygen -y -P '""' -f $chiave } | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "La chiave $chiave e' protetta da una passphrase: l'attivita' automatica non potrebbe usarla. Cancellala e rifalla con: ssh-keygen -t ed25519 -f `"$chiave`" (premendo solo Invio alle due domande)."
    }
    Write-Host "   Creata: $chiave"
}

# Gia' autorizzata? Si chiede al server, che e' l'unico a saperlo davvero.
Esegui { & ssh -o BatchMode=yes -o ConnectTimeout=20 $Server 'echo autorizzata' } | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host '   Gia'' autorizzata sul server: niente da fare.'
} else {
    Write-Host '   La installo sul server. Digita la password di root UNA VOLTA:'
    $pubblica = Get-Content "$chiave.pub" -Raw
    Esegui -Interattivo { $pubblica | & ssh $Server 'mkdir -p /root/.ssh && chmod 700 /root/.ssh && cat >> /root/.ssh/authorized_keys && chmod 600 /root/.ssh/authorized_keys && echo INSTALLATA' }
    if ($LASTEXITCODE -ne 0) {
        # Se l'automatismo non passa, la strada a mano resta: meglio dettarla
        # qui che lasciare in mano un errore e nessuna via d'uscita.
        Write-Host ''
        Write-Host 'Non ci sono riuscito da solo. Fallo a mano: copia la riga qui sotto,'
        Write-Host 'per intero, dalla prima lettera all''ultima:'
        Write-Host ''
        Write-Host $pubblica.Trim()
        Write-Host ''
        Write-Host 'poi entra nel server e incollala in fondo al file delle chiavi:'
        Write-Host "   ssh $Server"
        Write-Host '   mkdir -p /root/.ssh && chmod 700 /root/.ssh'
        Write-Host '   nano /root/.ssh/authorized_keys'
        Write-Host '   (incolla, poi Ctrl+O Invio Ctrl+X)'
        Write-Host '   chmod 600 /root/.ssh/authorized_keys'
        Write-Host ''
        throw 'Chiave non installata: rilancia questo script quando l''hai messa.'
    }
}

# ------------------------------------------------------------ 2. la prova
Write-Host '== 2/3  Prova del collegamento senza password ==========================='

Esegui { & ssh -o BatchMode=yes -o ConnectTimeout=20 $Server 'echo funziona' } | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw 'Il collegamento senza password non funziona: l''attivita'' resterebbe ferma ogni volta. Non registro niente.'
}
Write-Host '   Funziona: il server risponde senza chiedere la password.'

# ------------------------------------------------------------ 3. l'attivita'
Write-Host '== 3/3  Attivita'' settimanale =========================================='

$argomenti = @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden',
    '-File', "`"$Script`"",
    '-NonInterattivo',
    '-Destinazione', "`"$Destinazione`"",
    '-Server', $Server
)
if ($ConLeFoto) { $argomenti += '-ConLeFoto' }

$azione = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ($argomenti -join ' ')
$quando = New-ScheduledTaskTrigger -Weekly -DaysOfWeek $Giorno -At $Ora

# StartWhenAvailable e' il punto di tutto: se all'ora prevista il computer era
# spento, Windows lancia l'attivita' appena si riaccende, invece di saltare la
# settimana in silenzio.
$impostazioni = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1)

Register-ScheduledTask -TaskName $Nome -Action $azione -Trigger $quando `
    -Settings $impostazioni -Force `
    -Description "Copia il database e il foglio delle schede da $Server in $Destinazione." | Out-Null

$prossima = (Get-ScheduledTaskInfo -TaskName $Nome).NextRunTime
Write-Host "   Registrata: ogni $Giorno alle $Ora, verso $Destinazione"
Write-Host "   Prossima corsa: $prossima"
Write-Host ''
Write-Host 'Per provarla subito, senza aspettare:'
Write-Host "   Start-ScheduledTask -TaskName '$Nome'"
Write-Host 'Per vedere com''e'' andata:'
Write-Host "   Get-Content '$(Join-Path $env:LOCALAPPDATA 'mondo-copia.log')' -Tail 10"
Write-Host ''
Write-Host 'Da sapere: la chiave e'' senza passphrase, come deve essere per girare'
Write-Host 'da sola. Chi entra in questo computer con il tuo utente entra anche'
Write-Host 'nel server. Se un giorno il PC cambia mano, togli la riga dalla chiave'
Write-Host 'in /root/.ssh/authorized_keys sul server.'
