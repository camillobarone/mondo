# Consegna — Gestionale Mondo Immobiliare

Documento di riferimento per riprendere il lavoro fra sei mesi, o per passarlo a
un'altra persona. Contiene dove sta ogni cosa, chi la gestisce, cosa è stato
fatto e cosa è rimasto fuori.

**Aggiornato al 2 settembre 2026.** Esiste anche come `CONSEGNA.txt`, stessa cosa
in testo semplice, da aprire con il Blocco note senza bisogno di niente.

> **Nessuna password è scritta qui**, di proposito: questo file sta dentro il
> repository. Dove sono conservate è indicato di volta in volta.

---

## 1 · In una riga

CRM per Studio RCS Srls (Mondo Immobiliare Lecce, FIMAA dal 1994, uffici Lecce e
Porto Cesareo). Gestisce clienti, richieste d'acquisto, portafoglio immobili,
incroci automatici, venditori, trattative e adempimenti. Si usa dal browser, in
italiano, anche da telefono. Online su server proprio, con HTTPS e copia
notturna automatica.

**Indirizzo: https://gestionale.mondoimmobiliarelecce.it**

---

## 2 · Gli indirizzi e chi li gestisce

| Cosa | Dove | Note |
|---|---|---|
| `mondoimmobiliarelecce.it` (il sito) | **SiteGround** | invariato, non è stato toccato |
| `gestionale.mondoimmobiliarelecce.it` (il CRM) | **Aruba Cloud VPS** | aggiunto in questa sessione |

Il DNS del dominio è su SiteGround — i name server sono `ns1.siteground.net` e
`ns2.siteground.net`. Il sottodominio è stato creato lì, come **record A** nella
zona DNS (*Site Tools → Domain → DNS Zone Editor*), non con lo strumento
"Subdomains" (che avrebbe creato una cartella sull'hosting del sito, cosa
diversa).

```
Tipo: A    Nome: gestionale    Valore: 77.81.234.151
```

Sono due macchine diverse: il sito resta su SiteGround, il gestionale sta su
Aruba. Se un giorno si cambia server, si cambia solo quel valore.

### SiteGround

- pannello: **siteground.com** → Websites → `mondoimmobiliarelecce.it` → Site Tools
- credenziali: quelle del sito, in possesso di chi lo segue
- serve solo se si cambia l'IP del server o si aggiungono altri sottodomini

### Aruba Cloud

- pannello: **Cloud Management Platform** di Aruba (`cloud.aruba.it`)
- account cloud: **ARU-352439**
- prodotto: **Bare Metal e VPS → Cloud VPS**, taglia **O2A4**
  — 2 vCPU, 4 GB RAM, 40 GB disco, **6,29 €/mese + IVA**
- sistema: **Ubuntu 24.04**
- IP pubblico: **77.81.234.151** (IPv4, indispensabile)
- accesso: **SSH come `root`**, con la chiave caricata alla creazione

> Attenzione a non confonderlo con "Public Cloud → Cloud Server PRO", che è un
> prodotto diverso e costa più del doppio (13,70 €/mese) per le stesse esigenze.
> Il piano giusto sta sotto **Bare Metal e VPS**.

**Perché almeno 2 GB di RAM:** la compilazione del programma tocca i 900 MB e su
un piano da 1 GB viene interrotta a metà. Lo script di installazione, sotto i
3 GB, aggiunge da sé 2 GB di memoria di scambio.

**Perché IPv4:** i piani solo-IPv6 costano meno ma non sono raggiungibili dalla
maggior parte delle connessioni italiane.

**GDPR:** Aruba è nell'Unione Europea e fornisce l'accordo sul trattamento dei
dati (art. 28 GDPR) da tenere agli atti — loro responsabili del trattamento, tu
titolare.

---

## 3 · Il codice

- repository GitHub: **`camillobarone/mondo`**
- ramo di lavoro: **`claude/real-estate-client-management-app-xl7dnx`**
- pull request aperta: **#2**
- il programma sta nella cartella **`crm/`**

Il server scarica direttamente da questo ramo: se si cambia ramo, vanno
aggiornati gli URL dentro `crm/deploy/installa.sh` e `crm/deploy/aggiorna.sh`.

### Documentazione già nel repository

| File | Cosa contiene |
|---|---|
| `crm/README.md` | come si usa, funzione per funzione — è il manuale |
| `crm/deploy/README.md` | come si mette online da zero, aggiornamenti, ripristini |
| `crm/CONSEGNA.md` | questo documento |
| `crm/HANDOFF.md` | per far ripartire una conversazione nuova con Claude senza perdere il filo |

`CONSEGNA.txt` e `HANDOFF.txt` sono gli stessi due documenti in **testo
semplice**, da aprire con il Blocco note senza bisogno di niente — sono quelli
da stampare e tenere in cartella. **Non si scrivono a mano**: si rifanno dai
`.md` con un comando, e finché lo si usa non possono più restare indietro.

```bash
cd crm && npm run testo              # li riscrive
cd crm && npm run testo -- --controlla   # dice solo se sono indietro
```

Erano stati scritti a mano una volta e poi dimenticati: il 28 agosto 2026 erano
fermi al 5, e raccontavano un programma di tre settimane prima.

---

## 4 · Come è fatto dentro

