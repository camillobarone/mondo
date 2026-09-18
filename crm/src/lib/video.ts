/**
 * Il video YouTube di un immobile.
 *
 * Il gestionale non parla con YouTube e non ci va a guardare: tiene soltanto
 * il collegamento che gli si incolla, cosi' da sapere quali immobili un video
 * ce l'hanno e quali no. A usarlo davvero e' l'applicazione che gestisce il
 * canale, che legge l'esportazione degli immobili.
 *
 * Il collegamento si conserva **come e' stato scritto** — e' quello che si
 * clicca dalla scheda — e accanto si esporta l'identificativo del video
 * ricavato da li'. Senza, l'altra applicazione dovrebbe accoppiare video e
 * immobili confrontando i titoli: funziona finche' i titoli sono scritti in
 * modo regolare, e sbaglia in silenzio quando non lo sono.
 */

/**
 * L'identificativo di un video YouTube, ricavato dal collegamento.
 *
 * Le forme in giro sono almeno quattro e cambiano a seconda di dove si copia
 * il link — dal browser, dal pulsante "Condividi", dal telefono, da uno short:
 *
 *   https://www.youtube.com/watch?v=dQw4w9WgXcQ
 *   https://youtu.be/dQw4w9WgXcQ?si=abc          <- il "Condividi" ci attacca un codice suo
 *   https://www.youtube.com/shorts/dQw4w9WgXcQ
 *   https://www.youtube.com/embed/dQw4w9WgXcQ
 *
 * Restituisce `null` quando il collegamento non e' di YouTube o non contiene
 * un identificativo riconoscibile: non e' un errore, e il collegamento resta
 * comunque salvato e cliccabile. Un identificativo inventato sarebbe peggio
 * di nessun identificativo.
 */
export function idVideoYouTube(collegamento: string | null | undefined): string | null {
  const testo = (collegamento ?? "").trim();
  if (!testo) return null;

  let url: URL;
  try {
    url = new URL(testo);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  // Gli identificativi sono di undici caratteri fra lettere, cifre, trattino e
  // trattino basso. Controllarlo evita di prendere per identificativo un pezzo
  // di percorso qualunque.
  const valido = (candidato: string | undefined | null) =>
    candidato && /^[A-Za-z0-9_-]{11}$/.test(candidato) ? candidato : null;

  if (host === "youtu.be") {
    return valido(url.pathname.split("/").filter(Boolean)[0]);
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    const dallaQuery = valido(url.searchParams.get("v"));
    if (dallaQuery) return dallaQuery;
    const pezzi = url.pathname.split("/").filter(Boolean);
    // /shorts/<id>, /embed/<id>, /live/<id>
    if (pezzi.length >= 2 && ["shorts", "embed", "live", "v"].includes(pezzi[0]!)) {
      return valido(pezzi[1]);
    }
  }
  return null;
}

/**
 * Il collegamento cosi' come va salvato, oppure un messaggio se non va bene.
 *
 * Si accetta qualunque indirizzo `https`, non solo YouTube: un domani un video
 * potrebbe stare altrove, e rifiutarlo bloccherebbe il lavoro per una regola
 * che non protegge niente. Si rifiuta invece quello che indirizzo non e',
 * perche' un campo che accetta qualsiasi testo diventa in fretta un secondo
 * blocco note, e l'altra applicazione ci si romperebbe sopra.
 */
export function collegamentoVideo(valore: string | null | undefined): {
  url: string | null;
  errore: string | null;
} {
  const testo = (valore ?? "").trim();
  if (!testo) return { url: null, errore: null };

  // Incollando dalla barra del browser lo "https://" a volte non viene: si
  // rimette invece di rifiutare, perche' "youtu.be/xxxxxxxxxxx" e' comunque
  // un collegamento e chi lo scrive ha detto tutto quello che serviva.
  const conSchema = /^[a-z][a-z0-9+.-]*:\/\//i.test(testo) ? testo : `https://${testo}`;

  let url: URL;
  try {
    url = new URL(conSchema);
  } catch {
    return {
      url: null,
      errore: "Il collegamento al video non è un indirizzo valido: incolla l'indirizzo intero, quello che comincia con https://",
    };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { url: null, errore: "Il collegamento al video deve cominciare con https://" };
  }
  // Un nome senza punto e' formalmente un indirizzo valido — "https://canale"
  // passa — ma non porta da nessuna parte. Il browser lo ferma gia' col
  // pattern del campo: qui si tiene la stessa regola, perche' due controlli
  // che non dicono la stessa cosa sono peggio di uno solo.
  if (!url.hostname.includes(".")) {
    return {
      url: null,
      errore: "Il collegamento al video non sembra un indirizzo: manca il nome del sito, per esempio youtu.be",
    };
  }
  return { url: conSchema, errore: null };
}
