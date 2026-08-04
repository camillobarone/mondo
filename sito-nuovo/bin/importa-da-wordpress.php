<?php

/**
 * Importa gli immobili dal WordPress attuale nel gestionale nuovo.
 *
 * Legge direttamente dal database WordPress — su SiteGround i due siti
 * stanno sullo stesso server — e non tocca MAI il sito di origine.
 *
 * TRE COMANDI, IN QUEST'ORDINE:
 *
 *   1) php bin/importa-da-wordpress.php --campi   --wp-config=/percorso/wp-config.php
 *      Non importa niente: stampa i meta e le tassonomie che gli immobili
 *      usano davvero. Da leggere PRIMA di tutto il resto, perché i nomi dei
 *      campi di WP-Residence cambiano fra versioni.
 *
 *   2) php bin/importa-da-wordpress.php --prova   --wp-config=/percorso/wp-config.php
 *      Simulazione: mostra riga per riga cosa importerebbe, senza scrivere
 *      nulla. Se qui vedi prezzi o metrature a zero, gli alias in
 *      app/Core/WpMapper.php vanno corretti con i nomi visti al passo 1.
 *
 *   3) php bin/importa-da-wordpress.php          --wp-config=/percorso/wp-config.php
 *      Importazione vera.
 *
 * OPZIONI
 *   --wp-config=FILE   wp-config.php del sito di origine (consigliato)
 *   --db=NOME --utente=X --password=Y --host=H --prefisso=vnb_
 *                      in alternativa a --wp-config
 *   --uploads=DIR      cartella wp-content/uploads (dedotta da --wp-config)
 *   --senza-foto       importa solo i dati, nessuna immagine
 *   --solo-pubblicati  salta le bozze
 *   --limite=N         importa solo i primi N (utile per una prova breve)
 *
 * RIESEGUIBILE: gli immobili già importati vengono riconosciuti dall'ID
 * WordPress e aggiornati, non duplicati. Le foto già presenti non si
 * riscaricano.
 */

declare(strict_types=1);

require dirname(__DIR__) . '/app/bootstrap.php';

use Mil\Core\Config;
use Mil\Core\Db;
use Mil\Core\WpImport;
use Mil\Core\WpSource;
use Mil\Repo\Properties;

if (!Config::installed()) {
    exit("Il gestionale non è ancora installato: apri public/install.php.\n");
}

// ------------------------------------------------------------------ opzioni

/** @return array<string,string> */
function opzioni(): array
{
    global $argv;
    $out = [];
    foreach (array_slice($argv, 1) as $arg) {
        if (!str_starts_with($arg, '--')) {
            continue;
        }
        $pezzi = explode('=', substr($arg, 2), 2);
        $out[$pezzi[0]] = $pezzi[1] ?? '1';
    }

    return $out;
}

$opt = opzioni();
$soloCampi = isset($opt['campi']);
$prova = isset($opt['prova']);
$senzaFoto = isset($opt['senza-foto']);
$limite = (int) ($opt['limite'] ?? 0);
$stati = isset($opt['solo-pubblicati']) ? ['publish'] : ['publish', 'draft'];

// ------------------------------------------------------- sorgente WordPress

