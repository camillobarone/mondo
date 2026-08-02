<?php

/** @var array<string,array{0:string,1:string}> $campi */

use Mil\Core\Csrf;
use Mil\Core\Settings;
?>
<form method="post" class="form pannello">
  <?= Csrf::field() ?>
  <h2>Impostazioni del sito</h2>

  <?php foreach ($campi as $key => [$label, $aiuto]): ?>
    <label>
      <?= e($label) ?>
      <?php if ($aiuto !== ''): ?><small><?= e($aiuto) ?></small><?php endif; ?>
      <input type="text" name="<?= e($key) ?>" value="<?= e(Settings::get($key)) ?>">
    </label>
  <?php endforeach; ?>

  <button class="btn btn-primary">Salva impostazioni</button>
</form>

<div class="pannello">
  <h2>Nota sul JSON-LD</h2>
  <p>
    I dati strutturati vengono generati dal codice, non incollati a mano: nodo agenzia,
    annunci, articoli e breadcrumb seguono le regole già validate sul sito attuale
    (un solo <code>@graph</code> per pagina, valutazione media solo sull’agenzia,
    <code>Offer</code> omesso quando il prezzo è riservato).
  </p>
  <p>
    L’unico valore da tenere aggiornato a mano è il numero delle recensioni Google,
    che vive in <code>app/Core/Seo.php</code>. Quando cambia sulla scheda Google, si aggiorna lì
    e cambia su tutte le pagine insieme.
  </p>
</div>
