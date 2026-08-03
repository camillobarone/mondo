"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, run, one, audit } from "./db";
import { requireUser, requireOwner, hashPassword, login as doLogin, logout as doLogout } from "./auth";
import { parseCsv, decodeText } from "./csv";
import { splitName, splitPhones, parseRequirements } from "./import-map";
import type { Property } from "./types";

/* ------------------------------------------------------------- utilita' */

function text(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function nullable(form: FormData, key: string): string | null {
  const value = text(form, key);
  return value === "" ? null : value;
}

function integer(form: FormData, key: string): number | null {
  const value = text(form, key).replace(/[.\s€]/g, "").replace(",", ".");
  if (value === "") return null;
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function decimal(form: FormData, key: string): number | null {
  const value = text(form, key).replace(",", ".");
  if (value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function bool(form: FormData, key: string): number {
  return form.get(key) ? 1 : 0;
}

/** Raccoglie piu' caselle con lo stesso nome in una stringa "a,b,c". */
function csvField(form: FormData, key: string): string {
  return form
    .getAll(key)
    .map((value) => String(value).trim())
    .filter(Boolean)
    .join(",");
}

/** Normalizza le etichette scritte a mano: "Investitore, VIP" -> "Investitore,VIP". */
function tagField(form: FormData, key: string): string {
  return text(form, key)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .join(",");
}

/* ============================================================== accesso */

export async function loginAction(_prev: string | null, form: FormData) {
  const error = await doLogin(text(form, "email"), String(form.get("password") ?? ""));
  if (error) return error;
  redirect("/");
}

export async function logoutAction() {
  await doLogout();
  redirect("/login");
}

/* ============================================================== clienti */

export async function saveClient(form: FormData) {
  const user = await requireUser();
  const id = Number(form.get("id") ?? 0);

  const values = {
    first_name: text(form, "first_name"),
    last_name: text(form, "last_name"),
    company: nullable(form, "company"),
    phone: nullable(form, "phone"),
    mobile: nullable(form, "mobile"),
    email: nullable(form, "email"),
    address: nullable(form, "address"),
    city: nullable(form, "city"),
    tax_code: nullable(form, "tax_code"),
    birth_date: nullable(form, "birth_date"),
    roles: csvField(form, "roles"),
    source: nullable(form, "source"),
    status: text(form, "status") || "attivo",
    owner_id: integer(form, "owner_id"),
    tags: tagField(form, "tags"),
    notes: nullable(form, "notes"),
    privacy_consent: bool(form, "privacy_consent"),
    privacy_scope: nullable(form, "privacy_scope"),
    aml_doc_type: nullable(form, "aml_doc_type"),
    aml_doc_number: nullable(form, "aml_doc_number"),
    aml_doc_expiry: nullable(form, "aml_doc_expiry"),
  };

  if (!values.first_name && !values.last_name && !values.company) {
    throw new Error("Serve almeno il cognome o la ragione sociale.");
  }

  if (id) {
    const previous = one<{ privacy_consent: number; privacy_date: string | null }>(
      `SELECT privacy_consent, privacy_date FROM clients WHERE id = ?`,
      [id],
    );
    // La data del consenso si fissa quando viene dato, e non si riscrive.
    const privacyDate =
      values.privacy_consent && !previous?.privacy_consent
        ? new Date().toISOString().slice(0, 10)
        : values.privacy_consent
          ? (previous?.privacy_date ?? null)
          : null;

    run(
      `UPDATE clients SET
         first_name = ?, last_name = ?, company = ?, phone = ?, mobile = ?, email = ?,
         address = ?, city = ?, tax_code = ?, birth_date = ?, roles = ?, source = ?,
         status = ?, owner_id = ?, tags = ?, notes = ?,
         privacy_consent = ?, privacy_date = ?, privacy_scope = ?,
         aml_doc_type = ?, aml_doc_number = ?, aml_doc_expiry = ?,
         aml_checked_at = CASE WHEN ? IS NOT NULL THEN COALESCE(aml_checked_at, datetime('now')) ELSE aml_checked_at END,
         updated_at = datetime('now')
       WHERE id = ?`,
      [
        values.first_name, values.last_name, values.company, values.phone, values.mobile,
        values.email, values.address, values.city, values.tax_code, values.birth_date,
        values.roles, values.source, values.status, values.owner_id, values.tags, values.notes,
        values.privacy_consent, privacyDate, values.privacy_scope,
        values.aml_doc_type, values.aml_doc_number, values.aml_doc_expiry,
        values.aml_doc_number,
        id,
      ],
    );
    audit(user.id, "modifica", "cliente", id);
    revalidatePath(`/clienti/${id}`);
    revalidatePath("/clienti");
    redirect(`/clienti/${id}`);
  }

  const result = run(
    `INSERT INTO clients (
       first_name, last_name, company, phone, mobile, email, address, city, tax_code,
       birth_date, roles, source, status, owner_id, tags, notes,
       privacy_consent, privacy_date, privacy_scope,
       aml_doc_type, aml_doc_number, aml_doc_expiry, aml_checked_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      values.first_name, values.last_name, values.company, values.phone, values.mobile,
      values.email, values.address, values.city, values.tax_code, values.birth_date,
      values.roles, values.source, values.status, values.owner_id ?? user.id,
      values.tags, values.notes,
      values.privacy_consent,
      values.privacy_consent ? new Date().toISOString().slice(0, 10) : null,
      values.privacy_scope,
      values.aml_doc_type, values.aml_doc_number, values.aml_doc_expiry,
      values.aml_doc_number ? new Date().toISOString() : null,
    ],
  );

  const newId = Number(result.lastInsertRowid);
  audit(user.id, "crea", "cliente", newId);
  revalidatePath("/clienti");
  redirect(`/clienti/${newId}`);
}

export async function deleteClient(form: FormData) {
  const user = await requireUser();
  const id = Number(form.get("id"));
  // Cancellazione logica: la scheda sparisce ma resta la traccia per il registro.
  run(`UPDATE clients SET deleted_at = datetime('now') WHERE id = ?`, [id]);
  audit(user.id, "elimina", "cliente", id);
  revalidatePath("/clienti");
  redirect("/clienti");
}

/** Cancellazione definitiva su richiesta dell'interessato (GDPR). */
export async function eraseClient(form: FormData) {
  const user = await requireOwner();
  const id = Number(form.get("id"));
  run(`DELETE FROM clients WHERE id = ?`, [id]);
  audit(user.id, "elimina", "cliente", id, "cancellazione definitiva su richiesta GDPR");
  revalidatePath("/clienti");
  redirect("/clienti");
}

/* ============================================================= immobili */

export async function saveProperty(form: FormData) {
  const user = await requireUser();
  const id = Number(form.get("id") ?? 0);

  const values = {
    ref: text(form, "ref"),
    title: text(form, "title"),
    kind: text(form, "kind"),
    contract: text(form, "contract") || "vendita",
    address: nullable(form, "address"),
    city: nullable(form, "city"),
    zone: nullable(form, "zone"),
    sqm: integer(form, "sqm"),
    rooms: integer(form, "rooms"),
    bathrooms: integer(form, "bathrooms"),
    floor: nullable(form, "floor"),
    elevator: bool(form, "elevator"),
    outdoor: nullable(form, "outdoor"),
    garage: bool(form, "garage"),
    condition: nullable(form, "condition"),
    energy_class: nullable(form, "energy_class"),
    price: integer(form, "price"),
    min_price: integer(form, "min_price"),
    status: text(form, "status") || "acquisizione",
    owner_client_id: integer(form, "owner_client_id"),
    agent_id: integer(form, "agent_id"),
    mandate_start: nullable(form, "mandate_start"),
    mandate_end: nullable(form, "mandate_end"),
    exclusive: bool(form, "exclusive"),
    commission_pct: decimal(form, "commission_pct"),
    notes: nullable(form, "notes"),
  };

  if (!values.title) throw new Error("Serve un titolo per l'immobile.");

  if (id) {
    const previous = one<Property>(`SELECT * FROM properties WHERE id = ?`, [id]);

    run(
      `UPDATE properties SET
         ref = ?, title = ?, kind = ?, contract = ?, address = ?, city = ?, zone = ?,
         sqm = ?, rooms = ?, bathrooms = ?, floor = ?, elevator = ?, outdoor = ?, garage = ?,
         condition = ?, energy_class = ?, price = ?, min_price = ?, status = ?,
         owner_client_id = ?, agent_id = ?, mandate_start = ?, mandate_end = ?,
         exclusive = ?, commission_pct = ?, notes = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [
        values.ref, values.title, values.kind, values.contract, values.address, values.city,
        values.zone, values.sqm, values.rooms, values.bathrooms, values.floor, values.elevator,
        values.outdoor, values.garage, values.condition, values.energy_class, values.price,
        values.min_price, values.status, values.owner_client_id, values.agent_id,
        values.mandate_start, values.mandate_end, values.exclusive, values.commission_pct,
        values.notes, id,
      ],
    );

    // Ogni ribasso finisce nello storico prezzi.
    if (values.price !== null && previous && previous.price !== values.price) {
      run(`INSERT INTO price_history (property_id, price, user_id) VALUES (?,?,?)`, [
        id, values.price, user.id,
      ]);
    }

    audit(user.id, "modifica", "immobile", id);
    revalidatePath(`/immobili/${id}`);
    revalidatePath("/immobili");
    // Un immobile che cambia prezzo o zona cambia anche gli incroci.
    revalidatePath("/incroci");
    revalidatePath("/richieste");
    redirect(`/immobili/${id}`);
  }

  const result = run(
    `INSERT INTO properties (
       ref, title, kind, contract, address, city, zone, sqm, rooms, bathrooms, floor,
       elevator, outdoor, garage, condition, energy_class, price, min_price, status,
       owner_client_id, agent_id, mandate_start, mandate_end, exclusive, commission_pct, notes
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      values.ref, values.title, values.kind, values.contract, values.address, values.city,
      values.zone, values.sqm, values.rooms, values.bathrooms, values.floor, values.elevator,
      values.outdoor, values.garage, values.condition, values.energy_class, values.price,
      values.min_price, values.status, values.owner_client_id, values.agent_id ?? user.id,
      values.mandate_start, values.mandate_end, values.exclusive, values.commission_pct,
      values.notes,
    ],
  );

  const newId = Number(result.lastInsertRowid);
  if (values.price !== null) {
    run(`INSERT INTO price_history (property_id, price, user_id) VALUES (?,?,?)`, [
      newId, values.price, user.id,
    ]);
  }
  audit(user.id, "crea", "immobile", newId);
  revalidatePath("/immobili");
  revalidatePath("/incroci");
  revalidatePath("/richieste");
  redirect(`/immobili/${newId}`);
}

/** Chiusura della trattativa: rogito, prezzo finale e provvigioni. */
export async function closeDeal(form: FormData) {
  const user = await requireUser();
  const id = Number(form.get("id"));

  run(
    `UPDATE properties SET
       status = 'venduto',
       sold_price = ?, preliminary_date = ?, deed_date = ?,
       commission_seller = ?, commission_buyer = ?, commission_paid = ?,
       updated_at = datetime('now')
     WHERE id = ?`,
    [
      integer(form, "sold_price"),
      nullable(form, "preliminary_date"),
      nullable(form, "deed_date"),
      integer(form, "commission_seller"),
      integer(form, "commission_buyer"),
      bool(form, "commission_paid"),
      id,
    ],
  );

  audit(user.id, "modifica", "immobile", id, "chiusura trattativa");
  revalidatePath(`/immobili/${id}`);
  redirect(`/immobili/${id}`);
}

export async function deleteProperty(form: FormData) {
  const user = await requireUser();
  const id = Number(form.get("id"));
  run(`UPDATE properties SET deleted_at = datetime('now') WHERE id = ?`, [id]);
  audit(user.id, "elimina", "immobile", id);
  revalidatePath("/immobili");
  redirect("/immobili");
}

/* ============================================================ richieste */

export async function saveRequirement(form: FormData) {
  const user = await requireUser();
  const id = Number(form.get("id") ?? 0);
  const clientId = Number(form.get("client_id"));

  // Le zone spuntate piu' quelle scritte a mano, senza doppioni.
  const zones = [...new Set([...form.getAll("zones").map(String), ...text(form, "zones_extra").split(",")]
    .map((zone) => zone.trim())
    .filter(Boolean))].join(",");

  const values = [
    text(form, "contract") || "vendita",
    nullable(form, "kind"),
    nullable(form, "city"),
    zones,
    integer(form, "budget_min"),
    integer(form, "budget_max"),
    integer(form, "sqm_min"),
    integer(form, "rooms_min"),
    csvField(form, "needs"),
    text(form, "urgency") || "media",
    nullable(form, "financing"),
    text(form, "status") || "aperta",
    nullable(form, "notes"),
  ];

  if (id) {
    run(
      `UPDATE requirements SET
         contract = ?, kind = ?, city = ?, zones = ?, budget_min = ?, budget_max = ?,
         sqm_min = ?, rooms_min = ?, needs = ?, urgency = ?, financing = ?, status = ?,
         notes = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [...values, id],
    );
    audit(user.id, "modifica", "richiesta", id);
  } else {
    const result = run(
      `INSERT INTO requirements (
         client_id, contract, kind, city, zones, budget_min, budget_max, sqm_min,
         rooms_min, needs, urgency, financing, status, notes
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [clientId, ...values],
    );
    audit(user.id, "crea", "richiesta", Number(result.lastInsertRowid));
  }

  revalidatePath(`/clienti/${clientId}`);
  revalidatePath("/richieste");
  revalidatePath("/incroci");
  redirect(`/clienti/${clientId}`);
}

export async function deleteRequirement(form: FormData) {
  const user = await requireUser();
  const id = Number(form.get("id"));
  const clientId = Number(form.get("client_id"));
  run(`DELETE FROM requirements WHERE id = ?`, [id]);
  audit(user.id, "elimina", "richiesta", id);
  revalidatePath(`/clienti/${clientId}`);
  redirect(`/clienti/${clientId}`);
}

/* ============================================================ attivita' */

export async function saveActivity(form: FormData) {
  const user = await requireUser();
  const id = Number(form.get("id") ?? 0);
  const clientId = integer(form, "client_id");
  const propertyId = integer(form, "property_id");

  const values = [
    text(form, "type") || "nota",
    text(form, "title"),
    nullable(form, "notes"),
    clientId,
    propertyId,
    integer(form, "user_id") ?? user.id,
    nullable(form, "due_at"),
    nullable(form, "outcome"),
    nullable(form, "interest"),
  ];

  // Una nota o una telefonata gia' fatta si registrano subito come completate.
  const doneNow = form.get("done") ? new Date().toISOString() : null;

  if (id) {
    run(
      `UPDATE activities SET
         type = ?, title = ?, notes = ?, client_id = ?, property_id = ?, user_id = ?,
         due_at = ?, outcome = ?, interest = ?,
         done_at = CASE WHEN ? IS NOT NULL THEN ? ELSE done_at END
       WHERE id = ?`,
      [...values, doneNow, doneNow, id],
    );
    audit(user.id, "modifica", "attivita", id);
  } else {
    run(
      `INSERT INTO activities
        (type, title, notes, client_id, property_id, user_id, due_at, outcome, interest, done_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [...values, doneNow],
    );
  }

  // Il "sentito l'ultima volta" del cliente si aggiorna da solo.
  if (clientId && doneNow) {
    run(`UPDATE clients SET last_contact_at = datetime('now') WHERE id = ?`, [clientId]);
  }

  if (clientId) revalidatePath(`/clienti/${clientId}`);
  if (propertyId) revalidatePath(`/immobili/${propertyId}`);
  revalidatePath("/agenda");
  revalidatePath("/");
}

export async function completeActivity(form: FormData) {
  const user = await requireUser();
  const id = Number(form.get("id"));

  run(
    `UPDATE activities SET done_at = datetime('now'), outcome = COALESCE(?, outcome)
      WHERE id = ?`,
    [nullable(form, "outcome"), id],
  );

  const activity = one<{ client_id: number | null; property_id: number | null }>(
    `SELECT client_id, property_id FROM activities WHERE id = ?`,
    [id],
  );
  if (activity?.client_id) {
    run(`UPDATE clients SET last_contact_at = datetime('now') WHERE id = ?`, [
      activity.client_id,
    ]);
    revalidatePath(`/clienti/${activity.client_id}`);
  }
  if (activity?.property_id) revalidatePath(`/immobili/${activity.property_id}`);

  audit(user.id, "modifica", "attivita", id, "completata");
  revalidatePath("/agenda");
  revalidatePath("/");
}

export async function deleteActivity(form: FormData) {
  await requireUser();
  const id = Number(form.get("id"));
  const activity = one<{ client_id: number | null; property_id: number | null }>(
    `SELECT client_id, property_id FROM activities WHERE id = ?`,
    [id],
  );
  run(`DELETE FROM activities WHERE id = ?`, [id]);
  if (activity?.client_id) revalidatePath(`/clienti/${activity.client_id}`);
  if (activity?.property_id) revalidatePath(`/immobili/${activity.property_id}`);
  revalidatePath("/agenda");
}

/* ============================================================= proposte */

export async function saveOffer(form: FormData) {
  const user = await requireUser();
  const propertyId = Number(form.get("property_id"));

  run(
    `INSERT INTO offers (property_id, client_id, amount, offered_at, valid_until, status, notes)
     VALUES (?,?,?,?,?,?,?)`,
    [
      propertyId,
      Number(form.get("client_id")),
      integer(form, "amount") ?? 0,
      text(form, "offered_at") || new Date().toISOString().slice(0, 10),
      nullable(form, "valid_until"),
      text(form, "status") || "in_attesa",
      nullable(form, "notes"),
    ],
  );

  // Ricevuta una proposta, l'immobile entra in trattativa.
  run(
    `UPDATE properties SET status = 'proposta', updated_at = datetime('now')
      WHERE id = ? AND status IN ('acquisizione','in_vendita')`,
    [propertyId],
  );

  audit(user.id, "crea", "proposta", propertyId);
  revalidatePath(`/immobili/${propertyId}`);
}

export async function updateOfferStatus(form: FormData) {
  const user = await requireUser();
  const id = Number(form.get("id"));
  const status = text(form, "status");

  run(`UPDATE offers SET status = ? WHERE id = ?`, [status, id]);

  const offer = one<{ property_id: number }>(`SELECT property_id FROM offers WHERE id = ?`, [id]);
  if (offer && status === "accettata") {
    run(
      `UPDATE properties SET status = 'compromesso', updated_at = datetime('now') WHERE id = ?`,
      [offer.property_id],
    );
  }

  audit(user.id, "modifica", "proposta", id, status);
  if (offer) revalidatePath(`/immobili/${offer.property_id}`);
}

/* ========================================================== valutazioni */

export async function saveValuation(form: FormData) {
  const user = await requireUser();
  const propertyId = integer(form, "property_id");
  const sqm = integer(form, "sqm");
  const min = integer(form, "eur_sqm_min");
  const max = integer(form, "eur_sqm_max");

  run(
    `INSERT INTO valuations
      (property_id, client_id, city, zone, sqm, eur_sqm_min, eur_sqm_max,
       value_min, value_max, method, notes, user_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      propertyId,
      integer(form, "client_id"),
      nullable(form, "city"),
      nullable(form, "zone"),
      sqm,
      min,
      max,
      sqm && min ? sqm * min : null,
      sqm && max ? sqm * max : null,
      nullable(form, "method"),
      nullable(form, "notes"),
      user.id,
    ],
  );

  audit(user.id, "crea", "valutazione", propertyId);
  if (propertyId) revalidatePath(`/immobili/${propertyId}`);
}

/* =============================================================== utenti */

export async function saveUser(form: FormData) {
  const owner = await requireOwner();
  const id = Number(form.get("id") ?? 0);
  const password = String(form.get("password") ?? "");

  const email = text(form, "email").toLowerCase();
  const name = text(form, "name");
  const role = text(form, "role") === "titolare" ? "titolare" : "agente";
  const office = text(form, "office") || "Lecce";
  const active = bool(form, "active");

  if (id) {
    run(
      `UPDATE users SET email = ?, name = ?, role = ?, office = ?, active = ? WHERE id = ?`,
      [email, name, role, office, active, id],
    );
    if (password) {
      run(`UPDATE users SET password_hash = ? WHERE id = ?`, [hashPassword(password), id]);
    }
    audit(owner.id, "modifica", "utente", id);
  } else {
    if (password.length < 8) throw new Error("La password deve avere almeno 8 caratteri.");
    const result = run(
      `INSERT INTO users (email, name, password_hash, role, office, active)
       VALUES (?,?,?,?,?,1)`,
      [email, name, hashPassword(password), role, office],
    );
    audit(owner.id, "crea", "utente", Number(result.lastInsertRowid));
  }

  revalidatePath("/utenti");
  redirect("/utenti");
}

/* ========================================================= importazione */

export interface ImportResult {
  imported: number;
  skipped: number;
  /** Richieste ricavate dal file: sono quelle che alimentano gli incroci. */
  requirements: number;
  errors: string[];
}

/**
 * Importa i clienti da un file CSV.
 * I nomi delle colonne sono riconosciuti in italiano, con varianti comuni.
 */
export async function importClients(
  _prev: ImportResult | null,
  form: FormData,
): Promise<ImportResult> {
  const user = await requireUser();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { imported: 0, skipped: 0, requirements: 0, errors: ["Nessun file selezionato."] };
  }

  const bytes = await file.arrayBuffer();

  // Un .xlsx e' un archivio compresso: comincia per "PK". Riconoscerlo qui
  // evita la schermata piu' frustrante di tutte, quella che non importa
  // niente e non dice perche'.
  const firma = new Uint8Array(bytes.slice(0, 2));
  if (firma[0] === 0x50 && firma[1] === 0x4b) {
    return {
      imported: 0,
      skipped: 0,
      requirements: 0,
      errors: [
        "Questo è un file Excel (.xlsx), non un CSV. Aprilo con Excel e salvalo " +
          "con File → Salva con nome, scegliendo CSV come tipo di file.",
      ],
    };
  }

  const { rows } = parseCsv(decodeText(bytes));
  if (!rows.length) {
    return { imported: 0, skipped: 0, requirements: 0, errors: ["Il file non contiene righe."] };
  }

  const pick = (row: Record<string, string>, ...names: string[]): string => {
    for (const name of names) {
      for (const key of Object.keys(row)) {
        if (key.toLowerCase().trim() === name.toLowerCase()) {
          const value = row[key]?.trim();
          if (value) return value;
        }
      }
    }
    return "";
  };

  const result: ImportResult = { imported: 0, skipped: 0, requirements: 0, errors: [] };
  const skipDuplicates = !form.get("allow_duplicates");

  const insert = db.prepare(
    `INSERT INTO clients
      (first_name, last_name, company, phone, mobile, email, address, city,
       tax_code, roles, source, status, owner_id, tags, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );

  const insertRequirement = db.prepare(
    `INSERT INTO requirements
      (client_id, contract, kind, city, zones, budget_min, budget_max, sqm_min,
       rooms_min, needs, urgency, status, notes)
     VALUES (?,?,?,?,?,?,?,?,?,'','media','aperta',?)`,
  );

  const findExisting = db.prepare(
    `SELECT id FROM clients
      WHERE deleted_at IS NULL
        AND ((? != '' AND REPLACE(REPLACE(mobile,' ',''),'.','') = ?)
             OR (? != '' AND email = ? COLLATE NOCASE))
      LIMIT 1`,
  );

  const transaction = db.transaction((list: Record<string, string>[]) => {
    list.forEach((row, index) => {
      // Molti gestionali esportano cognome e nome in una colonna sola.
      const insieme = pick(row, "cognome/nome", "nome e cognome", "nominativo", "cliente");
      const separato = insieme ? splitName(insieme) : null;

      const firstName = pick(row, "nome", "first_name", "firstname") || (separato?.firstName ?? "");
      const lastName =
        pick(row, "cognome", "last_name", "lastname", "surname") || (separato?.lastName ?? "");
      const company = pick(row, "ragione sociale", "azienda", "company");
      const email = pick(row, "email", "e-mail", "mail", "email stampa");

      // Nella stessa cella possono esserci piu' numeri, separati da "/".
      const telefoni = splitPhones(
        [pick(row, "cellulare", "mobile", "cell"), pick(row, "telefono", "phone", "tel")]
          .filter(Boolean)
          .join("/"),
      );
      const mobile = telefoni.mobile;

      const richieste = parseRequirements(pick(row, "richieste", "richiesta", "cosa cerca"));
      const noteExtra = [
        pick(row, "note", "notes", "note cliente"),
        telefoni.extra.length ? `Altri numeri: ${telefoni.extra.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      if (!firstName && !lastName && !company) {
        result.skipped++;
        if (result.errors.length < 10) {
          result.errors.push(`Riga ${index + 2}: manca nome, cognome e ragione sociale.`);
        }
        return;
      }

      if (skipDuplicates && (mobile || email)) {
        const existing = findExisting.get(
          mobile,
          mobile.replace(/[\s.]/g, ""),
          email,
          email,
        ) as { id: number } | undefined;
        if (existing) {
          result.skipped++;
          return;
        }
      }

      // Chi arriva con una richiesta e' un acquirente: dirlo subito evita di
      // doverlo scoprire cliente per cliente.
      const ruoli =
        pick(row, "ruolo", "ruoli", "tipo", "roles").toLowerCase() ||
        (richieste.length
          ? richieste.every((r) => r.contract === "affitto")
            ? "conduttore"
            : "acquirente"
          : "");

      const clientId = Number(
        insert.run(
          firstName,
          lastName,
          company || null,
          telefoni.phone || null,
          mobile || null,
          email || null,
          pick(row, "indirizzo", "address") || null,
          pick(row, "citta", "città", "comune", "city") || null,
          pick(row, "codice fiscale", "cf", "tax_code") || null,
          ruoli,
          pick(row, "provenienza", "fonte", "source") || null,
          "attivo",
          user.id,
          pick(row, "etichette", "tag", "tags"),
          noteExtra || null,
        ).lastInsertRowid,
      );

      for (const richiesta of richieste) {
        insertRequirement.run(
          clientId,
          richiesta.contract,
          richiesta.kind,
          richiesta.city,
          richiesta.zones,
          richiesta.budgetMin,
          richiesta.budgetMax,
          richiesta.sqmMin,
          richiesta.roomsMin,
          richiesta.notes || null,
        );
        result.requirements++;
      }
      result.imported++;
    });
  });

  try {
    transaction(rows);
  } catch (error) {
    // La transazione e' stata annullata: in archivio non e' entrato niente.
    // I contatori vanno azzerati, altrimenti la schermata direbbe "1.108
    // importati" di schede che non esistono.
    result.imported = 0;
    result.requirements = 0;
    result.skipped = 0;
    result.errors = [
      `Importazione annullata, nessun cliente inserito: ${
        error instanceof Error ? error.message : "errore sconosciuto"
      }`,
    ];
  }

  audit(
    user.id,
    "crea",
    "cliente",
    null,
    `importazione CSV: ${result.imported} inseriti, ${result.requirements} richieste, ${result.skipped} saltati`,
  );
  revalidatePath("/clienti");
  return result;
}
