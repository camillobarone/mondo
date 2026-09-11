"use client";

import { useEffect, useState } from "react";
import { iscriviQuestoTelefono, togliQuestoTelefono, provaAvviso } from "@/lib/actions";

/**
 * Accendere e spegnere gli avvisi **su questo telefono**.
 *
 * Il pezzo di client e' obbligatorio: il permesso alle notifiche lo puo'
 * chiedere solo il browser, e solo dopo un clic vero della persona. Chiederlo
 * al caricamento della pagina, oltre a essere sgarbato, su Chrome fa scattare
 * il rifiuto automatico — e da quel momento il pulsante non funziona piu'
 * finche' non si va a rimettere il permesso a mano nelle impostazioni.
 *
 * L'iscrizione vale per **questo** telefono e per **questo** browser: chi entra
 * dal telefono e dal computer li accende tutti e due, e li vede elencati.
 */

type Stato =
  | "controllo"      // si sta ancora guardando com'e' messo il browser
  | "non-sostenuto"  // questo browser gli avvisi non li sa fare
  | "ios-da-home"    // iPhone: prima va aggiunto alla schermata Home
  | "negato"         // il permesso e' stato rifiutato una volta per tutte
  | "spento"
  | "acceso";

export function AvvisiTelefono({ chiavePubblica }: { chiavePubblica: string }) {
  const [stato, setStato] = useState<Stato>("controllo");
  const [occupato, setOccupato] = useState(false);
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const [esito, setEsito] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        // Su iPhone il pacchetto degli avvisi compare **solo** quando il sito
        // e' stato aggiunto alla schermata Home: dal browser non c'e'. Quindi
        // qui non si dice "non si puo'", si dice cosa fare.
        setStato(daIphone() && !inSchermataHome() ? "ios-da-home" : "non-sostenuto");
        return;
      }
      if (Notification.permission === "denied") {
        setStato("negato");
        return;
      }
      const registrazione = await navigator.serviceWorker.getRegistration();
      const iscrizione = await registrazione?.pushManager.getSubscription();
      setStato(iscrizione ? "acceso" : "spento");
    })();
  }, []);

  async function accendi() {
    setOccupato(true);
    setMessaggio(null);
    setEsito(null);
    try {
      const permesso = await Notification.requestPermission();
      if (permesso !== "granted") {
        setStato(permesso === "denied" ? "negato" : "spento");
        setMessaggio("Il permesso non è stato dato, quindi gli avvisi restano spenti.");
        return;
      }

      const registrazione = await navigator.serviceWorker.register("/sw.js");
      // `ready` e non la registrazione appena tornata: alla prima installazione
      // il pezzetto non e' ancora in funzione, e chiedergli l'iscrizione subito
      // fallisce senza dire niente di utile.
      await navigator.serviceWorker.ready;

      const iscrizione = await registrazione.pushManager.subscribe({
        // Obbligatorio: un avviso silenzioso, senza niente da mostrare, i
        // browser non lo accettano piu'.
        userVisibleOnly: true,
        applicationServerKey: daBase64Url(chiavePubblica),
      });

      const dati = new FormData();
      const json = iscrizione.toJSON();
      dati.set("endpoint", iscrizione.endpoint);
      dati.set("p256dh", json.keys?.p256dh ?? "");
      dati.set("auth", json.keys?.auth ?? "");
      dati.set("device", nomeDelDispositivo());

      const errore = await iscriviQuestoTelefono(null, dati);
      if (errore) {
        setMessaggio(errore);
        return;
      }
      setStato("acceso");
      setMessaggio("Fatto. Da adesso l'avviso arriva su questo telefono.");
    } catch (errore) {
      setMessaggio(
        `Non è stato possibile accendere gli avvisi: ${
          errore instanceof Error ? errore.message : String(errore)
        }`,
      );
    } finally {
      setOccupato(false);
    }
  }

  async function spegni() {
    setOccupato(true);
    setMessaggio(null);
    setEsito(null);
    try {
      const registrazione = await navigator.serviceWorker.getRegistration();
      const iscrizione = await registrazione?.pushManager.getSubscription();
      if (iscrizione) {
        const dati = new FormData();
        dati.set("endpoint", iscrizione.endpoint);
        // Prima dal server, poi dal telefono: al contrario, se la seconda
        // fallisse resterebbe una riga che manda avvisi a un telefono che non
        // li vuole piu'.
        await togliQuestoTelefono(null, dati);
        await iscrizione.unsubscribe();
      }
      setStato("spento");
      setMessaggio("Avvisi spenti su questo telefono.");
    } finally {
      setOccupato(false);
    }
  }

  async function prova() {
    setOccupato(true);
    setEsito(null);
    setMessaggio(null);
    const errore = await provaAvviso(null);
    setEsito(errore ?? "Mandato. Se non arriva entro qualche secondo, qualcosa non va.");
    setOccupato(false);
  }

  if (stato === "controllo") {
    return <p className="text-sm text-slate-500">Sto guardando se questo telefono può…</p>;
  }

  if (stato === "ios-da-home") {
    return (
      <Avviso tono="ambra" titolo="Su iPhone serve un passaggio in più">
        Apri questa pagina in <strong>Safari</strong>, tocca il pulsante{" "}
        <strong>Condividi</strong> (il quadrato con la freccia in su) e scegli{" "}
        <strong>Aggiungi a Home</strong>. Poi apri il gestionale da quell&apos;icona e torna
        qui: il pulsante per accendere gli avvisi comparirà. È Apple a volerlo così — dal
        browser le notifiche non le manda.
      </Avviso>
    );
  }

  if (stato === "non-sostenuto") {
    return (
      <Avviso tono="grigio" titolo="Questo browser non sa fare gli avvisi">
        Provalo da <strong>Chrome</strong> su Android, o da Safari su iPhone dopo aver
        aggiunto il gestionale alla schermata Home. Intanto resta il pulsante{" "}
        <strong>Calendario</strong> sulla riga dell&apos;agenda.
      </Avviso>
    );
  }

  if (stato === "negato") {
    return (
      <Avviso tono="ambra" titolo="Gli avvisi sono stati bloccati su questo telefono">
        Il permesso è stato rifiutato, e da qui non si può più chiedere: lo decide il
        browser. Va rimesso a mano — nelle impostazioni del sito, alla voce{" "}
        <strong>Notifiche</strong> — e poi si ricarica questa pagina.
      </Avviso>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {stato === "acceso" ? (
          <>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800">
              ✓ Accesi su questo telefono
            </span>
            <button type="button" className="btn-secondary" onClick={prova} disabled={occupato}>
              Mandami una prova
            </button>
            <button type="button" className="btn-secondary" onClick={spegni} disabled={occupato}>
              Spegni qui
            </button>
          </>
        ) : (
          <button type="button" className="btn-primary" onClick={accendi} disabled={occupato}>
            {occupato ? "Un momento…" : "Accendi gli avvisi su questo telefono"}
          </button>
        )}
      </div>

      {messaggio ? <p className="text-sm text-slate-700">{messaggio}</p> : null}
      {esito ? (
        <p role="status" className="text-sm text-slate-700">
          {esito}
        </p>
      ) : null}
    </div>
  );
}

