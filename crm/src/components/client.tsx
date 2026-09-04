"use client";

import { useFormStatus } from "react-dom";
import {
  createContext,
  useActionState,
  useContext,
  useState,
  type ReactNode,
} from "react";

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
  /** "nudo" toglie l'aspetto da pulsante: serve per i comandi minori. */
  variant?: "primary" | "secondary" | "danger" | "nudo";
  className?: string;
}) {
  const { pending } = useFormStatus();
  const style = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    danger: "btn-danger",
    nudo: "",
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

/* ------------------------------------------------- moduli che sanno dire di no */

/**
 * Il motivo per cui l'ultimo salvataggio e' stato rifiutato, da <ModuloConEsito>
 * a <AvvisoModulo>. Passa da un contesto e non da una proprieta' perche' in
 * mezzo ai due ci sono i campi, che restano componenti di server: una proprieta'
 * dovrebbe attraversarli uno per uno.
 */
const ContestoEsito = createContext<string | null>(null);

/**
 * Un modulo che, quando il server rifiuta il salvataggio, mostra il perche'
 * al posto della pagina di errore.
 *
 * Il rifiuto torna come **valore restituito** dall'azione (`useActionState`) e
 * non come eccezione. Cambia due cose:
 * - il testo arriva a schermo anche a programma pubblicato, dove Next non fa
 *   uscire dal server il messaggio di un errore lanciato;
 * - la pagina non cambia, quindi **quello che si era scritto resta nei campi**.
 *   Con un `throw` si perdeva tutto, e con un rimando all'indirizzo di prima
 *   pure: su una scheda immobile sono venticinque campi da riscrivere per un
 *   titolo dimenticato.
 *
 * I campi passano come `children` e restano componenti di server: qui dentro
 * diventa di client il solo involucro.
 */
export function ModuloConEsito({
  azione,
  className = "",
  children,
}: {
  azione: (precedente: string | null, dati: FormData) => Promise<string | null>;
  className?: string;
  children: ReactNode;
}) {
  const [errore, invia] = useActionState(azione, null);

  return (
    <ContestoEsito.Provider value={errore}>
      {/*
        `onReset` che rifiuta non e' un vezzo, e senza di lui meta' del lavoro
        qui sopra non servirebbe a niente.

        React, quando l'azione di un modulo finisce, **svuota da solo i campi**
        (chiama `form.reset()` sull'elemento). Ha senso per il modulo che
        aggiunge un commento, dove finito uno se ne comincia un altro; su una
        scheda immobile da venticinque campi rifiutata per un titolo mancante
        e' un disastro: il messaggio spiega cosa correggere e intanto non c'e'
        piu' niente da correggere. Fermare l'evento annulla lo svuotamento.

        Si perde solo un `<button type="reset">`, che in questo programma non
        esiste da nessuna parte. Dopo un salvataggio riuscito non cambia niente:
        li' si va altrove, e il modulo non c'e' piu'.

        Visto in browser: senza questa riga i campi tornavano vuoti a ogni
        rifiuto. Non se ne accorgono ne' TypeScript ne' `next build`.
      */}
      <form action={invia} onReset={(evento) => evento.preventDefault()} className={className}>
        {children}
      </form>
    </ContestoEsito.Provider>
  );
}

/**
 * Dove il rifiuto viene stampato. Lo decide il modulo, e la scelta giusta e'
 * **sopra i pulsanti**: e' li' che sta l'occhio di chi ha appena cliccato
 * Salva. In cima a un modulo lungo il messaggio comparirebbe fuori schermo, e
 * il salvataggio sembrerebbe non aver fatto niente.
 */
export function AvvisoModulo() {
  const errore = useContext(ContestoEsito);
  if (!errore) return null;

  return (
    <p
      role="alert"
      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
    >
      {errore}
    </p>
  );
}

/**
 * Casella di sola lettura con il pulsante per copiare: l'indirizzo e' lungo e
 * selezionarlo a mano sul telefono e' un supplizio.
 *
 * Stava nella cartella del calendario finche' a usarla era solo quella pagina.
 * Da quando c'e' anche il link del proprietario e' roba di due, e il posto di
 * un attrezzo usato da due pagine e' qui.
 */
export function CopyField({
  value,
  etichetta = "Indirizzo da copiare",
}: {
  value: string;
  etichetta?: string;
}) {
  const [copiato, setCopiato] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      <input
        readOnly
        value={value}
        onFocus={(event) => event.currentTarget.select()}
        className="field min-w-0 flex-1 font-mono text-xs"
        aria-label={etichetta}
      />
      <button
        type="button"
        className="btn-secondary shrink-0"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
          } catch {
            // Senza permesso per gli appunti resta la selezione manuale: la
            // casella e' gia' selezionata al tocco.
            return;
          }
          setCopiato(true);
          setTimeout(() => setCopiato(false), 2000);
        }}
      >
        {copiato ? "Copiato" : "Copia"}
      </button>
    </div>
  );
}
