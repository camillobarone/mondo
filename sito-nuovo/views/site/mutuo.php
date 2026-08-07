<?php

/**
 * @var array{importo:?float,anni:?int,tasso:?float,rate:int,prezzo:?float} $dati
 * @var bool $compilato
 * @var bool $tutte
 * @var array{rata:int,rate:array<int,array{n:int,dovuto:int,capitale:int,interessi:int,residuo:int}>,interessi:int,totale:int,numero:int,primaInteressi:int,anni:array<int,array{capitale:int,interessi:int,dovuto:int,residuo:int}>,ltv:?float,manca:string}|null $esito
 * @var array<int,array{q:string,a:string}> $faq
 */

use Mil\Core\Mutuo;

/* I numeri tornano nel modulo come li ha scritti chi compila, non in notazione
   da database: «180000» e non «180000,00», «3,3» e non «3,30».

   Gli zeri di troppo si tolgono SOLO quando ci sono decimali. Tagliarli sempre
   costava caro: «144000» finiva nel campo come «144», e lo stesso numero
   mutilato entrava nel collegamento «Tutte le rate», che rifaceva il conto su
   centoquarantaquattro euro. */
$valore = static function (int|float|null $v, int $decimali = 0): string {
    if ($v === null) {
        return '';
    }
    $testo = number_format((float) $v, $decimali, ',', '');

    return $decimali > 0 ? rtrim(rtrim($testo, '0'), ',') : $testo;
};

$base = url('/calcolatore-rata-mutuo/');

/* Il collegamento fra «per anno» e «tutte le rate» rifà l'indirizzo intero
   invece di aggiungere un parametro: senza JavaScript è l'unico modo di
   cambiare vista senza perdere quello che si è appena scritto nel modulo. */
