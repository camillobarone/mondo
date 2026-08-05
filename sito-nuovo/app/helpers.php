<?php

declare(strict_types=1);

use Mil\Core\Config;

/** Escape per output HTML. Da usare su OGNI variabile stampata in un template. */
function e(?string $value): string
{
    return htmlspecialchars($value ?? '', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** URL assoluto a partire da un percorso interno. */
function url(string $path = '/'): string
{
    $base = rtrim((string) Config::get('base_url'), '/');
    return $base . '/' . ltrim($path, '/');
}

/** URL di un asset con cache-busting sul mtime del file. */
function asset(string $path): string
{
    $rel = '/assets/' . ltrim($path, '/');
    $file = MIL_PUBLIC . $rel;
    $version = is_file($file) ? (string) filemtime($file) : '1';
    return url($rel) . '?v=' . $version;
}

/**
 * Rende assoluti i percorsi dentro un `srcset`.
 *
 * A database stanno relativi (`/uploads/…-960.webp 960w`), in pagina devono
 * essere risolvibili anche quando il sito vive in una sottocartella.
 */
function srcset_url(string $srcset): string
{
    $pezzi = [];
    foreach (explode(',', $srcset) as $voce) {
        $voce = trim($voce);
        if ($voce === '') {
            continue;
        }
        [$percorso, $larghezza] = array_pad(preg_split('/\s+/', $voce, 2) ?: [], 2, '');
        $pezzi[] = url($percorso) . ($larghezza !== '' ? ' ' . $larghezza : '');
    }

    return implode(', ', $pezzi);
}

/**
 * Favicon come data URI: una casa nei colori dell'agenzia, disegnata in SVG.
 *
 * Sta dentro l'HTML per due motivi. Il primo è che risparmia una richiesta.
 * Il secondo è che senza un `rel="icon"` dichiarato il browser va a cercare
 * `/favicon.ico` per conto suo, non lo trova e scrive un 404 in console:
 * un errore che Lighthouse conta, e che nessuno vede finché non lo misura.
 */
function favicon_svg(): string
{
    $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
        // Il blu del logo, non i colori delle pagine: la favicon segue il
        // marchio. Casa bianca su fondo blu e non il contrario, perché a
        // 16 pixel un quadrato bianco sparisce nella barra delle linguette,
        // che bianca lo è quasi sempre. Bianco su #1b82d8 sta a 4,0:1,
        // sopra il 3:1 che serve a una forma piena.
        . '<rect width="32" height="32" rx="7" fill="#1b82d8"/>'
        . '<path d="M5 15.6 16 6.4l11 9.2v1.9h-2.6V26h-5.6v-6.6h-5.6V26H7.6v-8.5H5z" fill="#fff"/>'
        . '</svg>';

    return 'data:image/svg+xml,' . strtr(rawurlencode($svg), ['%2F' => '/', '%3A' => ':', '%20' => ' ']);
}

/**
 * Preload dell'immagine più grande della pagina (la candidata LCP).
 *
 * Senza, il browser la scopre solo quando ha finito di leggere l'HTML e di
 * costruire il layout. Con `imagesrcset` sceglie subito la stessa variante
 * che sceglierebbe poi il tag `<img>`: se le due `sizes` non coincidono si
 * finisce a scaricarne due, quindi vanno tenute identiche.
 */
function preload_image(string $src, string $srcset = '', string $sizes = ''): string
{
    if (trim($src) === '') {
        return '';
    }

    $tag = '<link rel="preload" as="image" fetchpriority="high" href="' . e(url($src)) . '"';
    if ($srcset !== '') {
        $tag .= ' imagesrcset="' . e(srcset_url($srcset)) . '"';
        if ($sizes !== '') {
            $tag .= ' imagesizes="' . e($sizes) . '"';
        }
    }

    return $tag . '>';
}

/** Prezzo in euro, formato italiano. Null o 0 => "Trattativa riservata". */
function euro(?float $value, string $fallback = 'Trattativa riservata'): string
{
    if ($value === null || $value <= 0.0) {
        return $fallback;
    }
    return '€ ' . number_format($value, 0, ',', '.');
}

/** Data in formato italiano esteso. */
function data_it(?string $sqlDate, bool $withTime = false): string
{
    if (!$sqlDate) {
        return '';
    }
    $ts = strtotime($sqlDate);
    if ($ts === false) {
        return '';
    }
    $mesi = [1 => 'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
        'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
    $out = date('j', $ts) . ' ' . $mesi[(int) date('n', $ts)] . ' ' . date('Y', $ts);
    return $withTime ? $out . ', ' . date('H:i', $ts) : $out;
}

/** Slug URL-safe da una stringa libera. */
function slugify(string $text): string
{
    $text = str_replace(
        ['à', 'á', 'è', 'é', 'ì', 'í', 'ò', 'ó', 'ù', 'ú', "'", '’'],
        ['a', 'a', 'e', 'e', 'i', 'i', 'o', 'o', 'u', 'u', '-', '-'],
        mb_strtolower($text)
    );
    $text = preg_replace('/[^a-z0-9]+/', '-', $text) ?? '';
    return trim($text, '-');
}

/**
 * Troncamento a parole intere.
 *
 * Passa da `Testo::piano()` perché quasi tutti i troncamenti finiscono in una
 * meta description o in un'anteprima: lì i `##` e gli asterischi del testo
 * scritto in chat non formattano niente, occupano solo caratteri.
 */
function tronca(string $text, int $max = 160): string
{
    $text = \Mil\Core\Testo::piano($text);
    $text = trim(preg_replace('/\s+/', ' ', strip_tags($text)) ?? '');
    if (mb_strlen($text) <= $max) {
        return $text;
    }
    $cut = mb_substr($text, 0, $max);
    $lastSpace = mb_strrpos($cut, ' ');
    return rtrim($lastSpace !== false ? mb_substr($cut, 0, $lastSpace) : $cut, ' ,.;:') . '…';
}

/** Valore da $_GET con default e trim. */
function q(string $key, string $default = ''): string
{
    $v = $_GET[$key] ?? $default;
    return is_string($v) ? trim($v) : $default;
}

/** Valore intero da $_GET/$_POST. */
function int_or_null(mixed $value): ?int
{
    if ($value === null || $value === '' || !is_scalar($value)) {
        return null;
    }
    return (int) $value;
}

/** Float da input italiano ("180.000,50" => 180000.5). */
function float_or_null(mixed $value): ?float
{
    if ($value === null || $value === '' || !is_scalar($value)) {
        return null;
    }
    $clean = str_replace(['.', ' ', '€'], '', (string) $value);
    $clean = str_replace(',', '.', $clean);
    return is_numeric($clean) ? (float) $clean : null;
}
