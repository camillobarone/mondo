# Handoff — Mondo Image Studio

Stato del lavoro al momento del passaggio di consegne. Serve a riprendere in una
conversazione nuova senza rifare le stesse scoperte.

Ultimo aggiornamento: 3 agosto 2026, sera.

---

## In una riga

Generazione di immagini in locale per un'agenzia immobiliare, su GPU Intel Arc.
Installato sul PC dell'utente. La generazione da testo ha già funzionato, poi si
è rotta per una **mia regressione sul margine di memoria**, ora ripristinata:
**la conferma che sia tornata a funzionare è il primo punto da chiudere domani.**
Il virtual staging non è mai riuscito.

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
| GPU | Intel Arc **B580**, 12 GB VRAM (11,6 usabili) |
| RAM di sistema | 31,8 GB |
| Sistema | Windows 11, utente `P.S.Assemblato` |
| Python | 3.10.10 e 3.14 installati; si usa la **3.10** |
| torch | 2.13.0+xpu |
| ComfyUI | 0.30.0 in `C:\Users\P.S.Assemblato\ComfyUI` |
| Progetto | `C:\Users\P.S.Assemblato\mondo\image-studio` |
| OneDrive | **attivo**: il Desktop reale non è `%USERPROFILE%\Desktop` |
| Modelli | SDXL base, ControlNet Union, VAE, RealESRGAN. **Manca juggernaut-xl.** |

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
├── tests/                   71 test, tutti verdi
└── tools/extract_comfy_registry.py
```

`python -m pytest image-studio/tests/ -q` → **71 passati**.

---

## Come funziona, in due righe

ComfyUI è il motore. Il progetto costruisce i grafi in **formato API** con
funzioni Python (`graphs.py`) e li accoda via HTTP. Dashboard e CLI chiamano le
stesse funzioni: **nessuna logica duplicata**, una correzione vale per entrambe.

Quattro modalità: `staging` (arreda una stanza vera mantenendone la geometria
via ControlNet su contorni Canny), `retouch` (rigenera solo una zona
mascherata), `text`, `upscale`.

---

## Il comando con cui lavora

Non usa i `.bat` (vedi le trappole). La riga che funziona, incollata in una
PowerShell nuova:

```powershell
cd "C:\Users\P.S.Assemblato\mondo\image-studio"; git pull
```

```powershell
$env:PYTHONPATH="$PWD\src"; & "$((Get-Content .\comfy-path.txt -Raw).Trim())\venv\Scripts\python.exe" -m mondo_image.dashboard
```

`Get-Content -Raw`, non `Get-Content`: in PowerShell 5.1 senza `-Raw` il
risultato è un array e `.Trim()` non è affidabile.

---

## L'errore da cui imparare, se leggi una cosa sola leggi questa

**Il virtual staging esauriva la memoria video. Per farcelo entrare ho alzato
`--reserve-vram` da 0.6 a 1.5. Il staging non è entrato lo stesso, e la
generazione da testo — che funzionava — ha cominciato a uscire nera.**

Sono seguiti due giorni di diagnosi in cui ho incolpato, nell'ordine: il VAE,
`--lowvram`, la dashboard, il soggetto della richiesta. Ho fatto provare
all'utente `--lowvram`, poi `--lowvram --cpu-vae`, poi il ritorno alla
configurazione pulita — che però conteneva ancora il margine a 1.5, quindi
falliva comunque. Nel frattempo lui ha scritto *«lasciamo perdere»*.

Il meccanismo: un margine largo convince ComfyUI che il modello non entri in
VRAM, e glielo fa caricare a pezzi convertendo i pesi durante il caricamento.
Su Arc quel percorso produce valori non numerici. È **lo stesso meccanismo di
`--lowvram`**: per questo toglierlo non bastava.

Tre regole che ne discendono:

1. **Su Arc, non rispondere a un errore di memoria stringendo la memoria.**
   `--lowvram` e `--reserve-vram` alto portano al nero. La leva giusta è la
   **risoluzione di lavoro**.
2. **Un cambiamento che non risolve il problema per cui è stato fatto va
   annullato subito**, non lasciato lì "che male non fa".
3. **Quando un sintomo cambia dopo una modifica, sospetta la modifica**, non il
   componente che il sintomo suggerisce. `git log -S` avrebbe chiuso la
   questione in cinque minuti: l'ho usato solo al terzo giro.

Il margine è tornato a **0.6** in `dashboard.py` e `avvia-comfyui.bat`, con un
test che blocca la regressione.

---

## Altre trappole già pagate — non ripeterle

**PowerShell 5.1 con `ErrorActionPreference = "Stop"`** tratta come errore
fatale qualsiasi riga che un programma esterno scrive sul canale di errore,
anche quando quel programma riesce. `py.exe`, `git` e `pip` lo fanno di
routine. Negli script si usa `Continue` più controllo del codice di uscita.

**`/object_info` di ComfyUI descrive i menu a tendina in due forme:**
`(["a.safetensors"], …)` per i nodi storici e `("COMBO", {"options": […]})`
per lo schema V3. Vanno lette entrambe, altrimenti i nodi V3 — fra cui
`UpscaleModelLoader` — risultano privi di modelli.

**Lo stadio finale in precisione ridotta produce immagini nere.** Sintomo nel
log: `invalid value encountered in cast`. Serve `--fp32-vae`, già di default.
Questa è la causa *numero due* del nero: la prima è il caricamento a pezzi.

**Windows rifiuta porte riservate a Hyper-V/WSL** con `WinError 10013`, anche
se nessuno le usa. La dashboard ne prova diverse e poi ne fa scegliere una al
sistema.

**Con OneDrive attivo il Desktop non è `%USERPROFILE%\Desktop`.** Va chiesto a
Windows con `GetFolderPath('Desktop')`.

**Fra i VAE ComfyUI elenca `pixel_space`**, che è una modalità interna e non un
file: la selezione automatica scarta le voci senza estensione di modello.

**Sul suo PC l'estensione `.bat` è associata a un editor di testo.** Il doppio
clic su `avvia.bat` ne mostra il contenuto invece di eseguirlo. **Conseguenza
pratica: nessun `.bat` gli si può far eseguire con un doppio clic.** Vanno
lanciati da PowerShell o tramite un collegamento a `cmd.exe`.

**Il menu degli stili non seguiva la scheda.** Restava su "interior" anche su
"Crea", e il suffisso d'interni si attaccava a qualunque soggetto: alla
richiesta di una spiaggia rispondeva con una stanza con vista mare. L'immagine
era tecnicamente corretta, il che rendeva il difetto difficile da riconoscere.
Ora ogni scheda parte dal proprio stile.

---

## Misure reali sull'hardware

| Operazione | Tempo |
|---|---|
| `text` 1024×1024, 28 passi | 12–14 s (23–26 s la prima, col caricamento) |
| Avvio del motore | ~40 s |

Misurate con `--reserve-vram 0.6`. Le stime iniziali (6–9 s) erano ottimistiche
e sono già state corrette nel README.

---

## Da fare domani, in ordine

1. **Confermare che la generazione da testo è tornata a funzionare.** Gli ho
   lasciato i tre passi (chiudi, `git pull`, rilancia senza opzioni, Ctrl+F5) e
   il prompt della coppia sulla spiaggia al tramonto. È l'unica cosa che serve
   sapere per capire se il ripristino a 0.6 ha chiuso la partita.
   **Finché non arriva quella conferma, non toccare altro.**

2. **Virtual staging, per l'altra via.** La memoria non va stretta, va chiesta
   meno: generare a risoluzione più bassa (es. bucket 832×1216 invece di
   1216×832 a seconda della foto, o un gradino sotto) e riportare su con
   `upscale`, che gira da solo senza ControlNet in VRAM. Da valutare anche se
   `graphs.virtual_staging` possa scaricare il ControlNet prima del decode.
   Foto di prova sua: `F:\immobili 2026\Moteroni Mancarella\foto\2.jpg`

3. **Scaricare `juggernaut-xl`** (7 GB) — SDXL base sugli interni rende poco:
   `.\install\2-scarica-modelli.ps1 -Only juggernaut-xl`
   Da fare **dopo** che il staging funziona: non ha senso scaricare 7 GB per un
   percorso che ancora fallisce.

4. **La scorciatoia sul Desktop esiste** (`C:\Users\P.S.Assemblato\Desktop\Mondo
   Image Studio.lnk`) e punta a `cmd.exe /c "…\avvia.bat"`. Gli ho detto di non
   usarla finché stiamo facendo prove, perché congelerebbe opzioni sbagliate.
   **Quando la configurazione è stabile, il lavoro da chiudere è renderla di
   nuovo la via normale** — era la sua richiesta esplicita: «vorrei usare questa
   app senza dovere ogni volta usare PowerShell». Attenzione: se le si passano
   argomenti serve `cmd.exe /c call "…\avvia.bat" --opzione`, con `call`,
   altrimenti `cmd` mangia le virgolette.

---

## Domande che ha fatto, e cosa gli ho risposto

**«Si possono generare video?»** Tecnicamente sì, in pratica gli ho sconsigliato
di provarci adesso. Su 12 GB entrano solo i modelli piccoli (Wan 2.1 1.3B,
LTX-Video, SVD); i modelli veri stanno fra 28 e 80 GB. In più il video ha più
stadi delle immagini e gli stessi punti deboli su Arc — lo stesso meccanismo che
produce il nero. Gli ho anche fatto notare un problema del suo mestiere, non del
PC: un video generato *inventa* quello che c'è fuori inquadratura, e mostrare a
un acquirente stanze che non esistono è pubblicità ingannevole. Il virtual
staging su foto ferma è difendibile («arredamento simulato»), un video no.
Alternativa proposta e non ancora sviluppata: **movimento di camera sulle foto
vere** (carrellate, zoom, parallasse), che non richiede AI, gira su qualsiasi PC
e mostra l'immobile reale. Se la riprende, è un lavoro di giorni.

---

## Cosa non è verificabile dall'ambiente di sviluppo

- `huggingface.co` non è raggiungibile dalla rete del container. Per questo il
  downloader **risolve i nomi dei file interrogando l'API del repository**
  invece di cablarli.
- Non c'è GPU Intel: nessuna generazione reale. Tutto ciò che riguarda la
  precisione numerica e la memoria si scopre solo sul suo PC.
- PowerShell si può usare per il controllo di sintassi scaricando
  `PowerShell/PowerShell` da GitHub — è stato utile per riprodurre un difetto
  reale con un finto `py.exe`.

---

## Come parlargli

Un comando alla volta, con i passaggi numerati. Distinguere sempre in modo
esplicito **quale finestra** e **cosa è un comando da incollare** rispetto a
**cosa è output da leggere**: ha già provato a eseguire delle righe di output
scambiandole per comandi, ed è stata colpa di come le avevo presentate.

Quando l'errore è mio, dirlo. Ha investito due giorni su una regressione che
avevo introdotto io, e sapere che la causa era identificata — non un mistero
dell'hardware — è ciò che gli ha fatto riprendere in mano la cosa dopo
«lasciamo perdere».

Scrive in italiano e va risposto in italiano.
