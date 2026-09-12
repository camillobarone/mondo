import type { ActivityRow } from "./queries";

/**
 * Generazione dei file di calendario (formato iCalendar, RFC 5545).
 *
 * Serve a due cose diverse, con lo stesso formato:
 *
 * - il **singolo appuntamento** da scaricare e aggiungere subito al proprio
 *   calendario. Arriva istantaneo, e la sveglia dei 30 minuti la fa il
 *   telefono: e' il modo piu' affidabile di ricevere l'avviso;
 * - l'**abbonamento**, un indirizzo che il calendario ricontrolla da solo e
 *   tiene allineato senza che nessuno debba fare niente.
 *
 * Si e' scelta questa strada e non le API di Google perche' funziona con
 * qualsiasi calendario (Google, Apple, Outlook), non richiede di collegare
 * account ne' di tenere credenziali sul server, e non smette di funzionare il
 * giorno in cui Google cambia le regole delle applicazioni non verificate.
 */

/** Durata predefinita di un appuntamento, in minuti. */
const DURATA = 60;

/** Quanto prima deve suonare l'avviso. */
export const PREAVVISO_MINUTI = 30;

const FUSO = "Europe/Rome";

/**
 * Il testo dentro un campo iCalendar non puo' contenere virgole, punti e
 * virgola, barre rovesciate e a capo cosi' come sono.
 */
function scappa(testo: string): string {
  return testo
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * L'orario di un appuntamento e' quello che l'agente ha scritto guardando
 * l'orologio: "2026-08-05T15:30" vuol dire le tre e mezza a Lecce, non un
 * istante assoluto. Va portato nel file com'e', dichiarando il fuso — se lo si
 * convertisse passando da `Date` si prenderebbe il fuso del server, che su una
 * macchina appena installata e' UTC, e l'appuntamento slitterebbe di due ore.
 */
function oraLocale(valore: string): string | null {
  const pezzi = valore.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!pezzi) return null;
  const [, anno, mese, giorno, ore, minuti] = pezzi;
  return `${anno}${mese}${giorno}T${ore}${minuti}00`;
}

/** Aggiunge minuti a un orario da orologio, restando sull'orologio. */
function piuMinuti(locale: string, minuti: number): string {
  const finto = new Date(
    `${locale.slice(0, 4)}-${locale.slice(4, 6)}-${locale.slice(6, 8)}T${locale.slice(
      9,
      11,
    )}:${locale.slice(11, 13)}:00Z`,
  );
  finto.setUTCMinutes(finto.getUTCMinutes() + minuti);
  return finto.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "");
}

/** Istante assoluto, per i campi che non riguardano l'appuntamento. */
function istante(valore: string): string {
  const data = new Date(valore.includes("T") ? valore : valore.replace(" ", "T") + "Z");
  return data.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Le righe oltre i 75 ottetti vanno spezzate, e quella dopo deve cominciare
 * con uno spazio. Senza, alcuni calendari scartano l'evento intero invece di
 * segnalare l'errore.
 */
function piega(riga: string): string {
  const byte = Buffer.from(riga, "utf8");
  if (byte.length <= 73) return riga;

  const pezzi: string[] = [];
  let inizio = 0;
  while (inizio < byte.length) {
    let fine = Math.min(inizio + (pezzi.length === 0 ? 73 : 72), byte.length);
    // Non spezzare a meta' di un carattere accentato.
    while (fine < byte.length && (byte[fine]! & 0xc0) === 0x80) fine--;
    pezzi.push(byte.subarray(inizio, fine).toString("utf8"));
    inizio = fine;
  }
  return pezzi.join("\r\n ");
}

/**
 * Le regole dell'ora legale italiana. Outlook rifiuta un evento con un fuso
 * che non conosce, quindi vanno scritte per esteso una volta sola.
 */
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${FUSO}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
].join("\r\n");

export interface EventoOpzioni {
  /** Indirizzo del gestionale, per il collegamento dentro l'evento. */
  base?: string;
  /** Mettere la sveglia dei 30 minuti prima. */
  avviso?: boolean;
}

/**
 * Un appuntamento dell'agenda diventa un evento. Restituisce null per le
 * attivita' senza data: una nota o una telefonata gia' fatta non e' un
 * appuntamento, e nel calendario sarebbe solo rumore.
 */
export function evento(
  attivita: ActivityRow,
  { base = "", avviso = true }: EventoOpzioni = {},
): string | null {
  if (!attivita.due_at) return null;
  const partenza = oraLocale(attivita.due_at);
  if (!partenza) return null;

  const titolo = [attivita.title || "Appuntamento", attivita.client_name]
    .filter(Boolean)
    .join(" · ");

  const descrizione = [
    attivita.client_name ? `Cliente: ${attivita.client_name}` : "",
    attivita.property_title ? `Immobile: ${attivita.property_title}` : "",
    attivita.notes ?? "",
    base && attivita.property_id ? `${base}/immobili/${attivita.property_id}` : "",
    base && !attivita.property_id && attivita.client_id
      ? `${base}/clienti/${attivita.client_id}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const righe = [
    "BEGIN:VEVENT",
    // Identificatore stabile: rimandando lo stesso appuntamento il calendario
    // aggiorna quello che ha gia', invece di aggiungerne un altro.
    `UID:attivita-${attivita.id}@mondo-crm`,
    `DTSTAMP:${istante(new Date().toISOString())}`,
    `DTSTART;TZID=${FUSO}:${partenza}`,
    `DTEND;TZID=${FUSO}:${piuMinuti(partenza, DURATA)}`,
    `SUMMARY:${scappa(titolo)}`,
    descrizione ? `DESCRIPTION:${scappa(descrizione)}` : "",
    attivita.property_title ? `LOCATION:${scappa(attivita.property_title)}` : "",
    `CATEGORIES:${scappa(attivita.type)}`,
    attivita.done_at ? "STATUS:CONFIRMED" : "STATUS:TENTATIVE",
  ].filter(Boolean);

  // Niente sveglia su quello che e' gia' stato fatto.
  if (avviso && !attivita.done_at) {
    righe.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${scappa(titolo)}`,
      `TRIGGER:-PT${PREAVVISO_MINUTI}M`,
      "END:VALARM",
    );
  }

  righe.push("END:VEVENT");
  return righe.map(piega).join("\r\n");
}

/** Mette gli eventi dentro un calendario completo, pronto da servire. */
export function calendario(
  eventi: string[],
  { nome = "Mondo Immobiliare" }: { nome?: string } = {},
): string {
  const testata = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mondo Immobiliare//Gestionale//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${scappa(nome)}`,
    `X-WR-TIMEZONE:${FUSO}`,
    // Ogni quanto il calendario dovrebbe ricontrollare. Apple e Outlook lo
    // rispettano; Google decide da se' e va per le sue.
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
    "X-PUBLISHED-TTL:PT15M",
  ].map(piega);

  return [...testata, VTIMEZONE, ...eventi, "END:VCALENDAR"].join("\r\n") + "\r\n";
}

/** Nome file pulito per lo scaricamento. */
export function nomeFile(titolo: string): string {
  const pulito = titolo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${pulito || "appuntamento"}.ics`;
}
