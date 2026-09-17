#!/usr/bin/env node
/**
 * Un CSV con tutte le schede: dati personali, richieste, e per ogni persona
 * gli immobili che ha venduto, comprato, proposto o soltanto visitato.
 *
 *   cd /opt/mondo-crm && node scripts/esporta-tutto.mjs
 *   node scripts/esporta-tutto.mjs /dove/voglio/il/file.csv
 *
 * Legge e basta: apre il database in sola lettura e non scrive niente dentro.
 *
 * Perche' sta qui e non nel gestionale. Il pulsante "Scarica l'archivio" e'
 * stato tolto da Utenti apposta: da quando ognuno vede solo le proprie schede,
 * un file con dentro tutto l'archivio sarebbe la separazione aggirata con un
 * clic. Questa strada resta aperta perche' chi la percorre e' gia' entrato nel
 * server, dove l'archivio sta tutto insieme comunque — non aggiunge un potere
 * che non avesse gia'.
 *
 * Il file che ne esce pesa: codici fiscali, date di nascita, estremi dei
 * documenti dell'antiriciclaggio. Trattarlo come si tratta un archivio, non
 * come un foglio qualsiasi.
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const PERCORSO_DB =
  process.env.CRM_DB_PATH ?? path.join(process.cwd(), "data", "mondo.db");

if (!fs.existsSync(PERCORSO_DB)) {
  console.error(`Database non trovato: ${PERCORSO_DB}`);
  process.exit(1);
}

const oggi = new Date().toISOString().slice(0, 10);
const destinazione =
  process.argv[2] ??
  path.join(
    process.env.CRM_BACKUP_DIR ?? path.join(process.cwd(), "backup"),
    `clienti-completo-${oggi}.csv`,
  );

// ------------------------------------------------------------------ formato

/**
 * Excel in italiano si aspetta il punto e virgola, e senza il segno iniziale
 * (BOM) legge le lettere accentate come geroglifici. Stesse regole di
 * buildCsv() in src/lib/csv.ts: se qui cambiassero, i due file uscirebbero
 * diversi dallo stesso programma.
 */
