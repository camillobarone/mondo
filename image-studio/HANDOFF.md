# Handoff — Mondo Image Studio

Stato del lavoro al momento del passaggio di consegne. Serve a riprendere in una
conversazione nuova senza rifare le stesse scoperte.

---

## In una riga

Generazione di immagini in locale per un'agenzia immobiliare, su GPU Intel Arc.
**Installato e funzionante sul PC dell'utente**: le immagini da testo escono
correttamente. Resta aperto il virtual staging, che esaurisce la memoria video.

---

## Chi e su cosa

**Camillo Barone**, Mondo Immobiliare Lecce. Non è uno sviluppatore: va guidato
con istruzioni esplicite, un passo alla volta, senza dare per scontato nulla —
nemmeno "apri una finestra PowerShell" o "vai nella finestra dei comandi". Ogni
volta che sono stato vago si è bloccato. Lo scopo dichiarato è ridurre un
rischio professionale in azienda.

**Il suo PC:**

| | |
|---|---|
| GPU | Intel Arc **B580**, 12 GB VRAM (11,8 usabili) |
| Sistema | Windows 11, utente `P.S.Assemblato` |
| Python | 3.10.10 e 3.14 installati; si usa la **3.10** (la 3.14 non ha ancora i pacchetti PyTorch) |
| torch | 2.13.0+xpu |
| ComfyUI | 0.30.0 in `C:\Users\P.S.Assemblato\ComfyUI` |
| Progetto | `C:\Users\P.S.Assemblato\mondo\image-studio` |
| OneDrive | **attivo**: il Desktop reale non è `%USERPROFILE%\Desktop` |

---

## Dove sta il codice

Repository `camillobarone/mondo`, ramo `claude/local-image-generation-ai-ydvnqb`,
**PR #1** (draft, aperta, `mergeable_state: clean`, nessuna CI nel repo).

Il ramo base è `jules-4092590956749443987-c47f811b`, non `main`.

```
image-studio/
├── avvia.bat                doppio clic: aggiorna, accende il motore, apre la dashboard
├── crea-collegamento.bat    icona sul Desktop, una volta sola
├── avvia-comfyui.bat        solo il motore, per l'uso da terminale
├── genera.bat               wrapper della CLI
├── install/                 1-installa.ps1, 2-scarica-modelli.ps1, download_models.py
├── src/mondo_image/
│   ├── graphs.py            costruzione dei grafi ComfyUI (formato API)
│   ├── presets.py           prompt e parametri per tipo di lavoro
│   ├── client.py            client HTTP verso ComfyUI
│   ├── cli.py               comandi da terminale
│   ├── dashboard.py         server locale della dashboard
│   └── web/index.html       la pagina
├── tests/                   51 test, tutti verdi
└── tools/extract_comfy_registry.py
```

`python -m pytest image-studio/tests/ -q` → **51 passati**.

---

## Come funziona, in due righe

ComfyUI è il motore. Il progetto costruisce i grafi in **formato API** con
funzioni Python (`graphs.py`) e li accoda via HTTP. Dashboard e CLI chiamano le
stesse funzioni: **nessuna logica duplicata**, una correzione vale per entrambe.

Quattro modalità: `staging` (arreda una stanza vera mantenendone la geometria
via ControlNet su contorni Canny), `retouch` (rigenera solo una zona
mascherata), `text`, `upscale`.

---

## Decisioni da non ribaltare senza motivo

**SDXL, non FLUX.** Su Arc/Windows FLUX non carica in modo affidabile e non
entrerebbe in 12 GB. SDXL ha anche l'ecosistema ControlNet più maturo.

**PyTorch nativo XPU, non `intel-extension-for-pytorch`.** IPEX è in end-of-life
da marzo 2026. Torch XPU va installato **prima** dei requisiti di ComfyUI: lì
`torch` non è pinnato, quindi pip lo considera soddisfatto e non lo sostituisce
con la build CPU.

**Zero custom node.** Su Arc sono la prima causa di installazioni che si rompono
dopo un aggiornamento. Il preprocessore dei contorni è `Canny`, nativo.

**Formato API, non workflow della UI.** Il formato UI richiede coordinate, id
dei link e un ordine preciso dei widget: a mano si sbaglia.

---

