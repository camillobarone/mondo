<?php

/**
 * Controlla WpMapper contro schede vere di mondoimmobiliarelecce.it.
 *
 *   php bin/verifica-mappatura.php
 *
 * Categorie, comuni, zone, caratteristiche e meta di ogni caso qui sotto
 * sono stati letti sul WordPress in produzione (connettore MCP, contesto
 * `edit`) il 4 agosto 2026. Non sono inventati e non vanno "sistemati" a
 * mano: se un caso smette di passare, o è cambiato il mapper o è cambiato
 * il sito — e in questo secondo caso si rilegge il sito, non si riscrive
 * il valore atteso.
 *
 * Non copre tutti e 49 gli immobili: il censimento completo lo dà
 * `php bin/importa-da-wordpress.php --campi`.
 */

declare(strict_types=1);

require dirname(__DIR__) . '/app/bootstrap.php';

use Mil\Core\WpMapper;

/** @return array<string,mixed> */
function post(int $id, string $titolo, string $slug = 'x', string $stato = 'publish'): array
{
    return [
        'ID' => $id,
        'post_title' => $titolo,
        'post_name' => $slug,
        'post_status' => $stato,
        'post_content' => '',
        'post_excerpt' => '',
        'post_date' => '2026-01-01 00:00:00',
        'post_modified' => '2026-01-01 00:00:00',
    ];
}

$casi = [
    // id, titolo, terms, meta, atteso [type, city, area]
    [
        31915,
        'Casa indipendente a Trepuzzi, 122 mq con mansarda',
        [
            'property_category' => ['Appartamenti', 'Indipendenti'],
            'property_action_category' => ['Vendita'],
            'property_city' => ['Trepuzzi'],
            'property_area' => ['Trepuzzi'],
        ],
        ['property_price' => '125000', 'property-year' => '', 'stories-number' => '2', 'energy_class' => 'G'],
        ['type' => 'casa-indipendente', 'city' => 'Trepuzzi', 'area' => '', 'floors_total' => 2, 'energy_class' => 'G'],
    ],
    [
        22670,
        'Leverano, Villa a rustico.',
        [
            'property_category' => ['Indipendenti', 'Ville in Vendita a Lecce e Provincia'],
            'property_city' => ['Leverano'],
            'property_area' => ['Leverano'],
        ],
        ['property_price' => '250000', 'property-year' => '1980', 'stories-number' => 'Non disponibile', 'energy_class' => 'H'],
        ['type' => 'villa', 'city' => 'Leverano', 'area' => '', 'year_built' => 1980, 'energy_class' => 'H'],
    ],
    [
        29343,
        'Villetta Bifamiliare a Torre Lapillo Eurovillage',
        [
            'property_category' => ['Appartamenti', 'Residence'],
            'property_city' => ['Nardò', 'Porto Cesareo', 'Torre lapillo'],
            'property_area' => [],
        ],
        ['property_price' => '90000'],
        ['type' => 'appartamento', 'city' => 'Torre Lapillo', 'area' => ''],
    ],
    [
        28777,
        'Residence a Sant Isidoro',
        [
            'property_category' => ['Residence'],
            'property_city' => ['Porto Cesareo', "Sant'Isidoro"],
            'property_area' => ["Sant'Isidoro", 'Porto Cesareo'],
        ],
        ['property_price' => '150000'],
        ['type' => 'appartamento', 'city' => "Sant'Isidoro", 'area' => ''],
    ],
    [
        26131,
        'Vendita Palazzo Migali',
        [
            'property_category' => ['Antiche Dimore', 'Palazzo Storico'],
            'property_city' => ['Lecce città'],
            'property_area' => ['Lecce'],
            'property_features' => ['Area Solare di Proprietà'],
        ],
        ['property_price' => '0'],
        ['type' => 'palazzo-storico', 'city' => 'Lecce', 'area' => '', 'price' => null, 'price_hidden' => 1, 'features' => 'Area Solare di Proprietà'],
    ],
    [
        30387,
        'Nuda proprietà a San Cesario di Lecce',
        [
            'property_category' => ['Appartamenti'],
            'property_city' => ['San Cesario di Lecce'],
            'property_area' => ['San Cesario di Lecce'],
            'property_features' => ['Nuda Proprietà'],
        ],
        ['property_price' => '75000'],
        ['type' => 'nuda-proprieta', 'city' => 'San Cesario di Lecce', 'area' => '', 'features' => ''],
    ],
    [
        30763,
        'Villetta zona Poggio - Porto Cesareo',
        ['property_category' => ['Villette'], 'property_city' => ['Porto Cesareo'], 'property_area' => ['Porto Cesareo']],
        ['property_price' => '210000'],
        ['type' => 'villetta', 'city' => 'Porto Cesareo', 'area' => ''],
    ],
    [
        26521,
        'Vendita Locale Artigianale',
        ['property_category' => ['Locali Commerciali'], 'property_city' => ['Nardò'], 'property_area' => ['Nardò']],
        ['property_price' => '60000'],
        ['type' => 'locale-commerciale', 'city' => 'Nardò', 'area' => ''],
    ],
    [
        28719,
        'Villa a Punta Prosciutto',
        ['property_category' => ['Villa'], 'property_city' => ['Porto Cesareo'], 'property_area' => ['Porto Cesareo']],
        ['property_price' => '450000'],
        ['type' => 'villa', 'city' => 'Porto Cesareo', 'area' => ''],
    ],
    [
        30353,
        'Villino a Frigole',
        [
            'property_category' => ['Indipendenti', 'Villa'],
            'property_city' => ['Lecce città'],
            'property_area' => ['Lecce'],
        ],
        ['property_price' => '135000'],
        ['type' => 'villa', 'city' => 'Lecce', 'area' => ''],
    ],
    [
        29049,
        'TORRE LAPILLO - INDIPENDENTE',
        ['property_category' => ['Indipendenti'], 'property_city' => ['Torre lapillo'], 'property_area' => []],
        ['property_price' => '180000'],
        ['type' => 'casa-indipendente', 'city' => 'Torre Lapillo', 'area' => ''],
    ],
    [
        30264,
        'Bilocale a Punta Grossa',
        [
            'property_category' => ['Appartamenti', 'Multiproprietà'],
            'property_city' => ['Porto Cesareo'],
            'property_area' => ['Porto Cesareo'],
        ],
        ['property_price' => '35000'],
        ['type' => 'appartamento', 'city' => 'Porto Cesareo', 'area' => ''],
    ],
];

