import "server-only";
import { all, one, count } from "./db";
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
          AND date(a.due_at) < date('now') ${scope}
        ORDER BY a.due_at`,
      params([]),
    ),
    today: all<ActivityRow>(
      `${ACTIVITY_SELECT}
        WHERE a.done_at IS NULL AND date(a.due_at) = date('now') ${scope}
        ORDER BY a.due_at`,
      params([]),
    ),
    upcoming: all<ActivityRow>(
      `${ACTIVITY_SELECT}
        WHERE a.done_at IS NULL
          AND date(a.due_at) > date('now')
          AND date(a.due_at) <= date('now', '+14 days') ${scope}
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
        AND date(p.mandate_end) <= date('now', '+45 days')
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
        AND date(o.valid_until) <= date('now','+7 days')
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
          AND strftime('%Y', deed_date) = strftime('%Y','now')`,
    ),
    overdueCount: count(
      `SELECT COUNT(*) AS n FROM activities
        WHERE done_at IS NULL AND due_at IS NOT NULL
          AND date(due_at) < date('now') AND user_id = ?`,
      [userId],
    ),
    todayCount: count(
      `SELECT COUNT(*) AS n FROM activities
        WHERE done_at IS NULL AND date(due_at) = date('now') AND user_id = ?`,
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
