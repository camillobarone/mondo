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

  <h2 class="pagina-titolo"><?= e((string) $post['title']) ?></h2>
  <p class="post-meta">
    <?php if (!empty($post['author_name'])): ?>Scritto da <?= e((string) $post['author_name']) ?> · <?php endif; ?>
    <?= e(data_it((string) ($post['published_at'] ?: $post['created_at']))) ?>
  </p>

  <?php if (trim((string) $post['excerpt']) !== ''): ?>
    <p class="risposta-diretta"><?= e((string) $post['excerpt']) ?></p>
  <?php endif; ?>

  <div class="testo"><?= nl2br(e((string) $post['body'])) ?></div>

  <p class="firma">
    <?= e((string) ($post['author_name'] ?: 'Mondo Immobiliare')) ?> — Agente Immobiliare FIMAA<br>
    <span>Aggiornato al <?= e(data_it((string) ($post['updated_at'] ?: $post['published_at'] ?: $post['created_at']))) ?></span>
  </p>

  <?php if ($altri !== []): ?>
    <section class="sezione">
      <h3>Altri articoli</h3>
      <ul class="elenco">
        <?php foreach ($altri as $a): ?>
          <?php if ((int) $a['id'] !== (int) $post['id']): ?>
            <li><a href="<?= e(url('/blog/' . $a['slug'] . '/')) ?>"><?= e((string) $a['title']) ?></a></li>
          <?php endif; ?>
        <?php endforeach; ?>
      </ul>
    </section>
  <?php endif; ?>
</article>
