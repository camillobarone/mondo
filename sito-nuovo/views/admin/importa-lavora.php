<?php

/**
 * @var int $fatti
 * @var int $totale
 * @var array<string,int> $conta
 * @var array<int,array<string,mixed>> $ultimi
 */

// Il proseguimento è un meta refresh, non JavaScript: un lotto per caricamento,
// così nessuna richiesta dura abbastanza da farsi interrompere dal server.
$percento = $totale > 0 ? (int) round($fatti * 100 / $totale) : 0;
?>
<meta http-equiv="refresh" content="1; url=<?= e(url('/gestionale/importa/lavora/')) ?>">

<div class="pannello">
  <h2>Importazione in corso</h2>
  <p><strong><?= $fatti ?></strong> di <?= $totale ?> immobili — <?= $percento ?>%</p>

  <div class="barra" role="progressbar" aria-valuenow="<?= $percento ?>" aria-valuemin="0" aria-valuemax="100">
    <span style="width: <?= $percento ?>%"></span>
  </div>

  <p class="aiuto">
    La pagina prosegue da sola. <strong>Non chiuderla e non ricaricarla a mano.</strong>
    Se si interrompe non si perde niente: si riprende da dove era.
  </p>

  <ul class="elenco">
    <li>Nuovi: <strong><?= (int) ($conta['nuovi'] ?? 0) ?></strong></li>
    <li>Aggiornati: <strong><?= (int) ($conta['aggiornati'] ?? 0) ?></strong></li>
    <li>Foto importate: <strong><?= (int) ($conta['foto'] ?? 0) ?></strong></li>
    <?php if ((int) ($conta['errori'] ?? 0) > 0): ?>
      <li>Saltati per errore: <strong><?= (int) $conta['errori'] ?></strong></li>
    <?php endif; ?>
  </ul>

  <?php if ($ultimi !== []): ?>
    <h3>Appena lavorati</h3>
    <ul class="elenco">
      <?php foreach ($ultimi as $r): ?>
        <li>
          <?= e((string) $r['stato']) ?> — <?= e((string) $r['titolo']) ?>
          <?php if ((int) $r['foto'] > 0): ?> (<?= (int) $r['foto'] ?> foto)<?php endif; ?>
          <?php if ($r['messaggio'] !== ''): ?> — <?= e((string) $r['messaggio']) ?><?php endif; ?>
        </li>
      <?php endforeach; ?>
    </ul>
  <?php endif; ?>
</div>
