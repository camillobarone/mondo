<?php

/** @var array<int,array<string,mixed>> $voci */

use Mil\Core\Csrf;
?>
<div class="pannello">
  <h2>Perché questa pagina conta</h2>
  <p>
    Ogni indirizzo che oggi è indicizzato su Google deve continuare a rispondere. Se cambia sito e
    l’URL vecchio finisce in 404, il posizionamento di quella pagina si perde e non torna da solo.
    Qui si dichiara, per ogni vecchio indirizzo, dove deve puntare adesso: il server risponde 301 e
    il valore accumulato passa alla pagina nuova.
  </p>
</div>

<div class="due-colonne">
  <div class="pannello">
    <h2>Aggiungi</h2>
    <form method="post" class="form">
      <?= Csrf::field() ?>
      <label>Vecchio percorso<input type="text" name="from_path" placeholder="/vecchia-pagina/"></label>
      <label>Nuovo percorso<input type="text" name="to_path" placeholder="/pagina-nuova/"></label>
      <button class="btn btn-primary">Salva</button>
    </form>
  </div>

  <div class="pannello">
    <h2>Importa in blocco</h2>
    <form method="post" class="form">
      <?= Csrf::field() ?>
      <label>Una riga per reindirizzamento, vecchio e nuovo separati da <code>=&gt;</code>
        <textarea name="bulk" rows="8" placeholder="/vecchia-pagina/ => /pagina-nuova/&#10;/altro-indirizzo/ => /destinazione/"></textarea>
        <small>Accetta anche URL intere: viene tenuto solo il percorso.</small>
      </label>
      <button class="btn btn-ghost">Importa</button>
    </form>
  </div>
</div>

<div class="pannello">
  <h2>Attivi <span class="muto">(<?= count($voci) ?>)</span></h2>
  <?php if ($voci === []): ?>
    <p class="vuoto">Nessun reindirizzamento.</p>
  <?php else: ?>
    <table class="tabella">
      <thead><tr><th>Da</th><th>A</th><th>Codice</th><th>Usi</th><th></th></tr></thead>
      <tbody>
      <?php foreach ($voci as $r): ?>
        <tr>
          <td><code><?= e((string) $r['from_path']) ?></code></td>
          <td><code><?= e((string) $r['to_path']) ?></code></td>
          <td><?= (int) $r['code'] ?></td>
          <td><?= (int) $r['hits'] ?><?php if (!empty($r['last_hit_at'])): ?><br><small><?= e(data_it((string) $r['last_hit_at'])) ?></small><?php endif; ?></td>
          <td class="destra">
            <form method="post" action="<?= e(url('/gestionale/redirect/' . $r['id'] . '/elimina/')) ?>" onsubmit="return confirm('Eliminare?')">
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
