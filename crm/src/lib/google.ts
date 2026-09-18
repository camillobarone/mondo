/**
 * Google Calendar: il collegamento vero, non l'abbonamento.
 *
 * **Perche' esiste.** L'abbonamento iCalendar (`calendar.ts`) funziona e resta,
 * ma Google ricontrolla quei calendari quando decide lui — ore, a volte un
 * giorno — e ignora il `REFRESH-INTERVAL` che il file gli chiede. Camillo lo ha
 * verificato di persona: per vedere un appuntamento nuovo doveva togliere il
 * calendario da Google e rimetterlo. Da qui la scelta, sua, del 15 settembre
 * 2026: scrivere gli appuntamenti **dentro** Google con le sue API, dove
 * compaiono subito.
 *
 * **Come e' fatto, e perche' cosi'.**
 *
 * - **Una sola autorizzazione, quella del titolare.** Il gestionale crea dentro
 *   il suo Google un calendario per ogni persona («Agenda Roberto Lefons») e ci
 *   scrive gli appuntamenti di quella persona. Tre autorizzazioni sarebbero
 *   state tre giri di schermate di consenso, e i collaboratori un account
 *   Google non e' detto che lo vogliano.
 * - **Lo scopo e' `calendar.app.created`**, non `calendar`. Vuol dire: il
 *   gestionale puo' creare calendari suoi e gestire quelli, e **non puo'
 *   toccare il calendario personale di chi autorizza**. E' la differenza fra
 *   «questo programma puo' scrivere nella tua agenda» e «questo programma puo'
 *   leggere e cancellare tutta la tua agenda», e sulla schermata di consenso si
 *   legge. Se un giorno Google lo rifiutasse, la riga da cambiare e' una sola
 *   ed e' qui sotto — ma allora si concede molto di piu', e va detto a voce.
 * - **Niente dipendenze nuove**, come il lettore Excel, il generatore
 *   iCalendar e il protocollo Web Push: `fetch` e `node:crypto` bastano.
 *   `googleapis` porterebbe dentro qualche centinaio di pacchetti per fare
 *   quattro chiamate HTTP.
 *
 * **Quello che da qui non si e' potuto verificare:** la rete verso Google e'
 * chiusa nelle sessioni di sviluppo. Tutto quello che sta sotto e' provato
 * contro un finto Google che risponde come dice la documentazione — il giro
 * completo, i rinnovi, gli errori — ma il primo collegamento vero lo vede lui.
 * Se qualcosa non torna, il posto dove guardare e' `descriviErrore` in fondo.
 */

import { impostazione, scriviImpostazioni, cancellaImpostazioni } from "./queries";

/* ------------------------------------------------------------- costanti */

/**
 * Gli indirizzi di Google.
 *
 * `GOOGLE_FINTO_BASE` li sposta tutti altrove, e **esiste solo per poter
 * provare questo file**: dalle sessioni di sviluppo la rete verso Google e'
 * chiusa, e senza questa variabile l'unica verifica possibile sarebbe
 * rileggere il codice e sperare. In esercizio non si imposta, e allora si va
 * su Google — se un giorno la si trovasse scritta in `/etc/mondo-crm.env`,
 * qualcuno sta dirottando i consensi e va tolta.
 */
const FINTO = process.env.GOOGLE_FINTO_BASE;

/** Dove si manda la persona a dare il consenso. */
const AUTORIZZA = FINTO ? `${FINTO}/auth` : "https://accounts.google.com/o/oauth2/v2/auth";
/** Dove si scambia il codice con i token, e dove si rinnova. */
const TOKEN = FINTO ? `${FINTO}/token` : "https://oauth2.googleapis.com/token";
/** La radice delle chiamate al calendario. */
const API = FINTO ? `${FINTO}/calendar/v3` : "https://www.googleapis.com/calendar/v3";
/** Dove si dice a Google di dimenticare il collegamento. */
const REVOCA = FINTO ? `${FINTO}/revoke` : "https://oauth2.googleapis.com/revoke";

