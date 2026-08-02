<?php

/**
 * Modulo di contatto riusato su valutazione, scheda immobile e contatti.
 *
 * @var string $fonte      valutazione | immobile | contatto
 * @var string $titoloForm
 * @var string $sottotitolo
 * @var int|null $immobileId
 */
$fonte ??= 'contatto';
$titoloForm ??= 'Scrivici';
$sottotitolo ??= '';
$immobileId ??= null;
$inviato = ($_GET['inviato'] ?? '') === '1';
?>
<section class="modulo" id="modulo">
  <h2><?= e($titoloForm) ?></h2>
  <?php if ($sottotitolo !== ''): ?><p class="modulo-sub"><?= e($sottotitolo) ?></p><?php endif; ?>

  <?php if ($inviato): ?>
    <p class="modulo-ok">Richiesta ricevuta. Ti ricontattiamo entro 48 ore lavorative.</p>
  <?php endif; ?>

  <form method="post" action="<?= e(url('/invia-richiesta/')) ?>" class="form">
    <input type="hidden" name="fonte" value="<?= e($fonte) ?>">
    <input type="hidden" name="ts" value="<?= time() ?>">
    <?php if ($immobileId !== null): ?>
      <input type="hidden" name="immobile" value="<?= (int) $immobileId ?>">
    <?php endif; ?>

    <!-- Honeypot: invisibile a chi compila, irresistibile per i bot. -->
    <div class="hp" aria-hidden="true">
      <label>Non compilare questo campo <input type="text" name="website" tabindex="-1" autocomplete="off"></label>
    </div>

    <div class="form-row">
      <label>Nome e cognome
        <input type="text" name="nome" required autocomplete="name">
      </label>
      <label>Telefono
        <input type="tel" name="telefono" autocomplete="tel" placeholder="es. 340 1234567">
      </label>
    </div>

    <div class="form-row">
      <label>Email
        <input type="email" name="email" autocomplete="email">
      </label>
      <?php if ($fonte === 'valutazione'): ?>
      <label>Dove si trova la casa
        <input type="text" name="dove" placeholder="Comune e zona, es. Lecce — Mazzini">
      </label>
      <?php endif; ?>
    </div>

    <label>Messaggio
      <textarea name="messaggio" rows="4" placeholder="Raccontaci in due righe di cosa hai bisogno"></textarea>
    </label>

    <p class="privacy">Inviando accetti che ti ricontattiamo per rispondere alla richiesta. I dati non vengono ceduti a terzi.</p>
    <button type="submit" class="btn btn-primary">Invia la richiesta</button>
  </form>
</section>
