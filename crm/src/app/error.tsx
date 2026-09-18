"use client";

/**
 * La stessa rete di `(app)/error.tsx`, ma un gradino piu' in fuori: raccoglie
 * i guasti delle pagine che stanno fuori dal programma (accesso, recupero
 * della password) e quelli dell'involucro del programma stesso, che il file
 * dentro non puo' raccogliere perche' ci sta dentro.
 *
 * Qui non c'e' la navigazione: chi ci arriva potrebbe non essere nemmeno
 * entrato, e il cruscotto lo rimanderebbe alla schermata di accesso. La via
 * d'uscita e' quindi il solo «Riprova».
 */

import { PaginaMessaggio } from "@/components/ui";

export default function ErroreFuoriDalProgramma({
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
        <button type="button" onClick={reset} className="btn-primary">
          Riprova
        </button>
      }
    >
      <p>
        La pagina non si è aperta come doveva. Riprova; se succede di nuovo, segnalalo
        riportando il codice qui sotto.
      </p>
    </PaginaMessaggio>
  );
}
