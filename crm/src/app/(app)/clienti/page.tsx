import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listClients, activeUserOptions, clientTags, type ClientFilters } from "@/lib/queries";
import { fullName, shortDate, daysSince, phoneHref, euro, fromCsv } from "@/lib/format";
import { PageHeader, Card, EmptyState, StatusChip, Chip, Pagination, Banner } from "@/components/ui";
import { CLIENT_ROLES, CLIENT_SOURCES, CLIENT_STATUSES } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<ClientFilters>;
}) {
  await requireUser();
  const filters = await searchParams;
  const { rows, total, page, pages } = listClients(filters);
  const users = activeUserOptions();
  const tags = clientTags();

  const exportQuery = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => Boolean(value)) as [string, string][],
  ).toString();

  return (
    <>
      <PageHeader
        title="Clienti"
        subtitle={`${total} ${total === 1 ? "scheda" : "schede"} in archivio`}
        actions={
          <>
            <Link
              href={`/clienti/esporta${exportQuery ? `?${exportQuery}` : ""}`}
              className="btn-secondary"
              prefetch={false}
            >
              Esporta in Excel
            </Link>
            <Link href="/clienti/nuovo" className="btn-primary">
              Nuovo cliente
            </Link>
          </>
        }
      />

      {/* Il filtro speciale arriva dal cruscotto e non ha un controllo suo nel
          modulo qui sotto: senza questa fascia sembrerebbe un elenco monco. */}
      {filters.senza ? (
        <div className="mb-4">
          <Banner tone="amber">
            Stai vedendo solo{" "}
            <strong>
              {filters.senza === "richiesta"
                ? "gli acquirenti senza una richiesta aperta"
                : filters.senza === "privacy"
                  ? "i clienti attivi senza consenso privacy"
                  : "i clienti con il documento antiriciclaggio scaduto"}
            </strong>
            .{" "}
            <Link href="/clienti" className="font-medium underline">
              Torna a tutti i clienti
            </Link>
            .
          </Banner>
        </div>
      ) : null}

      {/* ------------------------------------------------------------ filtri */}
      <Card className="mb-5">
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="q">
              Cerca
            </label>
            <input
              id="q"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Nome, telefono, email, note…"
              className="field"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="status">
              Stato
            </label>
            <select id="status" name="status" defaultValue={filters.status ?? ""} className="field">
              <option value="">Tutti</option>
              {CLIENT_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="role">
              Tipo
            </label>
            <select id="role" name="role" defaultValue={filters.role ?? ""} className="field">
              <option value="">Tutti</option>
              {CLIENT_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="owner">
              Seguito da
            </label>
            <select id="owner" name="owner" defaultValue={filters.owner ?? ""} className="field">
              <option value="">Tutti</option>
              {users.map((user) => (
                <option key={user.value} value={user.value}>
                  {user.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="silentDays">
              Non sentiti da
            </label>
            <select
              id="silentDays"
              name="silentDays"
              defaultValue={filters.silentDays ?? ""}
              className="field"
            >
              <option value="">Qualsiasi</option>
              <option value="30">1 mese</option>
              <option value="90">3 mesi</option>
              <option value="180">6 mesi</option>
              <option value="365">1 anno</option>
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="source">
              Provenienza
            </label>
            <select id="source" name="source" defaultValue={filters.source ?? ""} className="field">
              <option value="">Tutte</option>
              {CLIENT_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </div>

          {tags.length > 0 ? (
            <div>
              <label className="field-label" htmlFor="tag">
                Etichetta
              </label>
              <select id="tag" name="tag" defaultValue={filters.tag ?? ""} className="field">
                <option value="">Tutte</option>
                {tags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="flex items-end gap-2 sm:col-span-2">
            <button type="submit" className="btn-primary">
              Filtra
            </button>
            <Link href="/clienti" className="btn-ghost">
              Azzera
            </Link>
          </div>
        </form>
      </Card>

      {/* ------------------------------------------------------------ elenco */}
      <Card bodyClassName="">
        {rows.length === 0 ? (
          <EmptyState
            title="Nessun cliente trovato."
            hint="Prova ad allargare la ricerca, oppure importa l'archivio da un file Excel."
            action={
              <Link href="/importa" className="btn-secondary">
                Importa da Excel
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Recapiti</th>
                  <th>Tipo</th>
                  <th>Cosa cerca</th>
                  <th>Stato</th>
                  <th>Seguito da</th>
                  <th>Ultimo contatto</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((client) => {
                  const silent = daysSince(client.last_contact_at);
                  const mobile = phoneHref(client.mobile ?? client.phone);
                  // Chi compra o affitta senza una richiesta registrata resta
                  // fuori dagli incroci: va detto qui, non scoperto dopo.
                  const buyer = fromCsv(client.roles).some(
                    (role) => role === "acquirente" || role === "conduttore",
                  );
                  const missingRequirement = buyer && client.open_requirements === 0;
                  return (
                    <tr key={client.id}>
                      <td>
                        <Link
                          href={`/clienti/${client.id}`}
                          className="font-medium text-slate-800 hover:text-brand-700 hover:underline"
                        >
                          {fullName(client)}
                        </Link>
                        {client.open_requirements > 0 ? (
                          <span className="ml-2 text-xs text-brand-700">
                            {client.open_requirements}{" "}
                            {client.open_requirements === 1 ? "richiesta" : "richieste"}
                          </span>
                        ) : null}
                        {client.city ? (
                          <div className="text-xs text-slate-400">{client.city}</div>
                        ) : null}
                      </td>
                      <td className="text-xs text-slate-600">
                        {mobile ? (
                          <a href={`tel:${mobile}`} className="block hover:text-brand-700">
                            {client.mobile ?? client.phone}
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                        {client.email ? (
                          <a
                            href={`mailto:${client.email}`}
                            className="block truncate hover:text-brand-700"
                          >
                            {client.email}
                          </a>
                        ) : null}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {client.roles
                            ? client.roles
                                .split(",")
                                .filter(Boolean)
                                .map((role) => (
                                  <Chip key={role} tone="slate">
                                    {role}
                                  </Chip>
                                ))
                            : <span className="text-xs text-slate-400">—</span>}
                        </div>
                      </td>
                      <td className="text-xs">
                        {client.want_budget_max || client.want_budget_min ? (
                          <>
                            <div className="font-medium text-slate-800">
                              {client.want_budget_min && client.want_budget_max
                                ? `${euro(client.want_budget_min)} – ${euro(client.want_budget_max)}`
                                : client.want_budget_max
                                  ? `fino a ${euro(client.want_budget_max)}`
                                  : `da ${euro(client.want_budget_min)}`}
                            </div>
                            {client.want_city || client.want_zones ? (
                              <div className="text-slate-500">
                                {[client.want_city, fromCsv(client.want_zones).join(", ")]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </div>
                            ) : null}
                          </>
                        ) : missingRequirement ? (
                          <Link href={`/clienti/${client.id}?nuova_richiesta=1`}>
                            <Chip tone="red">manca la richiesta</Chip>
                          </Link>
                        ) : client.open_requirements > 0 ? (
                          <span className="text-slate-500">budget non indicato</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td>
                        <StatusChip value={client.status} kind="client" />
                      </td>
                      <td className="text-xs text-slate-600">{client.owner_name ?? "—"}</td>
                      <td className="text-xs">
                        {client.last_contact_at ? (
                          <span className={silent && silent > 90 ? "text-amber-700" : "text-slate-600"}>
                            {shortDate(client.last_contact_at)}
                          </span>
                        ) : (
                          <span className="text-slate-400">mai</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={page}
          pages={pages}
          total={total}
          params={filters as Record<string, string | undefined>}
          basePath="/clienti"
        />
      </Card>
    </>
  );
}
