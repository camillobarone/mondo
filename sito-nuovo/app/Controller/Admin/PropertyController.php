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
use Mil\Core\Vocab;
use Mil\Repo\Contacts;
use Mil\Repo\Log;
use Mil\Repo\Properties;
use Mil\Repo\Redirects;
use Mil\Repo\Users;
use Throwable;

final class PropertyController
{
    public static function index(): void
    {
        Auth::required();

        $result = Properties::search([
            'status' => q('stato', 'any') ?: 'any',
            'q' => q('cerca'),
            'city' => q('comune'),
        ], max(1, (int) q('pagina', '1')), 25);

        View::show('admin/immobili-elenco', [
            'titolo' => 'Immobili',
            'result' => $result,
        ], 'layout/admin');
    }

    public static function create(): void
    {
        Auth::required();

        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
            Csrf::check();
            $id = Properties::create(self::fromRequest());
            Log::write('crea', 'immobile', $id, (string) ($_POST['title'] ?? ''));
            Session::flash('Immobile creato. Ora puoi caricare le foto.');
            Router::redirect('/gestionale/immobili/' . $id . '/');
        }

        View::show('admin/immobili-scheda', [
            'titolo' => 'Nuovo immobile',
            'p' => self::blank(),
            'images' => [],
            'agenti' => Users::active(),
            'abbinamenti' => [],
        ], 'layout/admin');
    }

    public static function edit(string $id): void
    {
        Auth::required();

        $property = Properties::find((int) $id);
        if ($property === null) {
            Session::flash('Immobile non trovato.', 'error');
            Router::redirect('/gestionale/immobili/');
        }

        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
            Csrf::check();
            $data = self::fromRequest();

            // Se lo slug cambia, il vecchio indirizzo non deve morire in 404:
            // si crea il 301 verso il nuovo, come fa Rank Math sul sito attuale.
            if ($data['slug'] !== $property['slug']) {
                Redirects::put('/immobili/' . $property['slug'], '/immobili/' . $data['slug']);
            }

            Properties::update((int) $id, $data);
            Log::write('modifica', 'immobile', (int) $id, (string) $data['title']);
            Session::flash('Modifiche salvate.');
            Router::redirect('/gestionale/immobili/' . $id . '/');
        }

        View::show('admin/immobili-scheda', [
            'titolo' => 'Immobile ' . $property['ref'],
            'p' => $property,
            'images' => Properties::images((int) $id),
            'agenti' => Users::active(),
            'abbinamenti' => Contacts::contactsFor($property, 5),
        ], 'layout/admin');
    }

    public static function uploadPhotos(string $id): void
    {
        Auth::required();
        Csrf::check();

        $property = Properties::find((int) $id);
        if ($property === null) {
            Router::redirect('/gestionale/immobili/');
        }

        /** @var array<string,array<int,mixed>>|null $files */
        $files = $_FILES['foto'] ?? null;
        $caricate = 0;
        $errori = [];

        if (is_array($files) && isset($files['name']) && is_array($files['name'])) {
            $sort = (int) Db::value(
                'SELECT COALESCE(MAX(sort), 0) FROM property_images WHERE property_id = :id',
                ['id' => (int) $id]
            );

            foreach (array_keys($files['name']) as $i) {
                if ((int) $files['error'][$i] === UPLOAD_ERR_NO_FILE) {
                    continue;
                }
                try {
                    $img = Uploader::image([
                        'name' => (string) $files['name'][$i],
                        'type' => (string) $files['type'][$i],
                        'tmp_name' => (string) $files['tmp_name'][$i],
                        'error' => (int) $files['error'][$i],
                        'size' => (int) $files['size'][$i],
                    ]);

                    Db::insert('property_images', [
                        'property_id' => (int) $id,
                        'path' => $img['path'],
                        'thumb' => $img['thumb'],
                        'alt' => (string) $property['title'],
                        'width' => $img['width'],
                        'height' => $img['height'],
                        'sort' => ++$sort,
                        'created_at' => Db::now(),
                    ]);
                    $caricate++;
                } catch (Throwable $e) {
                    $errori[] = $files['name'][$i] . ': ' . $e->getMessage();
                }
            }
        }

        if ($caricate > 0) {
            Session::flash($caricate . ' foto caricate.');
            Log::write('foto', 'immobile', (int) $id, $caricate . ' file');
        }
        foreach ($errori as $errore) {
            Session::flash((string) $errore, 'error');
        }
        if ($caricate === 0 && $errori === []) {
            Session::flash('Nessun file selezionato.', 'warn');
        }

        Router::redirect('/gestionale/immobili/' . $id . '/');
    }

    public static function deletePhoto(string $id, string $imageId): void
    {
        Auth::required();
        Csrf::check();

        $image = Db::one(
            'SELECT * FROM property_images WHERE id = :i AND property_id = :p',
            ['i' => (int) $imageId, 'p' => (int) $id]
        );

        if ($image !== null) {
            Uploader::remove((string) $image['path']);
            Db::delete('property_images', (int) $imageId);
            Session::flash('Foto eliminata.');
        }

        Router::redirect('/gestionale/immobili/' . $id . '/');
    }

    public static function destroy(string $id): void
    {
        Auth::adminRequired();
        Csrf::check();

        $property = Properties::find((int) $id);
        if ($property !== null) {
            foreach (Properties::images((int) $id) as $image) {
                Uploader::remove((string) $image['path']);
            }
            Properties::delete((int) $id);
            Log::write('elimina', 'immobile', (int) $id, (string) $property['title']);
            Session::flash('Immobile eliminato.');
        }

        Router::redirect('/gestionale/immobili/');
    }

    public static function matches(string $id): void
    {
        Auth::required();

        $property = Properties::find((int) $id);
        if ($property === null) {
            Router::redirect('/gestionale/immobili/');
        }

        View::show('admin/abbinamenti-immobile', [
            'titolo' => 'A chi proporre: ' . $property['title'],
            'p' => $property,
            'abbinamenti' => Contacts::contactsFor($property, 30),
        ], 'layout/admin');
    }

    /** @return array<string,mixed> */
    private static function fromRequest(): array
    {
        $title = trim((string) ($_POST['title'] ?? 'Senza titolo'));
        $status = (string) ($_POST['status'] ?? 'draft');
        if (!array_key_exists($status, Vocab::STATUSES)) {
            $status = 'draft';
        }

        $type = (string) ($_POST['type'] ?? 'appartamento');
        if (!array_key_exists($type, Vocab::TYPES)) {
            $type = 'appartamento';
        }

        $contract = (string) ($_POST['contract'] ?? 'vendita');
        if (!array_key_exists($contract, Vocab::CONTRACTS)) {
            $contract = 'vendita';
        }

        /** @var array<int,string> $features */
        $features = is_array($_POST['features'] ?? null) ? $_POST['features'] : [];
        $features = array_values(array_intersect($features, Vocab::FEATURES));

        $data = [
            'title' => mb_substr($title, 0, 191),
            'slug' => trim((string) ($_POST['slug'] ?? '')) ?: slugify($title),
            'ref' => trim((string) ($_POST['ref'] ?? '')),
            'status' => $status,
            'contract' => $contract,
            'type' => $type,
            'city' => mb_substr(trim((string) ($_POST['city'] ?? '')), 0, 120),
            'area' => mb_substr(trim((string) ($_POST['area'] ?? '')), 0, 120),
            'address' => mb_substr(trim((string) ($_POST['address'] ?? '')), 0, 191),
            'postal_code' => mb_substr(trim((string) ($_POST['postal_code'] ?? '')), 0, 10),
            'lat' => mb_substr(trim((string) ($_POST['lat'] ?? '')), 0, 20),
            'lng' => mb_substr(trim((string) ($_POST['lng'] ?? '')), 0, 20),
            'price' => float_or_null($_POST['price'] ?? null),
            'price_hidden' => isset($_POST['price_hidden']) ? 1 : 0,
            'condo_fees' => float_or_null($_POST['condo_fees'] ?? null),
            'sqm' => (int) ($_POST['sqm'] ?? 0),
            'lot_sqm' => (int) ($_POST['lot_sqm'] ?? 0),
            'rooms' => (int) ($_POST['rooms'] ?? 0),
            'bedrooms' => (int) ($_POST['bedrooms'] ?? 0),
            'bathrooms' => (int) ($_POST['bathrooms'] ?? 0),
            'floor' => mb_substr(trim((string) ($_POST['floor'] ?? '')), 0, 20),
            'floors_total' => (int) ($_POST['floors_total'] ?? 0),
            'year_built' => (int) ($_POST['year_built'] ?? 0),
            'energy_class' => in_array((string) ($_POST['energy_class'] ?? ''), Vocab::ENERGY, true)
                ? (string) $_POST['energy_class'] : '',
            'condition_state' => array_key_exists((string) ($_POST['condition_state'] ?? ''), Vocab::CONDITIONS)
                ? (string) $_POST['condition_state'] : '',
            'heating' => mb_substr(trim((string) ($_POST['heating'] ?? '')), 0, 60),
            'features' => implode(', ', $features),
            'excerpt' => mb_substr(trim((string) ($_POST['excerpt'] ?? '')), 0, 1000),
            'description' => trim((string) ($_POST['description'] ?? '')),
            'seo_title' => mb_substr(trim((string) ($_POST['seo_title'] ?? '')), 0, 60),
            'seo_description' => mb_substr(trim((string) ($_POST['seo_description'] ?? '')), 0, 160),
            'agent_id' => int_or_null($_POST['agent_id'] ?? null) ?: null,
            'featured' => isset($_POST['featured']) ? 1 : 0,
        ];

        if ($status === 'published') {
            $data['published_at'] = trim((string) ($_POST['published_at'] ?? '')) ?: Db::now();
        }

        return $data;
    }

    /** @return array<string,mixed> */
    private static function blank(): array
    {
        return [
            'id' => 0, 'ref' => '', 'title' => '', 'slug' => '', 'status' => 'draft',
            'contract' => 'vendita', 'type' => 'appartamento', 'city' => 'Lecce', 'area' => '',
            'address' => '', 'postal_code' => '', 'lat' => '', 'lng' => '', 'price' => null,
            'price_hidden' => 0, 'condo_fees' => null, 'sqm' => 0, 'lot_sqm' => 0, 'rooms' => 0,
            'bedrooms' => 0, 'bathrooms' => 0, 'floor' => '', 'floors_total' => 0, 'year_built' => 0,
            'energy_class' => '', 'condition_state' => '', 'heating' => '', 'features' => '',
            'excerpt' => '', 'description' => '', 'seo_title' => '', 'seo_description' => '',
            'agent_id' => null, 'featured' => 0, 'views' => 0, 'published_at' => null,
            'created_at' => Db::now(), 'updated_at' => null,
        ];
    }
}
