import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { count } from "@/lib/db";
import { LoginForm } from "./form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ cambiata?: string }>;
}) {
  if (await currentUser()) redirect("/");

  const { cambiata } = await searchParams;
  const hasUsers = count(`SELECT COUNT(*) AS n FROM users WHERE active = 1`) > 0;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-white">Mondo Immobiliare</h1>
          <p className="mt-1 text-sm text-brand-300">Gestione clienti e portafoglio</p>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-lg">
          {hasUsers ? (
            <>
              {cambiata ? (
                <p
                  className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
                  role="status"
                >
                  Password cambiata. Entra con quella nuova.
                </p>
              ) : null}
              <LoginForm />
              <p className="mt-4 text-center text-sm">
                <Link href="/recupero" className="text-slate-500 hover:text-brand-700 hover:underline">
                  Password dimenticata?
                </Link>
              </p>
            </>
          ) : (
            <div className="text-sm text-slate-600">
              <p className="font-medium text-slate-800">Nessun utente configurato.</p>
              <p className="mt-2">
                Esegui <code className="rounded bg-slate-100 px-1.5 py-0.5">npm run seed</code> dal
                terminale per creare il primo accesso, poi ricarica questa pagina.
              </p>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Accesso riservato ai collaboratori di Studio RCS Srls.
        </p>
      </div>
    </main>
  );
}
