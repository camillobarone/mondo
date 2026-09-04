import { NextResponse } from "next/server";
import { propertyByTrackingToken, trackingPhotoBelongs } from "@/lib/queries";
import { leggiFoto } from "@/lib/photos";

export const dynamic = "force-dynamic";

/**
 * Le foto della casa, per il proprietario che guarda dal suo link.
 *
 * Serviva una rotta apposta: `/foto/[id]/[file]` chiede di aver fatto
 * l'accesso **e** che l'immobile sia di chi guarda, e da fuori non e' vera
 * nessuna delle due cose. Sulla pagina del proprietario le immagini sarebbero
 * arrivate tutte rotte, ed e' il genere di guasto che non da' nessun errore:
 * la pagina si apre, le foto no.
 *
 * Il controllo non e' piu' debole, poggia su un'altra gamba. Al posto
 * dell'utente c'e' la chiave, e al posto di «l'immobile e' tuo» c'e' «la foto
 * e' di questo immobile». La seconda meta' serve quanto la prima: senza,
 * basterebbe cambiare il nome del file nell'indirizzo per sfogliare gli
 * interni di casa d'altri tenendosi la propria chiave, che e' buona.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; file: string }> },
) {
  const { token, file } = await params;

  const immobile = propertyByTrackingToken(token);
  // Stessa risposta per chiave sbagliata, chiave revocata, immobile cestinato
  // e foto inesistente: da fuori non si deve poter capire quale delle quattro.
  if (!immobile) return new NextResponse("Non trovata", { status: 404 });

  const anteprima = file.endsWith("-min.jpg");
  const nome = anteprima ? file.replace(/-min\.jpg$/, ".jpg") : file;

  // Il nome arriva dall'indirizzo e finisce dentro un percorso su disco:
  // senza questo controllo ci si esce con "..".
  if (!/^[a-f0-9]+\.jpg$/.test(nome)) {
    return new NextResponse("Non trovata", { status: 404 });
  }

  if (!trackingPhotoBelongs(immobile.id, nome)) {
    return new NextResponse("Non trovata", { status: 404 });
  }

  const dati = leggiFoto(immobile.id, nome, anteprima);
  if (!dati) return new NextResponse("Non trovata", { status: 404 });

  return new NextResponse(new Uint8Array(dati), {
    headers: {
      "Content-Type": "image/jpeg",
      // `private` e' obbligatorio: l'indirizzo contiene la chiave, e queste
      // immagini non devono fermarsi in nessuna cache condivisa lungo la
      // strada.
      //
      // E la durata e' breve, al contrario di `/foto/[id]/[file]` che tiene un
      // anno «immutable». Il nome del file non si ripete mai, quindi un anno
      // sarebbe corretto sul contenuto — ma qui c'e' la revoca di mezzo: una
      // volta tolta la chiave la pagina muore subito, mentre le foto gia'
      // scaricate continuerebbero ad aprirsi dalla cache di quel browser per
      // dodici mesi. Cinque minuti bastano a non riscaricare la galleria
      // mentre il proprietario la scorre, e fanno mordere la revoca quasi
      // subito. Trovato in browser: dal server il 404 arrivava gia' giusto.
      "Cache-Control": "private, max-age=300",
    },
  });
}
