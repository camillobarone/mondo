<?php

declare(strict_types=1);

namespace Mil\Core;

/**
 * Traduce un immobile WP-Residence nello schema del gestionale.
 *
 * Le chiavi qui sotto sono state lette sul database vero di
 * mondoimmobiliarelecce.it (connettore MCP, contesto `edit`, post 31915 e
 * 22670 — uno recente e uno del 2022) e i nomi delle tassonomie su tredici
 * immobili fra pubblicati e bozze. Non sono una convenzione sperata.
 *
 * Restano più alias per campo perché i meta di WP-Residence cambiano fra
 * versioni: il primo è quello verificato, gli altri sono rete di sicurezza.
 * Prima di un'importazione vera lanciare comunque `--campi`, che stampa il
 * censimento completo su tutti e 49 gli immobili.
 */
final class WpMapper
{
    /**
     * Campo del gestionale => meta WordPress candidati, in ordine di priorità.
     *
     * Attenzione ai trattini: WP-Residence mescola `property_price` con
     * `property-year` e `stories-number`. Cercare l'underscore dove il tema
     * usa il trattino non dà errore, dà una colonna vuota.
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
        'year_built' => ['property-year', 'property_year', 'property_year_built'],
        'energy_class' => ['energy_class', 'property_energy_class', 'prop_energy_class'],
        'ref' => ['property_internal_id', 'mls', 'property_id', 'property_reference'],
        'floor' => ['property_floor', 'prop_floor'],
        'floors_total' => ['stories-number', 'property_floors', 'prop_floors'],
        // WP-Residence tiene la galleria sia come lista di ID separati da
        // virgola (`image_to_attach`) sia come array serializzato
        // (`wpestate_property_gallery`): sul sito vero ci sono entrambi.
        'gallery' => ['image_to_attach', 'wpestate_property_gallery', 'property_images', 'gallery_images'],
        // WP-Residence tiene il video spezzato in due: il tipo (youtube,
        // vimeo) e il solo identificativo. L'indirizzo intero si ricompone.
        'video_type' => ['embed_video_type', 'property_video_type'],
        'video_id' => ['embed_video_id', 'property_video_id', 'property_video'],
        // La visita virtuale — Matterport e simili — sta invece come indirizzo
        // o come codice di incorporamento, a seconda di come e stata inserita.
        'tour' => ['virtual_tour', 'property_virtual_tour', 'wpestate_virtual_tour', 'matterport_url', 'property_tour'],
    ];

    /**
     * Radici per riconoscere la tipologia dal nome del termine.
     *
     * Sono radici e non parole intere perché i termini veri del sito sono al
     * plurale e a volte contengono un title SEO invece del solo nome: la
     * categoria 67 si chiama "Ville in Vendita a Lecce e Provincia".
     *
     * **L'ordine è la priorità.** Sul sito vero un immobile porta più
     * categorie insieme — il post 31915 è "Appartamenti" *e* "Indipendenti" —
     * quindi non si può prendere la prima categoria che combacia con
     * qualcosa: si scorrono le tipologie dalla più specifica alla più
     * generica e si tiene la prima che trova un termine. Al contrario, quella
     * casa indipendente verrebbe importata come appartamento solo perché
     * WordPress restituisce la categoria 28 prima della 46.
     *
     * Da qui anche `villett` prima di `vill` e le tipologie di pregio prima
     * di `appartamento`, che è il paracadute.
     */
    private const TIPI = [
        'nuda-proprieta' => ['nuda propriet'],
        'masseria' => ['masseri'],
        'palazzo-storico' => ['palazzo storico', 'antiche dimore', 'antica dimora'],
        'locale-commerciale' => ['commercial', 'negozi', 'uffic', 'capannon', 'artigianal'],
        'terreno' => ['terren', 'suol', 'lotto edificabil'],
        'villetta' => ['villett', 'villin'],
        'villa' => ['vill'],
        'casa-indipendente' => ['casa indipendente', 'casa singola', 'indipendent'],
        'attico' => ['attic', 'mansard'],
        'monolocale' => ['monolocal'],
        'bilocale' => ['bilocal'],
        'trilocale' => ['trilocal'],
        'quadrilocale' => ['quadrilocal'],
        // "Residence" e "Multiproprietà" sono categorie vere del sito: senza
        // una radice qui ogni immobile che le porta da solo finirebbe fra gli
        // avvisi invece che fra gli appartamenti.
        'appartamento' => ['appartament', 'apparta', 'residence', 'multiproprie'],
    ];

    /**
     * Tassonomie in cui cercare la tipologia. La nuda proprietà sul sito vero
     * non è una categoria ma una caratteristica (termine 2003), quindi va
     * cercata anche lì, altrimenti si perde.
     */
    private const TASSONOMIE_TIPO = ['property_category', 'property_features'];

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
        [$comune, $zona] = $this->luogo($terms, $meta, $titolo);

