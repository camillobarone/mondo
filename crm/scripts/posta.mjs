#!/usr/bin/env node
/**
 * Prova della configurazione della posta.
 *
 *   node scripts/posta.mjs              controlla che il server accetti l'accesso
 *   node scripts/posta.mjs --manda      manda davvero un'email di prova a se stessi
 *   node scripts/posta.mjs --a tizio@x  manda l'email di prova a quell'indirizzo
 *
 * Esiste perche' `promemoria.mjs --prova` dice soltanto *cosa* manderebbe: non
 * apre nessuna connessione, quindi passa anche con la password sbagliata o
 * l'host inesistente. Se non ci sono appuntamenti nella mezz'ora dice "nessun
 * appuntamento" e non prova niente — cioe' proprio nel momento in cui si vuole
 * sapere se la configurazione e' giusta, non risponde.
 *
 * Qui invece si parla davvero con il server di posta, e quando qualcosa non va
 * si dice quale delle cinque righe e' sbagliata. Un errore SMTP grezzo
 * ("EAUTH 535") non aiuta chi sta compilando un file per la prima volta.
 */
import nodemailer from "nodemailer";

const argomenti = process.argv.slice(2);
const indice = argomenti.indexOf("--a");
const destinatarioScelto = indice >= 0 ? argomenti[indice + 1] : undefined;
const manda = argomenti.includes("--manda") || destinatarioScelto !== undefined;

if (indice >= 0 && (!destinatarioScelto || destinatarioScelto.startsWith("--"))) {
  console.error("Manca l'indirizzo dopo --a. Esempio: --a nome@dominio.it");
  process.exit(1);
}

const posta = {
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
};

/* ---- 1. Le righe ci sono tutte? ------------------------------------------ */

const mancanti = [
  ["SMTP_HOST", posta.host],
  ["SMTP_USER", posta.user],
  ["SMTP_PASS", posta.pass],
]
  .filter(([, valore]) => !valore)
  .map(([nome]) => nome);

if (mancanti.length > 0) {
  console.error(`✗ La posta non è configurata: manca ${mancanti.join(", ")}.`);
  console.error("");
  console.error("  Le righe stanno in /etc/mondo-crm.env. Per compilarle:");
  console.error("    nano /etc/mondo-crm.env");
  console.error("");
  console.error("  Se il file lo hai già compilato e questo comando dice ancora");
  console.error("  che manca qualcosa, vuol dire che non è stato letto: va");
  console.error("  caricato prima, sulla stessa riga di comando —");
  console.error("    set -a; . /etc/mondo-crm.env; set +a; node scripts/posta.mjs");
  process.exit(1);
}

// La porta decide da sola il tipo di cifratura, come in tutto il resto del
// programma: 465 e' cifrata dal primo byte, 587 parte in chiaro e passa a
// cifrata con STARTTLS. Sbagliare l'accoppiata e' l'errore piu' comune e da
// fuori sembra un guasto del server.
const cifrataSubito = posta.port === 465;

console.log(`Server   : ${posta.host}:${posta.port} (${cifrataSubito ? "SSL" : "STARTTLS"})`);
console.log(`Utenza   : ${posta.user}`);
console.log(`Mittente : ${posta.from}`);
if (posta.port !== 465 && posta.port !== 587) {
  console.log(`⚠ La porta ${posta.port} non è una delle due solite (465 o 587).`);
}
console.log("");

const trasporto = nodemailer.createTransport({
  host: posta.host,
  port: posta.port,
  secure: cifrataSubito,
  auth: { user: posta.user, pass: posta.pass },
  // Oltre questi non si aspetta: senza un limite, una porta chiusa da un
  // firewall lascia il comando appeso per minuti senza dire niente.
  connectionTimeout: 15000,
  greetingTimeout: 15000,
});

/**
 * Traduce l'errore SMTP nella riga da correggere.
 *
 * I codici veri di nodemailer non sono quelli di sistema: un nome che non
 * esiste arriva come EDNS e una porta chiusa come ESOCKET, con il codice di
 * sistema (ENOTFOUND, ECONNREFUSED) solo dentro al testo. Si guardano tutti e
 * due, altrimenti si finisce a stampare l'errore grezzo.
 */
