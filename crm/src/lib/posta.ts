import "server-only";
import nodemailer from "nodemailer";

/**
 * Invio di email dal programma.
 *
 * La configurazione arriva dall'ambiente, cioe' da `/etc/mondo-crm.env` sul
 * server: le stesse variabili che usa lo script dei promemoria, cosi' si
 * configura una volta sola e vale per tutti e due.
 *
 * Se la posta non e' configurata il programma non si rompe: le funzioni qui
 * sotto lo dicono, e chi chiama decide cosa mostrare. E' importante che sia
 * cosi', perche' il gestionale ha funzionato per settimane senza SMTP.
 */

export interface Posta {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

export function configurazionePosta(): Posta | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  return {
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    user,
    pass,
    from: process.env.SMTP_FROM ?? user,
  };
}

/** Vero se il programma e' in grado di spedire. */
export function postaConfigurata(): boolean {
  return configurazionePosta() !== null;
}

/**
 * Spedisce un'email. Restituisce null se e' partita, un messaggio se no.
 *
 * Non lancia eccezioni: un errore del server di posta non deve trasformarsi
 * in una pagina bianca davanti a chi sta solo cercando di rientrare.
 */
export async function invia(opzioni: {
  a: string;
  oggetto: string;
  testo: string;
}): Promise<string | null> {
  const posta = configurazionePosta();
  if (!posta) return "La posta non è configurata su questo server.";

  try {
    const trasporto = nodemailer.createTransport({
      host: posta.host,
      port: posta.port,
      secure: posta.port === 465,
      auth: { user: posta.user, pass: posta.pass },
    });

    await trasporto.sendMail({
      from: posta.from,
      to: opzioni.a,
      subject: opzioni.oggetto,
      text: opzioni.testo,
      // Il corpo va codificato in base64, non nel modo predefinito.
      //
      // Il modo predefinito (quoted-printable) spezza le righe piu' lunghe di
      // 76 caratteri e ci infila un "=" a fine riga. Su un indirizzo come
      //   https://gestionale.mondoimmobiliarelecce.it/recupero/<biglietto>
      // che di caratteri ne ha quasi cento, vuol dire tagliarlo in due:
      // qualche programma di posta lo rimette insieme, altri no, e chi lo
      // copia a mano si porta dietro il taglio. Il collegamento non funziona e
      // non si capisce perche'.
      //
      // In base64 il corpo viaggia intero e lo rimette insieme il programma di
      // posta, sempre.
      textEncoding: "base64",
    });
    return null;
  } catch (errore) {
    // Il dettaglio finisce nel registro del servizio, non a schermo: contiene
    // il nome del server di posta e a volte l'utenza.
    console.error("Invio email non riuscito:", errore);
    return "Non è stato possibile inviare l'email. Riprova più tardi.";
  }
}

/** L'indirizzo pubblico del gestionale, per i collegamenti dentro le email. */
export function indirizzoBase(): string {
  return (process.env.CRM_BASE_URL ?? "").replace(/\/$/, "");
}
