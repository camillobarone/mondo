<?php

declare(strict_types=1);

namespace Mil\Core;

final class Csrf
{
    public static function token(): string
    {
        $token = Session::get('_csrf');
        if (!is_string($token) || $token === '') {
            $token = bin2hex(random_bytes(32));
            Session::set('_csrf', $token);
        }
        return $token;
    }

    /** Campo hidden da inserire in ogni form del gestionale. */
    public static function field(): string
    {
        return '<input type="hidden" name="_csrf" value="' . e(self::token()) . '">';
    }

    public static function valid(?string $candidate): bool
    {
        $token = Session::get('_csrf');
        return is_string($token) && is_string($candidate) && hash_equals($token, $candidate);
    }

    /** Blocca la richiesta se il token non è valido. */
    public static function check(): void
    {
        $posted = $_POST['_csrf'] ?? null;
        if (!self::valid(is_string($posted) ? $posted : null)) {
            http_response_code(419);
            exit('Sessione scaduta. Ricarica la pagina e riprova.');
        }
    }
}
