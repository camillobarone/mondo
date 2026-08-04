<?php

declare(strict_types=1);

namespace Mil\Controller\Site;

use Mil\Core\Imposte;
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
                Seo::graph($graph),
                'index, follow',
                // Adesso l'LCP della home è la foto dell'hero, non più il
                // titolo: va annunciata, altrimenti il browser la scopre
                // solo a layout costruito.
                self::preloadHero($featured['items'])
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
    /**
     * Calcolatore delle imposte d'acquisto.
     *
     * Il modulo va in GET e non in POST: il risultato ha un indirizzo suo, si
     * può mandare a un cliente per email o rileggere il giorno dopo, e la
     * pagina resta memorizzabile in cache. In cambio la pagina col risultato
     * esce `noindex`: sono combinazioni infinite dello stesso contenuto, e
     * indicizzarle vorrebbe dire riempire Google di pagine sottili.
     */
    public static function calcolatore(): void
    {
        $pageUrl = Seo::base() . '/calcolatore-imposte-acquisto-casa/';

        $compilato = q('rendita') !== '' || q('prezzo') !== '';
        $dati = [
            'prima' => q('casa', 'prima') !== 'seconda',
            'impresa' => q('venditore') === 'impresa',
            'lusso' => q('lusso') === '1',
            'rendita' => float_or_null(q('rendita')),
            'prezzo' => float_or_null(q('prezzo')),
        ];

        $faq = self::faqImposte();

        $graph = [
            Seo::logoNode(),
            Seo::agentNode(),
            [
                '@type' => 'WebPage',
                '@id' => $pageUrl . '#webpage',
                'url' => $pageUrl,
                'name' => 'Calcolo delle imposte sull’acquisto della casa',
                'inLanguage' => 'it',
                'about' => ['@id' => Seo::base() . '/#agent'],
            ],
            Seo::faqNode($faq, $pageUrl),
            Seo::breadcrumbNode([
                ['name' => 'Home', 'url' => Seo::base() . '/'],
                ['name' => 'Calcolo imposte d’acquisto', 'url' => $pageUrl],
            ], $pageUrl),
        ];

        View::show('site/calcolatore', [
            'meta' => self::meta(
                'Calcolo imposte acquisto casa a Lecce e nel Salento',
                'Calcola registro, IVA, ipotecaria e catastale sull’acquisto della casa: prima o seconda casa, da privato o da costruttore. Aliquote 2026.',
                $pageUrl,
                Seo::graph($graph),
                $compilato ? 'noindex, follow' : 'index, follow'
            ),
            'dati' => $dati,
            'compilato' => $compilato,
            'esito' => $compilato ? Imposte::calcola($dati) : null,
            'faq' => $faq,
        ]);
    }

    /**
     * Le domande sono quelle della guida «Imposte Acquisto Casa» del sito
     * dell'agenzia, accorciate: stesse risposte, stessi numeri. Se un giorno
     * cambiano lì, vanno cambiate anche qui — è l'unico punto del sito nuovo
     * in cui un contenuto vive in due posti, e va detto invece che nascosto.
     *
     * @return array<int,array{q:string,a:string}>
     */
    public static function faqImposte(): array
    {
        return [
            [
                'q' => 'Come si calcola il valore catastale?',
                'a' => 'Si prende la rendita catastale, che sta nella visura o nell’atto di provenienza, '
                    . 'e la si moltiplica per 115,5 se è prima casa o per 126 se è seconda casa. '
                    . 'Su quel valore si applica l’aliquota: 2% per la prima casa, 9% per la seconda, '
                    . 'con un minimo di 1.000 euro in entrambi i casi.',
            ],
            [
                'q' => 'Quando si paga l’IVA invece dell’imposta di registro?',
                'a' => 'Quando il venditore è un’impresa costruttrice o ristrutturatrice e la vendita '
                    . 'avviene entro cinque anni dalla fine dei lavori. In quel caso l’imposta di registro '
                    . 'diventa fissa a 200 euro e si paga l’IVA sul prezzo dichiarato: 4% prima casa, '
                    . '10% seconda casa, 22% per le case di lusso nelle categorie A/1, A/8 e A/9.',
            ],
            [
                'q' => 'Perché il calcolo parte dalla rendita e non dal prezzo?',
                'a' => 'Per la regola del prezzo-valore: quando l’acquirente è un privato e chiede '
                    . 'espressamente al notaio di applicarla, le imposte si calcolano sul valore catastale '
                    . 'anche se il prezzo pagato è più alto. Nel Salento il valore catastale è di solito '
                    . 'il 40-60% del valore reale, quindi il risparmio è concreto.',
            ],
            [
                'q' => 'Il totale comprende anche il notaio e la provvigione?',
                'a' => 'No. Qui ci sono solo le imposte dovute allo Stato sull’atto di acquisto. '
                    . 'L’onorario del notaio, l’imposta di bollo, la tassa ipotecaria e la provvigione '
                    . 'dell’agenzia sono voci separate e vanno aggiunte a parte.',
            ],
        ];
    }

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

    /**
     * L'immobile che dà la foto all'hero: il primo che ne ha davvero una.
     *
     * Non il primo e basta: se quello in cima non ha ancora le foto, la home
     * resterebbe senza immagine per un motivo che non c'entra niente con
     * quale immobile si vuole mettere in vetrina.
     *
     * @param array<int,array<string,mixed>> $featured
     * @return array<string,mixed>|null
     */
    public static function heroImage(array $featured): ?array
    {
        foreach ($featured as $p) {
            if (trim((string) ($p['cover'] ?? '')) !== '') {
                return $p;
            }
        }

        return null;
    }

    /**
     * Preload della foto dell'hero. Occupa tutta la larghezza, quindi le
     * `sizes` sono `100vw` e devono coincidere con quelle del tag.
     *
     * @param array<int,array<string,mixed>> $featured
     */
    private static function preloadHero(array $featured): string
    {
        $hero = self::heroImage($featured);
        if ($hero === null) {
            return '';
        }

        return preload_image((string) $hero['cover'], (string) ($hero['cover_srcset'] ?? ''), '100vw');
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
