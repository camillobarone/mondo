<?php

declare(strict_types=1);

namespace Mil\Controller\Admin;

use Mil\Controller\Site\Listings;
use Mil\Core\Auth;
use Mil\Core\Csrf;
use Mil\Core\Db;
use Mil\Core\Faq;
use Mil\Core\Router;
use Mil\Core\Session;
use Mil\Core\Uploader;
use Mil\Core\View;
use Mil\Core\Vocab;
use Mil\Repo\Contacts;
use Mil\Repo\Deals;
use Mil\Repo\Log;
use Mil\Repo\Properties;
use Mil\Repo\Redirects;
use Mil\Repo\Users;
use Throwable;

final class PropertyController
{
    /**
     * Indirizzo di un video o di una visita virtuale, ripulito.
     *
     * Si accetta solo `http`/`https`: un campo libero che finisce dentro un
     * `href` è il posto classico dove si infila un `javascript:`, e chi
     * incolla un link non deve poter iniettare codice nella scheda.
     */
    private static function indirizzo(mixed $valore): string
    {
        $url = trim((string) $valore);
        if ($url === '') {
            return '';
        }

        $schema = mb_strtolower((string) parse_url($url, PHP_URL_SCHEME));

        return in_array($schema, ['http', 'https'], true) ? mb_substr($url, 0, 500) : '';
    }

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
            Router::redirect(self::doveTornare((int) $id));
        }

        View::show('admin/immobili-scheda', [
            'titolo' => 'Nuovo immobile',
            'p' => self::blank(),
            'images' => [],
            'agenti' => Users::active(),
            'clienti' => Contacts::search(['active' => 'any'], 1, 300)['items'],
            'abbinamenti' => [],
            'proposte' => [],
            'storicoPrezzi' => [],
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

            Properties::update((int) $id, $data, trim((string) ($_POST['price_reason'] ?? '')));
            Log::write('modifica', 'immobile', (int) $id, (string) $data['title']);
            Session::flash('Modifiche salvate.');
            Router::redirect(self::doveTornare((int) $id));
        }

        View::show('admin/immobili-scheda', [
            'titolo' => 'Immobile ' . $property['ref'],
            'p' => $property,
            'images' => Properties::images((int) $id),
            'agenti' => Users::active(),
            'clienti' => Contacts::search(['active' => 'any'], 1, 300)['items'],
            'abbinamenti' => Contacts::contactsFor($property, 5),
            'proposte' => Deals::offersFor((int) $id),
            'storicoPrezzi' => Properties::priceHistory((int) $id),
        ], 'layout/admin');
    }

    /**
     * L'immobile come si vedrà online, prima che sia online.
     *
     * Serve perché la scheda del gestionale è un modulo — caselle e menu — e
     * da lì non si capisce come verrà la pagina: dove va a finire la
     * descrizione, se le foto sono nell'ordine giusto, se il prezzo si legge.
     * Qui si vede la pagina vera, disegnata dallo stesso codice del sito, con
     * l'unica differenza di una fascia in alto che ricorda dove sei.
     *
     * Funziona anche in bozza: è proprio prima di pubblicare che serve
     * guardarla.
     */
    public static function preview(string $id): void
    {
        Auth::required();

        $property = Properties::find((int) $id);
        if ($property === null) {
            Session::flash('Immobile non trovato.', 'error');
            Router::redirect('/gestionale/immobili/');
        }

        Listings::render($property, true);
    }

    /**
     * Dove si finisce dopo aver salvato: sulla scheda, oppure sull'anteprima
     * se si è premuto il bottone che salva e mostra il risultato.
     */
    private static function doveTornare(int $id): string
    {
        $base = '/gestionale/immobili/' . $id . '/';

        return (string) ($_POST['dopo'] ?? '') === 'anteprima' ? $base . 'anteprima/' : $base;
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
                        'srcset' => $img['srcset'],
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

    /**
     * Riordino, copertina e testi alternativi delle foto, con un modulo solo.
     *
     * Le descrizioni si salvano a ogni azione, non solo premendo «Salva»:
     * chi scrive una didascalia e poi sposta la foto non deve ritrovarsi
     * il testo perso perché ha premuto il bottone sbagliato.
     */
    public static function managePhotos(string $id): void
    {
        Auth::required();
        Csrf::check();

        if (Properties::find((int) $id) === null) {
            Router::redirect('/gestionale/immobili/');
        }

        /** @var array<int|string,mixed> $alt */
        $alt = is_array($_POST['alt'] ?? null) ? $_POST['alt'] : [];
        Properties::saveImageAlts((int) $id, $alt);

        [$azione, $bersaglio] = array_pad(explode(':', (string) ($_POST['azione'] ?? 'salva'), 2), 2, '');

        match ($azione) {
            'su' => Properties::moveImage((int) $id, (int) $bersaglio, -1),
            'giu' => Properties::moveImage((int) $id, (int) $bersaglio, 1),
            'copertina' => Properties::setCoverImage((int) $id, (int) $bersaglio),
            default => null,
        };

        Session::flash($azione === 'copertina' ? 'Copertina aggiornata.' : 'Foto aggiornate.');
        Router::redirect('/gestionale/immobili/' . $id . '/#foto');
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

    /** Registra una proposta d'acquisto ricevuta sull'immobile. */
    public static function addOffer(string $id): void
    {
        Auth::required();
        Csrf::check();

        $property = Properties::find((int) $id);
        if ($property === null) {
            Router::redirect('/gestionale/immobili/');
        }

        $amount = float_or_null($_POST['amount'] ?? null);
        if ($amount === null || $amount <= 0) {
            Session::flash('Serve l’importo della proposta.', 'error');
            Router::redirect('/gestionale/immobili/' . $id . '/');
        }

        $contactId = int_or_null($_POST['contact_id'] ?? null) ?: null;

        Deals::createOffer([
            'property_id' => (int) $id,
            'contact_id' => $contactId,
            'amount' => $amount,
            'status' => 'presentata',
            'deposit' => float_or_null($_POST['deposit'] ?? null),
            'valid_until' => self::date($_POST['valid_until'] ?? null),
            'notes' => mb_substr(trim((string) ($_POST['notes'] ?? '')), 0, 2000),
        ]);

        if ($contactId !== null) {
            Contacts::touch($contactId);
        }

        Log::write('proposta', 'immobile', (int) $id, euro($amount));
        Session::flash('Proposta registrata.');
        Router::redirect('/gestionale/immobili/' . $id . '/');
    }

    public static function offerStatus(string $id, string $offerId): void
    {
        Auth::required();
        Csrf::check();

        $status = (string) ($_POST['status'] ?? '');
        if (!array_key_exists($status, Vocab::OFFER_STATUSES)) {
            Session::flash('Stato proposta non valido.', 'error');
            Router::redirect('/gestionale/immobili/' . $id . '/');
        }

        Deals::setOfferStatus((int) $offerId, $status);
        Log::write('proposta-' . $status, 'immobile', (int) $id);

        Session::flash($status === 'accettata'
            ? 'Proposta accettata: l’immobile è passato a "sotto proposta".'
            : 'Proposta aggiornata.');
        Router::redirect('/gestionale/immobili/' . $id . '/');
    }

    public static function deleteOffer(string $id, string $offerId): void
    {
        Auth::adminRequired();
        Csrf::check();

        Deals::deleteOffer((int) $offerId);
        Session::flash('Proposta eliminata.');
        Router::redirect('/gestionale/immobili/' . $id . '/');
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
            'video_url' => self::indirizzo($_POST['video_url'] ?? ''),
            'tour_url' => self::indirizzo($_POST['tour_url'] ?? ''),
            'excerpt' => mb_substr(trim((string) ($_POST['excerpt'] ?? '')), 0, 1000),
            'description' => trim((string) ($_POST['description'] ?? '')),
            // Le domande si incollano in un riquadro solo e si salvano già
            // divise in coppie: così la pagina e il JSON-LD leggono la stessa
            // cosa, e riaprendo la scheda si rilegge il testo come è stato
            // capito — se una domanda manca, si vede subito.
            'faqs' => Faq::json(Faq::parse((string) ($_POST['faqs'] ?? ''))),
            'seo_title' => mb_substr(trim((string) ($_POST['seo_title'] ?? '')), 0, 60),
            'seo_description' => mb_substr(trim((string) ($_POST['seo_description'] ?? '')), 0, 160),
            'agent_id' => int_or_null($_POST['agent_id'] ?? null) ?: null,
            'featured' => isset($_POST['featured']) ? 1 : 0,
            // Incarico e trattativa.
            'deal_stage' => array_key_exists((string) ($_POST['deal_stage'] ?? ''), Vocab::DEAL_STAGES)
                ? (string) $_POST['deal_stage'] : 'acquisizione',
            'min_price' => float_or_null($_POST['min_price'] ?? null),
            'owner_contact_id' => int_or_null($_POST['owner_contact_id'] ?? null) ?: null,
            'mandate_start' => self::date($_POST['mandate_start'] ?? null),
            'mandate_end' => self::date($_POST['mandate_end'] ?? null),
            'exclusive' => isset($_POST['exclusive']) ? 1 : 0,
            'commission_pct' => float_or_null($_POST['commission_pct'] ?? null),
            'sold_price' => float_or_null($_POST['sold_price'] ?? null),
            'preliminary_date' => self::date($_POST['preliminary_date'] ?? null),
            'deed_date' => self::date($_POST['deed_date'] ?? null),
            'commission_seller' => float_or_null($_POST['commission_seller'] ?? null),
            'commission_buyer' => float_or_null($_POST['commission_buyer'] ?? null),
            'commission_paid' => isset($_POST['commission_paid']) ? 1 : 0,
        ];

        if ($status === 'published') {
            $data['published_at'] = trim((string) ($_POST['published_at'] ?? '')) ?: Db::now();
        }

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
            'id' => 0, 'ref' => '', 'title' => '', 'slug' => '', 'status' => 'draft',
            'deal_stage' => 'acquisizione',
            'contract' => 'vendita', 'type' => 'appartamento', 'city' => 'Lecce', 'area' => '',
            'address' => '', 'postal_code' => '', 'lat' => '', 'lng' => '', 'price' => null,
            'price_hidden' => 0, 'min_price' => null, 'condo_fees' => null, 'sqm' => 0,
            'lot_sqm' => 0, 'rooms' => 0,
            'bedrooms' => 0, 'bathrooms' => 0, 'floor' => '', 'floors_total' => 0, 'year_built' => 0,
            'energy_class' => '', 'condition_state' => '', 'heating' => '', 'features' => '',
            'video_url' => '', 'tour_url' => '',
            'excerpt' => '', 'description' => '', 'faqs' => '', 'seo_title' => '', 'seo_description' => '',
            'agent_id' => null, 'owner_contact_id' => null,
            'mandate_start' => null, 'mandate_end' => null, 'exclusive' => 0, 'commission_pct' => null,
            'sold_price' => null, 'preliminary_date' => null, 'deed_date' => null,
            'commission_seller' => null, 'commission_buyer' => null, 'commission_paid' => 0,
            'featured' => 0, 'views' => 0, 'published_at' => null,
            'created_at' => Db::now(), 'updated_at' => null,
        ];
    }
}
