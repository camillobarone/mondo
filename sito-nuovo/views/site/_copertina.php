<?php

/**
 * L'immagine di copertina di una pagina o di un articolo.
 *
 * @var array<string,mixed> $item  la riga della pagina o dell'articolo
 *
 * `width` e `height` si stampano sempre: senza, il browser non sa quanto
 * spazio riservare e il testo sotto sobbalza quando la foto arriva. È metà
 * del punteggio di stabilità visiva, e si paga con due attributi.
 */

$copertina = trim((string) ($item['cover'] ?? ''));
if ($copertina === '') {
    return;
}

// Chi non vede l'immagine legge questo. Se nessuno l'ha scritto vale il
// titolo: per il ritratto di un agente è già la cosa giusta.
$descrizione = trim((string) ($item['cover_alt'] ?? '')) ?: (string) $item['title'];
?>
<figure class="copertina">
  <img src="<?= e(url($copertina)) ?>"
       <?php if (($item['cover_srcset'] ?? '') !== ''): ?>
       srcset="<?= e(srcset_url((string) $item['cover_srcset'])) ?>"
       sizes="(min-width: 1100px) 1040px, 100vw"
       <?php endif; ?>
       alt="<?= e($descrizione) ?>"
       <?php if ((int) ($item['cover_width'] ?? 0) > 0): ?>
       width="<?= (int) $item['cover_width'] ?>" height="<?= (int) $item['cover_height'] ?>"
       <?php endif; ?>
       loading="eager" fetchpriority="high" decoding="async">
</figure>
