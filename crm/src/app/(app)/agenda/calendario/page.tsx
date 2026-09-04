import Link from "next/link";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { calendarToken } from "@/lib/queries";
import { PREAVVISO_MINUTI } from "@/lib/calendar";
import { PageHeader, Card } from "@/components/ui";
import { CopyField } from "@/components/client";
import { ResetTokenButton } from "./reset-button";

export const dynamic = "force-dynamic";

/**
 * Come portare l'agenda dentro il proprio calendario, e da li' ricevere
 * l'avviso mezz'ora prima.
 *
 * L'abbonamento e' un indirizzo, non un account collegato: funziona con
 * Google, con l'iPhone e con Outlook allo stesso modo, e non smette di
 * funzionare quando qualcuno cambia le regole delle applicazioni collegate.
 */
export default async function CalendarioPage() {
  const user = await requireUser();
  const token = calendarToken(user.id);

  // L'indirizzo con cui si e' arrivati qui e' anche quello che deve funzionare
  // dal telefono: si prende da li' invece di scriverlo in configurazione.
  const head = await headers();
  const host = head.get("x-forwarded-host") ?? head.get("host") ?? "";
  const protocollo = (head.get("x-forwarded-proto") ?? "https").split(",")[0]!.trim();
  const indirizzo = `${protocollo}://${host}/calendario/${token}.ics`;
  const webcal = indirizzo.replace(/^https?:/, "webcal:");

  return (
    <>
      <PageHeader
        title="Calendario e avvisi"
        subtitle={`Gli appuntamenti di ${user.name} nel tuo calendario, con l'avviso ${PREAVVISO_MINUTI} minuti prima.`}
        actions={
          <Link href="/agenda" className="btn-secondary">
            ← Torna all&apos;agenda
          </Link>
        }
      />

      <div className="space-y-5">
        <Card title="Un appuntamento alla volta">
          <p className="text-sm text-slate-600">
            Su ogni riga dell&apos;agenda c&apos;è <strong>Calendario</strong>: scarica
            l&apos;appuntamento e lo apre nel calendario del telefono o del computer, con la
            sveglia già impostata <strong>{PREAVVISO_MINUTI} minuti prima</strong>.
          </p>
          <p className="mt-2 text-sm text-slate-600">
            È la strada più affidabile per l&apos;avviso: entra subito, e suona anche a
            gestionale chiuso.
          </p>
        </Card>

        <Card title="Tutta l'agenda, sempre allineata">
          <p className="mb-3 text-sm text-slate-600">
            Questo indirizzo è il tuo calendario. Chi lo riceve vede i tuoi appuntamenti:
            trattalo come una password, non mandarlo in giro.
          </p>

          <CopyField value={indirizzo} etichetta="Indirizzo del calendario" />

          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <div>
              <p className="font-medium text-slate-800">Google Calendar (da computer)</p>
              <p>
                calendar.google.com → <em>Altri calendari</em> → <em>+</em> →{" "}
                <em>Da URL</em> → incolla l&apos;indirizzo → <em>Aggiungi calendario</em>.
              </p>
            </div>
            <div>
              <p className="font-medium text-slate-800">iPhone e iPad</p>
              <p>
                Impostazioni → <em>Calendario</em> → <em>Account</em> →{" "}
                <em>Aggiungi account</em> → <em>Altro</em> →{" "}
                <em>Aggiungi calendario con sottoscrizione</em> → incolla l&apos;indirizzo.
                Oppure apri direttamente{" "}
                <a href={webcal} className="text-brand-700 hover:underline">
                  questo collegamento
                </a>{" "}
                dal telefono.
              </p>
            </div>
            <div>
              <p className="font-medium text-slate-800">Outlook</p>
              <p>
                Calendario → <em>Aggiungi calendario</em> → <em>Sottoscrivi dal Web</em> →
                incolla l&apos;indirizzo.
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">Una cosa da sapere su Google</p>
            <p className="mt-1">
              Google ricontrolla i calendari esterni quando decide lui, anche dopo diverse
              ore: un appuntamento appena inserito può non comparire subito. Apple e Outlook
              sono più svelti. Per l&apos;appuntamento di oggi usa{" "}
              <strong>Calendario</strong> sulla riga dell&apos;agenda, che è immediato.
            </p>
          </div>
        </Card>

        <Card title="Avviso per email">
          <p className="text-sm text-slate-600">
            Se il server è configurato per spedire posta, {PREAVVISO_MINUTI} minuti prima di
            ogni appuntamento arriva un&apos;email a{" "}
            <strong>{user.email}</strong>. Non serve fare niente: parte da sé per gli
            appuntamenti assegnati a te.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            La configurazione della posta si fa una volta sola sul server, in{" "}
            <code className="rounded bg-slate-100 px-1">CONSEGNA.md</code> c&apos;è come.
            Finché non è impostata, l&apos;avviso per email semplicemente non parte: il
            calendario funziona lo stesso.
          </p>
        </Card>

        <Card title="Se l'indirizzo è finito nelle mani sbagliate">
          <p className="mb-3 text-sm text-slate-600">
            Genera un indirizzo nuovo: il vecchio smette di funzionare subito. I calendari
            già collegati vanno ricollegati con quello nuovo.
          </p>
          <ResetTokenButton />
        </Card>
      </div>
    </>
  );
}
