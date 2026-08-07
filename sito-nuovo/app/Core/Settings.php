<?php

declare(strict_types=1);

namespace Mil\Core;

use Throwable;

/** Impostazioni modificabili dal gestionale, in tabella chiave/valore. */
final class Settings
{
    /** @var array<string,string>|null */
    private static ?array $cache = null;

    /** @return array<string,string> */
    public static function all(): array
    {
        if (self::$cache !== null) {
            return self::$cache;
        }

        try {
            $rows = Db::all('SELECT name, value FROM settings');
        } catch (Throwable) {
            // Prima dell'installazione la tabella non esiste ancora.
            return self::$cache = [];
        }

        $out = [];
        foreach ($rows as $row) {
            $out[(string) $row['name']] = (string) $row['value'];
        }

        return self::$cache = $out;
    }

    public static function get(string $key, string $default = ''): string
    {
        $value = self::all()[$key] ?? '';
        return $value === '' ? $default : $value;
    }

    public static function set(string $key, string $value): void
    {
        $exists = Db::value('SELECT COUNT(*) FROM settings WHERE name = :n', ['n' => $key]);
        if ((int) $exists > 0) {
            Db::run('UPDATE settings SET value = :v WHERE name = :n', ['v' => $value, 'n' => $key]);
        } else {
            Db::insert('settings', ['name' => $key, 'value' => $value]);
        }
        self::$cache = null;
    }

    public static function flush(): void
    {
        self::$cache = null;
    }
}
