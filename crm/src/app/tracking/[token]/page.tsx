import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  propertyByTrackingToken,
  trackingPhotos,
  trackingVisits,
} from "@/lib/queries";
import { euro, shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "La vendita della tua casa — Mondo Immobiliare",
  // Il layout di radice lo dice gia' per tutto il programma. Qui si ripete
  // perche' questa e' l'unica pagina che si apre senza accesso: se un domani
  // qualcuno cambia il layout, questa deve restare fuori da Google comunque.
  robots: { index: false, follow: false },
};

/**
 * Il percorso di una vendita, come lo racconta chi la sta aspettando.
 *
 * Gli stati sono quelli veri di `PROPERTY_STATUSES`, ma non tutti: `ritirato`
 * non e' un gradino piu' in basso, e' un'altra storia — sta fuori dalla scala
 * e ha un riquadro suo. Mettercelo in fondo direbbe al proprietario che il
 * ritiro viene dopo il rogito.
 */
const PERCORSO = [
  {
    stato: "acquisizione",
    titolo: "Incarico",
    detto: "Abbiamo preso l’incarico e stiamo preparando la casa per la vendita.",
  },
  {
    stato: "in_vendita",
    titolo: "In vendita",
    detto: "La casa è pubblicata e riceve visite.",
  },
  {
    stato: "proposta",
    titolo: "Proposta ricevuta",
    detto: "È arrivata una proposta d’acquisto: la valutiamo insieme.",
  },
  {
    stato: "compromesso",
    titolo: "Compromesso",
    detto: "Il preliminare è firmato. Si va verso il rogito.",
  },
  {
    stato: "venduto",
    titolo: "Rogito",
    detto: "Venduto. Grazie della fiducia.",
  },
] as const;

