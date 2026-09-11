/**
 * Avvisi sul telefono: il protocollo Web Push, scritto qui dentro.
 *
 * Serve a mandare la notifica dei 30 minuti prima a chi non legge la posta sul
 * telefono e non usa un calendario che faccia suonare la sveglia — cioe', in
 * agenzia, a chi ha un Samsung o uno Xiaomi. Funziona su tutte e tre le marche
 * e non passa ne' da un server di posta ne' da un account Google.
 *
 * ## Come funziona, in breve
 *
 * Il telefono chiede al proprio browser un «indirizzo di consegna» (endpoint)
 * e due chiavi. Noi salviamo quella roba, e quando c'e' da avvisare
 * impacchettiamo il messaggio **cifrato per quel telefono** e lo consegniamo a
 * quell'indirizzo. Il servizio di consegna (Google per Chrome, Apple per
 * Safari, Mozilla per Firefox) non puo' leggere il contenuto: e' cifrato con
 * chiavi che ha solo il telefono.
 *
 * ## Perche' e' scritto a mano
 *
 * Come il lettore Excel e il generatore iCalendar: nessuna dipendenza in piu'
 * da installare e aggiornare sul server. Qui pero' c'e' di mezzo la
 * crittografia, dove un errore **non da' errore** — il messaggio parte, il
 * servizio di consegna risponde 400 e nessuno capisce perche'. Per questo:
 *
 * - ogni passaggio cita la riga della specifica da cui viene (RFC 8291 per la
 *   cifratura del messaggio, RFC 8188 per il formato aes128gcm, RFC 8292 per
 *   la firma VAPID);
 * - il risultato e' stato confrontato **byte per byte** con la libreria
 *   `web-push`, che e' quella che usano tutti, a parita' di chiavi e di sale.
 *   La prova sta nello scratchpad della sessione, non nel repository: serviva
 *   a dimostrare che questo file e' giusto, non a restare.
 *
 * Se un giorno questo file va toccato, **rifare quel confronto** e' l'unico
 * modo serio di sapere che funziona ancora. Guardarlo non basta.
 */
import crypto from "node:crypto";

/** La curva usata da tutto il protocollo. */
const CURVA = "prime256v1";

/** Quanto tiene al massimo un messaggio in coda, se il telefono e' spento. */
const TTL = 12 * 60 * 60;

/** L'iscrizione di un telefono, come arriva dal browser. */
export interface Iscrizione {
  /** Dove si consegna. E' del servizio di consegna, non nostro. */
  endpoint: string;
  /** La chiave pubblica del telefono (65 byte, base64url). */
  p256dh: string;
  /** Il segreto condiviso col telefono (16 byte, base64url). */
  auth: string;
}

/** Le due chiavi del mittente. Sono dell'agenzia e non cambiano mai. */
export interface ChiaviVapid {
  pubblica: string;
  privata: string;
}

/* ------------------------------------------------------------------ base64url */

// Il protocollo usa dappertutto base64url — senza «=» in fondo e con «-_» al
// posto di «+/». Node lo sa fare, ma non nella direzione inversa: `from` con
// "base64url" regge anche il base64 normale, quindi si usa per entrambi.

function daB64(valore: string): Buffer {
  return Buffer.from(valore, "base64url");
}

function aB64(dati: Buffer): string {
  return dati.toString("base64url");
}

/* ------------------------------------------------------------------ le chiavi */

/**
 * Genera la coppia di chiavi dell'agenzia.
 *
 * Si fa **una volta sola** e poi si conserva: cambiarle butterebbe via tutte
 * le iscrizioni, perche' il telefono lega la propria iscrizione alla chiave
 * pubblica con cui l'ha chiesta.
 */
export function generaChiaviVapid(): ChiaviVapid {
  const ecdh = crypto.createECDH(CURVA);
  ecdh.generateKeys();
  return {
    // Non compressa, 65 byte con lo 0x04 davanti: e' l'unica forma che i
    // browser accettano in `applicationServerKey`.
    pubblica: aB64(ecdh.getPublicKey()),
    privata: aB64(ecdh.getPrivateKey()),
  };
}

/**
 * Node vuole le chiavi in formato PKCS8/SPKI per firmare, non i byte grezzi.
 * Invece di comporre l'ASN.1 a mano si usa il costruttore JWK, che e' fatto
 * apposta e non si sbaglia sulle lunghezze.
 */
