import "server-only";

/**
 * Il ponte fra un'attivita' del gestionale e un evento dentro Google.
 *
 * Sta in un file suo e non dentro `actions.ts` per una ragione sola, ma
 * pesante: **da qui non si lancia mai un errore verso chi sta salvando.**
 * Google puo' essere lento, giu', o avere tolto il permesso; se una di queste
 * cose facesse fallire il salvataggio di un appuntamento, il gestionale
 * smetterebbe di funzionare perche' un servizio di terzi ha il raffreddore.
 * L'appuntamento si salva sempre; in Google ci arriva subito se si puo', al
 * prossimo giro se no.
 */

import { PREAVVISO_MINUTI } from "./calendar";
import {
  attivitaDaGoogle,
  attivitaDaRisincronizzare,
  segnaSincronizzata,
  segnaDaSincronizzare,
  salvaCalendarioGoogle,
  personeSenzaCalendarioGoogle,
} from "./queries";
import {
  googleCollegato,
  creaCalendario,
  scriviEvento,
  cancellaEvento,
  ErroreGoogle,
} from "./google";

/** Quanto dura un appuntamento in agenda. Lo stesso dei file iCalendar. */
const DURATA = 60;

/**
 * Il nome del calendario dentro Google.
 *
 * Con il nome della persona davanti si riconosce nell'elenco dei calendari, e
 * «Mondo» in coda dice da dove arriva a chi, mesi dopo, si chiede cosa siano
 * quei tre calendari comparsi.
 */
export function nomeCalendario(nome: string): string {
  return `Agenda ${nome} · Mondo`;
}

/**
 * Scrive in Google l'appuntamento, se c'e' da scrivere.
 *
 * Restituisce cosa e' successo invece di lanciarlo: chi chiama decide se
 * mostrarlo (la pagina di configurazione) o ignorarlo (il salvataggio di
 * un'attivita').
 */
export async function mandaAGoogle(
  activityId: number,
): Promise<{ fatto: boolean; motivo?: string }> {
  if (!googleCollegato()) return { fatto: false, motivo: "Google non e' collegato." };

  const dati = attivitaDaGoogle(activityId);
  if (!dati) return { fatto: false, motivo: "Attivita' non trovata o senza assegnatario." };

  const { attivita, utente } = dati;

  // Senza data non e' un appuntamento: e' una nota, e in un calendario non ci
  // va. Se ne aveva una e gliel'hanno tolta, l'evento va portato via.
  if (!attivita.due_at) {
    if (dati.eventId && utente.google_calendar_id) {
      await togliDaGoogle(utente.google_calendar_id, dati.eventId);
    }
    return { fatto: true };
  }

  try {
    // Il calendario della persona si crea la prima volta che le serve, non
    // quando si collega Google: chi non ha appuntamenti non deve ritrovarsi
    // un calendario vuoto in mezzo ai suoi.
    let calendarId = utente.google_calendar_id;
    if (!calendarId) {
      calendarId = await creaCalendario(nomeCalendario(utente.name));
      salvaCalendarioGoogle(utente.id, calendarId);
    }

    const eventId = await scriviEvento(calendarId, contenuto(attivita), dati.eventId);
    segnaSincronizzata(activityId, eventId);
    return { fatto: true };
  } catch (errore) {
    // Resta segnata come da mandare: la risincronizzazione la riprendera'.
    segnaDaSincronizzare(activityId);
    const motivo =
      errore instanceof ErroreGoogle ? errore.message : (errore as Error).message;
    console.error(`[google] appuntamento ${activityId} non scritto: ${motivo}`);
    return { fatto: false, motivo };
  }
}

/** Toglie l'evento da Google senza far rumore se non si riesce. */
export async function togliDaGoogle(calendarId: string, eventId: string): Promise<void> {
  try {
    await cancellaEvento(calendarId, eventId);
  } catch (errore) {
    console.error(`[google] evento ${eventId} non cancellato: ${(errore as Error).message}`);
  }
}

/**
 * Manda quello che era rimasto indietro.
 *
 * A scaglioni, e **in fila uno dopo l'altro**: Google mette il freno sulle
 * richieste ravvicinate, e venti chiamate in parallelo si prendono un 403 che
 * sembra un problema di permessi. La pagina dice quanti ne restano e si
 * ripreme.
 */
