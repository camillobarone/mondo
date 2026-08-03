"use client";

import { useRef, useState } from "react";
import { saveActivity } from "@/lib/actions";
import { SubmitButton } from "@/components/client";
import { ACTIVITY_TYPES } from "@/lib/types";
import type { ActivityRow } from "@/lib/queries";

/**
 * Modulo per registrare un'attivita'. Usato nella scheda cliente, nella scheda
 * immobile, nell'agenda e nella pagina di modifica: cambia solo cosa arriva
 * gia' compilato.
 */
export function ActivityForm({
  clientId,
  propertyId,
  userOptions,
  defaultUserId,
  clientOptions,
  propertyOptions,
  compact = false,
  activity,
  redirectTo,
}: {
  clientId?: number;
  propertyId?: number;
  userOptions: { value: string; label: string }[];
  defaultUserId: number;
  clientOptions?: { value: string; label: string }[];
  propertyOptions?: { value: string; label: string }[];
  compact?: boolean;
  /** Presente solo quando si sta modificando un'attivita' esistente. */
  activity?: ActivityRow;
  /** Dove tornare dopo il salvataggio (solo in modifica). */
  redirectTo?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [type, setType] = useState(activity?.type ?? "chiamata");
  const [done, setDone] = useState(Boolean(activity?.done_at));

  // Il commento raccolto dopo una visita e' quello che finisce nel resoconto
  // per il proprietario: va chiesto quando c'e' qualcosa da raccontare, cioe'
  // quando l'attivita' e' fatta, e non prima.
  const chiediEsito = done;
  const visita = type === "visita";

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await saveActivity(formData);
        if (!activity) formRef.current?.reset();
      }}
      className="space-y-3"
    >
      {activity ? <input type="hidden" name="id" value={activity.id} /> : null}
      {redirectTo ? <input type="hidden" name="redirect_to" value={redirectTo} /> : null}
      {/* Conserva il momento in cui e' stata completata: rimettendo la spunta
          non deve diventare "adesso". */}
      {activity?.done_at ? (
        <input type="hidden" name="done_at" value={activity.done_at} />
      ) : null}
      {clientId ? <input type="hidden" name="client_id" value={clientId} /> : null}
      {propertyId && !propertyOptions ? (
        <input type="hidden" name="property_id" value={propertyId} />
      ) : null}

      <div className={`grid gap-3 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-4"}`}>
        <div>
          <label className="field-label" htmlFor="type">
            Tipo
          </label>
          <select
            id="type"
            name="type"
            className="field"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            {ACTIVITY_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
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
            defaultValue={activity?.title ?? ""}
            required
          />
        </div>

        <div>
          <label className="field-label" htmlFor="due_at">
            Quando
          </label>
          <input
            id="due_at"
            name="due_at"
            type="datetime-local"
            className="field"
            defaultValue={(activity?.due_at ?? "").slice(0, 16)}
          />
        </div>
      </div>

      {clientOptions || propertyOptions ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {clientOptions ? (
            <div>
              <label className="field-label" htmlFor="client_id">
                Cliente
              </label>
              <select
                id="client_id"
                name="client_id"
                className="field"
                defaultValue={String(activity?.client_id ?? clientId ?? "")}
              >
                <option value="">—</option>
                {clientOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {propertyOptions ? (
            <div>
              <label className="field-label" htmlFor="property_id">
                Immobile
              </label>
              <select
                id="property_id"
                name="property_id"
                className="field"
                defaultValue={String(activity?.property_id ?? propertyId ?? "")}
              >
                <option value="">—</option>
                {propertyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {visita ? (
                <p className="mt-1 text-xs text-slate-500">
                  Collegando la visita all&apos;immobile finisce nel resoconto per il
                  proprietario.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div>
        <label className="field-label" htmlFor="notes">
          Note
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          className="field resize-y"
          defaultValue={activity?.notes ?? ""}
        />
      </div>

      {chiediEsito ? (
        <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="outcome">
              {visita ? "Cosa ha detto il cliente" : "Esito"}
            </label>
            <textarea
              id="outcome"
              name="outcome"
              rows={2}
              className="field resize-y"
              placeholder={
                visita
                  ? "Es. casa bella ma fuori budget: oltre i 260 non riusciamo ad andare"
                  : "Es. richiama lunedì"
              }
              defaultValue={activity?.outcome ?? ""}
            />
            {visita ? (
              <p className="mt-1 text-xs text-slate-500">
                Finisce nel resoconto per il proprietario, virgolettato.
              </p>
            ) : null}
          </div>
          <div>
            <label className="field-label" htmlFor="interest">
              Interesse
            </label>
            <select
              id="interest"
              name="interest"
              className="field"
              defaultValue={activity?.interest ?? ""}
            >
              <option value="">—</option>
              <option value="alto">Alto</option>
              <option value="medio">Medio</option>
              <option value="basso">Basso</option>
            </select>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              name="done"
              checked={done}
              onChange={(event) => setDone(event.target.checked)}
              className="size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            {activity ? "Fatto" : "Già fatto"}
          </label>

          {userOptions.length > 1 ? (
            <select
              name="user_id"
              defaultValue={String(activity?.user_id ?? defaultUserId)}
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

        <SubmitButton>{activity ? "Salva" : "Registra"}</SubmitButton>
      </div>
    </form>
  );
}
