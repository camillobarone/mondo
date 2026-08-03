# Mondo Immobiliare — Gestione clienti

Gestionale per la gestione dei clienti e del portafoglio immobili di Studio RCS Srls
(Mondo Immobiliare Lecce e Porto Cesareo).

Fa una cosa sola e la fa bene: **tenere in ordine clienti, richieste, immobili e
appuntamenti, e dire ogni mattina chi va richiamato e perché**. La pubblicazione
degli annunci sui portali resta dove sta oggi: non passa da qui.

---

## Cosa fa

| Area | In pratica |
|---|---|
| **Clienti** | Anagrafica completa, tipo di cliente (venditore, acquirente, locatore…), provenienza del contatto, etichette, storico di ogni telefonata ed email |
| **Richieste** | Cosa cerca ogni acquirente: zona, budget, metratura, requisiti irrinunciabili |
| **Immobili** | Portafoglio con incarico, scadenze, prezzo minimo riservato, storico dei ribassi, visite, feedback e **foto** |
| **Venditori** | I proprietari, con gli immobili che ti hanno affidato e lo stato di ciascuno |
| **Resoconto** | Una pagina da stampare per il proprietario: quanti lo cercano, chi si è fermato sul prezzo, cosa hanno detto i visitatori |
| **Incroci** | Il programma abbina da solo richieste e immobili, e ti dice chi chiamare — e per chi non l'ha proposto, ti dice perché |
| **Agenda** | Cose da fare, appuntamenti, compleanni della settimana, promemoria per i clienti trascurati e gli incarichi in scadenza. Si modificano e si eliminano, entrano nel tuo calendario e avvisano 30 minuti prima |
| **Trattative** | Proposte d'acquisto, compromesso, rogito e provvigioni |
| **Report** | Da dove arrivano i clienti che comprano davvero, tempi medi di vendita, rendimento per collaboratore |
| **Adempimenti** | Consenso privacy con data, dati per l'adeguata verifica antiriciclaggio, registro di chi ha fatto cosa |

Non incluso in questa versione: invio annunci ai portali, firma digitale,
invii massivi di email/WhatsApp, generazione automatica dei contratti, app da
scaricare (si usa dal browser, anche dal telefono), fatturazione.

---

## Primo avvio

Servono **Node.js 22 o successivo** e un terminale.

```bash
cd crm
npm install          # installa le dipendenze (una volta sola)
npm run seed         # crea il database e il primo utente
npm run build        # prepara la versione veloce
npm start            # avvia il programma
```

Poi apri **http://localhost:3000** e accedi con l'email e la password che il
comando `seed` ha stampato a schermo. **Annotale subito: non vengono più mostrate.**

Per scegliere tu email e password:

```bash
npm run seed -- --email tuonome@mondoimmobiliarelecce.it --password "una password lunga"
```

Per provarlo con dei dati finti prima di inserire quelli veri:

```bash
npm run seed -- --demo
```

### Durante lo sviluppo

```bash
npm run dev          # ricarica da solo a ogni modifica, su http://localhost:3000
```

---

## La ricerca, il cruscotto e WhatsApp

**Cerca** — nella colonna a sinistra (e nel menu, dal telefono) c'è un campo di
ricerca unico: clienti e immobili insieme. Il caso tipico è il telefono che
squilla: scrivi il numero che vedi sul display — anche solo un pezzo, anche
scritto con gli spazi — e arrivi alla scheda prima di rispondere. Funziona
anche con nome, email, riferimento (`MI-2041`) e zona.

**Da sistemare** — sul cruscotto c'è un riquadro con le mancanze che non si
vedono finché non fanno danno: acquirenti senza una richiesta aperta (che
quindi gli incroci non vedono), immobili senza proprietario collegato,
documenti antiriciclaggio scaduti, clienti senza consenso privacy. Ogni numero
si clicca e apre l'elenco già filtrato. Quando è tutto a posto, il riquadro
sparisce.

**Proponi su WhatsApp** — negli **Incroci**, e nella scheda immobile sotto *A
chi proporlo*, accanto a ogni abbinamento c'è un pulsante che apre WhatsApp con
la proposta **già scritta**: nome del cliente, immobile, zona, metri e prezzo.
La si può ritoccare prima di inviare, è testo normale. L'incrocio da solo non
vende: vende il messaggio mandato entro dieci minuti.

I numeri di telefono vengono messi in formato internazionale da soli: i numeri
dell'archivio sono quasi tutti senza +39, e senza questa correzione WhatsApp
aprirebbe una chat vuota o sbagliata.

