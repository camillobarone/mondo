"use client";

import { creaCalendarioDi, rigeneraCalendarioDi } from "@/lib/actions";
import { CopyField, SubmitButton, ConfirmButton } from "@/components/client";

export interface CalendarioPersona {
  id: number;
  name: string;
  /** L'indirizzo completo, gia' montato dal server. `null` se non e' mai stato creato. */
  indirizzo: string | null;
}

/**
 * I calendari delle persone, sulla pagina Utenti.
 *
 * Il link non esiste finche' non lo si crea, come per la pagina del
 * proprietario: la riga parte da un pulsante solo. Generarli tutti
 * all'apertura della pagina vorrebbe dire aprire una porta per ognuno anche
 * solo passando di qui.
 */
export function Calendari({ persone }: { persone: CalendarioPersona[] }) {
  return (
    <ul className="space-y-4">
      {persone.map((persona) => (
        <li key={persona.id} className="border-t border-slate-100 pt-4 first:border-0 first:pt-0">
          <p className="mb-1.5 text-sm font-medium text-slate-800">{persona.name}</p>

          {persona.indirizzo ? (
            <>
              <CopyField value={persona.indirizzo} etichetta={`Calendario di ${persona.name}`} />
              <form action={rigeneraCalendarioDi} className="mt-1.5">
                <input type="hidden" name="user_id" value={persona.id} />
                <ConfirmButton
                  variant="nudo"
                  className="text-xs text-red-700 hover:underline"
                  message={
                    `Generare un indirizzo nuovo per il calendario di ${persona.name}?\n\n` +
                    "Quello di adesso smette di rispondere: i calendari già collegati, " +
                    "compresi quelli sul tuo Google, si fermano finché non li ricolleghi " +
                    "con il nuovo indirizzo.\n\nProcedere?"
                  }
                >
                  genera un indirizzo nuovo
                </ConfirmButton>
              </form>
            </>
          ) : (
            <form action={creaCalendarioDi}>
              <input type="hidden" name="user_id" value={persona.id} />
              <SubmitButton variant="secondary">Crea il calendario</SubmitButton>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}
