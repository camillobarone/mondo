<?php

/**
 * @var string $wpConfig
 * @var array<string,mixed>|null $censimento
 * @var array<string,mixed>|null $anteprima
 * @var array{fatti:int,totale:int}|null $avanzamento
 */

use Mil\Core\Csrf;
?>
<div class="pannello">
  <h2>Importa gli immobili da WordPress</h2>
  <p class="aiuto">
    Legge gli immobili dal sito WordPress attuale e li porta qui dentro, foto comprese.
    <strong>Il sito WordPress non viene mai modificato</strong>: l’importazione lo legge e basta.
    Si può rilanciare quando si vuole — gli immobili già importati vengono aggiornati, non duplicati.
  </p>
</div>

<?php if ($avanzamento !== null): ?>
  <div class="pannello">
    <h2>C’è un’importazione a metà</h2>
    <p>Lavorati <strong><?= (int) $avanzamento['fatti'] ?></strong> immobili su <?= (int) $avanzamento['totale'] ?>.</p>
    <p><a class="btn btn-primary" href="<?= e(url('/gestionale/importa/lavora/')) ?>">Riprendi</a></p>
  </div>
<?php endif; ?>

<div class="pannello">
  <h2>Passo 1 — collega WordPress</h2>
  <form method="post" action="<?= e(url('/gestionale/importa/campi/')) ?>" class="form">
    <?= Csrf::field() ?>
    <label>Percorso del file <code>wp-config.php</code> del sito WordPress
      <small>È il file che contiene le credenziali del database. Non viene copiato né mostrato:
        lo legge il server, dove quel file già si trova.</small>
      <input type="text" name="wp_config" value="<?= e($wpConfig) ?>"
             placeholder="/home/customer/www/iltuosito.it/public_html/wp-config.php" required>
    </label>
    <button class="btn btn-ghost">Collega e guarda cosa c’è</button>
  </form>

  <?php if (is_array($censimento)): ?>
    <h3>Trovati su WordPress</h3>
    <p>
      <strong><?= (int) $censimento['immobili'] ?></strong> immobili pubblicati e
      <strong><?= (int) $censimento['bozze'] ?></strong> bozze.
    </p>

    <?php if (!empty($censimento['copertura'])): ?>
      <?php $mancanti = array_filter($censimento['copertura'], static fn (array $c): bool => $c['schede'] === 0); ?>
      <h3>L’importazione trova i suoi dati?</h3>
      <p class="aiuto">Riga per riga: il dato che serve al gestionale, e se WordPress ce l’ha.
        Quello che qui risulta «non trovato» arriverà vuoto, e andrà scritto a mano
        sulla scheda — meglio saperlo adesso.</p>

      <table class="tabella">
        <thead><tr><th>Dato</th><th>Trovato su</th><th>Esempio</th></tr></thead>
        <tbody>
        <?php foreach ($censimento['copertura'] as $c): ?>
          <tr class="<?= $c['schede'] === 0 ? 'spento' : '' ?>">
            <td><strong><?= e((string) $c['campo']) ?></strong>
              <?php if ($c['chiave'] !== ''): ?><br><small><code><?= e((string) $c['chiave']) ?></code></small><?php endif; ?>
            </td>
            <td><?= $c['schede'] === 0 ? '— non trovato' : (int) $c['schede'] . ' schede' ?></td>
            <td><?= e(tronca((string) $c['esempio'], 50)) ?></td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>

      <?php if ($mancanti === []): ?>
        <p><strong>Tutti i dati che servono ci sono.</strong> Si può proseguire.</p>
      <?php else: ?>
        <p><strong><?= count($mancanti) ?></strong> dato/i non trovato/i su WordPress:
          arriveranno vuoti. Non è un errore e non blocca l’importazione — vuol dire solo
          che su WordPress quel campo non è compilato.</p>
      <?php endif; ?>
    <?php endif; ?>

    <?php if (!empty($censimento['campi'])): ?>
      <details>
        <summary>Elenco completo dei campi WordPress (<?= count($censimento['campi']) ?>)</summary>
        <p class="aiuto">Serve solo se bisogna capire con che nome è salvato un dato.</p>
        <div class="tabella-scroll">
          <table class="tabella">
            <thead><tr><th>Campo</th><th>Su quante schede</th><th>Esempio</th></tr></thead>
            <tbody>
            <?php foreach ($censimento['campi'] as $campo): ?>
              <tr>
                <td><code><?= e((string) ($campo['key'] ?? '')) ?></code></td>
                <td><?= (int) ($campo['n'] ?? 0) ?></td>
                <td><?= e(tronca((string) ($campo['esempio'] ?? ''), 60)) ?></td>
              </tr>
            <?php endforeach; ?>
            </tbody>
          </table>
        </div>
      </details>
    <?php endif; ?>
  <?php endif; ?>
</div>

<?php if (is_array($censimento)): ?>
<div class="pannello">
  <h2>Passo 2 — prova senza scrivere</h2>
  <p class="aiuto">Mostra riga per riga cosa verrebbe importato, senza toccare niente.
    Serve a leggere i titoli e i prezzi e accorgersi degli errori <em>prima</em>.</p>
  <form method="post" action="<?= e(url('/gestionale/importa/prova/')) ?>">
    <?= Csrf::field() ?>
    <button class="btn btn-ghost">Fai la prova</button>
  </form>

  <?php if (is_array($anteprima)): ?>
    <div class="tabella-scroll">
      <table class="tabella">
        <thead><tr><th>Esito</th><th>Titolo</th><th>Prezzo</th><th>Superficie</th></tr></thead>
        <tbody>
        <?php foreach ($anteprima['righe'] as $r): ?>
          <tr>
            <td><?= e((string) $r['stato']) ?></td>
            <td><?= e((string) $r['titolo']) ?></td>
            <td><?= e($r['prezzo'] === null ? 'riservato' : euro((float) $r['prezzo'])) ?></td>
            <td><?= (int) $r['mq'] ?> mq</td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    </div>
    <?php if (!empty($anteprima['avvisi'])): ?>
      <h3>Da guardare</h3>
      <ul class="elenco">
        <?php foreach ($anteprima['avvisi'] as $a): ?><li><?= e((string) $a) ?></li><?php endforeach; ?>
      </ul>
    <?php endif; ?>
  <?php endif; ?>
</div>

<div class="pannello">
  <h2>Passo 3 — importa davvero</h2>
  <p class="aiuto">
    Adesso scrive. Gli immobili arrivano nel gestionale con le foto, e gli indirizzi restano
    identici a quelli di WordPress. Ci vuole qualche minuto: la pagina avanza da sola,
    <strong>non chiuderla</strong>. Se si interrompe, si riprende da dove era.
  </p>
  <form method="post" action="<?= e(url('/gestionale/importa/avvia/')) ?>"
        onsubmit="return confirm('Importare gli immobili da WordPress?')">
    <?= Csrf::field() ?>
    <button class="btn btn-primary">Importa gli immobili</button>
  </form>
</div>
<?php endif; ?>
