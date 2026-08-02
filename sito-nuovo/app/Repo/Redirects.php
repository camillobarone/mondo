<?php

declare(strict_types=1);

namespace Mil\Repo;

use Mil\Core\Db;

/**
 * Tabella dei reindirizzamenti 301.
 *
 * È il pezzo che decide se un cambio di sito conserva o brucia il
 * posizionamento: ogni URL che oggi è indicizzato deve rispondere 301 verso
 * il suo equivalente nuovo, non 404. Vedi docs/MIGRAZIONE-SEO.md.
 */
final class Redirects
{
    /** @return array<int,array<string,mixed>> */
    public static function all(): array
    {
        return Db::all('SELECT * FROM redirects ORDER BY hits DESC, from_path');
    }

    /** @return array<string,mixed>|null */
    public static function match(string $path): ?array
    {
        $path = '/' . trim($path, '/');
        $variants = $path === '/' ? ['/'] : [$path . '/', $path];

        foreach ($variants as $candidate) {
            $row = Db::one('SELECT * FROM redirects WHERE from_path = :p', ['p' => $candidate]);
            if ($row !== null) {
                Db::run(
                    'UPDATE redirects SET hits = hits + 1, last_hit_at = :now WHERE id = :id',
                    ['now' => Db::now(), 'id' => (int) $row['id']]
                );
                return $row;
            }
        }

        return null;
    }

    public static function put(string $from, string $to, int $code = 301): void
    {
        // Entrambi i percorsi in forma canonica, con lo slash finale: senza,
        // il 301 punterebbe a una URL che a sua volta redirige. Due hop dove
        // ne basta uno sono dispersione di segnale.
        $from = self::canonical($from);
        $to = str_starts_with($to, 'http') ? $to : self::canonical($to);

        $existing = Db::one('SELECT id FROM redirects WHERE from_path = :p', ['p' => $from]);

        if ($existing !== null) {
            Db::update('redirects', (int) $existing['id'], ['to_path' => $to, 'code' => $code]);
            return;
        }

        Db::insert('redirects', [
            'from_path' => $from,
            'to_path' => $to,
            'code' => $code,
            'created_at' => Db::now(),
        ]);
    }

    public static function delete(int $id): void
    {
        Db::delete('redirects', $id);
    }

    /** Percorso con lo slash finale; la home resta "/". */
    private static function canonical(string $path): string
    {
        $trimmed = trim($path, '/');
        return $trimmed === '' ? '/' : '/' . $trimmed . '/';
    }
}