/**
 * Quanto si aspetta Google prima di lasciar perdere.
 *
 * Serve perche' queste chiamate partono **dentro il salvataggio di un
 * appuntamento**: senza un limite, una rete che non risponde terrebbe la
 * pagina appesa finche' il browser non si stanca, e chi ha premuto Salva non
 * saprebbe se ha salvato. Dieci secondi sono larghi per una chiamata che ne
 * impiega meno di uno.
 */
const ATTESA_MASSIMA = 10_000;

/**
 * I permessi che si chiedono.
 *
 * - **`calendar.app.created`** — vedi il commento in cima: tiene il gestionale
 *   fuori dall'agenda personale di chi autorizza.
 * - **`openid email`** — serve a una cosa sola, e non e' un vezzo: **sapere con
 *   quale account si e' collegato**, per poterlo scrivere sulla pagina. Il 16
 *   settembre 2026 Camillo ha autorizzato con un account e ha cercato i
 *   calendari in un altro, e ci sono volute due ore per capirlo, perche' da
 *   nessuna parte c'era scritto quale dei due fosse. Non da' nessun accesso
 *   alla posta: `email` restituisce l'indirizzo e basta.
 */
export const AMBITO = "https://www.googleapis.com/auth/calendar.app.created openid email";

/**
 * Il fuso con cui si scrivono gli orari. Gli appuntamenti sono ore lette
 * sull'orologio, non istanti assoluti: e' la stessa ragione per cui i file
 * iCalendar portano `TZID=Europe/Rome` invece di passare da `Date`.
 */
const FUSO = "Europe/Rome";

/* --------------------------------------------------------------- errori */

/** Un guasto di cui si sa dire qualcosa a chi guarda lo schermo. */
export class ErroreGoogle extends Error {
  /** Vero quando il collegamento e' saltato e va rifatto a mano. */
  readonly daRicollegare: boolean;

  constructor(messaggio: string, daRicollegare = false) {
    super(messaggio);
    this.name = "ErroreGoogle";
    this.daRicollegare = daRicollegare;
  }
}

/* ---------------------------------------------------- le chiavi di Google

   Client id e segreto arrivano dal pannello di Google Cloud e si incollano in
   una pagina del gestionale, non in un file sul server. E' una scelta, non una
   scorciatoia: questo progetto si e' gia' fermato una volta su una riga da
   scrivere in `nano`, e le variabili d'ambiente restano comunque prioritarie
   per chi un giorno volesse spostarle fuori.                                */

export interface ChiaviGoogle {
  clientId: string;
  clientSecret: string;
}

