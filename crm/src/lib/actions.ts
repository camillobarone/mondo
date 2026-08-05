"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, run, one, audit } from "./db";
import { requireUser, requireOwner, hashPassword, login as doLogin, logout as doLogout } from "./auth";
import { parseCsv, decodeText } from "./csv";
import { readXlsx, looksLikeXlsx } from "./xlsx";
import { salvaFoto, cancellaFile, MAX_FOTO_PER_IMMOBILE } from "./photos";
import {
  splitName, splitPhones, parseRequirements,
  numero, dataItaliana, zonaEComune, tipologia,
} from "./import-map";
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

/* ====================================================== muro, in scrittura */

/**
 * Il muro visto dal lato delle modifiche.
 *
 * Nascondere una scheda non basta: i moduli mandano al server il numero della
 * scheda su cui agire, e quel numero si puo' cambiare. Senza questi controlli
 * si potrebbe modificare o cancellare la scheda di un collega senza averla mai
 * vista — e la cancellazione non lascerebbe niente da guardare dopo.
 *
 * Il messaggio e' sempre lo stesso, che la scheda non esista o che sia di un
 * altro. Due messaggi diversi sarebbero un modo per contare l'archivio altrui
 * un tentativo alla volta.
 */
const NEGATO = "Scheda non trovata.";

function esigiCliente(utente: number, id: number) {
  const mio = one<{ id: number }>(`SELECT id FROM clients WHERE id = ? AND owner_id = ?`, [
    id,
    utente,
  ]);
  if (!mio) throw new Error(NEGATO);
}

function esigiImmobile(utente: number, id: number) {
  const mio = one<{ id: number }>(`SELECT id FROM properties WHERE id = ? AND agent_id = ?`, [
    id,
    utente,
  ]);
  if (!mio) throw new Error(NEGATO);
}

function esigiRichiesta(utente: number, id: number) {
  const mia = one<{ id: number }>(
    `SELECT r.id FROM requirements r
       JOIN clients c ON c.id = r.client_id
      WHERE r.id = ? AND c.owner_id = ?`,
    [id, utente],
  );
  if (!mia) throw new Error(NEGATO);
}

/** Come in lettura: e' mia se e' assegnata a me o se tocca una mia scheda. */
function esigiAttivita(utente: number, id: number) {
  const mia = one<{ id: number }>(
    `SELECT a.id FROM activities a
       LEFT JOIN clients    c ON c.id = a.client_id
       LEFT JOIN properties p ON p.id = a.property_id
      WHERE a.id = ? AND (a.user_id = ? OR c.owner_id = ? OR p.agent_id = ?)`,
    [id, utente, utente, utente],
  );
  if (!mia) throw new Error(NEGATO);
}

/** Una proposta si tocca da entrambi i lati della trattativa. */
function esigiProposta(utente: number, id: number) {
  const mia = one<{ id: number }>(
    `SELECT o.id FROM offers o
       JOIN clients    c ON c.id = o.client_id
       JOIN properties p ON p.id = o.property_id
      WHERE o.id = ? AND (p.agent_id = ? OR c.owner_id = ?)`,
    [id, utente, utente],
  );
  if (!mia) throw new Error(NEGATO);
}

/**
 * I collegamenti che un modulo puo' portarsi dietro (il cliente e l'immobile
 * di un'attivita', di una proposta, di una valutazione) devono puntare a
 * schede proprie: altrimenti si scriverebbe dentro la storia di una scheda di
 * un collega senza poterla nemmeno vedere.
 */
function esigiCollegamenti(
  utente: number,
  collegamenti: { clientId?: number | null; propertyId?: number | null },
) {
  if (collegamenti.clientId) esigiCliente(utente, collegamenti.clientId);
  if (collegamenti.propertyId) esigiImmobile(utente, collegamenti.propertyId);
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
    esigiCliente(user.id, id);
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
        // Mai NULL: una scheda senza responsabile non sarebbe di tutti, sarebbe
        // di nessuno, e sparirebbe dagli elenchi di chiunque.
        values.roles, values.source, values.status, values.owner_id ?? user.id,
        values.tags, values.notes,
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
  esigiCliente(user.id, id);
  // Cancellazione logica: la scheda sparisce ma resta la traccia per il registro.
  run(`UPDATE clients SET deleted_at = datetime('now') WHERE id = ?`, [id]);
  audit(user.id, "elimina", "cliente", id);
  revalidatePath("/clienti");
  redirect("/clienti");
}

