import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
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
    JSON.stringify({ uid: userId, exp: Date.now() + DURATION_DAYS * 864e5 }),
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(token: string | undefined): number | null {
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
    const { uid, exp } = JSON.parse(Buffer.from(body, "base64url").toString());
    if (typeof uid !== "number" || typeof exp !== "number" || exp < Date.now()) return null;
    return uid;
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
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURATION_DAYS * 86400,
  });

  run(`UPDATE users SET id = id WHERE id = ?`, [user.id]);
  audit(user.id, "accesso", "utente", user.id, "login");
  return null;
}

export async function logout() {
  const store = await cookies();
  const userId = decode(store.get(COOKIE)?.value);
  if (userId) audit(userId, "accesso", "utente", userId, "logout");
  store.delete(COOKIE);
}

/** Utente della sessione corrente, oppure null. */
export async function currentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const userId = decode(store.get(COOKIE)?.value);
  if (!userId) return null;

  const user = one<User>(
    `SELECT id, email, name, role, office, active FROM users WHERE id = ?`,
    [userId],
  );
  if (!user || !user.active) return null;

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
