<?php

declare(strict_types=1);

namespace Mil\Controller\Admin;

use Mil\Core\Auth;
use Mil\Core\Csrf;
use Mil\Core\Db;
use Mil\Core\Router;
use Mil\Core\Session;
use Mil\Core\Uploader;
use Mil\Core\View;
use Mil\Controller\Site\Journal;
use Mil\Controller\Site\Pages;
use Mil\Repo\Content;
use Mil\Repo\Log;
use Mil\Repo\Redirects;
use Mil\Repo\Users;

final class ContentController
{
    // ------------------------------------------------------------ articoli

    public static function posts(): void
    {
        Auth::required();

        View::show('admin/articoli-elenco', [
            'titolo' => 'Articoli',
            'result' => Content::posts(false, max(1, (int) q('pagina', '1')), 30),
        ], 'layout/admin');
    }

    public static function createPost(): void
    {
        Auth::required();

        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
            Csrf::check();
            $id = Content::createPost(self::postFromRequest());
            Log::write('crea', 'articolo', $id, (string) ($_POST['title'] ?? ''));
            Session::flash('Articolo creato.');
            Router::redirect('/gestionale/articoli/' . $id . '/');
        }

        View::show('admin/articolo-scheda', [
            'titolo' => 'Nuovo articolo',
            'post' => self::blankPost(),
            'autori' => Users::active(),
        ], 'layout/admin');
    }

    public static function editPost(string $id): void
    {
        Auth::required();

        $post = Content::post((int) $id);
        if ($post === null) {
            Session::flash('Articolo non trovato.', 'error');
            Router::redirect('/gestionale/articoli/');
        }

        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
            Csrf::check();
            $data = self::postFromRequest();
            if ($data['slug'] !== $post['slug']) {
                Redirects::put('/' . $post['slug'], '/' . $data['slug']);
            }
            Content::updatePost((int) $id, $data);
            Log::write('modifica', 'articolo', (int) $id);
            Session::flash('Articolo salvato.');
            Router::redirect('/gestionale/articoli/' . $id . '/');
        }

        View::show('admin/articolo-scheda', [
            'titolo' => (string) $post['title'],
            'post' => $post,
            'autori' => Users::active(),
        ], 'layout/admin');
    }

    public static function destroyPost(string $id): void
    {
        Auth::adminRequired();
        Csrf::check();
        Content::deletePost((int) $id);
        Session::flash('Articolo eliminato.');
        Router::redirect('/gestionale/articoli/');
    }

    // -------------------------------------------------------------- pagine

    public static function pages(): void
    {
        Auth::required();

        View::show('admin/pagine-elenco', [
            'titolo' => 'Pagine',
            'pagine' => Content::pages(false),
        ], 'layout/admin');
    }

    public static function createPage(): void
    {
        Auth::required();

        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
            Csrf::check();
            $id = Content::createPage(self::pageFromRequest());
            Log::write('crea', 'pagina', $id, (string) ($_POST['title'] ?? ''));
            Session::flash('Pagina creata.');
            Router::redirect('/gestionale/pagine/' . $id . '/');
        }

        View::show('admin/pagina-scheda', [
            'titolo' => 'Nuova pagina',
            'page' => ['id' => 0, 'title' => '', 'slug' => '', 'body' => '',
                'cover' => '', 'cover_srcset' => '', 'cover_alt' => '', 'cover_width' => 0, 'cover_height' => 0,
                'seo_title' => '', 'seo_description' => '', 'status' => 'published'],
        ], 'layout/admin');
    }

    public static function editPage(string $id): void
    {
        Auth::required();

        $page = Content::page((int) $id);
        if ($page === null) {
            Session::flash('Pagina non trovata.', 'error');
            Router::redirect('/gestionale/pagine/');
        }

        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
            Csrf::check();
            $data = self::pageFromRequest();
            if ($data['slug'] !== $page['slug']) {
                Redirects::put('/' . $page['slug'], '/' . $data['slug']);
            }
            Content::updatePage((int) $id, $data);
            Log::write('modifica', 'pagina', (int) $id);
            Session::flash('Pagina salvata.');
            Router::redirect('/gestionale/pagine/' . $id . '/');
        }

        View::show('admin/pagina-scheda', [
            'titolo' => (string) $page['title'],
            'page' => $page,
        ], 'layout/admin');
    }

    public static function destroyPage(string $id): void
    {
        Auth::adminRequired();
        Csrf::check();
        Content::deletePage((int) $id);
        Session::flash('Pagina eliminata.');
        Router::redirect('/gestionale/pagine/');
    }

    /**
     * Anteprima di un articolo o di una pagina, bozze comprese.
     *
     * Una bozza non risponde a nessun indirizzo pubblico, quindi senza questa
     * non ci sarebbe modo di guardarla prima di pubblicarla — e il momento in
     * cui uno vuole guardarla è proprio quello. Sta sotto `/gestionale/`, che
     * chiede l'accesso ed è già escluso dai motori nel robots.txt; la pagina
     * esce comunque `noindex`.
     */
    public static function previewPost(string $id): void
    {
        Auth::required();

        $post = Content::post((int) $id);
        if ($post === null) {
            Session::flash('Articolo non trovato.', 'error');
            Router::redirect('/gestionale/articoli/');
        }

        Journal::render($post, true);
    }

    public static function previewPage(string $id): void
    {
        Auth::required();

        $page = Content::page((int) $id);
        if ($page === null) {
            Session::flash('Pagina non trovata.', 'error');
            Router::redirect('/gestionale/pagine/');
        }

        Pages::renderPage($page, true);
    }

    // ------------------------------------------------------------- utility

    /**
     * La copertina, comune ad articoli e pagine.
     *
     * Tre casi, e vanno tenuti distinti: un file nuovo sostituisce quello di
     * prima; la casella «togli l'immagine» la cancella; se non si fa niente
     * le colonne non vengono toccate affatto. Quest'ultimo è il caso
     * importante — restituire una copertina vuota quando nessuno ha caricato
     * niente vorrebbe dire perdere la foto a ogni salvataggio del testo.
     *
     * L'immagine passa dallo stesso Uploader delle foto degli immobili: tre
     * larghezze in WebP, così una foto scaricata dal telefono non arriva in
     * pagina a due megabyte.
     *
     * @return array<string,mixed>
     */
    private static function copertinaFromRequest(): array
    {
        $alt = ['cover_alt' => mb_substr(trim((string) ($_POST['cover_alt'] ?? '')), 0, 255)];

        if (isset($_POST['cover_togli'])) {
            return $alt + ['cover' => '', 'cover_srcset' => '', 'cover_width' => 0, 'cover_height' => 0];
        }

        $file = $_FILES['cover_file'] ?? null;
        if (!is_array($file) || (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
            return $alt;
        }

        try {
            $img = Uploader::image($file, 'contenuti');
        } catch (\Throwable $e) {
            // Il testo appena scritto non si perde per una foto sbagliata:
            // si salva tutto il resto e si dice cos'è andato storto.
            Session::flash('Immagine non caricata: ' . $e->getMessage(), 'error');
            return $alt;
        }

        return $alt + [
            'cover' => $img['path'],
            'cover_srcset' => $img['srcset'],
            'cover_width' => $img['width'],
            'cover_height' => $img['height'],
        ];
    }

    /** @return array<string,mixed> */
    private static function postFromRequest(): array
    {
        $title = trim((string) ($_POST['title'] ?? 'Senza titolo'));
        $status = (string) ($_POST['status'] ?? 'draft') === 'published' ? 'published' : 'draft';

        $data = [
            'title' => mb_substr($title, 0, 191),
            'slug' => trim((string) ($_POST['slug'] ?? '')) ?: slugify($title),
            'excerpt' => mb_substr(trim((string) ($_POST['excerpt'] ?? '')), 0, 1000),
            'body' => trim((string) ($_POST['body'] ?? '')),
            'seo_title' => mb_substr(trim((string) ($_POST['seo_title'] ?? '')), 0, 60),
            'seo_description' => mb_substr(trim((string) ($_POST['seo_description'] ?? '')), 0, 160),
            'author_id' => int_or_null($_POST['author_id'] ?? null) ?: null,
            'status' => $status,
        ] + self::copertinaFromRequest();

        if ($status === 'published') {
            $data['published_at'] = trim((string) ($_POST['published_at'] ?? '')) ?: Db::now();
        }

        return $data;
    }

    /** @return array<string,mixed> */
    private static function pageFromRequest(): array
    {
        $title = trim((string) ($_POST['title'] ?? 'Senza titolo'));

        return [
            'title' => mb_substr($title, 0, 191),
            'slug' => trim((string) ($_POST['slug'] ?? '')) ?: slugify($title),
            'body' => trim((string) ($_POST['body'] ?? '')),
            'seo_title' => mb_substr(trim((string) ($_POST['seo_title'] ?? '')), 0, 60),
            'seo_description' => mb_substr(trim((string) ($_POST['seo_description'] ?? '')), 0, 160),
            'status' => (string) ($_POST['status'] ?? 'published') === 'published' ? 'published' : 'draft',
        ] + self::copertinaFromRequest();
    }

    /** @return array<string,mixed> */
    private static function blankPost(): array
    {
        return [
            'id' => 0, 'title' => '', 'slug' => '', 'excerpt' => '', 'body' => '',
            'cover' => '', 'cover_srcset' => '', 'cover_alt' => '', 'cover_width' => 0, 'cover_height' => 0,
            'seo_title' => '', 'seo_description' => '', 'author_id' => Auth::id(),
            'status' => 'draft', 'published_at' => null,
        ];
    }
}