| | |
|---|---|
| Framework | **Next.js 16.2.4** (App Router, Server Components, Server Actions) |
| Linguaggio | **TypeScript**, React 19.2.4 |
| Grafica | **Tailwind CSS v4** |
| Archivio | **SQLite** con `better-sqlite3` v13, modalità WAL |
| Immagini | **sharp** (ridimensiona a 1920 px + miniatura 480 px) |
| Accesso | password con **scrypt**, cookie di sessione firmato in HMAC |

Nessun database esterno, nessun servizio a pagamento, nessuna dipendenza da
terzi oltre l'hosting. **Non ci sono chiamate verso l'esterno**: l'archivio
resta sulla macchina.

### File chiave

| File | Ruolo |
|---|---|
| `src/lib/schema.ts` | lo schema del database, unica fonte di verità, applicato all'avvio |
| `src/lib/queries.ts` | tutte le letture |
| `src/lib/actions.ts` | tutte le scritture (Server Actions) |
| `src/lib/matching.ts` | il motore degli incroci |
| `src/lib/auth.ts` | accesso, password, sessioni |
| `src/lib/xlsx.ts` | lettore di file Excel scritto a mano, senza librerie |
| `src/lib/import-map.ts` | riconoscimento dei tracciati del gestionale precedente |
| `src/lib/photos.ts` | salvataggio e ridimensionamento delle foto |
| `src/lib/calendar.ts` | generazione dei file di calendario (iCalendar) |

### Due dettagli che sembrano scelte estetiche e invece non lo sono

1. **`serverExternalPackages`** in `next.config.ts`. `better-sqlite3` è un
   modulo nativo e senza quella riga la compilazione fallisce; `nodemailer` fa
   richieste che il compilatore non sa seguire e impacchettarlo rompe l'invio
   delle email.
2. Il cookie di sessione mette `secure` in base a **`x-forwarded-proto`**, non a
   `NODE_ENV`. Con `NODE_ENV` l'accesso funzionava sul computer dove girava il
   programma e falliva silenziosamente su tutti gli altri dell'ufficio.

---

## 5 · Sul server, dove sta cosa

| | |
|---|---|
| Cartella del programma | `/opt/mondo-crm` |
| Archivio | `/opt/mondo-crm/data/mondo.db` |
| Foto | `/opt/mondo-crm/data/foto/<id immobile>/` |
| Chiave delle sessioni | `/opt/mondo-crm/data/secret.key` (generata da sola, 0600) |
| Copie di sicurezza | `/opt/mondo-crm/backup/` |
| Utente di sistema | `mondo` (non amministratore) |
| Servizio | `mondo-crm` (systemd) |
| Porta interna | 3000, **solo su 127.0.0.1** |
| Reverse proxy | nginx, `/etc/nginx/sites-available/mondo-crm` |
| Certificato | Let's Encrypt via certbot, si rinnova da sé |
| Firewall | ufw: aperte solo 22, 80, 443 |
| Copia notturna | cron, `/etc/cron.d/mondo-crm`, ogni notte alle **02:00** |
| Copia fuori dal server | stesso cron, il **primo di ogni mese** alle 03:00, su Google Drive via `rclone` (capitolo 7-bis) |
| Avvisi email | stesso cron, ogni **5 minuti**, `scripts/promemoria.mjs` |
| Configurazione posta | `/etc/mondo-crm.env` (fuori dal programma, sopravvive agli aggiornamenti) |
| Fuso orario | `TZ=Europe/Rome` nel servizio e nel cron |

Il programma può scrivere soltanto in `data/`, `backup/` e `.next/`
(`ProtectSystem=strict` nel servizio systemd).

### Due impostazioni nginx da non perdere

```nginx
client_max_body_size 32M;                        # senza, l'importazione fallisce
proxy_set_header X-Forwarded-Proto $scheme;      # senza, non si entra
```

Il valore predefinito di nginx è **1 MB**: un file Excel dell'archivio lo supera
e l'importazione muore con un errore che non spiega niente.

---

## 6 · I comandi che servono davvero

Tutti da PowerShell sul PC, o da qualunque terminale.

**Aggiornare** dopo una modifica al codice:
```
ssh root@77.81.234.151 "bash /opt/mondo-crm/deploy/aggiorna.sh"
```
Fa una copia prima di toccare qualsiasi cosa, e se il programma non riparte lo
dice invece di lasciare al buio.

**Vedere se sta bene:**
```
ssh root@77.81.234.151 "systemctl status mondo-crm"
ssh root@77.81.234.151 "journalctl -u mondo-crm -n 50"
```

**Fare subito una copia** (senza aspettare la notte):
```
ssh root@77.81.234.151 "cd /opt/mondo-crm && sudo -u mondo node scripts/backup.mjs"
```

**Portare le copie sul PC** — da fare una volta a settimana, su disco esterno.
Da PowerShell, due comandi: il primo porta l'archivio (tutte le copie
storiche), il secondo le foto.
```
scp root@77.81.234.151:/opt/mondo-crm/backup/*.db "F:\Gestionale backup"
scp -r root@77.81.234.151:/opt/mondo-crm/backup/foto "F:\Gestionale backup"
```
Non c'è più un pulsante nel programma che scarichi l'intero archivio: da quando
ognuno vede solo le proprie schede, sarebbe la separazione aggirata con un clic
(capitolo 10-bis). Questa è la strada, ed è anche l'unica che porta via le foto.

