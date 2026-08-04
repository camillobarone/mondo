# Installazione su SiteGround

Tempo richiesto: 20–30 minuti. Nessun costo aggiuntivo: servono solo PHP e MySQL,
che l'hosting SiteGround già include. Niente licenze, niente abbonamenti,
niente Composer, niente npm.

## Requisiti

| Cosa | Valore | Come verificarlo |
|---|---|---|
| PHP | 8.1 o superiore | Site Tools → Devs → PHP Manager |
| Estensioni | `pdo_mysql`, `gd`, `mbstring` | attive di default su SiteGround |
| Database | MySQL / MariaDB | Site Tools → Site → MySQL |
| Apache | `mod_rewrite` | attivo di default |

Il sito attuale su WordPress **non va toccato**: questa installazione vive su
un sottodominio o in una cartella separata, e resta invisibile ai motori finché
non si decide diversamente (vedi `MIGRAZIONE-SEO.md`).

---

## 1. Creare il database

Site Tools → **Site → MySQL → Databases → Create Database**.

Poi la scheda **Users**: crea un utente e assegnagli il database appena creato
con permessi pieni. Annota quattro valori:

- nome del database
- nome utente
- password
- host: `localhost`

## 2. Creare il sottodominio di prova

Site Tools → **Domain → Subdomains** → crea per esempio `prova`.
Si ottiene `prova.mondoimmobiliarelecce.it`.

SiteGround genera in automatico anche il certificato SSL (Let's Encrypt,
incluso). Attivalo da **Security → SSL Manager** prima di andare avanti:
installare in `http` e passare dopo a `https` obbliga a rifare i percorsi.

## 3. Caricare i file

Site Tools → **Site → File Manager**, oppure FTP/SFTP.

Ci sono due modi. Il primo è più pulito e va preferito.

### Modo A — document root sulla cartella `public/` (consigliato)

1. Carica l'intera cartella `sito-nuovo/` dentro la home del sottodominio.
2. Site Tools → **Domain → Subdomains** → icona ⚙ accanto al sottodominio →
   **Change Document Root** → punta a `.../sito-nuovo/public`.

Così codice, template e database restano fuori dalla cartella pubblica: dal web
non sono raggiungibili nemmeno provandoci.

### Modo B — tutto dentro la cartella pubblica

Se non puoi spostare il document root, carica il contenuto di `sito-nuovo/`
direttamente nella cartella del sottodominio. Il file `.htaccess` alla radice
del progetto blocca `app/`, `views/`, `db/`, `bin/`, `docs/` e `config.php`,
e inoltra tutto il resto a `public/`.

Il modo A è comunque più sicuro: una configurazione sbagliata di Apache non può
esporre nulla, perché i file non stanno proprio lì.

## 4. Permessi

Tre cartelle devono essere scrivibili da PHP:

```
public/uploads/   → 755
storage/cache/    → 755   (CSS minificato; se manca il sito funziona lo stesso,
                           solo rifà la minificazione a ogni richiesta)
db/               → 755   (serve solo con SQLite; con MySQL è inutilizzata)
```

Su SiteGround i permessi di default vanno già bene. Se il caricamento delle foto
dà errore, è questo il primo posto da guardare.

## 5. Installazione guidata

Apri `https://prova.mondoimmobiliarelecce.it/install.php` e compila:

- **Indirizzo del sito** — l'URL completo, senza slash finale
- **Database** — tipo `MySQL`, più i quattro valori del passo 1
- **Amministratore** — nome, email, password di almeno 10 caratteri
- **Contenuti di esempio** — lascialo spuntato la prima volta: il sito si
  presenta pieno e si capisce subito com'è fatto. Sono dati finti, marcati
  `DEMO-`, cancellabili dal gestionale.

## 6. ⚠️ Cancellare l'installer

Appena l'installazione è finita, **cancella `public/install.php` dal server**.
Finché resta lì è una porta aperta. È l'unico passaggio che non si può saltare.

