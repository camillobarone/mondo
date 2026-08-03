import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { activeUserOptions , knownZones } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import { PropertyForm } from "../property-form";

export const dynamic = "force-dynamic";

export default async function NewPropertyPage() {
  const user = await requireUser();

  const clients = all<{ id: number; name: string }>(
    `SELECT id, TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,'') ||
            CASE WHEN company IS NOT NULL AND company != '' THEN ' (' || company || ')' ELSE '' END) AS name
       FROM clients WHERE deleted_at IS NULL
      ORDER BY last_name COLLATE NOCASE LIMIT 1000`,
  );

  return (
    <>
      <PageHeader
        title="Nuovo immobile"
        subtitle="Collega il proprietario a una scheda cliente: servirà per l'incarico e le provvigioni."
      />
      <PropertyForm
        zoneOptions={knownZones()}
        userOptions={activeUserOptions()}
        defaultAgentId={user.id}
      />
    </>
  );
}
