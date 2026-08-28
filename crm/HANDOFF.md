# Handoff — per riprendere in una chat nuova

Da incollare (o allegare) all'inizio di una nuova conversazione. Dice chi è
l'utente, cos'è già stato fatto, dove sta ogni cosa e cosa resta aperto.

**Aggiornato al 28 agosto 2026.**

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

---

## 5 · Cosa resta aperto

| Cosa | Stato |
|---|---|
| **Configurare SMTP** in `/etc/mondo-crm.env` sul server | **Cominciato il 27 agosto, fermo su una password.** Vedi il punto della situazione qui sotto. |
| **Inserire i dati dei venditori** | Rimandato da lui: *«dopo inserisco i dati dei venditori»*. |
| **Comune e zona anche sulla scheda immobile** | Deciso di rimandare: oggi «Cosa cerca» sceglie il comune da un elenco, ma sulla scheda dell'immobile comune e zona restano campi liberi. Gli incroci funzionano lo stesso — il confronto e' tollerante, «S. Cataldo» trova «San Cataldo» — ma su un immobile si puo' ancora scrivere una zona che in quel comune non esiste. Portare li' lo stesso selettore e' il passo naturale successivo. |
| **Zone da correggere** | `ZONE_PER_COMUNE` in `types.ts` e' una lista di partenza: fitta per Lecce e Porto Cesareo, piu' scarna altrove, e scritta senza conoscere il mercato. Va fatta correggere a lui — aggiungere una voce e' una riga. |
| **Completare l'indirizzo degli immobili vecchi** | Lavoro suo, a mano. L'indirizzo è obbligatorio solo per i salvataggi da adesso in poi; quelli già in archivio senza via mostrano il titolo al posto della via nelle liste finché qualcuno non li apre e lo aggiunge. **Da adesso però sa quali sono**: il cruscotto li conta e il numero apre l'elenco dei soli immobili da completare (punto 15). Nessun automatismo previsto: la via non si inventa. |
| **Controllo giornaliero della PR #2** | Vedi capitolo 7. |
| **Incroci fra colleghi** | **Fatto** (`/incroci/colleghi`, `incrociFraColleghi` in `matching.ts`). Le due letture che scavalcano il muro sono le uniche del programma, hanno la selezione delle colonne scritta campo per campo apposta — un `SELECT *` li' porterebbe fuori prezzo minimo, provvigioni e note — e la richiesta altrui non legge nemmeno `client_id`. Resta aperto: **contatti in comune** (il rilevamento doppioni non attraversa il muro, quindi due schede della stessa persona non vengono segnalate) e **richieste di cancellazione GDPR**, che vanno girate a voce al collega. |

### SMTP — dove siamo rimasti (sera del 27 agosto 2026)

**Si riprende da qui.** Manca **una cosa sola**: una password di posta che
funzioni. Tutto il resto è fatto e verificato.

**Fatto e confermato:**

- Il server ha già `scripts/posta.mjs` (`aggiorna.sh` lanciato, file da 7.992
  byte, identico a quello del repository).
- `/etc/mondo-crm.env` è scritto: 5 righe, `SMTP_HOST=mail.mondoimmobiliarelecce.it`,
  `SMTP_PORT=465`, `SMTP_USER` e `SMTP_FROM` su `info@mondoimmobiliarelecce.it`,
  `SMTP_PASS` con dentro una password di 15 caratteri. Permessi `640 root:mondo`.
  La copia del file com'era prima sta in **`/etc/mondo-crm.env.prima`**.
- **Host e porta sono giusti per certo.** Non è più una deduzione dai DNS: il
  pannello SiteGround li scrive uguali — *server in uscita*
  `mail.mondoimmobiliarelecce.it`, *porta SMTP* `465` (e IMAP 993). Il comando
  di prova arriva fino alla richiesta di accesso, quindi nome risolto,
  connessione aperta e SSL stabilito.

**Dov'è il muro:** la password di `info@mondoimmobiliarelecce.it` che lui aveva
trovato **non è più valida**. Provate tutte e due le forme dell'utenza —
`info@mondoimmobiliarelecce.it` e `info` — e il server le rifiuta entrambe con
la stessa password. Da qui non c'è altro da provare.

Escluse per strada, così non si rifanno:

- **la `@` nella password non c'entra.** Provato: `@`, `!` e `#` arrivano
  interi al server di posta. L'unico carattere che si perde è il **`$`**, che
  il sistema si mangia insieme a tutto quello che segue.
- **il file non è mangiato.** 5 righe (nessuna riga spezzata da un ritorno a
  capo incollato) e la password lunga come dev'essere.

**Le due strade, da decidere con lui:**

