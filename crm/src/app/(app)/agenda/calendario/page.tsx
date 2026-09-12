import Link from "next/link";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { calendarToken, chiavePubblicaAvvisi, telefoniIscritti } from "@/lib/queries";
import { PREAVVISO_MINUTI } from "@/lib/calendar";
import { PageHeader, Card } from "@/components/ui";
import { CopyField, ModuloConEsito, AvvisoModulo } from "@/components/client";
import { togliQuestoTelefono } from "@/lib/actions";
import { ResetTokenButton } from "./reset-button";
import { AvvisiTelefono } from "./avvisi-telefono";

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
  const chiavePubblica = chiavePubblicaAvvisi();
  const telefoni = telefoniIscritti(user.id);

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
        <Card title="Avviso sul telefono, da solo">
          <p className="text-sm text-slate-600">
            È la strada che funziona su <strong>iPhone, Samsung e Xiaomi allo stesso
            modo</strong>: {PREAVVISO_MINUTI} minuti{" "}
            prima di ogni appuntamento il gestionale fa comparire l&apos;avviso sul
            telefono, anche a programma chiuso.
            Non serve nessun calendario collegato e nessun indirizzo email.
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Si accende <strong>su ogni telefono separatamente</strong>, una volta sola.
            Toccando l&apos;avviso si apre l&apos;appuntamento.
          </p>

          <div className="mt-4">
            <AvvisiTelefono chiavePubblica={chiavePubblica} />
          </div>

          {telefoni.length > 0 ? (
            <div className="mt-5 border-t border-slate-200 pt-4">
              <p className="text-sm font-medium text-slate-800">
                Dove arrivano i tuoi avvisi
              </p>
              <ul className="mt-2 space-y-2">
                {telefoni.map((telefono) => (
                  <li
                    key={telefono.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2"
                  >
                    <span className="text-sm text-slate-700">
                      {telefono.device ?? "Dispositivo"}
                      <span className="ml-2 text-xs text-slate-500">
                        {telefono.last_ok_at
                          ? `ultimo avviso ricevuto il ${telefono.last_ok_at.slice(8, 10)}/${telefono.last_ok_at.slice(5, 7)}`
                          : "nessun avviso ancora ricevuto"}
                      </span>
                    </span>
                    <ModuloConEsito azione={togliQuestoTelefono}>
                      <input type="hidden" name="endpoint" value={telefono.endpoint} />
                      <AvvisoModulo />
                      <button type="submit" className="text-xs text-slate-500 hover:underline">
                        togli
                      </button>
                    </ModuloConEsito>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-slate-500">
                Nell&apos;avviso ci sono l&apos;ora e il titolo dell&apos;appuntamento. Il
                nome del cliente compare solo se quella scheda è tua: se l&apos;appuntamento
                è su una scheda di un collega, arriva senza nome — come già succede per il
                promemoria via email.
              </p>
            </div>
          ) : null}
        </Card>

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
              <p className="mt-1 text-amber-800">
                Su Google vedi gli appuntamenti ma <strong>non vieni avvisato</strong>:
                leggi il riquadro qui sotto.
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
              <p className="mt-1 text-slate-500">
                Da qui la sveglia dei {PREAVVISO_MINUTI} minuti prima{" "}
                <strong>suona davvero</strong>, su tutti gli appuntamenti e senza
                impostare niente.
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
            <p className="font-medium">Due cose da sapere su Google</p>
            <p className="mt-1">
              <strong>La sveglia non suona.</strong> Dentro ogni appuntamento la sveglia
              dei {PREAVVISO_MINUTI} minuti prima c&apos;è, e Apple e Outlook la fanno{" "}
              suonare: Google invece <strong>non avvisa mai</strong> per i calendari a cui ci si
              abbona, li mostra e basta. Non è una cosa da impostare — Google non offre
              proprio la possibilità. Quindi su Google l&apos;abbonamento serve a{" "}
              <em>vedere</em> l&apos;agenda, non a essere avvisati.
            </p>
            <p className="mt-2">
              <strong>Gli appuntamenti nuovi arrivano tardi.</strong> Google ricontrolla i
              calendari esterni quando decide lui, anche dopo diverse ore. Apple e Outlook
              sono più svelti.
            </p>
            <p className="mt-2">
              Per tutti e due i problemi la risposta è la stessa:{" "}
              <strong>Calendario</strong> sulla riga dell&apos;agenda. Quell&apos;appuntamento
              entra subito e diventa tuo, e da lì la sveglia suona anche su Google.
            </p>
          </div>
        </Card>

        <Card title="Avviso per email">
          <p className="text-sm text-slate-600">
            Se il server è configurato per spedire posta, {PREAVVISO_MINUTI} minuti{" "}
            prima di ogni appuntamento arriva un&apos;email a{" "}
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