Se il secondo comando risponde `No such file or directory`, vuol dire che la
copia notturna non è ancora passata dopo questo aggiornamento. Basta forzarla
una volta e la cartella c'è:
```
ssh root@77.81.234.151 "cd /opt/mondo-crm && sudo -u mondo node scripts/backup.mjs"
```

**Ripristinare** una copia (**l'ordine conta**: prima si ferma il programma):
```
systemctl stop mondo-crm
cp /opt/mondo-crm/backup/<copia>.db /opt/mondo-crm/data/mondo.db
chown mondo:mondo /opt/mondo-crm/data/mondo.db
systemctl start mondo-crm
```

**Creare un nuovo utente** dalla riga di comando (di solito si fa da *Utenti*
nel programma):
```
cd /opt/mondo-crm && sudo -u mondo npm run seed -- --email nome@dominio.it --password "una password lunga"
```

**Installazione da zero** su un server nuovo:
```
curl -fsSL https://raw.githubusercontent.com/camillobarone/mondo/claude/real-estate-client-management-app-xl7dnx/crm/deploy/installa.sh \
  | bash -s -- gestionale.mondoimmobiliarelecce.it tua@email.it
```

### Nota per PowerShell

Le virgolette annidate non funzionano come su Linux. Questo **perde il `cd`** e
dà `Cannot find module`:
```
ssh root@IP 'sudo -u mondo bash -c "cd /opt/mondo-crm && node scripts/backup.mjs"'
```
Va scritto così:
```
ssh root@IP "cd /opt/mondo-crm && sudo -u mondo node scripts/backup.mjs"
```

---

## 6-bis · Far partire gli avvisi per email

Da questa configurazione dipendono **due cose**: l'avviso 30 minuti prima di
ogni appuntamento, e il collegamento di *Password dimenticata?*. Il meccanismo è
già installato e gira; manca solo dirgli da quale casella spedire.
**Si fa una volta sola.**

### La casella è su SiteGround, non su Aruba

Sono due macchine diverse e si confondono facilmente: il **gestionale** sta su
Aruba, la **posta** del dominio sta su SiteGround insieme al sito. Lo dicono i
DNS del dominio:

| Cosa dice il DNS | Come si legge |
|---|---|
| MX → `mx10.antispam.mailspamprotection.com` | il filtro antispam di SiteGround: la posta in arrivo va lì |
| `mail.mondoimmobiliarelecce.it` → `35.214.190.219` | un indirizzo SiteGround |
| SPF → `include:…spf.auto.dnssmarthost.net` | sempre SiteGround |

Quindi l'host da mettere è **`mail.mondoimmobiliarelecce.it`**. Un esempio con
`smtps.aruba.it` — che stava scritto qui fino al 27 agosto 2026 — porta a una
configurazione che non funziona e non dice perché.

Lo conferma il pannello stesso: in *Site Tools → Email → Accounts*, il riquadro
**Configurazione email** riporta *server in uscita* `mail.mondoimmobiliarelecce.it`,
**porta SMTP 465** (e IMAP 993 per la posta in arrivo). Se un domani cambiassero,
è lì che si guarda.

**Perché non far spedire direttamente il server del gestionale.** L'SPF del
dominio elenca chi è autorizzato a spedire per `@mondoimmobiliarelecce.it`, e
l'IP del server Aruba (`77.81.234.151`) **non c'è**. Spedendo da lì le email
risulterebbero non autorizzate e finirebbero nello spam. Appoggiandosi alla
casella SiteGround spedisce SiteGround, che l'SPF autorizza già: nessun record
DNS da toccare.

### I tre comandi

**1.** Apri il file:

```
ssh root@77.81.234.151 -t "nano /etc/mondo-crm.env"
```

Il **`-t`** non è un dettaglio: senza, `ssh` non apre un terminale vero e nano
non parte («unable to open the terminal»). Serve per qualunque programma a
schermate — nano, `rclone config`, `top`.

Compila le cinque righe. La casella dev'essere una che esiste davvero in
*Site Tools → Email → Accounts* su SiteGround:

```
SMTP_HOST=mail.mondoimmobiliarelecce.it
SMTP_PORT=465
SMTP_USER=info@mondoimmobiliarelecce.it
SMTP_PASS=la-password-della-casella
SMTP_FROM=info@mondoimmobiliarelecce.it
```

`SMTP_USER` è **l'indirizzo completo**, non solo `info`, e la password è quella
della **casella**, non quella del pannello SiteGround. Se la password contiene
spazi, apici o `$`, mettila fra apici singoli. Salva con `Ctrl+O`, `Invio`, ed
esci con `Ctrl+X`.

**2.** Prova che sia giusta, **prima** di riavviare:

```
ssh root@77.81.234.151 "set -a; . /etc/mondo-crm.env; set +a; cd /opt/mondo-crm && sudo -E -u mondo npm run posta"
```

Non spedisce niente: apre la connessione, fa l'accesso e dice se ha funzionato.
Se qualcosa non va **dice quale delle cinque righe è sbagliata** — nome
inesistente, porta chiusa, cifratura sbagliata per quella porta, utenza o
password rifiutate, mittente rifiutato. Si corregge il file e si ridà lo stesso
comando.

Se la 465 non risponde, prova `SMTP_PORT=587`: SiteGround accetta tutte e due,
e alcune reti bloccano una delle due in uscita.

**3.** Mandane una vera a te stesso, poi riavvia:

```
ssh root@77.81.234.151 "set -a; . /etc/mondo-crm.env; set +a; cd /opt/mondo-crm && sudo -E -u mondo npm run posta -- --manda"
ssh root@77.81.234.151 "systemctl restart mondo-crm"
```

Il riavvio serve perché il programma legge quel file solo all'avvio: finché non
lo fai, gli avvisi partono dal cron ma *Password dimenticata?* continua a dire
che la posta non è configurata.

### Se l'email non arriva

Il comando ha detto «spedita» ma in casella non c'è niente: allora non è più un
problema di configurazione. Guarda nella **posta indesiderata**; se è lì, è la
reputazione del mittente. Il registro degli invii automatici sta in
`/opt/mondo-crm/backup/promemoria.log`.

Per vedere quali avvisi manderebbe il cron in questo momento, senza spedirli:

```
ssh root@77.81.234.151 "set -a; . /etc/mondo-crm.env; set +a; cd /opt/mondo-crm && sudo -E -u mondo node scripts/promemoria.mjs --prova"
```

Attenzione: questo comando **non prova la configurazione**. Non apre nessuna
connessione, quindi passa anche con la password sbagliata, e se non ci sono
appuntamenti nella mezz'ora dice solo «nessun appuntamento». Per sapere se la
posta funziona serve `npm run posta`.

Il file contiene una password, quindi lo leggono solo `root` e il programma
(`chmod 640`). Sta fuori dalla cartella del gestionale apposta: un
aggiornamento non lo tocca.

---

## 7 · Le copie di sicurezza

- una a notte alle **02:00**, in `/opt/mondo-crm/backup/`
- si usa l'**API di backup di SQLite**: la copia è coerente anche se qualcuno
  sta scrivendo in quel momento
- quelle oltre i **60 giorni** si cancellano da sole
- vengono copiate anche le **foto**

> Una copia sullo stesso server **non è una copia**. Se quel disco muore, muore
> con lui. Va portata fuori: in automatico ogni mese su Google Drive (capitolo
> 7-bis), oppure a mano su `F:\Gestionale backup`, con il comando `scp` sopra.

Il pulsante *Scarica l'archivio* che c'era nella pagina **Utenti** è stato
tolto. Da quando ogni collaboratore vede solo le proprie schede, un file con
dentro tutto l'archivio sarebbe la separazione aggirata con un clic. La copia si
prende dal server, con lo `scp` del capitolo 6: è l'unica strada a mano, ed è
anche l'unica che porta via **anche le foto**.

Chi vuole solo le proprie schede le esporta in CSV da *Clienti* e da *Immobili*.

---

## 7-bis · Mandare le copie fuori dal server, in automatico

**Si fa una volta sola.** Da quel momento, il primo giorno di ogni mese alle
3 di notte, il server manda da solo l'ultima copia dell'archivio e le foto
nuove su Google Drive — senza bisogno di ricordarsene, senza disco esterno.

```
ssh root@77.81.234.151 "curl https://rclone.org/install.sh | sudo bash"
ssh root@77.81.234.151 -t "rclone config"
```

Il secondo comando fa una serie di domande, una alla volta:

| Domanda | Risposta |
|---|---|
| tipo di operazione | `n` — nuovo collegamento (new remote) |
| nome | `gdrive` — esattamente così, minuscolo |
| tipo di spazio | cerca nell'elenco `Google Drive` e scrivi il suo numero |
| client_id | vuoto, solo Invio |
| client_secret | vuoto, solo Invio |
| scope | `1` — accesso completo |
| root_folder_id | vuoto, solo Invio |
| service_account_file | vuoto, solo Invio |
| Edit advanced config? | `n` |
| Use auto config? | `n` — il server non ha un browser proprio |

A quel punto compare un indirizzo lungo. Aprilo su un browser qualsiasi —
anche dal telefono — accedi con l'account **Google** dove vuoi salvare le
copie (può essere `camillo.barone@gmail.com` o uno dedicato solo a questo), e
incolla nel terminale il codice che ti restituisce alla fine. Poi:

| Domanda | Risposta |
|---|---|
| Configure as Shared Drive? | `n` |
| conferma finale | `y`, poi `q` per uscire |

Da quel momento è collegato per sempre: non va rifatto, nemmeno dopo un
aggiornamento del programma. Le copie finiscono in una cartella
`mondo-crm-backup` dentro quel Google Drive, divise in `database/` e `foto/`.

**Per controllare che sia partito bene**, il mese dopo:
```
ssh root@77.81.234.151 "cat /opt/mondo-crm/backup/esterno.log"
```

Finché rclone non è installato o non è ancora collegato, questo passaggio non
fa nulla — né di buono né di dannoso: aspetta in silenzio che tu lo colleghi.

---

## 8 · L'archivio dentro adesso

Migrato dai file esportati dal gestionale precedente:

| Origine | Contenuto |
|---|---|
| `clienti_export.xlsx` (1.111 righe) | **1.108 clienti** importati, 3 doppioni saltati |
| — nelle note degli stessi clienti | **206 richieste d'acquisto** riconosciute e ricostruite |
| `lista_immobili03_08_2026.xls` (53 righe) | **53 immobili** |

I clienti vanno dal 22/03/2023 al 31/07/2026.

**L'importazione legge il file Excel direttamente**, senza conversione in CSV.
La prima versione passava per il CSV e perdeva dati; è stato scritto un lettore
`.xlsx` senza librerie (ZIP + `inflateRawSync` di Node), verificato cella per
cella contro openpyxl: **8.896 celle, zero differenze**.

Il tracciato del gestionale precedente è riconosciuto da solo: nomi e cognomi
divisi correttamente (comprese le particelle tipo *De*, *Di*, *Lo*), telefoni
separati fra fisso e cellulare (in Italia i cellulari iniziano per 3), e le
richieste estratte dal testo libero delle note.

**I venditori sono ancora da inserire** — era rimasto in sospeso.

---

## 9 · Cosa è stato fatto, in ordine

23 commit. In sintesi:

1. **Il programma** — clienti, richieste, immobili, incroci, agenda, trattative,
   report, adempimenti, accesso e permessi.
2. **Prestazioni** — regge l'archivio reale; provato con 3.000 clienti, gli
   incroci restano sotto i 2,5 secondi.
3. **Tre incroci mancati, tre cause diverse** trovate e risolte: la soglia di
   punteggio troppo alta, il confronto delle zone letterale (ora accento- e
   punteggiatura-insensibile, e "Torre Lapillo" incrocia "Porto Cesareo · Torre
   Lapillo"), e il budget minimo che escludeva. Una quarta era un budget minimo
   **invisibile** nell'interfaccia: ora l'elenco mostra la fascia intera e
   segnala le combinazioni contraddittorie.
4. **Importazione** — dal file Excel diretto, con riconoscimento del tracciato.
5. **Accesso dagli altri computer** dell'ufficio (il bug del cookie).
6. **Messa online** con un comando solo: `installa.sh` fa tutto, e si può
   rilanciare senza danni.
7. **Foto** sugli immobili.
8. **Venditori** — sezione separata, con gli immobili di ciascuno e l'avviso
   compleanni in Agenda, con gli auguri WhatsApp già scritti.
9. **Legame venditore–immobile** da entrambe le parti, con **ricerca** invece di
   una tendina con dentro tutto l'archivio.
10. **Storico visite per il proprietario** — l'ultima cosa fatta, vedi sotto.

### Lo storico visite per il proprietario

Su ogni scheda immobile, in alto: una pagina sola, da stampare o salvare in PDF
(dalla finestra di stampa, scegliendo "Salva come PDF") e mandare su WhatsApp.

Risponde alla domanda che il proprietario fa prima o poi — «ma la state facendo
vedere?» — prima ancora che la faccia. Riporta il saluto, l'elenco delle visite
effettuate con data, nome, cognome, telefono e commento di chi è venuto, e in un
riquadro a parte gli appuntamenti già fissati.

Non c'è un elenco da tenere aggiornato a parte: **legge dall'agenda**. Ogni
visita o appuntamento collegato all'immobile compare da solo, con la data
dell'appuntamento e non quella in cui è stata messa la spunta *Fatto*.

Le **Note** della riga compaiono dopo il commento, ma si tolgono con un clic
(*Togli le note interne*): sono i promemoria dell'agente e in un foglio
consegnato al proprietario sembrerebbero frasi del visitatore.

Un resoconto sul prezzo — con chi si era fermato sulla cifra e a quanto
l'immobile tornerebbe interessante — era stato costruito e poi tolto su
richiesta il 4 agosto 2026. Il codice resta nella storia del repository.

### Agenda: modifica, calendario, avvisi

- Ogni riga dell'agenda ha **Modifica** (anche per le attività già svolte:
  spostare, correggere, aggiungere il commento, togliere la spunta *Fatto*,
  eliminare) e **Calendario**, che scarica quell'appuntamento con la sveglia a
  30 minuti già impostata.
- **Agenda → Calendario e avvisi** dà l'indirizzo a cui abbonare Google, iPhone
  o Outlook. È un feed iCalendar con una chiave nell'indirizzo, non un account
  collegato: niente da autorizzare, ma quell'indirizzo vale come una password ed
  è rigenerabile dalla stessa pagina.
- **L'avviso per email** parte da `scripts/promemoria.mjs`, cron ogni 5 minuti.
  Vedi il capitolo 6-bis per la configurazione.

Si è scelto il formato iCalendar invece delle API di Google perché funziona con
qualsiasi calendario, non richiede credenziali sul server, e non si rompe quando
Google cambia le regole delle applicazioni non verificate — con un account Gmail
normale l'autorizzazione andrebbe rinnovata ogni sette giorni.

### Ricerca, WhatsApp, cruscotto, copia dal browser

11. **Ricerca globale** — campo unico nella colonna di sinistra: clienti e
    immobili insieme, numeri di telefono confrontati ignorando spazi e punti.
12. **Proponi su WhatsApp** — negli Incroci e nella scheda immobile, il
    messaggio di proposta arriva già scritto. Corretto anche un difetto reale:
    i pulsanti WhatsApp passavano i numeri **senza +39** (i numeri importati
    sono quasi tutti così), e wa.me apriva una chat vuota o sbagliata. Ora il
    prefisso lo mette `whatsappHref()` in `format.ts`, ovunque.
13. **«Da sistemare» sul cruscotto** — acquirenti senza richiesta aperta,
    immobili senza proprietario, **immobili senza la via**, documenti
    antiriciclaggio scaduti, clienti senza consenso privacy. Ogni voce apre
    l'elenco già filtrato (`/clienti?senza=…`, `/immobili?noAddress=1`).
14. **Copia di sicurezza dal browser** — Utenti → *Scarica l'archivio* (solo
    titolare, annotato nel registro). Usa l'API di backup di SQLite: coerente
    anche a programma in uso.
