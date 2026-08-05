-- L'email smette di essere unica. Stessa modifica del file `.mysql.sql`
-- gemello, e le ragioni stanno scritte lì.
--
-- SQLite non sa togliere un vincolo di unicità dichiarato sulla colonna:
-- l'unica strada è ricostruire la tabella senza, ricopiarci dentro i dati e
-- rimettere il nome. È la ricetta ufficiale, ed è il motivo per cui questa
-- migrazione esiste in due file invece che in uno.

CREATE TABLE users_nuova (
  id {PK},
  name VARCHAR(120) NOT NULL,
  email VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'agent',
  phone VARCHAR(40) NOT NULL DEFAULT '',
  bio TEXT,
  photo VARCHAR(255) NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT {NOW}
){SUFFIX};

INSERT INTO users_nuova (id, name, email, password_hash, role, phone, bio, photo, active, last_login_at, created_at)
  SELECT id, name, email, password_hash, role, phone, bio, photo, active, last_login_at, created_at FROM users;

DROP TABLE users;

ALTER TABLE users_nuova RENAME TO users;

CREATE INDEX users_email ON users (email);
