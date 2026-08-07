<?php

/** @var array{items:array<int,array<string,mixed>>,total:int,pages:int,page:int} $result */

use Mil\Core\Vocab;
?>
<div class="azioni-testa">
  <form method="get" class="filtri-inline">
    <input type="search" name="cerca" value="<?= e(q('cerca')) ?>" placeholder="Nome, telefono, note…">
    <select name="attivi">
      <option value="1" <?= q('attivi', '1') === '1' ? 'selected' : '' ?>>In ricerca</option>
      <option value="0" <?= q('attivi') === '0' ? 'selected' : '' ?>>Archiviati</option>
      <option value="any" <?= q('attivi') === 'any' ? 'selected' : '' ?>>Tutti</option>
    </select>
    <select name="ruolo">
      <option value="">Ogni ruolo</option>
      <?php foreach (Vocab::CLIENT_ROLES as $slug => $label): ?>
        <option value="<?= e($slug) ?>" <?= q('ruolo') === $slug ? 'selected' : '' ?>><?= e($label) ?></option>
      <?php endforeach; ?>
    </select>
    <select name="stato">
      <option value="">Ogni stato</option>
      <?php foreach (Vocab::CLIENT_STATUSES as $slug => $label): ?>
        <option value="<?= e($slug) ?>" <?= q('stato') === $slug ? 'selected' : '' ?>><?= e($label) ?></option>
      <?php endforeach; ?>
    </select>
    <button class="btn btn-ghost">Filtra</button>
  </form>
  <a class="btn btn-primary" href="<?= e(url('/gestionale/clienti/nuovo/')) ?>">+ Nuova richiesta</a>
</div>

<p class="muto">Chi cerca casa, con i suoi criteri. Il gestionale incrocia questi dati con il portafoglio immobili.</p>

<table class="tabella">
  <thead><tr><th>Cliente</th><th>Cerca</th><th>Budget</th><th>Dove</th><th>Agente</th><th></th></tr></thead>
  <tbody>
  <?php foreach ($result['items'] as $c): ?>
    <tr class="<?= (int) $c['active'] === 0 ? 'spento' : '' ?>">
      <td><a href="<?= e(url('/gestionale/clienti/' . $c['id'] . '/')) ?>"><?= e((string) $c['name']) ?></a><br>
        <small><?= e((string) ($c['phone'] ?: $c['email'])) ?></small></td>
      <td>
        <?= e(Vocab::label('contract', (string) $c['contract'])) ?>
        <?php if ($c['types'] !== ''): ?>
          <br><small><?php
            $labels = array_map(
                static fn (string $t): string => Vocab::label('type', $t),
                array_filter(explode(',', (string) $c['types']))
            );
            echo e(implode(', ', $labels));
          ?></small>
        <?php endif; ?>
      </td>
      <td><?= e(euro(!empty($c['budget_max']) ? (float) $c['budget_max'] : null, 'non indicato')) ?></td>
      <td><small><?= e((string) $c['cities'] ?: 'ovunque') ?></small></td>
      <td><?= e((string) ($c['agent_name'] ?? '—')) ?></td>
      <td class="destra"><a class="mini" href="<?= e(url('/gestionale/clienti/' . $c['id'] . '/abbinamenti/')) ?>">Cosa proporgli</a></td>
    </tr>
  <?php endforeach; ?>
  </tbody>
</table>

<?php if ($result['items'] === []): ?>
  <p class="vuoto">Nessuna richiesta registrata. <a href="<?= e(url('/gestionale/clienti/nuovo/')) ?>">Inseriscine una</a>:
    da quel momento ogni immobile nuovo verrà confrontato con questi criteri.</p>
<?php endif; ?>
