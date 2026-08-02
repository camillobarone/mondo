import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listRequirements } from "@/lib/queries";
import { requirementSummary } from "@/lib/matching";
import { euro, fromCsv, shortDate } from "@/lib/format";
import { PageHeader, Card, EmptyState, StatusChip, Chip, Pagination } from "@/components/ui";
import { REQUIREMENT_STATUSES } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RequirementsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; contract?: string; city?: string; page?: string }>;
}) {
  await requireUser();
  const filters = await searchParams;
  const { rows: requirements, total, page, pages } = listRequirements({
    status: "aperta",
    ...filters,
  });

  return (
    <>
      <PageHeader
        title="Richieste"
        subtitle={`${total} richieste. Ognuna viene incrociata con il portafoglio.`}
        actions={
          <Link href="/incroci" className="btn-primary">
            Vedi gli incroci
          </Link>
        }
      />

      <Card className="mb-5">
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="q">
              Cerca
            </label>
            <input
              id="q"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Cliente, zona, note…"
              className="field"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="status">
              Stato
            </label>
            <select id="status" name="status" defaultValue={filters.status ?? "aperta"} className="field">
              <option value="">Tutte</option>
              {REQUIREMENT_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="contract">
              Tipo
            </label>
            <select id="contract" name="contract" defaultValue={filters.contract ?? ""} className="field">
              <option value="">Tutti</option>
              <option value="vendita">Acquisto</option>
              <option value="affitto">Affitto</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" className="btn-primary">
              Filtra
            </button>
            <Link href="/richieste" className="btn-ghost">
              Azzera
            </Link>
          </div>
        </form>
      </Card>

      <Card bodyClassName="">
        {requirements.length === 0 ? (
          <EmptyState
            title="Nessuna richiesta."
            hint="Le richieste si aggiungono dalla scheda del cliente."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {requirements.map((requirement) => {
              const summary =
                requirement.status === "aperta"
                  ? requirementSummary(requirement, 4)
                  : { count: 0, perfect: 0, top: [] };

              return (
                <li key={requirement.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/clienti/${requirement.client_id}`}
                          className="text-sm font-medium text-slate-800 hover:text-brand-700 hover:underline"
                        >
                          {requirement.client_name || `Cliente #${requirement.client_id}`}
                        </Link>
                        <StatusChip value={requirement.status} kind="requirement" />
                        {requirement.urgency === "alta" ? <Chip tone="red">urgente</Chip> : null}
                      </div>

                      <p className="mt-0.5 text-sm text-slate-600">
                        {requirement.contract === "affitto" ? "Affitto" : "Acquisto"}
                        {requirement.kind ? ` · ${requirement.kind}` : ""}
                        {requirement.city ? ` a ${requirement.city}` : ""}
                        {requirement.budget_max ? ` · fino a ${euro(requirement.budget_max)}` : ""}
                        {requirement.sqm_min ? ` · da ${requirement.sqm_min} mq` : ""}
                      </p>

                      {fromCsv(requirement.zones).length ? (
                        <p className="mt-0.5 text-xs text-slate-500">
                          Zone: {fromCsv(requirement.zones).join(", ")}
                        </p>
                      ) : null}

                      <p className="mt-0.5 text-xs text-slate-400">
                        Aggiornata il {shortDate(requirement.updated_at)}
                        {requirement.client_mobile ? ` · ${requirement.client_mobile}` : ""}
                      </p>
                    </div>

                    <div className="text-right">
                      {requirement.status === "aperta" ? (
                        summary.count ? (
                          <>
                            <p className="text-sm font-semibold text-brand-700">
                              {summary.count} immobili
                            </p>
                            {summary.perfect ? (
                              <p className="text-xs text-emerald-600">{summary.perfect} perfetti</p>
                            ) : null}
                          </>
                        ) : (
                          <p className="text-xs text-slate-400">nessun incrocio</p>
                        )
                      ) : null}
                      <Link
                        href={`/clienti/${requirement.client_id}?modifica_richiesta=${requirement.id}`}
                        className="mt-1 inline-block text-xs text-brand-700 hover:underline"
                      >
                        modifica
                      </Link>
                    </div>
                  </div>

                  {summary.top.length > 0 ? (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {summary.top.map((match) => (
                        <li key={match.property.id}>
                          <Link
                            href={`/immobili/${match.property.id}`}
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs hover:border-brand-300"
                          >
                            <span className="font-medium text-slate-700">
                              {match.property.title}
                            </span>
                            <span className="text-slate-500">{euro(match.property.price)}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <Pagination
          page={page}
          pages={pages}
          total={total}
          params={filters as Record<string, string | undefined>}
          basePath="/richieste"
        />
      </Card>
    </>
  );
}
