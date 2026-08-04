# Handoff — sito nuovo Mondo Immobiliare

Documento per riprendere il lavoro in una chat nuova, senza contesto
precedente. Aggiornato al 4 agosto 2026.

---

## 1. Il punto di partenza, in una riga

La società ha detto a Camillo Barone di rifare da zero il sito italiano
(mondoimmobiliarelecce.it) **senza spendere soldi**, perché il budget è finito
— in alternativa, chiudere Claude e usare quei soldi per il sito nuovo.

Da qui: un sito completo con gestionale, in PHP e MySQL, zero licenze, che
gira sull'hosting SiteGround già pagato.

---

## 2. Dove sta il lavoro

| | |
|---|---|
| Repo | `camillobarone/mondo` |
| Branch | `claude/siteground-italian-site-bhtl4j` |
| PR | **#3** — aperta, in **draft**, `mergeable_state: clean` |
| Base della PR | `jules-4092590956749443987-c47f811b` |
| Head al momento | `d2b36fc` |
| Cartella | `sito-nuovo/` (il resto del repo non c'entra) |
| CI | **nessuna configurata** — zero check run, niente da far passare |
| Commenti | uno solo, del bot Gemini (avviso di dismissione). Nessuna azione |

Albero di lavoro pulito, tutto pushato.

### I commit, in ordine

1. `d2cb64e` — sito nuovo con gestionale, in PHP e MySQL
2. `9c04bf0` — porting del modello dati dalla PR #2
3. `3d2216e` — importazione da WordPress, conservando gli slug
4. `15003aa` — velocità mobile e galleria multi-foto
5. `2cb5d09` — questo documento
6. `3afbdda` — verifica della mappatura WP-Residence sul database vero
7. `d2b36fc` — modulo di ricerca reso visibile in home

---

## 3. Vincoli, e perché esistono

Questi non sono preferenze: sono decisioni prese con una ragione, e vanno
mantenute finché qualcuno non le rimette in discussione con dati nuovi.

**Niente Node.js.** SiteGround non lo ospita
(https://www.siteground.com/kb/node-js-available/). È il fatto che ha deciso
la questione «conviene unire la PR #2?»: no — la #2 gira su Next.js +
better-sqlite3 e su quell'hosting non parte. Il suo **modello dati** è stato
portato nella base PHP (commit 2), il codice no.

**Zero dipendenze.** Niente Composer, niente npm, niente framework, niente
tema, niente plugin, niente licenze. PHP 8.1+ e MySQL, punto.

**Zero JavaScript sul sito pubblico.** Non «poco»: zero. Menu, filtri e
galleria sono HTML e CSS. Da qui un TBT che sta fra 0 e 40 ms.

### Regole dalla skill `mondo-immobiliare` — in vigore, non negoziabili

- **JSON-LD del sito IT: mai via MCP.** Vive in SASWP Custom data. Si produce
  il JSON in chat, lo incolla Camillo. Mai dentro `post_content` o in meta.
- **Mai editare `_elementor_data` via API.**
- **Il telefono +393929825536 è DEPRECATO: non usarlo mai.** I numeri buoni
  sono 0832 391489 e 392 728 2442.
- **Mai inventare dati, fonti, riferimenti normativi o percorsi.** Mai
  placeholder nei deliverable.
- **Non promettere azioni dirette sul sito**: si consegna il materiale pronto
  da applicare.

### Regole di questo progetto

- L'importatore **non scrive mai** sul WordPress sorgente: lo legge e basta.
- `config.php` (credenziali DB) **non va mai committato** — è in `.gitignore`.
- Il **prezzo minimo del proprietario** non esce dal gestionale. Non è tolto
  nei template: lo toglie `Properties::search()`, la stessa query che alimenta
  le pagine pubbliche.

---

## 4. Com'è fatto

```
sito-nuovo/
├── app/
│   ├── Core/          Assets, Auth, Config, Csrf, Db, Mailer, Router, Seo,
│   │                  Session, Settings, Uploader, View, Vocab,
│   │                  WpMapper, WpSource
│   ├── Repo/          Agenda, Contacts, Content, Deals, Leads, Log,
│   │                  Properties, Redirects, Users
│   ├── Controller/    Site/ (Feeds, Forms, Journal, Listings, Pages)
│   │                  Admin/ (Agenda, Contact, Content, Dashboard, Lead,
│   │                          Property, Session, System)
│   ├── routes.php     la mappa delle URL, tutta qui
│   └── helpers.php
├── views/             layout/, site/, admin/ — template PHP puri
├── public/            document root: index.php, install.php, assets, uploads
├── db/                schema.sql (dialetto neutro), migrations/, seed.php
├── storage/cache/     CSS minificato, si rigenera da solo
├── bin/               installa-locale, aggiorna-db, importa-da-wordpress,
│                      finto-wordpress
└── docs/              INSTALL-SITEGROUND, MIGRAZIONE-SEO,
                       IMPORT-DA-WORDPRESS, HANDOFF (questo file)
```

### Cose da sapere prima di toccare il codice

**`Db` è a doppio dialetto.** Un solo `schema.sql` per MySQL (produzione) e
SQLite (prova in locale), con i token `{PK}` `{NOW}` `{MONEY}` `{SUFFIX}`
`{TEXT}` risolti a runtime da `Db::dialect()`. Per concatenare stringhe si usa
`Db::concat()`, che emette `CONCAT()` su MySQL e `||` su SQLite.

**Le migrazioni sono tracciate** in `db/migrations/`, applicate da
`php bin/aggiorna-db.php` e registrate nella tabella `schema_migrations`. Su
un'installazione nuova vengono solo marcate come fatte, perché `schema.sql` le
contiene già.

**`Db::runScript()` toglie le righe di commento con una regex prima** di
spezzare su `;`. Non è pignoleria: spezzando prima si perdeva la `CREATE TABLE`
che seguiva un blocco di commenti.

**`Router` accetta segnaposto con maiuscole e cifre** (`{offerId}`,
`{imageId}`). Con il vecchio `[a-z_]+` restavano letterali nella regex e la
rotta rispondeva 404 in silenzio.

**Il CSS del sito pubblico è inline**, non un `link`. Lo produce
`Core\Assets::css()`, che minifica e mette in cache su disco. Il minificatore
**lascia stare `+` e `~` di proposito**: stringere gli spazi attorno a un `+`
rompe `calc(100% + 10px)`.

**Le `sizes` delle immagini stanno in costanti condivise**
(`Assets::SIZES_CARD`, `SIZES_GALLERIA`, `SIZES_GALLERIA_MINI`) perché lo
stesso valore serve al tag immagine e al preload: se divergono, il browser
scarica due immagini invece di una.

---

## 5. Provarlo in locale

```bash
cd sito-nuovo
php bin/installa-locale.php http://127.0.0.1:8080
php -S 127.0.0.1:8080 -t public
```

Sito su `/`, gestionale su `/gestionale/`, accesso
`admin@mondoimmobiliarelecce.it` / `prova-locale-2026`. Usa SQLite, non serve
installare niente.

### Provare l'importatore senza toccare il WordPress vero

```bash
php bin/finto-wordpress.php /tmp/finto-wp.sqlite /tmp/finto-uploads
php bin/importa-da-wordpress.php \
    --sorgente-sqlite=/tmp/finto-wp.sqlite \
    --uploads=/tmp/finto-uploads \
    --prefisso=vnb_
```

Il prefisso `vnb_` non è opzionale: il finto WordPress usa quello, e senza il
flag l'importatore cerca `wp_posts` e va in errore.

### Misurare

- Lighthouse: `scratchpad/lh.sh <url>` (profilo mobile; stampa i quattro
  punteggi, le metriche chiave e gli audit falliti)
- Validatore JSON-LD: `php scratchpad/valida.php <url>`
- `CHROME_PATH` va su `/opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell`

**Nota:** lo scratchpad è legato alla sessione. In una chat nuova va
reinstallato Lighthouse e riscritto `lh.sh` — è una decina di righe, il
contenuto è documentato qui sopra.

---

## 6. Cos'è già fatto e verificato

### Sito pubblico
Home con ricerca, elenco con filtri, scheda immobile con galleria, pagina
valutazione con FAQ visibili, blog, pagine statiche, contatti con entrambe le
sedi, sitemap dal database, robots.txt che non blocca i crawler AI.

### Gestionale
Riepilogo, immobili con doppio stato (pubblicazione e trattativa), incarichi
con scadenza, prezzo minimo riservato, storico prezzi, proposte d'acquisto,
chiusura fino al rogito, richieste dal sito, richieste di acquisto, anagrafica
con ruoli multipli, adempimenti privacy e antiriciclaggio, articoli e pagine,
redirect 301, utenti, impostazioni.

### Calcolatore delle imposte d'acquisto
`/calcolatore-imposte-acquisto-casa/`. Modulo in GET — il risultato ha un
indirizzo suo, si manda per email e si rilegge; la pagina col risultato esce
`noindex, follow` perché sono combinazioni infinite dello stesso contenuto.
Zero JavaScript: si chiedono sia la rendita sia il prezzo, perché senza JS non
si può nascondere il campo che non serve.

**Le aliquote non sono state ricavate né cercate online**: stanno in
`Mil\Core\Imposte` come costanti, prese dalla guida «Imposte Acquisto Casa»
del sito WordPress dell'agenzia (aggiornata 6/7/2026), che cita Agenzia delle
Entrate e Notariato. Prima casa: rendita × 115,5, registro 2%, minimo €1.000,
ipotecaria e catastale €50. Seconda casa: × 126, registro 9%. Da impresa: IVA
4/10/22% sul prezzo, i tre fissi a €200. Verificato contro i due esempi
pubblicati nella guida (rendita €750 → €1.732,50 e €8.505,00): coincidono.

Fuori dal calcolo di proposito: notaio, bollo, tassa ipotecaria, provvigione —
non stanno nella guida, e metterci un numero non pubblicato sarebbe inventarlo.
La pagina lo dice.

⚠️ **Le quattro FAQ della pagina sono una riscrittura di quelle della guida
WordPress**: è l'unico punto in cui un contenuto vive in due posti. Se i due
siti dovessero coesistere sullo stesso dominio va risolto, un intent = un
contenuto.

### Anteprima della scheda immobile
Dal gestionale, `Salva e vedi l'anteprima` porta su
`/gestionale/immobili/{id}/anteprima/`: la scheda pubblica vera, disegnata da
`Listings::render()` — lo stesso metodo che serve il sito — con in cima una
fascia scura che dice dove sei e in che stato è l'immobile. Funziona anche in
bozza, esce sempre `noindex, nofollow` e non conta la visita.

L'anteprima mostra i dati **salvati**, non quelli scritti nel modulo e non
ancora inviati: il bottone salva e poi mostra, in un gesto solo. Un'anteprima
di dati non salvati avrebbe richiesto JavaScript e avrebbe potuto mostrare una
pagina che sul sito non esisterà mai.

### Domande frequenti sulla scheda (FAQ)
Colonna `properties.faqs`, JSON `[{"q": …, "a": …}]`, una copia sola da cui
escono sia il testo visibile in fondo alla scheda (`<details>`, senza
JavaScript) sia il nodo `FAQPage` del JSON-LD. La regola della skill — «FAQ
visibili in pagina identiche a quelle nello schema» — è rispettata per
costruzione, non per disciplina.

Si scrivono in un riquadro solo (`Mil\Core\Faq::parse`), incollando il blocco
com'esce da una chat: grassetti `**così**`, prefissi `D:`/`R:`, trattini,
numerazione e domanda staccata dalla risposta da una riga vuota vengono tutti
riconosciuti. Salvando, il riquadro si ricarica nella forma canonica con il
conteggio delle domande riconosciute: se una manca, si vede lì invece che
sulla pagina pubblicata.

### Abbinamento domanda/offerta
Punteggio 0–100. Budget unico criterio bloccante, con tolleranza 5%. I criteri
non espressi non penalizzano. Sotto 60 non viene proposto.

### Velocità (Lighthouse 12, profilo mobile)

Prima, sulla scheda immobile: 98 / 100 / 96 / 100, LCP 1,8 s.

Adesso, su **tutte** le pagine misurate — home, elenco, scheda, contatti,
valutazione, blog: **100 / 100 / 100 / 100**. LCP fra 0,7 e 1,3 s, CLS 0
(0,001 su due pagine), TBT fra 0 e 40 ms.

Cosa lo produce: CSS inline minificato, tre larghezze WebP per foto
(480/960/1600) con `srcset`, preload della candidata LCP con lo stesso
`imagesrcset` del tag, `width`/`height` ovunque, favicon SVG in data URI (il
404 su `/favicon.ico` era quello che teneva Best practice a 96).

**Come misurare senza prendere lucciole per lanterne.** Il server PHP di prova
è a thread singolo: se si lancia Lighthouse mentre il Chrome del giro
precedente si sta ancora chiudendo, i numeri crollano e non c'entra il codice.
Visto oggi, sulle stesse pagine e sullo stesso commit:

- home: 96 (TBT 230 ms), poi 99, 100, 100 (TBT 120, 40, 40 ms)
- scheda immobile: **78** con FCP 3,1 s, poi tre giri identici a **100** con
  FCP 0,7 s e TBT 0 ms

Il sito non ha JavaScript: un TBT di 200 ms non può venire dal codice. **Tre
giri e si tiene la mediana** — un numero solo, preso una volta, non vale niente
né in bene né in male. Il 78 di prima è esattamente il genere di dato che, se
riportato senza ricontrollarlo, manda a caccia di un problema che non esiste.

### Galleria multi-foto
Cinque foto in griglia, le altre dietro un «+N foto». Si aprono a tutto
schermo con `:target`, si sfogliano avanti e indietro in circolo, si chiudono.
Zero JavaScript, navigabile da tastiera, `display:none` finché non si apre —
quindi non scarica niente e non sposta un pixel.

### Pannello foto nel gestionale
Riordino su/giù, copertina scelta a mano, descrizione per ogni foto. Un modulo
solo: le descrizioni si salvano qualunque bottone si prema. Verificato che
cambiando copertina cambia anche `#primaryimage` nel JSON-LD, che resta valido.

### Bug latenti trovati e corretti
- **Router**: segnaposto solo minuscoli → l'eliminazione di una foto non ha mai
  funzionato dal primo commit, rispondeva 404 in silenzio.
- **Tipologie all'import**: cercare `villa` e `terreno` per intero non trovava
  i termini veri, che sono al plurale («Ville in Vendita a Lecce e Provincia»,
  «Terreni edificabili»). Ogni villa sarebbe finita importata come appartamento.
- **Contrasto**: i link color sabbia della fascia scura vincevano per
  specificità su `.btn-primary`, lasciando il bottone a 3:1.
- **Barra di ricerca in home**: la classe `sr` (`left: -9999px`) stava sul
  `<label>`, che avvolge il campo — fuori schermo finiva tutto il campo, non
  solo l'etichetta. Della barra restava il solo bottone «Cerca», su telefono
  come su computer, dal primo commit. `sr` è passata su uno `<span>`.

Tre di questi quattro erano invisibili a leggere il codice: si sono visti solo
aprendo le pagine e misurandole.

---

## 7. Cosa manca — dichiarato, non nascosto

**La mappatura WP-Residence adesso è verificata** (4 agosto 2026). Il
connettore MCP non andava in timeout: non esponeva i meta, perché WP-Residence
non li registra con `show_in_rest`. Letti in contesto `edit` sono usciti tutti.
Quattro chiavi erano sbagliate — `property-year`, `stories-number`,
`property_internal_id`, `wpestate_property_gallery` — e il riconoscimento della
tipologia prendeva la categoria sbagliata sugli immobili che ne portano più di
una, che sul sito vero sono la maggioranza. Corretto e coperto da
`php bin/verifica-mappatura.php` (12 schede reali). Dettaglio in
`docs/IMPORT-DA-WORDPRESS.md`.

Resta comunque da lanciare `--campi` sul database vero: la verifica ha coperto
13 immobili su 49, e una chiave usata su una scheda sola la trova solo il
censimento completo.

Cosa manca davvero:
- **Il video degli annunci non viene importato.** Le schede hanno
  `embed_video_type` / `embed_video_id` e lo schema dichiara un `VideoObject`;
  il gestionale non ha un campo dove metterlo. Serve una colonna, prima di
  puntare il dominio.
- Esecuzione reale su MySQL non provata (qui c'è solo SQLite)
- Rich Results Test di Google (serve una URL pubblica)
- Import CSV dell'anagrafica clienti (in WordPress non c'è)
- Export verso i portali (Immobiliare.it, Idealista)
- Editor con formattazione ricca, geocoding, virtual tour, calcolatore
  imposte, tool OMI
- FAQ della pagina valutazione scritte nel codice, non modificabili dal pannello

---

## 8. La cosa da dire a Camillo, se torna il discorso «3 su 3»

Va tenuta dritta perché è già stata detta e non va ammorbidita:

**«100 su tutto»** (Lighthouse: Prestazioni, Accessibilità, Best practice, SEO)
è dato di **laboratorio**. È fatto, misurato, su tutte le pagine.

**«3 su 3 di PageSpeed»** è un'altra cosa: sono i **Core Web Vitals presi dal
campo** (CrUX), raccolti da Chrome sui visitatori veri su 28 giorni. Nessuna
riga di codice li produce oggi. Si possono solo creare le condizioni perché
arrivino — ed è quello che è stato fatto. Si leggeranno a sito online e
visitato.

---

## 9. ⚠️ Prima di puntarci il dominio

`docs/MIGRAZIONE-SEO.md` mette per iscritto il rischio vero: il sito attuale
vale un audit **83/100 su circa 182 URL indicizzate**, con ~113 schema validati
e i cluster anti-cannibalizzazione. Pubblicare il sito nuovo sullo stesso
dominio senza mappa dei redirect butta quel lavoro, e le posizioni non tornano
da sole.

Il documento contiene anche la **terza strada**, che in molti casi è la
migliore: restare su WordPress e togliere solo le licenze. Costo qualche
giorno, rischio SEO quasi zero perché gli URL non cambiano. **Il sito nuovo ha
senso se serve il gestionale** — che è il pezzo che oggi non esiste.

Questa non è una posizione da difendere: è una scelta che spetta a Camillo e
alla società. Va però messa davanti prima, non dopo.

---

## 10. Se si riprende adesso, da dove

Non c'è niente di rotto e niente in sospeso a metà. Le strade aperte, in
ordine di quanto valgono:

1. **Decidere fra sito nuovo e terza strada** (punto 9). Tutto il resto
   dipende da questa, e adesso è il primo punto: la mappatura, che era il
   rischio tecnico aperto, è verificata.
2. **Provare su MySQL** — installazione via `public/install.php` su un
   sottodominio SiteGround, per esempio `prova.mondoimmobiliarelecce.it`.
3. **Lanciare `--campi` sul database vero** per il censimento completo sui 49
   immobili, e decidere il campo video.
4. Se si va avanti: mappa dei redirect, `og:image` sulle schede (oggi manca),
   export verso i portali.

### Il check-in orario sulla PR

C'è un check-in automatico ogni ora sulla PR #3: ricontrolla stato, check run
e commenti; se non è cambiato niente non scrive a nessuno e si ri-arma. Si
ferma da solo quando la PR viene merged o closed. Per fermarlo prima basta
dirlo.
