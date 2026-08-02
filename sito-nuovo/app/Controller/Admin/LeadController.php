<?php

declare(strict_types=1);

namespace Mil\Controller\Admin;

use Mil\Core\Auth;
use Mil\Core\Csrf;
use Mil\Core\Router;
use Mil\Core\Session;
use Mil\Core\View;
use Mil\Core\Vocab;
use Mil\Repo\Agenda;
use Mil\Repo\Leads;
use Mil\Repo\Log;
use Mil\Repo\Users;

final class LeadController
{
    public static function index(): void
    {
        Auth::required();

        View::show('admin/richieste-elenco', [
            'titolo' => 'Richieste dal sito',
            'result' => Leads::search([
                'status' => q('stato'),
                'source' => q('fonte'),
                'q' => q('cerca'),
            ], max(1, (int) q('pagina', '1')), 30),
            'contatori' => Leads::counters(),
        ], 'layout/admin');
    }

    public static function show(string $id): void
    {
        Auth::required();

        $lead = Leads::find((int) $id);
        if ($lead === null) {
            Session::flash('Richiesta non trovata.', 'error');
            Router::redirect('/gestionale/richieste/');
        }

        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
            Csrf::check();
            self::handlePost((int) $id);
            Router::redirect('/gestionale/richieste/' . $id . '/');
        }

        View::show('admin/richiesta-scheda', [
            'titolo' => 'Richiesta di ' . $lead['name'],
            'lead' => $lead,
            'note' => Leads::notes((int) $id),
            'agenti' => Users::active(),
        ], 'layout/admin');
    }

    private static function handlePost(int $id): void
    {
        $azione = (string) ($_POST['azione'] ?? '');

        if ($azione === 'nota') {
            $body = trim((string) ($_POST['nota'] ?? ''));
            if ($body !== '') {
                Leads::addNote($id, Auth::id(), mb_substr($body, 0, 4000));
                Session::flash('Nota aggiunta.');
            }
            return;
        }

        if ($azione === 'appuntamento') {
            $quando = trim((string) ($_POST['starts_at'] ?? ''));
            if ($quando === '' || strtotime($quando) === false) {
                Session::flash('Data appuntamento non valida.', 'error');
                return;
            }
            Agenda::create([
                'title' => mb_substr(trim((string) ($_POST['titolo'] ?? 'Appuntamento')), 0, 191),
                'starts_at' => date('Y-m-d H:i:s', (int) strtotime($quando)),
                'lead_id' => $id,
                'user_id' => Auth::id(),
                'notes' => mb_substr(trim((string) ($_POST['note'] ?? '')), 0, 2000),
            ]);
            Leads::update($id, ['status' => 'appuntamento']);
            Session::flash('Appuntamento inserito in agenda.');
            return;
        }

        $data = [];
        $status = (string) ($_POST['status'] ?? '');
        if (array_key_exists($status, Vocab::LEAD_STATUSES)) {
            $data['status'] = $status;
        }
        $assigned = int_or_null($_POST['assigned_to'] ?? null);
        $data['assigned_to'] = $assigned !== null && $assigned > 0 ? $assigned : null;

        Leads::update($id, $data);
        Log::write('aggiorna', 'richiesta', $id, (string) ($data['status'] ?? ''));
        Session::flash('Richiesta aggiornata.');
    }
}
