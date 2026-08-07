<?php

/**
 * @var array<string,mixed> $lead
 * @var array<int,array<string,mixed>> $note
 * @var array<int,array<string,mixed>> $agenti
 */

use Mil\Core\Csrf;
use Mil\Core\Vocab;
?>
<div class="due-colonne">
  <div class="pannello">
    <h2>Richiesta</h2>
    <dl class="dati">
      <div><dt>Arrivata</dt><dd><?= e(data_it((string) $lead['created_at'], true)) ?></dd></div>
      <div><dt>Origine</dt><dd><?= e(Vocab::label('lead_source', (string) $lead['source'])) ?></dd></div>
      <?php if (!empty($lead['property_title'])): ?>
        <div><dt>Immobile</dt><dd><a href="<?= e(url('/immobili/' . $lead['property_slug'] . '/')) ?>" target="_blank" rel="noopener"><?= e((string) $lead['property_title']) ?></a></dd></div>
      <?php endif; ?>
      <div><dt>Nome</dt><dd><?= e((string) $lead['name']) ?></dd></div>
      <?php if ($lead['phone'] !== ''): ?>
        <div><dt>Telefono</dt><dd><a href="tel:<?= e((string) $lead['phone']) ?>"><?= e((string) $lead['phone']) ?></a></dd></div>
      <?php endif; ?>
      <?php if ($lead['email'] !== ''): ?>
        <div><dt>Email</dt><dd><a href="mailto:<?= e((string) $lead['email']) ?>"><?= e((string) $lead['email']) ?></a></dd></div>
      <?php endif; ?>
      <?php if ($lead['city'] !== ''): ?>
        <div><dt>Dove</dt><dd><?= e((string) $lead['city']) ?></dd></div>
      <?php endif; ?>
    </dl>

    <?php if (trim((string) $lead['message']) !== ''): ?>
      <h3>Messaggio</h3>
      <blockquote class="citazione"><?= nl2br(e((string) $lead['message'])) ?></blockquote>
    <?php endif; ?>
  </div>

  <div>
    <div class="pannello">
      <h2>Lavorazione</h2>
      <form method="post" class="form">
        <?= Csrf::field() ?>
        <label>Stato
          <select name="status">
            <?php foreach (Vocab::LEAD_STATUSES as $slug => $label): ?>
              <option value="<?= e($slug) ?>" <?= $lead['status'] === $slug ? 'selected' : '' ?>><?= e($label) ?></option>
            <?php endforeach; ?>
          </select>
        </label>
        <label>Assegnata a
          <select name="assigned_to">
            <option value="">Nessuno</option>
            <?php foreach ($agenti as $a): ?>
              <option value="<?= (int) $a['id'] ?>" <?= (int) $lead['assigned_to'] === (int) $a['id'] ? 'selected' : '' ?>><?= e((string) $a['name']) ?></option>
            <?php endforeach; ?>
          </select>
        </label>
        <button class="btn btn-primary">Aggiorna</button>
      </form>
    </div>

    <div class="pannello">
      <h2>Fissa un appuntamento</h2>
      <form method="post" class="form">
        <?= Csrf::field() ?>
        <input type="hidden" name="azione" value="appuntamento">
        <label>Titolo<input type="text" name="titolo" value="Visita con <?= e((string) $lead['name']) ?>"></label>
        <label>Quando<input type="datetime-local" name="starts_at" required></label>
        <label>Note<textarea name="note" rows="2"></textarea></label>
        <button class="btn btn-ghost">Metti in agenda</button>
      </form>
    </div>
  </div>
</div>

<div class="pannello">
  <h2>Note</h2>
  <form method="post" class="form">
    <?= Csrf::field() ?>
    <input type="hidden" name="azione" value="nota">
    <label>Aggiungi una nota
      <textarea name="nota" rows="3" placeholder="Cosa è stato detto, cosa cerca, prossimo passo…"></textarea>
    </label>
    <button class="btn btn-ghost">Salva nota</button>
  </form>

  <?php if ($note === []): ?>
    <p class="vuoto">Nessuna nota.</p>
  <?php else: ?>
    <ul class="lista">
      <?php foreach ($note as $n): ?>
        <li><span class="muto"><?= e(data_it((string) $n['created_at'], true)) ?> — <?= e((string) ($n['user_name'] ?: 'sistema')) ?></span><br>
          <?= nl2br(e((string) $n['body'])) ?></li>
      <?php endforeach; ?>
    </ul>
  <?php endif; ?>
</div>
