import { requireUser } from "@/lib/auth";
import { activeUserOptions } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import { ClientForm } from "../client-form";

export const dynamic = "force-dynamic";

export default async function NewClientPage() {
  const user = await requireUser();

  return (
    <>
      <PageHeader
        title="Nuovo cliente"
        subtitle="Bastano cognome e un recapito: il resto si completa strada facendo."
      />
      <ClientForm userOptions={activeUserOptions()} defaultOwnerId={user.id} />
    </>
  );
}
