<?php

declare(strict_types=1);

namespace Mil\Core;

/**
 * Le domande frequenti di un immobile, scritte in un riquadro solo.
 *
 * Il testo arriva quasi sempre incollato da una chat, e nessuno ha voglia di
 * copiare sei domande e sei risposte in dodici caselle diverse. Quindi si
 * incolla il blocco intero e ci pensa questa classe a riconoscere le coppie:
 * una domanda, la sua risposta, una riga vuota, avanti la prossima.
 *
 * Sono ammesse le forme che escono davvero da una conversazione — grassetti
 * `**così**`, trattini a inizio riga, prefissi `D:` e `R:`, domanda e risposta
 * separate da una riga vuota invece che attaccate — perché l'alternativa è
 * chiedere a chi scrive di ripulire il testo a mano, e non succederebbe.
 */
final class Faq
{
    /** Oltre questi limiti non è più una FAQ: è un articolo nel posto sbagliato. */
    private const MAX_COPPIE = 20;
    private const MAX_DOMANDA = 300;
    private const MAX_RISPOSTA = 2000;

    /**
     * Riconosce le coppie domanda/risposta dentro un testo libero.
     *
     * @return array<int,array{q:string,a:string}>
     */
    public static function parse(string $testo): array
    {
        $testo = str_replace(["\r\n", "\r"], "\n", trim($testo));
        if ($testo === '') {
            return [];
        }

        $righe = array_map([self::class, 'ripulisci'], explode("\n", $testo));

        // Se nel testo c'è almeno una riga che finisce col punto interrogativo,
        // sono quelle le domande e nient'altro. La scorciatoia «la prima riga
        // utile è una domanda» resta per chi le scrive senza punto, ma non deve
        // trasformare in FAQ il paragrafo di introduzione di un testo normale.
        $conInterrogativo = false;
        foreach ($righe as $riga) {
            if (str_ends_with($riga, '?')) {
                $conInterrogativo = true;
                break;
            }
        }

        $coppie = [];
        $domanda = null;
        /** @var array<int,string> $risposta */
        $risposta = [];

        $chiudi = static function () use (&$coppie, &$domanda, &$risposta): void {
            if ($domanda === null) {
                return;
            }
            $testoRisposta = trim(implode("\n", $risposta));
            if ($testoRisposta !== '') {
                $coppie[] = [
                    'q' => mb_substr($domanda, 0, self::MAX_DOMANDA),
                    'a' => mb_substr($testoRisposta, 0, self::MAX_RISPOSTA),
                ];
            }
            $domanda = null;
            $risposta = [];
        };

        foreach (explode("\n", $testo) as $i => $riga) {
            $pulita = $righe[$i];

            if ($pulita === '') {
                continue;
            }

            if (self::eDomanda($riga, $pulita, $domanda === null && !$conInterrogativo)) {
                // Una domanda nuova chiude quella prima, con la sua risposta.
                $chiudi();
                $domanda = $pulita;
                continue;
            }

            if ($domanda === null) {
                // Testo prima della prima domanda: non è una FAQ, si scarta.
                continue;
            }

            $risposta[] = $pulita;
        }

        $chiudi();

        return array_slice($coppie, 0, self::MAX_COPPIE);
    }

    /**
     * Rimette le coppie nella forma con cui si scrivono: domanda, risposta,
     * riga vuota. Serve a ricaricare il riquadro quando si riapre la scheda,
     * e a far sì che salvare due volte di seguito non cambi niente.
     *
     * @param array<int,array{q:string,a:string}> $coppie
     */
    public static function testo(array $coppie): string
    {
        $blocchi = array_map(
            static fn (array $c): string => $c['q'] . "\n" . $c['a'],
            $coppie
        );

        return implode("\n\n", $blocchi);
    }

    /** @param array<int,array{q:string,a:string}> $coppie */
    public static function json(array $coppie): string
    {
        if ($coppie === []) {
            return '';
        }

        return (string) json_encode($coppie, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    /**
     * Rilegge la colonna del database. Tollera il vuoto e il non-JSON: una
     * scheda non deve andare in errore per un campo scritto male.
     *
     * @return array<int,array{q:string,a:string}>
     */
    public static function daJson(mixed $valore): array
    {
        $grezzo = trim((string) ($valore ?? ''));
        if ($grezzo === '') {
            return [];
        }

        $dati = json_decode($grezzo, true);
        if (!is_array($dati)) {
            return [];
        }

        $coppie = [];
        foreach ($dati as $riga) {
            if (!is_array($riga)) {
                continue;
            }
            $q = trim((string) ($riga['q'] ?? ''));
            $a = trim((string) ($riga['a'] ?? ''));
            if ($q !== '' && $a !== '') {
                $coppie[] = ['q' => $q, 'a' => $a];
            }
        }

        return array_slice($coppie, 0, self::MAX_COPPIE);
    }

    /**
     * Toglie dalla riga la punteggiatura che serviva solo a impaginarla nella
     * chat: asterischi del grassetto, cancelletti del titolo, trattini
     * dell'elenco, prefissi `D:` / `R:` / `Domanda:` / `Risposta:`.
     */
    private static function ripulisci(string $riga): string
    {
        $riga = trim($riga);
        $riga = preg_replace('/^#{1,6}\s*/u', '', $riga) ?? $riga;
        $riga = preg_replace('/^[-*•]\s+/u', '', $riga) ?? $riga;
        $riga = preg_replace('/^\d+[.)]\s+/u', '', $riga) ?? $riga;
        $riga = preg_replace('/^(?:D|R|Q|A|Domanda|Risposta)\s*[:.)]\s*/ui', '', $riga) ?? $riga;
        $riga = trim($riga, " \t*_");

        return trim($riga);
    }

    /**
     * Decide se la riga apre una domanda.
     *
     * Il punto interrogativo è il segnale principale, ed è quello che si trova
     * in pratica su ogni FAQ scritta in italiano. Restano due scorciatoie per
     * chi scrive senza: il prefisso `D:` esplicito, e la prima riga utile del
     * testo — quest'ultima solo quando in tutto il testo non c'è nemmeno un
     * punto interrogativo, altrimenti una FAQ scritta bene si porterebbe
     * dietro come domanda la prima riga di un'introduzione.
     */
    private static function eDomanda(string $originale, string $pulita, bool $primaSenzaInterrogativi): bool
    {
        if (str_ends_with($pulita, '?')) {
            return true;
        }
        if (preg_match('/^\s*(?:D|Q|Domanda)\s*[:.)]/ui', $originale) === 1) {
            return true;
        }

        return $primaSenzaInterrogativi;
    }
}
