"use client";

import { useActionState } from "react";
import Link from "next/link";
import { importClients, type ImportResult } from "@/lib/actions";
import { SubmitButton } from "@/components/client";

export function ImportForm() {
  const [result, action] = useActionState<ImportResult | null, FormData>(importClients, null);

  return (
    <>
      <form action={action} className="space-y-4">
        <div>
          <label className="field-label" htmlFor="file">
            File Excel o CSV
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
            className="field file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:text-slate-700"
          />
          <p className="mt-1 text-xs text-slate-400">
            Il file esportato dal tuo gestionale va bene com&apos;è: non serve convertirlo.
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            name="allow_duplicates"
            className="mt-0.5 size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span>
            <span className="text-sm text-slate-700">Importa anche i possibili doppioni</span>
            <span className="block text-xs text-slate-400">
              Se non spuntato, salta le righe con cellulare o email già presenti in archivio.
            </span>
          </span>
        </label>

        <SubmitButton pendingLabel="Importazione in corso…">Importa i clienti</SubmitButton>
      </form>

      {result ? (
        <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-800">
            {result.imported} clienti importati
            {result.skipped ? `, ${result.skipped} saltati` : ""}.
          </p>

          {result.requirements ? (
            <p className="mt-1 text-sm text-emerald-700">
              Riconosciute anche {result.requirements}{" "}
              {result.requirements === 1 ? "richiesta" : "richieste"}: quei clienti entrano
              subito negli incroci.
            </p>
          ) : null}

          {result.errors.length > 0 ? (
            <ul className="mt-2 space-y-0.5 text-xs text-amber-800">
              {result.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          ) : null}

          {result.imported > 0 ? (
            <Link href="/clienti" className="btn-primary mt-3">
              Vai all&apos;elenco clienti
            </Link>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
