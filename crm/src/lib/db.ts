import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA } from "./schema";

/**
 * Connessione unica al database SQLite.
 *
 * Il file vive in data/mondo.db (fuori dal repository). Lo schema viene
 * applicato a ogni avvio: tutte le istruzioni sono CREATE ... IF NOT EXISTS,
 * quindi su un database gia' popolato non cambia nulla.
 */

const DB_PATH =
  process.env.CRM_DB_PATH ?? path.join(process.cwd(), "data", "mondo.db");

declare global {
  // eslint-disable-next-line no-var
  var __crmDb: Database.Database | undefined;
}

function connect(): Database.Database {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const database = new Database(DB_PATH);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.exec(SCHEMA);
  aggiungiColonneMancanti(database);
  return database;
}

/**
 * Colonne aggiunte dopo che il programma era gia' in esercizio.
 *
 * `CREATE TABLE IF NOT EXISTS` non tocca una tabella che esiste gia': su un
 * archivio vero, che non si puo' ricreare da zero, le colonne nuove vanno
 * aggiunte una per una. `ALTER TABLE ADD COLUMN` non e' ripetibile, quindi
 * prima si guarda cosa c'e'.
 */
const COLONNE_AGGIUNTE: { tabella: string; colonna: string; definizione: string }[] = [
  // Chiave dell'abbonamento al calendario: sta nell'indirizzo del feed, quindi
  // vale come password e si genera solo quando serve.
  { tabella: "users", colonna: "calendar_token", definizione: "TEXT" },
  // Quando e' partito il promemoria dei 30 minuti: senza, ripartirebbe a ogni
  // giro del cron.
  { tabella: "activities", colonna: "reminded_at", definizione: "TEXT" },
];

function aggiungiColonneMancanti(database: Database.Database) {
  for (const { tabella, colonna, definizione } of COLONNE_AGGIUNTE) {
    const presenti = database
      .prepare(`PRAGMA table_info(${tabella})`)
      .all() as { name: string }[];
    if (presenti.some((campo) => campo.name === colonna)) continue;
    try {
      database.exec(`ALTER TABLE ${tabella} ADD COLUMN ${colonna} ${definizione}`);
    } catch (errore) {
      // In compilazione Next apre il database da piu' processi insieme: due
      // possono vedere la colonna mancante e provare ad aggiungerla entrambi.
      // Il secondo trova che c'e' gia', ed e' esattamente quello che voleva.
      if (!String(errore).includes("duplicate column name")) throw errore;
    }
  }
}

// In sviluppo Next ricarica i moduli a ogni modifica: senza il globale
// apriremmo una connessione nuova a ogni hot reload.
export const db: Database.Database = global.__crmDb ?? connect();
if (process.env.NODE_ENV !== "production") global.__crmDb = db;

/** Esegue una SELECT e restituisce tutte le righe. */
export function all<T>(sql: string, params: unknown[] = []): T[] {
  return db.prepare(sql).all(...(params as never[])) as T[];
}

/** Esegue una SELECT e restituisce la prima riga (o undefined). */
export function one<T>(sql: string, params: unknown[] = []): T | undefined {
  return db.prepare(sql).get(...(params as never[])) as T | undefined;
}

/** Esegue INSERT/UPDATE/DELETE. */
export function run(sql: string, params: unknown[] = []) {
  return db.prepare(sql).run(...(params as never[]));
}

/** Conta le righe di una query di conteggio. */
export function count(sql: string, params: unknown[] = []): number {
  const row = one<{ n: number }>(sql, params);
  return row?.n ?? 0;
}

/** Registra un'azione nel registro accessi (GDPR). */
export function audit(
  userId: number | null,
  action: string,
  entity: string,
  entityId?: number | null,
  detail?: string,
) {
  run(
    `INSERT INTO audit_log (user_id, action, entity, entity_id, detail)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, action, entity, entityId ?? null, detail ?? null],
  );
}
