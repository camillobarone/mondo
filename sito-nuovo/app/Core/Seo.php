<?php

declare(strict_types=1);

namespace Mil\Core;

use Mil\Repo\Content;

/**
 * Costruzione del JSON-LD secondo le regole del progetto Mondo Immobiliare.
 *
 * Regole implementate qui (non modificarle senza aggiornare la GUIDA-JSON-LD):
 *  - un solo blocco <script type="application/ld+json"> per pagina, un solo @graph;
 *  - #logo è un nodo top-level, #agent lo referenzia con {"@id": ...};
 *  - aggregateRating SOLO su RealEstateAgent, mai sull'immobile;
 *  - priceRange "€€" (due simboli), knowsLanguage a livello agenzia,
 *    availableLanguage solo dentro ContactPoint;
 *  - RealEstateListing usa about → House/Apartment, MAI broker;
 *  - Offer è un nodo separato con seller, e viene omesso del tutto
 *    quando il prezzo non è comunicabile;
 *  - l'ultimo item del BreadcrumbList ha sempre `item` con la URL canonica;
 *  - niente entità HTML dentro i valori: sono testo, non markup.
 */
final class Seo
{
    public const RATING_VALUE = '4.9';
    public const REVIEW_COUNT = 58;

    /** Wikidata verificati. Le località non verificate NON hanno sameAs: si omette. */
    public const WIKIDATA = [
        'Lecce' => 'https://www.wikidata.org/wiki/Q13386',
        'Porto Cesareo' => 'https://www.wikidata.org/wiki/Q52179',
        'Nardò' => 'https://www.wikidata.org/wiki/Q52169',
        'Otranto' => 'https://www.wikidata.org/wiki/Q52174',
        'Gallipoli' => 'https://www.wikidata.org/wiki/Q52143',
        'Galatina' => 'https://www.wikidata.org/wiki/Q52141',
        'Leverano' => 'https://www.wikidata.org/wiki/Q52149',
        'Copertino' => 'https://www.wikidata.org/wiki/Q52133',
        'Miggiano' => 'https://www.wikidata.org/wiki/Q52160',
    ];

    private const SAME_AS = [
        'https://www.wikidata.org/wiki/Q140358228',
        'https://www.facebook.com/MondoImmobiliareLe',
        'https://www.instagram.com/mondoimmobiliarelecce',
        'https://www.youtube.com/@mondoimmobiliarelecce',
        'https://www.tiktok.com/@mondoimmobiliare',
        'https://it.linkedin.com/company/mondo-immobiliare-lecce',
        'https://www.immobiliare.it/agenzie-immobiliari/227729/',
        'https://www.idealista.it/pro/mondoimmobiliarelecce/',
        'https://maps.app.goo.gl/ofkbqDzth3hUtD7a9',
        'https://www.salentoproperties.com/',
    ];

    /** Tre soci co-fondatori: slug della bio => nome. */
    private const FOUNDERS = [
        'camillo-barone-agente-immobiliare-lecce-dal-1994' => 'Camillo Barone',
        'antonio-renna-agente-immobiliare' => 'Antonio Renna',
        'alessandro-ciullo-agente-immobiliare' => 'Alessandro Ciullo',
    ];

    /** Quarto collaboratore, sede Porto Cesareo. */
    private const STAFF_PC = ['stefano-my' => 'Stefano My'];

    /** Base degli @id. In produzione va impostata sul dominio reale. */
    public static function base(): string
    {
        return rtrim(Settings::get('site_url', (string) Config::get('base_url')), '/');
    }

    public static function id(string $anchor): string
    {
        return self::base() . '/' . ltrim($anchor, '/');
    }

    // ---------------------------------------------------------------- nodi

    /**
     * Dove si cerca il logo, in ordine. Più formati perché il file lo
     * consegna una persona, non un programma: chi lo esporta da un
     * programma di grafica si ritrova quello che si ritrova.
     */
    private const FILE_LOGO = [
        '/assets/img/logo.png',
        '/assets/img/logo.webp',
        '/assets/img/logo.jpg',
    ];

