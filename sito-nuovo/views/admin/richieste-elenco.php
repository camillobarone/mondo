<?php

/**
 * @var array{items:array<int,array<string,mixed>>,total:int,pages:int,page:int} $result
 * @var array<string,int> $contatori
 */

use Mil\Core\Vocab;
?>
<form method="get" class="filtri-inline">
  <input type="search" name="cerca" value="<?= e(q('cerca')) ?>" placeholder="Nome, telefono, email…">
  <select name="stato">
    <option value="">Tutti gli stati</option>
    <?php foreach (Vocab::LEAD_STATUSES as $slug => $label): ?>
      <option value="<?= e($slug) ?>" <?= q('stato') === $slug ? 'selected' : '' ?>><?= e($label) ?></option>
    <?php endforeach; ?>
  </select>
  <select name="fonte">
    <option value="">Ogni origine</option>
    <?php foreach (Vocab::LEAD_SOURCES as $slug => $label): ?>
      <option value="<?= e($slug) ?>" <?= q('fonte') === $slug ? 'selected' : '' ?>><?= e($label) ?></option>
    <?php endforeach; ?>
  </select>
  <button class="btn btn-ghost">Filtra</button>
</form>

<p class="muto"><?= (int) $result['total'] ?> richieste · <?= (int) ($contatori['nuovo'] ?? 0) ?> ancora da lavorare.</p>

<table class="tabella">
  <thead><tr><th>Quando</th><th>Chi</th><th>Recapiti</th><th>Origine</th><th>Stato</th><th>Assegnata a</th></tr></thead>
  <tbody>
  <?php foreach ($result['items'] as $l): ?>
    <tr>
      <td><?= e(data_it((string) $l['created_at'], true)) ?></td>
      <td><a href="<?= e(url('/gestionale/richieste/' . $l['id'] . '/')) ?>"><?= e((string) $l['name']) ?></a></td>
      <td>
        <?php if ($l['phone'] !== ''): ?><a href="tel:<?= e((string) $l['phone']) ?>"><?= e((string) $l['phone']) ?></a><br><?php endif; ?>
        <?php if ($l['email'] !== ''): ?><small><?= e((string) $l['email']) ?></small><?php endif; ?>
      </td>
      <td><?= e(Vocab::label('lead_source', (string) $l['source'])) ?>
        <?php if (!empty($l['property_title'])): ?><br><small><?= e((string) $l['property_title']) ?></small><?php endif; ?>
      </td>
      <td><span class="pill pill-<?= e((string) $l['status']) ?>"><?= e(Vocab::label('lead_status', (string) $l['status'])) ?></span></td>
      <td><?= e((string) ($l['agent_name'] ?? '—')) ?></td>
    </tr>
  <?php endforeach; ?>
  </tbody>
</table>

<?php if ($result['items'] === []): ?>
  <p class="vuoto">Nessuna richiesta con questi criteri.</p>
<?php endif; ?>

<?php if ($result['pages'] > 1): ?>
  <nav class="paginazione">
    <?php for ($i = 1; $i <= $result['pages']; $i++): ?>
      <?php if ($i === $result['page']): ?><span class="on"><?= $i ?></span>
      <?php else: ?><a href="?pagina=<?= $i ?>&amp;stato=<?= e(q('stato')) ?>&amp;fonte=<?= e(q('fonte')) ?>&amp;cerca=<?= e(q('cerca')) ?>"><?= $i ?></a><?php endif; ?>
    <?php endfor; ?>
  </nav>
<?php endif; ?>
