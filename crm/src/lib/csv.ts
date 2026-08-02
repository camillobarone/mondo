/**
 * Lettura e scrittura CSV.
 *
 * Excel in italiano salva i CSV con il punto e virgola: il separatore viene
 * riconosciuto da solo leggendo la prima riga.
 */

export type CsvRow = Record<string, string>;

function detectDelimiter(firstLine: string): string {
  const counts = [
    { char: ";", n: (firstLine.match(/;/g) ?? []).length },
    { char: ",", n: (firstLine.match(/,/g) ?? []).length },
    { char: "\t", n: (firstLine.match(/\t/g) ?? []).length },
  ];
  return counts.sort((a, b) => b.n - a.n)[0]!.n > 0
    ? counts.sort((a, b) => b.n - a.n)[0]!.char
    : ",";
}

/** Divide il testo CSV in righe di celle, rispettando le virgolette. */
function tokenize(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

/** Legge un CSV con intestazione e restituisce un oggetto per riga. */
export function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const clean = text.replace(/^﻿/, ""); // toglie il BOM di Excel
  const firstLine = clean.split("\n", 1)[0] ?? "";
  const table = tokenize(clean, detectDelimiter(firstLine));
  if (!table.length) return { headers: [], rows: [] };

  const headers = table[0]!.map((h) => h.trim());
  const rows: CsvRow[] = [];

  for (const line of table.slice(1)) {
    if (line.every((cell) => cell.trim() === "")) continue;
    const row: CsvRow = {};
    headers.forEach((header, index) => {
      row[header] = (line[index] ?? "").trim();
    });
    rows.push(row);
  }

  return { headers, rows };
}

/** Costruisce un CSV (separatore ";", compatibile con Excel italiano). */
export function buildCsv(headers: string[], rows: (string | number | null)[][]): string {
  const escape = (value: string | number | null) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const lines = [headers.map(escape).join(";")];
  for (const row of rows) lines.push(row.map(escape).join(";"));
  return "﻿" + lines.join("\r\n");
}