function Avviso({
  tono,
  titolo,
  children,
}: {
  tono: "ambra" | "grigio";
  titolo: string;
  children: React.ReactNode;
}) {
  const colori =
    tono === "ambra"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-slate-200 bg-slate-50 text-slate-700";
  return (
    <div className={`rounded-md border p-3 text-sm ${colori}`}>
      <p className="font-medium">{titolo}</p>
      <p className="mt-1">{children}</p>
    </div>
  );
}

/* ----------------------------------------------------------- utilita' */

/**
 * La chiave pubblica va data al browser come byte, non come testo. E' la
 * conversione che tutti sbagliano una volta: `atob` non regge il base64url,
 * dove «-» e «_» stanno al posto di «+» e «/» e il riempimento non c'e'.
 */
function daBase64Url(valore: string): Uint8Array<ArrayBuffer> {
  const riempito = (valore + "=".repeat((4 - (valore.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const grezzo = atob(riempito);
  // Il buffer si crea a mano perche' `Uint8Array.from` lascia il tipo generico
  // e `applicationServerKey` vuole proprio un ArrayBuffer, non uno condiviso.
  const byte = new Uint8Array(new ArrayBuffer(grezzo.length));
  for (let i = 0; i < grezzo.length; i++) byte[i] = grezzo.charCodeAt(i);
  return byte;
}

/** Un nome per riconoscere il telefono nell'elenco, senza pretese. */
function nomeDelDispositivo(): string {
  const ua = navigator.userAgent;
  const sistema = /iPhone|iPad/.test(ua)
    ? "iPhone"
    : /Android/.test(ua)
      ? /SM-|Samsung/i.test(ua)
        ? "Samsung"
        : /Xiaomi|Redmi|POCO|MIUI/i.test(ua)
          ? "Xiaomi"
          : "Android"
      : /Macintosh/.test(ua)
        ? "Mac"
        : /Windows/.test(ua)
          ? "Windows"
          : "Dispositivo";
  const browser = /CriOS|Chrome/.test(ua)
    ? "Chrome"
    : /Firefox/.test(ua)
      ? "Firefox"
      : /Safari/.test(ua)
        ? "Safari"
        : "browser";
  return `${sistema} · ${browser}`;
}

function daIphone(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

/** Vero se il gestionale e' stato aperto dall'icona della schermata Home. */
function inSchermataHome(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Il modo di Apple, che non segue lo standard.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
