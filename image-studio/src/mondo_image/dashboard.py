"""Dashboard web locale: stesso motore della CLI, senza terminale.

Fa tre cose: accende ComfyUI e lo sorveglia, serve una pagina web, e traduce le
richieste della pagina nei grafi gia' definiti in `graphs`. La logica di
generazione non e' duplicata: se un difetto viene corretto nella CLI, la
dashboard lo eredita.

    python -m mondo_image.dashboard

Il server sta in ascolto solo su 127.0.0.1: non e' raggiungibile dalla rete.
"""

from __future__ import annotations

import base64
import binascii
import json
import mimetypes
import os
import subprocess
import sys
import threading
import time
import uuid
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

from . import graphs, presets
from .client import ComfyClient, ComfyError, DEFAULT_SERVER
from .cli import (
    CHECKPOINT_PREFERENCE,
    CONTROLNET_PREFERENCE,
    MAX_SEED,
    UPSCALER_PREFERENCE,
    VAE_PREFERENCE,
    _pick,
)

# Windows riserva interi intervalli di porte a Hyper-V, WSL e servizi di
# sistema: chi ci finisce sopra riceve un rifiuto (WinError 10013) anche senza
# che nessun programma le stia usando. Si prova una lista di candidate e, se
# nessuna e' libera, si lascia scegliere al sistema: tanto il browser lo
# apriamo noi, l'indirizzo non deve essere memorizzato a mano.
PORTE = (8765, 8766, 8899, 9765, 7321)
WEB_DIR = os.path.join(os.path.dirname(__file__), "web")
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "output")

# Gli stessi parametri di avvia-comfyui.bat: la dashboard non deve comportarsi
# diversamente dal lancio manuale.
#
# Il margine resta 0.6, che e' il valore con cui su B580 sono uscite immagini
# vere. Alzarlo a 1.5 per far entrare il virtual staging e' stato un errore:
# il staging ha esaurito la memoria lo stesso, e in piu' un margine largo
# convince ComfyUI che il modello non ci sta e glielo fa caricare a pezzi --
# la stessa strada di --lowvram, che su Arc produce valori non numerici e
# quindi immagini nere. Costo osservato: due giorni di diagnosi. Chi vuole
# provare un margine diverso lo passa come argomento, senza toccare il file.
ENGINE_FLAGS = ["--use-pytorch-cross-attention", "--reserve-vram", "0.6", "--fp32-vae"]

# Alcuni parametri escludono un nostro default invece di aggiungersi: ComfyUI
# accetterebbe entrambi, ma la combinazione non ha senso e il risultato
# dipenderebbe dall'ordine. Chi chiede --cpu-vae vuole lo stadio finale sul
# processore, quindi la precisione piena in VRAM non ha piu' ragione d'essere.
FLAG_INCOMPATIBILI = {"--cpu-vae": "--fp32-vae"}


def flag_motore(extra: list[str]) -> list[str]:
    """Unisce i nostri parametri a quelli passati a mano dall'utente.

    Serve a provare `--lowvram` e simili senza modificare nessun file: chi ha
    esaurito la memoria video deve poter cambiare impostazione riavviando con
    un parametro in piu'. I parametri dell'utente vanno in coda perche' a
    parita' di nome ComfyUI tiene l'ultimo.
    """
    flags = list(ENGINE_FLAGS)
    for parametro in extra:
        escluso = FLAG_INCOMPATIBILI.get(parametro)
        if escluso and escluso in flags:
            flags.remove(escluso)
    return [*flags, *extra]

# Limite di sicurezza sul caricamento delle foto: una foto da agenzia sta
# ampiamente sotto, e impedisce che una richiesta malformata occupi la memoria.
MAX_UPLOAD_BYTES = 40 * 1024 * 1024