---

## Portare dentro i clienti che hai già

1. Esporta l'archivio attuale dal gestionale che usi oggi. **Il file va bene
   com'è**: Excel (`.xlsx`) o CSV, indifferente. Il formato viene riconosciuto
   dal contenuto, non dal nome, e per il CSV anche il separatore (virgola,
   punto e virgola, tabulazione) e la codifica, accenti compresi.
   Non serve convertire niente: è il passaggio in cui si perdono i dati.
2. Nel programma, apri **Importa**.
3. **Prova prima con un file di 10 righe.** Controlla che i dati finiscano nelle
   colonne giuste, poi carica tutto.

Le colonne riconosciute (in qualsiasi ordine, le altre vengono ignorate):
`Nome`, `Cognome`, `Ragione sociale`, `Cellulare`, `Telefono`, `Email`,
`Indirizzo`, `Città`, `Codice fiscale`, `Ruolo`, `Provenienza`, `Etichette`, `Note`.

**Lo stesso posto importa anche gli immobili.** Il tipo di file viene
riconosciuto dalle intestazioni: se ci sono riferimento, tipologia e prezzo è
un portafoglio, altrimenti sono clienti. Dell'elenco immobili vengono letti
riferimento, contratto, tipologia, zona e comune, vani, metri, prezzo,
esclusiva e scadenza dell'incarico; il proprietario viene collegato alla sua
scheda cliente quando il telefono corrisponde a una già in archivio, altrimenti
nome e recapito restano nelle note. I doppioni si riconoscono dal riferimento
interno: reimportare lo stesso elenco non crea copie.

Vengono capiti anche i tracciati degli altri gestionali immobiliari:

- **`Cognome/Nome` in una colonna sola** viene diviso da solo, tenendo insieme
  i cognomi composti (*De Santis Anna* → cognome *De Santis*).
- **Più numeri nella stessa cella** (`3401112233/ 0832123456/`) finiscono uno
  nel cellulare e uno nel telefono; gli altri restano nelle note.
- **La colonna `Richieste`**, se contiene i blocchi `DETTAGLI RICHIESTA`, viene
  letta e trasformata in richieste vere: contratto, comune, zone, budget,
  metratura. Chi ne ha una diventa *acquirente* e **entra subito negli
  incroci**. Un cliente con più richieste ne ottiene una per ciascuna.
  Quello che non ha una casella corrispondente (camere, bagni, stato) finisce
  nelle note della richiesta, non si perde.

I doppioni vengono riconosciuti dal cellulare o dall'email e saltati, a meno che
non chiedi esplicitamente di importarli.

---

## Foto degli immobili

Si caricano dalla scheda dell'immobile, anche più d'una alla volta. Dal telefono
puoi scattarle sul momento.

Vengono **ridotte da sole** appena caricate: una foto da 10 MB scende sotto il
megabyte senza differenze visibili. Senza questo, cento immobili occuperebbero
decine di gigabyte e le schede impiegherebbero mezzo minuto ad aprirsi da
cellulare.

La prima foto è la **copertina**: è quella che compare nell'elenco immobili. Per
cambiarla, usa *Metti per prima* sotto la foto che preferisci.

Le foto si vedono **solo dopo l'accesso**: non sono in una cartella pubblica.
I file stanno in `data/foto/`, accanto al database, e finiscono nelle copie di
sicurezza insieme all'archivio.

Formati accettati: quelli delle fotocamere e dei telefoni, HEIC degli iPhone
compreso. Massimo 30 foto per immobile, 25 MB per foto.

---

## Copie di sicurezza

Tutto il programma vive in **un solo file**: `data/mondo.db`.

**La strada semplice, dal browser:** il titolare trova in **Utenti** il
pulsante *Scarica l'archivio*. Fa una copia coerente (anche mentre qualcuno
lavora) e la scarica sul computer: salvala sul disco esterno, una volta a
settimana. Lo scaricamento finisce nel registro accessi. Le foto non sono
comprese — quelle viaggiano con la copia notturna sul server.

```bash
npm run backup       # crea una copia in backup/, coerente anche a programma acceso
```

Le copie più vecchie di 60 giorni vengono cancellate da sole.

⚠️ **Per ripristinare una copia, ferma prima il programma.** Se sostituisci
`data/mondo.db` mentre il programma è acceso, quello continua a usare il file
vecchio e le modifiche finiscono nel nulla. L'ordine giusto è: ferma il
programma → sostituisci il file → riavvia.

