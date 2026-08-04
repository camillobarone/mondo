import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getProperty, visitHistory } from "@/lib/queries";
import { shortDate } from "@/lib/format";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

/**
 * Lo storico delle visite da consegnare al proprietario.
 *
 * A differenza del resoconto — che serve a discutere il prezzo — questo e' un
 * rendiconto: chi e' venuto a vedere la casa, quando, e cosa ha detto. Il
 * proprietario che non riceve notizie pensa che l'agenzia non stia lavorando;
 * un foglio con nomi e date risponde alla domanda prima che venga fatta.
 *
 * I dati sono quelli dell'agenda, senza copie intermedie: ogni visita o
 * appuntamento segnato sulla scheda dell'immobile finisce qui da solo.
 */
export default async function VisitHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ note?: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const { note } = await searchParams;
  const property = getProperty(Number(id));
  if (!property) notFound();

  // Le note sono i promemoria dell'agente ("portare la planimetria"): utili in
  // ufficio, fuori posto in un foglio consegnato al proprietario. Si possono
  // togliere con un clic, ma la scelta resta all'agente — a volte le note sono
  // proprio il racconto della visita.
  const conNote = note !== "no";

  const visite = visitHistory(property.id);
  const svolte = visite.filter((visita) => visita.done_at);
  const inProgramma = visite.filter((visita) => !visita.done_at);

  const commento = (visita: (typeof visite)[number]) =>
    [visita.outcome?.trim(), conNote ? visita.notes?.trim() : null].filter(Boolean).join(" — ");

  return (
    <div className="mx-auto max-w-3xl print:max-w-none">
      {/* ------------------------------------------------ comandi, non stampati */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/immobili/${property.id}`} className="btn-secondary">
          ← Torna alla scheda
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/immobili/${property.id}/visite${conNote ? "?note=no" : ""}`}
            className="text-sm text-slate-500 hover:text-brand-700 hover:underline"
          >
            {conNote ? "Togli le note interne" : "Rimetti le note interne"}
          </Link>
          <PrintButton />
        </div>
      </div>

      {conNote ? (
        <p className="mb-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 print:hidden">
          Il foglio riporta anche le <strong>note</strong> scritte in agenda, che spesso sono
          promemoria per l&apos;ufficio («portare la planimetria»). Rileggile prima di stampare, o
          toglile con il comando qui sopra.
        </p>
      ) : null}

      {/* ------------------------------------------------------------ testata */}
      <header className="mb-6 border-b border-slate-200 pb-4">
        <p className="text-xs tracking-wide text-slate-500 uppercase">
          Mondo Immobiliare · Studio RCS Srls
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Storico delle visite</h1>
        <p className="mt-1 text-sm text-slate-700">
          {property.title}
          {property.ref ? ` · ${property.ref}` : ""}
        </p>
        <p className="text-sm text-slate-600">
          {[property.address, property.zone, property.city].filter(Boolean).join(", ")}
        </p>
        <p className="mt-3 text-xs text-slate-400">
          Aggiornato al {shortDate(new Date().toISOString())}
        </p>
      </header>

      {/* ------------------------------------------------------------- saluto */}
      <section className="mb-6">
        <p className="text-sm text-slate-800">
          Gentile {property.owner_name || "proprietario"},
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          {svolte.length === 0 ? (
            <>
              di seguito il rendiconto dell&apos;attività svolta sul suo immobile. Al momento non
              risultano visite effettuate: continuiamo a proporlo ai clienti in ricerca e le
              faremo sapere a ogni novità.
            </>
          ) : (
            <>
              di seguito l&apos;elenco delle visite effettuate sul suo immobile, con i commenti
              raccolti dopo ciascun sopralluogo. A oggi le persone accompagnate a vedere la casa
              sono <strong>{svolte.length}</strong>
              {inProgramma.length === 1
                ? ", e c'è un altro appuntamento già in programma"
                : inProgramma.length > 1
                  ? `, e ci sono altri ${inProgramma.length} appuntamenti già in programma`
                  : ""}
              .
            </>
          )}
        </p>
      </section>

      {/* ------------------------------------------------------------- visite */}
      {svolte.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">
            Visite effettuate
          </h2>
          <Tabella righe={svolte} commento={commento} />
        </section>
      ) : null}

      {inProgramma.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">
            Appuntamenti in programma
          </h2>
          <Tabella righe={inProgramma} commento={commento} programma />
        </section>
      ) : null}

      {visite.length === 0 ? (
        <p className="mb-6 text-sm text-slate-600">
          Nessuna visita o appuntamento registrato su questo immobile.
        </p>
      ) : null}

      {/* ------------------------------------------------------------ chiusura */}
      <section className="mb-6">
        <p className="text-sm leading-relaxed text-slate-700">
          Restiamo a disposizione per qualsiasi chiarimento.
        </p>
        <p className="mt-4 text-sm text-slate-800">
          Cordiali saluti,
          <br />
          <strong>{property.agent_name || "Mondo Immobiliare Lecce"}</strong>
        </p>
      </section>

      <footer className="mt-8 border-t border-slate-200 pt-4 text-xs text-slate-400">
        Studio RCS Srls · Mondo Immobiliare Lecce · agenzia FIMAA dal 1994 · Lecce e Porto Cesareo.
        L&apos;elenco riporta le visite registrate nell&apos;agenda dell&apos;agenzia.
      </footer>
    </div>
  );
}

/**
 * Una riga per visita. Nome, telefono e commento sono le tre cose che il
 * proprietario guarda: la data dice se si sta lavorando, il commento perche'
 * non hanno comprato.
 */
function Tabella({
  righe,
  commento,
  programma = false,
}: {
  righe: ReturnType<typeof visitHistory>;
  commento: (visita: ReturnType<typeof visitHistory>[number]) => string;
  programma?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        {/* Larghezze fisse: le due tabelle stanno una sotto l'altra sullo
            stesso foglio, e con le colonne disallineate sembrano due documenti
            diversi. */}
        <colgroup>
          <col className="w-[6.5rem]" />
          <col className="w-[9rem]" />
          <col className="w-[7.5rem]" />
          <col />
        </colgroup>
        <thead>
          <tr className="border-b border-slate-300 text-left text-xs tracking-wide text-slate-500 uppercase">
            <th className="py-2 pr-3 font-medium">Data</th>
            <th className="py-2 pr-3 font-medium">Cliente</th>
            <th className="py-2 pr-3 font-medium">Telefono</th>
            <th className="py-2 font-medium">{programma ? "Note" : "Commento"}</th>
          </tr>
        </thead>
        <tbody>
          {righe.map((visita) => {
            const testo = commento(visita);
            return (
              <tr key={visita.id} className="border-b border-slate-100 align-top">
                {/* La data della visita e' quella dell'appuntamento, non quella
                    in cui l'agente ha messo la spunta: se segna oggi una visita
                    di due settimane fa, al proprietario deve risultare la data
                    vera. */}
                <td className="py-2 pr-3 whitespace-nowrap text-slate-600">
                  {shortDate(visita.due_at ?? visita.done_at ?? visita.created_at)}
                </td>
                <td className="py-2 pr-3 text-slate-800">
                  {visita.client_name || "—"}
                </td>
                <td className="py-2 pr-3 whitespace-nowrap text-slate-600">
                  {visita.client_phone || "—"}
                </td>
                <td className="py-2 whitespace-pre-line text-slate-700">{testo || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
