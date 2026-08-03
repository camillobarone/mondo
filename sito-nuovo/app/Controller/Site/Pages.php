<?php

declare(strict_types=1);

namespace Mil\Controller\Site;

use Mil\Core\Seo;
use Mil\Core\Settings;
use Mil\Core\View;
use Mil\Repo\Content;
use Mil\Repo\Properties;
use Mil\Repo\Redirects;

final class Pages
{
    public static function home(): void
    {
        $featured = Properties::search(['status' => 'online', 'featured' => 1], 1, 6);
        if ($featured['total'] === 0) {
            $featured = Properties::search(['status' => 'online'], 1, 6);
        }

        $pageUrl = Seo::base() . '/';
        $graph = [
            Seo::logoNode(),
            Seo::agentNode(),
            Seo::websiteNode(),
            [
                '@type' => 'WebPage',
                '@id' => $pageUrl . '#webpage',
                'url' => $pageUrl,
                'name' => Settings::get('home_seo_title', 'Agenzia immobiliare a Lecce e Porto Cesareo'),
                'isPartOf' => ['@id' => Seo::base() . '/#website'],
                'about' => ['@id' => Seo::base() . '/#agent'],
                'mainEntity' => ['@id' => Seo::base() . '/#agent'],
                'inLanguage' => 'it',
            ],
        ];

        View::show('site/home', [
            'meta' => self::meta(
                Settings::get('home_seo_title', 'Agenzia immobiliare a Lecce e Porto Cesareo'),
                Settings::get('home_seo_description', 'Agenzia immobiliare FIMAA dal 1994 a Lecce e Porto Cesareo. Vendita e valutazione di case, ville e appartamenti nel Salento.'),
                $pageUrl,
                Seo::graph($graph)
            ),
            'featured' => $featured['items'],
            'posts' => Content::posts(true, 1, 3)['items'],
            'cities' => Properties::citiesInUse(),
        ]);
    }

    public static function contatti(): void
    {
        $pageUrl = Seo::base() . '/contatti/';
        $graph = [
            Seo::logoNode(),
            Seo::agentNode(),
            Seo::agentPortoCesareoNode(),
            [
                '@type' => 'ContactPage',
                '@id' => $pageUrl . '#webpage',
                'url' => $pageUrl,
                'name' => 'Contatti',
                'about' => ['@id' => Seo::base() . '/#agent'],
                'inLanguage' => 'it',
            ],
            Seo::breadcrumbNode([
                ['name' => 'Home', 'url' => Seo::base() . '/'],
                ['name' => 'Contatti', 'url' => $pageUrl],
            ], $pageUrl),
        ];

        View::show('site/contatti', [
            'meta' => self::meta(
                'Contatti — Mondo Immobiliare Lecce e Porto Cesareo',
                'Le due sedi di Mondo Immobiliare: Lecce, Via Giuseppe Parini 48/a e Porto Cesareo, Via Francesco Cilea 76. Telefono, orari e modulo di contatto.',
                $pageUrl,
                Seo::graph($graph)
            ),
        ]);
    }

    public static function valutazione(): void
    {
        $pageUrl = Seo::base() . '/valutazione-gratuita/';

        // Le FAQ dello schema sono le stesse stampate in pagina: senza testo
        // visibile il markup violerebbe le linee guida.
        $faq = self::faqValutazione();

        $graph = [
            Seo::logoNode(),
            Seo::agentNode(),
            [
                '@type' => 'WebPage',
                '@id' => $pageUrl . '#webpage',
                'url' => $pageUrl,
                'name' => 'Valutazione gratuita della tua casa',
                'inLanguage' => 'it',
                'about' => ['@id' => Seo::base() . '/#agent'],
            ],
            Seo::faqNode($faq, $pageUrl),
            Seo::breadcrumbNode([
                ['name' => 'Home', 'url' => Seo::base() . '/'],
                ['name' => 'Valutazione gratuita', 'url' => $pageUrl],
            ], $pageUrl),
        ];

        View::show('site/valutazione', [
            'meta' => self::meta(
                'Valutazione gratuita della casa a Lecce e nel Salento',
                'Valutazione professionale e gratuita del tuo immobile a Lecce, Porto Cesareo e provincia. Risposta entro 48 ore da un agente FIMAA.',
                $pageUrl,
                Seo::graph($graph)
            ),
            'faq' => $faq,
        ]);
    }

