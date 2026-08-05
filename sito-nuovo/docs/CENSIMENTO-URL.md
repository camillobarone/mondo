# Censimento degli indirizzi — mondoimmobiliarelecce.it

Letto dal WordPress il **4 agosto 2026**, in sola lettura, tramite il
connettore MCP. Nessuna scrittura sul sito vero.

Il dominio pubblico è **`https://www.mondoimmobiliarelecce.it`**, con il
`www.`: va tenuto presente, perché ogni riga qui sotto è una URL che oggi
Google conosce.

## Il conto

| Cosa | Pubblicati | Bozze |
|---|---|---|
| Immobili (`estate_property`) | 34 | 15 |
| Pagine — contenuto vero | 46 | — |
| Pagine — residui del tema, da buttare | 25 | — |
| Articoli del blog | 56 | 9 |
| **Totale URL pubbliche censite** | **161** | |

Mancano gli archivi delle tassonomie (comune, tipologia, contratto, zona,
caratteristiche, stato) e le pagine 2, 3… degli elenchi. Vanno contati
prima del passaggio: sono quasi tutti `noindex` per scelta di Rank Math, ma
«quasi» non è «tutti» e va verificato uno per uno.

## La cosa più importante che è emersa — decisa il 5 agosto 2026

**Gli articoli del blog stanno alla radice**, non sotto `/blog/`:
`www.mondoimmobiliarelecce.it/imposte-acquisto-casa/`, non
`/blog/imposte-acquisto-casa/`. Il sito nuovo li metteva sotto `/blog/`:
sarebbero stati 56 indirizzi cambiati tutti insieme.

C'erano due strade — servirli alla radice anche sul sito nuovo, oppure
tenere `/blog/` e scrivere 56 reindirizzamenti 301. **Scelta la prima**: in
una migrazione si cambia una cosa alla volta, e la struttura degli
indirizzi non è ciò che c'era da sistemare. Un 301 passa quasi tutto, ma
«quasi» moltiplicato per 56 pagine, mentre cambia anche tutto il resto, era
rischio che si poteva non correre.

**Fatto.** Il sito nuovo serve gli articoli alla radice. In pratica:

- `/blog/` resta ed è l'indice degli articoli — anche sul sito vero c'è una
  pagina con slug `blog` che fa esattamente questo.
- Il singolo articolo risponde su `/<slug>/`, servito dal fallback di
  `Pages::catchAll()` insieme alle pagine statiche: prima i redirect, poi
  le pagine, poi gli articoli, poi il 404.
- `/blog/<slug>/` risponde 301 verso `/<slug>/`. Non serve per il sito
  vero, dove quegli indirizzi non sono mai esistiti: serve a non spezzare i
  link che il sito di prova ha esposto per qualche giorno.
- Articoli e pagine ora condividono la radice, quindi lo slug dev'essere
  unico **fra le due tabelle**, non dentro una sola. Se ne occupa
  `Content::uniqueSlug()`, che rifiuta anche gli slug su cui risponde già
  una rotta fissa (`immobili`, `blog`, `contatti`, `gestionale`…): una
  pagina chiamata «Contatti» diventa `contatti-2` invece di restare
  invisibile per sempre.
- La sitemap e tutti i collegamenti interni puntano già alla forma nuova.

Conseguenza sul resto del censimento: **per gli articoli non serve nessun
reindirizzamento**. I 56 indirizzi restano identici a quelli di oggi.

## Immobili — nessun reindirizzamento necessario

Il sito vecchio usa `/immobili/<slug>/`. Il sito nuovo usa `/immobili/<slug>/`.
Se l'importazione conserva lo slug — e lo conserva — questi 34 indirizzi
restano identici e non serve toccare niente.

