import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { matchesByClient, incrociFraColleghi, type Match } from "@/lib/matching";
import { euro, whatsappHref } from "@/lib/format";
import { PageHeader, Card, EmptyState, Chip, Pagination } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * Il messaggio con cui si propone l'immobile, gia' scritto. L'incrocio da
 * solo non vende niente: vende il messaggio mandato entro dieci minuti.
 * Prima di inviare si puo' comunque ritoccare, e' testo normale in WhatsApp.
 */
function proposta(clientName: string, agente: string, match: Match): string {
  const nome = clientName.split(" ")[0] || "";
  const dove = [match.property.zone, match.property.city].filter(Boolean).join(", ");
  const pezzi = [
    match.property.title,
    dove,
    match.property.sqm ? `${match.property.sqm} mq` : "",
    match.property.price ? euro(match.property.price) : "",
  ].filter(Boolean);
  return (
    `Buongiorno${nome ? ` ${nome}` : ""}, sono ${agente} di Mondo Immobiliare. ` +
    `È arrivato un immobile in linea con la sua ricerca: ${pezzi.join(", ")}. ` +
    `Se le interessa possiamo organizzare una visita. Rimango a disposizione.`
  );
}

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ soloPerfetti?: string; page?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const onlyPerfect = params.soloPerfetti === "1";

  // Gia' raggruppati per cliente: una telefonata copre piu' immobili.
  const { groups, total, clients, page, pages } = matchesByClient(user.id, {
    onlyPerfect,
    page: Number(params.page ?? 1) || 1,
  });

  // Solo il numero: le segnalazioni fra colleghi stanno nella loro pagina,
  // perche' si leggono in un altro modo — li' non si chiama un cliente, si
  // chiama un collega.
  const conIColleghi = incrociFraColleghi(user.id, { limite: 0 });

  return (
    <>
      <PageHeader
        title="Incroci"
        subtitle="Chi chiamare, e per quale immobile. Aggiornato in tempo reale."
        actions={
          <>
            {conIColleghi.colleghi.length ? (
              <Link href="/incroci/colleghi" className="btn-secondary">
                Con i colleghi
                {conIColleghi.totale ? ` (${conIColleghi.totale})` : ""}
              </Link>
            ) : null}
            <Link
              href={onlyPerfect ? "/incroci" : "/incroci?soloPerfetti=1"}
              className="btn-secondary"
            >
              {onlyPerfect ? "Mostra tutti" : "Solo corrispondenze piene"}
            </Link>
          </>
        }
      />

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            title="Nessun incrocio al momento."
            hint={
              conIColleghi.totale
                ? `Nel tuo archivio non c'è niente da abbinare, ma ci sono ${conIColleghi.totale} segnalazioni con i colleghi.`
                : "Servono richieste aperte e immobili disponibili. Registra cosa cercano i tuoi acquirenti e gli abbinamenti compariranno qui."
            }
            action={
              conIColleghi.totale ? (
                <Link href="/incroci/colleghi" className="btn-secondary">
                  Vedi gli incroci con i colleghi
                </Link>
              ) : (
                <Link href="/richieste" className="btn-secondary">
                  Vai alle richieste
                </Link>
              )
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
                    <div className="flex shrink-0 items-center gap-2">
                      {whatsappHref(group.clientPhone) ? (
                        <a
                          href={
                            whatsappHref(
                              group.clientPhone,
                              proposta(group.clientName, user.name, match),
                            ) ?? "#"
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="btn-secondary px-2.5 py-1 text-xs"
                          title="Apre WhatsApp con la proposta già scritta"
                        >
                          Proponi su WhatsApp
                        </a>
                      ) : null}
                      <Chip tone={match.warnings.length === 0 ? "green" : "amber"}>
                        {match.score}/{match.total}
                      </Chip>
                    </div>
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
