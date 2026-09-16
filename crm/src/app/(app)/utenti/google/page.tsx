import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { chiaviGoogle, googleCollegato } from "@/lib/google";
import { quantiDaRisincronizzare } from "@/lib/queries";
import {
  salvaChiaviGoogle,
  scollegaGoogleCalendar,
  dimenticaChiaviGoogle,
  risincronizzaGoogle,
} from "@/lib/actions";
import { ModuloConEsito, AvvisoModulo, SubmitButton, ConfirmButton, CopyField } from "@/components/client";
import { PageHeader, Card, TextField, Banner } from "@/components/ui";
import { indirizzoRitorno } from "../../google/ritorno";

export const dynamic = "force-dynamic";

export default async function GooglePage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string; collegato?: string }>;
}) {
  await requireOwner();
  const params = await searchParams;

  const chiavi = chiaviGoogle();
  const collegato = googleCollegato();
  const daMandare = collegato ? quantiDaRisincronizzare() : 0;
  const ritorno = await indirizzoRitorno();
  const daAmbiente = Boolean(process.env.GOOGLE_CLIENT_ID);

  return (
    <>
      <PageHeader
        title="Google Calendar"
        subtitle="Gli appuntamenti dentro il tuo Google, appena li salvi."
        actions={
          <Link href="/utenti" className="btn-secondary">
            Torna a Utenti
          </Link>
        }
      />

      {params.motivo ? (
        <div className="mb-4">
          <Banner tone="red">{params.motivo}</Banner>
        </div>
      ) : null}
      {params.collegato ? (
        <div className="mb-4">
          <Banner tone="green">
            Google è collegato. Da adesso gli appuntamenti nuovi ci finiscono dentro da
            soli; quelli già in agenda si mandano col pulsante qui sotto.
          </Banner>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="1 · Le chiavi di Google" className="lg:col-span-2">
          <div className="mb-4 max-w-2xl text-sm text-slate-600">
            <p>
              Si prendono una volta sola dal pannello di Google Cloud, seguendo la
              guida di consegna (capitolo <em>Collegare Google Calendar</em>). Qui si
              incollano e basta: <strong>non c&apos;è niente da scrivere sul server</strong>.
            </p>
            <p className="mt-2">
              Mentre le crei, Google chiede un <strong>URI di reindirizzamento
              autorizzato</strong>. È questo, e va incollato identico:
            </p>
            <div className="mt-2">
              <CopyField value={ritorno} etichetta="URI di reindirizzamento autorizzato" />
            </div>
          </div>

          {daAmbiente ? (
            <Banner tone="amber">
              Le chiavi arrivano dalle variabili d&apos;ambiente del server, e da qui non
              si cambiano.
            </Banner>
          ) : (
            <ModuloConEsito azione={salvaChiaviGoogle} className="max-w-xl space-y-4">
              <TextField
                label="Client ID"
                name="client_id"
                defaultValue={chiavi?.clientId}
                hint="Finisce per .apps.googleusercontent.com"
                autoComplete="off"
                required
              />
              <TextField
                label="Client secret"
                name="client_secret"
                type="password"
                defaultValue={chiavi ? "" : undefined}
                hint={chiavi ? "Ce n'è già uno salvato. Scrivilo solo se vuoi cambiarlo." : undefined}
                autoComplete="new-password"
                required={!chiavi}
              />
              <AvvisoModulo />
              <SubmitButton>Salva le chiavi</SubmitButton>
            </ModuloConEsito>
          )}
        </Card>

        <Card title="Com'è messo" className="lg:col-span-1">
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span aria-hidden>{chiavi ? "✅" : "⬜"}</span>
              <span className={chiavi ? "text-slate-700" : "text-slate-500"}>
                Chiavi {chiavi ? "salvate" : "da incollare"}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span aria-hidden>{collegato ? "✅" : "⬜"}</span>
              <span className={collegato ? "text-slate-700" : "text-slate-500"}>
                Consenso {collegato ? "dato" : "da dare"}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span aria-hidden>{collegato && !daMandare ? "✅" : "⬜"}</span>
              <span className={collegato && !daMandare ? "text-slate-700" : "text-slate-500"}>
                {collegato && daMandare
                  ? `${daMandare} appuntamenti ancora da mandare`
                  : "Appuntamenti allineati"}
              </span>
            </li>
          </ul>

          {collegato ? (
            <>
            <p className="mt-4 text-xs text-slate-500">
              I calendari si chiamano <em>Agenda Nome Cognome · Mondo</em>{" "}
              e compaiono
              nel tuo Google sotto <em>Le mie agende</em> — non sotto{" "}
              <em>Altri calendari</em>, che è dove vanno quelli a cui ci si abbona: questi
              sono tuoi, li possiedi tu. Il calendario di una persona nasce al suo primo
              appuntamento, non adesso.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Se in <em>Le mie agende</em> non li vedi, prima di pensare a un guasto
              guarda in <em>Impostazioni → Impostazioni per i miei calendari</em>: lì ci
              sono anche quelli che possiedi ma che hai tolto dalla vista, e basta
              rimettergli la spunta.
            </p>
            </>
          ) : null}
        </Card>

        <Card title="2 · Il consenso" className="lg:col-span-3">
          {!chiavi ? (
            <p className="text-sm text-slate-500">
              Prima vanno salvate le chiavi qui sopra.
            </p>
          ) : collegato ? (
            <div className="space-y-4">
              <p className="max-w-2xl text-sm text-slate-600">
                Google è collegato. Il gestionale può creare calendari suoi e scrivere
                lì dentro; <strong>il tuo calendario personale non lo può né leggere né
                toccare</strong> — è il permesso <code>calendar.app.created</code>, ed è
                il motivo per cui la schermata di consenso parlava solo di calendari
                creati dall&apos;app.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <ModuloConEsito azione={risincronizzaGoogle}>
                  <SubmitButton variant="secondary">
                    {daMandare
                      ? `Manda in Google i ${daMandare} rimasti`
                      : "Controlla se manca qualcosa"}
                  </SubmitButton>
                  <AvvisoModulo />
                </ModuloConEsito>

                <form action={scollegaGoogleCalendar}>
                  <ConfirmButton
                    variant="nudo"
                    className="text-xs text-red-700 hover:underline"
                    message={
                      "Scollego Google.\n\nGli appuntamenti già scritti restano nei " +
                      "calendari del tuo Google, ma da quel momento non si aggiornano " +
                      "più: se sposti un appuntamento nel gestionale, in Google resta " +
                      "all'ora vecchia.\n\nProcedere?"
                    }
                  >
                    scollega Google
                  </ConfirmButton>
                </form>

                <form action={dimenticaChiaviGoogle}>
                  <ConfirmButton
                    variant="nudo"
                    className="text-xs text-red-700 hover:underline"
                    message={
                      "Scollego Google e cancello anche le chiavi.\n\nPer ricollegarlo " +
                      "dovrai riprenderle dal pannello di Google Cloud.\n\nProcedere?"
                    }
                  >
                    scollega e dimentica le chiavi
                  </ConfirmButton>
                </form>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="max-w-2xl text-sm text-slate-600">
                Ti manda sulla schermata di Google. Va fatto <strong>con l&apos;account
                dove vuoi vedere i calendari</strong>{" "}— se sul computer sei entrato con
                più account Google, guarda in alto quale ti propone.
              </p>
              <p className="max-w-2xl text-xs text-slate-500">
                Se compare un avviso che l&apos;app non è verificata, è normale: è la tua,
                e Google lo dice a tutte quelle non pubblicate. Si prosegue da
                <em> Avanzate</em>.
              </p>
              <Link href="/google/collega" className="btn-primary inline-block">
                Collega Google
              </Link>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
