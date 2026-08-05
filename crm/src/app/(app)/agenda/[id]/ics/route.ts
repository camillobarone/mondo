import { requireUser } from "@/lib/auth";
import { getActivity } from "@/lib/queries";
import { calendario, evento, nomeFile } from "@/lib/calendar";

export const dynamic = "force-dynamic";

/**
 * Un solo appuntamento, da scaricare e aprire.
 *
 * E' la strada piu' corta per avere l'avviso: il file entra nel calendario
 * subito, senza aspettare che un abbonamento si aggiorni, e la sveglia dei 30
 * minuti la fa il telefono anche a gestionale chiuso.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await params;
  const attivita = getActivity(user.id, Number(id));

  // Stessa risposta se l'appuntamento non c'e' e se e' di un collega: due
  // risposte diverse permetterebbero di contare l'agenda altrui a tentativi.
  if (!attivita) return new Response("Attività non trovata.", { status: 404 });

  const testo = evento(attivita, { base: process.env.CRM_BASE_URL ?? "" });
  if (!testo) {
    return new Response("Questa attività non ha una data: non è un appuntamento.", {
      status: 400,
    });
  }

  return new Response(calendario([testo]), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeFile(attivita.title || "appuntamento")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
