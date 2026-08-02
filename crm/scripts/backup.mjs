/**
 * Copia di sicurezza del database.
 *
 *   npm run backup
 *
 * Usa l'API di backup di SQLite: la copia è coerente anche se qualcuno sta
 * lavorando sul programma in quel momento. I file finiscono in backup/ e i più
 * vecchi di 60 giorni vengono eliminati.
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = process.env.CRM_DB_PATH ?? path.join(root, "data", "mondo.db");
const backupDir = process.env.CRM_BACKUP_DIR ?? path.join(root, "backup");

if (!fs.existsSync(dbPath)) {
  console.error(`Database non trovato: ${dbPath}`);
  process.exit(1);
}

fs.mkdirSync(backupDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const target = path.join(backupDir, `mondo-${stamp}.db`);

const db = new Database(dbPath, { readonly: true });
await db.backup(target);
db.close();

const size = (fs.statSync(target).size / 1024 / 1024).toFixed(2);
console.log(`Backup creato: ${target} (${size} MB)`);

// Pulizia delle copie più vecchie di 60 giorni.
const limit = Date.now() - 60 * 864e5;
let removed = 0;
for (const file of fs.readdirSync(backupDir)) {
  if (!file.startsWith("mondo-") || !file.endsWith(".db")) continue;
  const full = path.join(backupDir, file);
  if (fs.statSync(full).mtimeMs < limit) {
    fs.unlinkSync(full);
    removed++;
  }
}
if (removed) console.log(`Rimosse ${removed} copie più vecchie di 60 giorni.`);
