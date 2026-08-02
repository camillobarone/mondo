<?php

/**
 * @var array{items:array<int,array<string,mixed>>,total:int,pages:int,page:int} $result
 * @var array<string,mixed> $filters
 * @var array<int,string> $cities
 */

use Mil\Core\View;
use Mil\Core\Vocab;

/** Conserva i filtri attivi quando si cambia pagina. */
$qs = static function (int $page) use ($filters): string {
    $params = array_filter([
        'contratto' => $filters['contract'],
        'tipologia' => $filters['type'],
        'comune' => $filters['city'],
        'prezzo_min' => $filters['price_min'],
        'prezzo_max' => $filters['price_max'],
        'mq_min' => $filters['sqm_min'],
        'camere' => $filters['bedrooms_min'],
        'cerca' => $filters['q'],
        'ordina' => $filters['sort'],
        'pagina' => $page > 1 ? $page : null,
    ], static fn (mixed $v): bool => $v !== null && $v !== '' && $v !== 0);

    return $params === [] ? '' : '?' . http_build_query($params);
};
?>
<section class="wrap sezione">
  <h2 class="pagina-titolo">Immobili in vendita a Lecce e nel Salento</h2>
  <p class="pagina-sub"><?= (int) $result['total'] ?> immobili disponibili, selezionati e verificati dai nostri agenti.</p>

  <form class="filtri" method="get">
    <label>Comune
      <select name="comune">
        <option value="">Tutti</option>
        <?php foreach ($cities as $city): ?>
          <option value="<?= e($city) ?>" <?= $filters['city'] === $city ? 'selected' : '' ?>><?= e($city) ?></option>
        <?php endforeach; ?>
      </select>
    </label>
    <label>Tipologia
      <select name="tipologia">
        <option value="">Tutte</option>
        <?php foreach (Vocab::TYPES as $slug => $label): ?>
          <option value="<?= e($slug) ?>" <?= $filters['type'] === $slug ? 'selected' : '' ?>><?= e($label) ?></option>
        <?php endforeach; ?>
      </select>
    </label>
    <label>Contratto
      <select name="contratto">
        <option value="">Tutti</option>
        <?php foreach (Vocab::CONTRACTS as $slug => $label): ?>
          <option value="<?= e($slug) ?>" <?= $filters['contract'] === $slug ? 'selected' : '' ?>><?= e($label) ?></option>
        <?php endforeach; ?>
      </select>
    </label>
    <label>Prezzo max
      <input type="text" name="prezzo_max" inputmode="numeric" value="<?= e($filters['price_max'] !== null ? (string) (int) $filters['price_max'] : '') ?>">
    </label>
    <label>Mq minimi
      <input type="text" name="mq_min" inputmode="numeric" value="<?= e($filters['sqm_min'] !== null ? (string) $filters['sqm_min'] : '') ?>">
    </label>
    <label>Ordina
      <select name="ordina">
        <option value="">Più recenti</option>
        <option value="prezzo-asc" <?= $filters['sort'] === 'prezzo-asc' ? 'selected' : '' ?>>Prezzo crescente</option>
        <option value="prezzo-desc" <?= $filters['sort'] === 'prezzo-desc' ? 'selected' : '' ?>>Prezzo decrescente</option>
        <option value="mq-desc" <?= $filters['sort'] === 'mq-desc' ? 'selected' : '' ?>>Più grandi</option>
      </select>
    </label>
    <button type="submit" class="btn btn-primary">Filtra</button>
    <a class="btn btn-ghost" href="<?= e(url('/immobili/')) ?>">Azzera</a>
  </form>

  <?php if ($result['items'] === []): ?>
    <p class="vuoto">Nessun immobile corrisponde a questi criteri. Prova ad allargare la ricerca, oppure
      <a href="<?= e(url('/contatti/')) ?>">dicci cosa cerchi</a>: molti immobili non arrivano mai al sito.</p>
  <?php else: ?>
    <div class="griglia">
      <?php foreach ($result['items'] as $p): ?>
        <?= View::partial('site/_card', ['p' => $p]) ?>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>

  <?php if ($result['pages'] > 1): ?>
    <nav class="paginazione" aria-label="Pagine dei risultati">
      <?php for ($i = 1; $i <= $result['pages']; $i++): ?>
        <?php if ($i === $result['page']): ?>
          <span class="on"><?= $i ?></span>
        <?php else: ?>
          <a href="<?= e(url('/immobili/') . $qs($i)) ?>"><?= $i ?></a>
        <?php endif; ?>
      <?php endfor; ?>
    </nav>
  <?php endif; ?>
</section>