| Slug | Immobile |
|---|---|
| `appartamento-stato-rustico` | Appartamento allo stato rustico Copertino |
| `appartamento-con-giardino` | Appartamento con Giardino |
| `appartamento-200-mt-dal-mare` | Appartamento in Vendita a 200 mt dal mare |
| `appartamento-indipendente-2` | Appartamento indipendente |
| `appartamento-indipendente` | Appartamento Indipendente a Frigole |
| `appartamento-belloluogo` | Appartamento nel Residence Belloluogo |
| `appartamento-nuovo-a-lecce` | Appartamento nuovo a Lecce, zona Ariosto |
| `bilocale-a-punta-grossa` | Bilocale a Punta Grossa |
| `casa-da-ristrutturare` | Casa da Ristrutturare a Trepuzzi |
| `casa-mansarda-trepuzzi` | Casa indipendente a Trepuzzi, 122 mq |
| `casa-indipendente-a-trepuzzi` | Casa indipendente in vendita a Trepuzzi |
| `leverano-villa-a-rustico` | Leverano, Villa a rustico |
| `nuda-proprieta-a-san-cesario` | Nuda proprieta a San Cesario di Lecce |
| `porto-cesareo-50-metri-mare` | Porto Cesareo 50 Metri dal Mare |
| `porto-cesareo-casa-vicino-al-mare` | Porto Cesareo casa vicino al mare |
| `residence-a-sant-isidoro` | Residence a Sant Isidoro |
| `torre-lapillo-casa-con-rendita` | Torre Lapillo - indipendente |
| `via-garibaldi-porto-cesareo` | Trilocale a Porto Cesareo, 2 bagni |
| `vendita-locale-artigianale` | Vendita Locale Artigianale |
| `vendita-villetta-eurovillage` | Vendita villetta Eurovillage |
| `villa-a-copertino` | Villa a Copertino |
| `villa-a-punta-prosciutto` | Villa a Punta Prosciutto |
| `villa-con-piscina-con-acqua-salata` | Villa con piscina con acqua salata |
| `villa-indipendente-porto-cesareo` | Villa Indipendente a Porto Cesareo |
| `villa-morfeo-porto-cesareo` | Villa Morfeo |
| `villa-poggio-porto-cesareo` | Villa Porto Cesareo zona Poggio |
| `villaggio-punta-grossa` | Villaggio Punta Grossa |
| `ville-indipendenti-boncore` | Ville indipendenti a Boncore |
| `villetta-eurovillage` | Villetta Bifamiliare a Torre Lapillo Eurovillage |
| `villetta-in-eurovillage` | Villetta in Eurovillage |
| `villetta-a-torre-castiglione` | Villetta in vendita a Torre Castiglione |
| `villetta-indipendente` | Villetta Indipendente a Porto Cesareo |
| `villetta-zona-poggio` | Villetta zona Poggio - Porto Cesareo |
| `villino-indipendente` | Villino indipendente a San Cataldo |

⚠️ Le 15 bozze non sono online e non hanno una URL da conservare, ma vanno
guardate: se una è una bozza di un immobile venduto, la sua vecchia URL
potrebbe essere ancora indicizzata.

## Pagine da ricreare — il grosso del lavoro

Sono le pagine che oggi portano visite: zone, quartieri, guide fiscali,
schede dei soci. Il sito nuovo **non ne ha nessuna**. Ognuna va ricreata
con lo stesso indirizzo, altrimenti si perde la posizione che ha oggi.

