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

  <h2>Visibilità sui motori</h2>
  <label class="check">
    <input type="checkbox" name="noindex" value="1" <?= Settings::get('noindex', '0') === '1' ? 'checked' : '' ?>>
    <span>Installazione di prova: tieni il sito fuori dai motori di ricerca</span>
  </label>
  <p class="aiuto">
    Con la spunta attiva ogni pagina esce <code>noindex, nofollow</code> e il
    <code>robots.txt</code> risponde <code>Disallow: /</code>. Serve finché questo
    indirizzo affianca il sito vero: due copie degli stessi immobili su due
    indirizzi si tolgono posizioni a vicenda, e a rimetterci è quello che oggi
    porta i contatti.
    <strong>Va tolta a mano il giorno in cui si va online</strong> — deve essere
    una decisione, non una dimenticanza.
  </p>

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
