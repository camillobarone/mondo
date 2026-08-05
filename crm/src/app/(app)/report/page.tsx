import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { reportBySource, reportByAgent, reportSalesPerformance } from "@/lib/queries";
import { euro, shortDate, num } from "@/lib/format";
import { PageHeader, Card, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ReportPage() {
  const user = await requireUser();
  const isOwner = user.role === "titolare";

  const sources = reportBySource(user.id);
  const agents = reportByAgent(user.id);
  const sales = reportSalesPerformance(user.id);

  const withDelta = sales.filter((sale) => sale.price && sale.sold_price);
  const averageDelta = withDelta.length
    ? withDelta.reduce((sum, sale) => sum + (sale.sold_price! / sale.price! - 1), 0) /
      withDelta.length
    : null;

  const withDays = sales.filter((sale) => sale.days_on_market && sale.days_on_market > 0);
  const averageDays = withDays.length
    ? Math.round(
        withDays.reduce((sum, sale) => sum + sale.days_on_market!, 0) / withDays.length,
      )
    : null;

  return (
    <>
      <PageHeader
        title="Report"
        subtitle="I numeri che dicono dove conviene investire tempo e denaro."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ------------------------------------------------------ provenienza */}
        <Card
          title="Da dove arrivano i clienti"
          bodyClassName=""
          actions={<span className="text-xs text-slate-400">clienti in archivio</span>}
        >
          {sources.length === 0 ? (
            <EmptyState title="Ancora nessun dato." />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Provenienza</th>
                  <th className="text-right">Clienti</th>
                  <th className="text-right">Con acquisto concluso</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((row) => (
                  <tr key={row.source}>
                    <td>{row.source}</td>
                    <td className="text-right">{num(row.clients)}</td>
                    <td className="text-right">
                      {row.sold ? (
                        <span className="font-medium text-emerald-700">{row.sold}</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* ---------------------------------------------------------- agenti */}
        <Card title="Rendimento per collaboratore" bodyClassName="">
          {agents.length === 0 ? (
            <EmptyState title="Ancora nessun dato." />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Collaboratore</th>
                  <th className="text-right">In portafoglio</th>
                  <th className="text-right">Venduti</th>
                  {isOwner ? <th className="text-right">Provvigioni</th> : null}
                </tr>
              </thead>
              <tbody>
                {agents.map((row) => (
                  <tr key={row.agent}>
                    <td>{row.agent}</td>
                    <td className="text-right">{row.portfolio}</td>
                    <td className="text-right font-medium">{row.sold}</td>
                    {isOwner ? (
                      <td className="text-right">{row.commission ? euro(row.commission) : "—"}</td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* ------------------------------------------------------------ vendite */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Tempo medio di vendita
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {averageDays !== null ? `${averageDays} giorni` : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Dall&apos;inizio dell&apos;incarico al rogito
          </p>
        </Card>

        <Card>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Scostamento medio dal richiesto
          </p>
          <p
            className={`mt-1 text-2xl font-semibold ${
              averageDelta !== null && averageDelta < -0.05 ? "text-amber-600" : "text-slate-900"
            }`}
          >
            {averageDelta !== null ? `${(averageDelta * 100).toFixed(1)}%` : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Quanto si scende in media tra richiesta e rogito
          </p>
        </Card>

        <Card>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Immobili venduti
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{sales.length}</p>
          <p className="mt-1 text-xs text-slate-400">Storico completo in archivio</p>
        </Card>
      </div>

      <Card title="Ultimi immobili venduti" className="mt-5" bodyClassName="">
        {sales.length === 0 ? (
          <EmptyState
            title="Nessuna vendita registrata."
            hint="Quando chiudi una trattativa dalla scheda immobile, i numeri compaiono qui."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Immobile</th>
                  <th>Comune</th>
                  <th className="text-right">Richiesto</th>
                  <th className="text-right">Rogito</th>
                  <th className="text-right">Scostamento</th>
                  <th className="text-right">Giorni</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => {
                  const delta =
                    sale.price && sale.sold_price ? sale.sold_price / sale.price - 1 : null;
                  return (
                    <tr key={sale.id}>
                      <td>
                        <Link
                          href={`/immobili/${sale.id}`}
                          className="font-medium text-slate-800 hover:text-brand-700 hover:underline"
                        >
                          {sale.title}
                        </Link>
                      </td>
                      <td className="text-xs text-slate-600">{sale.city ?? "—"}</td>
                      <td className="text-right text-xs">{euro(sale.price)}</td>
                      <td className="text-right text-xs font-medium">{euro(sale.sold_price)}</td>
                      <td className="text-right text-xs">
                        {delta !== null ? (
                          <span className={delta < 0 ? "text-amber-700" : "text-emerald-700"}>
                            {(delta * 100).toFixed(1)}%
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="text-right text-xs">
                        {sale.days_on_market && sale.days_on_market > 0 ? sale.days_on_market : "—"}
                      </td>
                      <td className="text-xs text-slate-600">{shortDate(sale.deed_date)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
