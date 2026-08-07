<?php

declare(strict_types=1);

namespace Mil\Controller\Site;

use Mil\Core\Seo;
use Mil\Core\Testo;
use Mil\Core\View;
use Mil\Repo\Content;

final class Journal
{
    public static function index(): void
    {
        $page = max(1, (int) q('pagina', '1'));
        $result = Content::posts(true, $page, 10);
        $pageUrl = Seo::base() . '/blog/';

        $graph = [
            Seo::logoNode(),
            Seo::agentNode(),
            [
                '@type' => 'CollectionPage',
                '@id' => $pageUrl . '#webpage',
                'url' => $pageUrl,
                'name' => 'Blog',
                'inLanguage' => 'it',
                'publisher' => ['@id' => Seo::base() . '/#agent'],
            ],
            Seo::breadcrumbNode([
                ['name' => 'Home', 'url' => Seo::base() . '/'],
                ['name' => 'Blog', 'url' => $pageUrl],
            ], $pageUrl),
        ];

        View::show('site/blog', [
            'meta' => Pages::meta(
                'Blog — mercato immobiliare di Lecce e del Salento',
                'Analisi, prezzi e guide pratiche su compravendita, fisco e mercato immobiliare a Lecce, Porto Cesareo e provincia.',
                $pageUrl,
                Seo::graph($graph),
                $page > 1 ? 'noindex, follow' : 'index, follow'
            ),
            'result' => $result,
        ]);
    }

    /**
     * L'articolo, servito alla radice: `/imposte-acquisto-casa/`.
     *
     * Torna `false` invece di stampare il 404, perché chi la chiama — il
     * fallback di Pages — deve poter continuare a cercare altrove: alla
     * radice ci stanno anche le pagine statiche, e chi arriva qui è già
     * l'ultimo tentativo prima del 404.
     */
    public static function show(string $slug): bool
    {
        $post = Content::postBySlug($slug);

        if ($post === null || $post['status'] !== 'published') {
            return false;
        }

        self::render($post);

        return true;
    }

    /**
     * Disegna un articolo. Separato da show() per lo stesso motivo di
     * Pages::renderPage(): serve anche all'anteprima del gestionale, che deve
     * poter mostrare una bozza — l'unico momento in cui guardarla è utile.
     *
     * @param array<string,mixed> $post
     */
    public static function render(array $post, bool $anteprima = false): void
    {
        $pageUrl = Seo::base() . '/' . $post['slug'] . '/';
        $published = substr((string) ($post['published_at'] ?: $post['created_at']), 0, 10);

        $article = [
            '@type' => 'BlogPosting',
            '@id' => $pageUrl . '#post',
            'headline' => Seo::text((string) $post['title']),
            'description' => Seo::text((string) ($post['excerpt'] ?: tronca((string) $post['body'], 200))),
            'url' => $pageUrl,
            'datePublished' => $published,
            'dateModified' => substr((string) ($post['updated_at'] ?: $post['published_at'] ?: $post['created_at']), 0, 10),
            'inLanguage' => 'it',
            'publisher' => ['@id' => Seo::base() . '/#agent'],
            'mainEntityOfPage' => ['@id' => $pageUrl . '#webpage'],
        ];

        $graph = [Seo::logoNode(), Seo::agentNode()];

        // L'autore è un nodo Person top-level, non inline nell'articolo.
        //
        // `worksFor` punta a `#agent`, che porta con sé il collegamento a
        // Wikidata e ai profili verificati: la persona eredita da lì
        // l'aggancio alle entità note, senza doverlo ripetere qui.
        if (!empty($post['author_name'])) {
            $authorId = $pageUrl . '#author';
            $persona = [
                '@type' => 'Person',
                '@id' => $authorId,
                'name' => Seo::text((string) $post['author_name']),
                'jobTitle' => 'Agente immobiliare',
                'worksFor' => [
                    '@type' => 'RealEstateAgent',
                    '@id' => Seo::base() . '/#agent',
                    'name' => 'Mondo Immobiliare Lecce',
                ],
            ];

            // Chi firma, e con quale esperienza. È il segnale che distingue
            // un articolo scritto da qualcuno che il mestiere lo fa da uno
            // che rimastica quel che si trova in giro.
            $bio = Seo::text((string) ($post['author_bio'] ?? ''));
            if ($bio !== '') {
                $persona['description'] = $bio;
            }

            $graph[] = $persona;
            $article['author'] = ['@id' => $authorId];
        }

        $graph[] = [
            '@type' => 'WebPage',
            '@id' => $pageUrl . '#webpage',
            'url' => $pageUrl,
            'name' => Seo::text((string) $post['title']),
            'inLanguage' => 'it',
            'mainEntity' => ['@id' => $pageUrl . '#post'],
        ];
        $graph[] = $article;

        // Anche gli articoli: molti dei 56 importati chiudono con un blocco
        // di domande frequenti, che sul sito vecchio Rank Math marcava e qui
        // altrimenti resterebbe testo semplice.
        $faq = Testo::faq((string) ($post['body'] ?? ''));
        if ($faq !== []) {
            $graph[] = Seo::faqNode($faq, $pageUrl);
        }

        $graph[] = Seo::breadcrumbNode([
            ['name' => 'Home', 'url' => Seo::base() . '/'],
            ['name' => 'Blog', 'url' => Seo::base() . '/blog/'],
            ['name' => Seo::text((string) $post['title']), 'url' => $pageUrl],
        ], $pageUrl);

        View::show('site/articolo', [
            'meta' => Pages::meta(
                (string) ($post['seo_title'] ?: $post['title']),
                (string) ($post['seo_description'] ?: tronca((string) ($post['excerpt'] ?: $post['body']), 155)),
                $pageUrl,
                Seo::graph($graph),
                $anteprima ? 'noindex, nofollow' : 'index, follow',
                '',
                (string) ($post['cover'] ?? '')
            ),
            'post' => $post,
            // Se ne prendono quattro per poterne scartare uno: l'articolo che
            // si sta leggendo è quasi sempre fra i più recenti, e scartarlo
            // qui — invece che nella pagina — evita il caso in cui resta il
            // titolo «Altri articoli» con sotto un elenco vuoto.
            'altri' => array_slice(array_values(array_filter(
                Content::posts(true, 1, 4)['items'],
                static fn (array $a): bool => (int) $a['id'] !== (int) $post['id']
            )), 0, 3),
        ]);
    }
}
