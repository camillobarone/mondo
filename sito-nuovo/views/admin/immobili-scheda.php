<?php

/**
 * @var array<string,mixed> $p
 * @var array<int,array<string,mixed>> $images
 * @var array<int,array<string,mixed>> $agenti
 * @var array<int,array{contact:array<string,mixed>,score:int,reasons:array<int,string>}> $abbinamenti
 */

use Mil\Core\Csrf;
use Mil\Core\Vocab;

$isNew = (int) $p['id'] === 0;
$features = array_filter(array_map('trim', explode(',', (string) $p['features'])));
?>
<form method="post" class="form form-larga">
  <?= Csrf::field() ?>

  <div class="due-colonne">
    <div class="pannello">
      <h2>Annuncio</h2>

      <label>Titolo
        <input type="text" name="title" value="<?= e((string) $p['title']) ?>" required maxlength="191">
      </label>

      <div class="form-row">
        <label>Slug (indirizzo)
          <input type="text" name="slug" value="<?= e((string) $p['slug']) ?>" placeholder="generato dal titolo">
          <small>Cambiandolo viene creato in automatico un 301 dal vecchio indirizzo.</small>
        </label>
        <label>Riferimento
          <input type="text" name="ref" value="<?= e((string) $p['ref']) ?>" placeholder="assegnato in automatico">
        </label>
      </div>

      <div class="form-row">
        <label>Stato di pubblicazione <small>cosa vede chi arriva sul sito</small>
          <select name="status">
            <?php foreach (Vocab::STATUSES as $slug => $label): ?>
              <option value="<?= e($slug) ?>" <?= $p['status'] === $slug ? 'selected' : '' ?>><?= e($label) ?></option>
            <?php endforeach; ?>
          </select>
        </label>
        <label>Stato della trattativa <small>a che punto è il lavoro</small>
          <select name="deal_stage">
            <?php foreach (Vocab::DEAL_STAGES as $slug => $label): ?>
              <option value="<?= e($slug) ?>" <?= ($p['deal_stage'] ?? '') === $slug ? 'selected' : '' ?>><?= e($label) ?></option>
            <?php endforeach; ?>
          </select>
        </label>
        <label>Contratto
          <select name="contract">
            <?php foreach (Vocab::CONTRACTS as $slug => $label): ?>
              <option value="<?= e($slug) ?>" <?= $p['contract'] === $slug ? 'selected' : '' ?>><?= e($label) ?></option>
            <?php endforeach; ?>
          </select>
        </label>
        <label>Tipologia
          <select name="type">
            <?php foreach (Vocab::TYPES as $slug => $label): ?>
              <option value="<?= e($slug) ?>" <?= $p['type'] === $slug ? 'selected' : '' ?>><?= e($label) ?></option>
            <?php endforeach; ?>
          </select>
        </label>
      </div>

      <div class="form-row">
        <label>Prezzo €
          <input type="text" name="price" inputmode="numeric" value="<?= e(!empty($p['price']) ? (string) (int) $p['price'] : '') ?>">
        </label>
        <label class="check">
          <input type="checkbox" name="price_hidden" value="1" <?= (int) $p['price_hidden'] === 1 ? 'checked' : '' ?>>
          Trattativa riservata
          <small>Il prezzo non compare in pagina e il nodo Offer viene omesso dallo schema.</small>
        </label>
        <label class="check">
          <input type="checkbox" name="featured" value="1" <?= (int) $p['featured'] === 1 ? 'checked' : '' ?>>
          In evidenza in home
        </label>
      </div>

      <div class="form-row">
        <label>Prezzo minimo accettato €
          <input type="text" name="min_price" inputmode="numeric" value="<?= e(!empty($p['min_price']) ? (string) (int) $p['min_price'] : '') ?>">
          <small>Solo interno. Non esce dal gestionale in nessuna pagina pubblica.</small>
        </label>
        <label>Motivo del cambio prezzo
          <input type="text" name="price_reason" placeholder="es. ribasso concordato col proprietario">
          <small>Compilato solo quando cambi il prezzo: finisce nello storico.</small>
        </label>
      </div>

      <h3>Incarico</h3>
      <div class="form-row">
        <label>Proprietario
          <select name="owner_contact_id">
            <option value="">—</option>
            <?php foreach ($clienti as $cl): ?>
              <option value="<?= (int) $cl['id'] ?>" <?= (int) ($p['owner_contact_id'] ?? 0) === (int) $cl['id'] ? 'selected' : '' ?>><?= e((string) $cl['name']) ?></option>
            <?php endforeach; ?>
          </select>
        </label>
        <label>Inizio incarico<input type="date" name="mandate_start" value="<?= e((string) ($p['mandate_start'] ?? '')) ?>"></label>
        <label>Scadenza incarico<input type="date" name="mandate_end" value="<?= e((string) ($p['mandate_end'] ?? '')) ?>"></label>
        <label>Provvigione %<input type="text" name="commission_pct" inputmode="decimal" value="<?= e(!empty($p['commission_pct']) ? (string) $p['commission_pct'] : '') ?>"></label>
      </div>
      <label class="check">
        <input type="checkbox" name="exclusive" value="1" <?= (int) ($p['exclusive'] ?? 0) === 1 ? 'checked' : '' ?>>
        Incarico in esclusiva
      </label>

      <h3>Chiusura</h3>
      <div class="form-row">
        <label>Prezzo di vendita €
          <input type="text" name="sold_price" inputmode="numeric" value="<?= e(!empty($p['sold_price']) ? (string) (int) $p['sold_price'] : '') ?>">
        </label>
        <label>Data compromesso<input type="date" name="preliminary_date" value="<?= e((string) ($p['preliminary_date'] ?? '')) ?>"></label>
        <label>Data rogito<input type="date" name="deed_date" value="<?= e((string) ($p['deed_date'] ?? '')) ?>"></label>
      </div>
      <div class="form-row">
        <label>Provvigione venditore €
          <input type="text" name="commission_seller" inputmode="numeric" value="<?= e(!empty($p['commission_seller']) ? (string) (int) $p['commission_seller'] : '') ?>">
        </label>
        <label>Provvigione acquirente €
          <input type="text" name="commission_buyer" inputmode="numeric" value="<?= e(!empty($p['commission_buyer']) ? (string) (int) $p['commission_buyer'] : '') ?>">
        </label>
        <label class="check">
          <input type="checkbox" name="commission_paid" value="1" <?= (int) ($p['commission_paid'] ?? 0) === 1 ? 'checked' : '' ?>>
          Provvigioni incassate
        </label>
      </div>

      <h3>Dove</h3>
      <div class="form-row">
        <label>Comune
          <input list="comuni" type="text" name="city" value="<?= e((string) $p['city']) ?>">
          <datalist id="comuni">
            <?php foreach (Vocab::CITIES as $city): ?><option value="<?= e($city) ?>"><?php endforeach; ?>
          </datalist>
        </label>
        <label>Zona / frazione
          <input type="text" name="area" value="<?= e((string) $p['area']) ?>" placeholder="es. Mazzini, Torre Lapillo">
        </label>
        <label>CAP
          <input type="text" name="postal_code" value="<?= e((string) $p['postal_code']) ?>" maxlength="10">
        </label>
      </div>
      <div class="form-row">
        <label>Indirizzo
          <input type="text" name="address" value="<?= e((string) $p['address']) ?>">
        </label>
        <label>Latitudine
          <input type="text" name="lat" value="<?= e((string) $p['lat']) ?>" placeholder="40.35834">
        </label>
        <label>Longitudine
          <input type="text" name="lng" value="<?= e((string) $p['lng']) ?>" placeholder="18.18184">
        </label>
      </div>
      <?php $modo = (string) ($p['map_mode'] ?? 'zona'); ?>
      <label>Quanto mostrare la posizione
        <select name="map_mode">
          <option value="zona" <?= $modo !== 'esatto' ? 'selected' : '' ?>>Solo la zona — nessun segnaposto</option>
          <option value="esatto" <?= $modo === 'esatto' ? 'selected' : '' ?>>Indirizzo esatto — segnaposto sulla casa</option>
        </select>
        <small>Con «solo la zona» le coordinate escono arrotondate a un centinaio
          di metri, anche nei dati strutturati: la via si riconosce, il numero
          civico no. Scegli «esatto» solo se il proprietario è d’accordo che si
          capisca quale casa è in vendita. Le coordinate qui sopra restano
          comunque quelle vere: servono a te per ritrovarla.</small>
      </label>

      <h3>Dati tecnici</h3>
      <div class="form-row">
        <label>Superficie mq<input type="number" name="sqm" value="<?= (int) $p['sqm'] ?>" min="0"></label>
        <label>Lotto mq<input type="number" name="lot_sqm" value="<?= (int) $p['lot_sqm'] ?>" min="0"></label>
        <label>Locali<input type="number" name="rooms" value="<?= (int) $p['rooms'] ?>" min="0"></label>
        <label>Camere<input type="number" name="bedrooms" value="<?= (int) $p['bedrooms'] ?>" min="0"></label>
        <label>Bagni<input type="number" name="bathrooms" value="<?= (int) $p['bathrooms'] ?>" min="0"></label>
      </div>
      <div class="form-row">
        <label>Piano<input type="text" name="floor" value="<?= e((string) $p['floor']) ?>"></label>
        <label>Piani totali<input type="number" name="floors_total" value="<?= (int) $p['floors_total'] ?>" min="0"></label>
        <label>Anno<input type="number" name="year_built" value="<?= (int) $p['year_built'] ?: '' ?>" min="0" max="2100"></label>
        <label>Classe energetica
          <select name="energy_class">
            <option value="">—</option>
            <?php foreach (Vocab::ENERGY as $cls): ?>
              <option value="<?= e($cls) ?>" <?= $p['energy_class'] === $cls ? 'selected' : '' ?>><?= e($cls) ?></option>
            <?php endforeach; ?>
          </select>
        </label>
        <label>Stato
          <select name="condition_state">
            <option value="">—</option>
            <?php foreach (Vocab::CONDITIONS as $slug => $label): ?>
              <option value="<?= e($slug) ?>" <?= $p['condition_state'] === $slug ? 'selected' : '' ?>><?= e($label) ?></option>
            <?php endforeach; ?>
          </select>
        </label>
      </div>
      <div class="form-row">
        <label>Riscaldamento<input type="text" name="heating" value="<?= e((string) $p['heating']) ?>"></label>
        <label>Spese condominiali annue €
          <input type="text" name="condo_fees" inputmode="numeric" value="<?= e(!empty($p['condo_fees']) ? (string) (int) $p['condo_fees'] : '') ?>">
        </label>
        <label>Agente di riferimento
          <select name="agent_id">
            <option value="">—</option>
            <?php foreach ($agenti as $a): ?>
              <option value="<?= (int) $a['id'] ?>" <?= (int) $p['agent_id'] === (int) $a['id'] ? 'selected' : '' ?>><?= e((string) $a['name']) ?></option>
            <?php endforeach; ?>
          </select>
        </label>
      </div>

      <h3>Dotazioni</h3>
      <div class="checkbox-griglia">
        <?php foreach (Vocab::FEATURES as $f): ?>
          <label class="check">
            <input type="checkbox" name="features[]" value="<?= e($f) ?>" <?= in_array($f, $features, true) ? 'checked' : '' ?>>
            <?= e($f) ?>
          </label>
        <?php endforeach; ?>
      </div>

      <h3>Video e visita virtuale</h3>
      <p class="aiuto">Si incolla l’indirizzo, non il codice da incorporare. Sulla scheda
        diventano due pulsanti: nessun riquadro che si carica da solo, quindi la pagina
        resta veloce e chi non guarda il video non finisce registrato da YouTube.</p>
      <div class="form-row">
        <label>Video <small>YouTube o Vimeo</small>
          <input type="text" name="video_url" inputmode="url" maxlength="500"
                 value="<?= e((string) ($p['video_url'] ?? '')) ?>"
                 placeholder="https://www.youtube.com/watch?v=...">
        </label>
        <label>Visita virtuale <small>Matterport o simili</small>
          <input type="text" name="tour_url" inputmode="url" maxlength="500"
                 value="<?= e((string) ($p['tour_url'] ?? '')) ?>"
                 placeholder="https://my.matterport.com/show/?m=...">
        </label>
      </div>

      <h3>Testi</h3>
      <label>Sommario
        <textarea name="excerpt" rows="2" maxlength="1000"><?= e((string) $p['excerpt']) ?></textarea>
      </label>
      <label>Descrizione
        <textarea name="description" rows="10"><?= e((string) $p['description']) ?></textarea>
        <small>Riga vuota fra i paragrafi, <code>##</code> per un sottotitolo,
          <code>-</code> per un elenco, <code>**parola**</code> per il grassetto.</small>
      </label>

      <?php
      $faq = Mil\Core\Faq::daJson($p['faqs'] ?? '');
      ?>
      <label>Domande frequenti
        <?php /* Un riquadro solo, non dodici caselle: le domande si scrivono
                 altrove e si incollano qui tutte insieme. Salvando, il testo
                 torna riscritto nella forma qui sotto — se una domanda non
                 compare, vuol dire che non è stata riconosciuta, e si vede
                 subito invece di scoprirlo sulla pagina pubblicata. */ ?>
        <textarea name="faqs" rows="12" placeholder="Quanto costa la villa?&#10;Il prezzo richiesto è 450.000 euro, trattabile.&#10;&#10;Si può visitare nel fine settimana?&#10;Sì, su appuntamento anche il sabato mattina."><?= e(Mil\Core\Faq::testo($faq)) ?></textarea>
        <small>Una domanda per riga, sotto la sua risposta, e una riga vuota fra
          una coppia e l’altra. Compaiono in fondo alla scheda e finiscono
          da sole nei dati strutturati per Google.
          <?php if ($faq !== []): ?>
            <strong><?= count($faq) ?> domande riconosciute.</strong>
          <?php endif; ?>
        </small>
      </label>
    </div>

    <div>
      <div class="pannello">
        <h2>SEO</h2>
        <label>SEO title <small>max 60 caratteri</small>
          <input type="text" name="seo_title" maxlength="60" value="<?= e((string) $p['seo_title']) ?>">
        </label>
        <label>Meta description <small>max 160 caratteri</small>
          <textarea name="seo_description" rows="3" maxlength="160"><?= e((string) $p['seo_description']) ?></textarea>
        </label>
        <p class="muto">Lasciandoli vuoti vengono usati titolo e descrizione dell’annuncio.</p>
      </div>

      <div class="pannello">
        <button type="submit" class="btn btn-primary largo"><?= $isNew ? 'Crea immobile' : 'Salva modifiche' ?></button>
        <?php /* Salva e porta all'anteprima con un gesto solo. È lo stesso
                 modulo e lo stesso invio: cambia solo dove si finisce dopo,
                 quindi non c'è modo di vedere un'anteprima di dati non
                 salvati — sarebbe la bugia peggiore che un'anteprima possa
                 raccontare. */ ?>
        <button type="submit" class="btn btn-ghost largo" name="dopo" value="anteprima">
          <?= $isNew ? 'Crea e vedi l’anteprima' : 'Salva e vedi l’anteprima' ?>
        </button>
        <?php if (!$isNew): ?>
          <p class="muto">Creato il <?= e(data_it((string) $p['created_at'], true)) ?> · <?= (int) $p['views'] ?> visite</p>
        <?php endif; ?>
      </div>

      <?php if (!$isNew && $abbinamenti !== []): ?>
        <div class="pannello">
          <h2>A chi proporlo</h2>
          <ul class="lista">
            <?php foreach ($abbinamenti as $m): ?>
              <li>
                <a href="<?= e(url('/gestionale/clienti/' . $m['contact']['id'] . '/')) ?>"><?= e((string) $m['contact']['name']) ?></a>
                <span class="score"><?= (int) $m['score'] ?>%</span>
                <?php if (!empty($m['contact']['phone'])): ?><br><small><?= e((string) $m['contact']['phone']) ?></small><?php endif; ?>
              </li>
            <?php endforeach; ?>
          </ul>
          <p><a class="mini" href="<?= e(url('/gestionale/immobili/' . $p['id'] . '/abbinamenti/')) ?>">Vedi tutti gli abbinamenti</a></p>
        </div>
      <?php endif; ?>
    </div>
  </div>
