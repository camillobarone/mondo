import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { agenda, activeUserOptions } from "@/lib/queries";
import { dateTime, relative } from "@/lib/format";
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
              {item.done_at ? (
                <span className="shrink-0 text-xs text-emerald-600">fatto</span>
              ) : (
                <CompleteButton id={item.id} />
              )}
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
  const everyone = params.tutti === "1";

  const { overdue, today, upcoming, done } = agenda(everyone ? null : user.id);
  const users = activeUserOptions();

  const clients = all<{ id: number; name: string }>(
    `SELECT id, TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,'')) AS name
       FROM clients WHERE deleted_at IS NULL
      ORDER BY last_name COLLATE NOCASE LIMIT 500`,
  );
  const properties = all<{ id: number; title: string }>(
    `SELECT id, title FROM properties WHERE deleted_at IS NULL
      ORDER BY updated_at DESC LIMIT 300`,
  );

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle="Telefonate, appuntamenti e cose da fare."
        actions={
          <Link href={everyone ? "/agenda" : "/agenda?tutti=1"} className="btn-secondary">
            {everyone ? "Solo le mie" : "Tutta l'agenzia"}
          </Link>
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