**Fai in modo che questo comando giri ogni notte** e che la cartella `backup/`
finisca su un disco diverso o su un servizio cloud. È l'unica cosa che sta fra te
e la perdita dell'archivio.

Esempio di riga da aggiungere a `crontab -e` per un backup ogni notte alle 2:

```
0 2 * * * cd /percorso/di/crm && /usr/bin/npm run backup >> backup/backup.log 2>&1
```

---

## Quanto regge

Provato con un archivio delle dimensioni reali dell'agenzia — 3.000 clienti,
250 immobili, 600 richieste, 5.000 attività registrate:

| Operazione | Tempo |
|---|---|
| Importazione dei 3.000 clienti da CSV | 2 secondi |
| Apertura di qualsiasi elenco o scheda | meno di 2 decimi di secondo |
| Incroci su 480 richieste aperte | 2 decimi di secondo |
| Esportazione dei 3.000 clienti in Excel | meno di 1 decimo di secondo |

L'intero archivio occupa **2,2 MB**: sta su una chiavetta USB migliaia di volte.
C'è ampio margine — il programma reggerebbe dieci volte tanto senza affanno.

## Venditori e compleanni

**Venditori** è l'altra faccia dei clienti: non chi cerca, ma chi ti ha affidato
qualcosa da vendere. Ogni scheda mostra i recapiti e sotto l'elenco degli
immobili di quel proprietario, con prezzo e stato.

Ci finisce chi ha il ruolo *venditore* o *locatore*, **più chiunque risulti
intestatario di un immobile in portafoglio** anche senza avere il ruolo
spuntato: l'immobile collegato dice la stessa cosa, e non dipende da come è
stata compilata la scheda.

**Il collegamento fra venditore e immobile si fa da entrambe le parti**, perché
è lo stesso legame e lo si cerca da dove ci si trova in quel momento:

- dalla **scheda dell'immobile**, quando manca il proprietario compare un
  riquadro con una **ricerca**: scrivi cognome o numero di telefono e compaiono
  i clienti che corrispondono, ognuno con il suo pulsante *Collega*. Senza
  scrivere niente propone chi è già segnato come venditore. Una tendina con
  tutto l'archivio dentro non sarebbe utilizzabile, e filtrarla per ruolo
  renderebbe introvabile proprio chi serve: nelle schede importate quel ruolo
  non c'è quasi mai;
- dalla **scheda del cliente**, in fondo agli immobili di proprietà, si sceglie
  fra quelli ancora senza intestatario — così non si porta via per sbaglio
  l'immobile di qualcun altro.

Non è obbligatorio: un venditore che ha già venduto tutto resta in elenco senza
immobili collegati. Ma un immobile senza proprietario sì che è un problema, e
l'elenco immobili lo segnala in cima con il collegamento per vedere quali sono.

---

## Il resoconto per il proprietario

Sulla scheda di ogni immobile, in alto, c'è **Resoconto per il proprietario**:
una pagina sola, fatta per essere stampata e lasciata sul tavolo. Il pulsante
*Stampa o salva in PDF* apre la finestra di stampa; scegliendo "Salva come PDF"
invece della stampante si ottiene il file da mandare su WhatsApp.

Serve alla conversazione più difficile del mestiere: dire a chi vende che il
prezzo è fuori mercato. A parole è la tua opinione contro la sua. Con i numeri
della sua casa in mano è un fatto:

- **quanti clienti in archivio cercano davvero una casa così**, quanti contatti
  sono arrivati, quante visite sono state fatte, quante proposte;
- **chi si è fermato soltanto sul prezzo**: persone che cercavano quella
  tipologia in quella zona e il cui budget dichiarato non arriva alla cifra.
  Sotto, i prezzi a cui l'immobile rientrerebbe nel loro raggio, con **quanti
  acquirenti** ci sono a ciascuno, confrontati con quelli di oggi. Il
  proprietario sceglie fra numeri concreti invece di sentirsi dire "è caro";
- **le frasi dei visitatori**, come sono state scritte dopo il sopralluogo;
- **la storia del prezzo** e le proposte ricevute.

Sono tutti dati che già hai: nessun campo nuovo da compilare. Ma vanno
registrati — un immobile senza visite annotate e senza richieste collegate
produce un resoconto a zeri, che è a sua volta un'informazione, ma sul lavoro
fatto e non sulla casa.

Perché una visita ci finisca servono due cose, tutte e due nella riga della
visita:

