<?php

/**
 * @var array<string,mixed> $p
 * @var array<int,array<string,mixed>> $images
 * @var array<int,array<string,mixed>> $simili
 */

use Mil\Core\Assets;
use Mil\Core\View;
use Mil\Core\Vocab;

$prezzo = (int) $p['price_hidden'] === 1 ? 'Trattativa riservata' : euro(isset($p['price']) ? (float) $p['price'] : null);
$features = array_filter(array_map('trim', explode(',', (string) $p['features'])));
?>
<article class="scheda">
  <nav class="briciole" aria-label="Percorso">
    <a href="<?= e(url('/')) ?>">Home</a> ›
    <a href="<?= e(url('/immobili/')) ?>">Immobili</a> ›
    <span><?= e((string) $p['title']) ?></span>
  </nav>

  <header class="wrap scheda-head">
    <p class="scheda-kicker"><?= e(Vocab::label('type', (string) $p['type'])) ?> ·
      <?= e((string) $p['city']) ?><?= $p['area'] !== '' ? ', ' . e((string) $p['area']) : '' ?> ·
      rif. <?= e((string) $p['ref']) ?></p>
    <h2><?= e((string) $p['title']) ?></h2>
    <p class="scheda-prezzo"><?= e($prezzo) ?></p>
  </header>

  <?php if ($images !== []): ?>
    <?php
    $totale = count($images);
    // In griglia ne stanno cinque: una grande e quattro sotto. Le altre non
    // spariscono, si aprono dal cartello «+N foto» sull'ultima.
    $inGriglia = array_slice($images, 0, 5, true);
    $nascoste = $totale - count($inGriglia);
    $didascalia = static fn (array $img): string => (string) ($img['alt'] ?: $p['title']);
    ?>
    <section class="galleria wrap" id="galleria" aria-label="Foto dell’immobile">
      <?php foreach ($inGriglia as $i => $img): ?>
        <a class="galleria-cella<?= $i === 0 ? ' galleria-main' : '' ?>" href="#foto-<?= $i ?>">
          <img src="<?= e(url((string) ($i === 0 ? $img['path'] : ($img['thumb'] ?: $img['path'])))) ?>"
               <?php if (($img['srcset'] ?? '') !== ''): ?>
               srcset="<?= e(srcset_url((string) $img['srcset'])) ?>"
               sizes="<?= e($i === 0 ? Assets::SIZES_GALLERIA : Assets::SIZES_GALLERIA_MINI) ?>"
               <?php endif; ?>
               alt="<?= e($didascalia($img)) ?>"
               width="<?= (int) $img['width'] ?>" height="<?= (int) $img['height'] ?>"
               loading="<?= $i === 0 ? 'eager' : 'lazy' ?>"
               <?= $i === 0 ? 'fetchpriority="high"' : 'decoding="async"' ?>>
          <?php if ($nascoste > 0 && $i === array_key_last($inGriglia)): ?>
            <span class="galleria-piu">+<?= $nascoste ?> foto</span>
          <?php endif; ?>
          <?php /* Testo fuori campo invece di `aria-label`: così il nome
                   accessibile del link contiene anche la scritta «+N foto»
                   che si vede sopra la foto, e le due versioni non divergono. */ ?>
          <span class="sr">Apri la foto <?= $i + 1 ?> di <?= $totale ?> a schermo intero</span>
        </a>
      <?php endforeach; ?>
    </section>

    <?php /* Le foto a schermo intero senza una riga di JavaScript: ogni riquadro
             è un `:target`, quindi è il browser a mostrarlo e a nasconderlo.
             Fino a quel momento resta `display:none`, così non scarica niente
             e non sposta di un pixel il resto della pagina. */ ?>
    <?php foreach ($images as $i => $img): ?>
      <div class="lente" id="foto-<?= $i ?>">
        <a class="lente-fondo" href="#galleria" aria-hidden="true" tabindex="-1"></a>
        <figure class="lente-corpo">
          <img src="<?= e(url((string) $img['path'])) ?>"
               <?php if (($img['srcset'] ?? '') !== ''): ?>
               srcset="<?= e(srcset_url((string) $img['srcset'])) ?>"
               sizes="<?= e(Assets::SIZES_GALLERIA) ?>"
               <?php endif; ?>
               alt="<?= e($didascalia($img)) ?>"
               width="<?= (int) $img['width'] ?>" height="<?= (int) $img['height'] ?>"
               loading="lazy" decoding="async">
          <figcaption><?= e($didascalia($img)) ?></figcaption>
        </figure>
        <nav class="lente-barra" aria-label="Sfoglia le foto">
          <a href="#foto-<?= ($i - 1 + $totale) % $totale ?>" rel="prev">‹ <span>Precedente</span></a>
          <span class="lente-conta"><?= $i + 1 ?> di <?= $totale ?></span>
          <a href="#foto-<?= ($i + 1) % $totale ?>" rel="next"><span>Successiva</span> ›</a>
          <a class="lente-chiudi" href="#galleria">Chiudi</a>
        </nav>
      </div>
    <?php endforeach; ?>
  <?php endif; ?>

  <div class="wrap scheda-grid">
    <div class="scheda-corpo">
      <h3>Caratteristiche</h3>
      <dl class="dati">
        <?php if ((int) $p['sqm'] > 0): ?><div><dt>Superficie</dt><dd><?= (int) $p['sqm'] ?> mq</dd></div><?php endif; ?>
        <?php if ((int) $p['lot_sqm'] > 0): ?><div><dt>Lotto</dt><dd><?= (int) $p['lot_sqm'] ?> mq</dd></div><?php endif; ?>
        <?php if ((int) $p['rooms'] > 0): ?><div><dt>Locali</dt><dd><?= (int) $p['rooms'] ?></dd></div><?php endif; ?>
        <?php if ((int) $p['bedrooms'] > 0): ?><div><dt>Camere</dt><dd><?= (int) $p['bedrooms'] ?></dd></div><?php endif; ?>
        <?php if ((int) $p['bathrooms'] > 0): ?><div><dt>Bagni</dt><dd><?= (int) $p['bathrooms'] ?></dd></div><?php endif; ?>
        <?php if ($p['floor'] !== ''): ?><div><dt>Piano</dt><dd><?= e((string) $p['floor']) ?></dd></div><?php endif; ?>
        <?php if ((int) $p['year_built'] > 0): ?><div><dt>Anno</dt><dd><?= (int) $p['year_built'] ?></dd></div><?php endif; ?>
        <?php if ($p['energy_class'] !== ''): ?><div><dt>Classe energetica</dt><dd><?= e((string) $p['energy_class']) ?></dd></div><?php endif; ?>
        <?php if ($p['condition_state'] !== ''): ?><div><dt>Stato</dt><dd><?= e(Vocab::label('condition', (string) $p['condition_state'])) ?></dd></div><?php endif; ?>
        <?php if ($p['heating'] !== ''): ?><div><dt>Riscaldamento</dt><dd><?= e((string) $p['heating']) ?></dd></div><?php endif; ?>
        <?php if (!empty($p['condo_fees'])): ?><div><dt>Spese condominiali</dt><dd><?= e(euro((float) $p['condo_fees'], '—')) ?> / anno</dd></div><?php endif; ?>
      </dl>

      <?php if ($features !== []): ?>
        <h3>Dotazioni</h3>
        <ul class="chips">
          <?php foreach ($features as $f): ?><li><?= e($f) ?></li><?php endforeach; ?>
        </ul>
      <?php endif; ?>

      <?php if (trim((string) $p['description']) !== ''): ?>
        <h3>Descrizione</h3>
        <div class="testo"><?= nl2br(e((string) $p['description'])) ?></div>
      <?php endif; ?>

      <?php
      $video = trim((string) ($p['video_url'] ?? ''));
      $tour = trim((string) ($p['tour_url'] ?? ''));
      ?>
      <?php if ($video !== '' || $tour !== ''): ?>
        <h3>Video e visita virtuale</h3>
        <?php /* Link, non riquadri incorporati. Un iframe di YouTube o
                 Matterport carica centinaia di kilobyte e mette un cookie di
                 profilazione a chi apre la pagina, anche a chi il video non lo
                 guarderà mai. Così invece non parte niente finché non si
                 clicca, e la scheda resta veloce. */ ?>
        <p class="media-link">
          <?php if ($video !== ''): ?>
            <a class="btn btn-ghost" href="<?= e($video) ?>" target="_blank" rel="noopener nofollow">▶ Guarda il video</a>
          <?php endif; ?>
          <?php if ($tour !== ''): ?>
            <a class="btn btn-ghost" href="<?= e($tour) ?>" target="_blank" rel="noopener nofollow">⬡ Visita virtuale</a>
          <?php endif; ?>
        </p>
        <p class="nota">Si aprono in una scheda nuova, sul sito di chi li ospita.</p>
      <?php endif; ?>

      <p class="firma">Scheda a cura di Mondo Immobiliare — agenzia FIMAA dal 1994.<br>
        <span>Aggiornata al <?= e(data_it((string) ($p['updated_at'] ?: $p['created_at']))) ?></span></p>
    </div>

    <aside class="scheda-lato">
      <div class="box-contatto">
        <p class="box-prezzo"><?= e($prezzo) ?></p>
        <p>Vuoi vederlo? Fissiamo una visita nei prossimi giorni.</p>
        <p><a class="btn btn-primary" href="tel:+390832391489">Chiama 0832 391489</a></p>
        <p><a class="btn btn-ghost" href="#modulo">Scrivi all’agente</a></p>
      </div>
      <?php if (in_array(mb_strtolower((string) $p['city']), ['porto cesareo', 'torre lapillo', 'torre castiglione'], true)): ?>
        <p class="nota-sede">Immobile seguito dalla sede di <strong>Porto Cesareo</strong>,
          Via Francesco Cilea 76 — <a href="tel:+390832391489">0832 391489</a>.</p>
      <?php else: ?>
        <p class="nota-sede">Immobile seguito dalla sede di <strong>Lecce</strong>,
          Via Giuseppe Parini 48/a — <a href="tel:+390832391489">0832 391489</a>.</p>
      <?php endif; ?>
    </aside>
  </div>

  <div class="wrap">
    <?= View::partial('site/_modulo', [
        'fonte' => 'immobile',
        'titoloForm' => 'Richiedi informazioni su questo immobile',
        'sottotitolo' => 'Ti risponde un agente, non un centralino.',
        'immobileId' => (int) $p['id'],
    ]) ?>
  </div>

  <?php if ($simili !== []): ?>
    <section class="wrap sezione">
      <h3>Altri immobili a <?= e((string) $p['city']) ?></h3>
      <div class="griglia">
        <?php foreach ($simili as $s): ?>
          <?php if ((int) $s['id'] !== (int) $p['id']): ?>
            <?= View::partial('site/_card', ['p' => $s]) ?>
          <?php endif; ?>
        <?php endforeach; ?>
      </div>
    </section>
  <?php endif; ?>
</article>
