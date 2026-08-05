import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { euro, fullName, fromCsv, phoneHref } from "@/lib/format";
import { PageHeader, Card, Chip, EmptyState, StatusChip } from "@/components/ui";
import type { Client, Property } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * La ricerca unica: un campo solo, da qualsiasi pagina.
 *
 * Il caso d'uso e' il telefono che squilla: chi chiama dice un nome, o si
 * legge il numero sul display, e bisogna arrivare alla scheda prima di
 * rispondere. Per questo cerca insieme clienti e immobili, e i numeri li
 * confronta ignorando spazi e punti: "340 111.2233" e "3401112233" sono lo
 * stesso numero scritto da due persone diverse.
 */

/** Un numero scritto in tre gestionali diversi resta lo stesso numero. */
const PULITO = (colonna: string) =>
  `REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${colonna},''),' ',''),'.',''),'-',''),'/','')`;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const { q } = await searchParams;
  const testo = (q ?? "").trim();
  const like = `%${testo}%`;
  // Le cifre da sole: cosi' un numero si trova anche scritto diverso.
  const cifre = testo.replace(/\D/g, "");
  const cercaNumero = cifre.length >= 5;

  const clienti = testo
    ? all<Client>(
        `SELECT * FROM clients
          WHERE deleted_at IS NULL AND owner_id = ? AND (
            first_name LIKE ? OR last_name LIKE ? OR company LIKE ?
            OR (first_name || ' ' || last_name) LIKE ?
            OR (last_name || ' ' || first_name) LIKE ?
            OR email LIKE ? OR tax_code LIKE ?
            ${cercaNumero ? `OR ${PULITO("mobile")} LIKE ? OR ${PULITO("phone")} LIKE ?` : ""}
          )
          ORDER BY last_name COLLATE NOCASE, first_name COLLATE NOCASE
          LIMIT 30`,
        cercaNumero
          ? [user.id, like, like, like, like, like, like, like, `%${cifre}%`, `%${cifre}%`]
          : [user.id, like, like, like, like, like, like, like],
      )
    : [];

  const immobili = testo
    ? all<Property>(
        `SELECT * FROM properties
          WHERE deleted_at IS NULL AND agent_id = ? AND (
            title LIKE ? OR ref LIKE ? OR address LIKE ?
            OR city LIKE ? OR zone LIKE ?
          )
          ORDER BY updated_at DESC
          LIMIT 30`,
        [user.id, like, like, like, like, like],
      )
    : [];

  return (
    <>
      <PageHeader
        title="Cerca"
        subtitle="Clienti e immobili insieme: nome, telefono, email, riferimento, zona."
      />

      <Card className="mb-5">
        <form action="/cerca" className="flex gap-2">
          <input
            name="q"
            defaultValue={testo}
            placeholder="Es. Rizzo, 340 111, MI-2041, Torre Lapillo…"
            className="field flex-1"
            autoFocus
          />
          <button type="submit" className="btn-primary shrink-0">
            Cerca
          </button>
        </form>
      </Card>

      {!testo ? null : clienti.length === 0 && immobili.length === 0 ? (
        <Card>
          <EmptyState
            title={`Niente per «${testo}».`}
            hint="Prova con meno lettere, o solo con le cifre del numero."
          />
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title={`Clienti (${clienti.length}${clienti.length === 30 ? "+" : ""})`} bodyClassName="">
            {clienti.length === 0 ? (
              <EmptyState title="Nessun cliente." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {clienti.map((cliente) => {
                  const numero = cliente.mobile ?? cliente.phone;
                  return (
                    <li key={cliente.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <Link
                          href={`/clienti/${cliente.id}`}
                          className="text-sm font-medium text-slate-800 hover:text-brand-700 hover:underline"
                        >
                          {fullName(cliente)}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {[numero, cliente.email, cliente.city].filter(Boolean).join(" · ") ||
                            "nessun recapito"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {fromCsv(cliente.roles)
                          .slice(0, 2)
                          .map((ruolo) => (
                            <Chip key={ruolo} tone="brand">
                              {ruolo}
                            </Chip>
                          ))}
                        {phoneHref(numero) ? (
                          <a
                            href={`tel:${phoneHref(numero)}`}
                            className="btn-secondary px-2.5 py-1 text-xs"
                          >
                            Chiama
                          </a>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title={`Immobili (${immobili.length}${immobili.length === 30 ? "+" : ""})`} bodyClassName="">
            {immobili.length === 0 ? (
              <EmptyState title="Nessun immobile." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {immobili.map((immobile) => (
                  <li key={immobile.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <Link
                        href={`/immobili/${immobile.id}`}
                        className="text-sm font-medium text-slate-800 hover:text-brand-700 hover:underline"
                      >
                        {immobile.title}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {[
                          immobile.ref,
                          [immobile.zone, immobile.city].filter(Boolean).join(", "),
                          immobile.sqm ? `${immobile.sqm} mq` : null,
                          euro(immobile.price),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <StatusChip value={immobile.status} kind="property" />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
