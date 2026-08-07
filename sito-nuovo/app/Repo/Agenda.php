<?php

declare(strict_types=1);

namespace Mil\Repo;

use Mil\Core\Db;

/** Appuntamenti e attività degli agenti. */
final class Agenda
{
    /** @return array<int,array<string,mixed>> */
    public static function upcoming(int $limit = 20, ?int $userId = null): array
    {
        $params = ['now' => date('Y-m-d 00:00:00')];
        $filter = '';
        if ($userId !== null) {
            $filter = ' AND a.user_id = :uid';
            $params['uid'] = $userId;
        }

        return Db::all(
            "SELECT a.*, p.title AS property_title, c.name AS contact_name, u.name AS user_name
             FROM appointments a
             LEFT JOIN properties p ON p.id = a.property_id
             LEFT JOIN contacts c ON c.id = a.contact_id
             LEFT JOIN users u ON u.id = a.user_id
             WHERE a.done = 0 AND a.starts_at >= :now {$filter}
             ORDER BY a.starts_at LIMIT {$limit}",
            $params
        );
    }

    /** @return array<int,array<string,mixed>> */
    public static function all(bool $includeDone = false): array
    {
        $where = $includeDone ? '1 = 1' : 'a.done = 0';

        return Db::all(
            "SELECT a.*, p.title AS property_title, c.name AS contact_name, u.name AS user_name
             FROM appointments a
             LEFT JOIN properties p ON p.id = a.property_id
             LEFT JOIN contacts c ON c.id = a.contact_id
             LEFT JOIN users u ON u.id = a.user_id
             WHERE {$where}
             ORDER BY a.done, a.starts_at DESC LIMIT 200"
        );
    }

    /** @param array<string,mixed> $data */
    public static function create(array $data): int
    {
        $data['created_at'] = Db::now();
        return Db::insert('appointments', $data);
    }

    public static function toggleDone(int $id): void
    {
        Db::run('UPDATE appointments SET done = CASE done WHEN 1 THEN 0 ELSE 1 END WHERE id = :id', ['id' => $id]);
    }

    public static function delete(int $id): void
    {
        Db::delete('appointments', $id);
    }

    public static function countUpcoming(): int
    {
        return (int) Db::value(
            'SELECT COUNT(*) FROM appointments WHERE done = 0 AND starts_at >= :now',
            ['now' => date('Y-m-d 00:00:00')]
        );
    }
}