export function chiaviGoogle(): ChiaviGoogle | null {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? impostazione("google_client_id");
  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET ?? impostazione("google_client_secret");
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** C'e' un collegamento vivo? (chiavi messe **e** consenso dato) */
export function googleCollegato(): boolean {
  return Boolean(chiaviGoogle() && impostazione("google_refresh_token"));
}

/* ------------------------------------------------------------- consenso */

/**
 * L'indirizzo a cui mandare il titolare per dare il consenso.
 *
 * Tre parametri non sono decorativi e vanno lasciati dove sono:
 * - **`access_type=offline`**: senza, Google manda solo un permesso che scade
 *   in un'ora e nessun `refresh_token`. Il collegamento smetterebbe di
 *   funzionare da solo dopo pranzo, e nessuno capirebbe perche'.
 * - **`prompt=consent`**: Google il `refresh_token` lo manda **una volta
 *   sola**, alla prima autorizzazione. Se si ricollega dopo aver cancellato il
 *   nostro, senza questo non ne arriverebbe un altro e resteremmo a mani
 *   vuote con la schermata che dice «fatto».
 * - **`state`**: il gettone contro le richieste costruite da terzi. Torna
 *   indietro con la risposta e va confrontato con quello messo da parte.
 */
export function indirizzoConsenso(redirectUri: string, state: string): string {
  const chiavi = chiaviGoogle();
  if (!chiavi) throw new ErroreGoogle("Mancano il Client ID e il segreto di Google.");

  const parametri = new URLSearchParams({
    client_id: chiavi.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: AMBITO,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTORIZZA}?${parametri}`;
}

interface RispostaToken {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  /** Il biglietto firmato che contiene, fra le altre cose, l'indirizzo. */
  id_token?: string;
  error?: string;
  error_description?: string;
}

/**
 * L'indirizzo dell'account che ha autorizzato, letto dall'`id_token`.
 *
 * **La firma non viene verificata, ed e' una scelta consapevole:** quel
 * biglietto non arriva da un browser ne' da un utente, arriva dalla risposta
 * di `oauth2.googleapis.com` a una chiamata che abbiamo fatto noi, su TLS,
 * autenticandoci col nostro segreto. Non c'e' nessuno in mezzo che possa
 * averlo sostituito. E soprattutto: **serve solo a scrivere un indirizzo a
 * schermo**, non decide nessun accesso. Se un giorno servisse a decidere
 * qualcosa, la firma andrebbe verificata — e allora questo commento va
 * riletto.
 */
function indirizzoDalBiglietto(idToken: string | undefined): string | null {
  if (!idToken) return null;
  const mezzo = idToken.split(".")[1];
  if (!mezzo) return null;
  try {
    const dati = JSON.parse(Buffer.from(mezzo, "base64url").toString("utf8")) as {
      email?: string;
    };
    return dati.email ?? null;
  } catch {
    return null;
  }
}

async function chiediToken(corpo: Record<string, string>): Promise<RispostaToken> {
  let risposta: Response;
  try {
    risposta = await fetch(TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(corpo).toString(),
      signal: AbortSignal.timeout(ATTESA_MASSIMA),
    });
  } catch (errore) {
    throw new ErroreGoogle(`Google non risponde: ${(errore as Error).message}`);
  }

  const dati = (await risposta.json().catch(() => ({}))) as RispostaToken;
  if (!risposta.ok || dati.error) {
    throw new ErroreGoogle(
      descriviErrore(risposta.status, dati.error, dati.error_description),
      // `invalid_grant` vuol dire che il permesso non vale piu': password
      // cambiata, accesso tolto a mano, o troppo tempo senza usarlo. L'unica
      // cura e' ridare il consenso.
      dati.error === "invalid_grant",
    );
  }
  return dati;
}

/**
 * Primo giro: il codice che Google ha rimandato indietro diventa un permesso
 * duraturo. Restituisce il `refresh_token`, che e' l'unica cosa da conservare.
 */
export async function scambiaCodice(
  codice: string,
  redirectUri: string,
): Promise<{
  refreshToken: string;
  accessToken: string;
  scadenza: number;
  account: string | null;
}> {
  const chiavi = chiaviGoogle();
  if (!chiavi) throw new ErroreGoogle("Mancano il Client ID e il segreto di Google.");

  const dati = await chiediToken({
    code: codice,
    client_id: chiavi.clientId,
    client_secret: chiavi.clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  if (!dati.refresh_token) {
    // Succede quando quell'account aveva gia' autorizzato e `prompt=consent`
    // non e' arrivato. Il messaggio dice cosa fare, perche' la via d'uscita
    // non e' nel gestionale: sta nella pagina dei permessi di Google.
    throw new ErroreGoogle(
      "Google non ha mandato il permesso duraturo. Togli l'accesso al gestionale da " +
        "myaccount.google.com/permissions e rifai il collegamento.",
    );
  }

  return {
    refreshToken: dati.refresh_token,
    accessToken: dati.access_token ?? "",
    scadenza: Date.now() + (dati.expires_in ?? 3600) * 1000,
    account: indirizzoDalBiglietto(dati.id_token),
  };
}

/** Con quale account di Google siamo collegati, se lo sappiamo. */
export function accountGoogle(): string | null {
  return impostazione("google_account");
}

/**
 * Il permesso buono per chiamare, rinnovato se serve.
 *
 * Il permesso breve dura un'ora e si tiene da parte per non chiederne uno a
 * ogni salvataggio. Il margine di un minuto evita il caso in cui il permesso
 * scade **fra** il controllo e la chiamata: sarebbe un 401 ogni tanto,
 * impossibile da riprodurre.
 */
async function permesso(): Promise<string> {
  const chiavi = chiaviGoogle();
  if (!chiavi) throw new ErroreGoogle("Mancano il Client ID e il segreto di Google.");

  const refresh = impostazione("google_refresh_token");
  if (!refresh) throw new ErroreGoogle("Google non e' collegato.", true);

  const salvato = impostazione("google_access_token");
  const scadenza = Number(impostazione("google_token_expires") ?? 0);
  if (salvato && scadenza > Date.now() + 60_000) return salvato;

  const dati = await chiediToken({
    refresh_token: refresh,
    client_id: chiavi.clientId,
    client_secret: chiavi.clientSecret,
    grant_type: "refresh_token",
  });
  if (!dati.access_token) throw new ErroreGoogle("Google non ha mandato il permesso.", true);

  scriviImpostazioni({
    google_access_token: dati.access_token,
    google_token_expires: String(Date.now() + (dati.expires_in ?? 3600) * 1000),
  });
  return dati.access_token;
}

/** Scollega: si dice a Google di dimenticare, poi si cancella da qui. */
export async function scollega(): Promise<void> {
  const refresh = impostazione("google_refresh_token");
  if (refresh) {
    // Se Google non risponde si cancella lo stesso: tenersi un permesso che
    // non si vuole piu' e' peggio che lasciarlo appeso dalla parte di Google,
    // dove comunque si toglie da myaccount.google.com/permissions.
    await fetch(`${REVOCA}?token=${encodeURIComponent(refresh)}`, {
      method: "POST",
      signal: AbortSignal.timeout(ATTESA_MASSIMA),
    }).catch(() => undefined);
  }
  cancellaImpostazioni([
    "google_refresh_token",
    "google_access_token",
    "google_token_expires",
    "google_account",
  ]);
}

/* ------------------------------------------------------- le chiamate vere */

async function chiama<T>(
  metodo: string,
  percorso: string,
  corpo?: unknown,
): Promise<T | null> {
  const token = await permesso();

  let risposta: Response;
  try {
    risposta = await fetch(`${API}${percorso}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(corpo ? { "Content-Type": "application/json" } : {}),
      },
      ...(corpo ? { body: JSON.stringify(corpo) } : {}),
      signal: AbortSignal.timeout(ATTESA_MASSIMA),
    });
  } catch (errore) {
    throw new ErroreGoogle(`Google non risponde: ${(errore as Error).message}`);
  }

  // Cancellare qualcosa che non c'e' piu' non e' un guasto: e' il risultato
  // che si voleva. Capita quando l'evento e' stato tolto a mano da Google.
  if (risposta.status === 404 || risposta.status === 410) return null;
  if (risposta.status === 204) return null;

  const dati = (await risposta.json().catch(() => ({}))) as {
    error?: { message?: string; status?: string };
  } & T;

  if (!risposta.ok) {
    throw new ErroreGoogle(
      descriviErrore(risposta.status, dati.error?.status, dati.error?.message),
      risposta.status === 401,
    );
  }
  return dati;
}

