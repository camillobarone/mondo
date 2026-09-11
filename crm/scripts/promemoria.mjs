#!/usr/bin/env node
/**
 * Avviso 30 minuti prima di ogni appuntamento, per due strade.
 *
 * Lo fa girare il cron ogni 5 minuti. Guarda gli appuntamenti non ancora
 * svolti che cadono entro la mezz'ora e avvisa chi ce l'ha in agenda:
 *
 *   - **sul telefono** (Web Push), per chi ha acceso gli avvisi da
 *     Agenda > Calendario e avvisi. Non ha bisogno di niente configurato;
 *   - **per email**, se il server sa spedire (SMTP_HOST e compagnia).
 *
 * Le due strade sono **indipendenti** e hanno ognuna la propria traccia
 * (`pushed_at` e `reminded_at`): senza, ripartirebbero a ogni giro — in
 * mezz'ora sei avvisi per lo stesso appuntamento — e accendere la posta
 * spegnerebbe in silenzio le notifiche.
 *
 *   node scripts/promemoria.mjs          manda gli avvisi
 *   node scripts/promemoria.mjs --prova  mostra cosa manderebbe, senza mandare
 *
 * Se non c'e' ne' la posta ne' un telefono iscritto non fa niente e lo dice: il
 * calendario funziona lo stesso.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import nodemailer from "nodemailer";
// Il protocollo sta in un file .ts perche' lo usa anche il programma; Node lo
// legge cosi' com'e', come gia' fa seed.mjs con schema.ts.
import { manda } from "../src/lib/push.ts";

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

// La posta puo' non esserci: le notifiche sul telefono partono lo stesso. Era
// un'uscita anticipata, e teneva ferme anche loro.
const postaPronta = Boolean(posta.host && posta.user && posta.pass);

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

// La colonna puo' mancare su un archivio creato prima di questa funzione: il
// programma la aggiunge all'avvio, ma il cron puo' girare per primo.
const colonne = db.prepare("PRAGMA table_info(activities)").all();
if (!colonne.some((campo) => campo.name === "reminded_at")) {
  db.exec("ALTER TABLE activities ADD COLUMN reminded_at TEXT");
}
if (!colonne.some((campo) => campo.name === "pushed_at")) {
  db.exec("ALTER TABLE activities ADD COLUMN pushed_at TEXT");
}
// Stessa ragione: il cron puo' girare prima che il programma sia ripartito e
// abbia creato la tabella.
db.exec(`CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
  device TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), last_ok_at TEXT)`);
db.exec(`CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY, value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')))`);

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
            u.name AS agente, u.email AS email, u.id AS utente,
            a.reminded_at, a.pushed_at
       FROM activities a
       LEFT JOIN clients    c ON c.id = a.client_id
       LEFT JOIN properties p ON p.id = a.property_id
       JOIN users u ON u.id = COALESCE(a.user_id, c.owner_id, p.agent_id)
      WHERE a.done_at IS NULL
        AND a.due_at IS NOT NULL
        AND (a.reminded_at IS NULL OR a.pushed_at IS NULL)
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

const trasporto = postaPronta
  ? nodemailer.createTransport({
      host: posta.host,
      port: posta.port,
      secure: posta.port === 465,
      auth: { user: posta.user, pass: posta.pass },
    })
  : null;

const segnaEmail = db.prepare("UPDATE activities SET reminded_at = datetime('now') WHERE id = ?");
const segnaPush = db.prepare("UPDATE activities SET pushed_at = datetime('now') WHERE id = ?");
const telefoniDi = db.prepare(
  "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?",
);
const segnaConsegna = db.prepare(
  "UPDATE push_subscriptions SET last_ok_at = datetime('now') WHERE endpoint = ?",
);
const buttaTelefono = db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?");

// Le chiavi si leggono dalla stessa tabella che usa il programma. Qui NON si
// generano: questo script gira come processo di sistema, e due processi che si
// svegliassero insieme a tabella vuota ne creerebbero due coppie diverse —
// meta' dei telefoni resterebbe legata a quella persa.
const chiaviSalvate = Object.fromEntries(
  db.prepare("SELECT key, value FROM settings WHERE key LIKE 'vapid_%'").all()
    .map((r) => [r.key, r.value]),
);
const chiavi =
  process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
    ? { pubblica: process.env.VAPID_PUBLIC_KEY, privata: process.env.VAPID_PRIVATE_KEY }
    : chiaviSalvate.vapid_public && chiaviSalvate.vapid_private
      ? { pubblica: chiaviSalvate.vapid_public, privata: chiaviSalvate.vapid_private }
      : null;

// Se ci sono telefoni iscritti ma non le chiavi, qualcosa e' andato storto
// davvero (qualcuno ha svuotato `settings`): dirlo, perche' altrimenti gli
// avvisi semplicemente non partono e nessuno sa perche'.
if (!chiavi) {
  const quanti = db.prepare("SELECT COUNT(*) AS n FROM push_subscriptions").get().n;
  if (quanti > 0) {
    console.error(
      `${quanti} telefoni sono iscritti agli avvisi ma le chiavi VAPID non ci sono: ` +
        "apri una volta Agenda > Calendario e avvisi nel gestionale, che le rigenera.",
    );
  }
}

const contatto = base || "https://gestionale.mondoimmobiliarelecce.it";
let inviati = 0;
let notificati = 0;

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

  const telefoni = chiavi && !riga.pushed_at ? telefoniDi.all(riga.utente) : [];

  if (prova) {
    const strade = [
      postaPronta && !riga.reminded_at ? `email a ${riga.email}` : "",
      telefoni.length ? `${telefoni.length} telefono/i` : "",
    ].filter(Boolean);
    console.log(`→ ${strade.join(" + ") || "nessuna strada disponibile"}: ${oggetto}`);
    continue;
  }

  /* --- la strada del telefono ------------------------------------------- */

  if (telefoni.length > 0) {
    // Sul telefono il corpo e' corto di proposito: la notifica ne mostra due
    // righe e taglia il resto, quindi le note e il collegamento restano
    // all'email. Quello che serve a chi la legge di corsa e' l'ora, con chi, e
    // dove.
    const corpo = [
      `Alle ${ora}`,
      riga.cliente || null,
      riga.indirizzo?.trim() || riga.immobile || null,
    ]
      .filter(Boolean)
      .join(" · ");

    const messaggio = JSON.stringify({
      titolo: `${anticipo}: ${riga.title || "appuntamento"}`,
      corpo,
      // Si apre l'agenda e non la scheda: la scheda di un collega darebbe
      // "non trovata", e chi tocca un avviso vuole sapere dove deve andare.
      url: "/agenda",
      tag: `attivita-${riga.id}`,
    });

    let almenoUno = false;
    for (const telefono of telefoni) {
      const esito = await manda(telefono, messaggio, chiavi, contatto);
      if (esito.ok) {
        almenoUno = true;
        segnaConsegna.run(telefono.endpoint);
      } else if (esito.daButtare) {
        // Quel telefono non esiste piu'. Si cancella subito, altrimenti ci si
        // riprova a ogni appuntamento per sempre.
        buttaTelefono.run(telefono.endpoint);
        console.error(`Telefono non piu' iscritto, tolto: ${esito.motivo}`);
      } else {
        console.error(`Avviso non consegnato (attività ${riga.id}): ${esito.motivo}`);
      }
    }
    // Si segna solo se almeno un telefono l'ha ricevuto: se sono falliti tutti,
    // al giro dopo ci si riprova.
    if (almenoUno) {
      segnaPush.run(riga.id);
      notificati++;
    }
  }

  /* --- la strada dell'email --------------------------------------------- */

  if (!trasporto || riga.reminded_at) continue;

  try {
    await trasporto.sendMail({
      from: posta.from,
      to: riga.email,
      subject: oggetto,
      text: righe.join("\n"),
      // Come in src/lib/posta.ts: il modo predefinito spezza le righe oltre i
      // 76 caratteri, e qui dentro ci sono indirizzi di schede e note lunghe.
      textEncoding: "base64",
    });
    segnaEmail.run(riga.id);
    inviati++;
  } catch (errore) {
    // Un indirizzo rifiutato non deve bloccare gli altri avvisi. Non si segna
    // come inviato: al giro dopo ci riprova.
    console.error(`Avviso non inviato per l'attività ${riga.id}: ${errore.message}`);
  }
}

console.log(
  prova
    ? `${daAvvisare.length} avvisi da mandare.`
    : `${notificati} avvisi sul telefono, ${inviati} per email.`,
);