1. **l'immobile collegato** — si sceglie dal menù *Immobile*, che c'è sia sulla
   scheda dell'immobile (già compilato), sia in agenda, sia sulla scheda del
   cliente;
2. **la visita segnata come fatta, con il commento**. Mettendo la spunta
   *Fatto* compare il campo **«Cosa ha detto il cliente»**: quello che scrivi lì
   finisce nel resoconto, virgolettato.

Il resoconto riporta **solo quel campo**, mai le *Note*. Le note sono i tuoi
promemoria — «portare la planimetria», «chiedere se scende» — e in un foglio
che si consegna al proprietario sembrerebbero frasi dette dal visitatore.

**I compleanni** compaiono in **Agenda**, in cima, da una settimana prima. Per
ognuno c'è il pulsante per chiamare e quello per mandare gli auguri su WhatsApp
**con il messaggio già scritto**. Basta compilare la data di nascita nella
scheda cliente.

È la telefonata che costa meno di tutte e vale più di molte altre. Se non
compare da sola il giorno giusto, però, non la fa nessuno.

---

## L'agenda nel tuo calendario, e l'avviso mezz'ora prima

Ogni riga dell'agenda ha ora **Modifica** e **Calendario**.

**Modifica** apre l'attività per intero — anche quelle già svolte. Si sposta
l'orario, si cambia il cliente o l'immobile, si aggiunge il commento che ci si
ricorda mezz'ora dopo, si toglie la spunta *Fatto* per rimetterla fra le cose da
fare, o si elimina. Prima l'unica strada era cancellare e riscrivere.

**Calendario** scarica quell'appuntamento e lo apre nel calendario del telefono
o del computer, con la sveglia già impostata **30 minuti prima**. È il modo più
affidabile di avere l'avviso: entra subito e suona anche a gestionale chiuso.

Da **Agenda → Calendario e avvisi** ci sono le altre due strade.

### Abbonare il calendario

C'è un indirizzo, uno per persona, che il calendario ricontrolla da solo:
Google, iPhone e Outlook lo capiscono allo stesso modo. Nella pagina c'è il
percorso esatto per ciascuno, e il pulsante per copiarlo.

Non è un account collegato: è un indirizzo. Vuol dire che non c'è niente da
autorizzare, ma anche che **quell'indirizzo vale come una password** — chi ce
l'ha vede i tuoi appuntamenti. Se finisce dove non doveva, dalla stessa pagina
se ne genera uno nuovo e il vecchio smette di rispondere.

> **Google ricontrolla quando decide lui**, anche dopo diverse ore: un
> appuntamento appena inserito può non comparire subito. Apple e Outlook sono
> più svelti. Per l'appuntamento di oggi usa **Calendario** sulla riga
> dell'agenda, che è immediato.

### L'avviso per email

Trenta minuti prima di ogni appuntamento parte un'email a chi ce l'ha in agenda,
con l'ora, il cliente, il suo numero e l'indirizzo dell'immobile. Non c'è niente
da attivare per singolo appuntamento: parte da sé.

Serve però che il server sappia spedire posta — è **una configurazione da fare
una volta sola**, spiegata in `CONSEGNA.md`. Finché non c'è, l'avviso per email
semplicemente non parte e tutto il resto funziona lo stesso.

---

## Perché un cliente non compare negli incroci

Il programma incrocia le **richieste**, non i clienti. Segnare un cliente come
*acquirente* non basta: finché non registri **cosa cerca** (zona, budget,
metratura), per il motore quel cliente non sta cercando niente.

Per questo, un acquirente senza richiesta aperta viene segnalato in rosso —
sia nell'elenco clienti (`manca la richiesta`) sia in cima alla sua scheda.

Se invece la richiesta c'è ma l'immobile non compare lo stesso, apri la scheda
dell'immobile: sotto agli abbinamenti c'è **Richieste scartate**, che elenca
nome per nome chi è stato escluso e di quanto.

---

## Metterlo online

Per usarlo dalle due sedi, o da casa, serve un server raggiungibile da internet.
Tutto il necessario sta in **[`deploy/`](deploy/README.md)**: un comando solo
installa il programma, l'avvio automatico, il certificato HTTPS, il firewall e
la copia di sicurezza notturna. Costo indicativo del server: 4-6 € al mese.

---

## Usarlo da più computer

Il programma gira su **un** computer e gli altri lo aprono dal browser: non va
installato su ognuno, e l'archivio resta uno solo.

**In ufficio, sulla stessa rete.** All'avvio il programma stampa due indirizzi:

