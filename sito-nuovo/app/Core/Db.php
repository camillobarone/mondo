<?php

declare(strict_types=1);

namespace Mil\Core;

use PDO;
use PDOStatement;
use RuntimeException;

/**
 * Accesso al database via PDO, con due driver:
 *   - mysql  → produzione su SiteGround
 *   - sqlite → prova in locale (php -S) senza installare nulla
 *
 * Lo schema in db/schema.sql è scritto con dei token ({PK}, {NOW}, {SUFFIX})
 * risolti qui: una sola definizione, due dialetti.
 */
final class Db
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $driver = (string) Config::get('db_driver');

        if ($driver === 'sqlite') {
            $file = (string) Config::get('db_file');
            $dir = dirname($file);
            if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
                throw new RuntimeException("Impossibile creare la cartella del database: {$dir}");
            }
            $pdo = new PDO('sqlite:' . $file, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
            $pdo->exec('PRAGMA foreign_keys = ON');
            $pdo->exec('PRAGMA journal_mode = WAL');
        } elseif ($driver === 'mysql') {
            $dsn = sprintf(
                'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
                (string) Config::get('db_host'),
                (int) Config::get('db_port'),
                (string) Config::get('db_name')
            );
            $pdo = new PDO($dsn, (string) Config::get('db_user'), (string) Config::get('db_pass'), [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        } else {
            throw new RuntimeException("Driver database non supportato: {$driver}");
        }

        return self::$pdo = $pdo;
    }

    public static function driver(): string
    {
        return (string) Config::get('db_driver');
    }

    /** Chiude la connessione (usato dall'installer dopo aver creato lo schema). */
    public static function reset(): void
    {
        self::$pdo = null;
    }

    /** @param array<string|int,mixed> $params */
    public static function run(string $sql, array $params = []): PDOStatement
    {
        $stmt = self::pdo()->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    /**
     * @param array<string|int,mixed> $params
     * @return array<int,array<string,mixed>>
     */
    public static function all(string $sql, array $params = []): array
    {
        /** @var array<int,array<string,mixed>> $rows */
        $rows = self::run($sql, $params)->fetchAll();
        return $rows;
    }

    /**
     * @param array<string|int,mixed> $params
     * @return array<string,mixed>|null
     */
    public static function one(string $sql, array $params = []): ?array
    {
        $row = self::run($sql, $params)->fetch();
        return $row === false ? null : $row;
    }

    /** @param array<string|int,mixed> $params */
    public static function value(string $sql, array $params = []): mixed
    {
        $value = self::run($sql, $params)->fetchColumn();
        return $value === false ? null : $value;
    }

    /**
     * INSERT da array associativo. Restituisce l'id generato.
     *
     * @param array<string,mixed> $data
     */
    public static function insert(string $table, array $data): int
    {
        $cols = array_keys($data);
        $sql = sprintf(
            'INSERT INTO %s (%s) VALUES (%s)',
            $table,
            implode(', ', $cols),
            implode(', ', array_map(static fn (string $c): string => ':' . $c, $cols))
        );
        self::run($sql, $data);
        return (int) self::pdo()->lastInsertId();
    }

    /**
     * UPDATE da array associativo su chiave primaria `id`.
     *
     * @param array<string,mixed> $data
     */
    public static function update(string $table, int $id, array $data): void
    {
        if ($data === []) {
            return;
        }
        $sets = implode(', ', array_map(static fn (string $c): string => "{$c} = :{$c}", array_keys($data)));
        $data['__id'] = $id;
        self::run("UPDATE {$table} SET {$sets} WHERE id = :__id", $data);
    }

    public static function delete(string $table, int $id): void
    {
        self::run("DELETE FROM {$table} WHERE id = :id", ['id' => $id]);
    }

    /** Traduce lo schema neutro nel dialetto del driver attivo. */
    public static function dialect(string $sql): string
    {
        if (self::driver() === 'sqlite') {
            return strtr($sql, [
                '{PK}' => 'INTEGER PRIMARY KEY AUTOINCREMENT',
                '{NOW}' => "(datetime('now','localtime'))",
                '{SUFFIX}' => '',
                '{TEXT}' => 'TEXT',
                '{MONEY}' => 'NUMERIC',
            ]);
        }

        return strtr($sql, [
            '{PK}' => 'INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY',
            '{NOW}' => 'CURRENT_TIMESTAMP',
            '{SUFFIX}' => ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
            '{TEXT}' => 'TEXT',
            '{MONEY}' => 'DECIMAL(12,2)',
        ]);
    }

    /** Esegue un file .sql (schema o seed) istruzione per istruzione. */
    public static function runScript(string $file): void
    {
        if (!is_file($file)) {
            throw new RuntimeException("File SQL non trovato: {$file}");
        }
        $sql = self::dialect((string) file_get_contents($file));

        // I commenti si tolgono PRIMA di dividere: una riga `--` davanti a un
        // CREATE TABLE farebbe scartare l'intera istruzione insieme al commento.
        $sql = preg_replace('/^\s*--.*$/m', '', $sql) ?? $sql;

        foreach (explode(';', $sql) as $statement) {
            $statement = trim($statement);
            if ($statement === '') {
                continue;
            }
            self::pdo()->exec($statement);
        }
    }

    /** Espressione "adesso" utilizzabile nelle query, per driver. */
    public static function now(): string
    {
        return date('Y-m-d H:i:s');
    }
}
