<?php

/**
 * @var array<string,mixed> $p
 * @var bool $eager  true solo sulla prima scheda: è l'unica che sta sopra
 *                   la piega, e caricarla subito accorcia l'LCP. Le altre
 *                   restano pigre, altrimenti si scaricano foto che nessuno
 *                   guarderà mai.
 * @var int $livello livello del titolo della scheda. Nell'elenco degli
 *                   immobili le schede stanno subito sotto l'`h1` della
 *                   pagina e vogliono un `h2`; in home e in fondo alla
 *                   scheda di un immobile stanno sotto un titolo di sezione
 *                   e allora devono essere `h3`. La scaletta dei titoli non
 *                   può saltare gradini, e la stessa scheda finisce in due
 *                   posti diversi: il livello lo decide chi la include.
 */

use Mil\Core\Assets;
use Mil\Core\Vocab;

$eager ??= false;
$livello = (int) ($livello ?? 3);
$prezzo = (int) ($p['price_hidden'] ?? 0) === 1
    ? 'Trattativa riservata'
    : euro(isset($p['price']) ? (float) $p['price'] : null);

$img = (string) ($p['cover_thumb'] ?: ($p['cover'] ?? ''));
$srcset = (string) ($p['cover_srcset'] ?? '');
?>
<article class="card">
  <a class="card-media" href="<?= e(url('/immobili/' . $p['slug'] . '/')) ?>">
    <?php if ($img !== ''): ?>
      <img src="<?= e(url($img)) ?>"
           <?php if ($srcset !== ''): ?>
           srcset="<?= e(srcset_url($srcset)) ?>"
           sizes="<?= e(Assets::SIZES_CARD) ?>"
           <?php endif; ?>
           alt="<?= e((string) $p['title']) ?>"
           width="960" height="640"
           loading="<?= $eager ? 'eager' : 'lazy' ?>"
           <?= $eager ? 'fetchpriority="high"' : 'decoding="async"' ?>>
    <?php else: ?>
      <span class="card-noimg">Foto in arrivo</span>
    <?php endif; ?>
    <?php if (($p['status'] ?? '') === 'reserved'): ?>
      <span class="badge badge-warn">Sotto proposta</span>
    <?php elseif (($p['status'] ?? '') === 'sold'): ?>
      <span class="badge badge-off">Venduto</span>
    <?php endif; ?>
  </a>

  <div class="card-body">
    <p class="card-kicker"><?= e(Vocab::label('type', (string) $p['type'])) ?> · <?= e((string) $p['city']) ?><?= $p['area'] !== '' ? ', ' . e((string) $p['area']) : '' ?></p>
    <h<?= $livello ?> class="card-title"><a href="<?= e(url('/immobili/' . $p['slug'] . '/')) ?>"><?= e((string) $p['title']) ?></a></h<?= $livello ?>>
    <p class="card-price"><?= e($prezzo) ?></p>
    <ul class="card-specs">
      <?php if ((int) $p['sqm'] > 0): ?><li><?= (int) $p['sqm'] ?> mq</li><?php endif; ?>
      <?php if ((int) $p['rooms'] > 0): ?><li><?= (int) $p['rooms'] ?> locali</li><?php endif; ?>
      <?php if ((int) $p['bathrooms'] > 0): ?><li><?= (int) $p['bathrooms'] ?> bagni</li><?php endif; ?>
    </ul>
  </div>
</article>
