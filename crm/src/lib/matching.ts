import { cache } from "react";
import { all } from "./db";
import { fromCsv, euro } from "./format";
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

interface ReadyRequirement {
  source: Requirement;
  contract: string;
  kind: string;
  city: string;
  zones: string[];
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
    kind: normalise(requirement.kind),
    city: normalise(requirement.city),
    zones: fromCsv(requirement.zones).map(normalise),
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
    price: property.price ?? 0,
    sqm: property.sqm ?? 0,
    rooms: property.rooms ?? 0,
    elevator: property.elevator === 1,
    garage: property.garage === 1,
    outdoor: !!property.outdoor && normalise(property.outdoor) !== "nessuno",
  };
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
  if (requirement.city && property.city && !samePlace(requirement.city, property.city)) {
    return { ok: false, reason: "comune", gap: 0 };
  }
  // La tipologia esclude solo quando le due famiglie sono davvero diverse:
  // un locale commerciale a chi cerca casa non e' una proposta, e' rumore.
  // Fra tipologie della stessa famiglia (attico invece di appartamento) si
  // segnala e basta.
  const cercata = famiglia(requirement.kind);
  const offerta = famiglia(property.kind);
  if (cercata && offerta && cercata !== offerta) {
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
  if (requirement.kind) check(property.kind === requirement.kind);
  if (requirement.city) check(samePlace(requirement.city, property.city));
  if (requirement.zones.length) {
    check(requirement.zones.some((zone) => samePlace(zone, property.zone)));
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
  if (requirement.kind) {
    if (property.kind === requirement.kind) reasons.push(`Tipologia: ${scored.property.kind}`);
    else warnings.push(`Tipologia diversa (${scored.property.kind || "non indicata"})`);
  }
  if (requirement.city) {
    if (samePlace(requirement.city, property.city)) reasons.push(`Comune: ${scored.property.city}`);
    else warnings.push(`Comune non indicato sull'immobile`);
  }
  if (requirement.zones.length) {
    if (requirement.zones.some((zone) => samePlace(zone, property.zone))) {
      reasons.push(`Zona richiesta: ${scored.property.zone}`);
    } else {
      warnings.push(`Fuori dalle zone richieste (${scored.property.zone || "zona non indicata"})`);
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
 * Immobili ancora proponibili, gia' preparati per il confronto. Memorizzato
 * per singola richiesta HTTP: la stessa pagina puo' incrociare centinaia di
 * richieste senza rileggere ne' rianalizzare il portafoglio ogni volta.
 */
const availableProperties = cache((): ReadyProperty[] =>
  all<Property>(
    `SELECT * FROM properties
      WHERE deleted_at IS NULL
        AND status IN ('acquisizione', 'in_vendita')
      ORDER BY updated_at DESC`,
  ).map(prepareProperty),
);

const openRequirements = cache(
  (): (ReadyRequirement & { clientName: string; clientPhone: string | null })[] =>
    all<Requirement & { client_name: string; client_phone: string | null }>(
      `SELECT r.*,
              TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) AS client_name,
              COALESCE(c.mobile, c.phone) AS client_phone
         FROM requirements r
         JOIN clients c ON c.id = r.client_id
        WHERE r.status = 'aperta'
          AND c.deleted_at IS NULL
        ORDER BY r.updated_at DESC`,
    ).map((row) => ({
      ...prepareRequirement(row),
      clientName: row.client_name,
      clientPhone: row.client_phone,
    })),
);

function scoreAgainstPortfolio(requirement: Requirement): Scored[] {
  const ready = prepareRequirement(requirement);
  const results: Scored[] = [];

  for (const property of availableProperties()) {
    const outcome = score(ready, property);
    if (outcome) results.push({ property: property.source, requirement, ...outcome });
  }

  return results.sort(byQuality);
}

/* ---------------------------------------------------------- API pubblica */

/** Immobili che corrispondono a una richiesta, i migliori per primi. */
export function matchesForRequirement(requirement: Requirement, limit = 20): Match[] {
  return scoreAgainstPortfolio(requirement).slice(0, limit).map(explain);
}

/**
 * Riepilogo per gli elenchi: quanti immobili corrispondono, quanti in pieno,
 * e i primi da mostrare.
 */
export function requirementSummary(
  requirement: Requirement,
  top = 4,
): { count: number; perfect: number; top: Match[] } {
  const scored = scoreAgainstPortfolio(requirement);
  let perfect = 0;
  for (const item of scored) if (item.misses === 0) perfect++;

  return { count: scored.length, perfect, top: scored.slice(0, top).map(explain) };
}

/** Richieste che corrispondono a un immobile: "a chi lo propongo?". */
export function matchesForProperty(
  property: Property,
  limit = 12,
): (Match & { client_name: string; client_phone: string | null })[] {
  const ready = prepareProperty(property);
  const scored: (Scored & { client_name: string; client_phone: string | null })[] = [];

  for (const requirement of openRequirements()) {
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
export function countMatchesForProperty(property: Property): number {
  const ready = prepareProperty(property);
  let count = 0;
  for (const requirement of openRequirements()) {
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

  for (const requirement of openRequirements()) {
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

export interface PriceInterest {
  /** Richieste aperte che oggi corrispondono davvero. */
  matching: number;
  /** Chi e' stato escluso soltanto dal prezzo, con il budget che aveva. */
  blockedByPrice: { clientName: string; budgetMax: number }[];
  /** Fascia in cui quei clienti avrebbero comprato. */
  band: { min: number; max: number } | null;
}

/**
 * Quanto interesse ha davvero questo immobile, e quanto ne perde per il
 * prezzo. E' il numero che serve al proprietario per capire se il problema
 * e' la casa o la cifra: "quattro persone la volevano, tutte sotto i 260".
 */
export function priceInterest(property: Property): PriceInterest {
  const ready = prepareProperty(property);
  const blocked: { clientName: string; budgetMax: number }[] = [];
  let matching = 0;

  for (const requirement of openRequirements()) {
    const verdict = evaluate(requirement, ready);
    if (verdict.ok) {
      matching++;
      continue;
    }
    // Solo chi si e' fermato sul prezzo pur volendo quel tipo di immobile: chi
    // cercava in un altro comune o un'altra tipologia e' gia' stato escluso
    // prima, con il suo motivo, e non arriva mai qui.
    if (verdict.reason !== "budget" || !requirement.budgetMax) continue;
    if (ready.price > 0 && requirement.budgetMax >= ready.price) continue;

    blocked.push({ clientName: requirement.clientName, budgetMax: requirement.budgetMax });
  }

  blocked.sort((a, b) => b.budgetMax - a.budgetMax);
  const budgets = blocked.map((b) => b.budgetMax);

  return {
    matching,
    blockedByPrice: blocked,
    band: budgets.length ? { min: Math.min(...budgets), max: Math.max(...budgets) } : null,
  };
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
export function matchesByClient({
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
} = {}): { groups: ClientMatches[]; total: number; clients: number; page: number; pages: number } {
  const properties = availableProperties();
  const byClient = new Map<number, { name: string; phone: string | null; scored: Scored[] }>();
  let total = 0;

  for (const requirement of openRequirements()) {
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
