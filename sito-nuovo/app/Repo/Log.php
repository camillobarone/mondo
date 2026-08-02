<?php

declare(strict_types=1);

namespace Mil\Repo;

use Mil\Core\Auth;
use Mil\Core\Db;
use Throwable;

/** Traccia chi ha fatto cosa nel gestionale. */
final class Log
{
    public static function write(string $action, string $entity = '', ?int $entityId = null, string $detail = ''): void
    {
        try {
            Db::insert('activity_log', [
                'user_id' => Auth::id(),
                'action' => $action,
                'entity' => $entity,
                'entity_id' => $entityId,
                'detail' => mb_substr($detail, 0, 255),
                'created_at' => Db::now(),
            ]);
        } catch (Throwable) {
            // Il log non deve mai far fallire l'operazione che stava tracciando.
        }
    }

    /** @return array<int,array<string,mixed>> */
    public static function latest(int $limit = 30): array
    {
        return Db::all(
            "SELECT a.*, u.name AS user_name
             FROM activity_log a LEFT JOIN users u ON u.id = a.user_id
             ORDER BY a.created_at DESC LIMIT {$limit}"
        );
    }
}
