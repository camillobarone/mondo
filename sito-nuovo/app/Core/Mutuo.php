<?php

declare(strict_types=1);

namespace Mil\Core;

/**
 * Rata del mutuo, ammortamento alla francese.
 *
 * A differenza di `Imposte`, qui dentro non c'è nessun dato dell'agenzia e
 * nessuna aliquota da tenere aggiornata: è aritmetica e basta. La formula
 * della rata costante è la stessa da due secoli e non invecchia. L'unico
 * numero che invecchierebbe — il tasso — non sta nel codice: lo scrive chi
 * compila, prendendolo dal preventivo della banca. È voluto: un tasso di
 * esempio stampato in pagina diventa falso nel giro di qualche mese, e un
 * dato falso costa più di un campo vuoto.
 *
 * Tutti i conti si fanno in centesimi interi. In virgola mobile una rata
 * moltiplicata per 480 mesi accumula errore, e il piano di ammortamento
 * chiuderebbe con un debito residuo di qualche centesimo invece che a zero:
 * l'ultima rata assorbe l'arrotondamento e il residuo va esatto a zero.
 */
final class Mutuo
{
    /** Limiti dei campi: fuori da questi il modulo riporta dentro il valore. */
    public const ANNI_MIN = 1;
    public const ANNI_MAX = 40;
    public const TASSO_MAX = 15.0;
    public const IMPORTO_MAX = 5_000_000.0;

    /** Sotto questa cifra non è un mutuo e il conto non si fa. */
    public const IMPORTO_MIN = 1_000.0;

    /** Rate all'anno fra cui si può scegliere. */
    public const RATE_ANNO = [12 => 'Mensile', 4 => 'Trimestrale', 2 => 'Semestrale'];

    /**
     * Oltre l'80% del prezzo la banca chiede di norma garanzie in più. Non è
     * una regola di legge ma la prassi dichiarata dagli istituti, ed è la
     * ragione per cui il campo «prezzo» esiste pur non entrando nel calcolo
     * della rata: serve solo a far comparire questo avviso.
     */
    public const LTV_SOGLIA = 0.8;

    /**
     * @param array{importo:?float,anni:?int,tasso:?float,rate:int,prezzo:?float} $dati
     * @return array{
     *     rata:int, rate:array<int,array{n:int,dovuto:int,capitale:int,interessi:int,residuo:int}>,
     *     interessi:int, totale:int, numero:int, primaInteressi:int,
     *     anni:array<int,array{capitale:int,interessi:int,dovuto:int,residuo:int}>,
     *     ltv:?float, manca:string
     * }
     */
    public static function calcola(array $dati): array
    {
        $importo = $dati['importo'];
        if ($importo === null || $importo < self::IMPORTO_MIN) {
            return self::vuoto('Serve l’importo del mutuo: sotto ' . euro(self::IMPORTO_MIN) . ' il conto non ha senso.');
        }
        if ($dati['anni'] === null || $dati['anni'] < self::ANNI_MIN) {
            return self::vuoto('Serve la durata in anni, da ' . self::ANNI_MIN . ' a ' . self::ANNI_MAX . '.');
        }
        if ($dati['tasso'] === null) {
            return self::vuoto('Serve il tasso annuo (TAN): lo trovi sul preventivo della banca.');
        }
        // Nessuna periodicità di scorta: se non è una delle tre previste il
        // conto non parte. Un valore di riserva qui vorrebbe dire calcolare
        // una rata mensile a qualcuno che ne voleva una semestrale, e il
        // risultato sarebbe sbagliato senza sembrarlo.
        if (!isset(self::RATE_ANNO[$dati['rate']])) {
            return self::vuoto('Serve la periodicità della rata: mensile, trimestrale o semestrale.');
        }

        $rateAnno = $dati['rate'];
        $numero = $dati['anni'] * $rateAnno;

        // Tasso periodale: il TAN diviso il numero di rate in un anno. È la
        // convenzione dei piani di ammortamento italiani — divisione semplice,
        // non equivalenza composta — ed è quella che riproduce il numero
        // scritto sul piano che consegna la banca.
        $periodale = $dati['tasso'] / 100 / $rateAnno;

        $capitale = (int) round($importo * 100);
        $piano = self::piano($capitale, $periodale, $numero);

        $interessi = 0;
        $totale = 0;
        foreach ($piano['rate'] as $voce) {
            $interessi += $voce['interessi'];
            $totale += $voce['dovuto'];
        }

        $prezzo = $dati['prezzo'];

        return [
            'rata' => $piano['rata'],
            'rate' => $piano['rate'],
            'interessi' => $interessi,
            'totale' => $totale,
            'numero' => count($piano['rate']),
            'primaInteressi' => $piano['rate'][0]['interessi'] ?? 0,
            'anni' => self::perAnno($piano['rate'], $rateAnno),
            'ltv' => $prezzo !== null && $prezzo > 0 ? $importo / $prezzo : null,
            'manca' => '',
        ];
    }

