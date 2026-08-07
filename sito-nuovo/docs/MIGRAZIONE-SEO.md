# Passare in produzione senza perdere il posizionamento

Questo documento riguarda una decisione, non un'installazione. Va letto prima
di puntare `mondoimmobiliarelecce.it` sul sito nuovo, e serve soprattutto a
mettere per iscritto cosa si rischia.

---

## Il punto di partenza

Il sito attuale non è una brochure: è un asset costruito in anni.

Al 25 luglio 2026, dai documenti di progetto:

- **audit complessivo 83/100** (era 66 il 2 luglio) — [verificato, fonte BRIEFING-LAVORO]
- circa **182 URL** passate in rassegna, con i problemi scesi da 152 a ~15 minori
- **~113 schema JSON-LD** corretti e validati uno per uno
- **7+ redirect 301** attivi da consolidamenti anti-cannibalizzazione
- cluster di contenuti costruiti su intent separati (fiscale, vendere, quartieri, geo)
- un tool dati proprietario (`/quotazioni-omi-lecce/`) con `Dataset` e licenza CC BY
- l'obiettivo dichiarato: **primi 3 risultati per "agenzia immobiliare Lecce"**

Rifare il sito da zero e pubblicarlo sullo stesso dominio senza un piano di
conservazione significa buttare questo lavoro. Non parzialmente: le posizioni
guadagnate si perdono in settimane e non tornano da sole.

**Questo è il rischio principale dell'operazione, e non dipende dalla qualità
del sito nuovo.** Un sito migliore su URL che rispondono 404 posiziona peggio di
un sito peggiore su URL che rispondono 200.

---

## La domanda che viene prima di tutte

*Cosa costa davvero, oggi, il sito attuale?*

Non "quanto è costato": quanto costa **mantenerlo acceso nei prossimi dodici
mesi**. Le voci sono queste:

| Voce | Tipo | Serve al sito nuovo? |
|---|---|---|
| Hosting SiteGround | ricorrente | **Sì** — identico, stesso piano |
| Dominio | ricorrente | **Sì** |
| Tema WP-Residence | licenza | No — il sito nuovo non ha temi |
| Rank Math PRO | ricorrente | No — SEO e sitemap sono nel codice |
| SASWP (schema) | ricorrente | No — il JSON-LD lo genera il codice |
| Elementor | licenza | No |
| AirLift | incluso in SiteGround | Non serve: niente da cachare lato plugin |

> ⚠️ **Non ho gli importi.** Le cifre esatte dei rinnovi non sono nei documenti
> di progetto e non le invento. Prima di decidere qualsiasi cosa, mettile in
> fila tu: sono il numero che decide se questa operazione ha senso.

Il punto vero: **il sito nuovo elimina le licenze, non l'hosting.** Se il buco
di budget è l'hosting, questo progetto non lo risolve. Se il buco sono i rinnovi
dei plugin, lo risolve del tutto.

### La terza strada, che di solito è la migliore

C'è un'opzione che non è né "tenere tutto" né "rifare da zero": **restare su
WordPress e togliere solo le licenze**. Rank Math ha una versione gratuita che
copre quasi tutto quello che serve; SASWP anche; gli schema si possono generare
da uno snippet PHP invece che da un plugin a pagamento. Costo: qualche giorno di
lavoro. Rischio SEO: quasi zero, perché gli URL non cambiano.

È meno soddisfacente di un sito nuovo. Ma se l'obiettivo dichiarato è arrivare
primi su "agenzia immobiliare Lecce", è la strada che ci mette meno in pericolo.

Il sito nuovo ha senso se serve **il gestionale**, non se serve risparmiare:
quello è il pezzo che WordPress oggi non fa, e che nessun taglio di licenze
regala.

---

## Se si decide di passare comunque: la procedura

Non è una lista da leggere, è una lista da eseguire in ordine. Saltare un passo
costa mesi.

### Fase 1 — Censimento (prima di toccare qualsiasi cosa)

1. Esporta **tutte** le URL indicizzate:
   - Search Console → Pagine → Esporta (tutte, non solo le prime 1.000)
   - `https://www.mondoimmobiliarelecce.it/sitemap_index.xml` e le sitemap figlie
   - Search Console → Prestazioni → esporta le pagine con click negli ultimi 12 mesi
2. Ordina per click. Le prime 30 URL portano quasi tutto il traffico organico:
   quelle non possono sbagliarsi.
3. Salva anche la tabella dei redirect già attivi in Rank Math: sono 301 che
   funzionano oggi e devono continuare a funzionare. Se l'URL A redirige a B e
   B sparisce, si spezza anche A.

### Fase 2 — Mappa vecchio → nuovo

Per **ogni** URL dell'elenco, una riga: dove va adesso.

- Stessa pagina, stesso indirizzo → nessun redirect, ed è il caso migliore.
  **Tieni gli slug identici ovunque puoi.** Ogni slug conservato è un redirect
  in meno e un rischio in meno.
