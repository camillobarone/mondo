<?php

/**
 * @var array<string,mixed> $c
 * @var array<int,array{property:array<string,mixed>,score:int,reasons:array<int,string>}> $abbinamenti
 */

use Mil\Core\Vocab;
?>
<p class="muto">
  <a href="<?= e(url('/gestionale/clienti/' . $c['id'] . '/')) ?>">← Torna alla scheda</a> ·
  <?= e(Vocab::label('contract', (string) $c['contract'])) ?> ·
  budget fino a <?= e(euro(!empty($c['budget_max']) ? (float) $c['budget_max'] : null, 'non indicato')) ?>
</p>

<?php if ($abbinamenti === []): ?>
  <p class="vuoto">Nessun immobile in portafoglio corrisponde a questi criteri.</p>
<?php else: ?>
  <p class="muto"><?= count($abbinamenti) ?> immobili da proporre, ordinati per affinità.</p>
  <table class="tabella">
    <thead><tr><th>Affinità</th><th>Immobile</th><th>Perché</th><th>Prezzo</th></tr></thead>
    <tbody>
    <?php foreach ($abbinamenti as $m): ?>
      <tr>
        <td><span class="score score-grande"><?= (int) $m['score'] ?>%</span></td>
        <td>
          <a href="<?= e(url('/gestionale/immobili/' . $m['property']['id'] . '/')) ?>"><?= e((string) $m['property']['title']) ?></a><br>
          <small><?= e(Vocab::label('type', (string) $m['property']['type'])) ?> ·
            <?= e((string) $m['property']['city']) ?> · <?= (int) $m['property']['sqm'] ?> mq</small>
        </td>
        <td>
          <?php if ($m['reasons'] === []): ?><small class="muto">Criteri generici</small><?php else: ?>
            <ul class="motivi"><?php foreach ($m['reasons'] as $r): ?><li><?= e($r) ?></li><?php endforeach; ?></ul>
          <?php endif; ?>
        </td>
        <td><?= e(euro(isset($m['property']['price']) ? (float) $m['property']['price'] : null)) ?></td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
<?php endif; ?>