# Quando ComfyUI muore durante una generazione, dalla dashboard si vede solo una
# connessione caduta: il motivo sta nel registro del motore. Allegarne la coda
# all'errore evita di dover chiedere all'utente di andarlo a leggere a mano —
# e il registro viene sovrascritto al riavvio successivo, quindi chi non lo
# guarda subito lo perde.
SEGNALI_MOTORE_MORTO = (
    "non risponde",
    "connection aborted",
    "connectionreset",
    "remotedisconnected",
    "connessione",
)
RIGHE_REGISTRO = 12


def coda_registro(percorso: str | None = None, righe: int = RIGHE_REGISTRO) -> str:
    """Ultime righe non vuote del registro del motore, o stringa vuota."""
    percorso = percorso or os.path.join(PROJECT_ROOT, "motore.log")
    try:
        with open(percorso, encoding="utf-8", errors="replace") as handle:
            lette = [riga.rstrip() for riga in handle if riga.strip()]
    except OSError:
        return ""
    return "\n".join(lette[-righe:])


def con_causa(messaggio: str) -> str:
    """Arricchisce col registro i soli errori che indicano un motore morto."""
    basso = messaggio.lower()
    if not any(segnale in basso for segnale in SEGNALI_MOTORE_MORTO):
        return messaggio
    coda = coda_registro()
    if not coda:
        return messaggio
    return f"{messaggio}\n\nUltime righe del registro del motore:\n{coda}"


# ------------------------------------------------------------------- motore


class Engine:
    """Avvia ComfyUI se non e' gia' in esecuzione, e lo spegne all'uscita."""

    def __init__(self, server: str = DEFAULT_SERVER, extra: list[str] | None = None) -> None:
        self.client = ComfyClient(server)
        self.process: subprocess.Popen | None = None
        self.log_path = os.path.join(PROJECT_ROOT, "motore.log")
        self.flags = flag_motore(extra or [])

    def comfy_path(self) -> str:
        path_file = os.path.join(PROJECT_ROOT, "comfy-path.txt")
        if not os.path.exists(path_file):
            raise RuntimeError(
                "comfy-path.txt non trovato: esegui prima install\\1-installa.ps1"
            )
        with open(path_file, encoding="utf-8") as handle:
            return handle.read().strip()

    def start(self, timeout: float = 180.0) -> bool:
        if self.client.is_up():
            return True  # gia' acceso a mano: non ne avviamo un secondo

        comfy = self.comfy_path()
        python = os.path.join(comfy, "venv", "Scripts", "python.exe")
        if not os.path.exists(python):  # fuori da Windows, per i test
            python = os.path.join(comfy, "venv", "bin", "python")
        if not os.path.exists(python):
            raise RuntimeError(f"Ambiente Python non trovato in {comfy}")

        print(f"Avvio del motore da {comfy}", flush=True)
        print(f"Impostazioni: {' '.join(self.flags)}", flush=True)
        log = open(self.log_path, "w", encoding="utf-8", errors="replace")
        self.process = subprocess.Popen(
            [python, "main.py", *self.flags],
            cwd=comfy,
            stdout=log,
            stderr=subprocess.STDOUT,
        )

        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if self.client.is_up():
                print("Motore pronto.", flush=True)
                return True
            if self.process.poll() is not None:
                raise RuntimeError(
                    f"Il motore si e' chiuso subito. Dettagli in {self.log_path}"
                )
            time.sleep(1.0)
        raise RuntimeError(f"Il motore non risponde dopo {int(timeout)}s")

    def stop(self) -> None:
        if not self.process or self.process.poll() is not None:
            return
        self.process.terminate()
        try:
            self.process.wait(timeout=15)
        except subprocess.TimeoutExpired:
            self.process.kill()


# -------------------------------------------------------------------- lavori


class Jobs:
    """Stato delle generazioni in corso, condiviso fra i thread del server."""

    def __init__(self) -> None:
        self._jobs: dict[str, dict] = {}
        self._lock = threading.Lock()

    def create(self) -> str:
        job_id = uuid.uuid4().hex
        with self._lock:
            self._jobs[job_id] = {"stato": "in_corso", "secondi": 0.0, "immagini": []}
        return job_id

    def update(self, job_id: str, **fields) -> None:
        with self._lock:
            if job_id in self._jobs:
                self._jobs[job_id].update(fields)

    def get(self, job_id: str) -> dict | None:
        with self._lock:
            job = self._jobs.get(job_id)
            return dict(job) if job else None


