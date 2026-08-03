<?php

/**
 * @var array<string,int> $immobili
 * @var array<string,int> $lead
 * @var int $clientiAttivi
 * @var array<int,array<string,mixed>> $appuntamenti
 * @var array<int,array<string,mixed>> $ultimiLead
 * @var array<int,array<string,mixed>> $piuViste
 * @var array<int,array<string,mixed>> $attivita
 */

use Mil\Core\Vocab;
?>
<div class="kpi">
  <a class="kpi-box" href="<?= e(url('/gestionale/immobili/?stato=published')) ?>">
    <strong><?= (int) ($immobili['published'] ?? 0) ?></strong><span>immobili online</span>
  </a>
  <a class="kpi-box" href="<?= e(url('/gestionale/immobili/?stato=draft')) ?>">
    <strong><?= (int) ($immobili['draft'] ?? 0) ?></strong><span>bozze da completare</span>
  </a>
  <a class="kpi-box <?= (int) ($lead['nuovo'] ?? 0) > 0 ? 'kpi-alert' : '' ?>" href="<?= e(url('/gestionale/richieste/?stato=nuovo')) ?>">
    <strong><?= (int) ($lead['nuovo'] ?? 0) ?></strong><span>richieste da lavorare</span>
  </a>
  <a class="kpi-box" href="<?= e(url('/gestionale/clienti/')) ?>">
    <strong><?= (int) $clientiAttivi ?></strong><span>clienti in ricerca</span>
  </a>
  <div class="kpi-box">
    <strong><?= (int) ($lead['ultimi7'] ?? 0) ?></strong><span>richieste negli ultimi 7 giorni</span>
  </div>
  <div class="kpi-box">
    <strong><?= (int) $anno['rogiti'] ?></strong><span>rogiti nel <?= (int) $anno['anno'] ?></span>
  </div>
</div>

<?php if ($incarichi !== [] || $proposteAperte !== []): ?>
<div class="due-colonne">
  <section class="pannello">
    <h2>Incarichi in scadenza <span class="muto">(entro 45 giorni)</span></h2>
    <?php if ($incarichi === []): ?>
      <p class="vuoto">Nessun incarico in scadenza.</p>
    <?php else: ?>
      <table class="tabella">
        <thead><tr><th>Scade</th><th>Immobile</th><th>Agente</th></tr></thead>
        <tbody>
        <?php foreach ($incarichi as $i): ?>
          <?php $scaduto = strtotime((string) $i['mandate_end']) < strtotime('today'); ?>
          <tr>
            <td><?= e(data_it((string) $i['mandate_end'])) ?>
              <?php if ($scaduto): ?><br><span class="pill pill-nuovo">scaduto</span><?php endif; ?></td>
            <td><a href="<?= e(url('/gestionale/immobili/' . $i['id'] . '/')) ?>"><?= e((string) $i['title']) ?></a><br>
              <small><?= (int) $i['exclusive'] === 1 ? 'esclusiva' : 'non esclusiva' ?></small></td>
            <td><?= e((string) ($i['agent_name'] ?? '—')) ?></td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    <?php endif; ?>
  </section>

  <section class="pannello">
    <h2>Proposte in attesa di risposta</h2>
    <?php if ($proposteAperte === []): ?>
      <p class="vuoto">Nessuna proposta aperta.</p>
    <?php else: ?>
      <ul class="lista">
        <?php foreach ($proposteAperte as $o): ?>
          <li>
            <strong><?= e(euro((float) $o['amount'])) ?></strong>
            su <a href="<?= e(url('/gestionale/immobili/' . $o['property_id'] . '/')) ?>"><?= e((string) $o['property_title']) ?></a><br>
            <small class="muto"><?= e(data_it((string) $o['presented_at'])) ?>
              <?php if (!empty($o['contact_name'])): ?>— <?= e((string) $o['contact_name']) ?><?php endif; ?></small>
          </li>
        <?php endforeach; ?>
      </ul>
    <?php endif; ?>
  </section>
</div>
<?php endif; ?>

