import { logoutAction } from "@/lib/actions";
import { SubmitButton } from "@/components/client";

export const dynamic = "force-dynamic";

export default function LogoutPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-900 px-4">
      <form action={logoutAction} className="w-full max-w-sm rounded-lg bg-white p-6 text-center">
        <p className="text-sm text-slate-700">Vuoi uscire dal programma?</p>
        <div className="mt-4">
          <SubmitButton className="w-full" pendingLabel="Uscita…">
            Esci
          </SubmitButton>
        </div>
      </form>
    </main>
  );
}
