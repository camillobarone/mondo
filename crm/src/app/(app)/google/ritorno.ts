import "server-only";
import { headers } from "next/headers";

/** Il nome del cookie che porta il gettone di stato fino al ritorno da Google. */
export const COOKIE_STATO = "google_stato";

/**
 * L'indirizzo a cui Google rimanda dopo il consenso.
 *
 * **Deve essere identico, carattere per carattere, a quello scritto in Google
 * Cloud → Credenziali → URI di reindirizzamento autorizzati**, altrimenti
 * Google rifiuta con `redirect_uri_mismatch` prima ancora di mostrare la
 * schermata. Si costruisce dall'indirizzo con cui si e' arrivati, come per il
 * link del calendario, cosi' funziona uguale in prova e in esercizio senza
 * niente da configurare.
 */
export async function indirizzoRitorno(): Promise<string> {
  const head = await headers();
  const host = head.get("x-forwarded-host") ?? head.get("host") ?? "";
  const protocollo = (head.get("x-forwarded-proto") ?? "https").split(",")[0]!.trim();
  return `${protocollo}://${host}/google/callback`;
}