/**
 * Crea dentro il Google del titolare il calendario di una persona e ne
 * restituisce l'identificativo.
 *
 * Il fuso si scrive alla creazione: senza, Google userebbe quello dell'account
 * — che per un telefono comprato altrove puo' non essere l'Italia — e gli
 * appuntamenti comparirebbero spostati di ore senza che nulla sembri rotto.
 */
export async function creaCalendario(nome: string): Promise<string> {
  const creato = await chiama<{ id?: string }>("POST", "/calendars", {
    summary: nome,
    description:
      "Creato dal gestionale di Mondo Immobiliare. Gli appuntamenti si " +
      "aggiungono e si modificano dal gestionale.",
    timeZone: FUSO,
  });
  if (!creato?.id) throw new ErroreGoogle("Google non ha detto quale calendario ha creato.");
  return creato.id;
}

/** C'e' ancora? Un calendario cancellato a mano da Google va ricreato. */
export async function calendarioEsiste(calendarId: string): Promise<boolean> {
  const trovato = await chiama<{ id?: string }>(
    "GET",
    `/calendars/${encodeURIComponent(calendarId)}`,
  );
  return Boolean(trovato?.id);
}

/** Toglie il calendario dal Google del titolare, con tutto quello che contiene. */
export async function eliminaCalendario(calendarId: string): Promise<void> {
  await chiama("DELETE", `/calendars/${encodeURIComponent(calendarId)}`);
}

