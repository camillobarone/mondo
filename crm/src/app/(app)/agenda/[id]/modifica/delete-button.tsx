"use client";

import { deleteActivity } from "@/lib/actions";
import { ConfirmButton } from "@/components/client";

export function DeleteActivityButton({
  id,
  redirectTo,
}: {
  id: number;
  redirectTo: string;
}) {
  return (
    <form action={deleteActivity}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="redirect_to" value={redirectTo} />
      <ConfirmButton message="Eliminare questa attività? Non si recupera.">
        Elimina
      </ConfirmButton>
    </form>
  );
}