# ------------------------------------------------------- costruzione grafi


def _sampling(payload: dict, preset: presets.Preset, denoise: float) -> graphs.SamplingParams:
    seed = payload.get("seed")
    return graphs.SamplingParams(
        steps=int(payload.get("steps") or preset.steps),
        cfg=float(payload.get("cfg") or preset.cfg),
        sampler=preset.sampler,
        scheduler=preset.scheduler,
        seed=int(seed) if seed not in (None, "") else int.from_bytes(os.urandom(4), "big") % MAX_SEED,
        denoise=float(payload.get("denoise") or denoise),
    )


def _decode_image(data_url: str, destination: str) -> str:
    """Salva su disco un'immagine arrivata dalla pagina come data URL."""
    _, _, encoded = data_url.partition(",")
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ComfyError("Immagine non leggibile: invio interrotto o file corrotto") from exc
    if not raw:
        raise ComfyError("Immagine vuota")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise ComfyError(
            f"Immagine troppo grande ({len(raw) // 1024 // 1024} MB). "
            f"Il limite e' {MAX_UPLOAD_BYTES // 1024 // 1024} MB."
        )
    with open(destination, "wb") as handle:
        handle.write(raw)
    return destination


def _image_size(path: str) -> tuple[int, int]:
    try:
        from PIL import Image

        with Image.open(path) as img:
            return img.size
    except Exception:
        return (1024, 1024)


def tutta_nera(path: str) -> bool:
    """Vero se il file non contiene un solo pixel acceso.

    Su Arc capita che il calcolo arrivi in fondo senza errori ma produca
    valori non numerici: convertiti in pixel diventano un rettangolo nero.
    Una foto vera con tutti i canali a zero non esiste nella pratica, quindi
    il criterio non genera falsi allarmi.
    """
    try:
        from PIL import Image

        with Image.open(path) as img:
            estremi = img.convert("RGB").getextrema()
    except Exception:
        return False
    return all(canale[1] == 0 for canale in estremi)


def diagnosi_nera(flags: list[str]) -> str:
    """Spiega l'immagine nera e indica il rimedio buono per quella configurazione."""
    testo = (
        "L'immagine e' uscita completamente nera.\n\n"
        "Non dipende da cosa hai chiesto: il calcolo e' arrivato in fondo, ma la "
        "scheda video ha prodotto valori non validi e sullo schermo si vedono neri. "
        "E' un difetto noto delle GPU Intel Arc in precisione ridotta."
    )
    if "--lowvram" in flags:
        return (
            f"{testo}\n\nIl motore e' avviato con --lowvram, che e' la causa piu' "
            "frequente: in modalita' ridotta i pesi vengono convertiti mentre "
            "vengono caricati, ed e' li' che il conto si rompe. Riavvia senza "
            "--lowvram. Serviva solo per il virtual staging; per generare da testo "
            "non e' necessario."
        )
    return (
        f"{testo}\n\nRiavvia aggiungendo --cpu-vae al comando di avvio: sposta sulla "
        "CPU l'ultimo passaggio, quello che converte il risultato in pixel."
    )


