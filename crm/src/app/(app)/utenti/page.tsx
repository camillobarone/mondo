import { requireOwner } from "@/lib/auth";
import { listUsers } from "@/lib/queries";
import { saveUser } from "@/lib/actions";
import { shortDate } from "@/lib/format";
import { SubmitButton } from "@/components/client";
import { PageHeader, Card, TextField, SelectField, CheckboxRow, Chip } from "@/components/ui";
import { OFFICES } from "@/lib/types";

export const dynamic = "force-dynamic";

const ROLES = [
  { value: "agente", label: "Collaboratore" },
  { value: "titolare", label: "Titolare" },
];

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ modifica?: string }>;
}) {
  await requireOwner();
  const params = await searchParams;
  const users = listUsers();
  const editing = params.modifica ? users.find((u) => u.id === Number(params.modifica)) : undefined;

  return (
    <>
      <PageHeader
        title="Utenti"
        subtitle="Chi può entrare nel programma e cosa può vedere."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card
          title={editing ? `Modifica ${editing.name}` : "Nuovo utente"}
          className="lg:col-span-1"
        >
          <form action={saveUser} className="space-y-4">
            {editing ? <input type="hidden" name="id" value={editing.id} /> : null}

            <TextField label="Nome e cognome" name="name" defaultValue={editing?.name} required />
            <TextField
              label="Email"
              name="email"
              type="email"
              defaultValue={editing?.email}
              required
            />
            <TextField
              label={editing ? "Nuova password" : "Password"}
              name="password"
              type="password"
              required={!editing}
              hint={
                editing
                  ? "Lascia vuoto per non cambiarla"
                  : "Almeno 8 caratteri"
              }
            />
            <SelectField
              label="Ruolo"
              name="role"
              options={ROLES}
              defaultValue={editing?.role ?? "agente"}
              placeholder={null}
              hint="Il titolare vede provvigioni, utenti e registro accessi"
            />
            <SelectField
              label="Ufficio"
              name="office"
              options={OFFICES}
              defaultValue={editing?.office ?? "Lecce"}
              placeholder={null}
            />
            <CheckboxRow
              label="Accesso attivo"
              name="active"
              defaultChecked={editing ? editing.active === 1 : true}
            />

            <SubmitButton>{editing ? "Salva" : "Crea utente"}</SubmitButton>
          </form>
        </Card>

        <Card title={`Utenti (${users.length})`} className="lg:col-span-2" bodyClassName="">
          <table className="tbl">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Ruolo</th>
                <th>Ufficio</th>
                <th>Stato</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="font-medium text-slate-800">{user.name}</td>
                  <td className="text-xs text-slate-600">{user.email}</td>
                  <td>
                    <Chip tone={user.role === "titolare" ? "brand" : "slate"}>
                      {user.role === "titolare" ? "titolare" : "collaboratore"}
                    </Chip>
                  </td>
                  <td className="text-xs text-slate-600">{user.office}</td>
                  <td>
                    {user.active ? (
                      <Chip tone="green">attivo</Chip>
                    ) : (
                      <Chip tone="red">disattivato</Chip>
                    )}
                  </td>
                  <td className="text-right">
                    <a
                      href={`/utenti?modifica=${user.id}`}
                      className="text-xs text-brand-700 hover:underline"
                    >
                      modifica
                    </a>
                    <div className="text-xs text-slate-400">dal {shortDate(user.created_at)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Copia di sicurezza" className="lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-2xl text-sm text-slate-600">
              <p>
                Il server fa da sé una copia ogni notte, ma resta sullo stesso disco: se
                quel disco muore, muore con lui. <strong>Una volta a settimana</strong>{" "}
                scarica da qui l&apos;archivio e salvalo sul disco esterno
                (<code className="rounded bg-slate-100 px-1">F:\Gestionale backup</code>).
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Il file contiene tutto tranne le foto. Lo scaricamento viene annotato nel
                registro accessi.
              </p>
            </div>
            <a href="/backup" className="btn-primary shrink-0">
              Scarica l&apos;archivio
            </a>
          </div>
        </Card>
      </div>
    </>
  );
}
