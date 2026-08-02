<?php

/** @var array<int,array<string,mixed>> $pagine */
?>
<div class="azioni-testa">
  <p class="muto"><?= count($pagine) ?> pagine.</p>
  <a class="btn btn-primary" href="<?= e(url('/gestionale/pagine/nuova/')) ?>">+ Nuova pagina</a>
</div>

<table class="tabella">
  <thead><tr><th>Titolo</th><th>Indirizzo</th><th>Stato</th><th></th></tr></thead>
  <tbody>
  <?php foreach ($pagine as $page): ?>
    <tr>
      <td><a href="<?= e(url('/gestionale/pagine/' . $page['id'] . '/')) ?>"><?= e((string) $page['title']) ?></a></td>
      <td><code>/<?= e((string) $page['slug']) ?>/</code></td>
      <td><span class="pill pill-<?= e((string) $page['status']) ?>"><?= $page['status'] === 'published' ? 'Pubblicata' : 'Bozza' ?></span></td>
      <td class="destra">
        <?php if ($page['status'] === 'published'): ?>
          <a class="mini" href="<?= e(url('/' . $page['slug'] . '/')) ?>" target="_blank" rel="noopener">Vedi ↗</a>
        <?php endif; ?>
      </td>
    </tr>
  <?php endforeach; ?>
  </tbody>
</table>

<?php if ($pagine === []): ?><p class="vuoto">Nessuna pagina.</p><?php endif; ?>
