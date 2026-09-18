/**
 * Primo avvio: crea il database e il primo utente.
 *
 *   npm run seed
 *   npm run seed -- --demo          (aggiunge dati di esempio per provare)
 *
 * Email e password si possono passare da riga di comando:
 *   npm run seed -- --email camillo@example.it --password "una password lunga"
 */

import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SCHEMA } from "../src/lib/schema.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const demo = process.argv.includes("--demo");
const email = arg("email", "titolare@mondoimmobiliarelecce.it");
const password = arg("password", crypto.randomBytes(9).toString("base64url"));
const name = arg("name", "Camillo Barone");

function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${crypto.scryptSync(plain, salt, 64).toString("hex")}`;
}

const dbPath = process.env.CRM_DB_PATH ?? path.join(root, "data", "mondo.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(SCHEMA);

// ------------------------------------------------------------------ utente
if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
  console.log(`L'utente ${email} esiste già. Nessuna modifica.`);
} else {
  db.prepare(
    `INSERT INTO users (email, name, password_hash, role, office)
     VALUES (?, ?, ?, 'titolare', 'Lecce')`,
  ).run(email, name, hashPassword(password));

  console.log("\n  Utente creato.\n");
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log("\n  Annotala: non verrà più mostrata.\n");
}

const userId = db.prepare("SELECT id FROM users WHERE email = ?").get(email).id;

