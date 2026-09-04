/**
 * I portali su cui l'agenzia pubblica gli annunci.
 *
 * Il gestionale non ci parla e non ci va a guardare: conserva il collegamento
 * all'annuncio, e basta. Serve a due cose, e sono tutte e due per il
 * proprietario che vende con noi:
 *
 *  - dimostrargli che la sua casa e' davvero pubblicata, con un collegamento
 *    che puo' aprire e verificare da se' — e' il motivo per cui questa sezione
 *    si chiama *registro di garanzia* e non *statistiche*;
 *  - dare all'agenzia un posto solo dove ricordarsi **dove** un annuncio sta,
 *    per andare a toglierlo il giorno del rogito. Un annuncio rimasto online
 *    dopo la vendita porta telefonate per una casa che non c'e' piu'.
 *
 * I numeri dei portali — visite, contatti — **non stanno qui e non ci
 * staranno**: non esiste un modo di prenderli, e inventarne di finti sarebbe
 * peggio che non averne.
 *
 * Aggiungerne un terzo (casa.it, per dire) costa: una voce qui sotto, una
 * colonna in `COLONNE_AGGIUNTE` di `db.ts` e in `schema.ts`, un campo nel tipo
 * `Property`, e le due righe nelle query di `saveProperty`. Poco, ma non
 * gratis: per questo ce ne sono due, che sono quelli su cui pubblica davvero.
 */
export const PORTALI = [
  {
    chiave: "idealista",
    /** Come si chiama, scritto come lo scrivono loro. */
    nome: "idealista",
    /** La colonna di `properties` che tiene il collegamento. */
    colonna: "listing_idealista",
    /** Deve comparire nel nome del sito, altrimenti il campo e' quello sbagliato. */
    dominio: "idealista",
    esempio: "https://www.idealista.it/immobile/12345678/",
  },
  {
    chiave: "immobiliare",
    nome: "Immobiliare.it",
    colonna: "listing_immobiliare",
    dominio: "immobiliare.it",
    esempio: "https://www.immobiliare.it/annunci/12345678/",
  },
] as const;

export type Portale = (typeof PORTALI)[number];

/**
 * Controlla il collegamento a un annuncio.
 *
 * Vuota e' una risposta buona: un immobile puo' non essere pubblicato, e
 * pretendere l'indirizzo bloccherebbe il lavoro per una regola che non
 * protegge niente.
 *
 * La regola su cosa sia un indirizzo e' la stessa di `collegamentoVideo` in
 * `video.ts`, scritta di nuovo invece che condivisa: i messaggi cambiano — li'
 * si parla di un video, qui di un annuncio — e una funzione sola che li
 * prendesse come parametro sarebbe piu' lunga delle due messe insieme.
 */
export function collegamentoAnnuncio(
  portale: Portale,
  valore: string | null | undefined,
): { url: string | null; errore: string | null } {
  const testo = (valore ?? "").trim();
  if (!testo) return { url: null, errore: null };

  // Incollando dalla barra del browser lo "https://" a volte non viene: si
  // rimette invece di rifiutare, perche' chi scrive ha gia' detto tutto.
  const conSchema = /^[a-z][a-z0-9+.-]*:\/\//i.test(testo) ? testo : `https://${testo}`;

  let url: URL;
  try {
    url = new URL(conSchema);
  } catch {
    return {
      url: null,
      errore: `Il collegamento all'annuncio su ${portale.nome} non è un indirizzo valido: incolla l'indirizzo intero, quello che comincia con https://`,
    };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return {
      url: null,
      errore: `Il collegamento all'annuncio su ${portale.nome} deve cominciare con https://`,
    };
  }

  // Il controllo che vale davvero: due campi vicini, uno per portale, e
  // incollare l'annuncio di idealista nella casella di Immobiliare.it e'
  // l'errore piu' facile del mondo. Senza questa riga il proprietario si
  // vedrebbe scritto "pubblicata su Immobiliare.it" con sotto un collegamento
  // che porta altrove — che e' peggio di non scriverlo affatto.
  if (!url.hostname.toLowerCase().includes(portale.dominio)) {
    return {
      url: null,
      errore: `Questo non sembra un annuncio di ${portale.nome}: l'indirizzo dovrebbe contenere «${portale.dominio}». Hai incollato il collegamento nella casella giusta?`,
    };
  }

  return { url: conSchema, errore: null };
}
