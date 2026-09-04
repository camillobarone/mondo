import Link from "next/link";
import type { ReactNode } from "react";

/* ------------------------------------------------------------------ testata */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ schede */

export function Card({
  title,
  actions,
  children,
  className = "",
  bodyClassName = "p-4",
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title ? (
        <header className="card-head">
          <h2 className="card-title">{title}</h2>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {hint ? <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">{hint}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ campi */

export function Field({
  label,
  name,
  children,
  hint,
  className = "",
}: {
  label: string;
  name?: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="field-label" htmlFor={name}>
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function TextField({
  label,
  name,
  defaultValue,
  type = "text",
  required,
  placeholder,
  hint,
  className = "",
  step,
  min,
  autoComplete,
  pattern,
  title,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  className?: string;
  step?: string;
  min?: string;
  /**
   * Cosa puo' metterci dentro da solo il browser. Serve quasi solo nella pagina
   * Utenti: li' il modulo somiglia a una schermata di accesso e Chrome ci
   * ribalta dentro le credenziali che ha in memoria.
   */
  autoComplete?: string;
  /**
   * Forma che il valore deve avere, controllata dal browser prima di inviare.
   *
   * E' la prima delle due difese: ferma lo sbaglio accanto al campo, senza far
   * partire niente. La seconda e' il server, che ormai il motivo del rifiuto
   * lo sa restituire (`<ModuloConEsito>` in `components/client.tsx`) invece di
   * lanciare un errore che a programma pubblicato diventava una pagina di
   * guasto muta. Tenerle tutte e due e' giusto: il browser si puo' aggirare,
   * il server no.
   */
  pattern?: string;
  /** Il messaggio che il browser mostra quando il valore non rispetta pattern. */
  title?: string;
}) {
  return (
    <Field label={label} name={name} hint={hint} className={className}>
      <input
        id={name}
        name={name}
        type={type}
        step={step}
        min={min}
        required={required}
        pattern={pattern}
        title={title}
        placeholder={placeholder}
        autoComplete={autoComplete}
        defaultValue={defaultValue ?? ""}
        className="field"
      />
    </Field>
  );
}

export function TextArea({
  label,
  name,
  defaultValue,
  rows = 4,
  placeholder,
  className = "",
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  rows?: number;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Field label={label} name={name} className={className}>
      <textarea
        id={name}
        name={name}
        rows={rows}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
        className="field resize-y"
      />
    </Field>
  );
}

/**
 * Campo libero con suggerimenti: si sceglie dall'elenco o si scrive quello
 * che non c'e'. Serve per le zone, dove ogni comune ha i suoi nomi e una
 * tendina chiusa lascerebbe fuori meta' del Salento.
 */
export function ComboField({
  label,
  name,
  options,
  defaultValue,
  placeholder,
  hint,
  className = "",
}: {
  label: string;
  name: string;
  options: readonly string[];
  defaultValue?: string | null;
  placeholder?: string;
  hint?: string;
  className?: string;
}) {
  const listId = `${name}-suggerimenti`;

  return (
    <Field label={label} name={name} hint={hint} className={className}>
      <input
        id={name}
        name={name}
        list={listId}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
        className="field"
        autoComplete="off"
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </Field>
  );
}

export type Option = { value: string; label: string };

export function SelectField({
  label,
  name,
  options,
  defaultValue,
  placeholder = "—",
  required,
  className = "",
  hint,
}: {
  label: string;
  name: string;
  options: readonly Option[] | readonly string[];
  defaultValue?: string | number | null;
  placeholder?: string | null;
  required?: boolean;
  className?: string;
  hint?: string;
}) {
  const normalised: Option[] = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );

  // Un valore fuori vocabolario (tipico dell'archivio importato: una
  // "masseria" che non sta nella tendina) deve restare visibile e salvabile.
  // Senza questa option il select ripiegherebbe sul segnaposto vuoto, e al
  // primo salvataggio della scheda il valore sparirebbe in silenzio.
  const attuale =
    defaultValue === null || defaultValue === undefined ? "" : String(defaultValue);
  if (attuale && !normalised.some((option) => String(option.value) === attuale)) {
    normalised.unshift({ value: attuale, label: attuale });
  }

  return (
    <Field label={label} name={name} className={className} hint={hint}>
      <select
        id={name}
        name={name}
        required={required}
        defaultValue={attuale}
        className="field"
      >
        {placeholder !== null ? <option value="">{placeholder}</option> : null}
        {normalised.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function CheckboxRow({
  label,
  name,
  defaultChecked,
  hint,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 py-1.5">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      />
      <span>
        <span className="text-sm text-slate-700">{label}</span>
        {hint ? <span className="block text-xs text-slate-400">{hint}</span> : null}
      </span>
    </label>
  );
}

/** Gruppo di caselle che producono un unico campo CSV (es. ruoli del cliente). */
export function CheckboxGroup({
  label,
  name,
  options,
  selected = [],
  columns = 3,
  capitalizza = true,
}: {
  label: string;
  name: string;
  options: readonly string[];
  selected?: string[];
  columns?: 2 | 3 | 4;
  /**
   * Iniziale maiuscola su ogni parola. Va bene per i vocabolari scritti in
   * minuscolo ("ascensore", "box"), ma rovina i nomi gia' scritti come vanno:
   * "Villetta a schiera" diventerebbe "Villetta A Schiera".
   */
  capitalizza?: boolean;
}) {
  // Le classi Tailwind devono essere letterali: niente interpolazione.
  const grid = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4" }[columns];

  return (
    <fieldset>
      <legend className="field-label">{label}</legend>
      <div className={`grid gap-x-4 gap-y-1 ${grid}`}>
        {options.map((option) => (
          <label key={option} className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              name={name}
              value={option}
              defaultChecked={selected.includes(option)}
              className="size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className={`text-sm text-slate-700 ${capitalizza ? "capitalize" : ""}`}>
              {option}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/* ------------------------------------------------------------------ stati */

const TONES: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-800",
  blue: "bg-sky-100 text-sky-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
  slate: "bg-slate-200 text-slate-700",
  brand: "bg-brand-100 text-brand-800",
  violet: "bg-violet-100 text-violet-800",
};

export function Chip({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: keyof typeof TONES | string;
}) {
  return <span className={`chip ${TONES[tone] ?? TONES.slate}`}>{children}</span>;
}

const CLIENT_STATUS_TONE: Record<string, string> = {
  attivo: "green",
  in_trattativa: "blue",
  dormiente: "amber",
  chiuso: "slate",
  non_interessato: "red",
};

const PROPERTY_STATUS_TONE: Record<string, string> = {
  acquisizione: "amber",
  in_vendita: "green",
  proposta: "blue",
  compromesso: "violet",
  venduto: "slate",
  ritirato: "red",
};

const REQUIREMENT_STATUS_TONE: Record<string, string> = {
  aperta: "green",
  pausa: "amber",
  soddisfatta: "blue",
  persa: "slate",
};

const OFFER_STATUS_TONE: Record<string, string> = {
  in_attesa: "amber",
  accettata: "green",
  rifiutata: "red",
  ritirata: "slate",
};

export function StatusChip({
  value,
  kind,
}: {
  value: string;
  kind: "client" | "property" | "requirement" | "offer";
}) {
  const map = {
    client: CLIENT_STATUS_TONE,
    property: PROPERTY_STATUS_TONE,
    requirement: REQUIREMENT_STATUS_TONE,
    offer: OFFER_STATUS_TONE,
  }[kind];

  return <Chip tone={map[value] ?? "slate"}>{value.replace(/_/g, " ")}</Chip>;
}

/* ------------------------------------------------------------------ varie */

export function Stat({
  label,
  value,
  href,
  tone = "slate",
}: {
  label: string;
  value: ReactNode;
  href?: string;
  tone?: "slate" | "amber" | "green" | "red";
}) {
  const accent = {
    slate: "text-slate-900",
    amber: "text-amber-600",
    green: "text-emerald-600",
    red: "text-red-600",
  }[tone];

  const body = (
    <div className="card px-4 py-3 transition hover:border-brand-300">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accent}`}>{value}</p>
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

/** Coppia etichetta/valore per le schede di dettaglio. */
export function DataRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5 text-sm">
      <dt className="w-40 shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 flex-1 text-slate-800">{children ?? "—"}</dd>
    </div>
  );
}

/** Paginazione: conserva i filtri gia' applicati nell'indirizzo. */
export function Pagination({
  page,
  pages,
  total,
  params,
  basePath,
}: {
  page: number;
  pages: number;
  total: number;
  params: Record<string, string | undefined>;
  basePath: string;
}) {
  if (pages <= 1) {
    return (
      <p className="px-4 py-3 text-xs text-slate-500">
        {total} {total === 1 ? "risultato" : "risultati"}
      </p>
    );
  }

  const link = (target: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page") query.set(key, value);
    }
    query.set("page", String(target));
    return `${basePath}?${query.toString()}`;
  };

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <p className="text-xs text-slate-500">
        Pagina {page} di {pages} · {total} risultati
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={link(page - 1)} className="btn-secondary px-2.5 py-1 text-xs">
            Precedente
          </Link>
        ) : null}
        {page < pages ? (
          <Link href={link(page + 1)} className="btn-secondary px-2.5 py-1 text-xs">
            Successiva
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function Banner({
  tone = "amber",
  children,
}: {
  tone?: "amber" | "red" | "green" | "blue";
  children: ReactNode;
}) {
  const styles = {
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-red-200 bg-red-50 text-red-900",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
    blue: "border-sky-200 bg-sky-50 text-sky-900",
  }[tone];

  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${styles}`} role="status">
      {children}
    </div>
  );
}

/* ------------------------------------------------- schermate di messaggio */

/**
 * La schermata che resta quando non c'e' niente da mostrare: una pagina che
 * non esiste, un guasto del programma.
 *
 * Sta qui e non dentro le pagine che la usano perche' quelle sono quattro
 * (`error.tsx` e `not-found.tsx`, una coppia dentro il programma e una
 * fuori) e devono somigliarsi: sono la stessa brutta notizia data in punti
 * diversi. Non ha ganci al database ne' stato, cosi' la puo' chiamare anche
 * un componente di client come `error.tsx`, che di server non puo' essere.
 */
export function PaginaMessaggio({
  titolo,
  children,
  azioni,
  codice,
}: {
  titolo: string;
  children: ReactNode;
  azioni?: ReactNode;
  /** Il codice interno del guasto: serve a ritrovarlo nel registro del server. */
  codice?: string;
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-lg font-semibold text-slate-900">{titolo}</h1>
      <div className="mt-2 text-sm text-slate-600">{children}</div>
      {azioni ? <div className="mt-6 flex justify-center gap-3">{azioni}</div> : null}
      {codice ? (
        <p className="mt-8 text-xs text-slate-400">
          Codice del guasto: <code className="font-mono">{codice}</code>
        </p>
      ) : null}
    </div>
  );
}
