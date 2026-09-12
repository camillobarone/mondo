/**
 * Quando una scheda non c'e'.
 *
 * Ci si arriva dai `notFound()` sparsi nelle pagine: un indirizzo scritto a
 * mano, un segnalibro su una scheda cancellata, e — non meno importante — una
 * scheda che c'e' ma e' di un collega, che per il muro fra collaboratori si
 * comporta esattamente come una che non esiste. Il testo non distingue i due
 * casi apposta: dire «esiste ma non e' tua» sarebbe un modo per contare
 * l'archivio altrui una prova alla volta.
 */

import Link from "next/link";
import { PaginaMessaggio } from "@/components/ui";

export default function SchedaNonTrovata() {
  return (
    <PaginaMessaggio
      titolo="Questa scheda non c'è"
      azioni={
        <>
          <Link href="/" className="btn-primary">
            Torna al cruscotto
          </Link>
          <Link href="/cerca" className="btn-secondary">
            Cerca
          </Link>
        </>
      }
    >
      <p>
        Può essere stata eliminata, oppure l&apos;indirizzo non è giusto. Se la stai
        cercando, prova dalla ricerca: basta un pezzo di nome o un numero di telefono.
      </p>
    </PaginaMessaggio>
  );
}
