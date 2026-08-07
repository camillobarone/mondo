<?php

declare(strict_types=1);

namespace Mil\Core;

/**
 * Configurazione dell'installazione. Il file config.php nella root NON sta in
 * git: lo genera install.php e contiene le credenziali del database.
 */
final class Config
{
    /** @var array<string,mixed> */
    private static array $values = [];

    private static bool $installed = false;

    public static function load(string $file): void
    {
        self::$values = self::defaults();

        if (is_file($file)) {
            /** @var array<string,mixed> $custom */
            $custom = require $file;
            self::$values = array_merge(self::$values, $custom);
            self::$installed = true;
        }

        if (self::$values['base_url'] === '') {
            self::$values['base_url'] = self::guessBaseUrl();
        }
    }

    public static function installed(): bool
    {
        return self::$installed;
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        return self::$values[$key] ?? $default;
    }

    public static function set(string $key, mixed $value): void
    {
        self::$values[$key] = $value;
    }

    /** @return array<string,mixed> */
    public static function defaults(): array
    {
        return [
            'debug' => false,
            'base_url' => '',
            // 'mysql' in produzione su SiteGround, 'sqlite' per la prova locale.
            'db_driver' => 'sqlite',
            'db_host' => 'localhost',
            'db_port' => 3306,
            'db_name' => '',
            'db_user' => '',
            'db_pass' => '',
            'db_file' => MIL_ROOT . '/db/mil.sqlite',
            'uploads_dir' => MIL_PUBLIC . '/uploads',
            'uploads_url' => '/uploads',
            // Destinatario delle notifiche lead. Vuoto = nessuna mail, il lead
            // resta comunque salvato a database (mai perdere un contatto).
            'mail_to' => '',
            'mail_from' => '',
        ];
    }

    private static function guessBaseUrl(): string
    {
        if (PHP_SAPI === 'cli') {
            return 'http://localhost:8080';
        }
        $https = ($_SERVER['HTTPS'] ?? '') === 'on'
            || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        return ($https ? 'https://' : 'http://') . $host;
    }
}