function spiega(errore) {
  const codice = errore.code ?? "";
  const testo = errore.message ?? String(errore);
  const dice = (...pezzi) => pezzi.some((p) => testo.toUpperCase().includes(p));

  if (codice === "EDNS" || dice("ENOTFOUND", "EAI_AGAIN")) {
    return [
      `Il nome «${posta.host}» non esiste, o il server non riesce a risolverlo.`,
      "→ Sbagliata la riga SMTP_HOST.",
    ];
  }
  // La cifratura sbagliata per quella porta: parlare in chiaro a una porta
  // cifrata (o il contrario) da' un errore TLS che non dice niente a nessuno.
  // E' l'errore che si fa scambiando 465 e 587, cioe' il piu' probabile.
  if (dice("WRONG VERSION NUMBER", "SSL", "TLS") && !dice("STARTTLS COMMAND FAILED")) {
    return [
      `Il server risponde sulla porta ${posta.port}, ma non nel modo che ci si aspetta da quella porta.`,
      posta.port === 465
        ? "→ La 465 è cifrata dall'inizio: se il tuo server la vuole in chiaro, metti SMTP_PORT=587."
        : "→ La 587 parte in chiaro: se il tuo server la vuole cifrata subito, metti SMTP_PORT=465.",
    ];
  }
  if (codice === "ESOCKET" || codice === "ECONNECTION" || dice("ETIMEDOUT", "ECONNREFUSED", "TIMEOUT")) {
    return [
      `Il server «${posta.host}» non risponde sulla porta ${posta.port}.`,
      posta.port === 465
        ? "→ Prova SMTP_PORT=587, oppure la porta 465 è bloccata in uscita dal server."
        : "→ Prova SMTP_PORT=465, oppure la porta è bloccata in uscita dal server.",
    ];
  }
  if (codice === "EAUTH") {
    return [
      "Il server di posta ha rifiutato utenza e password.",
      "→ Sbagliata la riga SMTP_USER o SMTP_PASS.",
      "  L'utenza è l'indirizzo completo (info@dominio.it, non solo «info»),",
      "  e la password è quella della casella, non quella del pannello.",
    ];
  }
  if (codice === "EENVELOPE") {
    return [
      `Il server ha accettato l'accesso ma ha rifiutato il mittente «${posta.from}».`,
      "→ SMTP_FROM deve essere una casella di questo dominio, di solito la stessa di SMTP_USER.",
    ];
  }
  return [testo];
}

/* ---- 2. Il server ci parla e ci fa entrare? ------------------------------ */

try {
  await trasporto.verify();
  console.log("✓ Il server di posta risponde e accetta l'accesso.");
} catch (errore) {
  console.error("✗ Non ha funzionato.");
  console.error("");
  for (const riga of spiega(errore)) console.error(`  ${riga}`);
  console.error("");
  console.error("  Dopo aver corretto /etc/mondo-crm.env, ridai questo stesso comando.");
  process.exit(1);
}

/* ---- 3. Un'email vera, se richiesta -------------------------------------- */

if (!manda) {
  console.log("");
  console.log("Nessuna email inviata (era solo un controllo).");
  console.log("Per mandarne una di prova a te stesso, ridai il comando con --manda");
  process.exit(0);
}

const destinatario = destinatarioScelto ?? posta.from;

try {
  await trasporto.sendMail({
    from: posta.from,
    to: destinatario,
    subject: "Prova: la posta del gestionale funziona",
    text: [
      "Se stai leggendo questa email, il gestionale sa spedire.",
      "",
      "Da adesso partono da soli:",
      "  · l'avviso 30 minuti prima di ogni appuntamento in agenda;",
      "  · il collegamento per rifare la password, da «Password dimenticata?».",
      "",
      "Questo messaggio l'ha mandato il comando di prova: non è successo niente,",
      "e non arriverà più finché non lo richiami a mano.",
    ].join("\n"),
    // Come in src/lib/posta.ts: il modo predefinito spezza le righe lunghe
    // oltre i 76 caratteri e taglia in due i collegamenti.
    textEncoding: "base64",
  });
  console.log(`✓ Email di prova spedita a ${destinatario}.`);
  console.log("");
  console.log("  Controlla la casella. Se non arriva entro qualche minuto guarda");
  console.log("  anche nella posta indesiderata: se è lì, il problema non è più");
  console.log("  la configurazione ma la reputazione del mittente.");
} catch (errore) {
  console.error("✗ L'accesso funziona, ma l'invio no.");
  console.error("");
  for (const riga of spiega(errore)) console.error(`  ${riga}`);
  process.exit(1);
}
