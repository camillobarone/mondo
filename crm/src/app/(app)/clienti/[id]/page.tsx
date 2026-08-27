import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  getClient,
  activitiesOfClient,
  requirementsOfClient,
  propertiesOfClient,
  offersOfClient,
  activeUserOptions,
  knownZones,
  giorniAlCompleanno,
  propertiesWithoutOwner,
  propertyOptionsFor,
} from "@/lib/queries";
import { requirementSummary } from "@/lib/matching";
import { deleteClient, linkOwner, saveContactInfo } from "@/lib/actions";
import {
  euro,
  budgetRange,
  budgetIsContradictory,
  shortDate,
  dateTime,
  fullName,
  fromCsv,
  label,
  phoneHref,
  whatsappHref,
  daysSince,
} from "@/lib/format";
import {
  PageHeader,
  Card,
  DataRow,
  Chip,
  StatusChip,
  EmptyState,
  Banner,
} from "@/components/ui";
import { ConfirmButton, SubmitButton } from "@/components/client";
import { ActivityForm } from "../../agenda/activity-form";
import { RequirementForm } from "../../richieste/requirement-form";
import { CompleteButton } from "../../agenda/complete-button";
import { CLIENT_STATUSES, OFFER_STATUSES } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nuova_richiesta?: string; modifica_richiesta?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;

  const clientId = Number(id);
  const client = getClient(user.id, clientId);
  if (!client) notFound();

  const requirements = requirementsOfClient(user.id, clientId);
  const properties = propertiesOfClient(user.id, clientId);
  const offers = offersOfClient(user.id, clientId);
  const activities = activitiesOfClient(user.id, clientId);
  const users = activeUserOptions();
  const propertyOptions = propertyOptionsFor(user.id);

  const editing = query.modifica_richiesta
    ? requirements.find((r) => r.id === Number(query.modifica_richiesta))
    : undefined;
  const showRequirementForm = query.nuova_richiesta === "1" || Boolean(editing);

  const silentFor = daysSince(client.last_contact_at);
  const mobile = phoneHref(client.mobile ?? client.phone);

  // Senza una richiesta aperta il cliente non entra negli incroci: e' la
  // causa piu' comune di "ho inserito l'immobile e non me l'ha segnalato".
  const buyer = fromCsv(client.roles).some(
    (role) => role === "acquirente" || role === "conduttore",
  );
  const missingRequirement = buyer && requirements.every((r) => r.status !== "aperta");
  const alCompleanno = giorniAlCompleanno(client.birth_date);
  // Cosa gli e' stato proposto e cosa ha gia' visionato: due viste sulla stessa
  // cronologia (activities), cosi' non si scrive due volte la stessa cosa.
  const proposedProperties = activities.filter(
    (activity) => activity.type === "proposta" && activity.property_id,
  );
  const visitedProperties = activities.filter(
    (activity) => activity.type === "visita" && activity.property_id,
  );
  // Immobili ancora senza intestatario: sono gli unici che ha senso proporre
  // qui, cosi' non si porta via per sbaglio l'immobile di un altro.
  const daCollegare = propertiesWithoutOwner(user.id, 500);

  return (
    <>
      <PageHeader
        title={fullName(client)}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusChip value={client.status} kind="client" />
            {fromCsv(client.roles).map((role) => (
              <Chip key={role} tone="brand">
                {role}
              </Chip>
            ))}
            {alCompleanno !== null && alCompleanno <= 7 ? (
              <Chip tone={alCompleanno === 0 ? "brand" : "amber"}>
                {alCompleanno === 0
                  ? "compie gli anni oggi"
                  : alCompleanno === 1
                    ? "compleanno domani"
                    : `compleanno fra ${alCompleanno} giorni`}
              </Chip>
            ) : null}
            {fromCsv(client.tags).map((tag) => (
              <Chip key={tag} tone="violet">
                {tag}
              </Chip>
            ))}
          </span>
        }
        actions={
          <>
            {mobile ? (
              <a href={`tel:${mobile}`} className="btn-secondary">
                Chiama
              </a>
            ) : null}
            {mobile ? (
              <a
                href={whatsappHref(mobile) ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary"
              >
                WhatsApp
              </a>
            ) : null}
            <Link href={`/clienti/${client.id}/modifica`} className="btn-primary">
              Modifica
            </Link>
          </>
        }
      />

      {missingRequirement ? (
        <div className="mb-4">
          <Banner tone="red">
            Questo cliente cerca casa ma non ha una <strong>richiesta aperta</strong>: finché
            non la registri, il programma non può proporgli nessun immobile.{" "}
            <Link href={`/clienti/${client.id}?nuova_richiesta=1`} className="font-medium underline">
              Registra cosa cerca
            </Link>
            .
          </Banner>
        </div>
      ) : null}

      {!client.privacy_consent ? (
        <div className="mb-4">
          <Banner tone="amber">
            Consenso privacy non registrato per questo cliente.{" "}
            <Link href={`/clienti/${client.id}/modifica`} className="font-medium underline">
              Registralo ora
            </Link>
            .
          </Banner>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ------------------------------------------------- colonna sinistra */}
        <div className="space-y-5">
          <Card title="Recapiti">
            <dl>
              <DataRow label="Cellulare">
                {client.mobile ? (
                  <a href={`tel:${phoneHref(client.mobile)}`} className="text-brand-700 hover:underline">
                    {client.mobile}
                  </a>
                ) : null}
              </DataRow>
              <DataRow label="Telefono">{client.phone}</DataRow>
              <DataRow label="Email">
                {client.email ? (
                  <a href={`mailto:${client.email}`} className="text-brand-700 hover:underline">
                    {client.email}
                  </a>
                ) : null}
              </DataRow>
              <DataRow label="Indirizzo">
                {[client.address, client.city].filter(Boolean).join(", ") || null}
              </DataRow>
              <DataRow label="Codice fiscale">{client.tax_code}</DataRow>
              <DataRow label="Data di nascita">
                {client.birth_date ? shortDate(client.birth_date) : null}
              </DataRow>
            </dl>
          </Card>

          <Card title="Gestione">
            <dl>
              <DataRow label="Stato">{label(client.status, CLIENT_STATUSES)}</DataRow>
              <DataRow label="Seguito da">{client.owner_name}</DataRow>
              <DataRow label="Provenienza">{client.source}</DataRow>
              <DataRow label="In archivio dal">{shortDate(client.created_at)}</DataRow>
              <DataRow label="Ultimo contatto">
                {client.last_contact_at ? (
                  <span className={silentFor && silentFor > 90 ? "text-amber-700" : ""}>
                    {shortDate(client.last_contact_at)}
                    {silentFor !== null ? ` (${silentFor} giorni fa)` : ""}
                  </span>
                ) : (
                  <span className="text-amber-700">mai registrato</span>
                )}
              </DataRow>
            </dl>
          </Card>

          {/* ------------------------------------------------- primo contatto */}
          <Card title="Primo contatto">
            <form action={saveContactInfo} className="space-y-3 p-4">
              <input type="hidden" name="client_id" value={client.id} />
              <div>
                <label className="field-label" htmlFor="contact_reason">
                  Per cosa ci ha contattato
                </label>
                <input
                  id="contact_reason"
                  name="contact_reason"
                  className="field"
                  placeholder="Es. ha visto l'annuncio di un trilocale a Frigole"
                  defaultValue={client.contact_reason ?? ""}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="contact_property_id">
                  Immobile per cui ci ha contattato
                </label>
                <select
                  id="contact_property_id"
                  name="contact_property_id"
                  className="field"
                  defaultValue={String(client.contact_property_id ?? "")}
                >
                  <option value="">Nessuno in particolare</option>
                  {propertyOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {client.contact_property_id ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Attualmente:{" "}
                    <Link
                      href={`/immobili/${client.contact_property_id}`}
                      className="text-brand-700 hover:underline"
                    >
                      {[client.contact_property_ref, client.contact_property_title]
                        .filter(Boolean)
                        .join(" · ")}
                    </Link>
                  </p>
                ) : null}
              </div>
              <SubmitButton>Salva</SubmitButton>
            </form>
          </Card>

          <Card title="Privacy e antiriciclaggio">
            <dl>
              <DataRow label="Consenso privacy">
                {client.privacy_consent ? (
                  <span className="text-emerald-700">
                    Sì{client.privacy_date ? ` — ${shortDate(client.privacy_date)}` : ""}
                  </span>
                ) : (
                  <span className="text-amber-700">Non registrato</span>
                )}
              </DataRow>
              <DataRow label="Ambito">{client.privacy_scope}</DataRow>
              <DataRow label="Documento">
                {client.aml_doc_type
                  ? `${client.aml_doc_type} ${client.aml_doc_number ?? ""}`
                  : null}
              </DataRow>
              <DataRow label="Scadenza documento">
                {client.aml_doc_expiry ? shortDate(client.aml_doc_expiry) : null}
              </DataRow>
            </dl>
          </Card>

          {client.notes ? (
            <Card title="Note">
              <p className="text-sm whitespace-pre-line text-slate-700">{client.notes}</p>
            </Card>
          ) : null}

          <form action={deleteClient}>
            <input type="hidden" name="id" value={client.id} />
            <ConfirmButton
              message={`Eliminare la scheda di ${fullName(client)}? Resterà nel registro ma sparirà dagli elenchi.`}
              className="w-full"
            >
              Elimina cliente
            </ConfirmButton>
          </form>
        </div>

        {/* --------------------------------------------------- colonna destra */}
        <div className="space-y-5 lg:col-span-2">
          {/* ------------------------------------------------------ richieste */}
          <Card
            title={`Cosa cerca (${requirements.length})`}
            actions={
              !showRequirementForm ? (
                <Link
                  href={`/clienti/${client.id}?nuova_richiesta=1`}
                  className="btn-secondary px-2.5 py-1 text-xs"
                >
                  Aggiungi richiesta
                </Link>
              ) : null
            }
            bodyClassName={showRequirementForm ? "p-4" : ""}
          >
            {showRequirementForm ? (
              <RequirementForm
                clientId={client.id}
                requirement={editing}
                zoneOptions={knownZones(user.id)}
                cancelHref={`/clienti/${client.id}`}
              />
            ) : requirements.length === 0 ? (
              <EmptyState
                title="Nessuna richiesta registrata."
                hint="Registra cosa cerca: il programma ti avviserà quando entra in portafoglio un immobile adatto."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {requirements.map((requirement) => {
                  const summary =
                    requirement.status === "aperta"
                      ? requirementSummary(user.id, requirement, 5)
                      : { count: 0, perfect: 0, top: [] };

                  return (
                    <li key={requirement.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            {requirement.contract === "affitto" ? "Affitto" : "Acquisto"}
                            {requirement.kind ? ` · ${requirement.kind}` : ""}
                            {requirement.city ? ` a ${requirement.city}` : ""}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {budgetRange(requirement.budget_min, requirement.budget_max)}
                            {requirement.sqm_min ? ` · da ${requirement.sqm_min} mq` : ""}
                            {requirement.rooms_min ? ` · da ${requirement.rooms_min} vani` : ""}
                            {fromCsv(requirement.zones).length
                              ? ` · ${fromCsv(requirement.zones).join(", ")}`
                              : ""}
                          </p>
                          {budgetIsContradictory(requirement.budget_min, requirement.budget_max) ? (
                            <p className="mt-1 text-xs font-medium text-red-700">
                              Il budget minimo è più alto del massimo: così nessun immobile può
                              rientrare in entrambi.{" "}
                              <Link
                                href={`/clienti/${client.id}?modifica_richiesta=${requirement.id}`}
                                className="underline"
                              >
                                Correggi la richiesta
                              </Link>
                              .
                            </p>
                          ) : null}
                          {requirement.notes ? (
                            <p className="mt-1 text-xs whitespace-pre-line text-slate-600">
                              {requirement.notes}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusChip value={requirement.status} kind="requirement" />
                          <Link
                            href={`/clienti/${client.id}?modifica_richiesta=${requirement.id}`}
                            className="text-xs text-brand-700 hover:underline"
                          >
                            modifica
                          </Link>
                        </div>
                      </div>

                      {requirement.status === "aperta" ? (
                        <div className="mt-2 rounded-md bg-slate-50 p-2.5">
                          {summary.count === 0 ? (
                            <p className="text-xs text-slate-500">
                              Nessun immobile in portafoglio corrisponde a questa richiesta.
                            </p>
                          ) : (
                            <>
                              <p className="mb-1.5 text-xs font-medium text-slate-600">
                                {summary.count} immobili da valutare
                                {summary.perfect ? ` · ${summary.perfect} corrispondono in pieno` : ""}
                              </p>
                              <ul className="space-y-1">
                                {summary.top.map((match) => (
                                  <li key={match.property.id} className="text-xs">
                                    <Link
                                      href={`/immobili/${match.property.id}`}
                                      className="font-medium text-brand-700 hover:underline"
                                    >
                                      {match.property.title}
                                    </Link>
                                    <span className="text-slate-500">
                                      {" "}
                                      — {euro(match.property.price)}
                                      {match.property.zone ? `, ${match.property.zone}` : ""}
                                    </span>
                                    {match.warnings.length ? (
                                      <span className="text-amber-700">
                                        {" "}
                                        ({match.warnings[0]})
                                      </span>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            </>
                          )}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* -------------------------------------------- immobili proposti */}
          <Card title={`Immobili proposti (${proposedProperties.length})`} bodyClassName="">
            {proposedProperties.length === 0 ? (
              <EmptyState
                title="Nessun immobile proposto."
                hint="Quando gli segnali un immobile, registralo nel modulo qui sotto."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {proposedProperties.map((activity) => (
                  <li key={activity.id} className="px-4 py-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/immobili/${activity.property_id}`}
                          className="text-sm font-medium text-slate-800 hover:text-brand-700 hover:underline"
                        >
                          {activity.property_title}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {[
                            [activity.property_address, activity.property_city]
                              .filter(Boolean)
                              .join(", "),
                            euro(activity.property_price),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-slate-500">
                        {shortDate(activity.due_at ?? activity.done_at ?? activity.created_at)}
                      </span>
                    </div>
                    {activity.outcome ? (
                      <p className="mt-1 text-xs text-slate-600">{activity.outcome}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-slate-100 p-4">
              <ActivityForm
                clientId={client.id}
                userOptions={users}
                defaultUserId={user.id}
                propertyOptions={propertyOptions}
                fixedType="proposta"
                propertyRequired
                defaultDone
                compact
              />
            </div>
          </Card>

          {/* -------------------------------------------- immobili visionati */}
          <Card title={`Immobili visionati (${visitedProperties.length})`} bodyClassName="">
            {visitedProperties.length === 0 ? (
              <EmptyState
                title="Nessuna visita registrata."
                hint="Registrala nel modulo qui sotto: compare anche nello storico visite del proprietario."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {visitedProperties.map((activity) => (
                  <li key={activity.id} className="px-4 py-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/immobili/${activity.property_id}`}
                          className="text-sm font-medium text-slate-800 hover:text-brand-700 hover:underline"
                        >
                          {activity.property_title}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {[
                            [activity.property_address, activity.property_city]
                              .filter(Boolean)
                              .join(", "),
                            euro(activity.property_price),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                        {activity.interest ? (
                          <Chip
                            tone={
                              activity.interest === "alto"
                                ? "green"
                                : activity.interest === "basso"
                                  ? "red"
                                  : "amber"
                            }
                          >
                            interesse {activity.interest}
                          </Chip>
                        ) : null}
                        {shortDate(activity.due_at ?? activity.done_at ?? activity.created_at)}
                      </span>
                    </div>
                    {activity.outcome ? (
                      <p className="mt-1 text-xs text-slate-600">{activity.outcome}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-slate-100 p-4">
              <ActivityForm
                clientId={client.id}
                userOptions={users}
                defaultUserId={user.id}
                propertyOptions={propertyOptions}
                fixedType="visita"
                propertyRequired
                defaultDone
                compact
              />
            </div>
          </Card>

          {/* ------------------------------------------------ immobili e proposte */}
          <Card title={`Immobili di proprietà (${properties.length})`} bodyClassName="">
            {properties.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {properties.map((property) => (
                  <li key={property.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <Link
                        href={`/immobili/${property.id}`}
                        className="text-sm font-medium text-slate-800 hover:text-brand-700 hover:underline"
                      >
                        {property.title}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {euro(property.price)}
                        {property.mandate_end
                          ? ` · incarico fino al ${shortDate(property.mandate_end)}`
                          : ""}
                      </p>
                    </div>
                    <span className="flex items-center gap-2">
                      <StatusChip value={property.status} kind="property" />
                      <form action={linkOwner}>
                        <input type="hidden" name="property_id" value={property.id} />
                        <input type="hidden" name="client_id" value="" />
                        <button type="submit" className="text-xs text-slate-400 hover:text-red-600">
                          scollega
                        </button>
                      </form>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-3 text-sm text-slate-500">
                Nessun immobile collegato. Se ne ha venduti in passato è normale.
              </p>
            )}

            {daCollegare.length > 0 ? (
              <form
                action={linkOwner}
                className="flex flex-wrap items-end gap-3 border-t border-slate-100 p-4"
              >
                <input type="hidden" name="client_id" value={client.id} />
                <div className="min-w-0 flex-1">
                  <label className="field-label" htmlFor="property_id">
                    Collega un immobile
                  </label>
                  <select id="property_id" name="property_id" required className="field">
                    <option value="">Scegli fra quelli senza proprietario…</option>
                    {daCollegare.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.ref ? `${property.ref} · ` : ""}
                        {property.title}
                      </option>
                    ))}
                  </select>
                </div>
                <SubmitButton>Collega</SubmitButton>
              </form>
            ) : null}
          </Card>

          {offers.length > 0 ? (
            <Card title={`Proposte fatte (${offers.length})`} bodyClassName="">
              <ul className="divide-y divide-slate-100">
                {offers.map((offer) => (
                  <li key={offer.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <Link
                        href={`/immobili/${offer.property_id}`}
                        className="text-sm font-medium text-slate-800 hover:text-brand-700 hover:underline"
                      >
                        {offer.property_title}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {euro(offer.amount)} · {shortDate(offer.offered_at)}
                      </p>
                    </div>
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
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {/* --------------------------------------------------------- storico */}
          <Card title="Registra un contatto">
            {/* L'immobile si sceglie anche da qui: una visita registrata dalla
                scheda del cliente, senza casa collegata, sparisce dallo storico
                visite che poi si consegna al proprietario. */}
            <ActivityForm
              clientId={client.id}
              userOptions={users}
              defaultUserId={user.id}
              propertyOptions={propertyOptions}
              compact
            />
          </Card>

          <Card title={`Storico (${activities.length})`} bodyClassName="">
            {activities.length === 0 ? (
              <EmptyState
                title="Nessun contatto registrato."
                hint="Ogni telefonata, email o visita registrata qui costruisce la memoria dell'agenzia."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {activities.map((activity) => (
                  <li key={activity.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Chip tone={activity.done_at ? "slate" : "amber"}>{activity.type}</Chip>
                        <span className="text-sm text-slate-800">{activity.title}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {dateTime(activity.due_at ?? activity.done_at ?? activity.created_at)}
                        {activity.user_name ? ` · ${activity.user_name}` : ""}
                        {activity.property_title ? (
                          <>
                            {" · "}
                            <Link
                              href={`/immobili/${activity.property_id}`}
                              className="text-brand-700 hover:underline"
                            >
                              {activity.property_title}
                            </Link>
                          </>
                        ) : null}
                      </p>
                      {activity.notes ? (
                        <p className="mt-1 text-xs whitespace-pre-line text-slate-600">
                          {activity.notes}
                        </p>
                      ) : null}
                      {activity.outcome ? (
                        <p className="mt-1 text-xs text-slate-700">
                          <span className="font-medium">Esito:</span> {activity.outcome}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        href={`/agenda/${activity.id}/modifica?da=/clienti/${client.id}`}
                        className="text-xs text-slate-400 hover:text-brand-700 hover:underline"
                      >
                        Modifica
                      </Link>
                      {!activity.done_at ? <CompleteButton id={activity.id} /> : null}
                    </div>
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
