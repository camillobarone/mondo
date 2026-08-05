<?php

/** @var array<int,array{q:string,a:string}> $faq */

use Mil\Core\View;
?>
<section class="wrap sezione">
  <h1 class="pagina-titolo">Valutazione gratuita della tua casa</h1>

  <p class="risposta-diretta">
    La valutazione è gratuita e non impegna. Un agente FIMAA viene a vedere l’immobile,
    incrocia i prezzi delle compravendite chiuse in zona con le quotazioni OMI dell’Agenzia
    delle Entrate e ti consegna una forbice di prezzo realistica entro 48 ore lavorative.
  </p>

  <h2 class="titolo-sezione">Perché il prezzo giusto conta più di tutto il resto</h2>
  <p>
    Un immobile fuori mercato resta fermo, perde visibilità sui portali e alla fine si vende
    comunque, ma più in basso e mesi dopo. La maggioranza di chi vende bene parte da una
    valutazione professionale: è il singolo passaggio che decide come andrà tutto il resto.
  </p>

  <h2 class="titolo-sezione">Cosa guardiamo</h2>
  <ul class="elenco">
    <li>Le compravendite realmente concluse nella stessa zona, non i prezzi richiesti sugli annunci.</li>
    <li>Le quotazioni OMI del semestre in corso, come riferimento ufficiale prudenziale.</li>
    <li>Lo stato dell’immobile, l’esposizione, il piano, le pertinenze, la classe energetica.</li>
    <li>La conformità urbanistica e catastale: un problema documentale scoperto al rogito costa molto più che scoperto oggi.</li>
  </ul>

  <h2 class="titolo-sezione">I valori di riferimento a Lecce, oggi</h2>
  <ul class="elenco">
    <li>Centro storico: 1.900 – 2.500 €/mq</li>
    <li>Quartieri semicentrali (Mazzini, Salesiani, Rudiae, San Lazzaro, Ariosto): 1.200 – 1.700 €/mq</li>
    <li>Periferia: 800 – 1.300 €/mq</li>
    <li>Marine: 1.100 – 2.200 €/mq secondo la distanza dal mare</li>
  </ul>
  <p class="nota">Sono fasce di zona: il valore del singolo immobile si sposta dentro la fascia, e a volte fuori, in base allo stato reale.</p>

  <?= View::partial('site/_modulo', [
      'fonte' => 'valutazione',
      'titoloForm' => 'Chiedi la valutazione',
      'sottotitolo' => 'Lasciaci nome, telefono e dove si trova la casa: ti richiamiamo noi.',
  ]) ?>

  <section class="faq">
    <h2 class="titolo-sezione">Domande frequenti</h2>
    <?php foreach ($faq as $item): ?>
      <div class="faq-item">
        <h3><?= e($item['q']) ?></h3>
        <p><?= e($item['a']) ?></p>
      </div>
    <?php endforeach; ?>
  </section>

  <p class="firma">Camillo Barone — Agente Immobiliare FIMAA<br>
    <span>Aggiornato al <?= e(data_it(date('Y-m-d'))) ?></span></p>
</section>