| Slug (resta uguale) | Pagina |
|---|---|
| `mondoimmobiliare` | Home (risponde su /) — / |
| `agenzia-immobiliare-lecce` | La nostra agenzia a Lecce |
| `agenzia-immobiliare-porto-cesareo` | Agenzia Immobiliare a Porto Cesareo |
| `chi-siamo` | Chi siamo |
| `contatti` | Contatti |
| `blog` | Articoli (indice del blog) |
| `servizi-immobiliari-esclusivi` | Servizi immobiliari esclusivi |
| `recensioni-clienti-affidabilita` | Recensioni clienti |
| `lavora-con-noi` | Lavora con noi |
| `libro` | Buying Property in Puglia — il libro |
| `virtual-tour-immobiliari` | Virtual tour immobiliari |
| `dove-operiamo-nel-salento` | Dove operiamo nel Salento |
| `case-in-vendita-nel-salento` | Case in vendita nel Salento |
| `vendere-casa-lecce` | Vendere casa a Lecce |
| `quanto-vale-la-mia-casa-a-lecce` | Quanto vale la mia casa a Lecce |
| `prezzi-case-lecce-2026` | Prezzi case Lecce 2026 |
| `quotazioni-omi-lecce` | Quotazioni OMI di Lecce, zona per zona |
| `quartieri-di-lecce` | Quartieri di Lecce |
| `centro-storico-lecce-immobili` | Centro storico di Lecce |
| `quartiere-mazzini-lecce-immobili` | Quartiere Mazzini |
| `quartiere-rudiae-lecce-immobili` | Quartiere Rudiae |
| `quartiere-san-lazzaro-lecce-immobili` | Quartiere San Lazzaro |
| `frigole-lecce` | Frigole |
| `san-cataldo-lecce` | San Cataldo |
| `torre-lapillo` | Torre Lapillo |
| `copertino` | Copertino |
| `nardo` | Nardo |
| `otranto` | Otranto |
| `galatina` | Galatina |
| `gallipoli` | Gallipoli |
| `leverano` | Leverano |
| `agevolazioni-prima-casa-lecce` | Agevolazioni prima casa |
| `tasse-acquisto-seconda-casa-salento` | Tasse seconda casa |
| `costi-notarili-rogito-salento` | Costi notarili rogito |
| `costo-agenzia-immobiliare-lecce` | Costo agenzia immobiliare |
| `mutuo-prima-casa-lecce` | Mutuo prima casa |
| `tempi-rogito-lecce` | Dal compromesso al rogito |
| `comprare-casa-a-lecce` | Comprare casa a Lecce |
| `calcolo-imu-2026-lecce` | Calcolo IMU 2026 — ⚠️ **è un calcolatore, non testo** (vedi sotto) |
| `camillo-barone-agente-immobiliare-lecce-dal-1994` | Camillo Barone |
| `antonio-renna-agente-immobiliare` | Antonio Renna |
| `alessandro-ciullo-agente-immobiliare` | Alessandro Ciullo |
| `stefano-my` | Stefano My |
| `cookie-policy` | Cookie Policy |
| `informativa-sulla-privacy-e-sulluso-dei-dati-di-mondo-immobiliare` | Informativa privacy |
| `terms-of-user` | Terms of Use |

### ⚠️ `calcolo-imu-2026-lecce` — rimandata (5 agosto 2026)

L'unica delle 46 che non si ricrea incollando del testo: è un **calcolatore**.
Si fa con lo stesso schema di `/calcolatore-imposte-acquisto-casa/` — modulo
HTML, `GET`, calcolo in PHP, pagina ridisegnata, zero JavaScript — con una
classe `Imu` accanto a `Core\Imposte`.

Serve prima di poterla fare:

1. **Le aliquote IMU del Comune di Lecce**, prese dalla pagina che l'agenzia
   ha già pubblicato. Sono una delibera comunale: non si ricavano altrove e
   non si inventano, esattamente come le aliquote in `Imposte`.
2. **Dove tenerle.** Quelle di `Imposte` stanno in costanti nel codice, e va
   bene: sono legge nazionale e cambiano di rado. Le aliquote comunali IMU
   cambiano **ogni anno**, quindi andrebbero in Impostazioni, modificabili dal
   gestionale senza toccare file. Decisione non ancora presa.

Nota sull'indirizzo: contiene `2026` e va tenuto identico — cambiarlo
perderebbe la posizione. Da gennaio sarà una pagina aggiornata con un anno
vecchio nell'indirizzo: si convive, aggiornando titolo e contenuto.

## Pagine da NON portare — residui del tema

