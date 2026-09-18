#!/usr/bin/env node
/**
 * Crea il profilo di una persona e la sua agenda, in un comando solo.
 *
 *   npm run persone                       (i due previsti: Roberto e Alessandro)
 *   npm run persone -- --nome "Tizia Caia" --email tizia@mondoimmobiliarelecce.it
 *   npm run persone -- --nome "..." --email ... --password "una password lunga"
 *
 * Fa quello che si farebbe a mano da Utenti → Nuovo utente piu' il pulsante
 * «Crea il calendario», ma senza doverci passare: crea l'utenza come
 * Collaboratore e le genera subito la chiave del calendario, cosi' la persona
 * compare nella tendina «assegnata a» dell'agenda e ha da subito il suo
 * indirizzo .ics da mettere in Google.
 *
 * Perche' esiste, visto che dalle pagine si fa gia': l'archivio di produzione
 * sta sul server dell'agenzia e da fuori non si raggiunge. Chi riprende il
 * lavoro non puo' creare quei profili al posto di chi ce l'ha davanti — puo'
 * pero' lasciargli un comando che non chiede di indovinare niente.
 *
 * **Si puo' rilanciare.** Chi c'e' gia' non viene toccato: ne' la password ne'
 * il ruolo ne' il calendario, che se e' gia' collegato da qualche parte non
 * deve spegnersi per una seconda corsa distratta. Chi manca viene creato.
 *
 * La password si genera a caso e si stampa. Se la persona nel programma non
 * deve entrare — ci sono profili che servono solo come etichetta a cui
 * assegnare un appuntamento — quella password non la si da' a nessuno e
 * l'utenza resta un nome nella tendina.
 */
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dbPath = process.env.CRM_DB_PATH ?? path.join(root, "data", "mondo.db");
const base = (process.env.CRM_BASE_URL ?? "https://gestionale.mondoimmobiliarelecce.it")
  .replace(/\/$/, "");

function arg(nome) {
  const indice = process.argv.indexOf(`--${nome}`);
  return indice > -1 ? process.argv[indice + 1] : undefined;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}

/**
 * I due profili chiesti il 12 settembre 2026, e rimasti in attesa solo perche'
 * da fuori all'archivio non si arriva. L'indirizzo e' quello dell'agenzia
 * nella forma nome.cognome: e' un'utenza, non una casella vera, e se la
 * casella vera fosse un'altra si cambia da Utenti in dieci secondi — conta
 * solo che sia diverso da tutti gli altri.
 */
const PREVISTI = [
  { nome: "Roberto Lefons", email: "roberto.lefons@mondoimmobiliarelecce.it" },
  { nome: "Alessandro Ciullo", email: "alessandro.ciullo@mondoimmobiliarelecce.it" },
];

const nomeSingolo = arg("nome");
const emailSingola = arg("email");
if ((nomeSingolo && !emailSingola) || (!nomeSingolo && emailSingola)) {
  console.error("Servono insieme --nome e --email. Esempio:");
  console.error('  npm run persone -- --nome "Tizia Caia" --email tizia@mondoimmobiliarelecce.it');
  process.exit(1);
}

const ufficio = arg("ufficio") ?? "Lecce";
const passwordScelta = arg("password");
if (passwordScelta && passwordScelta.length < 8) {
  console.error("La password deve avere almeno 8 caratteri.");
  process.exit(1);
}

const persone = nomeSingolo
  ? [{ nome: nomeSingolo, email: emailSingola.toLowerCase() }]
  : PREVISTI;

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

// La colonna del calendario la aggiunge il programma al primo avvio dopo
// l'aggiornamento. Questo script pero' puo' girare su un archivio appena
// copiato, prima che il programma sia ripartito: se manca se la aggiunge da
// solo, invece di fermarsi con un «no such column» che manda a cercare
// tutt'altro. Stessa precauzione di scripts/password.mjs.
const colonne = db.prepare("PRAGMA table_info(users)").all();
if (!colonne.some((campo) => campo.name === "calendar_token")) {
  db.exec("ALTER TABLE users ADD COLUMN calendar_token TEXT");
}