/**
 * Cancellazione definitiva su richiesta dell'interessato (GDPR).
 *
 * Non e' piu' riservata al titolare: adesso che ognuno tiene le proprie
 * schede, la richiesta di cancellazione la evade chi quel contatto ce l'ha.
 *
 * Da sapere: se la stessa persona e' in archivio anche presso un collega,
 * questa cancella solo la propria copia. Finche' non c'e' un modo di
 * segnalare i contatti in comune, una richiesta di cancellazione va girata a
 * voce anche all'altro.
 */
export async function eraseClient(form: FormData) {
  const user = await requireUser();
  const id = Number(form.get("id"));
  esigiCliente(user.id, id);
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
    esigiImmobile(user.id, id);
    // Il modulo si porta dietro anche il proprietario collegato, in un campo
    // nascosto: va controllato come tutto il resto, altrimenti sarebbe una
    // strada silenziosa per agganciare all'immobile la scheda di un collega.
    esigiCollegamenti(user.id, { clientId: values.owner_client_id });
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
        values.min_price, values.status, values.owner_client_id, values.agent_id ?? user.id,
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

/* --------------------------------------------------- proprietario <-> immobile */

/**
 * Collega un immobile alla scheda del suo proprietario, o scollega.
 * Si puo' fare da entrambe le parti: dalla scheda dell'immobile e da quella
 * del venditore. E' lo stesso legame, e chi lo cerca lo cerca da dove si
 * trova in quel momento.
 */
export async function linkOwner(form: FormData) {
  const user = await requireUser();
  const propertyId = Number(form.get("property_id"));
  const clientId = Number(form.get("client_id")) || null;
  if (!propertyId) return;

  // Entrambe le schede devono essere proprie: quella dell'immobile perche' si
  // sta modificando, quella del cliente perche' ci si sta agganciando.
  esigiImmobile(user.id, propertyId);
  esigiCollegamenti(user.id, { clientId });

  run(`UPDATE properties SET owner_client_id = ?, updated_at = datetime('now') WHERE id = ?`, [
    clientId, propertyId,
  ]);
  audit(
    user.id,
    "modifica",
    "immobile",
    propertyId,
    clientId ? `proprietario collegato (cliente ${clientId})` : "proprietario scollegato",
  );

  revalidatePath(`/immobili/${propertyId}`);
  revalidatePath("/immobili");
  revalidatePath("/venditori");
  if (clientId) revalidatePath(`/clienti/${clientId}`);
}

/* ------------------------------------------------------------------ foto */

export interface PhotoResult {
  caricate: number;
  errori: string[];
}

/** Carica una o piu' foto su un immobile. */
export async function uploadPhotos(
  _prev: PhotoResult | null,
  form: FormData,
): Promise<PhotoResult> {
  const user = await requireUser();
  const propertyId = Number(form.get("property_id"));
  if (!propertyId) return { caricate: 0, errori: ["Immobile non indicato."] };
  esigiImmobile(user.id, propertyId);

  const files = form.getAll("foto").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { caricate: 0, errori: ["Non hai scelto nessuna foto."] };

  const gia = one<{ n: number }>(`SELECT COUNT(*) AS n FROM photos WHERE property_id = ?`, [
    propertyId,
  ])!.n;

  const errori: string[] = [];
  let caricate = 0;
  let posizione = one<{ n: number }>(
    `SELECT COALESCE(MAX(position), -1) AS n FROM photos WHERE property_id = ?`,
    [propertyId],
  )!.n;

  for (const file of files) {
    if (gia + caricate >= MAX_FOTO_PER_IMMOBILE) {
      errori.push(`Massimo ${MAX_FOTO_PER_IMMOBILE} foto per immobile: le altre non sono state caricate.`);
      break;
    }

    const esito = await salvaFoto(propertyId, file.name, await file.arrayBuffer());
    if (esito.errore) {
      if (errori.length < 8) errori.push(esito.errore);
      continue;
    }

    posizione++;
    run(`INSERT INTO photos (property_id, file, position) VALUES (?,?,?)`, [
      propertyId, esito.file, posizione,
    ]);
    caricate++;
  }

  if (caricate) audit(user.id, "modifica", "immobile", propertyId, `${caricate} foto caricate`);
  revalidatePath(`/immobili/${propertyId}`);
  revalidatePath("/immobili");
  return { caricate, errori };
}

export async function deletePhoto(form: FormData) {
  const user = await requireUser();
  const id = Number(form.get("id"));
  const foto = one<{ property_id: number; file: string }>(
    `SELECT property_id, file FROM photos WHERE id = ?`,
    [id],
  );
  if (!foto) return;
  esigiImmobile(user.id, foto.property_id);

  run(`DELETE FROM photos WHERE id = ?`, [id]);
  cancellaFile(foto.property_id, foto.file);
  audit(user.id, "elimina", "immobile", foto.property_id, "foto eliminata");
  revalidatePath(`/immobili/${foto.property_id}`);
  revalidatePath("/immobili");
}

/** Porta una foto in cima: e' quella che si vede negli elenchi. */
export async function setCoverPhoto(form: FormData) {
  const user = await requireUser();
  const id = Number(form.get("id"));
  const foto = one<{ property_id: number }>(`SELECT property_id FROM photos WHERE id = ?`, [id]);
  if (!foto) return;
  esigiImmobile(user.id, foto.property_id);

  const minima = one<{ n: number }>(
    `SELECT COALESCE(MIN(position), 0) AS n FROM photos WHERE property_id = ?`,
    [foto.property_id],
  )!.n;
  run(`UPDATE photos SET position = ? WHERE id = ?`, [minima - 1, id]);

  audit(user.id, "modifica", "immobile", foto.property_id, "foto di copertina cambiata");
  revalidatePath(`/immobili/${foto.property_id}`);
  revalidatePath("/immobili");
}

/** Chiusura della trattativa: rogito, prezzo finale e provvigioni. */
export async function closeDeal(form: FormData) {
  const user = await requireUser();
  const id = Number(form.get("id"));
  esigiImmobile(user.id, id);

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
  esigiImmobile(user.id, id);
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

  // La richiesta e' del cliente: si tocca solo se il cliente e' proprio.
  esigiCliente(user.id, clientId);
  if (id) {
    esigiRichiesta(user.id, id);
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
  esigiRichiesta(user.id, id);
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
  // In modifica la spunta racconta lo stato attuale: toglierla rimette
  // l'appuntamento fra le cose da fare, e rimetterla non deve spostare a
  // "adesso" un lavoro finito la settimana scorsa.
  const fatto = Boolean(form.get("done"));
  const gia = text(form, "done_at");
  // Stesso formato di datetime('now') di SQLite: mischiare "2026-08-03T10:45Z"
  // e "2026-08-03 10:45:30" fa ordinare male le cronologie dello stesso giorno.
  const adesso = new Date().toISOString().slice(0, 19).replace("T", " ");
  const doneNow = fatto ? gia || adesso : null;

  // Il cliente e l'immobile a cui l'attivita' si aggancia devono essere
  // propri: senza questo controllo si potrebbe scrivere nello storico della
  // scheda di un collega, che poi se la ritrova nel foglio da consegnare.
  esigiCollegamenti(user.id, { clientId, propertyId });

  if (id) {
    esigiAttivita(user.id, id);
    run(
      `UPDATE activities SET
         type = ?, title = ?, notes = ?, client_id = ?, property_id = ?, user_id = ?,
         due_at = ?, outcome = ?, interest = ?, done_at = ?
       WHERE id = ?`,
      [...values, doneNow, id],
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

  // Solo percorsi interni: "//dominio.est" passerebbe il controllo su "/"
  // e porterebbe fuori dal gestionale.
  const dove = text(form, "redirect_to");
  if (dove.startsWith("/") && !dove.startsWith("//")) redirect(dove);
}

export async function completeActivity(form: FormData) {
  const user = await requireUser();
  const id = Number(form.get("id"));
  esigiAttivita(user.id, id);

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
  const user = await requireUser();
  const id = Number(form.get("id"));
  esigiAttivita(user.id, id);
  const activity = one<{ client_id: number | null; property_id: number | null }>(
    `SELECT client_id, property_id FROM activities WHERE id = ?`,
    [id],
  );
  run(`DELETE FROM activities WHERE id = ?`, [id]);
  audit(user.id, "elimina", "attivita", id);
  if (activity?.client_id) revalidatePath(`/clienti/${activity.client_id}`);
  if (activity?.property_id) revalidatePath(`/immobili/${activity.property_id}`);
  revalidatePath("/agenda");
  revalidatePath("/");

  const dove = text(form, "redirect_to");
  redirect(dove.startsWith("/") && !dove.startsWith("//") ? dove : "/agenda");
}

/* ============================================================= proposte */

export async function saveOffer(form: FormData) {
  const user = await requireUser();
  const propertyId = Number(form.get("property_id"));
  const clientId = Number(form.get("client_id"));
  esigiCollegamenti(user.id, { clientId, propertyId });

  run(
    `INSERT INTO offers (property_id, client_id, amount, offered_at, valid_until, status, notes)
     VALUES (?,?,?,?,?,?,?)`,
    [
      propertyId,
      clientId,
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
  esigiProposta(user.id, id);

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
  const clientId = integer(form, "client_id");
  esigiCollegamenti(user.id, { clientId, propertyId });

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
      clientId,
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
      // Stesso requisito della creazione: senza, da qui si poteva impostare
      // una password di una lettera a un utente esistente.
      if (password.length < 8) throw new Error("La password deve avere almeno 8 caratteri.");
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
  /** "clienti" | "immobili": cosa e' stato riconosciuto nel file. */
  kind?: "clienti" | "immobili";
  imported: number;
  skipped: number;
  /** Richieste ricavate dal file: sono quelle che alimentano gli incroci. */
  requirements: number;
  errors: string[];
}

/**
 * Capisce da solo se il file contiene clienti o immobili, guardando le
 * intestazioni. Meglio che chiederlo: una scelta sbagliata in un menu a
 * tendina riempirebbe l'archivio di schede senza senso.
 */
function riconosciTipo(headers: string[]): "clienti" | "immobili" | null {
  const normali = headers.map((h) => h.toLowerCase().trim());
  const ha = (...nomi: string[]) => nomi.some((n) => normali.includes(n));

  const immobili = [
    ha("riferimento", "rif", "codice"),
    ha("tipologia"),
    ha("prezzo"),
    ha("contratto"),
  ].filter(Boolean).length;

  const clienti = [
    ha("cognome/nome", "cognome", "nome", "nominativo", "cliente"),
    ha("cellulare", "telefono", "tel"),
    ha("email", "email stampa", "e-mail"),
    ha("richieste", "richiesta"),
  ].filter(Boolean).length;

  if (immobili >= 3 && immobili > clienti) return "immobili";
  if (clienti >= 2) return "clienti";
  return null;
}

/**
 * Importa il portafoglio immobili.
 *
 * I doppioni si riconoscono dal riferimento interno: reimportare lo stesso
 * elenco non crea copie. Il proprietario viene collegato alla sua scheda
 * cliente quando il telefono corrisponde a una gia' in archivio; altrimenti
 * nome e recapito restano nelle note, che e' meglio che perderli.
 */
function importaImmobili(rows: Record<string, string>[], userId: number): ImportResult {
  const result: ImportResult = {
    kind: "immobili", imported: 0, skipped: 0, requirements: 0, errors: [],
  };

  const leggi = (row: Record<string, string>, ...nomi: string[]): string => {
    for (const nome of nomi) {
      for (const chiave of Object.keys(row)) {
        if (chiave.toLowerCase().trim() === nome) {
          const valore = row[chiave]?.trim();
          if (valore) return valore;
        }
      }
    }
    return "";
  };

  // Il confronto con quello che c'e' gia' guarda solo il proprio archivio.
  // Fosse esteso a tutti, il conteggio dei saltati direbbe quante schede ha il
  // collega: si caricherebbe un elenco di numeri di telefono e si leggerebbe la
  // risposta nel totale, senza vedere una riga.
  const esistente = db.prepare(
    `SELECT id FROM properties
      WHERE ref = ? AND ref != '' AND deleted_at IS NULL AND agent_id = ?
      LIMIT 1`,
  );
  const proprietario = db.prepare(
    `SELECT id FROM clients
      WHERE deleted_at IS NULL
        AND owner_id = ?
        AND REPLACE(REPLACE(COALESCE(mobile,''),' ',''),'.','') = ?
      LIMIT 1`,
  );
  const inserisci = db.prepare(
    `INSERT INTO properties
      (ref, title, kind, contract, city, zone, sqm, rooms, price, status,
       owner_client_id, agent_id, mandate_end, exclusive, notes)
     VALUES (?,?,?,?,?,?,?,?,?,'in_vendita',?,?,?,?,?)`,
  );

  const transazione = db.transaction((elenco: Record<string, string>[]) => {
    elenco.forEach((row, indice) => {
      const ref = leggi(row, "riferimento", "rif", "codice");
      const tipo = leggi(row, "tipologia");
      const zonaGrezza = leggi(row, "zona", "comune", "località", "localita");
      const { city, zone } = zonaEComune(zonaGrezza);
      const sqm = numero(leggi(row, "mq", "metri", "superficie"));
      const price = numero(leggi(row, "prezzo"));

      if (!ref && !tipo && !zonaGrezza) {
        result.skipped++;
        return;
      }

      if (ref && esistente.get(ref, userId)) {
        result.skipped++;
        return;
      }

      // Il titolo non c'e' in questi tracciati: si compone da cosa e dove,
      // che e' l'unica cosa che serve per riconoscerlo in un elenco.
      const titolo =
        [tipo, sqm ? `${sqm} mq` : "", zone || city ? `a ${zone ?? city}` : ""]
          .filter(Boolean)
          .join(" ") || ref || `Immobile riga ${indice + 2}`;

      const telefono = leggi(row, "tel", "telefono", "cellulare").replace(/[\s.]/g, "");
      const nomeProprietario = leggi(row, "proprietario", "venditore");
      const collegato = telefono
        ? (proprietario.get(userId, telefono) as { id: number } | undefined)
        : undefined;

      const note = [
        collegato ? "" : nomeProprietario ? `Proprietario: ${nomeProprietario}` : "",
        collegato || !telefono ? "" : `Tel: ${telefono}`,
        /s[iì]/i.test(leggi(row, "asta")) ? "Immobile all'asta" : "",
        leggi(row, "status", "stato"),
      ]
        .filter(Boolean)
        .join(" · ");

      inserisci.run(
        ref,
        titolo,
        tipologia(tipo),
        /affitt|locaz/i.test(leggi(row, "contratto")) ? "affitto" : "vendita",
        city,
        zone,
        sqm,
        numero(leggi(row, "vani", "locali")),
        price,
        collegato?.id ?? null,
        userId,
        dataItaliana(leggi(row, "esclusiva termine", "scadenza incarico")),
        /s[iì]/i.test(leggi(row, "esclusiva")) ? 1 : 0,
        note || null,
      );
      result.imported++;
    });
  });

  try {
    transazione(rows);
  } catch (error) {
    result.imported = 0;
    result.skipped = 0;
    result.errors = [
      `Importazione annullata, nessun immobile inserito: ${
        error instanceof Error ? error.message : "errore sconosciuto"
      }`,
    ];
  }

  audit(userId, "crea", "immobile", null, `importazione: ${result.imported} immobili`);
  revalidatePath("/immobili");
  revalidatePath("/incroci");
  return result;
}

/** Le celle di un foglio Excel diventano righe con intestazione, come dal CSV. */
function rowsFromSheet(sheet: string[][]): Record<string, string>[] {
  const headerIndex = sheet.findIndex((row) => row.some((cell) => cell.trim() !== ""));
  if (headerIndex < 0) return [];

  const headers = sheet[headerIndex]!.map((cell) => cell.trim());
  return sheet
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => cell.trim() !== ""))
    .map((row) => {
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        if (header) record[header] = (row[index] ?? "").trim();
      });
      return record;
    });
}

/**
 * Importa i clienti da un file Excel o CSV.
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

  // Excel e CSV entrano dalla stessa porta: il formato si riconosce dal
  // contenuto, non dal nome, cosi' non c'e' un file "sbagliato" da scegliere.
  let rows: Record<string, string>[];
  try {
    rows = looksLikeXlsx(bytes) ? rowsFromSheet(readXlsx(bytes)) : parseCsv(decodeText(bytes)).rows;
  } catch (error) {
    return {
      imported: 0,
      skipped: 0,
      requirements: 0,
      errors: [
        `Non sono riuscito a leggere il file: ${
          error instanceof Error ? error.message : "formato non riconosciuto"
        }`,
      ],
    };
  }

  if (!rows.length) {
    return { imported: 0, skipped: 0, requirements: 0, errors: ["Il file non contiene righe."] };
  }

  const tipo = riconosciTipo(Object.keys(rows[0]!));
  if (!tipo) {
    return {
      imported: 0,
      skipped: 0,
      requirements: 0,
      errors: [
        "Non riconosco cosa contiene questo file. Per i clienti servono almeno " +
          "le colonne del nome e di un recapito; per gli immobili riferimento, " +
          "tipologia e prezzo.",
      ],
    };
  }

  if (tipo === "immobili") return importaImmobili(rows, user.id);

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

  const result: ImportResult = { kind: "clienti", imported: 0, skipped: 0, requirements: 0, errors: [] };
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

  // Come sopra: si confronta con le proprie schede, non con quelle di tutti.
  const findExisting = db.prepare(
    `SELECT id FROM clients
      WHERE deleted_at IS NULL
        AND owner_id = ?
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
          user.id,
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

/* ============================================================ calendario */

/**
 * Genera una chiave nuova per il feed del calendario. Serve quando
 * l'indirizzo e' finito dove non doveva: da quel momento il vecchio non
 * risponde piu'.
 */
export async function rigeneraCalendario() {
  const user = await requireUser();
  const token = crypto.randomBytes(24).toString("base64url");
  run(`UPDATE users SET calendar_token = ? WHERE id = ?`, [token, user.id]);
  audit(user.id, "modifica", "utente", user.id, "nuovo indirizzo del calendario");
  revalidatePath("/agenda/calendario");
}
