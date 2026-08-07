<?php

declare(strict_types=1);

namespace Mil\Controller\Site;

use Mil\Core\Mailer;
use Mil\Core\Router;
use Mil\Core\Session;
use Mil\Core\Vocab;
use Mil\Repo\Leads;
use Mil\Repo\Properties;

/**
 * Unico punto di ingresso dei moduli pubblici.
 *
 * Scelte deliberate, prese dallo snippet già in produzione:
 *  - il lead viene SEMPRE scritto a database prima di tentare la mail, così
 *    un problema di posta non fa perdere un contatto;
 *  - niente token CSRF sui moduli pubblici (le pagine sono cacheabili e un
 *    token scaduto farebbe fallire l'invio in silenzio); al suo posto
 *    honeypot, tempo minimo di compilazione e limite per IP.
 */
final class Forms
{
    private const MIN_SECONDS = 3;

    public static function submit(): void
    {
        $back = self::safeReferer();

        // 1. Honeypot: un campo invisibile che solo un bot compila.
        if (trim((string) ($_POST['website'] ?? '')) !== '') {
            Router::redirect($back . '?inviato=1');
        }

        // 2. Tempo minimo: un umano non compila un modulo in meno di 3 secondi.
        //
        // Il campo deve esserci: prima il controllo saltava quando mancava, e
        // bastava non spedirlo per non essere mai troppo veloce. Chi compila
        // il modulo dalla pagina ce l'ha sempre, perché lo scrive il modello.
        $started = (int) ($_POST['ts'] ?? 0);
        if ($started <= 0 || (time() - $started) < self::MIN_SECONDS) {
            Router::redirect($back . '?inviato=1');
        }

        $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
        if (Leads::tooManyFrom($ip)) {
            Session::flash('Hai già inviato più richieste di recente. Chiamaci allo 0832 391489, ti rispondiamo subito.', 'warn');
            Router::redirect($back);
        }

        $name = trim((string) ($_POST['nome'] ?? ''));
        $phone = trim((string) ($_POST['telefono'] ?? ''));
        $email = trim((string) ($_POST['email'] ?? ''));

        if ($name === '' || ($phone === '' && $email === '')) {
            Session::flash('Servono il nome e almeno un recapito fra telefono ed email.', 'error');
            Router::redirect($back);
        }
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Session::flash('L’indirizzo email non sembra valido.', 'error');
            Router::redirect($back);
        }

        $source = (string) ($_POST['fonte'] ?? 'contatto');
        if (!array_key_exists($source, Vocab::LEAD_SOURCES)) {
            $source = 'contatto';
        }

        $propertyId = int_or_null($_POST['immobile'] ?? null);
        $property = $propertyId !== null ? Properties::find($propertyId) : null;

        $leadId = Leads::create([
            'source' => $source,
            'property_id' => $property === null ? null : (int) $property['id'],
            'name' => mb_substr($name, 0, 120),
            'phone' => mb_substr($phone, 0, 40),
            'email' => mb_substr($email, 0, 191),
            'city' => mb_substr(trim((string) ($_POST['dove'] ?? '')), 0, 120),
            'message' => mb_substr(trim((string) ($_POST['messaggio'] ?? '')), 0, 4000),
            'status' => 'nuovo',
            'ip' => $ip,
        ]);

        Mailer::send(
            'Nuova richiesta dal sito — ' . Vocab::label('lead_source', $source),
            self::mailBody($leadId, $name, $phone, $email, $property),
            $email
        );

        Session::flash('Richiesta inviata. Ti ricontattiamo entro 48 ore lavorative.', 'ok');
        Router::redirect($back . '?inviato=1#modulo');
    }

    /** @param array<string,mixed>|null $property */
    private static function mailBody(int $leadId, string $name, string $phone, string $email, ?array $property): string
    {
        $lines = [
            'Nuova richiesta dal sito.',
            '',
            'Nome: ' . $name,
            'Telefono: ' . ($phone !== '' ? $phone : '—'),
            'Email: ' . ($email !== '' ? $email : '—'),
        ];

        if ($property !== null) {
            $lines[] = 'Immobile: ' . $property['title'] . ' (' . $property['ref'] . ')';
        }
        if (trim((string) ($_POST['dove'] ?? '')) !== '') {
            $lines[] = 'Dove si trova la casa: ' . trim((string) $_POST['dove']);
        }
        if (trim((string) ($_POST['messaggio'] ?? '')) !== '') {
            $lines[] = '';
            $lines[] = 'Messaggio:';
            $lines[] = trim((string) $_POST['messaggio']);
        }

        $lines[] = '';
        $lines[] = 'Scheda nel gestionale: ' . url('/gestionale/richieste/' . $leadId . '/');

        return implode("\n", $lines);
    }

    /**
     * Torna alla pagina di provenienza, ma solo se è una pagina di questo
     * sito: un Referer esterno non deve poter pilotare il redirect.
     */
    private static function safeReferer(): string
    {
        $referer = (string) ($_SERVER['HTTP_REFERER'] ?? '');
        if ($referer === '') {
            return '/contatti/';
        }

        $host = parse_url($referer, PHP_URL_HOST);
        $ownHost = parse_url((string) \Mil\Core\Config::get('base_url'), PHP_URL_HOST);

        if ($host !== null && $host !== $ownHost) {
            return '/contatti/';
        }

        $path = parse_url($referer, PHP_URL_PATH);

        // Un percorso che comincia con due barre non è un percorso: messo
        // dentro un `Location:` il browser lo legge come un altro sito e ci
        // va. Serve un indirizzo strano del nostro stesso dominio per
        // arrivarci, quindi è più teoria che pratica — ma si chiude qui in
        // una riga invece di lasciarlo aperto.
        if (!is_string($path) || $path === '' || str_starts_with($path, '//')) {
            return '/contatti/';
        }

        return $path;
    }
}
