<?php

/**
 * @var array<string,mixed> $p
 * @var bool $eager  true solo sulla prima scheda: è l'unica che sta sopra
 *                   la piega, e caricarla subito accorcia l'LCP. Le altre
 *                   restano pigre, altrimenti si scaricano foto che nessuno
 *                   guarderà mai.
 */

use Mil\Core\Assets;
use Mil\Core\Vocab;

$eager ??= false;
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
    <h3 class="card-title"><a href="<?= e(url('/immobili/' . $p['slug'] . '/')) ?>"><?= e((string) $p['title']) ?></a></h3>
    <p class="card-price"><?= e($prezzo) ?></p>
    <ul class="card-specs">
      <?php if ((int) $p['sqm'] > 0): ?><li><?= (int) $p['sqm'] ?> mq</li><?php endif; ?>
      <?php if ((int) $p['rooms'] > 0): ?><li><?= (int) $p['rooms'] ?> locali</li><?php endif; ?>
      <?php if ((int) $p['bathrooms'] > 0): ?><li><?= (int) $p['bathrooms'] ?> bagni</li><?php endif; ?>
    </ul>
  </div>
</article>
