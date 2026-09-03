/**
 * L'indirizzo non porta da nessuna parte.
 *
 * Senza questo file, un indirizzo sbagliato mostra la pagina di serie di Next:
 * «404 — This page could not be found», in inglese e senza un modo per
 * tornare indietro.
 */

import Link from "next/link";
import { PaginaMessaggio } from "@/components/ui";

export default function PaginaNonTrovata() {
  return (
    <PaginaMessaggio
      titolo="Questa pagina non esiste"
      azioni={
        <Link href="/" className="btn-primary">
          Vai al gestionale
        </Link>
      }
    >
      <p>L&apos;indirizzo non porta a nessuna pagina del gestionale.</p>
    </PaginaMessaggio>
  );
}
