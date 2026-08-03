import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { leggiFoto } from "@/lib/photos";

/**
 * Serve le foto degli immobili.
 *
 * Non stanno nella cartella pubblica di proposito: sono materiale
 * dell'agenzia, e vanno viste solo da chi ha fatto l'accesso. Passando da qui
 * il controllo c'e'; in `public/` chiunque conoscesse l'indirizzo le vedrebbe.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; file: string }> },
) {
  if (!(await currentUser())) {
    return new NextResponse("Accesso richiesto", { status: 401 });
  }

  const { id, file } = await params;
  const propertyId = Number(id);
  if (!Number.isInteger(propertyId) || propertyId <= 0) {
    return new NextResponse("Non trovata", { status: 404 });
  }

  const anteprima = file.endsWith("-min.jpg");
  const nome = anteprima ? file.replace(/-min\.jpg$/, ".jpg") : file;
  if (!/^[a-f0-9]+\.jpg$/.test(nome)) {
    return new NextResponse("Non trovata", { status: 404 });
  }

  const dati = leggiFoto(propertyId, nome, anteprima);
  if (!dati) return new NextResponse("Non trovata", { status: 404 });

  return new NextResponse(new Uint8Array(dati), {
    headers: {
      "Content-Type": "image/jpeg",
      // Il nome del file non si ripete mai: si puo' tenere in cache a lungo.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
