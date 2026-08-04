import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { getActivity, activeUserOptions } from "@/lib/queries";
import { dateTime } from "@/lib/format";
import { PageHeader, Card } from "@/components/ui";
import { ActivityForm } from "../../activity-form";
import { DeleteActivityButton } from "./delete-button";

export const dynamic = "force-dynamic";

/**
 * Modifica di un'attivita', anche gia' svolta.
 *
 * Un appuntamento si sposta, un cliente disdice, il commento raccolto dopo una
 * visita ci si ricorda mezz'ora dopo. Senza questa pagina l'unica strada era
 * cancellare e riscrivere, perdendo quello che c'era.
 */
export default async function EditActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ da?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { da } = await searchParams;

  const activity = getActivity(Number(id));
  if (!activity) notFound();

  const users = activeUserOptions();
  const clients = all<{ id: number; name: string }>(
    `SELECT id, TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,'')) AS name
       FROM clients WHERE deleted_at IS NULL
      ORDER BY last_name COLLATE NOCASE LIMIT 500`,
  );
  const properties = all<{ id: number; title: string }>(
    `SELECT id, title FROM properties WHERE deleted_at IS NULL
      ORDER BY updated_at DESC LIMIT 300`,
  );

  const clientOptions = clients.map((client) => ({
    value: String(client.id),
    label: client.name || `Cliente #${client.id}`,
  }));
  const propertyOptions = properties.map((property) => ({
    value: String(property.id),
    label: property.title,
  }));

  // Le tendine sono troncate (500 clienti, 300 immobili): se il collegamento
  // dell'attivita' sta oltre il taglio, il select ripiegherebbe su "—" e il
  // salvataggio scollegherebbe cliente o immobile in silenzio. Chi c'e' gia',
  // in cima e sempre presente.
  if (
    activity.client_id &&
    !clientOptions.some((option) => option.value === String(activity.client_id))
  ) {
    clientOptions.unshift({
      value: String(activity.client_id),
      label: activity.client_name || `Cliente #${activity.client_id}`,
    });
  }
  if (
    activity.property_id &&
    !propertyOptions.some((option) => option.value === String(activity.property_id))
  ) {
    propertyOptions.unshift({
      value: String(activity.property_id),
      label: activity.property_title || `Immobile #${activity.property_id}`,
    });
  }

  // Da dove si e' arrivati: si torna li'. Solo percorsi interni, per non
  // trasformare il campo in un rimbalzo verso l'esterno.
  const ritorno = da && da.startsWith("/") && !da.startsWith("//") ? da : "/agenda";

  return (
    <>
      <PageHeader
        title="Modifica attività"
        subtitle={
          activity.done_at
            ? `Svolta il ${dateTime(activity.done_at)}`
            : activity.due_at
              ? `In programma per il ${dateTime(activity.due_at)}`
              : "Senza data"
        }
        actions={
          <Link href={ritorno} className="btn-secondary">
            ← Annulla
          </Link>
        }
      />

      <Card className="mb-5">
        <ActivityForm
          userOptions={users}
          defaultUserId={user.id}
          clientOptions={clientOptions}
          propertyOptions={propertyOptions}
          activity={activity}
          redirectTo={ritorno}
        />
      </Card>

      <Card title="Eliminare">
        <p className="mb-3 text-sm text-slate-600">
          L&apos;attività sparisce dall&apos;agenda, dallo storico del cliente e
          dell&apos;immobile, e dallo storico visite del proprietario. Non si recupera.
        </p>
        <DeleteActivityButton id={activity.id} redirectTo={ritorno} />
      </Card>
    </>
  );
}
