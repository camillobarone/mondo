<?php

/**
 * @var array<string,mixed> $p
 * @var array<int,array{contact:array<string,mixed>,score:int,reasons:array<int,string>}> $abbinamenti
 */
?>
<p class="muto">
  <a href="<?= e(url('/gestionale/immobili/' . $p['id'] . '/')) ?>">← Torna alla scheda</a> ·
  <?= e(euro(isset($p['price']) ? (float) $p['price'] : null)) ?> ·
  <?= (int) $p['sqm'] ?> mq · <?= e((string) $p['city']) ?>
</p>

<?php if ($abbinamenti === []): ?>
  <p class="vuoto">Nessun cliente in ricerca corrisponde a questo immobile.
    <a href="<?= e(url('/gestionale/clienti/nuovo/')) ?>">Registra una richiesta</a> per iniziare a popolare gli abbinamenti.</p>
<?php else: ?>
  <p class="muto"><?= count($abbinamenti) ?> clienti da chiamare, ordinati per affinità.</p>
  <table class="tabella">
    <thead><tr><th>Affinità</th><th>Cliente</th><th>Perché</th><th>Recapiti</th></tr></thead>
    <tbody>
    <?php foreach ($abbinamenti as $m): ?>
      <tr>
        <td><span class="score score-grande"><?= (int) $m['score'] ?>%</span></td>
        <td><a href="<?= e(url('/gestionale/clienti/' . $m['contact']['id'] . '/')) ?>"><?= e((string) $m['contact']['name']) ?></a></td>
        <td>
          <?php if ($m['reasons'] === []): ?><small class="muto">Criteri generici</small><?php else: ?>
            <ul class="motivi"><?php foreach ($m['reasons'] as $r): ?><li><?= e($r) ?></li><?php endforeach; ?></ul>
          <?php endif; ?>
        </td>
        <td>
          <?php if ($m['contact']['phone'] !== ''): ?>
            <a href="tel:<?= e((string) $m['contact']['phone']) ?>"><?= e((string) $m['contact']['phone']) ?></a><br>
          <?php endif; ?>
          <?php if ($m['contact']['email'] !== ''): ?><small><?= e((string) $m['contact']['email']) ?></small><?php endif; ?>
        </td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
<?php endif; ?>
