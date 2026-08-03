-- Schema del sito + gestionale Mondo Immobiliare.
-- Scritto una volta sola, in SQL neutro: i token {PK}, {NOW}, {MONEY} e
-- {SUFFIX} vengono risolti da Mil\Core\Db::dialect() nel dialetto del driver
-- attivo (MySQL su SiteGround, SQLite per la prova in locale).

CREATE TABLE users (
  id {PK},
  name VARCHAR(120) NOT NULL,
  email VARCHAR(191) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'agent',
  phone VARCHAR(40) NOT NULL DEFAULT '',
  bio TEXT,
  photo VARCHAR(255) NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT {NOW}
){SUFFIX};

-- `status` è lo stato di PUBBLICAZIONE (cosa si vede online), `deal_stage` è
-- lo stato della TRATTATIVA (a che punto è il lavoro). Sono due assi diversi:
-- un immobile può essere online e già sotto proposta, oppure rogitato e
-- archiviato. Tenerli separati evita di dover scegliere fra dire la verità al
-- pubblico e dire la verità agli agenti.
CREATE TABLE properties (
  id {PK},
  ref VARCHAR(30) NOT NULL UNIQUE,
  title VARCHAR(191) NOT NULL,
  slug VARCHAR(191) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  deal_stage VARCHAR(20) NOT NULL DEFAULT 'acquisizione',
  contract VARCHAR(20) NOT NULL DEFAULT 'vendita',
  type VARCHAR(40) NOT NULL DEFAULT 'appartamento',
  city VARCHAR(120) NOT NULL DEFAULT '',
  area VARCHAR(120) NOT NULL DEFAULT '',
  address VARCHAR(191) NOT NULL DEFAULT '',
  postal_code VARCHAR(10) NOT NULL DEFAULT '',
  lat VARCHAR(20) NOT NULL DEFAULT '',
  lng VARCHAR(20) NOT NULL DEFAULT '',
  price {MONEY} NULL,
  price_hidden INTEGER NOT NULL DEFAULT 0,
  -- Prezzo minimo accettato dal proprietario. Non esce MAI dal gestionale:
  -- nessuna query del sito pubblico lo legge, nessun template lo stampa.
  min_price {MONEY} NULL,
  condo_fees {MONEY} NULL,
  sqm INTEGER NOT NULL DEFAULT 0,
  lot_sqm INTEGER NOT NULL DEFAULT 0,
  rooms INTEGER NOT NULL DEFAULT 0,
  bedrooms INTEGER NOT NULL DEFAULT 0,
  bathrooms INTEGER NOT NULL DEFAULT 0,
  floor VARCHAR(20) NOT NULL DEFAULT '',
  floors_total INTEGER NOT NULL DEFAULT 0,
  year_built INTEGER NOT NULL DEFAULT 0,
  energy_class VARCHAR(10) NOT NULL DEFAULT '',
  condition_state VARCHAR(40) NOT NULL DEFAULT '',
  heating VARCHAR(60) NOT NULL DEFAULT '',
  features TEXT,
  excerpt TEXT,
  description TEXT,
  seo_title VARCHAR(191) NOT NULL DEFAULT '',
  seo_description VARCHAR(255) NOT NULL DEFAULT '',
  agent_id INTEGER NULL,
  -- Proprietario dell'immobile, come voce dell'anagrafica contatti.
  owner_contact_id INTEGER NULL,
  -- Incarico: senza la scadenza a database non c'è modo di accorgersi che
  -- sta per scadere, ed è il momento in cui si perde un immobile.
  mandate_start DATE NULL,
  mandate_end DATE NULL,
  exclusive INTEGER NOT NULL DEFAULT 0,
  commission_pct REAL NULL,
  -- Chiusura della trattativa.
  sold_price {MONEY} NULL,
  preliminary_date DATE NULL,
  deed_date DATE NULL,
  commission_seller {MONEY} NULL,
  commission_buyer {MONEY} NULL,
  commission_paid INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  published_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT {NOW},
  updated_at DATETIME NULL
){SUFFIX};

