<?php

declare(strict_types=1);

namespace Mil\Core;

/**
 * Dove si trova un immobile, senza consegnare i visitatori a nessuno.
 *
 * Incorporare Google Maps significa uno script di terzi su ogni scheda, i
 * cookie che ne conseguono e quindi il banner: tutto ciò che questo sito
 * evita per stare a 100 e per non dover chiedere un consenso. Qui la mappa è
 * un riquadro di OpenStreetMap che si carica **solo se il visitatore lo
 * apre**, più un collegamento a Google Maps per chi vuole le indicazioni
 * stradali — che su un telefono apre direttamente l'applicazione.
 *
 * La precisione è una scelta per immobile, non una regola del sito. Molti
 * venditori non vogliono che si sappia esattamente quale casa è in vendita:
 * in modalità «zona» il segnaposto sparisce, la mappa si allarga e le
 * coordinate vengono arrotondate **prima** di uscire — anche nel JSON-LD,
 * altrimenti l'indirizzo esatto uscirebbe comunque dalla porta di servizio.
 */
final class Mappa
{
    /** Quanto si allarga il riquadro attorno al punto, in gradi. */
    private const RAGGIO_ESATTO = 0.0035;   // ~350 m per lato
    private const RAGGIO_ZONA = 0.02;       // ~2 km per lato

    /**
     * Tre decimali ≈ 110 metri: la via si riconosce, il numero civico no.
     * Due sarebbero un chilometro e mezzo, cioè una mappa inutile.
     */
    private const DECIMALI_ZONA = 3;

    /**
     * Le coordinate di un immobile, se ci sono e se hanno senso.
     *
     * @param array<string,mixed> $p
     * @return array{lat: float, lng: float, esatto: bool}|null
     */
    public static function punto(array $p): ?array
    {
        $lat = self::numero($p['lat'] ?? null);
        $lng = self::numero($p['lng'] ?? null);

        // Lo zero esatto è in mezzo all'Atlantico: è un campo vuoto scritto
        // male, non un immobile.
        if ($lat === null || $lng === null || ($lat === 0.0 && $lng === 0.0)) {
            return null;
        }
        if ($lat < -90.0 || $lat > 90.0 || $lng < -180.0 || $lng > 180.0) {
            return null;
        }

        $esatto = (string) ($p['map_mode'] ?? 'zona') === 'esatto';

        if (!$esatto) {
            $lat = round($lat, self::DECIMALI_ZONA);
            $lng = round($lng, self::DECIMALI_ZONA);
        }

        return ['lat' => $lat, 'lng' => $lng, 'esatto' => $esatto];
    }

    /**
     * L'indirizzo del riquadro OpenStreetMap. Il segnaposto c'è solo quando
     * la posizione è dichiarata esatta.
     */
    public static function osm(array $punto): string
    {
        $raggio = $punto['esatto'] ? self::RAGGIO_ESATTO : self::RAGGIO_ZONA;
        $bbox = implode(',', [
            self::g($punto['lng'] - $raggio),
            self::g($punto['lat'] - $raggio),
            self::g($punto['lng'] + $raggio),
            self::g($punto['lat'] + $raggio),
        ]);

        $url = 'https://www.openstreetmap.org/export/embed.html?bbox=' . rawurlencode($bbox) . '&layer=mapnik';
        if ($punto['esatto']) {
            $url .= '&marker=' . rawurlencode(self::g($punto['lat']) . ',' . self::g($punto['lng']));
        }

        return $url;
    }

    /** Il collegamento a Google Maps: sul telefono apre l'applicazione. */
    public static function google(array $punto): string
    {
        return 'https://www.google.com/maps/search/?api=1&query='
            . rawurlencode(self::g($punto['lat']) . ',' . self::g($punto['lng']));
    }

    /** La stessa mappa in grande, su OpenStreetMap. */
    public static function osmGrande(array $punto): string
    {
        return 'https://www.openstreetmap.org/?mlat=' . rawurlencode(self::g($punto['lat']))
            . '&mlon=' . rawurlencode(self::g($punto['lng']))
            . '#map=' . ($punto['esatto'] ? '17' : '14')
            . '/' . self::g($punto['lat']) . '/' . self::g($punto['lng']);
    }

    /**
     * Un numero scritto come lo scrive una macchina, non come lo scrive la
     * lingua italiana: la virgola decimale qui romperebbe l'indirizzo.
     */
    private static function g(float $valore): string
    {
        return rtrim(rtrim(number_format($valore, 6, '.', ''), '0'), '.');
    }

    /**
     * Accetta sia `40.35834` sia `40,35834`: nel gestionale si incolla quello
     * che si è copiato, e da Google Maps in italiano arriva con la virgola.
     */
    private static function numero(mixed $valore): ?float
    {
        $testo = trim((string) $valore);
        if ($testo === '') {
            return null;
        }

        $testo = str_replace(',', '.', $testo);

        return is_numeric($testo) ? (float) $testo : null;
    }
}
