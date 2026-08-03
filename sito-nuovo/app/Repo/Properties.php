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
                       (SELECT thumb  FROM property_images i WHERE i.property_id = p.id ORDER BY i.sort, i.id LIMIT 1) AS cover_thumb,
                       (SELECT srcset FROM property_images i WHERE i.property_id = p.id ORDER BY i.sort, i.id LIMIT 1) AS cover_srcset
                FROM properties p
                WHERE {$where}
                ORDER BY {$order}
                LIMIT {$perPage} OFFSET " . (($page - 1) * $perPage);

        $items = Db::all($sql, $params);

        // Il prezzo minimo del proprietario non esce da qui. search() alimenta
        // anche le pagine pubbliche: toglierlo alla fonte vale più che
        // ricordarsi di non stamparlo in ogni template. Chi ne ha diritto lo
        // legge con find(), che è usato solo dal gestionale.
        foreach ($items as $i => $item) {
            unset($items[$i]['min_price']);
        }

        return [
            'items' => $items,
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
            'deal_stage' => 'p.deal_stage = :deal_stage',
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

    /**
     * Testo alternativo delle foto. Non è un dettaglio: è quello che legge
     * chi non vede l'immagine, ed è anche l'unico testo che Google associa
     * alla foto. Si aggiorna solo ciò che appartiene a questo immobile.
     *
     * @param array<int|string,mixed> $alt descrizioni indicizzate per id immagine
     */
    public static function saveImageAlts(int $propertyId, array $alt): void
    {
        foreach (self::images($propertyId) as $img) {
            $id = (int) $img['id'];
            if (!array_key_exists($id, $alt)) {
                continue;
            }
            $nuovo = mb_substr(trim((string) $alt[$id]), 0, 255);
            if ($nuovo !== (string) $img['alt']) {
                Db::update('property_images', $id, ['alt' => $nuovo]);
            }
        }
    }

    /** Sposta una foto di un posto in su (-1) o in giù (+1). */
    public static function moveImage(int $propertyId, int $imageId, int $delta): void
    {
        $ids = array_map(static fn (array $i): int => (int) $i['id'], self::images($propertyId));
        $posizione = array_search($imageId, $ids, true);
        $destinazione = $posizione === false ? -1 : $posizione + $delta;

        if ($posizione === false || $destinazione < 0 || $destinazione >= count($ids)) {
            return;
        }

        [$ids[$posizione], $ids[$destinazione]] = [$ids[$destinazione], $ids[$posizione]];
        self::writeImageOrder($ids);
    }

    /**
     * Porta una foto in prima posizione. La prima è la copertina ovunque:
     * nelle schede in griglia, nell'anteprima social e nello schema.
     */
    public static function setCoverImage(int $propertyId, int $imageId): void
    {
        $ids = array_map(static fn (array $i): int => (int) $i['id'], self::images($propertyId));
        if (!in_array($imageId, $ids, true)) {
            return;
        }

        array_unshift($ids, $imageId);
        self::writeImageOrder(array_values(array_unique($ids)));
    }

    /** @param array<int,int> $ids nell'ordine voluto */
    private static function writeImageOrder(array $ids): void
    {
        foreach ($ids as $posizione => $id) {
            Db::update('property_images', $id, ['sort' => $posizione + 1]);
        }
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

    /**
     * @param array<string,mixed> $data
     * @param string $reason motivo della variazione di prezzo, se c'è
     */
    public static function update(int $id, array $data, string $reason = ''): void
    {
        if (isset($data['slug'])) {
            $data['slug'] = self::uniqueSlug((string) $data['slug'], $id);
        }

        // Il prezzo non si sovrascrive in silenzio: ogni variazione lascia
        // una riga nello storico, con il valore da cui si è partiti.
        if (array_key_exists('price', $data)) {
            $before = Db::value('SELECT price FROM properties WHERE id = :id', ['id' => $id]);
            $old = $before === null ? null : (float) $before;
            $new = $data['price'] === null ? null : (float) $data['price'];

            if ($old !== $new) {
                Db::insert('price_history', [
                    'property_id' => $id,
                    'price' => $new,
                    'previous_price' => $old,
                    'reason' => mb_substr($reason, 0, 255),
                    'user_id' => \Mil\Core\Auth::id(),
                    'created_at' => Db::now(),
                ]);
            }
        }

        $data['updated_at'] = Db::now();
        Db::update('properties', $id, $data);
    }

    /** @return array<int,array<string,mixed>> storico prezzi, dal più recente */
    public static function priceHistory(int $propertyId): array
    {
        return Db::all(
            'SELECT h.*, u.name AS user_name
             FROM price_history h LEFT JOIN users u ON u.id = h.user_id
             WHERE h.property_id = :id ORDER BY h.created_at DESC, h.id DESC',
            ['id' => $propertyId]
        );
    }

    /**
     * Incarichi in scadenza entro N giorni. È la domanda che nessuno si
     * ricorda di fare finché l'immobile non è già andato a un'altra agenzia.
     *
     * @return array<int,array<string,mixed>>
     */
    public static function mandatesExpiring(int $days = 45): array
    {
        return Db::all(
            "SELECT p.*, u.name AS agent_name
             FROM properties p LEFT JOIN users u ON u.id = p.agent_id
             WHERE p.mandate_end IS NOT NULL
               AND p.mandate_end <> ''
               AND p.mandate_end <= :limite
               AND p.deal_stage NOT IN ('rogitato','ritirato')
             ORDER BY p.mandate_end",
            ['limite' => date('Y-m-d', strtotime('+' . $days . ' days'))]
        );
    }

    /** @return array<string,int> conteggi per stato della trattativa */
    public static function stageCounters(): array
    {
        $out = [];
        foreach (Db::all('SELECT deal_stage, COUNT(*) AS n FROM properties GROUP BY deal_stage') as $row) {
            $out[(string) $row['deal_stage']] = (int) $row['n'];
        }

        return $out;
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