</form>

<?php if (!$isNew): ?>
<div class="pannello" id="foto">
  <h2>Foto</h2>
  <form method="post" action="<?= e(url('/gestionale/immobili/' . $p['id'] . '/foto/')) ?>" enctype="multipart/form-data" class="form">
    <?= Csrf::field() ?>
    <label>Carica una o più immagini <small>JPG, PNG o WebP. Vengono convertite in WebP e salvate in tre larghezze (480, 960, 1600 px): il telefono scarica la più piccola che gli basta.</small>
      <input type="file" name="foto[]" accept="image/jpeg,image/png,image/webp" multiple required>
    </label>
    <button type="submit" class="btn btn-ghost">Carica</button>
  </form>

  <?php if ($images !== []): ?>
    <?php /* Un modulo solo per tutto: i bottoni si distinguono con `azione`,
             così le descrizioni scritte a mano si salvano comunque, qualunque
             bottone si prema. L'unica eccezione è Elimina, che ha una rotta
             sua perché cancella anche i file dal disco. */ ?>
    <form method="post" action="<?= e(url('/gestionale/immobili/' . $p['id'] . '/foto/aggiorna/')) ?>">
      <?= Csrf::field() ?>
      <div class="foto-griglia">
        <?php foreach ($images as $i => $img): ?>
          <figure<?= $i === 0 ? ' class="foto-copertina"' : '' ?>>
            <img src="<?= e(url((string) ($img['thumb'] ?: $img['path']))) ?>" alt="" loading="lazy"
                 width="<?= (int) $img['width'] ?>" height="<?= (int) $img['height'] ?>">
            <?php if ($i === 0): ?><span class="foto-tag">Copertina</span><?php endif; ?>

            <label class="foto-alt">Descrizione della foto
              <input type="text" name="alt[<?= (int) $img['id'] ?>]" maxlength="255"
                     value="<?= e((string) $img['alt']) ?>"
                     placeholder="Cosa si vede in questa foto">
            </label>

            <div class="foto-azioni">
              <button class="mini" name="azione" value="su:<?= (int) $img['id'] ?>"
                      <?= $i === 0 ? 'disabled' : '' ?> aria-label="Sposta indietro">↑</button>
              <button class="mini" name="azione" value="giu:<?= (int) $img['id'] ?>"
                      <?= $i === count($images) - 1 ? 'disabled' : '' ?> aria-label="Sposta avanti">↓</button>
              <button class="mini" name="azione" value="copertina:<?= (int) $img['id'] ?>"
                      <?= $i === 0 ? 'disabled' : '' ?>>Copertina</button>
              <button class="mini mini-danger" name="azione" value="elimina"
                      formaction="<?= e(url('/gestionale/immobili/' . $p['id'] . '/foto/' . $img['id'] . '/elimina/')) ?>"
                      onclick="return confirm('Eliminare questa foto?')">Elimina</button>
            </div>
          </figure>
        <?php endforeach; ?>
      </div>
      <p><button type="submit" class="btn btn-ghost" name="azione" value="salva">Salva le descrizioni</button></p>
    </form>
  <?php else: ?>
    <p class="vuoto">Nessuna foto caricata. La prima diventa l’immagine principale, anche nello schema.</p>
  <?php endif; ?>
