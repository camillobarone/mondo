<?php

/**
 * @var array<int,array<string,mixed>> $featured
 * @var array<int,array<string,mixed>> $posts
 * @var array<int,string> $cities
 */

use Mil\Core\Assets;
use Mil\Core\View;
use Mil\Core\Vocab;

// Lo sfondo dell'hero è la copertina di un immobile in evidenza: nessun file
// in più da caricare, e la home cambia faccia da sola quando cambia la
// vetrina. Se nessuno ha foto resta il fondo scuro, senza buchi.
$sfondo = Mil\Controller\Site\Pages::heroImage($featured);
$sfondoSrc = $sfondo === null ? '' : (string) $sfondo['cover'];
?>
<section class="hero<?= $sfondoSrc === '' ? ' hero-senza-foto' : '' ?>">
  <?php if ($sfondoSrc !== ''): ?>
    <img class="hero-sfondo" src="<?= e(url($sfondoSrc)) ?>"
         <?php if (($sfondo['cover_srcset'] ?? '') !== ''): ?>
         srcset="<?= e(srcset_url((string) $sfondo['cover_srcset'])) ?>"
         sizes="100vw"
         <?php endif; ?>
         alt="" role="presentation"
         width="1600" height="1120" fetchpriority="high" decoding="async">
  <?php endif; ?>
  <div class="wrap">
    <p class="hero-kicker">Lecce · Porto Cesareo · Salento</p>
    <h1>La casa giusta la si riconosce entrando.<br>Il prezzo giusto, prima.</h1>
    <p class="hero-lead">
      Dal 1994 accompagniamo chi compra e chi vende fra Lecce e la costa ionica.
      Oltre 3.000 compravendite, due sedi, un metodo: prima i numeri veri della zona, poi la trattativa.
    </p>

    <form class="hero-search" method="get" action="<?= e(url('/immobili/')) ?>">
      <?php /* L'etichetta la nasconde solo il testo: `sr` su `label` porterebbe
               fuori schermo anche il campo, e il modulo resterebbe col solo
               bottone. Il nome del campo resta nella prima option. */ ?>
      <label><span class="sr">Comune</span>
        <select name="comune">
          <option value="">Tutti i comuni</option>
          <?php foreach ($cities as $city): ?>
            <option value="<?= e($city) ?>"><?= e($city) ?></option>
          <?php endforeach; ?>
        </select>
      </label>
      <label><span class="sr">Tipologia</span>
        <select name="tipologia">
          <option value="">Ogni tipologia</option>
          <?php foreach (Vocab::TYPES as $slug => $label): ?>
            <option value="<?= e($slug) ?>"><?= e($label) ?></option>
          <?php endforeach; ?>
        </select>
      </label>
      <label><span class="sr">Prezzo massimo</span>
        <input type="text" name="prezzo_max" placeholder="Prezzo massimo €" inputmode="numeric">
      </label>
      <button type="submit" class="btn btn-primary">Cerca</button>
    </form>

    <?php
    /* Le scorciatoie nascono dai comuni che hanno davvero immobili online:
       una voce fissa scritta a mano finirebbe prima o poi su un elenco vuoto,
       che è il modo più veloce per far chiudere la pagina. */
    $scorciatoie = [];
    foreach (array_slice($cities, 0, 4) as $comune) {
        $scorciatoie[] = ['Case a ' . $comune, '/immobili/?comune=' . rawurlencode($comune)];
    }
    $scorciatoie[] = ['Fino a 150.000 €', '/immobili/?prezzo_max=150000'];
    ?>
    <?php if (count($scorciatoie) > 1): ?>
      <ul class="scorciatoie">
        <?php foreach ($scorciatoie as [$etichetta, $indirizzo]): ?>
          <li><a href="<?= e(url($indirizzo)) ?>"><?= e($etichetta) ?></a></li>
        <?php endforeach; ?>
      </ul>
    <?php endif; ?>

    <ul class="trust">
      <li><strong>4,9 / 5</strong><span>58 recensioni Google</span></li>
      <li><strong>FIMAA</strong><span>iscritti dal 1994</span></li>
      <li><strong>3.000+</strong><span>compravendite concluse</span></li>
    </ul>
  </div>
</section>

<section class="wrap sezione">
  <div class="sezione-head">
    <h2>Immobili in evidenza</h2>
    <a class="link-more" href="<?= e(url('/immobili/')) ?>">Vedi tutti gli immobili</a>
  </div>

  <?php if ($featured === []): ?>
    <p class="vuoto">Nessun immobile pubblicato al momento.</p>
  <?php else: ?>
    <div class="griglia">
      <?php /* Niente `eager` qui: in home la griglia sta sotto l'hero, fuori
               dalla prima schermata. L'LCP è il titolo, non queste foto. */ ?>
      <?php foreach ($featured as $p): ?>
        <?= View::partial('site/_card', ['p' => $p]) ?>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>
</section>

<section class="fascia">
  <div class="wrap fascia-grid">
    <div>
      <h2>Quanto vale davvero la tua casa</h2>
      <p>
        Una valutazione sbagliata costa mesi. Partiamo dai prezzi reali delle compravendite
        chiuse in zona e dalle quotazioni OMI dell’Agenzia delle Entrate, non da una stima a occhio:
        oggi il centro storico di Lecce sta fra 1.900 e 2.500 €/mq, i quartieri semicentrali fra
        1.200 e 1.700, le marine fra 1.100 e 2.200 a seconda della distanza dal mare.
      </p>
      <p><a class="btn btn-primary" href="<?= e(url('/valutazione-gratuita/')) ?>">Chiedi la valutazione gratuita</a></p>
    </div>
    <div class="fascia-box">
      <h3>Due sedi, un solo interlocutore</h3>
      <p><strong>Lecce</strong> — Via Giuseppe Parini 48/a<br>
         <strong>Porto Cesareo</strong> — Via Francesco Cilea 76</p>
      <p>Lunedì – venerdì, 9:00–13:00 e 16:30–19:00<br>
         <a href="tel:+390832391489">0832 391489</a></p>
    </div>
  </div>
</section>

<?php if ($posts !== []): ?>
<section class="wrap sezione">
  <div class="sezione-head">
    <h2>Dal blog</h2>
    <a class="link-more" href="<?= e(url('/blog/')) ?>">Tutti gli articoli</a>
  </div>
  <div class="griglia griglia-3">
    <?php foreach ($posts as $post): ?>
      <article class="post-card">
        <h3><a href="<?= e(url('/blog/' . $post['slug'] . '/')) ?>"><?= e((string) $post['title']) ?></a></h3>
        <p><?= e(tronca((string) ($post['excerpt'] ?: $post['body']), 140)) ?></p>
        <p class="post-meta"><?= e(data_it((string) ($post['published_at'] ?: $post['created_at']))) ?></p>
      </article>
    <?php endforeach; ?>
  </div>
</section>
<?php endif; ?>
