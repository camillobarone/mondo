<?php

declare(strict_types=1);

namespace Mil\Controller\Admin;

use Mil\Core\Auth;
use Mil\Core\Csrf;
use Mil\Core\Router;
use Mil\Core\Session;
use Mil\Core\Settings;
use Mil\Core\View;
use Mil\Repo\Log;
use Mil\Repo\Redirects;
use Mil\Repo\Users;

final class SystemController
{
    /** Impostazioni modificabili dal gestionale, con etichetta e aiuto. */
    private const FIELDS = [
        'site_name' => ['Nome del sito', ''],
        'site_url' => ['Indirizzo del sito', 'Va usato anche negli @id del JSON-LD. In produzione: https://www.mondoimmobiliarelecce.it'],
        'logo_url' => ['URL del logo 512×512', 'Deve rispondere 200: è il logo che Google usa nel Knowledge Panel.'],
        'home_seo_title' => ['SEO title della home', 'Massimo 60 caratteri.'],
        'home_seo_description' => ['Meta description della home', 'Massimo 160 caratteri.'],
        'mail_to' => ['Email che riceve le richieste', ''],
        'mail_from' => ['Email mittente delle notifiche', 'Deve stare sul dominio del sito, altrimenti finisce in spam.'],
        'phone_display' => ['Telefono mostrato in pagina', ''],
        'whatsapp' => ['Numero WhatsApp (formato internazionale, senza +)', ''],
    ];

    public static function settings(): void
    {
        Auth::adminRequired();

        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
            Csrf::check();
            foreach (array_keys(self::FIELDS) as $key) {
                Settings::set($key, trim((string) ($_POST[$key] ?? '')));
            }

            // La casella non compare nel POST quando è tolta: va letta a parte,
            // altrimenti il ciclo qui sopra la svuoterebbe e basta.
            $noindex = isset($_POST['noindex']) ? '1' : '0';
            if (Settings::get('noindex', '0') !== $noindex) {
                Log::write($noindex === '1' ? 'noindex-on' : 'noindex-off', 'impostazioni');
            }
            Settings::set('noindex', $noindex);

            Log::write('modifica', 'impostazioni');
            Session::flash('Impostazioni salvate.');
            Router::redirect('/gestionale/impostazioni/');
        }