function chiavePrivataPerFirma(chiavi: ChiaviVapid): crypto.KeyObject {
  const pubblica = daB64(chiavi.pubblica);
  if (pubblica.length !== 65 || pubblica[0] !== 0x04) {
    throw new Error("La chiave pubblica VAPID non e' nel formato giusto (65 byte, 0x04).");
  }
  return crypto.createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x: aB64(pubblica.subarray(1, 33)),
      y: aB64(pubblica.subarray(33, 65)),
      d: chiavi.privata,
    },
    format: "jwk",
  });
}

/* ------------------------------------------------------------------ la firma */

/**
 * Il biglietto da vista con cui ci presentiamo al servizio di consegna
 * (RFC 8292). Dice chi siamo, per quale servizio vale e fino a quando.
 *
 * `aud` e' **l'origine dell'endpoint**, non l'endpoint intero: mettercelo
 * intero fa rifiutare il messaggio con 401, ed e' uno sbaglio facile perche'
 * l'endpoint e' li' sotto gli occhi.
 */
function biglietto(endpoint: string, chiavi: ChiaviVapid, contatto: string): string {
  const testata = { typ: "JWT", alg: "ES256" };
  const dati = {
    aud: new URL(endpoint).origin,
    // Dodici ore: la specifica non vuole piu' di ventiquattro.
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: contatto,
  };
  const corpo = [testata, dati]
    .map((pezzo) => aB64(Buffer.from(JSON.stringify(pezzo))))
    .join(".");

  // La firma va nella forma «r||s», 64 byte netti. Quella predefinita di Node
  // e' DER, che ha dentro lunghezze e tipi e qui viene rifiutata.
  const firma = crypto.sign("sha256", Buffer.from(corpo), {
    key: chiavePrivataPerFirma(chiavi),
    dsaEncoding: "ieee-p1363",
  });
  return `${corpo}.${aB64(firma)}`;
}

/* ------------------------------------------------------------------ la busta */

/** HKDF come lo usa il protocollo: estrai, espandi, tieni i primi byte. */
function hkdf(sale: Buffer, seme: Buffer, info: Buffer, quanti: number): Buffer {
  const prk = crypto.createHmac("sha256", sale).update(seme).digest();
  // Un solo giro basta: qui non si chiedono mai piu' di 32 byte.
  const uscita = crypto
    .createHmac("sha256", prk)
    .update(Buffer.concat([info, Buffer.from([1])]))
    .digest();
  return uscita.subarray(0, quanti);
}

/**
 * Cifra il messaggio per **quel** telefono (RFC 8291).
 *
 * Il sale e la coppia di chiavi usa-e-getta sono parametri solo per poterli
 * fissare nelle prove: chi chiama davvero non li passa mai, e vengono a caso
 * ogni volta. Riusare un sale sarebbe un errore grave — la stessa chiave con
 * lo stesso nonce due volte, che e' il modo in cui AES-GCM si rompe.
 */
