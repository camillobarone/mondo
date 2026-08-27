import Link from "next/link";
import { saveProperty } from "@/lib/actions";
import { SubmitButton } from "@/components/client";
import { Card, TextField, TextArea, SelectField, CheckboxRow, ComboField } from "@/components/ui";
import {
  ENERGY_CLASSES,
  PROPERTY_CONDITIONS,
  PROPERTY_KINDS,
  PROPERTY_STATUSES,
} from "@/lib/types";
import type { Property } from "@/lib/types";

export function PropertyForm({
  property,
  userOptions,
  defaultAgentId,
  zoneOptions,
}: {
  property?: Property;
  userOptions: { value: string; label: string }[];
  defaultAgentId: number;
  /** Zone gia' in archivio: suggerimenti, non un elenco chiuso. */
  zoneOptions: string[];
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
            required
            placeholder="Via Roma 10"
            className="sm:col-span-2"
            hint="Serve a riconoscere l'immobile a colpo d'occhio nelle liste e nelle tendine"
          />
          <TextField label="Comune" name="city" defaultValue={property?.city} placeholder="Lecce" />
          <ComboField
            label="Zona o localita'"
            name="zone"
            options={zoneOptions}
            defaultValue={property?.zone}
            placeholder="Centro storico, Torre Lapillo, contrada…"
            hint="Scegli dai suggerimenti o scrivine una nuova: serve agli incroci"
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
          {/* Il proprietario si collega dalla scheda dell'immobile, dove c'e'
              una ricerca: una tendina con tutto l'archivio clienti dentro non
              e' utilizzabile. Qui viaggia nascosto per non perderlo. */}
          <input
            type="hidden"
            name="owner_client_id"
            value={property?.owner_client_id ?? ""}
          />
          <div className="text-xs text-slate-400 sm:col-span-2 lg:col-span-1">
            <span className="field-label">Proprietario</span>
            {property?.owner_client_id
              ? "Collegato. Si cambia dalla scheda dell'immobile."
              : "Si collega dalla scheda dell'immobile, dopo aver salvato: lì c'è la ricerca fra i clienti."}
          </div>

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