    /** Redirect 301, poi pagine statiche, poi 404. In quest'ordine. */
    public static function catchAll(string $path): void
    {
        self::redirectIfKnown($path);

        $slug = trim($path, '/');
        $page = $slug === '' ? null : Content::pageBySlug($slug);

        if ($page === null || $page['status'] !== 'published') {
            self::notFound();
            return;
        }

        $pageUrl = Seo::base() . '/' . $page['slug'] . '/';
        $graph = [
            Seo::logoNode(),
            Seo::agentNode(),
            [
                '@type' => 'WebPage',
                '@id' => $pageUrl . '#webpage',
                'url' => $pageUrl,
                'name' => Seo::text((string) $page['title']),
                'inLanguage' => 'it',
                'publisher' => ['@id' => Seo::base() . '/#agent'],
            ],
            Seo::breadcrumbNode([
                ['name' => 'Home', 'url' => Seo::base() . '/'],
                ['name' => Seo::text((string) $page['title']), 'url' => $pageUrl],
            ], $pageUrl),
        ];

        View::show('site/pagina', [
            'meta' => self::meta(
                (string) ($page['seo_title'] ?: $page['title']),
                (string) ($page['seo_description'] ?: tronca((string) $page['body'], 155)),
                $pageUrl,
                Seo::graph($graph)
            ),
            'page' => $page,
        ]);
    }

    /**
     * Se il percorso è nella tabella dei reindirizzamenti, esce subito con
     * il 301. Vale anche per gli indirizzi che una rotta ha già intercettato
     * — un annuncio rinominato passa da qui, non dal 404.
     */
    public static function redirectIfKnown(?string $path = null): void
    {
        $path ??= (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
        $redirect = Redirects::match($path);

        if ($redirect !== null) {
            header('Location: ' . url((string) $redirect['to_path']), true, (int) $redirect['code']);
            exit;
        }
    }

    public static function notFound(): void
    {
        self::redirectIfKnown();

        http_response_code(404);
        View::show('site/404', [
            'meta' => self::meta('Pagina non trovata', '', Seo::base() . '/', '', 'noindex, follow'),
        ]);
    }

    /** @return array<int,array{q:string,a:string}> */
    public static function faqValutazione(): array
    {
        return [
            [
                'q' => 'Quanto costa la valutazione?',
                'a' => 'Niente. La valutazione dell’immobile è gratuita e non impegna a firmare alcun mandato di vendita.',
            ],
            [
                'q' => 'In quanto tempo ricevo la valutazione?',
                'a' => 'Entro 48 ore lavorative dalla richiesta un agente FIMAA vi ricontatta per fissare il sopralluogo e raccogliere i dati catastali.',
            ],
            [
                'q' => 'Su quali dati si basa la valutazione?',
                'a' => 'Sui prezzi reali delle compravendite chiuse in zona, sulle quotazioni OMI dell’Agenzia delle Entrate e sullo stato effettivo dell’immobile rilevato in sopralluogo.',
            ],
            [
                'q' => 'Valutate anche fuori Lecce?',
                'a' => 'Sì: Lecce e provincia, le marine (San Cataldo, Frigole, Torre Chianca) e la costa ionica da Porto Cesareo a Torre Lapillo, dove abbiamo la seconda sede.',
            ],
        ];
    }

    /** @return array<string,string> */
    public static function meta(
        string $title,
        string $description,
        string $canonical,
        string $jsonld = '',
        string $robots = 'index, follow',
        string $preload = ''
    ): array {
        return [
            // Limiti Rank Math applicati anche qui: 60 e 160 caratteri.
            'title' => mb_substr($title, 0, 60),
            'description' => mb_substr($description, 0, 160),
            'canonical' => $canonical,
            'jsonld' => $jsonld,
            'robots' => $robots,
            'preload' => $preload,
        ];
    }
}
