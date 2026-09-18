# Handoff — per riprendere in una chat nuova

Da incollare (o allegare) all'inizio di una nuova conversazione. Dice chi è
l'utente, cos'è già stato fatto, dove sta ogni cosa e cosa resta aperto.

**Aggiornato al 18 settembre 2026.**

> Il documento gemello è `CONSEGNA.md` (anche in `.txt`): quello è per
> l'agenzia, questo è per chi riprende il lavoro. `README.md` è il manuale
> d'uso. Se hai poco spazio, leggi prima **CONSEGNA.md capitoli 5 e 6**.

---

## 0 · Regola fissa — una finestra, un progetto

**In una conversazione aperta su questo progetto si lavora esclusivamente su
questo progetto: il gestionale in `crm/`. Divieto di lavorare su altri
progetti.**

Cosa vuol dire in pratica:

- si tocca **solo la cartella `crm/`**. `web-auditor/` e qualsiasi altra
  cartella di questo repository sono fuori: nemmeno per una correzione veloce;
- niente lavori sui siti `mondoimmobiliarelecce.it` o `salentoproperties.com`,
  niente SEO, niente articoli, niente WordPress, niente social. Sono attività
  di altri progetti e vanno chieste in una finestra loro;
- se arriva una richiesta che non riguarda il gestionale, **non si esegue**: si
  dice che è fuori perimetro per questa finestra e si chiede di aprirne una
  dedicata. Vale anche quando è una cosa da due minuti — è così che una finestra
  perde il filo;
- l'unica eccezione è la manutenzione della finestra stessa (`HANDOFF.md`,
  `CONSEGNA.md`, `README.md`, la pull request #2, il controllo giornaliero del
  capitolo 7): sono parte di questo progetto, non un progetto a parte.

Regola posta da Camillo il 27 agosto 2026. Resta valida finché non la revoca lui.

---

## 1 · Chi è l'utente

**Camillo Barone**, titolare di **Studio RCS Srls** —
*Mondo Immobiliare Lecce*, agenzia FIMAA dal 1994,
uffici a **Lecce** e **Porto Cesareo**.

- **Scrive e va risposto in italiano.** Anche i commenti nel codice sono in
  italiano.
- **Non è tecnico.** PowerShell, SSH e pannelli cloud vanno spiegati con
  comandi da copiare e incollare, non descritti.
- **Un passo alla volta.** Lo ha chiesto esplicitamente durante la
  configurazione del server: *«un solo passo alla volta, mi raccomando»*.
  Quando ci sono più schermate da attraversare, dagli una schermata per
  messaggio e aspetta la conferma.
- **Manda screenshot.** Vanno **letti davvero** prima di indicare dove
  cliccare. In questa sessione l'ho mandato sul prodotto Aruba sbagliato
  perché ho tirato a indovinare, e la sua risposta è stata:
  *«cerca di non commettere più questi errori.»*
- **Corregge quando sbaglio, e ha ragione.** Ha notato dati mancanti dopo una
  conversione CSV, e date lette male in un file Excel. Verificare prima di
  affermare.

---

## 2 · Cos'è il progetto

Un CRM immobiliare completo, **in esercizio dal 3 agosto 2026**, con
l'archivio reale dell'agenzia già dentro.

| | |
|---|---|
| Indirizzo | **https://gestionale.mondoimmobiliarelecce.it** |
| Server | Aruba Cloud VPS, **77.81.234.151**, Ubuntu 24.04 |
| Repository | `camillobarone/mondo`, cartella **`crm/`** |
| Ramo | `claude/real-estate-client-management-app-xl7dnx` |
| Pull request | **#2**, aperta in bozza |
| Tecnologie | Next.js 16 (App Router, Server Actions), React 19, SQLite via `better-sqlite3`, Tailwind v4 |
| Archivio dentro | 1.108 clienti, 206 richieste, 53 immobili |

Utenti del programma: **UFFICIO** e **CAMILLO BARONE** (entrambi titolari).

**Tutto è già committato e pushato.**

---

## 3 · Il comando che serve sempre

Dopo ogni modifica al codice, l'utente aggiorna il server **da solo**, da
PowerShell (questa sessione **non ha accesso SSH** al server: nessuna chiave,
nessuna rotta di rete):

```
ssh root@77.81.234.151 "bash /opt/mondo-crm/deploy/aggiorna.sh"
```

**Attenzione alle virgolette annidate in PowerShell** — questa forma perde il
`cd` e dà `Cannot find module`:

```
ssh root@IP 'sudo -u mondo bash -c "cd /opt/mondo-crm && node ..."'   # SBAGLIATO
ssh root@IP "cd /opt/mondo-crm && sudo -u mondo node ..."             # giusto
```

---

## 4 · Cosa c'è dentro, in breve

Clienti · Richieste · Immobili (con foto) ·
**Venditori** (proprietari, con avviso compleanni) ·
**Incroci** automatici · Agenda ·
**Storico visite per il proprietario** ·
Trattative · Report · Adempimenti (privacy datata, antiriciclaggio,
registro accessi) · Importazione da Excel · **Ricerca globale** ·
**separazione fra collaboratori** (ognuno vede solo le proprie schede).

### Le cose costruite in questa sessione, in ordine

1. Correzione di **tre cause diverse** di incroci mancati (soglia punteggio,
   confronto zone letterale, budget minimo che escludeva) più una quarta: un
   `budget_min` **invisibile** nell'interfaccia.
2. **Importazione diretta da `.xlsx`** — lettore Excel scritto in casa sopra
   `zlib`, verificato cella per cella contro openpyxl (8.896 celle, zero
   differenze). Il passaggio da CSV perdeva dati.
3. **Messa online** con un comando (`deploy/installa.sh`).
4. **Foto** sugli immobili.
5. **Venditori** + legame venditore↔immobile da entrambe le parti, con
   **ricerca** al posto della tendina infinita.
6. **Storico visite per il proprietario** — pagina stampabile con nome,
   telefono e commento di chi è venuto a vedere, presa dall'agenda.
7. **Agenda**: modifica/eliminazione anche delle attività svolte, calendario
   iCalendar (singolo evento + abbonamento per persona), avviso email 30
   minuti prima via cron.
8. **Revisione completa** + quattro utilità: ricerca globale,
   *Proponi su WhatsApp*, riquadro *Da sistemare*, copia di sicurezza dal
   browser.
9. **Incroci più stretti**: niente più proposte in un comune diverso da quello
   richiesto, né di una famiglia di tipologie diversa (commerciale, terreno,
   box a chi cerca casa). Il confronto sul comune tollera le scritture diverse
   («Lecce» e «LECCE (LE)»), e la tipologia esclude solo quando entrambe le
   famiglie si riconoscono.
10. **Storico visite**, e rimozione del resoconto sul prezzo (vedi sotto).
11. **Separazione fra collaboratori.** Ognuno vede soltanto le proprie schede,
    titolare compreso. Chiesta da lui cosi': *«se volessi condividere questo
    gestionale con un collega, dove lui non vede i miei clienti e io non vedo i
    suoi»*, e alla domanda su chi resta a vedere tutto ha risposto **caso B**:
    nessuno, nemmeno lui.

    Come funziona e cosa comporta: capitolo **10-bis** di `CONSEGNA.md`.
    In breve: `clients.owner_id` e `properties.agent_id` decidono tutto; il
    resto eredita. In `queries.ts`
    **ogni funzione di lettura vuole come primo dato l'id di chi guarda** —
    e' scomodo di proposito, cosi' una funzione nuova non puo' nascere senza
    muro: il programma non compila.

    Prima di scrivere il codice e' stata fatta una **mappa esaustiva** di ogni
    percorso di lettura (189 punti distinti su 30 file). Le cose che una
    revisione a occhio non avrebbe trovato:
    - i conteggi devono nascere dallo stesso filtro dell'elenco che
      accompagnano, altrimenti il numero conta l'archivio altrui;
    - il nome del cliente e il titolo dell'immobile attaccati a un'attivita'
      arrivavano da join non filtrati;
    - le foto controllavano solo che ci fosse un accesso, non di chi fosse
      l'immobile;
    - il controllo doppioni dell'importazione confrontava con tutto
      l'archivio: il totale dei saltati era un modo per interrogarlo;
    - lo script dei promemoria gira come processo di sistema e non passa da
      `queries.ts`: il filtro e' stato riscritto anche li'.

    Il pulsante *Scarica l'archivio* e' stato tolto: sarebbe stata la
    separazione aggirata con un clic. **Scoperta collaterale:** quel pulsante
    non era mai arrivato sul server, perche' `.gitignore` ignorava `backup/` a
    qualsiasi profondita' e la cartella `src/app/(app)/backup` non e' mai
    entrata nel repository. Le regole (e le esclusioni `rsync` degli script di
    installazione) sono ora ancorate alla radice.

    Verificato in browser con **due utenti veri** sullo stesso archivio, meta'
    schede a testa: 36 controlli sulle letture e 6 sulle scritture, compreso
    l'attacco vero — aprire il proprio modulo di modifica, cambiare il numero
    della scheda nel campo nascosto e salvare. Rifiutato, archivio intatto.

    Attenzione a un tranello nelle prove: l'archivio ha
    **775 gruppi di omonimi**, quindi cercare un nome e ritrovarlo non e' una
    fuga. I controlli vanno fatti sul numero di telefono, che e' di una
    persona sola.

12. **Il proprio accesso e il recupero della password.** Pagina
    `/accesso` (cambio della propria password) e `/recupero` + `/recupero/[token]`
    (password dimenticata). Prima le password le impostava solo il titolare, il
    che sotto la separazione simmetrica non aveva senso.

    Tre cose non ovvie:
    - **Le sessioni cadono.** `users.password_changed_at` (millisecondi, non
      testo: una data scritta viene letta come ora locale da JavaScript e come
      ora di Greenwich da SQLite) viene confrontato con l'`iat` messo nel
      cookie. Senza, cambiare la password non cacciava fuori nessuno e il
      cambio era una formalita'.
    - **Del biglietto di recupero si salva solo l'impronta** (SHA-256), mai il
      biglietto. Vale un'ora, una volta sola, e chiederne uno nuovo annulla i
      precedenti. La risposta a schermo e' identica che l'indirizzo esista o no.
    - **Le email vanno spedite in base64** (`textEncoding: "base64"` in
      `posta.ts`). Il modo predefinito di nodemailer, quoted-printable, spezza
      le righe oltre i 76 caratteri: l'indirizzo del recupero ne ha quasi cento
      e arrivava **tagliato in due**. L'ha trovato la prova in browser, non la
      lettura del codice.

    Via di scampo quando la posta non e' configurata (che e' lo stato di
    adesso): `npm run password -- --email ...`. Lo script si aggiunge da solo la
    colonna se manca, perche' si usa proprio quando qualcosa non va e il
    programma magari non e' ripartito.

    Verificato in browser: 29 controlli, compreso il caso della seconda finestra
    aperta prima del cambio che si ritrova fuori.

13. **Primo contatto e immobili proposti/visionati** (27 agosto 2026), su
    richiesta sua: *«per ogni cliente... devo sapere sempre: per cosa ci ha
    contattato, quali immobili ho proposto, cosa ha visionato, cosa cerca»*.

    - Due colonne nuove su `clients`: **`contact_reason`** (motivo del primo
      contatto, testo libero) e **`contact_property_id`** (l'immobile per cui
      ha scritto, FK verso `properties`). Si impostano **direttamente dalla
      scheda cliente**, riquadro «Primo contatto» — non serve andare in
      «Modifica cliente».
    - Nuovo tipo di attività **`proposta`** in `ACTIVITY_TYPES`
      (`src/lib/types.ts`), accanto a chiamata/email/whatsapp/visita/ecc.
    - La scheda cliente mostra due elenchi **separati dallo storico
      generale**: «Immobili proposti» (`type = 'proposta'`) e «Immobili
      visionati» (`type = 'visita'`), ciascuno con **il proprio modulo di
      inserimento diretto** in fondo — niente più passare dal box generico
      «Registra un contatto» scegliendo il tipo a mano.
    - `ActivityForm` (`agenda/activity-form.tsx`) ha imparato tre cose:
      `fixedType` (nasconde la tendina Tipo, il modulo ha già uno scopo),
      `propertyRequired` (l'immobile è obbligatorio, altrimenti la voce non
      finirebbe nella lista giusta) e `defaultDone` (proposte e visite si
      registrano quasi sempre a cosa fatta). Gli id dei campi usano `useId()`
      con prefisso: prima, con più moduli identici nella stessa pagina, gli
      `id` duplicati facevano aprire il campo sbagliato cliccando una label.
    - Se il campo «Cosa» resta vuoto (succede spesso in questi moduli
      dedicati, dove il tipo è già scelto), `saveActivity` ci mette da sola
      l'etichetta del tipo — mai più una riga di storico senza titolo.
    - **L'indirizzo (`address`) è ora obbligatorio** per ogni immobile, sia
      nel modulo che sul server (`saveProperty`). Motivo: senza via, un
      immobile compariva nelle liste col solo titolo o codice, impossibile
      da riconoscere al volo. Gli immobili già in archivio senza indirizzo
      non lo hanno all'indietro — vanno completati aprendoli una volta.
    - **Via, comune e prezzo** (non più il codice interno) in ogni tendina e
      lista dove si sceglie o si vede un immobile da proporre:
      `propertyOptionsFor` in `queries.ts`, la scheda cliente («Cosa cerca»),
      **Incroci** e **Richieste**. Il messaggio WhatsApp già scritto per il
      cliente resta **senza indirizzo esatto**, di proposito: è la prassi
      dell'agenzia, per non far saltare l'intermediazione prima della visita.
    - `ACTIVITY_SELECT` porta ora anche `property_address/city/price`
      (dietro lo stesso muro «solo se l'immobile è tuo» degli altri campi):
      `perNomiAttivita()` è passato da 2 a 5 parametri, tienilo a mente se
      tocchi quella query.

    Verificato in browser con Playwright ad ogni passaggio (creazione
    cliente, primo contatto, proposta e visita dai moduli dedicati, modifica
    cliente con i campi precompilati, blocco del salvataggio immobile senza
    indirizzo). L'utente ha poi confermato di persona sul gestionale in
    produzione: **«ok tutto funzionante»**.

14. **Preparata la configurazione della posta** (27 agosto 2026). La
    configurazione in sé la fa lui sul server — da qui non c'è rotta, la porta
    22 va in timeout — ma tutto il resto è pronto:

    - **`npm run posta`** (`scripts/posta.mjs`), nuovo. Apre davvero la
      connessione, fa l'accesso e, con `--manda`, spedisce un'email di prova.
      Traduce l'errore SMTP nella **riga da correggere**: nome inesistente,
      porta chiusa, cifratura sbagliata per quella porta (il classico 465↔587),
      utenza o password rifiutate, mittente rifiutato. Serviva perché
      `promemoria.mjs --prova` non apre nessuna connessione: passa anche con la
      password sbagliata, e senza appuntamenti nella mezz'ora non prova niente.
      I codici di nodemailer non sono quelli di sistema — `EDNS` per il nome,
      `ESOCKET` per la porta — quindi si guardano sia il codice sia il testo.
    - **Trovato l'host giusto**: la posta è su SiteGround, non su Aruba (vedi le
      trappole, capitolo 6). L'esempio che stava in `CONSEGNA.md` e in
      `deploy/servizi.sh` era `smtps.aruba.it` e non avrebbe mai funzionato.
    - `promemoria.mjs` ora spedisce in **base64** come `src/lib/posta.ts`: era
      l'unica via d'invio rimasta senza, e dentro ci sono indirizzi di schede.

    Provato con un finto server SMTP scritto per l'occasione: 8 casi, i 6 modi
    di sbagliare più il controllo che passa e l'invio vero, riletto sul filo per
    verificare `Content-Transfer-Encoding: base64` e gli accenti intatti.

15. **Gli immobili senza via si vedono** (28 agosto 2026). Il riquadro
    *«Da sistemare»* del cruscotto ne conta una quinta: gli immobili a cui manca
    l'indirizzo. Il numero apre `/immobili?noAddress=1`, e lo stesso avviso sta
    in cima all'elenco **Immobili**, dove sparisce da sé quando l'ultimo è
    completato. Serviva perché l'indirizzo è obbligatorio solo dai salvataggi
    del 27 agosto in poi: i vecchi restavano da completare, ma non c'era modo di
    sapere **quali** senza aprirli tutti.

    Costruito sullo stampo del filtro gemello (`noOwner`), con una accortezza:
    la condizione «senza via» sta in **`IMMOBILE_SENZA_VIA`**, una costante sola
    in `queries.ts`, usata sia da `countPropertiesWithoutAddress` sia dal filtro
    dell'elenco. Se le due condizioni si scollegassero, il cruscotto direbbe un
    numero e l'elenco ne aprirebbe un altro — è la trappola dei conteggi che
    questo codice ha già pagato una volta. Vale sia per `NULL` (le schede
    vecchie) sia per una stringa di soli spazi.

    Il filtro passa anche all'**esportazione CSV**, perché `listAllProperties`
    usa lo stesso `propertyWhere`.

    Verificato in browser con **due utenti** sullo stesso archivio (7 immobili a
    testa, 3 senza via l'uno e 5 l'altro): 19 controlli, compreso che nessuno dei
    due veda mai il totale dell'archivio (8), che l'esportazione non porti fuori
    niente del collega, e che avviso e voce spariscano quando gli indirizzi
    vengono completati. Messo in esercizio e **confermato da lui sul gestionale
    vero**: *«ora vedo la voce nel cruscotto»*.

