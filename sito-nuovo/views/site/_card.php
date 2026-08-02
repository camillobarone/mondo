<?php

/** @var array<string,mixed> $p */

use Mil\Core\Vocab;

$prezzo = (int) ($p['price_hidden'] ?? 0) === 1
    ? 'Trattativa riservata'
    : euro(isset($p['price']) ? (float) $p['price'] : null);
?>
<article class="card">
  <a class="card-media" href="<?= e(url('/immobili/' . $p['slug'] . '/')) ?>">
    <?php if (!empty($p['cover_thumb'] ?? $p['cover'] ?? '')): ?>
      <img src="<?= e(url((string) ($p['cover_thumb'] ?: $p['cover']))) ?>"
           alt="<?= e((string) $p['title']) ?>" loading="lazy" width="640" height="420">
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