$conPiano = static function (string $piano) use ($dati, $base, $valore): string {
    $campi = array_filter([
        'prezzo' => $valore($dati['prezzo']),
        'importo' => $valore($dati['importo']),
        'anni' => $dati['anni'] === null ? '' : (string) $dati['anni'],
        'tasso' => $valore($dati['tasso'], 2),
        'rate' => $dati['rate'] === 0 ? '' : (string) $dati['rate'],
        'piano' => $piano,
    ], static fn (string $v): bool => $v !== '');

    return $base . '?' . http_build_query($campi);
};
?>
<article class="wrap sezione">
  <nav class="briciole" aria-label="Percorso">
    <a href="<?= e(url('/')) ?>">Home</a> › <span>Calcolo rata mutuo</span>
  </nav>

  <header class="testata">
    <h1>Quanto viene la rata del mutuo</h1>
    <p class="occhiello">Ammortamento alla francese, a rata costante: quello di quasi tutti i mutui
      italiani. Il calcolo esce con la rata, gli interessi che si pagheranno in tutto e il piano
      completo, rata per rata. Il tasso lo scrivi tu, prendendolo dal preventivo della banca.</p>
  </header>

  <div class="calcolo-grid">
    <form class="form form-calcolo" method="get" action="<?= e($base) ?>">
      <label>Importo del mutuo
        <input type="text" name="importo" inputmode="numeric" value="<?= e($valore($dati['importo'])) ?>"
               placeholder="es. 144000">
        <small>Quanto chiedi alla banca, non il prezzo della casa.</small>
      </label>

      <label>Durata
        <input type="number" name="anni" inputmode="numeric" min="<?= Mutuo::ANNI_MIN ?>"
               max="<?= Mutuo::ANNI_MAX ?>" step="1" placeholder="es. 25"
               value="<?= e($dati['anni'] === null ? '' : (string) $dati['anni']) ?>">
        <small>In anni, da <?= Mutuo::ANNI_MIN ?> a <?= Mutuo::ANNI_MAX ?>.</small>
      </label>

      <label>Tasso annuo (TAN)
        <input type="text" name="tasso" inputmode="decimal" value="<?= e($valore($dati['tasso'], 2)) ?>"
               placeholder="es. 3,30">
        <small>In percentuale. Sta sul preventivo della banca: qui non c’è un tasso
          preimpostato perché cambierebbe da un mese all’altro.</small>
      </label>

      <?php /* Anche la periodicità parte vuota: la prima voce non è una
               scelta, è il posto in cui la scelta non è stata ancora fatta. */ ?>
      <label>Periodicità della rata
        <select name="rate">
          <option value=""<?= $dati['rate'] === 0 ? ' selected' : '' ?>>Da scegliere</option>
          <?php foreach (Mutuo::RATE_ANNO as $quante => $etichetta): ?>
            <option value="<?= $quante ?>"<?= $dati['rate'] === $quante ? ' selected' : '' ?>><?= e($etichetta) ?></option>
          <?php endforeach; ?>
        </select>
        <small>Quasi tutti i mutui sono a rata mensile.</small>
      </label>

      <?php /* Il prezzo non entra nel calcolo della rata: serve solo a far
               comparire il rapporto fra mutuo e valore della casa, che è il
               numero su cui la banca decide se il mutuo si fa. */ ?>
      <label>Prezzo dell’immobile <span class="campo-opzionale">facoltativo</span>
        <input type="text" name="prezzo" inputmode="numeric" value="<?= e($valore($dati['prezzo'])) ?>"
               placeholder="es. 180000">
        <small>Se lo scrivi, il calcolo mostra anche quanta parte del prezzo copre il mutuo.</small>
      </label>

      <button type="submit" class="btn btn-primary largo">Calcola la rata</button>
    </form>

    <div class="calcolo-esito">
      <?php if (!$compilato): ?>
        <div class="esito-vuoto">
          <h2>Il risultato compare qui</h2>
          <p>Compila il modulo e premi «Calcola». Il conto resta in questa pagina e
            l’indirizzo che si forma si può salvare o mandare per email e su WhatsApp:
            riaprendolo, i numeri sono ancora lì.</p>
        </div>
      <?php elseif ($esito['manca'] !== ''): ?>
        <p class="flash flash-warn"><?= e($esito['manca']) ?></p>
      <?php else: ?>
        <p class="esito-base">Rata <?= e(mb_strtolower(Mutuo::RATE_ANNO[$dati['rate']])) ?></p>
        <p class="rata-grande"><?= e(Mutuo::soldi($esito['rata'])) ?></p>

        <dl class="rata-voci">
          <div>
            <dt>Interessi totali</dt>
            <dd><?= e(Mutuo::tondi($esito['interessi'])) ?></dd>
          </div>
          <div>
            <dt>Totale da rimborsare</dt>
            <dd><?= e(Mutuo::tondi($esito['totale'])) ?></dd>
          </div>
          <div>
            <dt>Numero di rate</dt>
            <dd><?= $esito['numero'] ?></dd>
          </div>
          <div>
            <dt>Interessi nella prima rata</dt>
            <dd><?= e(Mutuo::soldi($esito['primaInteressi'])) ?></dd>
          </div>
        </dl>

        <?php if ($esito['ltv'] !== null): ?>
          <p class="nota<?= $esito['ltv'] > Mutuo::LTV_SOGLIA ? ' nota-attenzione' : '' ?>">
            Il mutuo copre il <?= e(Mutuo::percentuale($esito['ltv'])) ?> del prezzo<?= $esito['ltv'] > Mutuo::LTV_SOGLIA
              ? ' — sopra l’' . e(Mutuo::percentuale(Mutuo::LTV_SOGLIA)) . ' le banche chiedono di norma garanzie aggiuntive.'
              : '.' ?>
          </p>
        <?php endif; ?>

        <p><a class="btn btn-ghost" href="<?= e(url('/contatti/')) ?>">Vedi quali case rientrano in questa rata</a></p>
      <?php endif; ?>
    </div>
  </div>

  <?php if ($compilato && $esito['manca'] === ''): ?>
  <section class="mutuo-blocco">
    <div class="mutuo-blocco-testa">
      <h2>Come si compone la rata, anno per anno</h2>
      <p class="legenda">
        <span class="pallino pallino-cap"></span> Quota capitale
        <span class="pallino pallino-int"></span> Quota interessi
      </p>
    </div>
    <?php /* Il grafico esce dal server già disegnato: sono rettangoli SVG
             calcolati in PHP, non una libreria da scaricare. */ ?>
    <div class="grafico-rata"><?= Mutuo::grafico($esito['anni']) ?></div>
    <p class="nota">Ogni barra è un anno. All’inizio la rata è quasi tutta interessi perché
      si calcolano sul debito che resta, che all’inizio è intero; con gli anni il rapporto
      si ribalta.</p>
  </section>

  <section class="mutuo-blocco">
    <div class="mutuo-blocco-testa">
      <h2>Piano di ammortamento</h2>
      <p class="piano-scelta">
        <a href="<?= e($conPiano('anno')) ?>"<?= $tutte ? '' : ' aria-current="page"' ?>>Per anno</a>
        <a href="<?= e($conPiano('tutte')) ?>"<?= $tutte ? ' aria-current="page"' : '' ?>>Tutte le rate</a>
      </p>
    </div>

    <?php /* `tabindex` sul riquadro che scorre: senza, chi naviga da tastiera
             non può scorrere il piano, perché dentro non c'è niente che possa
             prendere il fuoco. Il gruppo ha un nome, altrimenti chi ascolta la
             pagina ci finisce dentro senza sapere cos'è. */ ?>
    <div class="piano-riquadro" tabindex="0" role="group" aria-label="Piano di ammortamento">
      <table class="piano-tabella">
        <?php if ($tutte): ?>
          <thead>
            <tr><th scope="col">Rata</th><th scope="col">Totale pagato</th><th scope="col">Quota capitale</th><th scope="col">Quota interessi</th><th scope="col">Debito residuo</th></tr>
          </thead>
          <tbody>
            <?php foreach ($esito['rate'] as $voce): ?>
              <tr>
                <th scope="row"><?= $voce['n'] ?></th>
                <td><?= e(Mutuo::soldi($voce['dovuto'])) ?></td>
                <td><?= e(Mutuo::soldi($voce['capitale'])) ?></td>
                <td><?= e(Mutuo::soldi($voce['interessi'])) ?></td>
                <td><?= e(Mutuo::soldi($voce['residuo'])) ?></td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        <?php else: ?>
          <thead>
            <tr><th scope="col">Anno</th><th scope="col">Quota capitale</th><th scope="col">Quota interessi</th><th scope="col">Totale pagato</th><th scope="col">Debito residuo</th></tr>
          </thead>
          <tbody>
            <?php foreach ($esito['anni'] as $indice => $anno): ?>
              <tr>
                <th scope="row"><?= $indice + 1 ?></th>
                <td><?= e(Mutuo::tondi($anno['capitale'])) ?></td>
                <td><?= e(Mutuo::tondi($anno['interessi'])) ?></td>
                <td><?= e(Mutuo::tondi($anno['dovuto'])) ?></td>
                <td><?= e(Mutuo::tondi($anno['residuo'])) ?></td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        <?php endif; ?>
      </table>
    </div>
    <p class="nota solo-stretto">La tabella scorre di lato: le ultime colonne sono il totale
      pagato e quanto resta da restituire.</p>
  </section>
  <?php endif; ?>

  <section class="sezione-testo">
    <h2>Come funziona il calcolo</h2>
    <p>La rata è <strong>costante</strong>: la stessa cifra dalla prima all’ultima. Quello che cambia,
      dentro la rata, è il rapporto fra le due parti che la compongono. Gli interessi si calcolano
      ogni volta sul <strong>debito che resta</strong>, quindi all’inizio sono la fetta grossa e la
      quota che riduce davvero il capitale è sottile; a ogni rata il debito scende un po’, gli
      interessi scendono con lui e la quota capitale cresce.</p>
    <p>È la ragione pratica per cui <strong>estinguere in anticipo conviene nei primi anni</strong> e
      molto meno negli ultimi: negli ultimi il grosso degli interessi è già stato pagato, e quello
      che resta da restituire è quasi tutto capitale.</p>
    <p>Il tasso periodale è il TAN diviso il numero di rate in un anno: con la rata mensile si divide
      per dodici, con la trimestrale per quattro. Allungare la durata abbassa la rata e alza gli
      interessi complessivi — sono due effetti opposti, e il calcolo li mostra tutti e due
      insieme proprio per non far guardare solo il primo.</p>

    <p class="nota">Resta fuori tutto ciò che non è restituzione del capitale: imposta sostitutiva,
      istruttoria, perizia, assicurazioni, spese di incasso rata. Sono le voci che trasformano il
      TAN in TAEG e le quantifica solo il prospetto della banca. Questo calcolo non è un’offerta
      né una consulenza finanziaria.</p>

    <h2>Domande frequenti</h2>
    <div class="faq">
      <?php foreach ($faq as $i => $voce): ?>
        <details<?= $i === 0 ? ' open' : '' ?>>
          <summary><?= e($voce['q']) ?></summary>
          <div class="faq-risposta"><?= e($voce['a']) ?></div>
        </details>
      <?php endforeach; ?>
    </div>

    <p>Le imposte da versare al rogito sono un conto a parte, e si fanno sul valore catastale o sul
      prezzo a seconda di chi vende: c’è
      <a href="<?= e(url('/calcolatore-imposte-acquisto-casa/')) ?>">il calcolo delle imposte d’acquisto</a>.</p>

    <p class="firma">Camillo Barone — Agente Immobiliare FIMAA<br>
      <span>Il calcolo è una stima costruita sull’ammortamento alla francese: le condizioni
        effettive le stabilisce la banca.</span></p>
  </section>
</article>