CREATE INDEX idx_properties_status ON properties (status);
CREATE INDEX idx_properties_stage ON properties (deal_stage);
CREATE INDEX idx_properties_city ON properties (city);
CREATE INDEX idx_properties_type ON properties (type);
CREATE INDEX idx_properties_price ON properties (price);
CREATE INDEX idx_properties_mandate ON properties (mandate_end);
CREATE INDEX idx_properties_owner ON properties (owner_contact_id);

-- Storico dei prezzi: ogni variazione resta scritta. Serve a rispondere alla
-- domanda che il proprietario fa sempre — "da quanto è a questo prezzo?" —
-- e a capire, sugli immobili fermi, se il problema è il prezzo o altro.
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

-- Proposte di acquisto ricevute su un immobile.
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

-- Valutazioni fatte, anche su immobili non ancora in portafoglio: è il
-- registro di cosa è stato promesso al proprietario, e a che numero.
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

CREATE TABLE property_images (
  id {PK},
  property_id INTEGER NOT NULL,
  path VARCHAR(255) NOT NULL,
  thumb VARCHAR(255) NOT NULL DEFAULT '',
  alt VARCHAR(191) NOT NULL DEFAULT '',
  width INTEGER NOT NULL DEFAULT 0,
  height INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT {NOW}
){SUFFIX};

CREATE INDEX idx_images_property ON property_images (property_id, sort);

CREATE TABLE leads (
  id {PK},
  source VARCHAR(30) NOT NULL DEFAULT 'contatto',
  property_id INTEGER NULL,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(40) NOT NULL DEFAULT '',
  email VARCHAR(191) NOT NULL DEFAULT '',
  city VARCHAR(120) NOT NULL DEFAULT '',
  message TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'nuovo',
  assigned_to INTEGER NULL,
  ip VARCHAR(45) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT {NOW},
  updated_at DATETIME NULL
){SUFFIX};

CREATE INDEX idx_leads_status ON leads (status, created_at);

CREATE TABLE lead_notes (
  id {PK},
  lead_id INTEGER NOT NULL,
  user_id INTEGER NULL,
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT {NOW}
){SUFFIX};

CREATE INDEX idx_lead_notes_lead ON lead_notes (lead_id);

-- Anagrafica delle richieste di acquisto: è la tabella su cui gira il
-- matching automatico con gli immobili in portafoglio.
CREATE TABLE contacts (
  id {PK},
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(40) NOT NULL DEFAULT '',
  email VARCHAR(191) NOT NULL DEFAULT '',
  -- Un contatto può essere più cose insieme: chi vende oggi compra domani.
  roles VARCHAR(191) NOT NULL DEFAULT 'acquirente',
  source VARCHAR(60) NOT NULL DEFAULT '',
  status VARCHAR(30) NOT NULL DEFAULT 'attivo',
  city VARCHAR(120) NOT NULL DEFAULT '',
  tax_code VARCHAR(20) NOT NULL DEFAULT '',
  contract VARCHAR(20) NOT NULL DEFAULT 'vendita',
  budget_min {MONEY} NULL,
  budget_max {MONEY} NULL,
  sqm_min INTEGER NOT NULL DEFAULT 0,
  bedrooms_min INTEGER NOT NULL DEFAULT 0,
  types VARCHAR(255) NOT NULL DEFAULT '',
  cities VARCHAR(255) NOT NULL DEFAULT '',
  financing VARCHAR(30) NOT NULL DEFAULT '',
  urgency VARCHAR(20) NOT NULL DEFAULT 'media',
  notes TEXT,
  -- Consenso privacy: senza data non vale niente in caso di contestazione.
  privacy_consent INTEGER NOT NULL DEFAULT 0,
  privacy_date DATETIME NULL,
  privacy_scope VARCHAR(191) NOT NULL DEFAULT '',
  -- Antiriciclaggio: identificazione del cliente prima della trattativa.
  aml_doc_type VARCHAR(40) NOT NULL DEFAULT '',
  aml_doc_number VARCHAR(60) NOT NULL DEFAULT '',
  aml_doc_expiry DATE NULL,
  aml_checked_at DATETIME NULL,
  last_contact_at DATETIME NULL,
  active INTEGER NOT NULL DEFAULT 1,
  assigned_to INTEGER NULL,
  created_at DATETIME NOT NULL DEFAULT {NOW},
  updated_at DATETIME NULL
){SUFFIX};

