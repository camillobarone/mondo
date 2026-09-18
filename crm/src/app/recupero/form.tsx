"use client";

import { useActionState } from "react";
import { chiediRecupero, reimpostaPassword } from "@/lib/actions";
import { SubmitButton } from "@/components/client";

/** Passo 1: si chiede il collegamento indicando la propria email. */
export function ChiediRecuperoForm() {
  const [messaggio, azione] = useActionState(chiediRecupero, null);

  // Un solo riquadro per la risposta, sempre dello stesso colore: la risposta
  // e' la stessa che l'indirizzo esista o no, e due colori diversi
  // tradirebbero la differenza a colpo d'occhio.
  return (
    <form action={azione} className="space-y-4">
      <div>
        <label className="field-label" htmlFor="email">
          La tua email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          className="field"
        />
      </div>

      {messaggio ? (
        <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700" role="status">
          {messaggio}
        </p>
      ) : null}

      <SubmitButton className="w-full" pendingLabel="Invio…">
        Mandami il collegamento
      </SubmitButton>
    </form>
  );
}

/** Passo 2: si arriva dal collegamento e si sceglie la password nuova. */
export function ReimpostaPasswordForm({ token, minimo }: { token: string; minimo: number }) {
  const [errore, azione] = useActionState(reimpostaPassword, null);

  return (
    <form action={azione} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <div>
        <label className="field-label" htmlFor="nuova">
          Password nuova
        </label>
        <input
          id="nuova"
          name="nuova"
          type="password"
          autoComplete="new-password"
          minLength={minimo}
          required
          autoFocus
          className="field"
        />
        <p className="mt-1 text-xs text-slate-500">Almeno {minimo} caratteri.</p>
      </div>

      <div>
        <label className="field-label" htmlFor="conferma">
          Ripeti la password
        </label>
        <input
          id="conferma"
          name="conferma"
          type="password"
          autoComplete="new-password"
          minLength={minimo}
          required
          className="field"
        />
      </div>

      {errore ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {errore}
        </p>
      ) : null}

      <SubmitButton className="w-full" pendingLabel="Salvataggio…">
        Imposta la password
      </SubmitButton>
    </form>
  );
}
