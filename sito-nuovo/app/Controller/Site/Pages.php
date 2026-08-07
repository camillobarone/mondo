<?php

declare(strict_types=1);

namespace Mil\Controller\Site;

use Mil\Core\Imposte;
use Mil\Core\Mutuo;
use Mil\Core\Seo;
use Mil\Core\Settings;
use Mil\Core\Testo;
use Mil\Core\View;
use Mil\Repo\Content;
use Mil\Repo\Properties;
use Mil\Repo\Redirects;

final class Pages
{
    /** L'anteprima di cortesia per chat e social, se qualcuno l'ha caricata. */
    public const FILE_SOCIAL = '/assets/img/social-1200x630.png';

    public static function home(): void
    {
        // `lecce_prima`: la sede principale è Lecce, e la home deve aprirsi su
        // Lecce. Senza questo, bastava caricare una villa sulla costa perché
        // la prima cosa che si vede del sito fosse un altro comune — comprese
        // le foto grandi in cima, che escono da qui.
        $featured = Properties::search(
            ['status' => 'online', 'featured' => 1, 'lecce_prima' => true],
            1,
            6
        );
        if ($featured['total'] === 0) {
            $featured = Properties::search(['status' => 'online', 'lecce_prima' => true], 1, 6);
        }

        $pageUrl = Seo::base() . '/';
        $graph = [
            Seo::logoNode(),
            Seo::agentNode(),
            Seo::websiteNode(),
            [
                '@type' => 'WebPage',
                '@id' => $pageUrl . '#webpage',
                'url' => $pageUrl,
                'name' => Settings::get('home_seo_title', 'Agenzia immobiliare a Lecce e Porto Cesareo'),
                'isPartOf' => ['@id' => Seo::base() . '/#website'],
                'about' => ['@id' => Seo::base() . '/#agent'],
                'mainEntity' => ['@id' => Seo::base() . '/#agent'],
                'inLanguage' => 'it',
            ],
        ];

        View::show('site/home', [
            'meta' => self::meta(
                Settings::get('home_seo_title', 'Agenzia immobiliare a Lecce e Porto Cesareo'),
                Settings::get('home_seo_description', 'Agenzia immobiliare FIMAA dal 1994 a Lecce e Porto Cesareo. Vendita e valutazione di case, ville e appartamenti nel Salento.'),
                $pageUrl,
                Seo::graph($graph),
                'index, follow',
                // Adesso l'LCP della home è la foto dell'hero, non più il
                // titolo: va annunciata, altrimenti il browser la scopre
                // solo a layout costruito.
                self::preloadHero($featured['items']),
                // Anche la home condivisa in chat mostra la sua foto grande.
                (string) (self::heroImage($featured['items'])['cover'] ?? '')
            ),
            'featured' => $featured['items'],
            'posts' => Content::posts(true, 1, 3)['items'],
            'cities' => Properties::citiesInUse(),
        ]);
    }

    public static function contatti(): void
    {
        $pageUrl = Seo::base() . '/contatti/';
        $graph = [
            Seo::logoNode(),
            Seo::agentNode(),
            Seo::agentPortoCesareoNode(),
            [
                '@type' => 'ContactPage',
                '@id' => $pageUrl . '#webpage',
                'url' => $pageUrl,
                'name' => 'Contatti',
                'about' => ['@id' => Seo::base() . '/#agent'],
                'inLanguage' => 'it',
            ],
            Seo::breadcrumbNode([
                ['name' => 'Home', 'url' => Seo::base() . '/'],
                ['name' => 'Contatti', 'url' => $pageUrl],
            ], $pageUrl),
        ];

        View::show('site/contatti', [
            'meta' => self::meta(
                'Contatti — Mondo Immobiliare Lecce e Porto Cesareo',
                'Le due sedi di Mondo Immobiliare: Lecce, Via Giuseppe Parini 48/a e Porto Cesareo, Via Francesco Cilea 76. Telefono, orari e modulo di contatto.',
                $pageUrl,
                Seo::graph($graph)
            ),
        ]);
    }

