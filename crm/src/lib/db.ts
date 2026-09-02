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
  assegnaTitolareMancante(database);
  allineaStatiImmobili(database);
  ripulisciEsterniVuoti(database);
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
  // Quando e' stata cambiata la password l'ultima volta, in millisecondi.
  //
  // Serve a far cadere le sessioni aperte prima del cambio. Senza, cambiare la
  // password non caccerebbe fuori nessuno: chi era gia' entrato — compreso chi
  // conosceva la vecchia password — resterebbe dentro per due settimane, e il
  // cambio sarebbe solo una formalita'.
  //
  // In millisecondi e non in testo di proposito: una data scritta
  // "2026-08-05 07:45:00" viene letta come ora locale in JavaScript e come ora
  // di Greenwich da SQLite, e due ore di differenza qui vorrebbero dire
  // sessioni che cadono quando non devono.
  { tabella: "users", colonna: "password_changed_at", definizione: "INTEGER" },
  // Per cosa il cliente ci ha contattato la prima volta, e per quale immobile:
  // senza queste due colonne l'unica cosa che restava del primo contatto era
  // la provenienza generica ("Sito web", "Passaparola"...), non il motivo.
  { tabella: "clients", colonna: "contact_reason", definizione: "TEXT" },
  { tabella: "clients", colonna: "contact_property_id", definizione: "INTEGER REFERENCES properties(id) ON DELETE SET NULL" },
  // Le aree di ricerca di una richiesta: piu' comuni, ognuno con le sue zone.
  //
  // Prima erano un comune solo (`city`) e un elenco piatto di zone (`zones`)
  // che non sapevano a quale comune appartenessero: chi cercava "a Lecce zona
  // Centro storico oppure a Porto Cesareo zona Torre Lapillo" non aveva modo
  // di dirlo, e le due zone finivano in un unico mucchio.
  //
  // `areas` e' json e ha la verita'; `city` e `zones` restano scritte come sua
  // proiezione, in un punto solo (saveRequirement), perche' ricerca e filtri
  // dell'elenco lavorano in SQL e su json non ci arriverebbero.
  { tabella: "requirements", colonna: "areas", definizione: "TEXT NOT NULL DEFAULT ''" },
  // Lo stato in cui il cliente accetta l'immobile, in csv: quasi sempre piu'
  // d'uno ("ottimo o ristrutturato"), quindi non un valore solo.
  { tabella: "requirements", colonna: "conditions", definizione: "TEXT NOT NULL DEFAULT ''" },
  // Il video dell'immobile su YouTube.
  //
  // Il gestionale non ci parla e non ci va a guardare: tiene il collegamento
  // per sapere quali immobili un video ce l'hanno, e per farlo uscire
  // nell'esportazione. A usarlo e' l'applicazione che gestisce il canale, che
  // altrimenti dovrebbe accoppiare video e immobili confrontando i titoli.
  { tabella: "properties", colonna: "video_url", definizione: "TEXT" },
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

/**
 * Ogni cliente e ogni immobile devono avere un responsabile.
 *
 * Da quando ognuno vede solo la propria roba, una scheda senza responsabile non
 * sarebbe "di tutti": sarebbe di nessuno, e sparirebbe dagli elenchi di
 * chiunque. Il modo per accorgersene sarebbe non trovare piu' un cliente che
 * c'e' sempre stato.
 *
 * Le schede rimaste scoperte vanno quindi al titolare — che e' anche la
 * verita' storica: prima che ci fossero piu' persone in archivio, erano sue.
 * Gira a ogni avvio, ma tocca solo le righe scoperte: quando non ce ne sono
 * piu', non fa niente.
 */
/**
 * Porta gli immobili vecchi sul vocabolario nuovo degli stati.
 *
 * Il 28 agosto 2026 gli stati sono passati da quattro a sette, perche' la
 * richiesta di un cliente ora dice anche in che stato lo accetta e le due
 * liste devono essere la stessa: se l'immobile puo' essere solo "Buono stato"
 * e il cliente cerca "Buono", non si incontrano mai.
 *
 * L'unica voce che cambia nome e' quella: le altre tre erano gia' scritte
 * uguali. Le tre voci nuove (Ottimo, Discreto, Da rivedere) non tolgono niente
 * a nessuno, si aggiungono e basta.
 *
 * Gira a ogni avvio ma tocca solo le righe rimaste indietro: quando non ce ne
 * sono piu', il comando non trova niente da fare e non fa niente.
 */
function allineaStatiImmobili(database: Database.Database) {
  database
    .prepare("UPDATE properties SET condition = 'Buono' WHERE condition = 'Buono stato'")
    .run();
}

/**
 * Toglie il vecchio «Nessuno» dal campo esterno.
 *
 * Finche' l'esterno era una scelta sola, «Nessuno» era un valore come gli
 * altri. Da quando se ne spuntano piu' d'uno, l'assenza di esterno si dice non
 * spuntando niente: lasciare la parola scritta vorrebbe dire mostrarla in
 * scheda accanto a caselle tutte vuote.
 *
 * Gira a ogni avvio e tocca solo le righe rimaste indietro.
 */
function ripulisciEsterniVuoti(database: Database.Database) {
  database
    .prepare("UPDATE properties SET outdoor = NULL WHERE lower(trim(outdoor)) = 'nessuno'")
    .run();
}

function assegnaTitolareMancante(database: Database.Database) {
  const riferimento = database
    .prepare(
      `SELECT id FROM users
        WHERE active = 1
        ORDER BY (role = 'titolare') DESC, id
        LIMIT 1`,
    )
    .get() as { id: number } | undefined;

  // Al primissimo avvio non c'e' ancora nessun utente: non c'e' neanche niente
  // da assegnare, e al prossimo giro ci sara'.
  if (!riferimento) return;

  database.prepare(`UPDATE clients    SET owner_id = ? WHERE owner_id IS NULL`).run(riferimento.id);
  database.prepare(`UPDATE properties SET agent_id = ? WHERE agent_id IS NULL`).run(riferimento.id);

  // Un'attivita' senza persona, senza cliente e senza immobile non avrebbe
  // nessun appiglio per farsi trovare da qualcuno.
  database
    .prepare(
      `UPDATE activities SET user_id = ?
        WHERE user_id IS NULL AND client_id IS NULL AND property_id IS NULL`,
    )
    .run(riferimento.id);
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