    /**
     * Il logo: indirizzo e misure vere, o `null` se un logo non c'è.
     *
     * Prima qui si tornava sempre un indirizzo, che il file esistesse o no —
     * `/assets/img/logo-512.png` era scritto come valore predefinito ma la
     * cartella non c'era mai stata — e le misure erano scritte a mano, 512
     * per 512, qualunque cosa fosse davvero il file. Due bugie nello stesso
     * nodo: un'immagine che non risponde e delle dimensioni inventate.
     *
     * Adesso il file si cerca sul disco e si misura. Se non c'è, non c'è: un
     * dato mancante è un problema minore di un dato falso.
     *
     * @return array{url:string,width:int,height:int}|null
     */
    public static function logo(): ?array
    {
        static $logo = false;

        if ($logo !== false) {
            return $logo;
        }

        foreach (self::FILE_LOGO as $percorso) {
            $file = MIL_PUBLIC . $percorso;
            if (!is_file($file)) {
                continue;
            }

            $misure = @getimagesize($file);
            if ($misure === false) {
                continue;
            }

            return $logo = [
                'url' => self::base() . $percorso,
                'width' => (int) $misure[0],
                'height' => (int) $misure[1],
            ];
        }

        // L'impostazione resta l'ultima parola per chi tiene il logo altrove,
        // ma di un file remoto non si possono misurare i lati: si dichiara
        // solo l'indirizzo.
        $impostato = trim((string) Settings::get('logo_url', ''));
        if ($impostato !== '') {
            return $logo = ['url' => $impostato, 'width' => 0, 'height' => 0];
        }

        return $logo = null;
    }

    /** Solo l'indirizzo, per chi non ha bisogno delle misure. */
    public static function logoUrl(): ?string
    {
        return self::logo()['url'] ?? null;
    }

    /**
     * @return array<string,mixed> vuoto se il logo non c'è: `graph()` scarta
     *                             i nodi vuoti e i riferimenti spariscono con
     *                             loro
     */
    public static function logoNode(): array
    {
        $logo = self::logo();
        if ($logo === null) {
            return [];
        }

        $nodo = [
            '@type' => 'ImageObject',
            '@id' => self::base() . '/#logo',
            'url' => $logo['url'],
            'contentUrl' => $logo['url'],
        ];

        if ($logo['width'] > 0) {
            $nodo['width'] = $logo['width'];
            $nodo['height'] = $logo['height'];
        }

        return $nodo;
    }

