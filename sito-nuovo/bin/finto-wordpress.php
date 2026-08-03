<?php

/**
 * Costruisce un WordPress finto su SQLite, per provare l'importatore senza
 * avvicinarsi al database vero.
 *
 *   php bin/finto-wordpress.php /percorso/finto-wp.sqlite /percorso/uploads
 *
 * Riproduce la struttura che l'importatore legge — posts, postmeta, terms,
 * term_taxonomy, term_relationships — con casi che sul sito vero esistono:
 * un immobile completo, uno a trattativa riservata, una bozza, un termine
 * di tassonomia con un title SEO finito nel campo nome (capita: vedi il
 * termine `ville` sul sito attuale), una dotazione fuori vocabolario.
 */

declare(strict_types=1);

require dirname(__DIR__) . '/app/bootstrap.php';

$dbFile = $argv[1] ?? (sys_get_temp_dir() . '/finto-wp.sqlite');
$uploads = $argv[2] ?? (sys_get_temp_dir() . '/finto-uploads');

@unlink($dbFile);
if (!is_dir($uploads . '/2026/07') && !mkdir($uploads . '/2026/07', 0775, true)) {
    exit("Non riesco a creare {$uploads}\n");
}

$pdo = new PDO('sqlite:' . $dbFile, null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

foreach ([
    'CREATE TABLE vnb_posts (ID INTEGER PRIMARY KEY, post_title TEXT, post_name TEXT,
        post_content TEXT, post_excerpt TEXT, post_status TEXT, post_type TEXT,
        post_date TEXT, post_modified TEXT)',
    'CREATE TABLE vnb_postmeta (meta_id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER,
        meta_key TEXT, meta_value TEXT)',
    'CREATE TABLE vnb_terms (term_id INTEGER PRIMARY KEY, name TEXT, slug TEXT)',
    'CREATE TABLE vnb_term_taxonomy (term_taxonomy_id INTEGER PRIMARY KEY, term_id INTEGER, taxonomy TEXT)',
    'CREATE TABLE vnb_term_relationships (object_id INTEGER, term_taxonomy_id INTEGER)',
] as $ddl) {
    $pdo->exec($ddl);
}

