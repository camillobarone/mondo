<?php

use Mil\Core\View;
?>
<section class="wrap sezione">
  <h1 class="pagina-titolo">Contatti</h1>
  <p class="risposta-diretta">
    Due sedi, un solo numero: <a href="tel:+390832391489">0832 391489</a>.
    Siamo aperti dal lunedì al venerdì, 9:00–13:00 e 16:30–19:00.
  </p>

  <div class="sedi">
    <div class="sede">
      <h2 class="titolo-sezione">Lecce</h2>
      <p>Via Giuseppe Parini 48/a<br>73100 Lecce</p>
      <p>Telefono <a href="tel:+390832391489">0832 391489</a><br>
         Cellulare <a href="tel:+393927282442">392 728 2442</a></p>
    </div>
    <div class="sede">
      <h2 class="titolo-sezione">Porto Cesareo</h2>
      <p>Via Francesco Cilea 76<br>73010 Porto Cesareo (LE)</p>
      <p>Telefono <a href="tel:+390832391489">0832 391489</a></p>
      <p class="nota">La sede di Porto Cesareo segue la costa ionica: Torre Lapillo, Punta Prosciutto, Torre Castiglione.</p>
    </div>
  </div>

  <?= View::partial('site/_modulo', [
      'fonte' => 'contatto',
      'titoloForm' => 'Scrivici',
      'sottotitolo' => 'Rispondiamo entro 48 ore lavorative.',
  ]) ?>
</section>
