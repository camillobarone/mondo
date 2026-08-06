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
| Head al momento | `14ab230` |
| Cartella | `sito-nuovo/` (il resto del repo non c'entra) |
| CI | **nessuna configurata** — zero check run, niente da far passare |
| Commenti | uno solo, del bot Gemini (avviso di dismissione). Nessuna azione |

Albero di lavoro pulito, tutto pushato.

### I commit

Sono una quarantina e l'elenco per esteso invecchiava a ogni sessione: si
legge con `git log --oneline --reverse` dalla cartella `sito-nuovo/`. I
messaggi sono scritti per essere letti in fila e raccontano il perché, non
il cosa.

Le tappe che servono per orientarsi:

- `d2cb64e` — nasce il sito nuovo con gestionale, in PHP e MySQL
- `3d2216e` — importazione da WordPress, conservando gli slug
- `8a9b8a7` — gli articoli tornano alla radice, dove Google li conosce
- `383b365` — il database si aggiorna da solo entrando nel gestionale
- `c36ad99` — la grafica di adesso: palette calda, foto grandi
- `4bb84cc` — le correzioni del controllo generale del 5 agosto
- `14ab230` — ultimo: la favicon prende il blu del logo vero

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

### ⚠️ Una cosa alla volta — la regola che viene prima delle altre

**Si consegna una cosa sola, si aspetta che Camillo l'abbia fatta, si
verifica, e solo dopo si passa alla successiva.** Vale per i file da
caricare, per le modifiche da approvare, per le domande da fare.

Non è una preferenza di stile: è costata il sito giù. Il 5 agosto 2026 il
controllo generale ha prodotto diciannove file, consegnati tutti insieme in
cinque gruppi ordinati per cartella di destinazione. Camillo ne ha caricato
uno — `Seo.php`, l'ultimo arrivato e quindi quello che aveva in mente — e
quel file chiamava un metodo nuovo di `Content.php`, che era rimasto
vecchio. Home, elenco immobili, blog, contatti e schede: **500 su tutto**.

Cosa se ne ricava, oltre alla regola:

- **un pacchetto grosso non viene caricato tutto**, viene caricato in parte,
  e la parte la sceglie chi carica, non chi consegna;
- **se proprio devono essere più file, vanno raggruppati per dipendenza, mai
  per cartella**: la cartella è comoda per chi carica, la dipendenza è
  l'unica cosa che decide se il sito sta in piedi fra un gruppo e l'altro;
- ogni gruppo deve **lasciare il sito funzionante**, e va detto a voce quale
  file chiama quale.

Quando la consegna è una sola cosa, niente di tutto questo serve.

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

**⚠️ `public/.htaccess` non si tocca senza provarlo sul server.** Il file nel
repo è tenuto **identico byte per byte** a quello che gira su SiteGround —
1390 byte — e va tenuto così, commenti compresi: è l'unica versione di cui si
sappia che funziona lì.

Il 6 agosto 2026 ci erano state aggiunte tre righe di cache per SVG e
caratteri tipografici — `ExpiresByType image/svg+xml`, `font/woff2`,
`application/font-woff2` — e il sito ha smesso di rispondere su **ogni
indirizzo tranne la home**: 404 su `/immobili/`, sulle schede, sul blog. La
home continuava a rispondere perché `index.php` è un file vero e ci arriva da
`DirectoryIndex`, senza bisogno della riscrittura.

Tre cose lo rendono un caso chiuso e non un'ipotesi:

- **non era un 500** ma un 404, quindi Apache non stava rifiutando il file per
  errore di sintassi;
- la pagina di errore era **quella di SiteGround, in inglese** («We searched
  the space…»), non quella del sito, che è in italiano e dice «Questa pagina
  non c'è». La richiesta non arrivava nemmeno a PHP;
- le stesse identiche righe su un **Apache normale** con `mod_rewrite` e
  `mod_expires`, provate in locale, non rompono niente: `/immobili/` e
  `/contatti/` rispondono 200.

Quindi non è la sintassi Apache: è il modo in cui SiteGround rilegge questo
file — davanti ad Apache c'è un NGINX che se lo interpreta per conto suo, ed è
lui a rispondere quel 404. **Quale delle tre righe non gli piaccia non è stato
stabilito**: per scoprirlo servivano altre interruzioni del sito, e il
guadagno erano pochi KB di cache.

Si è tornati indietro rinominando: il vecchio era stato conservato come
`htaccess.vecchio` prima di sovrascrivere, ed è bastato riscambiare i nomi. È
il motivo per cui **una copia del vecchio va sempre lasciata sul server**
prima di toccare questo file.

Se un giorno serve davvero: una riga per volta, aprendo `/immobili/` dopo
ognuna, con la copia pronta da rimettere.

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

### Il controllo generale del 5 agosto 2026

Passato tutto il sito con un browser vero, 15 pagine percorse, JSON-LD
estratto e riletto. Quello che ne è uscito è già corretto (commit `4bb84cc`);
resta qui perché sapere **cosa era rotto** evita di rifare lo stesso errore.

- **Il logo non esisteva.** `Seo.php` dichiarava `/assets/img/logo-512.png`
  come `logo` e `image` dell'agenzia su ogni pagina, ma la cartella `img/`
  non c'era: il nodo che identifica l'agenzia puntava a un 404, e `og:image`
  restava vuoto ovunque non ci fosse una foto di immobile. Risolto due volte:
  prima il codice, che adesso cerca il file su disco e ne legge le misure vere
  invece di dichiararne di inventate; poi il file, che Camillo ha disegnato e
  caricato. Vedi il blocco qui sotto.
- **`HEAD` rispondeva 404 su tutto**, home compresa: nessuna rotta era
  registrata su quel metodo.
- **Nessuna pagina era conservabile.** La sessione si apriva a chiunque e PHP
  marcava tutto `no-store`. Ora la sessione si apre solo a chi serve e le
  pagine pubbliche hanno un ETag.
- **Tutti i title superavano i 60 caratteri**: `Pages::meta()` tagliava a 60,
  poi il modello aggiungeva altri 26 di firma.
- Il `lastmod` della sitemap era la data di oggi ricalcolata a ogni lettura.
- Il login non contava i tentativi falliti.

Cosa è stato controllato e **andava già bene**, per non riverificarlo:
niente XSS nel motore di testo (dieci stringhe d'attacco), contrasto colori
tutto oltre il livello AA, un solo `h1` per pagina e nessun salto nella scala
dei titoli, URL con filtro correttamente `noindex` con canonical sull'elenco,
caricamento foto validato dai byte iniziali con doppia serratura `.htaccess`,
posta con iniezione di intestazioni bloccata, NAP e recensioni canonici, il
telefono deprecato assente da tutto il codice.

Gli attrezzi per rifarlo — crawler, misura dei margini, contrasto — vivono
nello scratchpad della sessione e vanno riscritti in una chat nuova. Sono un
centinaio di righe di Playwright in tutto.

### Il server è allineato al codice — 5 agosto 2026, sera

Il giorno prima era rimasto **mezzo caricato**, ed è così che il sito era
andato giù. Adesso `prova.mondoimmobiliarelecce.it` ha tutti i file del
controllo generale. Caricati uno per volta, o a gruppi solo dove i file erano
davvero indipendenti fra loro, con una verifica dopo ognuno.

L'ordine seguito, che è anche l'ordine delle dipendenze:

1. `app/Core/Session.php` — da solo, perché il nuovo `index.php` chiama un
   metodo che prima non c'era. Provato in locale rimettendo l'`index.php`
   vecchio accanto al `Session.php` nuovo: otto indirizzi, tutti 200.
2. `public/index.php`
3. `app/Core/Legali.php` — file nuovo, inerte finché non arriva chi lo usa
4. `views/layout/site.php`
5. i quattro di `app/Controller/Site/` insieme: indipendenti l'uno dall'altro
6. `app/helpers.php`, `views/admin/dashboard.php`, `public/assets/css/site.css`
7. la migrazione `2026-08-05-tentativi-accesso.sql` con `app/Core/Auth.php` —
   tutti e due inerti; poi l'ingresso nel gestionale ha applicato la
   migrazione, con il messaggio «Database aggiornato» a confermarlo
8. `app/Controller/Admin/Session.php` — per ultimo, perché è quello che
   accende il blocco dei tentativi: prima di lui la tabella doveva esistere

**Il logo vero c'è.** Camillo l'ha disegnato e caricato: `logo.png` 1024×1024
e `social-1200x630.png`, in `public/assets/img/`. Verificato nel sorgente
della home — il nodo `ImageObject` riporta `"width": 1024, "height": 1024`,
cioè le misure lette dal file, non scritte a memoria. Il marchio è blu
**`#1b82d8`**, ed è il valore da usare ovunque serva il colore dell'agenzia.
La favicon adesso è casa bianca su quadrato blu: bianco su `#1b82d8` misura
4,0:1, sopra il 3:1 che si chiede a una forma piena. Fondo pieno e non
trasparente perché a 16 pixel un quadrato bianco sparisce nella barra delle
linguette.

**Il log del server era pulito tranne una riga**, che si ripeteva a ogni
apertura dell'anteprima di un articolo: `Undefined array key "author_name"`.
L'anteprima disegna l'articolo con lo stesso codice del sito, ma le arrivava
il risultato di `Content::post()`, che era `SELECT * FROM posts`: le colonne
dell'autore stanno in `users`. Oltre all'avviso, l'anteprima perdeva la firma
in fondo e il nodo `Person` dello schema — due delle cose che si va a
guardare proprio in anteprima. Corretto in `0b2a6ab`: ora `post()` fa la
stessa unione che `postBySlug()` faceva già.

### Sito pubblico
Home con ricerca, elenco con filtri, scheda immobile con galleria, pagina
valutazione con FAQ visibili, blog, pagine statiche, contatti con entrambe le
sedi, sitemap dal database, robots.txt che non blocca i crawler AI.

### Dove stanno gli articoli
**Alla radice: `/imposte-acquisto-casa/`, non `/blog/imposte-acquisto-casa/`.**
È la struttura del sito vero, e conservarla evita 56 reindirizzamenti nel
momento peggiore per farli. `/blog/` resta come indice. Il singolo articolo lo
serve `Pages::catchAll()`, che prova in quest'ordine: redirect 301, pagine
statiche, articoli, 404. `/blog/<slug>/` risponde 301 verso `/<slug>/` per non
spezzare i link usciti dal sito di prova.

Conseguenza da ricordare: articoli e pagine abitano lo stesso spazio di nomi.
`Content::uniqueSlug()` cerca lo slug **in tutt'e due le tabelle** e rifiuta
quelli su cui risponde già una rotta fissa (elenco in `Content::RISERVATI`). Chi
aggiunge una rotta pubblica nuova alla radice deve aggiungerla anche lì.

### La scala dei titoli — regola da rispettare nelle viste nuove
Un solo `h1` per pagina, ed è il titolo della pagina (`.pagina-titolo`, o
l'`h1` dentro `.scheda-head` per l'immobile). Sotto, i titoli di sezione sono
`h2.titolo-sezione`; sotto ancora `h3`. Le classi servono solo a tenere il
corpo che avevano prima: **la misura non dice il livello**, e non va usata per
sceglierlo. `Core\Testo` segue la stessa scala: `#`/`##` diventano `h2`, il
resto `h3`.

Attenzione a `site/_card`: sta in tre pagine a due profondità diverse e riceve
il livello da chi la include (`'livello' => 2` solo nell'elenco immobili, dove
le schede stanno subito sotto l'`h1`). Saltare un gradino fa perdere il filo a
chi si muove fra i titoli con lo screen reader, ed è l'unico rilievo che
Lighthouse dava sull'accessibilità.

### Account «solo firma»
Terzo ruolo accanto a `agent` e `admin`: **`firma`**. Serve ai colleghi che
compaiono come autori di un articolo — nome e biografia in fondo al pezzo,
nodo `Person` nel JSON-LD — ma non gestiscono immobili e non entrano nel
gestionale. Nessuna password in circolazione per un accesso che non useranno.

Come funziona: `password_hash` resta la stringa vuota, e `Auth::attempt()`
rifiuta esplicitamente sia il ruolo `firma` sia l'hash vuoto. Passare un
account esistente a `firma` **cancella la password**, altrimenti l'etichetta
sarebbe una bugia. Nessuna colonna nuova: il ruolo sta dove stava già.

Due protezioni: non ci si può cambiare il ruolo da soli (si resterebbe chiusi
fuori, e per rientrare servirebbe phpMyAdmin), e la password nel modulo di
creazione non è più `required` in HTML — senza JavaScript non si può togliere
l'obbligo al volo, quindi il controllo vero è nel controller, per ruolo.

Per ridare l'accesso a un «solo firma»: rimettilo Agente, salva, e a quel
punto ricompare il campo della password. Fra i due salvataggi l'account è un
agente senza password — che comunque non entra, per via del controllo
sull'hash vuoto.

> ⚠️ **Scritto nel programma, non ancora sul server.** Il 5 agosto 2026
> Camillo ha scelto di dare a ogni collega un'email diversa invece di
> caricare gli otto file di questa modifica. Sul server c'è quindi ancora la
> versione con l'email unica, che è coerente e funziona.
>
> Gli otto file sono un blocco unico e vanno caricati insieme, mai a pezzi:
> `Db.php`, `Auth.php`, `Users.php`, `SystemController.php`, `utenti.php`,
> `utente-scheda.php`, `schema.sql` e la migrazione
> `2026-08-05-email-condivisa.mysql.sql`. Caricare il solo
> `SystemController.php` farebbe accettare al modulo un'email ripetuta che il
> database rifiuterebbe subito dopo, con un errore poco leggibile.

**L'email non è più unica.** In agenzia la posta è una sola, e chiedere un
indirizzo diverso per ogni collega significa chiedere di inventarne. L'email
qui è la chiave d'accesso, non un dato anagrafico: deve essere unica solo fra
chi entra davvero. `Users::emailTaken()` conta perciò i soli account con ruolo
diverso da `firma`, e il vincolo `UNIQUE` è stato tolto dal database.

Il pezzo che rende la cosa sicura sta in `Auth::attempt()`: la query esclude
`role = 'firma'`. Senza quel filtro, cercare per sola email potrebbe
restituire una firma al posto della persona che sta entrando — stesso
indirizzo — e negarle l'accesso pur avendo la password giusta.

### Migrazioni per un solo driver
Un file di migrazione chiamato `*.mysql.sql` o `*.sqlite.sql` viene eseguito
solo sul driver corrispondente, e sull'altro non viene nemmeno segnato come
applicato (`Db::migrazioneVale()`). Serviva per togliere il vincolo di
unicità sull'email: su MySQL è un `ALTER TABLE`, su SQLite bisogna
ricostruire la tabella. Sono due file gemelli, ognuno SQL vero che si legge e
si prova da solo, invece di un segnaposto che nasconde la differenza.

### Copertine e anteprima social
Pagine e articoli hanno un'immagine di copertina, caricata dal gestionale e
lavorata dallo stesso `Uploader` delle foto degli immobili: fino a tre
larghezze in WebP. Si vede sotto il titolo — non sopra: chi arriva da Google deve
ritrovare per primo il titolo che ha cliccato — larga quanto il testo, con
`width`/`height` sempre stampati perché la pagina non sobbalzi.

Prima esisteva una colonna `posts.cover` che era una casella di testo in cui
scrivere a mano un indirizzo, **e che non veniva mostrata da nessuna parte**:
si salvava e finiva lì.

`Pages::meta()` ha ora un settimo parametro, l'immagine, e il layout emette
`og:image` più le `twitter:card`. **Prima il sito non dichiarava nessuna
immagine sociale**: un immobile mandato su WhatsApp arrivava come un
rettangolo di testo, proprio dove la foto è tutto. La scheda immobile passa
la sua prima foto, la home quella dell'hero, pagine e articoli la copertina;
se non c'è niente si ripiega su `logo_url` delle impostazioni.

**Anteprima delle bozze**: `/gestionale/pagine/{id}/anteprima/` e
`/gestionale/articoli/{id}/anteprima/`. Per questo il disegno della pagina è
stato estratto in `Pages::renderPage()` e `Journal::render()`, sullo stesso
schema di `Listings::render()`, che l'anteprima degli immobili già usava.

Nota su `Uploader`, **risolta**. Generava solo le larghezze minori o uguali
all'originale (480, 960, 1600): una foto da 1400 px usciva quindi al massimo a
960, e una da 800 px a 480 — su schermo grande si vedevano ingrandite. Adesso
la misura più grande è quella dell'originale, con il tetto di 1600:

```php
$massima = min($width, max(self::WIDTHS));
$larghezze = array_values(array_filter(self::WIDTHS, fn ($w) => $w < $massima));
$larghezze[] = $massima;
```

Non si ingrandisce mai (il tetto è l'originale) e non si superano i 1600 px
(nessuno schermo userebbe una foto da 5000). Verificato su 400, 480, 800, 960,
1400, 1600 e 3000 px: le prime due e le ultime tre non cambiano, 800 e 1400
adesso escono alla loro misura vera.

**Vale solo dalle foto caricate da qui in avanti.** Le 1.114 foto importate e
tutto quello che è già stato caricato restano come sono: i file WebP sono già
stati scritti, e nessuno li rigenera. Se una foto in pagina si vede sfocata,
si ricarica e viene rilavorata con le misure nuove.

### Le domande frequenti diventano dati strutturati
Pagine e articoli emettevano `WebPage`/`BlogPosting` e le briciole di pane, e
basta. Le guide fiscali dell'agenzia hanno metà del contenuto fatto di domande
— sette sole su «Agevolazioni prima casa» — e sul sito vecchio Rank Math le
marcava come `FAQPage`. Qui restavano testo semplice.

`Testo::faq()` le rilegge dal testo già scritto, senza campi nuovi:

- un `##` intitolato **Domande frequenti** (oppure `FAQ`, o *Domande e
  risposte*) apre la sezione;
- ogni `###` dentro la sezione è una domanda, il testo fino al `###`
  successivo è la sua risposta;
- un altro `##`, o una riga orizzontale `---`, chiudono la sezione.

Quel confine è la parte che conta: senza, ogni `h3` della pagina diventerebbe
una domanda che nessuno ha posto — e la firma in fondo all'articolo finirebbe
dentro l'ultima risposta.

Le risposte escono senza segni di formattazione: nel JSON-LD un `**` non è
grassetto, è rumore dentro una frase. Paragrafi consecutivi si uniscono in una
risposta sola.

Il nodo si aggiunge solo se la sezione c'è: una pagina senza domande ha il
grafo di prima, invariato. In pagina non cambia niente — le `h3` si vedevano
già.

**Perché, visto che Google ha tolto i risultati arricchiti per le FAQ nel
2023** (li tiene solo per enti pubblici e sanità): perché non è per Google. È
la forma in cui ChatGPT, Perplexity e gli assistenti leggono una domanda e la
sua risposta senza doverla indovinare, ed è il terreno su cui il sito sta
costruendo. Costa qualche riga di JSON su pagine che quelle domande ce le
hanno già scritte dentro.

### `llms.txt`
`/llms.txt`, generato dal database come la sitemap: identità dell'agenzia,
sedi, pagine principali, immobili online e articoli, in Markdown pulito.
Serve ai modelli linguistici, che leggendo l'HTML spenderebbero gran parte
del contesto su menù e impalcatura. Non è uno standard riconosciuto da
Google e potrebbe non servire a niente: costa trenta righe e non toglie
nulla al resto. I dati dell'agenzia si leggono da `Seo::agentNode()`, non
sono ricopiati — così non possono divergere dal JSON-LD.

In `robots.txt` **non** va messa una riga `LLM-Content:`: i validatori la
contano come direttiva sconosciuta e bocciano il file intero.

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

### Mappa dell'immobile (`Mil\Core\Mappa`)
Le coordinate c'erano già — colonne `lat`/`lng`, portate dall'importazione —
ma non si vedevano da nessuna parte. Adesso la scheda ha «Dove si trova».

Niente Google Maps incorporato: sarebbe uno script di terzi su ogni scheda,
con i cookie e quindi il banner. In pagina c'è un riquadro di OpenStreetMap
dentro un `<details>`, che **finché resta chiuso non viene scaricato**
(verificato: 7 richieste di rete, nessuna esterna), più un collegamento a
Google Maps che sul telefono apre l'applicazione.

`properties.map_mode` decide quanto si mostra, immobile per immobile:
- `zona` (predefinito) — coordinate arrotondate a 3 decimali (~110 m), niente
  segnaposto, riquadro largo ~2 km;
- `esatto` — coordinate intere e segnaposto sulla casa.

L'arrotondamento avviene in `Mappa::punto()`, che è **l'unico punto da cui
escono le coordinate**: ci passa anche il `geo` del JSON-LD. Verificato che in
modalità `zona` le coordinate esatte non compaiono da nessuna parte nella
pagina — se il calcolo fosse solo nel template, uscirebbero dallo schema.

### Impaginazione del testo scritto a mano (`Mil\Core\Testo`)
Articoli, pagine e descrizioni degli immobili si scrivono in una chat e si
incollano nel gestionale. Prima uscivano con `nl2br()`, cioè con i `##` e gli
asterischi stampati in pagina: un articolo lungo era un muro di testo con dei
cancelletti dentro.

`Testo::html()` riconosce solo il poco che si usa scrivendo: riga vuota fra i
paragrafi, `#`/`##` → `h3` e il resto → `h4` (il titolo della pagina è già un
`h2`: l'indice resta una scala), `-`/`*`/`•` e `1.` per gli elenchi, `>` per le
citazioni, `---` per una riga, `**grassetto**`, `*corsivo*`,
`[testo](indirizzo)` con soli `http(s)`, `/`, `mailto:` e `tel:`.

Il testo viene **prima messo in sicurezza con `e()` e poi ricostruito**: non
esiste un percorso in cui dell'HTML scritto in un articolo arrivi in pagina.
Un `<script>` incollato si vede come testo.

`Testo::piano()` fa il contrario — toglie i segni senza impaginare — ed è
richiamato da `tronca()`: nelle meta description e nelle anteprime i `##` non
formattano niente, occupano solo caratteri contati.

### Abbinamento domanda/offerta
Punteggio 0–100. Budget unico criterio bloccante, con tolleranza 5%. I criteri
non espressi non penalizzano. Sotto 60 non viene proposto.

### Velocità (Lighthouse 12, profilo mobile)

Prima, sulla scheda immobile: 98 / 100 / 96 / 100, LCP 1,8 s.

Adesso, su **tutte** le pagine misurate — home, elenco, scheda, contatti,
valutazione, blog: **100 / 100 / 100 / 100**. LCP fra 0,7 e 1,3 s, CLS 0
(0,001 su due pagine), TBT fra 0 e 40 ms.

Cosa lo produce: CSS inline minificato, fino a tre larghezze WebP per foto
(480/960/1600, o la misura vera dell'originale se sta fra due tagli) con
`srcset`, preload della candidata LCP con lo stesso
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

- **«Altri articoli» vuoto**: la pagina dell'articolo chiedeva gli ultimi tre
  post e poi scartava sé stessa disegnando l'elenco. Con un articolo solo
  pubblicato restava il titolo «Altri articoli» e sotto il nulla. Adesso lo
  scarto avviene nel controller, che ne chiede quattro per poterne togliere
  uno, e la sezione o ha delle voci o non c'è.

Quattro di questi cinque erano invisibili a leggere il codice: si sono visti
solo aprendo le pagine e misurandole.

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

⚠️ **Questo elenco va riletto contro il codice prima di ripeterlo a Camillo.**
Il 4 agosto gli è stato detto che mancava il campo video quando era già fatto
da due commit: la riga era rimasta qui. Una funzione dichiarata mancante che
invece c'è costa più di una mancanza dichiarata: gli fa spendere una decisione
su un problema che non esiste.

Cosa manca davvero (verificato il 4 agosto, sera):
- Esecuzione reale su MySQL non provata (qui c'è solo SQLite)
- Rich Results Test di Google (serve una URL pubblica)
- Import CSV dell'anagrafica clienti (in WordPress non c'è)
- Export verso i portali (Immobiliare.it, Idealista)
- Geocoding, tool OMI, pagine di zona, pagine dei soci
- Statistiche di visita: nessun Analytics, e nessun conteggio lato server
  oltre alle visualizzazioni per immobile
- Blocco dopo N tentativi di accesso falliti: c'è solo un ritardo di 300 ms
- FAQ della pagina valutazione scritte nel codice, non modificabili dal pannello
- **La mappa vecchio → nuovo degli indirizzi non esiste ancora**: il gestionale
  ha la tabella e la pagina dei reindirizzamenti, ma sono vuote. È il pezzo che
  decide se il passaggio costa posizioni. Vedi `MIGRAZIONE-SEO.md`, fasi 1 e 2.
  Il censimento è fatto (`CENSIMENTO-URL.md`): 34 immobili e 56 articoli non
  hanno bisogno di **reindirizzamenti**, perché i loro indirizzi restano
  identici. Attenzione a non leggerci più di quello: **gli articoli non sono
  stati importati** — l'importatore legge solo `estate_property` — e vanno
  ricreati a mano come le pagine. Restano da decidere le 25 pagine-residuo del
  tema.
- **Il contenuto da ricreare**: 35 pagine e 54 articoli al 5 agosto 2026. Il
  conto aggiornato, l'elenco di cosa è già fatto e la regola con cui si
  scelgono i collegamenti interni stanno in `CENSIMENTO-URL.md`, sezione «A che
  punto siamo».
- Il `sameAs` dell'autore singolo: il nodo `Person` di un articolo eredita
  l'aggancio a Wikidata da `worksFor` → `#agent`, ma non ha un proprio
  collegamento a un profilo pubblico. Servirebbe una colonna in `users`.

Fatti, non più mancanti: video e visita virtuale (colonne, campi, importazione,
pulsanti sulla scheda, `VideoObject` nel JSON-LD), calcolatore delle imposte,
anteprima della scheda, FAQ per immobile, formattazione ricca del testo
(`Core\Testo`: sottotitoli, elenchi, grassetto, collegamenti).

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

Aggiornato alla **sera del 5 agosto 2026**. Superato tutto quello che
riguardava il codice: il sito gira su `prova.mondoimmobiliarelecce.it` con
MySQL e gestionale, i file sul server sono allineati al repo, il logo vero è
al suo posto e il log del server è vuoto.

**Il passo successivo è già cominciato, e si è fermato su due dati.** Si stava
scrivendo l'**informativa privacy**. Quella del sito vecchio (pagina WP
`24677`) non si può ricopiare: descrive Google Analytics, il retargeting e una
newsletter, e il sito nuovo non ha niente di tutto questo — zero JavaScript,
nessun cookie di tracciamento, nessun modulo di iscrizione. Ricopiarla
sarebbe dichiarare il falso.

Quello che il sito fa davvero, letto dal codice e già pronto per il testo:

- i moduli raccolgono **nome, telefono, email, zona, messaggio e indirizzo
  IP** (`Forms.php` → tabella `leads`)
- **un solo cookie**, `milsess`, tecnico, di sessione, e parte soltanto
  quando si invia un modulo o si entra nel gestionale
- **un solo terzo**: il riquadro OpenStreetMap sulle schede immobile, dentro
  un `<details>` chiuso — si collega solo se il visitatore clicca «Apri la
  mappa», e con `referrerpolicy="no-referrer"`
- i tentativi di accesso falliti al gestionale salvano IP ed email per un
  quarto d'ora, poi `Auth::dimenticaVecchi()` li cancella
- titolare: Studio RCS Srls, Via Giuseppe Parini 48/a, Lecce, P.IVA
  IT05004730759, tel 0832 391489

**Le due domande da fare a Camillo appena si riprende**, e finché non
risponde il testo non si scrive perché sarebbero dati inventati:

1. quale **indirizzo email** pubblicare per le richieste privacy (accesso,
   cancellazione). Non compare da nessuna parte nel codice: cercato, zero
   risultati.
2. **per quanto tempo tiene le richieste di contatto** prima di cancellarle.
   Proposta fatta e in attesa di conferma: 24 mesi dall'ultimo contatto.

Poi, in ordine di quanto pesa:

1. **Ricreare il contenuto: 35 pagine e 54 articoli.** È il collo di
   bottiglia, e non è lavoro tecnico — sono testi da riscrivere uno per uno
   nel gestionale, con lo stesso slug del sito vecchio. Finché non ci sono,
   il sito nuovo non può sostituire quello vero. Elenco, conteggio e regole
   in `CENSIMENTO-URL.md`.
2. **La tabella dei reindirizzamenti è ancora vuota.** Serve solo per le 25
   pagine-residuo del tema (410 o 301 verso la home: da decidere) e per
   eventuali slug che cambiano. Immobili e articoli non ne hanno bisogno.
3. **Le due pagine di legge**, `informativa-sulla-privacy-e-sulluso-dei-dati-di-mondo-immobiliare`
   e `cookie-policy`. Sono le prime due da ricreare, prima di qualunque
   guida: il modulo di contatto raccoglie nome, telefono ed email, e
   l'informativa deve essere raggiungibile da ogni pagina. Gli indirizzi
   stanno in `app/Core/Legali.php`; finché mancano, il piè di pagina non le
   nomina — meglio nessun collegamento che uno rotto — e il riepilogo del
   gestionale lo dice in chiaro. Le pagine vecchie da cui partire: WP `24677`
   (privacy) e WP `30757` (cookie). La cookie policy sarà corta: il sito ha
   un cookie solo, tecnico.
4. **Pulizia prima di andare online**: cancellare `public/install.php`, i 2
   clienti di esempio e i 3 articoli di esempio.
5. **`agenzia-immobiliare-porto-cesareo`.** Il nodo della seconda sede nello
   schema la nomina in ogni pagina del sito. Finché non esiste, `url` viene
   omesso dal nodo: nessun collegamento rotto, ma nemmeno l'indirizzo della
   sede nei dati strutturati. La pagina vecchia da cui partire è WP `30534`,
   pubblicata e aggiornata a luglio 2026.
6. **Il calcolatore IMU** (`calcolo-imu-2026-lecce`), rimandato: è l'unica
   delle 46 pagine che è codice e non testo. Vedi `CENSIMENTO-URL.md`.
7. **Lanciare `--campi` sul database vero** per il censimento completo sui 49
   immobili, e decidere il campo video.
8. **Decidere se mettere il logo in testata.** Adesso il sito scrive il nome
   dell'agenzia in caratteri, non lo disegna: il logo esiste come file e sta
   nei dati strutturati, ma in pagina non si vede. Non è una svista ed è una
   scelta di Camillo, non da fare per conto suo.
9. Più avanti: export verso i portali.

### Il check-in orario sulla PR

C'è un check-in automatico ogni ora sulla PR #3: ricontrolla stato, check run
e commenti; se non è cambiato niente non scrive a nessuno e si ri-arma. Si
ferma da solo quando la PR viene merged o closed. Per fermarlo prima basta
dirlo.
