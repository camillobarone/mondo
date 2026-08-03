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
| **Immobili** | Portafoglio con incarico, scadenze, prezzo minimo riservato, storico dei ribassi, visite e feedback |
| **Incroci** | Il programma abbina da solo richieste e immobili, e ti dice chi chiamare — e per chi non l'ha proposto, ti dice perché |
| **Agenda** | Cose da fare, appuntamenti, promemoria per i clienti trascurati e gli incarichi in scadenza |
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

## Copie di sicurezza

Tutto il programma vive in **un solo file**: `data/mondo.db`.

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
