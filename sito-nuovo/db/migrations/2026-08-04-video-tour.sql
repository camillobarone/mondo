-- Video e visita virtuale sulle schede immobile.
--
-- Sul sito WordPress ci sono già: i video su YouTube e le visite Matterport.
-- Nel gestionale non esisteva la casella dove metterli, quindi l'importazione
-- li lasciava indietro — non per un errore, per una mancanza.
--
-- Si conserva l'indirizzo, non il codice di incorporamento: il codice che
-- arriva da un portale porta con sé tracciamenti e markup che non
-- controlliamo, mentre dall'indirizzo il player lo costruisce il sito.

ALTER TABLE properties ADD COLUMN video_url VARCHAR(500) NOT NULL DEFAULT '';
ALTER TABLE properties ADD COLUMN tour_url VARCHAR(500) NOT NULL DEFAULT '';
