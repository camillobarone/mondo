import Link from "next/link";
import { utenteDelBiglietto, PASSWORD_MINIMA } from "@/lib/auth";
import { ReimpostaPasswordForm } from "../form";

export const dynamic = "force-dynamic";

/**
 * Si arriva qui dal collegamento ricevuto per email.
 *
 * Il biglietto vale un'ora e una volta sola: scaduto o gia' usato, la pagina
 * non dice "esiste ma e' vecchio" — dice soltanto che non va bene, come per un
 * indirizzo inventato.
 */
export default async function ImpostaPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const utente = utenteDelBiglietto(token);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-white">Scegli una password</h1>
          {utente ? (
            <p className="mt-1 text-sm text-brand-300">per {utente.email}</p>
          ) : null}
        </div>

        <div className="rounded-lg bg-white p-6 shadow-lg">
          {utente ? (
            <>
              <p className="mb-4 text-sm text-slate-600">
                Appena salvata, tutti gli accessi già aperti si chiudono. Entrerai con questa.
              </p>
              <ReimpostaPasswordForm token={token} minimo={PASSWORD_MINIMA} />
            </>
          ) : (
            <div className="text-sm text-slate-600">
              <p className="font-medium text-slate-800">Questo collegamento non è più valido.</p>
              <p className="mt-2">
                Vale un&apos;ora e una volta sola. Se è passato troppo tempo, o se l&apos;hai già
                usato, chiedine un altro.
              </p>
              <p className="mt-3">
                <Link href="/recupero" className="text-brand-700 hover:underline">
                  Chiedi un collegamento nuovo
                </Link>
              </p>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="text-brand-300 hover:text-white hover:underline">
            Torna all&apos;accesso
          </Link>
        </p>
      </div>
    </main>
  );
}
