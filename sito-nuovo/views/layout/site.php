<?php

/**
 * @var array<string,string> $meta
 * @var string $content
 */

use Mil\Core\Assets;
use Mil\Core\Session;
use Mil\Core\Settings;

$flash = Session::takeFlash();
?>
<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e($meta['title']) ?> — <?= e(Settings::get('site_name', 'Mondo Immobiliare Lecce')) ?></title>
<?php if ($meta['description'] !== ''): ?>
<meta name="description" content="<?= e($meta['description']) ?>">
<?php endif; ?>
<?php /* Finché l'installazione è di prova, ogni pagina esce `noindex` qualunque
         cosa dica la sua `meta`: un sottodominio che ripubblica gli stessi
         immobili farebbe concorrenza al sito vero. Si toglie dal gestionale,
         di proposito a mano, il giorno in cui si va online. */ ?>
<meta name="robots" content="<?= e(Settings::get('noindex', '0') === '1' ? 'noindex, nofollow' : $meta['robots']) ?>">
<link rel="canonical" href="<?= e($meta['canonical']) ?>">
<meta property="og:type" content="website">
<meta property="og:title" content="<?= e($meta['title']) ?>">
<meta property="og:description" content="<?= e($meta['description']) ?>">
<meta property="og:url" content="<?= e($meta['canonical']) ?>">
<meta property="og:locale" content="it_IT">
<link rel="icon" href="<?= e(favicon_svg()) ?>" type="image/svg+xml">
<?php /* Il carattere dei titoli si annuncia subito: sta nel CSS inline, che il
         browser scopre solo leggendolo, e senza preload il serif arriverebbe
         a titolo già disegnato facendolo sobbalzare. */ ?>
<link rel="preload" href="<?= e(asset('font/playfair-display.woff2')) ?>" as="font" type="font/woff2" crossorigin>
<?= $meta['preload'] ?? '' ?>
<style><?= Assets::css('site.css') ?></style>
<?= $meta['jsonld'] ?? '' ?>
</head>
<body>
<a class="skip" href="#contenuto">Vai al contenuto</a>

<?php /* Anteprima dal gestionale: la pagina è quella vera, cambia solo questa
         fascia. Sta in cima e non si può chiudere, così non capita di
         scambiarla per il sito pubblico e di credere pubblicato un immobile
         che è ancora in bozza. */ ?>
<?php if ($anteprima ?? false): ?>
<div class="fascia-anteprima">
  <div class="wrap fascia-riga">
    <p><strong>Anteprima.</strong> Così si vedrà la scheda online<?= ($p['status'] ?? '') !== 'published' ? ' — adesso è in ' . e(mb_strtolower(Mil\Core\Vocab::label('status', (string) $p['status']))) : '' ?>.</p>
    <a href="<?= e(url('/gestionale/immobili/' . (int) ($p['id'] ?? 0) . '/')) ?>">‹ Torna a modificare</a>
  </div>
</div>
<?php endif; ?>

<header class="site-head">
  <div class="wrap head-row">
    <a class="brand" href="<?= e(url('/')) ?>">
      <span class="brand-name"><?= e(Settings::get('site_name', 'Mondo Immobiliare')) ?></span>
      <span class="brand-claim">Agenzia FIMAA dal 1994 · Lecce e Porto Cesareo</span>
    </a>

    <?php /* Il numero resta fuori dal menu che si chiude: quando la testata
             diventa il burger, il bottone per chiamare non deve sparire dietro
             a un tocco in più. Sul telefono stretto sparisce comunque, perché
             lì non ci sta accanto al nome — e lì c'è la barra in fondo. */ ?>
    <a class="nav-cta nav-cta-fissa" href="tel:+390832391489">0832 391489</a>

    <input type="checkbox" id="nav-toggle" class="nav-toggle" hidden>
    <label for="nav-toggle" class="nav-burger" aria-label="Apri il menu"><span></span></label>

    <nav class="nav" aria-label="Menu principale">
      <a href="<?= e(url('/immobili/')) ?>">Immobili</a>
      <a href="<?= e(url('/valutazione-gratuita/')) ?>">Valutazione gratuita</a>
      <a href="<?= e(url('/calcolatore-imposte-acquisto-casa/')) ?>">Calcolo imposte</a>
      <a href="<?= e(url('/blog/')) ?>">Blog</a>
      <a href="<?= e(url('/contatti/')) ?>">Contatti</a>
      <a class="nav-cta" href="tel:+390832391489">0832 391489</a>
    </nav>
  </div>
</header>

<?php if ($flash !== []): ?>
<div class="wrap">
  <?php foreach ($flash as $item): ?>
    <p class="flash flash-<?= e($item['type']) ?>"><?= e($item['message']) ?></p>
  <?php endforeach; ?>
</div>
<?php endif; ?>

<main id="contenuto">
<?= $content ?>
</main>

<footer class="site-foot">
  <div class="wrap foot-grid">
    <div>
      <h2 class="foot-title">Mondo Immobiliare</h2>
      <p>Studio RCS Srls — agenzia immobiliare FIMAA dal 1994.<br>
         Oltre 3.000 compravendite fra Lecce, la provincia e la costa.</p>
      <p class="rating">★ 4,9 su 5 — 58 recensioni Google</p>
    </div>
    <div>
      <h2 class="foot-title">Sede di Lecce</h2>
      <p>Via Giuseppe Parini 48/a<br>73100 Lecce</p>
      <p><a href="tel:+390832391489">0832 391489</a> · <a href="tel:+393927282442">392 728 2442</a></p>
    </div>
    <div>
      <h2 class="foot-title">Sede di Porto Cesareo</h2>
      <p>Via Francesco Cilea 76<br>73010 Porto Cesareo</p>
      <p><a href="tel:+390832391489">0832 391489</a></p>
    </div>
    <div>
      <h2 class="foot-title">Orari</h2>
      <p>Lunedì – venerdì<br>9:00 – 13:00 · 16:30 – 19:00</p>
      <p><a href="<?= e(url('/calcolatore-imposte-acquisto-casa/')) ?>">Calcolo imposte d’acquisto</a></p>
      <p class="piva">P. IVA IT05004730759</p>
    </div>
  </div>
  <div class="wrap foot-bottom">
    <p>© <?= date('Y') ?> Studio RCS Srls</p>
    <p><a href="<?= e(url('/gestionale/')) ?>" rel="nofollow">Area riservata</a></p>
  </div>
</footer>
</body>
</html>