// Se qui non c'e' nessuno, l'archivio e' quello sbagliato: meglio dirlo adesso
// che lasciare due profili in un database di prova, convinti di averli messi
// dove servivano.
const quanti = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
if (quanti === 0) {
  console.error(`L'archivio ${dbPath} non ha nessun utente.`);
  console.error("Se e' la prima installazione, prima «npm run seed».");
  console.error("Se invece l'archivio vero e' un altro, passa CRM_DB_PATH.");
  process.exit(1);
}

// Il registro accessi vuole un nome accanto a ogni riga. Qui non c'e' nessuno
// che ha fatto l'accesso: la riga la si intesta al titolare, che e' chi ha
// chiesto i profili e chi ne risponde.
const titolare = db
  .prepare("SELECT id, name FROM users WHERE role = 'titolare' AND active = 1 ORDER BY id")
  .get();

const registra = db.prepare(
  `INSERT INTO audit_log (user_id, action, entity, entity_id, detail)
   VALUES (?, ?, 'utente', ?, ?)`,
);

for (const persona of persone) {
  const esistente = db
    .prepare("SELECT id, name, email, role, active, calendar_token FROM users WHERE email = ? COLLATE NOCASE")
    .get(persona.email);

  let id;
  if (esistente) {
    id = esistente.id;
    console.log(`${esistente.name} c'era già (${esistente.email}). Lasciato com'è.`);
    if (!esistente.active) {
      console.log("  ATTENZIONE: è disattivato, quindi non compare nella tendina «assegnata a».");
      console.log("  Si riattiva da Utenti.");
    }
  } else {
    const password = passwordScelta ?? crypto.randomBytes(9).toString("base64url");
    id = db
      .prepare(
        `INSERT INTO users (email, name, password_hash, role, office, active)
         VALUES (?, ?, ?, 'agente', ?, 1)`,
      )
      .run(persona.email, persona.nome, hashPassword(password), ufficio).lastInsertRowid;
    registra.run(titolare?.id ?? null, "crea", id, `profilo creato dal server`);

    console.log(`${persona.nome} creato come Collaboratore (${ufficio}).`);
    console.log(`  Email:    ${persona.email}`);
    console.log(`  Password: ${password}`);
    console.log("  Annotala adesso: non viene più mostrata. Se nel programma non deve");
    console.log("  entrare, non darla a nessuno: il profilo serve lo stesso.");
  }

  // Il calendario: la chiave si crea solo se manca. Rigenerarla qui vorrebbe
  // dire spegnere, a ogni corsa, un calendario che qualcuno ha appena
  // collegato in Google. Per cambiarla c'e' il pulsante apposta, in Utenti.
  const riga = db.prepare("SELECT calendar_token FROM users WHERE id = ?").get(id);
  if (riga.calendar_token) {
    console.log(`  Calendario: ${base}/calendario/${riga.calendar_token}.ics  (c'era già)`);
  } else {
    const token = crypto.randomBytes(24).toString("base64url");
    db.prepare("UPDATE users SET calendar_token = ? WHERE id = ?").run(token, id);
    registra.run(titolare?.id ?? null, "modifica", id, `creato il calendario di ${persona.nome}`);
    console.log(`  Calendario: ${base}/calendario/${token}.ics`);
  }
  console.log("");
}

console.log("L'indirizzo del calendario vale come una password: chi ce l'ha vede gli");
console.log("appuntamenti di quella persona, con il nome e il numero dei clienti.");
console.log("Si rigenera in qualunque momento da Utenti → I calendari delle persone.");
console.log("");
console.log("In Google i calendari veri li crea il collegamento a Google Calendar:");
console.log("Utenti → Google Calendar → Crea i calendari mancanti.");
