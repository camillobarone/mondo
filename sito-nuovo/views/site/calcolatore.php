<?php

/**
 * @var array{prima:bool,impresa:bool,lusso:bool,rendita:?float,prezzo:?float} $dati
 * @var bool $compilato
 * @var array{voci:array<int,array{nome:string,importo:float,dettaglio:string}>,totale:float,base:?float,baseNome:string,manca:string}|null $esito
 * @var array<int,array{q:string,a:string}> $faq
 */

use Mil\Core\Imposte;

$valore = static fn (?float $v): string => $v === null ? '' : rtrim(rtrim(number_format($v, 2, '.', ''), '0'), '.');
?>
<article class="wrap sezione">
  <nav class="briciole" aria-label="Percorso">
    <a href="<?= e(url('/')) ?>">Home</a> › <span>Calcolo imposte d’acquisto</span>
  </nav>

  <header class="testata">
    <h1>Quanto si paga di imposte comprando casa</h1>
    <p class="occhiello">Registro, IVA, ipotecaria e catastale, con le aliquote in vigore nel 2026.
      Il conto cambia in modo netto a seconda che sia prima o seconda casa e che si compri
      da un privato o da un costruttore: sono i due dati che il modulo chiede per primi.</p>
  </header>

  <div class="calcolo-grid">
    <form class="form form-calcolo" method="get" action="<?= e(url('/calcolatore-imposte-acquisto-casa/')) ?>">
      <fieldset>
        <legend>Che casa è</legend>
        <label class="scelta">
          <input type="radio" name="casa" value="prima" <?= $dati['prima'] ? 'checked' : '' ?>>
          <span><strong>Prima casa</strong><small>ci trasferisco la residenza entro 18 mesi</small></span>
        </label>
        <label class="scelta">
          <input type="radio" name="casa" value="seconda" <?= $dati['prima'] ? '' : 'checked' ?>>
          <span><strong>Seconda casa</strong><small>o non ho i requisiti per l’agevolazione</small></span>
        </label>
      </fieldset>

      <fieldset>
        <legend>Da chi la compro</legend>
        <label class="scelta">
          <input type="radio" name="venditore" value="privato" <?= $dati['impresa'] ? '' : 'checked' ?>>
          <span><strong>Da un privato</strong><small>le imposte si calcolano sulla rendita catastale</small></span>
        </label>
        <label class="scelta">
          <input type="radio" name="venditore" value="impresa" <?= $dati['impresa'] ? 'checked' : '' ?>>
          <span><strong>Da un’impresa, con IVA</strong><small>costruttore entro 5 anni dalla fine dei lavori</small></span>
        </label>
      </fieldset>

      <?php /* Si chiedono tutti e due i numeri, sempre. Senza JavaScript non
               si può nascondere il campo che non serve, e mostrarne uno solo
               vorrebbe dire ricaricare la pagina per cambiare idea sul
               venditore: chiedere entrambi costa una riga in più e non
               interrompe mai il ragionamento di chi compila. */ ?>
      <label>Rendita catastale
        <input type="text" name="rendita" inputmode="decimal" value="<?= e($valore($dati['rendita'])) ?>"
               placeholder="es. 750">
        <small>Serve se compri da un privato. Sta nella visura catastale o nell’atto di provenienza.</small>
      </label>

      <label>Prezzo dichiarato
        <input type="text" name="prezzo" inputmode="decimal" value="<?= e($valore($dati['prezzo'])) ?>"
               placeholder="es. 200000">
        <small>Serve se compri da un’impresa con IVA.</small>
      </label>

      <label class="scelta scelta-riga">
        <input type="checkbox" name="lusso" value="1" <?= $dati['lusso'] ? 'checked' : '' ?>>
        <span>È una casa di lusso, categoria A/1, A/8 o A/9 <small>cambia solo l’IVA, che sale al 22%</small></span>
      </label>

      <button type="submit" class="btn btn-primary largo">Calcola le imposte</button>
    </form>

    <div class="calcolo-esito">
      <?php if (!$compilato): ?>
        <div class="esito-vuoto">
          <h2>Il risultato compare qui</h2>
          <p>Compila il modulo e premi «Calcola». Il conto resta in questa pagina e
            l’indirizzo che si forma si può salvare o mandare per email: riaprendolo,
            i dati sono ancora lì.</p>
        </div>
      <?php elseif ($esito['manca'] !== ''): ?>
        <p class="flash flash-warn"><?= e($esito['manca']) ?></p>
      <?php else: ?>
        <h2>Imposte da versare</h2>
        <p class="esito-base"><?= e($esito['baseNome']) ?><?= $esito['base'] === null ? '' : ' = <strong>' . e(euro($esito['base'])) . '</strong>' ?></p>

        <table class="tabella-imposte">
          <tbody>
            <?php foreach ($esito['voci'] as $voce): ?>
              <tr>
                <th scope="row"><?= e($voce['nome']) ?><br><small><?= e($voce['dettaglio']) ?></small></th>
                <td><?= e(Imposte::soldi($voce['importo'])) ?></td>
              </tr>
            <?php endforeach; ?>
          </tbody>
          <tfoot>
            <tr><th scope="row">Totale imposte</th><td><?= e(Imposte::soldi($esito['totale'])) ?></td></tr>
          </tfoot>
        </table>

        <p class="nota">Restano fuori onorario del notaio, imposta di bollo, tassa ipotecaria
          e provvigione dell’agenzia: sono voci separate, che non dipendono da questo calcolo.</p>

        <p><a class="btn btn-ghost" href="<?= e(url('/contatti/')) ?>">Fatti dare il conto esatto da un agente</a></p>
      <?php endif; ?>
    </div>
  </div>

  <section class="sezione-testo">
    <h2>Come funziona il calcolo</h2>
    <p>Comprando <strong>da un privato</strong> le imposte non si calcolano sul prezzo pagato ma sul
      <strong>valore catastale</strong>: è la regola del prezzo-valore, in vigore dal 2006, e va chiesta
      espressamente al notaio durante il rogito. Il valore catastale si ottiene moltiplicando la rendita
      per 115,5 sulla prima casa e per 126 sulla seconda — due coefficienti diversi, ed è l’errore che
      si vede più spesso.</p>
    <p>Comprando <strong>da un’impresa costruttrice</strong> entro cinque anni dalla fine dei lavori si paga
      invece l’IVA sul prezzo dichiarato, e l’imposta di registro diventa fissa a 200 euro, come
      l’ipotecaria e la catastale.</p>
    <p>Nel Salento il valore catastale è tipicamente il 40-60% del valore di mercato: è la ragione per cui,
      su una compravendita fra privati, l’imposta risulta molto più bassa di quanto ci si aspetti
      guardando il prezzo.</p>

    <h2>Domande frequenti</h2>
    <div class="faq">
      <?php foreach ($faq as $i => $voce): ?>
        <details<?= $i === 0 ? ' open' : '' ?>>
          <summary><?= e($voce['q']) ?></summary>
          <div class="faq-risposta"><?= e($voce['a']) ?></div>
        </details>
      <?php endforeach; ?>
    </div>

    <p>Se la casa si compra con un mutuo, la rata è un conto a parte e si fa qui:
      <a href="<?= e(url('/calcolatore-rata-mutuo/')) ?>">calcolo della rata del mutuo</a>.</p>

    <p class="firma">Aliquote e coefficienti secondo la guida fiscale di Mondo Immobiliare,
      basata su Agenzia delle Entrate e Consiglio Nazionale del Notariato.<br>
      <span>Il calcolo è una stima: l’importo definitivo lo determina il notaio in sede di rogito.</span></p>
  </section>
</article>