    public static function valutazione(): void
    {
        $pageUrl = Seo::base() . '/valutazione-gratuita/';

        // Le FAQ dello schema sono le stesse stampate in pagina: senza testo
        // visibile il markup violerebbe le linee guida.
        $faq = self::faqValutazione();

        $graph = [
            Seo::logoNode(),
            Seo::agentNode(),
            [
                '@type' => 'WebPage',
                '@id' => $pageUrl . '#webpage',
                'url' => $pageUrl,
                'name' => 'Valutazione gratuita della tua casa',
                'inLanguage' => 'it',
                'about' => ['@id' => Seo::base() . '/#agent'],
            ],
            Seo::faqNode($faq, $pageUrl),
            Seo::breadcrumbNode([
                ['name' => 'Home', 'url' => Seo::base() . '/'],
                ['name' => 'Valutazione gratuita', 'url' => $pageUrl],
            ], $pageUrl),
        ];

        View::show('site/valutazione', [
            'meta' => self::meta(
                'Valutazione gratuita della casa a Lecce e nel Salento',
                'Valutazione professionale e gratuita del tuo immobile a Lecce, Porto Cesareo e provincia. Risposta entro 48 ore da un agente FIMAA.',
                $pageUrl,
                Seo::graph($graph)
            ),
            'faq' => $faq,
        ]);
    }

    /**
     * Redirect 301, poi pagine statiche, poi articoli del blog, poi 404.
     * In quest'ordine.
     *
     * Alla radice ci stanno due cose: le pagine e gli articoli. Gli articoli
     * ci stanno perché è lì che il sito vero li tiene da anni, ed è l'unico
     * modo di cambiare programma senza cambiare 56 indirizzi indicizzati.
     * Che non si pestino i piedi lo garantisce Content::uniqueSlug(), che
     * cerca lo slug in entrambe le tabelle prima di assegnarlo.
     */
    public static function catchAll(string $path): void
    {
        self::redirectIfKnown($path);

        $slug = trim($path, '/');
        if ($slug === '') {
            self::notFound();
            return;
        }

        $page = Content::pageBySlug($slug);

        if ($page === null || $page['status'] !== 'published') {
            if (Journal::show($slug)) {
                return;
            }
            self::notFound();
            return;
        }

        self::renderPage($page);
    }

    /**
     * Disegna una pagina statica.
     *
     * Sta fuori da catchAll() perché la usa anche l'anteprima del gestionale:
     * una bozza non risponde a nessun indirizzo pubblico, e senza questo non
     * ci sarebbe modo di vederla prima di pubblicarla — che è esattamente il
     * momento in cui uno vorrebbe guardarla.
     *
     * @param array<string,mixed> $page
     */
    public static function renderPage(array $page, bool $anteprima = false): void
    {
        $pageUrl = Seo::base() . '/' . $page['slug'] . '/';
        $graph = [
            Seo::logoNode(),
            Seo::agentNode(),
            [
                '@type' => 'WebPage',
                '@id' => $pageUrl . '#webpage',
                'url' => $pageUrl,
                'name' => Seo::text((string) $page['title']),
                'inLanguage' => 'it',
                'publisher' => ['@id' => Seo::base() . '/#agent'],
            ],
        ];

        // Le domande frequenti, se la pagina ne ha una sezione. Si leggono
        // dal testo già scritto — nessun campo in più da compilare — e
        // valgono per le guide fiscali, dove metà del contenuto è fatto di
        // domande che qualcuno digita davvero in un motore di ricerca.
        $faq = Testo::faq((string) ($page['body'] ?? ''));
        if ($faq !== []) {
            $graph[] = Seo::faqNode($faq, $pageUrl);
        }

        $graph[] = Seo::breadcrumbNode([
            ['name' => 'Home', 'url' => Seo::base() . '/'],
            ['name' => Seo::text((string) $page['title']), 'url' => $pageUrl],
        ], $pageUrl);

        View::show('site/pagina', [
            'meta' => self::meta(
                (string) ($page['seo_title'] ?: $page['title']),
                (string) ($page['seo_description'] ?: tronca((string) $page['body'], 155)),
                $pageUrl,
                Seo::graph($graph),
                $anteprima ? 'noindex, nofollow' : 'index, follow',
                '',
                (string) ($page['cover'] ?? '')
            ),
            'page' => $page,
        ]);
    }

