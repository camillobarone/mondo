"use client";

import { useRef } from "react";
import { saveActivity } from "@/lib/actions";
import { SubmitButton } from "@/components/client";
import { ACTIVITY_TYPES } from "@/lib/types";

/**
 * Modulo per registrare un'attivita'. Usato nella scheda cliente, nella scheda
 * immobile e nell'agenda: cambia solo cosa arriva gia' compilato.
 */
export function ActivityForm({
  clientId,
  propertyId,
  userOptions,
  defaultUserId,
  clientOptions,
  propertyOptions,
  compact = false,
}: {
  clientId?: number;
  propertyId?: number;
  userOptions: { value: string; label: string }[];
  defaultUserId: number;
  clientOptions?: { value: string; label: string }[];
  propertyOptions?: { value: string; label: string }[];
  compact?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await saveActivity(formData);
        formRef.current?.reset();
      }}
      className="space-y-3"
    >
      {clientId ? <input type="hidden" name="client_id" value={clientId} /> : null}
      {propertyId ? <input type="hidden" name="property_id" value={propertyId} /> : null}

      <div className={`grid gap-3 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-4"}`}>
        <div>
          <label className="field-label" htmlFor="type">
            Tipo
          </label>
          <select id="type" name="type" className="field" defaultValue="chiamata">
            {ACTIVITY_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div className={compact ? "" : "sm:col-span-2"}>
          <label className="field-label" htmlFor="title">
            Cosa
          </label>
          <input
            id="title"
            name="title"
            className="field"
            placeholder="Es. richiamare per la visita"
            required
          />
        </div>

        <div>
          <label className="field-label" htmlFor="due_at">
            Quando
          </label>
          <input id="due_at" name="due_at" type="datetime-local" className="field" />
        </div>
      </div>

      {clientOptions ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="client_id">
              Cliente
            </label>
            <select id="client_id" name="client_id" className="field">
              <option value="">—</option>
              {clientOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="property_id">
              Immobile
            </label>
            <select id="property_id" name="property_id" className="field">
              <option value="">—</option>
              {(propertyOptions ?? []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      <div>
        <label className="field-label" htmlFor="notes">
          Note
        </label>
        <textarea id="notes" name="notes" rows={2} className="field resize-y" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              name="done"
              className="size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Già fatto
          </label>

          {userOptions.length > 1 ? (
            <select
              name="user_id"
              defaultValue={String(defaultUserId)}
              className="field w-auto py-1.5 text-xs"
              aria-label="Assegnata a"
            >
              {userOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <SubmitButton>Registra</SubmitButton>
      </div>
    </form>
  );
}
