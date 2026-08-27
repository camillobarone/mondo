const EUR = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const NUM = new Intl.NumberFormat("it-IT");

/**
 * Il budget di una richiesta, per intero. Mostrare solo il massimo
 * nasconderebbe un minimo rimasto li' da una modifica precedente: e' il
 * genere di dato invisibile che poi fa sparire gli incroci.
 */
export function budgetRange(
  min: number | null | undefined,
  max: number | null | undefined,
): string {
  if (min && max) return `${euro(min)} – ${euro(max)}`;
  if (max) return `Fino a ${euro(max)}`;
  if (min) return `Da ${euro(min)}`;
  return "Budget non indicato";
}

/** Un minimo sopra il massimo e' sempre un errore di compilazione. */
export function budgetIsContradictory(
  min: number | null | undefined,
  max: number | null | undefined,
): boolean {
  return Boolean(min && max && min > max);
}

/** 250000 -> "250.000 €"  ·  null -> "—" */
export function euro(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return EUR.format(value);
}

export function num(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return NUM.format(value);
}

/** "2026-08-02" oppure "2026-08-02 14:30:00" -> "2 ago 2026" */
export function shortDate(value: string | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Con l'ora, per l'agenda: "2 ago 2026, 14:30" */
export function dateTime(value: string | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "3 giorni fa", "oggi", "fra 5 giorni" */
export function relative(value: string | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  // Giorni di calendario, non blocchi di 24 ore: alle dieci di sera,
  // l'appuntamento di domattina alle nove e' "domani", non "oggi".
  const mezzanotte = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round(
    (mezzanotte(date).getTime() - mezzanotte(new Date()).getTime()) / 864e5,
  );
  if (days === 0) return "oggi";
  if (days === 1) return "domani";
  if (days === -1) return "ieri";
  if (days < 0) return `${-days} giorni fa`;
  return `fra ${days} giorni`;
}

/** Quanti giorni sono passati da una data (numero, per i confronti). */
export function daysSince(value: string | null | undefined): number | null {
  const date = toDate(value);
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / 864e5);
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  // SQLite salva "YYYY-MM-DD HH:MM:SS": lo rendiamo interpretabile come UTC.
  const normalised = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const date = new Date(value.length === 10 ? value : normalised);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Nome completo di un cliente, con ripiego sulla ragione sociale. */
export function fullName(client: {
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
}): string {
  const person = [client.first_name, client.last_name].filter(Boolean).join(" ").trim();
  return person || client.company || "(senza nome)";
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

/** Trasforma "venditore,acquirente" in ["venditore", "acquirente"]. */
export function fromCsv(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function toCsv(values: (string | null | undefined)[]): string {
  return values.map((v) => (v ?? "").trim()).filter(Boolean).join(",");
}

/** Etichetta leggibile da un valore tecnico: "in_trattativa" -> "In trattativa". */
export function label(
  value: string | null | undefined,
  options: readonly { value: string; label: string }[],
): string {
  if (!value) return "—";
  return options.find((o) => o.value === value)?.label ?? value;
}

/** Numero di telefono pulito per il link tel: / WhatsApp. */
export function phoneHref(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/[^\d+]/g, "");
  return digits.length >= 6 ? digits : null;
}

/**
 * Collegamento wa.me pronto, con l'eventuale messaggio gia' scritto.
 *
 * WhatsApp vuole il numero in formato internazionale. Nell'archivio pero' i
 * numeri sono quasi tutti "3401112233", senza +39: passarli cosi' a wa.me
 * apre una chat sbagliata o vuota. Un numero italiano si riconosce: dieci
 * cifre che cominciano per 3 (cellulare) — a quello il prefisso lo mettiamo
 * noi. I numeri gia' internazionali (+39..., 0039...) passano come sono.
 */
export function whatsappHref(
  value: string | null | undefined,
  text?: string,
): string | null {
  const pulito = phoneHref(value);
  if (!pulito) return null;

  let cifre = pulito.replace(/\D/g, "");
  if (pulito.startsWith("+")) {
    // gia' internazionale
  } else if (cifre.startsWith("00")) {
    cifre = cifre.slice(2);
  } else if (cifre.length === 10 && cifre.startsWith("3")) {
    cifre = "39" + cifre;
  } else if (cifre.startsWith("0")) {
    // Fisso italiano: WhatsApp li' non c'e' quasi mai, ma il numero almeno
    // e' giusto.
    cifre = "39" + cifre;
  }

  const coda = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${cifre}${coda}`;
}

/**
 * L'etichetta di un immobile dentro una tendina: via, comune e prezzo.
 *
 * Sta qui e non dentro la query che la usava perche' le tendine sono tre e
 * pescano da fonti diverse. La stessa legge scritta in due posti si scolla al
 * primo ritocco, ed era gia' successo: "Collega un immobile" mostrava ancora
 * codice interno e titolo descrittivo quando le altre due erano gia' passate
 * all'indirizzo. Un solo posto, e non puo' succedere di nuovo.
 *
 * Dove manca la via o il comune — capita nei primi giorni di un'acquisizione,
 * prima che la scheda sia compilata — resta il titolo, cosi' l'immobile non
 * compare senza niente scritto accanto.
 */
export function etichettaImmobile(immobile: {
  title: string;
  address?: string | null;
  city?: string | null;
  price?: number | null;
}): string {
  const luogo = [immobile.address, immobile.city ? immobile.city.toUpperCase() : null]
    .filter(Boolean)
    .join(", ");
  const parti = [luogo || immobile.title];
  if (immobile.price !== null && immobile.price !== undefined) parti.push(euro(immobile.price));
  return parti.join(" — ");
}
