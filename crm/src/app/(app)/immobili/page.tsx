import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  listProperties,
  activeUserOptions,
  distinctCities,
  type PropertyFilters,
} from "@/lib/queries";
import { euro, shortDate, relative } from "@/lib/format";
import { PageHeader, Card, EmptyState, StatusChip, Pagination, Chip } from "@/components/ui";
import { PROPERTY_KINDS, PROPERTY_STATUSES, ZONES } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<PropertyFilters>;
}) {
  await requireUser();
  const filters = await searchParams;
  const { rows, total, page, pages } = listProperties(filters);
  const users = activeUserOptions();
  const cities = distinctCities();

  const exportQuery = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => Boolean(value)) as [string, string][],
  ).toString();

  return (
    <>
      <PageHeader
        title="Immobili"
        subtitle={`${total} ${total === 1 ? "immobile" : "immobili"} in archivio`}
        actions={
          <>
            <Link
              href={`/immobili/esporta${exportQuery ? `?${exportQuery}` : ""}`}
              className="btn-secondary"
              prefetch={false}
            >
              Esporta in Excel
            </Link>
            <Link href="/immobili/nuovo" className="btn-primary">
              Nuovo immobile
            </Link>
          </>
        }
      />

      <Card className="mb-5">
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="q">
              Cerca
            </label>
            <input
              id="q"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Titolo, indirizzo, codice…"
              className="field"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="status">
              Stato
            </label>
            <select id="status" name="status" defaultValue={filters.status ?? ""} className="field">
              <option value="">Tutti</option>
              {PROPERTY_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="contract">
              Contratto
            </label>
            <select
              id="contract"
              name="contract"
              defaultValue={filters.contract ?? ""}
              className="field"
            >
              <option value="">Tutti</option>
              <option value="vendita">Vendita</option>
              <option value="affitto">Affitto</option>
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="kind">
              Tipologia
            </label>
            <select id="kind" name="kind" defaultValue={filters.kind ?? ""} className="field">
              <option value="">Tutte</option>
              {PROPERTY_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="city">
              Comune
            </label>
            <select id="city" name="city" defaultValue={filters.city ?? ""} className="field">
              <option value="">Tutti</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="zone">
              Zona
            </label>
            <select id="zone" name="zone" defaultValue={filters.zone ?? ""} className="field">
              <option value="">Tutte</option>
              {ZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="priceMax">
              Prezzo massimo
            </label>
            <input
              id="priceMax"
              name="priceMax"
              defaultValue={filters.priceMax ?? ""}
              placeholder="250000"
              className="field"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="agent">
              Agente
            </label>
            <select id="agent" name="agent" defaultValue={filters.agent ?? ""} className="field">
              <option value="">Tutti</option>
              {users.map((user) => (
                <option key={user.value} value={user.value}>
                  {user.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2 sm:col-span-2">
            <button type="submit" className="btn-primary">
              Filtra
            </button>
            <Link href="/immobili" className="btn-ghost">
              Azzera
            </Link>
          </div>
        </form>
      </Card>

      <Card bodyClassName="">
        {rows.length === 0 ? (
          <EmptyState
            title="Nessun immobile trovato."
            action={
              <Link href="/immobili/nuovo" className="btn-primary">
                Aggiungi il primo
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Immobile</th>
                  <th>Zona</th>
                  <th>Caratteristiche</th>
                  <th>Prezzo</th>
                  <th>Stato</th>
                  <th>Incarico</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((property) => {
                  const expiring =
                    property.mandate_end &&
                    new Date(property.mandate_end).getTime() - Date.now() < 45 * 864e5;

                  return (
                    <tr key={property.id}>
                      <td>
                        <Link
                          href={`/immobili/${property.id}`}
                          className="font-medium text-slate-800 hover:text-brand-700 hover:underline"
                        >
                          {property.title}
                        </Link>
                        <div className="text-xs text-slate-400">
                          {property.ref ? `${property.ref} · ` : ""}
                          {property.kind}
                          {property.owner_name ? ` · ${property.owner_name}` : ""}
                        </div>
                      </td>
                      <td className="text-xs text-slate-600">
                        {property.city}
                        {property.zone ? <div className="text-slate-400">{property.zone}</div> : null}
                      </td>
                      <td className="text-xs text-slate-600">
                        {property.sqm ? `${property.sqm} mq` : "—"}
                        {property.rooms ? ` · ${property.rooms} vani` : ""}
                        {property.elevator ? " · ascensore" : ""}
                      </td>
                      <td className="text-sm font-medium whitespace-nowrap">
                        {euro(property.price)}
                        {property.sqm && property.price ? (
                          <div className="text-xs font-normal text-slate-400">
                            {Math.round(property.price / property.sqm)} €/mq
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <StatusChip value={property.status} kind="property" />
                      </td>
                      <td className="text-xs">
                        {property.mandate_end ? (
                          <span className={expiring ? "text-amber-700" : "text-slate-600"}>
                            {shortDate(property.mandate_end)}
                            {expiring ? (
                              <div className="text-amber-700">{relative(property.mandate_end)}</div>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                        {property.exclusive ? (
                          <div className="mt-0.5">
                            <Chip tone="brand">esclusiva</Chip>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={page}
          pages={pages}
          total={total}
          params={filters as Record<string, string | undefined>}
          basePath="/immobili"
        />
      </Card>
    </>
  );
}
