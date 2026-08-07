<?php

/** @var array{items:array<int,array<string,mixed>>,total:int,pages:int,page:int} $result */

use Mil\Core\Vocab;
?>
<div class="azioni-testa">
  <form method="get" class="filtri-inline">
    <input type="search" name="cerca" value="<?= e(q('cerca')) ?>" placeholder="Titolo, comune, riferimento…">
    <select name="stato">
      <option value="any">Tutti gli stati</option>
      <?php foreach (Vocab::STATUSES as $slug => $label): ?>
        <option value="<?= e($slug) ?>" <?= q('stato') === $slug ? 'selected' : '' ?>><?= e($label) ?></option>
      <?php endforeach; ?>
    </select>
    <button class="btn btn-ghost">Filtra</button>
  </form>
  <a class="btn btn-primary" href="<?= e(url('/gestionale/immobili/nuovo/')) ?>">+ Nuovo immobile</a>
</div>

<p class="muto"><?= (int) $result['total'] ?> immobili.</p>

<table class="tabella">
  <thead><tr><th>Rif.</th><th>Immobile</th><th>Prezzo</th><th>Stato</th><th>Visite</th><th></th></tr></thead>
  <tbody>
  <?php foreach ($result['items'] as $p): ?>
    <tr>
      <td><code><?= e((string) $p['ref']) ?></code></td>
      <td>
        <a href="<?= e(url('/gestionale/immobili/' . $p['id'] . '/')) ?>"><?= e((string) $p['title']) ?></a><br>
        <small><?= e(Vocab::label('type', (string) $p['type'])) ?> · <?= e((string) $p['city']) ?><?= $p['sqm'] > 0 ? ' · ' . (int) $p['sqm'] . ' mq' : '' ?></small>
      </td>
      <td><?= e((int) $p['price_hidden'] === 1 ? 'Riservato' : euro(isset($p['price']) ? (float) $p['price'] : null, '—')) ?></td>
      <td><span class="pill pill-<?= e((string) $p['status']) ?>"><?= e(Vocab::label('status', (string) $p['status'])) ?></span></td>
      <td><?= (int) $p['views'] ?></td>
      <td class="destra">
        <a class="mini" href="<?= e(url('/gestionale/immobili/' . $p['id'] . '/abbinamenti/')) ?>">A chi proporlo</a>
        <?php if ($p['status'] === 'published' || $p['status'] === 'reserved'): ?>
          <a class="mini" href="<?= e(url('/immobili/' . $p['slug'] . '/')) ?>" target="_blank" rel="noopener">Vedi ↗</a>
        <?php endif; ?>
      </td>
    </tr>
  <?php endforeach; ?>
  </tbody>
</table>

<?php if ($result['items'] === []): ?>
  <p class="vuoto">Nessun immobile con questi criteri.</p>
<?php endif; ?>

<?php if ($result['pages'] > 1): ?>
  <nav class="paginazione">
    <?php for ($i = 1; $i <= $result['pages']; $i++): ?>
      <?php if ($i === $result['page']): ?><span class="on"><?= $i ?></span>
      <?php else: ?><a href="?pagina=<?= $i ?>&amp;stato=<?= e(q('stato')) ?>&amp;cerca=<?= e(q('cerca')) ?>"><?= $i ?></a><?php endif; ?>
    <?php endfor; ?>
  </nav>
<?php endif; ?>
