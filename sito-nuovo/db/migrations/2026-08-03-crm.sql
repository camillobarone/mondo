-- Porting del modello dati dal gestionale della PR #2: incarico, prezzo
-- minimo riservato, trattativa fino al rogito, adempimenti privacy e
-- antiriciclaggio, storico prezzi, proposte, valutazioni, esito delle visite.
--
-- Serve SOLO alle installazioni fatte prima del 3 agosto 2026: su una
-- installazione nuova schema.sql contiene già tutto e questa migrazione viene
-- solo marcata come applicata (vedi Db::migrate).
--
-- Ogni ALTER aggiunge una colonna per volta: è l'unica forma che SQLite
-- accetta, e MySQL la accetta comunque.

ALTER TABLE properties ADD COLUMN deal_stage VARCHAR(20) NOT NULL DEFAULT 'acquisizione';
ALTER TABLE properties ADD COLUMN min_price DECIMAL(12,2) NULL;
ALTER TABLE properties ADD COLUMN owner_contact_id INTEGER NULL;
ALTER TABLE properties ADD COLUMN mandate_start DATE NULL;
ALTER TABLE properties ADD COLUMN mandate_end DATE NULL;
ALTER TABLE properties ADD COLUMN exclusive INTEGER NOT NULL DEFAULT 0;
ALTER TABLE properties ADD COLUMN commission_pct REAL NULL;
ALTER TABLE properties ADD COLUMN sold_price DECIMAL(12,2) NULL;
ALTER TABLE properties ADD COLUMN preliminary_date DATE NULL;
ALTER TABLE properties ADD COLUMN deed_date DATE NULL;
ALTER TABLE properties ADD COLUMN commission_seller DECIMAL(12,2) NULL;
ALTER TABLE properties ADD COLUMN commission_buyer DECIMAL(12,2) NULL;
ALTER TABLE properties ADD COLUMN commission_paid INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_properties_stage ON properties (deal_stage);
CREATE INDEX idx_properties_mandate ON properties (mandate_end);
CREATE INDEX idx_properties_owner ON properties (owner_contact_id);

ALTER TABLE contacts ADD COLUMN roles VARCHAR(191) NOT NULL DEFAULT 'acquirente';
ALTER TABLE contacts ADD COLUMN source VARCHAR(60) NOT NULL DEFAULT '';
ALTER TABLE contacts ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'attivo';
ALTER TABLE contacts ADD COLUMN city VARCHAR(120) NOT NULL DEFAULT '';
ALTER TABLE contacts ADD COLUMN tax_code VARCHAR(20) NOT NULL DEFAULT '';
ALTER TABLE contacts ADD COLUMN financing VARCHAR(30) NOT NULL DEFAULT '';
ALTER TABLE contacts ADD COLUMN urgency VARCHAR(20) NOT NULL DEFAULT 'media';
ALTER TABLE contacts ADD COLUMN privacy_consent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE contacts ADD COLUMN privacy_date DATETIME NULL;
ALTER TABLE contacts ADD COLUMN privacy_scope VARCHAR(191) NOT NULL DEFAULT '';
ALTER TABLE contacts ADD COLUMN aml_doc_type VARCHAR(40) NOT NULL DEFAULT '';
ALTER TABLE contacts ADD COLUMN aml_doc_number VARCHAR(60) NOT NULL DEFAULT '';
ALTER TABLE contacts ADD COLUMN aml_doc_expiry DATE NULL;
ALTER TABLE contacts ADD COLUMN aml_checked_at DATETIME NULL;
ALTER TABLE contacts ADD COLUMN last_contact_at DATETIME NULL;

CREATE INDEX idx_contacts_status ON contacts (status);
CREATE INDEX idx_contacts_lastcontact ON contacts (last_contact_at);

ALTER TABLE appointments ADD COLUMN outcome TEXT;
ALTER TABLE appointments ADD COLUMN interest VARCHAR(20) NOT NULL DEFAULT '';

CREATE TABLE price_history (
  id {PK},
  property_id INTEGER NOT NULL,
  price {MONEY} NULL,
  previous_price {MONEY} NULL,
  reason VARCHAR(255) NOT NULL DEFAULT '',
  user_id INTEGER NULL,
  created_at DATETIME NOT NULL DEFAULT {NOW}
){SUFFIX};

CREATE INDEX idx_price_history_property ON price_history (property_id, created_at);

CREATE TABLE offers (
  id {PK},
  property_id INTEGER NOT NULL,
  contact_id INTEGER NULL,
  amount {MONEY} NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'presentata',
  deposit {MONEY} NULL,
  valid_until DATE NULL,
  presented_at DATETIME NOT NULL DEFAULT {NOW},
  replied_at DATETIME NULL,
  notes TEXT,
  user_id INTEGER NULL,
  created_at DATETIME NOT NULL DEFAULT {NOW}
){SUFFIX};

CREATE INDEX idx_offers_property ON offers (property_id, presented_at);
CREATE INDEX idx_offers_status ON offers (status);

CREATE TABLE valuations (
  id {PK},
  property_id INTEGER NULL,
  contact_id INTEGER NULL,
  lead_id INTEGER NULL,
  address VARCHAR(191) NOT NULL DEFAULT '',
  city VARCHAR(120) NOT NULL DEFAULT '',
  sqm INTEGER NOT NULL DEFAULT 0,
  value_min {MONEY} NULL,
  value_max {MONEY} NULL,
  method VARCHAR(120) NOT NULL DEFAULT '',
  notes TEXT,
  user_id INTEGER NULL,
  created_at DATETIME NOT NULL DEFAULT {NOW}
){SUFFIX};

CREATE INDEX idx_valuations_when ON valuations (created_at);