1. **Casella nuova dedicata** (`gestionale@` o `crm@`), password scelta da lui
   sul momento. È la strada che aveva scelto, perché non tocca `info@`.
   Primo tentativo **fallito** con un errore generico di SiteGround — *«An
   error occurred. Please try again later»* — che di solito è passeggero. Se
   fallisce ancora: controllare quante caselle esistono (tetto del piano) e lo
   spazio su disco (se è pieno, SiteGround rifiuta con errori vaghi così).
2. **Rifare la password di `info@`** da *Site Tools → Email → Accounts*, tre
   puntini → *Change Password*. Funziona di sicuro. Costo: dove quella casella
   è configurata (Outlook, telefoni) va rimessa anche lì.

**La domanda da fargli per prima:** `info@` è configurata su Outlook o sui
telefoni dell'ufficio? Se **no**, strada 2 e si chiude in cinque minuti. Se
**sì**, si insiste sulla 1.

**Quando avrà una password certa**, mancano due passaggi:

```
ssh root@77.81.234.151 -t "nano /etc/mondo-crm.env"     # freccia giù ×3, Fine, riscrive la password
ssh root@77.81.234.151 "set -a; . /etc/mondo-crm.env; set +a; cd /opt/mondo-crm && sudo -E -u mondo node scripts/posta.mjs"
```

Se ha creato una casella nuova, **prima** vanno cambiate anche `SMTP_USER` e
`SMTP_FROM` — con un `printf` come quello che ha già dato le quattro righe, così
in nano tocca sempre e solo la riga della password. Poi `--manda` per l'email
vera e `systemctl restart mondo-crm`.

> Nota per chi guida i comandi: `ssh` gli chiede **la password di root a ogni
> comando** (si vede negli screenshot), non usa la chiave come dice il capitolo
> 2 di `CONSEGNA.md`. Non è un problema, ma vuol dire che ogni comando in più
> gli costa una digitazione: meglio pochi comandi lunghi che molti corti.

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
- **I numeri di telefono dell'archivio sono senza +39**: per WhatsApp si passa
  da `whatsappHref()` in `src/lib/format.ts`, mai da `wa.me` a mano.
- **La posta del dominio non sta dove sta il gestionale.** Il server è su Aruba,
  ma le caselle `@mondoimmobiliarelecce.it` sono su **SiteGround** insieme al
  sito: lo dicono l'MX (`mailspamprotection.com`) e `mail.mondoimmobiliarelecce.it`
  (35.214.x.x). `SMTP_HOST` è `mail.mondoimmobiliarelecce.it`. E l'IP di Aruba
  non è nell'SPF del dominio: far spedire il server per conto suo manderebbe
  tutto nello spam.

---

## 7 · Il controllo periodico della PR

C'è un promemoria automatico che rientra **una volta al giorno**, alle 07:00
UTC (le 9 in Italia), con questo testo:

> Controllo giornaliero della PR camillobarone/mondo#2 (gestionale clienti):
> verifica stato CI, eventuali commenti di revisione e conflitti di merge. Se
> non è cambiato nulla, ri-arma il controllo per il giorno dopo alle 07:00 UTC
> silenziosamente, senza scrivere all'utente.

Cosa fare quando arriva: leggere lo stato della PR #2, e
**se non è cambiato nulla ri-armarlo con `send_later` per il giorno dopo**,
senza scrivere all'utente.

Era ogni ora fino al 4 agosto 2026, poi lui ha chiesto di diradarlo. Il
promemoria si crea con `send_later` e non con `create_trigger`: un promemoria
ricorrente vero parte senza gli strumenti `mcp__github__*` e non riuscirebbe a
leggere la PR.

Stato noto all'ultimo controllo: aperta in bozza, `mergeable_state: clean`,
**nessuna CI configurata**, nessuna review, un solo commento (il bot Gemini del
2 agosto, da ignorare).

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

> Riprendo il gestionale di Mondo Immobiliare (`crm/`, ramo
> `claude/real-estate-client-management-app-xl7dnx`, PR #2, online su
> https://gestionale.mondoimmobiliarelecce.it). Ho letto `HANDOFF.md`,
> `CONSEGNA.md` e `README.md`. So che ogni collaboratore vede solo le proprie
> schede (capitolo 10-bis di `CONSEGNA.md`), che gli incroci fra colleghi sono
> fatti, e che l'ultima cosa costruita (27 agosto 2026) è il primo contatto
> del cliente più gli elenchi dedicati «Immobili proposti»/«Immobili
> visionati» con inserimento diretto — capitolo 4, punto 13. Restano da
> configurare l'SMTP per gli avvisi email — **cominciato, fermo su una password
> di posta da rifare su SiteGround: leggi «SMTP, dove siamo rimasti» nel
> capitolo 5** — da inserire i dati dei venditori e da completare l'indirizzo
> sugli immobili vecchi che non ce l'hanno. Vale la regola fissa del capitolo 0:
> in questa finestra si lavora solo su `crm/`. Dimmi da dove ripartiamo.
