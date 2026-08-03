<?php

/**
 * @var array<string,mixed> $c
 * @var array<int,array<string,mixed>> $agenti
 * @var array<int,array{property:array<string,mixed>,score:int,reasons:array<int,string>}> $abbinamenti
 */

use Mil\Core\Csrf;
use Mil\Core\Vocab;

$isNew = (int) $c['id'] === 0;
$types = array_filter(explode(',', (string) $c['types']));
$cities = array_filter(explode(',', (string) $c['cities']));
$ruoli = array_filter(explode(',', (string) ($c['roles'] ?? '')));
?>
<div class="due-colonne">
  <form method="post" class="form pannello">
    <?= Csrf::field() ?>
    <h2>Chi è e cosa cerca</h2>

    <div class="form-row">
      <label>Nome<input type="text" name="name" value="<?= e((string) $c['name']) ?>" required></label>
      <label>Telefono<input type="tel" name="phone" value="<?= e((string) $c['phone']) ?>"></label>
      <label>Email<input type="email" name="email" value="<?= e((string) $c['email']) ?>"></label>
    </div>

    <div class="form-row">
      <label>Comune di residenza<input type="text" name="city" value="<?= e((string) ($c['city'] ?? '')) ?>"></label>
      <label>Codice fiscale<input type="text" name="tax_code" maxlength="20" value="<?= e((string) ($c['tax_code'] ?? '')) ?>"></label>
      <label>Stato
        <select name="status">
          <?php foreach (Vocab::CLIENT_STATUSES as $slug => $label): ?>
            <option value="<?= e($slug) ?>" <?= ($c['status'] ?? '') === $slug ? 'selected' : '' ?>><?= e($label) ?></option>
          <?php endforeach; ?>
        </select>
      </label>
    </div>

    <h3>Ruoli <small>si può essere più cose insieme</small></h3>
    <div class="checkbox-griglia">
      <?php foreach (Vocab::CLIENT_ROLES as $slug => $label): ?>
        <label class="check">
          <input type="checkbox" name="roles[]" value="<?= e($slug) ?>" <?= in_array($slug, $ruoli, true) ? 'checked' : '' ?>>
          <?= e($label) ?>
        </label>
      <?php endforeach; ?>
    </div>

    <div class="form-row">
      <label>Da dove arriva
        <select name="source">
          <option value="">—</option>
          <?php foreach (Vocab::CLIENT_SOURCES as $slug => $label): ?>
            <option value="<?= e($slug) ?>" <?= ($c['source'] ?? '') === $slug ? 'selected' : '' ?>><?= e($label) ?></option>
          <?php endforeach; ?>
        </select>
      </label>
      <label>Come paga
        <select name="financing">
          <option value="">—</option>
          <?php foreach (Vocab::FINANCING as $slug => $label): ?>
            <option value="<?= e($slug) ?>" <?= ($c['financing'] ?? '') === $slug ? 'selected' : '' ?>><?= e($label) ?></option>
          <?php endforeach; ?>
        </select>
      </label>
      <label>Urgenza
        <select name="urgency">
          <?php foreach (Vocab::URGENCY as $slug => $label): ?>
            <option value="<?= e($slug) ?>" <?= ($c['urgency'] ?? 'media') === $slug ? 'selected' : '' ?>><?= e($label) ?></option>
          <?php endforeach; ?>
        </select>
      </label>
    </div>

    <div class="form-row">
      <label>Contratto
        <select name="contract">
          <?php foreach (Vocab::CONTRACTS as $slug => $label): ?>
            <option value="<?= e($slug) ?>" <?= $c['contract'] === $slug ? 'selected' : '' ?>><?= e($label) ?></option>
          <?php endforeach; ?>
        </select>
      </label>
      <label>Budget minimo €<input type="text" name="budget_min" inputmode="numeric" value="<?= e(!empty($c['budget_min']) ? (string) (int) $c['budget_min'] : '') ?>"></label>
      <label>Budget massimo €<input type="text" name="budget_max" inputmode="numeric" value="<?= e(!empty($c['budget_max']) ? (string) (int) $c['budget_max'] : '') ?>"></label>
    </div>

    <div class="form-row">
      <label>Mq minimi<input type="number" name="sqm_min" min="0" value="<?= (int) $c['sqm_min'] ?: '' ?>"></label>
      <label>Camere minime<input type="number" name="bedrooms_min" min="0" value="<?= (int) $c['bedrooms_min'] ?: '' ?>"></label>
      <label>Seguito da
        <select name="assigned_to">
          <option value="">—</option>
          <?php foreach ($agenti as $a): ?>
            <option value="<?= (int) $a['id'] ?>" <?= (int) $c['assigned_to'] === (int) $a['id'] ? 'selected' : '' ?>><?= e((string) $a['name']) ?></option>
          <?php endforeach; ?>
        </select>
      </label>
    </div>

    <h3>Tipologie di interesse <small>nessuna spuntata = qualunque tipologia</small></h3>
    <div class="checkbox-griglia">
      <?php foreach (Vocab::TYPES as $slug => $label): ?>
        <label class="check">
          <input type="checkbox" name="types[]" value="<?= e($slug) ?>" <?= in_array($slug, $types, true) ? 'checked' : '' ?>>
          <?= e($label) ?>
        </label>
      <?php endforeach; ?>
    </div>

    <h3>Zone <small>nessuna spuntata = ovunque</small></h3>
    <div class="checkbox-griglia">
      <?php foreach (Vocab::CITIES as $city): ?>
        <label class="check">
          <input type="checkbox" name="cities[]" value="<?= e($city) ?>" <?= in_array($city, $cities, true) ? 'checked' : '' ?>>
          <?= e($city) ?>
        </label>
      <?php endforeach; ?>
    </div>

    <label>Note
      <textarea name="notes" rows="4" placeholder="Vincoli, tempi, mutuo già deliberato, cosa ha già visto…"><?= e((string) $c['notes']) ?></textarea>
    </label>

    <h3>Adempimenti</h3>
    <p class="muto">Privacy e antiriciclaggio si registrano qui. Le date le scrive il
      sistema al momento della spunta: una data messa a mano non prova niente.</p>

    <input type="hidden" name="privacy_date_esistente" value="<?= e((string) ($c['privacy_date'] ?? '')) ?>">
    <input type="hidden" name="aml_checked_esistente" value="<?= e((string) ($c['aml_checked_at'] ?? '')) ?>">

    <label class="check">
      <input type="checkbox" name="privacy_consent" value="1" <?= (int) ($c['privacy_consent'] ?? 0) === 1 ? 'checked' : '' ?>>
      Consenso privacy raccolto
      <?php if (!empty($c['privacy_date'])): ?>
        <small>Registrato il <?= e(data_it((string) $c['privacy_date'], true)) ?></small>
      <?php endif; ?>
    </label>
    <label>A cosa ha acconsentito
      <input type="text" name="privacy_scope" value="<?= e((string) ($c['privacy_scope'] ?? '')) ?>"
             placeholder="es. gestione della richiesta e ricontatto telefonico">
    </label>

    <div class="form-row">
      <label>Documento
        <select name="aml_doc_type">
          <option value="">—</option>
          <?php foreach (Vocab::AML_DOCS as $slug => $label): ?>
            <option value="<?= e($slug) ?>" <?= ($c['aml_doc_type'] ?? '') === $slug ? 'selected' : '' ?>><?= e($label) ?></option>
          <?php endforeach; ?>
        </select>
      </label>
      <label>Numero<input type="text" name="aml_doc_number" value="<?= e((string) ($c['aml_doc_number'] ?? '')) ?>"></label>
      <label>Scadenza<input type="date" name="aml_doc_expiry" value="<?= e((string) ($c['aml_doc_expiry'] ?? '')) ?>"></label>
    </div>
    <?php if (!empty($c['aml_checked_at'])): ?>
      <p class="muto">Identificazione registrata il <?= e(data_it((string) $c['aml_checked_at'], true)) ?>.</p>
    <?php endif; ?>

    <label class="check">
      <input type="checkbox" name="active" value="1" <?= (int) $c['active'] === 1 ? 'checked' : '' ?>>
      Ricerca ancora attiva
      <small>Togliendo la spunta il cliente esce dagli abbinamenti senza essere cancellato.</small>
    </label>

    <button class="btn btn-primary"><?= $isNew ? 'Salva e cerca abbinamenti' : 'Salva modifiche' ?></button>
  </form>

  <div>
    <?php if (!$isNew): ?>
      <div class="pannello">
        <h2>In sintesi</h2>
        <dl class="dati">
          <div><dt>Ultimo contatto</dt>
            <dd><?= e(!empty($c['last_contact_at']) ? data_it((string) $c['last_contact_at']) : 'mai registrato') ?></dd></div>
          <div><dt>Consenso privacy</dt>
            <dd><?= (int) ($c['privacy_consent'] ?? 0) === 1 ? 'sì' : '<span class="pill pill-nuovo">manca</span>' ?></dd></div>
          <div><dt>Identificazione</dt>
            <dd><?= !empty($c['aml_checked_at']) ? 'fatta' : '<span class="pill pill-nuovo">manca</span>' ?></dd></div>
        </dl>
      </div>

      <?php if ($proposte !== []): ?>
        <div class="pannello">
          <h2>Proposte fatte</h2>
          <ul class="lista">
            <?php foreach ($proposte as $o): ?>
              <li>
                <strong><?= e(euro((float) $o['amount'])) ?></strong>
                <span class="pill pill-<?= e((string) $o['status']) ?>"><?= e(Vocab::label('offer_status', (string) $o['status'])) ?></span><br>
                <small><a href="<?= e(url('/gestionale/immobili/' . $o['property_id'] . '/')) ?>"><?= e((string) $o['property_title']) ?></a>
                  — <?= e(data_it((string) $o['presented_at'])) ?></small>
              </li>
            <?php endforeach; ?>
          </ul>
        </div>
      <?php endif; ?>

      <div class="pannello">
        <h2>Cosa possiamo proporgli</h2>
        <?php if ($abbinamenti === []): ?>
          <p class="vuoto">Nessun immobile in portafoglio soddisfa questi criteri. Vale la pena avvisarlo appena entra qualcosa.</p>
        <?php else: ?>
          <ul class="lista">
            <?php foreach ($abbinamenti as $m): ?>
              <li>
                <a href="<?= e(url('/gestionale/immobili/' . $m['property']['id'] . '/')) ?>"><?= e((string) $m['property']['title']) ?></a>
                <span class="score"><?= (int) $m['score'] ?>%</span><br>
                <small><?= e(euro(isset($m['property']['price']) ? (float) $m['property']['price'] : null)) ?> ·
                  <?= (int) $m['property']['sqm'] ?> mq · <?= e((string) $m['property']['city']) ?></small>
              </li>
            <?php endforeach; ?>
          </ul>
          <p><a class="mini" href="<?= e(url('/gestionale/clienti/' . $c['id'] . '/abbinamenti/')) ?>">Vedi tutti con le motivazioni</a></p>
        <?php endif; ?>
      </div>

      <div class="pannello pannello-pericolo">
        <h2>Elimina</h2>
        <form method="post" action="<?= e(url('/gestionale/clienti/' . $c['id'] . '/elimina/')) ?>"
              onsubmit="return confirm('Eliminare questa richiesta?')">
          <?= Csrf::field() ?>
          <button class="btn btn-danger">Elimina richiesta</button>
        </form>
      </div>
    <?php endif; ?>
  </div>
</div>
