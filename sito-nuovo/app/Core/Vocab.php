<?php

declare(strict_types=1);

namespace Mil\Core;

/**
 * Vocabolari chiusi dell'applicazione. Sono gli stessi assi con cui il sito
 * attuale classifica gli immobili (tipologia, contratto, comune, stato):
 * tenerli allineati rende diretta l'importazione dal WordPress esistente.
 */
final class Vocab
{
    public const CONTRACTS = [
        'vendita' => 'Vendita',
        'affitto' => 'Affitto',
    ];

    public const TYPES = [
        'appartamento' => 'Appartamento',
        'bilocale' => 'Bilocale',
        'trilocale' => 'Trilocale',
        'quadrilocale' => 'Quadrilocale',
        'attico' => 'Attico',
        'villa' => 'Villa',
        'villetta' => 'Villetta',
        'casa-indipendente' => 'Casa indipendente',
        'masseria' => 'Masseria',
        'nuda-proprieta' => 'Nuda proprietà',
        'terreno' => 'Terreno',
        'locale-commerciale' => 'Locale commerciale',
    ];

    /** Stato dell'annuncio nel gestionale. Solo `published` è visibile online. */
    public const STATUSES = [
        'draft' => 'Bozza',
        'published' => 'Pubblicato',
        'reserved' => 'Sotto proposta',
        'sold' => 'Venduto',
        'archived' => 'Archiviato',
    ];

    public const CONDITIONS = [
        'nuovo' => 'Nuovo / in costruzione',
        'ristrutturato' => 'Ristrutturato',
        'buono' => 'Buono stato',
        'da-ristrutturare' => 'Da ristrutturare',
        'rustico' => 'Allo stato rustico',
    ];

    public const ENERGY = ['A4', 'A3', 'A2', 'A1', 'B', 'C', 'D', 'E', 'F', 'G'];

    /** Comuni e marine effettivamente presidiati. Salento, non "Puglia" generica. */
    public const CITIES = [
        'Lecce', 'Porto Cesareo', 'Torre Lapillo', 'Torre Castiglione', 'San Cataldo',
        'Frigole', 'Nardò', 'Copertino', 'Leverano', 'Galatina', 'Gallipoli',
        'Otranto', 'San Cesario di Lecce', 'Trepuzzi', 'Monteroni di Lecce',
    ];

    public const FEATURES = [
        'Giardino', 'Terrazzo', 'Balcone', 'Posto auto', 'Box auto', 'Piscina',
        'Aria condizionata', 'Ascensore', 'Cantina', 'Mansarda', 'Taverna',
        'Arredato', 'Vista mare', 'Impianto fotovoltaico', 'Camino',
    ];

    /** Stati del lead nel funnel commerciale. */
    public const LEAD_STATUSES = [
        'nuovo' => 'Nuovo',
        'contattato' => 'Contattato',
        'appuntamento' => 'Appuntamento fissato',
        'in-trattativa' => 'In trattativa',
        'chiuso-vinto' => 'Chiuso — acquisito',
        'chiuso-perso' => 'Chiuso — perso',
    ];

    public const LEAD_SOURCES = [
        'valutazione' => 'Richiesta di valutazione',
        'immobile' => 'Richiesta info su immobile',
        'contatto' => 'Modulo contatti',
    ];

    public static function label(string $group, string $key, string $fallback = ''): string
    {
        /** @var array<string,string> $map */
        $map = match ($group) {
            'contract' => self::CONTRACTS,
            'type' => self::TYPES,
            'status' => self::STATUSES,
            'condition' => self::CONDITIONS,
            'lead_status' => self::LEAD_STATUSES,
            'lead_source' => self::LEAD_SOURCES,
            default => [],
        };

        return $map[$key] ?? ($fallback !== '' ? $fallback : $key);
    }
}
