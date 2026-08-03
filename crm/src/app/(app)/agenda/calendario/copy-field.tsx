"use client";

import { useState } from "react";

/** Casella di sola lettura con il pulsante per copiare: l'indirizzo e' lungo
 *  e selezionarlo a mano sul telefono e' un supplizio. */
export function CopyField({ value }: { value: string }) {
  const [copiato, setCopiato] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      <input
        readOnly
        value={value}
        onFocus={(event) => event.currentTarget.select()}
        className="field min-w-0 flex-1 font-mono text-xs"
        aria-label="Indirizzo del calendario"
      />
      <button
        type="button"
        className="btn-secondary shrink-0"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
          } catch {
            // Senza permesso per gli appunti resta la selezione manuale: la
            // casella e' gia' selezionata al tocco.
            return;
          }
          setCopiato(true);
          setTimeout(() => setCopiato(false), 2000);
        }}
      >
        {copiato ? "Copiato" : "Copia"}
      </button>
    </div>
  );
}
