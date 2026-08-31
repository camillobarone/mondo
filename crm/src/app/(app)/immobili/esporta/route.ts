import { currentUser } from "@/lib/auth";
import { audit } from "@/lib/db";
import { listAllProperties, type PropertyFilters } from "@/lib/queries";
import { buildCsv } from "@/lib/csv";
import { idVideoYouTube } from "@/lib/video";

/** Scarica il portafoglio filtrato come CSV apribile con Excel. */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return new Response("Non autorizzato", { status: 401 });

  const params = Object.fromEntries(new URL(request.url).searchParams) as PropertyFilters;
  const properties = listAllProperties(user.id, params);
  // Prima le colonne dei soldi erano riservate al titolare, perche' vedeva
  // anche il portafoglio degli altri. Adesso ognuno esporta solo il proprio:
  // i propri incassi li puo' vedere chiunque li abbia fatti.
  const isOwner = true;

  const headers = [
    "Codice",
    "Titolo",
    "Tipologia",
    "Contratto",
    "Indirizzo",
    "Comune",
    "Zona",
    "Mq",
    "Vani",
    "Prezzo",
    "Stato",
    "Proprietario",
    "Agente",
    "Inizio incarico",
    "Scadenza incarico",
    "Esclusiva",
    // Il collegamento com'e' stato scritto, e accanto l'identificativo del
    // video ricavato da li'. Due colonne e non una: il collegamento serve a
    // una persona che lo clicca, l'identificativo a un programma che deve
    // accoppiare il video al suo immobile senza indovinare dal titolo. Vuoto
    // quando il collegamento non e' di YouTube o non contiene un
    // identificativo riconoscibile — un identificativo inventato sarebbe
    // peggio di nessun identificativo.
    "Video YouTube",
    "ID video",
  ];

  // Le provvigioni le vede solo il titolare.
  if (isOwner) headers.push("Prezzo rogito", "Provvigione venditore", "Provvigione acquirente");

  const csv = buildCsv(
    headers,
    properties.map((property) => {
      const row: (string | number | null)[] = [
        property.ref,
        property.title,
        property.kind,
        property.contract,
        property.address,
        property.city,
        property.zone,
        property.sqm,
        property.rooms,
        property.price,
        property.status,
        property.owner_name,
        property.agent_name,
        property.mandate_start,
        property.mandate_end,
        property.exclusive ? "Sì" : "No",
        property.video_url,
        idVideoYouTube(property.video_url),
      ];
      if (isOwner) {
        row.push(property.sold_price, property.commission_seller, property.commission_buyer);
      }
      return row;
    }),
  );

  audit(user.id, "esporta", "immobile", null, `${properties.length} immobili esportati`);

  const today = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="immobili-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

export const dynamic = "force-dynamic";
