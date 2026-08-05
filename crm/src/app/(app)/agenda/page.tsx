import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { agenda, activeUserOptions, upcomingBirthdays } from "@/lib/queries";
import { dateTime, relative, fullName, shortDate, phoneHref, whatsappHref } from "@/lib/format";
import { PageHeader, Card, EmptyState, Chip } from "@/components/ui";
import { CompleteButton } from "./complete-button";
import { ActivityForm } from "./activity-form";
import type { ActivityRow } from "@/lib/queries";

export const dynamic = "force-dynamic";

function Section({
  title,
  items,
  tone = "brand",
  emptyText,
}: {
  title: string;
  items: ActivityRow[];
  tone?: string;
  emptyText: string;
}) {
  return (
    <Card title={`${title} (${items.length})`} bodyClassName="">
      {items.length === 0 ? (
        <EmptyState title={emptyText} />
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={tone}>{item.type}</Chip>
                  <span className="text-sm font-medium text-slate-800">
                    {item.title || "(senza titolo)"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {dateTime(item.done_at ?? item.due_at)}
                  {item.due_at && !item.done_at ? ` · ${relative(item.due_at)}` : ""}
                  {item.user_name ? ` · ${item.user_name}` : ""}
                </p>
                {(item.client_name || item.property_title) && (
                  <p className="mt-0.5 text-xs">
                    {item.client_name ? (
                      <Link
                        href={`/clienti/${item.client_id}`}
                        className="text-brand-700 hover:underline"
                      >
                        {item.client_name}
                      </Link>
                    ) : null}
                    {item.client_name && item.property_title ? (
                      <span className="text-slate-400"> · </span>
                    ) : null}
                    {item.property_title ? (
                      <Link
                        href={`/immobili/${item.property_id}`}
                        className="text-brand-700 hover:underline"
                      >
                        {item.property_title}
                      </Link>
                    ) : null}
                  </p>
                )}
                {item.notes ? (
                  <p className="mt-1 text-xs whitespace-pre-line text-slate-600">{item.notes}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {item.due_at ? (
                  <a
                    href={`/agenda/${item.id}/ics`}
                    className="text-xs text-slate-400 hover:text-brand-700 hover:underline"
                    title="Aggiungi al tuo calendario, con l'avviso 30 minuti prima"
                  >
                    Calendario
                  </a>
                ) : null}
                <Link
                  href={`/agenda/${item.id}/modifica?da=/agenda`}
                  className="text-xs text-slate-400 hover:text-brand-700 hover:underline"
                >
                  Modifica
                </Link>
                {item.done_at ? (
                  <span className="text-xs text-emerald-600">fatto</span>
                ) : (
                  <CompleteButton id={item.id} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ tutti?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  // "Tutte" non vuol dire piu' quelle dell'agenzia: vuol dire tutte quelle
  // che rientrano nel proprio archivio, comprese quelle segnate da un collega
  // su una scheda mia durante un giro fatto insieme.
  const everyone = params.tutti === "1";

  const { overdue, today, upcoming, done } = agenda(user.id, !everyone);
  // Gli auguri sono la telefonata che costa meno e vale di piu': se non
  // compaiono da soli il giorno giusto, non li fa nessuno.
  const compleanni = upcomingBirthdays(user.id, 7);
  const users = activeUserOptions();

  const clients = all<{ id: number; name: string }>(
    `SELECT id, TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,'')) AS name
       FROM clients WHERE deleted_at IS NULL AND owner_id = ?
      ORDER BY last_name COLLATE NOCASE LIMIT 500`,
    [user.id],
  );
  const properties = all<{ id: number; title: string }>(
    `SELECT id, title FROM properties WHERE deleted_at IS NULL AND agent_id = ?
      ORDER BY updated_at DESC LIMIT 300`,
    [user.id],
  );

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle="Telefonate, appuntamenti e cose da fare."
        actions={
          <>
            <Link href="/agenda/calendario" className="btn-secondary">
              Calendario e avvisi
            </Link>
            <Link href={everyone ? "/agenda" : "/agenda?tutti=1"} className="btn-secondary">
              {everyone ? "Solo assegnate a me" : "Tutte le mie schede"}
            </Link>
          </>
        }
      />

      <Card title="Registra un'attività" className="mb-5">
        <ActivityForm
          userOptions={users}
          defaultUserId={user.id}
          clientOptions={clients.map((client) => ({
            value: String(client.id),
            label: client.name || `Cliente #${client.id}`,
          }))}
          propertyOptions={properties.map((property) => ({
            value: String(property.id),
            label: property.title,
          }))}
        />
      </Card>

      <div className="space-y-5">
        {compleanni.length > 0 ? (
          <Card title={`Compleanni (${compleanni.length})`} bodyClassName="">
            <ul className="divide-y divide-slate-100">
              {compleanni.map((cliente) => {
                const cellulare = phoneHref(cliente.mobile ?? cliente.phone);
                return (
                  <li
                    key={cliente.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Chip tone={cliente.birthdayIn === 0 ? "brand" : "amber"}>
                          {cliente.birthdayIn === 0
                            ? "oggi"
                            : cliente.birthdayIn === 1
                              ? "domani"
                              : `fra ${cliente.birthdayIn} giorni`}
                        </Chip>
                        <Link
                          href={`/clienti/${cliente.id}`}
                          className="text-sm font-medium text-slate-800 hover:text-brand-700 hover:underline"
                        >
                          {fullName(cliente)}
                        </Link>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {shortDate(cliente.birth_date)}
                        {cliente.age > 0 ? ` · compie ${cliente.age} anni` : ""}
                      </p>
                    </div>

                    {cellulare ? (
                      <div className="flex gap-2">
                        <a href={`tel:${cellulare}`} className="btn-secondary px-2.5 py-1 text-xs">
                          Chiama
                        </a>
                        <a
                          href={
                            whatsappHref(
                              cellulare,
                              `Tanti auguri ${cliente.first_name || ""}!`.trim(),
                            ) ?? "#"
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="btn-secondary px-2.5 py-1 text-xs"
                        >
                          Auguri su WhatsApp
                        </a>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : null}

        {overdue.length > 0 ? (
          <Section title="In ritardo" items={overdue} tone="red" emptyText="" />
        ) : null}
        <Section title="Oggi" items={today} emptyText="Niente in programma per oggi." />
        <Section
          title="Prossimi 14 giorni"
          items={upcoming}
          tone="slate"
          emptyText="Nessun appuntamento in arrivo."
        />
        <Section
          title="Fatte di recente"
          items={done}
          tone="green"
          emptyText="Nessuna attività registrata nelle ultime due settimane."
        />
      </div>
    </>
  );
}
