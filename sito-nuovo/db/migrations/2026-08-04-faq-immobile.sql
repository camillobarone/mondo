-- Domande frequenti sulla singola scheda immobile.
--
-- Le stesse domande servono in due posti: visibili in pagina per chi legge, e
-- dentro il JSON-LD come FAQPage per i motori. Tenerle in due punti diversi
-- significa vederle divergere alla prima correzione, quindi qui ce n'è una
-- copia sola e il JSON-LD si costruisce da questa.
--
-- Il formato è JSON — una lista di {"q": "...", "a": "..."} — invece di una
-- tabella a parte: le domande sono poche, si leggono e si salvano sempre
-- insieme all'immobile, e nessuna query dovrà mai cercarle o ordinarle.

ALTER TABLE properties ADD COLUMN faqs TEXT;
