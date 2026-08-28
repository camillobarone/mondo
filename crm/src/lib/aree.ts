import { fromCsv } from "./format";

/**
 * Le aree di ricerca di una richiesta: un comune con le sue zone.
 *
 * Prima una richiesta aveva un comune solo e un elenco di zone senza padre.
 * Chi cercava "a Lecce in centro, oppure a Porto Cesareo a Torre Lapillo" non
 * aveva modo di dirlo: le due zone finivano in un mucchio unico e il programma
 * non sapeva piu' quale apparteneva a quale comune. Da qui in poi ogni zona sa
 * di che comune e', e i comuni possono essere piu' d'uno.
 *
 * Zone vuote non vuol dire "nessuna zona": vuol dire **tutto il comune**. E' il
 * caso piu' comune — chi cerca a Porto Cesareo di solito cerca a Porto Cesareo,
 * punto — e va trattato come un'area valida, non come un'area incompleta.
 */
export interface Area {
  comune: string;
  zone: string[];
}

/**
 * Limiti di buon senso.
 *
 * Il json arriva da un campo nascosto del modulo, quindi e' roba scritta dal
 * browser: puo' essere malformata, enorme, o non essere affatto quello che ci
 * aspettiamo. Nessuno cerca casa in venti comuni, ma senza un tetto una
 * richiesta gonfiata a mano diventerebbe una pagina che non si apre piu'.
 */
const MAX_AREE = 20;
const MAX_ZONE = 40;
const MAX_LUNGHEZZA = 80;

const pulisci = (valore: unknown): string =>
  typeof valore === "string" ? valore.trim().slice(0, MAX_LUNGHEZZA) : "";

/** Toglie doppioni e vuoti da un elenco di nomi, conservando l'ordine. */
function distinti(valori: string[]): string[] {
  const visti = new Set<string>();
  const fuori: string[] = [];
  for (const valore of valori) {
    const chiave = valore.toLowerCase();
    if (!valore || visti.has(chiave)) continue;
    visti.add(chiave);
    fuori.push(valore);
  }
  return fuori;
}

/**
 * Le aree di una richiesta, da qualunque forma arrivino.
 *
 * Le richieste scritte prima del 28 agosto 2026 hanno `areas` vuoto e i vecchi
 * `city` + `zones`: si leggono come una sola area, che e' esattamente quello
 * che erano. Cosi' l'archivio non ha bisogno di essere convertito, e una
 * richiesta vecchia continua a incrociare come ha sempre fatto.
 */
export function leggiAree(fonte: {
  areas?: string | null;
  city?: string | null;
  zones?: string | null;
}): Area[] {
  const grezzo = fonte.areas?.trim();
  if (grezzo) {
    try {
      const letto: unknown = JSON.parse(grezzo);
      if (Array.isArray(letto)) {
        const aree = letto
          .slice(0, MAX_AREE)
          .map((voce): Area | null => {
            if (!voce || typeof voce !== "object") return null;
            const dato = voce as { comune?: unknown; zone?: unknown };
            const comune = pulisci(dato.comune);
            if (!comune) return null;
            const zone = Array.isArray(dato.zone)
              ? distinti(dato.zone.slice(0, MAX_ZONE).map(pulisci))
              : [];
            return { comune, zone };
          })
          .filter((area): area is Area => area !== null);
        if (aree.length) return aree;
      }
    } catch {
      // Json rotto: si ricade sui campi vecchi invece di lasciare la richiesta
      // senza aree. Una richiesta che non incrocia piu' e' un danno silenzioso,
      // e sarebbe stato notato solo dal cliente che non viene richiamato.
    }
  }

  const comune = pulisci(fonte.city);
  const zone = distinti(fromCsv(fonte.zones).map(pulisci));
  if (!comune && !zone.length) return [];
  // Zone senza comune: capita nelle richieste importate, dove la zona c'era e
  // il comune no. Si tiene l'area con il comune vuoto — vale come "zone queste,
  // comune qualunque", che e' quello che il motore faceva gia' prima.
  return [{ comune, zone }];
}

/** Il json da mettere in archivio. Stringa vuota quando non c'e' niente. */
export function scriviAree(aree: Area[]): string {
  const pulite = aree
    .slice(0, MAX_AREE)
    .map((area) => ({
      comune: pulisci(area.comune),
      zone: distinti((area.zone ?? []).slice(0, MAX_ZONE).map(pulisci)),
    }))
    .filter((area) => area.comune || area.zone.length);
  return pulite.length ? JSON.stringify(pulite) : "";
}

/**
 * Le due colonne vecchie, ricavate dalle aree.
 *
 * Restano scritte perche' la ricerca e il filtro per comune dell'elenco
 * richieste lavorano in SQL, dove il json non si interroga. Sono una copia, e
 * la copia si scrive in un punto solo — qui — proprio per non ritrovarsi con
 * due verita' che si allontanano.
 */
export function proiezione(aree: Area[]): { city: string | null; zones: string } {
  return {
    city: aree[0]?.comune || null,
    zones: distinti(aree.flatMap((area) => area.zone)).join(","),
  };
}

/** Come si legge un'area in una riga sola: "Lecce (Centro storico, Santa Rosa)". */
export function descriviArea(area: Area): string {
  if (!area.zone.length) return area.comune || "zona non indicata";
  if (!area.comune) return area.zone.join(", ");
  return `${area.comune} (${area.zone.join(", ")})`;
}
