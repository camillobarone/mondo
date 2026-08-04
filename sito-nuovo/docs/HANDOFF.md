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
| Head al momento | `15003aa` |
| Cartella | `sito-nuovo/` (il resto del repo non c'entra) |
| CI | **nessuna configurata** — zero check run, niente da far passare |
| Commenti | uno solo, del bot Gemini (avviso di dismissione). Nessuna azione |

Albero di lavoro pulito, tutto pushato.

### I quattro commit

1. `d2cb64e` — sito nuovo con gestionale, in PHP e MySQL
2. `9c04bf0` — porting del modello dati dalla PR #2
3. `3d2216e` — importazione da WordPress, conservando gli slug
4. `15003aa` — velocità mobile e galleria multi-foto

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
galleria sono HTML e CSS. Da qui il TBT a 0 ms.

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

### Abbinamento domanda/offerta
Punteggio 0–100. Budget unico criterio bloccante, con tolleranza 5%. I criteri
non espressi non penalizzano. Sotto 60 non viene proposto.

### Velocità (Lighthouse 12, profilo mobile)

Prima, sulla scheda immobile: 98 / 100 / 96 / 100, LCP 1,8 s.

Adesso, su **tutte** le pagine misurate — home, elenco, scheda, contatti,
valutazione, blog: **100 / 100 / 100 / 100**. LCP fra 0,7 e 1,3 s, TBT 0 ms,
CLS 0 (0,001 su due pagine).

Cosa lo produce: CSS inline minificato, tre larghezze WebP per foto
(480/960/1600) con `srcset`, preload della candidata LCP con lo stesso
`imagesrcset` del tag, `width`/`height` ovunque, favicon SVG in data URI (il
404 su `/favicon.ico` era quello che teneva Best practice a 96).

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

---

## 7. Cosa manca — dichiarato, non nascosto

**Il punto più importante:** la mappatura dei campi WP-Residence **non è
verificata sul database vero**. Il connettore MCP del sito è andato in timeout
quattro volte, e ho cambiato strategia invece di insistere. Per questo
l'importatore ha `--campi`, che stampa i nomi reali dei meta prima di
importare: **è il primo passo e non è saltabile.**

Poi:
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

1. **Far girare `--campi` sul database WordPress vero** e correggere la
   mappatura. È l'unico punto dove il lavoro fatto potrebbe rivelarsi sbagliato.
2. **Provare su MySQL** — installazione via `public/install.php` su un
   sottodominio SiteGround, per esempio `prova.mondoimmobiliarelecce.it`.
3. **Decidere fra sito nuovo e terza strada** (punto 9). Tutto il resto
   dipende da questa.
4. Se si va avanti: mappa dei redirect, `og:image` sulle schede (oggi manca),
   export verso i portali.

### Il check-in orario sulla PR

C'è un check-in automatico ogni ora sulla PR #3: ricontrolla stato, check run
e commenti; se non è cambiato niente non scrive a nessuno e si ri-arma. Si
ferma da solo quando la PR viene merged o closed. Per fermarlo prima basta
dirlo.