def build_graph(payload: dict, client: ComfyClient, workdir: str) -> dict:
    """Traduce la richiesta della pagina in un grafo, come fa la CLI."""
    modo = payload.get("modo", "testo")
    preset = presets.get(payload.get("preset") or presets.DEFAULT_PRESET)
    soggetto = (payload.get("prompt") or "").strip()

    checkpoint = _pick(
        client.available("CheckpointLoaderSimple", "ckpt_name"), CHECKPOINT_PREFERENCE
    )
    vae = _pick(client.available("VAELoader", "vae_name"), VAE_PREFERENCE)

    if modo == "ingrandisci":
        modello = _pick(client.available("UpscaleModelLoader", "model_name"), UPSCALER_PREFERENCE)
        if not modello:
            raise ComfyError("Nessun modello di ingrandimento installato.")
        foto = _decode_image(payload["immagine"], os.path.join(workdir, "foto.png"))
        return graphs.upscale(
            image_name=client.upload_image(foto),
            model_name=modello,
            scale_back_to=0.5 if int(payload.get("fattore", 2)) == 2 else None,
        )

    if not checkpoint:
        raise ComfyError("Nessun checkpoint installato: esegui 2-scarica-modelli.ps1")

    if modo == "testo":
        if not soggetto:
            raise ComfyError("Descrivi cosa vuoi generare.")
        larghezza, altezza = graphs.best_sdxl_size(
            *ASPETTI.get(payload.get("formato", "landscape"), (4, 3))
        )
        return graphs.text_to_image(
            checkpoint=checkpoint,
            positive=preset.build_positive(soggetto),
            negative=preset.build_negative(payload.get("negativo", "")),
            width=larghezza,
            height=altezza,
            batch_size=max(1, min(4, int(payload.get("quantita", 1)))),
            params=_sampling(payload, preset, denoise=1.0),
            vae_name=vae,
        )

    if not payload.get("immagine"):
        raise ComfyError("Serve una foto di partenza.")
    foto = _decode_image(payload["immagine"], os.path.join(workdir, "foto.png"))
    larghezza, altezza = graphs.best_sdxl_size(*_image_size(foto))
    nome_foto = client.upload_image(foto)

    if modo == "arreda":
        controlnet = _pick(
            client.available("ControlNetLoader", "control_net_name"), CONTROLNET_PREFERENCE
        )
        if not controlnet:
            raise ComfyError("ControlNet non installato: serve per il virtual staging.")
        if not soggetto:
            raise ComfyError("Descrivi come vuoi che diventi la stanza.")
        return graphs.virtual_staging(
            checkpoint=checkpoint,
            image_name=nome_foto,
            positive=preset.build_positive(soggetto),
            negative=preset.build_negative(payload.get("negativo", "")),
            width=larghezza,
            height=altezza,
            controlnet_name=controlnet,
            control_strength=float(payload.get("controllo") or preset.control_strength),
            is_union="union" in controlnet.lower(),
            params=_sampling(payload, preset, denoise=preset.denoise),
            vae_name=vae,
        )

    if modo == "ritocca":
        if not payload.get("maschera"):
            raise ComfyError("Disegna sulla foto la zona da rigenerare.")
        maschera = _decode_image(payload["maschera"], os.path.join(workdir, "maschera.png"))
        return graphs.retouch(
            checkpoint=checkpoint,
            image_name=nome_foto,
            mask_name=client.upload_image(maschera),
            positive=preset.build_positive(soggetto or "coerente con il resto della stanza"),
            negative=preset.build_negative(payload.get("negativo", "")),
            width=larghezza,
            height=altezza,
            params=_sampling(payload, preset, denoise=0.85),
            vae_name=vae,
        )

    raise ComfyError(f"Modalita' sconosciuta: {modo}")


ASPETTI = {
    "square": (1, 1),
    "landscape": (4, 3),
    "wide": (16, 9),
    "portrait": (3, 4),
    "story": (9, 16),
}


# -------------------------------------------------------------------- server


