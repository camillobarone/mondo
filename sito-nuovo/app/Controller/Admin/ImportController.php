<?php

declare(strict_types=1);

namespace Mil\Controller\Admin;

use Mil\Core\Auth;
use Mil\Core\Csrf;
use Mil\Core\Db;
use Mil\Core\Router;
use Mil\Core\Session;
use Mil\Core\View;
use Mil\Core\WpImport;
use Mil\Core\WpMapper;
use Mil\Core\WpSource;
use Mil\Repo\Log;
use Throwable;

/**
 * L'importazione da WordPress, dal gestionale.
 *
 * Esiste perché l'importazione va rifatta ogni volta che gli immobili
 * cambiano su WordPress, e non può dipendere da qualcuno che sappia aprire un
 * terminale. Chi manda avanti l'agenzia deve poterla lanciare da solo.
 *
 * Le credenziali del database WordPress non compaiono mai: si indica il
 * percorso di `wp-config.php` e le legge il server, dove quel file già sta.
 * Nessuno deve copiarle a mano, e quindi nessuno può lasciarle in giro.
 */
final class ImportController
{
    /** Quanti immobili per giro. Con le foto è la parte lenta: meglio pochi. */
    private const PER_GIRO = 3;

    public static function page(): void
    {
        Auth::adminRequired();

        View::show('admin/importa', [
            'titolo' => 'Importa da WordPress',
            'wpConfig' => (string) (Session::get('imp_wpconfig') ?? self::indovinaWpConfig()),
            'censimento' => Session::get('imp_censimento'),
            'anteprima' => Session::get('imp_anteprima'),
            'avanzamento' => self::avanzamento(),
        ], 'layout/admin');
    }

    /** Passo 1: legge il database WordPress e mostra cosa c'è, senza toccarlo. */
    public static function census(): void
    {
        Auth::adminRequired();
        Csrf::check();

        $percorso = trim((string) ($_POST['wp_config'] ?? ''));
        Session::set('imp_wpconfig', $percorso);

        try {
            $wp = self::sorgente($percorso);
            $censimento = $wp->metaCensus();
            Session::set('imp_censimento', [
                'immobili' => count($wp->properties(['publish'])),
                'bozze' => count($wp->properties(['draft'])),
                // Prima cosa serve davvero: l'importazione trova i suoi dati?
                'copertura' => (new WpMapper())->copertura($censimento),
                // L'elenco crudo resta, ma in fondo e richiuso: serve solo a
                // chi deve andare a vedere com'e chiamato un campo.
                'campi' => $censimento,
            ]);
            Session::forget('imp_anteprima');
            Session::flash('Collegamento a WordPress riuscito.');
        } catch (Throwable $e) {
            Session::forget('imp_censimento');
            Session::flash('Non riesco a leggere WordPress: ' . $e->getMessage(), 'error');
        }

        Router::redirect('/gestionale/importa/');
    }

    /** Passo 2: simula tutto senza scrivere niente. */
    public static function preview(): void
    {
        Auth::adminRequired();
        Csrf::check();

        try {
            $wp = self::sorgente((string) Session::get('imp_wpconfig'));
            $imp = new WpImport($wp);

            $righe = [];
            foreach ($imp->daLavorare() as $wpId) {
                $righe[] = $imp->uno($wpId, true, false);
            }

            Session::set('imp_anteprima', ['righe' => $righe, 'avvisi' => $imp->avvisi()]);
            Session::flash('Simulazione completata: non è stato scritto niente.');
        } catch (Throwable $e) {
            Session::flash('Simulazione fallita: ' . $e->getMessage(), 'error');
        }

        Router::redirect('/gestionale/importa/');
    }

    /** Passo 3: parte davvero. Prepara la coda, poi lavora a piccoli lotti. */
    public static function start(): void
    {
        Auth::adminRequired();
        Csrf::check();

        try {
            $wp = self::sorgente((string) Session::get('imp_wpconfig'));
            $coda = (new WpImport($wp))->daLavorare();

            Session::set('imp_coda', $coda);
            Session::set('imp_fatti', 0);
            Session::set('imp_conta', ['nuovi' => 0, 'aggiornati' => 0, 'foto' => 0, 'errori' => 0]);
            Session::set('imp_errori', []);
            Log::write('import-avvio', 'wordpress', null, count($coda) . ' immobili');
        } catch (Throwable $e) {
            Session::flash('Non riesco a partire: ' . $e->getMessage(), 'error');
            Router::redirect('/gestionale/importa/');
        }

        Router::redirect('/gestionale/importa/lavora/');
    }

