/**
 * Adattamento dei tracciati di export degli altri gestionali.
 *
 * I gestionali immobiliari esportano quasi sempre "Cognome/Nome" in un campo
 * solo, piu' numeri di telefono nella stessa cella, e le richieste come blocco
 * di testo con un'etichetta per riga. Qui quel testo viene riportato ai campi
 * del programma, senza perdere per strada quello che non ha una casella
 * corrispondente: finisce nelle note della richiesta.
 */

/** Particelle che fanno parte del cognome: "De Santis Anna" -> De Santis. */
const PARTICELLE = new Set([
  "de", "del", "della", "dello", "dei", "degli", "di", "da", "dal", "dalla",
  "lo", "la", "li", "san", "santa", "sant", "van", "von", "mc", "o",
]);

/**
 * "Rossi Mario" -> cognome Rossi, nome Mario. L'ordine cognome-nome e' quello
 * dell'intestazione "Cognome/Nome": si fida di quello, non di un'euristica.
 */
export function splitName(full: string): { firstName: string; lastName: string } {
  const words = full.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { firstName: "", lastName: "" };
  if (words.length === 1) return { firstName: "", lastName: words[0]! };

  const surname: string[] = [words[0]!];
  let i = 1;
  while (
    i < words.length - 1 &&
    PARTICELLE.has(words[i]!.toLowerCase().replace(/[’']$/, ""))
  ) {
    surname.push(words[i]!);
    i++;
  }
  // Anche il primo pezzo puo' essere una particella: "De Santis Anna".
  if (PARTICELLE.has(words[0]!.toLowerCase().replace(/[’']$/, "")) && surname.length === 1) {
    surname.push(words[1]!);
    i = 2;
  }

  return { firstName: words.slice(i).join(" "), lastName: surname.join(" ") };
}

/**
 * "3401112233/ 0832123456/" -> cellulare e telefono separati. In Italia i
 * cellulari cominciano per 3: e' l'unico modo affidabile di distinguerli.
 */
export function splitPhones(raw: string): { mobile: string; phone: string; extra: string[] } {
  const numbers = raw
    .split("/")
    .map((n) => n.trim())
    .filter((n) => /\d{6,}/.test(n));

  const mobiles = numbers.filter((n) => /^(\+?39)?\s*3/.test(n.replace(/[\s.]/g, "")));
  const landlines = numbers.filter((n) => !mobiles.includes(n));

  return {
    mobile: mobiles[0] ?? "",
    phone: landlines[0] ?? "",
    extra: [...mobiles.slice(1), ...landlines.slice(1)],
  };
}

/** Le tipologie degli altri gestionali riportate al nostro vocabolario. */
const TIPOLOGIE: Record<string, string> = {
  "appartamento": "Appartamento",
  "attico": "Attico",
  "loft": "Appartamento",
  "mansarda": "Appartamento",
  "villa": "Villa",
  "villetta a schiera": "Villetta a schiera",
  "casa singola": "Casa indipendente",
  "casa indipendente": "Casa indipendente",
  "terratetto": "Casa indipendente",
  "rustico": "Rustico",
  "masseria": "Masseria",
  "trullo": "Trullo / Pajara",
  "negozio": "Locale commerciale",
  "locale comm.le/fondo": "Locale commerciale",
  "attivita commerciale": "Locale commerciale",
  "attività commerciale": "Locale commerciale",
  "capannone": "Locale commerciale",
  "ufficio": "Locale commerciale",
  "box": "Box / Garage",
  "garage": "Box / Garage",
  "terreno": "Terreno",
};

/* ---------------------------------------------------------------- immobili */

export interface ParsedProperty {
  ref: string;
  title: string;
  kind: string | null;
  contract: string;
  city: string | null;
  zone: string | null;
  rooms: number | null;
  sqm: number | null;
  price: number | null;
  exclusive: number;
  mandateEnd: string | null;
  ownerName: string;
  ownerPhone: string;
  notes: string;
}

/** "€ 1.050.000" -> 1050000 ; "720 mq" -> 720 ; "3.0" -> 3 */
export function numero(text: string): number | null {
  const pulito = String(text).replace(/[^\d.,]/g, "").replace(/\.(?=\d{3}\b)/g, "");
  const valore = Number(pulito.replace(",", "."));
  return Number.isFinite(valore) && valore > 0 ? Math.round(valore) : null;
}

/** "15/08/2025" -> "2025-08-15", il formato che capisce il database. */
export function dataItaliana(text: string): string | null {
  const m = String(text).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
}

/**
 * "Torre lapillo - Porto Cesareo (LE)" -> zona e comune separati.
 * Senza trattino c'e' solo il comune: "Lecce (LE)".
 */
export function zonaEComune(text: string): { city: string | null; zone: string | null } {
  const pulito = String(text).replace(/\s*\([A-Za-z]{2}\)\s*$/, "").trim();
  if (!pulito) return { city: null, zone: null };

  const taglio = pulito.lastIndexOf(" - ");
  if (taglio < 0) return { city: pulito, zone: null };
  return { zone: pulito.slice(0, taglio).trim() || null, city: pulito.slice(taglio + 3).trim() || null };
}

export function tipologia(text: string): string | null {
  const pulito = String(text).trim();
  if (!pulito) return null;
  return TIPOLOGIE[pulito.toLowerCase()] ?? pulito;
}

/* --------------------------------------------------------------- richieste */

export interface ParsedRequirement {
  contract: string;
  kind: string | null;
  city: string | null;
  zones: string;
  budgetMin: number | null;
  budgetMax: number | null;
  sqmMin: number | null;
  roomsMin: number | null;
  notes: string;
}

/** Zone che non sono zone: indicano "tutto il comune". */
const NON_ZONE = new Set(["capoluogo", "tutte le zone", "qualsiasi zona"]);

function etichetta(text: string, name: string): string {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.toLowerCase().startsWith(`${name.toLowerCase()}:`)) {
      return trimmed.slice(name.length + 1).trim();
    }
  }
  return "";
}

/** "€ 150.000" -> 150000 */
function importo(text: string): number[] {
  return [...text.matchAll(/([\d][\d.\s]*)/g)]
    .map((m) => Number(m[1]!.replace(/[.\s]/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0);
}

/**
 * Un cliente puo' cercare piu' cose insieme — la casa per se' e il locale da
 * mettere a reddito. Nell'export sono blocchi consecutivi nella stessa cella:
 * qui vengono separati, perche' letti tutti insieme i campi dell'uno
 * finirebbero nell'altro.
 */
export function parseRequirements(text: string): ParsedRequirement[] {
  if (!text.trim()) return [];

  const blocks = text
    .split(/(?=DETTAGLI RICHIESTA)/i)
    .map((block) => block.trim())
    .filter(Boolean);

  const list = (blocks.length ? blocks : [text])
    .map(parseRequirement)
    .filter((requirement): requirement is ParsedRequirement => requirement !== null);

  // Due blocchi identici sono la stessa richiesta ripetuta, non due richieste.
  const seen = new Set<string>();
  return list.filter((requirement) => {
    const key = JSON.stringify(requirement);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Legge un singolo blocco "DETTAGLI RICHIESTA" e ne ricava una richiesta.
 * Restituisce null quando non c'e' nessun criterio: una richiesta che dice
 * "qualsiasi prezzo, qualsiasi zona, qualsiasi tipologia" non aggiunge nulla
 * a quello che gia' si sa, e sporcherebbe gli incroci.
 */
export function parseRequirement(text: string): ParsedRequirement | null {
  if (!text.trim()) return null;

  const notes: string[] = [];

  // --- contratto ---------------------------------------------------------
  const contrattoRaw = etichetta(text, "Contratto").toLowerCase();
  let contract = "vendita";
  if (contrattoRaw.includes("vendita") && contrattoRaw.includes("affitto")) {
    notes.push("Valuta sia acquisto sia affitto");
  } else if (contrattoRaw.includes("affitto")) {
    contract = "affitto";
  }

  // --- prezzo ------------------------------------------------------------
  const prezzoRaw = etichetta(text, "Prezzo");
  let budgetMin: number | null = null;
  let budgetMax: number | null = null;
  if (prezzoRaw && !/qualsiasi/i.test(prezzoRaw)) {
    const numeri = importo(prezzoRaw);
    if (/^da\b/i.test(prezzoRaw) && numeri.length >= 2) {
      budgetMin = numeri[0]!;
      budgetMax = numeri[1]!;
    } else if (/a partire da/i.test(prezzoRaw)) {
      budgetMin = numeri[0] ?? null;
    } else if (/fino a/i.test(prezzoRaw)) {
      budgetMax = numeri[0] ?? null;
    } else if (numeri.length === 1) {
      budgetMax = numeri[0]!;
    }
  }

  // --- tipologia ---------------------------------------------------------
  const tipologieRaw = etichetta(text, "Tipologie");
  let kind: string | null = null;
  if (tipologieRaw && !/qualsiasi/i.test(tipologieRaw)) {
    const elenco = tipologieRaw.split(",").map((t) => t.trim()).filter(Boolean);
    kind = TIPOLOGIE[elenco[0]!.toLowerCase()] ?? elenco[0]!;
    if (elenco.length > 1) notes.push(`Tipologie richieste: ${elenco.join(", ")}`);
  }

  // --- comune e zone -----------------------------------------------------
  // "Lecce (LE) - Centro Storico / Surbo (LE) - Capoluogo"
  const zonaRaw = etichetta(text, "Zona di ricerca");
  let city: string | null = null;
  const zones: string[] = [];
  const comuni: string[] = [];
  if (zonaRaw && !/qualsiasi/i.test(zonaRaw)) {
    for (const pezzo of zonaRaw.split("/").map((z) => z.trim()).filter(Boolean)) {
      const match = pezzo.match(/^(.+?)\s*\([A-Za-z]{2}\)\s*(?:-\s*(.*))?$/);
      const comune = (match?.[1] ?? pezzo).trim();
      const zona = (match?.[2] ?? "").trim();
      if (comune && !comuni.includes(comune)) comuni.push(comune);
      if (zona && !NON_ZONE.has(zona.toLowerCase()) && !zones.includes(zona)) zones.push(zona);
    }
    city = comuni[0] ?? null;
    if (comuni.length > 1) notes.push(`Anche a: ${comuni.slice(1).join(", ")}`);
  }

  // --- superficie --------------------------------------------------------
  const superficieRaw = etichetta(text, "Superficie");
  let sqmMin: number | null = null;
  if (superficieRaw) {
    const numeri = importo(superficieRaw);
    if (/^da\b|a partire da/i.test(superficieRaw)) sqmMin = numeri[0] ?? null;
    else notes.push(`Superficie: ${superficieRaw}`);
  }

  // --- vani --------------------------------------------------------------
  // "Camere" sono le camere da letto, non i vani: tenerle separate evita di
  // filtrare via immobili giusti con un numero che vuol dire un'altra cosa.
  const vaniRaw = etichetta(text, "Locali/Vani");
  const roomsMin = vaniRaw ? (importo(vaniRaw)[0] ?? null) : null;

  for (const extra of ["Camere", "Bagni", "Stato", "Categoria"]) {
    const value = etichetta(text, extra);
    if (value && !/qualsiasi/i.test(value)) notes.push(`${extra}: ${value}`);
  }

  const concreta =
    budgetMin !== null || budgetMax !== null || kind !== null || city !== null ||
    zones.length > 0 || sqmMin !== null || roomsMin !== null;
  if (!concreta) return null;

  return {
    contract,
    kind,
    city,
    zones: zones.join(","),
    budgetMin,
    budgetMax,
    sqmMin,
    roomsMin,
    notes: notes.join(" · "),
  };
}
