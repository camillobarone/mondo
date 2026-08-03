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

    /**
     * Stato della trattativa, indipendente dalla pubblicazione: un immobile
     * può essere online e già sotto proposta, o rogitato e ancora visibile
     * come venduto.
     */
    public const DEAL_STAGES = [
        'acquisizione' => 'In acquisizione',
        'in_vendita' => 'In vendita',
        'proposta' => 'Proposta ricevuta',
        'compromesso' => 'Compromesso firmato',
        'rogitato' => 'Rogitato',
        'ritirato' => 'Incarico ritirato',
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

    /** Un contatto può avere più ruoli insieme: chi vende oggi compra domani. */
    public const CLIENT_ROLES = [
        'acquirente' => 'Acquirente',
        'venditore' => 'Venditore',
        'locatore' => 'Locatore',
        'conduttore' => 'Inquilino',
        'segnalatore' => 'Segnalatore',
        'collega' => 'Collega',
    ];

    public const CLIENT_STATUSES = [
        'attivo' => 'Attivo',
        'in_trattativa' => 'In trattativa',
        'dormiente' => 'Dormiente',
        'chiuso' => 'Chiuso',
        'non_interessato' => 'Non più interessato',
    ];

    /** Da dove arriva il contatto. Alimenta il report sulle provenienze. */
    public const CLIENT_SOURCES = [
        'sito' => 'Sito',
        'portale' => 'Portale (Immobiliare, Idealista)',
        'passaparola' => 'Passaparola',
        'vetrina' => 'Vetrina / passaggio',
        'social' => 'Social',
        'cliente_storico' => 'Cliente storico',
        'collega' => 'Segnalazione di un collega',
    ];

    /** Come paga: cambia i tempi della trattativa più di ogni altro dato. */
    public const FINANCING = [
        'contanti' => 'Contanti / senza mutuo',
        'mutuo_deliberato' => 'Mutuo già deliberato',
        'mutuo_da_valutare' => 'Mutuo da valutare',
        'vende_prima' => 'Deve prima vendere',
    ];

    public const URGENCY = [
        'alta' => 'Alta',
        'media' => 'Media',
        'bassa' => 'Bassa',
    ];

    public const OFFER_STATUSES = [
        'presentata' => 'Presentata',
        'accettata' => 'Accettata',
        'rifiutata' => 'Rifiutata',
        'ritirata' => 'Ritirata',
        'scaduta' => 'Scaduta',
    ];

    /** Documenti ammessi per l'identificazione antiriciclaggio. */
    public const AML_DOCS = [
        'carta_identita' => 'Carta d’identità',
        'patente' => 'Patente',
        'passaporto' => 'Passaporto',
    ];

    /** Interesse rilevato dopo una visita. */
    public const INTEREST = [
        'alto' => 'Alto',
        'medio' => 'Medio',
        'basso' => 'Basso',
    ];

    public static function label(string $group, string $key, string $fallback = ''): string
    {
        /** @var array<string,string> $map */
        $map = match ($group) {
            'contract' => self::CONTRACTS,
            'type' => self::TYPES,
            'status' => self::STATUSES,
            'deal_stage' => self::DEAL_STAGES,
            'condition' => self::CONDITIONS,
            'lead_status' => self::LEAD_STATUSES,
            'lead_source' => self::LEAD_SOURCES,
            'client_role' => self::CLIENT_ROLES,
            'client_status' => self::CLIENT_STATUSES,
            'client_source' => self::CLIENT_SOURCES,
            'financing' => self::FINANCING,
            'urgency' => self::URGENCY,
            'offer_status' => self::OFFER_STATUSES,
            'aml_doc' => self::AML_DOCS,
            'interest' => self::INTEREST,
            default => [],
        };

        return $map[$key] ?? ($fallback !== '' ? $fallback : $key);
    }
}
