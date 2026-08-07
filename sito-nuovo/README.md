# Sito nuovo + gestionale — Mondo Immobiliare

Sito prova completo per Mondo Immobiliare Lecce: front-end pubblico con annunci
e blog, più un gestionale per immobili, richieste e clienti in ricerca.

**PHP 8.1+ e MySQL. Nient'altro.** Nessun tema, nessun plugin, nessuna licenza,
nessun abbonamento, nessun `composer install`, nessun `npm run build`. Gira su
qualsiasi hosting SiteGround così com'è, e il costo di esercizio è l'hosting che
si paga già.

---

## Provarlo in locale, adesso

```bash
php bin/installa-locale.php
php -S localhost:8080 -t public
```

- Sito → <http://localhost:8080/>
- Gestionale → <http://localhost:8080/gestionale/>
- Accesso → `admin@mondoimmobiliarelecce.it` / `prova-locale-2026`

Usa SQLite, non serve installare un database. In produzione si usa MySQL:
è lo stesso codice, cambia solo una riga in `config.php`.

Per metterlo online: **[docs/INSTALL-SITEGROUND.md](docs/INSTALL-SITEGROUND.md)**.
Per portarci dentro gli immobili che stanno su WordPress:
**[docs/IMPORT-DA-WORDPRESS.md](docs/IMPORT-DA-WORDPRESS.md)**.

⚠️ Prima di puntarci il dominio vero, leggi
**[docs/MIGRAZIONE-SEO.md](docs/MIGRAZIONE-SEO.md)**: il sito attuale vale un
audit 83/100 e circa 182 URL indicizzate, e si perdono tutte se il passaggio si
fa senza mappa dei redirect.

---

## Cosa c'è

### Sito pubblico

- Home con ricerca, immobili in evidenza, dati di fiducia veri (4,9/5 su 58
  recensioni, FIMAA dal 1994, oltre 3.000 compravendite)
- Elenco immobili con filtri per comune, tipologia, contratto, prezzo, metratura
- Scheda immobile: galleria a schermo intero, dati tecnici, dotazioni, immobili
  simili, modulo di richiesta che scrive direttamente nel gestionale
- **Galleria senza JavaScript** — cinque foto in griglia, le altre dietro un
  «+N foto»; si aprono a tutto schermo, si sfogliano avanti e indietro e si
  chiudono usando solo `:target`. Funziona da tastiera, non sposta un pixel
  della pagina e finché non si apre non scarica nemmeno un byte in più
- Pagina valutazione con FAQ visibili (le stesse dello schema, mai solo nel markup)
- Blog con firma e data dell'autore
- Pagine statiche gestibili dal pannello
- Contatti con entrambe le sedi

### Gestionale (`/gestionale/`)

- **Riepilogo** — immobili online, bozze, richieste da lavorare, clienti in
  ricerca, prossimi appuntamenti, immobili più visti
- **Immobili** — scheda completa, foto multiple in WebP con tre larghezze
  generate al caricamento, riordinabili, con copertina scelta a mano e
  descrizione per ogni foto; campi SEO per pagina, e **due stati distinti**:
  quello di pubblicazione (cosa vede il pubblico) e quello della trattativa
  (a che punto è il lavoro)
- **Incarico** — proprietario, date di inizio e scadenza, esclusiva,
  provvigione; gli incarichi in scadenza finiscono in evidenza sul riepilogo
- **Prezzo minimo riservato** — quanto il proprietario accetta davvero. Non
  esce mai dal gestionale: viene tolto alla fonte dalle query che alimentano
  anche il sito pubblico, non solo omesso dai template
- **Storico dei prezzi** — ogni variazione resta scritta, con il valore
  precedente e il motivo
- **Proposte d'acquisto** — importo, caparra, validità, esito. Accettarne una
  porta l'immobile a "sotto proposta" anche in vetrina, così nessun collega
  fissa una visita su un immobile già impegnato
- **Trattativa fino in fondo** — compromesso, rogito, provvigioni venditore e
  acquirente, incassato sì/no
- **Richieste dal sito** — ogni modulo diventa una richiesta tracciata: stato,
  agente assegnato, note, appuntamento in un clic
- **Richieste di acquisto** — chi cerca cosa, con budget, zone, tipologie,
  metratura minima, come paga e quanto ha fretta
- **Anagrafica** — ruoli multipli (chi vende oggi compra domani), provenienza
  del contatto, stato, data dell'ultimo contatto
- **Adempimenti** — consenso privacy con data messa dal sistema e
  identificazione antiriciclaggio; chi non li ha completati compare sul
  riepilogo
