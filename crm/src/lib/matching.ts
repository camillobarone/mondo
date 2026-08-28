import { cache } from "react";
import { all } from "./db";
import { fromCsv, euro } from "./format";
import { leggiAree } from "./aree";
import type { Property, Requirement } from "./types";

/**
 * Incrocio richieste <-> immobili.
 *
 * Il punteggio conta quanti criteri della richiesta l'immobile soddisfa
 * davvero (i criteri non compilati non contano ne' a favore ne' contro).
 * Un immobile compare solo se non viola nessun criterio obbligatorio:
 * tipo di contratto, budget massimo e metri quadri minimi. Il budget minimo
 * non esclude niente: se costa meno del previsto, tanto meglio.
 *
 * PRESTAZIONI — con 500 richieste aperte e 150 immobili disponibili si
 * valutano 75.000 combinazioni a ogni apertura di pagina. Tre accorgimenti
 * tengono il calcolo sotto il decimo di secondo:
 *   1. richieste e immobili vengono "preparati" una volta sola (zone, comuni
 *      e requisiti gia' normalizzati), invece di rianalizzarli a ogni confronto;
 *   2. il confronto lavora solo su numeri e stringhe gia' pronte;
 *   3. le motivazioni testuali si costruiscono solo per gli abbinamenti che
 *      finiscono davvero sotto gli occhi dell'utente.
 */

export interface Match {
  property: Property;
  requirement: Requirement;
  score: number;      // criteri soddisfatti
  total: number;      // criteri valutati
  reasons: string[];  // perche' e' un buon incrocio
  warnings: string[]; // dove non corrisponde del tutto
}

interface Scored {
  property: Property;
  requirement: Requirement;
  score: number;
  total: number;
  misses: number;     // criteri non soddisfatti
}

/** Tolleranza sul budget massimo: un immobile poco sopra vale la telefonata. */
const BUDGET_TOLERANCE = 1.08;

/**
 * Confronto "come lo farebbe una persona": ignora maiuscole, accenti e
 * punteggiatura. Cosi' "S. Cataldo", "San Cataldo" e "san cataldo" non
 * diventano tre zone diverse solo perche' scritte in tre modi.
 */