    /**
     * Nodo #agent nella forma canonica. Va incluso nel @graph di OGNI pagina:
     * senza di lui Google non risolve i riferimenti e segnala errori critici.
     *
     * @return array<string,mixed>
     */
    public static function agentNode(): array
    {
        $base = self::base();

        // L'`@id` c'è sempre: serve a legare la persona all'agenzia dentro il
        // grafo, e vale anche quando la scheda non è ancora stata scritta.
        // L'`url` invece è un indirizzo che qualcuno andrà a chiedere, quindi
        // esce solo se quella pagina esiste davvero — stessa regola della
        // sede di Porto Cesareo, qui sotto. Si accende da sé man mano che le
        // schede vengono pubblicate: nessuno deve ricordarsi di tornare qui.
        $person = static function (string $slug, string $name) use ($base): array {
            $nodo = [
                '@type' => 'Person',
                '@id' => $base . '/' . $slug . '/#person',
                'name' => $name,
            ];

            if (Content::pagePubblicata($slug)) {
                $nodo['url'] = $base . '/' . $slug . '/';
            }

            return $nodo;
        };

        $founders = [];
        foreach (self::FOUNDERS as $slug => $name) {
            $founders[] = $person($slug, $name);
        }
        $employees = $founders;
        foreach (self::STAFF_PC as $slug => $name) {
            $employees[] = $person($slug, $name);
        }

        // Il rimando al logo solo se un logo c'è: senza il nodo #logo nel
        // grafo, questo sarebbe un riferimento che non si risolve.
        $logo = self::logoUrl() === null
            ? []
            : ['logo' => ['@id' => $base . '/#logo'], 'image' => ['@id' => $base . '/#logo']];

        return [
            '@type' => 'RealEstateAgent',
            '@id' => $base . '/#agent',
            'name' => 'Mondo Immobiliare Lecce',
            'legalName' => 'Studio RCS Srls',
            'foundingDate' => '1994',
            'url' => $base . '/',
            ...$logo,
            'knowsLanguage' => ['Italian', 'English'],
            'priceRange' => '€€',
            'address' => [
                '@type' => 'PostalAddress',
                'streetAddress' => 'Via Giuseppe Parini 48/a',
                'addressLocality' => 'Lecce',
                'addressRegion' => 'Puglia',
                'postalCode' => '73100',
                'addressCountry' => 'IT',
            ],
            'geo' => [
                '@type' => 'GeoCoordinates',
                'latitude' => 40.35834,
                'longitude' => 18.18184,
            ],
            // Gli orari erano scritti in chiaro nel piè di pagina e in nessun
            // altro posto: chi legge la pagina li vedeva, chi legge i dati
            // no. Sono i due turni veri, non un orario continuato inventato
            // per far prima.
            'openingHoursSpecification' => [
                [
                    '@type' => 'OpeningHoursSpecification',
                    'dayOfWeek' => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                    'opens' => '09:00',
                    'closes' => '13:00',
                ],
                [
                    '@type' => 'OpeningHoursSpecification',
                    'dayOfWeek' => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                    'opens' => '16:30',
                    'closes' => '19:00',
                ],
            ],
            // Dove lavora davvero l'agenzia. Non «Puglia»: il Salento è un
            // mercato suo, e un'agenzia che dichiara mezza regione dice a chi
            // legge che non è di nessun posto in particolare.
            'areaServed' => [
                ['@type' => 'City', 'name' => 'Lecce'],
                ['@type' => 'City', 'name' => 'Porto Cesareo'],
                ['@type' => 'AdministrativeArea', 'name' => 'Provincia di Lecce'],
            ],
            'contactPoint' => [
                [
                    '@type' => 'ContactPoint',
                    'telephone' => '+390832391489',
                    'contactType' => 'customer service',
                    'availableLanguage' => ['Italian', 'English'],
                ],
                [
                    '@type' => 'ContactPoint',
                    'telephone' => '+393927282442',
                    'contactType' => 'customer service',
                    'availableLanguage' => ['Italian', 'English'],
                ],
            ],
            'aggregateRating' => [
                '@type' => 'AggregateRating',
                'ratingValue' => self::RATING_VALUE,
                'reviewCount' => self::REVIEW_COUNT,
                'bestRating' => '5',
                'worstRating' => '1',
            ],
            'memberOf' => [
                '@type' => 'Organization',
                '@id' => 'https://www.fimaa.it/#organization',
                'name' => 'FIMAA',
                'url' => 'https://www.fimaa.it',
            ],
            'founder' => $founders,
            'employee' => $employees,
            'sameAs' => self::SAME_AS,
        ];
    }

    /** L'indirizzo della pagina dedicata alla sede di Porto Cesareo. */
    public const PAGINA_PORTO_CESAREO = 'agenzia-immobiliare-porto-cesareo';

    /** Filiale di Porto Cesareo, collegata alla casa madre. @return array<string,mixed> */
    public static function agentPortoCesareoNode(): array
    {
        $base = self::base();

        $nodo = [
            '@type' => 'RealEstateAgent',
            '@id' => $base . '/#agent-portocesareo',
            'name' => 'Mondo Immobiliare — Porto Cesareo',
            'parentOrganization' => ['@id' => $base . '/#agent'],
            'priceRange' => '€€',
            'address' => [
                '@type' => 'PostalAddress',
                'streetAddress' => 'Via Francesco Cilea 76',
                'addressLocality' => 'Porto Cesareo',
                'addressRegion' => 'Puglia',
                'postalCode' => '73010',
                'addressCountry' => 'IT',
            ],
            'geo' => [
                '@type' => 'GeoCoordinates',
                'latitude' => 40.26287,
                'longitude' => 17.89698,
            ],
            'telephone' => '+390832391489',
            'employee' => [[
                '@type' => 'Person',
                '@id' => $base . '/stefano-my/#person',
                'name' => 'Stefano My',
            ]],
        ];

        if (self::logoUrl() !== null) {
            $nodo['logo'] = ['@id' => $base . '/#logo'];
        }

        // `url` solo se la pagina della sede esiste davvero. Era scritto fisso,
        // e siccome quella pagina è ancora fra quelle da ricreare, i dati
        // strutturati di ogni pagina del sito rimandavano a un 404 — proprio
        // il nodo che dovrebbe dire a un motore dove trovare la seconda sede.
        if (Content::pagePubblicata(self::PAGINA_PORTO_CESAREO)) {
            $nodo['url'] = $base . '/' . self::PAGINA_PORTO_CESAREO . '/';
        }

        return $nodo;
    }

