# Mondo Image Studio

Generazione di immagini **in locale**, sul tuo PC, senza abbonamenti, senza inviare
foto dei clienti a servizi esterni e senza limiti di crediti.

Pensato per una **GPU Intel Arc con 12 GB di VRAM su Windows** (tipicamente una
Arc B580). Il motore è ComfyUI; questo progetto aggiunge l'installazione
automatica, i modelli giusti e una riga di comando che nasconde la complessità.

---

## Cosa sa fare

| Comando   | A cosa serve                                                          |
|-----------|-----------------------------------------------------------------------|
| `staging` | Arreda una stanza vuota, o la mostra ristrutturata, **mantenendo muri, finestre e prospettiva** |
| `retouch` | Rigenera solo una zona che marchi tu: togliere un mobile, rifare un pavimento, pulire una parete |
| `text`    | Crea un'immagine dal nulla: copertine articoli, grafiche social, immagini editoriali |
| `upscale` | Porta una foto a risoluzione da stampa o da portale                   |
| `doctor`  | Dice se tutto è a posto e quali modelli hai installato                |

---

## Requisiti

- Windows 10 o 11
- GPU Intel Arc (Alchemist o Battlemage) con almeno 8 GB di VRAM — con 12 GB stai comodo
- **Driver Intel Arc aggiornati**: è il punto che fa fallire più installazioni.
  Scaricali da [intel.com](https://www.intel.com/content/www/us/en/download/785597/)
- [Python 3.12](https://www.python.org/downloads/) (spunta *Add python.exe to PATH*)
- [Git per Windows](https://git-scm.com/download/win)
- Spazio libero su disco: **15 GB** per l'installazione minima, **30 GB** per quella completa

---

## Installazione

Apri PowerShell nella cartella `image-studio` ed esegui, in quest'ordine:

```powershell
# 1. Motore e ambiente Python (circa 10 minuti)
powershell -ExecutionPolicy Bypass -File .\install\1-installa.ps1

# 2. Modelli (fino a 24 GB — vai a prendere un caffè)
powershell -ExecutionPolicy Bypass -File .\install\2-scarica-modelli.ps1
```

Se un download si interrompe, rilancia lo stesso comando: riprende da dove era
rimasto.

### Quanto scaricare

| Livello | Comando | Peso |
|---|---|---|
| Minimo, tutto funziona | `.\install\2-scarica-modelli.ps1 -RequiredOnly` | 10 GB |
| Consigliato, aggiunge il fotorealismo | il comando sopra, poi `.\install\2-scarica-modelli.ps1 -Only juggernaut-xl` | 17 GB |
| Tutto, con un secondo checkpoint fotorealistico | `.\install\2-scarica-modelli.ps1` | 24 GB |

Il livello minimo usa SDXL base: funziona, ma sugli interni resa meno convincente.
Il checkpoint fotorealistico è ciò che alza davvero la qualità degli annunci, e
puoi aggiungerlo in qualsiasi momento senza rifare nulla.

Per installare ComfyUI altrove:
`.\install\1-installa.ps1 -ComfyPath D:\AI\ComfyUI`

---

## Uso quotidiano: la dashboard

Doppio clic su **`avvia.bat`**. Accende il motore, apre il browser e ti presenta
la pagina di lavoro. Non serve il terminale.

Quattro schede:

| Scheda | Cosa fa |
|---|---|
| **Arreda** | Virtual staging: carichi la foto della stanza vuota e descrivi l'arredamento |
| **Ritocca** | Dipingi col mouse sulla foto la zona da rigenerare — niente maschere da preparare in Paint |
| **Crea** | Genera dal nulla: copertine, grafiche social |
| **Ingrandisci** | Porta una foto a risoluzione da stampa |

I risultati compaiono nella pagina e restano nella galleria in basso. I file
finiscono comunque in `output/`.

Chiudendo la finestra nera si spegne tutto.

---

## Uso da terminale

La riga di comando resta disponibile, ed è più comoda per il lavoro ripetitivo:
stessa logica, stessi grafi, stessi preset. Il motore va acceso una volta
(`avvia-comfyui.bat`) e lasciato aperto, poi generi da un altro terminale.

### Verifica dell'installazione

```powershell
.\genera.bat doctor
```

Devi vedere `Stato: attivo` e l'elenco dei modelli, con un asterisco su quelli
scelti automaticamente.

### Virtual staging — arredare una stanza vuota

```powershell
.\genera.bat staging C:\foto\salone-vuoto.jpg ^
  "soggiorno arredato in stile moderno, divano grigio in tessuto, tavolino in legno chiaro, tappeto beige, grande pianta d'appartamento"
```

La foto originale viene ridotta ai suoi contorni e questi vengono imposti al
modello: **muri, finestre, porte e prospettiva restano dov'erano**. Il modello
riempie il resto.

Le due manopole che contano:

- `--control 0.9` tiene la geometria più fedele (default 0.8). Alzalo se il
  modello ti sposta le finestre.
- `--denoise 0.6` cambia meno la foto, `--denoise 0.85` cambia molto di più
  (default 0.72). Alzalo se l'arredamento risulta timido.

Per far vedere un immobile **ristrutturato** invece che arredato:

```powershell
.\genera.bat staging C:\foto\cucina-vecchia.jpg ^
  "cucina completamente ristrutturata, mobili bianchi opachi, top in gres, pavimento in parquet rovere chiaro" ^
  --preset renovation
```

### Ritocco mirato — togliere o cambiare una cosa sola

Serve una **maschera**: un PNG delle stesse proporzioni della foto, nero ovunque
e **bianco solo dove vuoi che il modello intervenga**. La disegni in due minuti
con Paint, Photopea o GIMP.

```powershell
.\genera.bat retouch C:\foto\camera.jpg C:\foto\camera-maschera.png ^
  "parete intonacata bianca, pulita, senza oggetti"
```

- `--grow 20` allarga la zona di intervento se restano aloni ai bordi
- `--feather 24` ammorbidisce lo stacco fra zona rigenerata e foto originale

### Immagini per blog e social

```powershell
.\genera.bat text "vicolo del centro storico di Lecce in pietra leccese, luce del tramonto" ^
  --preset social --aspect wide -n 3
```

`--aspect` accetta `square`, `landscape`, `wide`, `portrait`, `story`.
`-n 3` genera tre varianti; su 12 GB non andare oltre 4 per volta.

### Ingrandimento

```powershell
.\genera.bat upscale C:\foto\salone.jpg --factor 2
```

Non usa diffusione, quindi consuma pochissima VRAM ed è veloce.

### Preset disponibili

| Preset       | Quando usarlo                                     |
|--------------|---------------------------------------------------|
| `interior`   | Interni arredati (default per `staging` e `retouch`) |
| `exterior`   | Facciate, ville, masserie, viste sul mare        |
| `renovation` | Simulazioni di ristrutturazione                   |
| `social`     | Grafiche social e copertine, con spazio per il testo |
| `photo`      | Fotorealismo generico (default per `text`)        |

I preset aggiungono in automatico il gergo fotografico che sposta davvero il
risultato (obiettivo, luce, resa) e i negativi che tengono lontani gli artefatti.
Tu descrivi solo il soggetto. Si modificano in `src/mondo_image/presets.py`.

### Risultati riproducibili

Ogni immagine nasce da un *seed*. Con `--seed 12345` ottieni sempre lo stesso
risultato a parità di prompt: utile per cambiare una sola cosa alla volta.

---

## Prestazioni attese su Arc B580

| Operazione                    | Tempo indicativo |
|-------------------------------|------------------|
| `text` 1024×1024, 28 passi    | 12–14 secondi    |
| `staging` (con ControlNet)    | 18–25 secondi    |
| `upscale` 2×                  | 2–4 secondi      |
| Primo avvio dopo l'accensione | 30–60 secondi (caricamento del modello) |

Il primo comando dopo l'avvio è sempre lento: il modello deve salire in VRAM.
Dal secondo in poi va a regime.

---

## Limiti, detti chiaramente

Meglio saperli adesso che scoprirli davanti a un cliente.

- **FLUX.1 e Qwen-Image non funzionano in modo affidabile su Arc con Windows.**
  Sono i modelli più chiacchierati, ma su questa piattaforma o non caricano o
  crashano. Questo progetto usa **SDXL**, che su Arc è solido — e che per il
  virtual staging è comunque la scelta migliore, perché ha l'ecosistema
  ControlNet e inpainting più maturo.
- **Intel Arc è più lenta di una NVIDIA equivalente**, circa 2–3 volte a parità
  di fascia. Per il volume di lavoro di un'agenzia è comunque abbondante.
- **Niente custom node.** Tutti i grafi usano solo nodi nativi di ComfyUI: è una
  scelta voluta, perché su Arc i custom node sono la prima causa di installazioni
  che si rompono dopo un aggiornamento.
- **I volti non sono il punto forte.** SDXL a queste risoluzioni fa fatica sui
  volti in secondo piano. Per gli interni non è un problema: i preset escludono
  già le persone.
- **Le maschere le disegni tu.** Non c'è selezione automatica degli oggetti.

---

## Uso professionale delle immagini

Il virtual staging è pratica normale e legittima nel settore, ma un'immagine
generata che mostra un immobile diverso da com'è può diventare un problema
contrattuale. La regola prudente, e quella che tutela l'agenzia:

- indica nell'annuncio che si tratta di **arredamento virtuale** o di una
  **simulazione di progetto**;
- affianca sempre almeno una foto reale dello stato attuale;
- non alterare elementi che incidono sul valore o sulla conformità: metrature,
  affacci, stato strutturale, difetti.

Per l'uso commerciale dei modelli scaricati: SDXL è distribuito con licenza
CreativeML Open RAIL++-M, Real-ESRGAN con licenza BSD-3. I checkpoint
fotorealistici opzionali hanno licenze proprie, indicate sulle rispettive pagine
Hugging Face — vanno controllate prima di un uso commerciale intensivo.

---

## Se qualcosa non va

**`genera.bat doctor` dice NON RAGGIUNGIBILE**
ComfyUI non è acceso. Apri `avvia-comfyui.bat` e lascialo aperto.

**L'installer dice che PyTorch non vede la GPU**
Driver Arc troppo vecchi, nel 90% dei casi. Aggiornali dal sito Intel, riavvia il
PC, rilancia `1-installa.ps1`.

**L'immagine esce tutta nera**
Su Arc lo stadio che converte il risultato in pixel, in precisione ridotta,
produce valori non numerici. `avvia-comfyui.bat` passa già `--fp32-vae` per
evitarlo. Se dovesse succedere lo stesso, sostituiscilo con `--cpu-vae`: sposta
quello stadio sul processore, più lento ma infallibile. Il sintomo nel log del
motore è `invalid value encountered in cast`.

**Memoria video esaurita** — nel log compare `UR_RESULT_ERROR_OUT_OF_RESOURCES`
Succede sul `staging`, che tiene in VRAM il modello e il ControlNet insieme.
Prima cosa da provare: chiudi il browser, che sulla stessa scheda consuma
parecchia memoria. Se non basta, riavvia il motore passandogli l'opzione senza
modificare niente:

```powershell
.\avvia-comfyui.bat --lowvram
```

Tiene in VRAM solo la parte di modello in uso: più lento, ma regge qualsiasi
combinazione. Il gradino successivo è `--cpu-vae`, che libera altra memoria
spostando lo stadio finale sul processore.

**Errori di memoria quando cambi tipo di modello**
Aggiungi `--disable-smart-memory` alla riga di comando in `avvia-comfyui.bat`.

**Il download di un modello si blocca**
Rilancia `2-scarica-modelli.ps1`: riprende dal punto in cui si era interrotto.

**Un modello obbligatorio non si scarica**
Scaricalo a mano dalla pagina Hugging Face e mettilo nella cartella giusta sotto
`ComfyUI\models\`: i checkpoint in `checkpoints`, il VAE in `vae`, il ControlNet
in `controlnet`, l'upscaler in `upscale_models`. Poi riavvia ComfyUI.

**Voglio vedere cosa sta facendo davvero**
`--dry-run` stampa il grafo che verrebbe eseguito, senza generare nulla e senza
bisogno del server acceso.

---

## Com'è fatto

```
image-studio/
├── avvia.bat                doppio clic: motore + dashboard nel browser
├── avvia-comfyui.bat        solo il motore, per l'uso da terminale
├── genera.bat               wrapper della CLI
├── install/
│   ├── 1-installa.ps1       ComfyUI + venv + PyTorch XPU
│   ├── 2-scarica-modelli.ps1
│   ├── download_models.py   download con ripresa, nomi risolti via API
│   └── models.json          manifest dei modelli
├── src/mondo_image/
│   ├── cli.py               comandi e selezione automatica dei modelli
│   ├── dashboard.py         server locale della dashboard
│   ├── web/index.html       la pagina
│   ├── graphs.py            costruzione dei grafi ComfyUI
│   ├── client.py            client HTTP verso ComfyUI
│   └── presets.py           prompt e parametri per tipo di lavoro
├── tools/
│   └── extract_comfy_registry.py
└── tests/
    ├── comfy_registry.json  snapshot dei nodi ComfyUI reali
    └── test_graphs.py
```

Due scelte che vale la pena conoscere se un giorno ci metti mano:

**Formato API invece di workflow visuali.** I grafi sono costruiti in Python nel
formato che ComfyUI accetta via HTTP, non come file di workflow della UI. Il
formato della UI richiede posizioni, id dei collegamenti e un ordine preciso dei
widget: scriverlo a mano significa sbagliarlo. L'interfaccia grafica di ComfyUI
resta comunque disponibile su <http://127.0.0.1:8188> per il lavoro manuale.

**I grafi sono testati contro il sorgente di ComfyUI.**
`tools/extract_comfy_registry.py` estrae dal codice di ComfyUI i nodi reali con i
loro input e produce `tests/comfy_registry.json`. I test verificano che ogni nodo
usato esista, che ogni input sia dichiarato, che nessun obbligatorio manchi e che
sampler, scheduler e tipi di ControlNet siano valori ammessi. Così un errore di
battitura si vede subito, non a metà di una generazione.

```powershell
# rigenerare lo snapshot dopo un aggiornamento di ComfyUI
python tools\extract_comfy_registry.py C:\Users\tuo\ComfyUI tests\comfy_registry.json
python -m pytest tests\ -q
```

---

## Aggiungere altri modelli

Qualsiasi checkpoint **SDXL** scaricato da Hugging Face o Civitai funziona: mettilo
in `ComfyUI\models\checkpoints`, riavvia ComfyUI e selezionalo con
`--checkpoint nome-del-file.safetensors`. `genera.bat doctor` elenca quelli
installati.

Lo stesso vale per le LoRA (in `ComfyUI\models\loras`), utili per fissare uno
stile ricorrente:

```powershell
.\genera.bat text "villa con piscina" --lora stile-agenzia.safetensors:0.8
```
