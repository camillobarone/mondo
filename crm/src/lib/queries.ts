import "server-only";
import crypto from "node:crypto";
import { all, one, count, run } from "./db";
import { fromCsv } from "./format";
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
  page?: string;
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

function clientWhere(filters: ClientFilters): { sql: string; params: unknown[] } {
  const clauses = ["c.deleted_at IS NULL"];
  const params: unknown[] = [];

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

export function listClients(filters: ClientFilters): {
  rows: ClientRow[];
  total: number;
  page: number;
  pages: number;
} {
  const { sql, params } = clientWhere(filters);
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
      ORDER BY c.last_name COLLATE NOCASE, c.first_name COLLATE NOCASE
      LIMIT ? OFFSET ?`,
    [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE],
  );

  return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Come listClients ma senza pagina: serve all'esportazione. */
export function listAllClients(filters: ClientFilters): ClientRow[] {
  const { sql, params } = clientWhere(filters);
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

export function getClient(id: number): (Client & { owner_name: string | null }) | undefined {
  return one<Client & { owner_name: string | null }>(
    `SELECT c.*, u.name AS owner_name
       FROM clients c
       LEFT JOIN users u ON u.id = c.owner_id
      WHERE c.id = ? AND c.deleted_at IS NULL`,
    [id],
  );
}

/** Cerca possibili doppioni prima di creare un cliente. */
export function findDuplicates(
  mobile: string | null,
  email: string | null,
  firstName: string,
  lastName: string,
  excludeId = 0,
): Client[] {
  return all<Client>(
    `SELECT * FROM clients
      WHERE deleted_at IS NULL AND id != ?
        AND (
          (? != '' AND REPLACE(REPLACE(mobile,' ',''),'.','') = ?)
          OR (? != '' AND email = ? COLLATE NOCASE)
          OR (first_name = ? COLLATE NOCASE AND last_name = ? COLLATE NOCASE)
        )
      LIMIT 5`,
    [
      excludeId,
      mobile ?? "",
      (mobile ?? "").replace(/[\s.]/g, ""),
      email ?? "",
      email ?? "",
      firstName,
      lastName,
    ],
  );
}

export function clientTags(): string[] {
  const rows = all<{ tags: string }>(
    `SELECT tags FROM clients WHERE deleted_at IS NULL AND tags != ''`,
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
  page?: string;
}

export type PropertyRow = Property & {
  owner_name: string | null;
  agent_name: string | null;
};

function propertyWhere(filters: PropertyFilters): { sql: string; params: unknown[] } {
  const clauses = ["p.deleted_at IS NULL"];
  const params: unknown[] = [];

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

export function listProperties(filters: PropertyFilters): {
  rows: PropertyRow[];
  total: number;
  page: number;
  pages: number;
} {
  const { sql, params } = propertyWhere(filters);
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

export function listAllProperties(filters: PropertyFilters): PropertyRow[] {
  const { sql, params } = propertyWhere(filters);
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

export function getProperty(id: number): PropertyRow | undefined {
  return one<PropertyRow>(
    `SELECT p.*,
            TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) AS owner_name,
            u.name AS agent_name
       FROM properties p
       LEFT JOIN clients c ON c.id = p.owner_client_id
       LEFT JOIN users   u ON u.id = p.agent_id
      WHERE p.id = ? AND p.deleted_at IS NULL`,
    [id],
  );
}

export function propertiesOfClient(clientId: number): Property[] {
  return all<Property>(
    `SELECT * FROM properties
      WHERE owner_client_id = ? AND deleted_at IS NULL
      ORDER BY updated_at DESC`,
    [clientId],
  );
}

export interface Photo {
  id: number;
  property_id: number;
  file: string;
  caption: string | null;
  position: number;
}

export function photosOfProperty(propertyId: number): Photo[] {
  return all<Photo>(
    `SELECT id, property_id, file, caption, position FROM photos
      WHERE property_id = ? ORDER BY position, id`,
    [propertyId],
  );
}

/** La prima foto di ogni immobile, per mostrarla negli elenchi. */
export function coverPhotos(propertyIds: number[]): Map<number, string> {
  if (!propertyIds.length) return new Map();
  const segnaposto = propertyIds.map(() => "?").join(",");
  const rows = all<{ property_id: number; file: string }>(
    `SELECT property_id, file FROM photos
      WHERE property_id IN (${segnaposto})
      ORDER BY property_id, position, id`,
    propertyIds,
  );

  const cover = new Map<number, string>();
  for (const row of rows) if (!cover.has(row.property_id)) cover.set(row.property_id, row.file);
  return cover;
}

export function priceHistory(propertyId: number) {
  return all<{ id: number; price: number; changed_at: string; user_name: string | null }>(
    `SELECT h.id, h.price, h.changed_at, u.name AS user_name
       FROM price_history h
       LEFT JOIN users u ON u.id = h.user_id
      WHERE h.property_id = ?
      ORDER BY h.changed_at DESC`,
    [propertyId],
  );
}

export function distinctCities(): string[] {
  return all<{ city: string }>(
    `SELECT DISTINCT city FROM properties
      WHERE deleted_at IS NULL AND city IS NOT NULL AND city != ''
      ORDER BY city COLLATE NOCASE`,
  ).map((row) => row.city);
}

/**
 * Zone gia' usate in archivio, sugli immobili e sulle richieste, unite a
 * quelle di partenza. Sono suggerimenti, non una gabbia: chi inserisce puo'
 * sempre scrivere una localita' nuova, e da quel momento la ritrova qui.
 */
export function knownZones(): string[] {
  const fromProperties = all<{ zone: string }>(
    `SELECT DISTINCT zone FROM properties
      WHERE deleted_at IS NULL AND zone IS NOT NULL AND zone != ''`,
  ).map((row) => row.zone);

  const fromRequirements = all<{ zones: string }>(
    `SELECT DISTINCT zones FROM requirements WHERE zones IS NOT NULL AND zones != ''`,
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

export function listRequirements(filters: {
  q?: string;
  status?: string;
  contract?: string;
  city?: string;
  page?: string;
}): { rows: RequirementRow[]; total: number; page: number; pages: number } {
  const clauses = ["c.deleted_at IS NULL"];
  const params: unknown[] = [];

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

export function getRequirement(id: number): RequirementRow | undefined {
  return one<RequirementRow>(
    `SELECT r.*,
            TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) AS client_name,
            c.mobile AS client_mobile
       FROM requirements r
       JOIN clients c ON c.id = r.client_id
      WHERE r.id = ?`,
    [id],
  );
}

export function requirementsOfClient(clientId: number): Requirement[] {
  return all<Requirement>(
    `SELECT * FROM requirements WHERE client_id = ? ORDER BY updated_at DESC`,
    [clientId],
  );
}

/* ============================================================ attivita' */

export type ActivityRow = Activity & {
  client_name: string | null;
  property_title: string | null;
  user_name: string | null;
};

const ACTIVITY_SELECT = `
  SELECT a.*,
         TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) AS client_name,
         p.title AS property_title,
         u.name  AS user_name
    FROM activities a
    LEFT JOIN clients    c ON c.id = a.client_id
    LEFT JOIN properties p ON p.id = a.property_id
    LEFT JOIN users      u ON u.id = a.user_id`;

export function activitiesOfClient(clientId: number, limit = 100): ActivityRow[] {
  return all<ActivityRow>(
    `${ACTIVITY_SELECT}
      WHERE a.client_id = ?
      ORDER BY COALESCE(a.done_at, a.due_at, a.created_at) DESC
      LIMIT ?`,
    [clientId, limit],
  );
}

export function activitiesOfProperty(propertyId: number, limit = 100): ActivityRow[] {
  return all<ActivityRow>(
    `${ACTIVITY_SELECT}
      WHERE a.property_id = ?
      ORDER BY COALESCE(a.done_at, a.due_at, a.created_at) DESC
      LIMIT ?`,
    [propertyId, limit],
  );
}

/** Cose da fare: scadute, oggi e in arrivo. */
export function agenda(userId: number | null) {
  const scope = userId ? "AND a.user_id = ?" : "";
  const params = (extra: unknown[]) => (userId ? [...extra, userId] : extra);

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
export function getActivity(id: number): ActivityRow | undefined {
  return one<ActivityRow>(`${ACTIVITY_SELECT} WHERE a.id = ?`, [id]);
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
  return all<ActivityRow>(
    `${ACTIVITY_SELECT}
      WHERE a.user_id = ?
        AND a.due_at IS NOT NULL
        AND date(a.due_at) >= date('now','localtime','-30 days')
        AND date(a.due_at) <= date('now','localtime','+365 days')
      ORDER BY a.due_at`,
    [userId],
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

/* ============================================== report per il proprietario */

export interface PropertyReport {
  /** Giorni da quando l'immobile e' in portafoglio. */
  days: number;
  visits: ActivityRow[];
  /** I feedback scritti dopo le visite: sono la parte che pesa di piu'. */
  feedback: { date: string | null; text: string; client: string | null }[];
  contacts: number;
}

export function propertyReport(property: Property): PropertyReport {
  const inizio = property.mandate_start ?? property.created_at;
  // Giorni interi compiuti: la data del mandato e' a mezzanotte, e arrotondare
  // per eccesso farebbe dire "95 giorni" a un mandato firmato 94 giorni fa.
  const days = inizio
    ? Math.max(0, Math.floor((Date.now() - new Date(inizio).getTime()) / 86400000))
    : 0;

  const visits = all<ActivityRow>(
    `${ACTIVITY_SELECT}
      WHERE a.property_id = ? AND a.type = 'visita'
      ORDER BY COALESCE(a.done_at, a.due_at) DESC`,
    [property.id],
  );

  // Ogni contatto registrato su questo immobile, non solo le visite:
  // telefonate e richieste di informazioni dicono quanto si e' mosso.
  const contacts = count(
    `SELECT COUNT(*) AS n FROM activities WHERE property_id = ?`,
    [property.id],
  );

  // Solo l'esito, mai le note. Le note sono i promemoria dell'agente ("portare
  // la planimetria", "chiedere lo sconto"): finirebbero virgolettate in un
  // foglio che si consegna al proprietario, come se le avesse dette il
  // visitatore. L'esito e' il campo che si compila apposta, quando la visita
  // si segna come fatta.
  const feedback = visits
    .filter((visit) => visit.done_at && (visit.outcome ?? "").trim())
    .map((visit) => ({
      date: visit.done_at,
      text: (visit.outcome ?? "").trim(),
      client: visit.client_name || null,
    }));

  return { days, visits, feedback, contacts };
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
export function listSellers(filters: { q?: string; page?: string } = {}): {
  rows: SellerRow[];
  total: number;
  page: number;
  pages: number;
} {
  const clauses = [
    `c.deleted_at IS NULL`,
    `(
       (',' || c.roles || ',') LIKE '%,venditore,%'
       OR (',' || c.roles || ',') LIKE '%,locatore,%'
       OR EXISTS (SELECT 1 FROM properties p
                   WHERE p.owner_client_id = c.id AND p.deleted_at IS NULL)
     )`,
  ];
  const params: unknown[] = [];

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
      `SELECT * FROM properties
        WHERE deleted_at IS NULL AND owner_client_id IN (${segnaposto})
        ORDER BY status, updated_at DESC`,
      ids,
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
export function propertiesWithoutOwner(limit = 500): Property[] {
  return all<Property>(
    `SELECT * FROM properties
      WHERE deleted_at IS NULL AND owner_client_id IS NULL
      ORDER BY status, title COLLATE NOCASE
      LIMIT ?`,
    [limit],
  );
}

export function countPropertiesWithoutOwner(): number {
  return count(
    `SELECT COUNT(*) AS n FROM properties WHERE deleted_at IS NULL AND owner_client_id IS NULL`,
  );
}

/**
 * Le mancanze che non si vedono finche' non fanno danno: l'acquirente che non
 * entra negli incroci perche' nessuno ha scritto cosa cerca, il consenso
 * privacy mai raccolto, il documento antiriciclaggio scaduto, l'immobile di
 * cui non si sa chi chiamare. Ogni numero ha il suo filtro nell'elenco.
 */
export function daSistemare(): {
  senzaProprietario: number;
  senzaRichiesta: number;
  senzaPrivacy: number;
  amlScaduti: number;
} {
  return {
    senzaProprietario: countPropertiesWithoutOwner(),
    senzaRichiesta: count(
      `SELECT COUNT(*) AS n FROM clients c
        WHERE c.deleted_at IS NULL
          AND c.status IN ('attivo','in_trattativa')
          AND ((',' || c.roles || ',') LIKE '%,acquirente,%'
            OR (',' || c.roles || ',') LIKE '%,conduttore,%')
          AND NOT EXISTS (SELECT 1 FROM requirements r
                           WHERE r.client_id = c.id AND r.status = 'aperta')`,
    ),
    senzaPrivacy: count(
      `SELECT COUNT(*) AS n FROM clients
        WHERE deleted_at IS NULL AND privacy_consent = 0
          AND status IN ('attivo','in_trattativa')`,
    ),
    amlScaduti: count(
      `SELECT COUNT(*) AS n FROM clients
        WHERE deleted_at IS NULL
          AND aml_doc_expiry IS NOT NULL
          AND date(aml_doc_expiry) < date('now','localtime')`,
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
export function searchOwnerCandidates(q: string | undefined, limit = 15): {
  rows: Client[];
  total: number;
  searched: boolean;
} {
  const cerca = q?.trim();

  if (!cerca) {
    return {
      rows: all<Client>(
        `SELECT * FROM clients
          WHERE deleted_at IS NULL
            AND ((',' || roles || ',') LIKE '%,venditore,%'
                 OR (',' || roles || ',') LIKE '%,locatore,%')
          ORDER BY last_name COLLATE NOCASE, first_name COLLATE NOCASE
          LIMIT ?`,
        [limit],
      ),
      total: count(
        `SELECT COUNT(*) AS n FROM clients
          WHERE deleted_at IS NULL
            AND ((',' || roles || ',') LIKE '%,venditore,%'
                 OR (',' || roles || ',') LIKE '%,locatore,%')`,
      ),
      searched: false,
    };
  }

  const like = `%${cerca}%`;
  const where = `deleted_at IS NULL AND (
      first_name LIKE ? OR last_name LIKE ? OR company LIKE ?
      OR mobile LIKE ? OR phone LIKE ? OR email LIKE ?
      OR (last_name || ' ' || first_name) LIKE ?
      OR (first_name || ' ' || last_name) LIKE ?
    )`;
  const params = [like, like, like, like, like, like, like, like];

  return {
    rows: all<Client>(
      `SELECT * FROM clients WHERE ${where}
        ORDER BY last_name COLLATE NOCASE, first_name COLLATE NOCASE
        LIMIT ?`,
      [...params, limit],
    ),
    total: count(`SELECT COUNT(*) AS n FROM clients WHERE ${where}`, params),
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
export function upcomingBirthdays(days = 7): BirthdayRow[] {
  const rows = all<Client>(
    `SELECT * FROM clients
      WHERE deleted_at IS NULL
        AND birth_date IS NOT NULL AND birth_date != ''
        AND status != 'non_interessato'`,
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

export function offersOfProperty(propertyId: number): OfferRow[] {
  return all<OfferRow>(
    `SELECT o.*,
            TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) AS client_name,
            p.title AS property_title, p.price AS property_price
       FROM offers o
       JOIN clients c    ON c.id = o.client_id
       JOIN properties p ON p.id = o.property_id
      WHERE o.property_id = ?
      ORDER BY o.offered_at DESC`,
    [propertyId],
  );
}

export function offersOfClient(clientId: number): OfferRow[] {
  return all<OfferRow>(
    `SELECT o.*,
            TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) AS client_name,
            p.title AS property_title, p.price AS property_price
       FROM offers o
       JOIN clients c    ON c.id = o.client_id
       JOIN properties p ON p.id = o.property_id
      WHERE o.client_id = ?
      ORDER BY o.offered_at DESC`,
    [clientId],
  );
}

/* ============================================================ valutazioni */

export function valuationsOfProperty(propertyId: number): Valuation[] {
  return all<Valuation>(
    `SELECT * FROM valuations WHERE property_id = ? ORDER BY created_at DESC`,
    [propertyId],
  );
}

/* ================================================================ utenti */

export function listUsers(includeInactive = true): User[] {
  return all<User>(
    `SELECT * FROM users ${includeInactive ? "" : "WHERE active = 1"}
      ORDER BY active DESC, name COLLATE NOCASE`,
  );
}

export function activeUserOptions(): { value: string; label: string }[] {
  return all<User>(`SELECT * FROM users WHERE active = 1 ORDER BY name COLLATE NOCASE`).map(
    (user) => ({ value: String(user.id), label: user.name }),
  );
}

/* ============================================================= cruscotto */

export function dashboard(userId: number) {
  const mandatesExpiring = all<PropertyRow>(
    `SELECT p.*, NULL AS owner_name, NULL AS agent_name
       FROM properties p
      WHERE p.deleted_at IS NULL
        AND p.mandate_end IS NOT NULL
        AND p.status IN ('acquisizione','in_vendita','proposta')
        AND date(p.mandate_end) <= date('now','localtime','+45 days')
      ORDER BY p.mandate_end`,
  );

  const silentClients = all<ClientRow>(
    `SELECT c.*, u.name AS owner_name, 0 AS open_requirements,
            NULL AS want_budget_min, NULL AS want_budget_max,
            NULL AS want_city, NULL AS want_zones
       FROM clients c
       LEFT JOIN users u ON u.id = c.owner_id
      WHERE c.deleted_at IS NULL
        AND c.status IN ('attivo','in_trattativa')
        AND (c.last_contact_at IS NULL OR c.last_contact_at < datetime('now','-90 days'))
      ORDER BY COALESCE(c.last_contact_at, c.created_at)
      LIMIT 12`,
  );

  const expiringOffers = all<OfferRow>(
    `SELECT o.*,
            TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) AS client_name,
            p.title AS property_title, p.price AS property_price
       FROM offers o
       JOIN clients c    ON c.id = o.client_id
       JOIN properties p ON p.id = o.property_id
      WHERE o.status = 'in_attesa'
        AND o.valid_until IS NOT NULL
        AND date(o.valid_until) <= date('now','localtime','+7 days')
      ORDER BY o.valid_until`,
  );

  return {
    clients: count(`SELECT COUNT(*) AS n FROM clients WHERE deleted_at IS NULL`),
    activeClients: count(
      `SELECT COUNT(*) AS n FROM clients
        WHERE deleted_at IS NULL AND status IN ('attivo','in_trattativa')`,
    ),
    forSale: count(
      `SELECT COUNT(*) AS n FROM properties
        WHERE deleted_at IS NULL AND status IN ('acquisizione','in_vendita')`,
    ),
    negotiations: count(
      `SELECT COUNT(*) AS n FROM properties
        WHERE deleted_at IS NULL AND status IN ('proposta','compromesso')`,
    ),
    openRequirements: count(
      `SELECT COUNT(*) AS n FROM requirements r
        JOIN clients c ON c.id = r.client_id
       WHERE r.status = 'aperta' AND c.deleted_at IS NULL`,
    ),
    soldThisYear: count(
      `SELECT COUNT(*) AS n FROM properties
        WHERE deleted_at IS NULL AND status = 'venduto'
          AND deed_date IS NOT NULL
          AND strftime('%Y', deed_date) = strftime('%Y','now','localtime')`,
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

export function reportBySource() {
  return all<{ source: string; clients: number; sold: number }>(
    `SELECT COALESCE(NULLIF(c.source,''), 'Non indicata') AS source,
            COUNT(DISTINCT c.id) AS clients,
            COUNT(DISTINCT CASE WHEN p.status = 'venduto' THEN p.id END) AS sold
       FROM clients c
       LEFT JOIN offers o    ON o.client_id = c.id AND o.status = 'accettata'
       LEFT JOIN properties p ON p.id = o.property_id
      WHERE c.deleted_at IS NULL
      GROUP BY source
      ORDER BY clients DESC`,
  );
}

export function reportByAgent() {
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
      WHERE p.deleted_at IS NULL
      GROUP BY agent
      ORDER BY sold DESC, portfolio DESC`,
  );
}

export function reportSalesPerformance() {
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
      WHERE p.deleted_at IS NULL AND p.status = 'venduto'
      ORDER BY p.deed_date DESC
      LIMIT 100`,
  );
}

export function auditTrail(limit = 200) {
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
      ORDER BY a.created_at DESC
      LIMIT ?`,
    [limit],
  );
}