class Handler(BaseHTTPRequestHandler):
    engine: Engine
    jobs: Jobs

    def log_message(self, format: str, *args) -> None:  # meno rumore in console
        pass

    # ------------------------------------------------------------ risposte

    def _json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _file(self, path: str, content_type: str | None = None) -> None:
        if not os.path.isfile(path):
            self._json({"errore": "non trovato"}, 404)
            return
        content_type = content_type or (mimetypes.guess_type(path)[0] or "application/octet-stream")
        with open(path, "rb") as handle:
            body = handle.read()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    # --------------------------------------------------------------- GET

    def do_GET(self) -> None:
        route = urlparse(self.path).path

        if route in ("/", "/index.html"):
            self._file(os.path.join(WEB_DIR, "index.html"), "text/html; charset=utf-8")
            return

        if route == "/api/stato":
            client = self.engine.client
            attivo = client.is_up()
            self._json({
                "motore": attivo,
                "checkpoint": client.available("CheckpointLoaderSimple", "ckpt_name") if attivo else [],
                "controlnet": client.available("ControlNetLoader", "control_net_name") if attivo else [],
                "upscaler": client.available("UpscaleModelLoader", "model_name") if attivo else [],
                "preset": [
                    {"nome": p.name, "descrizione": p.description}
                    for p in presets.PRESETS.values()
                ],
            })
            return

        if route.startswith("/api/lavoro/"):
            job = self.jobs.get(route.rsplit("/", 1)[-1])
            self._json(job or {"errore": "lavoro sconosciuto"}, 200 if job else 404)
            return

        if route == "/api/galleria":
            self._json({"immagini": _galleria()})
            return

        if route.startswith("/immagini/"):
            # Solo il nome del file: impedisce di risalire fuori da output/.
            nome = os.path.basename(route.rsplit("/", 1)[-1])
            self._file(os.path.join(OUTPUT_DIR, nome))
            return

        self._json({"errore": "non trovato"}, 404)

    # -------------------------------------------------------------- POST

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/api/genera":
            self._json({"errore": "non trovato"}, 404)
            return

        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_UPLOAD_BYTES * 2:
            self._json({"errore": "richiesta troppo grande"}, 413)
            return
        try:
            payload = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            self._json({"errore": "richiesta non valida"}, 400)
            return

        job_id = self.jobs.create()
        threading.Thread(
            target=_esegui, args=(self.engine, self.jobs, job_id, payload), daemon=True
        ).start()
        self._json({"lavoro": job_id})


def _galleria(limite: int = 24) -> list[dict]:
    if not os.path.isdir(OUTPUT_DIR):
        return []
    files = [f for f in os.listdir(OUTPUT_DIR) if f.lower().endswith(".png")]
    files.sort(key=lambda f: os.path.getmtime(os.path.join(OUTPUT_DIR, f)), reverse=True)
    return [{"nome": f, "url": f"/immagini/{f}"} for f in files[:limite]]


def _esegui(engine: Engine, jobs: Jobs, job_id: str, payload: dict) -> None:
    """Genera in un thread separato, cosi' la pagina puo' seguire l'avanzamento."""
    workdir = os.path.join(PROJECT_ROOT, ".lavoro", job_id)
    os.makedirs(workdir, exist_ok=True)
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    inizio = time.monotonic()
    try:
        client = engine.client
        if not client.is_up():
            raise ComfyError(
                "Il motore non risponde. Chiudi la finestra dei comandi e "
                "rilancia il comando con cui hai avviato il programma."
            )

        prompt = build_graph(payload, client, workdir)
        prompt_id = client.queue(prompt)

        def battito(secondi: float) -> None:
            jobs.update(job_id, secondi=round(secondi, 1))

        immagini = client.wait(prompt_id, on_tick=battito)

        salvate = []
        stamp = time.strftime("%Y%m%d-%H%M%S")
        etichetta = payload.get("modo", "testo")
        for indice, immagine in enumerate(immagini, start=1):
            suffisso = f"-{indice}" if len(immagini) > 1 else ""
            nome = f"{stamp}-{etichetta}{suffisso}.png"
            client.download(immagine, os.path.join(OUTPUT_DIR, nome))
            salvate.append({"nome": nome, "url": f"/immagini/{nome}"})

        # I file restano su disco: se il giudizio fosse sbagliato, l'utente
        # deve poterli guardare comunque.
        if salvate and all(tutta_nera(os.path.join(OUTPUT_DIR, s["nome"])) for s in salvate):
            raise ComfyError(diagnosi_nera(engine.flags))

        jobs.update(
            job_id,
            stato="completato",
            secondi=round(time.monotonic() - inizio, 1),
            immagini=salvate,
        )
    except ComfyError as exc:
        jobs.update(job_id, stato="errore", errore=con_causa(str(exc)))
    except Exception as exc:  # imprevisti: meglio mostrarli che lasciare la pagina in attesa
        jobs.update(job_id, stato="errore", errore=con_causa(f"{type(exc).__name__}: {exc}"))
    finally:
        for nome in ("foto.png", "maschera.png"):
            try:
                os.remove(os.path.join(workdir, nome))
            except OSError:
                pass
        try:
            os.rmdir(workdir)
        except OSError:
            pass


