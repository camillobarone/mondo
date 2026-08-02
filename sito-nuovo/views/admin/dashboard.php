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
</div>

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
