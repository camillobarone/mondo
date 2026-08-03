<?php

declare(strict_types=1);

namespace Mil\Core;

/**
 * Il CSS del sito pubblico viaggia dentro la pagina, non in un file a parte.
 *
 * Un `<link rel=stylesheet>` blocca il primo disegno: il browser scarica
 * l'HTML, trova il link, apre una seconda richiesta e aspetta. Su rete mobile
 * quel giro vale più dei byte che si risparmierebbero mettendo in cache il
 * file. Dodici KB minificati diventano tre e mezzo compressi: meno di quanto
 * costi il round trip che si evita.
 *
 * Il risultato è tenuto in memoria per la durata della richiesta e su disco
 * fra una richiesta e l'altra, così la minificazione avviene una volta sola
 * finché il sorgente non cambia.
 */
final class Assets
{
    /**
     * Attributo `sizes` delle schede in griglia. Sta qui, e non nel template,
     * perché lo stesso valore serve al `<img>` e al preload della prima
     * immagine: se i due non coincidono il browser ne scarica due.
     */
    public const SIZES_CARD = '(max-width: 700px) 100vw, 360px';

    /** `sizes` della foto grande nella scheda immobile. */
    public const SIZES_GALLERIA = '(max-width: 1180px) 100vw, 1100px';

    /** `sizes` delle foto piccole sotto quella grande: quattro per riga, due su telefono. */
    public const SIZES_GALLERIA_MINI = '(max-width: 700px) 50vw, 270px';

    /** @var array<string,string> */
    private static array $memoria = [];

    /** CSS pronto da mettere dentro un tag <style>. */
    public static function css(string $path): string
    {
        $file = MIL_PUBLIC . '/assets/css/' . ltrim($path, '/');

        if (isset(self::$memoria[$file])) {
            return self::$memoria[$file];
        }
        if (!is_file($file)) {
            return '';
        }

        $cache = self::cacheFile($file);
        if (is_file($cache) && filemtime($cache) >= filemtime($file)) {
            return self::$memoria[$file] = (string) file_get_contents($cache);
        }

        $css = self::minify((string) file_get_contents($file));

        // Se la cartella di cache non è scrivibile si tira dritto lo stesso:
        // la minificazione costa poco, è la ripetizione che conviene evitare.
        if (is_dir(dirname($cache)) || @mkdir(dirname($cache), 0775, true)) {
            @file_put_contents($cache, $css);
        }

        return self::$memoria[$file] = $css;
    }

    /**
     * Minificazione prudente: toglie commenti e spazi inutili, non riscrive
     * nulla. Nessuna regola viene accorpata o riordinata, così il CSS che
     * arriva al browser resta quello che si legge nel sorgente.
     */
    public static function minify(string $css): string
    {
        $css = preg_replace('#/\*(?!!).*?\*/#s', '', $css) ?? $css;
        $css = preg_replace('/\s+/', ' ', $css) ?? $css;
        // `+` e `~` restano fuori di proposito: stringere gli spazi attorno a
        // un `+` rompe `calc(100% + 10px)`, e i due spazi che si risparmiano
        // non valgono il rischio di scoprirlo in produzione.
        $css = preg_replace('/\s*([{}:;,>])\s*/', '$1', $css) ?? $css;
        // `and(` non è valido: le media query hanno bisogno dello spazio.
        $css = str_replace(['and(', 'not(', ';}'], [' and (', ' not (', '}'], $css);

        return trim($css);
    }

    private static function cacheFile(string $sorgente): string
    {
        return MIL_ROOT . '/storage/cache/' . md5($sorgente) . '.css';
    }
}
