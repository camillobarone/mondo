# Importare gli immobili dal WordPress attuale

Porta gli immobili di `mondoimmobiliarelecce.it` (34 pubblicati + 15 bozze al
2 agosto 2026) dentro il gestionale nuovo, con le foto e **conservando gli
slug**: `/immobili/villa-poggio-porto-cesareo/` resta quell'indirizzo lì, e
non serve nessun redirect.

Lo script **non scrive mai** sul sito WordPress. Legge e basta.

---

## Stato della mappatura

**Verificata sul sito vero il 4 agosto 2026.** I meta sono stati letti sul
WordPress in produzione tramite il connettore MCP in contesto `edit` (post
31915, del 2026, e 22670, del 2022), le tassonomie su tredici immobili fra
pubblicati e bozze. Quello che ne è uscito sta in `app/Core/WpMapper.php` e
si ricontrolla con:

```bash
php bin/verifica-mappatura.php
```

Quel comando ripassa dodici schede reali e non ha bisogno né del database
WordPress né di rete: se un giorno smette di passare, o è cambiato il mapper
o è cambiato il sito.

Cinque cose che la verifica ha corretto, e che vale la pena conoscere prima
di leggere il resto:

| Campo | Si cercava | Sul sito si chiama |
|---|---|---|
| Anno di costruzione | `property_year` | **`property-year`** (trattino) |
| Numero di piani | `property_floors` | **`stories-number`** |
| Riferimento | `property_id` | **`property_internal_id`** |
| Galleria serializzata | *non letta* | **`wpestate_property_gallery`** |

E la quinta, che non è un nome di campo: **un immobile porta più categorie
insieme.** Il post 31915 è "Casa indipendente a Trepuzzi" ed è classificato
`Appartamenti` *e* `Indipendenti`. Prendere la prima categoria che combacia
significava importarlo come appartamento, perché WordPress restituisce la 28
prima della 46. Ora si scorrono le tipologie dalla più specifica alla più
generica. Vale anche per i comuni: un immobile a Torre Lapillo porta anche
Nardò e Porto Cesareo, e si sceglie quello che compare nel titolo.

⚠️ Resta comunque il passo 1. La verifica ha coperto tredici immobili su
quarantanove: il censimento completo lo dà solo `--campi`, ed è l'unico modo
di accorgersi di una chiave usata su una scheda sola.

---

## 1. Guarda che campi ci sono davvero

```bash
cd ~/prova.mondoimmobiliarelecce.it/sito-nuovo
php bin/importa-da-wordpress.php --campi \
    --wp-config=/home/TUOUTENTE/public_html/wp-config.php
```

Stampa due elenchi:

- **META USATI DAGLI IMMOBILI** — ogni chiave, su quanti immobili compare, e
  un valore di esempio. Serve a rispondere a una domanda sola: *il prezzo, in
  che chiave sta?*
- **TASSONOMIE** — i valori di tipologia, contratto, comune, zona e
  caratteristiche, con quante volte ricorrono.

Confronta le chiavi con la costante `META` in `app/Core/WpMapper.php`. Se una
riga importante (prezzo, superficie, camere) non è fra gli alias, aggiungila
in testa alla lista di quel campo: la prima chiave non vuota vince.

> Il file `wp-config.php` sta nella cartella del sito WordPress. Se non sai
> qual è, cercalo da Site Tools → File Manager: è alla radice di `public_html`.
> Da lì lo script ricava da solo nome del database, utente, password e
> prefisso delle tabelle.

## 2. Simula

```bash
php bin/importa-da-wordpress.php --prova \
    --wp-config=/home/TUOUTENTE/public_html/wp-config.php
```

Non scrive niente: elenca gli immobili con prezzo e metratura come li
importerebbe.

**Cosa guardare:**

| Se vedi | Vuol dire |
|---|---|
| Prezzi a zero o vuoti | l'alias del prezzo è sbagliato — torna al passo 1 |
| Metrature a zero ovunque | idem per `property_size` |
| «Tipologia non riconosciuta» | il nome del termine non contiene nessuna radice nota: aggiungila a `TIPI` in `WpMapper.php` |
| «Dotazione fuori vocabolario» | la caratteristica **viene importata comunque**, com'è scritta; l'avviso serve solo a decidere se aggiungerla a `Vocab::FEATURES` per averla anche nei filtri |
| `riservato` su un immobile che ha un prezzo | il prezzo non è stato letto |

Un `riservato` su un immobile che davvero non espone il prezzo è corretto: a
database resta senza prezzo e in pagina esce «Trattativa riservata», come sul
sito attuale.

## 3. Importa

```bash
php bin/importa-da-wordpress.php \
    --wp-config=/home/TUOUTENTE/public_html/wp-config.php
```

Alla fine stampa quanti nuovi, quanti aggiornati, quante foto e gli avvisi.

**Si può rilanciare quante volte serve.** Gli immobili già importati vengono
riconosciuti dall'ID WordPress e aggiornati, non duplicati; le foto già
presenti non si riscaricano. Quindi la sequenza normale è: importi, guardi,
correggi gli alias, rilanci.

### Opzioni

