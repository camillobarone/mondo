#!/usr/bin/env node
/**
 * Rifa' i gemelli in testo semplice: CONSEGNA.txt e HANDOFF.txt.
 *
 *   node scripts/testo.mjs            li riscrive
 *   node scripts/testo.mjs --controlla  dice solo se sono indietro (per il CI)
 *
 * Esistono perche' i .md si leggono male con il Blocco note: le tabelle
 * diventano una fila di barre verticali e i titoli si riempiono di cancelletti.
 * Il .txt e' la copia che si apre su qualsiasi computer senza installare
 * niente, ed e' quella che finisce stampata in cartella.
 *
 * Prima si riscrivevano a mano, e infatti il 28 agosto 2026 erano fermi al 5:
 * tre settimane di lavoro raccontate solo nella versione che l'agenzia non
 * apre. Da qui in poi si rifanno con un comando, e le due versioni non possono
 * piu' allontanarsi in silenzio.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const soloControllo = process.argv.includes("--controlla");
const LARGHEZZA = 79;

/** Toglie la punteggiatura del markdown lasciando il testo che si legge. */
function pulisci(riga) {
  return riga
    // Un collegamento vero porta con se' l'indirizzo, uno interno no: su carta
    // "(deploy/README.md)" e' rumore, "(https://...)" e' l'unica cosa utile.
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1 ($2)")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|[\s(«"])\*([^*]+)\*/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    // Il grassetto che comincia su una riga e finisce sulla successiva lascia
    // gli asterischi spaiati: nel testo semplice non servono comunque.
    .replace(/\*\*/g, "")
    .replace(/&nbsp;/g, " ");
}

/** Spezza un testo lungo mantenendo un rientro fisso. */
function accapo(testo, rientro, larghezza = LARGHEZZA) {
  const parole = testo.split(/\s+/).filter(Boolean);
  const righe = [];
  let corrente = "";
  for (const parola of parole) {
    if (corrente && rientro + corrente.length + 1 + parola.length > larghezza) {
      righe.push(" ".repeat(rientro) + corrente);
      corrente = parola;
    } else {
      corrente = corrente ? corrente + " " + parola : parola;
    }
  }
  if (corrente) righe.push(" ".repeat(rientro) + corrente);
  return righe;
}

/** Le celle di una riga di tabella, senza le barre esterne. */
function celle(riga) {
  return riga
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((c) => pulisci(c).trim());
}

const separatore = (riga) => /^\s*\|[\s:|-]+\|\s*$/.test(riga);

/**
 * Una tabella diventa due cose diverse a seconda di com'e' fatta.
 *
 * Con un'intestazione vera ("File | Cosa contiene") le colonne sono un titolo
 * e la sua spiegazione: si scrivono su righe separate, altrimenti la
 * spiegazione non ci sta in ottanta colonne. Senza intestazione ("| | |") sono
 * un elenco di voci e valori corti, e si allineano in due colonne: e' come
 * sono scritte le schede tecniche, e si leggono a colpo d'occhio.
 */
function tabella(righe) {
  const intestazione = celle(righe[0]);
  const corpo = righe.slice(2).filter((r) => r.trim());
  const conTitolo = intestazione.some((c) => c !== "");
  const fuori = [];

  if (!conTitolo) {
    const dati = corpo.map(celle);
    const largo = Math.max(...dati.map((d) => (d[0] ?? "").length));
    for (const d of dati) {
      const valore = d.slice(1).filter(Boolean).join(" · ");
      const prefisso = "  " + (d[0] ?? "").padEnd(largo + 3);
      const spezzate = accapo(valore, prefisso.length);
      // La prima riga si attacca all'etichetta, le altre restano incolonnate.
      fuori.push(prefisso + spezzate[0].trimStart());
      fuori.push(...spezzate.slice(1));
    }
    return fuori;
  }

  for (const riga of corpo) {
    const d = celle(riga);
    fuori.push("  " + d[0]);
    const valore = d.slice(1).filter(Boolean).join(" · ");
    if (valore) fuori.push(...accapo(valore, 6));
    fuori.push("");
  }
  if (fuori.at(-1) === "") fuori.pop();
  return fuori;
}

