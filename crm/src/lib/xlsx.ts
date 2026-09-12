import { inflateRawSync } from "node:zlib";

/**
 * Lettura dei file .xlsx.
 *
 * Passare da Excel al CSV e' il punto in cui l'importazione si rompe piu'
 * spesso: separatore sbagliato, accenti rovinati, celle su piu' righe che si
 * spezzano. Leggendo direttamente il foglio, quel passaggio non serve piu'.
 *
 * Un .xlsx e' un archivio ZIP di file XML. Qui se ne leggono due:
 * `sharedStrings.xml`, dove Excel mette una sola volta i testi ripetuti, e il
 * primo foglio, dove le celle rimandano a quell'elenco per numero.
 * Niente dipendenze esterne: lo ZIP lo apre `zlib`, che sta in Node.
 */

/* ------------------------------------------------------------------ ZIP */

interface ZipEntry {
  name: string;
  data: Buffer;
}

/**
 * Legge l'indice in coda all'archivio (la "central directory"): e' l'unico
 * punto che dichiara con certezza dove comincia e quanto e' lungo ogni file.
 */
function readZip(buffer: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();

  // Il record di chiusura sta in fondo, dopo un commento di lunghezza ignota.
  let end = -1;
  for (let i = buffer.length - 22; i >= 0 && i > buffer.length - 65558; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("Il file non sembra un documento Excel valido.");

  const total = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);

  for (let i = 0; i < total; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;

    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);

    // L'intestazione locale ha campi di lunghezza propria: vanno rimisurati.
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const raw = buffer.subarray(start, start + compressedSize);

    files.set(name, method === 0 ? raw : inflateRawSync(raw));
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return files;
}

/* ------------------------------------------------------------------ XML */

const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'",
};

function unescapeXml(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&(?:amp|lt|gt|quot|apos);/g, (entity) => ENTITIES[entity] ?? entity);
}

/** Concatena tutti i <t> di un frammento: un testo formattato ne ha piu' d'uno. */
function textOf(fragment: string): string {
  let out = "";
  for (const match of fragment.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t\s*\/>/g)) {
    out += unescapeXml(match[1] ?? "");
  }
  return out;
}

/** "BC" -> 54. Le colonne di Excel contano in base 26 con le lettere. */
function columnIndex(reference: string): number {
  const letters = reference.match(/^[A-Z]+/)?.[0] ?? "A";
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
}

/* --------------------------------------------------------------- foglio */

/**
 * Restituisce le celle del primo foglio come testo, riga per riga.
 * Le righe e le colonne vuote in mezzo vengono conservate: servono a tenere
 * allineate le intestazioni con i valori.
 */
export function readXlsx(bytes: ArrayBuffer): string[][] {
  const files = readZip(Buffer.from(bytes));

  // Testi condivisi: le celle vi rimandano per numero.
  const shared: string[] = [];
  const sharedXml = files.get("xl/sharedStrings.xml");
  if (sharedXml) {
    for (const match of sharedXml.toString("utf8").matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      shared.push(textOf(match[1]!));
    }
  }

  const sheetName = [...files.keys()]
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort()[0];
  if (!sheetName) throw new Error("Il file Excel non contiene fogli leggibili.");

  const sheet = files.get(sheetName)!.toString("utf8");
  const rows: string[][] = [];

  for (const rowMatch of sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];

    for (const cellMatch of rowMatch[1]!.matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = cellMatch[1]!;
      const body = cellMatch[2] ?? "";
      const reference = attributes.match(/r="([A-Z]+\d+)"/)?.[1];
      const type = attributes.match(/t="([^"]+)"/)?.[1] ?? "n";

      let value = "";
      if (type === "s") {
        const index = Number(body.match(/<v>(\d+)<\/v>/)?.[1] ?? -1);
        value = shared[index] ?? "";
      } else if (type === "inlineStr") {
        value = textOf(body);
      } else if (type === "str" || type === "e") {
        value = unescapeXml(body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "");
      } else {
        value = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
      }

      const at = reference ? columnIndex(reference) : cells.length;
      while (cells.length < at) cells.push("");
      cells[at] = value;
    }

    rows.push(cells);
  }

  return rows;
}

/** Un .xlsx e' uno ZIP: comincia sempre per "PK". */
export function looksLikeXlsx(bytes: ArrayBuffer): boolean {
  const head = new Uint8Array(bytes.slice(0, 2));
  return head[0] === 0x50 && head[1] === 0x4b;
}