</div>

<div class="due-colonne">
  <div class="pannello">
    <h2>Proposte ricevute</h2>

    <?php if ($proposte === []): ?>
      <p class="vuoto">Nessuna proposta registrata su questo immobile.</p>
    <?php else: ?>
      <table class="tabella">
        <thead><tr><th>Quando</th><th>Da</th><th>Importo</th><th>Stato</th><th></th></tr></thead>
        <tbody>
        <?php foreach ($proposte as $o): ?>
          <tr>
            <td><?= e(data_it((string) $o['presented_at'])) ?></td>
            <td>
              <?php if (!empty($o['contact_id'])): ?>
                <a href="<?= e(url('/gestionale/clienti/' . $o['contact_id'] . '/')) ?>"><?= e((string) $o['contact_name']) ?></a>
              <?php else: ?>
                <span class="muto">non collegata</span>
              <?php endif; ?>
              <?php if (!empty($o['notes'])): ?><br><small><?= e(tronca((string) $o['notes'], 90)) ?></small><?php endif; ?>
            </td>
            <td><strong><?= e(euro((float) $o['amount'])) ?></strong>
              <?php if (!empty($o['deposit'])): ?><br><small>caparra <?= e(euro((float) $o['deposit'])) ?></small><?php endif; ?>
            </td>
            <td><span class="pill pill-<?= e((string) $o['status']) ?>"><?= e(Vocab::label('offer_status', (string) $o['status'])) ?></span></td>
            <td class="destra">
              <?php if ($o['status'] === 'presentata'): ?>
                <?php foreach (['accettata' => 'Accetta', 'rifiutata' => 'Rifiuta', 'ritirata' => 'Ritirata'] as $stato => $etichetta): ?>
                  <form method="post" action="<?= e(url('/gestionale/immobili/' . $p['id'] . '/proposte/' . $o['id'] . '/stato/')) ?>" class="inline">
                    <?= Csrf::field() ?>
                    <input type="hidden" name="status" value="<?= e($stato) ?>">
                    <button class="mini"><?= e($etichetta) ?></button>
                  </form>
                <?php endforeach; ?>
              <?php endif; ?>
            </td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    <?php endif; ?>

    <h3>Registra una proposta</h3>
    <form method="post" action="<?= e(url('/gestionale/immobili/' . $p['id'] . '/proposte/')) ?>" class="form">
      <?= Csrf::field() ?>
      <div class="form-row">
        <label>Importo €<input type="text" name="amount" inputmode="numeric" required></label>
        <label>Caparra €<input type="text" name="deposit" inputmode="numeric"></label>
        <label>Valida fino al<input type="date" name="valid_until"></label>
      </div>
      <label>Da quale cliente
        <select name="contact_id">
          <option value="">—</option>
          <?php foreach ($clienti as $cl): ?>
            <option value="<?= (int) $cl['id'] ?>"><?= e((string) $cl['name']) ?></option>
          <?php endforeach; ?>
        </select>
      </label>
      <label>Note<textarea name="notes" rows="2"></textarea></label>
      <button class="btn btn-ghost">Registra proposta</button>
    </form>
  </div>

  <div class="pannello">
    <h2>Storico dei prezzi</h2>
    <?php if ($storicoPrezzi === []): ?>
      <p class="vuoto">Il prezzo non è mai cambiato da quando l’immobile è a sistema.</p>
    <?php else: ?>
      <ul class="lista">
        <?php foreach ($storicoPrezzi as $h): ?>
          <li>
            <strong><?= e(euro(isset($h['price']) ? (float) $h['price'] : null)) ?></strong>
            <?php if (!empty($h['previous_price'])): ?>
              <span class="muto">da <?= e(euro((float) $h['previous_price'])) ?></span>
            <?php endif; ?><br>
            <small class="muto"><?= e(data_it((string) $h['created_at'], true)) ?>
              <?php if (!empty($h['user_name'])): ?>— <?= e((string) $h['user_name']) ?><?php endif; ?></small>
            <?php if (!empty($h['reason'])): ?><br><small><?= e((string) $h['reason']) ?></small><?php endif; ?>
          </li>
        <?php endforeach; ?>
      </ul>
    <?php endif; ?>
  </div>
</div>

<div class="pannello pannello-pericolo">
  <h2>Elimina</h2>
  <p>L’immobile e tutte le sue foto vengono rimossi. L’operazione non si annulla.</p>
  <form method="post" action="<?= e(url('/gestionale/immobili/' . $p['id'] . '/elimina/')) ?>"
        onsubmit="return confirm('Eliminare definitivamente questo immobile?')">
    <?= Csrf::field() ?>
    <button class="btn btn-danger">Elimina immobile</button>
  </form>
</div>
<?php endif; ?>
