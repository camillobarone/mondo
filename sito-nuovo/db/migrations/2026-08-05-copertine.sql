-- Immagine di copertina per pagine e articoli.
--
-- Gli articoli avevano già una colonna `cover`, ma era una casella di testo
-- in cui bisognava scrivere a mano l'indirizzo di un'immagine — e soprattutto
-- quel valore non veniva mostrato da nessuna parte: si salvava e finiva lì.
-- Adesso è un vero caricamento, con le tre larghezze che Uploader genera per
-- le foto degli immobili, e si vede in pagina.
--
-- `cover_alt` è la descrizione per chi non vede l'immagine. Quando è vuota si
-- usa il titolo, che per il ritratto di un agente è già la cosa giusta; per
-- la foto di una zona conviene scriverla.
--
-- Ogni ALTER aggiunge una colonna per volta: è l'unica forma che SQLite
-- accetta, e MySQL la accetta comunque.

ALTER TABLE pages ADD COLUMN cover VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE pages ADD COLUMN cover_srcset TEXT;
ALTER TABLE pages ADD COLUMN cover_alt VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE pages ADD COLUMN cover_width INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pages ADD COLUMN cover_height INTEGER NOT NULL DEFAULT 0;

ALTER TABLE posts ADD COLUMN cover_srcset TEXT;
ALTER TABLE posts ADD COLUMN cover_alt VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE posts ADD COLUMN cover_width INTEGER NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN cover_height INTEGER NOT NULL DEFAULT 0;
