import { saveOffer, closeDeal, saveValuation, updateOfferStatus } from "@/lib/actions";
import { SubmitButton } from "@/components/client";
import { TextField, TextArea, SelectField, CheckboxRow } from "@/components/ui";
import { OFFER_STATUSES } from "@/lib/types";
import type { Property } from "@/lib/types";

/** Registra una proposta d'acquisto ricevuta. */
export function OfferForm({
  propertyId,
  clientOptions,
}: {
  propertyId: number;
  clientOptions: { value: string; label: string }[];
}) {
  return (
    <form action={saveOffer} className="space-y-3">
      <input type="hidden" name="property_id" value={propertyId} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField
          label="Da chi"
          name="client_id"
          options={clientOptions}
          required
          placeholder="Scegli il cliente"
          className="lg:col-span-2"
        />
        <TextField label="Importo" name="amount" placeholder="175000" required />
        <TextField
          label="Data"
          name="offered_at"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
        />
        <TextField label="Valida fino al" name="valid_until" type="date" />
        <SelectField
          label="Stato"
          name="status"
          options={OFFER_STATUSES}
          defaultValue="in_attesa"
          placeholder={null}
        />
      </div>

      <TextArea label="Note" name="notes" rows={2} />
      <SubmitButton>Registra proposta</SubmitButton>
    </form>
  );
}

/** Cambia lo stato di una proposta gia' registrata. */
export function OfferStatusForm({ id, status }: { id: number; status: string }) {
  return (
    <form action={updateOfferStatus} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={status}
        className="field w-auto py-1 text-xs"
        aria-label="Stato della proposta"
      >
        {OFFER_STATUSES.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <SubmitButton variant="secondary" className="px-2 py-1 text-xs" pendingLabel="…">
        Aggiorna
      </SubmitButton>
    </form>
  );
}

/** Chiusura: rogito, prezzo finale e provvigioni. */
export function CloseDealForm({ property }: { property: Property }) {
  return (
    <form action={closeDeal} className="space-y-3">
      <input type="hidden" name="id" value={property.id} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <TextField
          label="Prezzo di rogito"
          name="sold_price"
          defaultValue={property.sold_price ?? property.price}
        />
        <TextField
          label="Data compromesso"
          name="preliminary_date"
          type="date"
          defaultValue={property.preliminary_date}
        />
        <TextField
          label="Data rogito"
          name="deed_date"
          type="date"
          defaultValue={property.deed_date}
        />
        <TextField
          label="Provvigione venditore"
          name="commission_seller"
          defaultValue={property.commission_seller}
        />
        <TextField
          label="Provvigione acquirente"
          name="commission_buyer"
          defaultValue={property.commission_buyer}
        />
        <div className="flex items-end">
          <CheckboxRow
            label="Provvigioni incassate"
            name="commission_paid"
            defaultChecked={property.commission_paid === 1}
          />
        </div>
      </div>

      <SubmitButton>Registra la chiusura</SubmitButton>
    </form>
  );
}

/** Valutazione con i prezzi €/mq di zona. */
export function ValuationForm({
  property,
}: {
  property: Property;
}) {
  return (
    <form action={saveValuation} className="space-y-3">
      <input type="hidden" name="property_id" value={property.id} />
      {property.owner_client_id ? (
        <input type="hidden" name="client_id" value={property.owner_client_id} />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextField label="Comune" name="city" defaultValue={property.city} />
        <TextField label="Zona" name="zone" defaultValue={property.zone} />
        <TextField label="Metri quadri" name="sqm" defaultValue={property.sqm} />
        <TextField label="Metodo" name="method" placeholder="OMI + comparabili" />
        <TextField label="€/mq minimo" name="eur_sqm_min" placeholder="1900" />
        <TextField label="€/mq massimo" name="eur_sqm_max" placeholder="2500" />
      </div>

      <TextArea
        label="Note"
        name="notes"
        rows={2}
        placeholder="Fonte dei valori, stato dell'immobile, motivo dello scostamento…"
      />
      <SubmitButton>Salva valutazione</SubmitButton>
    </form>
  );
}
