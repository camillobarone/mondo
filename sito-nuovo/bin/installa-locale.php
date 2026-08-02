<?php

/**
 * Installazione da riga di comando, per provare il sito in locale su SQLite
 * senza installare né MySQL né altro.
 *
 *   php bin/installa-locale.php [http://localhost:8080] [email] [password]
 *   php -S localhost:8080 -t public
 *
 * In produzione su SiteGround si usa l'installer via browser (public/install.php),
 * che chiede le credenziali MySQL.
 */

declare(strict_types=1);

require dirname(__DIR__) . '/app/bootstrap.php';

use Mil\Core\Config;
use Mil\Core\Db;
use Mil\Core\Settings;
use Mil\Repo\Users;

$baseUrl = rtrim($argv[1] ?? 'http://localhost:8080', '/');
$email = $argv[2] ?? 'admin@mondoimmobiliarelecce.it';
$password = $argv[3] ?? 'prova-locale-2026';

$configFile = MIL_ROOT . '/config.php';
$dbFile = MIL_ROOT . '/db/mil.sqlite';

foreach ([$configFile, $dbFile, $dbFile . '-wal', $dbFile . '-shm'] as $vecchio) {
    if (is_file($vecchio)) {
        unlink($vecchio);
    }
}

$valori = [
    'debug' => true,
    'base_url' => $baseUrl,
    'db_driver' => 'sqlite',
    'db_file' => $dbFile,
];

foreach ($valori as $chiave => $valore) {
    Config::set($chiave, $valore);
}
Db::reset();

Db::runScript(MIL_ROOT . '/db/schema.sql');
echo "Schema creato.\n";

Users::create([
    'name' => 'Camillo Barone',
    'email' => $email,
    'role' => 'admin',
    'active' => 1,
], $password);

foreach ([
    'site_name' => 'Mondo Immobiliare Lecce',
    'site_url' => $baseUrl,
    'home_seo_title' => 'Agenzia immobiliare a Lecce e Porto Cesareo',
    'home_seo_description' => 'Agenzia immobiliare FIMAA dal 1994 a Lecce e Porto Cesareo. Vendita e valutazione di case, ville e appartamenti nel Salento.',
    'mail_to' => $email,
    'phone_display' => '0832 391489',
] as $chiave => $valore) {
    Settings::set($chiave, $valore);
}

require MIL_ROOT . '/db/seed.php';
mil_seed_demo();
echo "Contenuti di esempio caricati.\n";

$righe = [];
foreach ($valori as $chiave => $valore) {
    $righe[] = sprintf('    %s => %s,', var_export($chiave, true), var_export($valore, true));
}
file_put_contents(
    $configFile,
    "<?php\n\n// Configurazione della prova in locale. Non usare in produzione.\n\nreturn [\n"
    . implode("\n", $righe) . "\n];\n"
);

echo "Fatto.\n";
echo "  Sito:       {$baseUrl}/\n";
echo "  Gestionale: {$baseUrl}/gestionale/\n";
echo "  Accesso:    {$email} / {$password}\n";
