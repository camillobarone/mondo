<?php
/**
 * Bootstrap unico dell'applicazione.
 * Caricato sia dal front controller pubblico sia dagli script CLI in bin/.
 */

declare(strict_types=1);

define('MIL_ROOT', dirname(__DIR__));
define('MIL_APP', MIL_ROOT . '/app');
define('MIL_VIEWS', MIL_ROOT . '/views');
define('MIL_PUBLIC', MIL_ROOT . '/public');

mb_internal_encoding('UTF-8');
date_default_timezone_set('Europe/Rome');

spl_autoload_register(static function (string $class): void {
    if (!str_starts_with($class, 'Mil\\')) {
        return;
    }
    $path = MIL_APP . '/' . str_replace('\\', '/', substr($class, 4)) . '.php';
    if (is_file($path)) {
        require $path;
    }
});

require MIL_APP . '/helpers.php';

use Mil\Core\Config;

Config::load(MIL_ROOT . '/config.php');

if (Config::get('debug')) {
    error_reporting(E_ALL);
    ini_set('display_errors', '1');
} else {
    error_reporting(E_ALL & ~E_DEPRECATED);
    ini_set('display_errors', '0');
}
