#!/usr/bin/env node
/**
 * Reimposta la password di un utente dalla riga di comando.
 *
 *   npm run password -- --email stefano@mondoimmobiliarelecce.it
 *   npm run password -- --email stefano@... --password "una password lunga"
 *
 * E' la via di scampo: serve quando la posta non e' configurata (e quindi il
 * recupero automatico non puo' funzionare), oppure quando chi non riesce a
 * entrare e' l'unico titolare e non c'e' nessuno che possa aiutarlo dal
 * programma.
 *
 * Senza --password ne genera una a caso e la stampa: e' meglio di una scelta
 * a mano fatta di fretta, e va cambiata dalla pagina «Il mio accesso» appena
 * si e' entrati.
 *
 * Come ogni altro cambio di password, fa cadere le sessioni gia' aperte.
 */
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dbPath = process.env.CRM_DB_PATH ?? path.join(root, "data", "mondo.db");

function arg(nome) {
  const indice = process.argv.indexOf(`--${nome}`);
  return indice > -1 ? process.argv[indice + 1] : undefined;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}

const email = arg("email");
if (!email) {
  console.error("Serve --email. Esempio:");
  console.error('  npm run password -- --email stefano@mondoimmobiliarelecce.it');
  process.exit(1);
}

const password = arg("password") ?? crypto.randomBytes(9).toString("base64url");
if (password.length < 8) {
  console.error("La password deve avere almeno 8 caratteri.");
  process.exit(1);
}

const db = new Database(dbPath);

// La colonna la aggiunge il programma al primo avvio dopo l'aggiornamento. Ma
// questo script e' la via di scampo: si usa proprio quando qualcosa non va, e
// magari il programma non e' nemmeno ripartito. Quindi se la colonna manca se
// la aggiunge da solo, invece di fallire con un errore incomprensibile.
const colonne = db.prepare("PRAGMA table_info(users)").all();
if (!colonne.some((campo) => campo.name === "password_changed_at")) {
  db.exec("ALTER TABLE users ADD COLUMN password_changed_at INTEGER");
}

const utente = db
  .prepare("SELECT id, name, email, active FROM users WHERE email = ? COLLATE NOCASE")
  .get(email);

if (!utente) {
  console.error(`Nessun utente con l'email ${email}.`);
  console.error("Gli utenti in archivio:");
  for (const riga of db.prepare("SELECT email, name, active FROM users ORDER BY id").all()) {
    console.error(`  ${riga.email}  (${riga.name})${riga.active ? "" : "  — disattivato"}`);
  }
  process.exit(1);
}

db.prepare("UPDATE users SET password_hash = ?, password_changed_at = ? WHERE id = ?").run(
  hashPassword(password),
  Date.now(),
  utente.id,
);
db.prepare(
  `INSERT INTO audit_log (user_id, action, entity, entity_id, detail)
   VALUES (?, 'modifica', 'utente', ?, 'password reimpostata dal server')`,
).run(utente.id, utente.id);

console.log(`Password reimpostata per ${utente.name} (${utente.email}).`);
console.log(`  Password: ${password}`);
console.log("");
console.log("Annotala adesso: non viene più mostrata.");
console.log("Gli accessi già aperti di questo utente sono stati chiusi.");
if (!utente.active) {
  console.log("");
  console.log("ATTENZIONE: questo utente è disattivato, quindi non potrà entrare.");
  console.log("Riattivalo dalla pagina Utenti.");
}
