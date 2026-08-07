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
use Mil\Repo\Deals;
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
                'status' => q('stato'),
                'role' => q('ruolo'),
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
            'proposte' => [],
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
            'titolo' => (string) $contact['name'],
            'c' => $contact,
            'agenti' => Users::active(),
            'abbinamenti' => Contacts::propertiesFor($contact, 6),
            'proposte' => Deals::offersBy((int) $id),
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

        /** @var array<int,string> $roles */
        $roles = is_array($_POST['roles'] ?? null) ? $_POST['roles'] : [];
        $roles = array_values(array_intersect($roles, array_keys(Vocab::CLIENT_ROLES)));
        if ($roles === []) {
            $roles = ['acquirente'];
        }

        $contract = (string) ($_POST['contract'] ?? 'vendita');
        $consenso = isset($_POST['privacy_consent']) ? 1 : 0;

        $data = [
            'name' => mb_substr(trim((string) ($_POST['name'] ?? '')), 0, 120) ?: 'Senza nome',
            'phone' => mb_substr(trim((string) ($_POST['phone'] ?? '')), 0, 40),
            'email' => mb_substr(trim((string) ($_POST['email'] ?? '')), 0, 191),
            'roles' => implode(',', $roles),
            'source' => array_key_exists((string) ($_POST['source'] ?? ''), Vocab::CLIENT_SOURCES)
                ? (string) $_POST['source'] : '',
            'status' => array_key_exists((string) ($_POST['status'] ?? ''), Vocab::CLIENT_STATUSES)
                ? (string) $_POST['status'] : 'attivo',
            'city' => mb_substr(trim((string) ($_POST['city'] ?? '')), 0, 120),
            'tax_code' => mb_strtoupper(mb_substr(trim((string) ($_POST['tax_code'] ?? '')), 0, 20)),
            'contract' => array_key_exists($contract, Vocab::CONTRACTS) ? $contract : 'vendita',
            'budget_min' => float_or_null($_POST['budget_min'] ?? null),
            'budget_max' => float_or_null($_POST['budget_max'] ?? null),
            'sqm_min' => (int) ($_POST['sqm_min'] ?? 0),
            'bedrooms_min' => (int) ($_POST['bedrooms_min'] ?? 0),
            'types' => implode(',', $types),
            'cities' => implode(',', $cities),
            'financing' => array_key_exists((string) ($_POST['financing'] ?? ''), Vocab::FINANCING)
                ? (string) $_POST['financing'] : '',
            'urgency' => array_key_exists((string) ($_POST['urgency'] ?? ''), Vocab::URGENCY)
                ? (string) $_POST['urgency'] : 'media',
            'notes' => mb_substr(trim((string) ($_POST['notes'] ?? '')), 0, 4000),
            'privacy_consent' => $consenso,
            'privacy_scope' => mb_substr(trim((string) ($_POST['privacy_scope'] ?? '')), 0, 191),
            'aml_doc_type' => array_key_exists((string) ($_POST['aml_doc_type'] ?? ''), Vocab::AML_DOCS)
                ? (string) $_POST['aml_doc_type'] : '',
            'aml_doc_number' => mb_substr(trim((string) ($_POST['aml_doc_number'] ?? '')), 0, 60),
            'aml_doc_expiry' => self::date($_POST['aml_doc_expiry'] ?? null),
            'active' => isset($_POST['active']) ? 1 : 0,
            'assigned_to' => int_or_null($_POST['assigned_to'] ?? null) ?: null,
        ];

        // La data del consenso la scrive il sistema, non l'operatore: un
        // consenso datato a mano non prova niente. Si azzera se il consenso
        // viene tolto, così non resta una data orfana.
        $data['privacy_date'] = $consenso === 1
            ? (trim((string) ($_POST['privacy_date_esistente'] ?? '')) ?: \Mil\Core\Db::now())
            : null;

        // Idem per la verifica antiriciclaggio: vale il momento in cui il
        // documento è stato registrato.
        $data['aml_checked_at'] = $data['aml_doc_number'] !== ''
            ? (trim((string) ($_POST['aml_checked_esistente'] ?? '')) ?: \Mil\Core\Db::now())
            : null;

        return $data;
    }

    /** Data in formato Y-m-d, oppure null se il campo è vuoto o illeggibile. */
    private static function date(mixed $value): ?string
    {
        $raw = trim((string) ($value ?? ''));
        if ($raw === '') {
            return null;
        }
        $ts = strtotime($raw);

        return $ts === false ? null : date('Y-m-d', $ts);
    }

    /** @return array<string,mixed> */
    private static function blank(): array
    {
        return [
            'id' => 0, 'name' => '', 'phone' => '', 'email' => '', 'contract' => 'vendita',
            'roles' => 'acquirente', 'source' => '', 'status' => 'attivo', 'city' => '',
            'tax_code' => '', 'financing' => '', 'urgency' => 'media',
            'budget_min' => null, 'budget_max' => null, 'sqm_min' => 0, 'bedrooms_min' => 0,
            'types' => '', 'cities' => '', 'notes' => '', 'active' => 1, 'assigned_to' => null,
            'privacy_consent' => 0, 'privacy_date' => null, 'privacy_scope' => '',
            'aml_doc_type' => '', 'aml_doc_number' => '', 'aml_doc_expiry' => null,
            'aml_checked_at' => null, 'last_contact_at' => null,
        ];
    }
}
