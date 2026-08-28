import "server-only";
import crypto from "node:crypto";
import { all, one, count, run } from "./db";
import { fromCsv, euro } from "./format";
import { ZONES } from "./types";
import type {
  Activity,
  Client,
  Offer,
  Property,
  Requirement,
  User,
  Valuation,
} from "./types";

/* ========================================================== visibilita' */

/**
 * Chi sta guardando.
 *
 * Ogni collaboratore vede soltanto la propria roba, e questo vale per tutti,
 * titolare compreso: l'archivio e' condiviso come edificio, non come
 * contenuto. Per questo quasi tutte le funzioni qui sotto vogliono come primo
 * dato l'id di chi ha fatto l'accesso.
 *
 * E' scomodo di proposito. Se la persona che guarda si prendesse da sola —
 * da una variabile di contesto, per dire — una funzione nuova nascerebbe
 * senza muro e nessuno se ne accorgerebbe fino al giorno del danno. Cosi'
 * invece il programma non si compila nemmeno finche' non si e' deciso, per
 * ogni singola lettura, chi ha diritto di vederla.
 *
 * Le due colonne che decidono tutto:
 *   clients.owner_id    -> di chi e' il cliente
 *   properties.agent_id -> di chi e' l'immobile
 * Tutto il resto (richieste, attivita', proposte, valutazioni, foto, storico
 * prezzi) non ha una proprieta' sua: eredita da cliente o immobile.
 */

/** Il cliente e' mio. Richiede la tabella clients come `c`. */
const CLIENTE_MIO = `c.owner_id = ?`;

/** L'immobile e' mio. Richiede la tabella properties come `p`. */
const IMMOBILE_MIO = `p.agent_id = ?`;

/**
 * Un'attivita' si vede se e' mia, oppure se e' attaccata a una mia scheda.
 *
 * Le tre strade servono tutte. La prima e' il caso normale. La seconda e la
 * terza tengono in piedi le visite fatte a quattro mani — un mio acquirente
 * portato a vedere l'immobile di un collega riguarda tutti e due — e rendono
 * innocua un'attivita' rimasta senza assegnatario, che altrimenti sparirebbe
 * dall'agenda di chiunque senza che nessuno se ne accorga.
 *
 * Richiede le tre tabelle come `a`, `c` e `p` (vedi ACTIVITY_SELECT).
 */
const ATTIVITA_MIA = `(a.user_id = ? OR c.owner_id = ? OR p.agent_id = ?)`;

/** I tre parametri, nell'ordine, che ATTIVITA_MIA si aspetta. */
const perAttivita = (utente: number) => [utente, utente, utente];

/* ============================================================== clienti */

export interface ClientFilters {
  q?: string;
  status?: string;
  role?: string;
  owner?: string;
  source?: string;
  tag?: string;
  /** Non sentiti da almeno N giorni. */
  silentDays?: string;
  /** Filtri "da sistemare": richiesta | privacy | aml. */
  senza?: string;
  /** alfabetico | recenti (assente = recenti, gli ultimi inseriti in cima). */
  sort?: string;
  page?: string;
}

/** L'ordine dell'elenco clienti: alfabetico, oppure gli ultimi inseriti in
 * cima. Di default i piu' recenti — e' quello che serve appena si aggiunge un
 * nominativo, non doverlo cercare in mezzo a mille altri in ordine di cognome. */
function clientOrderBy(sort: string | undefined): string {
  return sort === "alfabetico"
    ? "c.last_name COLLATE NOCASE, c.first_name COLLATE NOCASE"
    : "c.created_at DESC, c.id DESC";
}

export const PAGE_SIZE = 40;

export type ClientRow = Client & {
  owner_name: string | null;
  open_requirements: number;
  /** Riepilogo di cosa cerca, per mostrarlo direttamente in elenco. */
  want_budget_min: number | null;
  want_budget_max: number | null;
  want_city: string | null;
  want_zones: string | null;
};

function clientWhere(
  utente: number,
  filters: ClientFilters,
): { sql: string; params: unknown[] } {
  // Il vincolo di proprieta' sta qui dentro, insieme agli altri filtri, e non
  // nelle singole query: cosi' l'elenco e il conteggio che lo accompagna
  // nascono dalla stessa condizione. Un conteggio calcolato per conto suo
  // direbbe quante schede hanno i colleghi, senza mostrarne nessuna.
  const clauses = ["c.deleted_at IS NULL", CLIENTE_MIO];
  const params: unknown[] = [utente];

  const q = filters.q?.trim();
  if (q) {
    clauses.push(`(
      c.first_name LIKE ? OR c.last_name LIKE ? OR c.company LIKE ?
      OR c.email LIKE ? OR c.phone LIKE ? OR c.mobile LIKE ?
      OR c.notes LIKE ? OR c.tags LIKE ? OR c.city LIKE ?
      OR (c.first_name || ' ' || c.last_name) LIKE ?
    )`);
    const like = `%${q}%`;
    params.push(like, like, like, like, like, like, like, like, like, like);
  }

  if (filters.status) {
    clauses.push("c.status = ?");
    params.push(filters.status);
  }
  if (filters.role) {
    clauses.push("(',' || c.roles || ',') LIKE ?");
    params.push(`%,${filters.role},%`);
  }
  if (filters.owner) {
    clauses.push("c.owner_id = ?");
    params.push(Number(filters.owner));
  }
  if (filters.source) {
    clauses.push("c.source = ?");
    params.push(filters.source);
  }
  if (filters.tag) {
    clauses.push("(',' || c.tags || ',') LIKE ?");
    params.push(`%,${filters.tag},%`);
  }
  if (filters.silentDays) {
    const days = Number(filters.silentDays);
    if (Number.isFinite(days) && days > 0) {
      clauses.push(
        `(c.last_contact_at IS NULL OR c.last_contact_at < datetime('now', ?))`,
      );
      params.push(`-${days} days`);
    }
  }

  // I filtri del riquadro "Da sistemare" sul cruscotto: ognuno isola una
  // mancanza che nel lavoro quotidiano non si vede, finche' non fa danno.
  if (filters.senza === "richiesta") {
    // Stessa condizione del conteggio sul cruscotto: il numero cliccato e
    // l'elenco che si apre devono dire la stessa cosa.
    clauses.push(`(
      c.status IN ('attivo','in_trattativa')
      AND ((',' || c.roles || ',') LIKE '%,acquirente,%' OR (',' || c.roles || ',') LIKE '%,conduttore,%')
      AND NOT EXISTS (SELECT 1 FROM requirements r
                       WHERE r.client_id = c.id AND r.status = 'aperta')
    )`);
  } else if (filters.senza === "privacy") {
    clauses.push(`c.privacy_consent = 0 AND c.status IN ('attivo','in_trattativa')`);
  } else if (filters.senza === "aml") {
    clauses.push(
      `c.aml_doc_expiry IS NOT NULL AND date(c.aml_doc_expiry) < date('now','localtime')`,
    );
  }

  return { sql: clauses.join(" AND "), params };
}

