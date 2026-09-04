import { requireUser, PASSWORD_MINIMA } from "@/lib/auth";
import { PageHeader, Card, DataRow, Banner } from "@/components/ui";
import { CambioPasswordForm } from "./form";

export const dynamic = "force-dynamic";

/**
 * Il proprio accesso.
 *
 * Prima le password le impostava solo il titolare, dalla pagina Utenti: voleva
 * dire che qualcun altro conosceva la tua. Da qui ognuno si cambia la propria,
 * e nessun altro deve saperla.
 */
export default async function AccessoPage() {
  const user = await requireUser();

  return (
    <>
      <PageHeader
        title="Il mio accesso"
        subtitle="I tuoi dati e la tua password. Nessun altro la vede."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Chi sei nel programma">
          <dl>
            <DataRow label="Nome">{user.name}</DataRow>
            <DataRow label="Email">{user.email}</DataRow>
            <DataRow label="Ruolo">
              {user.role === "titolare" ? "Titolare" : "Agente"}
            </DataRow>
            <DataRow label="Ufficio">{user.office}</DataRow>
          </dl>
          <p className="mt-3 text-xs text-slate-500">
            Nome, email e ufficio li cambia il titolare dalla pagina Utenti. La password no:
            quella è solo tua.
          </p>
        </Card>

        <Card title="Cambia la password">
          <Banner tone="blue">
            Appena cambiata, <strong>tutti gli accessi già aperti si chiudono</strong> — anche
            quelli su altri computer, e anche quelli di chi conosceva la password vecchia.
            Dovrai rientrare con quella nuova.
          </Banner>
          <div className="mt-4">
            <CambioPasswordForm minimo={PASSWORD_MINIMA} />
          </div>
        </Card>
      </div>
    </>
  );
}
