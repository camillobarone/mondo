<?php

/** @var array{items:array<int,array<string,mixed>>,total:int,pages:int,page:int} $result */
?>
<div class="azioni-testa">
  <p class="muto"><?= (int) $result['total'] ?> articoli.</p>
  <a class="btn btn-primary" href="<?= e(url('/gestionale/articoli/nuovo/')) ?>">+ Nuovo articolo</a>
</div>

<table class="tabella">
  <thead><tr><th>Titolo</th><th>Autore</th><th>Stato</th><th>Data</th><th></th></tr></thead>
  <tbody>
  <?php foreach ($result['items'] as $post): ?>
    <tr>
      <td><a href="<?= e(url('/gestionale/articoli/' . $post['id'] . '/')) ?>"><?= e((string) $post['title']) ?></a><br>
        <small><code>/<?= e((string) $post['slug']) ?>/</code></small></td>
      <td><?= e((string) ($post['author_name'] ?? '—')) ?></td>
      <td><span class="pill pill-<?= e((string) $post['status']) ?>"><?= $post['status'] === 'published' ? 'Pubblicato' : 'Bozza' ?></span></td>
      <td><?= e(data_it((string) ($post['published_at'] ?: $post['created_at']))) ?></td>
      <td class="destra">
        <?php if ($post['status'] === 'published'): ?>
          <a class="mini" href="<?= e(url('/' . $post['slug'] . '/')) ?>" target="_blank" rel="noopener">Vedi ↗</a>
        <?php endif; ?>
      </td>
    </tr>
  <?php endforeach; ?>
  </tbody>
</table>

<?php if ($result['items'] === []): ?><p class="vuoto">Nessun articolo.</p><?php endif; ?>
