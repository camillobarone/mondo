"use client";

import { completeActivity } from "@/lib/actions";
import { SubmitButton } from "@/components/client";

/** Segna un'attivita' come fatta, aggiornando anche l'ultimo contatto del cliente. */
export function CompleteButton({ id }: { id: number }) {
  return (
    <form action={completeActivity} className="shrink-0">
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="secondary" pendingLabel="…" className="px-2.5 py-1 text-xs">
        Fatto
      </SubmitButton>
    </form>
  );
}
