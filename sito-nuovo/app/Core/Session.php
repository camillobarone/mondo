<?php

declare(strict_types=1);

namespace Mil\Core;

final class Session
{
    /** Il nome del cookie: serve anche per sapere se una sessione esiste già. */
    private const COOKIE = 'milsess';

    /**
     * La sessione si apre solo a chi serve.
     *
     * Prima si apriva a chiunque, e costava due cose a ogni visitatore che
     * non avrebbe mai fatto il login: un cookie che non gli serviva, e —
     * più caro — l'intestazione `Cache-Control: no-store` che PHP mette da
     * sé quando una sessione è attiva. Con quella nessuna pagina del sito
     * poteva essere conservata da nessuno: né dal browser, né dal tasto
     * «indietro», né da un eventuale servizio davanti al sito. Su un sito
     * senza una riga di JavaScript, fatto apposta per essere leggero, era
     * la parte facile del guadagno buttata via.
     *
     * Serve in tre casi, e sono tutti riconoscibili prima di aprirla:
     *  - il gestionale, dove c'è qualcuno collegato;
     *  - una POST, cioè l'invio di un modulo, che lascia il messaggio da
     *    mostrare nella pagina dopo;
     *  - una richiesta che porta già il cookie, che è come torna indietro
     *    quel messaggio dopo il rinvio.
     */
    public static function avviaSeServe(string $path, string $method): void
    {
        if (
            str_starts_with($path, '/gestionale')
            || $method === 'POST'
            || isset($_COOKIE[self::COOKIE])
        ) {
            self::start();
        }
    }

    public static function start(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE || PHP_SAPI === 'cli') {
            return;
        }
        // Le intestazioni di cache le decide il front controller, non PHP:
        // senza questa riga arriva comunque il suo `no-store` d'ufficio.
        session_cache_limiter('');
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Lax',
            'secure' => ($_SERVER['HTTPS'] ?? '') === 'on'
                || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https',
        ]);
        session_name(self::COOKIE);
        session_start();
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        return $_SESSION[$key] ?? $default;
    }

    public static function set(string $key, mixed $value): void
    {
        $_SESSION[$key] = $value;
    }

    public static function forget(string $key): void
    {
        unset($_SESSION[$key]);
    }

    /** Messaggio one-shot mostrato al caricamento successivo. */
    public static function flash(string $message, string $type = 'ok'): void
    {
        $_SESSION['_flash'][] = ['type' => $type, 'message' => $message];
    }

    /** @return array<int,array{type:string,message:string}> */
    public static function takeFlash(): array
    {
        /** @var array<int,array{type:string,message:string}> $items */
        $items = $_SESSION['_flash'] ?? [];
        unset($_SESSION['_flash']);
        return $items;
    }
}
