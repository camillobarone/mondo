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

Session::start();

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$rawPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$path = is_string($rawPath) ? rawurldecode($rawPath) : '/';

// Una URL, una forma: le pagine vivono con lo slash finale. La variante senza
// slash risponde 301 invece di servire lo stesso contenuto a due indirizzi.
if ($method === 'GET' && $path !== '/' && !str_ends_with($path, '/')) {
    $lastSegment = substr($path, (int) strrpos($path, '/') + 1);
    if (!str_contains($lastSegment, '.')) {
        $query = (string) ($_SERVER['QUERY_STRING'] ?? '');
        header('Location: ' . $path . '/' . ($query !== '' ? '?' . $query : ''), true, 301);
        exit;
    }
}

$router = new Router();
require MIL_APP . '/routes.php';

$router->dispatch($method, $path);
