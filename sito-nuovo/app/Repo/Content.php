<?php

declare(strict_types=1);

namespace Mil\Repo;

use Mil\Core\Db;

/** Articoli del blog e pagine statiche. */
final class Content
{
    // ------------------------------------------------------------ articoli

    /** @return array{items:array<int,array<string,mixed>>,total:int,pages:int,page:int} */
    public static function posts(bool $onlyPublished = true, int $page = 1, int $perPage = 10): array
    {
        $where = $onlyPublished ? "p.status = 'published'" : '1 = 1';
        $total = (int) Db::value("SELECT COUNT(*) FROM posts p WHERE {$where}");
        $pages = max(1, (int) ceil($total / $perPage));
        $page = max(1, min($page, $pages));

        $items = Db::all(
            "SELECT p.*, u.name AS author_name
             FROM posts p LEFT JOIN users u ON u.id = p.author_id
             WHERE {$where}
             ORDER BY COALESCE(p.published_at, p.created_at) DESC
             LIMIT {$perPage} OFFSET " . (($page - 1) * $perPage)
        );

        return ['items' => $items, 'total' => $total, 'pages' => $pages, 'page' => $page];
    }

    /** @return array<string,mixed>|null */
    public static function postBySlug(string $slug): ?array
    {
        return Db::one(
            'SELECT p.*, u.name AS author_name, u.bio AS author_bio
             FROM posts p LEFT JOIN users u ON u.id = p.author_id
             WHERE p.slug = :s',
            ['s' => $slug]
        );
    }

    /** @return array<string,mixed>|null */
    public static function post(int $id): ?array
    {
        return Db::one('SELECT * FROM posts WHERE id = :id', ['id' => $id]);
    }

    /** @param array<string,mixed> $data */
    public static function createPost(array $data): int
    {
        $data['slug'] = self::uniqueSlug('posts', $data['slug'] ?: (string) $data['title']);
        $data['created_at'] = Db::now();
        return Db::insert('posts', $data);
    }

    /** @param array<string,mixed> $data */
    public static function updatePost(int $id, array $data): void
    {
        if (isset($data['slug'])) {
            $data['slug'] = self::uniqueSlug('posts', (string) $data['slug'], $id);
        }
        $data['updated_at'] = Db::now();
        Db::update('posts', $id, $data);
    }

    public static function deletePost(int $id): void
    {
        Db::delete('posts', $id);
    }

    // ------------------------------------------------------------- pagine

    /** @return array<int,array<string,mixed>> */
    public static function pages(bool $onlyPublished = true): array
    {
        $where = $onlyPublished ? "status = 'published'" : '1 = 1';
        return Db::all("SELECT * FROM pages WHERE {$where} ORDER BY title");
    }

    /** @return array<string,mixed>|null */
    public static function pageBySlug(string $slug): ?array
    {
        return Db::one('SELECT * FROM pages WHERE slug = :s', ['s' => $slug]);
    }

    /**
     * Esiste una pagina pubblicata con questo indirizzo?
     *
     * Serve dove il codice nomina una pagina che deve ancora essere scritta —
     * il piè di pagina che rimanda all'informativa, lo schema che rimanda alla
     * sede di Porto Cesareo. Senza questo controllo si pubblicano collegamenti
     * che portano a un 404, che è peggio del collegamento mancante: chi lo
     * segue si trova davanti a un errore, e chi legge lo schema si porta via
     * un indirizzo che non risponde.
     *
     * L'elenco si legge una volta sola per richiesta: sono poche decine di
     * righe e le pagine che lo interrogano lo fanno più volte a testa.
     */
    public static function pagePubblicata(string $slug): bool
    {
        static $slugs = null;

        if ($slugs === null) {
            $slugs = array_column(Db::all("SELECT slug FROM pages WHERE status = 'published'"), 'slug');
        }

        return in_array($slug, $slugs, true);
    }

    /** @return array<string,mixed>|null */
    public static function page(int $id): ?array
    {
        return Db::one('SELECT * FROM pages WHERE id = :id', ['id' => $id]);
    }

    /** @param array<string,mixed> $data */
    public static function createPage(array $data): int
    {
        $data['slug'] = self::uniqueSlug('pages', $data['slug'] ?: (string) $data['title']);
        $data['created_at'] = Db::now();
        return Db::insert('pages', $data);
    }

    /** @param array<string,mixed> $data */
    public static function updatePage(int $id, array $data): void
    {
        if (isset($data['slug'])) {
            $data['slug'] = self::uniqueSlug('pages', (string) $data['slug'], $id);
        }
        $data['updated_at'] = Db::now();
        Db::update('pages', $id, $data);
    }

    public static function deletePage(int $id): void
    {
        Db::delete('pages', $id);
    }

    /**
     * Slug che una pagina o un articolo non può prendersi, perché alla
     * radice risponde già una rotta fissa. Senza questo elenco una pagina
     * chiamata «Contatti» prenderebbe lo slug `contatti` e resterebbe
     * invisibile per sempre: la rotta vince, e nessuno capisce perché.
     */
    private const RISERVATI = [
        'immobili',
        'blog',
        'contatti',
        'valutazione-gratuita',
        'calcolatore-imposte-acquisto-casa',
        'invia-richiesta',
        'gestionale',
        'assets',
        'uploads',
        'robots',
        'sitemap',
    ];

    /**
     * Slug unico. Il nome della tabella non arriva mai dall'utente: è
     * passato dal codice fra i due valori ammessi.
     *
     * L'unicità è fra le due tabelle, non dentro una sola: articoli e pagine
     * abitano entrambi la radice del sito, quindi un articolo e una pagina
     * con lo stesso slug sarebbero due contenuti allo stesso indirizzo, e
     * uno dei due non si vedrebbe mai.
     */
    private static function uniqueSlug(string $table, string $raw, ?int $ignoreId = null): string
    {
        $table = $table === 'posts' ? 'posts' : 'pages';
        $base = slugify($raw) ?: 'contenuto';
        $slug = $base;
        $n = 1;

        while (self::slugOccupato($table, $slug, $ignoreId)) {
            $slug = $base . '-' . (++$n);
        }

        return $slug;
    }

    private static function slugOccupato(string $table, string $slug, ?int $ignoreId): bool
    {
        if (in_array($slug, self::RISERVATI, true)) {
            return true;
        }

        foreach (['posts', 'pages'] as $altra) {
            $sql = "SELECT COUNT(*) FROM {$altra} WHERE slug = :s";
            $params = ['s' => $slug];

            // L'esclusione vale solo per la riga che si sta salvando, e
            // quindi solo nella sua tabella: un id uguale nell'altra è un
            // contenuto diverso.
            if ($altra === $table && $ignoreId !== null) {
                $sql .= ' AND id <> :id';
                $params['id'] = $ignoreId;
            }

            if ((int) Db::value($sql, $params) > 0) {
                return true;
            }
        }

        return false;
    }
}
