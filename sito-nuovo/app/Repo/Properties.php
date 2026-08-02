<?php

declare(strict_types=1);

namespace Mil\Repo;

use Mil\Core\Db;

final class Properties
{
    /**
     * Ricerca con filtri. Tutti i valori passano da parametri legati:
     * nessuna stringa dell'utente finisce mai concatenata nell'SQL.
     *
     * @param array<string,mixed> $filters
     * @return array{items:array<int,array<string,mixed>>,total:int,pages:int,page:int}
     */
    public static function search(array $filters = [], int $page = 1, int $perPage = 12): array
    {
        [$where, $params] = self::buildWhere($filters);

        $total = (int) Db::value("SELECT COUNT(*) FROM properties p WHERE {$where}", $params);
        $pages = max(1, (int) ceil($total / $perPage));
        $page = max(1, min($page, $pages));

        $order = match ((string) ($filters['sort'] ?? '')) {
            'prezzo-asc' => 'CASE WHEN p.price IS NULL OR p.price = 0 THEN 1 ELSE 0 END, p.price ASC',
            'prezzo-desc' => 'p.price DESC',
            'mq-desc' => 'p.sqm DESC',
            default => 'p.featured DESC, COALESCE(p.published_at, p.created_at) DESC',
        };

        $sql = "SELECT p.*,
                       (SELECT path  FROM property_images i WHERE i.property_id = p.id ORDER BY i.sort, i.id LIMIT 1) AS cover,
                       (SELECT thumb FROM property_images i WHERE i.property_id = p.id ORDER BY i.sort, i.id LIMIT 1) AS cover_thumb
                FROM properties p
                WHERE {$where}
                ORDER BY {$order}
                LIMIT {$perPage} OFFSET " . (($page - 1) * $perPage);

        return [
            'items' => Db::all($sql, $params),
            'total' => $total,
            'pages' => $pages,
            'page' => $page,
        ];
    }

    /**
     * @param array<string,mixed> $filters
     * @return array{0:string,1:array<string,mixed>}
     */
    private static function buildWhere(array $filters): array
    {
        $clauses = [];
        $params = [];

        // Di default il sito pubblico mostra solo ciò che è online.
        $status = $filters['status'] ?? 'published';
        if ($status === 'online') {
            $clauses[] = "p.status IN ('published','reserved')";
        } elseif (is_string($status) && $status !== 'any') {
            $clauses[] = 'p.status = :status';
            $params['status'] = $status;
        }

        $simple = [
            'contract' => 'p.contract = :contract',
            'type' => 'p.type = :type',
            'city' => 'p.city = :city',
        ];
        foreach ($simple as $key => $clause) {
            if (!empty($filters[$key])) {
                $clauses[] = $clause;
                $params[$key] = $filters[$key];
            }
        }

        if (!empty($filters['price_min'])) {
            $clauses[] = 'p.price >= :price_min';
            $params['price_min'] = (float) $filters['price_min'];
        }
        if (!empty($filters['price_max'])) {
            $clauses[] = 'p.price > 0 AND p.price <= :price_max';
            $params['price_max'] = (float) $filters['price_max'];
        }
        if (!empty($filters['sqm_min'])) {
            $clauses[] = 'p.sqm >= :sqm_min';
            $params['sqm_min'] = (int) $filters['sqm_min'];
        }
        if (!empty($filters['bedrooms_min'])) {
            $clauses[] = 'p.bedrooms >= :bedrooms_min';
            $params['bedrooms_min'] = (int) $filters['bedrooms_min'];
        }
        if (!empty($filters['featured'])) {
            $clauses[] = 'p.featured = 1';
        }
        if (!empty($filters['q'])) {
            $clauses[] = '(p.title LIKE :q OR p.description LIKE :q OR p.city LIKE :q OR p.area LIKE :q OR p.ref LIKE :q)';
            $params['q'] = '%' . $filters['q'] . '%';
        }

        return [$clauses === [] ? '1 = 1' : implode(' AND ', $clauses), $params];
    }

    /** @return array<string,mixed>|null */
    public static function bySlug(string $slug): ?array
    {
        return Db::one('SELECT * FROM properties WHERE slug = :s', ['s' => $slug]);
    }

    /** @return array<string,mixed>|null */
    public static function find(int $id): ?array
    {
        return Db::one('SELECT * FROM properties WHERE id = :id', ['id' => $id]);
    }

    /** @return array<int,array<string,mixed>> */
    public static function images(int $propertyId): array
    {
        return Db::all(
            'SELECT * FROM property_images WHERE property_id = :id ORDER BY sort, id',
            ['id' => $propertyId]
        );
    }

    /** @param array<string,mixed> $data */
    public static function create(array $data): int
    {
        $data['slug'] = self::uniqueSlug($data['slug'] ?: (string) $data['title']);
        $data['ref'] = $data['ref'] ?: self::nextRef();
        $data['created_at'] = Db::now();
        $data['updated_at'] = Db::now();

        return Db::insert('properties', $data);
    }

    /** @param array<string,mixed> $data */
    public static function update(int $id, array $data): void
    {
        if (isset($data['slug'])) {
            $data['slug'] = self::uniqueSlug((string) $data['slug'], $id);
        }
        $data['updated_at'] = Db::now();
        Db::update('properties', $id, $data);
    }

    public static function delete(int $id): void
    {
        Db::run('DELETE FROM property_images WHERE property_id = :id', ['id' => $id]);
        Db::delete('properties', $id);
    }

    public static function incrementViews(int $id): void
    {
        Db::run('UPDATE properties SET views = views + 1 WHERE id = :id', ['id' => $id]);
    }

    /** Slug unico: se occupato aggiunge -2, -3, … invece di sovrascrivere. */
    public static function uniqueSlug(string $raw, ?int $ignoreId = null): string
    {
        $base = slugify($raw) ?: 'immobile';
        $slug = $base;
        $n = 1;

        while (true) {
            $sql = 'SELECT COUNT(*) FROM properties WHERE slug = :s';
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

    /** Codice progressivo tipo MIL-0042, comodo da dettare al telefono. */
    public static function nextRef(): string
    {
        $last = (int) Db::value('SELECT COUNT(*) FROM properties');
        do {
            $ref = 'MIL-' . str_pad((string) (++$last), 4, '0', STR_PAD_LEFT);
        } while ((int) Db::value('SELECT COUNT(*) FROM properties WHERE ref = :r', ['r' => $ref]) > 0);

        return $ref;
    }

    /** @return array<int,string> comuni con almeno un immobile online */
    public static function citiesInUse(): array
    {
        $rows = Db::all(
            "SELECT city, COUNT(*) AS n FROM properties
             WHERE status IN ('published','reserved') AND city <> ''
             GROUP BY city ORDER BY n DESC, city"
        );

        return array_map(static fn (array $r): string => (string) $r['city'], $rows);
    }

    /** @return array<string,int> conteggi per la dashboard */
    public static function counters(): array
    {
        $rows = Db::all('SELECT status, COUNT(*) AS n FROM properties GROUP BY status');
        $out = ['totale' => 0];
        foreach ($rows as $row) {
            $out[(string) $row['status']] = (int) $row['n'];
            $out['totale'] += (int) $row['n'];
        }

        return $out;
    }
}
