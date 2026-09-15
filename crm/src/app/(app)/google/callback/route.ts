import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { scambiaCodice } from "@/lib/google";
import { scriviImpostazioni } from "@/lib/queries";
import { audit } from "@/lib/db";
import { indirizzoRitorno, COOKIE_STATO } from "../ritorno";

export const dynamic = "force-dynamic";

/** Torna alla pagina di Google con un messaggio da leggere. */
function conMessaggio(motivo: string): never {
  redirect(`/utenti/google?motivo=${encodeURIComponent(motivo)}`);
}

/**
 * Dove Google rimanda dopo la schermata di consenso.
 *
 * Qui arriva un codice che vale una volta sola e pochi secondi: si scambia
 * subito con il permesso duraturo, che e' l'unica cosa che si conserva.
 */
export async function GET(request: Request) {
  const user = await requireOwner();
  const parametri = new URL(request.url).searchParams;

  const barattolo = await cookies();
  const atteso = barattolo.get(COOKIE_STATO)?.value;
  // Il gettone si brucia comunque, riuscito o no: vale per un giro solo.
  barattolo.delete(COOKIE_STATO);

  // Quando si preme «Annulla» sulla schermata di Google si torna qui con un
  // errore invece che con un codice. Non e' un guasto: e' una risposta.
  const rifiuto = parametri.get("error");
  if (rifiuto) {
    conMessaggio(
      rifiuto === "access_denied"
        ? "Il collegamento è stato annullato sulla schermata di Google. Nessuna modifica."
        : `Google ha risposto: ${rifiuto}`,
    );
  }

  const stato = parametri.get("state");
  if (!atteso || !stato || stato !== atteso) {
    conMessaggio(
      "La risposta di Google non corrisponde alla richiesta partita da qui. " +
        "Può succedere se la pagina è rimasta aperta troppo a lungo: ripremi «Collega Google».",
    );
  }

  const codice = parametri.get("code");
  if (!codice) conMessaggio("Google non ha mandato il codice di autorizzazione.");

  try {
    const token = await scambiaCodice(codice, await indirizzoRitorno());
    scriviImpostazioni({
      google_refresh_token: token.refreshToken,
      google_access_token: token.accessToken,
      google_token_expires: String(token.scadenza),
    });
    audit(user.id, "modifica", "impostazioni", null, "Google Calendar collegato");
  } catch (errore) {
    conMessaggio((errore as Error).message);
  }

  redirect("/utenti/google?collegato=1");
}