export function cifra(
  messaggio: string,
  iscrizione: Iscrizione,
  fissi?: { sale: Buffer; privataUsaEGetta: Buffer },
): Buffer {
  const chiaveTelefono = daB64(iscrizione.p256dh);
  const segretoTelefono = daB64(iscrizione.auth);
  if (chiaveTelefono.length !== 65) {
    throw new Error("La chiave del telefono non e' di 65 byte: iscrizione da buttare.");
  }

  const sale = fissi?.sale ?? crypto.randomBytes(16);
  const mittente = crypto.createECDH(CURVA);
  if (fissi) mittente.setPrivateKey(fissi.privataUsaEGetta);
  else mittente.generateKeys();
  const chiaveMittente = mittente.getPublicKey();

  // 1. Il segreto che nasce dalle due chiavi, e che sa fare solo chi ha una
  //    delle due private.
  const condiviso = mittente.computeSecret(chiaveTelefono);

  // 2. Si mescola col segreto dell'iscrizione. La stringa e' quella della
  //    specifica, **con lo zero finale**: e' un terminatore, non decorazione,
  //    e toglierlo cambia tutte le chiavi senza dare errore.
  const seme = hkdf(
    segretoTelefono,
    condiviso,
    Buffer.concat([
      Buffer.from("WebPush: info\0"),
      chiaveTelefono,
      chiaveMittente,
    ]),
    32,
  );

  // 3. Da li' escono la chiave del lucchetto e il suo numero d'ordine.
  const chiave = hkdf(sale, seme, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdf(sale, seme, Buffer.from("Content-Encoding: nonce\0"), 12);

  // 4. Il messaggio finisce con 0x02, che vuol dire «ultimo pezzo». Senza, il
  //    telefono aspetta un seguito che non arriva e non mostra niente.
  const cifratore = crypto.createCipheriv("aes-128-gcm", chiave, nonce);
  const chiuso = Buffer.concat([
    cifratore.update(Buffer.concat([Buffer.from(messaggio, "utf8"), Buffer.from([2])])),
    cifratore.final(),
    cifratore.getAuthTag(),
  ]);

  // 5. La testata viaggia in chiaro davanti al messaggio: sale, quanto e'
  //    lungo un pezzo (4096, scritto su 4 byte), quanto e' lunga la chiave del
  //    mittente (65) e la chiave stessa.
  const testata = Buffer.alloc(21);
  sale.copy(testata, 0);
  testata.writeUInt32BE(4096, 16);
  testata.writeUInt8(chiaveMittente.length, 20);

  return Buffer.concat([testata, chiaveMittente, chiuso]);
}

/* ------------------------------------------------------------------ l'invio */

/** Come e' andata la consegna a un telefono. */
export interface Esito {
  ok: boolean;
  stato: number;
  /** Vero quando quel telefono non esiste piu': l'iscrizione va cancellata. */
  daButtare: boolean;
  motivo?: string;
}

/**
 * Consegna il messaggio a un telefono.
 *
 * Non lancia mai: un telefono che non risponde non deve fermare gli altri
 * avvisi dello stesso giro. Il motivo torna scritto in italiano perche' chi lo
 * legge e' chi guarda il registro del cron, non chi ha scritto il protocollo.
 */
export async function manda(
  iscrizione: Iscrizione,
  messaggio: string,
  chiavi: ChiaviVapid,
  contatto: string,
): Promise<Esito> {
  let corpo: Buffer;
  try {
    corpo = cifra(messaggio, iscrizione);
  } catch (errore) {
    return {
      ok: false,
      stato: 0,
      daButtare: true,
      motivo: errore instanceof Error ? errore.message : String(errore),
    };
  }

  try {
    const risposta = await fetch(iscrizione.endpoint, {
      method: "POST",
      headers: {
        // La firma e la nostra chiave pubblica viaggiano insieme, separate da
        // una virgola: e' la forma «vapid» di RFC 8292, non due intestazioni.
        Authorization: `vapid t=${biglietto(iscrizione.endpoint, chiavi, contatto)}, k=${chiavi.pubblica}`,
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(TTL),
        // Alta, perche' e' un avviso con un'ora di scadenza: un telefono in
        // risparmio energetico terrebbe ferma quella normale fino a domani.
        Urgency: "high",
      },
      body: new Uint8Array(corpo),
    });

    if (risposta.ok) return { ok: true, stato: risposta.status, daButtare: false };

    // 404 e 410 vogliono dire che quel telefono non c'e' piu' — ha
    // disinstallato, ha cancellato i dati del sito, o l'iscrizione e' scaduta.
    // E' l'unico caso in cui si cancella: su un errore qualsiasi si riprova.
    const daButtare = risposta.status === 404 || risposta.status === 410;
    return { ok: false, stato: risposta.status, daButtare, motivo: spiegaStato(risposta.status) };
  } catch (errore) {
    return {
      ok: false,
      stato: 0,
      daButtare: false,
      motivo: `non raggiungibile (${errore instanceof Error ? errore.message : errore})`,
    };
  }
}

/** Traduce il codice del servizio di consegna nella cosa da guardare. */
export function spiegaStato(stato: number): string {
  if (stato === 400)
    return "messaggio rifiutato: quasi sempre la cifratura, oppure un'intestazione sbagliata";
  if (stato === 401 || stato === 403)
    return "firma rifiutata: controlla le chiavi VAPID e il contatto (CRM_BASE_URL)";
  if (stato === 404 || stato === 410) return "quel telefono non e' piu' iscritto";
  if (stato === 413) return "messaggio troppo lungo (oltre 4 KB)";
  if (stato === 429) return "troppi messaggi di fila: riprova piu' tardi";
  if (stato >= 500) return "il servizio di consegna e' in difficolta': riprova";
  return `risposta inattesa (${stato})`;
}