- **Abbinamento automatico** — vedi sotto
- **Agenda** — appuntamenti legati a immobile, cliente e agente
- **Articoli e pagine** — con risposta diretta, autore, campi SEO
- **Reindirizzamenti 301** — con import in blocco, per la migrazione
- **Importazione da WordPress** — legge gli immobili dal database del sito
  attuale, foto comprese, conservando gli slug. Rilanciabile: aggiorna invece
  di duplicare. Vedi `docs/IMPORT-DA-WORDPRESS.md`
- **Utenti** — ruoli amministratore e agente
- **Impostazioni** — nome, indirizzo, logo, email di destinazione

### L'abbinamento automatico

È il pezzo che il sito attuale non ha, ed è quello che vale di più.

Oggi la domanda (chi cerca cosa) vive nella testa degli agenti, l'offerta vive
sul sito, e l'incrocio si fa a memoria. Qui è una query: si registra una volta
cosa cerca il cliente — contratto, budget, zone, tipologie, metratura, camere —
e da quel momento

- aprendo un **immobile**, il gestionale dice **a chi proporlo**, ordinati per
  affinità, con le ragioni scritte;
- aprendo un **cliente**, dice **cosa proporgli**, con lo stesso criterio.

Il punteggio va da 0 a 100. Il budget è l'unico criterio bloccante — con una
tolleranza del 5%, perché una trattativa quello scarto lo recupera. I criteri
che il cliente non ha espresso non penalizzano nessun immobile: chi non indica
la zona non si vede scartare case per la zona.

Sotto il 60% l'abbinamento non viene proposto: un elenco che contiene tutto non
fa risparmiare tempo a nessuno.

### SEO, GEO e AEO — nel codice, non nei plugin

Ogni pagina esce con un solo blocco `application/ld+json`, un solo `@graph`,
costruito secondo le regole già validate sul sito attuale:

- nodo `#agent` canonico su ogni pagina — `legalName` Studio RCS Srls,
  `foundingDate` 1994, `priceRange` "€€", due `contactPoint`, tre `founder`,
  quattro `employee`, `memberOf` FIMAA, dieci `sameAs`, `knowsLanguage` a
  livello di organizzazione
- `aggregateRating` **solo** su `RealEstateAgent`, mai sull'immobile
- `RealEstateListing` → `about` → `House`/`Apartment`, **mai** `broker`
- `Offer` come nodo separato con `seller`, **omesso del tutto** quando il prezzo
  è riservato — mai un'offerta senza prezzo
- `#logo` come nodo top-level, referenziato per `@id`
- `BreadcrumbList` con `item` anche sull'ultimo elemento
- `FAQPage` solo dove le domande sono davvero visibili in pagina
- niente entità HTML dentro i valori: sono testo, non markup

Più: canonical auto-referenziante, `noindex` sui risultati filtrati e sulle
pagine oltre la prima, sitemap generata dal database, robots.txt che **non**
blocca i crawler AI, una sola forma di URL (la variante senza slash finale
risponde 301), immagini convertite in WebP.

---

## Velocità: misurata, non promessa

Lighthouse 12, profilo **mobile** (rete 4G lenta simulata, CPU rallentata 4×),
misurato sul sito in locale con le foto vere passate dall'importatore:

| Pagina | Prestazioni | Accessibilità | Best practice | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|
| Home | 100 | 100 | 100 | 100 | 0,7 s | 0 | 0 ms |
| Elenco immobili | 100 | 100 | 100 | 100 | 0,7 s | 0,001 | 0 ms |
| Scheda immobile | 100 | 100 | 100 | 100 | 1,3 s | 0 | 0 ms |
| Contatti | 100 | 100 | 100 | 100 | 0,7 s | 0 | 0 ms |
| Valutazione | 100 | 100 | 100 | 100 | 0,7 s | 0 | 20 ms |
| Blog | 100 | 100 | 100 | 100 | 0,7 s | 0,001 | 0 ms |

Come ci si arriva, in concreto:

- **Zero JavaScript** sul sito pubblico. Non «poco»: zero. Menu, filtri e
  galleria sono HTML e CSS. Per questo il blocco del thread principale è 0 ms
  e non c'è niente che possa rallentarsi da solo col tempo.
- **CSS dentro la pagina**, minificato e messo in cache su disco. Un
  `<link rel=stylesheet>` è una seconda richiesta prima del primo disegno: su
  rete mobile costa più dei byte che si risparmiano.
- **Tre larghezze per ogni foto** (480, 960, 1600 px) in WebP, servite con
  `srcset` e `sizes`. Il telefono scarica quella che gli serve, non quella che
  serve al monitor dell'ufficio.
