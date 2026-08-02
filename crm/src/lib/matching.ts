import { all } from "./db";
import { fromCsv } from "./format";
import type { Property, Requirement } from "./types";

/**
 * Incrocio richieste <-> immobili.
 *
 * Il punteggio conta quanti criteri della richiesta l'immobile soddisfa
 * davvero (i criteri non compilati non contano ne' a favore ne' contro).
 * Un immobile compare solo se non viola nessun criterio obbligatorio:
 * tipo di contratto, budget e metri quadri minimi.
 */

export interface Match {
  property: Property;
  requirement: Requirement;
  score: number;      // criteri soddisfatti
  total: number;      // criteri valutati
  reasons: string[];  // perche' e' un buon incrocio
  warnings: string[]; // dove non corrisponde del tutto
}

/** Tolleranza sul budget massimo: un immobile poco sopra vale la telefonata. */
const BUDGET_TOLERANCE = 1.08;

function normalise(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function evaluate(requirement: Requirement, property: Property): Match | null {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 0;
  let total = 0;

  // --- criteri che escludono l'immobile ---------------------------------
  if (normalise(property.contract) !== normalise(requirement.contract)) return null;

  const price = property.price ?? 0;
  if (requirement.budget_max && price > requirement.budget_max * BUDGET_TOLERANCE) return null;
  if (requirement.budget_min && price > 0 && price < requirement.budget_min * 0.75) return null;
  if (requirement.sqm_min && property.sqm && property.sqm < requirement.sqm_min * 0.9) return null;

  // --- criteri che danno punteggio --------------------------------------
  if (requirement.budget_max) {
    total++;
    if (price && price <= requirement.budget_max) {
      score++;
      reasons.push("Rientra nel budget");
    } else if (price) {
      warnings.push("Poco sopra il budget");
    }
  }

  if (requirement.kind) {
    total++;
    if (normalise(property.kind) === normalise(requirement.kind)) {
      score++;
      reasons.push(`Tipologia: ${property.kind}`);
    } else {
      warnings.push(`Tipologia diversa (${property.kind || "non indicata"})`);
    }
  }

  if (requirement.city) {
    total++;
    if (normalise(property.city) === normalise(requirement.city)) {
      score++;
      reasons.push(`Comune: ${property.city}`);
    } else {
      warnings.push(`Comune diverso (${property.city || "non indicato"})`);
    }
  }

  const wantedZones = fromCsv(requirement.zones).map(normalise);
  if (wantedZones.length) {
    total++;
    if (wantedZones.includes(normalise(property.zone))) {
      score++;
      reasons.push(`Zona richiesta: ${property.zone}`);
    } else {
      warnings.push(`Fuori dalle zone richieste (${property.zone || "zona non indicata"})`);
    }
  }

  if (requirement.sqm_min) {
    total++;
    if (property.sqm && property.sqm >= requirement.sqm_min) {
      score++;
      reasons.push(`${property.sqm} mq`);
    } else {
      warnings.push("Metratura sotto il minimo richiesto");
    }
  }

  if (requirement.rooms_min) {
    total++;
    if (property.rooms && property.rooms >= requirement.rooms_min) {
      score++;
      reasons.push(`${property.rooms} vani`);
    } else {
      warnings.push("Meno vani del richiesto");
    }
  }

  for (const need of fromCsv(requirement.needs)) {
    total++;
    const satisfied =
      (need === "ascensore" && property.elevator === 1) ||
      (need === "box" && property.garage === 1) ||
      (need === "esterno" && !!property.outdoor && normalise(property.outdoor) !== "nessuno");
    if (satisfied) {
      score++;
      reasons.push(need === "box" ? "Ha il box" : `Ha ${need}`);
    } else {
      warnings.push(`Manca: ${need}`);
    }
  }

  return { property, requirement, score, total, reasons, warnings };
}

function availableProperties(): Property[] {
  return all<Property>(
    `SELECT * FROM properties
      WHERE deleted_at IS NULL
        AND status IN ('acquisizione', 'in_vendita')
      ORDER BY updated_at DESC`,
  );
}

function openRequirements(): (Requirement & { client_name: string })[] {
  return all<Requirement & { client_name: string }>(
    `SELECT r.*,
            TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) AS client_name
       FROM requirements r
       JOIN clients c ON c.id = r.client_id
      WHERE r.status = 'aperta'
        AND c.deleted_at IS NULL
      ORDER BY r.updated_at DESC`,
  );
}

/** Immobili che corrispondono a una richiesta, i migliori per primi. */
export function matchesForRequirement(requirement: Requirement): Match[] {
  return availableProperties()
    .map((property) => evaluate(requirement, property))
    .filter((match): match is Match => match !== null)
    .sort((a, b) => b.score - a.score || a.warnings.length - b.warnings.length);
}

/** Richieste che corrispondono a un immobile: "a chi lo propongo?". */
export function matchesForProperty(
  property: Property,
): (Match & { client_name: string })[] {
  return openRequirements()
    .map((requirement) => {
      const match = evaluate(requirement, property);
      return match ? { ...match, client_name: requirement.client_name } : null;
    })
    .filter((match): match is Match & { client_name: string } => match !== null)
    .sort((a, b) => b.score - a.score || a.warnings.length - b.warnings.length);
}

/** Tutti gli incroci aperti, per la pagina Incroci. */
export function allMatches(minimumScore = 2): (Match & { client_name: string })[] {
  const properties = availableProperties();
  const results: (Match & { client_name: string })[] = [];

  for (const requirement of openRequirements()) {
    for (const property of properties) {
      const match = evaluate(requirement, property);
      if (match && match.score >= minimumScore) {
        results.push({ ...match, client_name: requirement.client_name });
      }
    }
  }

  return results.sort((a, b) => b.score - a.score || a.warnings.length - b.warnings.length);
}