    /** @return array<string,mixed> */
    public static function websiteNode(): array
    {
        return [
            '@type' => 'WebSite',
            '@id' => self::base() . '/#website',
            'url' => self::base() . '/',
            'name' => Settings::get('site_name', 'Mondo Immobiliare Lecce'),
            'inLanguage' => 'it',
            'publisher' => ['@id' => self::base() . '/#agent'],
        ];
    }

    /**
     * @param array<int,array{name:string,url:string}> $trail
     * @return array<string,mixed>
     */
    public static function breadcrumbNode(array $trail, string $pageUrl): array
    {
        $items = [];
        $position = 1;

        foreach ($trail as $step) {
            $items[] = [
                '@type' => 'ListItem',
                'position' => $position++,
                'name' => $step['name'],
                'item' => $step['url'],
            ];
        }

        return [
            '@type' => 'BreadcrumbList',
            '@id' => $pageUrl . '#breadcrumb',
            'itemListElement' => $items,
        ];
    }

    /**
     * FAQPage. Da emettere SOLO se le stesse domande sono visibili in pagina.
     *
     * @param array<int,array{q:string,a:string}> $faq
     * @return array<string,mixed>
     */
    public static function faqNode(array $faq, string $pageUrl): array
    {
        return [
            '@type' => 'FAQPage',
            '@id' => $pageUrl . '#faq',
            'mainEntity' => array_map(static fn (array $item): array => [
                '@type' => 'Question',
                'name' => $item['q'],
                'acceptedAnswer' => ['@type' => 'Answer', 'text' => $item['a']],
            ], $faq),
        ];
    }

    // ------------------------------------------------------------ annuncio

