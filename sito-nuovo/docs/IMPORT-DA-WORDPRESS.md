# Importare gli immobili dal WordPress attuale

Porta gli immobili di `mondoimmobiliarelecce.it` (34 pubblicati + 15 bozze al
2 agosto 2026) dentro il gestionale nuovo, con le foto e **conservando gli
slug**: `/immobili/villa-poggio-porto-cesareo/` resta quell'indirizzo lì, e
non serve nessun redirect.

Lo script **non scrive mai** sul sito WordPress. Legge e basta.

---

## ⚠️ Leggi questo prima di partire

I nomi dei campi personalizzati di WP-Residence **cambiano fra versioni del
tema e temi child**. La mappatura in `app/Core/WpMapper.php` segue le
convenzioni del tema (`property_price`, `property_size`, `property_bedrooms`…)
ma **non è stata verificata sul database vero**: il connettore MCP del sito è
andato in timeout ripetutamente mentre la scrivevo, quindi resta un'ipotesi
ragionevole, non un dato accertato.

Per questo il passo 1 esiste e non è saltabile: stampa i nomi che il *tuo*
sito usa davvero. Se combaciano, non tocchi niente. Se non combaciano, si
correggono gli alias e si riparte — cinque minuti, non una giornata.

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
| «Dotazione non nel vocabolario» | quella caratteristica viene ignorata: se ti serve, aggiungila a `Vocab::FEATURES` |
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
| Riferimento | meta `property_id`, oppure generato (`MIL-0001`…) |
| Tipologia | tassonomia `property_category`, riconosciuta per radice |
| Contratto | tassonomia `property_action_category` |
| Comune e zona | `property_city` e `property_area` |
| Dotazioni | `property_features`, filtrate sul vocabolario |
| Foto | immagine in evidenza + galleria, convertite in WebP e ridotte a 1600 px |

**Non** viene importato: JSON-LD (lo rigenera il codice), meta di Rank Math
(SEO title e description si ricompilano dal gestionale), i campi di
WP-Residence senza equivalente.

---

## Limiti noti

- **Contenuti costruiti con page builder.** La descrizione viene ripulita da
  HTML e shortcode, ma il *testo dentro* gli shortcode resta — ed è giusto
  così, perché di solito è il contenuto vero. Su un immobile costruito con
  Elementor o WPBakery però può arrivare del testo di impaginazione. Dopo
  l'importazione apri due o tre descrizioni e guarda: si correggono dal
  gestionale in un minuto.
- **La galleria** viene letta dai meta `image_to_attach` / `property_images`,
  che secondo la versione del tema contengono una lista di ID o un array
  serializzato. Lo script estrae i numeri da entrambi. Se le foto risultano
  poche, controlla al passo 1 in che chiave sta la galleria.
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
(«Ville in Vendita a Lecce e Provincia») e una dotazione fuori vocabolario.
