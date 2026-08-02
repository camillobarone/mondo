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
        <label>Stato
          <select name="status">
            <?php foreach (Vocab::STATUSES as $slug => $label): ?>
              <option value="<?= e($slug) ?>" <?= $p['status'] === $slug ? 'selected' : '' ?>><?= e($label) ?></option>
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

      <h3>Testi</h3>
      <label>Sommario
        <textarea name="excerpt" rows="2" maxlength="1000"><?= e((string) $p['excerpt']) ?></textarea>
      </label>
      <label>Descrizione
        <textarea name="description" rows="10"><?= e((string) $p['description']) ?></textarea>
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
<div class="pannello">
  <h2>Foto</h2>
  <form method="post" action="<?= e(url('/gestionale/immobili/' . $p['id'] . '/foto/')) ?>" enctype="multipart/form-data" class="form">
    <?= Csrf::field() ?>
    <label>Carica una o più immagini <small>JPG, PNG o WebP. Vengono convertite e ridimensionate in automatico.</small>
      <input type="file" name="foto[]" accept="image/jpeg,image/png,image/webp" multiple required>
    </label>
    <button type="submit" class="btn btn-ghost">Carica</button>
  </form>

  <?php if ($images !== []): ?>
    <div class="foto-griglia">
      <?php foreach ($images as $img): ?>
        <figure>
          <img src="<?= e(url((string) ($img['thumb'] ?: $img['path']))) ?>" alt="" loading="lazy">
          <form method="post" action="<?= e(url('/gestionale/immobili/' . $p['id'] . '/foto/' . $img['id'] . '/elimina/')) ?>"
                onsubmit="return confirm('Eliminare questa foto?')">
            <?= Csrf::field() ?>
            <button class="mini mini-danger">Elimina</button>
          </form>
        </figure>
      <?php endforeach; ?>
    </div>
  <?php else: ?>
    <p class="vuoto">Nessuna foto caricata. La prima diventa l’immagine principale, anche nello schema.</p>
  <?php endif; ?>
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
