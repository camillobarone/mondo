-- Tentativi di accesso falliti, per fermare chi prova le password a raffica.
--
-- Finora l'unica difesa era un'attesa di tre decimi di secondo dopo ogni
-- errore: circa tre tentativi al secondo, per sempre, senza che niente li
-- contasse. Con una lista di password comuni è tempo sufficiente.
--
-- Si segna l'indirizzo di rete e l'email provata. Il blocco guarda tutti e
-- due: bloccare solo l'email permetterebbe a chiunque di chiudere fuori un
-- collega scrivendo la sua email dieci volte di fila.
--
-- Le righe le pulisce Auth quando controlla, quindi la tabella non cresce.

CREATE TABLE accessi_falliti (
  id {PK},
  ip VARCHAR(45) NOT NULL,
  email VARCHAR(191) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT {NOW}
){SUFFIX};

CREATE INDEX idx_accessi_falliti_ip ON accessi_falliti (ip, created_at);
CREATE INDEX idx_accessi_falliti_email ON accessi_falliti (email, created_at);