$post = $pdo->prepare('INSERT INTO vnb_posts
    (ID, post_title, post_name, post_content, post_excerpt, post_status, post_type, post_date, post_modified)
    VALUES (?,?,?,?,?,?,?,?,?)');
$meta = $pdo->prepare('INSERT INTO vnb_postmeta (post_id, meta_key, meta_value) VALUES (?,?,?)');
$term = $pdo->prepare('INSERT INTO vnb_terms (term_id, name, slug) VALUES (?,?,?)');
$tt = $pdo->prepare('INSERT INTO vnb_term_taxonomy (term_taxonomy_id, term_id, taxonomy) VALUES (?,?,?)');
$rel = $pdo->prepare('INSERT INTO vnb_term_relationships (object_id, term_taxonomy_id) VALUES (?,?)');

// Tassonomie: nomi come stanno davvero sul sito, compreso quello sporco.
$termini = [
    1 => ['Ville in Vendita a Lecce e Provincia', 'ville', 'property_category'],
    2 => ['Appartamenti', 'appartamenti', 'property_category'],
    3 => ['Terreni edificabili', 'terreni', 'property_category'],
    4 => ['Vendita', 'vendita', 'property_action_category'],
    5 => ['Affitto', 'affitto', 'property_action_category'],
    6 => ['Porto Cesareo', 'porto-cesareo', 'property_city'],
    7 => ['Lecce', 'lecce', 'property_city'],
    8 => ['Zona Poggio', 'zona-poggio', 'property_area'],
    9 => ['Giardino', 'giardino', 'property_features'],
    10 => ['Posto auto', 'posto-auto', 'property_features'],
    11 => ['Impianto di allarme', 'allarme', 'property_features'],
];
foreach ($termini as $id => [$nome, $slug, $tax]) {
    $term->execute([$id, $nome, $slug]);
    $tt->execute([$id, $id, $tax]);
}

// Un'immagine vera su disco, così la lavorazione delle foto è reale.
$img = imagecreatetruecolor(2000, 1400);
imagefilledrectangle($img, 0, 0, 2000, 1400, imagecolorallocate($img, 170, 150, 120));
imagejpeg($img, $uploads . '/2026/07/villetta-poggio.jpg', 85);
imagejpeg($img, $uploads . '/2026/07/villetta-poggio-2.jpg', 85);
imagedestroy($img);

$immobili = [
    [
        'id' => 31151,
        'title' => 'Villa Porto Cesareo zona Poggio',
        'slug' => 'villa-poggio-porto-cesareo',
        'content' => "<p>Villa indipendente su due livelli.</p>\n<p>Giardino piantumato e posto auto interno.</p>[vc_row]sporcizia da shortcode[/vc_row]",
        'excerpt' => 'Villa indipendente a due passi dal centro.',
        'status' => 'publish',
        'date' => '2026-06-18 08:25:52',
        'meta' => [
            'property_price' => '245000',
            'property_size' => '130',
            'property_lot_size' => '600',
            'property_rooms' => '5',
            'property_bedrooms' => '3',
            'property_bathrooms' => '2',
            'property_address' => 'Via delle Ginestre 12, Porto Cesareo',
            'property_zip' => '73010',
            'property_latitude' => '40.26287',
            'property_longitude' => '17.89698',
            'property_year' => '2005',
            'energy_class' => 'D',
            'property_id' => 'MIL-0042',
            '_thumbnail_id' => '90001',
            'image_to_attach' => '90001,90002',
        ],
        'terms' => [1, 4, 6, 8, 9, 10, 11],
    ],
    [
        // Prezzo assente: sul sito è "trattativa riservata".
        'id' => 29686,
        'title' => 'Villa Morfeo',
        'slug' => 'villa-morfeo-porto-cesareo',
        'content' => '<p>Villa con uliveto secolare.</p>',
        'excerpt' => '',
        'status' => 'publish',
        'date' => '2025-12-20 18:04:35',
        'meta' => [
            'property_price' => '',
            'property_size' => '210',
            'property_bedrooms' => '4',
            'property_bathrooms' => '3',
        ],
        'terms' => [1, 4, 6],
    ],
    [
        // Prezzo in formato italiano, tipologia da riconoscere per parola.
        'id' => 31292,
        'title' => 'Appartamento nuovo in vendita a Lecce, zona Ariosto',
        'slug' => 'appartamento-nuovo-a-lecce',
        'content' => '<p>Appartamento di nuova costruzione.</p>',
        'excerpt' => '',
        'status' => 'publish',
        'date' => '2026-06-23 06:17:53',
        'meta' => [
            'property_price' => '€ 178.000,00',
            'property_size' => '105',
            'property_bedrooms' => '2',
            'property_bathrooms' => '2',
            'property_floor' => '3',
            'energy_class' => 'C',
        ],
        'terms' => [2, 4, 7],
    ],
    [
        // Bozza, in affitto, tipologia terreno.
        'id' => 30999,
        'title' => 'Terreno edificabile a Lecce',
        'slug' => 'terreno-edificabile-lecce',
        'content' => '<p>Lotto edificabile.</p>',
        'excerpt' => '',
        'status' => 'draft',
        'date' => '2026-05-02 10:00:00',
        'meta' => ['property_price' => '95000', 'property_lot_size' => '1200'],
        'terms' => [3, 5, 7],
    ],
];

foreach ($immobili as $i) {
    $post->execute([
        $i['id'], $i['title'], $i['slug'], $i['content'], $i['excerpt'],
        $i['status'], 'estate_property', $i['date'], $i['date'],
    ]);
    foreach ($i['meta'] as $k => $v) {
        $meta->execute([$i['id'], $k, $v]);
    }
    foreach ($i['terms'] as $t) {
        $rel->execute([$i['id'], $t]);
    }
}

// Allegati, come li registra WordPress.
foreach ([90001 => 'villetta-poggio.jpg', 90002 => 'villetta-poggio-2.jpg'] as $attId => $file) {
    $post->execute([$attId, $file, $file, '', '', 'inherit', 'attachment', '2026-07-01 10:00:00', '2026-07-01 10:00:00']);
    $meta->execute([$attId, '_wp_attached_file', '2026/07/' . $file]);
    $meta->execute([$attId, '_wp_attachment_image_alt', 'Villa a Porto Cesareo, vista del giardino']);
}

echo "WordPress finto pronto:\n";
echo "  database: {$dbFile}\n";
echo "  uploads:  {$uploads}\n";
echo "  immobili: " . count($immobili) . " (3 pubblicati + 1 bozza), 2 allegati\n";
