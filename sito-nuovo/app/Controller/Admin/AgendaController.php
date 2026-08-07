<?php

declare(strict_types=1);

namespace Mil\Controller\Admin;

use Mil\Core\Auth;
use Mil\Core\Csrf;
use Mil\Core\Router;
use Mil\Core\Session;
use Mil\Core\View;
use Mil\Repo\Agenda;
use Mil\Repo\Contacts;
use Mil\Repo\Properties;
use Mil\Repo\Users;

final class AgendaController
{
    public static function index(): void
    {
        Auth::required();

        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
            Csrf::check();
            $quando = trim((string) ($_POST['starts_at'] ?? ''));

            if ($quando === '' || strtotime($quando) === false) {
                Session::flash('Data non valida.', 'error');
            } else {
                Agenda::create([
                    'title' => mb_substr(trim((string) ($_POST['title'] ?? 'Appuntamento')), 0, 191),
                    'starts_at' => date('Y-m-d H:i:s', (int) strtotime($quando)),
                    'property_id' => int_or_null($_POST['property_id'] ?? null) ?: null,
                    'contact_id' => int_or_null($_POST['contact_id'] ?? null) ?: null,
                    'user_id' => int_or_null($_POST['user_id'] ?? null) ?: Auth::id(),
                    'notes' => mb_substr(trim((string) ($_POST['notes'] ?? '')), 0, 2000),
                ]);
                Session::flash('Appuntamento aggiunto.');
            }

            Router::redirect('/gestionale/agenda/');
        }

        View::show('admin/agenda', [
            'titolo' => 'Agenda',
            'voci' => Agenda::all(q('tutti') === '1'),
            'immobili' => Properties::search(['status' => 'any'], 1, 200)['items'],
            'clienti' => Contacts::search(['active' => '1'], 1, 200)['items'],
            'agenti' => Users::active(),
        ], 'layout/admin');
    }

    public static function toggle(string $id): void
    {
        Auth::required();
        Csrf::check();
        Agenda::toggleDone((int) $id);
        Router::redirect('/gestionale/agenda/');
    }

    public static function destroy(string $id): void
    {
        Auth::required();
        Csrf::check();
        Agenda::delete((int) $id);
        Session::flash('Appuntamento eliminato.');
        Router::redirect('/gestionale/agenda/');
    }
}
