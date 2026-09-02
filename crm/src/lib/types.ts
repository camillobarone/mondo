export type Role = "titolare" | "agente";

export interface User {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  role: Role;
  office: string;
  active: number;
  created_at: string;
}

export type SessionUser = Pick<User, "id" | "email" | "name" | "role" | "office">;

export interface Client {
  id: number;
  first_name: string;
  last_name: string;
  company: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  tax_code: string | null;
  birth_date: string | null;
  roles: string;
  source: string | null;
  contact_reason: string | null;
  contact_property_id: number | null;
  status: string;
  owner_id: number | null;
  tags: string;
  notes: string | null;
  privacy_consent: number;
  privacy_date: string | null;
  privacy_scope: string | null;
  aml_doc_type: string | null;
  aml_doc_number: string | null;
  aml_doc_expiry: string | null;
  aml_checked_at: string | null;
  last_contact_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Property {
  id: number;
  ref: string;
  title: string;
  kind: string;
  contract: string;
  address: string | null;
  city: string | null;
  zone: string | null;
  sqm: number | null;
  rooms: number | null;
  bathrooms: number | null;
  floor: string | null;
  elevator: number;
  outdoor: string | null;
  garage: number;
  condition: string | null;
  energy_class: string | null;
  price: number | null;
  min_price: number | null;
  status: string;
  owner_client_id: number | null;
  agent_id: number | null;
  mandate_start: string | null;
  mandate_end: string | null;
  exclusive: number;
  commission_pct: number | null;
  sold_price: number | null;
  preliminary_date: string | null;
  deed_date: string | null;
  commission_seller: number | null;
  commission_buyer: number | null;
  commission_paid: number;
  /** Il video dell'immobile su YouTube. Il gestionale lo conserva e basta: non ci parla. */
  video_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Requirement {
  id: number;
  client_id: number;
  contract: string;
  /** Csv di tipologie accettate. Un valore solo e' un csv valido: le richieste vecchie non sono state convertite. */
  kind: string | null;
  /** Proiezione di `areas`: il comune della prima area. Scritta solo per ricerca e filtri. */
  city: string | null;
  /** Proiezione di `areas`: tutte le zone in csv. Scritta solo per ricerca e filtri. */
  zones: string;
  /** Le aree in json — la verita'. Si legge con leggiAree() in lib/aree.ts. */
  areas: string;
  /** Csv degli stati in cui accetta l'immobile. */
  conditions: string;
  budget_min: number | null;
  budget_max: number | null;
  sqm_min: number | null;
  rooms_min: number | null;
  needs: string;
  urgency: string;
  financing: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: number;
  type: string;
  title: string;
  notes: string | null;
  client_id: number | null;
  property_id: number | null;
  user_id: number | null;
  due_at: string | null;
  done_at: string | null;
  outcome: string | null;
  interest: string | null;
  created_at: string;
}

export interface Offer {
  id: number;
  property_id: number;
  client_id: number;
  amount: number;
  offered_at: string;
  valid_until: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface Valuation {
  id: number;
  property_id: number | null;
  client_id: number | null;
  city: string | null;
  zone: string | null;
  sqm: number | null;
  eur_sqm_min: number | null;
  eur_sqm_max: number | null;
  value_min: number | null;
  value_max: number | null;
  method: string | null;
  notes: string | null;
  user_id: number | null;
  created_at: string;
}

// ------------------------------------------------------------- vocabolari
// Un solo posto dove vivono le opzioni dei menu a tendina.

export const CLIENT_ROLES = [
  "venditore",
  "acquirente",
  "locatore",
  "conduttore",
  "segnalatore",
  "collega",
] as const;

export const CLIENT_STATUSES = [
  { value: "attivo", label: "Attivo" },
  { value: "in_trattativa", label: "In trattativa" },
  { value: "dormiente", label: "Dormiente" },
  { value: "chiuso", label: "Chiuso" },
  { value: "non_interessato", label: "Non piu' interessato" },
] as const;

export const CLIENT_SOURCES = [
  "Sito web",
  "Immobiliare.it",
  "Idealista",
  "Casa.it",
  "Passaparola",
  "Cartello",
  "Social",
  "Cliente storico",
  "Altro",
] as const;

export const PROPERTY_KINDS = [
  "Appartamento",
  "Attico",
  "Villa",
  "Villetta a schiera",
  "Casa indipendente",
  "Trullo / Pajara",
  "Masseria",
  "Terreno",
  "Locale commerciale",
  "Box / Garage",
  "Rustico",
] as const;

export const PROPERTY_STATUSES = [
  { value: "acquisizione", label: "In acquisizione" },
  { value: "in_vendita", label: "In vendita" },
  { value: "proposta", label: "Proposta ricevuta" },
  { value: "compromesso", label: "Compromesso" },
  { value: "venduto", label: "Venduto" },
  { value: "ritirato", label: "Ritirato" },
] as const;

/** Stati in cui un immobile e' ancora proponibile a un acquirente. */
export const AVAILABLE_STATUSES = ["acquisizione", "in_vendita"] as const;

/**
 * Lo stato di un immobile, dal migliore al peggiore. L'ordine conta: e' quello
 * in cui compaiono nelle tendine, e chi compila sceglie quasi sempre scorrendo
 * dall'alto.
 *
 * Erano quattro fino al 28 agosto 2026, e non bastavano: fra "Ristrutturato" e
 * "Da ristrutturare" ci stanno tre situazioni molto diverse, e un acquirente
 * che dice "lo prendo anche da rivedere, purche' non da rifare" non aveva un
 * modo di dirlo. La stessa lista vale per la richiesta e per l'immobile — se
 * fossero due liste diverse non si potrebbero confrontare, e il filtro nella
 * richiesta sarebbe scritto per niente.
 *
 * "Buono stato" e' diventato "Buono": gli immobili gia' in archivio vengono
 * convertiti da soli all'avvio (vedi allineaStatiImmobili in db.ts).
 */
export const PROPERTY_CONDITIONS = [
  "Nuovo / In costruzione",
  "Ottimo",
  "Ristrutturato",
  "Buono",
  "Discreto",
  "Da rivedere",
  "Da ristrutturare",
] as const;

/**
 * Gli spazi esterni di un immobile. Se ne spunta piu' d'uno: un appartamento
 * con balcone e giardino e' la normalita', non un caso strano.
 *
 * «Nessuno» non c'e' di proposito: nessuna casella spuntata vuol dire gia'
 * nessun esterno, e una casella «Nessuno» accanto alle altre permetterebbe di
 * spuntare insieme «Nessuno» e «Giardino» — due cose che non possono essere
 * vere tutte e due.
 */
export const OUTDOOR_KINDS = ["Balcone", "Terrazzo", "Giardino"] as const;

export const ENERGY_CLASSES = ["A4", "A3", "A2", "A1", "B", "C", "D", "E", "F", "G"] as const;

export const ACTIVITY_TYPES = [
  { value: "chiamata", label: "Telefonata" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "proposta", label: "Proposta immobile" },
  { value: "visita", label: "Visita" },
  { value: "appuntamento", label: "Appuntamento" },
  { value: "nota", label: "Nota" },
  { value: "task", label: "Da fare" },
] as const;

export const OFFER_STATUSES = [
  { value: "in_attesa", label: "In attesa" },
  { value: "accettata", label: "Accettata" },
  { value: "rifiutata", label: "Rifiutata" },
  { value: "ritirata", label: "Ritirata" },
] as const;

export const REQUIREMENT_STATUSES = [
  { value: "aperta", label: "Aperta" },
  { value: "pausa", label: "In pausa" },
  { value: "soddisfatta", label: "Soddisfatta" },
  { value: "persa", label: "Persa" },
] as const;

export const URGENCIES = ["bassa", "media", "alta"] as const;

export const FINANCING = [
  { value: "contanti", label: "Contanti" },
  { value: "mutuo_deliberato", label: "Mutuo gia' deliberato" },
  { value: "mutuo_da_valutare", label: "Mutuo da valutare" },
] as const;

/**
 * Le due sedi, piu' una voce per chi non e' nessuna delle due: le agenzie
 * indipendenti con cui si collabora hanno un'utenza qui dentro, ma non sono
 * un nostro ufficio. E' solo un'etichetta — non decide cosa si vede.
 */
export const OFFICES = ["Lecce", "Porto Cesareo", "Agenzia esterna"] as const;

/**
 * Zone di riferimento del mercato locale. Servono ai filtri e al matching:
 * l'utente puo' comunque scrivere una zona libera.
 */
/**
 * I comuni della provincia di Lecce, tutti.
 *
 * Lecce e Porto Cesareo stanno in cima perche' sono le due sedi e coprono la
 * quasi totalita' delle richieste; gli altri seguono in ordine alfabetico.
 * Sono 96 e non 97 perche' nel 2019 Presicce e Acquarica del Capo si sono
 * uniti in un comune solo.
 *
 * L'elenco non chiude la porta a niente: nel modulo resta un campo libero per
 * un comune fuori provincia, che ogni tanto capita.
 */
export const COMUNI = [
  "Lecce",
  "Porto Cesareo",
  "Alessano",
  "Alezio",
  "Alliste",
  "Andrano",
  "Aradeo",
  "Arnesano",
  "Bagnolo del Salento",
  "Botrugno",
  "Calimera",
  "Campi Salentina",
  "Cannole",
  "Caprarica di Lecce",
  "Carmiano",
  "Carpignano Salentino",
  "Casarano",
  "Castrì di Lecce",
  "Castrignano de' Greci",
  "Castrignano del Capo",
  "Castro",
  "Cavallino",
  "Collepasso",
  "Copertino",
  "Corigliano d'Otranto",
  "Corsano",
  "Cursi",
  "Cutrofiano",
  "Diso",
  "Gagliano del Capo",
  "Galatina",
  "Galatone",
  "Gallipoli",
  "Giuggianello",
  "Giurdignano",
  "Guagnano",
  "Lequile",
  "Leverano",
  "Lizzanello",
  "Maglie",
  "Martano",
  "Martignano",
  "Matino",
  "Melendugno",
  "Melissano",
  "Melpignano",
  "Miggiano",
  "Minervino di Lecce",
  "Monteroni di Lecce",
  "Montesano Salentino",
  "Morciano di Leuca",
  "Muro Leccese",
  "Nardò",
  "Neviano",
  "Nociglia",
  "Novoli",
  "Ortelle",
  "Otranto",
  "Palmariggi",
  "Parabita",
  "Patù",
  "Poggiardo",
  "Presicce-Acquarica",
  "Racale",
  "Ruffano",
  "Salice Salentino",
  "Salve",
  "San Cassiano",
  "San Cesario di Lecce",
  "San Donato di Lecce",
  "San Pietro in Lama",
  "Sanarica",
  "Sannicola",
  "Santa Cesarea Terme",
  "Scorrano",
  "Seclì",
  "Sogliano Cavour",
  "Soleto",
  "Specchia",
  "Spongano",
  "Squinzano",
  "Sternatia",
  "Supersano",
  "Surano",
  "Surbo",
  "Taurisano",
  "Taviano",
  "Tiggiano",
  "Trepuzzi",
  "Tricase",
  "Tuglie",
  "Ugento",
  "Uggiano la Chiesa",
  "Veglie",
  "Vernole",
  "Zollino",
] as const;

/**
 * Quartieri, frazioni e marine di ogni comune.
 *
 * Non e' completa per tutti e 96, e non finge di esserlo: e' fitta dove
 * l'agenzia lavora davvero — Lecce e Porto Cesareo prima di tutto — e si ferma
 * al comune dove non lo fa. Un comune che non compare qui non e' un errore:
 * vuol dire che si sceglie il comune e basta, e se serve una localita' si
 * scrive nel campo libero.
 *
 * E' una lista di partenza, scritta per essere corretta da chi il mercato lo
 * conosce: aggiungere una voce qui e' una riga, e da quel momento compare nel
 * modulo.
 */
export const ZONE_PER_COMUNE: Record<string, readonly string[]> = {
  Lecce: [
    "Centro storico",
    "Mazzini",
    "Salesiani",
    "Ariosto",
    "Rudiae",
    "San Lazzaro",
    "Santa Rosa",
    "Leuca",
    "San Pio",
    "Stadio",
    "Ferrovia",
    "Periferia",
    "San Cataldo",
    "Frigole",
    "Torre Chianca",
    "Spiaggiabella",
    "Torre Rinalda",
    "Casalabate",
  ],
  "Porto Cesareo": [
    "Centro",
    "Torre Lapillo",
    "Punta Prosciutto",
    "Torre Chianca",
    "Scala di Furno",
    "La Strea",
    "Torre Squillace",
  ],
  "Nardò": [
    "Centro storico",
    "Santa Maria al Bagno",
    "Santa Caterina",
    "Sant'Isidoro",
    "Torre Inserraglio",
    "Cenate",
    "Boncore",
  ],
  Gallipoli: ["Centro storico", "Baia Verde", "Lido San Giovanni", "Rivabella", "Padula Bianca"],
  Otranto: ["Centro storico", "Alimini", "Baia dei Turchi", "Frassanito", "Porto Badisco"],
  Melendugno: ["Torre dell'Orso", "Roca", "San Foca", "Torre Specchia Ruggeri", "Borgagne"],
  Vernole: ["Acaya", "Strudà", "Pisignano", "Vanze", "Acquarica di Lecce"],
  Ugento: ["Torre San Giovanni", "Lido Marini", "Torre Mozza", "Gemini", "Fontanelle"],
  Salve: ["Pescoluse", "Torre Pali", "Lido Marini", "Ruggiano"],
  "Castrignano del Capo": ["Santa Maria di Leuca", "Giuliano", "Salignano"],
  "Morciano di Leuca": ["Torre Vado", "Barbarano del Capo"],
  Tricase: ["Tricase Porto", "Depressa", "Lucugnano", "Sant'Eufemia", "Caprarica del Capo"],
  "Santa Cesarea Terme": ["Cerfignano", "Vitigliano", "Porto Miggiano"],
  Andrano: ["Marina di Andrano", "Castiglione"],
  Diso: ["Marittima"],
  Alliste: ["Felline", "Posto Rocco"],
  Racale: ["Torre Suda"],
  Galatina: ["Centro storico", "Collemeto", "Noha", "Santa Barbara"],
  Cavallino: ["Castromediano"],
  Lizzanello: ["Merine"],
  Lequile: ["Dragoni"],
  Carmiano: ["Magliano"],
  Novoli: ["Villa Convento"],
  Poggiardo: ["Vaste"],
  Ruffano: ["Torrepaduli"],
  Alessano: ["Montesardo"],
  "Presicce-Acquarica": ["Presicce", "Acquarica del Capo"],
  Squinzano: ["Casalabate"],
  Trepuzzi: ["Casalabate"],
  Sannicola: ["Chiesanuova"],
};

/** Le zone di un comune, vuote se per quel comune non ne conosciamo. */
export function zonePerComune(comune: string | null | undefined): readonly string[] {
  if (!comune) return [];
  const cercato = comune.trim().toLowerCase();
  const chiave = Object.keys(ZONE_PER_COMUNE).find((c) => c.toLowerCase() === cercato);
  return chiave ? ZONE_PER_COMUNE[chiave]! : [];
}

export const ZONES = [
  "Centro storico",
  "Mazzini",
  "Salesiani",
  "Rudiae",
  "San Lazzaro",
  "Ariosto",
  "Santa Rosa",
  "Leuca",
  "Periferia",
  "Frigole",
  "San Cataldo",
  "Torre Chianca",
  "Porto Cesareo",
  "Torre Lapillo",
] as const;