function converti(md) {
  const righe = md.split("\n");
  const fuori = [];
  let dentroCodice = false;

  for (let i = 0; i < righe.length; i++) {
    const riga = righe[i];

    if (/^```/.test(riga)) {
      dentroCodice = !dentroCodice;
      continue;
    }
    if (dentroCodice) {
      fuori.push(riga.trim() ? "    " + riga : "");
      continue;
    }

    // Titolo del documento, dentro una cornice.
    const titolo = riga.match(/^#\s+(.+)$/);
    if (titolo) {
      const testo = pulisci(titolo[1]).toUpperCase();
      const bordo = "=".repeat(testo.length);
      fuori.push(bordo, testo, bordo, "");
      while (righe[i + 1] === "") i++;
      continue;
    }

    // Capitolo: maiuscolo e sottolineato, come nei documenti battuti a macchina.
    const capitolo = riga.match(/^##\s+(.+)$/);
    if (capitolo) {
      const testo = pulisci(capitolo[1]).toUpperCase();
      while (fuori.at(-1) === "") fuori.pop();
      fuori.push("", "", testo, "-".repeat(testo.length), "");
      while (righe[i + 1] === "") i++;
      continue;
    }

    // Sottotitolo: resta in minuscolo, staccato sopra e sotto.
    const sotto = riga.match(/^#{3,}\s+(.+)$/);
    if (sotto) {
      while (fuori.at(-1) === "") fuori.pop();
      fuori.push("", "", pulisci(sotto[1]), "");
      while (righe[i + 1] === "") i++;
      continue;
    }

    // Riga orizzontale: nel testo semplice basta lo spazio bianco.
    if (/^---+\s*$/.test(riga)) continue;

    // Tabella: si raccoglie tutta e si consegna al formattatore.
    if (/^\s*\|/.test(riga) && separatore(righe[i + 1] ?? "")) {
      const blocco = [riga, righe[i + 1]];
      let j = i + 2;
      while (j < righe.length && /^\s*\|/.test(righe[j])) blocco.push(righe[j++]);
      fuori.push(...tabella(blocco), "");
      i = j - 1;
      continue;
    }

    // Citazione: la barra a sinistra si vede anche senza colori.
    const citazione = riga.match(/^>\s?(.*)$/);
    if (citazione) {
      fuori.push("  | " + pulisci(citazione[1]).trimEnd());
      continue;
    }

    fuori.push(pulisci(riga).trimEnd());
  }

  // Non piu' di due righe vuote di fila, e una sola a fine file.
  const stretto = [];
  for (const riga of fuori) {
    if (riga === "" && stretto.at(-1) === "" && stretto.at(-2) === "") continue;
    stretto.push(riga);
  }
  while (stretto.at(-1) === "") stretto.pop();
  // Fine riga di Windows: questi file si aprono con il Blocco note, e i vecchi
  // erano scritti cosi'. Con i soli LF certi programmi mostrano tutto il
  // documento su una riga sola.
  return stretto.join("\r\n") + "\r\n";
}

let indietro = 0;
for (const nome of ["CONSEGNA", "HANDOFF"]) {
  const md = fs.readFileSync(path.join(root, `${nome}.md`), "utf8");
  const atteso = converti(md).replace(
    // Dentro il .txt, dire "esiste anche come .txt" non aiuta nessuno.
    /Esiste anche come CONSEGNA\.txt, stessa cosa\s*\n?\s*in testo semplice[^.]*\./,
    // Va spezzata cosi': la prima riga si attacca a "Aggiornato al ... 2026."
    // e altrimenti sfonda le ottanta colonne.
    "Questa è la versione in testo semplice,\r\n" +
      "da aprire con il Blocco note senza bisogno di niente. L'originale è\r\n" +
      "CONSEGNA.md.",
  );
  const dove = path.join(root, `${nome}.txt`);
  const attuale = fs.existsSync(dove) ? fs.readFileSync(dove, "utf8") : "";

  if (attuale === atteso) {
    console.log(`${nome}.txt: gia' allineato`);
    continue;
  }
  indietro++;
  if (soloControllo) {
    console.log(`${nome}.txt: INDIETRO rispetto a ${nome}.md`);
  } else {
    fs.writeFileSync(dove, atteso);
    console.log(`${nome}.txt: riscritto (${atteso.length} caratteri)`);
  }
}

if (soloControllo && indietro > 0) {
  console.log(`\n${indietro} file da rifare: node scripts/testo.mjs`);
  process.exit(1);
}