$falliti = 0;

foreach ($casi as [$id, $titolo, $terms, $meta, $atteso]) {
    $mapper = new WpMapper();
    $r = $mapper->map(post($id, $titolo), $meta, $terms);

    foreach ($atteso as $campo => $valore) {
        if ($r[$campo] !== $valore) {
            printf(
                "NON PASSA  %d %s → %s: atteso %s, ottenuto %s\n",
                $id,
                $titolo,
                $campo,
                var_export($valore, true),
                var_export($r[$campo], true)
            );
            $falliti++;
        }
    }
}

// Galleria: lista con virgola finale e array serializzato.
$mapper = new WpMapper();
$ids = $mapper->immagini([
    '_thumbnail_id' => '31916',
    'image_to_attach' => '31916,32022,32023,',
]);
if ($ids !== [31916, 32022, 32023]) {
    echo "NON PASSA  galleria da image_to_attach: " . var_export($ids, true) . "\n";
    $falliti++;
}

$mapper = new WpMapper();
$ids = $mapper->immagini([
    '_thumbnail_id' => '22686',
    'wpestate_property_gallery' => 'a:3:{i:0;s:5:"22671";i:1;s:5:"22672";i:2;s:5:"22686";}',
]);
if ($ids !== [22686, 22671, 22672]) {
    echo "NON PASSA  galleria serializzata: " . var_export($ids, true) . "\n";
    $falliti++;
}

echo $falliti === 0
    ? "PASSA — " . count($casi) . " schede reali + 2 gallerie\n"
    : "\n{$falliti} controlli non passati\n";

exit($falliti === 0 ? 0 : 1);
