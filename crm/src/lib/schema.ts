// Schema del database. Unica fonte di verita': applicato all'avvio da db.ts.
// Ogni istruzione e' idempotente, quindi puo' essere rieseguito senza danni.

export const SCHEMA = String.raw`
-- Schema Mondo Immobiliare CRM
-- Applicato automaticamente all'avvio. Ogni istruzione e' idempotente.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------- utenti
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE,
  name          TEXT    NOT NULL,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'agente',   -- titolare | agente
  office        TEXT    NOT NULL DEFAULT 'Lecce',    -- Lecce | Porto Cesareo
  active        INTEGER NOT NULL DEFAULT 1,
  calendar_token TEXT,                            -- chiave del feed calendario
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- --------------------------------------------------- recupero password
-- Un biglietto usa e getta per rientrare quando la password si e' persa.
--
-- Del biglietto si conserva solo l'impronta, mai il biglietto stesso: cosi'
-- nemmeno chi legge l'archivio puo' usarlo per entrare al posto di qualcuno.
-- Vale un'ora e una volta sola.
CREATE TABLE IF NOT EXISTS password_resets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT    NOT NULL,
  expires_at  INTEGER NOT NULL,          -- millisecondi, per non litigare coi fusi
  used_at     TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_password_resets_hash ON password_resets(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);

-- ---------------------------------------------------------------- clienti
CREATE TABLE IF NOT EXISTS clients (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name      TEXT    NOT NULL DEFAULT '',
  last_name       TEXT    NOT NULL DEFAULT '',
  company         TEXT,
  phone           TEXT,
  mobile          TEXT,
  email           TEXT,
  address         TEXT,
  city            TEXT,
  tax_code        TEXT,
  birth_date      TEXT,
  roles           TEXT    NOT NULL DEFAULT '',       -- csv: venditore,acquirente,locatore,conduttore,segnalatore,collega
  source          TEXT,                              -- provenienza del contatto (dove ci ha trovato)
  contact_reason  TEXT,                              -- per cosa ci ha contattato inizialmente
  contact_property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL, -- l'immobile per cui ci ha contattato
  status          TEXT    NOT NULL DEFAULT 'attivo', -- attivo|in_trattativa|dormiente|chiuso|non_interessato
  owner_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  tags            TEXT    NOT NULL DEFAULT '',
  notes           TEXT,
  privacy_consent INTEGER NOT NULL DEFAULT 0,
  privacy_date    TEXT,
  privacy_scope   TEXT,                              -- a cosa ha acconsentito
  aml_doc_type    TEXT,                              -- antiriciclaggio: tipo documento
  aml_doc_number  TEXT,
  aml_doc_expiry  TEXT,
  aml_checked_at  TEXT,
  last_contact_at TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  deleted_at      TEXT
);

CREATE INDEX IF NOT EXISTS idx_clients_last_name ON clients(last_name);
CREATE INDEX IF NOT EXISTS idx_clients_mobile    ON clients(mobile);
CREATE INDEX IF NOT EXISTS idx_clients_email     ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_owner     ON clients(owner_id);
CREATE INDEX IF NOT EXISTS idx_clients_status    ON clients(status);

-- ---------------------------------------------------------------- immobili
CREATE TABLE IF NOT EXISTS properties (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  ref               TEXT    NOT NULL DEFAULT '',       -- codice interno
  title             TEXT    NOT NULL DEFAULT '',
  kind              TEXT    NOT NULL DEFAULT '',       -- appartamento|villa|villetta|terreno|...
  contract          TEXT    NOT NULL DEFAULT 'vendita',-- vendita|affitto
  address           TEXT,
  city              TEXT,
  zone              TEXT,
  sqm               INTEGER,
  rooms             INTEGER,
  bathrooms         INTEGER,
  floor             TEXT,
  elevator          INTEGER NOT NULL DEFAULT 0,
  outdoor           TEXT,                              -- csv: balcone,terrazzo,giardino
  garage            INTEGER NOT NULL DEFAULT 0,
  condition         TEXT,
  energy_class      TEXT,
  price             INTEGER,
  min_price         INTEGER,                           -- prezzo minimo accettato dal proprietario
  status            TEXT    NOT NULL DEFAULT 'acquisizione',
                    -- acquisizione|in_vendita|proposta|compromesso|venduto|ritirato
  owner_client_id   INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  agent_id          INTEGER REFERENCES users(id)   ON DELETE SET NULL,
  mandate_start     TEXT,
  mandate_end       TEXT,
  exclusive         INTEGER NOT NULL DEFAULT 0,
  commission_pct    REAL,
  -- chiusura trattativa
  sold_price        INTEGER,
  preliminary_date  TEXT,                              -- compromesso
  deed_date         TEXT,                              -- rogito
  commission_seller INTEGER,
  commission_buyer  INTEGER,
  commission_paid   INTEGER NOT NULL DEFAULT 0,
  video_url         TEXT,                              -- il video dell'immobile su YouTube
  tracking_token    TEXT,                              -- chiave del link riservato al proprietario
  notes             TEXT,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  deleted_at        TEXT
);

CREATE INDEX IF NOT EXISTS idx_properties_status   ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_city     ON properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_owner    ON properties(owner_client_id);
CREATE INDEX IF NOT EXISTS idx_properties_mandate  ON properties(mandate_end);

-- ---------------------------------------------------------------- richieste
CREATE TABLE IF NOT EXISTS requirements (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id   INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  contract    TEXT    NOT NULL DEFAULT 'vendita',
  kind        TEXT,                          -- csv di tipologie accettate
  city        TEXT,                          -- proiezione: il comune della prima area
  zones       TEXT    NOT NULL DEFAULT '',   -- proiezione: tutte le zone, in csv
  areas       TEXT    NOT NULL DEFAULT '',   -- json [{comune, zone[]}] — la verita'
  conditions  TEXT    NOT NULL DEFAULT '',   -- csv di stati accettati
  budget_min  INTEGER,
  budget_max  INTEGER,
  sqm_min     INTEGER,
  rooms_min   INTEGER,
  needs       TEXT    NOT NULL DEFAULT '',   -- csv: ascensore,box,esterno,piano_basso
  urgency     TEXT    NOT NULL DEFAULT 'media',  -- bassa|media|alta
  financing   TEXT,                          -- contanti|mutuo_deliberato|mutuo_da_valutare
  status      TEXT    NOT NULL DEFAULT 'aperta', -- aperta|pausa|soddisfatta|persa
  notes       TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_requirements_client ON requirements(client_id);
CREATE INDEX IF NOT EXISTS idx_requirements_status ON requirements(status);

-- ---------------------------------------------------------------- attivita' e agenda
CREATE TABLE IF NOT EXISTS activities (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT    NOT NULL DEFAULT 'nota',
              -- chiamata|email|whatsapp|visita|appuntamento|nota|task
  title       TEXT    NOT NULL DEFAULT '',
  notes       TEXT,
  client_id   INTEGER REFERENCES clients(id)    ON DELETE CASCADE,
  property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id)      ON DELETE SET NULL,
  due_at      TEXT,                            -- quando e' in agenda
  done_at     TEXT,                            -- quando e' stata completata
  outcome     TEXT,                            -- esito / feedback della visita
  interest    TEXT,                            -- alto|medio|basso  (per le visite)
  reminded_at TEXT,                            -- quando e' partito il promemoria
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_activities_due      ON activities(due_at);
CREATE INDEX IF NOT EXISTS idx_activities_client   ON activities(client_id);
CREATE INDEX IF NOT EXISTS idx_activities_property ON activities(property_id);
CREATE INDEX IF NOT EXISTS idx_activities_user     ON activities(user_id);

-- ---------------------------------------------------------------- proposte d'acquisto
CREATE TABLE IF NOT EXISTS offers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  client_id   INTEGER NOT NULL REFERENCES clients(id)    ON DELETE CASCADE,
  amount      INTEGER NOT NULL,
  offered_at  TEXT    NOT NULL DEFAULT (date('now')),
  valid_until TEXT,
  status      TEXT    NOT NULL DEFAULT 'in_attesa', -- in_attesa|accettata|rifiutata|ritirata
  notes       TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_offers_property ON offers(property_id);
CREATE INDEX IF NOT EXISTS idx_offers_client   ON offers(client_id);

-- ---------------------------------------------------------------- storico prezzi
CREATE TABLE IF NOT EXISTS price_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  price       INTEGER NOT NULL,
  changed_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_price_history_property ON price_history(property_id);

-- ---------------------------------------------------------------- foto
-- I file stanno su disco, in data/foto/: qui restano solo i nomi e l'ordine.
-- Tenere le immagini dentro il database lo farebbe gonfiare da 2 MB a qualche
-- gigabyte, e ogni copia di sicurezza diventerebbe lentissima.
CREATE TABLE IF NOT EXISTS photos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  file        TEXT    NOT NULL,   -- nome del file, senza percorso
  caption     TEXT,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_photos_property ON photos(property_id, position);

-- ---------------------------------------------------------------- valutazioni
CREATE TABLE IF NOT EXISTS valuations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id   INTEGER REFERENCES properties(id) ON DELETE CASCADE,
  client_id     INTEGER REFERENCES clients(id)    ON DELETE CASCADE,
  city          TEXT,
  zone          TEXT,
  sqm           INTEGER,
  eur_sqm_min   INTEGER,
  eur_sqm_max   INTEGER,
  value_min     INTEGER,
  value_max     INTEGER,
  method        TEXT,     -- come e' stata fatta (OMI, comparabili, ...)
  notes         TEXT,
  user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_valuations_property ON valuations(property_id);
CREATE INDEX IF NOT EXISTS idx_valuations_client   ON valuations(client_id);

-- ---------------------------------------------------------------- registro accessi
CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action     TEXT    NOT NULL,   -- crea|modifica|elimina|esporta|accesso
  entity     TEXT    NOT NULL,   -- cliente|immobile|richiesta|...
  entity_id  INTEGER,
  detail     TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity  ON audit_log(entity, entity_id);
`;
