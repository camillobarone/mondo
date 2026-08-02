<?php

declare(strict_types=1);

namespace Mil\Repo;

use Mil\Core\Auth;
use Mil\Core\Db;

final class Users
{
    /** @return array<int,array<string,mixed>> */
    public static function all(): array
    {
        return Db::all('SELECT * FROM users ORDER BY active DESC, name');
    }

    /** @return array<int,array<string,mixed>> */
    public static function active(): array
    {
        return Db::all('SELECT * FROM users WHERE active = 1 ORDER BY name');
    }

    /** @return array<string,mixed>|null */
    public static function find(int $id): ?array
    {
        return Db::one('SELECT * FROM users WHERE id = :id', ['id' => $id]);
    }

    public static function emailTaken(string $email, ?int $ignoreId = null): bool
    {
        $sql = 'SELECT COUNT(*) FROM users WHERE email = :e';
        $params = ['e' => mb_strtolower(trim($email))];
        if ($ignoreId !== null) {
            $sql .= ' AND id <> :id';
            $params['id'] = $ignoreId;
        }

        return (int) Db::value($sql, $params) > 0;
    }

    /** @param array<string,mixed> $data */
    public static function create(array $data, string $password): int
    {
        $data['email'] = mb_strtolower(trim((string) $data['email']));
        $data['password_hash'] = Auth::hash($password);
        $data['created_at'] = Db::now();

        return Db::insert('users', $data);
    }

    /** @param array<string,mixed> $data */
    public static function update(int $id, array $data, string $password = ''): void
    {
        if (isset($data['email'])) {
            $data['email'] = mb_strtolower(trim((string) $data['email']));
        }
        if ($password !== '') {
            $data['password_hash'] = Auth::hash($password);
        }
        Db::update('users', $id, $data);
    }
}
