<?php

declare(strict_types=1);

namespace Mil\Core;

use Mil\Repo\Content;

/**
 * Le pagine che per legge devono essere raggiungibili da tutto il sito.
 *
 * Gli indirizzi sono quelli del sito vecchio, non nuovi: chi ha salvato
 * l'informativa, o chi la trova indicizzata, deve ritrovarla allo stesso
 * posto. Sono scritti qui e non nel modello perché li nomina anche il
 * gestionale, che avvisa quando manca.
 */
final class Legali
{
    /** @var array<string,string> indirizzo => come si chiama nel piè di pagina */
    public const PAGINE = [
        'informativa-sulla-privacy-e-sulluso-dei-dati-di-mondo-immobiliare' => 'Privacy',
        'cookie-policy' => 'Cookie',
    ];

    /**
     * Solo quelle che esistono davvero.
     *
     * @return array<string,string>
     */
    public static function presenti(): array
    {
        return array_filter(
            self::PAGINE,
            static fn (string $slug): bool => Content::pagePubblicata($slug),
            ARRAY_FILTER_USE_KEY
        );
    }

    /**
     * Quelle che ancora non ci sono. Il gestionale lo dice in chiaro invece
     * di lasciare che se ne accorga qualcun altro.
     *
     * @return array<string,string>
     */
    public static function mancanti(): array
    {
        return array_diff_key(self::PAGINE, self::presenti());
    }
}
