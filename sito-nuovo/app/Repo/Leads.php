<?php

declare(strict_types=1);

namespace Mil\Repo;

use Mil\Core\Db;

final class Leads
{
    /**
     * @param array<string,mixed> $data
     * @return array{items:array<int,array<string,mixed>>,total:int,pages:int,page:int}
     */
    public static function search(array $data = [], int $page = 1, int $perPage = 25): array
    {
        $clauses = [];
        $params = [];

        if (!empty($data['status'])) {
            $clauses[] = 'l.status = :status';
            $params['status'] = $data['status'];
        }
        if (!empty($data['source'])) {
            $clauses[] = 'l.source = :source';
            $params['source'] = $data['source'];
        }
        if (!empty($data['q'])) {
            $clauses[] = '(l.name LIKE :q OR l.phone LIKE :q OR l.email LIKE :q OR l.message LIKE :q)';
            $params['q'] = '%' . $data['q'] . '%';
        }
        if (!empty($data['assigned_to'])) {
            $clauses[] = 'l.assigned_to = :assigned_to';
            $params['assigned_to'] = (int) $data['assigned_to'];
        }

        $where = $clauses === [] ? '1 = 1' : implode(' AND ', $clauses);
        $total = (int) Db::value("SELECT COUNT(*) FROM leads l WHERE {$where}", $params);
        $pages = max(1, (int) ceil($total / $perPage));
        $page = max(1, min($page, $pages));

        $items = Db::all(
            "SELECT l.*, p.title AS property_title, p.slug AS property_slug, u.name AS agent_name
             FROM leads l
             LEFT JOIN properties p ON p.id = l.property_id
             LEFT JOIN users u ON u.id = l.assigned_to
             WHERE {$where}
             ORDER BY l.created_at DESC
             LIMIT {$perPage} OFFSET " . (($page - 1) * $perPage),
            $params
        );

        return ['items' => $items, 'total' => $total, 'pages' => $pages, 'page' => $page];
    }

    /** @return array<string,mixed>|null */
    public static function find(int $id): ?array
    {
        return Db::one(
            'SELECT l.*, p.title AS property_title, p.slug AS property_slug, u.name AS agent_name
             FROM leads l
             LEFT JOIN properties p ON p.id = l.property_id
             LEFT JOIN users u ON u.id = l.assigned_to
             WHERE l.id = :id',
            ['id' => $id]
        );
    }

    /** @param array<string,mixed> $data */
    public static function create(array $data): int
    {
        $data['created_at'] = Db::now();
        return Db::insert('leads', $data);
    }

    /** @param array<string,mixed> $data */
    public static function update(int $id, array $data): void
    {
        $data['updated_at'] = Db::now();
        Db::update('leads', $id, $data);
    }

    /** @return array<int,array<string,mixed>> */
    public static function notes(int $leadId): array
    {
        return Db::all(
            'SELECT n.*, u.name AS user_name
             FROM lead_notes n LEFT JOIN users u ON u.id = n.user_id
             WHERE n.lead_id = :id ORDER BY n.created_at DESC',
            ['id' => $leadId]
        );
    }

    public static function addNote(int $leadId, ?int $userId, string $body): void
    {
        Db::insert('lead_notes', [
            'lead_id' => $leadId,
            'user_id' => $userId,
            'body' => $body,
            'created_at' => Db::now(),
        ]);
    }

    /**
     * Anti-spam per il modulo pubblico: massimo N invii per IP in una finestra.
     * Stesso criterio dello snippet in produzione (3 invii / 10 minuti).
     */
    public static function tooManyFrom(string $ip, int $max = 3, int $minutes = 10): bool
    {
        if ($ip === '') {
            return false;
        }
        $since = date('Y-m-d H:i:s', time() - $minutes * 60);
        $n = (int) Db::value(
            'SELECT COUNT(*) FROM leads WHERE ip = :ip AND created_at >= :since',
            ['ip' => $ip, 'since' => $since]
        );

        return $n >= $max;
    }

    /** @return array<string,int> */
    public static function counters(): array
    {
        $rows = Db::all('SELECT status, COUNT(*) AS n FROM leads GROUP BY status');
        $out = ['totale' => 0];
        foreach ($rows as $row) {
            $out[(string) $row['status']] = (int) $row['n'];
            $out['totale'] += (int) $row['n'];
        }
        $out['ultimi7'] = (int) Db::value(
            'SELECT COUNT(*) FROM leads WHERE created_at >= :since',
            ['since' => date('Y-m-d H:i:s', strtotime('-7 days'))]
        );

        return $out;
    }

    /** @return array<int,array<string,mixed>> */
    public static function latest(int $limit = 8): array
    {
        return Db::all(
            "SELECT l.*, p.title AS property_title
             FROM leads l LEFT JOIN properties p ON p.id = l.property_id
             ORDER BY l.created_at DESC LIMIT {$limit}"
        );
    }
}
