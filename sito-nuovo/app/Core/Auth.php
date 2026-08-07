<?php

declare(strict_types=1);

namespace Mil\Core;

final class Auth
{
    /** Quanti errori si perdonano prima di chiudere la porta. */
    private const TENTATIVI_MAX = 8;

    /** Per quanti minuti resta chiusa, e su quale finestra si contano gli errori. */
    private const MINUTI_BLOCCO = 15;

    /** @var array<string,mixed>|null */
    private static ?array $user = null;

    /**
     * La porta è chiusa per troppi errori recenti?
     *
     * Si guardano insieme l'indirizzo di rete e l'email provata: contare solo
     * l'email lascerebbe a chiunque il modo di chiudere fuori un collega
     * sbagliandogli la password otto volte di fila.
     */
    public static function bloccato(string $ip, string $email): bool
    {
        self::dimenticaVecchi();

        $da = date('Y-m-d H:i:s', time() - self::MINUTI_BLOCCO * 60);

        $quanti = (int) Db::value(
            'SELECT COUNT(*) FROM accessi_falliti
             WHERE created_at >= :da AND (ip = :ip OR email = :e)',
            ['da' => $da, 'ip' => $ip, 'e' => mb_strtolower(trim($email))]
        );

        return $quanti >= self::TENTATIVI_MAX;
    }

    /** Quanti minuti mancano alla riapertura, almeno uno. */
    public static function minutiRimasti(string $ip, string $email): int
    {
        $ultimo = Db::value(
            'SELECT MAX(created_at) FROM accessi_falliti WHERE ip = :ip OR email = :e',
            ['ip' => $ip, 'e' => mb_strtolower(trim($email))]
        );

        if ($ultimo === null) {
            return self::MINUTI_BLOCCO;
        }

        $passati = (int) floor((time() - strtotime((string) $ultimo)) / 60);

        return max(1, self::MINUTI_BLOCCO - $passati);
    }

    /** Segna un tentativo andato male. */
    public static function segnaFallito(string $ip, string $email): void
    {
        Db::insert('accessi_falliti', [
            'ip' => mb_substr($ip, 0, 45),
            'email' => mb_substr(mb_strtolower(trim($email)), 0, 191),
            'created_at' => Db::now(),
        ]);
    }

    /** Chi è entrato riparte pulito: gli errori di prima non contano più. */
    public static function azzeraFalliti(string $ip, string $email): void
    {
        Db::run(
            'DELETE FROM accessi_falliti WHERE ip = :ip OR email = :e',
            ['ip' => $ip, 'e' => mb_strtolower(trim($email))]
        );
    }

    /**
     * Via le righe più vecchie della finestra. Si fa qui, a ogni controllo,
     * così non serve nessun lavoro pianificato e la tabella resta corta.
     */
    private static function dimenticaVecchi(): void
    {
        Db::run(
            'DELETE FROM accessi_falliti WHERE created_at < :da',
            ['da' => date('Y-m-d H:i:s', time() - self::MINUTI_BLOCCO * 60)]
        );
    }

    public static function attempt(string $email, string $password): bool
    {
        // Gli account «solo firma» sono esclusi qui, nella query, non dopo.
        // Non è una rifinitura: più account possono condividere l'email
        // dell'agenzia, quindi cercare per sola email potrebbe restituire una
        // firma al posto della persona che sta davvero entrando, e negarle
        // l'accesso pur avendo la password giusta. Filtrando subito, chi non
        // entra non può nemmeno fare ombra a chi entra.
        $user = Db::one(
            "SELECT * FROM users WHERE email = :e AND active = 1 AND role <> 'firma'",
            ['e' => mb_strtolower(trim($email))]
        );

        // Password mai impostata: nessun tentativo può indovinarla, perché
        // non c'è. password_verify() lo negherebbe da solo su un hash vuoto —
        // sta scritto perché una difesa che si vede è una difesa che nessuno
        // smonta per sbaglio.
        if ($user === null || (string) $user['password_hash'] === '') {
            return false;
        }

        if (!password_verify($password, (string) $user['password_hash'])) {
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
