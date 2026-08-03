<?php

/**
 * Applica al database le migrazioni non ancora eseguite.
 *
 *   php bin/aggiorna-db.php
 *
 * Da lanciare dopo aver caricato una versione nuova del codice su un sito
 * già installato. Su un'installazione appena fatta non serve: install.php
 * segna le migrazioni come già applicate, perché schema.sql le contiene.
 *
 * ⚠️ Fai un backup del database prima. Le migrazioni aggiungono colonne e
 * tabelle, non cancellano niente, ma un backup costa due minuti e un errore
 * senza backup costa una giornata.
 */

declare(strict_types=1);

require dirname(__DIR__) . '/app/bootstrap.php';

use Mil\Core\Config;
use Mil\Core\Db;

if (!Config::installed()) {
    exit("Il sito non è ancora installato: apri public/install.php.\n");
}

try {
    $fatte = Db::migrate();
} catch (Throwable $e) {
    fwrite(STDERR, "Migrazione fallita: " . $e->getMessage() . "\n");
    fwrite(STDERR, "Il database è rimasto al punto in cui era. Ripristina il backup se necessario.\n");
    exit(1);
}

if ($fatte === []) {
    echo "Database già aggiornato, niente da fare.\n";
    exit;
}

echo "Migrazioni applicate:\n";
foreach ($fatte as $nome) {
    echo "  - {$nome}\n";
}
