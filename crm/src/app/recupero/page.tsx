import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { postaConfigurata } from "@/lib/posta";
import { ChiediRecuperoForm } from "./form";

export const dynamic = "force-dynamic";

/**
 * Password dimenticata.
 *
 * Sta fuori dall'area protetta per forza: chi e' arrivato qui non riesce a
 * entrare. Per lo stesso motivo non puo' dire piu' del necessario — la
 * risposta e' identica che l'indirizzo esista o no, altrimenti diventerebbe
 * un modo per sapere chi lavora in agenzia.
 */
export default async function RecuperoPage() {
  if (await currentUser()) redirect("/accesso");

  const posta = postaConfigurata();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-white">Password dimenticata</h1>
          <p className="mt-1 text-sm text-brand-300">
            {posta ? "Ti mandiamo un collegamento per rientrare" : "Come rientrare"}
          </p>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-lg">
          {posta ? (
            <>
              <p className="mb-4 text-sm text-slate-600">
                Scrivi l&apos;indirizzo con cui entri nel gestionale. Il collegamento vale{" "}
                <strong>un&apos;ora</strong> e una volta sola.
              </p>
              <ChiediRecuperoForm />
            </>
          ) : (
            <div className="text-sm text-slate-600">
              <p className="font-medium text-slate-800">
                Il recupero automatico non è disponibile.
              </p>
              <p className="mt-2">
                Su questo server la posta non è ancora configurata, quindi il programma non può
                mandarti l&apos;email. Chiedi al titolare di reimpostarti la password dalla pagina{" "}
                <strong>Utenti</strong>.
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