        View::show('admin/impostazioni', [
            'titolo' => 'Impostazioni',
            'campi' => self::FIELDS,
        ], 'layout/admin');
    }

    // ------------------------------------------------------------ redirect

    public static function redirects(): void
    {
        Auth::adminRequired();

        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
            Csrf::check();

            // Incolla massivo: una riga per redirect, "vecchio → nuovo".
            $bulk = trim((string) ($_POST['bulk'] ?? ''));
            if ($bulk !== '') {
                $n = 0;
                foreach (preg_split('/\R/', $bulk) ?: [] as $line) {
                    $parts = preg_split('/\s*(?:=>|→|\t|\s{2,}|,|;)\s*/u', trim($line), 2);
                    if (is_array($parts) && count($parts) === 2 && $parts[0] !== '' && $parts[1] !== '') {
                        Redirects::put(self::path($parts[0]), self::path($parts[1]));
                        $n++;
                    }
                }
                Session::flash($n . ' reindirizzamenti importati.');
            } else {
                $from = trim((string) ($_POST['from_path'] ?? ''));
                $to = trim((string) ($_POST['to_path'] ?? ''));
                if ($from !== '' && $to !== '') {
                    Redirects::put(self::path($from), self::path($to));
                    Session::flash('Reindirizzamento salvato.');
                } else {
                    Session::flash('Servono entrambi i percorsi.', 'error');
                }
            }

            Router::redirect('/gestionale/redirect/');
        }

        View::show('admin/redirect', [
            'titolo' => 'Reindirizzamenti 301',
            'voci' => Redirects::all(),
        ], 'layout/admin');
    }

    public static function destroyRedirect(string $id): void
    {
        Auth::adminRequired();
        Csrf::check();
        Redirects::delete((int) $id);
        Session::flash('Reindirizzamento eliminato.');
        Router::redirect('/gestionale/redirect/');
    }

    /** Accetta sia una URL intera sia un percorso, restituisce il percorso. */
    private static function path(string $value): string
    {
        $value = trim($value);
        if (str_starts_with($value, 'http')) {
            $parsed = parse_url($value, PHP_URL_PATH);
            $value = is_string($parsed) ? $parsed : '/';
        }

        return '/' . trim($value, '/');
    }

    // -------------------------------------------------------------- utenti

    /**
     * I tre ruoli ammessi, con `agent` come ripiego: quello che arriva dal
     * modulo non si usa mai così com'è.
     *
     * `firma` è un account che non entra nel gestionale — esiste solo per
     * comparire come autore di un articolo, con nome e biografia. Serve per
     * i colleghi che scrivono ma non gestiscono immobili: nessuna password
     * in circolazione per un accesso che non useranno.
     */
    private static function role(mixed $valore): string
    {
        $valore = (string) $valore;

        return in_array($valore, ['admin', 'firma'], true) ? $valore : 'agent';
    }

    public static function users(): void
    {
        Auth::adminRequired();

        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
            Csrf::check();
            $email = trim((string) ($_POST['email'] ?? ''));
            $password = (string) ($_POST['password'] ?? '');
            $role = self::role($_POST['role'] ?? '');

            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                Session::flash('Email non valida.', 'error');
            } elseif ($role !== 'firma' && mb_strlen($password) < 10) {
                Session::flash('La password deve avere almeno 10 caratteri.', 'error');
            } elseif (Users::emailTaken($email)) {
                Session::flash('Esiste già un utente con questa email.', 'error');
            } else {
                $id = Users::create([
                    'name' => mb_substr(trim((string) ($_POST['name'] ?? '')), 0, 120) ?: 'Senza nome',
                    'email' => $email,
                    'role' => $role,
                    'phone' => mb_substr(trim((string) ($_POST['phone'] ?? '')), 0, 40),
                    'active' => 1,
                    // Chi firma e basta non entra: password vuota, che
                    // Users::create() traduce in un hash vuoto — e un hash
                    // vuoto non combacia con nessun tentativo di accesso.
                ], $role === 'firma' ? '' : $password);
                Log::write('crea', 'utente', $id, $email);
                Session::flash('Utente creato.');
            }

            Router::redirect('/gestionale/utenti/');
        }

        View::show('admin/utenti', [
            'titolo' => 'Utenti',
            'utenti' => Users::all(),
        ], 'layout/admin');
    }

    public static function editUser(string $id): void
    {
        Auth::adminRequired();

        $user = Users::find((int) $id);
        if ($user === null) {
            Session::flash('Utente non trovato.', 'error');
            Router::redirect('/gestionale/utenti/');
        }

        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
            Csrf::check();

            $password = (string) ($_POST['password'] ?? '');
            if ($password !== '' && mb_strlen($password) < 10) {
                Session::flash('La password deve avere almeno 10 caratteri.', 'error');
                Router::redirect('/gestionale/utenti/' . $id . '/');
            }

            $active = isset($_POST['active']) ? 1 : 0;
            $role = self::role($_POST['role'] ?? '');

            // Non ci si può disattivare né declassare da soli: si resterebbe
            // chiusi fuori dal proprio gestionale, e per rientrare servirebbe
            // phpMyAdmin.
            if ((int) $id === Auth::id()) {
                $active = 1;
                $role = (string) $user['role'];
            }

            $dati = [
                'name' => mb_substr(trim((string) ($_POST['name'] ?? '')), 0, 120) ?: (string) $user['name'],
                'role' => $role,
                'phone' => mb_substr(trim((string) ($_POST['phone'] ?? '')), 0, 40),
                'bio' => mb_substr(trim((string) ($_POST['bio'] ?? '')), 0, 2000),
                'active' => $active,
            ];

            // Diventare «solo firma» toglie l'accesso davvero: la password
            // precedente va cancellata, altrimenti chi la conosceva
            // continuerebbe a entrare e l'etichetta sarebbe una bugia.
            if ($role === 'firma') {
                $dati['password_hash'] = '';
                $password = '';
            }

            Users::update((int) $id, $dati, $password);

            Log::write('modifica', 'utente', (int) $id);
            Session::flash('Utente aggiornato.');
            Router::redirect('/gestionale/utenti/' . $id . '/');
        }

        View::show('admin/utente-scheda', [
            'titolo' => (string) $user['name'],
            'u' => $user,
        ], 'layout/admin');
    }
}