function normalise(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Due luoghi si considerano lo stesso anche quando uno contiene l'altro:
 * "Centro" e "Centro storico", "Cataldo" e "San Cataldo", "Porto Cesareo" e
 * "Porto Cesareo (LE)". Sotto i 4 caratteri non si azzarda: troppo facile un
 * falso accostamento.
 */
function samePlace(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  return a.includes(b) || b.includes(a);
}

/**
 * Famiglie di immobili: cose che si possono ragionevolmente proporre l'una al
 * posto dell'altra. Un attico a chi cerca un appartamento vale la telefonata;
 * un locale commerciale a chi cerca casa no, e nemmeno un terreno o un box.
 *
 * Si riconosce dalla parola perche' la tipologia arriva anche dagli archivi
 * importati, dove non e' scritta come nel menu a tendina.
 */
const FAMIGLIE: { nome: string; parole: string[] }[] = [
  {
    nome: "commerciale",
    parole: [
      "commerciale", "negozio", "ufficio", "capannone", "laboratorio",
      "magazzino", "opificio", "bar", "ristorante", "albergo", "hotel",
    ],
  },
  { nome: "terreno", parole: ["terreno", "suolo", "lotto", "agricolo", "edificabile"] },
  { nome: "posto auto", parole: ["box", "garage", "autorimessa", "posto auto"] },
  {
    nome: "abitativo",
    parole: [
      "appartamento", "attico", "villa", "villetta", "casa", "abitazione",
      "trullo", "pajara", "masseria", "rustico", "monolocale", "bilocale",
      "trilocale", "quadrilocale", "loft", "mansarda", "palazzo", "dimora",
    ],
  },
];

/**
 * A quale famiglia appartiene una tipologia. `null` quando non si riconosce:
 * in quel caso non si esclude niente, si lascia decidere all'agente.
 */
function famiglia(kind: string): string | null {
  for (const gruppo of FAMIGLIE) {
    if (gruppo.parole.some((parola) => kind.includes(parola))) return gruppo.nome;
  }
  return null;
}

/* ------------------------------------------------------------ preparazione */

interface AreaPronta {
  comune: string;
  zone: string[];
}

interface ReadyRequirement {
  source: Requirement;
  contract: string;
  /** Le tipologie accettate. Vuoto = indifferente. */
  kinds: string[];
  /** Un comune per area, con le sue zone. Zone vuote = tutto il comune. */
  aree: AreaPronta[];
  /** Gli stati accettati. Vuoto = indifferente. */
  conditions: string[];
  needsElevator: boolean;
  needsGarage: boolean;
  needsOutdoor: boolean;
  budgetMin: number;
  budgetMax: number;
  sqmMin: number;
  roomsMin: number;
}

interface ReadyProperty {
  source: Property;
  contract: string;
  kind: string;
  city: string;
  zone: string;
  condition: string;
  price: number;
  sqm: number;
  rooms: number;
  elevator: boolean;
  garage: boolean;
  outdoor: boolean;
}

function prepareRequirement(requirement: Requirement): ReadyRequirement {
  const needs = fromCsv(requirement.needs);
  return {
    source: requirement,
    contract: normalise(requirement.contract),
    kinds: fromCsv(requirement.kind).map(normalise).filter(Boolean),
    aree: leggiAree(requirement).map((area) => ({
      comune: normalise(area.comune),
      zone: area.zone.map(normalise).filter(Boolean),
    })),
    conditions: fromCsv(requirement.conditions).map(normalise).filter(Boolean),
    needsElevator: needs.includes("ascensore"),
    needsGarage: needs.includes("box"),
    needsOutdoor: needs.includes("esterno"),
    budgetMin: requirement.budget_min ?? 0,
    budgetMax: requirement.budget_max ?? 0,
    sqmMin: requirement.sqm_min ?? 0,
    roomsMin: requirement.rooms_min ?? 0,
  };
}

function prepareProperty(property: Property): ReadyProperty {
  return {
    source: property,
    contract: normalise(property.contract),
    kind: normalise(property.kind),
    city: normalise(property.city),
    zone: normalise(property.zone),
    condition: normalise(property.condition),
    price: property.price ?? 0,
    sqm: property.sqm ?? 0,
    rooms: property.rooms ?? 0,
    elevator: property.elevator === 1,
    garage: property.garage === 1,
    outdoor: !!property.outdoor && normalise(property.outdoor) !== "nessuno",
  };
}

/**
 * Le zone che contano per un immobile: quelle chieste nel comune dove
 * l'immobile si trova davvero, piu' quelle delle aree senza comune.
 *
 * Restituisce `null` quando la zona non e' un criterio da valutare, e i casi
 * sono due, diversi fra loro ma con la stessa conseguenza:
 *
 *   - per quel comune non e' stata scelta nessuna zona, cioe' va bene tutto il
 *     comune. Contarlo come criterio sempre soddisfatto gonfierebbe il
 *     punteggio di ogni immobile di quel comune allo stesso modo, che e' come
 *     non contarlo — ma con un numero piu' alto e meno leggibile;
 *   - le zone chieste riguardano altri comuni, e su questo immobile non
 *     dicono niente.
 */
function zoneApplicabili(
  requirement: ReadyRequirement,
  property: ReadyProperty,
): string[] | null {
  const applicabili = requirement.aree.filter(
    (area) => !area.comune || samePlace(area.comune, property.city),
  );
  if (!applicabili.length) return null;
  if (applicabili.some((area) => !area.zone.length)) return null;
  const zone = applicabili.flatMap((area) => area.zone);
  return zone.length ? zone : null;
}

/* -------------------------------------------------------------- confronto */

/** Perche' un immobile non e' stato proposto a una richiesta. */
export type Rejection = "contratto" | "comune" | "tipologia" | "budget" | "metratura";

type Verdict =
  | { ok: true; score: number; total: number; misses: number }
  | { ok: false; reason: Rejection; gap: number };

/**
 * Conta i criteri soddisfatti, oppure spiega perche' l'immobile e' escluso.
 * `gap` dice di quanto si sbaglia: euro oltre il budget, metri sotto il minimo.
 * Serve a rispondere alla domanda "perche' non me l'ha segnalato?".
 */
function evaluate(requirement: ReadyRequirement, property: ReadyProperty): Verdict {
  // --- criteri che escludono l'immobile ---------------------------------
  if (property.contract !== requirement.contract) {
    return { ok: false, reason: "contratto", gap: 0 };
  }
  // Il comune esclude: chi cerca a Lecce non si sposta a Gallipoli perche'
  // l'immobile e' bello. Sulla zona invece si transige — dentro lo stesso
  // comune una via vicina resta una proposta sensata.
  //
  // I comuni ora possono essere piu' d'uno: basta che l'immobile stia in uno
  // qualsiasi di quelli chiesti. Le aree senza comune (arrivano dalle
  // richieste importate, dove la zona c'era e il comune no) non escludono
  // niente: non saprebbero cosa escludere.
  const comuniChiesti = requirement.aree.map((area) => area.comune).filter(Boolean);
  if (
    comuniChiesti.length &&
    property.city &&
    !comuniChiesti.some((comune) => samePlace(comune, property.city))
  ) {
    return { ok: false, reason: "comune", gap: 0 };
  }
  // La tipologia esclude solo quando le famiglie sono davvero diverse: un
  // locale commerciale a chi cerca casa non e' una proposta, e' rumore. Fra
  // tipologie della stessa famiglia (attico invece di appartamento) si segnala
  // e basta.
  //
  // Con piu' tipologie chieste si esclude soltanto se **nessuna** e' della
  // famiglia dell'immobile, e solo quando si riconoscono tutte: se anche una
  // sola non si riconosce — succede con le tipologie degli archivi importati —
  // non si sa abbastanza per escludere, e decide l'agente.
  const offerta = famiglia(property.kind);
  const famiglieChieste = requirement.kinds.map(famiglia);
  if (
    offerta &&
    famiglieChieste.length &&
    famiglieChieste.every((nome) => nome !== null) &&
    !famiglieChieste.includes(offerta)
  ) {
    return { ok: false, reason: "tipologia", gap: 0 };
  }
  if (requirement.budgetMax && property.price > requirement.budgetMax * BUDGET_TOLERANCE) {
    return { ok: false, reason: "budget", gap: property.price - requirement.budgetMax };
  }
  // Il budget minimo NON esclude: costare meno del previsto non e' un
  // difetto, e un affare sotto le attese vale sempre la telefonata. Pesa
  // solo sul punteggio, cosi' resta in fondo all'elenco invece che fuori.
  if (requirement.sqmMin && property.sqm && property.sqm < requirement.sqmMin * 0.9) {
    return { ok: false, reason: "metratura", gap: requirement.sqmMin - property.sqm };
  }

  let hits = 0;
  let total = 0;
  let misses = 0;
  const check = (satisfied: boolean) => {
    total++;
    if (satisfied) hits++;
    else misses++;
  };

  if (requirement.budgetMax) check(property.price > 0 && property.price <= requirement.budgetMax);
  if (requirement.budgetMin) check(property.price >= requirement.budgetMin);
  if (requirement.kinds.length) check(requirement.kinds.includes(property.kind));
  if (comuniChiesti.length) {
    check(comuniChiesti.some((comune) => samePlace(comune, property.city)));
  }
  // Contano solo le zone del comune in cui l'immobile si trova davvero: le
  // zone chieste a Porto Cesareo non dicono niente su un immobile di Lecce.
  // Se per quel comune non e' stata scelta nessuna zona, vuol dire tutto il
  // comune, e la zona non e' un criterio: non si conta, altrimenti sarebbe un
  // punto regalato a ogni immobile.
  const zoneChieste = zoneApplicabili(requirement, property);
  if (zoneChieste) check(zoneChieste.some((zone) => samePlace(zone, property.zone)));
  // Lo stato pesa ma non esclude, come i vani e l'ascensore: "da rivedere"
  // quando si cercava "ottimo" e' una telefonata in meno da fare, non un
  // immobile da nascondere.
  if (requirement.conditions.length && property.condition) {
    check(requirement.conditions.includes(property.condition));
  }
  if (requirement.sqmMin) check(property.sqm >= requirement.sqmMin);
  if (requirement.roomsMin) check(property.rooms >= requirement.roomsMin);
  if (requirement.needsElevator) check(property.elevator);
  if (requirement.needsGarage) check(property.garage);
  if (requirement.needsOutdoor) check(property.outdoor);

  return { ok: true, score: hits, total, misses };
}

/** Conta i criteri soddisfatti. Restituisce null se l'immobile va escluso. */
function score(
  requirement: ReadyRequirement,
  property: ReadyProperty,
): { score: number; total: number; misses: number } | null {
  const verdict = evaluate(requirement, property);
  return verdict.ok ? verdict : null;
}

/** Scrive le motivazioni: chiamata solo sugli abbinamenti da mostrare. */
function explain(scored: Scored): Match {
  const requirement = prepareRequirement(scored.requirement);
  const property = prepareProperty(scored.property);
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (requirement.budgetMax) {
    if (property.price > 0 && property.price <= requirement.budgetMax) {
      reasons.push("Rientra nel budget");
    } else if (property.price > 0) {
      warnings.push("Poco sopra il budget");
    }
  }
  if (requirement.budgetMin && property.price > 0 && property.price < requirement.budgetMin) {
    warnings.push(`Sotto il minimo che cercava (${euro(requirement.budgetMin)})`);
  }
  if (requirement.kinds.length) {
    if (requirement.kinds.includes(property.kind)) {
      reasons.push(`Tipologia: ${scored.property.kind}`);
    } else {
      warnings.push(`Tipologia diversa (${scored.property.kind || "non indicata"})`);
    }
  }
  const comuniChiesti = requirement.aree.map((area) => area.comune).filter(Boolean);
  if (comuniChiesti.length) {
    if (comuniChiesti.some((comune) => samePlace(comune, property.city))) {
      reasons.push(`Comune: ${scored.property.city}`);
    } else {
      warnings.push(`Comune non indicato sull'immobile`);
    }
  }
  const zoneChieste = zoneApplicabili(requirement, property);
  if (zoneChieste) {
    if (zoneChieste.some((zone) => samePlace(zone, property.zone))) {
      reasons.push(`Zona richiesta: ${scored.property.zone}`);
    } else {
      warnings.push(`Fuori dalle zone richieste (${scored.property.zone || "zona non indicata"})`);
    }
  }
  if (requirement.conditions.length && property.condition) {
    if (requirement.conditions.includes(property.condition)) {
      reasons.push(`Stato: ${scored.property.condition}`);
    } else {
      warnings.push(`Stato diverso da quello cercato (${scored.property.condition})`);
    }
  }
  if (requirement.sqmMin) {
    if (property.sqm >= requirement.sqmMin) reasons.push(`${scored.property.sqm} mq`);
    else warnings.push("Metratura sotto il minimo richiesto");
  }
  if (requirement.roomsMin) {
    if (property.rooms >= requirement.roomsMin) reasons.push(`${scored.property.rooms} vani`);
    else warnings.push("Meno vani del richiesto");
  }
  if (requirement.needsElevator) {
    if (property.elevator) reasons.push("Ha ascensore");
    else warnings.push("Manca: ascensore");
  }
  if (requirement.needsGarage) {
    if (property.garage) reasons.push("Ha il box");
    else warnings.push("Manca: box");
  }
  if (requirement.needsOutdoor) {
    if (property.outdoor) reasons.push("Ha esterno");
    else warnings.push("Manca: esterno");
  }

  return {
    property: scored.property,
    requirement: scored.requirement,
    score: scored.score,
    total: scored.total,
    reasons,
    warnings,
  };
}

function byQuality(a: Scored, b: Scored): number {
  return b.score - a.score || a.misses - b.misses;
}

/* ----------------------------------------------------------- dati di base */

/**
 * Immobili ancora proponibili, gia' preparati per il confronto.
 *
 * Sono i propri, e basta: gli incroci girano dentro l'archivio di chi guarda.
 * La segnalazione degli incroci fra colleghi — un mio acquirente e l'immobile
 * di un altro — e' un'altra cosa, con altre regole su cosa si puo' mostrare,
 * e non passa da qui.
 *
 * Memorizzato per singola richiesta HTTP e per persona: la stessa pagina puo'
 * incrociare centinaia di richieste senza rileggere il portafoglio ogni volta.
 */
const availableProperties = cache((utente: number): ReadyProperty[] =>
  all<Property>(
    `SELECT p.* FROM properties p
      WHERE p.deleted_at IS NULL
        AND p.agent_id = ?
        AND p.status IN ('acquisizione', 'in_vendita')
      ORDER BY p.updated_at DESC`,
    [utente],
  ).map(prepareProperty),
);

const openRequirements = cache(
  (utente: number): (ReadyRequirement & { clientName: string; clientPhone: string | null })[] =>
    all<Requirement & { client_name: string; client_phone: string | null }>(
      `SELECT r.*,
              TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) AS client_name,
              COALESCE(c.mobile, c.phone) AS client_phone
         FROM requirements r
         JOIN clients c ON c.id = r.client_id
        WHERE r.status = 'aperta'
          AND c.deleted_at IS NULL
          AND c.owner_id = ?
        ORDER BY r.updated_at DESC`,
      [utente],
    ).map((row) => ({
      ...prepareRequirement(row),
      clientName: row.client_name,
      clientPhone: row.client_phone,
    })),
);

function scoreAgainstPortfolio(utente: number, requirement: Requirement): Scored[] {
  const ready = prepareRequirement(requirement);
  const results: Scored[] = [];

  for (const property of availableProperties(utente)) {
    const outcome = score(ready, property);
    if (outcome) results.push({ property: property.source, requirement, ...outcome });
  }

  return results.sort(byQuality);
}

/* ---------------------------------------------------------- API pubblica */

/** Immobili che corrispondono a una richiesta, i migliori per primi. */
export function matchesForRequirement(
  utente: number,
  requirement: Requirement,
  limit = 20,
): Match[] {
  return scoreAgainstPortfolio(utente, requirement).slice(0, limit).map(explain);
}

/**
 * Riepilogo per gli elenchi: quanti immobili corrispondono, quanti in pieno,
 * e i primi da mostrare.
 */
export function requirementSummary(
  utente: number,
  requirement: Requirement,
  top = 4,
): { count: number; perfect: number; top: Match[] } {
  const scored = scoreAgainstPortfolio(utente, requirement);
  let perfect = 0;
  for (const item of scored) if (item.misses === 0) perfect++;

  return { count: scored.length, perfect, top: scored.slice(0, top).map(explain) };
}

/** Richieste che corrispondono a un immobile: "a chi lo propongo?". */
export function matchesForProperty(
  utente: number,
  property: Property,
  limit = 12,
): (Match & { client_name: string; client_phone: string | null })[] {
  const ready = prepareProperty(property);
  const scored: (Scored & { client_name: string; client_phone: string | null })[] = [];

  for (const requirement of openRequirements(utente)) {
    const outcome = score(requirement, ready);
    if (outcome) {
      scored.push({
        property,
        requirement: requirement.source,
        ...outcome,
        client_name: requirement.clientName,
        client_phone: requirement.clientPhone,
      });
    }
  }

  return scored
    .sort(byQuality)
    .slice(0, limit)
    .map((item) => ({
      ...explain(item),
      client_name: item.client_name,
      client_phone: item.client_phone,
    }));
}

/** Quanti clienti aspettano un immobile come questo. */
export function countMatchesForProperty(utente: number, property: Property): number {
  const ready = prepareProperty(property);
  let count = 0;
  for (const requirement of openRequirements(utente)) {
    if (score(requirement, ready)) count++;
  }
  return count;
}

export interface NearMiss {
  requirement: Requirement;
  clientName: string;
  reason: Rejection;
  gap: number;
}

/**
 * Richieste scartate per questo immobile, con il motivo. Risponde alla
 * domanda "perche' non me l'ha proposto al cliente Tal dei Tali?" senza
 * doverci mettere mano. Contratto, comune e tipologia si contano ma non si
 * elencano: sono differenze su cui non c'e' niente da valutare, elencarle
 * seppellirebbe le due che contano davvero.
 */
export function nearMissesForProperty(
  utente: number,
  property: Property,
  limit = 6,
): { total: number; byReason: Record<Rejection, number>; items: NearMiss[] } {
  const ready = prepareProperty(property);
  const byReason: Record<Rejection, number> = {
    contratto: 0,
    comune: 0,
    tipologia: 0,
    budget: 0,
    metratura: 0,
  };
  const items: NearMiss[] = [];

  for (const requirement of openRequirements(utente)) {
    const verdict = evaluate(requirement, ready);
    if (verdict.ok) continue;

    byReason[verdict.reason]++;
    if (verdict.reason === "budget" || verdict.reason === "metratura") {
      items.push({
        requirement: requirement.source,
        clientName: requirement.clientName,
        reason: verdict.reason,
        gap: verdict.gap,
      });
    }
  }

  const total = Object.values(byReason).reduce((somma, quanti) => somma + quanti, 0);
  // I piu' vicini per primi: sono quelli su cui vale la pena ragionare.
  items.sort((a, b) => a.gap - b.gap);

  return { total, byReason, items: items.slice(0, limit) };
}

export interface ClientMatches {
  clientId: number;
  clientName: string;
  /** Cellulare (o fisso) del cliente: serve al pulsante WhatsApp. */
  clientPhone: string | null;
  total: number;
  matches: Match[];
}

/**
 * Tutti gli incroci aperti, raggruppati per cliente: una telefonata sola
 * puo' coprire piu' immobili.
 */
export function matchesByClient(
  utente: number,
  {
    minimumScore = 1,
    onlyPerfect = false,
    perClient = 8,
    page = 1,
    clientsPerPage = 25,
  }: {
    minimumScore?: number;
    onlyPerfect?: boolean;
    perClient?: number;
    page?: number;
    clientsPerPage?: number;
  } = {},
): { groups: ClientMatches[]; total: number; clients: number; page: number; pages: number } {
  const properties = availableProperties(utente);
  const byClient = new Map<number, { name: string; phone: string | null; scored: Scored[] }>();
  let total = 0;

  for (const requirement of openRequirements(utente)) {
    for (const property of properties) {
      const outcome = score(requirement, property);
      if (!outcome) continue;
      // Una richiesta senza criteri (solo "compra") non ha niente da
      // soddisfare: si mostra lo stesso, non si nasconde.
      if (outcome.total > 0 && outcome.score < minimumScore) continue;
      if (onlyPerfect && outcome.misses > 0) continue;

      total++;
      let group = byClient.get(requirement.source.client_id);
      if (!group) {
        group = { name: requirement.clientName, phone: requirement.clientPhone, scored: [] };
        byClient.set(requirement.source.client_id, group);
      }
      group.scored.push({
        property: property.source,
        requirement: requirement.source,
        ...outcome,
      });
    }
  }

  // Ordina i clienti per qualita' del miglior abbinamento, poi costruisce le
  // motivazioni solo per la pagina richiesta: e' quello che l'utente legge.
  const ordered = [...byClient.entries()]
    .map(([clientId, group]) => {
      const scored = group.scored.sort(byQuality);
      return { clientId, name: group.name, phone: group.phone, scored, best: scored[0]! };
    })
    .sort(
      (a, b) =>
        b.best.score - a.best.score ||
        a.best.misses - b.best.misses ||
        b.scored.length - a.scored.length,
    );

  const pages = Math.max(1, Math.ceil(ordered.length / clientsPerPage));
  const current = Math.min(Math.max(1, page), pages);

  const groups: ClientMatches[] = ordered
    .slice((current - 1) * clientsPerPage, current * clientsPerPage)
    .map((entry) => ({
      clientId: entry.clientId,
      clientName: entry.name,
      clientPhone: entry.phone,
      total: entry.scored.length,
      matches: entry.scored.slice(0, perClient).map(explain),
    }));

  return { groups, total, clients: ordered.length, page: current, pages };
}

/* ============================================ incroci fra colleghi */

/**
 * Qui, e solo qui, il confronto attraversa il muro.
 *
 * Serve a rispondere a una domanda sola: "il collega ha qualcosa per il mio
 * cliente, o un cliente per il mio immobile?". La risposta utile e' si' o no —
 * a quel punto ci si telefona, come si e' sempre fatto fra agenzie.
 *
 * La regola di cosa passa e cosa no e' semplice da tenere a mente:
 * **le caratteristiche si', l'identita' no.** Di un immobile altrui si vedono
 * tipologia, comune, zona, metri, vani e prezzo richiesto — cioe' quello che
 * un collega direbbe al telefono. Non si vedono il prezzo minimo che il
 * proprietario accetterebbe, le provvigioni, le note interne, ne' chi e' il
 * proprietario. Di una richiesta altrui si vede cosa cerca e con che budget;
 * non si vede **mai** chi la sta cercando, ne' il suo numero.
 *
 * Il prezzo minimo in particolare non deve uscire per nessun motivo: e' la
 * soglia sotto cui il venditore non scende, e conoscerla vuol dire sedersi al
 * tavolo sapendo la mano dell'altro.
 */

/** Un immobile di un collega, ridotto a cio' che si puo' dire al telefono. */
export interface ImmobileDiUnCollega {
  id: number;
  titolo: string;
  tipologia: string;
  contratto: string;
  comune: string | null;
  zona: string | null;
  mq: number | null;
  vani: number | null;
  prezzo: number | null;
}

/** Una richiesta di un collega. Chi l'ha fatta non compare, in nessun campo. */
export interface RichiestaDiUnCollega {
  id: number;
  contratto: string;
  tipologia: string | null;
  comune: string | null;
  zone: string;
  budgetMin: number | null;
  budgetMax: number | null;
  mqMin: number | null;
  vaniMin: number | null;
}

export interface Collega {
  id: number;
  nome: string;
  email: string;
}

export interface IncrocioCollega {
  /** Da che parte sta la cosa mia: il cliente o l'immobile. */
  verso: "mio-cliente" | "mio-immobile";
  collega: Collega;
  punteggio: number;
  totale: number;
  motivi: string[];
  avvertenze: string[];
  /** Presenti a coppie: uno dei due lati e' mio, l'altro del collega. */
  mioCliente?: { id: number; nome: string; telefono: string | null; richiestaId: number };
  immobileDelCollega?: ImmobileDiUnCollega;
  mioImmobile?: { id: number; titolo: string; prezzo: number | null };
  richiestaDelCollega?: RichiestaDiUnCollega;
}

/**
 * Gli immobili dei colleghi, con le sole colonne che possono uscire.
 *
 * La selezione e' scritta campo per campo apposta: un `SELECT *` qui, oggi o
 * fra due anni, porterebbe fuori prezzo minimo, provvigioni e note interne
 * senza che nessuno se ne accorga.
 */
const immobiliDeiColleghi = cache(
  (utente: number): (ReadyProperty & { collega: Collega })[] =>
    all<{
      id: number; title: string; kind: string; contract: string;
      city: string | null; zone: string | null; condition: string | null;
      sqm: number | null; rooms: number | null; price: number | null;
      elevator: number; garage: number; outdoor: string | null;
      agente_id: number; agente_nome: string; agente_email: string;
    }>(
      // `p.condition` e' una caratteristica dell'immobile, come i metri o la
      // zona: sta fra le cose che del collega si vedono. Serve perche' la
      // richiesta ora dice anche in che stato l'acquirente lo accetta.
      `SELECT p.id, p.title, p.kind, p.contract, p.city, p.zone, p.condition,
              p.sqm, p.rooms, p.price, p.elevator, p.garage, p.outdoor,
              u.id AS agente_id, u.name AS agente_nome, u.email AS agente_email
         FROM properties p
         JOIN users u ON u.id = p.agent_id
        WHERE p.deleted_at IS NULL
          AND p.agent_id != ?
          AND u.active = 1
          AND p.status IN ('acquisizione', 'in_vendita')
        ORDER BY p.updated_at DESC`,
      [utente],
    ).map((riga) => ({
      ...prepareProperty({
        id: riga.id, title: riga.title, kind: riga.kind, contract: riga.contract,
        city: riga.city, zone: riga.zone, condition: riga.condition,
        sqm: riga.sqm, rooms: riga.rooms,
        price: riga.price, elevator: riga.elevator, garage: riga.garage,
        outdoor: riga.outdoor,
      } as Property),
      collega: { id: riga.agente_id, nome: riga.agente_nome, email: riga.agente_email },
    })),
);

/**
 * Le richieste aperte dei colleghi, senza chi le ha fatte.
 *
 * `client_id` non viene nemmeno letto: cosi' non c'e' niente da cui ricavare
 * un collegamento a quella scheda, neanche per sbaglio in una pagina scritta
 * domani.
 */
const richiesteDeiColleghi = cache(
  (utente: number): (ReadyRequirement & { collega: Collega })[] =>
    all<{
      id: number; contract: string; kind: string | null; city: string | null;
      zones: string; areas: string; conditions: string; needs: string;
      budget_min: number | null; budget_max: number | null;
      sqm_min: number | null; rooms_min: number | null;
      referente_id: number; referente_nome: string; referente_email: string;
    }>(
      // `areas` e `conditions` sono luoghi e stati di un immobile, non dicono
      // niente su chi cerca: restano dalla parte delle caratteristiche, che si
      // vedono. Senza, gli incroci con i colleghi userebbero solo il comune
      // vecchio e ignorerebbero le altre aree — meno proposte, in silenzio.
      `SELECT r.id, r.contract, r.kind, r.city, r.zones, r.areas, r.conditions, r.needs,
              r.budget_min, r.budget_max, r.sqm_min, r.rooms_min,
              u.id AS referente_id, u.name AS referente_nome, u.email AS referente_email
         FROM requirements r
         JOIN clients c ON c.id = r.client_id
         JOIN users   u ON u.id = c.owner_id
        WHERE r.status = 'aperta'
          AND c.deleted_at IS NULL
          AND c.owner_id != ?
          AND u.active = 1
        ORDER BY r.updated_at DESC`,
      [utente],
    ).map((riga) => ({
      ...prepareRequirement({
        id: riga.id, contract: riga.contract, kind: riga.kind, city: riga.city,
        zones: riga.zones, areas: riga.areas, conditions: riga.conditions,
        needs: riga.needs,
        budget_min: riga.budget_min, budget_max: riga.budget_max,
        sqm_min: riga.sqm_min, rooms_min: riga.rooms_min,
        // Non e' il vero cliente: e' un turacciolo, perche' il tipo lo vuole e
        // il numero vero non deve entrare in memoria da questa parte del muro.
        client_id: 0,
      } as Requirement),
      collega: { id: riga.referente_id, nome: riga.referente_nome, email: riga.referente_email },
    })),
);

function immobileVisibile(pronto: ReadyProperty): ImmobileDiUnCollega {
  const p = pronto.source;
  return {
    id: p.id,
    titolo: p.title,
    tipologia: p.kind,
    contratto: p.contract,
    comune: p.city,
    zona: p.zone,
    mq: p.sqm,
    vani: p.rooms,
    prezzo: p.price,
  };
}

function richiestaVisibile(pronta: ReadyRequirement): RichiestaDiUnCollega {
  const r = pronta.source;
  return {
    id: r.id,
    contratto: r.contract,
    tipologia: r.kind,
    comune: r.city,
    zone: r.zones,
    budgetMin: r.budget_min,
    budgetMax: r.budget_max,
    mqMin: r.sqm_min,
    vaniMin: r.rooms_min,
  };
}

/**
 * Tutti gli incroci che scavalcano il muro, nei due versi.
 *
 * Vale la stessa severita' degli incroci propri: comune diverso, famiglia di
 * tipologia diversa, fuori budget o sotto metratura restano fuori. Una
 * segnalazione fra colleghi costa una telefonata a qualcuno: deve valerla.
 */
export function incrociFraColleghi(
  utente: number,
  { limite = 60 }: { limite?: number } = {},
): { incroci: IncrocioCollega[]; totale: number; colleghi: string[] } {
  const mieRichieste = openRequirements(utente);
  const mieiImmobili = availableProperties(utente);
  const loroImmobili = immobiliDeiColleghi(utente);
  const loroRichieste = richiesteDeiColleghi(utente);

  const raccolti: (IncrocioCollega & { misses: number })[] = [];
  const colleghi = new Set<string>();

  // Verso 1: un mio acquirente e l'immobile di un collega.
  for (const richiesta of mieRichieste) {
    for (const immobile of loroImmobili) {
      const esito = score(richiesta, immobile);
      if (!esito) continue;

      const spiegato = explain({
        property: immobile.source,
        requirement: richiesta.source,
        ...esito,
      });
      colleghi.add(immobile.collega.nome);
      raccolti.push({
        verso: "mio-cliente",
        collega: immobile.collega,
        punteggio: esito.score,
        totale: esito.total,
        misses: esito.misses,
        motivi: spiegato.reasons,
        avvertenze: spiegato.warnings,
        mioCliente: {
          id: richiesta.source.client_id,
          nome: richiesta.clientName,
          telefono: richiesta.clientPhone,
          richiestaId: richiesta.source.id,
        },
        immobileDelCollega: immobileVisibile(immobile),
      });
    }
  }

  // Verso 2: un mio immobile e l'acquirente di un collega.
  for (const richiesta of loroRichieste) {
    for (const immobile of mieiImmobili) {
      const esito = score(richiesta, immobile);
      if (!esito) continue;

      const spiegato = explain({
        property: immobile.source,
        requirement: richiesta.source,
        ...esito,
      });
      colleghi.add(richiesta.collega.nome);
      raccolti.push({
        verso: "mio-immobile",
        collega: richiesta.collega,
        punteggio: esito.score,
        totale: esito.total,
        misses: esito.misses,
        motivi: spiegato.reasons,
        avvertenze: spiegato.warnings,
        mioImmobile: {
          id: immobile.source.id,
          titolo: immobile.source.title,
          prezzo: immobile.source.price,
        },
        richiestaDelCollega: richiestaVisibile(richiesta),
      });
    }
  }

  raccolti.sort((a, b) => b.punteggio - a.punteggio || a.misses - b.misses);

  return {
    incroci: raccolti.slice(0, limite).map(({ misses: _misses, ...resto }) => resto),
    totale: raccolti.length,
    colleghi: [...colleghi].sort((a, b) => a.localeCompare(b, "it")),
  };
}
