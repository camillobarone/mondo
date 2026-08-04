<?php

/**
 * @var array<string,mixed> $post
 * @var array<int,array<string,mixed>> $autori
 */

use Mil\Core\Csrf;

$isNew = (int) $post['id'] === 0;
?>
<form method="post" class="form">
  <?= Csrf::field() ?>
  <div class="due-colonne">
    <div class="pannello">
      <h2>Contenuto</h2>
      <label>Titolo<input type="text" name="title" value="<?= e((string) $post['title']) ?>" required maxlength="191"></label>
      <label>Slug
        <input type="text" name="slug" value="<?= e((string) $post['slug']) ?>" placeholder="generato dal titolo">
        <small>Cambiandolo viene creato in automatico un 301 dal vecchio indirizzo.</small>
      </label>
      <label>Risposta diretta <small>40–50 parole, è il paragrafo che i motori citano</small>
        <textarea name="excerpt" rows="3" maxlength="1000"><?= e((string) $post['excerpt']) ?></textarea>
      </label>
      <label>Testo
        <textarea name="body" rows="20"><?= e((string) $post['body']) ?></textarea>
        <small>Si incolla com’è scritto in chat: riga vuota fra i paragrafi,
          <code>##</code> davanti a un sottotitolo, <code>-</code> davanti a una
          voce di elenco, <code>**parola**</code> per il grassetto,
          <code>[testo](indirizzo)</code> per un collegamento. In pagina
          diventano sottotitoli, elenchi e grassetto veri.</small>
      </label>
    </div>

    <div>
      <div class="pannello">
        <h2>Pubblicazione</h2>
        <label>Stato
          <select name="status">
            <option value="draft" <?= $post['status'] === 'draft' ? 'selected' : '' ?>>Bozza</option>
            <option value="published" <?= $post['status'] === 'published' ? 'selected' : '' ?>>Pubblicato</option>
          </select>
        </label>
        <label>Autore
          <select name="author_id">
            <option value="">—</option>
            <?php foreach ($autori as $a): ?>
              <option value="<?= (int) $a['id'] ?>" <?= (int) $post['author_id'] === (int) $a['id'] ? 'selected' : '' ?>><?= e((string) $a['name']) ?></option>
            <?php endforeach; ?>
          </select>
          <small>Un cluster tematico, un autore: è così che si costruisce autorevolezza.</small>
        </label>
        <label>Immagine di copertina (URL)
          <input type="text" name="cover" value="<?= e((string) $post['cover']) ?>">
        </label>
        <button class="btn btn-primary largo"><?= $isNew ? 'Crea articolo' : 'Salva' ?></button>
      </div>

      <div class="pannello">
        <h2>SEO</h2>
        <label>SEO title <small>max 60</small>
          <input type="text" name="seo_title" maxlength="60" value="<?= e((string) $post['seo_title']) ?>">
        </label>
        <label>Meta description <small>max 160</small>
          <textarea name="seo_description" rows="3" maxlength="160"><?= e((string) $post['seo_description']) ?></textarea>
        </label>
      </div>
    </div>
  </div>
</form>

<?php if (!$isNew): ?>
<div class="pannello pannello-pericolo">
  <h2>Elimina</h2>
  <form method="post" action="<?= e(url('/gestionale/articoli/' . $post['id'] . '/elimina/')) ?>"
        onsubmit="return confirm('Eliminare questo articolo?')">
    <?= Csrf::field() ?>
    <button class="btn btn-danger">Elimina articolo</button>
  </form>
</div>
<?php endif; ?>
