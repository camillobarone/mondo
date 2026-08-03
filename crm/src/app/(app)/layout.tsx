import { requireUser } from "@/lib/auth";
import { count } from "@/lib/db";
import { Nav, type NavItem } from "@/components/nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const todo = count(
    `SELECT COUNT(*) AS n FROM activities
      WHERE done_at IS NULL AND due_at IS NOT NULL
        AND date(due_at) <= date('now') AND user_id = ?`,
    [user.id],
  );

  const items: NavItem[] = [
    { href: "/", label: "Cruscotto" },
    { href: "/agenda", label: "Agenda", badge: todo || undefined },
    { href: "/clienti", label: "Clienti" },
    { href: "/venditori", label: "Venditori" },
    { href: "/immobili", label: "Immobili" },
    { href: "/richieste", label: "Richieste" },
    { href: "/incroci", label: "Incroci" },
    { href: "/report", label: "Report" },
    { href: "/importa", label: "Importa" },
  ];

  if (user.role === "titolare") {
    items.push({ href: "/utenti", label: "Utenti" }, { href: "/registro", label: "Registro" });
  }

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <Nav items={items} userName={user.name} userRole={user.role} office={user.office} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
