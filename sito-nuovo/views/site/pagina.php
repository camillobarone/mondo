<?php

/** @var array<string,mixed> $page */
?>
<article class="wrap sezione">
  <nav class="briciole" aria-label="Percorso">
    <a href="<?= e(url('/')) ?>">Home</a> › <span><?= e((string) $page['title']) ?></span>
  </nav>

  <h2 class="pagina-titolo"><?= e((string) $page['title']) ?></h2>
  <div class="testo"><?= nl2br(e((string) $page['body'])) ?></div>

  <p class="firma">Mondo Immobiliare — agenzia FIMAA dal 1994<br>
    <span>Aggiornata al <?= e(data_it((string) ($page['updated_at'] ?: $page['created_at']))) ?></span></p>
</article>
