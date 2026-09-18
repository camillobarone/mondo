"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/actions";
import { SubmitButton } from "@/components/client";

export function LoginForm() {
  const [error, action] = useActionState(loginAction, null);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="field-label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          className="field"
        />
      </div>

      <div>
        <label className="field-label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="field"
        />
      </div>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <SubmitButton className="w-full" pendingLabel="Accesso…">
        Entra
      </SubmitButton>
    </form>
  );
}
