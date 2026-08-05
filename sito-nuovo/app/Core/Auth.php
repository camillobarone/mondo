<?php

declare(strict_types=1);

namespace Mil\Core;

final class Auth
{
    /** @var array<string,mixed>|null */
    private static ?array $user = null;

    public static function attempt(string $email, string $password): bool
    {
        $user = Db::one(
            'SELECT * FROM users WHERE email = :e AND active = 1',
            ['e' => mb_strtolower(trim($email))]
        );

        // Account «solo firma»: esistono per comparire come autori di un
        // articolo, non per entrare. Non hanno password, e questo controllo
        // dice a chiare lettere che nessun tentativo di accesso li riguarda.
        // L'hash vuoto lo negherebbe già password_verify() da solo: sta qui
        // perché una difesa che si vede è una difesa che nessuno smonta per
        // sbaglio.
        if ($user !== null
            && ((string) $user['role'] === 'firma' || (string) $user['password_hash'] === '')) {
            return false;
        }

        if ($user === null || !password_verify($password, (string) $user['password_hash'])) {
            return false;
        }

        // Rigenera l'ID di sessione al login: previene la session fixation.
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_regenerate_id(true);
        }

        Session::set('uid', (int) $user['id']);
        Db::update('users', (int) $user['id'], ['last_login_at' => Db::now()]);
        self::$user = $user;

        return true;
    }

    public static function logout(): void
    {
        Session::forget('uid');
        self::$user = null;
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_regenerate_id(true);
        }
    }

    /** @return array<string,mixed>|null */
    public static function user(): ?array
    {
        if (self::$user !== null) {
            return self::$user;
        }
        $uid = Session::get('uid');
        if (!is_int($uid)) {
            return null;
        }
        return self::$user = Db::one('SELECT * FROM users WHERE id = :id AND active = 1', ['id' => $uid]);
    }

    public static function id(): ?int
    {
        $user = self::user();
        return $user === null ? null : (int) $user['id'];
    }

    public static function check(): bool
    {
        return self::user() !== null;
    }

    public static function isAdmin(): bool
    {
        $user = self::user();
        return $user !== null && $user['role'] === 'admin';
    }

    /** Blocca l'accesso alle pagine del gestionale a chi non è autenticato. */
    public static function required(): void
    {
        if (!self::check()) {
            Session::set('_after_login', $_SERVER['REQUEST_URI'] ?? '/gestionale/');
            Router::redirect('/gestionale/login/');
        }

        self::aggiornaDatabase();
    }

    /**
     * Applica le modifiche al database ancora da fare, appena qualcuno entra
     * nel gestionale.
     *
     * Serve perché aggiornare il sito significa caricare dei file, e chi lo fa
     * non ha un terminale: senza questo, una colonna nuova resterebbe scritta
     * solo nel codice e la prima pagina che prova a leggerla andrebbe in
     * errore. Il momento giusto è l'ingresso nel gestionale — c'è una persona
     * davanti, autenticata, e se qualcosa va storto se ne accorge subito
     * invece di scoprirlo un visitatore.
     *
     * Costa una lettura di `schema_migrations` per pagina: nulla, e in cambio
     * non esiste più il caso "file nuovi, database vecchio".
     */
    private static function aggiornaDatabase(): void
    {
        try {
            $fatte = Db::migrate();
        } catch (\Throwable $e) {
            Session::flash('Aggiornamento del database non riuscito: ' . $e->getMessage(), 'error');
            return;
        }

        if ($fatte !== []) {
            Session::flash('Database aggiornato (' . count($fatte) . ' modifiche applicate).');
        }
    }

    public static function adminRequired(): void
    {
        self::required();
        if (!self::isAdmin()) {
            http_response_code(403);
            exit('Serve un account amministratore per questa sezione.');
        }
    }

    public static function hash(string $password): string
    {
        return password_hash($password, PASSWORD_DEFAULT);
    }
}
