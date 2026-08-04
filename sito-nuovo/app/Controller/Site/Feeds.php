<?php

declare(strict_types=1);

namespace Mil\Controller\Site;

use Mil\Core\Db;
use Mil\Core\Seo;

/**
 * Sitemap e robots.txt generati dal database: nessun file da rigenerare a
 * mano, e nessuna URL dimenticata quando si pubblica un immobile.
 */
final class Feeds
{
    public static function sitemap(): void
    {
        header('Content-Type: application/xml; charset=UTF-8');

        $base = rtrim(Seo::base(), '/');
        $urls = [
            ['loc' => $base . '/', 'priority' => '1.0', 'lastmod' => date('Y-m-d')],
            ['loc' => $base . '/immobili/', 'priority' => '0.9', 'lastmod' => date('Y-m-d')],
            ['loc' => $base . '/valutazione-gratuita/', 'priority' => '0.9', 'lastmod' => date('Y-m-d')],
            ['loc' => $base . '/calcolatore-imposte-acquisto-casa/', 'priority' => '0.7', 'lastmod' => date('Y-m-d')],
            ['loc' => $base . '/blog/', 'priority' => '0.7', 'lastmod' => date('Y-m-d')],
            ['loc' => $base . '/contatti/', 'priority' => '0.6', 'lastmod' => date('Y-m-d')],
        ];

        // Gli immobili venduti restano online ma fuori dalla sitemap:
        // sono noindex, chiederne la scansione sarebbe un segnale sbagliato.
        foreach (Db::all("SELECT slug, updated_at, published_at, created_at FROM properties
                          WHERE status IN ('published','reserved') ORDER BY id DESC") as $row) {
            $urls[] = [
                'loc' => $base . '/immobili/' . $row['slug'] . '/',
                'priority' => '0.8',
                'lastmod' => substr((string) ($row['updated_at'] ?: $row['published_at'] ?: $row['created_at']), 0, 10),
            ];
        }

        foreach (Db::all("SELECT slug, updated_at, published_at, created_at FROM posts
                          WHERE status = 'published' ORDER BY id DESC") as $row) {
            $urls[] = [
                'loc' => $base . '/blog/' . $row['slug'] . '/',
                'priority' => '0.7',
                'lastmod' => substr((string) ($row['updated_at'] ?: $row['published_at'] ?: $row['created_at']), 0, 10),
            ];
        }

        foreach (Db::all("SELECT slug, updated_at, created_at FROM pages WHERE status = 'published'") as $row) {
            $urls[] = [
                'loc' => $base . '/' . $row['slug'] . '/',
                'priority' => '0.6',
                'lastmod' => substr((string) ($row['updated_at'] ?: $row['created_at']), 0, 10),
            ];
        }

        echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
        foreach ($urls as $url) {
            echo "  <url>\n";
            echo '    <loc>' . e($url['loc']) . "</loc>\n";
            echo '    <lastmod>' . e($url['lastmod']) . "</lastmod>\n";
            echo '    <priority>' . e($url['priority']) . "</priority>\n";
            echo "  </url>\n";
        }
        echo '</urlset>';
    }

    public static function robots(): void
    {
        header('Content-Type: text/plain; charset=UTF-8');

        $base = rtrim(Seo::base(), '/');

        // Su un'installazione di prova non si invita nessuno a entrare: sarebbe
        // una copia degli stessi immobili su un altro indirizzo, e il duplicato
        // lo pagherebbe il sito vero.
        if (\Mil\Core\Settings::get('noindex', '0') === '1') {
            echo "User-agent: *\n";
            echo "Disallow: /\n";
            return;
        }

        // Nessun blocco ai crawler AI: la visibilità nelle risposte generative
        // è un obiettivo, non un rischio da cui difendersi.
        echo "User-agent: *\n";
        echo "Allow: /\n";
        echo "Disallow: /gestionale/\n";
        echo "Disallow: /install.php\n";
        echo "\n";
        echo "Sitemap: {$base}/sitemap.xml\n";
    }
}
