#!/usr/bin/env node
/**
 * Avviso per email 30 minuti prima di ogni appuntamento.
 *
 * Lo fa girare il cron ogni 5 minuti. Guarda gli appuntamenti non ancora
 * svolti che cadono entro la mezz'ora, manda un'email a chi ce l'ha in agenda
 * e segna che l'avviso e' partito: senza quella traccia ripartirebbe a ogni
 * giro, e in mezz'ora arriverebbero sei email per lo stesso appuntamento.
 *
 *   node scripts/promemoria.mjs          manda gli avvisi
 *   node scripts/promemoria.mjs --prova  mostra cosa manderebbe, senza mandare
 *
 * Senza la configurazione della posta (SMTP_HOST e compagnia) esce dicendolo e
 * non fa niente: il calendario funziona lo stesso.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import nodemailer from "nodemailer";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dbPath = process.env.CRM_DB_PATH ?? path.join(root, "data", "mondo.db");
const base = (process.env.CRM_BASE_URL ?? "").replace(/\/$/, "");
const prova = process.argv.includes("--prova");

/** Con quanto anticipo, in minuti. */
const PREAVVISO = Number(process.env.CRM_PREAVVISO_MINUTI ?? 30);

const posta = {
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
};

if (!posta.host || !posta.user || !posta.pass) {
  console.log(
    "Posta non configurata (mancano SMTP_HOST, SMTP_USER o SMTP_PASS): nessun avviso inviato.",
  );
  process.exit(0);
}

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

// La colonna puo' mancare su un archivio creato prima di questa funzione: il
// programma la aggiunge all'avvio, ma il cron puo' girare per primo.
const colonne = db.prepare("PRAGMA table_info(activities)").all();
if (!colonne.some((campo) => campo.name === "reminded_at")) {
  db.exec("ALTER TABLE activities ADD COLUMN reminded_at TEXT");
}

/**
 * L'orario di un appuntamento e' quello scritto guardando l'orologio. Il cron
 * gira con TZ=Europe/Rome (lo imposta installa.sh), quindi interpretarlo come
 * ora locale e' corretto; se il fuso non fosse impostato, l'avviso arriverebbe
 * sballato di un paio d'ore.
 */
function quando(valore) {
  const pezzi = String(valore).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!pezzi) return null;
  const [, anno, mese, giorno, ore, minuti] = pezzi.map(Number);
  return new Date(anno, mese - 1, giorno, ore, minuti, 0, 0);
}

const adesso = Date.now();
const candidati = db
  .prepare(
    // Il nome del cliente, il suo numero e l'immobile escono solo se quella
    // scheda e' di chi riceve l'avviso: ognuno vede soltanto la propria roba,
    // e un'email e' un posto da cui i dati escono per sempre. Se la scheda e'
    // di un collega, l'avviso arriva lo stesso ma con il solo titolo e l'ora.
    //
    // Il destinatario si ricava anche dal cliente o dall'immobile, non solo da
    // chi ha in carico l'attivita': cosi' un appuntamento rimasto senza
    // assegnatario non smette di avvisare qualcuno, in silenzio, per sempre.
    `SELECT a.id, a.type, a.title, a.notes, a.due_at, a.client_id, a.property_id,
            CASE WHEN c.owner_id = u.id
                 THEN TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,''))
                 END AS cliente,
            CASE WHEN c.owner_id = u.id THEN COALESCE(c.mobile, c.phone) END AS telefono,
            CASE WHEN p.agent_id = u.id THEN p.title END AS immobile,
            CASE WHEN p.agent_id = u.id
                 THEN TRIM(COALESCE(p.address,'') || ' ' || COALESCE(p.city,''))
                 END AS indirizzo,
            u.name AS agente, u.email AS email
       FROM activities a
       LEFT JOIN clients    c ON c.id = a.client_id
       LEFT JOIN properties p ON p.id = a.property_id
       JOIN users u ON u.id = COALESCE(a.user_id, c.owner_id, p.agent_id)
      WHERE a.done_at IS NULL
        AND a.due_at IS NOT NULL
        AND a.reminded_at IS NULL
        AND u.active = 1
        AND u.email IS NOT NULL AND u.email != ''
        AND date(a.due_at) BETWEEN date('now','localtime','-1 day') AND date('now','localtime','+2 days')`,
  )
  .all();

// Il filtro fine si fa qui, dove si sa interpretare l'orario da orologio: in
// SQL servirebbe fidarsi del fuso del database.
const daAvvisare = candidati.filter((riga) => {
  const inizio = quando(riga.due_at);
  if (!inizio) return false;
  const minutiMancanti = (inizio.getTime() - adesso) / 60000;
  // Fra adesso e il preavviso. Il margine negativo copre il caso in cui il
  // cron sia saltato un giro: meglio un avviso in ritardo di cinque minuti che
  // nessun avviso.
  return minutiMancanti <= PREAVVISO && minutiMancanti > -10;
});

if (daAvvisare.length === 0) {
  console.log("Nessun appuntamento da avvisare.");
  process.exit(0);
}

const trasporto = nodemailer.createTransport({
  host: posta.host,
  port: posta.port,
  secure: posta.port === 465,
  auth: { user: posta.user, pass: posta.pass },
});

const segna = db.prepare("UPDATE activities SET reminded_at = datetime('now') WHERE id = ?");
let inviati = 0;

for (const riga of daAvvisare) {
  const inizio = quando(riga.due_at);
  const ora = inizio.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

  const righe = [
    `${riga.title || "Appuntamento"} alle ${ora}.`,
    "",
    riga.cliente ? `Cliente: ${riga.cliente}${riga.telefono ? ` · ${riga.telefono}` : ""}` : "",
    riga.immobile ? `Immobile: ${riga.immobile}` : "",
    riga.indirizzo?.trim() ? `Indirizzo: ${riga.indirizzo.trim()}` : "",
    riga.notes ? `\n${riga.notes}` : "",
    // Il collegamento si mette solo se la scheda si puo' aprire davvero: un
    // indirizzo verso la scheda di un collega darebbe "non trovata".
    base && riga.property_id && riga.immobile ? `\n${base}/immobili/${riga.property_id}` : "",
    base && riga.client_id && riga.cliente && !(riga.property_id && riga.immobile)
      ? `\n${base}/clienti/${riga.client_id}`
      : "",
  ].filter(Boolean);

  // I minuti veri, non il preavviso: il cron gira ogni cinque minuti, quindi
  // "fra 30 minuti" sarebbe quasi sempre una bugia.
  const mancano = Math.round((inizio.getTime() - adesso) / 60000);
  const anticipo =
    mancano <= 0 ? "Adesso" : mancano === 1 ? "Fra un minuto" : `Fra ${mancano} minuti`;
  const oggetto = `${anticipo}: ${riga.title || "appuntamento"}${
    riga.cliente ? ` · ${riga.cliente}` : ""
  }`;

  if (prova) {
    console.log(`→ ${riga.email}: ${oggetto}`);
    continue;
  }

  try {
    await trasporto.sendMail({
      from: posta.from,
      to: riga.email,
      subject: oggetto,
      text: righe.join("\n"),
    });
    segna.run(riga.id);
    inviati++;
  } catch (errore) {
    // Un indirizzo rifiutato non deve bloccare gli altri avvisi. Non si segna
    // come inviato: al giro dopo ci riprova.
    console.error(`Avviso non inviato per l'attività ${riga.id}: ${errore.message}`);
  }
}

console.log(prova ? `${daAvvisare.length} avvisi da mandare.` : `${inviati} avvisi inviati.`);
