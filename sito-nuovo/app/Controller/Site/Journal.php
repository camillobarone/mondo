<?php

declare(strict_types=1);

namespace Mil\Controller\Site;

use Mil\Core\Seo;
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

    public static function show(string $slug): void
    {
        $post = Content::postBySlug($slug);

        if ($post === null || $post['status'] !== 'published') {
            Pages::notFound();
            return;
        }

        $pageUrl = Seo::base() . '/blog/' . $post['slug'] . '/';
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
        if (!empty($post['author_name'])) {
            $authorId = $pageUrl . '#author';
            $graph[] = [
                '@type' => 'Person',
                '@id' => $authorId,
                'name' => Seo::text((string) $post['author_name']),
                'worksFor' => [
                    '@type' => 'RealEstateAgent',
                    '@id' => Seo::base() . '/#agent',
                    'name' => 'Mondo Immobiliare Lecce',
                ],
            ];
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
                Seo::graph($graph)
            ),
            'post' => $post,
            'altri' => Content::posts(true, 1, 3)['items'],
        ]);
    }
}
