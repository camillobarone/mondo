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

CREATE TABLE properties (
  id {PK},
  ref VARCHAR(30) NOT NULL UNIQUE,
  title VARCHAR(191) NOT NULL,
  slug VARCHAR(191) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
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
  featured INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  published_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT {NOW},
  updated_at DATETIME NULL
){SUFFIX};

CREATE INDEX idx_properties_status ON properties (status);
CREATE INDEX idx_properties_city ON properties (city);
CREATE INDEX idx_properties_type ON properties (type);
CREATE INDEX idx_properties_price ON properties (price);

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
  contract VARCHAR(20) NOT NULL DEFAULT 'vendita',
  budget_min {MONEY} NULL,
  budget_max {MONEY} NULL,
  sqm_min INTEGER NOT NULL DEFAULT 0,
  bedrooms_min INTEGER NOT NULL DEFAULT 0,
  types VARCHAR(255) NOT NULL DEFAULT '',
  cities VARCHAR(255) NOT NULL DEFAULT '',
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  assigned_to INTEGER NULL,
  created_at DATETIME NOT NULL DEFAULT {NOW},
  updated_at DATETIME NULL
){SUFFIX};

CREATE INDEX idx_contacts_active ON contacts (active);

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