    /**
     * Un lotto per volta, poi la pagina si ricarica da sola.
     *
     * Il ricaricamento è un `<meta refresh>` nel template, non JavaScript:
     * funziona anche se il browser lo blocca, e non c'è niente da mantenere.
     */
    public static function work(): void
    {
        Auth::adminRequired();

        /** @var array<int,int> $coda */
        $coda = Session::get('imp_coda') ?? [];
        $fatti = (int) (Session::get('imp_fatti') ?? 0);

        if ($coda === []) {
            Router::redirect('/gestionale/importa/');
        }

        if ($fatti >= count($coda)) {
            self::chiudi();
        }

        try {
            $wp = self::sorgente((string) Session::get('imp_wpconfig'));
            $imp = new WpImport($wp, self::cartellaUploads((string) Session::get('imp_wpconfig')));

            /** @var array<string,int> $conta */
            $conta = Session::get('imp_conta') ?? ['nuovi' => 0, 'aggiornati' => 0, 'foto' => 0, 'errori' => 0];
            /** @var array<int,string> $errori */
            $errori = Session::get('imp_errori') ?? [];

            $ultimi = [];
            for ($i = 0; $i < self::PER_GIRO && $fatti < count($coda); $i++, $fatti++) {
                $esito = $imp->uno($coda[$fatti], false, true);
                $ultimi[] = $esito;

                match ($esito['stato']) {
                    'nuovo' => $conta['nuovi']++,
                    'aggiornato' => $conta['aggiornati']++,
                    default => $conta['errori']++,
                };
                $conta['foto'] += (int) $esito['foto'];
                if ($esito['stato'] === 'errore') {
                    $errori[] = $esito['titolo'] . ': ' . $esito['messaggio'];
                }
            }

            Session::set('imp_fatti', $fatti);
            Session::set('imp_conta', $conta);
            Session::set('imp_errori', $errori);

            if ($fatti >= count($coda)) {
                self::chiudi();
            }

            View::show('admin/importa-lavora', [
                'titolo' => 'Importazione in corso',
                'fatti' => $fatti,
                'totale' => count($coda),
                'conta' => $conta,
                'ultimi' => $ultimi,
            ], 'layout/admin');
        } catch (Throwable $e) {
            Session::flash('Importazione interrotta: ' . $e->getMessage(), 'error');
            Router::redirect('/gestionale/importa/');
        }
    }

    /** Chiude l'importazione, scrive il riepilogo e torna alla pagina. */
    private static function chiudi(): never
    {
        /** @var array<string,int> $conta */
        $conta = Session::get('imp_conta') ?? [];
        /** @var array<int,string> $errori */
        $errori = Session::get('imp_errori') ?? [];

        Log::write('import-fine', 'wordpress', null, sprintf(
            '%d nuovi, %d aggiornati, %d foto, %d errori',
            $conta['nuovi'] ?? 0,
            $conta['aggiornati'] ?? 0,
            $conta['foto'] ?? 0,
            $conta['errori'] ?? 0
        ));

        Session::flash(sprintf(
            'Importazione finita: %d nuovi, %d aggiornati, %d foto.',
            $conta['nuovi'] ?? 0,
            $conta['aggiornati'] ?? 0,
            $conta['foto'] ?? 0
        ));
        foreach (array_slice($errori, 0, 5) as $errore) {
            Session::flash((string) $errore, 'warn');
        }

        Session::forget('imp_coda');
        Session::forget('imp_fatti');

        Router::redirect('/gestionale/importa/');
    }

    /** @return array{fatti:int,totale:int}|null se c'è un'importazione a metà */
    private static function avanzamento(): ?array
    {
        /** @var array<int,int> $coda */
        $coda = Session::get('imp_coda') ?? [];
        if ($coda === []) {
            return null;
        }

        return ['fatti' => (int) (Session::get('imp_fatti') ?? 0), 'totale' => count($coda)];
    }

    private static function sorgente(string $wpConfig): WpSource
    {
        if ($wpConfig === '' || !is_file($wpConfig)) {
            throw new \RuntimeException('il file wp-config.php non esiste in ' . ($wpConfig ?: 'nessun percorso'));
        }

        return WpSource::fromWpConfig($wpConfig);
    }

    /** La cartella degli upload di WordPress sta accanto a wp-config.php. */
    private static function cartellaUploads(string $wpConfig): string
    {
        $cartella = dirname($wpConfig) . '/wp-content/uploads';
        return is_dir($cartella) ? $cartella : '';
    }

    /**
     * Il percorso di wp-config.php, indovinato dalla struttura di SiteGround.
     * È solo un suggerimento nel campo: chi lo apre lo vede e lo corregge.
     */
    private static function indovinaWpConfig(): string
    {
        $qui = MIL_ROOT;
        // .../www/prova.dominio.it/public_html  ->  .../www/dominio.it/public_html
        if (preg_match('#^(.*/)([^/]+)/public_html$#', $qui, $m) === 1) {
            $senzaPrefisso = preg_replace('/^[^.]+\./', '', $m[2]);
            $candidato = $m[1] . $senzaPrefisso . '/public_html/wp-config.php';
            if (is_file($candidato)) {
                return $candidato;
            }
        }

        return '';
    }
}
