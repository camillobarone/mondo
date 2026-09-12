import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { one, run, audit } from "./db";
import type { SessionUser, User } from "./types";

const COOKIE = "mondo_crm";
const DURATION_DAYS = 14;

/**
 * Chiave per firmare i cookie di sessione.
 * Si prende da CRM_SECRET; se non c'e', ne viene generata una e salvata in
 * data/secret.key, cosi' il programma funziona senza configurazione e le
 * sessioni sopravvivono ai riavvii.
 */
function secret(): Buffer {
  const fromEnv = process.env.CRM_SECRET;
  if (fromEnv) return Buffer.from(fromEnv, "utf8");

  const file = path.join(process.cwd(), "data", "secret.key");
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, crypto.randomBytes(48).toString("hex"), {
      mode: 0o600,
    });
  }
  return Buffer.from(fs.readFileSync(file, "utf8"), "utf8");
}

// ------------------------------------------------------------------ password

/** Genera l'hash di una password con scrypt (salt casuale per ogni password). */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/** Verifica una password contro il suo hash, a tempo costante. */
export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

// ------------------------------------------------------------------ sessione

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(userId: number): string {
  const body = Buffer.from(
    JSON.stringify({
      uid: userId,
      exp: Date.now() + DURATION_DAYS * 864e5,
      // Quando e' stato emesso. Serve a far cadere questa sessione se la
      // password viene cambiata dopo: vedi currentUser.
      iat: Date.now(),
    }),
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(token: string | undefined): { uid: number; iat: number } | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  if (
    expected.length !== signature.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  ) {
    return null;
  }

  try {
    const { uid, exp, iat } = JSON.parse(Buffer.from(body, "base64url").toString());
    if (typeof uid !== "number" || typeof exp !== "number" || exp < Date.now()) return null;
    // I cookie emessi prima che esistesse questo campo restano validi: chi sta
    // lavorando non deve ritrovarsi buttato fuori da un aggiornamento.
    return { uid, iat: typeof iat === "number" ? iat : 0 };
  } catch {
    return null;
  }
}

/** Effettua il login. Restituisce un messaggio d'errore, o null se ha funzionato. */
export async function login(email: string, password: string): Promise<string | null> {
  const user = one<User>(`SELECT * FROM users WHERE email = ? COLLATE NOCASE`, [
    email.trim(),
  ]);

  // Messaggio identico in tutti i casi: non riveliamo se l'email esiste.
  const generic = "Email o password non corretti.";
  if (!user || !user.active) return generic;
  if (!verifyPassword(password, user.password_hash)) return generic;

  const store = await cookies();
  store.set(COOKIE, encode(user.id), {
    httpOnly: true,
    sameSite: "lax",
    // Il cookie va marcato "solo HTTPS" quando la connessione lo e' davvero,
    // non quando il programma e' compilato per la produzione: in ufficio gira
    // su http in rete locale, e un cookie Secure li' il browser lo scarta —
    // l'accesso fallirebbe senza dire perche'.
    secure: await isHttps(),
    path: "/",
    maxAge: DURATION_DAYS * 86400,
  });

  run(`UPDATE users SET id = id WHERE id = ?`, [user.id]);
  audit(user.id, "accesso", "utente", user.id, "login");
  return null;
}

/**
 * Vero solo se la pagina e' arrivata via HTTPS. Dietro un proxy (il caso di un
 * server con certificato) lo dice l'intestazione `x-forwarded-proto`.
 */
async function isHttps(): Promise<boolean> {
  const head = await headers();
  const forwarded = head.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0]!.trim() === "https";
  return false;
}

export async function logout() {
  const store = await cookies();
  const sessione = decode(store.get(COOKIE)?.value);
  if (sessione) audit(sessione.uid, "accesso", "utente", sessione.uid, "logout");
  store.delete(COOKIE);
}

/** Utente della sessione corrente, oppure null. */
export async function currentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const sessione = decode(store.get(COOKIE)?.value);
  if (!sessione) return null;

  const user = one<User & { password_changed_at: number | null }>(
    `SELECT id, email, name, role, office, active, password_changed_at
       FROM users WHERE id = ?`,
    [sessione.uid],
  );
  if (!user || !user.active) return null;

  // Password cambiata dopo che questa sessione era gia' aperta: la sessione
  // non vale piu'. E' il motivo per cui cambiare la password serve a qualcosa —
  // chi era entrato con quella vecchia si ritrova fuori.
  if (user.password_changed_at && sessione.iat < user.password_changed_at) return null;

  const { id, email, name, role, office } = user;
  return { id, email, name, role, office };
}

/** Come currentUser, ma rimanda al login se non c'e' nessuno collegato. */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

/** Richiede il ruolo titolare: usato per provvigioni, utenti e registro. */
export async function requireOwner(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "titolare") redirect("/");
  return user;
}

