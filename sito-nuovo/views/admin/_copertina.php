<?php

/**
 * Il campo immagine di copertina, uguale per articoli e pagine.
 *
 * @var array<string,mixed> $item
 */
?>
<label>Immagine di copertina
  <input type="file" name="cover_file" accept="image/jpeg,image/png,image/webp">
  <small>Si vede in cima alla pagina, ed è l’anteprima quando il link finisce
    su WhatsApp o Facebook. Massimo 12 MB: al ridimensionamento pensa il
    programma, che ne ricava tre misure e le converte in WebP.</small>
</label>

<?php if (trim((string) ($item['cover'] ?? '')) !== ''): ?>
  <div class="copertina-attuale">
    <img src="<?= e(url((string) $item['cover'])) ?>" alt="">
    <label class="check">
      <input type="checkbox" name="cover_togli" value="1"> Togli questa immagine
    </label>
  </div>
<?php endif; ?>

<label>Descrizione dell’immagine
  <input type="text" name="cover_alt" maxlength="255"
         value="<?= e((string) ($item['cover_alt'] ?? '')) ?>"
         placeholder="se lasci vuoto si usa il titolo">
  <small>La legge chi non vede l’immagine, e Google. Per un ritratto basta il
    nome; per la foto di una zona conviene dire cosa si vede.</small>
</label>