| Opzione | A cosa serve |
|---|---|
| `--limite=3` | importa solo i primi 3, per una prova breve |
| `--solo-pubblicati` | salta le 15 bozze |
| `--senza-foto` | solo i dati, molto più veloce |
| `--uploads=DIR` | se `wp-content/uploads` non sta dove lo script lo cerca |
| `--db=… --utente=… --password=… --prefisso=vnb_` | al posto di `--wp-config` |

---

## Cosa viene importato

| Nel gestionale | Da WordPress |
|---|---|
| Titolo, slug, descrizione, sommario | `post_title`, `post_name`, `post_content`, `post_excerpt` |
| Stato | `publish` → Pubblicato, `draft` → Bozza |
| Prezzo, superficie, locali, camere, bagni, piano | meta di WP-Residence |
| Lotto, anno, classe energetica, CAP, coordinate | idem |
| Riferimento | meta `property_internal_id` o `mls`, oppure generato (`MIL-0001`…) |
| Tipologia | `property_category` e `property_features`, per radice, dalla più specifica alla più generica |
| Contratto | tassonomia `property_action_category` |
| Comune e zona | `property_city` e `property_area`; fra più termini vince quello nominato nel titolo, e il comune viene riportato alla forma di `Vocab::CITIES` («Lecce città» → Lecce) |
| Dotazioni | `property_features`, ricondotte al vocabolario dove possibile e tenute com'è altrimenti |
| Foto | immagine in evidenza + galleria, convertite in WebP e ridotte a 1600 px |

**Non** viene importato: JSON-LD (lo rigenera il codice), meta di Rank Math
(SEO title e description si ricompilano dal gestionale), i campi di
WP-Residence senza equivalente.

⚠️ Fra quelli senza equivalente ce n'è uno che pesa: **il video**. Le schede
del sito attuale portano `embed_video_type` e `embed_video_id` — sul post
31915 c'è uno YouTube Shorts, sul 22670 un video di presentazione — e lo
schema di quelle pagine dichiara un `VideoObject`. Il gestionale nuovo non ha
un campo per tenerlo, quindi oggi quel contenuto si perderebbe. Serve una
colonna e un blocco nella scheda: è lavoro piccolo, ma va deciso prima di
puntare il dominio, non dopo.

---

## Limiti noti

- **Contenuti costruiti con page builder.** La descrizione viene ripulita da
  HTML e shortcode, ma il *testo dentro* gli shortcode resta — ed è giusto
  così, perché di solito è il contenuto vero. Su un immobile costruito con
  Elementor o WPBakery però può arrivare del testo di impaginazione. Dopo
  l'importazione apri due o tre descrizioni e guarda: si correggono dal
  gestionale in un minuto.
- **La galleria** sta in due meta contemporaneamente: `image_to_attach` (lista
  di ID separati da virgola) e `wpestate_property_gallery` (array serializzato
  PHP). Lo script legge il primo e ricade sul secondo, estraendo i numeri da
  entrambi. Se le foto risultano poche, controlla al passo 1 in che chiave sta
  la galleria.
- **Nessun immobile viene cancellato.** Se togli un immobile da WordPress,
  quello importato resta: va archiviato a mano dal gestionale.
- **I dati commerciali non ci sono in WordPress** — incarico, scadenza,
  prezzo minimo, proprietario, provvigioni. Sono i campi che il gestionale
  aggiunge e che vanno compilati a mano, una volta, sui 34 immobili.

## Dopo l'importazione

1. **Gestionale → Immobili**: controlla che i conteggi tornino (34 pubblicati,
   15 bozze) e apri due o tre schede.
2. **Sul sito**: apri gli stessi immobili e verifica che le foto ci siano e la
   descrizione sia leggibile.
3. **Rich Results Test** su un annuncio importato: è l'unica conferma esterna
   che lo schema regga.
4. Compila l'**incarico** almeno sugli immobili con esclusiva: da lì in poi il
   riepilogo ti avvisa delle scadenze.

---

## Provarlo senza toccare il sito vero

C'è un WordPress finto, per capire come si comporta prima di puntarlo al
database di produzione:

```bash
php bin/finto-wordpress.php /tmp/finto-wp.sqlite /tmp/finto-uploads
php bin/importa-da-wordpress.php --prova \
    --sorgente-sqlite=/tmp/finto-wp.sqlite --prefisso=vnb_ --uploads=/tmp/finto-uploads
```

Contiene i casi che sul sito vero esistono: un immobile completo, uno a
trattativa riservata, una bozza, un prezzo in formato italiano
(`€ 178.000,00`), un termine di tassonomia con un title SEO nel campo nome
(«Ville in Vendita a Lecce e Provincia»), un comune scritto «Lecce città» e
una dotazione fuori vocabolario.

E, dal 4 agosto, la forma che gli immobili hanno davvero e che prima nessun
caso di prova riproduceva: due categorie insieme, tre comuni di cui uno solo
giusto, galleria come array serializzato e prezzo scritto `0` invece che
lasciato vuoto. I nomi dei termini segnati `[vero]` in
`bin/finto-wordpress.php` sono copiati dal database di produzione, con la
elle minuscola di «Torre lapillo» compresa: non vanno "sistemati".
