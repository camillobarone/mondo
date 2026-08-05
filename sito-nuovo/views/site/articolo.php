<?php

/**
 * @var array<string,mixed> $post
 * @var array<int,array<string,mixed>> $altri
 */
?>
<article class="wrap sezione articolo">
  <nav class="briciole" aria-label="Percorso">
    <a href="<?= e(url('/')) ?>">Home</a> ›
    <a href="<?= e(url('/blog/')) ?>">Blog</a> ›
    <span><?= e((string) $post['title']) ?></span>
  </nav>

  <h1 class="pagina-titolo"><?= e((string) $post['title']) ?></h1>
  <p class="post-meta">
    <?php if (!empty($post['author_name'])): ?>Scritto da <?= e((string) $post['author_name']) ?> · <?php endif; ?>
    <?= e(data_it((string) ($post['published_at'] ?: $post['created_at']))) ?>
  </p>

  <?php if (trim((string) $post['excerpt']) !== ''): ?>
    <?php /* L'occhiello è una frase, non un pezzo di pagina impaginato: si
             tolgono i segni del markdown senza trasformarli in titoli. Negli
             elenchi ci pensa già tronca(); qui il testo non viene tagliato e
             i «##» finivano a video tali e quali. */ ?>
    <p class="risposta-diretta"><?= e(Mil\Core\Testo::piano((string) $post['excerpt'])) ?></p>
  <?php endif; ?>

  <div class="testo"><?= Mil\Core\Testo::html((string) $post['body']) ?></div>

  <?php $bio = trim((string) ($post['author_bio'] ?? '')); ?>
  <footer class="autore">
    <p class="autore-nome">
      <?= e((string) ($post['author_name'] ?: 'Mondo Immobiliare')) ?> — Agente Immobiliare FIMAA
    </p>
    <?php if ($bio !== ''): ?>
      <div class="autore-bio"><?= Mil\Core\Testo::html($bio) ?></div>
    <?php endif; ?>
    <p class="autore-data">Aggiornato al <?= e(data_it((string) ($post['updated_at'] ?: $post['published_at'] ?: $post['created_at']))) ?></p>
  </footer>

  <?php if ($altri !== []): ?>
    <section class="sezione">
      <h2 class="titolo-sezione">Altri articoli</h2>
      <ul class="elenco">
        <?php foreach ($altri as $a): ?>
          <li><a href="<?= e(url('/' . $a['slug'] . '/')) ?>"><?= e((string) $a['title']) ?></a></li>
        <?php endforeach; ?>
      </ul>
    </section>
  <?php endif; ?>
</article>
