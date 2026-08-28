import Link from "next/link";
import { saveRequirement } from "@/lib/actions";
import { SubmitButton } from "@/components/client";
import { TextField, TextArea, SelectField, CheckboxGroup } from "@/components/ui";
import { fromCsv } from "@/lib/format";
import {
  COMUNI,
  FINANCING,
  PROPERTY_CONDITIONS,
  PROPERTY_KINDS,
  REQUIREMENT_STATUSES,
  URGENCIES,
  ZONE_PER_COMUNE,
} from "@/lib/types";
import type { Requirement } from "@/lib/types";
import { leggiAree } from "@/lib/aree";
import { AreaPicker } from "./area-picker";

/** Cosa cerca il cliente. Serve al motore degli incroci. */
export function RequirementForm({
  clientId,
  requirement,
  cancelHref,
}: {
  clientId: number;
  requirement?: Requirement;
  cancelHref: string;
}) {
  return (
    <form action={saveRequirement} className="space-y-4">
      <input type="hidden" name="client_id" value={clientId} />
      {requirement ? <input type="hidden" name="id" value={requirement.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField
          label="Cerca per"
          name="contract"
          options={[
            { value: "vendita", label: "Acquisto" },
            { value: "affitto", label: "Affitto" },
          ]}
          defaultValue={requirement?.contract ?? "vendita"}
          placeholder={null}
        />
        <SelectField
          label="Urgenza"
          name="urgency"
          options={URGENCIES.map((value) => ({ value, label: value }))}
          defaultValue={requirement?.urgency ?? "media"}
          placeholder={null}
        />
      </div>

      <CheckboxGroup
        label="Tipologia"
        name="kind"
        options={PROPERTY_KINDS}
        selected={fromCsv(requirement?.kind)}
        columns={4}
        capitalizza={false}
      />

      <AreaPicker
        iniziali={requirement ? leggiAree(requirement) : []}
        comuni={COMUNI}
        zonePerComune={ZONE_PER_COMUNE}
      />

      <CheckboxGroup
        label="Stato dell'immobile"
        name="conditions"
        options={PROPERTY_CONDITIONS}
        selected={fromCsv(requirement?.conditions)}
        columns={4}
        capitalizza={false}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TextField
          label="Budget minimo"
          name="budget_min"
          defaultValue={requirement?.budget_min}
          placeholder="120000"
        />
        <TextField
          label="Budget massimo"
          name="budget_max"
          defaultValue={requirement?.budget_max}
          placeholder="250000"
        />
        <TextField label="Metri quadri minimi" name="sqm_min" defaultValue={requirement?.sqm_min} />
        <TextField label="Vani minimi" name="rooms_min" defaultValue={requirement?.rooms_min} />
      </div>

      <CheckboxGroup
        label="Requisiti irrinunciabili"
        name="needs"
        options={["ascensore", "box", "esterno"]}
        selected={fromCsv(requirement?.needs)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Come paga"
          name="financing"
          options={FINANCING}
          defaultValue={requirement?.financing}
        />
        <SelectField
          label="Stato della richiesta"
          name="status"
          options={REQUIREMENT_STATUSES}
          defaultValue={requirement?.status ?? "aperta"}
          placeholder={null}
        />
      </div>

      <TextArea
        label="Note"
        name="notes"
        defaultValue={requirement?.notes}
        rows={3}
        placeholder="Dettagli che non stanno nei campi: piano basso per la madre, vicino a scuola…"
      />

      <div className="flex items-center gap-3">
        <SubmitButton>{requirement ? "Salva richiesta" : "Aggiungi richiesta"}</SubmitButton>
        <Link href={cancelHref} className="btn-secondary">
          Annulla
        </Link>
      </div>
    </form>
  );
}
