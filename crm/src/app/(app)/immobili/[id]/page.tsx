import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import {
  getProperty,
  activitiesOfProperty,
  offersOfProperty,
  priceHistory,
  valuationsOfProperty,
  activeUserOptions,
} from "@/lib/queries";
import { matchesForProperty, countMatchesForProperty, nearMissesForProperty } from "@/lib/matching";
import { photosOfProperty } from "@/lib/queries";
import { PhotoGallery } from "./photo-gallery";
import { deleteProperty } from "@/lib/actions";
import { euro, shortDate, dateTime, relative, label } from "@/lib/format";
import {
  PageHeader,
  Card,
  DataRow,
  Chip,
  StatusChip,
  EmptyState,
  Banner,
} from "@/components/ui";
import { ConfirmButton, Collapsible } from "@/components/client";
import { ActivityForm } from "../../agenda/activity-form";
import { CompleteButton } from "../../agenda/complete-button";
import { OfferForm, OfferStatusForm, CloseDealForm, ValuationForm } from "./forms";
import { PROPERTY_STATUSES, OFFER_STATUSES } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const propertyId = Number(id);

  const property = getProperty(propertyId);
  if (!property) notFound();

  const matches = matchesForProperty(property);
  const matchCount = countMatchesForProperty(property);
  const missed = nearMissesForProperty(property);
  const photos = photosOfProperty(property.id);
  const offers = offersOfProperty(propertyId);
  const activities = activitiesOfProperty(propertyId);
  const prices = priceHistory(propertyId);
  const valuations = valuationsOfProperty(propertyId);
  const users = activeUserOptions();

  const clients = all<{ id: number; name: string }>(
    `SELECT id, TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,'')) AS name
       FROM clients WHERE deleted_at IS NULL
      ORDER BY last_name COLLATE NOCASE LIMIT 1000`,
  );
  const clientOptions = clients.map((client) => ({
    value: String(client.id),
    label: client.name || `Cliente #${client.id}`,
  }));

  const visits = activities.filter((activity) => activity.type === "visita");
  const mandateExpiring =
    property.mandate_end &&
    new Date(property.mandate_end).getTime() - Date.now() < 45 * 864e5 &&
    !["venduto", "ritirato"].includes(property.status);

  return (
    <>
      <PageHeader
        title={property.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusChip value={property.status} kind="property" />
            {property.exclusive ? <Chip tone="brand">esclusiva</Chip> : null}
            <span className="text-sm text-slate-500">
              {[property.kind, property.zone, property.city].filter(Boolean).join(" · ")}
            </span>
          </span>
        }
        actions={
          <Link href={`/immobili/${property.id}/modifica`} className="btn-primary">
            Modifica
          </Link>
        }
      />

      {mandateExpiring ? (
        <div className="mb-4">
          <Banner tone="amber">
            L&apos;incarico scade il {shortDate(property.mandate_end)} ({relative(property.mandate_end)}).
            Contatta il proprietario per il rinnovo.
          </Banner>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ------------------------------------------------- colonna sinistra */}
        <div className="space-y-5">
          <Card title="Scheda">
            <dl>
              <DataRow label="Prezzo richiesto">
                <span className="text-base font-semibold text-slate-900">
                  {euro(property.price)}
                </span>
                {property.sqm && property.price ? (
                  <span className="ml-2 text-xs text-slate-500">
                    {Math.round(property.price / property.sqm)} €/mq
                  </span>
                ) : null}
              </DataRow>
              {user.role === "titolare" || property.agent_id === user.id ? (
                <DataRow label="Minimo accettato">{euro(property.min_price)}</DataRow>
              ) : null}
              <DataRow label="Contratto">{property.contract}</DataRow>
              <DataRow label="Stato">{label(property.status, PROPERTY_STATUSES)}</DataRow>
              <DataRow label="Codice">{property.ref}</DataRow>
              <DataRow label="Indirizzo">{property.address}</DataRow>
              <DataRow label="Metri quadri">{property.sqm ? `${property.sqm} mq` : null}</DataRow>
              <DataRow label="Vani / bagni">
                {[property.rooms, property.bathrooms].some(Boolean)
                  ? `${property.rooms ?? "?"} vani · ${property.bathrooms ?? "?"} bagni`
                  : null}
              </DataRow>
              <DataRow label="Piano">
                {property.floor}
                {property.elevator ? " · con ascensore" : ""}
              </DataRow>
              <DataRow label="Esterno">{property.outdoor}</DataRow>
              <DataRow label="Box">{property.garage ? "Sì" : "No"}</DataRow>
              <DataRow label="Stato immobile">{property.condition}</DataRow>
              <DataRow label="Classe energetica">{property.energy_class}</DataRow>
            </dl>
          </Card>

          <Card title="Incarico">
            <dl>
              <DataRow label="Proprietario">
                {property.owner_client_id ? (
                  <Link
                    href={`/clienti/${property.owner_client_id}`}
                    className="text-brand-700 hover:underline"
                  >
                    {property.owner_name}
                  </Link>
                ) : (
                  <span className="text-amber-700">non collegato a una scheda</span>
                )}
              </DataRow>
              <DataRow label="Agente">{property.agent_name}</DataRow>
              <DataRow label="Dal">{shortDate(property.mandate_start)}</DataRow>
              <DataRow label="Fino al">
                <span className={mandateExpiring ? "text-amber-700" : ""}>
                  {shortDate(property.mandate_end)}
                </span>
              </DataRow>
              <DataRow label="Esclusiva">{property.exclusive ? "Sì" : "No"}</DataRow>
              <DataRow label="Provvigione">
                {property.commission_pct ? `${property.commission_pct}%` : null}
              </DataRow>
            </dl>
          </Card>

          {prices.length > 1 ? (
            <Card title="Storico prezzi">
              <ul className="space-y-1.5 text-sm">
                {prices.map((entry, index) => {
                  const previous = prices[index + 1];
                  const delta = previous ? entry.price - previous.price : 0;
                  return (
                    <li key={entry.id} className="flex items-center justify-between">
                      <span className="text-slate-700">{euro(entry.price)}</span>
                      <span className="text-xs text-slate-400">
                        {delta !== 0 ? (
                          <span className={delta < 0 ? "text-red-600" : "text-emerald-600"}>
                            {delta > 0 ? "+" : ""}
                            {euro(delta)}{" "}
                          </span>
                        ) : null}
                        {shortDate(entry.changed_at)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : null}

          {property.status === "venduto" && user.role === "titolare" ? (
            <Card title="Chiusura">
              <dl>
                <DataRow label="Prezzo di rogito">{euro(property.sold_price)}</DataRow>
                <DataRow label="Compromesso">{shortDate(property.preliminary_date)}</DataRow>
                <DataRow label="Rogito">{shortDate(property.deed_date)}</DataRow>
                <DataRow label="Provvigione venditore">{euro(property.commission_seller)}</DataRow>
                <DataRow label="Provvigione acquirente">{euro(property.commission_buyer)}</DataRow>
                <DataRow label="Incassate">{property.commission_paid ? "Sì" : "No"}</DataRow>
              </dl>
            </Card>
          ) : null}

          {property.notes ? (
            <Card title="Note interne">
              <p className="text-sm whitespace-pre-line text-slate-700">{property.notes}</p>
            </Card>
          ) : null}

          <form action={deleteProperty}>
            <input type="hidden" name="id" value={property.id} />
            <ConfirmButton
              message={`Eliminare "${property.title}"? Resterà nel registro ma sparirà dagli elenchi.`}
              className="w-full"
            >
              Elimina immobile
            </ConfirmButton>
          </form>
        </div>

        {/* --------------------------------------------------- colonna destra */}
        <div className="space-y-5 lg:col-span-2">
          {/* ------------------------------------------------------------ foto */}
          <Card title={`Foto (${photos.length})`}>
            <PhotoGallery propertyId={property.id} photos={photos} />
          </Card>

          {/* -------------------------------------------------- a chi proporlo */}
          <Card
            title={`A chi proporlo (${matchCount})`}
            actions={
              <Link href="/incroci" className="text-xs text-brand-700 hover:underline">
                Tutti gli incroci
              </Link>
            }
            bodyClassName=""
          >
            {matches.length === 0 ? (
              <EmptyState
                title="Nessuna richiesta aperta corrisponde a questo immobile."
                hint="Registra le richieste dei tuoi acquirenti: gli incroci compariranno qui da soli."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {matches.map((match) => (
                  <li key={match.requirement.id} className="px-4 py-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/clienti/${match.requirement.client_id}`}
                          className="text-sm font-medium text-slate-800 hover:text-brand-700 hover:underline"
                        >
                          {match.client_name}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {match.reasons.join(" · ") || "Corrispondenza parziale"}
                        </p>
                        {match.warnings.length ? (
                          <p className="text-xs text-amber-700">{match.warnings.join(" · ")}</p>
                        ) : null}
                      </div>
                      <Chip tone={match.warnings.length === 0 ? "green" : "amber"}>
                        {match.score}/{match.total}
                      </Chip>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* ------------------------------------------------- perche' esclusi */}
          {missed.total > 0 ? (
            <Card title={`Richieste scartate (${missed.total})`} bodyClassName="">
              <p className="px-4 pt-3 text-xs text-slate-500">
                {[
                  missed.byReason.budget
                    ? `${missed.byReason.budget} fuori budget`
                    : null,
                  missed.byReason.metratura
                    ? `${missed.byReason.metratura} sotto la metratura richiesta`
                    : null,
                  missed.byReason.contratto
                    ? `${missed.byReason.contratto} cercano l'altro tipo di contratto`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                .
              </p>
              {missed.items.length ? (
                <ul className="divide-y divide-slate-100">
                  {missed.items.map((item) => (
                    <li
                      key={item.requirement.id}
                      className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2"
                    >
                      <Link
                        href={`/clienti/${item.requirement.client_id}`}
                        className="text-sm text-slate-700 hover:text-brand-700 hover:underline"
                      >
                        {item.clientName}
                      </Link>
                      <span className="text-xs text-slate-500">
                        {item.reason === "budget"
                          ? `${euro(item.gap)} oltre il suo budget`
                          : `${item.gap} mq sotto il suo minimo`}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="px-4 pb-3 pt-1 text-xs text-slate-400">
                Se qualcuno di questi ti sembra comunque da chiamare, allarga il suo budget o
                la metratura minima nella sua richiesta.
              </p>
            </Card>
          ) : null}

          {/* --------------------------------------------------------- proposte */}
          <Card title={`Proposte ricevute (${offers.length})`} bodyClassName="">
            {offers.length === 0 ? (
              <div className="p-4">
                <p className="mb-3 text-sm text-slate-500">Nessuna proposta registrata.</p>
                <OfferForm propertyId={property.id} clientOptions={clientOptions} />
              </div>
            ) : (
              <>
                <ul className="divide-y divide-slate-100">
                  {offers.map((offer) => (
                    <li
                      key={offer.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/clienti/${offer.client_id}`}
                          className="text-sm font-medium text-slate-800 hover:text-brand-700 hover:underline"
                        >
                          {offer.client_name}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {euro(offer.amount)}
                          {property.price
                            ? ` · ${Math.round((offer.amount / property.price - 1) * 100)}% sul richiesto`
                            : ""}
                          {" · "}
                          {shortDate(offer.offered_at)}
                          {offer.valid_until ? ` · valida fino al ${shortDate(offer.valid_until)}` : ""}
                        </p>
                        {offer.notes ? (
                          <p className="mt-0.5 text-xs text-slate-600">{offer.notes}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Chip
                          tone={
                            offer.status === "accettata"
                              ? "green"
                              : offer.status === "rifiutata"
                                ? "red"
                                : "amber"
                          }
                        >
                          {label(offer.status, OFFER_STATUSES)}
                        </Chip>
                        <OfferStatusForm id={offer.id} status={offer.status} />
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-slate-200 p-4">
                  <OfferForm propertyId={property.id} clientOptions={clientOptions} />
                </div>
              </>
            )}
          </Card>

          {/* ------------------------------------------------------ valutazione */}
          <Collapsible title={`Valutazioni (${valuations.length})`}>
            {valuations.length > 0 ? (
              <ul className="mb-4 space-y-2">
                {valuations.map((valuation) => (
                  <li key={valuation.id} className="rounded-md bg-slate-50 px-3 py-2 text-sm">
                    <p className="font-medium text-slate-800">
                      {euro(valuation.value_min)} – {euro(valuation.value_max)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {valuation.eur_sqm_min && valuation.eur_sqm_max
                        ? `${valuation.eur_sqm_min}–${valuation.eur_sqm_max} €/mq`
                        : ""}
                      {valuation.zone ? ` · ${valuation.zone}` : ""}
                      {valuation.method ? ` · ${valuation.method}` : ""}
                      {` · ${shortDate(valuation.created_at)}`}
                    </p>
                    {valuation.notes ? (
                      <p className="mt-1 text-xs text-slate-600">{valuation.notes}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            <ValuationForm property={property} />
          </Collapsible>

          {/* ---------------------------------------------------- chiusura deal */}
          {["proposta", "compromesso", "venduto"].includes(property.status) ? (
            <Collapsible
              title="Chiusura della trattativa"
              defaultOpen={property.status === "compromesso"}
            >
              <CloseDealForm property={property} />
            </Collapsible>
          ) : null}

          {/* ----------------------------------------------------------- visite */}
          <Card title="Registra una visita o un'attività">
            <ActivityForm
              propertyId={property.id}
              userOptions={users}
              defaultUserId={user.id}
              clientOptions={clientOptions}
              compact
            />
          </Card>

          <Card title={`Storico (${activities.length} · ${visits.length} visite)`} bodyClassName="">
            {activities.length === 0 ? (
              <EmptyState title="Nessuna attività registrata su questo immobile." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {activities.map((activity) => (
                  <li key={activity.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Chip tone={activity.type === "visita" ? "blue" : "slate"}>
                          {activity.type}
                        </Chip>
                        <span className="text-sm text-slate-800">{activity.title}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {dateTime(activity.done_at ?? activity.due_at ?? activity.created_at)}
                        {activity.client_name ? (
                          <>
                            {" · "}
                            <Link
                              href={`/clienti/${activity.client_id}`}
                              className="text-brand-700 hover:underline"
                            >
                              {activity.client_name}
                            </Link>
                          </>
                        ) : null}
                        {activity.user_name ? ` · ${activity.user_name}` : ""}
                      </p>
                      {activity.notes ? (
                        <p className="mt-1 text-xs whitespace-pre-line text-slate-600">
                          {activity.notes}
                        </p>
                      ) : null}
                      {activity.outcome ? (
                        <p className="mt-1 text-xs text-slate-700">
                          <span className="font-medium">Feedback:</span> {activity.outcome}
                        </p>
                      ) : null}
                    </div>
                    {!activity.done_at ? <CompleteButton id={activity.id} /> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
