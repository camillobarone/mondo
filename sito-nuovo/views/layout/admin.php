<?php

/**
 * @var string $content
 * @var string $titolo
 */

use Mil\Core\Auth;
use Mil\Core\Session;

$flash = Session::takeFlash();
$me = Auth::user();
$here = (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);

$voci = [
    '/gestionale/' => 'Riepilogo',
    '/gestionale/immobili/' => 'Immobili',
    '/gestionale/richieste/' => 'Richieste dal sito',
    '/gestionale/clienti/' => 'Richieste di acquisto',
    '/gestionale/agenda/' => 'Agenda',
    '/gestionale/articoli/' => 'Articoli',
    '/gestionale/pagine/' => 'Pagine',
];
$vociAdmin = [
    '/gestionale/importa/' => 'Importa da WordPress',
    '/gestionale/redirect/' => 'Reindirizzamenti',
    '/gestionale/utenti/' => 'Utenti',
    '/gestionale/impostazioni/' => 'Impostazioni',
];
?>
<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title><?= e($titolo ?? 'Gestionale') ?> — Gestionale</title>
<link rel="stylesheet" href="<?= e(asset('css/admin.css')) ?>">
</head>
<body>
<div class="app">

<aside class="side">
  <a class="side-brand" href="<?= e(url('/gestionale/')) ?>">Mondo Immobiliare<span>gestionale</span></a>
  <nav>
    <?php foreach ($voci as $href => $label): ?>
      <a href="<?= e(url($href)) ?>" class="<?= str_starts_with($here, $href) && $href !== '/gestionale/' || $here === $href ? 'on' : '' ?>"><?= e($label) ?></a>
    <?php endforeach; ?>
    <?php if (Auth::isAdmin()): ?>
      <p class="side-sep">Amministrazione</p>
      <?php foreach ($vociAdmin as $href => $label): ?>
        <a href="<?= e(url($href)) ?>" class="<?= str_starts_with($here, $href) ? 'on' : '' ?>"><?= e($label) ?></a>
      <?php endforeach; ?>
    <?php endif; ?>
  </nav>
  <div class="side-foot">
    <p><?= e((string) ($me['name'] ?? '')) ?><span><?= e((string) ($me['role'] ?? '')) ?></span></p>
    <a href="<?= e(url('/')) ?>" target="_blank" rel="noopener">Vedi il sito ↗</a>
    <a href="<?= e(url('/gestionale/logout/')) ?>">Esci</a>
  </div>
</aside>

<div class="main">
  <header class="topbar">
    <h1><?= e($titolo ?? 'Gestionale') ?></h1>
  </header>

  <?php foreach ($flash as $item): ?>
    <p class="flash flash-<?= e($item['type']) ?>"><?= e($item['message']) ?></p>
  <?php endforeach; ?>

  <?= $content ?>
</div>

</div>
</body>
</html>