```
- Local:    http://localhost:3000        <- il computer su cui gira
- Network:  http://192.168.1.7:3000      <- gli altri computer dell'ufficio
```

Il secondo si apre da qualsiasi computer, tablet o telefono collegato alla
stessa rete. Perché funzioni servono tre cose: il computer che lo ospita
acceso e con la finestra aperta, la porta 3000 aperta nel firewall di Windows,
e **un utente a testa** (si creano da *Utenti*) — non la stessa password per
tutti, altrimenti il registro accessi non dice più chi ha fatto cosa.

**Fra sedi diverse, o da casa.** La rete locale non basta: serve un server
raggiungibile da internet, con un indirizzo e un certificato HTTPS. È il
passaggio successivo, e cambia poco del programma: sposta soltanto dove gira.

---

## Chi vede cosa

Due ruoli:

- **Titolare** — vede tutto, comprese le provvigioni, la gestione degli utenti e
  il registro accessi.
- **Collaboratore** — vede clienti, immobili, richieste e agenda; non vede
  provvigioni né registro.

Gli utenti si creano da **Utenti** (solo il titolare).

---

## Privacy e antiriciclaggio

- Ogni scheda cliente registra **se e quando** è stato dato il consenso privacy,
  e a cosa. Le schede senza consenso sono segnalate con un avviso giallo.
- I campi per l'**adeguata verifica** (documento d'identità, numero, scadenza)
  sono nella scheda cliente: vanno compilati quando la trattativa si concretizza.
- Il **registro accessi** conserva chi ha creato, modificato, eliminato o
  esportato dati, con data e ora.
- L'eliminazione di un cliente è *logica*: la scheda sparisce dagli elenchi ma
  resta tracciata. La cancellazione definitiva su richiesta dell'interessato è
  riservata al titolare.

I dati non escono mai dal computer o dal server su cui gira il programma: non ci
sono servizi esterni coinvolti.

---

## Configurazione (opzionale)

Variabili d'ambiente, tutte facoltative:

| Variabile | A cosa serve | Valore predefinito |
|---|---|---|
| `CRM_DB_PATH` | Dove sta il file del database | `data/mondo.db` |
| `CRM_BACKUP_DIR` | Dove finiscono le copie di sicurezza | `backup/` |
| `CRM_SECRET` | Chiave per firmare le sessioni | generata e salvata in `data/secret.key` |
| `PORT` | Porta su cui gira il programma | `3000` |

---

## Com'è fatto (per chi mette le mani nel codice)

- **Next.js 16** (App Router, Server Components, Server Actions) e **React 19**
- **SQLite** via `better-sqlite3` — nessun server di database da installare
- **Tailwind CSS v4**
- Accesso con password (hash `scrypt`) e sessione su cookie firmato HMAC — nessuna
  dipendenza esterna per l'autenticazione

```
src/
  lib/
    schema.ts     struttura del database (applicata a ogni avvio, idempotente)
    db.ts         connessione e funzioni di base
    auth.ts       password, sessioni, controllo dei ruoli
    queries.ts    tutte le letture dal database
    actions.ts    tutte le scritture (Server Actions)
    matching.ts   il motore che incrocia richieste e immobili
    csv.ts        lettura e scrittura dei file CSV
    photos.ts     foto degli immobili: ridimensionamento e archiviazione
    xlsx.ts       lettura dei file Excel (senza dipendenze: lo ZIP lo apre zlib)
    import-map.ts i tracciati degli altri gestionali riportati ai nostri campi
    format.ts     date, euro, etichette
    types.ts      tipi e vocabolari dei menu a tendina
  components/     pezzi di interfaccia riusabili
  app/(app)/      le schermate del programma
scripts/
  seed.mjs        primo avvio e dati di esempio
  backup.mjs      copia di sicurezza
```

Il motore degli incroci (`matching.ts`) esclude un immobile solo su tre criteri
— tipo di contratto, budget **massimo** e metratura minima — e per il resto
assegna un punteggio. Il budget *minimo* non esclude mai: un immobile che costa
meno del previsto resta in elenco, segnalato, perché è comunque una telefonata
da fare. Così un immobile leggermente fuori parametro compare comunque, con
l'avviso del perché: la telefonata la decidi tu, non il programma.

Le zone si confrontano come le leggerebbe una persona: maiuscole, accenti e
punteggiatura non contano, e "Centro" trova "Centro storico". Chi viene escluso
finisce nel riquadro **Richieste scartate** della scheda immobile, con scritto
di quanto: `Mario Rossi — 12.000 € oltre il suo budget`.
