import Link from "next/link";
import { saveClient } from "@/lib/actions";
import { AvvisoModulo, ModuloConEsito, SubmitButton } from "@/components/client";
import { Card, TextField, TextArea, SelectField, CheckboxGroup, CheckboxRow } from "@/components/ui";
import { fromCsv } from "@/lib/format";
import { CLIENT_ROLES, CLIENT_SOURCES, CLIENT_STATUSES } from "@/lib/types";
import type { Client } from "@/lib/types";

export function ClientForm({
  client,
  userOptions,
  propertyOptions,
  defaultOwnerId,
}: {
  client?: Client;
  userOptions: { value: string; label: string }[];
  propertyOptions: { value: string; label: string }[];
  defaultOwnerId: number;
}) {
  return (
    <ModuloConEsito azione={saveClient} className="space-y-5">
      {client ? <input type="hidden" name="id" value={client.id} /> : null}

      <Card title="Anagrafica">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField label="Nome" name="first_name" defaultValue={client?.first_name} />
          <TextField label="Cognome" name="last_name" defaultValue={client?.last_name} />
          <TextField
            label="Ragione sociale"
            name="company"
            defaultValue={client?.company}
            hint="Solo per aziende"
          />
          <TextField label="Cellulare" name="mobile" defaultValue={client?.mobile} type="tel" />
          <TextField label="Telefono fisso" name="phone" defaultValue={client?.phone} type="tel" />
          <TextField label="Email" name="email" defaultValue={client?.email} type="email" />
          <TextField
            label="Indirizzo"
            name="address"
            defaultValue={client?.address}
            className="sm:col-span-2"
          />
          <TextField label="Comune" name="city" defaultValue={client?.city} />
          <TextField
            label="Codice fiscale"
            name="tax_code"
            defaultValue={client?.tax_code}
          />
          <TextField
            label="Data di nascita"
            name="birth_date"
            type="date"
            defaultValue={client?.birth_date}
          />
        </div>
      </Card>

      <Card title="Inquadramento">
        <div className="space-y-4">
          <CheckboxGroup
            label="Che tipo di cliente è"
            name="roles"
            options={CLIENT_ROLES}
            selected={fromCsv(client?.roles)}
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SelectField
              label="Stato"
              name="status"
              options={CLIENT_STATUSES}
              defaultValue={client?.status ?? "attivo"}
              placeholder={null}
            />
            <SelectField
              label="Da dove arriva"
              name="source"
              options={CLIENT_SOURCES}
              defaultValue={client?.source}
            />
            <SelectField
              label="Seguito da"
              name="owner_id"
              options={userOptions}
              defaultValue={client?.owner_id ?? defaultOwnerId}
              placeholder="Nessuno"
            />
            <TextField
              label="Etichette"
              name="tags"
              defaultValue={client?.tags}
              placeholder="investitore, cliente storico"
              hint="Separate da virgola"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Per cosa ci ha contattato"
              name="contact_reason"
              defaultValue={client?.contact_reason}
              placeholder="Es. ha visto l'annuncio di un trilocale a Frigole"
              hint="Il motivo del primo contatto"
            />
            <SelectField
              label="Immobile per cui ci ha contattato"
              name="contact_property_id"
              options={propertyOptions}
              defaultValue={client?.contact_property_id}
              placeholder="Nessuno in particolare"
            />
          </div>

          <TextArea
            label="Note"
            name="notes"
            defaultValue={client?.notes}
            rows={4}
            placeholder="Tutto quello che è utile ricordare su questo cliente."
          />
        </div>
      </Card>

      <Card title="Privacy e antiriciclaggio">
        <div className="space-y-4">
          <CheckboxRow
            label="Ha dato il consenso al trattamento dei dati"
            name="privacy_consent"
            defaultChecked={client?.privacy_consent === 1}
            hint={
              client?.privacy_date
                ? `Consenso registrato il ${client.privacy_date}`
                : "La data viene registrata automaticamente"
            }
          />

          <TextField
            label="A cosa ha acconsentito"
            name="privacy_scope"
            defaultValue={client?.privacy_scope}
            placeholder="Es. gestione della trattativa e invio proposte immobiliari"
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField
              label="Documento d'identità"
              name="aml_doc_type"
              options={["Carta d'identità", "Patente", "Passaporto"]}
              defaultValue={client?.aml_doc_type}
            />
            <TextField
              label="Numero documento"
              name="aml_doc_number"
              defaultValue={client?.aml_doc_number}
            />
            <TextField
              label="Scadenza documento"
              name="aml_doc_expiry"
              type="date"
              defaultValue={client?.aml_doc_expiry}
            />
          </div>

          <p className="text-xs text-slate-500">
            I dati del documento servono all&apos;adeguata verifica prevista dalla normativa
            antiriciclaggio per gli agenti immobiliari. Compilali quando la trattativa si concretizza.
          </p>
        </div>
      </Card>

      <AvvisoModulo />

      <div className="flex items-center gap-3">
        <SubmitButton>{client ? "Salva modifiche" : "Crea cliente"}</SubmitButton>
        <Link href={client ? `/clienti/${client.id}` : "/clienti"} className="btn-secondary">
          Annulla
        </Link>
      </div>
    </ModuloConEsito>
  );
}