export default async function TrackingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const casa = propertyByTrackingToken(token);

  // Stessa schermata per chiave sbagliata, chiave revocata e immobile
  // cestinato: da fuori non si deve poter capire quale delle tre.
  if (!casa) notFound();

  const foto = trackingPhotos(casa.id);
  const visite = trackingVisits(casa.id);

  // Stessa regola della pagina che si stampa: una visita e' fatta quando ha
  // una data di svolgimento. Cosi' non serve confrontare orari con l'adesso —
  // `due_at` e' ora locale senza fuso e i confronti sono una fonte di errori.
  const svolte = visite.filter((visita) => visita.done_at);
  const inProgramma = visite.filter((visita) => !visita.done_at);

  const ritirato = casa.status === "ritirato";
  const gradino = PERCORSO.findIndex((passo) => passo.stato === casa.status);
  const luogo = [casa.city, casa.zone].filter(Boolean).join(" · ");

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
      {/* ------------------------------------------------------------ testata */}
      <header className="mb-6">
        <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">
          Mondo Immobiliare · Studio RCS Srls
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl">
          {casa.address?.trim() || casa.title}
        </h1>
        {luogo ? <p className="mt-1 text-sm text-slate-600">{luogo}</p> : null}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
          {casa.price ? (
            <span className="text-base font-semibold text-slate-900">{euro(casa.price)}</span>
          ) : null}
          {casa.sqm ? <span>{casa.sqm} m²</span> : null}
          {casa.rooms ? <span>{casa.rooms} locali</span> : null}
          {casa.kind ? <span>{casa.kind}</span> : null}
        </div>
      </header>

      {/* -------------------------------------------------------------- foto */}
      {foto.length > 0 ? (
        <section className="mb-6">
          <a
            href={`/tracking/${token}/foto/${foto[0].file}`}
            target="_blank"
            rel="noreferrer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/tracking/${token}/foto/${foto[0].file.replace(/\.jpg$/, "-min.jpg")}`}
              alt={foto[0].caption ?? ""}
              className="aspect-4/3 w-full rounded-lg border border-slate-200 object-cover"
            />
          </a>

          {foto.length > 1 ? (
            <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {foto.slice(1).map((scatto) => (
                <li key={scatto.file}>
                  <a
                    href={`/tracking/${token}/foto/${scatto.file}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/tracking/${token}/foto/${scatto.file.replace(/\.jpg$/, "-min.jpg")}`}
                      alt={scatto.caption ?? ""}
                      loading="lazy"
                      className="aspect-4/3 w-full rounded-md border border-slate-200 object-cover"
                    />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {casa.video_url ? (
        <a
          href={casa.video_url}
          target="_blank"
          rel="noreferrer"
          className="btn-secondary mb-6 w-full sm:w-auto"
        >
          Guarda il video della casa
        </a>
      ) : null}

      {/* ------------------------------------------------------------ visite */}
      <section className="card mb-6">
        <div className="card-head">
          <h2 className="card-title">Le visite</h2>
        </div>
        <div className="px-4 py-4">
          {svolte.length > 0 ? (
            <>
              <p className="text-3xl font-semibold text-slate-900">
                {svolte.length}
                {/* Lo spazio ci vuole scritto: `ml-2` e' un margine, e a occhio
                    sembra uno spazio, ma nel testo della pagina i due pezzi
                    restano attaccati — «2visite finora» per chi legge con la
                    sintesi vocale. */}{" "}
                <span className="align-middle text-sm font-normal text-slate-600">
                  {svolte.length === 1 ? "visita finora" : "visite finora"}
                </span>
              </p>
              <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
                {svolte.map((visita) => (
                  <li key={visita.id} className="py-2 text-sm text-slate-700">
                    {shortDate(visita.done_at)}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-slate-600">
              Nessuna visita registrata per ora. Le vedrai comparire qui appena
              accompagniamo qualcuno a vedere la casa.
            </p>
          )}

          {inProgramma.length > 0 ? (
            <div className="mt-4 rounded-md border border-brand-200 bg-brand-50 px-3 py-2.5">
              <p className="text-xs font-semibold tracking-wide text-brand-800 uppercase">
                {inProgramma.length === 1 ? "Visita in programma" : "Visite in programma"}
              </p>
              <ul className="mt-1 space-y-0.5">
                {inProgramma.map((visita) => (
                  <li key={visita.id} className="text-sm text-brand-900">
                    {shortDate(visita.due_at)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="mt-4 text-xs text-slate-400">
            Per rispetto della riservatezza di chi viene a vedere, qui non
            compaiono i nomi né i recapiti dei visitatori.
          </p>
        </div>
      </section>

      {/* ----------------------------------------------------------- percorso */}
      <section className="card mb-6">
        <div className="card-head">
          <h2 className="card-title">A che punto siamo</h2>
        </div>
        <div className="px-4 py-4">
          {ritirato ? (
            <p className="text-sm text-slate-700">
              L’incarico su questa casa è chiuso. Se vuoi riprendere la vendita,
              parlane con il tuo consulente.
            </p>
          ) : (
            <ol className="space-y-3">
              {PERCORSO.map((passo, indice) => {
                const fatto = gradino >= 0 && indice < gradino;
                const adesso = indice === gradino;
                return (
                  <li key={passo.stato} className="flex gap-3">
                    <span
                      aria-hidden
                      className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                        adesso
                          ? "bg-brand-600 ring-4 ring-brand-100"
                          : fatto
                            ? "bg-brand-300"
                            : "bg-slate-200"
                      }`}
                    />
                    <div className="min-w-0">
                      <p
                        className={`text-sm ${
                          adesso
                            ? "font-semibold text-slate-900"
                            : fatto
                              ? "text-slate-700"
                              : "text-slate-400"
                        }`}
                      >
                        {passo.titolo}
                      </p>
                      {adesso ? (
                        <p className="mt-0.5 text-sm text-slate-600">{passo.detto}</p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </section>

      {/* --------------------------------------------------------- consulente */}
      <section className="card mb-6">
        <div className="card-head">
          <h2 className="card-title">Chi segue la tua casa</h2>
        </div>
        <div className="px-4 py-4">
          <p className="text-base font-medium text-slate-900">
            {casa.agent_name ?? "Mondo Immobiliare Lecce"}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Per qualsiasi cosa sulla vendita — il prezzo, una visita, una
            proposta — scrivi o telefona in agenzia: rispondiamo noi.
          </p>
        </div>
      </section>

      <footer className="pb-6 text-center text-xs text-slate-400">
        <p>
          Studio RCS Srls · Mondo Immobiliare Lecce · agenzia FIMAA dal 1994 ·
          Lecce e Porto Cesareo.
        </p>
        <p className="mt-1">
          Pagina riservata al proprietario. L’indirizzo è personale: non
          condividerlo.
        </p>
      </footer>
    </main>
  );
}
