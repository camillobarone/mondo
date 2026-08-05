"use client";

import { useActionState } from "react";
import { cambiaPassword } from "@/lib/actions";
import { SubmitButton } from "@/components/client";

export function CambioPasswordForm({ minimo }: { minimo: number }) {
  const [errore, azione] = useActionState(cambiaPassword, null);

  return (
    <form action={azione} className="max-w-sm space-y-4">
      <div>
        <label className="field-label" htmlFor="attuale">
          Password di adesso
        </label>
        <input
          id="attuale"
          name="attuale"
          type="password"
          autoComplete="current-password"
          required
          className="field"
        />
      </div>

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
          className="field"
        />
        <p className="mt-1 text-xs text-slate-500">Almeno {minimo} caratteri.</p>
      </div>

      <div>
        <label className="field-label" htmlFor="conferma">
          Ripeti la password nuova
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

      <SubmitButton pendingLabel="Cambio in corso…">Cambia la password</SubmitButton>
    </form>
  );
}