export async function risincronizza(
  quanti = 20,
): Promise<{ mandati: number; falliti: number; motivo?: string }> {
  if (!googleCollegato()) return { mandati: 0, falliti: 0, motivo: "Google non e' collegato." };

  let mandati = 0;
  let falliti = 0;
  let motivo: string | undefined;

  for (const id of attivitaDaRisincronizzare(quanti)) {
    const esito = await mandaAGoogle(id);
    if (esito.fatto) {
      mandati++;
    } else {
      falliti++;
      motivo ??= esito.motivo;
      // Al primo guasto ci si ferma. Se Google ha tolto il permesso o ha messo
      // il freno, insistere venti volte peggiora le cose e riempie il registro
      // dello stesso errore.
      break;
    }
  }

  return { mandati, falliti, motivo };
}

/**
 * Crea in Google i calendari delle persone che non ce l'hanno.
 *
 * Il calendario di una persona nasce da se' al suo primo appuntamento, e per
 * l'uso normale basta. Questo serve a chi vuole **prepararli prima**: metterli
 * in Google, dargli un colore, decidere quali tenere accesi — senza dover
 * inventare un appuntamento finto per farli comparire.
 *
 * Uno per volta e non in parallelo: Google mette il freno sulle richieste
 * ravvicinate, e tre chiamate insieme si prendono un 403 che sembra un
 * problema di permessi.
 */
export async function creaCalendariMancanti(): Promise<{
  creati: string[];
  motivo?: string;
}> {
  if (!googleCollegato()) return { creati: [], motivo: "Google non e' collegato." };

  const creati: string[] = [];
  for (const persona of personeSenzaCalendarioGoogle()) {
    try {
      const calendarId = await creaCalendario(nomeCalendario(persona.name));
      salvaCalendarioGoogle(persona.id, calendarId);
      creati.push(persona.name);
    } catch (errore) {
      const motivo =
        errore instanceof ErroreGoogle ? errore.message : (errore as Error).message;
      console.error(`[google] calendario di ${persona.name} non creato: ${motivo}`);
      // Ci si ferma al primo guasto: se Google ha tolto il permesso o ha messo
      // il freno, insistere peggiora e riempie il registro dello stesso errore.
      return { creati, motivo };
    }
  }
  return { creati };
}

/* ----------------------------------------------------------- il contenuto */

/**
 * Cosa finisce dentro l'evento.
 *
 * **E' lo stesso contenuto del feed iCalendar**, e deve restare tale: due
 * strade che mostrano la stessa agenda non possono raccontare due cose
 * diverse. I nomi sono gia' mascherati da `attivitaDaGoogle`, che usa l'id di
 * chi ha l'appuntamento assegnato — il cliente di un collega arriva qui gia'
 * senza nome, e non c'e' niente da filtrare a valle.
 */
function contenuto(attivita: {
  id: number;
  title: string | null;
  type: string;
  notes: string | null;
  due_at: string | null;
  done_at: string | null;
  client_id: number | null;
  client_name: string | null;
  client_phone: string | null;
  property_id: number | null;
  property_title: string | null;
}) {
  const base = process.env.CRM_BASE_URL ?? "";
  const titolo = [attivita.title || "Appuntamento", attivita.client_name]
    .filter(Boolean)
    .join(" · ");

  const descrizione = [
    // Il numero attaccato al nome, come nel feed iCalendar e nell'avviso per
    // posta. Nell'app di Google si tocca e parte la chiamata.
    attivita.client_name
      ? `Cliente: ${attivita.client_name}${attivita.client_phone ? ` · ${attivita.client_phone}` : ""}`
      : "",
    attivita.property_title ? `Immobile: ${attivita.property_title}` : "",
    attivita.notes ?? "",
    base && attivita.property_id ? `${base}/immobili/${attivita.property_id}` : "",
    base && !attivita.property_id && attivita.client_id
      ? `${base}/clienti/${attivita.client_id}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    titolo,
    inizio: attivita.due_at!,
    durata: DURATA,
    descrizione,
    luogo: attivita.property_title ?? "",
    // Niente sveglia su quello che e' gia' stato fatto: suonerebbe per un
    // appuntamento chiuso. `null` vuol dire nessuna sveglia — zero avrebbe
    // voluto dire «suona all'ora esatta», che e' un'altra cosa.
    preavviso: attivita.done_at ? null : PREAVVISO_MINUTI,
  };
}
