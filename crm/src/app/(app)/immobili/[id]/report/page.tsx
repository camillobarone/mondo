import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getProperty, propertyReport, priceHistory, offersOfProperty } from "@/lib/queries";
import { priceInterest } from "@/lib/matching";
import { euro, shortDate } from "@/lib/format";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

/**
 * Il resoconto da consegnare al proprietario.
 *
 * Serve alla conversazione piu' difficile del mestiere: convincere chi vende
 * che il prezzo e' fuori mercato. Detto a parole e' l'opinione dell'agente
 * contro quella del proprietario; con i numeri della sua casa in mano
 * diventa un fatto. Per questo la pagina e' fatta per essere stampata e
 * lasciata sul tavolo, non per essere consultata a schermo.
 */
export default async function PropertyReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const property = getProperty(Number(id));
  if (!property) notFound();

  const report = propertyReport(property);
  const interest = priceInterest(property);
  const prices = priceHistory(property.id);
  const offers = offersOfProperty(property.id);

  const visiteFatte = report.visits.filter((visit) => visit.done_at);
  const ultimaVisita = visiteFatte[0]?.done_at ?? null;
  const ribassi = prices.length - 1;

  // Due prezzi da mettere sul tavolo: quello che recupera l'acquirente piu'
  // vicino e quello che li recupera tutti. Il proprietario sceglie fra due
  // numeri concreti invece di sentirsi dire "e' troppo caro".
  const scaglioni = interest.band
    ? [...new Set([interest.band.max, interest.band.min])].map((prezzo) => ({
        prezzo,
        acquirenti:
          interest.matching +
          interest.blockedByPrice.filter((cliente) => cliente.budgetMax >= prezzo).length,
      }))
    : [];

  return (
    <div className="mx-auto max-w-3xl print:max-w-none">
      {/* ------------------------------------------------ comandi, non stampati */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/immobili/${property.id}`} className="btn-secondary">
          ← Torna alla scheda
        </Link>
        <PrintButton />
      </div>

      {/* ------------------------------------------------------------ testata */}
      <header className="mb-6 border-b border-slate-200 pb-4">
        <p className="text-xs tracking-wide text-slate-500 uppercase">
          Mondo Immobiliare · Studio RCS Srls
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{property.title}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {property.ref ? `${property.ref} · ` : ""}
          {[property.zone, property.city].filter(Boolean).join(", ")}
          {property.sqm ? ` · ${property.sqm} mq` : ""}
        </p>
        <p className="mt-3 text-sm text-slate-700">
          Prezzo richiesto: <strong className="text-lg">{euro(property.price)}</strong>
          {" · "}
          In vendita da <strong>{report.days}</strong> giorni
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {property.owner_name ? `Per ${property.owner_name} · ` : ""}
          Resoconto aggiornato al {shortDate(new Date().toISOString())}
        </p>
      </header>

      {/* ------------------------------------------------------------ i numeri */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">
          Cosa è successo
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Numero valore={interest.matching} etichetta="clienti in cerca di una casa così" />
          <Numero valore={report.contacts} etichetta="contatti registrati" />
          <Numero valore={visiteFatte.length} etichetta="visite fatte" />
          <Numero valore={offers.length} etichetta="proposte ricevute" />
        </div>
        {ultimaVisita ? (
          <p className="mt-2 text-sm text-slate-600">
            Ultima visita il <strong>{shortDate(ultimaVisita)}</strong>.
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-600">Nessuna visita ancora effettuata.</p>
        )}
      </section>

      {/* ------------------------------------------------- il punto sul prezzo */}
      {interest.blockedByPrice.length > 0 && interest.band ? (
        <section className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 print:border-slate-300 print:bg-white">
          <h2 className="text-sm font-semibold text-amber-900 print:text-slate-900">
            {interest.blockedByPrice.length}{" "}
            {interest.blockedByPrice.length === 1
              ? "cliente cercava esattamente questo immobile ma si è fermato sul prezzo"
              : "clienti cercavano esattamente questo immobile ma si sono fermati sul prezzo"}
          </h2>
          <p className="mt-2 text-sm text-amber-900 print:text-slate-700">
            Sono persone che cercano questa tipologia, in questa zona, e che hanno dichiarato di
            poter arrivare{" "}
            <strong>
              {interest.band.min === interest.band.max
                ? `a ${euro(interest.band.max)}`
                : `fra ${euro(interest.band.min)} e ${euro(interest.band.max)}`}
            </strong>
            . Il prezzo attuale è {euro(property.price)}.
          </p>
          <div className="mt-3">
            <p className="text-sm text-amber-900 print:text-slate-700">
              A che prezzo tornerebbe nel raggio di questi acquirenti:
            </p>
            <ul className="mt-1 space-y-1">
              {scaglioni.map((scaglione) => (
                <li key={scaglione.prezzo} className="flex justify-between text-sm">
                  <span className="font-medium text-amber-900 print:text-slate-800">
                    a {euro(scaglione.prezzo)}
                  </span>
                  <span className="text-amber-900 print:text-slate-700">
                    {scaglione.acquirenti}{" "}
                    {scaglione.acquirenti === 1 ? "acquirente" : "acquirenti"} in archivio
                  </span>
                </li>
              ))}
              <li className="flex justify-between border-t border-amber-200 pt-1 text-sm print:border-slate-300">
                <span className="text-amber-900 print:text-slate-800">
                  al prezzo di oggi, {euro(property.price)}
                </span>
                <span className="text-amber-900 print:text-slate-700">
                  {interest.matching} {interest.matching === 1 ? "acquirente" : "acquirenti"}
                </span>
              </li>
            </ul>
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------------------ feedback */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">
          Cosa hanno detto i visitatori
        </h2>
        {report.feedback.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nessun commento registrato dopo le visite.
          </p>
        ) : (
          <ul className="space-y-2">
            {report.feedback.map((item, index) => (
              <li key={index} className="border-l-2 border-slate-200 pl-3">
                <p className="text-sm text-slate-800 italic">«{item.text}»</p>
                <p className="text-xs text-slate-400">
                  {item.date ? shortDate(item.date) : "data non indicata"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* -------------------------------------------------------- storia prezzo */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">
          Storia del prezzo
        </h2>
        {prices.length <= 1 ? (
          <p className="text-sm text-slate-600">
            Il prezzo non è mai stato modificato da quando l&apos;immobile è in vendita.
          </p>
        ) : (
          <>
            <ul className="space-y-1">
              {prices.map((entry) => (
                <li key={entry.id} className="flex justify-between text-sm">
                  <span className="text-slate-500">{shortDate(entry.changed_at)}</span>
                  <span className="font-medium text-slate-800">{euro(entry.price)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-500">
              {ribassi} {ribassi === 1 ? "variazione" : "variazioni"} in {report.days} giorni.
            </p>
          </>
        )}
      </section>

      {/* ------------------------------------------------------------ proposte */}
      {offers.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">
            Proposte ricevute
          </h2>
          <ul className="space-y-1">
            {offers.map((offer) => (
              <li key={offer.id} className="flex justify-between text-sm">
                <span className="text-slate-500">
                  {shortDate(offer.offered_at)} · {offer.status.replace(/_/g, " ")}
                </span>
                <span className="font-medium text-slate-800">{euro(offer.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="mt-8 border-t border-slate-200 pt-4 text-xs text-slate-400">
        I dati provengono dall&apos;archivio dell&apos;agenzia: richieste registrate dei clienti,
        visite effettuate e commenti raccolti dopo i sopralluoghi.
      </footer>
    </div>
  );
}

function Numero({ valore, etichetta }: { valore: number; etichetta: string }) {
  return (
    <div className="rounded-md border border-slate-200 px-3 py-2">
      <p className="text-2xl font-semibold text-slate-900">{valore}</p>
      <p className="text-xs leading-tight text-slate-500">{etichetta}</p>
    </div>
  );
}
