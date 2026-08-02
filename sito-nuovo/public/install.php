<?php

/**
 * Installazione guidata. Crea config.php, lo schema del database e il primo
 * utente amministratore. Dopo l'installazione va cancellato dal server.
 */

declare(strict_types=1);

require dirname(__DIR__) . '/app/bootstrap.php';

use Mil\Core\Config;
use Mil\Core\Db;
use Mil\Core\Settings;
use Mil\Repo\Users;

$configFile = MIL_ROOT . '/config.php';

if (is_file($configFile)) {
    http_response_code(403);
    exit('Il sito è già installato. Per sicurezza cancella install.php dal server.');
}

$errori = [];
$fatto = false;

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    $driver = ($_POST['db_driver'] ?? 'mysql') === 'sqlite' ? 'sqlite' : 'mysql';

    $valori = [
        'debug' => false,
        'base_url' => rtrim(trim((string) ($_POST['base_url'] ?? '')), '/'),
        'db_driver' => $driver,
        'db_host' => trim((string) ($_POST['db_host'] ?? 'localhost')),
        'db_port' => (int) ($_POST['db_port'] ?? 3306),
        'db_name' => trim((string) ($_POST['db_name'] ?? '')),
        'db_user' => trim((string) ($_POST['db_user'] ?? '')),
        'db_pass' => (string) ($_POST['db_pass'] ?? ''),
    ];

    $adminNome = trim((string) ($_POST['admin_name'] ?? ''));
    $adminEmail = trim((string) ($_POST['admin_email'] ?? ''));
    $adminPass = (string) ($_POST['admin_pass'] ?? '');

    if ($valori['base_url'] === '' || !filter_var($valori['base_url'], FILTER_VALIDATE_URL)) {
        $errori[] = 'L’indirizzo del sito non è valido (deve iniziare con http:// o https://).';
    }
    if ($driver === 'mysql' && ($valori['db_name'] === '' || $valori['db_user'] === '')) {
        $errori[] = 'Servono nome del database e utente MySQL.';
    }
    if (!filter_var($adminEmail, FILTER_VALIDATE_EMAIL)) {
        $errori[] = 'L’email dell’amministratore non è valida.';
    }
    if (mb_strlen($adminPass) < 10) {
        $errori[] = 'La password deve avere almeno 10 caratteri.';
    }

    if ($errori === []) {
        foreach ($valori as $chiave => $valore) {
            Config::set($chiave, $valore);
        }
        Db::reset();

        try {
            Db::pdo();
        } catch (Throwable $e) {
            $errori[] = 'Connessione al database non riuscita: ' . $e->getMessage();
        }
    }

    if ($errori === []) {
        try {
            Db::runScript(MIL_ROOT . '/db/schema.sql');

            Users::create([
                'name' => $adminNome !== '' ? $adminNome : 'Amministratore',
                'email' => $adminEmail,
                'role' => 'admin',
                'active' => 1,
            ], $adminPass);

            foreach ([
                'site_name' => 'Mondo Immobiliare Lecce',
                'site_url' => $valori['base_url'],
                'home_seo_title' => 'Agenzia immobiliare a Lecce e Porto Cesareo',
                'home_seo_description' => 'Agenzia immobiliare FIMAA dal 1994 a Lecce e Porto Cesareo. Vendita e valutazione di case, ville e appartamenti nel Salento.',
                'mail_to' => $adminEmail,
                'phone_display' => '0832 391489',
            ] as $chiave => $valore) {
                Settings::set($chiave, $valore);
            }

            if (isset($_POST['demo'])) {
                require MIL_ROOT . '/db/seed.php';
                mil_seed_demo();
            }

            // Il file di configurazione si scrive per ultimo: se qualcosa
            // fallisce prima, l'installer resta disponibile per un altro giro.
            file_put_contents($configFile, mil_config_php($valori), LOCK_EX);
            @chmod($configFile, 0640);

            $fatto = true;
        } catch (Throwable $e) {
            $errori[] = 'Creazione del database non riuscita: ' . $e->getMessage();
        }
    }
}