/* ==================================================== cambio della password */

/** Requisito unico, uguale ovunque si imposti una password. */
export const PASSWORD_MINIMA = 8;

/**
 * Segna che da adesso le sessioni aperte prima non valgono piu'.
 * Va chiamata ogni volta che una password cambia, da qualunque strada.
 */
function invalidaSessioni(userId: number) {
  run(`UPDATE users SET password_changed_at = ? WHERE id = ?`, [Date.now(), userId]);
}

/**
 * Cambio della propria password, conoscendo quella vecchia.
 * Restituisce un messaggio d'errore, oppure null se ha funzionato.
 */
export function cambiaLaMiaPassword(
  userId: number,
  attuale: string,
  nuova: string,
): string | null {
  const user = one<User>(`SELECT * FROM users WHERE id = ?`, [userId]);
  if (!user) return "Utente non trovato.";

  if (!verifyPassword(attuale, user.password_hash)) {
    return "La password attuale non è corretta.";
  }
  if (nuova.length < PASSWORD_MINIMA) {
    return `La nuova password deve avere almeno ${PASSWORD_MINIMA} caratteri.`;
  }
  if (nuova === attuale) {
    return "La nuova password è uguale a quella di adesso.";
  }

  run(`UPDATE users SET password_hash = ? WHERE id = ?`, [hashPassword(nuova), userId]);
  invalidaSessioni(userId);
  audit(userId, "modifica", "utente", userId, "password cambiata dall'interessato");
  return null;
}

/* ------------------------------------------------- password dimenticata */

/** Quanto vale un biglietto di recupero. Un'ora: il tempo di leggere l'email. */
const RECUPERO_MINUTI = 60;

function impronta(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Prepara un biglietto di recupero per un'email, se quell'utente esiste.
 *
 * Restituisce null quando non c'e' niente da mandare — utente inesistente o
 * disattivato. Chi chiama NON deve far trapelare la differenza: la pagina
 * risponde la stessa cosa in ogni caso, altrimenti diventa un modo per sapere
 * chi ha un accesso e chi no.
 */
export function preparaRecupero(
  email: string,
): { utente: User; token: string; scadenza: Date } | null {
  const user = one<User>(`SELECT * FROM users WHERE email = ? COLLATE NOCASE AND active = 1`, [
    email.trim(),
  ]);
  if (!user) return null;

  // Un biglietto per volta, e non piu' di uno al minuto: senza, chi conosce
  // l'indirizzo email di qualcuno potrebbe riempirgli la casella.
  const recente = one<{ n: number }>(
    `SELECT COUNT(*) AS n FROM password_resets
      WHERE user_id = ? AND used_at IS NULL AND created_at > datetime('now', '-1 minute')`,
    [user.id],
  );
  if (recente && recente.n > 0) return null;

  const token = crypto.randomBytes(32).toString("base64url");
  const scadenza = new Date(Date.now() + RECUPERO_MINUTI * 60_000);

  // I biglietti precedenti non servono piu': chiederne uno nuovo annulla i vecchi.
  run(`UPDATE password_resets SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL`, [
    user.id,
  ]);
  run(
    `INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?,?,?)`,
    [user.id, impronta(token), scadenza.getTime()],
  );
  audit(user.id, "accesso", "utente", user.id, "richiesto il recupero della password");

  return { utente: user, token, scadenza };
}

/** A chi appartiene un biglietto, se e' ancora valido. */
export function utenteDelBiglietto(token: string): User | null {
  if (!token || token.length < 20) return null;
  const riga = one<{ user_id: number }>(
    `SELECT user_id FROM password_resets
      WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`,
    [impronta(token), Date.now()],
  );
  if (!riga) return null;
  return one<User>(`SELECT * FROM users WHERE id = ? AND active = 1`, [riga.user_id]) ?? null;
}

/**
 * Imposta una password nuova usando il biglietto. Il biglietto si consuma:
 * lo stesso indirizzo, riaperto, non funziona una seconda volta.
 */
export function impostaPasswordConBiglietto(token: string, nuova: string): string | null {
  const user = utenteDelBiglietto(token);
  if (!user) return "Questo collegamento non è più valido. Chiedine un altro.";
  if (nuova.length < PASSWORD_MINIMA) {
    return `La password deve avere almeno ${PASSWORD_MINIMA} caratteri.`;
  }

  run(`UPDATE users SET password_hash = ? WHERE id = ?`, [hashPassword(nuova), user.id]);
  run(`UPDATE password_resets SET used_at = datetime('now') WHERE token_hash = ?`, [
    impronta(token),
  ]);
  invalidaSessioni(user.id);
  audit(user.id, "modifica", "utente", user.id, "password reimpostata dopo il recupero");
  return null;
}