/** Un appuntamento, nella forma che Google si aspetta. */
export interface EventoGoogle {
  titolo: string;
  /** "2026-09-16 15:30" — ora locale, senza fuso, come arriva dal modulo. */
  inizio: string;
  /** Quanto dura, in minuti. */
  durata: number;
  descrizione?: string;
  luogo?: string;
  /**
   * Minuti di preavviso per la sveglia, oppure `null` per non metterne
   * nessuna. Zero **non** vuol dire «niente sveglia»: vuol dire «suona
   * all'ora esatta dell'appuntamento».
   */
  preavviso: number | null;
}

/**
 * `"2026-09-16 15:30"` → `"2026-09-16T15:30:00"`.
 *
 * Google vuole la T e i secondi, ma **senza** fuso in coda: il fuso viaggia nel
 * campo `timeZone` accanto. Metterci una `Z` vorrebbe dire dichiarare che sono
 * le 15:30 di Greenwich, e in Italia l'appuntamento comparirebbe alle 17:30.
 */
function istante(quando: string): string {
  const pulito = quando.trim().replace(" ", "T");
  return pulito.length === 16 ? `${pulito}:00` : pulito.slice(0, 19);
}

/**
 * Somma i minuti a un orario **senza passare dal fuso del server**.
 *
 * `new Date("2026-09-16T15:30:00")` viene letta come ora locale, e
 * `toISOString()` la riscrive in ora di Greenwich: sul server, che gira con
 * `TZ=Europe/Rome`, ogni appuntamento sarebbe finito in Google spostato di due
 * ore. E' la stessa trappola gia' pagata sui file iCalendar e sugli avvisi del
 * telefono — qui si fanno i conti in UTC su numeri che di fuso non ne hanno,
 * e si riscrive com'era.
 */