    /**
     * La rata costante: R = C · i / (1 − (1+i)^−n).
     *
     * A tasso zero la formula si annulla al denominatore, e la rata è
     * semplicemente il capitale diviso il numero di rate. Non è un caso di
     * scuola: capita con i mutui agevolati a tasso zero.
     */
    public static function rata(int $capitale, float $periodale, int $numero): int
    {
        if ($numero <= 0) {
            return 0;
        }
        if ($periodale <= 0) {
            return (int) round($capitale / $numero);
        }

        return (int) round($capitale * $periodale / (1 - (1 + $periodale) ** -$numero));
    }

    /**
     * Il piano rata per rata, in centesimi.
     *
     * L'ultima rata non è la rata costante: è quello che resta da restituire
     * più i suoi interessi. Serve ad assorbire tutti gli arrotondamenti fatti
     * lungo la strada, altrimenti il debito residuo finale non è zero.
     *
     * @return array{rata:int,rate:array<int,array{n:int,dovuto:int,capitale:int,interessi:int,residuo:int}>}
     */
    private static function piano(int $capitale, float $periodale, int $numero): array
    {
        $rata = self::rata($capitale, $periodale, $numero);
        $residuo = $capitale;
        $rate = [];

        for ($n = 1; $n <= $numero; $n++) {
            $interessi = (int) round($residuo * $periodale);

            if ($n === $numero) {
                $quota = $residuo;
                $dovuto = $quota + $interessi;
            } else {
                $dovuto = $rata;
                $quota = $dovuto - $interessi;
                // Se la rata coprirebbe più del residuo — succede all'ultima
                // rata utile quando gli arrotondamenti hanno anticipato il
                // rimborso — si paga solo quello che manca.
                if ($quota > $residuo) {
                    $quota = $residuo;
                    $dovuto = $quota + $interessi;
                }
            }

            $residuo -= $quota;
            $rate[] = [
                'n' => $n,
                'dovuto' => $dovuto,
                'capitale' => $quota,
                'interessi' => $interessi,
                'residuo' => $residuo,
            ];

            if ($residuo <= 0) {
                break;
            }
        }

        return ['rata' => $rata, 'rate' => $rate];
    }

    /**
     * Le rate raggruppate per anno. È la vista che serve davvero a chi guarda:
     * quaranta righe si leggono, quattrocentottanta no.
     *
     * @param array<int,array{n:int,dovuto:int,capitale:int,interessi:int,residuo:int}> $rate
     * @return array<int,array{capitale:int,interessi:int,dovuto:int,residuo:int}>
     */
    private static function perAnno(array $rate, int $rateAnno): array
    {
        $anni = [];
        foreach ($rate as $indice => $voce) {
            $anno = intdiv($indice, $rateAnno);
            if (!isset($anni[$anno])) {
                $anni[$anno] = ['capitale' => 0, 'interessi' => 0, 'dovuto' => 0, 'residuo' => 0];
            }
            $anni[$anno]['capitale'] += $voce['capitale'];
            $anni[$anno]['interessi'] += $voce['interessi'];
            $anni[$anno]['dovuto'] += $voce['dovuto'];
            $anni[$anno]['residuo'] = $voce['residuo'];
        }

        return $anni;
    }

