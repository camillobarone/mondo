"use client";

import { useActionState } from "react";
import { uploadPhotos, deletePhoto, setCoverPhoto, type PhotoResult } from "@/lib/actions";
import { SubmitButton, ConfirmButton } from "@/components/client";
import type { Photo } from "@/lib/queries";

/**
 * Le foto di un immobile. La prima e' quella che si vede negli elenchi:
 * "Metti per prima" la sposta in cima senza dover riordinare tutto.
 */
export function PhotoGallery({ propertyId, photos }: { propertyId: number; photos: Photo[] }) {
  const [result, action] = useActionState<PhotoResult | null, FormData>(uploadPhotos, null);

  return (
    <div className="space-y-4">
      {photos.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo, index) => (
            <li key={photo.id} className="group relative">
              <a
                href={`/foto/${propertyId}/${photo.file}`}
                target="_blank"
                rel="noreferrer"
                title="Apri a schermo intero"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/foto/${propertyId}/${photo.file.replace(/\.jpg$/, "-min.jpg")}`}
                  alt=""
                  loading="lazy"
                  className="aspect-4/3 w-full rounded-md border border-slate-200 object-cover"
                />
              </a>

              {index === 0 ? (
                <span className="absolute top-1.5 left-1.5 rounded bg-brand-700/90 px-1.5 py-0.5 text-[11px] font-medium text-white">
                  copertina
                </span>
              ) : null}

              <div className="mt-1 flex items-center justify-between gap-2">
                {index > 0 ? (
                  <form action={setCoverPhoto}>
                    <input type="hidden" name="id" value={photo.id} />
                    <button type="submit" className="text-xs text-brand-700 hover:underline">
                      Metti per prima
                    </button>
                  </form>
                ) : (
                  <span />
                )}
                <form action={deletePhoto}>
                  <input type="hidden" name="id" value={photo.id} />
                  <ConfirmButton
                    message="Eliminare questa foto?"
                    variant="nudo"
                    className="text-xs text-red-600 hover:underline"
                  >
                    Elimina
                  </ConfirmButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">
          Nessuna foto. Caricale qui sotto: compariranno anche nell&apos;elenco immobili.
        </p>
      )}

      <form action={action} className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
        <input type="hidden" name="property_id" value={propertyId} />
        <div className="min-w-0 flex-1">
          <label className="field-label" htmlFor={`foto-${propertyId}`}>
            Aggiungi foto
          </label>
          <input
            id={`foto-${propertyId}`}
            name="foto"
            type="file"
            accept="image/*"
            multiple
            required
            className="field file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:text-slate-700"
          />
          <p className="mt-1 text-xs text-slate-400">
            Puoi sceglierne più d&apos;una in una volta. Dal telefono puoi anche scattarle sul
            momento: vengono rimpicciolite da sole.
          </p>
        </div>
        <SubmitButton pendingLabel="Caricamento…">Carica</SubmitButton>
      </form>

      {result ? (
        <div className="text-sm">
          {result.caricate > 0 ? (
            <p className="text-emerald-700">
              {result.caricate} {result.caricate === 1 ? "foto caricata" : "foto caricate"}.
            </p>
          ) : null}
          {result.errori.map((errore, index) => (
            <p key={index} className="text-amber-700">
              {errore}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
