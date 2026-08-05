import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listSellers } from "@/lib/queries";
import { euro, fullName, shortDate, phoneHref, daysSince, whatsappHref } from "@/lib/format";
import { PageHeader, Card, EmptyState, StatusChip, Chip, Pagination } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Fra quanto è il compleanno, detto come lo direbbe una persona. */
function quandoCompie(giorni: number | null): string | null {
  if (giorni === null) return null;
  if (giorni === 0) return "compie gli anni oggi";
  if (giorni === 1) return "compie gli anni domani";
  if (giorni <= 30) return `compleanno fra ${giorni} giorni`;
  return null;
}

export default async function SellersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const user = await requireUser();
  const filters = await searchParams;
  const { rows, total, page, pages } = listSellers(user.id, filters);

  return (
    <>
      <PageHeader
        title="Venditori"
        subtitle={`${total} proprietari. Chi ti ha affidato un immobile, e cosa.`}
        actions={
          <Link href="/clienti/nuovo" className="btn-primary">
            Nuovo cliente
          </Link>
        }
      />

      <Card className="mb-5">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <label className="field-label" htmlFor="q">
              Cerca
            </label>
            <input
              id="q"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Nome, telefono, email…"
              className="field"
            />
          </div>
          <button type="submit" className="btn-primary">
            Filtra
          </button>
          <Link href="/venditori" className="btn-ghost">
            Azzera
          </Link>
        </form>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title="Nessun venditore in archivio."
            hint="Compaiono qui i clienti segnati come venditore o locatore, e chiunque risulti proprietario di un immobile in portafoglio."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((seller) => {
            const mobile = phoneHref(seller.mobile ?? seller.phone);
            const silent = daysSince(seller.last_contact_at);
            const compleanno = quandoCompie(seller.birthdayIn);

            return (
              <Card key={seller.id} bodyClassName="">
                <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/clienti/${seller.id}`}
                        className="font-medium text-slate-800 hover:text-brand-700 hover:underline"
                      >
                        {fullName(seller)}
                      </Link>
                      <StatusChip value={seller.status} kind="client" />
                      {seller.birthdayIn === 0 ? (
                        <Chip tone="brand">🎂 oggi</Chip>
                      ) : compleanno && seller.birthdayIn !== null && seller.birthdayIn <= 7 ? (
                        <Chip tone="amber">🎂 {compleanno}</Chip>
                      ) : null}
                    </div>

                    <p className="mt-0.5 text-xs text-slate-500">
                      {seller.mobile ?? seller.phone ?? "nessun recapito"}
                      {seller.email ? ` · ${seller.email}` : ""}
                      {seller.city ? ` · ${seller.city}` : ""}
                    </p>

                    <p className="mt-0.5 text-xs text-slate-400">
                      {seller.last_contact_at
                        ? `Ultimo contatto ${shortDate(seller.last_contact_at)}`
                        : "Mai contattato"}
                      {silent && silent > 90 ? " — da richiamare" : ""}
                      {seller.birth_date ? ` · nato il ${shortDate(seller.birth_date)}` : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {mobile ? (
                      <>
                        <a href={`tel:${mobile}`} className="btn-secondary px-2.5 py-1 text-xs">
                          Chiama
                        </a>
                        <a
                          href={whatsappHref(mobile) ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-secondary px-2.5 py-1 text-xs"
                        >
                          WhatsApp
                        </a>
                      </>
                    ) : null}
                  </div>
                </div>

                {seller.properties.length ? (
                  <ul className="mt-2 divide-y divide-slate-100 border-t border-slate-100">
                    {seller.properties.map((property) => (
                      <li
                        key={property.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-2"
                      >
                        <Link
                          href={`/immobili/${property.id}`}
                          className="text-sm text-slate-700 hover:text-brand-700 hover:underline"
                        >
                          {property.title}
                        </Link>
                        <span className="flex items-center gap-2 text-xs text-slate-500">
                          {property.ref ? <span>{property.ref}</span> : null}
                          <span>{euro(property.price)}</span>
                          <StatusChip value={property.status} kind="property" />
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
                    Nessun immobile collegato a questa scheda.
                  </p>
                )}
              </Card>
            );
          })}

          <Card bodyClassName="">
            <Pagination
              page={page}
              pages={pages}
              total={total}
              params={filters as Record<string, string | undefined>}
              basePath="/venditori"
            />
          </Card>
        </div>
      )}
    </>
  );
}
