import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

/**
 * Foto degli immobili.
 *
 * I file stanno accanto al database, in `data/foto/<immobile>/`: cosi' una
 * copia della cartella `data` porta via tutto, archivio e immagini insieme.
 *
 * Ogni foto viene ridotta appena caricata. Una foto scattata col telefono pesa
 * 4-5 MB: cento immobili sarebbero decine di gigabyte, e ogni scheda ci
 * metterebbe mezzo minuto ad aprirsi sul telefono di un cliente. Ridotta a
 * 1920 pixel pesa poco piu' di duecento kilobyte, e a occhio non cambia nulla.
 */

const LATO_MASSIMO = 1920;
const LATO_ANTEPRIMA = 480;
export const MAX_FOTO_PER_IMMOBILE = 30;
export const MAX_BYTE_PER_FOTO = 25 * 1024 * 1024;

/** I formati che sharp sa aprire, HEIC degli iPhone compreso. */
const FORMATI = new Set(["jpeg", "jpg", "png", "webp", "heif", "heic", "avif", "gif", "tiff"]);

function cartellaFoto(): string {
  const database = process.env.CRM_DB_PATH ?? path.join(process.cwd(), "data", "mondo.db");
  return path.join(path.dirname(database), "foto");
}

/** Percorso su disco di una foto. Il nome viene ripulito: mai fidarsi. */
export function percorsoFoto(propertyId: number, file: string, anteprima = false): string {
  const pulito = path.basename(file);
  const nome = anteprima ? pulito.replace(/\.jpg$/, "-min.jpg") : pulito;
  return path.join(cartellaFoto(), String(propertyId), nome);
}

export interface FotoSalvata {
  file: string;
  errore?: undefined;
}
export interface FotoScartata {
  file?: undefined;
  errore: string;
}

/**
 * Salva una foto: la ruota secondo l'orientamento della fotocamera, la riduce
 * e ne ricava un'anteprima. Restituisce il nome del file, oppure il motivo per
 * cui e' stata scartata.
 */
export async function salvaFoto(
  propertyId: number,
  nomeOriginale: string,
  dati: ArrayBuffer,
): Promise<FotoSalvata | FotoScartata> {
  if (dati.byteLength === 0) return { errore: `${nomeOriginale}: file vuoto.` };
  if (dati.byteLength > MAX_BYTE_PER_FOTO) {
    return { errore: `${nomeOriginale}: supera i 25 MB.` };
  }

  const buffer = Buffer.from(dati);
  let immagine: sharp.Sharp;
  let formato: string | undefined;

  try {
    immagine = sharp(buffer, { failOn: "error" });
    formato = (await immagine.metadata()).format;
  } catch {
    return { errore: `${nomeOriginale}: non è un'immagine leggibile.` };
  }

  if (!formato || !FORMATI.has(formato)) {
    return { errore: `${nomeOriginale}: formato non supportato (${formato ?? "sconosciuto"}).` };
  }

  const cartella = path.join(cartellaFoto(), String(propertyId));
  fs.mkdirSync(cartella, { recursive: true });

  const nome = `${crypto.randomBytes(8).toString("hex")}.jpg`;

  // `rotate()` senza argomenti applica l'orientamento scritto dalla fotocamera:
  // senza, le foto verticali del telefono arrivano coricate.
  await sharp(buffer)
    .rotate()
    .resize({ width: LATO_MASSIMO, height: LATO_MASSIMO, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(path.join(cartella, nome));

  await sharp(buffer)
    .rotate()
    .resize({ width: LATO_ANTEPRIMA, height: LATO_ANTEPRIMA, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 78, mozjpeg: true })
    .toFile(path.join(cartella, nome.replace(/\.jpg$/, "-min.jpg")));

  return { file: nome };
}

/** Cancella i file di una foto. Se non ci sono piu', non e' un problema. */
export function cancellaFile(propertyId: number, file: string): void {
  for (const anteprima of [false, true]) {
    try {
      fs.unlinkSync(percorsoFoto(propertyId, file, anteprima));
    } catch {
      /* gia' sparito: niente da fare */
    }
  }
}

/** Legge una foto dal disco. `null` se non esiste. */
export function leggiFoto(propertyId: number, file: string, anteprima: boolean): Buffer | null {
  try {
    return fs.readFileSync(percorsoFoto(propertyId, file, anteprima));
  } catch {
    return null;
  }
}