15. **Correzioni di revisione** (revisione incrociata a più passaggi):
    - i confronti fra `due_at` (ora locale) e `date('now')` (UTC in SQLite)
      usano `date('now','localtime')`: intorno alla mezzanotte agenda, badge e
      cruscotto sbagliavano giorno;
    - «oggi/domani» calcolati sui giorni di calendario, non su blocchi di 24
      ore (alle 22 l'appuntamento di domattina risultava «oggi»);
    - l'età nei compleanni era di un anno in più per quasi tutti;
    - togliendo la spunta *Fatto* a una visita si perdeva il commento del
      visitatore; ora sopravvive;
    - le tendine troncate della pagina di modifica potevano scollegare
      cliente/immobile in silenzio; il collegato è sempre fra le opzioni;
    - un valore fuori vocabolario (es. tipologia importata) non si azzera più
      al primo salvataggio della scheda;
    - `done_at` in un formato solo (ordinamenti dello stesso giorno sballati);
    - minimo di 8 caratteri per le password anche in modifica utente;
    - chiuso un redirect aperto su `redirect_to` (`//dominio` passava il
      controllo su `/`).

---

## 9-bis · Cosa cerca il cliente, in dettaglio

Rifatto il 28 agosto 2026, su richiesta sua. Il riquadro **«Cosa cerca»** è
quello che alimenta gli incroci, ed era il punto più povero del programma.

**Tipologia: più d'una.** «Appartamento o villetta» è la richiesta normale.
Nessuna spuntata vuol dire indifferente.

**Dove cerca: un comune per volta, con le sue zone.** Si sceglie il comune —
l'elenco ha tutti i **96 comuni della provincia di Lecce**, con Lecce e Porto
Cesareo in cima — compaiono i suoi quartieri e le sue frazioni, si spunta e si
conferma con *Aggiungi*. L'area resta in elenco e si ricomincia con un altro
comune.

Prima c'era un comune solo e un elenco di zone che non sapeva a quale comune
appartenesse: chi cercava «a Lecce in centro oppure a Porto Cesareo al mare»
spuntava quattro caselle in un mucchio unico, e bastava questo per proporgli il
centro di Porto Cesareo.

Nessuna zona spuntata per un comune vuol dire **tutto il comune**, ed è il caso
più frequente. Le liste delle zone sono fitte dove l'agenzia lavora e più
scarne altrove: aggiungerne una è una riga in `ZONE_PER_COMUNE`
(`src/lib/types.ts`).

**Stato dell'immobile: da 4 a 7 voci.** Nuovo/in costruzione, ottimo,
ristrutturato, buono, discreto, da rivedere, da ristrutturare. È la **stessa
lista** per la richiesta e per la scheda immobile — se fossero due liste diverse
non si potrebbero confrontare, e il filtro nella richiesta sarebbe scritto per
niente. Gli immobili che avevano «Buono stato» sono passati a «Buono» da soli
al primo avvio.

### Cosa esclude e cosa no

Il motore **non nasconde** un immobile perché ha la zona o lo stato sbagliato:
lo propone più in basso e scrive cosa non torna. Escludono soltanto il tipo di
contratto, il **comune** (se non è nessuno di quelli chiesti), la **famiglia di
tipologia**, il budget massimo e la metratura minima.

Sulla tipologia, con più voci scelte si esclude solo se **nessuna** è della
famiglia dell'immobile, e solo quando si riconoscono tutte: se anche una sola
non si riconosce — succede con le tipologie degli archivi importati — non si sa
abbastanza per escludere, e decide l'agente.

### Le richieste vecchie

Non sono state convertite e non ne hanno bisogno: quelle scritte prima hanno il
vecchio comune e le vecchie zone, e vengono lette come un'unica area. Continuano
a incrociare esattamente come prima.

---

## 9-ter · Il video dell'immobile

Aggiunto il 31 agosto 2026, perché l'applicazione che gestisce il canale YouTube
aveva bisogno di sapere quali immobili hanno un video, e di agganciare ogni
video al suo immobile.

Sulla scheda dell'immobile c'è il campo **Video su YouTube**: ci si incolla
l'indirizzo. Il gestionale **non chiama YouTube** — resta vero che il programma
non fa nessuna chiamata verso l'esterno: conserva il collegamento e lo fa uscire
nell'esportazione.

Nel CSV degli immobili ci sono due colonne: **Video YouTube** (il collegamento
come è stato scritto) e **ID video** (il codice ricavato da quel collegamento).
Il codice si estrae da tutte le forme che YouTube usa — `watch?v=`, `youtu.be`,
`shorts`, `embed`, `live`, con o senza i parametri che il pulsante *Condividi*
attacca in coda. Resta vuoto quando non se ne riconosce uno.

Sul cruscotto, nel riquadro *Da sistemare*, compaiono gli **immobili in vendita
senza un video**. Conta solo quelli ancora proponibili: per un immobile venduto
il video non serve più, e tenerlo nel conteggio darebbe un numero che non scende
mai e che quindi si smette di guardare.

**I dati escono a mano, non c'è nessuna porta aperta.** L'altra applicazione non
interroga il gestionale: si scarica il CSV da *Immobili → Esporta in Excel* e lo
si passa. È stata una scelta sua: aprire un indirizzo che un altro programma
interroga da solo sarebbe la prima volta che il gestionale espone qualcosa verso
l'esterno, e non è una cosa da fare di sfuggita.

---

## 9-quater · L'elenco immobili si apre sugli attivi

Chiesto il 1° settembre 2026. L'elenco mostrava tutto il portafoglio mai
esistito, venduti compresi: per arrivare a quello su cui si lavora bisognava
filtrare ogni volta.

Ora apre sugli **attivi** — acquisizione e in vendita, gli stessi che il
programma già considera proponibili — e in cima ci sono tre schede con i
rispettivi numeri. La scheda scelta sopravvive alla ricerca e ai filtri; quando
si sceglie uno stato preciso dalla tendina le schede spariscono, perché
sarebbero due comandi che dicono la stessa cosa.

**I collegamenti del cruscotto aprono sempre l'elenco completo.** I loro
conteggi guardano tutti gli stati: se l'elenco si fosse aperto sui soli attivi,
il cruscotto avrebbe promesso nove righe e ne avrebbe aperte cinque. È la stessa
trappola dei conteggi già pagata due volte in questo programma.

La foto di copertina nell'elenco è passata da 56×40 a **176×128 pixel**: serve a
riconoscere l'immobile senza aprirlo.

---

## 9-quinquies · Comune, zona ed esterno sulla scheda immobile

Chiesto il 2 settembre 2026, ed è il seguito naturale di «cosa cerca»: da una
parte si sceglieva da un elenco, dall'altra si scriveva a mano.

**Comune e zona** ora vengono dalle stesse liste della richiesta —
`COMUNI` e `ZONE_PER_COMUNE` in `src/lib/types.ts`. Il confronto degli incroci
era già tollerante («S. Cataldo» trova «San Cataldo»), ma su un immobile si
poteva scrivere una zona che in quel comune non esiste, e non se ne accorgeva
nessuno.

**Il valore che l'immobile ha già resta sempre fra le opzioni**, anche quando
non è in elenco. I 53 immobili in archivio hanno comune e zona scritti a mano:
una tendina che non li contenesse li scollegherebbe al primo salvataggio, in
silenzio. È la trappola delle tendine troncate, già pagata una volta.

**L'esterno è diventato multiplo**: balcone, terrazzo e giardino insieme, in
csv. La voce *Nessuno* è sparita — nessuna casella spuntata dice già la stessa
cosa, e tenerla avrebbe permesso di spuntare insieme «Nessuno» e «Giardino».
Gli immobili che l'avevano vengono ripuliti da `ripulisciEsterniVuoti` in
`db.ts`, idempotente come le altre conversioni. Il motore degli incroci
continua a riconoscere «ha un esterno»: legge il csv e ignora l'eventuale
«Nessuno» rimasto scritto.

---

## 10 · Cosa **non** c'è

Escluso d'accordo, non dimenticato:

- invio annunci ai portali
- firma digitale
- invii massivi di email/WhatsApp
- generazione automatica dei contratti
- app da scaricare (si usa dal browser, anche dal telefono)
- fatturazione

---

## 10-bis · Lavorare in due senza vedersi le schede

Ogni collaboratore vede soltanto la propria roba, e questo
**vale per tutti, titolare compreso**. L'archivio è condiviso come edificio,
non come contenuto.

A decidere sono due campi soli: il **referente** del cliente (*Seguito da*) e
l'**agente di riferimento** dell'immobile. Richieste, attività, proposte,
valutazioni, foto e storico prezzi non hanno un padrone loro: seguono la scheda
a cui sono attaccati.

Il confine è lo stesso ovunque — elenchi, ricerca, incroci, agenda, cruscotto,
report, esportazioni, foto, promemoria via email. Anche i **conteggi**: il
numero in cima a un elenco è il numero di quell'elenco, mai quello
dell'agenzia. Se fosse quello dell'agenzia, basterebbe cambiare i filtri per
contare l'archivio del collega senza vederne una riga.

Scrivere a mano l'indirizzo di una scheda altrui dà **«non trovata»**, la stessa
risposta di un numero inventato: un «non autorizzato» confermerebbe che quella
scheda esiste.

Quattro cose da sapere, perché si notano nell'uso:

1. Un appuntamento può essere di uno e riguardare la scheda dell'altro — una
   visita fatta insieme. Si vede, ma al posto del nome compare *«scheda di un
   collega»*.
2. Il **rilevamento doppioni** guarda solo il proprio archivio: se la stessa
   persona è seguita da entrambi, nessuno viene avvisato. È voluto — un avviso
   sarebbe già un modo per interrogare l'archivio altrui — ma va saputo.
3. Per la stessa ragione, una **richiesta di cancellazione GDPR** va girata a
   voce anche all'altro: ognuno cancella solo la propria copia.
4. Il ruolo **titolare** non dà più accesso ai dati altrui: serve solo a creare
   e disattivare gli utenti. Il **registro accessi** ce l'hanno tutti, ma
   ciascuno vede soltanto le proprie mosse.

### Gli incroci con i colleghi

La separazione avrebbe poco senso se poi le occasioni si perdessero. In
**Incroci → Con i colleghi** il programma segnala nei due versi: un tuo
acquirente per l'immobile di un collega, e un tuo immobile per un acquirente
suo.

Valgono le stesse regole degli incroci propri (niente altro comune, niente
altra famiglia di tipologie), ma cambia cosa si vede —
**le caratteristiche sì, l'identità no**:

| Del collega si vede | Non si vede |
|---|---|
| tipologia, comune, zona, metri, vani, prezzo richiesto | chi è il proprietario |
| cosa cerca un suo acquirente, e con che budget | nome e telefono di quell'acquirente |
| | il **prezzo minimo** accettato dal venditore |
| | note interne e provvigioni |

Il prezzo minimo non esce per nessun motivo: è la soglia sotto cui il venditore
non scende, e conoscerla vuol dire sedersi al tavolo sapendo la mano dell'altro.

Non c'è nessun pulsante per chiamare il cliente del collega: si scrive al
collega. Da lì in poi è un accordo fra due persone, provvigione compresa —
come si è sempre fatto fra agenzie.

### La password è di chi la usa

Ognuno si cambia la propria da **Il mio accesso** (in fondo alla colonna a
sinistra). Prima le impostava solo il titolare dalla pagina Utenti: voleva dire
che qualcun altro conosceva la tua, e fra colleghi che non si vedono le schede a
vicenda era una stonatura.

Appena cambiata, **tutti gli accessi già aperti si chiudono**, compresi quelli
di chi conosceva la password vecchia. È il momento in cui il cambio serve
davvero a qualcosa.

**Password dimenticata:** dalla pagina di accesso, *Password dimenticata?*.
Arriva un'email con un collegamento che vale un'ora e una volta sola. Del
collegamento in archivio resta solo l'impronta, mai il collegamento stesso: chi
leggesse il file dell'archivio non potrebbe usarlo per entrare.

> Funziona **solo con l'SMTP configurato** (capitolo 6-bis). Finché manca, la
> pagina lo dice invece di far aspettare un'email che non arriverà, e la
> password la reimposta il titolare da Utenti.

**Se non entra più nessuno** — password persa e posta non configurata — si
reimposta dal server:
```
ssh root@77.81.234.151 "cd /opt/mondo-crm && sudo -u mondo npm run password -- --email nome@mondoimmobiliarelecce.it"
```
Ne genera una a caso e la stampa a schermo. Annotarla subito.

⚠️ **Il limite, detto chiaro.** Questo separa gli sguardi dentro il programma,
non l'accesso alla macchina. Chi ha le chiavi del server ha il file
dell'archivio, e lì dentro c'è tutto; chi amministra gli utenti può ancora
imporre una password nuova a un altro — non può leggere quella in uso, ma può
sostituirla, e a quel punto entrare. La differenza è che adesso
**se ne accorge**: l'interessato si ritrova fuori e la sua password non
funziona più. Se serve una separazione che regga fra due
persone che non si fidano l'una dell'altra, la strada sono
**due installazioni distinte** che si parlano solo per gli incroci.

Se invece siete due soggetti giuridici diversi che condividono lo stesso
archivio, dal punto di vista privacy siete **contitolari del trattamento** e
serve un accordo scritto (art. 26 GDPR). Se il collaboratore è un incaricato
dello Studio, resta tutto in capo al titolare ed è molto più semplice.

---

## 11 · Privacy e adempimenti

- **consenso privacy** con data e ambito, su ogni scheda cliente
- **adeguata verifica antiriciclaggio** (D.lgs 231/2007): tipo e numero
  documento, scadenza, data del controllo
- **registro accessi**: cosa è stato fatto e quando — ognuno vede il proprio
- **separazione fra collaboratori**: ognuno accede soltanto alle schede di cui è
  referente (capitolo 10-bis)
- **cancellazione logica**: i clienti eliminati restano nell'archivio con la
  data di cancellazione, non spariscono
- l'accordo art. 28 GDPR con Aruba va tenuto agli atti

---

## 12 · Se qualcosa non va

| Sintomo | Da guardare per primo |
|---|---|
| Il sito non si apre | `systemctl status mondo-crm`, poi `journalctl -u mondo-crm -n 50` |
| Non si entra da un altro computer | `proxy_set_header X-Forwarded-Proto` in nginx |
| L'importazione di un file grosso fallisce | `client_max_body_size` in nginx (il valore normale, 1 MB, è troppo poco) |
| La compilazione si ferma a metà | RAM insufficiente — serve la memoria di scambio |
| `not found: make` durante l'installazione | mancano `build-essential` e `python3` |
| Un cliente non compare negli incroci | il programma incrocia le **richieste**, non i clienti: senza una richiesta registrata non appare. La scheda immobile ha il riquadro *Richieste scartate* che dice il motivo di ogni esclusione |
| Il certificato è scaduto | `certbot renew` — normalmente si rinnova da solo |

---

## 13 · Dove stanno le password

Nessuna è in questo file né nel repository.

| Cosa | Dove |
|---|---|
| Accesso al gestionale | creato all'installazione, stampato a schermo; poi si gestisce da *Utenti* |
| SSH al server | chiave SSH sul PC |
| Pannello Aruba | account ARU-352439, credenziali personali |
| Pannello SiteGround | credenziali del sito |
| Chiave delle sessioni | generata dal programma in `data/secret.key` — **non va cancellata**: cancellarla fa uscire tutti |