Sono pagine che WP-Residence installa e che nessuno ha mai tolto. Oggi sono
pubbliche e raggiungibili: pannelli del CRM, pagine di ricerca del tema, una
pagina «Stripe». Non sono contenuto, e alcune espongono all'esterno funzioni
che dovrebbero stare dietro un accesso.

Destinazione consigliata: **410** (sparita apposta) oppure **301 alla home**.
Non vanno ricreate.

- `advanced-search`
- `advanced-search-2`
- `agent-list-sidebar-left`
- `agents-agencies-developers-search-results`
- `compare-listings`
- `dashboard-add-agent`
- `dashboard-add-property`
- `dashboard-agent-list`
- `dashboard-analytics`
- `dashboard-favorite-properties`
- `dashboard-inbox`
- `dashboard-invoices`
- `dashboard-main`
- `dashboard-profile-page`
- `dashboard-property-list`
- `dashboard-saved-searches`
- `dashboard-search-results`
- `half-map-properties-list`
- `properties-standard-list`
- `property-submit-front`
- `saved-searches`
- `stripe`
- `wpestate-crm`
- `wpestate-crm-contacts`
- `wpestate-crm-leads-inquires`

## Articoli del blog

Tutti alla radice, tutti da conservare — è il patrimonio di contenuti
dell'agenzia. Con la strada 1 gli indirizzi restano identici.