<?php if ($daRichiamare !== [] || $adempimenti !== []): ?>
<div class="due-colonne">
  <section class="pannello">
    <h2>Da richiamare <span class="muto">(non sentiti da oltre 45 giorni)</span></h2>
    <?php if ($daRichiamare === []): ?>
      <p class="vuoto">Tutti i clienti attivi sono stati sentiti di recente.</p>
    <?php else: ?>
      <ul class="lista">
        <?php foreach ($daRichiamare as $c): ?>
          <li>
            <a href="<?= e(url('/gestionale/clienti/' . $c['id'] . '/')) ?>"><?= e((string) $c['name']) ?></a>
            <?php if (!empty($c['phone'])): ?><span class="muto"><?= e((string) $c['phone']) ?></span><?php endif; ?><br>
            <small class="muto"><?= e(!empty($c['last_contact_at'])
                ? 'ultimo contatto ' . data_it((string) $c['last_contact_at'])
                : 'mai registrato un contatto') ?></small>
          </li>
        <?php endforeach; ?>
      </ul>
    <?php endif; ?>
  </section>

  <section class="pannello">
    <h2>Adempimenti da completare</h2>
    <?php if ($adempimenti === []): ?>
      <p class="vuoto">Privacy e identificazione a posto su tutti i clienti attivi.</p>
    <?php else: ?>
      <p class="muto">Consenso privacy o identificazione antiriciclaggio mancanti.</p>
      <ul class="lista">
        <?php foreach ($adempimenti as $c): ?>
          <li>
            <a href="<?= e(url('/gestionale/clienti/' . $c['id'] . '/')) ?>"><?= e((string) $c['name']) ?></a><br>
            <small class="muto"><?php
              $mancano = [];
              if ((int) $c['privacy_consent'] === 0 || empty($c['privacy_date'])) {
                  $mancano[] = 'consenso privacy';
              }
              if (empty($c['aml_checked_at'])) {
                  $mancano[] = 'identificazione';
              }
              echo e('manca: ' . implode(', ', $mancano));
            ?></small>
          </li>
        <?php endforeach; ?>
      </ul>
    <?php endif; ?>
  </section>
</div>
<?php endif; ?>

<div class="due-colonne">
  <section class="pannello">
    <h2>Ultime richieste</h2>
    <?php if ($ultimiLead === []): ?>
      <p class="vuoto">Nessuna richiesta ancora.</p>
    <?php else: ?>
      <table class="tabella">
        <thead><tr><th>Quando</th><th>Chi</th><th>Origine</th><th>Stato</th></tr></thead>
        <tbody>
        <?php foreach ($ultimiLead as $l): ?>
          <tr>
            <td><?= e(data_it((string) $l['created_at'], true)) ?></td>
            <td><a href="<?= e(url('/gestionale/richieste/' . $l['id'] . '/')) ?>"><?= e((string) $l['name']) ?></a><br>
                <small><?= e((string) ($l['phone'] ?: $l['email'])) ?></small></td>
            <td><?= e(Vocab::label('lead_source', (string) $l['source'])) ?>
                <?php if (!empty($l['property_title'])): ?><br><small><?= e((string) $l['property_title']) ?></small><?php endif; ?></td>
            <td><span class="pill pill-<?= e((string) $l['status']) ?>"><?= e(Vocab::label('lead_status', (string) $l['status'])) ?></span></td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    <?php endif; ?>
  </section>

  <section class="pannello">
    <h2>Prossimi appuntamenti</h2>
    <?php if ($appuntamenti === []): ?>
      <p class="vuoto">Agenda libera. <a href="<?= e(url('/gestionale/agenda/')) ?>">Aggiungi un appuntamento</a>.</p>
    <?php else: ?>
      <ul class="lista">
        <?php foreach ($appuntamenti as $a): ?>
          <li><strong><?= e(data_it((string) $a['starts_at'], true)) ?></strong> — <?= e((string) $a['title']) ?>
            <?php if (!empty($a['contact_name'])): ?><br><small>con <?= e((string) $a['contact_name']) ?></small><?php endif; ?>
          </li>
        <?php endforeach; ?>
      </ul>
    <?php endif; ?>

    <h2>Immobili più visti</h2>
    <?php if ($piuViste === []): ?>
      <p class="vuoto">Nessun dato ancora.</p>
    <?php else: ?>
      <ul class="lista">
        <?php foreach ($piuViste as $v): ?>
          <li><a href="<?= e(url('/gestionale/immobili/' . $v['id'] . '/')) ?>"><?= e((string) $v['title']) ?></a>
            <span class="muto"><?= (int) $v['views'] ?> visite</span></li>
        <?php endforeach; ?>
      </ul>
    <?php endif; ?>
  </section>
</div>

<?php if ($attivita !== []): ?>
<section class="pannello">
  <h2>Ultime attività</h2>
  <ul class="lista lista-fitta">
    <?php foreach ($attivita as $a): ?>
      <li><span class="muto"><?= e(data_it((string) $a['created_at'], true)) ?></span>
        <?= e((string) ($a['user_name'] ?: 'sistema')) ?>: <?= e((string) $a['action']) ?> <?= e((string) $a['entity']) ?>
        <?php if ($a['detail'] !== ''): ?>— <?= e((string) $a['detail']) ?><?php endif; ?></li>
    <?php endforeach; ?>
  </ul>
</section>
<?php endif; ?>
