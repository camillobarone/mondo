"use client";

import { useId, useState } from "react";

/** Valore riservato della tendina per «scrivo io». */
const ALTRO = "__altro__";

/**
 * Dove sta l'immobile: un comune, e dentro quel comune una zona.
 *
 * Le stesse liste che si usano nella richiesta del cliente. Finche' di qua si
 * scriveva a mano e di la' si sceglieva da un elenco, le due parti potevano non
 * incontrarsi mai: il confronto degli incroci e' tollerante — «S. Cataldo»
 * trova «San Cataldo» — ma su un immobile si poteva scrivere una zona che in
 * quel comune non esiste, e nessuno se ne accorgeva.
 *
 * **Il valore che l'immobile ha gia' resta sempre fra le opzioni**, anche
 * quando non e' in elenco. I 53 immobili in archivio hanno comune e zona
 * scritti a mano, spesso in forme come «LECCE (LE)»: una tendina che non li
 * contenesse li scollegherebbe al primo salvataggio, in silenzio. E' la stessa
 * trappola delle tendine troncate gia' pagata una volta qui dentro.
 */
export function LuogoImmobile({
  comuneIniziale,
  zonaIniziale,
  comuni,
  zonePerComune,
  zoneGiaUsate,
}: {
  comuneIniziale: string | null;
  zonaIniziale: string | null;
  comuni: readonly string[];
  zonePerComune: Record<string, readonly string[]>;
  /** Le zone gia' scritte in archivio: servono dove non ne conosciamo nessuna. */
  zoneGiaUsate: readonly string[];
}) {
  const comuneDiPartenza = (comuneIniziale ?? "").trim();
  const zonaDiPartenza = (zonaIniziale ?? "").trim();
  const id = useId();

  // Un comune fuori elenco non e' un errore da correggere: e' il dato che c'e'.
  const fuoriElenco =
    comuneDiPartenza && !comuni.some((c) => c.toLowerCase() === comuneDiPartenza.toLowerCase());
  const elencoComuni = fuoriElenco ? [comuneDiPartenza, ...comuni] : comuni;

  const [comune, setComune] = useState(comuneDiPartenza);
  const [comuneScritto, setComuneScritto] = useState("");
  const [zona, setZona] = useState(zonaDiPartenza);
  const [zonaScritta, setZonaScritta] = useState("");

  const comuneFinale = (comune === ALTRO ? comuneScritto : comune).trim();
  const zonaFinale = (zona === ALTRO ? zonaScritta : zona).trim();

  const chiave = Object.keys(zonePerComune).find(
    (c) => c.toLowerCase() === comuneFinale.toLowerCase(),
  );
  const zoneDelComune = chiave ? zonePerComune[chiave]! : [];
  // Dove non conosciamo le zone di quel comune, si propone almeno quello che
  // l'agenzia ha gia' scritto altrove: meglio di una tendina vuota.
  const proposte = zoneDelComune.length ? zoneDelComune : zoneGiaUsate;
  const zonaDaTenere =
    zonaDiPartenza && !proposte.some((z) => z.toLowerCase() === zonaDiPartenza.toLowerCase())
      ? [zonaDiPartenza]
      : [];
  const elencoZone = [...zonaDaTenere, ...proposte];

  return (
    <>
      {/* Quello che il server legge davvero. */}
      <input type="hidden" name="city" value={comuneFinale} />
      <input type="hidden" name="zone" value={zonaFinale} />

      <div>
        <label className="field-label" htmlFor={`${id}-comune`}>
          Comune
        </label>
        <select
          id={`${id}-comune`}
          value={comune}
          onChange={(evento) => {
            setComune(evento.target.value);
            // La zona apparteneva al comune di prima: tenerla vorrebbe dire
            // attaccarla al comune nuovo, dove magari non esiste.
            setZona("");
            setZonaScritta("");
          }}
          className="field"
        >
          <option value="">—</option>
          {elencoComuni.map((nome) => (
            <option key={nome} value={nome}>
              {nome}
            </option>
          ))}
          <option value={ALTRO}>Altro comune…</option>
        </select>
        {comune === ALTRO ? (
          <input
            value={comuneScritto}
            onChange={(evento) => setComuneScritto(evento.target.value)}
            placeholder="Fuori provincia di Lecce"
            className="field mt-2"
            aria-label="Quale comune"
          />
        ) : null}
      </div>

      <div>
        <label className="field-label" htmlFor={`${id}-zona`}>
          Zona o località
        </label>
        <select
          id={`${id}-zona`}
          value={zona}
          onChange={(evento) => setZona(evento.target.value)}
          className="field"
          disabled={!comuneFinale}
        >
          <option value="">{comuneFinale ? "—" : "Scegli prima il comune"}</option>
          {elencoZone.map((nome) => (
            <option key={nome} value={nome}>
              {nome}
            </option>
          ))}
          <option value={ALTRO}>Altra zona…</option>
        </select>
        {zona === ALTRO ? (
          <input
            value={zonaScritta}
            onChange={(evento) => setZonaScritta(evento.target.value)}
            placeholder="Contrada Santa Barbara"
            className="field mt-2"
            aria-label="Quale zona"
          />
        ) : null}
        {comuneFinale && !zoneDelComune.length ? (
          <p className="mt-1 text-xs text-slate-500">
            Per {comuneFinale} non abbiamo un elenco di zone: scegli fra quelle già usate o
            scrivine una con «Altra zona…».
          </p>
        ) : null}
      </div>
    </>
  );
}