    /**
     * Il grafico a barre, disegnato in SVG dal server.
     *
     * È la parte che di solito costa una libreria JavaScript da qualche
     * decina di kilobyte. Qui sono rettangoli calcolati in PHP e stampati
     * nell'HTML: nessuna richiesta in più, e la figura c'è già quando la
     * pagina arriva invece di comparire mezzo secondo dopo.
     *
     * Le altezze sono in unità del `viewBox`, non in pixel: l'SVG si adatta
     * alla larghezza che trova e le proporzioni restano quelle.
     *
     * @param array<int,array{capitale:int,interessi:int,dovuto:int,residuo:int}> $anni
     */
    public static function grafico(array $anni): string
    {
        $massimo = 0;
        foreach ($anni as $anno) {
            $massimo = max($massimo, $anno['capitale'] + $anno['interessi']);
        }
        if ($massimo <= 0) {
            return '';
        }

        $quanti = count($anni);
        $larghezza = 640;
        $altezza = 200;
        $bordo = 6;
        $vuoto = $quanti > 25 ? 1 : 3;
        $barra = ($larghezza - $bordo * 2 - $vuoto * ($quanti - 1)) / $quanti;

        $svg = '<svg viewBox="0 0 ' . $larghezza . ' ' . ($altezza + 22) . '" preserveAspectRatio="none"'
            . ' role="img" aria-label="Composizione della rata anno per anno: la quota interessi cala, la quota capitale cresce">';

        $indice = 0;
        foreach ($anni as $anno) {
            $x = $bordo + $indice * ($barra + $vuoto);
            $hCapitale = (int) round($anno['capitale'] / $massimo * $altezza);
            $hInteressi = (int) round($anno['interessi'] / $massimo * $altezza);

            $svg .= '<rect x="' . number_format($x, 2, '.', '') . '" y="' . ($altezza - $hInteressi)
                . '" width="' . number_format($barra, 2, '.', '') . '" height="' . $hInteressi . '" class="barra-int"/>';
            $svg .= '<rect x="' . number_format($x, 2, '.', '') . '" y="' . ($altezza - $hInteressi - $hCapitale)
                . '" width="' . number_format($barra, 2, '.', '') . '" height="' . $hCapitale . '" class="barra-cap"/>';

            // Con quaranta barre le etichette si sovrappongono: si scrivono
            // solo la prima, l'ultima e una ogni cinque.
            if ($quanti <= 20 || $indice === 0 || $indice === $quanti - 1 || ($indice + 1) % 5 === 0) {
                $svg .= '<text x="' . number_format($x + $barra / 2, 2, '.', '') . '" y="' . ($altezza + 15)
                    . '" class="barra-anno" text-anchor="middle">' . ($indice + 1) . '</text>';
            }

            $indice++;
        }

        return $svg . '</svg>';
    }

    /** Riporta un numero dentro i suoi limiti invece di rifiutarlo. */
    public static function dentro(float $valore, float $min, float $max): float
    {
        return max($min, min($max, $valore));
    }

    /** @return array{rata:int,rate:array<int,array{n:int,dovuto:int,capitale:int,interessi:int,residuo:int}>,interessi:int,totale:int,numero:int,primaInteressi:int,anni:array<int,array{capitale:int,interessi:int,dovuto:int,residuo:int}>,ltv:?float,manca:string} */
    private static function vuoto(string $manca): array
    {
        return [
            'rata' => 0, 'rate' => [], 'interessi' => 0, 'totale' => 0,
            'numero' => 0, 'primaInteressi' => 0, 'anni' => [], 'ltv' => null,
            'manca' => $manca,
        ];
    }

    /** Importo in centesimi stampato in euro, con i centesimi. */
    public static function soldi(int $centesimi): string
    {
        return euro_cent($centesimi / 100);
    }

    /**
     * Importo in centesimi arrotondato all'unità: per i totali, dove i
     * centesimi sono rumore.
     *
     * Non passa da `euro()` di proposito: quella funzione legge lo zero come
     * prezzo mancante e stampa «Trattativa riservata». Su un immobile è
     * giusto, qui no — a tasso zero gli interessi totali sono zero, ed è una
     * risposta, non un dato che manca.
     */
    public static function tondi(int $centesimi): string
    {
        return '€ ' . number_format(round($centesimi / 100), 0, ',', '.');
    }

    /** «78,3%» da 0.783. */
    public static function percentuale(float $quota): string
    {
        return number_format($quota * 100, 1, ',', '.') . '%';
    }
}
