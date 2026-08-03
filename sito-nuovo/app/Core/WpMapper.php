<?php

declare(strict_types=1);

namespace Mil\Core;

/**
 * Traduce un immobile WP-Residence nello schema del gestionale.
 *
 * ⚠️ I nomi dei meta di WP-Residence cambiano fra versioni e temi child.
 * Per ogni campo qui sotto ci sono più alias, provati in ordine, e tutto
 * ciò che non viene riconosciuto finisce nel rapporto invece di sparire in
 * silenzio. Prima di un'importazione vera lanciare `--campi`: stampa i meta
 * realmente presenti sul sito, così gli alias si correggono su dati veri
 * invece che su una convenzione sperata.
 */
final class WpMapper
{
    /**
     * Campo del gestionale => meta WordPress candidati, in ordine di priorità.
     *
     * @var array<string,array<int,string>>
     */
    private const META = [
        'price' => ['property_price', 'prop_price', 'price'],
        'sqm' => ['property_size', 'prop_size', 'property_area_size'],
        'lot_sqm' => ['property_lot_size', 'prop_lot_size'],
        'rooms' => ['property_rooms', 'prop_rooms'],
        'bedrooms' => ['property_bedrooms', 'prop_bedrooms'],
        'bathrooms' => ['property_bathrooms', 'prop_bathrooms'],
        'address' => ['property_address', 'prop_address'],
        'postal_code' => ['property_zip', 'prop_zip', 'property_postal_code'],
        'lat' => ['property_latitude', 'prop_latitude'],
        'lng' => ['property_longitude', 'prop_longitude'],
        'year_built' => ['property_year', 'prop_year', 'property_year_built'],
        'energy_class' => ['energy_class', 'property_energy_class', 'prop_energy_class'],
        'ref' => ['property_id', 'prop_id', 'property_reference'],
        'floor' => ['property_floor', 'prop_floor'],
        'floors_total' => ['property_floors', 'prop_floors'],
        // WP-Residence tiene la galleria in un meta serializzato o in una
        // lista di ID separati da virgola, secondo la versione.
        'gallery' => ['image_to_attach', 'property_images', 'gallery_images', 'prop_gallery'],
    ];

    /**
     * Radici per riconoscere la tipologia dal nome del termine.
     *
     * Sono radici e non parole intere perché i termini del sito sono al
     * plurale ("Ville in Vendita a Lecce e Provincia", "Terreni edificabili")
     * e a volte contengono un title SEO invece del solo nome. L'ordine conta:
     * si prende la prima che combacia, quindi `villett` viene prima di `vill`,
     * altrimenti ogni villetta finirebbe classificata come villa.
     */
    private const TIPI = [
        'nuda-proprieta' => ['nuda propriet'],
        'casa-indipendente' => ['casa indipendente', 'casa singola', 'indipendent'],
        'villetta' => ['villett', 'villin'],
        'villa' => ['vill'],
        'masseria' => ['masseri'],
        'attico' => ['attic', 'mansard'],
        'monolocale' => ['monolocal'],
        'bilocale' => ['bilocal'],
        'trilocale' => ['trilocal'],
        'quadrilocale' => ['quadrilocal'],
        'terreno' => ['terren', 'suol', 'lotto'],
        'locale-commerciale' => ['commercial', 'negozi', 'uffic', 'capannon'],
        'appartamento' => ['appartament', 'apparta'],
    ];

    /** @var array<int,string> avvisi accumulati durante la mappatura */
    private array $avvisi = [];

