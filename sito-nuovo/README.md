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
- Scheda immobile: galleria, dati tecnici, dotazioni, immobili simili, modulo di
  richiesta che scrive direttamente nel gestionale
- Pagina valutazione con FAQ visibili (le stesse dello schema, mai solo nel markup)
- Blog con firma e data dell'autore
- Pagine statiche gestibili dal pannello
- Contatti con entrambe le sedi

### Gestionale (`/gestionale/`)

- **Riepilogo** — immobili online, bozze, richieste da lavorare, clienti in
  ricerca, prossimi appuntamenti, immobili più visti
- **Immobili** — scheda completa, foto multiple con ridimensionamento e
  conversione WebP automatici, stato (bozza / online / sotto proposta / venduto),
  campi SEO per pagina
- **Richieste dal sito** — ogni modulo diventa una richiesta tracciata: stato,
  agente assegnato, note, appuntamento in un clic
- **Richieste di acquisto** — chi cerca cosa, con budget, zone, tipologie e
  metratura minima
- **Abbinamento automatico** — vedi sotto
- **Agenda** — appuntamenti legati a immobile, cliente e agente
- **Articoli e pagine** — con risposta diretta, autore, campi SEO
- **Reindirizzamenti 301** — con import in blocco, per la migrazione
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
risponde 301), immagini convertite in WebP e ridotte a 1600 px.

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
├── db/                schema.sql (dialetto neutro) e seed.php (dati demo)
├── bin/               installazione da riga di comando per la prova locale
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

---

## Cosa manca, dichiarato

Non è un elenco di scuse: è quello che va deciso prima di considerarlo finito.

- **Mappa e canonical degli immobili sono manuali** — latitudine e longitudine
  si inseriscono a mano nella scheda; non c'è geocoding automatico.
- **Nessun import automatico da WordPress.** I 34 immobili pubblicati e le 15
  bozze vanno reinseriti, oppure serve uno script di importazione dedicato:
  è un lavoro fattibile ma non è in questa consegna.
- **Nessun export verso i portali** (Immobiliare.it, Idealista). Oggi passa da
  WordPress; va verificato come il portale riceve i feed prima di rifarlo.
- **Editor testuale semplice**, senza formattazione ricca. I testi vengono
  stampati con escape e `nl2br`: sicuro, ma senza grassetti e liste.
- **Nessun virtual tour**, nessun calcolatore imposte, nessun tool OMI: tre
  funzioni che sul sito attuale esistono e qui no.
- **Le FAQ della pagina valutazione sono scritte nel codice**, non modificabili
  dal pannello.
