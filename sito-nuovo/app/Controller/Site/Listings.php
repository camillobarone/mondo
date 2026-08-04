<?php

declare(strict_types=1);

namespace Mil\Controller\Site;

use Mil\Core\Assets;
use Mil\Core\Seo;
use Mil\Core\View;
use Mil\Core\Vocab;
use Mil\Repo\Properties;

final class Listings
{
    public static function index(): void
    {
        $filters = [
            'status' => 'online',
            'contract' => self::pick(q('contratto'), array_keys(Vocab::CONTRACTS)),
            'type' => self::pick(q('tipologia'), array_keys(Vocab::TYPES)),
            'city' => self::pick(q('comune'), Vocab::CITIES),
            'price_min' => float_or_null(q('prezzo_min')),
            'price_max' => float_or_null(q('prezzo_max')),
            'sqm_min' => int_or_null(q('mq_min')),
            'bedrooms_min' => int_or_null(q('camere')),
            'q' => q('cerca'),
            'sort' => q('ordina'),
        ];

        $page = max(1, (int) q('pagina', '1'));
        $result = Properties::search($filters, $page, 12);

        // Le pagine di risultato filtrate non vanno indicizzate: sono
        // combinazioni infinite dello stesso contenuto.
        $isFiltered = array_filter($filters, static fn (mixed $v, string $k): bool =>
            !in_array($k, ['status', 'sort'], true) && !empty($v), ARRAY_FILTER_USE_BOTH) !== [];

        $pageUrl = Seo::base() . '/immobili/';
        $graph = [
            Seo::logoNode(),
            Seo::agentNode(),
            [
                '@type' => 'CollectionPage',
                '@id' => $pageUrl . '#webpage',
                'url' => $pageUrl,
                'name' => 'Immobili in vendita a Lecce e nel Salento',
                'inLanguage' => 'it',
                'publisher' => ['@id' => Seo::base() . '/#agent'],
            ],
            Seo::breadcrumbNode([
                ['name' => 'Home', 'url' => Seo::base() . '/'],
                ['name' => 'Immobili in vendita', 'url' => $pageUrl],
            ], $pageUrl),
        ];

        View::show('site/immobili', [
            'meta' => Pages::meta(
                'Immobili in vendita a Lecce e nel Salento',
                'Case, ville e appartamenti in vendita a Lecce, Porto Cesareo e provincia, selezionati da Mondo Immobiliare, agenzia FIMAA dal 1994.',
                $pageUrl,
                Seo::graph($graph),
                $isFiltered || $page > 1 ? 'noindex, follow' : 'index, follow',
                self::preloadPrimaScheda($result['items'])
            ),
            'result' => $result,
            'filters' => $filters,
            'cities' => Properties::citiesInUse(),
        ]);
    }

    public static function show(string $slug): void
    {
        $property = Properties::bySlug($slug);

        if ($property === null || !in_array($property['status'], ['published', 'reserved', 'sold'], true)) {
            Pages::notFound();
            return;
        }

        Properties::incrementViews((int) $property['id']);
        self::render($property);
    }

    /**
     * Disegna la scheda pubblica di un immobile.
     *
     * Il gestionale chiama questo stesso metodo per l'anteprima: una scheda
     * sola, disegnata da un punto solo. Un'anteprima costruita a parte
     * mostrerebbe una pagina somigliante invece della pagina vera, e la
     * differenza salterebbe fuori il giorno della pubblicazione — cioè troppo
     * tardi per essere utile.
     *
     * @param array<string,mixed> $property
     */
    public static function render(array $property, bool $anteprima = false): void
    {
        $images = Properties::images((int) $property['id']);

        $pageUrl = Seo::base() . '/immobili/' . $property['slug'] . '/';

        $description = (string) ($property['seo_description'] ?: tronca((string) $property['description'], 155));

        // Un immobile venduto resta online per la storia, ma fuori dall'indice;
        // l'anteprima non deve finirci nemmeno per sbaglio.
        $robots = 'index, follow';
        if ($anteprima) {
            $robots = 'noindex, nofollow';
        } elseif ($property['status'] === 'sold') {
            $robots = 'noindex, follow';
        }

        View::show('site/immobile', [
            'meta' => Pages::meta(
                (string) ($property['seo_title'] ?: $property['title']),
                $description,
                $pageUrl,
                Seo::graph(Seo::listingNodes($property, $images)),
                $robots,
                self::preloadCopertina($images)
            ),
            'p' => $property,
            'images' => $images,
            'anteprima' => $anteprima,
            'simili' => Properties::search([
                'status' => 'online',
                'city' => $property['city'],
                'contract' => $property['contract'],
            ], 1, 4)['items'],
        ]);
    }

    /**
     * La foto grande della scheda è quasi sempre l'elemento LCP: si annuncia
     * nell'head così il browser la mette in coda subito, senza aspettare di
     * aver costruito il layout per accorgersene.
     *
     * @param array<int,array<string,mixed>> $images
     */
    private static function preloadCopertina(array $images): string
    {
        $prima = $images[0] ?? null;
        if ($prima === null) {
            return '';
        }

        return preload_image(
            (string) $prima['path'],
            (string) ($prima['srcset'] ?? ''),
            Assets::SIZES_GALLERIA
        );
    }

    /**
     * Stessa idea per gli elenchi: sopra la piega c'è la prima scheda della
     * griglia, ed è la sua immagine a fare da LCP.
     *
     * @param array<int,array<string,mixed>> $items
     */
    public static function preloadPrimaScheda(array $items): string
    {
        $prima = $items[0] ?? null;
        if ($prima === null) {
            return '';
        }

        $src = (string) ($prima['cover_thumb'] ?: ($prima['cover'] ?? ''));

        return preload_image($src, (string) ($prima['cover_srcset'] ?? ''), Assets::SIZES_CARD);
    }

    /** @param array<int,string> $allowed */
    private static function pick(string $value, array $allowed): string
    {
        return in_array($value, $allowed, true) ? $value : '';
    }
}