    /**
     * @param array<string,mixed> $p riga della tabella properties
     * @param array<int,array<string,mixed>> $images
     * @return array<int,array<string,mixed>> nodi da aggiungere al @graph
     */
    public static function listingNodes(array $p, array $images = []): array
    {
        $base = self::base();
        $pageUrl = $base . '/immobili/' . $p['slug'] . '/';
        $nodes = [];

        // Immagine principale, referenziata da listing e accommodation.
        $primary = null;
        if ($images !== []) {
            $first = $images[0];
            $imgUrl = self::absolute((string) $first['path']);
            $primary = [
                '@type' => 'ImageObject',
                '@id' => $pageUrl . '#primaryimage',
                'url' => $imgUrl,
                'contentUrl' => $imgUrl,
                'width' => (int) ($first['width'] ?? 1200),
                'height' => (int) ($first['height'] ?? 700),
            ];
            $nodes[] = $primary;
        }

        $accommodationType = self::accommodationType((string) $p['type']);
        $hasAccommodation = $accommodationType !== null;

        // 1. RealEstateListing — about → House/Apartment, mai broker.
        $listing = [
            '@type' => 'RealEstateListing',
            '@id' => $pageUrl . '#listing',
            'url' => $pageUrl,
            'name' => self::text((string) $p['title']),
            'description' => self::text(tronca((string) $p['description'], 300)),
            'datePosted' => substr((string) ($p['published_at'] ?: $p['created_at']), 0, 10),
            'inLanguage' => 'it',
            'provider' => ['@id' => $base . '/#agent'],
        ];
        if ($primary !== null) {
            $listing['image'] = ['@id' => $pageUrl . '#primaryimage'];
        }
        if ($hasAccommodation) {
            $listing['about'] = ['@id' => $pageUrl . '#house'];
        }
        // Il video dell'annuncio, se c'è. `VideoObject` vuole per forza
        // `thumbnailUrl` e `uploadDate`: senza, Google scarta il nodo invece
        // di ignorarne un pezzo, quindi si dichiara solo quando entrambi ci
        // sono davvero — la miniatura è la foto di copertina, la data è
        // quella di pubblicazione dell'annuncio.
        $video = trim((string) ($p['video_url'] ?? ''));
        if ($video !== '' && $primary !== null) {
            $listing['video'] = ['@id' => $pageUrl . '#video'];
        }
        $nodes[] = $listing;

        if ($video !== '' && $primary !== null) {
            $nodes[] = [
                '@type' => 'VideoObject',
                '@id' => $pageUrl . '#video',
                'name' => self::text((string) $p['title']),
                'description' => self::text(tronca((string) $p['description'], 200)),
                'contentUrl' => $video,
                'thumbnailUrl' => (string) $primary['url'],
                'uploadDate' => substr((string) ($p['published_at'] ?: $p['created_at']), 0, 10),
                'inLanguage' => 'it',
            ];
        }

        // 2. House / Apartment — dati tecnici.
        if ($hasAccommodation) {
            $house = [
                '@type' => $accommodationType,
                '@id' => $pageUrl . '#house',
                'name' => self::text((string) $p['title']),
                'address' => self::addressNode($p),
            ];
            if ($primary !== null) {
                $house['image'] = ['@id' => $pageUrl . '#primaryimage'];
            }
            // Le coordinate passano da `Mappa`, che le arrotonda quando la
            // scheda è in «solo la zona». Altrimenti la posizione esatta
            // uscirebbe comunque da qui, mentre la mappa in pagina la nasconde.
            $punto = Mappa::punto($p);
            if ($punto !== null) {
                $house['geo'] = [
                    '@type' => 'GeoCoordinates',
                    'latitude' => $punto['lat'],
                    'longitude' => $punto['lng'],
                ];
            }
            if ((int) $p['sqm'] > 0) {
                $house['floorSize'] = [
                    '@type' => 'QuantitativeValue',
                    'value' => (int) $p['sqm'],
                    'unitCode' => 'MTK',
                ];
            }
            foreach ([
                'numberOfRooms' => 'rooms',
                'numberOfBedrooms' => 'bedrooms',
                'numberOfBathroomsTotal' => 'bathrooms',
            ] as $schemaKey => $column) {
                if ((int) ($p[$column] ?? 0) > 0) {
                    $house[$schemaKey] = (int) $p[$column];
                }
            }
            if ((int) ($p['year_built'] ?? 0) > 0) {
                $house['yearBuilt'] = (int) $p['year_built'];
            }

            $features = self::features($p);
            if ($features !== []) {
                $house['amenityFeature'] = array_map(static fn (string $f): array => [
                    '@type' => 'LocationFeatureSpecification',
                    'name' => $f,
                    'value' => true,
                ], $features);
            }

            // Tutto ciò che non ha una proprietà nativa finisce qui.
            $extra = [];
            if ((int) ($p['lot_sqm'] ?? 0) > 0) {
                $extra[] = ['@type' => 'PropertyValue', 'name' => 'Superficie lotto', 'value' => (int) $p['lot_sqm'], 'unitText' => 'MTK'];
            }
            if (!empty($p['energy_class'])) {
                $extra[] = ['@type' => 'PropertyValue', 'name' => 'Classe energetica', 'value' => self::text((string) $p['energy_class'])];
            }
            if (!empty($p['condition_state'])) {
                $extra[] = ['@type' => 'PropertyValue', 'name' => 'Stato', 'value' => self::text((string) $p['condition_state'])];
            }
            if ($extra !== []) {
                $house['additionalProperty'] = $extra;
            }

            $nodes[] = $house;
        }

        // 3. Agenzia — sempre.
        $nodes[] = self::logoNode();
        $nodes[] = self::agentNode();

        $sellerId = self::isPortoCesareoArea($p)
            ? $base . '/#agent-portocesareo'
            : $base . '/#agent';
        if ($sellerId !== $base . '/#agent') {
            $nodes[] = self::agentPortoCesareoNode();
        }

        // 4. Offer — solo con prezzo comunicabile. Trattativa riservata => niente nodo.
        $price = (float) ($p['price'] ?? 0);
        if ($price > 0 && (int) ($p['price_hidden'] ?? 0) === 0) {
            $offer = [
                '@type' => 'Offer',
                '@id' => $pageUrl . '#offer',
                'businessFunction' => $p['contract'] === 'affitto'
                    ? 'http://purl.org/goodrelations/v1#LeaseOut'
                    : 'http://purl.org/goodrelations/v1#Sell',
                'price' => (string) (int) round($price),
                'priceCurrency' => 'EUR',
                'availability' => in_array($p['status'], ['reserved', 'sold'], true)
                    ? 'https://schema.org/SoldOut'
                    : 'https://schema.org/InStock',
                'priceValidUntil' => date('Y') . '-12-31',
                'seller' => ['@id' => $sellerId],
            ];
            if ($hasAccommodation) {
                $offer['itemOffered'] = ['@id' => $pageUrl . '#house'];
            }
            $nodes[] = $offer;
        }

        // 5. FAQPage — solo se le domande sono davvero stampate nella scheda.
        // La regola «visibili in pagina» è rispettata per costruzione: pagina e
        // nodo leggono la stessa colonna, quindi non possono divergere.
        $faq = Faq::daJson($p['faqs'] ?? '');
        if ($faq !== []) {
            $nodes[] = self::faqNode(array_map(static fn (array $voce): array => [
                'q' => self::text($voce['q']),
                'a' => self::text($voce['a']),
            ], $faq), $pageUrl);
        }

        // 6. Breadcrumb — l'ultimo item ha sempre `item`.
        $nodes[] = self::breadcrumbNode([
            ['name' => 'Home', 'url' => $base . '/'],
            ['name' => 'Immobili in vendita', 'url' => $base . '/immobili/'],
            ['name' => self::text((string) $p['title']), 'url' => $pageUrl],
        ], $pageUrl);

        return $nodes;
    }

