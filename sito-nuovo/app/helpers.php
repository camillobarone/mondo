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

/** Troncamento a parole intere. */
function tronca(string $text, int $max = 160): string
{
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