// ------------------------------------------------------------- dati di prova
if (demo) {
  if (db.prepare("SELECT COUNT(*) AS n FROM clients").get().n > 0) {
    console.log("Il database contiene già dei clienti: dati di esempio non inseriti.");
  } else {
    const addClient = db.prepare(
      `INSERT INTO clients
        (first_name, last_name, mobile, email, city, roles, source, status, owner_id,
         privacy_consent, privacy_date, last_contact_at, notes)
       VALUES (@first, @last, @mobile, @email, @city, @roles, @source, @status, @owner,
               1, date('now'), datetime('now', @silence), @notes)`,
    );

    const clients = [
      { first: "Marco", last: "Rizzo", mobile: "+39 340 1112233", email: "marco.rizzo@example.it",
        city: "Lecce", roles: "acquirente", source: "Sito web", status: "attivo",
        silence: "-5 days", notes: "Cerca prima casa, mutuo in valutazione." },
      { first: "Anna", last: "De Santis", mobile: "+39 347 4455667", email: "anna.desantis@example.it",
        city: "Lecce", roles: "venditore", source: "Passaparola", status: "attivo",
        silence: "-40 days", notes: "Eredità, vuole vendere entro l'anno." },
      { first: "Giuseppe", last: "Leone", mobile: "+39 328 7788990", email: null,
        city: "Porto Cesareo", roles: "acquirente", source: "Immobiliare.it", status: "attivo",
        silence: "-120 days", notes: "Investitore, cerca casa vacanze da mettere a reddito." },
      { first: "Chiara", last: "Fumarola", mobile: "+39 333 2211445", email: "chiara.f@example.it",
        city: "Lecce", roles: "acquirente", source: "Cartello", status: "in_trattativa",
        silence: "-2 days", notes: "Ha visto il trilocale in centro, molto interessata." },
    ];

    const clientIds = clients.map(
      (client) => Number(addClient.run({ ...client, owner: userId }).lastInsertRowid),
    );

    const addProperty = db.prepare(
      `INSERT INTO properties
        (ref, title, kind, contract, address, city, zone, sqm, rooms, bathrooms, floor,
         elevator, outdoor, garage, condition, energy_class, price, min_price, status,
         owner_client_id, agent_id, mandate_start, mandate_end, exclusive, commission_pct, notes)
       VALUES (@ref, @title, @kind, 'vendita', @address, @city, @zone, @sqm, @rooms, @bathrooms,
               @floor, @elevator, @outdoor, @garage, @condition, @energy, @price, @minPrice,
               'in_vendita', @owner, @agent, date('now','-60 days'), date('now', @mandateEnd),
               @exclusive, 3, @notes)`,
    );

    const properties = [
      { ref: "MI-001", title: "Trilocale ristrutturato in centro storico", kind: "Appartamento",
        address: "Via Palmieri 12", city: "Lecce", zone: "Centro storico", sqm: 95, rooms: 3,
        bathrooms: 1, floor: "2", elevator: 0, outdoor: "Balcone", garage: 0,
        condition: "Ristrutturato", energy: "D", price: 235000, minPrice: 215000,
        owner: clientIds[1], agent: userId, mandateEnd: "+25 days", exclusive: 1,
        notes: "Chiavi in agenzia. Proprietaria disponibile ai sopralluoghi il pomeriggio." },
      { ref: "MI-002", title: "Villetta con giardino a Torre Lapillo", kind: "Villetta a schiera",
        address: "Via delle Dune 4", city: "Porto Cesareo", zone: "Torre Lapillo", sqm: 120,
        rooms: 4, bathrooms: 2, floor: "T", elevator: 0, outdoor: "Giardino", garage: 1,
        condition: "Buono stato", energy: "E", price: 265000, minPrice: 245000,
        owner: null, agent: userId, mandateEnd: "+180 days", exclusive: 1,
        notes: "A 400 metri dal mare." },
      { ref: "MI-003", title: "Bilocale zona Mazzini da ristrutturare", kind: "Appartamento",
        address: "Via Trinchese 88", city: "Lecce", zone: "Mazzini", sqm: 65, rooms: 2,
        bathrooms: 1, floor: "4", elevator: 1, outdoor: "Balcone", garage: 0,
        condition: "Da ristrutturare", energy: "G", price: 128000, minPrice: 118000,
        owner: null, agent: userId, mandateEnd: "+90 days", exclusive: 0,
        notes: "Ottimo per investimento: zona molto richiesta dagli studenti." },
    ];

    const propertyIds = properties.map(
      (property) => Number(addProperty.run(property).lastInsertRowid),
    );

    const addRequirement = db.prepare(
      `INSERT INTO requirements
        (client_id, contract, kind, city, zones, budget_min, budget_max, sqm_min, rooms_min,
         needs, urgency, financing, status, notes)
       VALUES (@client, 'vendita', @kind, @city, @zones, @min, @max, @sqm, @rooms,
               @needs, @urgency, @financing, 'aperta', @notes)`,
    );

    addRequirement.run({
      client: clientIds[0], kind: "Appartamento", city: "Lecce",
      zones: "Centro storico,Mazzini", min: 150000, max: 250000, sqm: 80, rooms: 3,
      needs: "", urgency: "alta", financing: "mutuo_da_valutare",
      notes: "Prima casa, preferisce il centro. Non vuole piano terra.",
    });
    addRequirement.run({
      client: clientIds[2], kind: "Villetta a schiera", city: "Porto Cesareo",
      zones: "Torre Lapillo,Porto Cesareo", min: 180000, max: 300000, sqm: 90, rooms: 3,
      needs: "esterno", urgency: "media", financing: "contanti",
      notes: "Casa vacanze da mettere a reddito in estate.",
    });
    addRequirement.run({
      client: clientIds[3], kind: "Appartamento", city: "Lecce", zones: "Centro storico",
      min: 200000, max: 260000, sqm: 85, rooms: 3, needs: "", urgency: "alta",
      financing: "mutuo_deliberato",
      notes: "Ha già visto MI-001, decide entro due settimane.",
    });

    db.prepare(
      `INSERT INTO activities (type, title, notes, client_id, property_id, user_id, due_at, done_at, outcome)
       VALUES ('visita', 'Visita al trilocale in centro',
               'Sopralluogo di 40 minuti.', ?, ?, ?,
               datetime('now','-2 days'), datetime('now','-2 days'),
               'Molto interessata, chiede se il prezzo è trattabile.')`,
    ).run(clientIds[3], propertyIds[0], userId);

    db.prepare(
      `INSERT INTO activities (type, title, client_id, user_id, due_at)
       VALUES ('chiamata', 'Richiamare per fissare la seconda visita', ?, ?, datetime('now'))`,
    ).run(clientIds[3], userId);

    db.prepare(
      `INSERT INTO activities (type, title, client_id, user_id, due_at)
       VALUES ('chiamata', 'Aggiornamento sullo stato della vendita', ?, ?, datetime('now','-1 day'))`,
    ).run(clientIds[1], userId);

    const addPrice = db.prepare(
      `INSERT INTO price_history (property_id, price, user_id, changed_at)
       VALUES (?, ?, ?, datetime('now','-60 days'))`,
    );
    for (const propertyId of propertyIds) {
      const { price } = db.prepare("SELECT price FROM properties WHERE id = ?").get(propertyId);
      addPrice.run(propertyId, price, userId);
    }

    console.log("Dati di esempio inseriti: 4 clienti, 3 immobili, 3 richieste, 3 attività.");
  }
}

db.close();
console.log(`Database pronto: ${dbPath}`);