    /** @param array<string,mixed> $p @return array<string,mixed> */
    private static function addressNode(array $p): array
    {
        return array_filter([
            '@type' => 'PostalAddress',
            'streetAddress' => self::text((string) ($p['address'] ?? '')),
            'addressLocality' => self::text((string) $p['city']),
            'addressRegion' => 'Puglia',
            'postalCode' => (string) ($p['postal_code'] ?? ''),
            'addressCountry' => 'IT',
        ], static fn (mixed $v): bool => $v !== '' && $v !== null);
    }

    /** Mappa la tipologia interna sul tipo schema.org. null = nessun nodo accommodation. */
    public static function accommodationType(string $type): ?string
    {
        return match ($type) {
            'appartamento', 'bilocale', 'trilocale', 'quadrilocale', 'monolocale', 'attico', 'nuda-proprieta' => 'Apartment',
            'villa', 'villetta', 'casa-indipendente', 'masseria', 'trullo' => 'House',
            // Terreni e locali commerciali non sono Accommodation: si omette il
            // nodo e i dati restano sul RealEstateListing.
            default => null,
        };
    }

    /** @param array<string,mixed> $p @return array<int,string> */
    private static function features(array $p): array
    {
        $raw = (string) ($p['features'] ?? '');
        if ($raw === '') {
            return [];
        }
        $list = array_filter(array_map('trim', explode(',', $raw)));
        return array_values(array_map([self::class, 'text'], $list));
    }

    /** @param array<string,mixed> $p */
    private static function isPortoCesareoArea(array $p): bool
    {
        $city = mb_strtolower((string) $p['city']);
        return in_array($city, ['porto cesareo', 'torre lapillo', 'torre castiglione'], true);
    }

    private static function absolute(string $path): string
    {
        return str_starts_with($path, 'http') ? $path : self::base() . '/' . ltrim($path, '/');
    }

    /**
     * Ripulisce un valore prima di metterlo nel JSON-LD: i valori sono testo,
     * non HTML — un "&amp;" resterebbe letterale nell'output letto da Google.
     */
    /**
     * Testo pulito per i dati strutturati.
     *
     * Passa da Testo::piano() perché i contenuti si scrivono in chat e si
     * incollano nel gestionale con i segni del markdown: senza questo, un
     * sommario che comincia con «## » finiva tale e quale dentro il JSON-LD,
     * dove non significa niente e si legge male. È lo stesso motivo per cui
     * ci passa già tronca(); qui mancava, e l'occhiello dell'articolo — che
     * non viene troncato — ci scivolava dentro intatto.
     */
    public static function text(string $value): string
    {
        $value = html_entity_decode(strip_tags(Testo::piano($value)), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        return trim(preg_replace('/\s+/', ' ', $value) ?? '');
    }

    // ------------------------------------------------------------- output

    /**
     * Un solo blocco per pagina, un solo @graph.
     *
     * @param array<int,array<string,mixed>> $nodes
     */
    public static function graph(array $nodes): string
    {
        // I nodi vuoti si buttano: è così che un pezzo che non c'è — il logo,
        // per esempio, finché nessuno carica il file — sparisce dal grafo
        // invece di uscire come oggetto senza contenuto.
        $nodes = array_filter($nodes, static fn (array $n): bool => $n !== []);

        $json = json_encode(
            ['@context' => 'https://schema.org', '@graph' => array_values($nodes)],
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_PRETTY_PRINT
        );

        if ($json === false) {
            return '';
        }

        return '<script type="application/ld+json">' . $json . '</script>';
    }
}
