-- Traccia della provenienza da WordPress. Senza questa colonna un secondo
-- giro dell'importatore creerebbe 34 doppioni invece di aggiornare.

ALTER TABLE properties ADD COLUMN wp_id INTEGER NULL;
ALTER TABLE property_images ADD COLUMN wp_id INTEGER NULL;

CREATE INDEX idx_properties_wpid ON properties (wp_id);
