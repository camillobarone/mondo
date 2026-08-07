<?php

/**
 * @var array<int,array<string,mixed>> $voci
 * @var array<int,array<string,mixed>> $immobili
 * @var array<int,array<string,mixed>> $clienti
 * @var array<int,array<string,mixed>> $agenti
 */

use Mil\Core\Csrf;
?>
<div class="due-colonne">
  <div class="pannello">
    <h2>Appuntamenti</h2>
    <p class="muto">
      <?php if (q('tutti') === '1'): ?>
        <a href="<?= e(url('/gestionale/agenda/')) ?>">Mostra solo quelli da fare</a>
      <?php else: ?>
        <a href="<?= e(url('/gestionale/agenda/?tutti=1')) ?>">Mostra anche quelli conclusi</a>
      <?php endif; ?>
    </p>

    <?php if ($voci === []): ?>
      <p class="vuoto">Agenda vuota.</p>
    <?php else: ?>
      <table class="tabella">
        <thead><tr><th>Quando</th><th>Cosa</th><th>Con chi</th><th></th></tr></thead>
        <tbody>
        <?php foreach ($voci as $v): ?>
          <tr class="<?= (int) $v['done'] === 1 ? 'spento' : '' ?>">
            <td><?= e(data_it((string) $v['starts_at'], true)) ?></td>
            <td><?= e((string) $v['title']) ?>
              <?php if (!empty($v['property_title'])): ?><br><small><?= e((string) $v['property_title']) ?></small><?php endif; ?>
            </td>
            <td><?= e((string) ($v['contact_name'] ?: '—')) ?><br><small><?= e((string) ($v['user_name'] ?: '')) ?></small></td>
            <td class="destra">
              <form method="post" action="<?= e(url('/gestionale/agenda/' . $v['id'] . '/fatto/')) ?>" class="inline">
                <?= Csrf::field() ?>
                <button class="mini"><?= (int) $v['done'] === 1 ? 'Riapri' : 'Fatto' ?></button>
              </form>
              <form method="post" action="<?= e(url('/gestionale/agenda/' . $v['id'] . '/elimina/')) ?>" class="inline"
                    onsubmit="return confirm('Eliminare?')">
                <?= Csrf::field() ?>
                <button class="mini mini-danger">Elimina</button>
              </form>
            </td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    <?php endif; ?>
  </div>

  <div class="pannello">
    <h2>Nuovo appuntamento</h2>
    <form method="post" class="form">
      <?= Csrf::field() ?>
      <label>Cosa<input type="text" name="title" required placeholder="es. Visita villetta Eurovillage"></label>
      <label>Quando<input type="datetime-local" name="starts_at" required></label>
      <label>Immobile
        <select name="property_id">
          <option value="">—</option>
          <?php foreach ($immobili as $i): ?>
            <option value="<?= (int) $i['id'] ?>"><?= e((string) $i['ref']) ?> — <?= e((string) $i['title']) ?></option>
          <?php endforeach; ?>
        </select>
      </label>
      <label>Cliente
        <select name="contact_id">
          <option value="">—</option>
          <?php foreach ($clienti as $cl): ?>
            <option value="<?= (int) $cl['id'] ?>"><?= e((string) $cl['name']) ?></option>
          <?php endforeach; ?>
        </select>
      </label>
      <label>Agente
        <select name="user_id">
          <option value="">Io</option>
          <?php foreach ($agenti as $a): ?>
            <option value="<?= (int) $a['id'] ?>"><?= e((string) $a['name']) ?></option>
          <?php endforeach; ?>
        </select>
      </label>
      <label>Note<textarea name="notes" rows="3"></textarea></label>
      <button class="btn btn-primary">Aggiungi</button>
    </form>
  </div>
</div>
