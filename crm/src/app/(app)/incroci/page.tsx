import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { matchesByClient } from "@/lib/matching";
import { euro } from "@/lib/format";
import { PageHeader, Card, EmptyState, Chip, Pagination } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ soloPerfetti?: string; page?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const onlyPerfect = params.soloPerfetti === "1";

  // Gia' raggruppati per cliente: una telefonata copre piu' immobili.
  const { groups, total, clients, page, pages } = matchesByClient({
    onlyPerfect,
    page: Number(params.page ?? 1) || 1,
  });

  return (
    <>
      <PageHeader
        title="Incroci"
        subtitle="Chi chiamare, e per quale immobile. Aggiornato in tempo reale."
        actions={
          <Link
            href={onlyPerfect ? "/incroci" : "/incroci?soloPerfetti=1"}
            className="btn-secondary"
          >
            {onlyPerfect ? "Mostra tutti" : "Solo corrispondenze piene"}
          </Link>
        }
      />

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            title="Nessun incrocio al momento."
            hint="Servono richieste aperte e immobili disponibili. Registra cosa cercano i tuoi acquirenti e gli abbinamenti compariranno qui."
            action={
              <Link href="/richieste" className="btn-secondary">
                Vai alle richieste
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            {total} abbinamenti per {clients} clienti
            {pages > 1 ? ` · pagina ${page} di ${pages}, i più promettenti per primi` : ""}.
          </p>

          {groups.map((group) => (
            <Card
              key={group.clientId}
              title={
                <Link
                  href={`/clienti/${group.clientId}`}
                  className="hover:text-brand-700 hover:underline"
                >
                  {group.clientName || `Cliente #${group.clientId}`}
                </Link>
              }
              actions={
                <span className="text-xs text-slate-500">
                  {group.total} {group.total === 1 ? "immobile" : "immobili"}
                  {group.total > group.matches.length ? ` · mostrati i primi ${group.matches.length}` : ""}
                </span>
              }
              bodyClassName=""
            >
              <ul className="divide-y divide-slate-100">
                {group.matches.map((match) => (
                  <li
                    key={`${match.requirement.id}-${match.property.id}`}
                    className="flex flex-wrap items-start justify-between gap-3 px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/immobili/${match.property.id}`}
                        className="text-sm font-medium text-slate-800 hover:text-brand-700 hover:underline"
                      >
                        {match.property.title}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {euro(match.property.price)}
                        {match.property.zone ? ` · ${match.property.zone}` : ""}
                        {match.property.sqm ? ` · ${match.property.sqm} mq` : ""}
                      </p>
                      <p className="text-xs text-emerald-700">{match.reasons.join(" · ")}</p>
                      {match.warnings.length ? (
                        <p className="text-xs text-amber-700">{match.warnings.join(" · ")}</p>
                      ) : null}
                    </div>
                    <Chip tone={match.warnings.length === 0 ? "green" : "amber"}>
                      {match.score}/{match.total}
                    </Chip>
                  </li>
                ))}
              </ul>
            </Card>
          ))}

          <Card bodyClassName="">
            <Pagination
              page={page}
              pages={pages}
              total={clients}
              params={params as Record<string, string | undefined>}
              basePath="/incroci"
            />
          </Card>
        </div>
      )}
    </>
  );
}
