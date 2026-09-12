import { requireUser } from "@/lib/auth";
import { PageHeader, Card, Banner } from "@/components/ui";
import { ImportForm } from "./import-form";

export const dynamic = "force-dynamic";

const COLUMNS: [string, string][] = [
  ["Nome", "Nome di battesimo"],
  ["Cognome", "Cognome"],
  ["Ragione sociale", "Per le aziende"],
  ["Cellulare", "Usato anche per riconoscere i doppioni"],
  ["Telefono", "Numero fisso"],
  ["Email", "Usata anche per riconoscere i doppioni"],
  ["Indirizzo", "Via e numero civico"],
  ["Città", "Comune di residenza"],
  ["Codice fiscale", "Se disponibile"],
  ["Ruolo", "venditore, acquirente, locatore, conduttore"],
  ["Provenienza", "Da dove è arrivato il contatto"],
  ["Etichette", "Separate da virgola"],
  ["Note", "Testo libero"],
];

export default async function ImportPage() {
  await requireUser();

  return (
    <>
      <PageHeader
        title="Importa clienti"
        subtitle="Porta dentro l'archivio esistente da un file Excel o CSV."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Carica il file">
            <ImportForm />
          </Card>

          <div className="mt-4">
            <Banner tone="blue">
              <strong>Prima di importare tutto:</strong> prova con un file di 10 righe. Controlla che
              i dati finiscano nelle colonne giuste, poi carica l&apos;archivio completo.
            </Banner>
          </div>
        </div>

        <Card title="Colonne riconosciute">
          <p className="mb-3 text-xs text-slate-500">
            Il programma riconosce queste intestazioni, in qualsiasi ordine. Le colonne che non
            servono vengono ignorate; quelle mancanti restano vuote.
          </p>
          <dl className="space-y-2">
            {COLUMNS.map(([name, description]) => (
              <div key={name}>
                <dt className="text-sm font-medium text-slate-700">{name}</dt>
                <dd className="text-xs text-slate-500">{description}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </>
  );
}