try {
    if (isset($opt['wp-config'])) {
        $wp = WpSource::fromWpConfig($opt['wp-config']);
        $uploads = $opt['uploads'] ?? dirname($opt['wp-config']) . '/wp-content/uploads';
    } elseif (isset($opt['db'])) {
        $wp = new WpSource(
            $opt['host'] ?? 'localhost',
            $opt['db'],
            $opt['utente'] ?? '',
            $opt['password'] ?? '',
            $opt['prefisso'] ?? 'wp_'
        );
        $uploads = $opt['uploads'] ?? '';
    } elseif (isset($opt['sorgente-sqlite'])) {
        // Solo per le prove: un WordPress finto su SQLite, per verificare
        // l'importatore senza avvicinarsi al database vero.
        $pdo = new PDO('sqlite:' . $opt['sorgente-sqlite'], null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $wp = WpSource::fromPdo($pdo, $opt['prefisso'] ?? 'wp_');
        $uploads = $opt['uploads'] ?? '';
    } else {
        exit("Serve --wp-config=/percorso/wp-config.php oppure --db=… --utente=… --password=…\n"
            . "Lancia il comando senza argomenti per rileggere le istruzioni in testa al file.\n");
    }
} catch (Throwable $e) {
    fwrite(STDERR, $e->getMessage() . "\n");
    exit(1);
}

// -------------------------------------------------------- 1) censimento

if ($soloCampi) {
    echo "META USATI DAGLI IMMOBILI\n";
    echo str_repeat('-', 78) . "\n";
    printf("%-42s %5s  %s\n", 'chiave', 'su n.', 'esempio');
    foreach ($wp->metaCensus() as $riga) {
        printf("%-42s %5d  %s\n", $riga['key'], $riga['n'], mb_substr($riga['esempio'], 0, 30));
    }

    echo "\nTASSONOMIE\n";
    echo str_repeat('-', 78) . "\n";
    foreach ($wp->taxonomyCensus() as $tax => $valori) {
        echo "{$tax}\n";
        foreach ($valori as $v) {
            echo "    {$v}\n";
        }
    }

    echo "\nOra confronta queste chiavi con gli alias in app/Core/WpMapper.php.\n";
    echo "Quando combaciano, lancia --prova.\n";
    exit;
}

// ------------------------------------------------------ 2) e 3) importazione

$importatore = new WpImport($wp, $senzaFoto ? '' : $uploads);
$coda = $importatore->daLavorare($stati, $limite);

echo ($prova ? "SIMULAZIONE — nessuna scrittura\n" : "IMPORTAZIONE\n");
echo count($coda) . " immobili da lavorare (" . implode(' + ', $stati) . ")\n";
echo str_repeat('-', 78) . "\n";

$nuovi = 0;
$aggiornati = 0;
$foto = 0;
$saltati = 0;
$errori = [];

// La lavorazione vera sta in Mil\Core\WpImport, usata anche dalla pagina del
// gestionale: qui sopra ci resta solo il modo di raccontarla a schermo.
foreach ($coda as $wpId) {
    $esito = $importatore->uno($wpId, $prova, !$senzaFoto);

    printf(
        "%-7s %-44s %11s %5s mq\n",
        substr($esito['stato'], 0, 7),
        mb_substr($esito['titolo'], 0, 44),
        $esito['prezzo'] === null ? 'riservato' : number_format($esito['prezzo'], 0, ',', '.'),
        (string) $esito['mq']
    );

    match ($esito['stato']) {
        'nuovo' => $nuovi++,
        'aggiornato' => $aggiornati++,
        default => $saltati++,
    };
    $foto += $esito['foto'];
    if ($esito['stato'] === 'errore') {
        $errori[] = $esito['titolo'] . ': ' . $esito['messaggio'];
    }
}

// ---------------------------------------------------------------- rapporto

echo str_repeat('-', 78) . "\n";
echo ($prova ? "Simulazione finita.\n" : "Importazione finita.\n");
echo "  nuovi:       {$nuovi}\n";
echo "  aggiornati:  {$aggiornati}\n";
if (!$prova && !$senzaFoto) {
    echo "  foto:        {$foto}\n";
}
if ($saltati > 0) {
    echo "  saltati:     {$saltati}\n";
}

foreach ($importatore->avvisi() as $avviso) {
    echo "  ⚠ {$avviso}\n";
}
foreach ($errori as $errore) {
    echo "  ✗ {$errore}\n";
}

if (!$prova) {
    echo "\nControlla in Gestionale → Immobili, poi apri due o tre schede sul sito.\n";
    echo "Gli slug sono identici a quelli di WordPress: le vecchie URL rispondono\n";
    echo "senza bisogno di un redirect.\n";
}
