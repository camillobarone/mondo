<?php

/** @var array{items:array<int,array<string,mixed>>,total:int,pages:int,page:int} $result */
?>
<section class="wrap sezione">
  <h1 class="pagina-titolo">Blog</h1>
  <p class="pagina-sub">Prezzi, fisco e mercato immobiliare a Lecce e nel Salento, spiegati da chi ci lavora.</p>

  <?php if ($result['items'] === []): ?>
    <p class="vuoto">Nessun articolo pubblicato.</p>
  <?php else: ?>
    <div class="griglia griglia-3">
      <?php foreach ($result['items'] as $post): ?>
        <article class="post-card">
          <h2 class="titolo-sezione"><a href="<?= e(url('/' . $post['slug'] . '/')) ?>"><?= e((string) $post['title']) ?></a></h2>
          <p><?= e(tronca((string) ($post['excerpt'] ?: $post['body']), 160)) ?></p>
          <p class="post-meta">
            <?= e(data_it((string) ($post['published_at'] ?: $post['created_at']))) ?>
            <?php if (!empty($post['author_name'])): ?> · <?= e((string) $post['author_name']) ?><?php endif; ?>
          </p>
        </article>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>

  <?php if ($result['pages'] > 1): ?>
    <nav class="paginazione" aria-label="Pagine del blog">
      <?php for ($i = 1; $i <= $result['pages']; $i++): ?>
        <?php if ($i === $result['page']): ?>
          <span class="on"><?= $i ?></span>
        <?php else: ?>
          <a href="<?= e(url('/blog/') . ($i > 1 ? '?pagina=' . $i : '')) ?>"><?= $i ?></a>
        <?php endif; ?>
      <?php endfor; ?>
    </nav>
  <?php endif; ?>
</section>
