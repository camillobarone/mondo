<?php

declare(strict_types=1);

require dirname(__DIR__) . '/app/bootstrap.php';

use Mil\Core\Config;
use Mil\Core\Router;
use Mil\Core\Session;

// Finché config.php non esiste il sito non può girare: si va all'installer.
if (!Config::installed()) {
    $script = $_SERVER['SCRIPT_NAME'] ?? '';
    if (!str_ends_with($script, 'install.php')) {
        header('Location: ' . rtrim((string) Config::get('base_url'), '/') . '/install.php');
        exit;
    }
}

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$rawPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$path = is_string($rawPath) ? rawurldecode($rawPath) : '/';

Session::avviaSeServe($path, $method);

// Una URL, una forma: le pagine vivono con lo slash finale. La variante senza
// slash risponde 301 invece di servire lo stesso contenuto a due indirizzi.
if (($method === 'GET' || $method === 'HEAD') && $path !== '/' && !str_ends_with($path, '/')) {
    $lastSegment = substr($path, (int) strrpos($path, '/') + 1);
    if (!str_contains($lastSegment, '.')) {
        $query = (string) ($_SERVER['QUERY_STRING'] ?? '');
        header('Location: ' . $path . '/' . ($query !== '' ? '?' . $query : ''), true, 301);
        exit;
    }
}

$router = new Router();
require MIL_APP . '/routes.php';

// Il gestionale non passa da qui: è roba di chi è collegato, non deve finire
// in nessuna cache e non ha niente da guadagnare da un confronto di versioni.
if (str_starts_with($path, '/gestionale')) {
    header('Cache-Control: private, no-store');
    $router->dispatch($method, $path);
    exit;
}

// Le pagine pubbliche escono con una targhetta di versione (ETag).
//
// Alla visita dopo il browser la rimanda indietro chiedendo «è ancora
// questa?»: se la pagina non è cambiata si risponde 304 senza corpo, e chi
// legge si tiene quella che ha già. Sono un centinaio di byte al posto di
// trenta-quaranta KB, e la pagina compare senza aspettare.
//
// `max-age=0, must-revalidate` vuol dire: puoi conservarla, ma chiedimi
// sempre prima di riusarla. Così una modifica fatta nel gestionale si vede
// subito — che è la ragione per cui non si mette una durata più lunga.
ob_start();
$router->dispatch($method, $path);
$corpo = (string) ob_get_clean();

$stato = http_response_code();

// Chi ha una sessione aperta sta vedendo qualcosa che è solo suo: il
// messaggio «Richiesta inviata» subito dopo aver compilato un modulo. Quella
// pagina non va marcata `public`, o una cache condivisa potrebbe mostrarla a
// un altro visitatore, né confrontata per versione: la volta dopo il
// messaggio non c'è più, ed è giusto che la pagina torni intera.
$suaSoltanto = session_status() === PHP_SESSION_ACTIVE;

if ($suaSoltanto) {
    header('Cache-Control: private, no-store');
} elseif (($method === 'GET' || $method === 'HEAD') && $stato === 200) {
    $etag = '"' . md5($corpo) . '"';
    header('ETag: ' . $etag);
    header('Cache-Control: public, max-age=0, must-revalidate');

    if (trim((string) ($_SERVER['HTTP_IF_NONE_MATCH'] ?? '')) === $etag) {
        http_response_code(304);
        exit;
    }
}

echo $corpo;