    /**
     * @param array<string,mixed> $post riga di wp_posts
     * @param array<string,string> $meta
     * @param array<string,array<int,string>> $terms
     * @return array<string,mixed> riga pronta per la tabella properties
     */
    public function map(array $post, array $meta, array $terms): array
    {
        $wpId = (int) $post['ID'];
        $titolo = trim((string) $post['post_title']) ?: 'Senza titolo';

        $tipo = $this->tipo($terms, $wpId);
        $contratto = $this->contratto($terms);
        [$comune, $zona] = $this->luogo($terms, $meta);

        $prezzo = $this->numero($this->meta($meta, 'price'));

        return [
            'wp_id' => $wpId,
            'title' => mb_substr($titolo, 0, 191),
            // Lo slug si conserva identico: è la ragione per cui i vecchi
            // indirizzi continueranno a rispondere senza un redirect.
            'slug' => (string) $post['post_name'],
            'ref' => mb_substr(trim((string) $this->meta($meta, 'ref')), 0, 30),
            'status' => $post['post_status'] === 'publish' ? 'published' : 'draft',
            'deal_stage' => $post['post_status'] === 'publish' ? 'in_vendita' : 'acquisizione',
            'contract' => $contratto,
            'type' => $tipo,
            'city' => mb_substr($comune, 0, 120),
            'area' => mb_substr($zona, 0, 120),
            'address' => mb_substr(trim((string) $this->meta($meta, 'address')), 0, 191),
            'postal_code' => mb_substr(trim((string) $this->meta($meta, 'postal_code')), 0, 10),
            'lat' => mb_substr(trim((string) $this->meta($meta, 'lat')), 0, 20),
            'lng' => mb_substr(trim((string) $this->meta($meta, 'lng')), 0, 20),
            'price' => $prezzo,
            // Nessun prezzo a database significa trattativa riservata, non
            // prezzo dimenticato: è così che si comporta anche il sito attuale.
            'price_hidden' => $prezzo === null ? 1 : 0,
            'sqm' => (int) $this->numero($this->meta($meta, 'sqm')),
            'lot_sqm' => (int) $this->numero($this->meta($meta, 'lot_sqm')),
            'rooms' => (int) $this->numero($this->meta($meta, 'rooms')),
            'bedrooms' => (int) $this->numero($this->meta($meta, 'bedrooms')),
            'bathrooms' => (int) $this->numero($this->meta($meta, 'bathrooms')),
            'floor' => mb_substr(trim((string) $this->meta($meta, 'floor')), 0, 20),
            'floors_total' => (int) $this->numero($this->meta($meta, 'floors_total')),
            'year_built' => $this->anno($this->meta($meta, 'year_built')),
            'energy_class' => $this->classeEnergetica($this->meta($meta, 'energy_class')),
            'features' => $this->dotazioni($terms),
            'excerpt' => mb_substr($this->testo((string) $post['post_excerpt']), 0, 1000),
            'description' => $this->testo((string) $post['post_content']),
            'published_at' => $post['post_status'] === 'publish' ? (string) $post['post_date'] : null,
            'created_at' => (string) $post['post_date'],
            'updated_at' => (string) $post['post_modified'],
        ];
    }

    /** @return array<int,string> */
    public function avvisi(): array
    {
        return array_values(array_unique($this->avvisi));
    }

    /**
     * ID delle immagini dell'immobile: prima quella in evidenza, poi la
     * galleria. Duplicati rimossi mantenendo l'ordine.
     *
     * @param array<string,string> $meta
     * @return array<int,int>
     */
    public function immagini(array $meta): array
    {
        $ids = [];

        $cover = (int) ($meta['_thumbnail_id'] ?? 0);
        if ($cover > 0) {
            $ids[] = $cover;
        }

        $galleria = (string) $this->meta($meta, 'gallery');
        if ($galleria !== '') {
            // Il valore può essere serializzato da PHP oppure una lista di ID
            // separati da virgola: si estraggono comunque i numeri.
            preg_match_all('/\d+/', $galleria, $m);
            foreach ($m[0] as $n) {
                $id = (int) $n;
                // Gli array serializzati contengono anche lunghezze e indici:
                // si tengono solo i valori plausibili come ID di allegato.
                if ($id > 100) {
                    $ids[] = $id;
                }
            }
        }

        return array_values(array_unique($ids));
    }

    // ------------------------------------------------------------ interni

    /** @param array<string,string> $meta */
    private function meta(array $meta, string $campo): string
    {
        foreach (self::META[$campo] ?? [] as $chiave) {
            if (isset($meta[$chiave]) && trim($meta[$chiave]) !== '') {
                return $meta[$chiave];
            }
        }

        return '';
    }

