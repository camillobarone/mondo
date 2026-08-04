<?php

/** @var array<string,mixed> $page */

use Mil\Core\Csrf;

$isNew = (int) $page['id'] === 0;
?>
<form method="post" class="form">
  <?= Csrf::field() ?>
  <div class="due-colonne">
    <div class="pannello">
      <h2>Contenuto</h2>
      <label>Titolo<input type="text" name="title" value="<?= e((string) $page['title']) ?>" required maxlength="191"></label>
      <label>Slug
        <input type="text" name="slug" value="<?= e((string) $page['slug']) ?>" placeholder="generato dal titolo">
        <small>La pagina risponde su <code>/slug/</code>. Cambiandolo viene creato un 301.</small>
      </label>
      <label>Testo<textarea name="body" rows="20"><?= e((string) $page['body']) ?></textarea>
        <small>Riga vuota fra i paragrafi, <code>##</code> per un sottotitolo,
          <code>-</code> per un elenco, <code>**parola**</code> per il grassetto.</small>
      </label>
    </div>

    <div>
      <div class="pannello">
        <h2>Pubblicazione</h2>
        <label>Stato
          <select name="status">
            <option value="published" <?= $page['status'] === 'published' ? 'selected' : '' ?>>Pubblicata</option>
            <option value="draft" <?= $page['status'] === 'draft' ? 'selected' : '' ?>>Bozza</option>
          </select>
        </label>
        <button class="btn btn-primary largo"><?= $isNew ? 'Crea pagina' : 'Salva' ?></button>
      </div>

      <div class="pannello">
        <h2>SEO</h2>
        <label>SEO title <small>max 60</small>
          <input type="text" name="seo_title" maxlength="60" value="<?= e((string) $page['seo_title']) ?>">
        </label>
        <label>Meta description <small>max 160</small>
          <textarea name="seo_description" rows="3" maxlength="160"><?= e((string) $page['seo_description']) ?></textarea>
        </label>
      </div>
    </div>
  </div>
</form>

<?php if (!$isNew): ?>
<div class="pannello pannello-pericolo">
  <h2>Elimina</h2>
  <form method="post" action="<?= e(url('/gestionale/pagine/' . $page['id'] . '/elimina/')) ?>"
        onsubmit="return confirm('Eliminare questa pagina?')">
    <?= Csrf::field() ?>
    <button class="btn btn-danger">Elimina pagina</button>
  </form>
</div>
<?php endif; ?>