        $prezzo = $this->numero($this->meta($meta, 'price'));
        // Uno zero a database è la trattativa riservata scritta con lo zero,
        // non un immobile che si regala: va trattato come prezzo assente,
        // altrimenti il sito pubblica "€ 0".
        if ($prezzo !== null && $prezzo <= 0) {
            $prezzo = null;
        }

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
            'video_url' => $this->video($meta),
            'tour_url' => $this->tour($meta),
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

    /**
     * Verifica, campo per campo, se WordPress contiene davvero il dato che
     * l'importazione andrà a cercare.
     *
     * È il controllo che serve davvero prima di importare. L'elenco crudo dei
     * meta presenti non lo è: sono sessanta nomi tecnici, e chi deve decidere
     * se procedere non ha modo di sapere quali contino. Questa risposta invece
     * si legge — «prezzo: trovato su 49 schede», «anno di costruzione: non
     * trovato» — e dice in anticipo cosa arriverà vuoto.
     *
     * @param array<int,array{key:string,n:int,esempio:string}> $censimento da WpSource::metaCensus()
     * @return array<int,array{campo:string,chiave:string,schede:int,esempio:string}>
     */
    public function copertura(array $censimento): array
    {
        $conteggi = [];
        foreach ($censimento as $riga) {
            $conteggi[$riga['key']] = $riga;
        }

        $out = [];
        foreach (self::CAMPI_LEGGIBILI as $campo => $etichetta) {
            $trovato = null;
            foreach (self::META[$campo] ?? [] as $chiave) {
                if (isset($conteggi[$chiave]) && $conteggi[$chiave]['n'] > 0) {
                    $trovato = $conteggi[$chiave];
                    break;
                }
            }

            $out[] = [
                'campo' => $etichetta,
                'chiave' => $trovato === null ? '' : (string) $trovato['key'],
                'schede' => $trovato === null ? 0 : (int) $trovato['n'],
                'esempio' => $trovato === null ? '' : (string) $trovato['esempio'],
            ];
        }

        return $out;
    }

    /** I nomi dei campi come li chiamerebbe un agente, non il database. */
    private const CAMPI_LEGGIBILI = [
        'price' => 'Prezzo',
        'sqm' => 'Superficie',
        'lot_sqm' => 'Superficie del lotto',
        'rooms' => 'Locali',
        'bedrooms' => 'Camere',
        'bathrooms' => 'Bagni',
        'address' => 'Indirizzo',
        'postal_code' => 'CAP',
        'lat' => 'Latitudine',
        'lng' => 'Longitudine',
        'year_built' => 'Anno di costruzione',
        'energy_class' => 'Classe energetica',
        'ref' => 'Riferimento',
        'floor' => 'Piano',
        'floors_total' => 'Piani totali',
        'gallery' => 'Galleria fotografica',
        'video_id' => 'Video (YouTube o Vimeo)',
        'tour' => 'Visita virtuale (Matterport)',
    ];

    // ------------------------------------------------------------ interni

    /**
     * L'indirizzo del video, ricomposto.
     *
     * WP-Residence non salva l'indirizzo intero: tiene da una parte il tipo
     * (`youtube`, `vimeo`) e dall'altra il solo identificativo. A volte però
     * nell'identificativo c'è già l'indirizzo completo, perché è stato
     * incollato così: in quel caso si prende com'è.
     *
     * @param array<string,string> $meta
     */
    private function video(array $meta): string
    {
        $id = trim($this->meta($meta, 'video_id'));
        if ($id === '') {
            return '';
        }

        if (str_starts_with($id, 'http://') || str_starts_with($id, 'https://')) {
            return mb_substr($id, 0, 500);
        }

        $tipo = mb_strtolower(trim($this->meta($meta, 'video_type')));

        return match (true) {
            str_contains($tipo, 'vimeo') => 'https://vimeo.com/' . rawurlencode($id),
            default => 'https://www.youtube.com/watch?v=' . rawurlencode($id),
        };
    }

    /**
     * L'indirizzo della visita virtuale.
     *
     * Può arrivare come indirizzo pulito oppure come codice `<iframe>` intero,
     * a seconda di come è stato incollato in WordPress. Nel secondo caso si
     * tiene solo l'indirizzo: il codice di un terzo porta con sé attributi e
     * tracciamenti che non controlliamo, e ricostruirlo noi costa una riga.
     *
     * @param array<string,string> $meta
     */
    private function tour(array $meta): string
    {
        $grezzo = trim($this->meta($meta, 'tour'));
        if ($grezzo === '') {
            return '';
        }

        if (preg_match('#src=["\']([^"\']+)["\']#i', $grezzo, $m) === 1) {
            $grezzo = $m[1];
        }

        return str_starts_with($grezzo, 'http') ? mb_substr($grezzo, 0, 500) : '';
    }

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
        $nomi = [];
        foreach (self::TASSONOMIE_TIPO as $tassonomia) {
            foreach ($terms[$tassonomia] ?? [] as $nome) {
                $nomi[] = mb_strtolower($nome);
            }
        }