export function listClients(
  utente: number,
  filters: ClientFilters,
): {
  rows: ClientRow[];
  total: number;
  page: number;
  pages: number;
} {
  const { sql, params } = clientWhere(utente, filters);
  const page = Math.max(1, Number(filters.page ?? 1) || 1);
  const total = count(`SELECT COUNT(*) AS n FROM clients c WHERE ${sql}`, params);

  const rows = all<ClientRow>(
    `SELECT c.*,
            u.name AS owner_name,
            (SELECT COUNT(*) FROM requirements r
              WHERE r.client_id = c.id AND r.status = 'aperta') AS open_requirements,
            (SELECT MIN(r.budget_min) FROM requirements r
              WHERE r.client_id = c.id AND r.status = 'aperta') AS want_budget_min,
            (SELECT MAX(r.budget_max) FROM requirements r
              WHERE r.client_id = c.id AND r.status = 'aperta') AS want_budget_max,
            (SELECT r.city FROM requirements r
              WHERE r.client_id = c.id AND r.status = 'aperta'
              ORDER BY r.updated_at DESC LIMIT 1) AS want_city,
            (SELECT r.zones FROM requirements r
              WHERE r.client_id = c.id AND r.status = 'aperta'
              ORDER BY r.updated_at DESC LIMIT 1) AS want_zones
       FROM clients c
       LEFT JOIN users u ON u.id = c.owner_id
      WHERE ${sql}
      ORDER BY ${clientOrderBy(filters.sort)}
      LIMIT ? OFFSET ?`,
    [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE],
  );

  return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Come listClients ma senza pagina: serve all'esportazione. */
export function listAllClients(utente: number, filters: ClientFilters): ClientRow[] {
  const { sql, params } = clientWhere(utente, filters);
  return all<ClientRow>(
    `SELECT c.*, u.name AS owner_name, 0 AS open_requirements,
            NULL AS want_budget_min, NULL AS want_budget_max,
            NULL AS want_city, NULL AS want_zones
       FROM clients c
       LEFT JOIN users u ON u.id = c.owner_id
      WHERE ${sql}
      ORDER BY c.last_name COLLATE NOCASE, c.first_name COLLATE NOCASE`,
    params,
  );
}

/**
 * Una scheda cliente, se e' di chi la chiede.
 *
 * Il cliente di un collega non da' errore «non sei autorizzato»: risulta
 * inesistente, esattamente come un numero inventato. La differenza non e'
 * formale — un «non autorizzato» confermerebbe che quella scheda c'e', e
 * provando gli indirizzi uno dopo l'altro si conterebbe l'archivio altrui
 * senza vederne una riga.
 */
export function getClient(
  utente: number,
  id: number,
): (Client & {
  owner_name: string | null;
  contact_property_ref: string | null;
  contact_property_title: string | null;
}) | undefined {
  return one<
    Client & {
      owner_name: string | null;
      contact_property_ref: string | null;
      contact_property_title: string | null;
    }
  >(
    `SELECT c.*, u.name AS owner_name,
            cp.ref   AS contact_property_ref,
            cp.title AS contact_property_title
       FROM clients c
       LEFT JOIN users      u  ON u.id = c.owner_id
       LEFT JOIN properties cp ON cp.id = c.contact_property_id
      WHERE c.id = ? AND c.deleted_at IS NULL AND ${CLIENTE_MIO}`,
    [id, utente],
  );
}

/** Cerca possibili doppioni prima di creare un cliente, fra i propri. */
export function findDuplicates(
  utente: number,
  mobile: string | null,
  email: string | null,
  firstName: string,
  lastName: string,
  excludeId = 0,
): Client[] {
  return all<Client>(
    `SELECT * FROM clients
      WHERE deleted_at IS NULL AND id != ? AND owner_id = ?
        AND (
          (? != '' AND REPLACE(REPLACE(mobile,' ',''),'.','') = ?)
          OR (? != '' AND email = ? COLLATE NOCASE)
          OR (first_name = ? COLLATE NOCASE AND last_name = ? COLLATE NOCASE)
        )
      LIMIT 5`,
    [
      excludeId,
      utente,
      mobile ?? "",
      (mobile ?? "").replace(/[\s.]/g, ""),
      email ?? "",
      email ?? "",
      firstName,
      lastName,
    ],
  );
}

export function clientTags(utente: number): string[] {
  const rows = all<{ tags: string }>(
    `SELECT tags FROM clients WHERE deleted_at IS NULL AND tags != '' AND owner_id = ?`,
    [utente],
  );
  const set = new Set<string>();
  for (const row of rows) {
    for (const tag of row.tags.split(",")) {
      const trimmed = tag.trim();
      if (trimmed) set.add(trimmed);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, "it"));
}

/* ============================================================ immobili */

export interface PropertyFilters {
  q?: string;
  status?: string;
  contract?: string;
  kind?: string;
  city?: string;
  zone?: string;
  agent?: string;
  priceMin?: string;
  priceMax?: string;
  /** Solo quelli senza proprietario collegato. */
  noOwner?: string;
  /** Solo quelli senza via, da completare a mano. */
  noAddress?: string;
  page?: string;
}

/**
 * Un immobile "senza via".
 *
 * Sta scritto qui una volta sola perche' lo usano in due: il filtro
 * dell'elenco e il numero che lo annuncia. Se le due condizioni si
 * scollegassero, il cruscotto direbbe "12 da completare" e l'elenco ne
 * aprirebbe undici, senza che si capisca perche'.
 *
 * L'indirizzo e' obbligatorio dal 27 agosto 2026, ma solo per i salvataggi da
 * allora in poi: le schede piu' vecchie hanno NULL, e una salvata con un campo
 * di soli spazi ha la stringa vuota. Valgono tutte e due.
 */
const IMMOBILE_SENZA_VIA = `(p.address IS NULL OR TRIM(p.address) = '')`;

export type PropertyRow = Property & {
  owner_name: string | null;
  agent_name: string | null;
};

function propertyWhere(
  utente: number,
  filters: PropertyFilters,
): { sql: string; params: unknown[] } {
  const clauses = ["p.deleted_at IS NULL", IMMOBILE_MIO];
  const params: unknown[] = [utente];

  const q = filters.q?.trim();
  if (q) {
    clauses.push(`(
      p.title LIKE ? OR p.ref LIKE ? OR p.address LIKE ?
      OR p.city LIKE ? OR p.zone LIKE ? OR p.notes LIKE ?
    )`);
    const like = `%${q}%`;
    params.push(like, like, like, like, like, like);
  }

  if (filters.status) {
    clauses.push("p.status = ?");
    params.push(filters.status);
  }
  if (filters.contract) {
    clauses.push("p.contract = ?");
    params.push(filters.contract);
  }
  if (filters.kind) {
    clauses.push("p.kind = ?");
    params.push(filters.kind);
  }
  if (filters.city) {
    clauses.push("p.city = ? COLLATE NOCASE");
    params.push(filters.city);
  }
  if (filters.zone) {
    clauses.push("p.zone = ? COLLATE NOCASE");
    params.push(filters.zone);
  }
  if (filters.agent) {
    clauses.push("p.agent_id = ?");
    params.push(Number(filters.agent));
  }
  if (filters.noOwner === "1") {
    clauses.push("p.owner_client_id IS NULL");
  }
  if (filters.noAddress === "1") {
    clauses.push(IMMOBILE_SENZA_VIA);
  }
  if (filters.priceMin) {
    clauses.push("p.price >= ?");
    params.push(Number(filters.priceMin));
  }
  if (filters.priceMax) {
    clauses.push("p.price <= ?");
    params.push(Number(filters.priceMax));
  }

  return { sql: clauses.join(" AND "), params };
}

export function listProperties(
  utente: number,
  filters: PropertyFilters,
): {
  rows: PropertyRow[];
  total: number;
  page: number;
  pages: number;
} {
  const { sql, params } = propertyWhere(utente, filters);
  const page = Math.max(1, Number(filters.page ?? 1) || 1);
  const total = count(`SELECT COUNT(*) AS n FROM properties p WHERE ${sql}`, params);

  const rows = all<PropertyRow>(
    `SELECT p.*,
            TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) AS owner_name,
            u.name AS agent_name
       FROM properties p
       LEFT JOIN clients c ON c.id = p.owner_client_id
       LEFT JOIN users   u ON u.id = p.agent_id
      WHERE ${sql}
      ORDER BY
        CASE p.status
          WHEN 'in_vendita'   THEN 1
          WHEN 'proposta'     THEN 2
          WHEN 'acquisizione' THEN 3
          WHEN 'compromesso'  THEN 4
          ELSE 5
        END,
        p.updated_at DESC
      LIMIT ? OFFSET ?`,
    [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE],
  );

  return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export function listAllProperties(utente: number, filters: PropertyFilters): PropertyRow[] {
  const { sql, params } = propertyWhere(utente, filters);
  return all<PropertyRow>(
    `SELECT p.*,
            TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) AS owner_name,
            u.name AS agent_name
       FROM properties p
       LEFT JOIN clients c ON c.id = p.owner_client_id
       LEFT JOIN users   u ON u.id = p.agent_id
      WHERE ${sql}
      ORDER BY p.updated_at DESC`,
    params,
  );
}

/** Un immobile, se e' di chi lo chiede. Vale la stessa regola di getClient. */
export function getProperty(utente: number, id: number): PropertyRow | undefined {
  return one<PropertyRow>(
    `SELECT p.*,
            TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) AS owner_name,
            u.name AS agent_name
       FROM properties p
       LEFT JOIN clients c ON c.id = p.owner_client_id
       LEFT JOIN users   u ON u.id = p.agent_id
      WHERE p.id = ? AND p.deleted_at IS NULL AND ${IMMOBILE_MIO}`,
    [id, utente],
  );
}

/**
 * Gli immobili intestati a un cliente.
 *
 * Il filtro e' sull'immobile, non sul cliente: un mio venditore puo' avere
 * dato un secondo immobile a un collega, e quello non e' affare mio. Nella
 * sua scheda vedro' solo cio' che seguo io.
 */
export function propertiesOfClient(utente: number, clientId: number): Property[] {
  return all<Property>(
    `SELECT * FROM properties
      WHERE owner_client_id = ? AND deleted_at IS NULL AND agent_id = ?
      ORDER BY updated_at DESC`,
    [clientId, utente],
  );
}

export interface Photo {
  id: number;
  property_id: number;
  file: string;
  caption: string | null;
  position: number;
}

export function photosOfProperty(utente: number, propertyId: number): Photo[] {
  return all<Photo>(
    `SELECT f.id, f.property_id, f.file, f.caption, f.position
       FROM photos f
       JOIN properties p ON p.id = f.property_id
      WHERE f.property_id = ? AND ${IMMOBILE_MIO}
      ORDER BY f.position, f.id`,
    [propertyId, utente],
  );
}

/** La prima foto di ogni immobile, per mostrarla negli elenchi. */
export function coverPhotos(utente: number, propertyIds: number[]): Map<number, string> {
  if (!propertyIds.length) return new Map();
  const segnaposto = propertyIds.map(() => "?").join(",");
  const rows = all<{ property_id: number; file: string }>(
    `SELECT f.property_id, f.file
       FROM photos f
       JOIN properties p ON p.id = f.property_id
      WHERE f.property_id IN (${segnaposto}) AND ${IMMOBILE_MIO}
      ORDER BY f.property_id, f.position, f.id`,
    [...propertyIds, utente],
  );

  const cover = new Map<number, string>();
  for (const row of rows) if (!cover.has(row.property_id)) cover.set(row.property_id, row.file);
  return cover;
}

export function priceHistory(utente: number, propertyId: number) {
  return all<{ id: number; price: number; changed_at: string; user_name: string | null }>(
    `SELECT h.id, h.price, h.changed_at, u.name AS user_name
       FROM price_history h
       JOIN properties p ON p.id = h.property_id
       LEFT JOIN users u ON u.id = h.user_id
      WHERE h.property_id = ? AND ${IMMOBILE_MIO}
      ORDER BY h.changed_at DESC`,
    [propertyId, utente],
  );
}

/**
 * I comuni gia' presenti in archivio, per la tendina dei filtri.
 *
 * Anche questi sono ristretti ai propri immobili. Sembra un eccesso — un
 * nome di paese non e' un dato di nessuno — ma la tendina direbbe comunque
 * dove lavora il collega, e sarebbe un elenco che si allunga da solo ogni
 * volta che acquisisce in un posto nuovo.
 */
export function distinctCities(utente: number): string[] {
  return all<{ city: string }>(
    `SELECT DISTINCT p.city AS city FROM properties p
      WHERE p.deleted_at IS NULL AND p.city IS NOT NULL AND p.city != ''
        AND ${IMMOBILE_MIO}
      ORDER BY p.city COLLATE NOCASE`,
    [utente],
  ).map((row) => row.city);
}

/**
 * Zone gia' usate in archivio, sugli immobili e sulle richieste, unite a
 * quelle di partenza. Sono suggerimenti, non una gabbia: chi inserisce puo'
 * sempre scrivere una localita' nuova, e da quel momento la ritrova qui.
 */
export function knownZones(utente: number): string[] {
  const fromProperties = all<{ zone: string }>(
    `SELECT DISTINCT p.zone AS zone FROM properties p
      WHERE p.deleted_at IS NULL AND p.zone IS NOT NULL AND p.zone != ''
        AND ${IMMOBILE_MIO}`,
    [utente],
  ).map((row) => row.zone);

  const fromRequirements = all<{ zones: string }>(
    `SELECT DISTINCT r.zones AS zones FROM requirements r
       JOIN clients c ON c.id = r.client_id
      WHERE r.zones IS NOT NULL AND r.zones != '' AND ${CLIENTE_MIO}`,
    [utente],
  ).flatMap((row) => fromCsv(row.zones));

  const seen = new Map<string, string>();
  for (const raw of [...ZONES, ...fromProperties, ...fromRequirements]) {
    const zone = raw.trim();
    const key = zone.toLowerCase();
    if (zone && !seen.has(key)) seen.set(key, zone);
  }

  return [...seen.values()].sort((a, b) => a.localeCompare(b, "it"));
}

/* ============================================================ richieste */

export type RequirementRow = Requirement & {
  client_name: string;
  client_mobile: string | null;
};

export function listRequirements(
  utente: number,
  filters: {
    q?: string;
    status?: string;
    contract?: string;
    city?: string;
    page?: string;
  },
): { rows: RequirementRow[]; total: number; page: number; pages: number } {
  // La richiesta non ha un proprietario suo: e' di chi segue il cliente.
  const clauses = ["c.deleted_at IS NULL", CLIENTE_MIO];
  const params: unknown[] = [utente];

  if (filters.q?.trim()) {
    const like = `%${filters.q.trim()}%`;
    clauses.push(
      `((c.first_name || ' ' || c.last_name) LIKE ? OR r.notes LIKE ? OR r.city LIKE ? OR r.zones LIKE ?)`,
    );
    params.push(like, like, like, like);
  }
  if (filters.status) {
    clauses.push("r.status = ?");
    params.push(filters.status);
  }
  if (filters.contract) {
    clauses.push("r.contract = ?");
    params.push(filters.contract);
  }
  if (filters.city) {
    clauses.push("r.city = ? COLLATE NOCASE");
    params.push(filters.city);
  }

  const where = clauses.join(" AND ");
  const page = Math.max(1, Number(filters.page ?? 1) || 1);
  const total = count(
    `SELECT COUNT(*) AS n FROM requirements r JOIN clients c ON c.id = r.client_id WHERE ${where}`,
    params,
  );

  const rows = all<RequirementRow>(
    `SELECT r.*,
            TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) AS client_name,
            c.mobile AS client_mobile
       FROM requirements r
       JOIN clients c ON c.id = r.client_id
      WHERE ${where}
      ORDER BY
        CASE r.status WHEN 'aperta' THEN 1 WHEN 'pausa' THEN 2 ELSE 3 END,
        CASE r.urgency WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
        r.updated_at DESC
      LIMIT ? OFFSET ?`,
    [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE],
  );

  return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export function getRequirement(utente: number, id: number): RequirementRow | undefined {
  return one<RequirementRow>(
    `SELECT r.*,
            TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) AS client_name,
            c.mobile AS client_mobile
       FROM requirements r
       JOIN clients c ON c.id = r.client_id
      WHERE r.id = ? AND ${CLIENTE_MIO}`,
    [id, utente],
  );
}

export function requirementsOfClient(utente: number, clientId: number): Requirement[] {
  return all<Requirement>(
    `SELECT r.* FROM requirements r
       JOIN clients c ON c.id = r.client_id
      WHERE r.client_id = ? AND ${CLIENTE_MIO}
      ORDER BY r.updated_at DESC`,
    [clientId, utente],
  );
}

/* ============================================================ attivita' */

export type ActivityRow = Activity & {
  client_name: string | null;
  property_title: string | null;
  property_address: string | null;
  property_city: string | null;
  property_price: number | null;
  user_name: string | null;
};

/**
 * Le colonne di un'attivita', con i nomi collegati.
 *
 * Il nome del cliente e il titolo dell'immobile escono solo se quella scheda
 * e' di chi guarda. Non e' pignoleria: un'attivita' puo' essere mia e toccare
 * la scheda di un collega — una visita fatta insieme, un immobile passato di
 * mano — e in quel caso l'attivita' si vede, ma il nome che ci sta attaccato
 * no. Senza questo taglio il muro avrebbe una finestra proprio dove passa
 * tutto il lavoro quotidiano.
 *
 * Vuole due parametri in testa, prima di quelli della WHERE: vedi perAttivita.
 */
const ACTIVITY_SELECT = `
  SELECT a.*,
         CASE WHEN c.owner_id = ?
              THEN TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,''))
              END AS client_name,
         CASE WHEN p.agent_id = ? THEN p.title   END AS property_title,
         CASE WHEN p.agent_id = ? THEN p.address END AS property_address,
         CASE WHEN p.agent_id = ? THEN p.city    END AS property_city,
         CASE WHEN p.agent_id = ? THEN p.price   END AS property_price,
         u.name  AS user_name
    FROM activities a
    LEFT JOIN clients    c ON c.id = a.client_id
    LEFT JOIN properties p ON p.id = a.property_id
    LEFT JOIN users      u ON u.id = a.user_id`;

/** I cinque parametri che ACTIVITY_SELECT si aspetta prima della WHERE. */
const perNomiAttivita = (utente: number) => [utente, utente, utente, utente, utente];

export function activitiesOfClient(
  utente: number,
  clientId: number,
  limit = 100,
): ActivityRow[] {
  return all<ActivityRow>(
    `${ACTIVITY_SELECT}
      WHERE a.client_id = ? AND ${ATTIVITA_MIA}
      ORDER BY COALESCE(a.due_at, a.done_at, a.created_at) DESC
      LIMIT ?`,
    [...perNomiAttivita(utente), clientId, ...perAttivita(utente), limit],
  );
}

export function activitiesOfProperty(
  utente: number,
  propertyId: number,
  limit = 100,
): ActivityRow[] {
  return all<ActivityRow>(
    `${ACTIVITY_SELECT}
      WHERE a.property_id = ? AND ${ATTIVITA_MIA}
      ORDER BY COALESCE(a.due_at, a.done_at, a.created_at) DESC
      LIMIT ?`,
    [...perNomiAttivita(utente), propertyId, ...perAttivita(utente), limit],
  );
}

export type VisitRow = ActivityRow & { client_phone: string | null };

/**
 * Visite e appuntamenti registrati su un immobile, dal piu' vecchio al piu'
 * recente. E' lo storico che si consegna al proprietario, e prende da una
 * fonte sola: l'agenda. Quello che si segna in agenda compare qui, senza
 * doverlo riscrivere da nessuna parte — se lo storico fosse un elenco a
 * parte, le due liste divergerebbero alla prima visita segnata di fretta.
 *
 * Ci sono anche gli appuntamenti ancora da fare: al proprietario interessa
 * sapere che qualcuno passa la settimana prossima.
 */
export function visitHistory(utente: number, propertyId: number): VisitRow[] {
  return all<VisitRow>(
    `SELECT a.*,
            CASE WHEN c.owner_id = ?
                 THEN TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,''))
                 END AS client_name,
            CASE WHEN c.owner_id = ? THEN COALESCE(c.mobile, c.phone) END AS client_phone,
            CASE WHEN p.agent_id = ? THEN p.title END AS property_title,
            u.name  AS user_name
       FROM activities a
       LEFT JOIN clients    c ON c.id = a.client_id
       LEFT JOIN properties p ON p.id = a.property_id
       LEFT JOIN users      u ON u.id = a.user_id
      WHERE a.property_id = ?
        AND a.type IN ('visita', 'appuntamento')
        AND ${ATTIVITA_MIA}
      ORDER BY COALESCE(a.due_at, a.done_at, a.created_at)`,
    [utente, utente, utente, propertyId, ...perAttivita(utente)],
  );
}

/**
 * Cose da fare: scadute, oggi e in arrivo.
 *
 * `soloAssegnateAMe` distingue due cose che prima erano «le mie» e «quelle di
 * tutti»: adesso «tutte» vuol dire tutte quelle che rientrano nel proprio
 * archivio — comprese quelle che un collega ha segnato su una mia scheda
 * durante una visita fatta insieme — e non piu' quelle dell'agenzia intera.
 */
export function agenda(utente: number, soloAssegnateAMe: boolean) {
  const scope = soloAssegnateAMe ? "AND a.user_id = ?" : `AND ${ATTIVITA_MIA}`;
  const params = (extra: unknown[]) => [
    ...perNomiAttivita(utente),
    ...extra,
    ...(soloAssegnateAMe ? [utente] : perAttivita(utente)),
  ];

  return {
    overdue: all<ActivityRow>(
      `${ACTIVITY_SELECT}
        WHERE a.done_at IS NULL AND a.due_at IS NOT NULL
          AND date(a.due_at) < date('now','localtime') ${scope}
        ORDER BY a.due_at`,
      params([]),
    ),
    today: all<ActivityRow>(
      `${ACTIVITY_SELECT}
        WHERE a.done_at IS NULL AND date(a.due_at) = date('now','localtime') ${scope}
        ORDER BY a.due_at`,
      params([]),
    ),
    upcoming: all<ActivityRow>(
      `${ACTIVITY_SELECT}
        WHERE a.done_at IS NULL
          AND date(a.due_at) > date('now','localtime')
          AND date(a.due_at) <= date('now','localtime','+14 days') ${scope}
        ORDER BY a.due_at`,
      params([]),
    ),
    done: all<ActivityRow>(
      `${ACTIVITY_SELECT}
        WHERE a.done_at IS NOT NULL
          AND date(a.done_at) >= date('now', '-14 days') ${scope}
        ORDER BY a.done_at DESC
        LIMIT 60`,
      params([]),
    ),
  };
}

/** Una singola attivita', per la pagina di modifica. */
export function getActivity(utente: number, id: number): ActivityRow | undefined {
  return one<ActivityRow>(`${ACTIVITY_SELECT} WHERE a.id = ? AND ${ATTIVITA_MIA}`, [
    ...perNomiAttivita(utente),
    id,
    ...perAttivita(utente),
  ]);
}

/* ==================================================================== calendario */

/**
 * Gli appuntamenti da mettere nel calendario di una persona.
 *
 * Solo quelli con una data: una nota o una telefonata gia' fatta non e' un
 * appuntamento. Si tiene un mese indietro perche' un calendario che dimentica
 * subito il passato e' scomodo da consultare, e un anno avanti perche' oltre
 * non si prende appuntamento.
 */
export function calendarActivities(userId: number): ActivityRow[] {
  // Qui il filtro e' gia' quello giusto e resta com'e': il calendario e' di
  // una persona sola, e contiene gli appuntamenti assegnati a lei.
  return all<ActivityRow>(
    `${ACTIVITY_SELECT}
      WHERE a.user_id = ?
        AND a.due_at IS NOT NULL
        AND date(a.due_at) >= date('now','localtime','-30 days')
        AND date(a.due_at) <= date('now','localtime','+365 days')
      ORDER BY a.due_at`,
    [...perNomiAttivita(userId), userId],
  );
}

/**
 * La chiave che sta nell'indirizzo del calendario. Vale come una password —
 * chi ce l'ha vede gli appuntamenti — quindi e' lunga e casuale, e si genera
 * la prima volta che serve invece di darne una a tutti fin dall'inizio.
 */
export function calendarToken(userId: number): string {
  const riga = one<{ calendar_token: string | null }>(
    `SELECT calendar_token FROM users WHERE id = ?`,
    [userId],
  );
  if (riga?.calendar_token) return riga.calendar_token;

  const token = crypto.randomBytes(24).toString("base64url");
  run(`UPDATE users SET calendar_token = ? WHERE id = ?`, [token, userId]);
  return token;
}

/** Genera una chiave nuova: la precedente smette di funzionare. */
export function resetCalendarToken(userId: number): string {
  const token = crypto.randomBytes(24).toString("base64url");
  run(`UPDATE users SET calendar_token = ? WHERE id = ?`, [token, userId]);
  return token;
}

export function userByCalendarToken(
  token: string,
): { id: number; name: string; email: string } | undefined {
  if (!token || token.length < 20) return undefined;
  return one<{ id: number; name: string; email: string }>(
    `SELECT id, name, email FROM users WHERE calendar_token = ? AND active = 1`,
    [token],
  );
}

/* ============================================================= venditori */

export type SellerRow = Client & {
  properties: Property[];
  /** Giorni al prossimo compleanno: 0 = oggi. null se la data non c'e'. */
  birthdayIn: number | null;
};

/**
 * I proprietari: chi ha il ruolo di venditore o locatore, piu' chiunque
 * risulti intestatario di un immobile in portafoglio. Il ruolo puo' non
 * essere stato spuntato — l'immobile collegato dice la stessa cosa e non
 * dipende da come e' stata compilata la scheda.
 */
export function listSellers(
  utente: number,
  filters: { q?: string; page?: string } = {},
): {
  rows: SellerRow[];
  total: number;
  page: number;
  pages: number;
} {
  // La scorciatoia dell'immobile collegato vale solo se l'immobile e' mio:
  // altrimenti il venditore di un collega entrerebbe nel mio elenco soltanto
  // perche' e' intestatario di qualcosa che io non seguo.
  const clauses = [
    `c.deleted_at IS NULL`,
    CLIENTE_MIO,
    `(
       (',' || c.roles || ',') LIKE '%,venditore,%'
       OR (',' || c.roles || ',') LIKE '%,locatore,%'
       OR EXISTS (SELECT 1 FROM properties p
                   WHERE p.owner_client_id = c.id AND p.deleted_at IS NULL
                     AND ${IMMOBILE_MIO})
     )`,
  ];
  const params: unknown[] = [utente, utente];

  const q = filters.q?.trim();
  if (q) {
    clauses.push(`(
      c.first_name LIKE ? OR c.last_name LIKE ? OR c.company LIKE ?
      OR c.mobile LIKE ? OR c.phone LIKE ? OR c.email LIKE ?
      OR (c.first_name || ' ' || c.last_name) LIKE ?
    )`);
    const like = `%${q}%`;
    params.push(like, like, like, like, like, like, like);
  }

  const where = clauses.join(" AND ");
  const page = Math.max(1, Number(filters.page ?? 1) || 1);
  const total = count(`SELECT COUNT(*) AS n FROM clients c WHERE ${where}`, params);

  const clients = all<Client>(
    `SELECT c.* FROM clients c
      WHERE ${where}
      ORDER BY c.last_name COLLATE NOCASE, c.first_name COLLATE NOCASE
      LIMIT ? OFFSET ?`,
    [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE],
  );

  const ids = clients.map((client) => client.id);
  const byOwner = new Map<number, Property[]>();
  if (ids.length) {
    const segnaposto = ids.map(() => "?").join(",");
    for (const property of all<Property>(
      `SELECT p.* FROM properties p
        WHERE p.deleted_at IS NULL AND p.owner_client_id IN (${segnaposto})
          AND ${IMMOBILE_MIO}
        ORDER BY p.status, p.updated_at DESC`,
      [...ids, utente],
    )) {
      const elenco = byOwner.get(property.owner_client_id!) ?? [];
      elenco.push(property);
      byOwner.set(property.owner_client_id!, elenco);
    }
  }

  return {
    rows: clients.map((client) => ({
      ...client,
      properties: byOwner.get(client.id) ?? [],
      birthdayIn: giorniAlCompleanno(client.birth_date),
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** Immobili ancora senza proprietario collegato: il buco da riempire. */
// Nota: i parametri dopo `utente` sono tutti obbligatori, senza valore
// predefinito, anche dove un predefinito sarebbe comodo. Il motivo e' che
// `auditTrail(300)` — la vecchia chiamata — con un predefinito continuerebbe a
// compilare, prendendo 300 per l'id di chi guarda. Un muro che si buca per una
// svista di battitura non serve a niente: meglio che non compili.
export function propertiesWithoutOwner(utente: number, limit: number): Property[] {
  return all<Property>(
    `SELECT p.* FROM properties p
      WHERE p.deleted_at IS NULL AND p.owner_client_id IS NULL AND ${IMMOBILE_MIO}
      ORDER BY p.status, p.title COLLATE NOCASE
      LIMIT ?`,
    [utente, limit],
  );
}

export function countPropertiesWithoutOwner(utente: number): number {
  return count(
    `SELECT COUNT(*) AS n FROM properties p
      WHERE p.deleted_at IS NULL AND p.owner_client_id IS NULL AND ${IMMOBILE_MIO}`,
    [utente],
  );
}

/** Quanti immobili non hanno la via. Stessa condizione del filtro dell'elenco. */
export function countPropertiesWithoutAddress(utente: number): number {
  return count(
    `SELECT COUNT(*) AS n FROM properties p
      WHERE p.deleted_at IS NULL AND ${IMMOBILE_SENZA_VIA} AND ${IMMOBILE_MIO}`,
    [utente],
  );
}

/**
 * Le mancanze che non si vedono finche' non fanno danno: l'acquirente che non
 * entra negli incroci perche' nessuno ha scritto cosa cerca, il consenso
 * privacy mai raccolto, il documento antiriciclaggio scaduto, l'immobile di
 * cui non si sa chi chiamare. Ogni numero ha il suo filtro nell'elenco.
 */
export function daSistemare(utente: number): {
  senzaProprietario: number;
  senzaVia: number;
  senzaRichiesta: number;
  senzaPrivacy: number;
  amlScaduti: number;
} {
  return {
    senzaProprietario: countPropertiesWithoutOwner(utente),
    senzaVia: countPropertiesWithoutAddress(utente),
    senzaRichiesta: count(
      `SELECT COUNT(*) AS n FROM clients c
        WHERE c.deleted_at IS NULL
          AND ${CLIENTE_MIO}
          AND c.status IN ('attivo','in_trattativa')
          AND ((',' || c.roles || ',') LIKE '%,acquirente,%'
            OR (',' || c.roles || ',') LIKE '%,conduttore,%')
          AND NOT EXISTS (SELECT 1 FROM requirements r
                           WHERE r.client_id = c.id AND r.status = 'aperta')`,
      [utente],
    ),
    senzaPrivacy: count(
      `SELECT COUNT(*) AS n FROM clients c
        WHERE c.deleted_at IS NULL AND c.privacy_consent = 0
          AND ${CLIENTE_MIO}
          AND c.status IN ('attivo','in_trattativa')`,
      [utente],
    ),
    amlScaduti: count(
      `SELECT COUNT(*) AS n FROM clients c
        WHERE c.deleted_at IS NULL
          AND ${CLIENTE_MIO}
          AND c.aml_doc_expiry IS NOT NULL
          AND date(c.aml_doc_expiry) < date('now','localtime')`,
      [utente],
    ),
  };
}

/**
 * Chi proporre come proprietario di un immobile.
 *
 * Senza ricerca mostra solo chi e' gia' segnato come venditore o locatore:
 * di solito sono pochi e c'e' subito quello giusto. Con la ricerca cerca in
 * tutto l'archivio, perche' il proprietario spesso e' una scheda che quel
 * ruolo non ce l'ha — in un archivio importato non ce l'ha quasi nessuno,
 * e filtrare per ruolo lo renderebbe introvabile.
 *
 * In nessun caso si riversano mille nomi in una tendina.
 */
export function searchOwnerCandidates(
  utente: number,
  q: string | undefined,
  limit = 15,
): {
  rows: Client[];
  total: number;
  searched: boolean;
} {
  const cerca = q?.trim();

  // Anche la ricerca guarda solo la propria rubrica. Era il punto piu' aperto
  // del programma: bastava scrivere tre cifre di un numero per pescare
  // qualsiasi scheda dell'archivio, ruolo o non ruolo.
  //
  // Conseguenza da conoscere: se il proprietario e' gia' seguito da un
  // collega, qui non compare, e va creata una scheda propria. E' il prezzo
  // della separazione, ed e' anche il motivo per cui la segnalazione dei
  // contatti in comune merita un discorso a parte.
  if (!cerca) {
    const where = `c.deleted_at IS NULL AND ${CLIENTE_MIO}
        AND ((',' || c.roles || ',') LIKE '%,venditore,%'
             OR (',' || c.roles || ',') LIKE '%,locatore,%')`;
    return {
      rows: all<Client>(
        `SELECT c.* FROM clients c WHERE ${where}
          ORDER BY c.last_name COLLATE NOCASE, c.first_name COLLATE NOCASE
          LIMIT ?`,
        [utente, limit],
      ),
      total: count(`SELECT COUNT(*) AS n FROM clients c WHERE ${where}`, [utente]),
      searched: false,
    };
  }

  const like = `%${cerca}%`;
  const where = `c.deleted_at IS NULL AND ${CLIENTE_MIO} AND (
      c.first_name LIKE ? OR c.last_name LIKE ? OR c.company LIKE ?
      OR c.mobile LIKE ? OR c.phone LIKE ? OR c.email LIKE ?
      OR (c.last_name || ' ' || c.first_name) LIKE ?
      OR (c.first_name || ' ' || c.last_name) LIKE ?
    )`;
  const params = [utente, like, like, like, like, like, like, like, like];

  return {
    rows: all<Client>(
      `SELECT c.* FROM clients c WHERE ${where}
        ORDER BY c.last_name COLLATE NOCASE, c.first_name COLLATE NOCASE
        LIMIT ?`,
      [...params, limit],
    ),
    total: count(`SELECT COUNT(*) AS n FROM clients c WHERE ${where}`, params),
    searched: true,
  };
}

/* =========================================================== compleanni */

/**
 * Quanti giorni mancano al compleanno. Il 29 febbraio negli anni non
 * bisestili viene trattato come 1 marzo: meglio gli auguri con un giorno di
 * scarto che nessun augurio per tre anni su quattro.
 */
export function giorniAlCompleanno(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const nascita = new Date(birthDate);
  if (Number.isNaN(nascita.getTime())) return null;

  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);

  const mese = nascita.getMonth();
  const giorno = nascita.getDate();
  let prossimo = new Date(oggi.getFullYear(), mese, giorno);
  if (prossimo.getMonth() !== mese) prossimo = new Date(oggi.getFullYear(), mese + 1, 1);
  if (prossimo < oggi) {
    prossimo = new Date(oggi.getFullYear() + 1, mese, giorno);
    if (prossimo.getMonth() !== mese) prossimo = new Date(oggi.getFullYear() + 1, mese + 1, 1);
  }

  return Math.round((prossimo.getTime() - oggi.getTime()) / 86400000);
}

export type BirthdayRow = Client & { birthdayIn: number; age: number };

/**
 * Compleanni dei prossimi giorni. Il confronto si fa su mese e giorno, non
 * sulla data intera: l'anno di nascita non c'entra.
 */
export function upcomingBirthdays(utente: number, days: number): BirthdayRow[] {
  const rows = all<Client>(
    `SELECT c.* FROM clients c
      WHERE c.deleted_at IS NULL
        AND ${CLIENTE_MIO}
        AND c.birth_date IS NOT NULL AND c.birth_date != ''
        AND c.status != 'non_interessato'`,
    [utente],
  );

  return rows
    .map((client) => {
      const mancano = giorniAlCompleanno(client.birth_date);
      const nascita = client.birth_date ? new Date(client.birth_date) : null;
      // Gli anni che compie SONO l'anno del prossimo compleanno meno l'anno
      // di nascita: il "+1 se non e' oggi" li sbagliava per tutti i
      // compleanni che cadono entro fine anno (quasi tutti, con una
      // finestra di 7 giorni).
      let anni = 0;
      if (nascita && !Number.isNaN(nascita.getTime()) && mancano !== null) {
        const oggi = new Date();
        const questAnno = new Date(
          oggi.getFullYear(),
          nascita.getMonth(),
          nascita.getDate(),
        );
        const inizioOggi = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());
        const annoDelCompleanno =
          questAnno >= inizioOggi ? oggi.getFullYear() : oggi.getFullYear() + 1;
        anni = annoDelCompleanno - nascita.getFullYear();
      }
      return { ...client, birthdayIn: mancano ?? 9999, age: anni };
    })
    .filter((client) => client.birthdayIn <= days)
    .sort((a, b) => a.birthdayIn - b.birthdayIn || a.last_name.localeCompare(b.last_name, "it"));
}

/* ============================================================== proposte */

export type OfferRow = Offer & {
  client_name: string;
  property_title: string;
  property_price: number | null;
};

/**
 * Una proposta d'acquisto tocca due parti: chi compra e chi vende. Si vede
 * quindi da entrambi i lati — se e' mio l'immobile o se e' mio il cliente —
 * perche' una proposta visibile a una sola delle due meta' sarebbe una
 * trattativa che si segue a meta'.
 */
const PROPOSTA_MIA = `(${IMMOBILE_MIO} OR ${CLIENTE_MIO})`;

export function offersOfProperty(utente: number, propertyId: number): OfferRow[] {
  return all<OfferRow>(
    `SELECT o.*,
            TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) AS client_name,
            p.title AS property_title, p.price AS property_price
       FROM offers o
       JOIN clients c    ON c.id = o.client_id
       JOIN properties p ON p.id = o.property_id
      WHERE o.property_id = ? AND ${PROPOSTA_MIA}
      ORDER BY o.offered_at DESC`,
    [propertyId, utente, utente],
  );
}

export function offersOfClient(utente: number, clientId: number): OfferRow[] {
  return all<OfferRow>(
    `SELECT o.*,
            TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) AS client_name,
            p.title AS property_title, p.price AS property_price
       FROM offers o
       JOIN clients c    ON c.id = o.client_id
       JOIN properties p ON p.id = o.property_id
      WHERE o.client_id = ? AND ${PROPOSTA_MIA}
      ORDER BY o.offered_at DESC`,
    [clientId, utente, utente],
  );
}

/* ============================================================ valutazioni */

export function valuationsOfProperty(utente: number, propertyId: number): Valuation[] {
  return all<Valuation>(
    `SELECT v.* FROM valuations v
       JOIN properties p ON p.id = v.property_id
      WHERE v.property_id = ? AND ${IMMOBILE_MIO}
      ORDER BY v.created_at DESC`,
    [propertyId, utente],
  );
}

/* ================================================================ utenti */

export function listUsers(includeInactive = true): User[] {
  return all<User>(
    `SELECT * FROM users ${includeInactive ? "" : "WHERE active = 1"}
      ORDER BY active DESC, name COLLATE NOCASE`,
  );
}

/**
 * Gli utenti con quante schede hanno in carico.
 *
 * Serve alla pagina Utenti prima di eliminare qualcuno: eliminare un'utenza
 * non cancella il suo archivio, lo passa a chi preme il pulsante. Chi preme
 * deve vedere prima quanta roba sta per ereditare.
 *
 * I conteggi escludono il cestino, perche' e' quello che l'interessato si
 * vedrebbe elencato: contare anche le schede cestinate darebbe un numero che
 * non torna con nessuna pagina del programma.
 */
export function usersWithLoad(): (User & { clienti: number; immobili: number })[] {
  return all<User & { clienti: number; immobili: number }>(
    `SELECT u.*,
            (SELECT COUNT(*) FROM clients    c WHERE c.owner_id = u.id AND c.deleted_at IS NULL) AS clienti,
            (SELECT COUNT(*) FROM properties p WHERE p.agent_id = u.id AND p.deleted_at IS NULL) AS immobili
       FROM users u
      ORDER BY u.active DESC, u.name COLLATE NOCASE`,
  );
}

export function activeUserOptions(): { value: string; label: string }[] {
  return all<User>(`SELECT * FROM users WHERE active = 1 ORDER BY name COLLATE NOCASE`).map(
    (user) => ({ value: String(user.id), label: user.name }),
  );
}

/**
 * Le opzioni della tendina "immobile", per chi sceglie fra i propri.
 *
 * L'etichetta e' via, comune e prezzo — non il codice interno ne' il titolo
 * descrittivo: a colpo d'occhio si riconosce l'indirizzo, non "RIF-042" o
 * "appartamento di 90 mq". Dove manca via o comune — capita nei primi giorni
 * di un'acquisizione, prima di compilare la scheda — resta il titolo, cosi'
 * l'immobile non appare senza nulla scritto accanto.
 *
 * In ordine di comune: chi cerca "Copertino" li trova vicini, invece che
 * sparsi per data di inserimento.
 */
export function propertyOptionsFor(utente: number): { value: string; label: string }[] {
  const rows = all<{
    id: number;
    title: string;
    address: string | null;
    city: string | null;
    price: number | null;
  }>(
    `SELECT id, title, address, city, price FROM properties
      WHERE deleted_at IS NULL AND agent_id = ?
      ORDER BY (city IS NULL OR city = ''), city COLLATE NOCASE, address COLLATE NOCASE
      LIMIT 300`,
    [utente],
  );
  return rows.map((property) => {
    const luogo = [property.address, property.city ? property.city.toUpperCase() : null]
      .filter(Boolean)
      .join(", ");
    const parti = [luogo || property.title];
    if (property.price !== null) parti.push(euro(property.price));
    return {
      value: String(property.id),
      label: parti.join(" — "),
    };
  });
}

/* ============================================================= cruscotto */

export function dashboard(userId: number) {
  const mandatesExpiring = all<PropertyRow>(
    `SELECT p.*, NULL AS owner_name, NULL AS agent_name
       FROM properties p
      WHERE p.deleted_at IS NULL
        AND ${IMMOBILE_MIO}
        AND p.mandate_end IS NOT NULL
        AND p.status IN ('acquisizione','in_vendita','proposta')
        AND date(p.mandate_end) <= date('now','localtime','+45 days')
      ORDER BY p.mandate_end`,
    [userId],
  );

  const silentClients = all<ClientRow>(
    `SELECT c.*, u.name AS owner_name, 0 AS open_requirements,
            NULL AS want_budget_min, NULL AS want_budget_max,
            NULL AS want_city, NULL AS want_zones
       FROM clients c
       LEFT JOIN users u ON u.id = c.owner_id
      WHERE c.deleted_at IS NULL
        AND ${CLIENTE_MIO}
        AND c.status IN ('attivo','in_trattativa')
        AND (c.last_contact_at IS NULL OR c.last_contact_at < datetime('now','-90 days'))
      ORDER BY COALESCE(c.last_contact_at, c.created_at)
      LIMIT 12`,
    [userId],
  );

  const expiringOffers = all<OfferRow>(
    `SELECT o.*,
            TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) AS client_name,
            p.title AS property_title, p.price AS property_price
       FROM offers o
       JOIN clients c    ON c.id = o.client_id
       JOIN properties p ON p.id = o.property_id
      WHERE o.status = 'in_attesa'
        AND ${PROPOSTA_MIA}
        AND o.valid_until IS NOT NULL
        AND date(o.valid_until) <= date('now','localtime','+7 days')
      ORDER BY o.valid_until`,
    [userId, userId],
  );

  return {
    clients: count(
      `SELECT COUNT(*) AS n FROM clients c WHERE c.deleted_at IS NULL AND ${CLIENTE_MIO}`,
      [userId],
    ),
    activeClients: count(
      `SELECT COUNT(*) AS n FROM clients c
        WHERE c.deleted_at IS NULL AND ${CLIENTE_MIO}
          AND c.status IN ('attivo','in_trattativa')`,
      [userId],
    ),
    forSale: count(
      `SELECT COUNT(*) AS n FROM properties p
        WHERE p.deleted_at IS NULL AND ${IMMOBILE_MIO}
          AND p.status IN ('acquisizione','in_vendita')`,
      [userId],
    ),
    negotiations: count(
      `SELECT COUNT(*) AS n FROM properties p
        WHERE p.deleted_at IS NULL AND ${IMMOBILE_MIO}
          AND p.status IN ('proposta','compromesso')`,
      [userId],
    ),
    openRequirements: count(
      `SELECT COUNT(*) AS n FROM requirements r
        JOIN clients c ON c.id = r.client_id
       WHERE r.status = 'aperta' AND c.deleted_at IS NULL AND ${CLIENTE_MIO}`,
      [userId],
    ),
    soldThisYear: count(
      `SELECT COUNT(*) AS n FROM properties p
        WHERE p.deleted_at IS NULL AND ${IMMOBILE_MIO} AND p.status = 'venduto'
          AND p.deed_date IS NOT NULL
          AND strftime('%Y', p.deed_date) = strftime('%Y','now','localtime')`,
      [userId],
    ),
    overdueCount: count(
      `SELECT COUNT(*) AS n FROM activities
        WHERE done_at IS NULL AND due_at IS NOT NULL
          AND date(due_at) < date('now','localtime') AND user_id = ?`,
      [userId],
    ),
    todayCount: count(
      `SELECT COUNT(*) AS n FROM activities
        WHERE done_at IS NULL AND date(due_at) = date('now','localtime') AND user_id = ?`,
      [userId],
    ),
    mandatesExpiring,
    silentClients,
    expiringOffers,
  };
}

/* ================================================================ report */

export function reportBySource(utente: number) {
  return all<{ source: string; clients: number; sold: number }>(
    `SELECT COALESCE(NULLIF(c.source,''), 'Non indicata') AS source,
            COUNT(DISTINCT c.id) AS clients,
            COUNT(DISTINCT CASE WHEN p.status = 'venduto' THEN p.id END) AS sold
       FROM clients c
       LEFT JOIN offers o    ON o.client_id = c.id AND o.status = 'accettata'
       LEFT JOIN properties p ON p.id = o.property_id
      WHERE c.deleted_at IS NULL AND ${CLIENTE_MIO}
      GROUP BY source
      ORDER BY clients DESC`,
    [utente],
  );
}

/**
 * Com'e' andato il proprio portafoglio.
 *
 * Prima era una classifica fra colleghi, con tanto di provvigioni incassate
 * da ciascuno. Non e' piu' possibile e non e' piu' il senso: ognuno vede i
 * propri numeri, che restano quello che serve davvero — quanto ho in
 * portafoglio, quanto ho venduto, quanto ho incassato.
 */
export function reportByAgent(utente: number) {
  return all<{
    agent: string;
    portfolio: number;
    sold: number;
    commission: number | null;
  }>(
    `SELECT COALESCE(u.name, 'Non assegnato') AS agent,
            COUNT(CASE WHEN p.status IN ('acquisizione','in_vendita') THEN 1 END) AS portfolio,
            COUNT(CASE WHEN p.status = 'venduto' THEN 1 END) AS sold,
            SUM(CASE WHEN p.status = 'venduto'
                     THEN COALESCE(p.commission_seller,0) + COALESCE(p.commission_buyer,0)
                     END) AS commission
       FROM properties p
       LEFT JOIN users u ON u.id = p.agent_id
      WHERE p.deleted_at IS NULL AND ${IMMOBILE_MIO}
      GROUP BY agent
      ORDER BY sold DESC, portfolio DESC`,
    [utente],
  );
}

export function reportSalesPerformance(utente: number) {
  return all<{
    id: number;
    title: string;
    city: string | null;
    price: number | null;
    sold_price: number | null;
    deed_date: string | null;
    days_on_market: number | null;
  }>(
    `SELECT p.id, p.title, p.city, p.price, p.sold_price, p.deed_date,
            CAST(julianday(p.deed_date) - julianday(p.mandate_start) AS INTEGER) AS days_on_market
       FROM properties p
      WHERE p.deleted_at IS NULL AND ${IMMOBILE_MIO} AND p.status = 'venduto'
      ORDER BY p.deed_date DESC
      LIMIT 100`,
    [utente],
  );
}

/**
 * Il registro di cosa e' stato fatto, limitato alle proprie azioni.
 *
 * Un registro che elencasse le mosse di tutti racconterebbe, riga per riga,
 * il lavoro del collega: quante schede ha inserito, quando, su cosa sta
 * lavorando. Sotto una separazione simmetrica non lo puo' vedere nessuno,
 * nemmeno chi amministra il programma.
 */
export function auditTrail(utente: number, limit: number) {
  return all<{
    id: number;
    action: string;
    entity: string;
    entity_id: number | null;
    detail: string | null;
    created_at: string;
    user_name: string | null;
  }>(
    `SELECT a.id, a.action, a.entity, a.entity_id, a.detail, a.created_at, u.name AS user_name
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.user_id
      WHERE a.user_id = ?
      ORDER BY a.created_at DESC
      LIMIT ?`,
    [utente, limit],
  );
}
