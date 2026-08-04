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

        $css = self::assoluti(self::minify((string) file_get_contents($file)), $path);

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

    /**
     * Riscrive in assoluto i percorsi dentro `url(...)`.
     *
     * Un `url(../font/x.woff2)` dentro un file CSS punta a partire dalla
     * cartella del CSS. Ma questo CSS finisce dentro la pagina, e lì lo stesso
     * percorso viene risolto a partire dall'indirizzo della pagina: dalla home
     * diventa `/font/x.woff2`, che non esiste. Il file non si carica e
     * l'errore si vede solo nella console del browser.
     *
     * La versione (`?v=`) è la stessa che mette `asset()`, di proposito: il
     * `<link rel=preload>` e il `@font-face` devono chiedere esattamente la
     * stessa URL, altrimenti il browser scarica il carattere due volte e il
     * preload non serve a niente.
     */
    private static function assoluti(string $css, string $cssPath): string
    {
        $cartella = trim(dirname('/assets/css/' . ltrim($cssPath, '/')), '/');

        return preg_replace_callback(
            '#url\(\s*([\'"]?)(?!data:|https?:|//|/)([^\'")]+)\1\s*\)#i',
            static function (array $m) use ($cartella): string {
                $relativo = '/' . $cartella . '/' . $m[2];
                // Normalizza i `..` senza toccare il disco.
                $pezzi = [];
                foreach (explode('/', $relativo) as $pezzo) {
                    if ($pezzo === '..') {
                        array_pop($pezzi);
                    } elseif ($pezzo !== '' && $pezzo !== '.') {
                        $pezzi[] = $pezzo;
                    }
                }

                return 'url("' . asset(implode('/', array_slice($pezzi, 1))) . '")';
            },
            $css
        ) ?? $css;
    }

    private static function cacheFile(string $sorgente): string
    {
        return MIL_ROOT . '/storage/cache/' . md5($sorgente) . '.css';
    }
}
