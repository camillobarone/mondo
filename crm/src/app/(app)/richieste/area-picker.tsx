"use client";

import { useId, useState } from "react";
import type { Area } from "@/lib/aree";

/**
 * Dove cerca il cliente: un comune per volta, con le sue zone.
 *
 * Prima c'erano un campo libero per il comune e una griglia di zone valida per
 * tutti i comuni insieme. Chi cerca "a Lecce in centro oppure a Porto Cesareo
 * a Torre Lapillo" spuntava quattro caselle e il programma non sapeva piu'
 * quale zona appartenesse a quale comune: bastava questo per proporgli il
 * centro di Porto Cesareo.
 *
 * Qui si sceglie un comune, compaiono le sue zone, si conferma l'area — e da
 * quel momento si puo' ricominciare con un altro comune. Le aree confermate
 * restano in elenco e si tolgono una per una.
 */
export function AreaPicker({
  iniziali,
  comuni,
  zonePerComune,
}: {
  iniziali: Area[];
  comuni: readonly string[];
  zonePerComune: Record<string, readonly string[]>;
}) {
  const [aree, setAree] = useState<Area[]>(iniziali);
  const [comune, setComune] = useState("");
  const [altroComune, setAltroComune] = useState("");
  const [zone, setZone] = useState<string[]>([]);
  const [altreZone, setAltreZone] = useState("");
  const id = useId();

  const fuoriElenco = comune === ALTRO;
  const comuneScelto = (fuoriElenco ? altroComune : comune).trim();
  const zoneDisponibili = zonePerComune[comune] ?? [];

  const zoneScelte = [
    ...new Set([...zone, ...altreZone.split(",").map((z) => z.trim()).filter(Boolean)]),
  ];

  /**
   * Quello che finisce davvero nel modulo: le aree confermate piu' quella
   * ancora aperta.
   *
   * L'area aperta si porta dietro di proposito. Chi sceglie il comune, spunta
   * le zone e poi preme «Salva richiesta» senza passare da «Aggiungi» ha detto
   * tutto quello che doveva: perdergli la scelta perche' non ha premuto il
   * pulsante giusto sarebbe un dato buttato via in silenzio, e se ne
   * accorgerebbe solo mesi dopo, dagli incroci che non arrivano.
   */
  const daSalvare = comuneScelto
    ? [...aree.filter((a) => !stessoComune(a.comune, comuneScelto)), { comune: comuneScelto, zone: zoneScelte }]
    : aree;

  function aggiungi() {
    if (!comuneScelto) return;
    setAree(daSalvare);
    setComune("");
    setAltroComune("");
    setZone([]);
    setAltreZone("");
  }

  function togli(indice: number) {
    setAree((precedenti) => precedenti.filter((_, i) => i !== indice));
  }

  return (
    <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
      <legend className="field-label px-1">Dove cerca</legend>

      {/* Il json e' l'unica cosa che il server legge davvero. */}
      <input type="hidden" name="areas" value={JSON.stringify(daSalvare)} />

      {aree.length > 0 ? (
        <ul className="space-y-2">
          {aree.map((area, indice) => (
            <li
              key={`${area.comune}-${indice}`}
              className="flex items-start justify-between gap-3 rounded-md bg-slate-50 px-3 py-2"
            >
              <span className="text-sm">
                <strong className="text-slate-800">{area.comune || "Comune non indicato"}</strong>
                <span className="text-slate-600">
                  {area.zone.length ? ` — ${area.zone.join(", ")}` : " — tutto il comune"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => togli(indice)}
                className="shrink-0 text-sm font-medium text-slate-500 hover:text-red-600"
              >
                Togli
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">
          Nessuna zona indicata: la richiesta incrocia in qualsiasi comune.
        </p>
      )}

      <div className="space-y-3 border-t border-slate-200 pt-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor={`${id}-comune`}>
              {aree.length ? "Aggiungi un altro comune" : "Comune"}
            </label>
            <select
              id={`${id}-comune`}
              value={comune}
              onChange={(evento) => {
                setComune(evento.target.value);
                // Le zone sono di quel comune: cambiando comune non hanno piu'
                // senso, e lasciarle spuntate le attaccherebbe al comune nuovo.
                setZone([]);
              }}
              className="field"
            >
              <option value="">Scegli un comune…</option>
              {comuni.map((nome) => (
                <option key={nome} value={nome}>
                  {nome}
                </option>
              ))}
              <option value={ALTRO}>Altro comune…</option>
            </select>
          </div>

          {fuoriElenco ? (
            <div>
              <label className="field-label" htmlFor={`${id}-altro`}>
                Quale comune
              </label>
              <input
                id={`${id}-altro`}
                value={altroComune}
                onChange={(evento) => setAltroComune(evento.target.value)}
                placeholder="Fuori provincia di Lecce"
                className="field"
              />
            </div>
          ) : null}
        </div>

        {comuneScelto ? (
          <div className="space-y-2">
            {zoneDisponibili.length ? (
              <div>
                <span className="field-label">Zone di {comuneScelto}</span>
                <div className="grid gap-x-4 gap-y-1 sm:grid-cols-3">
                  {zoneDisponibili.map((nome) => (
                    <label key={nome} className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={zone.includes(nome)}
                        onChange={(evento) =>
                          setZone((precedenti) =>
                            evento.target.checked
                              ? [...precedenti, nome]
                              : precedenti.filter((z) => z !== nome),
                          )
                        }
                        className="size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="text-sm text-slate-700">{nome}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Nessuna spuntata vuol dire tutto il comune.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Per {comuneScelto} non abbiamo un elenco di zone: scrivile qui sotto, se servono.
              </p>
            )}

            <div>
              <label className="field-label" htmlFor={`${id}-altre`}>
                Altre zone
              </label>
              <input
                id={`${id}-altre`}
                value={altreZone}
                onChange={(evento) => setAltreZone(evento.target.value)}
                placeholder="Contrada Santa Barbara, zona ospedale"
                className="field"
              />
              <p className="mt-1 text-xs text-slate-500">
                Quelle che non trovi sopra, separate da una virgola.
              </p>
            </div>

            <button type="button" onClick={aggiungi} className="btn-secondary">
              Aggiungi {comuneScelto}
              {zoneScelte.length ? ` (${zoneScelte.length} zone)` : ""}
            </button>
          </div>
        ) : null}
      </div>
    </fieldset>
  );
}

/** Valore riservato della tendina per il comune scritto a mano. */
const ALTRO = "__altro__";

const stessoComune = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();
