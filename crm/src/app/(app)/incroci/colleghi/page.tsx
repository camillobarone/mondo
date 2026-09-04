import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { incrociFraColleghi, type IncrocioCollega } from "@/lib/matching";
import { euro, fromCsv } from "@/lib/format";
import { PageHeader, Card, EmptyState, Chip, Banner } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * Gli incroci che scavalcano il muro fra colleghi.
 *
 * Ogni riga dice una cosa sola: c'e' qualcosa da chiedere a un collega. Non
 * c'e' un pulsante per contattare il cliente dell'altro, perche' non e' il
 * proprio cliente: si telefona al collega, e da li' in poi e' un accordo fra
 * due persone, come si e' sempre fatto fra agenzie.
 *
 * Della roba altrui si mostrano solo le caratteristiche. Nessun nome di
 * cliente, nessun numero, nessun prezzo minimo.
 */

function Caratteristiche({ voci }: { voci: (string | null | undefined)[] }) {
  const pulite = voci.filter((voce): voce is string => Boolean(voce && voce.trim()));
  if (!pulite.length) return null;
  return <p className="text-xs text-slate-500">{pulite.join(" · ")}</p>;
}

function Riga({ incrocio }: { incrocio: IncrocioCollega }) {
  const mioCliente = incrocio.mioCliente;
  const immobile = incrocio.immobileDelCollega;
  const mioImmobile = incrocio.mioImmobile;
  const richiesta = incrocio.richiestaDelCollega;

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0 space-y-1">
        {mioCliente && immobile ? (
          <>
            <p className="text-sm">
              <span className="text-slate-500">Il tuo cliente </span>
              <Link
                href={`/clienti/${mioCliente.id}`}
                className="font-medium text-slate-800 hover:text-brand-700 hover:underline"
              >
                {mioCliente.nome || `Cliente #${mioCliente.id}`}
              </Link>
            </p>
            <p className="text-sm text-slate-800">
              <span className="text-slate-500">Immobile di {incrocio.collega.nome}: </span>
              {immobile.titolo}
            </p>
            <Caratteristiche
              voci={[
                immobile.tipologia,
                [immobile.zona, immobile.comune].filter(Boolean).join(", "),
                immobile.mq ? `${immobile.mq} mq` : null,
                immobile.vani ? `${immobile.vani} vani` : null,
                immobile.prezzo ? euro(immobile.prezzo) : null,
              ]}
            />
          </>
        ) : null}

        {mioImmobile && richiesta ? (
          <>
            <p className="text-sm">
              <span className="text-slate-500">Il tuo immobile </span>
              <Link
                href={`/immobili/${mioImmobile.id}`}
                className="font-medium text-slate-800 hover:text-brand-700 hover:underline"
              >
                {mioImmobile.titolo}
              </Link>
            </p>
            <p className="text-sm text-slate-800">
              <span className="text-slate-500">Un acquirente di {incrocio.collega.nome} cerca: </span>
              {[
                richiesta.tipologia,
                [richiesta.comune, ...fromCsv(richiesta.zone)].filter(Boolean).join(", "),
              ]
                .filter(Boolean)
                .join(" · ") || "senza criteri indicati"}
            </p>
            <Caratteristiche
              voci={[
                richiesta.budgetMax
                  ? `fino a ${euro(richiesta.budgetMax)}`
                  : richiesta.budgetMin
                    ? `da ${euro(richiesta.budgetMin)}`
                    : null,
                richiesta.mqMin ? `almeno ${richiesta.mqMin} mq` : null,
                richiesta.vaniMin ? `almeno ${richiesta.vaniMin} vani` : null,
              ]}
            />
          </>
        ) : null}

        {incrocio.motivi.length ? (
          <p className="text-xs text-emerald-700">{incrocio.motivi.join(" · ")}</p>
        ) : null}
        {incrocio.avvertenze.length ? (
          <p className="text-xs text-amber-700">{incrocio.avvertenze.join(" · ")}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <a
          href={`mailto:${incrocio.collega.email}?subject=${encodeURIComponent(
            immobile
              ? `Il tuo immobile: ${immobile.titolo}`
              : `Ho un immobile per un tuo cliente: ${mioImmobile?.titolo ?? ""}`,
          )}`}
          className="btn-secondary px-2.5 py-1 text-xs"
          title={`Scrivi a ${incrocio.collega.nome}`}
        >
          Scrivi a {incrocio.collega.nome.split(" ")[0]}
        </a>
        <Chip tone={incrocio.avvertenze.length === 0 ? "green" : "amber"}>
          {incrocio.punteggio}/{incrocio.totale}
        </Chip>
      </div>
    </li>
  );
}

export default async function IncrociColleghiPage() {
  const user = await requireUser();
  const { incroci, totale, colleghi } = incrociFraColleghi(user.id);

  const mieiClienti = incroci.filter((i) => i.verso === "mio-cliente");
  const mieiImmobili = incroci.filter((i) => i.verso === "mio-immobile");

  return (
    <>
      <PageHeader
        title="Incroci con i colleghi"
        subtitle="Quando qualcosa di tuo corrisponde a qualcosa di un collega."
        actions={
          <Link href="/incroci" className="btn-secondary">
            I tuoi incroci
          </Link>
        }
      />

      {colleghi.length === 0 ? (
        <Card>
          <EmptyState
            title="Non c'è nessun altro collaboratore attivo."
            hint="Questa pagina serve quando in agenzia lavora più di una persona: segnala quando un tuo acquirente corrisponde all'immobile di un collega, o viceversa."
          />
        </Card>
      ) : incroci.length === 0 ? (
        <Card>
          <EmptyState
            title="Nessun incrocio con i colleghi, per ora."
            hint={`Confrontato con: ${colleghi.join(", ")}. Comparirà qualcosa appena una richiesta e un immobile si corrispondono davvero — le stesse regole degli incroci tuoi, niente proposte in un altro comune o di un'altra tipologia.`}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <Banner tone="blue">
            Di quello che è del collega vedi le <strong>caratteristiche</strong>, non
            l&apos;identità: nessun nome di cliente, nessun numero di telefono, nessun prezzo
            minimo. Per andare avanti si sente il collega — l&apos;accordo sulla provvigione lo
            fate voi.
          </Banner>

          <p className="text-sm text-slate-500">
            {totale} {totale === 1 ? "segnalazione" : "segnalazioni"}
            {totale > incroci.length ? `, mostrate le ${incroci.length} migliori` : ""} · con{" "}
            {colleghi.join(", ")}.
          </p>

          {mieiClienti.length ? (
            <Card
              title="Un tuo cliente, un immobile di un collega"
              actions={<span className="text-xs text-slate-500">{mieiClienti.length}</span>}
              bodyClassName=""
            >
              <ul className="divide-y divide-slate-100">
                {mieiClienti.map((incrocio) => (
                  <Riga
                    key={`c-${incrocio.mioCliente?.richiestaId}-${incrocio.immobileDelCollega?.id}`}
                    incrocio={incrocio}
                  />
                ))}
              </ul>
            </Card>
          ) : null}

          {mieiImmobili.length ? (
            <Card
              title="Un tuo immobile, un cliente di un collega"
              actions={<span className="text-xs text-slate-500">{mieiImmobili.length}</span>}
              bodyClassName=""
            >
              <ul className="divide-y divide-slate-100">
                {mieiImmobili.map((incrocio) => (
                  <Riga
                    key={`i-${incrocio.mioImmobile?.id}-${incrocio.richiestaDelCollega?.id}`}
                    incrocio={incrocio}
                  />
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      )}
    </>
  );
}