## Trappole già pagate — non ripeterle

**PowerShell 5.1 con `ErrorActionPreference = "Stop"`** tratta come errore
fatale qualsiasi riga che un programma esterno scrive sul canale di errore,
anche quando quel programma riesce. `py.exe`, `git` e `pip` lo fanno di
routine. Negli script si usa `Continue` più controllo del codice di uscita.

**`/object_info` di ComfyUI descrive i menu a tendina in due forme:**
`(["a.safetensors"], …)` per i nodi storici e `("COMBO", {"options": […]})`
per lo schema V3. Vanno lette entrambe, altrimenti i nodi V3 — fra cui
`UpscaleModelLoader` — risultano privi di modelli.

**Su Arc lo stadio finale in precisione ridotta produce immagini nere.**
Il sintomo nel log è `invalid value encountered in cast`. Serve `--fp32-vae`.

**Windows rifiuta porte riservate a Hyper-V/WSL** con `WinError 10013`, anche
se nessuno le usa. La dashboard ne prova diverse e poi ne fa scegliere una al
sistema.

**Con OneDrive attivo il Desktop non è `%USERPROFILE%\Desktop`.** Va chiesto a
Windows con `GetFolderPath('Desktop')`.

**Fra i VAE ComfyUI elenca `pixel_space`**, che è una modalità interna e non un
file: la selezione automatica scarta le voci senza estensione di modello.

---

## Misure reali sull'hardware

| Operazione | Tempo |
|---|---|
| `text` 1024×1024, 28 passi | 12–14 s (23–26 s la prima, col caricamento) |
| Avvio del motore | ~40 s |

Le stime iniziali (6–9 s) erano ottimistiche e sono già state corrette nel README.

---

## Il punto aperto

**Il virtual staging esaurisce la memoria video.** Errore:
`level_zero backend failed with error: 40 (UR_RESULT_ERROR_OUT_OF_RESOURCES)`
nel nodo `KSampler`. Causa: SDXL (~5 GB) più ControlNet Union (~2,5 GB) più le
attivazioni superano lo spazio libero quando Windows sta già usando parte della
scheda per il desktop.

Già fatto: margine riservato portato da 0,6 a 1,5 GB. **Non ancora verificato
sul suo PC.**

Se non basta, la scala dei rimedi — tutti passabili senza modificare file,
perché `avvia-comfyui.bat` inoltra gli argomenti:

1. `.\avvia-comfyui.bat --lowvram` — tiene in VRAM solo la parte in uso
2. `--cpu-vae` al posto di `--fp32-vae` — libera altra memoria
3. `--disable-smart-memory` — se l'errore compare cambiando tipo di modello

Foto di prova che aveva usato:
`F:\immobili 2026\Moteroni Mancarella\foto\2.jpg`

---

## Altri punti in sospeso

- **La dashboard non è mai stata provata sul suo PC.** È verificata solo contro
  un finto ComfyUI (13 test). L'ultimo tentativo si è fermato su `WinError 10013`,
  corretto ma non riprovato.
- **Il checkpoint fotorealistico non è scaricato.** Sta usando SDXL base, che
  sugli interni rende poco. Comando:
  `.\install\2-scarica-modelli.ps1 -Only juggernaut-xl` (7 GB).
- **Nessuna immagine di virtual staging è ancora uscita.** È il vero criterio
  per capire se lo strumento gli serve.

---

## Cosa non è verificabile dall'ambiente di sviluppo

- `huggingface.co` non è raggiungibile dalla rete del container. Per questo il
  downloader **risolve i nomi dei file interrogando l'API del repository**
  invece di cablarli.
- Non c'è GPU Intel: nessuna generazione reale.
- PowerShell si può usare per il controllo di sintassi scaricando
  `PowerShell/PowerShell` da GitHub — è stato utile per riprodurre un difetto
  reale con un finto `py.exe`.

---

## Come parlargli

Un comando alla volta, con i passaggi numerati. Distinguere sempre in modo
esplicito **quale finestra** e **cosa è un comando da incollare** rispetto a
**cosa è output da leggere**: ha già provato a eseguire delle righe di output
scambiandole per comandi, ed è stata colpa di come le avevo presentate.

Scrive in italiano e va risposto in italiano.
