-- Immagini responsive: il `srcset` pronto da stampare, calcolato al
-- caricamento. Senza, un telefono scarica la foto da 1600 px per mostrarla
-- larga 360 — è la voce che pesa di più sul caricamento in mobilità.

ALTER TABLE property_images ADD COLUMN srcset VARCHAR(500) NOT NULL DEFAULT '';
