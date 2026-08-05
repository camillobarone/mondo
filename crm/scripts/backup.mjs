/**
 * Copia di sicurezza dell'archivio.
 *
 *   npm run backup
 *
 * Il database viene copiato con l'API di backup di SQLite: la copia è coerente
 * anche se qualcuno sta lavorando sul programma in quel momento. Le foto degli
 * immobili vengono rispecchiate a parte — sono file che non cambiano mai una
 * volta scritti, quindi si copiano solo quelle nuove.
 *
 * Le copie del database più vecchie di 60 giorni vengono eliminate. Le foto no:
 * cancellarle vorrebbe dire perdere per sempre l'unica copia di un'immagine
 * tolta per sbaglio dalla scheda.
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

// ------------------------------------------------------------------- foto
const photoDir = path.join(path.dirname(dbPath), "foto");
const photoBackup = path.join(backupDir, "foto");

// La cartella si crea sempre, anche quando non c'e' ancora nessuna foto.
// Costa niente ed evita che il comando settimanale di copia sul PC
//     scp -r root@IP:/opt/mondo-crm/backup/foto ...
// finisca con "No such file or directory" finche' nessuno ha caricato la prima
// immagine: un errore che sembra un guasto e non lo e'.
fs.mkdirSync(photoBackup, { recursive: true });

if (fs.existsSync(photoDir)) {
  let copied = 0;
  for (const property of fs.readdirSync(photoDir)) {
    const from = path.join(photoDir, property);
    if (!fs.statSync(from).isDirectory()) continue;

    const to = path.join(photoBackup, property);
    fs.mkdirSync(to, { recursive: true });
    for (const file of fs.readdirSync(from)) {
      const target = path.join(to, file);
      if (fs.existsSync(target)) continue;   // gia' copiata in una notte passata
      fs.copyFileSync(path.join(from, file), target);
      copied++;
    }
  }
  console.log(copied ? `Copiate ${copied} nuove foto.` : "Nessuna foto nuova da copiare.");
}
