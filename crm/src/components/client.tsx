"use client";

import { useFormStatus } from "react-dom";
import { useState, type ReactNode } from "react";

/** Bottone di invio che si disabilita e cambia testo mentre salva. */
export function SubmitButton({
  children = "Salva",
  pendingLabel = "Salvataggio…",
  variant = "primary",
  className = "",
  formAction,
  name,
  value,
}: {
  children?: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  const style = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    danger: "btn-danger",
  }[variant];

  return (
    <button
      type="submit"
      disabled={pending}
      formAction={formAction}
      name={name}
      value={value}
      className={`${style} ${className}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

/** Bottone che chiede conferma prima di inviare (eliminazioni). */
export function ConfirmButton({
  children,
  message,
  variant = "danger",
  className = "",
}: {
  children: ReactNode;
  message: string;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
}) {
  const { pending } = useFormStatus();
  const style = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    danger: "btn-danger",
  }[variant];

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${style} ${className}`}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {pending ? "Attendere…" : children}
    </button>
  );
}

/** Sezione che si apre e chiude, per i moduli lunghi. */
export function Collapsible({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="card">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="card-title">{title}</span>
        <span className="text-slate-400">{open ? "−" : "+"}</span>
      </button>
      {open ? <div className="border-t border-slate-200 p-4">{children}</div> : null}
    </div>
  );
}
