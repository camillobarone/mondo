#!/usr/bin/env node
/**
 * Diagnosi dell'archivio. Legge e basta: apre il database in sola lettura,
 * non scrive niente e non fa migrazioni.
 *
 *   cd /opt/mondo-crm && node scripts/diagnosi.mjs
 *
 * Serve a rispondere a una domanda sola, quando il gestionale sembra vuoto:
 * i dati ci sono ancora, e a chi risultano intestati? Da quando c'e' il muro
 * fra colleghi, ognuno vede solo le schede con il proprio nome sopra: un
 * archivio "sparito" e' quasi sempre un archivio intestato a un altro utente.
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const PERCORSO =
  process.env.CRM_DB_PATH ?? path.join(process.cwd(), "data", "mondo.db");

if (!fs.existsSync(PERCORSO)) {
  console.log(`Il database NON esiste: ${PERCORSO}`);
  const cartella = path.dirname(PERCORSO);
  if (fs.existsSync(cartella)) {
    console.log(`Dentro ${cartella} c'e':`);
    for (const nome of fs.readdirSync(cartella)) console.log(`  ${nome}`);
  } else {
    console.log(`La cartella ${cartella} non esiste proprio.`);
  }
  process.exit(1);
}

const info = fs.statSync(PERCORSO);
console.log(`Database:  ${PERCORSO}`);
console.log(`Dimensione: ${(info.size / 1024).toFixed(0)} KB`);
console.log(`Ultima modifica: ${info.mtime.toLocaleString("it-IT")}`);

const db = new Database(PERCORSO, { readonly: true, fileMustExist: true });
const tutti = (sql) => db.prepare(sql).all();
const uno = (sql) => db.prepare(sql).get();

const utenti = tutti(
  `SELECT id, email, name, role, active FROM users ORDER BY id`,
);

console.log(`\n=== UTENTI (${utenti.length}) ===`);
for (const u of utenti) {
  const stato = u.active ? "attivo" : "DISATTIVATO";
  console.log(`  id ${u.id}  ${u.role.padEnd(9)}  ${stato.padEnd(11)}  ${u.email}  (${u.name})`);
}

const nome = (id) => {
  if (id === null) return "NESSUNO (senza intestatario)";
  const u = utenti.find((x) => x.id === id);
  return u ? `id ${id} — ${u.email}` : `id ${id} — UTENTE INESISTENTE`;
};

const blocchi = [
  { titolo: "CLIENTI", tabella: "clients", colonna: "owner_id" },
  { titolo: "IMMOBILI", tabella: "properties", colonna: "agent_id" },
];

for (const { titolo, tabella, colonna } of blocchi) {
  const totale = uno(`SELECT COUNT(*) AS n FROM ${tabella}`).n;
  console.log(`\n=== ${titolo}: ${totale} in tutto ===`);
  if (!totale) continue;
  const righe = tutti(
    `SELECT ${colonna} AS chi, COUNT(*) AS n FROM ${tabella}
      GROUP BY ${colonna} ORDER BY n DESC`,
  );
  for (const riga of righe) console.log(`  ${String(riga.n).padStart(6)}  →  ${nome(riga.chi)}`);
}

// Le altre tabelle non hanno un intestatario proprio: seguono il cliente o
// l'immobile a cui sono attaccate. Qui basta sapere che ci sono ancora.
console.log(`\n=== ALTRO ===`);
for (const tabella of ["requirements", "activities", "offers", "valuations", "price_history"]) {
  try {
    console.log(`  ${String(uno(`SELECT COUNT(*) AS n FROM ${tabella}`).n).padStart(6)}  ${tabella}`);
  } catch {
    console.log(`       -  ${tabella} (tabella assente)`);
  }
}

console.log(
  `\nSe i numeri sopra non sono zero, l'archivio c'e' tutto: e' solo intestato\n` +
    `all'utente indicato, e lo vede solo chi entra con quell'indirizzo email.`,
);

db.close();
