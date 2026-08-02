<?php

declare(strict_types=1);

namespace Mil\Controller\Admin;

use Mil\Core\Auth;
use Mil\Core\Db;
use Mil\Core\View;
use Mil\Repo\Agenda;
use Mil\Repo\Contacts;
use Mil\Repo\Leads;
use Mil\Repo\Log;
use Mil\Repo\Properties;

final class Dashboard
{
    public static function index(): void
    {
        Auth::required();

        View::show('admin/dashboard', [
            'titolo' => 'Riepilogo',
            'immobili' => Properties::counters(),
            'lead' => Leads::counters(),
            'clientiAttivi' => Contacts::countActive(),
            'appuntamenti' => Agenda::upcoming(6),
            'ultimiLead' => Leads::latest(8),
            'piuViste' => Db::all(
                "SELECT id, title, slug, views FROM properties
                 WHERE status IN ('published','reserved') ORDER BY views DESC LIMIT 5"
            ),
            'attivita' => Log::latest(10),
        ], 'layout/admin');
    }
}
