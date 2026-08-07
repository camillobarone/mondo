<?php

/**
 * @var array<string,string> $meta
 * @var string $content
 */

use Mil\Core\Assets;
use Mil\Core\Session;
use Mil\Core\Settings;

$flash = Session::takeFlash();

/* Il nome dell'agenzia in coda al titolo, ma solo se ci sta.
   `Pages::meta()` taglia il titolo a 60 caratteri, che è il limite oltre il
   quale Google lo riscrive da sé; poi qui si aggiungevano sempre altri 26
   caratteri di « — Mondo Immobiliare Lecce», e ogni pagina del sito usciva
   fra i 67 e i 79. Il taglio a monte non serviva a niente.
   Chi ha un titolo già lungo tiene il suo e basta: dice più il titolo che il
   nome dell'agenzia ripetuto, che comunque sta nel dominio e nello snippet. */
$titoloPagina = (string) $meta['title'];
$titoloCompleto = $titoloPagina;

/* Si prova prima la firma per esteso, poi quella corta, poi si rinuncia:
   sei caratteri di differenza fanno rientrare una pagina che altrimenti
   uscirebbe senza marchio del tutto. */
foreach ([(string) Settings::get('site_name', 'Mondo Immobiliare Lecce'), 'Mondo Immobiliare'] as $firma) {
    $conFirma = $titoloPagina . ' — ' . $firma;
    if (mb_strlen($conFirma) <= 60) {
        $titoloCompleto = $conFirma;
        break;
    }
}
?>
<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e($titoloCompleto) ?></title>
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
<?php /* L'anteprima di quando il link finisce in una chat. Per un'agenzia
         immobiliare non è un dettaglio: gli annunci si mandano su WhatsApp, e
         un link senza foto in mezzo a una conversazione non lo apre nessuno.
         `summary_large_image` è quello che dice a X di usare il riquadro
         grande invece del francobollo di fianco al testo. */ ?>
<?php if (($meta['image'] ?? '') !== ''): ?>
<meta property="og:image" content="<?= e($meta['image']) ?>">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="<?= e($meta['image']) ?>">
<?php endif; ?>
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
    <?php /* Il marchio in testata è il solo simbolo, senza la scritta che il
             logo si porta dentro: rimpicciolita a 54 punti quella scritta
             diventa una macchia, e comunque ripeterebbe il nome che sta già
             qui accanto in Playfair. `alt` vuoto di proposito — il nome
             dell'agenzia è nel testo del collegamento, e chi ascolta la
             pagina non ha bisogno di sentirlo due volte. */ ?>
    <?php $simbolo = marchio('logo-simbolo.png'); ?>
    <a class="brand" href="<?= e(url('/')) ?>">
      <?php if ($simbolo !== null): ?>
      <img class="brand-mark" src="<?= e($simbolo['src']) ?>"
           width="<?= $simbolo['width'] ?>" height="<?= $simbolo['height'] ?>"
           alt="" decoding="async" fetchpriority="high">
      <?php endif; ?>
      <span class="brand-testo">
        <span class="brand-name"><?= e(Settings::get('site_name', 'Mondo Immobiliare')) ?></span>
        <span class="brand-claim">Agenzia FIMAA dal 1994 · Lecce e Porto Cesareo</span>
      </span>
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
      <p><a href="<?= e(url('/calcolatore-imposte-acquisto-casa/')) ?>">Calcolo imposte d’acquisto</a><br>
         <a href="<?= e(url('/calcolatore-rata-mutuo/')) ?>">Calcolo rata mutuo</a></p>
      <p class="piva">P. IVA IT05004730759</p>
    </div>
  </div>
  <div class="wrap foot-bottom">
    <p>© <?= date('Y') ?> Studio RCS Srls</p>
    <?php /* Informativa e cookie policy: un modulo che raccoglie nome,
             telefono ed email deve avere l'informativa raggiungibile da ogni
             pagina, non una frase discorsiva sotto al bottone.
             Il collegamento compare solo quando la pagina c'è davvero:
             finché non è stata scritta, un rimando a un 404 sarebbe peggio
             del rimando mancante. */ ?>
    <p class="foot-legale">
      <?php foreach (Mil\Core\Legali::presenti() as $slug => $etichetta): ?>
        <a href="<?= e(url('/' . $slug . '/')) ?>"><?= e($etichetta) ?></a>
      <?php endforeach; ?>
      <a href="<?= e(url('/gestionale/')) ?>" rel="nofollow">Area riservata</a>
    </p>
  </div>
</footer>
</body>
</html>