/** @param array<string,mixed> $valori */
function mil_config_php(array $valori): string
{
    $righe = [];
    foreach ($valori as $chiave => $valore) {
        $righe[] = sprintf(
            "    %s => %s,",
            var_export($chiave, true),
            is_bool($valore) || is_int($valore) ? var_export($valore, true) : var_export((string) $valore, true)
        );
    }

    return "<?php\n\n"
        . "// Generato da install.php. Contiene le credenziali del database:\n"
        . "// non va messo sotto controllo di versione né reso leggibile dal web.\n\n"
        . "return [\n" . implode("\n", $righe) . "\n];\n";
}
?>
<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Installazione — Mondo Immobiliare</title>
<link rel="stylesheet" href="assets/css/admin.css">
</head>
<body class="centrato">
<main class="login" style="width:min(640px,94vw)">

<?php if ($fatto): ?>
  <h1>Installazione completata<span>Mondo Immobiliare</span></h1>
  <p class="flash flash-ok">Il sito è pronto.</p>
  <p><strong>Ultimo passo, obbligatorio:</strong> cancella dal server il file
     <code>public/install.php</code>. Finché resta lì, chiunque lo trovi vede questa pagina.</p>
  <p><a class="btn btn-primary largo" href="gestionale/login/">Entra nel gestionale</a></p>
  <p class="login-back"><a href="./">Vai al sito</a></p>

<?php else: ?>
  <h1>Installazione<span>Mondo Immobiliare</span></h1>

  <?php foreach ($errori as $errore): ?>
    <p class="flash flash-error"><?= e($errore) ?></p>
  <?php endforeach; ?>

  <form method="post" class="form">
    <h2>Indirizzo</h2>
    <label>Indirizzo del sito
      <small>Senza slash finale. Esempio: https://prova.mondoimmobiliarelecce.it</small>
      <input type="text" name="base_url" required
             value="<?= e((string) ($_POST['base_url'] ?? ((($_SERVER['HTTPS'] ?? '') === 'on' ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? '')))) ?>">
    </label>

    <h2>Database</h2>
    <label>Tipo
      <select name="db_driver">
        <option value="mysql">MySQL / MariaDB — è quello di SiteGround</option>
        <option value="sqlite" <?= ($_POST['db_driver'] ?? '') === 'sqlite' ? 'selected' : '' ?>>SQLite — solo per provare in locale</option>
      </select>
    </label>
    <div class="form-row">
      <label>Host<input type="text" name="db_host" value="<?= e((string) ($_POST['db_host'] ?? 'localhost')) ?>"></label>
      <label>Porta<input type="number" name="db_port" value="<?= e((string) ($_POST['db_port'] ?? '3306')) ?>"></label>
    </div>
    <label>Nome del database<input type="text" name="db_name" value="<?= e((string) ($_POST['db_name'] ?? '')) ?>"></label>
    <div class="form-row">
      <label>Utente<input type="text" name="db_user" value="<?= e((string) ($_POST['db_user'] ?? '')) ?>"></label>
      <label>Password<input type="password" name="db_pass" autocomplete="off"></label>
    </div>

    <h2>Amministratore</h2>
    <div class="form-row">
      <label>Nome<input type="text" name="admin_name" value="<?= e((string) ($_POST['admin_name'] ?? '')) ?>"></label>
      <label>Email<input type="email" name="admin_email" required value="<?= e((string) ($_POST['admin_email'] ?? '')) ?>"></label>
    </div>
    <label>Password <small>almeno 10 caratteri</small>
      <input type="password" name="admin_pass" required minlength="10" autocomplete="new-password">
    </label>

    <label class="check">
      <input type="checkbox" name="demo" value="1" checked>
      Carica contenuti di esempio
      <small>Immobili, articoli, pagine e clienti finti, per vedere subito il sito pieno. Si cancellano dal gestionale.</small>
    </label>

    <button type="submit" class="btn btn-primary largo">Installa</button>
  </form>
<?php endif; ?>

</main>
</body>
</html>