16. **«Cosa cerca» rifatto** (28 agosto 2026), su richiesta sua: tipologie
    multiple, comuni con le loro zone e ripetibili, stato dell'immobile.

    - **Tipologia**: la colonna `kind` di `requirements` e' diventata un csv.
      Non serviva una colonna nuova ne' una conversione: un valore solo e' gia'
      un csv valido, e le richieste vecchie continuano a leggersi.
    - **Aree**: colonna nuova `areas`, json `[{comune, zone[]}]`, ed e' la
      verita'. `city` e `zones` restano scritte come **proiezione** — solo
      perche' la ricerca e il filtro per comune lavorano in SQL, dove il json
      non si interroga — e si scrivono in un punto solo, `saveRequirement`,
      per non ritrovarsi con due verita' che si allontanano. Si legge tutto da
      `leggiAree()` in **`src/lib/aree.ts`**, che quando `areas` e' vuoto ricade
      sui due campi vecchi: per questo l'archivio non e' stato convertito.
    - **Stato**: colonna nuova `conditions` (csv), e `PROPERTY_CONDITIONS`
      passata da 4 a 7 voci. La lista e' **la stessa** per richiesta e immobile,
      altrimenti non si confrontano. «Buono stato» → «Buono» sugli immobili
      esistenti, con `allineaStatiImmobili` in `db.ts`, idempotente come
      `assegnaTitolareMancante`.
    - **Nel motore**: il comune esclude se l'immobile non e' in **nessuno** di
      quelli chiesti; la tipologia esclude solo se nessuna delle famiglie
      chieste e' quella dell'immobile **e** si riconoscono tutte; zona e stato
      **pesano e non escludono**. Zone vuote per un comune = tutto il comune, e
      in quel caso la zona non viene nemmeno contata come criterio: contarla
      sempre soddisfatta gonfierebbe il punteggio di ogni immobile allo stesso
      modo. Sta in `zoneApplicabili()`.
    - Le due query degli **incroci fra colleghi** hanno le colonne scritte a
      mano: `p.condition`, `r.areas` e `r.conditions` sono state aggiunte li'
      dentro. TypeScript non se ne sarebbe accorto — quegli oggetti si
      costruiscono con un cast — e gli incroci coi colleghi avrebbero ignorato
      in silenzio tutte le aree oltre alla prima.

    Verificato in browser con due utenti, su uno scenario costruito perche'
    ogni regola avesse il suo caso: 25 controlli, compresi l'immobile in un
    comune non chiesto (escluso), il negozio a chi cerca casa (escluso), la
    zona sbagliata e lo stato sbagliato (proposti lo stesso, con l'avvertenza),
    «tutto il comune» che non conta la zona come criterio, una richiesta vecchia
    senza `areas` che incrocia ancora, e il muro fra collaboratori intatto.

    **Trappola da non ripetere nelle prove:** la scheda cliente ha **sette**
    pulsanti di invio, e negli **Incroci** gli immobili si riconoscono dalla
    **via**, non dal titolo. La prima versione della prova cliccava il pulsante
    sbagliato e cercava i titoli: dodici controlli rossi, tutti colpa della
    prova e non del codice.

17. **Il video dell'immobile** (31 agosto 2026). Nato da una richiesta arrivata
    da un'altra chat, per un'altra applicazione — quella che gestisce il canale
    YouTube — che aveva bisogno di sapere quali immobili hanno un video e di
    agganciare ogni video al suo immobile.

    La richiesta cosi' com'era arrivata **non riguardava questo programma**:
    parlava del repository `camillobarone/mondo-sito`, di cartelle `app/` e
    `views/` e di rotte `/gestionale/immobili/{id}`, che qui non esistono. E'
    stata rifiutata per la regola del capitolo 0, e ricostruita da capo dopo
    aver chiesto a lui cosa serviva davvero. Il pezzo mancante non era
    l'esportazione — c'era gia' — ma il **legame fra immobile e video**.

    - Colonna nuova `properties.video_url`, campo **Video su YouTube** sulla
      scheda, collegamento cliccabile sulla scheda dell'immobile.
    - Due colonne nel CSV: **Video YouTube** (il collegamento come e' stato
      scritto) e **ID video** (il codice ricavato da li'). Due e non una: il
      collegamento serve a chi lo clicca, il codice a un programma che deve
      accoppiare video e immobile senza indovinare dal titolo.
      `idVideoYouTube()` in **`src/lib/video.ts`** regge `watch?v=`, `youtu.be`,
      `shorts`, `embed`, `live`, con o senza i parametri del pulsante
      *Condividi*, e restituisce `null` invece di inventare.
    - Voce **«immobili in vendita senza un video»** nel riquadro *Da sistemare*,
      con `IMMOBILE_SENZA_VIDEO` scritta una volta sola come per la via. Conta
      solo i proponibili: un numero che comprende i venduti non scende mai, e
      un numero che non scende si smette di guardare.
    - **I dati escono a mano.** Scelta sua fra il CSV scaricato e un indirizzo
      che l'altra applicazione interroga da sola: ha scelto il CSV, e il
      gestionale continua a non esporre niente verso l'esterno.

    Verificato: 25 casi sull'estrazione del codice (tutte le forme di link, piu'
    quello che va rifiutato) e 22 controlli in browser con due utenti, compresi
    il conteggio che esclude i venduti, il muro fra collaboratori, e il CSV
    riletto colonna per colonna — c'e' il video, non c'e' il prezzo minimo.

    **Due trappole pagate qui:**
    - **`pattern` in JSX non e' una stringa JavaScript.** Scritto
      `pattern="\\S+\\.\\S+"` diventa una barra rovesciata letterale, nessun
      valore risulta mai valido e **il modulo non si invia piu'**, in silenzio.
      Va scritto `pattern="\S+\.\S+"`. Se ne accorge solo una prova in browser:
      TypeScript e `next build` passano tutti e due.
    - **Un controllo del server che fallisce da' una pagina 500 senza
      spiegazioni**, e vale per tutto il programma — «Serve un titolo», «Serve
      l'indirizzo», non solo il video. Non c'e' nessun `error.tsx`, e in
      produzione React nasconde comunque il messaggio. Per questo il campo del
      video si difende **prima**, nel browser, col `pattern`: e' l'unico modo di
      dire cosa non va senza riscrivere tutti i moduli. Vedi capitolo 5.

18. **L'elenco immobili si apre sugli attivi** (1° settembre 2026), e la foto
    di copertina e' passata da 56x40 a **176x128 pixel**.

    - Filtro `gruppo` in `PropertyFilters`: `attivi` (predefinito), `altri`,
      `tutti`. La condizione sta in `IMMOBILE_ATTIVO`, scritta una volta sola,
      e sono gli stessi stati di `AVAILABLE_STATUSES`.
    - Tre schede in cima con i conteggi, che passano dallo **stesso**
      `propertyWhere` dell'elenco (`countPropertiesPerGruppo`): un numero che
      nascesse da un'altra condizione direbbe dodici mentre l'elenco ne apre
      undici.
    - Il gruppo viaggia in un campo nascosto dentro il modulo dei filtri: senza,
      premere «Filtra» riporterebbe di soppiatto agli attivi anche chi stava
      guardando i venduti, e la ricerca sembrerebbe non trovare piu' niente.
    - Le schede **spariscono** quando si sceglie uno stato preciso dalla
      tendina: sarebbero due comandi che dicono la stessa cosa, e uno dei due
      starebbe mentendo.
    - **I collegamenti del cruscotto hanno ora `gruppo=tutti` esplicito.** I
      loro conteggi (`senza proprietario`, `senza via`, `senza video`) guardano
      tutti gli stati: senza quel parametro il cruscotto avrebbe promesso nove
      righe e l'elenco ne avrebbe aperte cinque. E' la trappola dei conteggi,
      la terza volta che si presenta in questo programma.

    Verificato in browser con due utenti: 24 controlli, compresi i tre conteggi
    delle schede contro le righe che aprono davvero, il gruppo che sopravvive a
    «Filtra», l'esportazione che segue il gruppo, e il muro fra collaboratori.

    **Trappola nelle prove:** dopo un clic su un collegamento interno, Next
    cambia l'indirizzo **prima** di sostituire il contenuto. Leggere
    `textContent("body")` subito dopo restituisce un misto di pagina vecchia e
    nuova, e un controllo passa o fallisce a caso. Va letta la tabella
    (`allTextContents()` sulle righe) dopo `waitForLoadState("networkidle")`.
    Da tenere presente: l'elenco immobili mostra **titolo e codice**, non la
    via — cercare l'indirizzo li' dentro non trova niente.

19. **Comune, zona ed esterno sulla scheda immobile** (2 settembre 2026).

    - `LuogoImmobile` (`immobili/luogo-immobile.tsx`): comune dalle stesse liste
      della richiesta, poi la zona di quel comune. **Il valore gia' presente
      resta sempre fra le opzioni** anche quando non e' in elenco — i 53
      immobili hanno comune e zona scritti a mano, spesso come «LECCE (LE)», e
      una tendina che non li contenesse li scollegherebbe al primo salvataggio.
      Dove non conosciamo le zone di un comune si propongono quelle gia' usate
      in archivio (`knownZones`), che e' meglio di una tendina vuota.
    - **Esterno in csv**: `OUTDOOR_KINDS` in `types.ts`, caselle al posto della
      tendina. «Nessuno» tolto dal vocabolario — nessuna casella spuntata lo
      dice gia', e tenerlo avrebbe permesso «Nessuno» + «Giardino» insieme.
      `ripulisciEsterniVuoti` in `db.ts` converte le righe vecchie.
      In `matching.ts` l'esterno si legge ora con `fromCsv`, ignorando un
      eventuale «Nessuno» rimasto scritto.
    - `ComboField` in `components/ui.tsx` non e' piu' usata da nessuna pagina.
      Lasciata dov'e': e' un campo generico, non codice di questa funzione.

    Verificato in browser con due utenti: 23 controlli, compresi il valore fuori
    elenco che sopravvive a un salvataggio, la zona che si azzera cambiando
    comune, i due esterni salvati e riletti, e gli incroci che riconoscono
    ancora «Ha esterno».

    **Trappola nelle prove:** uno scenario puo' passare per il motivo sbagliato.
    Il primo tentativo metteva l'immobile con due esterni a Porto Cesareo mentre
    la richiesta cercava a Lecce: il comune lo escludeva prima ancora di
    guardare l'esterno, e il criterio da provare non veniva mai messo alla
    prova. La richiesta e' stata rifatta senza comune apposta.

20. **I messaggi di errore si leggono** (3 settembre 2026). Era l'ultima delle
    cose aperte che dipendessero solo da chi scrive il codice.

    Il problema, che valeva per tutto il programma da sempre: un controllo del
    server che rifiuta un salvataggio scriveva `throw`, e a programma
    pubblicato il testo di un errore **non esce dal server** — React lo
    nasconde per non lasciarsi sfuggire dettagli interni. A schermo restava
    una pagina bianca in inglese, senza dire cosa correggere, e tornando
    indietro il modulo era vuoto.

    - **Le azioni che rifiutano restituiscono il motivo invece di lanciarlo.**
      `saveClient` e `saveProperty` hanno ora la forma
      `(precedente, dati) => Promise<string | null>`. La convenzione sta
      scritta in cima a `actions.ts`, sopra le utilita'.
    - **`<ModuloConEsito>` e `<AvvisoModulo/>`** (`components/client.tsx`)
      sono l'altra meta': il primo e' un `<form>` con dentro `useActionState`,
      il secondo stampa il messaggio dove il modulo decide — **sopra i
      pulsanti**, dove sta l'occhio di chi ha appena cliccato Salva. In cima a
      un modulo lungo comparirebbe fuori schermo.
    - I campi passano come `children` e **restano componenti di server**:
      diventa di client il solo involucro. Il messaggio arriva a
      `AvvisoModulo` per contesto, che e' l'unica strada che attraversa dei
      figli renderizzati dal server senza toccarli uno per uno.
    - **Quattro schermate nuove**: `error.tsx` e `not-found.tsx`, una coppia
      dentro `(app)` (che tiene la navigazione al suo posto) e una fuori (per
      accesso, recupero e gli indirizzi che non esistono). Si appoggiano tutte
      a `PaginaMessaggio` in `ui.tsx`. La schermata di guasto mostra il
      **`digest`**, il codice con cui si ritrova l'errore vero nel registro
      del server — l'unica cosa utile che React lascia uscire.
    - I `throw` di `NEGATO` (il muro fra collaboratori) sono rimasti `throw`
      apposta: non sono rifiuti previsti ma tentativi di scavalcare il muro,
      non c'e' niente da spiegare a chi ci prova, e adesso sotto c'e' la rete.
    - `tornaConMotivo` della pagina **Utenti** e' rimasto com'era: quel modulo
      ha quattro campi e il rimando all'indirizzo ci sta. Con venticinque no.

    **La trappola vera, e non si vede nel codice:** React, quando l'azione di
    un modulo finisce, **svuota da solo i campi** — chiama `form.reset()`
    sull'elemento. Il messaggio compariva e insieme spariva tutto quello che
    c'era da correggere: la meta' peggiore del problema di partenza. Si ferma
    con `onReset={(e) => e.preventDefault()}` sul `<form>`, che e' una riga e
    va spiegata, altrimenti la prima persona che passa la toglie. Non se ne
    accorgono ne' `tsc` ne' `next build`: l'ha trovata la prova in browser.

    Verificato in browser **con la build di produzione**, non in sviluppo — e'
    li' che i messaggi sparivano, in sviluppo si vedeva tutto e sembrava a
    posto. Due utenti, 30 controlli: i quattro rifiuti letti a schermo, i campi
    (testo, note, etichette, caselle) intatti dopo ogni rifiuto sia in
    creazione sia in modifica, l'archivio non toccato, le quattro schermate
    nuove, e il muro intatto compreso l'attacco col numero di scheda cambiato
    nel campo nascosto.

    **Trappola nelle prove:** cercare `[role="alert"]` nella pagina trova
    `#__next-route-announcer__`, il riquadro invisibile con cui Next annuncia i
    cambi di pagina ai lettori di schermo, che ha `role="alert"` pure lui ed e'
    sempre vuoto. Va cercato **dentro il modulo**. E come al solito, dopo un
    invio non si legge subito: si aspetta la comparsa del messaggio o il cambio
    di indirizzo, mai `networkidle` da solo.

21. **Mondo Tracking** (4 settembre 2026), sei passi in una giornata: la pagina
    `/tracking/[token]` che il proprietario apre dal telefono senza password, la
    rotta delle foto agganciata alla chiave, il riquadro sulla scheda
    dell'immobile per creare e mandare il link, il registro di garanzia coi
    collegamenti agli annunci e il richiamo per quelli rimasti online dopo il
    rogito.

    E' la **prima pagina di questo programma raggiungibile senza accesso**, ed
    e' il motivo per cui e' scritta come e' scritta. Il racconto per esteso —
    cosa e' stato deciso, cosa e' stato rifiutato della proposta arrivata da
    un'altra chat, e le trappole pagate per strada — sta nel capitolo 5, sotto
    «I due progetti nuovi». Messa in esercizio e **confermata da lui sul
    gestionale vero**: *«fatto tutto ok»*.

22. **La zona diversa non e' piu' un'avvertenza** (9 settembre 2026, fatto da
    un'altra finestra su questo stesso progetto). Negli **Incroci** un immobile
    in una zona diversa da quelle cercate finiva fra le avvertenze in ambra,
    come se avesse un difetto. In una citta' come Lecce il cliente scrive due
    quartieri e ne visita quattro: la zona diversa e' contesto per chi telefona,
    non un motivo di scarto.

    - `Match` ha un terzo elenco accanto a `reasons` e `warnings`: **`notes`**,
      «ne' pro ne' contro». Al posto dell'avvertenza ci va *«Cercava in zona:
      …»*, e solo quando la richiesta le zone le specifica.
    - **Il punteggio non cambia**: la zona continua a pesare sul ranking e sul
      filtro «solo corrispondenze piene». E' cambiato come si racconta, non come
      si decide.
    - Prima, un immobile **senza zona in scheda** dava *«Fuori dalle zone
      richieste (zona non indicata)»*: un dato mancante presentato come
      differenza. Adesso l'avviso compare solo se una zona c'e' e non e' quella.
    - `notes` attraversa anche `incrociFraColleghi`, dove gli oggetti si
      costruiscono a mano campo per campo — se lo si dimentica li', la nota non
      compare e nessuno se ne accorge.

    **In esercizio dall'11 settembre**, insieme al resto.

23. **`npm run posta` sa parlare di Gmail** (11 settembre 2026). Non sblocca
    l'SMTP — quello aspetta una password che solo lui puo' generare — ma toglie
    di mezzo i tre modi di sbagliarla, che Google rifiuta tutti con lo stesso
    identico 535 e un messaggio che manda a cercare una password che non esiste.

    - **La password normale di Gmail**: il ramo `EAUTH` si sdoppia. Con un host
      che finisce per `gmail.com` il messaggio dice che serve una *password per
      le app*, da dove si genera, e che la pagina non si apre senza la verifica
      in due passaggi. Per tutti gli altri fornitori il testo di prima e'
      rimasto identico: li' «la password della casella, non quella del
      pannello» e' ancora il consiglio giusto.
    - **La password incollata con gli spazi**: si rifiuta **prima di
      connettersi**. Dal server tornerebbe lo stesso 535 di una password
      sbagliata, e da qui invece si sa dire *cosa* correggere. Un avviso piu'
      morbido (⚠, e si prova lo stesso) quando non ha la forma delle 16 lettere
      minuscole: la forma potrebbe cambiare, e la parola definitiva la dice il
      server.
    - **La riga che si spezza**, che e' il caso peggiore perche' si traveste da
      un altro: `SMTP_PASS=abcd efgh ijkl mnop` letta dalla shell non arriva, e
      il messaggio era «manca SMTP_PASS» a chi la password l'aveva appena
      scritta. Adesso «manca SMTP_PASS» porta con se' la spiegazione. Peggio
      ancora, **systemd quella riga la legge in un altro modo** (tutta, spazi
      compresi): la prova e il servizio direbbero due cose diverse. Sta fra le
      trappole del capitolo 6.
    - Con Gmail `SMTP_FROM` deve essere **uguale** a `SMTP_USER` — Google
      spedisce solo per conto dell'account con cui si e' entrati — e anche
      `EENVELOPE` adesso lo dice.
    - Aggiornato il commento in `deploy/servizi.sh` con l'esempio Gmail:
      l'esempio che c'era rimandava alla strada abbandonata. Il file
      `/etc/mondo-crm.env` **non viene toccato** — `scrivi_posta` esce subito se
      esiste — quindi vale solo per un'installazione da zero.

    **Come e' stato provato, visto che da qui a Gmail non si arriva.** Due
    strade, e servono tutte e due: 23 controlli con un finto `nodemailer` messo
    in un `node_modules/` dello scratchpad (e' l'unico modo di accendere il ramo
    Gmail, che dipende da `SMTP_HOST`, senza toccare `/etc/hosts` — cosa che tra
    l'altro l'ambiente non permette), **piu'** due passaggi con il nodemailer
    vero contro un finto server SMTP su `127.0.0.1`, per essere sicuri che il
    sostituto non stesse nascondendo niente. Il file provato viene **copiato dal
    vero a ogni corsa**, mai ricopiato a mano. Prove rifatte due volte di fila:
    23 verdi, 0 rossi.

    **Trappola nelle prove, la stessa di sempre:** i primi due rossi erano
    colpa della prova — `--manda` finiva dentro `env` come se fosse il nome di
    una variabile. Nel dubbio si guarda prima la prova.

24. **La sveglia sul calendario: detta dove si legge** (11 settembre 2026). Sua
    domanda: *«l'invio di un allarme trenta minuti prima dell'appuntamento
    stabilito, si puo' inserire?»*, dopo aver scelto di usare l'agenda dentro
    Google Calendar.

    **Non c'era niente da inserire: la sveglia c'e' da sempre.** Ogni evento
    esce con `VALARM` / `TRIGGER:-PT30M`, sia nel file del singolo appuntamento
    sia nell'abbonamento (`src/lib/calendar.ts`). E' **Google** che la butta
    via: per i calendari a cui ci si abbona non avvisa mai, e non lo si puo'
    nemmeno impostare — non offre la voce. Apple e Outlook la fanno suonare.

    Il difetto vero era un altro, ed era di documentazione: **la pagina del
    programma non lo diceva**. Stava in `README.md` e in `CONSEGNA.md`, cioe'
    ovunque tranne che in *Agenda → Calendario e avvisi*, dove il titolo
    promette «con l'avviso 30 minuti prima» e sotto ci sono le istruzioni per
    Google. Adesso il riquadro ambra ne racconta **due** di cose (la sveglia che
    non suona, e il ritardo con cui Google si aggiorna), sotto le istruzioni di
    Google c'e' la riga che avvisa, e sotto quelle dell'iPhone che li' invece
    suona davvero.

    **Trovato per strada, ed e' un difetto vero:** su questa pagina si leggeva
    **«30minuti»** attaccato, nel riquadro dell'avviso per email, da prima di
    oggi. E' la trappola dello spazio dopo `{espressione}` che va a capo, ora
    scritta nel capitolo 6. Una passata su tutti i `.tsx` ha trovato **un solo
    altro punto** con la stessa forma — `luogo-immobile.tsx`, che diceva «Per
    Tuglienon abbiamo un elenco di zone» — corretto anche quello. Tutti gli
    altri riscontri della ricerca erano stringhe con template literal, dove la
    regola di JSX non c'entra.

    Verificato in browser sulla **build di produzione**, a schermo di telefono
    (390x844): 21 controlli sulla pagina del calendario (compreso che non sia
    sparito niente di quello che c'era prima) e 6 sui due spazi, rifatti due
    volte di fila. Piu' il file dell'abbonamento chiesto **senza cookie**, come
    fa Google, per rileggerci dentro `TRIGGER:-PT30M`.

    **Trappola nelle prove, e ha fatto perdere due giri:** `next start` non era
    ripartito — `EADDRINUSE` finito solo nel registro — e le prove stavano
    leggendo **la build vecchia**. Due controlli davano rosso su una correzione
    che era gia' giusta. Dopo aver rilanciato il server si guarda che sia
    partito davvero, non che risponda: a rispondere era quello di prima.

25. **Gli avvisi sul telefono** (11 settembre 2026). Scelto da lui fra quattro
    strade, dopo aver detto che in agenzia usano **iPhone, Samsung e Xiaomi**:
    con tre marche diverse, il calendario in abbonamento non risolve — Apple la
    sveglia la fa suonare, Google no, e su Android i calendari esterni spesso
    non compaiono nemmeno. La posta l'avrebbe risolto per tutti e tre, ma e'
    ferma per sua decisione (punto 23).

    Trenta minuti prima di ogni appuntamento arriva una notifica sul telefono,
    a programma chiuso. **Niente da configurare sul server**, ed e' il punto: e'
    la ragione per cui e' stato scelto questo e non l'SMTP.

    **`src/lib/push.ts` — il protocollo scritto a mano.** Cifratura del
    messaggio (RFC 8291), formato `aes128gcm` (RFC 8188), firma VAPID
    (RFC 8292), tutto su `node:crypto`. Niente dipendenze nuove, come il lettore
    Excel e il generatore iCalendar.

    **Come e' stato verificato, ed e' l'unica cosa che conta qui:** la
    crittografia e' stata confrontata **byte per byte con `web-push`**, la
    libreria che usano tutti, installata nello scratchpad **come pietra di
    paragone e non come dipendenza**. Quattro messaggi diversi — corto, json,
    con gli accenti, da 3000 caratteri — stesse chiavi, stesso sale, byte
    identici. Se un giorno quel file va toccato, **rifare quel confronto**: e'
    l'unico modo serio di sapere che funziona ancora, perche' un errore di
    crittografia non da' errore. Il servizio di consegna risponde 400 e basta.

    Le tre cose che si sbagliano e che qui sono scritte apposta:
    - **`aud` e' la sola origine dell'endpoint**, non l'endpoint intero. Con
      l'endpoint intero si prende 401 e sembra un problema di chiavi.
    - **La firma va in forma `r||s`**, 64 byte netti (`dsaEncoding:
      "ieee-p1363"`). Quella predefinita di Node e' DER e viene rifiutata.
    - **Lo zero in fondo alle stringhe** `"WebPush: info\0"` e
      `"Content-Encoding: aes128gcm\0"` e' un terminatore, non decorazione:
      toglierlo cambia tutte le chiavi senza dare errore.

    **Le chiavi VAPID si generano da sole** alla prima apertura della pagina e
    stanno in una tabella `settings` nell'archivio, non in un file sul server.
    E' una scelta, non una scorciatoia: questo progetto si e' gia' fermato una
    volta su una riga da compilare in `nano`, e un avviso che non parte finche'
    qualcuno non apre un file e' un avviso che non parte. **Il cron pero' non le
    genera** — legge e basta: due processi che si svegliassero insieme a tabella
    vuota ne creerebbero due coppie diverse, e meta' dei telefoni resterebbe
    legata a quella persa. Se mancano e ci sono iscritti, lo dice nel registro.

    **`pushed_at` e' separata da `reminded_at`.** Con una colonna sola,
    accendere la posta spegnerebbe in silenzio le notifiche. E il cron **non
    esce piu' se manca l'SMTP**: era un'uscita anticipata, e avrebbe tenuto
    ferme anche queste.

    Il resto: `push_subscriptions` (un telefono per riga, `endpoint` unico —
    lo stesso telefono lo ripropone uguale a ogni visita e senza `ON CONFLICT`
    si accumulerebbe una riga per apertura); `public/sw.js`, che **non fa
    cache** di proposito; `public/manifest.json` e le icone, generate con
    `sharp` invece di mettere dei binari nel repository. 404 e 410 sono gli
    unici stati che cancellano l'iscrizione: su tutto il resto si riprova.

    **Il muro.** La notifica passa dalla stessa query mascherata dell'email: il
    nome del cliente esce solo se `clients.owner_id` e' di chi riceve. Nel
    messaggio non c'e' **mai** il numero di telefono, e il collegamento porta
    all'**agenda** e non alla scheda — quella di un collega darebbe «non
    trovata».

    **iPhone: senza aggiungerlo alla schermata Home non funziona**, ed e' Apple
    a volerlo. Il pacchetto degli avvisi in Safari non c'e' proprio, quindi la
    pagina riconosce il caso e dice cosa fare invece di dire «non si puo'».

    Verificato: **82 controlli**, tutti rifatti almeno due volte di fila.
    11 sulla cifratura contro `web-push`, 24 sulla firma e sugli stati di
    errore, 20 sul giro completo (appuntamento → cron → consegna a un finto
    servizio → **messaggio riaperto e riletto**, compreso il nome del collega
    che non esce), 27 in browser sulla pagina.

    **Quello che da qui NON si verifica, e va detto:** l'ultimo metro. A Google
    e ad Apple la rete non arriva, quindi che la notifica **compaia davvero su
    un telefono vero** lo puo' dire solo lui, col pulsante *Mandami una prova*.
    E' la stessa situazione dell'SMTP.

    **Quattro trappole pagate nelle prove**, tutte «rosso che sembrava del
    codice»:
    - `execFileSync` **blocca il ciclo di eventi**, e il finto servizio di
      consegna girava nello stesso processo: il cron chiamava e non rispondeva
      nessuno. Stallo, non guasto.
    - `due_at` scritto nell'ora del container (UTC) mentre il cron gira con
      `TZ=Europe/Rome`: due ore di scarto e il filtro lo scartava. E' la
      trappola del fuso del capitolo 6, ripresentata.
    - `SELECT id FROM users LIMIT 1` **senza `ORDER BY`** ha restituito il
      collega: le due schede finivano allo stesso proprietario e **il muro non
      veniva provato affatto**. Adesso la prova si ferma da sola se i due id
      coincidono.
    - la prova delle chiavi non si rimetteva a posto, e alla seconda corsa le
      trovava gia' create.

    E una nel codice, la stessa del punto 24 e commessa **un'ora dopo averla
    scritta**: lo spazio dopo `{PREAVVISO_MINUTI}` sparito nel riquadro nuovo,
    «30minuti». L'ha presa la prova in browser.

26. **«Lecce» non e' piu' «Monteroni di Lecce»** (12 settembre 2026). Sua
    segnalazione: nel riquadro *«immobili da valutare»* della scheda cliente
    arrivavano immobili di comuni diversi da quelli chiesti.

    La causa: il confronto fra comuni passava da **`samePlace`**, che considera
    uguali due luoghi quando **uno contiene l'altro**. Per le zone e' proprio
    quello che serve — «Centro» dentro «Centro storico» — ma fra i comuni
    «Lecce» sta dentro *Monteroni di Lecce*, *San Cesario di Lecce*,
    *Caprarica di Lecce*, *Castri' di Lecce*, *Minervino di Lecce*,
    *San Donato di Lecce* e perfino *Muro Leccese*. Sui 96 comuni in elenco gli
    accostamenti sbagliati erano **otto**, e **sette riguardavano Lecce**: cioe'
    il comune dove l'agenzia lavora di piu'. L'ottavo era
    *Corigliano d'Otranto* ~ *Otranto*.

    - **`sameComune`** in `matching.ts`, separata da `samePlace` e non
      intercambiabile. Le quattro letture del comune (l'esclusione, il
      punteggio, `zoneApplicabili` e `explain`) sono passate alla nuova; le due
      delle zone sono rimaste dov'erano.
    - Le due scritture che vanno tollerate lo stesso, perche' i comuni in
      archivio sono battuti a mano: **la provincia in coda** («LECCE (LE)» =
      «Lecce», ed e' la forma di buona parte del portafoglio) e **il nome
      accorciato**, ma solo quando e' l'*inizio* e finisce su una parola intera
      («Monteroni» = «Monteroni di Lecce»). E' l'unica direzione sicura: nessun
      altro comune **comincia** per «Monteroni», mentre a **finire** per
      «Lecce» sono in sei. Il confronto per contenimento sbagliava proprio
      perche' non distingueva le due direzioni.
    - **L'immobile senza comune in scheda resta proposto**, e non e' una
      dimenticanza: non e' in un comune diverso, e' in un comune che non
      sappiamo, e `explain` lo dice gia' con «Comune non indicato
      sull'immobile». Escluderlo avrebbe nascosto le schede vecchie a tutte le
      richieste in una volta sola. Ora c'e' scritto il perche', accanto al
      controllo.

    Non e' servita nessuna colonna nuova ne' nessuna conversione: e' cambiato
    solo il confronto. Vale insieme per la scheda cliente, gli **Incroci** e
    gli **incroci fra colleghi**, che passano tutti da `evaluate`.

    Verificato in due modi. **4.894 controlli** sulla regola, con le funzioni
    **estratte dal file vero** e non ricopiate: tutte le 4.560 coppie di comuni
    diversi dell'elenco (nessuna confusa), ogni comune contro se stesso con e
    senza la provincia, gli otto accostamenti che prima passavano, le scritture
    che devono continuare a valere, e le zone che devono continuare a tollerare
    il contenimento. Poi **18 controlli in browser** sulla build di produzione,
    con due utenti: la richiesta a Lecce che non riceve piu' i cinque comuni
    omonimi ma riceve «LECCE (LE)», «Lecce» e quello senza comune; il conteggio
    che dice tre e ne apre tre; la **direzione opposta** (chi cerca a Monteroni
    non riceve Lecce); e il muro fra collaboratori. Rifatti due volte di fila.

    **Trappola nelle prove, ed e' nuova:** la scheda cliente ha anche le tendine
    per proporre un immobile, e quelle **elencano tutto il portafoglio**.
    Leggendo `textContent("body")` ogni immobile risulta proposto: sei controlli
    rossi su un codice gia' giusto, smentiti dal conteggio della pagina che
    diceva il numero esatto. Si legge **il solo riquadro**, non il corpo. Come
    sempre: nel dubbio si guarda prima la prova.

27. **Un calendario per persona, e il titolare li raccoglie** (12 settembre
    2026). Sua richiesta: aggiungere «Roberto Lefons» e «Alessandro Ciullo» fra
    i profili a cui si assegna un'attivita', e avere per ognuno un calendario
    da mettere in Google Calendar, separato dagli altri.

    **La prima meta' non e' stata scritta, perche' c'era gia'** — e vale la
    pena dirlo, perche' la tentazione era costruire un secondo meccanismo
    accanto a quello che gia' funzionava. La tendina «assegnata a» elenca gli
    **utenti** (`activeUserOptions`), e ogni utente ha di suo un feed
    `/calendario/<chiave>.ics` filtrato su `a.user_id`. Quindi creare i due
    profili come utenti bastava per i punti 1, 2 e 3 della richiesta.
    Verificato prima di rispondere, non dedotto: **32 controlli in browser** su
    un archivio con tre profili e un appuntamento a testa — i tre `.ics`
    separati, ciascuno col solo proprio appuntamento e la sveglia a -30
    minuti, la chiave inventata che da' 404, e Roberto che vede l'attivita' ma
    non il nome del cliente di Camillo.

    **Quello che mancava davvero era un solo pezzo**, e non si sarebbe visto
    senza chiederglielo: il link `.ics` lo vede **solo chi ha fatto l'accesso**,
    sulla propria pagina. Camillo quelli dei collaboratori non li poteva
    prendere. Gli sono state messe davanti le tre strade (li prende lui / se li
    prendono loro / sono solo etichette e non entrano mai) e **ha scelto la
    prima**: li mette tutti nel proprio Google, uno per colore.

    - **Riquadro «I calendari delle persone»** in fondo alla pagina Utenti, che
      e' gia' `requireOwner`. `calendariDellePersone` in `queries.ts`,
      `creaCalendarioDi` e `rigeneraCalendarioDi` in `actions.ts`,
      `utenti/calendari.tsx` per la parte di client.
    - **E' un'apertura voluta nel muro fra collaboratori**, la quarta del
      programma dopo gli incroci fra colleghi e la pagina del proprietario, e
      va trattata come quelle: colonne scritte a mano una per una — un
      `SELECT *` su `users` porterebbe li' dentro l'impronta della password e
      il biglietto di recupero — e il perche' scritto sopra la funzione, non
      nel commit.
    - **La chiave non si genera da sola.** `calendarToken` la crea quando
      manca, ed e' giusto sulla pagina di chi la sta guardando; qui no. La
      pagina Utenti elenca tutti, e generarle all'apertura vorrebbe dire aprire
      una porta per ognuno solo passando di li'. Per questo c'e'
      **`calendarioDi`**, che legge e basta, e ogni riga parte da un pulsante
      *Crea il calendario* — lo stesso stampo del link del proprietario.
    - **Ogni creazione e ogni rigenerazione finiscono nel registro accessi**,
      col nome di chi l'ha chiesta e di chi riguarda. E' l'unico modo di
      accorgersi, dopo, che un link e' stato preso.
    - `creaCalendarioDi` **non fa niente se la chiave c'e' gia'**: premuto due
      volte, il pulsante non deve spegnere un calendario che qualcuno ha appena
      collegato. Chi vuole cambiarla passa dall'altro pulsante, che lo dice.
    - `rigeneraCalendario` (la propria) e `rigeneraCalendarioDi` (di un altro)
      restano **due azioni separate**: la prima non chiede il titolare, la
      seconda si'. Fonderle avrebbe voluto dire un solo controllo per due casi
      diversi, che e' il modo in cui i controlli si perdono.

    Verificato in browser sulla build di produzione: **35 controlli**, piu' i
    32 di prima rifatti. Fra gli altri: il collaboratore che sulla pagina
    Utenti viene rimandato via; nessuna chiave creata dalla sola apertura della
    pagina; i tre link creati uno per volta e i tre `.ics` che restano
    separati; il pulsante premuto due volte che non cambia niente; la chiave
    rigenerata che spegne la vecchia (404) e conserva gli appuntamenti; le due
    righe nel registro accessi; e la pagina di Roberto che mostra **la chiave
    rigenerata dal titolare** e da nessuna parte quella di Camillo.

    **Due trappole nelle prove, tutte e due gia' scritte qui e ripagate lo
    stesso:**
    - il link sta dentro un `<input readOnly>` (`CopyField`), e
      `textContent` non lo vede: tre rossi su un codice giusto. Si legge
      `inputValue`, non il testo della pagina. Sorella della trappola dei
      `<select>`, che nella prova del punto 26 elencavano tutto il portafoglio.
    - la prova **sporcava l'archivio** creando chiavi, e alla seconda corsa il
      passo «nessun indirizzo prima di crearlo» falliva da solo. Adesso azzera
      `calendar_token` all'inizio. **E due prove non si lanciano insieme sullo
      stesso archivio:** una corsa in parallelo ha dato un rosso finto proprio
      perche' l'altra le azzerava le chiavi sotto.

    **Quello che da qui NON si verifica:** che Google digerisca i tre indirizzi.
    La rete verso l'esterno e' chiusa. Il file e' lo stesso di sempre, quello
    del suo calendario che gia' funziona, quindi non c'e' motivo di dubitarne —
    ma la conferma la puo' dare solo lui.

    **Da fare a lui, ed e' il pezzo che resta:** creare i due utenti da
    *Utenti → Nuovo utente*. Da qui non si arriva all'archivio di produzione.

28. **Google Calendar collegato davvero** (15 settembre 2026). Sua
    segnalazione, dopo aver provato l'abbonamento col calendario di Roberto:
    *«non funziona, bisogna sempre eliminare il calendario da Google e
    riattivare per vedere gli aggiornamenti»*.

    **La prima cosa fatta e' stata verificare da che parte stava il difetto.**
    Il feed cambia **all'istante** — 8 controlli: l'orario spostato, un
    appuntamento aggiunto, uno cancellato, tutti visibili alla richiesta
    successiva — e il file chiede gia' `REFRESH-INTERVAL:PT15M` e
    `X-PUBLISHED-TTL:PT15M`, con `Cache-Control: private, no-store` e nessun
    `ETag`. Dalla nostra parte non c'era niente da correggere: **Google
    ricontrolla i calendari in abbonamento quando decide lui e ignora quelle
    richieste**, e togliere-e-rimettere forza una lettura, che e' esattamente
    quello che lui aveva osservato.

    Gli sono state messe davanti tre strade — una pagina «Agenda di tutti»
    dentro il gestionale, collegare Google sul serio, o tenersi cosi' — e ha
    scelto la seconda, **sapendo che costa un progetto su Google Cloud**: la
    domanda glielo diceva.

    - **`src/lib/google.ts`** — OAuth e chiamate al calendario scritte a mano
      su `fetch` e `node:crypto`. Niente `googleapis`: qualche centinaio di
      pacchetti per quattro chiamate HTTP. Stessa scelta del lettore Excel,
      del generatore iCalendar e del protocollo Web Push.
    - **`src/lib/google-sync.ts`** — il ponte. Sta in un file suo per una
      ragione sola: **da li' non si lancia mai un errore verso chi salva.**
      L'appuntamento si salva sempre; in Google ci arriva subito se si puo', al
      giro dopo se no.
    - **L'ambito e' `calendar.app.created`, non `calendar`.** Il gestionale
      crea calendari suoi e gestisce quelli, e **non puo' toccare il calendario
      personale di chi autorizza**. Se un giorno Google lo rifiutasse, la riga
      da cambiare e' una sola — ma allora si concede molto di piu' e va detto
      a voce, non cambiato in silenzio.
    - **Client id e segreto si incollano in una pagina**, non in
      `/etc/mondo-crm.env`. Stessa ragione delle chiavi VAPID: questo progetto
      si e' gia' fermato una volta su una riga da scrivere in `nano`.
    - **Una sola autorizzazione, la sua**, e dentro il suo Google un calendario
      per persona. Tre autorizzazioni sarebbero stati tre giri di schermate, e
      i collaboratori un account Google non e' detto che lo vogliano.

    **Le cose che, sbagliate, si rompono in silenzio** — e sono tutte provate:
    - **`access_type=offline` e `prompt=consent`.** Senza il primo Google manda
      solo un permesso da un'ora; senza il secondo, alla **seconda**
      autorizzazione non manda nessun `refresh_token` e resta una schermata che
      dice «fatto» su un collegamento morto.
    - **Il fuso.** `new Date("2026-09-20T16:30:00")` si legge come ora locale e
      `toISOString()` la riscrive in UTC: sul server, che gira con
      `TZ=Europe/Rome`, **ogni appuntamento sarebbe finito in Google spostato di
      due ore**. I conti si fanno in UTC su numeri senza fuso (`piuMinuti`), e
      il fuso viaggia nel campo `timeZone` accanto all'orario, come `TZID` nei
      file iCalendar. E' la terza volta che questa trappola si presenta.
    - **`reminders.overrides: []` vuol dire «nessuna sveglia»; `minutes: 0`
      vuol dire «suona adesso».** Sugli appuntamenti gia' fatti serve il primo.
      Scritto sbagliato al primo giro e corretto prima di provare.
    - **Il muro.** Il mascheramento dei nomi usa l'id di **chi ha
      l'appuntamento assegnato**, non di chi salva: nel calendario di Roberto
      il cliente di Camillo non ha nome, come nel suo feed iCalendar.

    **Come e' stato verificato, ed e' l'unica cosa che conta qui.** A Google la
    rete non arriva, quindi e' stato scritto **un finto Google** che risponde
    come dice la documentazione (consenso, token, rinnovo, creazione
    calendario, eventi, e i guasti su richiesta), e il codice vero ci e' stato
    puntato contro con `GOOGLE_FINTO_BASE` — una variabile che **esiste solo
    per le prove**, e che in esercizio non si imposta. **49 controlli in
    browser sulla build di produzione**, rifatti due volte di fila: il giro
    completo dal pannello vuoto all'appuntamento dentro Google, i tre parametri
    del consenso, lo `state` inventato che non collega niente, l'orario e il
    fuso letti dentro l'evento, l'appuntamento spostato che fa una modifica e
    non un doppione, la sveglia che sparisce su quello fatto, il permesso breve
    che si rinnova una volta sola, **Google giu' che non impedisce il
    salvataggio**, la risincronizzazione che recupera, la cancellazione che
    arriva anche di la', il permesso revocato che si racconta, e lo
    scollegamento che non lascia agganci morti.

    **Collegato davvero il 15 settembre**, seguendo i passi con lui una
    schermata per messaggio: chiavi salvate, consenso dato, *«Google e'
    collegato»*. Quindi **Google vero accetta tutto quello che il finto Google
    faceva credere** — l'ambito `calendar.app.created` compreso, che era la cosa
    su cui avevo meno certezze.

    **Due cose che la guida non diceva, e adesso le dice.** Il capitolo 10-ter
    di `CONSEGNA.md` era scritto su sei passi e la realta' ne ha chiesti otto:
    - **Branding va compilato prima**, altrimenti al momento di pubblicare
      Google risponde *«Per pubblicare l'app, devi completare la configurazione
      nella pagina Branding»*. Vuole home page, informativa privacy e **dominio
      autorizzato scritto nudo** (`mondoimmobiliarelecce.it`, senza `https://`
      ne' `www.`). L'informativa e'
      `www.mondoimmobiliarelecce.it/informativa-sulla-privacy-e-sulluso-dei-dati-di-mondo-immobiliare/`.
    - **La console e' cambiata**: non c'e' piu' «Schermata consenso OAuth» con
      il modulo lungo, c'e' **Google Auth Platform** con *Panoramica, Branding,
      Pubblico, Client, Accesso ai dati*. Le credenziali si creano da **Client**,
      non da *API e servizi → Credenziali*.

    **E una mia leggerezza, detta perche' non si ripeta:** gli avevo indicato un
    pulsante «Google Calendar» in cima alla pagina Utenti che **non esiste** —
    il collegamento l'avevo messo dentro l'ultimo paragrafo del riquadro dei
    calendari. Prima di dire dove cliccare, si guarda il proprio codice.

    **Tre trappole nelle prove, tutte «rosso che sembrava del codice»:**
    - dopo l'invio, `networkidle` torna **prima** che l'azione di server abbia
      finito: la prova leggeva il finto Google un attimo troppo presto e dava
      rosso su un evento che poi arrivava. Si aspetta guardando **l'archivio**,
      non la pagina.
    - l'appuntamento era stato creato **senza cliente**, quindi per Camillo non
      era ne' suo ne' su una sua scheda: la pagina di modifica giustamente non
      si apriva, **e il controllo sul nome del cliente non provava niente**.
      Era il muro che funzionava.
    - l'agenda si apre su «Solo assegnate a me», e l'appuntamento era di
      Roberto: cercarlo li' e' cercarlo dove non deve essere.

    **Da fare a lui:** i sei passi su Google Cloud, scritti nel capitolo
    **10-ter di `CONSEGNA.md`**. Il quarto — *Pubblica app* — non e'
    facoltativo: in stato «Test» Google fa scadere il permesso **ogni sette
    giorni**.

    **Attenzione a non tenere tutte e due le strade insieme:** l'abbonamento
    `.ics` continua a funzionare, e collegandoli entrambi lo stesso
    appuntamento comparirebbe due volte.

29. **«Collegato con l'account …»** (16 settembre 2026). Il giorno dopo aver
    collegato Google, i calendari non si vedevano. Sono volute **due ore** per
    scoprire che c'erano — ma dentro `immobiliarelecce@gmail.com`, mentre lui
    guardava il calendario di `camillo.barone@gmail.com`.

    **Niente era rotto, e questo e' il punto.** Le tre spunte erano verdi,
    Google aveva accettato ogni scrittura e restituito gli identificativi degli
    eventi. Mancava una riga a schermo: **con quale account**. Il gestionale lo
    sapeva — aveva appena parlato con quell'account — e non lo diceva a nessuno.

    - Allo scopo si e' aggiunto **`openid email`**. Serve a quello e basta:
      leggere l'indirizzo dall'`id_token` che Google rimanda insieme ai token.
      Non da' nessun accesso alla posta.
    - **La firma dell'`id_token` non si verifica**, ed e' scritto perche' sopra
      `indirizzoDalBiglietto`: quel biglietto arriva dalla risposta di
      `oauth2.googleapis.com` a una chiamata nostra, su TLS, autenticata col
      nostro segreto — non passa da nessun browser. E soprattutto **serve solo
      a scrivere un indirizzo a schermo**, non decide nessun accesso. Se un
      giorno decidesse qualcosa, la firma va verificata.
    - L'indirizzo compare in **due punti** (il riquadro di stato e il testo del
      consenso) e finisce nel **registro accessi**: *«Google Calendar collegato
      con …»*. Si dimentica allo scollegamento, insieme al resto.

    **Due cose che avevo scritto sbagliate, corrette qui:**
    - la pagina e `CONSEGNA.md` dicevano che i calendari compaiono sotto
      **«Altri calendari»**. Falso: quella e' la sezione degli **abbonamenti**.
      I calendari creati dall'app sono **di proprieta'** di chi autorizza, e
      Google li mette sotto **«Le mie agende»**. Detto sbagliato, ha mandato a
      cercare nel posto sbagliato per mezza giornata;
    - gli avevo indicato un pulsante in cima alla pagina Utenti che non esiste
      (vedi punto 28).

    **La morale, che vale oltre questa funzione:** quando una cosa «non
    funziona» ma tutti i controlli interni sono verdi, la domanda giusta non e'
    «cosa si e' rotto» ma **«cosa sto guardando»**. E se il programma sa una
    cosa che servirebbe a rispondere, deve dirla senza che gliela si chieda.

    Verificato contro il finto Google: **14 controlli**, due corse di fila, con
    **due account diversi** per essere sicuri che l'indirizzo mostrato sia
    davvero quello con cui si e' collegati — compreso lo scollega-e-ricollega
    che cambia account, dopo il quale nessun utente resta agganciato a un
    calendario di prima. Piu' il giro completo del punto 28 rifatto (50) e la
    prova degli spazi (17).

    **Trappola nelle prove, la solita:** la prova del punto 28 confrontava
    l'ambito con l'**uguaglianza esatta**, e aggiungendo `openid email` e'
    diventata rossa su un codice giusto. Adesso verifica le due cose che
    contano davvero: che ci sia `calendar.app.created`, e che **non** ci sia
    l'accesso pieno al calendario.

30. **«Crea adesso i calendari mancanti»** (16 settembre 2026). Sua richiesta:
    voleva il calendario «· Mondo» anche per Roberto e Alessandro, e me l'ha
    chiesto **passandomi i loro due indirizzi `.ics`** — cioe' confondendo
    ancora le due strade, che e' il segno che la pagina non le distingueva
    abbastanza.

    La causa vera non era una distrazione sua: il calendario di una persona
    nasce al **primo appuntamento assegnato a lei** (punto 28), e loro due non
    ne avevano. La scelta resta giusta per l'uso normale — nessuno vuole tre
    calendari vuoti fra i propri — ma **chi vuole prepararli prima, per dargli
    un colore in Google, non deve doversi inventare un appuntamento finto**.

    - `creaCalendariMancanti` in `google-sync.ts`, `personeSenzaCalendarioGoogle`
      in `queries.ts`, e un pulsante che li crea per tutte le persone attive.
      Uno per volta e non in parallelo: Google mette il freno.
    - Chi ce l'ha gia' viene saltato, e l'appuntamento che arriva dopo finisce
      nel calendario che c'e'.
    - Ogni creazione finisce nel registro accessi coi nomi.

    **Il difetto trovato mentre lo provavo, ed e' quello che vale la pena
    ricordare:** il riquadro compariva **solo quando mancavano dei calendari**.
    Premuto il pulsante, i calendari venivano creati, il riquadro non aveva
    piu' motivo di esistere e spariva — **portandosi via il messaggio che
    diceva «fatto»**, perche' il modulo che lo tiene veniva smontato insieme.
    Si premeva e non succedeva niente di visibile, che e' il modo migliore per
    far credere che un programma sia rotto. Adesso il riquadro c'e' sempre e
    cambia solo quello che dice dentro.

    **Regola generale, perche' non e' la prima volta:** il posto dove compare
    l'esito di un'azione non puo' dipendere da una condizione che quell'azione
    cambia. Se lo fa, il messaggio si vede solo quando l'azione fallisce —
    cioe' mai quando servirebbe di piu'.

    Verificato contro il finto Google: 15 controlli, due corse di fila, piu' le
    tre prove di prima rifatte (14, 50, 17).

31. **La copia fuori dal server era ferma da un mese** (17 settembre 2026). Sua
    domanda, apparentemente innocua: *«il database con tutti i nominativi dove
    fa il backup?»* — e la verifica ha trovato il guasto.

    **Come si presentava.** `rclone listremotes` lanciato da lui rispondeva
    `gdrive:`, quindi sembrava tutto collegato. Ma nel registro
    `backup/esterno.log` c'erano due righe sole: una copia riuscita il 14
    agosto alle 12:36, e poi il 1° settembre alle 3 di notte *«rclone non è
    ancora collegato a Google Drive: copia esterna saltata»*.

    **Il motivo.** Quella del 14 agosto era una prova lanciata **a mano, da
    root**, l'utente da cui `deploy/README.md` fa fare `rclone config`. Il cron
    invece girava come `mondo` (`0 3 1 * * mondo …`), e la configurazione di
    rclone sta in `/root/.config/rclone/rclone.conf`, che `mondo` non può
    leggere. Da lì `rclone listremotes` tornava vuoto e la copia si saltava —
    ogni volta, in silenzio. Trentaquattro giorni di archivio esistevano solo
    sul disco del server: il database era intanto passato da 452 a 606 KB.

    **La cosa peggiore non era il guasto, era che non si vedeva.** Il messaggio
    nel registro diceva «non è ancora collegato», che si legge come «non l'hai
    mai configurato» e non come «l'ho cercato dove non c'era». Il backup
    notturno locale funzionava perfettamente, quindi da fuori sembrava tutto a
    posto.

    **Rimesso in piedi sul server**, senza aspettare il 1° ottobre: copiata la
    configurazione in `/home/mondo/.config/rclone/`, poi lanciata la copia come
    farebbe il cron (`sudo -H -u mondo bash deploy/backup-esterno.sh` — senza
    `-H` la prova avrebbe letto la configurazione di root e sarebbe passata
    comunque, dicendo il falso). 40 secondi, database di stanotte su Drive e 84
    foto controllate.

    **Corretto nel repository**, perché una reinstallazione da zero
    ripeterebbe l'errore:
    - `deploy/backup-esterno.sh` cerca la configurazione per nome, in ordine —
      `RCLONE_CONFIG`, `/etc/mondo-crm-rclone.conf`, quella dell'utente che
      sta girando, quella di root — e quando non la trova **scrive nel registro
      dove ha guardato e con quale utente**, invece della frase generica.
    - Il cron della copia esterna gira ora **come root**, non come `mondo`:
      root è l'utente da cui la guida fa collegare rclone.
    - **Da mensile a settimanale** (`0 3 * * 0`, ogni domenica): in un mese
      l'archivio era cresciuto del 35%, e una copia al mese vuol dire fino a
      trenta giorni di inserimenti a rischio.
    - `deploy/README.md`: l'avvertenza di collegare rclone da root, come si
      legge il registro, e il `client_id` da crearsi.

    **Regola generale, e vale oltre questo caso:** un lavoro schedulato che
    gira come un utente diverso da quello che ha configurato lo strumento
    fallisce in silenzio. Se un controllo può fallire per «non configurato»,
    il messaggio deve dire **dove ha cercato**, non solo che non ha trovato.

32. **Un foglio con tutto l'archivio, e una cartella su F:** (17 settembre
    2026). Sua richiesta, subito dopo la faccenda dei backup: *«crea una
    cartella di backup su F:, in quella cartella crea anche un file csv con
    tutti i nominativi dei clienti, acquirenti e venditori completo di ogni
    informazione (dati personali e immobili venduti o visionati per ogni
    cliente)»*.

    **Da qui il suo disco F: non si tocca** — questo ambiente è un contenitore
    Linux in cloud, senza rotta verso il suo PC e senza SSH verso il server
    (provato: porta 22 irraggiungibile, client ssh assente). Quindi: il lavoro
    è tutto negli script, i comandi li lancia lui.

    - **`scripts/esporta-tutto.mjs`** — una riga per persona, 37 colonne:
      anagrafica, privacy, antiriciclaggio, richieste, e poi **immobili di cui
      è proprietario, venduti come proprietario, acquistati, proposte
      presentate, immobili visionati** con date, prezzi, interesse ed esito.
      Apre il database in sola lettura. Le schede cestinate (`deleted_at`)
      restano fuori, e il conto di quante ne ha escluse lo stampa a schermo.
    - **`deploy/copia-su-disco.ps1`** — da Windows: genera il CSV sul server,
      mette da parte l'ultima copia notturna, crea la cartella su F: e scarica
      database e foglio datandoli. `-ConLeFoto` porta via anche le immagini.
      Controlla che il disco esista prima di scrivere: senza quel controllo
      PowerShell creerebbe `F:\backup-mondo` da un'altra parte senza dire
      niente, se la chiavetta non è infilata.

    **Sul perché non è un pulsante nel gestionale.** Il *Scarica l'archivio* di
    Utenti è stato tolto apposta (punto sul muro fra colleghi): con ognuno che
    vede solo le proprie schede, un file con dentro tutto sarebbe la
    separazione aggirata con un clic. Da riga di comando sul server la cosa
    cambia: chi ci arriva ha già il `.db` intero sotto mano, l'export non gli
    dà un potere nuovo. **Se un giorno chiedesse di rimetterlo nell'interfaccia,
    è quella la domanda da rifargli**, non una questione tecnica.

    **Verifica.** Archivio di prova costruito con lo schema vero (estratto da
    `schema.ts` senza compilare TypeScript): un acquirente con due visite,
    due proposte e un acquisto andato a rogito; una venditrice con due
    immobili di cui uno venduto; uno che compra e vende insieme; e una scheda
    cestinata che deve restare fuori. Riletto il CSV con un parser scritto per
    l'occasione: 37 colonne su tutte le righe, il punto e virgola dentro una
    nota correttamente virgolettato, la scheda cestinata assente.

    Tre ritocchi nati dalla rilettura del foglio, non dai test: budget con un
    solo estremo scritto *«fino a 300.000 €»* invece di «/ 300.000 €», stati
    senza trattino basso (`in vendita`), e il singolare quando la scheda
    cestinata è una sola.

    **Il `.ps1` non si poteva eseguire da qui** (niente PowerShell in questo
    ambiente): l'ha lanciato lui, ed è andato **al primo colpo**. In
    `F:\backup-mondo` sono arrivati `clienti-completo-2026-09-17.csv` (180 KB)
    e `mondo-2026-09-17.db` (592 KB).

    **Quanto c'è davvero dentro quel foglio**, misurato con `diagnosi.mjs`
    sull'archivio vero: 1.256 schede esportate + 3 cestinate = 1.259, cioè
    tutte. Anagrafica e richieste piene (244 richieste). Ma **`offers: 0`** e
    solo 12 immobili su 56 collegati a un proprietario, quindi le colonne
    *Immobili acquistati* e *Proposte presentate* escono **vuote per tutti**, e
    *Immobili visionati* pesca da 18 attività in croce.

    **Il buco vero, e non è dell'export.** La vendita il gestionale la scrive
    sull'immobile (stato, prezzo, rogito), ma **chi ha comprato** si ricava
    solo dalla proposta accettata. Con zero proposte in archivio, di ogni
    immobile venduto non risulta da nessuna parte il nome dell'acquirente.
    Gliel'ho detto e gli ho messo davanti le due strade — registrare le
    proposte sulle vendite già fatte (inserimento, nessun codice), o aggiungere
    all'immobile un campo «acquirente» collegato alla scheda (modifica al
    programma). **Ha scelto la seconda lo stesso giorno: vedi il punto 33.**

33. **Il campo acquirente sull'immobile** (17 settembre 2026). Sua scelta, fra
    le due che gli avevo messo davanti quando l'export ha scoperto il buco:
    *«aggiungi il campo acquirente all'immobile»*.

    **Il buco.** La vendita il gestionale la scriveva sull'immobile — stato,
    prezzo di rogito, date — ma **chi aveva comprato** si ricavava solo dalla
    proposta accettata, e in `offers` non c'era nemmeno una riga. Di ogni casa
    venduta l'archivio sapeva quanto e quando, non il nome dell'acquirente. Per
    le vendite fatte prima del gestionale non c'era proprio modo di scriverlo.

    - `properties.buyer_client_id`, con indice, e la voce in `COLONNE_AGGIUNTE`
      per l'archivio gia' in esercizio.
    - `linkBuyer` gemella di `linkOwner`, stessi controlli di appartenenza.
    - `searchBuyerCandidates` sui ruoli acquirente/conduttore. Nel farla ho
      **unito i due corpi in `searchClientCandidates`**: erano cinquanta righe
      identiche, e due copie vogliono dire che la correzione fatta su una manca
      sull'altra — proprio sul riquadro usato meno, dove nessuno se ne accorge.
    - Stessa cosa nel JSX: il riquadro «Collega il proprietario» e' diventato
      **`<CollegaScheda>`**, usato due volte. La ricerca viaggia in un GET con
      un nome proprio (`proprietario`, `acquirente`) cosi' i due riquadri non
      si rubano il testo scritto dentro.
    - Il riquadro dell'acquirente compare **solo a trattativa avviata**
      (proposta/compromesso/venduto): su un immobile appena acquisito sarebbe
      una domanda senza risposta in cima alla scheda, tutti i giorni.
    - Scheda cliente: riquadro «Immobili acquistati», solo se ha comprato.
    - `esporta-tutto.mjs` legge i comprati da **due fonti tenute insieme** —
      il campo e la proposta accettata — e sullo stesso immobile fa una riga
      sola; il prezzo lo prende dalla proposta, se c'e', altrimenti da
      `sold_price`, altrimenti scrive «prezzo non registrato».
    - Colonna «Acquirente» anche nell'esportazione degli immobili.

    **L'errore che ho fatto, ed era scritto nel codice tre righe sopra.** Avevo
    messo `CREATE INDEX ... ON properties(buyer_client_id)` **dentro
    `schema.ts`**. Su un archivio gia' esistente `SCHEMA` gira *prima* della
    migrazione: la colonna in quel momento non c'e' ancora e la compilazione e'
    morta con `no such column: buyer_client_id`. Il commento di
    `COLONNE_AGGIUNTE` avverte esattamente di questo, e l'avevo appena letto.
    **L'indice di una colonna aggiunta dopo va solo in `COLONNE_AGGIUNTE`**,
    mai in `schema.ts`.

    **Verifica.** Typecheck e `npm run build` puliti. Migrazione provata sul
    vero: il `data/mondo.db` locale aveva la tabella senza la colonna, dopo la
    correzione colonna e indice risultano presenti. Export provato su quattro
    casi — comprato col solo campo, col solo `offers`, con tutti e due sullo
    stesso immobile (una riga sola), e senza nessun prezzo. Poi **prova di resa
    vera**: `next start` sull'archivio di prova con un cookie di sessione
    firmato a mano (`CRM_SECRET` fissato), e le pagine chieste con curl —
    venduto senza acquirente mostra il riquadro e «non collegato»; venduto con
    acquirente non mostra il riquadro e porta il link a `/clienti/2`; appena
    acquisito non mostra ne' l'uno ne' l'altra; la scheda dell'acquirente dice
    «Immobili acquistati (1)» e quella della venditrice non ha il riquadro.

    **Non provata**: la pressione del pulsante *Collega* (e' una Server Action,
    da curl non si arriva). Il codice e' il gemello di `linkOwner`, che
    funziona, ma la prima pressione vera la fa lui.

34. **La copia su F: diventa automatica** (17 settembre 2026). Sua richiesta:
    *«mi serve che il backup su F sia automatico, settimanale, quando il pc è
    acceso»*.

    **L'ostacolo vero non era la pianificazione, era la password.**
    `copia-su-disco.ps1` ne chiedeva tre, una per collegamento, e un'attivita'
    pianificata non ha nessuno che le digiti. Senza chiave SSH il resto non
    avrebbe avuto senso.

    - **`deploy/programma-copia-settimanale.ps1`**, da lanciare una volta sola:
      crea la chiave ed25519 se manca, la installa sul server, **verifica che
      il collegamento senza password funzioni davvero** e solo allora registra
      l'attivita'. Se la prova fallisce non registra niente: un'attivita' che
      resta ferma ogni volta e' peggio di nessuna attivita'.
    - **`copia-su-disco.ps1` rifatto** per girare senza nessuno davanti:
      `-NonInterattivo` aggiunge `BatchMode=yes` e `ConnectTimeout` — senza,
      ssh resterebbe appeso per sempre a un prompt che nessuno vede — scrive
      un registro e **esce con codice diverso da zero** quando fallisce, cosi'
      la cronologia di Windows lo segna come errore invece che come riuscita.
    - Il registro sta in `%LOCALAPPDATA%\mondo-copia.log`, **fuori dal disco
      di destinazione di proposito**: quando manca proprio quel disco, e' li'
      che bisogna poter leggere perche'.
    - `StartWhenAvailable` e' il pezzo che risponde a «quando il pc è acceso»:
      se all'ora prevista era spento, Windows lancia l'attivita' appena si
      riaccende invece di saltare la settimana.

    **Due punti Windows che e' facile sbagliare**, entrambi gestiti nel codice
    con il commento accanto: `ssh-keygen -N ''` non funziona da PowerShell
    (l'argomento vuoto viene buttato via e la chiave esce protetta da
    passphrase, cioe' inservibile) — ci vuole `-N '""'`, e dopo si verifica
    con `ssh-keygen -y -P '""'` invece di sperarlo. E gli `.ps1` vanno scritti
    **UTF-8 con BOM**, o Windows PowerShell 5.1 li legge come ANSI.

    **Verifica, stavolta eseguita davvero.** La volta scorsa avevo consegnato
    un `.ps1` mai passato da un parser (funziono', ma era fortuna). Qui ho
    scaricato PowerShell 7 nell'ambiente: **entrambi gli script parsano**, e
    `copia-su-disco.ps1` e' stato **eseguito** con `ssh` e `scp` finti su
    cinque rami — corsa normale, disco non collegato, server che non risponde,
    copia dei file fallita, di nuovo a posto — controllando ogni volta codice
    d'uscita e riga nel registro. Verificato anche che il `$(...)` dentro il
    comando remoto arrivi a bash intatto invece di essere valutato da
    PowerShell.

    **Non eseguibile da qui**: la parte con `Register-ScheduledTask`, che e'
    solo-Windows. Quella la prova lui.

    **Da sapere**: la chiave e' senza passphrase, obbligatoriamente. Chi entra
    nel PC con il suo utente entra come root nel server. Gliel'ho detto, e sta
    scritto in fondo allo script e nel README.

    **E poi si e' rotto da lui, al primo lancio — la lezione vera di questo
    punto.** Lo script creava la chiave, chiedeva al server «sono gia'
    autorizzato?», e **moriva sulla risposta**:

    ```
    ssh.exe : root@…: Permission denied (publickey,password).
    ```

    Quel messaggio non e' un guasto: e' il «no» che stavamo cercando, ed e'
    scritto su stderr. In **Windows PowerShell 5.1** un comando esterno che
    scrive su stderr diventa un **errore bloccante** quando
    `$ErrorActionPreference` vale `Stop`. In **PowerShell 7 no** — ed e'
    esattamente il PowerShell che avevo scaricato per provare. La prova era
    passata su tutti e cinque i rami, su un interprete che non ha il
    comportamento che conta.

    **Regola da portarsi dietro: PowerShell 7 su Linux non e' una prova valida
    per uno script che girera' su Windows PowerShell 5.1.** Dove non si puo'
    provare sul vero, almeno non si usa `Stop` attorno ai comandi esterni.

    Corretto in entrambi gli script con `Esegui { … }`, che abbassa la
    preferenza attorno a ogni chiamata esterna e lascia decidere a
    `$LASTEXITCODE` — l'unica cosa che dice davvero com'e' andata. La variante
    `-Interattivo` non cattura i flussi, altrimenti si porterebbe via la
    richiesta della password.

    Riprovato: parser pulito su entrambi, i cinque rami di `copia-su-disco`
    rifatti con `$PSNativeCommandUseErrorActionPreference = $true` (il proxy
    piu' vicino alla severita' di 5.1 ottenibile da qui), e il flusso del
    programma-copia provato per intero con `ssh` e `ssh-keygen` finti —
    compresi un `ssh-keygen` che scrive su stderr e il «Permission denied» che
    l'aveva ucciso. Passa tutto e si ferma solo su `New-ScheduledTaskAction`,
    che su Linux non esiste.

    **E si e' rotto una seconda volta, diversamente.** Installata la chiave e
    registrata l'attivita', la copia falliva cosi':

    ```
    NON RIUSCITA: il server non ha completato la preparazione
                  (Bad escape character 'ncodedCommand'.).
    ```

    E' `ssh` che si lamenta di aver ricevuto `-e ncodedCommand`, cioe' il
    frammento di `-encodedCommand` — un'opzione di `powershell.exe` che nel
    codice non compariva da nessuna parte.

    **Come l'ho ristretto, e vale piu' della causa:** gli argomenti
    dell'attivita' erano esatti (`Get-ScheduledTask … .Actions`), `ssh` era
    quello di Windows (`Get-Command ssh`), e la copia falliva **uguale lanciata
    a mano** — quindi non era l'attivita', era lo script. A quel punto il
    confronto: `programma-copia-settimanale.ps1` chiama ssh nello stesso modo e
    **funziona**; l'unica differenza era lo splatting `@opzioni` nella chiamata
    di `copia-su-disco.ps1`.

    Tolto lo splatting: `SshRemoto` e `ScpRemoto` scrivono la chiamata per
    esteso, un ramo per caso (interattivo / non, ricorsivo / non). Piu' righe,
    nessuna interpretazione di mezzo.

    **Il meccanismo esatto non l'ho stabilito** — da Linux non si riproduce, e
    non ho voluto tenere in piedi un costrutto che in una corsa vera ha
    passato a un programma un'opzione mai scritta. **Regola: verso un programma
    esterno, niente splatting.** Riprovati sei rami su sei, verificando anche
    gli argomenti che arrivano davvero a ssh e scp nelle due modalita'.

    **Da qui in poi funziona, provato da lui** il 17 settembre 2026 lanciando
    l'attivita' con `Start-ScheduledTask`: `FATTA: mondo-2026-09-17.db e
    clienti-completo-2026-09-17.csv (0.75 MB) in F:\backup-mondo`. Cioe' la
    catena intera — attivita' di Windows, chiave senza password, export sul
    server, copia sul disco — senza nessuno che tocchi niente. Prima corsa
    automatica prevista lunedi' 21 settembre alle 9.

    **Se un giorno smette**, il primo posto da guardare e'
    `%LOCALAPPDATA%\mondo-copia.log`: l'ultima riga dice `FATTA:` oppure
    `NON RIUSCITA:` con il motivo. Non arriva nessun segnale da nessun'altra
    parte.

35. **La copia fuori sede passa da Drive a Box** (17 settembre 2026). Nata da
    una sua domanda — *«alternativa a drive?»* — dopo che il `client_id`
    condiviso di rclone era finito fra le cose in sospeso.

    Gli avevo spiegato che il problema non e' Drive ma il tipo di accesso: i
    servizi con login OAuth (Drive, OneDrive, Dropbox) passano da un'identita'
    applicativa condivisa fra tutti gli utenti di rclone, ed e' quella che
    Google ritira; i servizi con chiave d'accesso no. Consigliavo Aruba (stesso
    fornitore del server, dati in Italia, accordo art. 28 gia' agli atti) o
    Hetzner. **Ha scelto Box**, e va benissimo per il problema immediato:
    l'annuncio di ritiro e' solo di Google.

    Detto una volta e non ripetuto: **Box e' americana**, e per un archivio con
    codici fiscali e documenti d'identita' la residenza dei dati e' una cosa da
    aver scelto. Le copie principali restano quella sul server (Italia) e
    quella sul disco in ufficio.

    - **`backup-esterno.sh`: la destinazione e' un'impostazione.** Prima
      `gdrive:` era scritto in due punti del codice. Ora legge
      `CRM_BACKUP_REMOTO` da `/etc/mondo-crm.env` — fuori dalla cartella del
      programma, quindi sopravvive agli aggiornamenti — e ne ricava anche il
      nome da cercare fra i collegamenti di rclone. Senza quella riga il
      comportamento e' identico a prima.
    - Documentata la procedura Box per esteso in `deploy/README.md`, col
      passaggio meno ovvio: il server non ha browser, quindi si risponde `n`
      alla domanda sul browser, si esegue `rclone authorize "box"` **da
      Windows** (rclone si installa con `winget install Rclone.Rclone`) e si
      incolla il token nella sessione ssh che sta aspettando.

    **In esercizio dal 17 settembre**: prima copia riuscita in 1m09s — database
    e tutte le 84 foto, ricaricate da zero perche' per Box erano nuove.

    **Il collegamento `gdrive` e' ancora configurato sul server** e la vecchia
    cartella e' ancora su Drive: nessuno le usa piu'. Vanno tolte quando lui
    decide, non prima — e' l'unica copia di agosto-settembre su Drive.

    **Il token di Box e' finito in chat** mentre lo incollava. Gliel'ho
    spiegato — e' un `refresh_token`, cioe' una chiave permanente che apre
    l'archivio con codici fiscali e documenti, e l'unico rimedio e' revocarla
    e rifare l'autorizzazione, tre minuti senza interrompere niente. **Ha
    detto di lasciarla** (*«no lasciala»*). Deciso da lui, con l'informazione
    completa davanti: **non riproporglielo.** Se un giorno lo riprende, la
    strada e' Box → Impostazioni account → Sicurezza → App collegate, togliere
    rclone, poi `rclone config` → `e` → `box` → nuova autorizzazione.

36. **I due profili, e il telefono dentro l'appuntamento** (18 settembre
    2026). Sua richiesta, in due righe: *«Devi creare l'agenda per Roberto
    Lefons e Alessandro Ciullo. Negli appuntamenti dell'agenda deve comparire
    anche il telefono del cliente»*.

    **La prima meta' non si puo' fare da qui, e non e' una scusa**: i profili
    sono righe nell'archivio di produzione, che sta sul server dell'agenzia e
    da fuori non si raggiunge. Restava aperta da sei giorni proprio per questo
    (punto 27). Quello che si poteva fare era togliergli di mezzo il lavoro:
    `npm run persone` crea i due profili come Collaboratori **e** genera la
    chiave del loro calendario, che dalle pagine sono due passaggi in due
    posti diversi (*Utenti → Nuovo utente*, poi *I calendari delle persone →
    Crea il calendario*). Un comando, e stampa i due indirizzi `.ics`.

    - **Si puo' rilanciare.** Chi c'e' gia' non viene toccato: ne' la
      password, ne' il ruolo, ne' la chiave del calendario — che se qualcuno
      l'ha appena collegata in Google non deve spegnersi per una seconda corsa
      distratta. E' la stessa regola di `creaCalendarioDi`, e per lo stesso
      motivo.
    - **Si ferma se l'archivio e' vuoto.** Un archivio senza nemmeno un utente
      non e' quello dell'agenzia: e' un database di prova, o il percorso
      sbagliato. Meglio fermarsi che lasciare due profili dove non servono e
      credere di averli messi dove servivano.
    - Le email sono `nome.cognome@mondoimmobiliarelecce.it`. **Sono nomi
      utente, non caselle**: contano solo perche' devono essere diversi uno
      dall'altro. Se le caselle vere sono altre, si cambiano da *Utenti* in
      dieci secondi — e vanno cambiate se quelle persone devono ricevere
      l'avviso per email prima degli appuntamenti.
    - La password si genera a caso e si stampa. Se nel programma non devono
      entrare, non la si da' a nessuno: il profilo resta un nome nella tendina
      «assegnata a» e il suo calendario funziona lo stesso.
    - Le due righe finiscono nel registro accessi intestate al titolare. Non
      c'e' nessuno che ha fatto l'accesso — il comando gira sul server — ma
      un profilo comparso dal nulla, riletto fra sei mesi, non deve essere un
      mistero.

    **Il telefono nell'appuntamento** e' una colonna sola, `client_phone`,
    aggiunta a `ACTIVITY_SELECT` accanto al nome del cliente e mascherata
    **dallo stesso `CASE`**. E' il punto che conta: nome e numero escono
    insieme o non escono per niente, quindi il muro fra collaboratori non ha
    bisogno di un secondo controllo che qualcuno, un giorno, si dimentichera'
    di scrivere. `COALESCE(c.mobile, c.phone)` — il cellulare se c'e', il
    fisso se no — che e' l'ordine con cui si proverebbe a chiamare, ed e'
    quello che l'avviso per posta usava gia' da settembre.

    - In agenda il numero sta **attaccato al nome**, e' un collegamento
      `tel:` e da telefono apre il tastierino gia' scritto. Dall'elenco alla
      telefonata senza passare dalla scheda: e' tutto il senso della
      richiesta.
    - Nei file `.ics` e in Google finisce dentro la descrizione, nella forma
      `Cliente: Mario Rossi · 3401112233`. **La stessa dell'avviso per email**,
      che la usava da prima: tre strade che raccontano lo stesso appuntamento
      non possono scriverlo in tre modi diversi. Sul telefono il numero nella
      descrizione dell'evento si tocca e parte la chiamata.
    - `VisitRow` non aggiunge piu' il telefono per conto suo: ce l'ha
      `ActivityRow`, ed e' lo stesso numero mascherato allo stesso modo. Una
      colonna calcolata in due punti e' una colonna che prima o poi si calcola
      in due modi.
    - **Adesso l'indirizzo `.ics` vale di piu' di prima.** Chi lo trovasse non
      vedrebbe solo che c'e' un appuntamento: vedrebbe chi e' e che numero ha.
      Il commento sulla rotta lo dice, e la pagina *Calendario e avvisi* lo
      dice a chi legge. E' il motivo per cui la riga «rigenerare le chiavi
      finite in chat», qui sotto, e' passata da «tanto vale» a da fare.

    Verificato in browser sulla build di produzione, 21 controlli, piu' il
    finto Google per la strada che il browser non fa vedere:

    - il numero in agenda, il `tel:` ripulito dagli spazi (`+39 333 2211445`
      diventa `tel:+393332211445`), il cliente senza nessun recapito che
      mostra il nome e niente altro — non un separatore appeso;
    - Roberto che sul **suo** cliente vede il fisso `0832 123456` (la prova
      del `COALESCE`: quel cliente il cellulare non ce l'ha) e sul cliente di
      Camillo non vede ne' il nome ne' il numero, ne' in pagina ne'
      nell'`.ics` del singolo appuntamento;
    - i due profili nella tendina «assegnata a», i due calendari nella pagina
      *Utenti* con indirizzi diversi, una chiave inventata che da' 404, il
      collaboratore rimandato via da *Utenti*;
    - `GOOGLE_FINTO_BASE` — la variabile che esiste apposta (punto 28) — per
      leggere i sei eventi come Google li riceve: descrizione **identica** a
      quella del feed `.ics`, compreso il cliente senza numero e quello del
      collega senza niente.

    Due trappole gia' scritte qui e ripagate lo stesso: la tendina «assegnata
    a» elenca tutti gli utenti, quindi leggendo `textContent("body")` Roberto
    e Alessandro «c'erano» anche prima di crearli — si legge il `<select>`,
    non il corpo; e il link del calendario sta dentro un `<input readOnly>`,
    quindi si legge `value`, non il testo.

    **In esercizio dal 18 settembre 2026**, un'ora dopo il commit: ha
    aggiornato il server con `deploy/aggiorna.sh` (copia a 0,58 MB, ricompilato,
    ripartito alle 12:59) e lanciato `npm run persone`. **I due profili adesso
    ci sono davvero**, con la chiave del calendario gia' generata — la riga
    aperta dal 12 settembre si chiude qui.

    **E li' e' inciampato, subito.** Lui quei due profili li aveva gia' creati
    a mano dalle pagine, con le loro email vere (`rolef707@gmail.com`,
    `sandrociullo@libero.it`); il comando guardava i doppioni **solo
    sull'email**, non li ha riconosciuti, e l'agenzia si e' ritrovata **quattro
    profili per due persone**, con due calendari doppi e due nomi ripetuti
    nella tendina «assegnata a». Non e' un disturbo estetico: e'
    l'appuntamento segnato sul profilo che quella persona non apre mai.
    Rimediato in due clic — via i due creati dal comando, che avevano «niente»
    in carico — e l'elenco e' tornato a quattro utenti. Effetto collaterale
    buono: se ne sono andate con loro le due chiavi `.ics` e le due password
    che il comando aveva stampato e che erano finite in conversazione.

    Corretto lo stesso giorno: adesso, **prima di creare, guarda anche il
    nome**. Se c'e' gia' qualcuno che si chiama cosi' con un'altra email, non
    crea niente, dice quale email ha trovato e suggerisce il comando esatto per
    dare il calendario a **quel** profilo (`--nome "..." --email <quella
    trovata>`), lasciando aperta la strada dell'omonimo vero da *Utenti*. Non
    indovina e non fonde niente da solo: gli omonimi esistono, e un comando che
    li unisce in silenzio fa un danno peggiore del doppione. Provato
    riproducendo il caso: due profili a mano con le email vere, il comando
    rilanciato, **nessun quinto utente creato** e il suggerimento stampato che,
    eseguito, genera davvero il calendario mancante.

    La lezione, che vale oltre questo comando: **cio' che per il programma e'
    la stessa persona non e' cio' che e' la stessa persona per chi ci lavora.**
    L'email e' la chiave tecnica, il nome e' quello che l'agenzia vede. Un
    controllo sulla sola chiave tecnica passa liscio proprio nel caso che fa
    danno.

    Nello stesso giro, dal `systemctl status`, e' saltato fuori un contorno che
    non c'entra con questo lavoro ma va saputo: quattro «**Failed to find
    Server Action**» nel log della mattina (08:35, 10:20, 11:04, 11:43). Non e'
    un guasto — e' una pagina rimasta aperta nel browser da prima del riavvio
    del 17, che manda comandi con gli identificativi della compilazione
    vecchia. **Quei clic non hanno fatto niente**, ed e' la parte che conta: chi
    ha premuto *Salva* in quei momenti non ha salvato. Si risolve ricaricando
    la pagina (Ctrl+F5), e va fatto **dopo ogni aggiornamento**, su ogni
    computer e telefono dove il gestionale resta aperto. Se ricompare spesso
    nel log, vuol dire che qualcuno lavora su una scheda vecchia senza
    accorgersene.

    **Terza cosa vista dal suo schermo, e corretta subito**: «Creati in Google
    i calendari di Alessandro, Immobiliare Colazzo, Roberto» gli e' comparso
    **nel riquadro rosso**, su un'operazione perfettamente riuscita. Non era
    una svista di quella pagina: `AvvisoModulo` era rosso e basta — un solo
    canale di ritorno per tutto — e le due azioni di Google ci mandavano dentro
    anche gli esiti buoni. Un programma che avvisa allo stesso modo quando va
    bene e quando va male insegna a non fidarsi dei suoi avvisi, e il prezzo lo
    paga il giorno in cui un rosso vero viene ignorato.

    - `EsitoModulo` (in `types.ts`, non accanto al componente: lo scrivono le
      azioni sul server e lo legge il browser, e un tipo condiviso non puo'
      abitare in un file «use client»). **Una stringa vuol dire che e' andata
      male** — cosi' le quattro azioni che rispondono solo errori non si toccano
      e restano rosse — e chi ha una buona notizia la dichiara:
      `{ riuscito: true, testo }`.
    - Verde con `role="status"`, rosso con `role="alert"`. Non e' pignoleria:
      `alert` interrompe chi usa il lettore di schermo, e per una cosa riuscita
      non deve. E il colore da solo non basterebbe — chi non distingue il rosso
      dal verde si ritroverebbe due messaggi identici.

    Provato in browser sulla build: il verde sui due pulsanti di Google, il
    rosso che **resta** rosso su un Client ID scritto male e sul rifiuto di una
    scheda cliente, piu' i 21 controlli di prima rifatti.

    Rimasto li' apposta, e da decidere da lui: nella descrizione dell'evento
    il collegamento alla scheda del cliente c'e' **anche quando la scheda e'
    di un collega** e quindi non si apre (da' «non trovata»). E' cosi' da
    prima di questo lavoro, l'avviso per email invece il link lo omette. Una
    riga per allinearli, ma nessuno l'ha chiesto e non e' roba di questo
    punto.

---

## 5 · Cosa resta aperto

| Cosa | Stato |
|---|---|
| **Configurare SMTP** in `/etc/mondo-crm.env` sul server | **Rimandato da lui l'11 settembre 2026**: *«per adesso rimandiamo, troppo complicato»* — la verifica in due passaggi piu' la password per le app sono due passaggi su Google, non sul gestionale. **Non riproporglielo**: quando serve, lo riprende lui. Dalla parte del codice non manca niente (punto 23), e il punto della situazione qui sotto resta valido parola per parola. |
| **Un `client_id` di rclone tutto nostro** | Da fare prima o poi. Oggi la copia su Google Drive usa il `client_id` condiviso di rclone, che Google **ritira nel corso del 2026**: quando lo spegne la copia esterna smette di partire, e — come il 14 agosto — senza dare nessun segnale dal gestionale. Procedura in <https://rclone.org/drive/#making-your-own-client-id>, poi `rclone config` da root sul collegamento `gdrive`. |
| **Inserire i dati dei venditori** | Rimandato da lui: *«dopo inserisco i dati dei venditori»*. |
| **Messaggi di errore che si leggono** | **Fatto** il 3 settembre 2026 (punto 20). I rifiuti tornano dalle azioni come testo e compaiono sopra il pulsante Salva senza far perdere quello che si era scritto; sotto c'e' la rete di `error.tsx` e `not-found.tsx`. Resta da fare, se mai servisse: gli altri moduli non hanno controlli di server da raccontare, ma se glieli si aggiunge la strada e' `<ModuloConEsito>`, non `throw`. |
| **Zone da correggere** | `ZONE_PER_COMUNE` in `types.ts` e' una lista di partenza: fitta per Lecce e Porto Cesareo, piu' scarna altrove, e scritta senza conoscere il mercato. Va fatta correggere a lui — aggiungere una voce e' una riga. |
| **Completare l'indirizzo degli immobili vecchi** | Lavoro suo, a mano. L'indirizzo è obbligatorio solo per i salvataggi da adesso in poi; quelli già in archivio senza via mostrano il titolo al posto della via nelle liste finché qualcuno non li apre e lo aggiunge. **Da adesso però sa quali sono**: il cruscotto li conta e il numero apre l'elenco dei soli immobili da completare (punto 15). Nessun automatismo previsto: la via non si inventa. |
| **Applicazione per i venditori** («Mondo Tracking») | **Finita, in esercizio e provata da lui**, fino alle modifiche del 7 settembre comprese: *«fatto tutto, funziona»*. La pagina col nome e le osservazioni dei visitatori, il riquadro per mandare il link, i tre portali col nostro sito, la firma di Virginia. Documentata per l'agenzia in `README.md` («La pagina del proprietario») e `CONSEGNA.md` (9-septies). Vedi «I due progetti nuovi», qui sotto. |
| **Pubblicazione sui portali** | **Progetto nuovo, e il piu' urgente dei due.** Ha dismesso Casagest24 e pubblica a mano. Vedi «I due progetti nuovi», qui sotto. |
| **Provare gli avvisi su un telefono vero** | **Aspetta lui, ed e' l'unica cosa che manca** agli avvisi del punto 25. Da qui non si arriva ne' a Google ne' ad Apple. Lui apre *Agenda → Calendario e avvisi* dal telefono, accende, e tocca *Mandami una prova*. Se non arriva, il messaggio dice gia' il motivo. Da provare su tutte e tre le marche, e sull'iPhone **dopo** averlo aggiunto alla schermata Home. |
| **Creare i due profili** «Roberto Lefons» e «Alessandro Ciullo» | **Fatto: esistono in produzione dal 18 settembre 2026.** Li ha creati lui con `npm run persone` sul server, subito dopo l'aggiornamento (punto 36). Sono Collaboratori a Lecce, con l'email `nome.cognome@mondoimmobiliarelecce.it` e la chiave del calendario gia' generata. **Resta da fargli confermare due cose:** che le email siano quelle giuste — vanno corrette da *Utenti* se quelle persone devono ricevere l'avviso per posta prima degli appuntamenti — e che in *Utenti → Google Calendar → Crea adesso i calendari mancanti* siano comparsi i loro due calendari dentro il suo Google. |
| **I tre calendari in abbonamento** | **Provati da lui il 15 settembre, e non bastano**: Google li ricontrolla quando decide lui. Da qui e' nato il punto 28. Restano funzionanti per chi li ha gia' collegati. |
| **Collegare Google Calendar** | **In esercizio dal 17 settembre 2026.** Collegato il 15, il 16 scoperto sull'account sbagliato (punto 29), ricollegato e calendari creati il 17: *«ora ci sono tutti i calendari»*. Resta da fargli confermare **l'ultima cosa, che e' il motivo di tutto**: che spostando un appuntamento nel gestionale si muova **subito** anche in Google. |
| **Togliere da Google i calendari in abbonamento** | Gli `.ics` aggiunti con *Da URL* vanno tolti, adesso che c'e' il collegamento vero: tenendo tutte e due le strade **ogni appuntamento compare due volte**. Detto a lui il 17 settembre. |
| **Rigenerare le chiavi `.ics` finite in chat** | Gli indirizzi dei calendari di Roberto, Alessandro e Virginia sono stati incollati in conversazione durante le prove di settembre. Valgono come password. Un clic da *Utenti* → *genera un indirizzo nuovo*. **Era «tanto vale», dal 18 settembre e' da fare**: da quel giorno dentro quei feed c'e' anche il numero di telefono dei clienti (punto 36), quindi una chiave in giro non mostra piu' soltanto che c'e' un appuntamento. **Il 18 ce ne sono finite altre due, piu' due password**: `npm run persone` stampa a schermo gli indirizzi e le password appena create, e lui ha incollato in chat tutto quello che il comando aveva scritto. Quei due `.ics` non servono comunque a niente — i calendari veri li fa il collegamento a Google — quindi rigenerarli non costa niente. Le password contano solo se quei due profili devono entrare davvero nel programma: in quel caso si cambiano da *Utenti* o con `npm run password`. Detto a lui il 18; **decide lui, e non si ripropone** — stessa regola del token di Box (punto 35). |
| **Togliere i calendari in abbonamento da Google** | Quando confermera' che i calendari nuovi ci sono: tenendo tutte e due le strade, ogni appuntamento comparirebbe **due volte**. |
| **Controllo giornaliero della PR #2** | Vedi capitolo 7. |
| **La descrizione della PR #2** | **Rifatta il 12 settembre.** Quella del 7 era rimasta indietro di sei cose — gli avvisi sul telefono, i calendari per persona, il confronto fra comuni, la zona che non e' piu' un'avvertenza — e conteneva **un esempio diventato falso**: citava *«Fuori dalle zone richieste (Frigole)»* come avvertenza, e quell'avvertenza non esiste piu'. Lezione: quando si cambia il modo in cui il programma **si racconta**, la descrizione della PR va riletta, non solo aggiornata in coda. E' l'unica presentazione del progetto che un estraneo legge. |
| **Incroci fra colleghi** | **Fatto** (`/incroci/colleghi`, `incrociFraColleghi` in `matching.ts`). Le due letture che scavalcano il muro sono le uniche del programma, hanno la selezione delle colonne scritta campo per campo apposta — un `SELECT *` li' porterebbe fuori prezzo minimo, provvigioni e note — e la richiesta altrui non legge nemmeno `client_id`. Resta aperto: **contatti in comune** (il rilevamento doppioni non attraversa il muro, quindi due schede della stessa persona non vengono segnalate) e **richieste di cancellazione GDPR**, che vanno girate a voce al collega. |

### SMTP — dove siamo rimasti (aggiornato al 2 settembre 2026)

> **Fermo per sua decisione dall'11 settembre 2026.** Gli sono stati dati i
> passi per intero e ha risposto *«per adesso rimandiamo, troppo complicato»*.
> Quello che resta da fare sta tutto su Google — verifica in due passaggi e
> password per le app — e nessuno può farlo al posto suo. **Non va rimesso in
> cima alle cose da fare a ogni finestra nuova:** è una scelta sua, non una
> dimenticanza. Qui sotto è tutto ancora buono per quando lo riprende.
>
> **Cosa comporta, e va detto se ne nasce un problema.** Senza posta il
> gestionale funziona (ha funzionato così per settimane), ma due cose no:
> l'**avviso per email 30 minuti prima** degli appuntamenti — restano il
> pulsante *Calendario* sulla riga dell'agenda e l'abbonamento iCalendar — e
> soprattutto **«Password dimenticata?»**, che continua a dire che la posta non
> è configurata. Se qualcuno resta fuori, la via è
> `npm run password -- --email ...` dal server, ed è l'unica.
>
> **Da non confondere con l'agenda dentro Google Calendar**, che è un'altra
> cosa e **funziona già**: si copia l'indirizzo da *Agenda → Calendario e
> avvisi* e si incolla in Google (*Altri calendari → + → Da URL*). Nessuna
> password, nessun account collegato, niente a che vedere con l'SMTP.

**Manca una cosa sola**: una password di posta che funzioni. Tutto il resto è
fatto, sul server e nel codice.

**La strada è cambiata: si va con Gmail, non più con SiteGround.** La casella
`info@mondoimmobiliarelecce.it` è su SiteGround (MX `mailspamprotection.com`,
`mail.mondoimmobiliarelecce.it` → 35.214.x.x), host e porta erano giusti e
confermati dal pannello — ma **la password di quella casella non è più valida**,
provate tutte e due le forme dell'utenza, e il tentativo di creare una casella
nuova `gestionale@` è fallito con un errore generico di SiteGround.

A quel punto lui ha detto una cosa che ha cambiato tutto: **in agenzia non usano
Outlook, leggono la posta su Gmail** dove `info@` viene inoltrata. Quindi si
spedisce da **`immobiliarelecce@gmail.com`**, che è suo e che controlla.

**Cosa deve fare lui, ed è l'unica cosa che manca:**

1. Attivare la **verifica in due passaggi** sull'account Google, se non c'è.
2. Generare una **password per le app** su `myaccount.google.com/apppasswords`.
   Sono 16 lettere minuscole. Google le mostra a gruppi di quattro: **gli spazi
   non fanno parte della password**, vanno tolti. La password normale di Gmail
   non funziona — Google ha chiuso quella strada nel 2022.

**Poi bastano tre comandi.** Le prime quattro righe si scrivono in un colpo solo
(non contengono segreti), e in nano gli resta da toccare la sola riga della
password:

```
ssh root@77.81.234.151 "cp -n /etc/mondo-crm.env /etc/mondo-crm.env.prima; printf '%s\n' 'SMTP_HOST=smtp.gmail.com' 'SMTP_PORT=465' 'SMTP_USER=immobiliarelecce@gmail.com' 'SMTP_PASS=' 'SMTP_FROM=immobiliarelecce@gmail.com' > /etc/mondo-crm.env; chmod 640 /etc/mondo-crm.env; chown root:mondo /etc/mondo-crm.env; cat /etc/mondo-crm.env"
ssh root@77.81.234.151 -t "nano /etc/mondo-crm.env"
ssh root@77.81.234.151 "set -a; . /etc/mondo-crm.env; set +a; cd /opt/mondo-crm && sudo -E -u mondo node scripts/posta.mjs"
```

`npm run posta` dice **quale delle cinque righe è sbagliata** invece di dare un
codice d'errore, e dall'11 settembre (punto 23) sui tre modi di sbagliare la
password di Gmail è esplicito: la password normale al posto di quella per le
app, gli spazi rimasti dentro, e la riga che si spezza e fa dire «manca
SMTP_PASS» a chi l'aveva appena scritta. Quando passa: `-- --manda` per un'email vera, poi
`systemctl restart mondo-crm` — il programma legge quel file solo all'avvio, e
finché non riparte *Password dimenticata?* continua a dire che la posta non è
configurata.

**Sul server è già tutto pronto:** `scripts/posta.mjs` c'è, `/etc/mondo-crm.env`
esiste (con dentro i vecchi valori SiteGround, che il comando qui sopra
sovrascrive) e la copia di com'era prima sta in `/etc/mondo-crm.env.prima`.

Escluse per strada, così non si rifanno: la **`@` nella password non c'entra**
(provato: `@`, `!` e `#` arrivano interi; l'unico carattere che si perde è il
**`$`**), e il file non era mangiato.

### I due progetti nuovi (4 settembre 2026)

Sono nati in una mattinata di domande sue, **non c'e' ancora una riga di codice
scritta** per nessuno dei due, e le specifiche devono ancora arrivare. Qui sta
tutto quello che si e' scoperto, che e' parecchio: senza, si ricomincerebbe da
zero a fare le stesse domande.

> **Rimandati tutti e due, l'11 settembre 2026.** Gli e' stata riproposta la
> pubblicazione sui portali come il lavoro che rende di piu', e ha risposto
> *«anche questo dopo»*. Vale quello che vale per l'SMTP: **non va riproposto a
> ogni finestra nuova.** Quando vuole ripartire lo dice lui, e qui sotto c'e'
> tutto quello che serve per farlo senza rifare le stesse domande.

**Ordine consigliato, detto a lui: prima la pubblicazione, poi i venditori.**
La pubblicazione e' il lavoro che fa tutti i giorni e che si e' appena caricato
a mano; l'applicazione per i venditori e' una bella cosa che nessun cliente sta
chiedendo. I due progetti condividono comunque i campi nuovi sulla scheda
immobile.

#### A · Applicazione per i venditori

Sua richiesta: *«una applicazione per i clienti che vendono con noi per vedere
l'andamento della promozione in vendita»*. Sta **in una finestra sua** — e'
un programma a se' — mentre qui si fa la parte del gestionale e si concorda
**cosa passa in mezzo**.

Da sapere prima di ricominciare:

- **Meta' esiste gia', su carta.** E' lo *Storico visite per il proprietario*
  (capitolo 9 di `README.md`): visite fatte con data, nome, telefono e commento,
  appuntamenti fissati, note interne che si tolgono con un clic. La richiesta e'
  quella pagina che smette di essere un foglio. Le specifiche partano da li',
  dicendo cosa aggiungere e cosa togliere.
- **Le tre domande che decidono tutto**, e che gli sono state fatte:
  1. cosa vede il venditore e **cosa non deve vedere mai** — prezzo minimo,
     provvigioni, note interne, e i **nomi e telefoni di chi e' venuto a
     vedere**, che sono dati di altri clienti. Sul foglio stampato decide caso
     per caso; su una pagina sempre accesa la scelta si fa una volta;
  2. **come ci entra**: un collegamento privato per immobile (stesso stampo del
     token del calendario, gia' collaudato qui) oppure utenze vere. Con una
     ventina di venditori, il collegamento basta;
  3. cosa vuol dire *andamento*: le visite le abbiamo, i numeri dei portali no.
- **Il muro verso l'esterno.** Oggi il gestionale non espone niente: questa
  sarebbe la prima porta aperta verso fuori. Va fatta stretta di proposito.

**Cosa c'e' gia' in casa (4 settembre 2026).** E' arrivata una proposta di
architettura passata da un'altra chat (Gemini), col nome **Mondo Tracking**:
pagina pubblica per immobile, visite, semaforo della vendita, link di verifica
degli annunci. La mappa del database che portava con se' e' stata **verificata
riga per riga contro il codice ed e' giusta** — `schema.ts`, `data/mondo.db`,
`offers`, `price_history`, `photos` esistono tutte, e lo stampo del token del
calendario e' esattamente quello proposto. Diversamente dall'episodio del punto
17, qui non c'era niente da rifiutare.

I **Passi 1 e 2 sono fatti** e committati:

- `properties.tracking_token` in `COLONNE_AGGIUNTE`, con **indice univoco**.
  L'indice **non puo' stare in `SCHEMA`**: `SCHEMA` gira prima che le colonne
  nuove vengano aggiunte, e su un archivio vero morirebbe a ogni avvio con
  *no such column*. Per questo `COLONNE_AGGIUNTE` ha ora un campo `indice`, e
  il ciclo lo crea **fuori** dal salto — una colonna aggiunta da una versione
  precedente resterebbe altrimenti senza indice per sempre.
- `propertyByTrackingToken`, `trackingToken`, `resetTrackingToken`,
  `revokeTrackingToken` in `queries.ts`. **Le colonne sono scritte a mano una
  per una** come nelle letture fra colleghi: qui si esce dall'agenzia, e un
  `SELECT *` porterebbe fuori prezzo minimo, provvigioni e note interne.
- **Nessuna chiave e' stata generata.** Si crea un immobile alla volta, quando
  l'agente decide di mandare il link: 53 link vivi che nessuno ha chiesto
  sarebbero 53 porte aperte senza sorveglianza.

- `trackingVisits(propertyId)` — **il Passo 2**. Visite e appuntamenti di
  quell'immobile, e **soltanto la data**. Non chiede chi guarda: la chiave ha
  gia' deciso quale casa, e `ATTIVITA_MIA` qui sarebbe pure sbagliato nel
  merito — nasconderebbe al proprietario la visita che un collega ha fatto a
  casa sua in condivisione.

**La decisione di Camillo, presa il 4 settembre** — e' la prima delle tre
domande del capitolo 5A, e adesso ha una risposta: il proprietario vede **le
visite senza nomi, e nient'altro**. Fuori i giudizi sulla visita, fuori le
proposte d'acquisto, fuori lo storico dei prezzi. Quindi tre pezzi
dell'architettura di Gemini — feedback, offerte, storico prezzi — **non si
costruiscono**, e i componenti che li disegnano vanno tolti, non lasciati vuoti.

Il campo del CRM piu' pericoloso in tutto questo non e' un recapito: e'
**`activities.title`**, il campo «Cosa». E' testo libero, e chi segna una
visita di fretta ci scrive «Visita sig. Rossi». Il nome sarebbe uscito da li',
non dalle colonne che uno si ricorda di controllare. Sta fuori apposta, e la
prova lo verifica cercando proprio quel cognome nel risultato.

Provato su un database usa-e-getta, **29 controlli**, con le istruzioni SQL
**estratte dai file veri** e non ricopiate: fra gli altri, l'indice che
fallisce se creato prima della colonna (e' la prova del perche' sta dove sta),
i NULL che convivono sotto un indice univoco, il collega che non riesce a farsi
generare la chiave di un immobile non suo, le colonne vietate che non escono, e
le visite che escono con tre campi soli — `id`, `due_at`, `done_at`.

- **Il Passo 3: le foto.** `trackingPhotos`, `trackingPhotoBelongs` e la rotta
  `src/app/tracking/[token]/foto/[file]/route.ts`. Serviva una rotta apposta:
  `/foto/[id]/[file]` vuole l'accesso **e** che l'immobile sia di chi guarda, e
  da fuori non e' vera nessuna delle due — le foto sarebbero arrivate tutte
  rotte, e il guasto non da' nessun errore (la pagina si apre, le foto no).
  Il controllo poggia su un'altra gamba: al posto dell'utente la chiave, al
  posto di «l'immobile e' tuo» **«la foto e' di questo immobile»**. Senza la
  seconda meta' basterebbe cambiare il nome del file nell'indirizzo per
  sfogliare gli interni di casa d'altri tenendosi la propria chiave, che e'
  buona. `Cache-Control: private` e' obbligatorio: l'indirizzo contiene la
  chiave e non deve fermarsi in nessuna cache condivisa.

- **Il Passo 4: la pagina.** `src/app/tracking/[token]/page.tsx`. Testata con
  via, comune, zona e prezzo; le foto; **le visite** (quante, con le date, e gli
  appuntamenti in programma in un riquadro a parte); **a che punto siamo**, una
  scala dall'incarico al rogito con il gradino di adesso in evidenza; chi segue
  la casa. Nessun javascript di client: e' tutta renderizzata dal server, il che
  su una pagina pubblica e' una cosa in meno che puo' rompersi.

  `ritirato` **sta fuori dalla scala** e ha un riquadro suo: metterlo in fondo
  direbbe al proprietario che il ritiro viene dopo il rogito.

  Verificata in browser vero su un telefono (390x844), 17 controlli, piu' 23 sul
  contenuto della pagina. L'archivio di prova e' costruito apposta con **tutto
  quello che non deve uscire gia' scritto dentro** — cognome del visitatore nel
  campo «Cosa», il suo cellulare e la sua email, prezzo minimo, provvigione,
  note interne, giudizio sulla visita — e la prova va a cercarli uno per uno
  nella pagina consegnata. Nessuno esce.

**Due cose trovate dal browser, che il codice non mostrava:**

1. **`ml-2` non e' uno spazio.** «2 visite finora» era due elementi accostati
   da un margine: a occhio giusto, nel testo della pagina «2visite finora», che
   e' come lo legge una sintesi vocale. Lo spazio va scritto.
2. **La cache teneva in vita le foto dopo la revoca.** Il server rispondeva
   404 correttamente, ma la rotta copiava da `/foto/[id]/[file]` un
   `max-age` di un anno con `immutable`: le foto gia' scaricate continuavano ad
   aprirsi da quel browser per dodici mesi. Ora sono **cinque minuti** — bastano
   a non riscaricare la galleria mentre si scorre, e fanno mordere la revoca
   quasi subito. Sull'altra rotta un anno resta giusto: li' non c'e' revoca.

- **Il Passo 5: il riquadro sulla scheda dell'agente.**
  `immobili/[id]/tracking-box.tsx`, con le tre azioni `creaLinkTracking`,
  `rigeneraLinkTracking` e `revocaLinkTracking` in `actions.ts`. Il link non
  esiste finche' non lo si crea: il riquadro parte da un pulsante solo.
  Il messaggio WhatsApp passa da **`whatsappHref()`** — i numeri in archivio
  sono senza +39 e `wa.me` a mano non aprirebbe nessuna chat — e porta dentro
  il nome del proprietario e la via, perche' chi ha due immobili con noi deve
  capire di quale gli stiamo parlando.

  **`ownerPhoneForProperty` e' una funzione a se' e non un campo in
  `PropertyRow`**: quel tipo lo costruiscono **tre** query diverse, e un campo
  aggiunto al tipo ma non a tutte e tre sarebbe `undefined` in due pagine su
  tre senza che TypeScript dica niente — gli oggetti si costruiscono con un
  cast. E' la stessa trappola degli incroci fra colleghi, evitata stavolta
  prima di scriverla.

  `CopyField` si e' spostata da `agenda/calendario/` a `components/client.tsx`:
  da quando la usano due pagine, il suo posto e' fra gli attrezzi condivisi.

- **Il recapito dell'agenzia** sta in **`AGENZIA`** (`types.ts`): nome,
  ragione sociale e telefono **3927282442**, dato da Camillo il 4 settembre.
  Scritto li' e non in archivio perche' l'agenzia e' una sola, e una tabella di
  configurazione con dentro una riga sarebbe una tabella in piu' da riempire.
  Gli utenti del gestionale **non hanno un campo telefono**: per questo anche
  il consulente, sulla pagina del proprietario, risponde a quel numero.

  Verificato in browser da capo a fondo, 17 controlli: l'agente entra, apre la
  scheda, crea il link, e lo stesso indirizzo si apre **in un browser senza
  cookie** mostrando la casa giusta; poi lo toglie, e quell'indirizzo non apre
  piu' niente. Compresi i due `wa.me` col prefisso `39` davanti e il `tel:`
  che parte davvero.

  **Trappola nelle prove:** i pulsanti pericolosi chiedono conferma con
  `window.confirm`, e **Playwright annulla ogni dialogo** se non gli si dice
  altro (`page.on("dialog", (d) => d.accept())`). Senza quella riga la revoca
  non parte e il controllo fallisce dando la colpa al codice. E la prova va
  fatta ripartire **azzerando `tracking_token`**: alla seconda corsa il
  pulsante «Crea il link» non c'e' piu', perche' la prima lo ha gia' creato.

- **Il Passo 6: i portali.** `src/lib/portali.ts` tiene l'elenco `PORTALI`
  (idealista e Immobiliare.it) e `collegamentoAnnuncio()`. Due colonne nuove,
  `listing_idealista` e `listing_immobiliare`: due e non una lista, perche' i
  portali sono due e due caselle con la loro etichetta si compilano senza
  spiegazioni. Il costo di aggiungerne un terzo sta scritto in cima a
  `portali.ts` — poco, ma non gratis.

  **Il controllo che vale davvero non e' che sia un indirizzo: e' che sia il
  sito giusto.** Due caselle vicine, e incollare l'annuncio di idealista sotto
  Immobiliare.it e' l'errore piu' facile del mondo — il proprietario si
  vedrebbe scritto «pubblicata su Immobiliare.it» con sotto un collegamento che
  porta altrove, che e' peggio di non scriverlo affatto.

  Sulla pagina del proprietario la sezione **«Dove è pubblicata»** mostra solo i
  portali dove la casa c'e' davvero, e **sparisce del tutto** se non e'
  pubblicata da nessuna parte: una riga «non pubblicata su X» non racconta come
  va la vendita, racconta cosa l'agenzia non ha fatto. Quella riga serve in
  ufficio, e sulla scheda dell'immobile infatti c'e', vuota compresa.

- **Il richiamo che vale di piu': gli annunci da togliere.**
  `IMMOBILE_ANNUNCIO_DA_TOGLIERE` in `queries.ts`, scritta una volta sola come
  le sorelle, conta gli immobili **venduti o ritirati che hanno ancora un
  annuncio online**. Un annuncio rimasto pubblicato dopo il rogito porta
  telefonate per una casa che non c'e' piu', e nessuno se ne accorge finche' non
  squilla il telefono. Il collegamento del cruscotto porta `gruppo=tutti`, che
  qui e' obbligatorio: venduti e ritirati stanno fra gli «altri».

  **Le parentesi esterne di quella condizione non sono decorative:** senza,
  l'`OR` fra i due portali si mangerebbe l'`AND` sullo stato e il numero
  comprenderebbe tutto il portafoglio pubblicato. La prova lo verifica.

  **Non e' stato fatto** il richiamo gemello «in vendita e non pubblicato da
  nessuna parte». Oggi darebbe 53 su 53 — Camillo ha appena cominciato a
  pubblicare a mano — e un numero che comprende tutto non e' un richiamo, e'
  rumore. Quando gli annunci saranno caricati, e' una condizione di tre righe.

  **`SELECT` e segnaposto:** aggiungendo le due colonne, l'`INSERT` di
  `saveProperty` si e' ritrovato con 29 colonne e 27 `?`. TypeScript non se ne
  accorge e il build passa: si rompe al primo salvataggio. Contati a macchina,
  colonne e parametri, prima di provare — vale la pena rifarlo ogni volta che
  si tocca quella query.

  Verificato: 6 controlli sulla condizione del richiamo (comprese le parentesi
  e la casella di soli spazi) e **15 in browser** — il cruscotto che conta, il
  collegamento che apre esattamente la riga promessa, l'annuncio incollato
  nella casella sbagliata che viene rifiutato **senza portare via le note**, il
  salvataggio buono, e la sezione che sparisce quando la casa non e' pubblicata.
  Piu' le prove di prima rifatte: 38 + 17, tutte verdi.

#### I nomi e le osservazioni sulla pagina — fatto

**Camillo ha cambiato idea la sera del 4 settembre**, e questa decisione
sostituisce quella della mattina. Nella pagina del proprietario ora ci sono il
**nome di chi ha visitato**, le **sue osservazioni**, e **data e ora**.

Non e' un allargamento rispetto a come lavora l'agenzia: il foglio stampato di
`/immobili/[id]/visite` porta gia' nome, cognome, **telefono** e commento, e si
consegna a mano da sempre. La pagina da' **meno** di quel foglio.

Cosa resta fuori, e perche':

- **telefono ed email**, per sua richiesta esplicita: il nome dice al
  proprietario chi e' entrato in casa sua, il numero gli darebbe il modo di
  scavalcare l'agenzia;
- **`notes`**, che sono i promemoria dell'agente e non le parole del cliente.
  Le osservazioni stanno in **`outcome`**, il campo «Cosa ha detto il cliente»;
- **`title`**, e questa non cambia: e' il campo «Cosa», dove si scrive «Visita
  sig. Rossi». Adesso il nome ha la sua colonna, e prenderlo anche da li'
  vorrebbe dire prenderlo due volte per una strada che nessuno controlla;
- **`interest`**, che e' il giudizio dell'agente sul cliente.

**Il visitatore portato da un collega: «Collaborazione con altra agenzia».**
Deciso da lui. La visita e le osservazioni si vedono, il nome no — verrebbe
dall'archivio di un altro collaboratore. La regola sta nella query: il nome esce
solo se `clients.owner_id` coincide con `properties.agent_id`, e un cliente
senza titolare cade dalla parte prudente.

**La data e' `due_at`, con l'ora** (`dateTime()`), non `done_at`: e' la stessa
che stampa il foglio, e due pagine che raccontano la stessa visita non possono
dire due date diverse.

Verificato: 20 controlli sul contenuto della pagina, compresi il nome del
cliente del collega che **non** esce, i due telefoni che non escono, e le note
interne di entrambi gli agenti.

#### Idealista: la casella c'e', i numeri no

`properties.idealista_owner_url`, campo **Pagina idealista per il proprietario**
sulla scheda. Non sta nell'elenco `PORTALI` ed e' separata anche a schermo:
gli annunci dimostrano che la casa e' pubblicata, quei conteggi sono di
idealista e non nostri. Sulla pagina del proprietario compare sotto una riga,
con scritto che le visite alla casa sono quelle sopra.

**Si incolla a mano e solo se lui vuole.** Al 4 settembre i numeri di idealista
non erano ancora stati verificati, e resta da fare a lui:

1. generare dal pannello idealista il link del proprietario di **un** immobile e
   aprirlo **in incognito** — che e' anche l'unico modo di vedere quello che
   vede il venditore;
2. controllare che nel link non compaia la parola **`PLUS`** scritta a lettere:
   e' base64, e il copia-incolla a volte trasforma un `+` in quella parola;
3. rifarlo su uno dei **due immobili di Trepuzzi**, online da 455 giorni, e
   confrontare. Serve perche' sull'immobile di Via dei Palumbo idealista dava
   *1.221 visite* con **0 giorni di pubblicazione**, e quel numero non torna;
4. dire cosa scrive la **ⓘ** accanto a *«Rendimento dell'annuncio»*: non e'
   chiaro se quei numeri siano dell'annuncio o della media della zona.

Finche' non lo fa, la casella resta vuota e la sezione non compare: il codice
non aspetta niente, aspetta lui. **Da qui non si verifica:** la rete verso
l'esterno e' chiusa e idealista non si raggiunge.

#### La firma e il sito (7 settembre)

Due richieste sue, fatte insieme.

**Firma la coordinatrice, non l'agente.** `AGENZIA.coordinatrice` in
`types.ts`, oggi *Virginia*. Vale per il messaggio WhatsApp del link e per il
**foglio delle visite** da stampare, che prima portava il nome di chi aveva
fatto l'accesso — cioe' una firma diversa a seconda di chi premeva il pulsante.
Non e' stata toccata la scheda **«Chi segue la tua casa»** sulla pagina del
proprietario: li' c'e' l'agente, ed e' giusto — sono due cose diverse, chi
segue l'immobile e chi firma quello che l'agenzia manda. Se un giorno volesse
Virginia anche li', e' una riga.

**Il nostro sito e' diventato un portale.** Colonna `listing_sito`, e una voce
in cima a `PORTALI`: il sito dell'agenzia e' un posto dove l'immobile e'
pubblicato come gli altri, e cosi' entra da solo nella sezione «Dove e'
pubblicata» e nel messaggio, senza codice suo. Il controllo sul dominio vale
anche per lui: un link di idealista incollato nella casella del sito viene
rifiutato.

**Il messaggio dell'invito** porta ora, sotto il link riservato, l'elenco dei
posti dove l'annuncio e' online — solo quelli compilati — e in fondo la firma.

**Ogni portale ha due nomi, e servono tutti e due.** `nome` e' come lo chiamiamo
al proprietario («Vedi l'annuncio su **Mondo Immobiliare**»: lui non sa cosa sia
«il nostro sito»); `etichetta` e' come lo chiamiamo in ufficio, sulla casella
(«**Annuncio sul nostro sito**»). Se ne accorse Camillo guardando la schermata:
«Annuncio su Mondo Immobiliare» accanto a «Annuncio su Immobiliare.it» sono due
nomi che si somigliano troppo, e chi compila di fretta sbaglia casella.

**salentoproperties.com non serve**, glielo e' stato chiesto il 7 settembre.

**La trappola pagata qui, e vale per il prossimo portale.** Con due portali la
scelta del campo era un ternario `chiave === "idealista" ? a : b`, ripetuto in
**quattro** file. Al terzo portale quel ternario **compila ancora** e sbaglia in
silenzio: tiene il secondo campo per tutti quelli dopo il primo. Adesso c'e'
`annuncioDi(portale, immobile)` in `portali.ts`, che indicizza per nome di
colonna ed e' controllato da TypeScript. **Aggiungere un portale non deve piu'
voler dire cercare gli `if` sparsi.**

Verificato: 97 controlli, tutte le prove **rifatte due volte di fila** per
essere sicuri che siano indipendenti — tre di loro sporcavano l'archivio e non
lo rimettevano a posto, e la seconda corsa falliva dando la colpa al codice.
Adesso ognuna riparte da uno stato noto.

**Il muro, per chi scrive il prossimo pezzo.** Ogni lettura di `queries.ts`
vuole per primo l'id di chi guarda, e qui non c'e' nessuno che ha fatto
l'accesso. Il muro non sparisce, **cambia forma**: la chiave apre *un immobile
solo*, e ogni lettura va agganciata a quell'`id`. Una funzione scritta senza
pensarci non filtrerebbe niente.

#### La guida di Gemini: cosa se ne tiene

`INTEGRAZIONE_CLAUDE.md` e' arrivato il 4 settembre ed e' stato letto tutto.

**La forma e' buona e si tiene**: pagina pubblica a schede, i portali come
*registro di garanzia* con i link di verifica invece di API che non esistono,
la roadmap dall'incarico al rogito, la scheda del consulente, e il riquadro
sulla scheda immobile per mandare il link su WhatsApp.

**Il codice no, e non e' un dettaglio di stile.** Sette cose, tutte verificate
contro il database vero:

1. `SELECT p.*` sulla vista del proprietario: porta fuori **prezzo minimo,
   provvigioni, prezzo di vendita e note interne**. E' la trappola gia' scritta
   qui sopra per gli incroci fra colleghi, qui fuori dall'agenzia.
2. **Tre colonne che non esistono**: `users.full_name`, `users.phone`,
   `clients.full_name`. Sono `users.name`, niente telefono sugli utenti, e
   `clients.first_name`/`last_name`. La pagina sarebbe morta al primo
   caricamento.
3. La lettura delle attivita' porta `title`, `notes`, `outcome` e `interest`
   ed e' etichettata «anonima». **Non lo e'**: `title` e' il campo «Cosa», dove
   si scrive «Visita sig. Rossi».
4. Uno script che genera il token **per tutti e 53 gli immobili** e li stampa a
   video. Cinquantatre link vivi che nessuno ha chiesto, piu' l'elenco delle
   chiavi in un registro.
5. Token da 8 byte (16 caratteri), la meta' di quello del calendario. Qui se ne
   usano 24, come per il calendario.
6. `cleanPhone(...)` non esiste, e `wa.me` scritto a mano e' una trappola gia'
   pagata: i numeri in archivio sono senza +39, si passa da `whatsappHref()`.
7. `logQuickViewingAction` **non controlla che l'immobile sia di chi scrive** —
   un buco nel muro — e restituisce `{success:true}` invece della convenzione
   dei rifiuti del punto 20.

Tre delle cinque schede previste (**feedback a stelle, offerte, storico
prezzi**) non si costruiscono: le ha escluse Camillo. Vanno tolte, non lasciate
vuote — un riquadro sempre vuoto su una pagina che il proprietario guarda e'
peggio che non averlo.

#### B · Pubblicazione sui portali

**Fatto nuovo, e grosso: ha dismesso Casagest24** — il gestionale che pubblicava
i suoi annunci su immobiliare.it e idealista — **e ha cominciato a pubblicare a
mano**, per usare questo CRM come fonte della verita'.

**Il rischio da verificare prima che disdica**, gli e' stato detto e la risposta
non e' ancora arrivata: i 36 annunci vivi su idealista li ha caricati
Casagest24. Allo stacco **restano o vengono ritirati?** E si possono modificare
a mano, o il feed sovrascrive? Se cadono, vanno ricaricati *prima* di staccare.
Gli e' stato anche detto di conservare il file scaricato oggi, che e' la
fotografia dei 36 annunci come Casagest24 li ha lasciati.

Le tre strade, come gliele ho messe:

1. **Aiuti alla pubblicazione a mano** — testo dell'annuncio gia' scritto dai
   dati, foto pronte, il segno di **dove e' pubblicato** con i codici, e il
   richiamo quando cambia il prezzo o l'immobile si vende («va aggiornato anche
   su…»). Sta tutto in `crm/`, non dipende da nessuno, si fa subito. **Il pezzo
   che vale di piu' e' il richiamo:** un annuncio rimasto online dopo il rogito
   porta telefonate per una casa che non c'e' piu'. Stesso stampo del riquadro
   *Da sistemare*.
2. **Il flusso XML verso i portali** — la strada vera, quella che faceva
   Casagest24. Il file lo so scrivere (stesso lavoro del generatore iCalendar),
   ma **il formato e' loro e non si indovina**: serve la specifica tecnica di
   ogni portale. E alcuni accettano flussi **solo da gestionali accreditati** —
   se rispondono cosi', la strada e' chiusa. Vuole anche **le foto raggiungibili
   da fuori**, che oggi stanno dietro l'accesso di proposito: e' una scelta da
   fare apposta, non un dettaglio.
3. **Entrare nel pannello al posto suo** — esclusa e da non riproporre:
   condizioni d'uso, rischio sull'account che gli porta i clienti, e si rompe in
   silenzio.

#### Cosa si e' scoperto sui portali

**idealista ha gia' la pagina per il proprietario.** Si genera dal pannello e si
manda per email o WhatsApp. **Il link e' per immobile ed e' stabile** —
verificato su due immobili diversi, due link diversi. Quindi **si salva nel
gestionale in un campo sulla scheda**, come `video_url`.

Cosa mostra (visto in uno screenshot suo, l'immobile M105 di Via dei Palumbo):

- **il logo e i recapiti della sua agenzia**, non quelli di idealista — il
  timore che fosse una loro vetrina non si e' avverato;
- riquadro *Rendimento dell'annuncio*: **visite all'annuncio, preferiti,
  contatti, visite all'immobile**;
- *Pubblicato su 3 Portali*: idealista, **casa.it**, **PACKMAX** — e
  immobiliare.it non c'e';
- **«0 visite all'immobile»**: idealista ha il posto per quel numero e non lo sa
  riempire. **E' esattamente il buco che l'applicazione per i venditori deve
  riempire**, ed e' il motivo per cui le due pagine si completano invece di
  sovrapporsi.

**Due cose restano da verificare** prima di fidarsi di quei numeri, e gli sono
state chieste: *1.221 visite* su un annuncio con **0 giorni di pubblicazione**
non torna (va confrontato con un immobile di storia nota, per esempio i due di
Trepuzzi online da 455 giorni); e la scritta «Confrontato con la media della
zona per immobili simili» non chiarisce se quei numeri siano dell'annuncio o
della media. Se mandiamo al proprietario un numero che significa un'altra cosa,
la figura e' sua.

**Attenzione al link:** e' base64, e un `+` puo' arrivare come la parola
letterale `PLUS` passando dal copia-incolla. Si prova aprendolo in una finestra
in incognito — che e' anche il modo di vedere quello che vede il proprietario.

**Il file di esportazione di idealista** (sezione *Immobili*) e' stato letto col
lettore xlsx del gestionale, che lo apre senza problemi. **Non contiene
statistiche**: nessuna delle 74 colonne ha visualizzazioni o contatti. Contiene
pero' tre cose utili — la colonna **Riferimento** (il codice suo) accanto a
**Codice** (quello di idealista), che e' **il legame** e c'e' su 31 annunci su
36; **via e numero civico di tutti e 36**, utili a completare gli indirizzi
mancanti in archivio; e due misure di andamento gia' pronte, **giorni online**
(mediana 168, i due piu' vecchi 455) e **qualita' annuncio** (mediana 85,
quattro annunci a 70 — voto che influenza quanto idealista li mostra, alzarlo e'
visibilita' gratis). **Cinque annunci non hanno il riferimento** e resterebbero
scollegati.

#### Le domande in sospeso, tutte sue

1. Ai portali, **prima di disdire Casagest24**: se il collegamento col gestionale
   esterno si interrompe, gli annunci restano o vengono ritirati? Si modificano
   a mano?
2. A idealista e immobiliare.it: *«Ho un gestionale mio. Posso mandarvi gli
   annunci con un flusso XML? Mi mandate la specifica tecnica e come si attiva?
   Accettate flussi da software non accreditati?»*
3. Su quali portali vuole essere, oltre a idealista e immobiliare.it.
4. Se il numero delle visite su un immobile di storia nota e' credibile, e cosa
   dice la ⓘ accanto a «Rendimento dell'annuncio».

> **Da qui non si verifica niente di tutto questo:** la rete verso l'esterno e'
> chiusa in queste sessioni. `idealista.it` risponde *bloccato dal proxy*, e
> anche `gestionale.mondoimmobiliarelecce.it` non si raggiunge. Le verifiche sui
> siti le fa lui, o si fanno con Claude nel suo browser da una sessione sua.

### Il calendario in Google: era gia' fatto

Glielo aveva chiesto ed e' bastato indicarglielo: *Agenda → Calendario e
avvisi*, si copia l'indirizzo e si incolla in Google Calendar (*Altri calendari
→ + → Da URL*). Nessuna password, nessun account collegato. Provato da qui
chiedendo il file senza cookie, come farebbe Google: risponde, con l'ora
italiana giusta e la sveglia a −30 minuti.

**La cosa da non dimenticare:** quella sveglia **Google la ignora** — non fa
suonare gli avvisi dei calendari a cui ci si abbona, li mostra e basta. Apple e
Outlook la usano. Percio' l'abbonamento serve a *vedere* l'agenda, non a essere
avvisati: per l'avviso restano il pulsante *Calendario* sulla riga e l'email.
Scritto anche in `README.md` e `CONSEGNA.md`, che prima non lo dicevano.

### Fuori perimetro, in attesa di una sua decisione

Pubblicazione annunci sui portali, firma digitale, invii massivi
email/WhatsApp, generazione automatica dei contratti in PDF, app da scaricare.

---

## 6 · Come si lavora su questo codice

**Convenzioni date per acquisite:**

- codice e commenti **in italiano**, come il resto del progetto;
- i commenti spiegano **perché**, non cosa: la riga di codice si legge da sola,
  il motivo per cui è scritta così no;
- **nessuna dipendenza superflua.** Il lettore Excel e il generatore iCalendar
  sono scritti a mano apposta. Le sole dipendenze sono `better-sqlite3`,
  `sharp`, `nodemailer`, oltre a Next/React/Tailwind;
- **si verifica con un browser vero** prima di dire che funziona. Il metodo
  usato: server di prova su una porta libera con `CRM_DB_PATH` su un database
  usa-e-getta nello scratchpad, dati di prova via `better-sqlite3`, Playwright
  con `executablePath: "/opt/pw-browsers/chromium"` (i pacchetti si prendono
  con un symlink da `/opt/node22/lib/node_modules/`, **da rimuovere dopo**);
- **i `.txt` non si scrivono a mano.** `CONSEGNA.txt` e `HANDOFF.txt` sono i
  gemelli in testo semplice dei rispettivi `.md`, e si rifanno con
  `npm run testo` (`npm run testo -- --controlla` dice solo se sono indietro).
  Toccato un `.md`, si rilancia — erano stati scritti a mano e sono rimasti
  indietro di tre settimane senza che se ne accorgesse nessuno;
- prima di dichiarare finito: `npx tsc --noEmit`, `npm run build` e
  `npm run testo`.

### Trappole già pagate (non ripeterle)

- **`due_at` è ora locale senza fuso** (viene da `<input datetime-local>`),
  mentre `date('now')` in SQLite è **UTC**. Ogni confronto fra i due usa
  `date('now','localtime')`. Nei file di calendario l'orario va portato com'è
  con `TZID=Europe/Rome`, senza passare da `Date`.
- **Le colonne nuove** non arrivano da `CREATE TABLE IF NOT EXISTS`: si
  aggiungono nell'elenco `COLONNE_AGGIUNTE` in `src/lib/db.ts`.
- **Aggiungendo una colonna a `properties`, conta i `?` dell'INSERT.** In
  `saveProperty` colonne e segnaposto stanno in due punti diversi della stessa
  query: ne aggiungi una e i `?` restano quelli di prima. **Ha morso tre volte
  in due giorni** — TypeScript non se ne accorge, `next build` passa, e si
  rompe al primo salvataggio. Si contano a macchina, non a occhio:
  `python3` che spacchetta la lista fra parentesi e conta i `?`. Vale anche per
  l'UPDATE, che vuole un parametro in piu' (l'id in fondo).
- **Servizio, cron e file della posta** stanno in `deploy/servizi.sh`, usato
  sia da `installa.sh` sia da `aggiorna.sh`: scritti solo dall'installazione,
  un aggiornamento non li applicherebbe mai.
- **nginx**: `client_max_body_size 32M` (senza, l'importazione muore) e
  `X-Forwarded-Proto` (senza, non si entra dagli altri computer).
- **I campi di un modulo non montati non vengono inviati**: se un blocco è
  condizionale, i valori già registrati vanno passati come campi nascosti,
  altrimenti il salvataggio li cancella.
- **Le tendine troncate** (`LIMIT 500`) scollegano in silenzio ciò che sta
  oltre il taglio: il valore attuale va sempre inserito fra le opzioni.
- **React svuota da solo i campi** quando l'azione di un modulo finisce
  (`form.reset()`). Su un modulo lungo rifiutato per un campo mancante porta
  via anche i ventiquattro giusti. `<ModuloConEsito>` lo ferma con
  `onReset={(e) => e.preventDefault()}`: quella riga non va tolta.
- **Un rifiuto si restituisce, non si lancia.** Il testo di un `throw` non esce
  dal server a programma pubblicato: si vede in sviluppo e sparisce una volta
  online, che è il modo peggiore di sbagliare. Vedi il punto 20.
- **Le prove sui messaggi vanno fatte sulla build di produzione**
  (`npm run build` + `npx next start`), mai in sviluppo: lì i messaggi si
  vedono comunque e ogni prova passa.
- **Lo spazio dopo un tag di chiusura sparisce se il testo va a capo**, e
  questa e' la forma che ha morso di piu': `<strong>mai</strong> per i` con
  «per i calendari...» che prosegue sulla riga dopo rende **«maiper»**. Nel
  sorgente lo spazio si vede, sulla stessa riga del tag, e sembra a posto —
  **e' React che lo toglie**, e lo si scopre solo leggendo l'HTML servito. Ci
  sono cascato due volte nella stessa settimana, la seconda dopo aver guardato
  il sorgente e dichiarato che era giusto. La cura e' `{" "}` esplicito:
  `</strong>{" "}` a fine riga. Il 16 settembre ne sono stati corretti **26**
  in 10 file, e la prova che li tiene fermi non legge il sorgente: apre dodici
  pagine e cerca `</strong>` attaccato a una lettera nell'HTML.
- **Lo spazio dopo `{espressione}` sparisce se il testo va a capo.** In JSX,
  `posta, {PREAVVISO_MINUTI} minuti prima di` seguito a capo da altro testo
  rende **«30minuti»**: la riga successiva viene ripulita e con lei se ne va lo
  spazio iniziale. Se invece il testo dopo l'espressione **non** va a capo (o la
  riga finisce con `{" "}`), lo spazio resta. E' la sorella della trappola
  dell'`ml-2`, e come quella **non si vede nel codice**: `tsc` e `next build`
  passano, e a occhio la riga sembra giusta. Si trova solo leggendo il testo
  della pagina in un browser. Cura: tenere espressione e parola sulla stessa
  riga, e andare a capo con `{" "}`.
- **Il fuso, per la terza volta: mai far passare un orario da `new Date`.**
  `new Date("2026-09-20T16:30:00")` viene letta come ora **locale** e
  `toISOString()` la riscrive in **UTC**: sul server, che gira con
  `TZ=Europe/Rome`, ogni orario si sposta di due ore. Vale per i file
  iCalendar (`TZID`), per gli avvisi del telefono e per gli eventi mandati a
  Google (`piuMinuti` in `google.ts`): i conti si fanno su numeri senza fuso, e
  il fuso viaggia in un campo accanto. Non da' errore, sposta e basta.
- **Il confronto per contenimento va bene per le zone, non per i comuni.**
  `samePlace` considera uguali due luoghi quando uno contiene l'altro, ed e'
  quello che serve fra le zone («Centro» / «Centro storico»). Fra i comuni
  faceva passare *Monteroni di Lecce* per *Lecce* — sette comuni su otto
  confusi contenevano «Lecce». Per i comuni c'e' **`sameComune`**, che tollera
  la provincia in coda e il nome accorciato **solo all'inizio**. Le due
  funzioni non sono intercambiabili: se aggiungi un confronto su un luogo,
  guarda prima **di cosa** stai parlando.
- **I numeri di telefono dell'archivio sono senza +39**: per WhatsApp si passa
  da `whatsappHref()` in `src/lib/format.ts`, mai da `wa.me` a mano.
- **La posta del dominio non sta dove sta il gestionale.** Il server è su Aruba,
  ma le caselle `@mondoimmobiliarelecce.it` sono su **SiteGround** insieme al
  sito: lo dicono l'MX (`mailspamprotection.com`) e `mail.mondoimmobiliarelecce.it`
  (35.214.x.x). E l'IP di Aruba non è nell'SPF del dominio: far spedire il
  server per conto suo manderebbe tutto nello spam. **`SMTP_HOST` però non è
  quello:** quella strada si è fermata sulla password della casella `info@`, e
  dal 2 settembre si spedisce da **Gmail** (`smtp.gmail.com`, capitolo 5). Il
  motivo per cui il pezzo qui sopra resta scritto è l'SPF — vale anche adesso,
  ed è la ragione per cui ci si appoggia a una casella vera invece di far
  spedire il server da solo.
- **La password per le app di Google si incolla con gli spazi dentro, e i due
  lettori del file non sono d'accordo.** Google la mostra a gruppi di quattro;
  con `SMTP_PASS=abcd efgh ijkl mnop` la shell (`set -a; . /etc/mondo-crm.env`)
  si ferma al primo spazio e la variabile **non arriva affatto**, mentre systemd
  legge tutta la riga, spazi compresi. Cioè `npm run posta` e il servizio vero
  possono dire due cose diverse sulla stessa riga. `posta.mjs` adesso li nomina
  tutti e due — vedi il punto 23.

---

## 7 · Il controllo periodico della PR

C'è un promemoria automatico che rientra **il primo di ogni mese**, alle 07:00
UTC (le 9 in Italia). Era ogni ora fino al 4 agosto, poi giornaliero, e dal
**9 settembre 2026 è mensile**: lo ha chiesto lui, e ha ragione — la PR è in
bozza, nessuno la revisiona, e un controllo che dice sempre «niente di nuovo»
si smette di leggere.

Cosa fare quando arriva, dal più economico al più caro:

1. **Conflitti.** `git fetch origin jules-4092590956749443987-c47f811b claude/real-estate-client-management-app-xl7dnx`, poi
   `git merge-base --is-ancestor origin/jules-...  origin/claude/...`: se la
   base è già dentro il ramo, **nessun conflitto è possibile** e non serve
   chiedere altro.
2. **Revisioni e commenti.** `mcp__github__pull_request_read` con `get_reviews`
   e `get_comments`.
3. **CI.** Se la testa del ramo non è cambiata dall'ultima volta, non possono
   essere cambiate nemmeno quelle.

**Non chiedere `mergeable_state` con `pull_request_read get`:** quella chiamata
si porta dietro 26 KB di descrizione della PR a ogni controllo, e i tre passi
qui sopra dicono la stessa cosa gratis.

Se non è cambiato nulla, si **ri-arma con `send_later` per il primo del mese
successivo**, senza scrivere a Camillo. Se invece è cambiato qualcosa, gli si
scrive.

Si usa `send_later` e non `create_trigger`: un promemoria ricorrente vero parte
in una sessione nuova, senza gli strumenti `mcp__github__*`, e non riuscirebbe
a leggere la PR. `send_later` invece rientra **in questa sessione**, che gli
strumenti ce li ha — e sopravvive anche a un `/clear`, perché è legato al
numero della sessione e non alla conversazione. Il testo del promemoria è però
scritto per bastare a se stesso, nel caso il contesto non ci sia più.

**Stato all'ultimo controllo (9 settembre 2026):** aperta in bozza, nessun
conflitto possibile, **nessuna CI configurata**, nessuna review, un solo
commento — il bot Gemini del 2 agosto che annuncia la propria dismissione, da
ignorare.

Il controllo si ferma solo quando la PR viene unita o chiusa, o se lo chiede
lui.

---

## 8 · Da sapere sull'ambiente di lavoro

- La sessione gira in un **container isolato**: il repository viene clonato da
  zero e sparisce a fine sessione. **Quello che non è pushato è perso.**
- **Non c'è accesso SSH al server dell'agenzia** e non c'è il comando `gh`: per
  GitHub si usano gli strumenti `mcp__github__*`.
- Chromium è già installato in `/opt/pw-browsers/chromium`; non lanciare
  `playwright install`.
- File temporanei nello scratchpad indicato dal sistema, mai in `/tmp`.

---

## 9 · Prima frase utile per la chat nuova

Ce ne sono due, una corta e una lunga. **Non sono magiche:** tutto quello che
dicono sta gia' scritto qui dentro, e servono solo a far leggere questo file
alla chat nuova, che parte senza memoria di niente.

### La versione corta — per una domanda qualsiasi

Due righe, da incollare prima della domanda. Bastano per chiedere dov'e' una
cosa, come si fa qualcosa, o per farsi spiegare un pezzo del programma.

> Lavoriamo sul gestionale in `crm/` (ramo
> `claude/real-estate-client-management-app-xl7dnx`). Leggi `crm/HANDOFF.md`
> prima di rispondermi, e vale la regola fissa del capitolo 0: in questa
> finestra solo `crm/`.

Il motivo per cui vale la pena anche solo di queste due righe non e' la
cortesia: e' **la regola del capitolo 0**. Una chat che non la conosce, se lui
nomina di sfuggita il sito o i social, si mette a lavorarci — ed e' esattamente
la cosa che quella regola esiste per impedire.

### La versione lunga — per cominciare un lavoro

Quando c'e' da costruire qualcosa. Aggiunge la cosa che il file da solo non da':
**a che punto siamo adesso**, cioe' cos'e' l'ultima cosa fatta e cosa e' in
ballo. Risparmia un giro di domande.

> Riprendo il gestionale di Mondo Immobiliare (`crm/`, ramo
> `claude/real-estate-client-management-app-xl7dnx`, PR #2, online su
> https://gestionale.mondoimmobiliarelecce.it). Ho letto `HANDOFF.md`,
> `CONSEGNA.md` e `README.md`, e vale la **regola fissa del capitolo 0**: in
> questa finestra si lavora solo su `crm/`, niente altri progetti.
>
> So che ogni collaboratore vede solo le proprie schede (capitolo 10-bis di
> `CONSEGNA.md`), **con una sola apertura**: dalla pagina Utenti il titolare
> prende i link dei calendari dei colleghi. L'ultima cosa fatta e' il
> **collegamento vero a Google Calendar** (*Utenti → Google Calendar*): gli
> abbonamenti `.ics` erano troppo lenti — Google li ricontrolla quando decide
> lui — e adesso e' il gestionale a scrivere gli appuntamenti dentro Google
> appena si salvano. Aspetta che lui faccia i sei passi su Google Cloud del
> capitolo 10-ter di `CONSEGNA.md`. Prima c'era una **correzione agli
> incroci**: negli «immobili da valutare» arrivavano comuni diversi da quelli
> chiesti, perche' «Lecce» sta dentro «Monteroni di Lecce» e il confronto si
> fermava li'. Prima ancora, gli **avvisi sul telefono**:
> 30 minuti prima di ogni appuntamento arriva una notifica, a programma chiuso,
> su iPhone Samsung e Xiaomi allo stesso modo. Si accendono da *Agenda →
> Calendario e avvisi*, un telefono alla volta, e **non c'e' niente da
> configurare sul server** — le chiavi se le genera il programma. Prima c'era
> **Mondo Tracking**, la pagina `/tracking/[token]` per il proprietario.
>
> **Tre cose che ho deciso io e che non si rimettono in discussione da sole:**
> l'**SMTP e' rimandato** (troppo complicato, la parte che manca sta su Google);
> la **pubblicazione sui portali** e' rimandata; e per gli avvisi ho scelto le
> **notifiche del gestionale** invece della posta. Non me le riproponete a ogni
> finestra: quando voglio ripartire lo dico io.
>
> **Le tre decisioni sul tracking che il codice segue:** il proprietario vede il
> **nome** di chi ha visitato e le sue **osservazioni**, mai i recapiti; se il
> visitatore e' cliente di un collega compare **«Collaborazione con altra
> agenzia»**; e le comunicazioni al venditore le firma **Virginia**.
>
> **L'unica cosa in sospeso che aspetta me:** provare gli avvisi su un telefono
> vero, col pulsante *Mandami una prova*. Da voi non si verifica — a Google e
> ad Apple la rete di quelle sessioni non arriva. Se vi dico che non arrivano,
> il messaggio d'errore che vedo e' gia' scritto per dirvi dove guardare.
>
> Dimmi da dove ripartiamo.