## 7. Primo giro

- Sito: `https://prova.mondoimmobiliarelecce.it/`
- Gestionale: `https://prova.mondoimmobiliarelecce.it/gestionale/`

Nel gestionale, in ordine:

1. **Impostazioni** — nome del sito, indirizzo, email che riceve le richieste,
   URL del logo 512×512 (deve rispondere 200: è quello che Google usa nel
   Knowledge Panel).
2. **Utenti** — crea un account per ogni agente. Ruolo `Agente` per chi lavora
   sugli immobili, `Amministratore` solo a chi deve toccare utenti, redirect e
   impostazioni.
3. **Immobili** — cancella i `DEMO-` e inserisci due immobili veri, per vedere
   come si comporta con i dati reali.
4. **Richieste di acquisto** — inserisci due o tre clienti in ricerca. Da quel
   momento il gestionale, per ogni immobile nuovo, dice a chi proporlo.

## 8. Tenere il sottodominio fuori dall'indice

Finché è una prova, non deve finire su Google: sarebbe una copia degli stessi
immobili su un secondo indirizzo, e a rimetterci le posizioni è il sito che
oggi porta i contatti.

**L'installazione ci pensa da sola.** `install.php` scrive `noindex = 1`, e
finché quella impostazione è attiva ogni pagina esce `noindex, nofollow` e il
`robots.txt` risponde `Disallow: /`. Non c'è niente da fare al primo giro.

Si toglie da **Gestionale → Impostazioni → Visibilità sui motori**, il giorno
in cui si decide di andare online. È una casella da togliere a mano di
proposito: deve essere una decisione, non una dimenticanza. Il cambio finisce
nel registro attività, così resta scritto chi l'ha fatto e quando.

**In più, e da fare subito: proteggi il sottodominio con password.** Site Tools
→ **Sicurezza → URL protetti** → proteggi la radice del sottodominio. Il
`robots.txt` è una richiesta di buona educazione che i crawler seri
rispettano; la password è una porta chiusa, e vale anche per chi indovina
l'indirizzo. Le due cose stanno insieme, non una al posto dell'altra.

---

## Backup

Il sito sta in due posti, e servono entrambi:

- **Database** — Site Tools → **Site → MySQL → phpMyAdmin** → Esporta.
  Oppure il backup automatico giornaliero di SiteGround, già incluso.
- **Cartella `public/uploads/`** — le foto degli immobili non sono nel database.

## Aggiornare il codice

Non c'è un aggiornamento automatico ed è voluto: nessun plugin che si aggiorna
da solo, nessuna rottura a sorpresa il giorno sbagliato. Per aggiornare:

1. Backup del database (phpMyAdmin → Esporta) e della cartella `public/uploads/`.
2. Sostituisci i file di `app/`, `views/`, `db/` e `public/assets/`, lasciando
   stare `config.php` e `public/uploads/`.
3. Se la versione nuova porta migrazioni, applicale:
   `php bin/aggiorna-db.php` da SSH, oppure aprendo una sessione shell da
   Site Tools → Devs → SSH. Lo script dice cosa ha applicato; rilanciarlo due
   volte non fa danni, le migrazioni già fatte vengono saltate.

## Se qualcosa non va

| Sintomo | Causa quasi sempre |
|---|---|
| Pagina bianca | Errore PHP. Metti `'debug' => true` in `config.php`, ricarica, leggi il messaggio, poi rimettilo a `false`. |
| Tutte le pagine danno 404 tranne la home | `mod_rewrite` non attivo o `.htaccess` non caricato. |
| CSS assente, pagina "nuda" | `base_url` in `config.php` non corrisponde all'indirizzo reale. |
| Le foto non si caricano | Permessi di `public/uploads/`, oppure `upload_max_filesize` troppo basso in PHP Manager. |
| Le mail non arrivano | Imposta `mail_from` su un indirizzo del dominio del sito: i mittenti esterni finiscono in spam. |
