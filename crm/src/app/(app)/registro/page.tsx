import { requireUser } from "@/lib/auth";
import { auditTrail } from "@/lib/queries";
import { dateTime } from "@/lib/format";
import { PageHeader, Card, EmptyState, Chip } from "@/components/ui";

export const dynamic = "force-dynamic";

const TONES: Record<string, string> = {
  crea: "green",
  modifica: "blue",
  elimina: "red",
  esporta: "amber",
  accesso: "slate",
};

export default async function AuditPage() {
  // Non e' piu' una pagina da titolare: ognuno ha il registro delle proprie
  // mosse, e nessuno ha quello degli altri.
  const user = await requireUser();
  const entries = auditTrail(user.id, 300);

  return (
    <>
      <PageHeader
        title="Registro accessi"
        subtitle="Cosa hai fatto e quando. Serve agli adempimenti privacy e a ricostruire gli errori."
      />

      <Card bodyClassName="">
        {entries.length === 0 ? (
          <EmptyState title="Nessuna attività registrata." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Chi</th>
                  <th>Azione</th>
                  <th>Oggetto</th>
                  <th>Dettaglio</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="text-xs whitespace-nowrap text-slate-600">
                      {dateTime(entry.created_at)}
                    </td>
                    <td className="text-xs text-slate-700">{entry.user_name ?? "—"}</td>
                    <td>
                      <Chip tone={TONES[entry.action] ?? "slate"}>{entry.action}</Chip>
                    </td>
                    <td className="text-xs text-slate-600">
                      {entry.entity}
                      {entry.entity_id ? ` #${entry.entity_id}` : ""}
                    </td>
                    <td className="text-xs text-slate-500">{entry.detail ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-4 text-xs text-slate-500">
        Il registro conserva le ultime 300 operazioni. Per il periodo di conservazione previsto
        dalla normativa, i backup del database vanno archiviati separatamente.
      </p>
    </>
  );
}