function piuMinuti(quando: string, minuti: number): string {
  const [anno, mese, giorno, ore, min, sec] = istante(quando)
    .split(/[-T:]/)
    .map(Number) as [number, number, number, number, number, number];
  const t = Date.UTC(anno, mese - 1, giorno, ore, min, sec || 0) + minuti * 60_000;
  const d = new Date(t);
  const due = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${due(d.getUTCMonth() + 1)}-${due(d.getUTCDate())}` +
    `T${due(d.getUTCHours())}:${due(d.getUTCMinutes())}:${due(d.getUTCSeconds())}`
  );
}

function corpoEvento(evento: EventoGoogle) {
  return {
    summary: evento.titolo,
    description: evento.descrizione ?? "",
    location: evento.luogo ?? "",
    // L'orario va com'e' stato letto sull'orologio, e il fuso viaggia nel
    // campo accanto: e' la stessa scelta dei file iCalendar con `TZID`.
    start: { dateTime: istante(evento.inizio), timeZone: FUSO },
    end: { dateTime: piuMinuti(evento.inizio, evento.durata), timeZone: FUSO },
    reminders: {
      // `useDefault: false` con la lista vuota vuol dire «nessuna sveglia».
      // Lasciando `useDefault: true` suonerebbero quelle predefinite del suo
      // Google, che non sappiamo quali siano.
      useDefault: false,
      overrides:
        evento.preavviso === null
          ? []
          : [{ method: "popup", minutes: evento.preavviso }],
    },
  };
}

/**
 * Scrive l'appuntamento nel calendario di quella persona.
 *
 * Se `eventId` c'e' si aggiorna quello, altrimenti se ne crea uno nuovo. E se
 * quello che c'era e' stato cancellato a mano dentro Google, si ricrea invece
 * di lasciare l'appuntamento fuori: `chiama` restituisce `null` sul 404, ed e'
 * l'unico posto dove quel `null` significa «rifai».
 */
export async function scriviEvento(
  calendarId: string,
  evento: EventoGoogle,
  eventId: string | null,
): Promise<string> {
  const dove = `/calendars/${encodeURIComponent(calendarId)}/events`;

  if (eventId) {
    const aggiornato = await chiama<{ id?: string }>(
      "PATCH",
      `${dove}/${encodeURIComponent(eventId)}`,
      corpoEvento(evento),
    );
    if (aggiornato?.id) return aggiornato.id;
  }

  const creato = await chiama<{ id?: string }>("POST", dove, corpoEvento(evento));
  if (!creato?.id) throw new ErroreGoogle("Google non ha detto quale evento ha creato.");
  return creato.id;
}

/** Toglie l'evento. Se non c'era gia' piu', va bene lo stesso. */
export async function cancellaEvento(calendarId: string, eventId: string): Promise<void> {
  await chiama(
    "DELETE",
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
  );
}

/* ------------------------------------------------------ dire cosa non va */

/**
 * Da codice d'errore a riga da correggere.
 *
 * Stesso mestiere di `scripts/posta.mjs`: i codici di Google non dicono niente
 * a chi li legge, e quello che serve sapere e' **cosa fare adesso**. Le tre
 * righe che contano sono le prime: sono gli errori che si prendono durante la
 * configurazione, cioe' quando non si sa ancora se il problema e' nel
 * gestionale o nel pannello di Google.
 */
function descriviErrore(stato: number, codice?: string, dettaglio?: string): string {
  const detto = dettaglio ?? codice ?? `errore ${stato}`;

  if (codice === "invalid_client" || detto.includes("Unauthorized")) {
    return (
      "Google non riconosce il Client ID o il segreto. Vanno ricopiati dal pannello " +
      "di Google Cloud (Credenziali → ID client OAuth), attenti agli spazi in coda."
    );
  }
  if (codice === "redirect_uri_mismatch" || detto.includes("redirect_uri")) {
    return (
      "L'indirizzo di ritorno non e' fra quelli autorizzati. Va aggiunto identico, " +
      "compresa la barra finale se c'e', in Google Cloud → Credenziali → il tuo ID " +
      "client → URI di reindirizzamento autorizzati."
    );
  }
  if (codice === "invalid_grant") {
    return (
      "Il permesso non vale piu': puo' essere stato tolto da myaccount.google.com/permissions, " +
      "oppure e' scaduto perche' l'applicazione e' rimasta in stato «Test» su Google Cloud — " +
      "li' i permessi durano sette giorni. Ricollega Google; se ricapita ogni settimana, " +
      "l'applicazione va pubblicata («In produzione»)."
    );
  }
  if (codice === "access_denied") {
    return "Il consenso e' stato rifiutato sulla schermata di Google. Rifai il collegamento e accetta.";
  }
  if (stato === 403 && detto.includes("has not been used")) {
    return (
      "L'API Google Calendar non e' accesa su quel progetto. Si accende da Google Cloud → " +
      "API e servizi → Libreria → Google Calendar API → Abilita."
    );
  }
  if (stato === 403 && (detto.includes("Rate Limit") || detto.includes("quota"))) {
    return "Google ha messo un freno per troppe richieste ravvicinate. Riprova fra qualche minuto.";
  }
  if (stato === 401) {
    return "Google ha rifiutato il permesso. Prova a ricollegare Google.";
  }
  if (stato === 403 && detto.includes("insufficient")) {
    return (
      "Il permesso concesso non basta per questa operazione. Va rifatto il collegamento " +
      "accettando tutte le voci della schermata di consenso."
    );
  }
  return `Google ha risposto: ${detto}`;
}
