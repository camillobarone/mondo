import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { getProperty, activeUserOptions , knownZones } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import { PropertyForm } from "../../property-form";

export const dynamic = "force-dynamic";

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const property = getProperty(Number(id));
  if (!property) notFound();

  const clients = all<{ id: number; name: string }>(
    `SELECT id, TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,'')) AS name
       FROM clients WHERE deleted_at IS NULL
      ORDER BY last_name COLLATE NOCASE LIMIT 1000`,
  );

  return (
    <>
      <PageHeader title={`Modifica ${property.title}`} />
      <PropertyForm
        zoneOptions={knownZones()}
        property={property}
        userOptions={activeUserOptions()}
        defaultAgentId={user.id}
      />
    </>
  );
}
