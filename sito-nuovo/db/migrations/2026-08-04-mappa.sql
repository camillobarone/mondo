-- Precisione del segnaposto sulla mappa, immobile per immobile.
--
-- Le coordinate c'erano già e l'importazione le porta da WordPress, ma non
-- c'era modo di dire quanto mostrarle. Molti venditori non vogliono che si
-- riconosca esattamente quale casa è in vendita: il valore predefinito è
-- quindi `zona`, cioè il caso prudente. `esatto` si sceglie a mano, quando
-- il proprietario è d'accordo.

ALTER TABLE properties ADD COLUMN map_mode VARCHAR(10) NOT NULL DEFAULT 'zona';