function creaCsv(intestazioni, righe) {
  const cella = (valore) => {
    const testo = valore === null || valore === undefined ? "" : String(valore);
    return /[";\n]/.test(testo) ? `"${testo.replace(/"/g, '""')}"` : testo;
  };
  const linee = [intestazioni.map(cella).join(";")];
  for (const riga of righe) linee.push(riga.map(cella).join(";"));
  return "﻿" + linee.join("\r\n");
}

/** 180000 -> "180.000 €". Scritto a mano per non dipendere da ICU. */
function euro(numero) {
  if (numero === null || numero === undefined || numero === "") return "";
  return String(numero).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " €";
}

/** "2026-03-15" o "2026-03-15 10:00" -> "15/03/2026". */
function data(iso) {
  if (!iso) return "";
  const [anno, mese, giorno] = String(iso).slice(0, 10).split("-");
  return giorno ? `${giorno}/${mese}/${anno}` : String(iso);
}

/** Le voci multiple in una cella sola: "A | B | C". */
const elenco = (voci) => voci.filter(Boolean).join(" | ");

/** "in_vendita" -> "in vendita": nel foglio lo legge una persona. */
const leggibile = (stato) => String(stato ?? "").replace(/_/g, " ");

// ------------------------------------------------------------------ lettura

const db = new Database(PERCORSO_DB, { readonly: true });

const clienti = db
  .prepare(
    `SELECT c.*, u.name AS seguito_da
       FROM clients c
       LEFT JOIN users u ON u.id = c.owner_id
      WHERE c.deleted_at IS NULL
      ORDER BY c.last_name COLLATE NOCASE, c.first_name COLLATE NOCASE`,
  )
  .all();

const scartati = db
  .prepare(`SELECT COUNT(*) AS n FROM clients WHERE deleted_at IS NOT NULL`)
  .get().n;

// Gli immobili si tengono a portata di mano per numero: le righe qui sotto li
// ripescano una volta per ogni visita, proposta o mandato.
const immobili = new Map();
for (const p of db.prepare(`SELECT * FROM properties WHERE deleted_at IS NULL`).all()) {
  immobili.set(p.id, p);
}

function descrivi(idImmobile) {
  const p = immobili.get(idImmobile);
  if (!p) return "";
  const dove = [p.address, p.city].filter(Boolean).join(", ");
  const nome = p.title || p.kind || "immobile";
  return [p.ref, dove ? `${nome} — ${dove}` : nome].filter(Boolean).join(" ");
}

/** Raccoglie le righe di una tabella sotto il numero del cliente. */
function perCliente(sql) {
  const mappa = new Map();
  for (const riga of db.prepare(sql).all()) {
    if (!riga.client_id) continue;
    if (!mappa.has(riga.client_id)) mappa.set(riga.client_id, []);
    mappa.get(riga.client_id).push(riga);
  }
  return mappa;
}

const visite = perCliente(
  `SELECT * FROM activities
    WHERE type = 'visita' AND property_id IS NOT NULL
    ORDER BY COALESCE(done_at, due_at, created_at)`,
);
const proposte = perCliente(`SELECT * FROM offers ORDER BY offered_at`);
const richieste = perCliente(`SELECT * FROM requirements ORDER BY created_at`);

// I mandati: gli immobili intestati a ciascun proprietario.
const mandati = new Map();
for (const p of immobili.values()) {
  if (!p.owner_client_id) continue;
  if (!mandati.has(p.owner_client_id)) mandati.set(p.owner_client_id, []);
  mandati.get(p.owner_client_id).push(p);
}

// ------------------------------------------------------------------ colonne

const INTESTAZIONI = [
  "N.", "Cognome", "Nome", "Ragione sociale", "Ruoli", "Stato",
  "Cellulare", "Telefono", "Email", "Indirizzo", "Comune",
  "Codice fiscale", "Data di nascita",
  "Provenienza", "Motivo del contatto", "Immobile del primo contatto",
  "Seguito da", "Etichette",
  "Consenso privacy", "Data consenso", "Ambito consenso",
  "Antiriciclaggio: documento", "Numero documento", "Scadenza documento",
  "Antiriciclaggio: verificato il",
  "Ultimo contatto", "Scheda creata il", "Scheda aggiornata il",
  "Richieste",
  "Immobili di cui è proprietario", "Immobili venduti come proprietario",
  "Immobili acquistati", "Proposte presentate",
  "Immobili visionati", "Numero di visite", "Ultima visita",
  "Note",
];

const righe = clienti.map((c) => {
  const suoi = mandati.get(c.id) ?? [];
  const sueVisite = visite.get(c.id) ?? [];
  const sueProposte = proposte.get(c.id) ?? [];

  const venduti = suoi.filter((p) => p.status === "venduto");
  // Comprato vuol dire proposta accettata: il rogito, quando c'e', sta
  // sull'immobile e si aggiunge solo se e' stato registrato.
  const acquistati = sueProposte.filter((o) => o.status === "accettata");

  const dataVisita = (v) => data(v.done_at ?? v.due_at ?? v.created_at);
  const ultima = sueVisite.length ? dataVisita(sueVisite[sueVisite.length - 1]) : "";

  return [
    c.id, c.last_name, c.first_name, c.company, c.roles, c.status,
    c.mobile, c.phone, c.email, c.address, c.city,
    c.tax_code, data(c.birth_date),
    c.source, c.contact_reason, descrivi(c.contact_property_id),
    c.seguito_da, c.tags,
    c.privacy_consent ? "Sì" : "No", data(c.privacy_date), c.privacy_scope,
    c.aml_doc_type, c.aml_doc_number, data(c.aml_doc_expiry),
    data(c.aml_checked_at),
    data(c.last_contact_at), data(c.created_at), data(c.updated_at),

    elenco(
      (richieste.get(c.id) ?? []).map((r) => {
        const dove = [r.city, r.zones].filter(Boolean).join(" — ");
        // Con un solo estremo "100.000 € / " non si capisce da che parte sta:
        // meglio dirlo a parole.
        const budget =
          r.budget_min && r.budget_max
            ? `${euro(r.budget_min)} / ${euro(r.budget_max)}`
            : r.budget_max
              ? `fino a ${euro(r.budget_max)}`
              : r.budget_min
                ? `da ${euro(r.budget_min)}`
                : "";
        return [r.contract, r.kind, dove, budget, `(${leggibile(r.status)})`]
          .filter(Boolean)
          .join(", ");
      }),
    ),

    elenco(
      suoi.map((p) => {
        const prezzo = p.price ? `, ${euro(p.price)}` : "";
        return `${descrivi(p.id)} (${leggibile(p.status)}${prezzo})`;
      }),
    ),
    elenco(
      venduti.map((p) => {
        const quando = p.deed_date ? `rogito ${data(p.deed_date)}` : "venduto";
        const quanto = p.sold_price ? `, ${euro(p.sold_price)}` : "";
        return `${descrivi(p.id)} (${quando}${quanto})`;
      }),
    ),
    elenco(
      acquistati.map((o) => {
        const p = immobili.get(o.property_id);
        const rogito = p?.deed_date ? `, rogito ${data(p.deed_date)}` : "";
        return `${descrivi(o.property_id)} (${euro(o.amount)}${rogito})`;
      }),
    ),
    elenco(
      sueProposte.map(
        (o) => `${descrivi(o.property_id)} (${euro(o.amount)}, ${leggibile(o.status)}, ${data(o.offered_at)})`,
      ),
    ),
    elenco(
      sueVisite.map((v) => {
        const interesse = v.interest ? `, interesse ${v.interest}` : "";
        const esito = v.outcome ? `, ${v.outcome}` : "";
        return `${descrivi(v.property_id)} (${dataVisita(v)}${interesse}${esito})`;
      }),
    ),
    sueVisite.length || "",
    ultima,

    c.notes,
  ];
});

// ------------------------------------------------------------------ scrittura

fs.mkdirSync(path.dirname(destinazione), { recursive: true });
fs.writeFileSync(destinazione, creaCsv(INTESTAZIONI, righe));
db.close();

const peso = (fs.statSync(destinazione).size / 1024).toFixed(0);
const conVisite = righe.filter((r) => r[34]).length;
const conMandato = clienti.filter((c) => mandati.has(c.id)).length;

console.log(`Esportate ${clienti.length} schede in ${destinazione} (${peso} KB).`);
console.log(`  di cui con almeno una visita: ${conVisite}`);
console.log(`  di cui proprietari di un immobile: ${conMandato}`);
if (scartati) {
  console.log(
    scartati === 1 ? "Esclusa 1 scheda cestinata." : `Escluse ${scartati} schede cestinate.`,
  );
}
