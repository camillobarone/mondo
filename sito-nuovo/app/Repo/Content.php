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
     * Slug unico dentro una tabella. Il nome della tabella non arriva mai
     * dall'utente: è passato dal codice fra i due valori ammessi.
     */
    private static function uniqueSlug(string $table, string $raw, ?int $ignoreId = null): string
    {
        $table = $table === 'posts' ? 'posts' : 'pages';
        $base = slugify($raw) ?: 'contenuto';
        $slug = $base;
        $n = 1;

        while (true) {
            $sql = "SELECT COUNT(*) FROM {$table} WHERE slug = :s";
            $params = ['s' => $slug];
            if ($ignoreId !== null) {
                $sql .= ' AND id <> :id';
                $params['id'] = $ignoreId;
            }
            if ((int) Db::value($sql, $params) === 0) {
                return $slug;
            }
            $slug = $base . '-' . (++$n);
        }
    }
}
