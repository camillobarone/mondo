<?php

declare(strict_types=1);

namespace Mil\Core;

/**
 * Imposte sull'acquisto di una casa.
 *
 * Le aliquote e i coefficienti non sono stati ricavati altrove: sono quelli
 * pubblicati e mantenuti dall'agenzia sulla guida «Imposte Acquisto Casa»
 * (mondoimmobiliarelecce.it/imposte-acquisto-casa/, aggiornata il 6/7/2026),
 * che a sua volta cita Agenzia delle Entrate e Consiglio Nazionale del
 * Notariato. Tenerli qui in costanti, con la fonte scritta accanto, serve a
 * una cosa sola: quando la guida cambierà, si saprà esattamente quali numeri
 * toccare, e saranno gli stessi in pagina e nel calcolo.
 *
 * Cosa NON c'è dentro, di proposito: onorario del notaio, imposta di bollo,
 * tassa ipotecaria, provvigione. Non stanno nella guida, e mettere qui un
 * numero che l'agenzia non ha pubblicato significherebbe inventarlo.
 */
final class Imposte
{
    /** Coefficienti già comprensivi della rivalutazione del 5% della rendita. */
    public const COEFF_PRIMA = 115.5;
    public const COEFF_SECONDA = 126.0;

    /** Acquisto da privato: registro proporzionale sul valore catastale. */
    public const REGISTRO_PRIMA = 0.02;
    public const REGISTRO_SECONDA = 0.09;
    public const REGISTRO_MINIMO = 1000.0;
    public const FISSA_PRIVATO = 50.0;

    /** Acquisto da impresa con IVA: IVA sul prezzo, il resto in misura fissa. */
    public const IVA_PRIMA = 0.04;
    public const IVA_SECONDA = 0.10;
    public const IVA_LUSSO = 0.22;
    public const FISSA_IMPRESA = 200.0;

    /**
     * @param array{prima:bool,impresa:bool,lusso:bool,rendita:?float,prezzo:?float} $dati
     * @return array{
     *     voci:array<int,array{nome:string,importo:float,dettaglio:string}>,
     *     totale:float, base:?float, baseNome:string, manca:string
     * }
     */
    public static function calcola(array $dati): array
    {
        return $dati['impresa'] ? self::conIva($dati) : self::conRegistro($dati);
    }

    /**
     * Acquisto da privato. La base imponibile è il valore catastale, non il
     * prezzo: è la regola del prezzo-valore, ed è la ragione per cui in questa
     * pagina si chiede la rendita e non quanto si è offerto.
     *
     * @param array{prima:bool,impresa:bool,lusso:bool,rendita:?float,prezzo:?float} $dati
     * @return array{voci:array<int,array{nome:string,importo:float,dettaglio:string}>,totale:float,base:?float,baseNome:string,manca:string}
     */
    private static function conRegistro(array $dati): array
    {
        $rendita = $dati['rendita'];
        if ($rendita === null || $rendita <= 0) {
            return self::vuoto('Serve la rendita catastale: la trovi nella visura o nell’atto di provenienza.');
        }

        $coefficiente = $dati['prima'] ? self::COEFF_PRIMA : self::COEFF_SECONDA;
        $aliquota = $dati['prima'] ? self::REGISTRO_PRIMA : self::REGISTRO_SECONDA;

        $valore = $rendita * $coefficiente;
        $registro = max($valore * $aliquota, self::REGISTRO_MINIMO);

        $dettaglioRegistro = self::percentuale($aliquota) . ' di ' . euro($valore);
        if ($registro > $valore * $aliquota) {
            $dettaglioRegistro .= ' è sotto il minimo di legge, quindi si paga il minimo';
        }

        $voci = [
            [
                'nome' => 'Imposta di registro',
                'importo' => $registro,
                'dettaglio' => $dettaglioRegistro,
            ],
            ['nome' => 'Imposta ipotecaria', 'importo' => self::FISSA_PRIVATO, 'dettaglio' => 'importo fisso'],
            ['nome' => 'Imposta catastale', 'importo' => self::FISSA_PRIVATO, 'dettaglio' => 'importo fisso'],
        ];

        return [
            'voci' => $voci,
            'totale' => array_sum(array_column($voci, 'importo')),
            'base' => $valore,
            'baseNome' => 'Valore catastale — rendita ' . euro($rendita) . ' × ' . self::numero($coefficiente),
            'manca' => '',
        ];
    }

    /**
     * Acquisto da impresa costruttrice. Qui la base è il prezzo dichiarato e
     * il registro non è più proporzionale: diventa fisso come le altre due.
     *
     * @param array{prima:bool,impresa:bool,lusso:bool,rendita:?float,prezzo:?float} $dati
     * @return array{voci:array<int,array{nome:string,importo:float,dettaglio:string}>,totale:float,base:?float,baseNome:string,manca:string}
     */
    private static function conIva(array $dati): array
    {
        $prezzo = $dati['prezzo'];
        if ($prezzo === null || $prezzo <= 0) {
            return self::vuoto('Serve il prezzo dichiarato: con l’IVA le imposte si calcolano su quello, non sulla rendita.');
        }

        if ($dati['lusso']) {
            $aliquota = self::IVA_LUSSO;
        } else {
            $aliquota = $dati['prima'] ? self::IVA_PRIMA : self::IVA_SECONDA;
        }

        $voci = [
            [
                'nome' => 'IVA',
                'importo' => $prezzo * $aliquota,
                'dettaglio' => self::percentuale($aliquota) . ' di ' . euro($prezzo),
            ],
            ['nome' => 'Imposta di registro', 'importo' => self::FISSA_IMPRESA, 'dettaglio' => 'importo fisso'],
            ['nome' => 'Imposta ipotecaria', 'importo' => self::FISSA_IMPRESA, 'dettaglio' => 'importo fisso'],
            ['nome' => 'Imposta catastale', 'importo' => self::FISSA_IMPRESA, 'dettaglio' => 'importo fisso'],
        ];

        return [
            'voci' => $voci,
            'totale' => array_sum(array_column($voci, 'importo')),
            'base' => $prezzo,
            'baseNome' => 'Prezzo dichiarato nell’atto',
            'manca' => '',
        ];
    }

    /** @return array{voci:array<int,array{nome:string,importo:float,dettaglio:string}>,totale:float,base:?float,baseNome:string,manca:string} */
    private static function vuoto(string $manca): array
    {
        return ['voci' => [], 'totale' => 0.0, 'base' => null, 'baseNome' => '', 'manca' => $manca];
    }

    /**
     * Importo con i centesimi: «€ 1.732,50» è la cifra che il notaio
     * scriverà, «€ 1.733» no. Da quando serve anche al calcolo della rata del
     * mutuo la formattazione vive in `euro_cent()`; questo nome resta perché
     * lo usa già la pagina delle imposte.
     */
    public static function soldi(float $importo): string
    {
        return euro_cent($importo);
    }

    /** «2%» invece di «0.02». */
    private static function percentuale(float $aliquota): string
    {
        return self::numero($aliquota * 100) . '%';
    }

    /** Numero all'italiana, senza decimali inutili: 115,5 e 126, non 115,50 e 126,00. */
    private static function numero(float $valore): string
    {
        return rtrim(rtrim(number_format($valore, 2, ',', '.'), '0'), ',');
    }
}