CREATE INDEX idx_contacts_active ON contacts (active);
CREATE INDEX idx_contacts_status ON contacts (status);
CREATE INDEX idx_contacts_lastcontact ON contacts (last_contact_at);

CREATE TABLE appointments (
  id {PK},
  title VARCHAR(191) NOT NULL,
  starts_at DATETIME NOT NULL,
  property_id INTEGER NULL,
  contact_id INTEGER NULL,
  lead_id INTEGER NULL,
  user_id INTEGER NULL,
  notes TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  -- Compilati DOPO la visita: com'è andata e quanto interesse c'era.
  -- È il dato che permette di dire al proprietario perché non si vende.
  outcome TEXT,
  interest VARCHAR(20) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT {NOW}
){SUFFIX};

CREATE INDEX idx_appointments_when ON appointments (starts_at, done);

CREATE TABLE posts (
  id {PK},
  title VARCHAR(191) NOT NULL,
  slug VARCHAR(191) NOT NULL UNIQUE,
  excerpt TEXT,
  body TEXT,
  cover VARCHAR(255) NOT NULL DEFAULT '',
  seo_title VARCHAR(191) NOT NULL DEFAULT '',
  seo_description VARCHAR(255) NOT NULL DEFAULT '',
  author_id INTEGER NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  published_at DATETIME NULL,
  updated_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT {NOW}
){SUFFIX};

CREATE INDEX idx_posts_status ON posts (status, published_at);

CREATE TABLE pages (
  id {PK},
  title VARCHAR(191) NOT NULL,
  slug VARCHAR(191) NOT NULL UNIQUE,
  body TEXT,
  seo_title VARCHAR(191) NOT NULL DEFAULT '',
  seo_description VARCHAR(255) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'published',
  updated_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT {NOW}
){SUFFIX};

-- Redirect 301: è il pezzo che permette di non perdere il posizionamento
-- quando un URL cambia. Vedi docs/MIGRAZIONE-SEO.md.
CREATE TABLE redirects (
  id {PK},
  from_path VARCHAR(255) NOT NULL UNIQUE,
  to_path VARCHAR(255) NOT NULL,
  code INTEGER NOT NULL DEFAULT 301,
  hits INTEGER NOT NULL DEFAULT 0,
  last_hit_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT {NOW}
){SUFFIX};

CREATE TABLE settings (
  id {PK},
  name VARCHAR(100) NOT NULL UNIQUE,
  value TEXT
){SUFFIX};

-- Registro delle migrazioni già applicate. Su un'installazione nuova questo
-- file è già aggiornato, quindi le migrazioni vengono solo marcate come fatte;
-- su un'installazione esistente vengono eseguite davvero. Vedi Db::migrate().
CREATE TABLE schema_migrations (
  id {PK},
  name VARCHAR(191) NOT NULL UNIQUE,
  applied_at DATETIME NOT NULL DEFAULT {NOW}
){SUFFIX};

CREATE TABLE activity_log (
  id {PK},
  user_id INTEGER NULL,
  action VARCHAR(60) NOT NULL,
  entity VARCHAR(60) NOT NULL DEFAULT '',
  entity_id INTEGER NULL,
  detail VARCHAR(255) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT {NOW}
){SUFFIX};

CREATE INDEX idx_activity_when ON activity_log (created_at);
