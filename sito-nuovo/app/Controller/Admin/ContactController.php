<?php

declare(strict_types=1);

namespace Mil\Controller\Admin;

use Mil\Core\Auth;
use Mil\Core\Csrf;
use Mil\Core\Router;
use Mil\Core\Session;
use Mil\Core\View;
use Mil\Core\Vocab;
use Mil\Repo\Contacts;
use Mil\Repo\Log;
use Mil\Repo\Users;

final class ContactController
{
    public static function index(): void
    {
        Auth::required();

        View::show('admin/clienti-elenco', [
            'titolo' => 'Richieste di acquisto',
            'result' => Contacts::search([
                'q' => q('cerca'),
                'active' => q('attivi', '1'),
            ], max(1, (int) q('pagina', '1')), 30),
        ], 'layout/admin');
    }

    public static function create(): void
    {
        Auth::required();

        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
            Csrf::check();
            $id = Contacts::create(self::fromRequest());
            Log::write('crea', 'cliente', $id, (string) ($_POST['name'] ?? ''));
            Session::flash('Richiesta cliente salvata. Ecco cosa possiamo proporgli.');
            Router::redirect('/gestionale/clienti/' . $id . '/abbinamenti/');
        }

        View::show('admin/cliente-scheda', [
            'titolo' => 'Nuova richiesta di acquisto',
            'c' => self::blank(),
            'agenti' => Users::active(),
            'abbinamenti' => [],
        ], 'layout/admin');
    }

    public static function edit(string $id): void
    {
        Auth::required();

        $contact = Contacts::find((int) $id);
        if ($contact === null) {
            Session::flash('Richiesta non trovata.', 'error');
            Router::redirect('/gestionale/clienti/');
        }

        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
            Csrf::check();
            Contacts::update((int) $id, self::fromRequest());
            Log::write('modifica', 'cliente', (int) $id);
            Session::flash('Modifiche salvate.');
            Router::redirect('/gestionale/clienti/' . $id . '/');
        }

        View::show('admin/cliente-scheda', [
            'titolo' => $contact['name'],
            'c' => $contact,
            'agenti' => Users::active(),
            'abbinamenti' => Contacts::propertiesFor($contact, 6),
        ], 'layout/admin');
    }

    public static function destroy(string $id): void
    {
        Auth::adminRequired();
        Csrf::check();

        Contacts::delete((int) $id);
        Log::write('elimina', 'cliente', (int) $id);
        Session::flash('Richiesta eliminata.');
        Router::redirect('/gestionale/clienti/');
    }

    public static function matches(string $id): void
    {
        Auth::required();

        $contact = Contacts::find((int) $id);
        if ($contact === null) {
            Router::redirect('/gestionale/clienti/');
        }

        View::show('admin/abbinamenti-cliente', [
            'titolo' => 'Cosa proporre a ' . $contact['name'],
            'c' => $contact,
            'abbinamenti' => Contacts::propertiesFor($contact, 30),
        ], 'layout/admin');
    }

    /** @return array<string,mixed> */
    private static function fromRequest(): array
    {
        /** @var array<int,string> $types */
        $types = is_array($_POST['types'] ?? null) ? $_POST['types'] : [];
        $types = array_values(array_intersect($types, array_keys(Vocab::TYPES)));

        /** @var array<int,string> $cities */
        $cities = is_array($_POST['cities'] ?? null) ? $_POST['cities'] : [];
        $cities = array_values(array_intersect($cities, Vocab::CITIES));

        $contract = (string) ($_POST['contract'] ?? 'vendita');

        return [
            'name' => mb_substr(trim((string) ($_POST['name'] ?? '')), 0, 120) ?: 'Senza nome',
            'phone' => mb_substr(trim((string) ($_POST['phone'] ?? '')), 0, 40),
            'email' => mb_substr(trim((string) ($_POST['email'] ?? '')), 0, 191),
            'contract' => array_key_exists($contract, Vocab::CONTRACTS) ? $contract : 'vendita',
            'budget_min' => float_or_null($_POST['budget_min'] ?? null),
            'budget_max' => float_or_null($_POST['budget_max'] ?? null),
            'sqm_min' => (int) ($_POST['sqm_min'] ?? 0),
            'bedrooms_min' => (int) ($_POST['bedrooms_min'] ?? 0),
            'types' => implode(',', $types),
            'cities' => implode(',', $cities),
            'notes' => mb_substr(trim((string) ($_POST['notes'] ?? '')), 0, 4000),
            'active' => isset($_POST['active']) ? 1 : 0,
            'assigned_to' => int_or_null($_POST['assigned_to'] ?? null) ?: null,
        ];
    }

    /** @return array<string,mixed> */
    private static function blank(): array
    {
        return [
            'id' => 0, 'name' => '', 'phone' => '', 'email' => '', 'contract' => 'vendita',
            'budget_min' => null, 'budget_max' => null, 'sqm_min' => 0, 'bedrooms_min' => 0,
            'types' => '', 'cities' => '', 'notes' => '', 'active' => 1, 'assigned_to' => null,
        ];
    }
}
