"use client";

import { rigeneraCalendario } from "@/lib/actions";
import { ConfirmButton } from "@/components/client";

export function ResetTokenButton() {
  return (
    <form action={rigeneraCalendario}>
      <ConfirmButton message="Generare un indirizzo nuovo? I calendari già collegati smetteranno di aggiornarsi finché non li ricolleghi.">
        Genera un indirizzo nuovo
      </ConfirmButton>
    </form>
  );
}
