import Link from "next/link";
import { saveProperty } from "@/lib/actions";
import { SubmitButton } from "@/components/client";
import { Card, TextField, TextArea, SelectField, CheckboxRow } from "@/components/ui";
import {
  ENERGY_CLASSES,
  PROPERTY_CONDITIONS,
  PROPERTY_KINDS,
  PROPERTY_STATUSES,
  ZONES,
} from "@/lib/types";
import type { Property } from "@/lib/types";

export function PropertyForm({
  property,
  userOptions,
  clientOptions,
  defaultAgentId,
}: {
  property?: Property;
  userOptions: { value: string; label: string }[];
  clientOptions: { value: string; label: string }[];
  defaultAgentId: number;
}) {
  return (
    <form action={saveProperty} className="space-y-5">
      {property ? <input type="hidden" name="id" value={property.id} /> : null}

      <Card title="L'immobile">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField
            label="Titolo"
            name="title"
            defaultValue={property?.title}
            required
            placeholder="Trilocale in via Parini, centro"
            className="sm:col-span-2"
          />
          <TextField
            label="Codice interno"
            name="ref"
            defaultValue={property?.ref}
            placeholder="MI-0042"
          />

          <SelectField
            label="Tipologia"
            name="kind"
            options={PROPERTY_KINDS}
            defaultValue={property?.kind}
          />
          <SelectField
            label="Contratto"
            name="contract"
            options={[
              { value: "vendita", label: "Vendita" },
              { value: "affitto", label: "Affitto" },
            ]}
            defaultValue={property?.contract ?? "vendita"}
            placeholder={null}
          />
          <SelectField
            label="Stato"
            name="status"
            options={PROPERTY_STATUSES}
            defaultValue={property?.status ?? "acquisizione"}
            placeholder={null}
          />

          <TextField
            label="Indirizzo"
            name="address"
            defaultValue={property?.address}
            className="sm:col-span-2"
          />
          <TextField label="Comune" name="city" defaultValue={property?.city} placeholder="Lecce" />
          <SelectField
            label="Zona"
            name="zone"
            options={ZONES}
            defaultValue={property?.zone}
            hint="Serve agli incroci con le richieste"
          />
        </div>
      </Card>

      <Card title="Caratteristiche">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField label="Metri quadri" name="sqm" defaultValue={property?.sqm} />
          <TextField label="Vani" name="rooms" defaultValue={property?.rooms} />
          <TextField label="Bagni" name="bathrooms" defaultValue={property?.bathrooms} />
          <TextField label="Piano" name="floor" defaultValue={property?.floor} placeholder="2" />
          <SelectField
            label="Stato dell'immobile"
            name="condition"
            options={PROPERTY_CONDITIONS}
            defaultValue={property?.condition}
          />
          <SelectField
            label="Classe energetica"
            name="energy_class"
            options={ENERGY_CLASSES}
            defaultValue={property?.energy_class}
          />
          <SelectField
            label="Esterno"
            name="outdoor"
            options={["Balcone", "Terrazzo", "Giardino", "Nessuno"]}
            defaultValue={property?.outdoor}
          />
          <div className="flex flex-col justify-end">
            <CheckboxRow
              label="Ascensore"
              name="elevator"
              defaultChecked={property?.elevator === 1}
            />
            <CheckboxRow label="Box / posto auto" name="garage" defaultChecked={property?.garage === 1} />
          </div>
        </div>
      </Card>

      <Card title="Prezzo e incarico">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField
            label="Prezzo richiesto"
            name="price"
            defaultValue={property?.price}
            placeholder="185000"
            hint="Solo numeri"
          />
          <TextField
            label="Prezzo minimo accettato"
            name="min_price"
            defaultValue={property?.min_price}
            hint="Riservato: non compare negli annunci"
          />
          <SelectField
            label="Proprietario"
            name="owner_client_id"
            options={clientOptions}
            defaultValue={property?.owner_client_id}
            placeholder="Non collegato"
            hint="Scegli una scheda cliente"
          />

          <TextField
            label="Inizio incarico"
            name="mandate_start"
            type="date"
            defaultValue={property?.mandate_start}
          />
          <TextField
            label="Scadenza incarico"
            name="mandate_end"
            type="date"
            defaultValue={property?.mandate_end}
            hint="Riceverai un avviso 45 giorni prima"
          />
          <TextField
            label="Provvigione %"
            name="commission_pct"
            defaultValue={property?.commission_pct}
            placeholder="3"
          />

          <SelectField
            label="Agente di riferimento"
            name="agent_id"
            options={userOptions}
            defaultValue={property?.agent_id ?? defaultAgentId}
            placeholder="Nessuno"
          />
          <div className="flex items-end">
            <CheckboxRow
              label="Incarico in esclusiva"
              name="exclusive"
              defaultChecked={property?.exclusive === 1}
            />
          </div>
        </div>
      </Card>

      <Card title="Note">
        <TextArea
          label="Note interne"
          name="notes"
          defaultValue={property?.notes}
          rows={4}
          placeholder="Situazione urbanistica, trattabilità, chiavi in agenzia…"
        />
      </Card>

      <div className="flex items-center gap-3">
        <SubmitButton>{property ? "Salva modifiche" : "Crea immobile"}</SubmitButton>
        <Link href={property ? `/immobili/${property.id}` : "/immobili"} className="btn-secondary">
          Annulla
        </Link>
      </div>
    </form>
  );
}
