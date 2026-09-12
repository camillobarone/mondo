import { calendarActivities, userByCalendarToken } from "@/lib/queries";
import { calendario, evento } from "@/lib/calendar";

export const dynamic = "force-dynamic";

/**
 * Il calendario a cui ci si abbona.
 *
 * Sta fuori dalle pagine protette dal cookie di sessione perche' a chiederlo e'
 * il calendario, non il browser: nessuna applicazione di calendario sa fare
 * l'accesso. Al posto della password c'e' la chiave nell'indirizzo, lunga e
 * casuale, revocabile in qualunque momento dalla pagina Calendario.
 *
 * Espone solo gli appuntamenti di quella persona, e nessun dato personale
 * oltre a quelli: niente recapiti, niente prezzi.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const pulito = token.replace(/\.ics$/i, "");
  const utente = userByCalendarToken(pulito);

  // Stessa risposta per chiave sbagliata e per utente disattivato: da fuori non
  // si deve poter capire se una chiave e' esistita.
  if (!utente) {
    return new Response("Calendario non trovato.", { status: 404 });
  }

  const eventi = calendarActivities(utente.id)
    .map((attivita) => evento(attivita, { base: process.env.CRM_BASE_URL ?? "" }))
    .filter((testo): testo is string => testo !== null);

  return new Response(calendario(eventi, { nome: `Agenda ${utente.name}` }), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="agenda.ics"',
      // Non finire in nessuna cache intermedia: e' roba di una persona sola.
      "Cache-Control": "private, no-store",
    },
  });
}