- **Preload della foto grande** con lo stesso `imagesrcset` del tag `<img>`:
  il browser la mette in coda subito invece di scoprirla a layout finito.
- **`width` e `height` su ogni immagine** e proporzioni fissate in CSS: la
  pagina non salta mentre carica. Da qui il CLS a zero.
- **Favicon in SVG dentro l'HTML**: nessuna richiesta, e soprattutto nessun
  404 su `/favicon.ico` — l'errore che teneva Best practice a 96.

Una precisazione che conviene fare adesso, perché dopo sembra una scusa:
**questi sono numeri di laboratorio**. I «3 su 3» di PageSpeed sono un'altra
cosa — sono i Core Web Vitals raccolti da Chrome sui visitatori veri (CrUX),
su 28 giorni di traffico. Nessuna riga di codice li può produrre oggi: si
possono solo creare le condizioni perché arrivino, ed è quello che è stato
fatto. Si leggeranno quando il sito sarà online e visitato.

---

## Com'è fatto dentro

```
sito-nuovo/
├── app/
│   ├── Core/          Config, Db, Router, View, Auth, Csrf, Seo, Uploader…
│   ├── Repo/          accesso ai dati, una classe per entità
│   ├── Controller/    Site/ (pubblico) e Admin/ (gestionale)
│   ├── routes.php     la mappa delle URL, tutta qui
│   └── helpers.php
├── views/             template PHP puri: layout/, site/, admin/
├── public/            document root — index.php, install.php, assets, uploads
├── db/                schema.sql (dialetto neutro), migrations/, seed.php
├── storage/cache/     CSS minificato, si rigenera da solo
├── bin/               installazione locale, aggiornamento DB, import da WP
└── docs/              installazione su SiteGround, migrazione SEO
```

Scelte prese e perché:

- **Niente framework.** Meno da imparare, meno da aggiornare, niente si rompe
  perché una dipendenza ha cambiato versione. Il codice si legge tutto in
  un pomeriggio.
- **Query preparate ovunque**, escape su ogni variabile stampata, CSRF su ogni
  form del gestionale, password con `password_hash`, upload validati sul
  contenuto e non sull'estensione.
- **Niente CSRF sui moduli pubblici**, di proposito: le pagine sono cacheabili e
  un token scaduto farebbe fallire gli invii in silenzio. Al suo posto honeypot,
  tempo minimo di compilazione e limite per IP — lo stesso schema dello snippet
  già in produzione.
- **Il lead si scrive a database prima di tentare la mail.** Un problema di
  posta non deve far perdere un contatto.
- **Un solo schema SQL** per MySQL e SQLite, con i dialetti risolti a runtime:
  si prova in locale senza installare niente e si va in produzione senza
  cambiare una riga.
- **Migrazioni tracciate** in `db/migrations/`, applicate da
  `php bin/aggiorna-db.php` e registrate a database. Su un'installazione nuova
  vengono solo marcate come fatte, perché `schema.sql` le contiene già.

---

## Cosa manca, dichiarato

Non è un elenco di scuse: è quello che va deciso prima di considerarlo finito.

- **Mappa e canonical degli immobili sono manuali** — latitudine e longitudine
  si inseriscono a mano nella scheda; non c'è geocoding automatico.
- **Nessun export verso i portali** (Immobiliare.it, Idealista). Oggi passa da
  WordPress; va verificato come il portale riceve i feed prima di rifarlo.
- **Editor testuale semplice**, senza formattazione ricca. I testi vengono
  stampati con escape e `nl2br`: sicuro, ma senza grassetti e liste.
- **Nessun import CSV** dell'anagrafica clienti: gli immobili si importano da
  WordPress, i clienti no — in WordPress non ci sono.
- **La mappatura dei campi WP-Residence non è verificata sul database vero**:
  il connettore del sito era irraggiungibile. Per questo l'importatore ha un
  comando `--campi` che stampa i nomi reali prima di importare.
- **Report ridotti all'osso**: provenienza dei contatti, rogiti e provvigioni
  dell'anno, tempo medio fino al rogito. Niente grafici.
- **Nessun virtual tour e nessun tool OMI**: due funzioni che sul sito attuale
  esistono e qui no. I calcolatori invece ci sono tutti e due — imposte
  d'acquisto e rata del mutuo — e il terzo, l'IMU, aspetta le aliquote del
  Comune di Lecce.
- **Le FAQ della pagina valutazione sono scritte nel codice**, non modificabili
  dal pannello.
