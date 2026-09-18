import { cookies, headers } from "next/headers";
import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { indirizzoConsenso } from "@/lib/google";
import { indirizzoRitorno, COOKIE_STATO } from "../ritorno";

export const dynamic = "force-dynamic";

/**
 * Manda il titolare sulla schermata di consenso di Google.
 *
 * E' una rotta e non un'azione di modulo perche' deve finire con una
 * navigazione **fuori** dal gestionale, verso `accounts.google.com`.
 */
export async function GET() {
  await requireOwner();

  // Il gettone contro le richieste costruite da terzi: se ne mette metà nel
  // cookie e la si ritrova uguale al ritorno. Senza, chiunque potrebbe far
  // atterrare sul nostro callback il codice di un altro account.
  const stato = crypto.randomBytes(24).toString("base64url");
  (await cookies()).set(COOKIE_STATO, stato, {
    httpOnly: true,
    sameSite: "lax",
    secure: (await headers()).get("x-forwarded-proto")?.startsWith("https") ?? false,
    path: "/",
    maxAge: 600,
  });

  redirect(indirizzoConsenso(await indirizzoRitorno(), stato));
}
