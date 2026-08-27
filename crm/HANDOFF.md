# Handoff — per riprendere in una chat nuova

Da incollare (o allegare) all'inizio di una nuova conversazione. Dice chi è
l'utente, cos'è già stato fatto, dove sta ogni cosa e cosa resta aperto.

**Aggiornato al 27 agosto 2026.**

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

---

## 5 · Cosa resta aperto

| Cosa | Stato |
|---|---|
| **Configurare SMTP** in `/etc/mondo-crm.env` sul server | **Non fatto, ma pronto.** Finché manca non partono né l'avviso *email* 30 minuti prima né *Password dimenticata?* (il calendario funziona lo stesso). Procedimento riscritto nel capitolo **6-bis** di `CONSEGNA.md`, con i dati giusti e il comando di prova `npm run posta`. **Lo deve fare lui**: da qui non c'è rotta verso il server (porta 22 in timeout, verificato) e la password della casella ce l'ha solo lui. |
| **Inserire i dati dei venditori** | Rimandato da lui: *«dopo inserisco i dati dei venditori»*. |
| **Completare l'indirizzo degli immobili vecchi** | L'indirizzo è obbligatorio solo per i salvataggi da adesso in poi. Gli immobili già in archivio senza via continuano a mostrare il titolo al posto della via nelle liste, finché qualcuno non li apre e lo aggiunge. Nessuna fretta, nessun automatismo previsto. |
| **Controllo giornaliero della PR #2** | Vedi capitolo 7. |
| **Incroci fra colleghi** | **Fatto** (`/incroci/colleghi`, `incrociFraColleghi` in `matching.ts`). Le due letture che scavalcano il muro sono le uniche del programma, hanno la selezione delle colonne scritta campo per campo apposta — un `SELECT *` li' porterebbe fuori prezzo minimo, provvigioni e note — e la richiesta altrui non legge nemmeno `client_id`. Resta aperto: **contatti in comune** (il rilevamento doppioni non attraversa il muro, quindi due schede della stessa persona non vengono segnalate) e **richieste di cancellazione GDPR**, che vanno girate a voce al collega. |

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
- prima di dichiarare finito: `npx tsc --noEmit` e `npm run build`.

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
> configurare l'SMTP per gli avvisi email, da inserire i dati dei venditori e
> da completare l'indirizzo sugli immobili vecchi che non ce l'hanno. Vale la
> regola fissa del capitolo 0: in questa finestra si lavora solo su `crm/`.
> Dimmi da dove ripartiamo.
