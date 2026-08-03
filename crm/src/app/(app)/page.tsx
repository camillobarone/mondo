import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { agenda, dashboard, daSistemare } from "@/lib/queries";
import { euro, shortDate, relative, fullName, daysSince } from "@/lib/format";
import { PageHeader, Card, Stat, EmptyState, Chip, Banner } from "@/components/ui";
import { CompleteButton } from "./agenda/complete-button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const stats = dashboard(user.id);
  const { overdue, today } = agenda(user.id);

  // Le quattro mancanze silenziose. Ognuna, lasciata li', costa qualcosa di
  // concreto: un incrocio mai proposto, una sanzione, una telefonata a vuoto.
  const cure = daSistemare();
  const daFare = [
    {
      quanti: cure.senzaRichiesta,
      testo: "acquirenti senza una richiesta aperta: invisibili agli incroci",
      href: "/clienti?senza=richiesta",
    },
    {
      quanti: cure.senzaProprietario,
      testo: "immobili senza proprietario collegato",
      href: "/immobili?noOwner=1",
    },
    {
      quanti: cure.amlScaduti,
      testo: "documenti antiriciclaggio scaduti",
      href: "/clienti?senza=aml",
    },
    {
      quanti: cure.senzaPrivacy,
      testo: "clienti attivi senza consenso privacy",
      href: "/clienti?senza=privacy",
    },
  ].filter((riga) => riga.quanti > 0);

  return (
    <>
      <PageHeader
        title={`Buongiorno, ${user.name.split(" ")[0]}`}
        subtitle="Ecco cosa richiede attenzione oggi."
        actions={
          <>
            <Link href="/clienti/nuovo" className="btn-secondary">
              Nuovo cliente
            </Link>
            <Link href="/immobili/nuovo" className="btn-primary">
              Nuovo immobile
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Clienti attivi" value={stats.activeClients} href="/clienti?status=attivo" />
        <Stat label="Immobili in vendita" value={stats.forSale} href="/immobili?status=in_vendita" />
        <Stat label="Trattative aperte" value={stats.negotiations} href="/immobili?status=proposta" />
        <Stat
          label="Richieste aperte"
          value={stats.openRequirements}
          href="/richieste?status=aperta"
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {/* ------------------------------------------------ da fare oggi */}
        <div className="space-y-5 lg:col-span-2">
          <Card
            title={`Da fare oggi (${today.length + overdue.length})`}
            actions={
              <Link href="/agenda" className="text-xs text-brand-700 hover:underline">
                Tutta l&apos;agenda
              </Link>
            }
            bodyClassName=""
          >
            {overdue.length === 0 && today.length === 0 ? (
              <EmptyState
                title="Niente in sospeso."
                hint="Quando registri una telefonata o un appuntamento con una data, compare qui."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {[...overdue, ...today].map((item) => {
                  const late = overdue.includes(item);
                  return (
                    <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Chip tone={late ? "red" : "brand"}>{item.type}</Chip>
                          <span className="text-sm font-medium text-slate-800">
                            {item.title || "(senza titolo)"}
                          </span>
                          {late ? (
                            <span className="text-xs font-medium text-red-600">
                              {relative(item.due_at)}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {item.client_name ? (
                            <Link
                              href={`/clienti/${item.client_id}`}
                              className="hover:text-brand-700 hover:underline"
                            >
                              {item.client_name}
                            </Link>
                          ) : null}
                          {item.client_name && item.property_title ? " · " : null}
                          {item.property_title ? (
                            <Link
                              href={`/immobili/${item.property_id}`}
                              className="hover:text-brand-700 hover:underline"
                            >
                              {item.property_title}
                            </Link>
                          ) : null}
                        </p>
                      </div>
                      <CompleteButton id={item.id} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* -------------------------------------------- clienti dormienti */}
          <Card
            title="Da richiamare — non sentiti da oltre 3 mesi"
            actions={
              <Link
                href="/clienti?silentDays=90&status=attivo"
                className="text-xs text-brand-700 hover:underline"
              >
                Vedi tutti
              </Link>
            }
            bodyClassName=""
          >
            {stats.silentClients.length === 0 ? (
              <EmptyState title="Nessun cliente attivo trascurato. Ottimo." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {stats.silentClients.map((client) => {
                  const days = daysSince(client.last_contact_at ?? client.created_at);
                  return (
                    <li key={client.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <Link
                          href={`/clienti/${client.id}`}
                          className="text-sm font-medium text-slate-800 hover:text-brand-700 hover:underline"
                        >
                          {fullName(client)}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {client.mobile ?? client.phone ?? "nessun recapito"}
                          {client.roles ? ` · ${client.roles.replace(/,/g, ", ")}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-amber-700">
                        {days !== null ? `${days} giorni` : "mai sentito"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        {/* --------------------------------------------------- colonna lato */}
        <div className="space-y-5">
          {daFare.length > 0 ? (
            <Card title="Da sistemare" bodyClassName="">
              <ul className="divide-y divide-slate-100">
                {daFare.map((riga) => (
                  <li key={riga.href}>
                    <Link
                      href={riga.href}
                      className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50"
                    >
                      <span className="min-w-[2rem] text-right text-sm font-semibold text-amber-700">
                        {riga.quanti}
                      </span>
                      <span className="text-sm text-slate-700">{riga.testo}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card title="Incarichi in scadenza" bodyClassName="">
            {stats.mandatesExpiring.length === 0 ? (
              <EmptyState title="Nessun incarico in scadenza nei prossimi 45 giorni." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {stats.mandatesExpiring.map((property) => (
                  <li key={property.id} className="px-4 py-2.5">
                    <Link
                      href={`/immobili/${property.id}`}
                      className="text-sm font-medium text-slate-800 hover:text-brand-700 hover:underline"
                    >
                      {property.title}
                    </Link>
                    <p className="text-xs text-amber-700">
                      Scade {shortDate(property.mandate_end)} · {relative(property.mandate_end)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {stats.expiringOffers.length > 0 ? (
            <Card title="Proposte in scadenza" bodyClassName="">
              <ul className="divide-y divide-slate-100">
                {stats.expiringOffers.map((offer) => (
                  <li key={offer.id} className="px-4 py-2.5">
                    <Link
                      href={`/immobili/${offer.property_id}`}
                      className="text-sm font-medium text-slate-800 hover:text-brand-700 hover:underline"
                    >
                      {offer.property_title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {offer.client_name} · {euro(offer.amount)}
                    </p>
                    <p className="text-xs text-amber-700">
                      Valida fino al {shortDate(offer.valid_until)}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card title="Numeri dell'agenzia">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Clienti in archivio</dt>
                <dd className="font-medium">{stats.clients}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Venduti quest&apos;anno</dt>
                <dd className="font-medium">{stats.soldThisYear}</dd>
              </div>
            </dl>
            <Link href="/report" className="mt-3 inline-block text-xs text-brand-700 hover:underline">
              Apri i report →
            </Link>
          </Card>

          {stats.clients === 0 ? (
            <Banner tone="blue">
              L&apos;archivio è vuoto. Puoi{" "}
              <Link href="/importa" className="font-medium underline">
                importare i clienti da un file Excel
              </Link>{" "}
              in pochi minuti.
            </Banner>
          ) : null}
        </div>
      </div>
    </>
  );
}