    /** @param array<string,array<int,string>> $terms */
    private function tipo(array $terms, int $wpId): string
    {
        $nomi = $terms['property_category'] ?? [];

        foreach ($nomi as $nome) {
            $n = mb_strtolower($nome);
            foreach (self::TIPI as $slug => $parole) {
                foreach ($parole as $parola) {
                    if (str_contains($n, $parola)) {
                        return $slug;
                    }
                }
            }
        }

        if ($nomi !== []) {
            $this->avvisi[] = sprintf(
                'Tipologia non riconosciuta sul post %d: "%s" — importato come appartamento.',
                $wpId,
                implode(', ', $nomi)
            );
        }

        return 'appartamento';
    }

    /** @param array<string,array<int,string>> $terms */
    private function contratto(array $terms): string
    {
        foreach ($terms['property_action_category'] ?? [] as $nome) {
            if (str_contains(mb_strtolower($nome), 'affitt')) {
                return 'affitto';
            }
        }

        return 'vendita';
    }

    /**
     * @param array<string,array<int,string>> $terms
     * @param array<string,string> $meta
     * @return array{0:string,1:string}
     */
    private function luogo(array $terms, array $meta): array
    {
        $comune = $terms['property_city'][0] ?? '';
        $zona = $terms['property_area'][0] ?? '';

        // Senza tassonomia si prova a dedurre il comune dall'indirizzo, ma
        // solo se è uno di quelli presidiati: meglio vuoto che sbagliato.
        if ($comune === '') {
            $indirizzo = mb_strtolower((string) $this->meta($meta, 'address'));
            foreach (Vocab::CITIES as $city) {
                if ($indirizzo !== '' && str_contains($indirizzo, mb_strtolower($city))) {
                    $comune = $city;
                    break;
                }
            }
        }

        return [trim($comune), trim($zona)];
    }

    /** @param array<string,array<int,string>> $terms */
    private function dotazioni(array $terms): string
    {
        $trovate = [];

        foreach ($terms['property_features'] ?? [] as $nome) {
            $n = mb_strtolower($nome);
            foreach (Vocab::FEATURES as $feature) {
                if (str_contains($n, mb_strtolower($feature))) {
                    $trovate[] = $feature;
                    continue 2;
                }
            }
            $this->avvisi[] = sprintf('Dotazione non nel vocabolario, ignorata: "%s".', $nome);
        }

        return implode(', ', array_unique($trovate));
    }

    /** Numero da un valore WordPress, che può avere valuta e separatori. */
    private function numero(string $valore): ?float
    {
        $pulito = preg_replace('/[^\d,.\-]/', '', $valore) ?? '';
        if ($pulito === '') {
            return null;
        }

        // "180.000,50" (italiano) e "180000.50" (inglese) vanno letti entrambi.
        if (str_contains($pulito, ',') && str_contains($pulito, '.')) {
            $pulito = str_replace('.', '', $pulito);
        }
        $pulito = str_replace(',', '.', $pulito);

        return is_numeric($pulito) ? (float) $pulito : null;
    }

    private function anno(string $valore): int
    {
        $anno = (int) $this->numero($valore);

        return ($anno >= 1500 && $anno <= (int) date('Y') + 5) ? $anno : 0;
    }

    private function classeEnergetica(string $valore): string
    {
        $v = mb_strtoupper(trim($valore));

        return in_array($v, Vocab::ENERGY, true) ? $v : '';
    }

    /** HTML di WordPress → testo semplice con i paragrafi conservati. */
    private function testo(string $html): string
    {
        // Gli shortcode non hanno senso fuori da WordPress: si tolgono.
        $t = preg_replace('/\[[^\]]*\]/', '', $html) ?? $html;
        $t = preg_replace('#<br\s*/?>#i', "\n", $t) ?? $t;
        $t = preg_replace('#</(p|div|li|h[1-6])>#i', "\n\n", $t) ?? $t;
        $t = strip_tags($t);
        $t = html_entity_decode($t, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $t = preg_replace('/[ \t]+/', ' ', $t) ?? $t;
        $t = preg_replace('/\n{3,}/', "\n\n", $t) ?? $t;

        return trim($t);
    }
}