        // Le tipologie fuori, i termini dentro: vince la tipologia più
        // specifica, non il termine che WordPress restituisce per primo.
        foreach (self::TIPI as $slug => $parole) {
            foreach ($parole as $parola) {
                foreach ($nomi as $n) {
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
    private function luogo(array $terms, array $meta, string $titolo): array
    {
        $comune = $this->canonizzaComune(
            $this->termineDalTitolo($terms['property_city'] ?? [], $titolo)
        );
        $zona = $this->termineDalTitolo($terms['property_area'] ?? [], $titolo);

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

        // Sul sito vero `property_area` ripete quasi sempre il comune
        // ("Trepuzzi" / "Trepuzzi"). Ripeterlo anche qui non aggiunge niente
        // e riempie di rumore le schede: la zona si tiene solo se è altro.
        if ($this->confrontabile($zona) === $this->confrontabile($comune)) {
            $zona = '';
        }

        return [trim($comune), trim($zona)];
    }

    /**
     * Il termine giusto quando ce n'è più di uno.
     *
     * Un immobile a Torre Lapillo porta anche "Nardò" e "Porto Cesareo" fra i
     * comuni, e WordPress restituisce per primo quello con l'ID più basso —
     * cioè il più vecchio, non il più giusto. Il titolo dell'annuncio invece
     * il posto lo dice: se uno dei termini compare lì, è quello.
     *
     * @param array<int,string> $nomi
     */
    private function termineDalTitolo(array $nomi, string $titolo): string
    {
        if ($nomi === []) {
            return '';
        }

        $t = $this->confrontabile($titolo);
        foreach ($nomi as $nome) {
            $n = $this->confrontabile($nome);
            if ($n !== '' && str_contains($t, $n)) {
                return $nome;
            }
        }

        return $nomi[0];
    }

    /**
     * Il comune scritto come lo scrive il gestionale.
     *
     * Sul sito vero i termini sono "Lecce città" e "Torre lapillo": lasciati
     * così non combaciano con `Vocab::CITIES`, e il filtro per comune del
     * sito pubblico — che accetta solo quei valori — non li trova mai.
     */
    private function canonizzaComune(string $nome): string
    {
        $n = $this->confrontabile($nome);
        if ($n === '') {
            return '';
        }

        foreach (Vocab::CITIES as $city) {
            $c = $this->confrontabile($city);
            if ($n === $c) {
                return $city;
            }
        }

        // Secondo giro sui prefissi, per assorbire i suffissi redazionali:
        // "Lecce città" torna Lecce. Si fa dopo il confronto esatto, così
        // "San Cesario di Lecce" resta sé stesso invece di diventare Lecce.
        foreach (Vocab::CITIES as $city) {
            if (str_starts_with($n, $this->confrontabile($city))) {
                return $city;
            }
        }

        return trim($nome);
    }

    /** Forma confrontabile: solo lettere e cifre, minuscole. */
    private function confrontabile(string $valore): string
    {
        $v = mb_strtolower(trim($valore));

        return preg_replace('/[^\p{L}\p{N}]+/u', '', $v) ?? $v;
    }

    /** @param array<string,array<int,string>> $terms */
    private function dotazioni(array $terms): string
    {
        $trovate = [];

        foreach ($terms['property_features'] ?? [] as $nome) {
            $n = mb_strtolower($nome);

            // La nuda proprietà è già diventata la tipologia dell'immobile:
            // ripeterla fra le dotazioni la farebbe leggere come un accessorio.
            if (str_contains($n, 'nuda propriet')) {
                continue;
            }

            foreach (Vocab::FEATURES as $feature) {
                if (str_contains($n, mb_strtolower($feature))) {
                    $trovate[] = $feature;
                    continue 2;
                }
            }

            // Fuori vocabolario non vuol dire inventata: "Area Solare di
            // Proprietà" è un termine vero, scelto a mano sul sito attuale.
            // Si tiene com'è — buttarla sarebbe perdere un dato di vendita —
            // e l'avviso resta per poterla poi aggiungere a `Vocab::FEATURES`.
            $trovate[] = trim($nome);
            $this->avvisi[] = sprintf('Dotazione fuori vocabolario, importata com\'è: "%s".', $nome);
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
