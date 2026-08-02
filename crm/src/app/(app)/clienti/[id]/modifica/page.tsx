import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getClient, activeUserOptions } from "@/lib/queries";
import { fullName } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { ClientForm } from "../../client-form";

export const dynamic = "force-dynamic";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const client = getClient(Number(id));
  if (!client) notFound();

  return (
    <>
      <PageHeader title={`Modifica ${fullName(client)}`} />
      <ClientForm
        client={client}
        userOptions={activeUserOptions()}
        defaultOwnerId={user.id}
      />
    </>
  );
}
