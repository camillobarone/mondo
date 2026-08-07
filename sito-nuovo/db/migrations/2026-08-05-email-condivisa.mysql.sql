-- L'email smette di essere unica.
--
-- In agenzia la posta è una sola: chiedere un indirizzo diverso per ogni
-- collega significa chiedere di inventarne, e un indirizzo inventato è un
-- indirizzo che un giorno qualcuno userà per scriverci davvero.
--
-- L'unicità serviva perché l'email è la chiave con cui si entra. Ma gli
-- account «solo firma» non entrano, quindi per loro non è la chiave di
-- niente: possono condividere l'indirizzo dell'agenzia senza che nulla
-- diventi ambiguo. Fra gli account che entrano davvero l'unicità resta, e
-- la controlla il programma (Users::emailTaken), che sa distinguere i ruoli
-- mentre un vincolo del database no.
--
-- L'indice però resta, senza il vincolo: su quella colonna si cerca a ogni
-- tentativo di accesso.

ALTER TABLE users DROP INDEX email;
CREATE INDEX users_email ON users (email);
