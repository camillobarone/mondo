import { requireOwner } from "@/lib/auth";
import { usersWithLoad } from "@/lib/queries";
import { saveUser, eliminaUtente } from "@/lib/actions";
import { shortDate } from "@/lib/format";
import { SubmitButton, ConfirmButton } from "@/components/client";
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
  const io = await requireOwner();
  const params = await searchParams;
  const users = usersWithLoad();
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
                <th className="text-right">In carico</th>
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
                  <td className="text-right text-xs text-slate-600">
                    {user.clienti || user.immobili ? (
                      <>
                        {user.clienti} client{user.clienti === 1 ? "e" : "i"}
                        <div>
                          {user.immobili} immobil{user.immobili === 1 ? "e" : "i"}
                        </div>
                      </>
                    ) : (
                      <span className="text-slate-400">niente</span>
                    )}
                  </td>
                  <td className="text-right">
                    <a
                      href={`/utenti?modifica=${user.id}`}
                      className="text-xs text-brand-700 hover:underline"
                    >
                      modifica
                    </a>
                    {/*
                      Su se stessi il pulsante non c'e' proprio: l'azione lo
                      rifiuterebbe comunque, ma un pulsante che non si puo'
                      premere e' un pulsante che si prova a premere.
                    */}
                    {user.id === io.id ? null : (
                      <form action={eliminaUtente} className="mt-1">
                        <input type="hidden" name="id" value={user.id} />
                        <ConfirmButton
                          variant="nudo"
                          className="text-xs text-red-700 hover:underline"
                          message={
                            user.clienti || user.immobili
                              ? `Elimini l'utenza di ${user.name}.\n\n` +
                                `Le sue schede NON vengono cancellate: ${user.clienti} clienti e ` +
                                `${user.immobili} immobili passano a te, e da quel momento li vedi ` +
                                `nel tuo archivio.\n\nProcedere?`
                              : `Elimini l'utenza di ${user.name}. Non ha nessuna scheda in carico.\n\nProcedere?`
                          }
                        >
                          elimina
                        </ConfirmButton>
                      </form>
                    )}
                    <div className="text-xs text-slate-400">dal {shortDate(user.created_at)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Copia di sicurezza" className="lg:col-span-3">
          <div className="max-w-2xl text-sm text-slate-600">
            <p>
              Il server fa da sé una copia ogni notte. La copia va portata{" "}
              <strong>fuori dal server</strong>: se quel disco muore, muore con lui.
            </p>
            <p className="mt-2">
              Il pulsante che scaricava l&apos;archivio da qui non c&apos;è più. Adesso
              che ogni collaboratore vede solo le proprie schede, un file con dentro
              l&apos;intero archivio sarebbe la separazione aggirata con un clic: chi lo
              scarica si ritrova sul computer anche i clienti degli altri.
            </p>
            <p className="mt-2">
              Per portare la copia al sicuro si passa dal server, dove l&apos;archivio
              sta già tutto insieme. Il comando è nella guida di consegna, capitolo
              &laquo;Copie di sicurezza&raquo;.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Ognuno può comunque scaricare le <strong>proprie</strong> schede da Clienti
              e da Immobili, con il pulsante &laquo;Esporta&raquo;.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