    /**
     * Se il percorso è nella tabella dei reindirizzamenti, esce subito con
     * il 301. Vale anche per gli indirizzi che una rotta ha già intercettato
     * — un annuncio rinominato passa da qui, non dal 404.
     */
    public static function redirectIfKnown(?string $path = null): void
    {
        $path ??= (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
        $redirect = Redirects::match($path);

        if ($redirect !== null) {
            header('Location: ' . url((string) $redirect['to_path']), true, (int) $redirect['code']);
            exit;
        }
    }

    public static function notFound(): void
    {
        self::redirectIfKnown();

        http_response_code(404);
        View::show('site/404', [
            'meta' => self::meta('Pagina non trovata', '', Seo::base() . '/', '', 'noindex, follow'),
        ]);
    }

    /** @return array<int,array{q:string,a:string}> */
    /**
     * Calcolatore delle imposte d'acquisto.
     *
     * Il modulo va in GET e non in POST: il risultato ha un indirizzo suo, si
     * può mandare a un cliente per email o rileggere il giorno dopo, e la
     * pagina resta memorizzabile in cache. In cambio la pagina col risultato
     * esce `noindex`: sono combinazioni infinite dello stesso contenuto, e
     * indicizzarle vorrebbe dire riempire Google di pagine sottili.
     */
    public static function calcolatore(): void
    {
        $pageUrl = Seo::base() . '/calcolatore-imposte-acquisto-casa/';

        $compilato = q('rendita') !== '' || q('prezzo') !== '';
        $dati = [
            'prima' => q('casa', 'prima') !== 'seconda',
            'impresa' => q('venditore') === 'impresa',
            'lusso' => q('lusso') === '1',
            'rendita' => float_or_null(q('rendita')),
            'prezzo' => float_or_null(q('prezzo')),
        ];

        $faq = self::faqImposte();

        $graph = [
            Seo::logoNode(),
            Seo::agentNode(),
            [
                '@type' => 'WebPage',
                '@id' => $pageUrl . '#webpage',
                'url' => $pageUrl,
                'name' => 'Calcolo delle imposte sull’acquisto della casa',
                'inLanguage' => 'it',
                'about' => ['@id' => Seo::base() . '/#agent'],
            ],
            Seo::faqNode($faq, $pageUrl),
            Seo::breadcrumbNode([
                ['name' => 'Home', 'url' => Seo::base() . '/'],
                ['name' => 'Calcolo imposte d’acquisto', 'url' => $pageUrl],
            ], $pageUrl),
        ];

        View::show('site/calcolatore', [
            'meta' => self::meta(
                'Calcolo imposte acquisto casa a Lecce e nel Salento',
                'Calcola registro, IVA, ipotecaria e catastale sull’acquisto della casa: prima o seconda casa, da privato o da costruttore. Aliquote 2026.',
                $pageUrl,
                Seo::graph($graph),
                $compilato ? 'noindex, follow' : 'index, follow'
            ),
            'dati' => $dati,
            'compilato' => $compilato,
            'esito' => $compilato ? Imposte::calcola($dati) : null,
            'faq' => $faq,
        ]);
    }

    /**
     * Le domande sono quelle della guida «Imposte Acquisto Casa» del sito
     * dell'agenzia, accorciate: stesse risposte, stessi numeri. Se un giorno
     * cambiano lì, vanno cambiate anche qui — è l'unico punto del sito nuovo
     * in cui un contenuto vive in due posti, e va detto invece che nascosto.
     *
     * @return array<int,array{q:string,a:string}>
     */
    public static function faqImposte(): array
    {
        return [
            [
                'q' => 'Come si calcola il valore catastale?',
                'a' => 'Si prende la rendita catastale, che sta nella visura o nell’atto di provenienza, '
                    . 'e la si moltiplica per 115,5 se è prima casa o per 126 se è seconda casa. '
                    . 'Su quel valore si applica l’aliquota: 2% per la prima casa, 9% per la seconda, '
                    . 'con un minimo di 1.000 euro in entrambi i casi.',
            ],
            [
                'q' => 'Quando si paga l’IVA invece dell’imposta di registro?',
                'a' => 'Quando il venditore è un’impresa costruttrice o ristrutturatrice e la vendita '
                    . 'avviene entro cinque anni dalla fine dei lavori. In quel caso l’imposta di registro '
                    . 'diventa fissa a 200 euro e si paga l’IVA sul prezzo dichiarato: 4% prima casa, '
                    . '10% seconda casa, 22% per le case di lusso nelle categorie A/1, A/8 e A/9.',
            ],
            [
                'q' => 'Perché il calcolo parte dalla rendita e non dal prezzo?',
                'a' => 'Per la regola del prezzo-valore: quando l’acquirente è un privato e chiede '
                    . 'espressamente al notaio di applicarla, le imposte si calcolano sul valore catastale '
                    . 'anche se il prezzo pagato è più alto. Nel Salento il valore catastale è di solito '
                    . 'il 40-60% del valore reale, quindi il risparmio è concreto.',
            ],
            [
                'q' => 'Il totale comprende anche il notaio e la provvigione?',
                'a' => 'No. Qui ci sono solo le imposte dovute allo Stato sull’atto di acquisto. '
                    . 'L’onorario del notaio, l’imposta di bollo, la tassa ipotecaria e la provvigione '
                    . 'dell’agenzia sono voci separate e vanno aggiunte a parte.',
            ],
        ];
    }

    /**
     * Calcolo della rata del mutuo.
     *
     * Stesso schema del calcolatore delle imposte: modulo in `GET`, conto in
     * PHP, zero JavaScript. Il `GET` non è una comodità — è la funzione che
     * l'originale in JavaScript non aveva: l'indirizzo che si forma contiene
     * tutti i dati, quindi un agente può mandarlo su WhatsApp a un cliente e
     * il cliente riapre esattamente quel conto.
     */
    public static function mutuo(): void
    {
        $pageUrl = Seo::base() . '/calcolatore-rata-mutuo/';

        $compilato = q('importo') !== '' || q('tasso') !== '';

        // La periodicità e la durata partono da un valore: sono scelte di
        // struttura, non dati di mercato, e un modulo che si apre già
        // impostato su «25 anni, rata mensile» chiede una cosa in meno.
        // L'importo e il tasso restano vuoti di proposito.
        $rate = (int) q('rate', '12');
        if (!isset(Mutuo::RATE_ANNO[$rate])) {
            $rate = 12;
        }

        $anni = int_or_null(q('anni', '25'));
        if ($anni !== null) {
            $anni = (int) Mutuo::dentro((float) $anni, (float) Mutuo::ANNI_MIN, (float) Mutuo::ANNI_MAX);
        }

        $importo = float_or_null(q('importo'));
        if ($importo !== null) {
            $importo = Mutuo::dentro($importo, 0.0, Mutuo::IMPORTO_MAX);
        }

        $prezzo = float_or_null(q('prezzo'));
        if ($prezzo !== null) {
            $prezzo = Mutuo::dentro($prezzo, 0.0, Mutuo::IMPORTO_MAX);
        }

        // Il tasso non passa da `float_or_null()`: quella funzione toglie i
        // punti perché li legge come separatore delle migliaia, e «3.3»
        // diventerebbe 33. Un tasso non ha migliaia, quindi qui il punto e la
        // virgola valgono tutti e due come separatore decimale.
        $tasso = self::decimale(q('tasso'));
        if ($tasso !== null) {
            $tasso = Mutuo::dentro($tasso, 0.0, Mutuo::TASSO_MAX);
        }

        $dati = [
            'importo' => $importo,
            'anni' => $anni,
            'tasso' => $tasso,
            'rate' => $rate,
            'prezzo' => $prezzo,
        ];

        $faq = self::faqMutuo();

        $graph = [
            Seo::logoNode(),
            Seo::agentNode(),
            [
                '@type' => 'WebPage',
                '@id' => $pageUrl . '#webpage',
                'url' => $pageUrl,
                'name' => 'Calcolo della rata del mutuo',
                'inLanguage' => 'it',
                'about' => ['@id' => Seo::base() . '/#agent'],
            ],
            Seo::faqNode($faq, $pageUrl),
            Seo::breadcrumbNode([
                ['name' => 'Home', 'url' => Seo::base() . '/'],
                ['name' => 'Calcolo rata mutuo', 'url' => $pageUrl],
            ], $pageUrl),
        ];

        View::show('site/mutuo', [
            'meta' => self::meta(
                'Calcolo rata mutuo: quanto si paga al mese',
                'Calcola la rata del mutuo con l’ammortamento alla francese: rata, interessi totali e piano completo. Con il rapporto fra mutuo e prezzo della casa.',
                $pageUrl,
                Seo::graph($graph),
                // Una pagina per ogni combinazione di importo e tasso sarebbe
                // un numero infinito di indirizzi quasi uguali. Indicizzabile
                // è solo il modulo vuoto; i conti compilati restano
                // condivisibili e seguibili, ma fuori dall'indice.
                $compilato ? 'noindex, follow' : 'index, follow'
            ),
            'dati' => $dati,
            'compilato' => $compilato,
            'esito' => $compilato ? Mutuo::calcola($dati) : null,
            'tutte' => q('piano') === 'tutte',
            'faq' => $faq,
        ]);
    }

    /**
     * Numero decimale scritto all'italiana o all'inglese: «3,3» e «3.3» sono
     * lo stesso tasso, e chi compila non deve indovinare quale vuole il sito.
     */
    private static function decimale(string $valore): ?float
    {
        $pulito = str_replace([',', ' ', '%'], ['.', '', ''], trim($valore));

        return is_numeric($pulito) ? (float) $pulito : null;
    }

    /**
     * Le domande sono sull'aritmetica del mutuo, non sulle condizioni di
     * mercato: restano vere qualunque sia il tasso del momento. È di
     * proposito — una FAQ che cita un tasso va riscritta ogni trimestre, e
     * quella riscrittura non la fa nessuno.
     *
     * @return array<int,array{q:string,a:string}>
     */
    public static function faqMutuo(): array
    {
        return [
            [
                'q' => 'Come si calcola la rata del mutuo?',
                'a' => 'Con l’ammortamento alla francese, che è quello di quasi tutti i mutui italiani: '
                    . 'la rata resta uguale per tutta la durata. Si divide il tasso annuo per il numero '
                    . 'di rate in un anno, si applica quel tasso al debito che resta e si trova l’importo '
                    . 'che azzera il debito esattamente all’ultima rata. Cambiando la durata cambia la '
                    . 'rata, ma cambiano anche gli interessi complessivi, e in direzione opposta.',
            ],
            [
                'q' => 'Perché all’inizio si pagano quasi solo interessi?',
                'a' => 'Perché gli interessi si calcolano ogni volta sul debito che resta, e all’inizio '
                    . 'il debito è tutto intero. La rata è sempre la stessa, ma la parte che va a '
                    . 'ridurre il capitale è piccola all’inizio e cresce a ogni rata. È la ragione per '
                    . 'cui estinguere in anticipo conviene molto nei primi anni e molto meno negli ultimi: '
                    . 'nel grafico qui sopra è la fascia scura che si allarga.',
            ],
            [
                'q' => 'Questa rata è il TAEG?',
                'a' => 'No. Qui si calcola solo la restituzione del capitale con i suoi interessi, '
                    . 'partendo dal TAN. Il TAEG comprende anche l’imposta sostitutiva, l’istruttoria, '
                    . 'la perizia, le assicurazioni obbligatorie e le spese di incasso rata: sono voci '
                    . 'che variano da banca a banca e che solo il prospetto della banca può quantificare.',
            ],
            [
                'q' => 'Quanto mi può prestare la banca rispetto al prezzo della casa?',
                'a' => 'Di norma fino all’80% del valore dell’immobile, che la banca stabilisce con una '
                    . 'perizia e che non coincide sempre con il prezzo pattuito. Sopra quella soglia il '
                    . 'mutuo si ottiene, ma con garanzie aggiuntive. Se compili anche il prezzo, il '
                    . 'calcolatore mostra il rapporto e avvisa quando lo supera.',
            ],
        ];
    }

    public static function faqValutazione(): array
    {
        return [
            [
                'q' => 'Quanto costa la valutazione?',
                'a' => 'Niente. La valutazione dell’immobile è gratuita e non impegna a firmare alcun mandato di vendita.',
            ],
            [
                'q' => 'In quanto tempo ricevo la valutazione?',
                'a' => 'Entro 48 ore lavorative dalla richiesta un agente FIMAA vi ricontatta per fissare il sopralluogo e raccogliere i dati catastali.',
            ],
            [
                'q' => 'Su quali dati si basa la valutazione?',
                'a' => 'Sui prezzi reali delle compravendite chiuse in zona, sulle quotazioni OMI dell’Agenzia delle Entrate e sullo stato effettivo dell’immobile rilevato in sopralluogo.',
            ],
            [
                'q' => 'Valutate anche fuori Lecce?',
                'a' => 'Sì: Lecce e provincia, le marine (San Cataldo, Frigole, Torre Chianca) e la costa ionica da Porto Cesareo a Torre Lapillo, dove abbiamo la seconda sede.',
            ],
        ];
    }

    /**
     * L'immobile che dà la foto all'hero: il primo che ne ha davvero una.
     *
     * Non il primo e basta: se quello in cima non ha ancora le foto, la home
     * resterebbe senza immagine per un motivo che non c'entra niente con
     * quale immobile si vuole mettere in vetrina.
     *
     * @param array<int,array<string,mixed>> $featured
     * @return array<string,mixed>|null
     */
    public static function heroImage(array $featured): ?array
    {
        return self::heroImages($featured, 1)[0] ?? null;
    }

    /**
     * Le foto che si alternano in cima alla home.
     *
     * Sono le copertine degli immobili in vetrina, prese in ordine: nessun
     * file nuovo da produrre, e la home cambia faccia da sola quando cambia
     * la vetrina. Ne bastano tre — la quarta la vedrebbe solo chi resta
     * fermo sulla home diciotto secondi.
     *
     * Il tetto non è un vezzo: ogni foto in più è una foto che ogni
     * visitatore scarica per vedere la home. Tre è il punto in cui si
     * smette di essere una cartolina senza far pagare il viaggio a chi
     * arriva con la rete del telefono.
     *
     * @param array<int,array<string,mixed>> $featured
     * @return array<int,array<string,mixed>>
     */
    public static function heroImages(array $featured, int $quante = 3): array
    {
        $con = [];

        foreach ($featured as $p) {
            if (trim((string) ($p['cover'] ?? '')) === '') {
                continue;
            }

            $con[] = $p;

            if (count($con) >= $quante) {
                break;
            }
        }

        return $con;
    }

    /**
     * Preload della foto dell'hero. Occupa tutta la larghezza, quindi le
     * `sizes` sono `100vw` e devono coincidere con quelle del tag.
     *
     * @param array<int,array<string,mixed>> $featured
     */
    private static function preloadHero(array $featured): string
    {
        $hero = self::heroImage($featured);
        if ($hero === null) {
            return '';
        }

        return preload_image((string) $hero['cover'], (string) ($hero['cover_srcset'] ?? ''), '100vw');
    }

    /** @return array<string,string> */
    public static function meta(
        string $title,
        string $description,
        string $canonical,
        string $jsonld = '',
        string $robots = 'index, follow',
        string $preload = '',
        string $image = ''
    ): array {
        return [
            // Limiti Rank Math applicati anche qui: 60 e 160 caratteri.
            'title' => mb_substr($title, 0, 60),
            'description' => mb_substr($description, 0, 160),
            'canonical' => $canonical,
            'jsonld' => $jsonld,
            'robots' => $robots,
            'preload' => $preload,
            'image' => self::immagineSociale($image),
        ];
    }

    /**
     * L'immagine che si vede quando il link viene incollato in WhatsApp, su
     * Facebook o in una email. Fino a ieri il sito non ne dichiarava nessuna:
     * un immobile condiviso in chat arrivava come un rettangolo di testo,
     * proprio nel posto in cui la foto è tutto.
     *
     * Se la pagina non ha un'immagine sua si ripiega sul logo. Non è un gran
     * biglietto da visita, ma è meglio del vuoto: almeno si riconosce da chi
     * arriva il link.
     *
     * L'indirizzo esce sempre assoluto — i social non sanno risolvere un
     * percorso relativo, e senza dominio l'anteprima resta bianca.
     */
    private static function immagineSociale(string $image): string
    {
        $image = trim($image);
        if ($image === '') {
            $image = trim((string) Settings::get('logo_url', ''));
        }
        // Ultimo ripiego: l'immagine di cortesia del progetto, 1200×630 —
        // la misura che vogliono WhatsApp e Facebook, mentre un logo quadrato
        // lì viene ritagliato male. Si dichiara solo se il file c'è davvero:
        // un `og:image` che punta a un indirizzo morto fa comparire il
        // riquadro rotto invece di niente.
        if ($image === '' && is_file(MIL_PUBLIC . self::FILE_SOCIAL)) {
            $image = self::FILE_SOCIAL;
        }

        // Niente immagine, niente tag: senza questa riga `url('')` restituisce
        // l'indirizzo della home, e ogni pagina dichiarava come anteprima una
        // pagina HTML invece di una figura.
        if ($image === '') {
            return '';
        }

        return str_starts_with($image, 'http') ? $image : url($image);
    }
}
