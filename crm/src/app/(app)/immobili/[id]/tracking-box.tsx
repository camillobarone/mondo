import { headers } from "next/headers";
import { CopyField, ConfirmButton, SubmitButton } from "@/components/client";
import { Card } from "@/components/ui";
import {
  creaLinkTracking,
  rigeneraLinkTracking,
  revocaLinkTracking,
} from "@/lib/actions";
import { whatsappHref } from "@/lib/format";

/**
 * Il link riservato al proprietario, sulla scheda dell'agente.
 *
 * E' l'unico modo per farsi dare quell'indirizzo: la chiave non si genera da
 * sola alla nascita dell'immobile, perche' un link vivo e' una porta aperta
 * verso fuori e le porte si aprono quando c'e' da entrarci.
 */
export async function TrackingBox({
  propertyId,
  token,
  indirizzo,
  ownerName,
  ownerPhone,
}: {
  propertyId: number;
  token: string | null;
  /** La via dell'immobile: entra nel messaggio, cosi' si sa di quale casa si parla. */
  indirizzo: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
}) {
  if (!token) {
    return (
      <Card title="Link per il proprietario">
        <p className="mb-3 text-sm text-slate-600">
          Una pagina che il proprietario apre dal telefono, senza password, per
          vedere <strong>le visite</strong> e a che punto è la vendita. Non
          mostra né i nomi né i recapiti di chi è venuto a vedere.
        </p>
        <form action={creaLinkTracking}>
          <input type="hidden" name="property_id" value={propertyId} />
          <SubmitButton pendingLabel="Creazione…">Crea il link</SubmitButton>
        </form>
      </Card>
    );
  }

  // L'indirizzo con cui si e' arrivati qui e' anche quello che deve funzionare
  // dal telefono del proprietario: si prende da li' invece di scriverlo in
  // configurazione, come fa gia' la pagina del calendario.
  const head = await headers();
  const host = head.get("x-forwarded-host") ?? head.get("host") ?? "";
  const protocollo = (head.get("x-forwarded-proto") ?? "https").split(",")[0]!.trim();
  const link = `${protocollo}://${host}/tracking/${token}`;

  const casa = indirizzo?.trim();
  const messaggio =
    `Gentile ${ownerName || "cliente"}, da questo collegamento può seguire ` +
    `l'andamento della vendita${casa ? ` del suo immobile in ${casa}` : ""}: ` +
    `${link}\n\nÈ riservato a lei, la preghiamo di non condividerlo.`;

  // Mai wa.me scritto a mano: i numeri in archivio sono senza +39, e senza
  // prefisso WhatsApp non apre nessuna conversazione.
  const whatsapp = whatsappHref(ownerPhone, messaggio);

  return (
    <Card title="Link per il proprietario">
      <p className="mb-3 text-sm text-slate-600">
        Chi ha questo indirizzo vede le visite e a che punto è la vendita.
        Vale come una password: mandalo solo al proprietario.
      </p>

      <CopyField value={link} etichetta="Link riservato al proprietario" />

      <div className="mt-3 flex flex-wrap gap-2">
        <a href={link} target="_blank" rel="noreferrer" className="btn-secondary">
          Guarda com&apos;è
        </a>
        {whatsapp ? (
          <a href={whatsapp} target="_blank" rel="noreferrer" className="btn-primary">
            Invia su WhatsApp
          </a>
        ) : null}
      </div>

      {!whatsapp ? (
        <p className="mt-2 text-xs text-amber-700">
          {ownerName
            ? "Il proprietario non ha un numero in scheda: aggiungilo per mandarglielo su WhatsApp."
            : "Nessun proprietario collegato a questo immobile: collegalo per mandargli il link su WhatsApp."}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-4 border-t border-slate-100 pt-3">
        <form action={rigeneraLinkTracking}>
          <input type="hidden" name="property_id" value={propertyId} />
          <ConfirmButton
            variant="nudo"
            className="text-xs text-slate-600 hover:underline"
            message="Generare un link nuovo? Quello già mandato smetterà di funzionare."
          >
            Genera un link nuovo
          </ConfirmButton>
        </form>
        <form action={revocaLinkTracking}>
          <input type="hidden" name="property_id" value={propertyId} />
          <ConfirmButton
            variant="nudo"
            className="text-xs text-red-600 hover:underline"
            message="Togliere il link? Il proprietario non vedrà più la pagina finché non gliene crei uno nuovo."
          >
            Togli il link
          </ConfirmButton>
        </form>
      </div>
    </Card>
  );
}