- Pagina che esiste ma cambia indirizzo → 301 verso il nuovo.
- Pagina che non esiste più → 301 verso la pagina più affine per intento,
  **non** verso la home. Un 301 di massa sulla home Google lo tratta come un 404.
- Immobile venduto → 301 verso l'archivio del comune, come già si fa oggi.

La mappa si incolla in **Gestionale → Reindirizzamenti → Importa in blocco**,
una riga per redirect, `vecchio => nuovo`.

### Fase 3 — Contenuti

I contenuti vanno **riportati, non riscritti**. Le pagine che oggi posizionano
lo fanno per quello che dicono: riscriverle "meglio" mentre si cambia sito
significa cambiare due variabili insieme e non sapere più cosa ha funzionato.

Priorità, dall'alto:

1. le 30 URL con più click
2. i pillar (vendere casa, comprare casa, valutazione, hub geografici)
3. gli hub di quartiere e le marine
4. il resto del blog

Le pagine con dati proprietari — quotazioni OMI, prezzi €/mq, casi reali — sono
quelle che valgono di più e che nessun concorrente può copiare. Vanno per prime.

### Fase 4 — Prova sul sottodominio

Prima di toccare il dominio vero:

- **Screaming Frog** (versione gratuita, fino a 500 URL) sul sottodominio:
  zero 404, zero catene di redirect, un solo `<h1>` per pagina, canonical
  auto-referenziante ovunque.
- **Rich Results Test** di Google su un annuncio, un articolo, la home,
  una pagina statica. Quattro tipi, quattro prove.
- **PageSpeed Insights** su mobile, sulla home e su un annuncio.
- A mano: modulo di contatto (arriva la mail? il lead è nel gestionale?),
  ricerca con filtri, sito da telefono.

### Fase 5 — Il passaggio

Da fare **di martedì mattina**, mai di venerdì e mai sotto stagione. Se qualcosa
va storto servono giorni pieni per accorgersene e rimediare.

1. Backup completo del sito attuale: database e cartella. Non il backup
   automatico — uno fatto a mano, scaricato, verificato aprendolo.
2. Carica i redirect definitivi nel sito nuovo.
3. Sposta il document root del dominio principale sul sito nuovo.
4. Verifica **subito**, in questo ordine: home 200, tre annunci 200, tre vecchie
   URL → 301 a hop singolo, `/sitemap.xml` 200, `/robots.txt` senza `Disallow: /`.
5. Search Console → invia la nuova sitemap. **Non** rimuovere la vecchia
   proprietà: serve per confrontare i dati.
6. Search Console → Controllo URL → richiedi indicizzazione delle 10 pagine
   principali.

### Fase 6 — Le quattro settimane dopo

Ogni giorno per la prima settimana, poi ogni settimana:

- **Search Console → Pagine**: gli errori 404 devono restare vicini allo zero.
  Ogni 404 nuovo è un redirect che manca: si aggiunge dal gestionale.
- **Prestazioni**: un calo dei click nei primi 15 giorni è normale.
  Un calo che continua dopo 30 giorni non lo è.
- **Impostazioni → Reindirizzamenti**: la colonna "Usi" dice quali redirect
  vengono davvero colpiti. Quelli a zero dopo un mese si possono ignorare;
  quelli con molti colpi sono URL ancora vive nell'indice.

⚠️ **Tieni il sito vecchio recuperabile per almeno 60 giorni.** Se dopo un mese
il traffico organico è sceso di oltre il 30%, si torna indietro. Tornare
indietro è un'operazione da un'ora se il backup c'è, ed è impossibile se non c'è.

---

## Cosa il sito nuovo fa già, senza plugin

Perché non venga rifatto a mano quello che è già nel codice:

| Funzione | Dove sta |
|---|---|
| Redirect 301 gestibili | Gestionale → Reindirizzamenti (+ automatici a ogni cambio slug) |
| `sitemap.xml` sempre aggiornata | `app/Controller/Site/Feeds.php`, generata dal database |
| `robots.txt` | stesso file — nessun blocco ai crawler AI, per scelta |
| Canonical auto-referenziante | `views/layout/site.php` |
| `noindex` su risultati filtrati, pagine 2+, venduti | `app/Controller/Site/Listings.php` |
| JSON-LD completo e validato | `app/Core/Seo.php` |
| Limiti 60/160 su title e description | `app/Controller/Site/Pages.php::meta()` |
| Una sola forma di URL (301 sullo slash) | `public/index.php` |
| Immagini ridotte e convertite in WebP | `app/Core/Uploader.php` |

Il dato da tenere aggiornato a mano è **uno solo**: il numero di recensioni
Google, in `app/Core/Seo.php` (`REVIEW_COUNT`, oggi 58 con media 4,9). Quando
cambia sulla scheda Google si aggiorna lì e cambia su tutte le pagine insieme.