| Slug | Titolo |
|---|---|
| `accettazione-tacita-di-eredita` | Accettazione Tacita di Eredità |
| `assegno-circolare` | Assegno Circolare |
| `bonus-casa-under-36` | Bonus Casa Under 36 |
| `calcolo-imposta-di-registro` | Calcolo imposta di registro |
| `caparra-confirmatoria` | Caparra Confirmatoria |
| `cedolare-secca-2024` | Cedolare Secca 2026: Aliquote, Requisiti e Come Funziona |
| `classe-energetica-casa-lecce` | Classe Energetica Casa Lecce |
| `come-diventare-agente-immobiliare` | Come Diventare Agente Immobiliare |
| `come-scegliere-la-casa-giusta-per-te` | Come scegliere la casa giusta per te |
| `come-scegliere-lagenzia-immobiliare-ideale-per-vendere-casa` | Come Scegliere l&#8217;Agenzia Immobiliare Ideale per Vendere Casa |
| `come-vendere-casa-da-privato` | Come Vendere Casa da Privato: Guida Pratica |
| `comodato-di-uso-gratuito` | Comodato di uso Gratuito &#8211; Guida Completa 2026 |
| `comprare-casa-mare-salento-2026` | Comprare Casa al Mare in Salento nell&#8217;Estate 2026: Conviene Farlo Adesso? |
| `comprare-e-vendere-casa-a-lecce` | Comprare e Vendere Casa a Lecce |
| `conferimento-di-incarico-vendita-immobiliare` | Incarico di Vendita Immobiliare: Tipi, Durata e Tutele |
| `conformita-urbanistica-vendita-casa-lecce` | Conformità urbanistica: cosa serve per vendere casa a Lecce nel 2026 |
| `contratto-preliminare-di-vendita` | Contratto Preliminare di Vendita: Guida Completa con Facsimile |
| `detrazione-spese-di-intermediazione` | Detrazione Spese di Intermediazione Immobiliare |
| `direttiva-case-green` | Direttiva Case Green |
| `efficienza-energetica` | Efficienza Energetica degli Edifici |
| `fiducia-e-agente-immobiliare` | Fiducia tra Agente Immobiliare e Cliente: Perché è Decisiva |
| `franchising-vs-agenzie-autonome` | Franchising vs Agenzie Autonome |
| `guida-vendita-di-un-immobile-locato` | Guida alla Vendita di un Immobile Locato |
| `il-contratto-di-rent-to-buy` | Il Contratto di Rent to Buy |
| `il-sogno-di-casa` | Il Sogno di Casa |
| `imposte-acquisto-casa` | Imposte Acquisto Casa |
| `incentivi-fiscali-immobiliari-2025` | Incentivi Fiscali Immobiliari 2026: Bonus Ristrutturazioni, Ecobonus e Sismabonus |
| `intelligenza-artificiale` | Intelligenza Artificiale e Mercato Immobiliare nel 2026 |
| `investimento-immobiliare-salento` | Investimento Immobiliare nel Salento: Rendimenti, Zone e ROI 2026 |
| `lecce-citta-di-storia-e-arte` | Lecce città di storia e arte |
| `matterport` | Matterport: Virtual Tour 3D degli Immobili nel Salento |
| `mercato-immobiliare-lecce-2025` | Mercato Immobiliare Lecce: Volumi di Compravendita e Andamento |
| `mercato-immobiliare-lecce-2026` | Mercato Immobiliare Lecce 2026 |
| `metodo-comparativo` | Metodo Comparativo: Come si Valuta un Immobile a Lecce |
| `miti-da-sfatare` | 5 Miti da Sfatare sul Mercato Immobiliare Leccese che ti Stanno Costando Denaro |
| `mutui-mercato-immobiliare-2026` | Mutui e Mercato Immobiliare 2026: Tassi, Prezzi e Opportunità per Chi Compra o Vende nel Salento |
| `nuda-proprieta` | Nuda Proprietà |
| `planimetria-catastale` | Planimetria Catastale: La Guida Definitiva al 2026 |
| `plusvalenza-immobiliare-2026-guida-lecce` | Plusvalenza Immobiliare 2026: Guida Completa |
| `porto-cesareo` | Porto Cesareo: Mare, Vita e Investimento Immobiliare |
| `potenziale-di-apprezzamento-del-valore-immobiliare` | Apprezzamento del Valore Immobiliare: i Fattori che Contano |
| `prezzi-2025-lecce-zona-santa-rosa` | Prezzi Case a Lecce: Zona Santa Rosa secondo i Dati OMI |
| `prezzo-alto` | Il Mito del Prezzo Alto: Perché Partire Troppo Alti Ti Fa Perdere Soldi |
| `proposta-di-acquisto-immobiliare` | Proposta di Acquisto Immobiliare |
| `ristrutturare-casa` | Ristrutturare Casa |
| `saldo-e-stralcio` | Saldo e Stralcio |
| `sistema-prezzo-valore` | Sistema Prezzo-Valore: Pagare Meno Imposte sull&#8217;Acquisto Casa |
| `smart-home-la-casa-intelligente-del-futuro` | Smart Home: La Casa Intelligente del Futuro |
| `superficie-catastale` | Superficie Catastale: Cos&#8217;è, Come Si Calcola |
| `surroga-del-mutuo-una-guida` | Surroga del Mutuo: Una Guida Dettagliata |
| `tempi-vendita-casa-lecce-2026` | Tempi di Vendita di una Casa a Lecce nel 2026 |
| `valutazione-immobiliare-lecce` | Valutazione Immobiliare: Cos&#8217;è e Come si Calcola a Lecce |
| `vendere-casa-con-mutuo` | Vendere casa con mutuo |
| `vendi-con-mondo-immobiliare` | Vendere Casa a Lecce con Mondo Immobiliare: Il Metodo |
| `villette-da-ristrutturare-salento` | Villette da ristrutturare in Salento: guida all&#8217;acquisto e opportunità 2026 |
| `virtual-tour-3d` | Virtual Tour 3D Immobiliare: Guida a Visitare Casa Online |

## Cosa manca a questo censimento

- Gli archivi delle tassonomie e le pagine 2, 3… degli elenchi
- I redirect che Rank Math già gestisce oggi: se ce ne sono, vanno riportati
  nel gestionale nuovo, altrimenti si creano catene di reindirizzamenti
- Le URL che portano traffico ma non sono nel sito: allegati, PDF, immagini
- Il confronto con Search Console: quali di queste pagine ricevono davvero
  clic. Quelle contano il doppio, le altre si possono anche perdere
