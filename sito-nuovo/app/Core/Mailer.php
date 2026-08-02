<?php

declare(strict_types=1);

namespace Mil\Core;

/**
 * Notifiche via mail() di PHP — su SiteGround funziona senza configurazione.
 * L'invio è best-effort: il lead è già stato salvato a database prima di
 * arrivare qui, quindi una mail che fallisce non fa perdere il contatto.
 */
final class Mailer
{
    public static function send(string $subject, string $body, string $replyTo = ''): bool
    {
        $to = Settings::get('mail_to', (string) Config::get('mail_to'));
        if ($to === '' || PHP_SAPI === 'cli') {
            return false;
        }

        $from = Settings::get('mail_from', (string) Config::get('mail_from'));
        if ($from === '') {
            $host = parse_url((string) Config::get('base_url'), PHP_URL_HOST);
            $from = 'no-reply@' . (is_string($host) ? preg_replace('/^www\./', '', $host) : 'localhost');
        }

        $headers = [
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'From: ' . self::header(Settings::get('site_name', 'Mondo Immobiliare Lecce')) . ' <' . $from . '>',
        ];
        if ($replyTo !== '' && filter_var($replyTo, FILTER_VALIDATE_EMAIL)) {
            $headers[] = 'Reply-To: ' . $replyTo;
        }

        return @mail($to, self::header($subject), $body, implode("\r\n", $headers));
    }

    /** Rimuove i caratteri che permetterebbero un'iniezione di header. */
    private static function header(string $value): string
    {
        return trim(str_replace(["\r", "\n", "\0"], '', $value));
    }
}
