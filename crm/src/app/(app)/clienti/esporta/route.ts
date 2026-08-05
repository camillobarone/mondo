import { currentUser } from "@/lib/auth";
import { audit } from "@/lib/db";
import { listAllClients, type ClientFilters } from "@/lib/queries";
import { buildCsv } from "@/lib/csv";
import { fullName } from "@/lib/format";

/** Scarica l'elenco filtrato dei clienti come CSV apribile con Excel. */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return new Response("Non autorizzato", { status: 401 });

  // I filtri arrivano dall'indirizzo e non sono controllati: va bene, perche'
  // il vincolo che conta non e' fra questi. Qualunque cosa chieda chi scarica,
  // listAllClients gli da' soltanto le proprie schede.
  const params = Object.fromEntries(new URL(request.url).searchParams) as ClientFilters;
  const clients = listAllClients(user.id, params);

  const csv = buildCsv(
    [
      "Nome",
      "Cognome",
      "Ragione sociale",
      "Cellulare",
      "Telefono",
      "Email",
      "Indirizzo",
      "Comune",
      "Codice fiscale",
      "Ruoli",
      "Provenienza",
      "Stato",
      "Seguito da",
      "Etichette",
      "Consenso privacy",
      "Ultimo contatto",
      "Note",
    ],
    clients.map((client) => [
      client.first_name,
      client.last_name,
      client.company,
      client.mobile,
      client.phone,
      client.email,
      client.address,
      client.city,
      client.tax_code,
      client.roles,
      client.source,
      client.status,
      client.owner_name,
      client.tags,
      client.privacy_consent ? `Sì (${client.privacy_date ?? ""})` : "No",
      client.last_contact_at,
      client.notes,
    ]),
  );

  audit(user.id, "esporta", "cliente", null, `${clients.length} schede esportate`);

  const today = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clienti-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

export const dynamic = "force-dynamic";