def aggiorna_progetto() -> str | None:
    """Scarica gli aggiornamenti all'avvio, cosi' non serve aprire un terminale.

    Restituisce un resoconto da mostrare, oppure None quando non c'e' nulla da
    dire. Un aggiornamento che non riesce — niente rete, modifiche locali, git
    assente — non deve mai impedire di lavorare: si prosegue con la versione
    che c'e' gia'.
    """
    repository = os.path.dirname(PROJECT_ROOT)
    if not os.path.isdir(os.path.join(repository, ".git")):
        return None

    def git(*argomenti: str):
        return subprocess.run(
            ["git", "-C", repository, *argomenti],
            capture_output=True, text=True, timeout=120,
        )

    try:
        prima = git("rev-parse", "HEAD").stdout.strip()
        esito = git("pull", "--ff-only")
        dopo = git("rev-parse", "HEAD").stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return None

    if esito.returncode != 0:
        return "Aggiornamento non riuscito: si prosegue con la versione installata."
    if prima and dopo and prima != dopo:
        # La pagina viene riletta da disco a ogni richiesta, quindi le modifiche
        # all'interfaccia sono gia' attive; il resto entra al prossimo avvio.
        return "Aggiornamento scaricato. Attivo del tutto al prossimo avvio."
    return None


def apri_server(handler, porte=PORTE) -> ThreadingHTTPServer:
    """Occupa la prima porta utilizzabile, altrimenti una qualsiasi libera.

    Su Windows il rifiuto puo' arrivare anche per una porta che nessuno sta
    usando, perche' rientra in un intervallo riservato dal sistema: l'unica
    difesa e' provarne altre.
    """
    for porta in porte:
        try:
            return ThreadingHTTPServer(("127.0.0.1", porta), handler)
        except OSError:
            continue
    return ThreadingHTTPServer(("127.0.0.1", 0), handler)


def main(argv: list[str] | None = None) -> int:
    # Tutto cio' che segue il nome del modulo va al motore cosi' com'e':
    # `-m mondo_image.dashboard --lowvram` accende ComfyUI in modalita' ridotta
    # senza toccare nessun file. E' la via d'uscita quando la memoria video non
    # basta, e la dashboard e' l'unico modo in cui il motore viene acceso.
    extra = list(sys.argv[1:] if argv is None else argv)

    notizia = aggiorna_progetto()
    if notizia:
        print(f"  {notizia}\n", flush=True)

    engine = Engine(extra=extra)
    try:
        engine.start()
    except RuntimeError as exc:
        print(f"\nErrore: {exc}\n", file=sys.stderr)
        return 1

    Handler.engine = engine
    Handler.jobs = Jobs()
    try:
        server = apri_server(Handler)
    except OSError as exc:
        print(f"\nErrore: nessuna porta disponibile ({exc})\n", file=sys.stderr)
        engine.stop()
        return 1
    indirizzo = f"http://127.0.0.1:{server.server_port}"

    print(f"\nDashboard pronta su {indirizzo}")
    print("Chiudi questa finestra per spegnere tutto.\n")
    threading.Timer(1.0, lambda: webbrowser.open(indirizzo)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nChiusura in corso...")
    finally:
        server.shutdown()
        engine.stop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
