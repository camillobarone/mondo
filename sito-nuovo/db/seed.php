<?php

/**
 * Contenuti di esempio per vedere il sito pieno appena installato.
 *
 * ⚠️ SONO DATI FINTI. Prezzi, metrature e descrizioni non corrispondono a
 * immobili reali: servono solo a provare il sito e il gestionale. Ogni
 * riferimento è marcato `DEMO-` proprio per non confonderlo col portafoglio
 * vero. Si cancellano dal gestionale, uno per uno o in blocco.
 *
 * I dati dell'agenzia (indirizzi, telefoni, orari, recensioni) invece sono
 * quelli veri e canonici: sono gli stessi che finiscono nel JSON-LD.
 */

declare(strict_types=1);

use Mil\Core\Db;
use Mil\Repo\Content;
use Mil\Repo\Contacts;
use Mil\Repo\Properties;

function mil_seed_demo(): void
{
    $autore = (int) (Db::value('SELECT id FROM users ORDER BY id LIMIT 1') ?? 0) ?: null;

    $immobili = [
        [
            'title' => 'Villetta indipendente con giardino a Porto Cesareo',
            'type' => 'villetta', 'city' => 'Porto Cesareo', 'area' => 'Zona Poggio',
            'price' => 245000, 'sqm' => 130, 'lot_sqm' => 600, 'rooms' => 5, 'bedrooms' => 3,
            'bathrooms' => 2, 'year_built' => 2005, 'energy_class' => 'D', 'condition_state' => 'buono',
            'features' => 'Giardino, Posto auto, Terrazzo, Aria condizionata',
            'featured' => 1,
            'excerpt' => 'Villetta su due livelli a pochi minuti dal centro di Porto Cesareo, con giardino piantumato e doppio ingresso.',
            'description' => "Villetta indipendente disposta su due livelli, in una traversa tranquilla della zona Poggio.\n\nAl piano terra: soggiorno con angolo cottura, una camera, bagno e accesso diretto al giardino. Al primo piano due camere matrimoniali, secondo bagno e terrazzo abitabile esposto a sud.\n\nIl giardino di circa 600 mq è già piantumato con ulivi e agrumi, con spazio per due auto. Impianti a norma, infissi in pvc con doppio vetro.\n\nIl mare di Torre Lapillo è a sette minuti di auto.",
        ],
        [
            'title' => 'Appartamento ristrutturato in zona Mazzini, Lecce',
            'type' => 'appartamento', 'city' => 'Lecce', 'area' => 'Mazzini',
            'price' => 178000, 'sqm' => 105, 'rooms' => 4, 'bedrooms' => 2, 'bathrooms' => 2,
            'floor' => '3', 'floors_total' => 5, 'year_built' => 1978, 'energy_class' => 'C',
            'condition_state' => 'ristrutturato',
            'features' => 'Ascensore, Balcone, Aria condizionata, Cantina',
            'featured' => 1,
            'excerpt' => 'Quattro vani ristrutturati nel 2023, terzo piano con ascensore, a due passi da viale Gallipoli.',
            'description' => "Appartamento di 105 mq al terzo piano di una palazzina con ascensore, in una delle zone più richieste di Lecce.\n\nRistrutturato nel 2023: impianti rifatti, pavimenti nuovi, due bagni finestrati, cucina abitabile con balcone. Doppia esposizione, luminoso per tutta la giornata.\n\nCompleta la proprietà una cantina al piano interrato.\n\nScuole, farmacia e supermercato entro trecento metri; il centro storico si raggiunge a piedi in un quarto d'ora.",
        ],
        [
            'title' => 'Casa indipendente con mansarda a Trepuzzi',
            'type' => 'casa-indipendente', 'city' => 'Trepuzzi', 'area' => 'Centro',
            'price' => 132000, 'sqm' => 122, 'rooms' => 5, 'bedrooms' => 3, 'bathrooms' => 2,
            'year_built' => 1995, 'energy_class' => 'E', 'condition_state' => 'buono',
            'features' => 'Mansarda, Terrazzo, Posto auto, Camino',
            'excerpt' => 'Casa indipendente su due livelli più mansarda, con terrazzo di copertura e posto auto interno.',
            'description' => "Casa indipendente nel centro di Trepuzzi, a pochi minuti da Lecce.\n\nPiano terra con soggiorno, cucina abitabile, bagno e ripostiglio; primo piano con tre camere e secondo bagno; mansarda di 35 mq utilizzabile come studio o quarta camera.\n\nTerrazzo di copertura con vista aperta e posto auto interno. Riscaldamento autonomo, camino funzionante in soggiorno.",
        ],
        [
            'title' => 'Trilocale a cinquanta metri dal mare, Porto Cesareo',
            'type' => 'trilocale', 'city' => 'Porto Cesareo', 'area' => 'Centro',
            'price' => 189000, 'sqm' => 72, 'rooms' => 3, 'bedrooms' => 2, 'bathrooms' => 2,
            'floor' => '1', 'floors_total' => 2, 'year_built' => 2010, 'energy_class' => 'C',
            'condition_state' => 'buono',
            'features' => 'Balcone, Posto auto, Arredato, Aria condizionata, Vista mare',
            'featured' => 1,
            'excerpt' => 'Trilocale arredato con due bagni, a cinquanta metri dalla spiaggia. Pronto per l’uso o per l’affitto turistico.',
            'description' => "Trilocale al primo piano in una piccola palazzina del 2010, a cinquanta metri dalla spiaggia.\n\nSoggiorno con angolo cottura, due camere, due bagni completi, balcone vivibile con affaccio laterale sul mare. Venduto arredato, climatizzato in ogni ambiente.\n\nPosto auto assegnato nel cortile interno.\n\nSoluzione adatta sia a chi cerca una seconda casa pronta, sia a chi la mette a reddito nei mesi estivi.",
        ],
        [
            'title' => 'Villa con uliveto a Nardò',
            'type' => 'villa', 'city' => 'Nardò', 'area' => 'Campagna',
            'price' => 0, 'price_hidden' => 1, 'sqm' => 210, 'lot_sqm' => 4500,
            'rooms' => 7, 'bedrooms' => 4, 'bathrooms' => 3, 'year_built' => 2008,
            'energy_class' => 'B', 'condition_state' => 'buono',
            'features' => 'Piscina, Giardino, Camino, Impianto fotovoltaico, Box auto',
            'excerpt' => 'Villa di 210 mq su lotto di 4.500 mq con uliveto secolare e piscina. Trattativa riservata.',
            'description' => "Villa isolata immersa in un uliveto secolare, a otto chilometri dal centro di Nardò e dodici dal mare.\n\nAmpio salone con camino, cucina abitabile, quattro camere e tre bagni. Portico coperto sui due lati esposti, piscina di 10×5 metri, box auto doppio.\n\nImpianto fotovoltaico da 6 kW e pozzo autorizzato per l'irrigazione.\n\nPer questo immobile il prezzo si comunica solo in sede di appuntamento.",
        ],
        [
            'title' => 'Bilocale ristrutturato nel centro storico di Lecce',
            'type' => 'bilocale', 'city' => 'Lecce', 'area' => 'Centro storico',
            'price' => 149000, 'sqm' => 58, 'rooms' => 2, 'bedrooms' => 1, 'bathrooms' => 1,
            'floor' => 'terra', 'year_built' => 1900, 'energy_class' => 'F',
            'condition_state' => 'ristrutturato',
            'features' => 'Arredato, Aria condizionata',
            'excerpt' => 'Bilocale con volte a stella nel cuore del centro storico, ristrutturato conservando le pietre a vista.',
            'description' => "Bilocale al piano terra in un palazzo storico a due passi da piazza Sant'Oronzo.\n\nRistrutturato mantenendo le volte a stella e la pietra leccese a vista: soggiorno con angolo cottura, camera matrimoniale, bagno finestrato.\n\nVenduto arredato. Adatto a chi cerca una casa in centro o un immobile da mettere a reddito sul turistico.",
        ],
    ];

    foreach ($immobili as $i => $dati) {
        Properties::create(array_merge([
            'ref' => 'DEMO-' . str_pad((string) ($i + 1), 4, '0', STR_PAD_LEFT),
            'slug' => '',
            'status' => 'published',
            'contract' => 'vendita',
            'postal_code' => '', 'address' => '', 'lat' => '', 'lng' => '',
            'price_hidden' => 0, 'condo_fees' => null, 'lot_sqm' => 0,
            'floor' => '', 'floors_total' => 0, 'heating' => 'Autonomo',
            'seo_title' => '', 'seo_description' => '',
            'agent_id' => $autore, 'featured' => 0,
            'published_at' => date('Y-m-d H:i:s', strtotime('-' . ($i * 9 + 3) . ' days')),
        ], $dati));
    }

    $articoli = [
        [
            'title' => 'Quanto costa al metro quadro una casa a Lecce',
            'excerpt' => 'A Lecce il centro storico sta fra 1.900 e 2.500 €/mq, i quartieri semicentrali fra 1.200 e 1.700, la periferia fra 800 e 1.300. Le marine vanno da 1.100 a 2.200 €/mq secondo la distanza dal mare.',
            'body' => "Le fasce di prezzo per zona sono il punto di partenza di ogni valutazione, non il punto di arrivo: il valore del singolo immobile si sposta dentro la fascia in base allo stato, al piano, all'esposizione e alla presenza di pertinenze.\n\nQuesto è un articolo di esempio, inserito con l'installazione per mostrare come si comporta il blog. Va sostituito con un contenuto vero prima di pubblicare il sito.",
        ],
        [
            'title' => 'Vendere casa nel Salento: i tempi reali',
            'excerpt' => 'I tempi di vendita dipendono soprattutto dal prezzo di partenza. Un immobile valutato correttamente si muove in poche settimane; uno fuori mercato resta fermo e alla fine si vende comunque più in basso.',
            'body' => "Contenuto di esempio inserito con l'installazione. Sostituirlo con un articolo vero, firmato e datato, prima di mettere il sito online.",
        ],
    ];

    foreach ($articoli as $i => $dati) {
        Content::createPost(array_merge([
            'slug' => '',
            'cover' => '',
            'seo_title' => '',
            'seo_description' => '',
            'author_id' => $autore,
            'status' => 'published',
            'published_at' => date('Y-m-d H:i:s', strtotime('-' . ($i * 12 + 5) . ' days')),
        ], $dati));
    }

    Content::createPage([
        'title' => 'Chi siamo',
        'slug' => 'chi-siamo',
        'body' => "Mondo Immobiliare è il marchio di Studio RCS Srls, agenzia immobiliare iscritta FIMAA. L'attività continuativa dei soci parte dal 1994; nel 2020 le tre realtà separate si uniscono e nasce Mondo Immobiliare.\n\nOperiamo con due sedi, Lecce e Porto Cesareo, su Lecce e provincia e sulla costa ionica.\n\nQuesta pagina è un segnaposto dell'installazione: va riscritta con i contenuti veri.",
        'seo_title' => '',
        'seo_description' => '',
        'status' => 'published',
    ]);

    // Due richieste di acquisto, per far vedere subito il motore di abbinamento.
    Contacts::create([
        'name' => 'Cliente di esempio — famiglia',
        'phone' => '', 'email' => '', 'contract' => 'vendita',
        'budget_min' => 120000, 'budget_max' => 200000,
        'sqm_min' => 100, 'bedrooms_min' => 3,
        'types' => 'appartamento,casa-indipendente,villetta',
        'cities' => 'Lecce,Trepuzzi',
        'notes' => 'Dato di esempio inserito dall’installazione. Cerca casa vicino alle scuole, mutuo già deliberato.',
        'active' => 1, 'assigned_to' => $autore,
    ]);

    Contacts::create([
        'name' => 'Cliente di esempio — seconda casa al mare',
        'phone' => '', 'email' => '', 'contract' => 'vendita',
        'budget_min' => null, 'budget_max' => 250000,
        'sqm_min' => 60, 'bedrooms_min' => 2,
        'types' => 'trilocale,bilocale,villetta',
        'cities' => 'Porto Cesareo,Torre Lapillo',
        'notes' => 'Dato di esempio inserito dall’installazione. Vuole vicinanza al mare, anche da mettere a reddito d’estate.',
        'active' => 1, 'assigned_to' => $autore,
    ]);
}
