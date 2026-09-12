"use client";

/**
 * La rete sotto tutto il programma.
 *
 * Senza un file come questo, qualunque guasto — un controllo del server che
 * lancia, una query che va storta — arriva a schermo come pagina bianca con
 * scritto «A server error occurred», in inglese e senza una via d'uscita.
 * Qui invece si resta dentro il programma, con la navigazione al suo posto,
 * e ci sono due pulsanti: riprovare e tornare al cruscotto.
 *
 * A programma pubblicato il testo dell'errore non esce dal server: al suo
 * posto Next manda un `digest`, un codice che sta anche nel registro del
 * server. Si mostra apposta — e' quello che permette di ritrovare cos'e'
 * successo davvero (`CONSEGNA.md`, capitolo 12).
 *
 * Deve essere un componente di client: React vuole poter agganciare qui il
 * confine degli errori, e `reset` e' una funzione che gira nel browser.
 */

import Link from "next/link";
import { PaginaMessaggio } from "@/components/ui";

export default function ErroreDelProgramma({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PaginaMessaggio
      titolo="Qualcosa non ha funzionato"
      codice={error.digest}
      azioni={
        <>
          <button type="button" onClick={reset} className="btn-primary">
            Riprova
          </button>
          <Link href="/" className="btn-secondary">
            Torna al cruscotto
          </Link>
        </>
      }
    >
      <p>
        L&apos;ultima operazione non è andata a buon fine. Non è stato salvato niente:
        l&apos;archivio è come l&apos;hai lasciato.
      </p>
      <p className="mt-2">
        Riprova. Se succede di nuovo sempre nello stesso punto, segnalalo riportando il
        codice qui sotto.
      </p>
    </PaginaMessaggio>
  );
}
