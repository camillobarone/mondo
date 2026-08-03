"""Prova d'insieme della dashboard contro un finto ComfyUI.

La dashboard tocca parecchi pezzi: costruzione del grafo, caricamento della
foto, coda, attesa, salvataggio. Con un finto motore in ascolto si verifica
tutto il percorso senza GPU, e si controlla che il grafo inviato sia davvero
quello della modalita' scelta.
"""

from __future__ import annotations

import base64
import io
import json
import re
import os
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest
import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from mondo_image import dashboard  # noqa: E402

# PNG 1x1 valido: basta a farlo leggere da Pillow e a spedirlo.
PNG_1PX = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmM"
    "IQAAAABJRU5ErkJggg=="
)
DATA_URL = "data:image/png;base64," + base64.b64encode(PNG_1PX).decode()

# Gli elenchi rispecchiano le due forme reali di /object_info: i loader storici
# usano il formato legacy, UpscaleModelLoader lo schema V3.
OBJECT_INFO = {
    "CheckpointLoaderSimple": {"input": {"required": {"ckpt_name": [["sd_xl_base_1.0.safetensors"]]}}},
    "VAELoader": {"input": {"required": {"vae_name": [["pixel_space", "sdxl-vae-fp16-fix.safetensors"]]}}},
    "ControlNetLoader": {"input": {"required": {"control_net_name": [["controlnet-union-sdxl-promax.safetensors"]]}}},
    "UpscaleModelLoader": {"input": {"required": {"model_name": ["COMBO", {"options": ["RealESRGAN_x4plus.pth"]}]}}},
    "LoraLoader": {"input": {"required": {"lora_name": [[]]}}},
    "Canny": {}, "SetUnionControlNetType": {}, "FeatherMask": {}, "GrowMask": {},
}


class FakeComfy(BaseHTTPRequestHandler):
    """Motore finto: registra i grafi ricevuti e restituisce sempre un'immagine."""

    grafi: list[dict] = []

    def log_message(self, *args):
        pass

    def _send(self, payload, content_type="application/json"):
        body = payload if isinstance(payload, bytes) else json.dumps(payload).encode()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.startswith("/system_stats"):
            self._send({"system": {}})
        elif self.path.startswith("/object_info"):
            self._send(OBJECT_INFO)
        elif self.path.startswith("/history/"):
            self._send({
                "p1": {
                    "status": {"status_str": "success", "completed": True},
                    "outputs": {"9": {"images": [
                        {"filename": "esito.png", "subfolder": "", "type": "output"}
                    ]}},
                }
            })
        elif self.path.startswith("/view"):
            self._send(PNG_1PX, "image/png")
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length)
        if self.path.startswith("/upload/image"):
            self._send({"name": "foto.png", "subfolder": "mondo", "type": "input"})
        elif self.path.startswith("/prompt"):
            FakeComfy.grafi.append(json.loads(raw)["prompt"])
            self._send({"prompt_id": "p1"})
        else:
            self.send_response(404)
            self.end_headers()


@pytest.fixture()
def app(tmp_path, monkeypatch):
    """Avvia finto motore e dashboard su porte libere, con output isolato."""
    FakeComfy.grafi = []
    motore = ThreadingHTTPServer(("127.0.0.1", 0), FakeComfy)
    threading.Thread(target=motore.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{motore.server_port}"

    uscita = tmp_path / "output"
    monkeypatch.setattr(dashboard, "OUTPUT_DIR", str(uscita))
    monkeypatch.setattr(dashboard, "PROJECT_ROOT", str(tmp_path))

    dashboard.Handler.engine = dashboard.Engine(server=url)
    dashboard.Handler.jobs = dashboard.Jobs()
    server = ThreadingHTTPServer(("127.0.0.1", 0), dashboard.Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()

    yield f"http://127.0.0.1:{server.server_port}"

    server.shutdown()
    motore.shutdown()


def genera(base: str, richiesta: dict, attesa: float = 15.0) -> dict:
    risposta = requests.post(f"{base}/api/genera", json=richiesta, timeout=10).json()
    assert "lavoro" in risposta, risposta
    scadenza = time.monotonic() + attesa
    while time.monotonic() < scadenza:
        job = requests.get(f"{base}/api/lavoro/{risposta['lavoro']}", timeout=10).json()
        if job.get("stato") in ("completato", "errore"):
            return job
        time.sleep(0.1)
    raise AssertionError("il lavoro non si e' concluso")


def tipi(grafo: dict) -> set[str]:
    return {n["class_type"] for n in grafo.values()}


# ------------------------------------------------------------------ stato


def test_stato_elenca_i_modelli(app):
    stato = requests.get(f"{app}/api/stato", timeout=10).json()
    assert stato["motore"] is True
    assert stato["checkpoint"] == ["sd_xl_base_1.0.safetensors"]
    # Letto dallo schema V3: e' il caso che prima risultava vuoto.
    assert stato["upscaler"] == ["RealESRGAN_x4plus.pth"]
    assert any(p["nome"] == "interior" for p in stato["preset"])


def test_la_pagina_viene_servita(app):
    pagina = requests.get(f"{app}/", timeout=10)
    assert pagina.status_code == 200
    assert "Mondo Image Studio" in pagina.text
    assert "text/html" in pagina.headers["Content-Type"]


# ------------------------------------------------------------ generazioni


def test_crea_da_testo(app):
    job = genera(app, {"modo": "testo", "prompt": "masseria salentina", "preset": "exterior"})
    assert job["stato"] == "completato", job
    assert len(job["immagini"]) == 1

    grafo = FakeComfy.grafi[-1]
    assert "EmptyLatentImage" in tipi(grafo)
    assert "ControlNetApplyAdvanced" not in tipi(grafo)
    # Il preset deve aver arricchito la descrizione dell'utente.
    testi = [n["inputs"]["text"] for n in grafo.values() if n["class_type"] == "CLIPTextEncode"]
    assert any("masseria salentina" in t and "photorealistic" in t for t in testi)


def test_arreda_usa_il_controlnet(app):
    job = genera(app, {
        "modo": "arreda", "prompt": "soggiorno moderno", "preset": "interior",
        "immagine": DATA_URL, "controllo": "0.9",
    })
    assert job["stato"] == "completato", job

    grafo = FakeComfy.grafi[-1]
    assert {"Canny", "ControlNetApplyAdvanced", "SetUnionControlNetType"} <= tipi(grafo)
    applica = next(n for n in grafo.values() if n["class_type"] == "ControlNetApplyAdvanced")
    assert applica["inputs"]["strength"] == 0.9


def test_ritocca_richiede_la_maschera(app):
    job = genera(app, {"modo": "ritocca", "prompt": "parete bianca", "immagine": DATA_URL})
    assert job["stato"] == "errore"
    assert "zona" in job["errore"].lower()


def test_ritocca_con_maschera(app):
    job = genera(app, {
        "modo": "ritocca", "prompt": "parete intonacata bianca",
        "immagine": DATA_URL, "maschera": DATA_URL,
    })
    assert job["stato"] == "completato", job
    grafo = FakeComfy.grafi[-1]
    assert {"ImageToMask", "SetLatentNoiseMask"} <= tipi(grafo)
    # Foto e maschera devono passare per lo stesso riscalamento.
    scale = [n["inputs"] for n in grafo.values() if n["class_type"] == "ImageScale"]
    assert len(scale) == 2
    assert scale[0]["width"] == scale[1]["width"]


def test_ingrandisci_non_richiede_descrizione(app):
    job = genera(app, {"modo": "ingrandisci", "immagine": DATA_URL, "fattore": "2"})
    assert job["stato"] == "completato", job
    assert "ImageUpscaleWithModel" in tipi(FakeComfy.grafi[-1])


def test_seed_fisso_viene_rispettato(app):
    genera(app, {"modo": "testo", "prompt": "prova", "seed": "12345"})
    campionatore = next(
        n for n in FakeComfy.grafi[-1].values() if n["class_type"] == "KSampler"
    )
    assert campionatore["inputs"]["seed"] == 12345


# -------------------------------------------------------------- controlli


def test_senza_foto_non_parte(app):
    job = genera(app, {"modo": "arreda", "prompt": "soggiorno"})
    assert job["stato"] == "errore"
    assert "foto" in job["errore"].lower()


def test_senza_descrizione_non_parte(app):
    job = genera(app, {"modo": "testo", "prompt": "   "})
    assert job["stato"] == "errore"


def test_immagine_corrotta_da_errore_leggibile(app):
    job = genera(app, {"modo": "arreda", "prompt": "x", "immagine": "data:image/png;base64,@@@"})
    assert job["stato"] == "errore"
    assert "non leggibile" in job["errore"].lower()


def test_galleria_mostra_i_risultati(app):
    genera(app, {"modo": "testo", "prompt": "prova galleria"})
    galleria = requests.get(f"{app}/api/galleria", timeout=10).json()["immagini"]
    assert len(galleria) == 1
    scaricata = requests.get(f"{app}{galleria[0]['url']}", timeout=10)
    assert scaricata.status_code == 200
    assert scaricata.content == PNG_1PX


def test_non_si_esce_dalla_cartella_output(app):
    """Il percorso richiesto va ridotto al solo nome del file."""
    fuori = requests.get(f"{app}/immagini/..%2F..%2Fcomfy-path.txt", timeout=10)
    assert fuori.status_code == 404


# ------------------------------------------------------- scelta della porta


def test_ripiega_sulla_porta_successiva():
    """Se la prima e' occupata deve passare alla seguente, non arrendersi."""
    occupata = ThreadingHTTPServer(("127.0.0.1", 0), FakeComfy)
    presa = occupata.server_port
    libera = presa + 1
    try:
        server = dashboard.apri_server(FakeComfy, porte=(presa, libera))
        assert server.server_port == libera
        server.server_close()
    finally:
        occupata.server_close()


def test_ripiega_su_una_porta_qualsiasi():
    """Con tutte le candidate inutilizzabili si lascia scegliere al sistema.

    Windows rifiuta le porte riservate a Hyper-V anche se nessuno le usa
    (WinError 10013): senza questo ripiego la dashboard non partirebbe.
    """
    occupata = ThreadingHTTPServer(("127.0.0.1", 0), FakeComfy)
    try:
        server = dashboard.apri_server(FakeComfy, porte=(occupata.server_port,))
        assert server.server_port not in (0, occupata.server_port)
        server.server_close()
    finally:
        occupata.server_close()


def test_la_prima_porta_libera_ha_la_precedenza():
    server = dashboard.apri_server(FakeComfy, porte=(0,))
    assert server.server_port > 0
    server.server_close()


# --------------------------------------------------- aggiornamento automatico


def _repo(percorso, con_git=True):
    """Costruisce un repository di prova con dentro la cartella image-studio."""
    import subprocess as sp
    percorso.mkdir(parents=True, exist_ok=True)
    if con_git:
        sp.run(["git", "init", "-q", str(percorso)], check=True)
        sp.run(["git", "-C", str(percorso), "config", "user.email", "t@t"], check=True)
        sp.run(["git", "-C", str(percorso), "config", "user.name", "t"], check=True)
        (percorso / "f.txt").write_text("uno")
        sp.run(["git", "-C", str(percorso), "add", "-A"], check=True)
        sp.run(["git", "-C", str(percorso), "commit", "-qm", "primo"], check=True)
    studio = percorso / "image-studio"
    studio.mkdir(exist_ok=True)
    return studio


def test_senza_git_non_disturba(tmp_path, monkeypatch):
    """Chi ha scaricato lo zip invece di clonare deve poter lavorare lo stesso."""
    monkeypatch.setattr(dashboard, "PROJECT_ROOT", str(_repo(tmp_path / "a", con_git=False)))
    assert dashboard.aggiorna_progetto() is None


def test_gia_aggiornato_resta_silenzioso(tmp_path, monkeypatch):
    """Nessun remoto configurato: il pull fallisce, ma non e' una notizia utile
    da urlare a ogni avvio. Basta che non blocchi."""
    monkeypatch.setattr(dashboard, "PROJECT_ROOT", str(_repo(tmp_path / "b")))
    esito = dashboard.aggiorna_progetto()
    assert esito is None or "prosegue" in esito


def test_annuncia_l_aggiornamento_scaricato(tmp_path, monkeypatch):
    """Con un commit nuovo a monte, l'avvio deve dirlo."""
    import subprocess as sp
    origine = tmp_path / "origine"
    _repo(origine)

    clone = tmp_path / "clone"
    sp.run(["git", "clone", "-q", str(origine), str(clone)], check=True)
    sp.run(["git", "-C", str(clone), "config", "user.email", "t@t"], check=True)
    sp.run(["git", "-C", str(clone), "config", "user.name", "t"], check=True)
    (clone / "image-studio").mkdir(exist_ok=True)

    # Un commit nuovo sull'origine, che il clone non ha ancora.
    (origine / "f.txt").write_text("due")
    sp.run(["git", "-C", str(origine), "commit", "-qam", "secondo"], check=True)

    monkeypatch.setattr(dashboard, "PROJECT_ROOT", str(clone / "image-studio"))
    esito = dashboard.aggiorna_progetto()
    assert esito is not None and "Aggiornamento scaricato" in esito
    assert (clone / "f.txt").read_text() == "due"


def test_modifiche_locali_non_bloccano_l_avvio(tmp_path, monkeypatch):
    """Se il pull non puo' andare avanti si prosegue: mai impedire di lavorare."""
    import subprocess as sp
    origine = tmp_path / "origine2"
    _repo(origine)
    clone = tmp_path / "clone2"
    sp.run(["git", "clone", "-q", str(origine), str(clone)], check=True)
    (clone / "image-studio").mkdir(exist_ok=True)

    (origine / "f.txt").write_text("remoto")
    sp.run(["git", "-C", str(origine), "commit", "-qam", "remoto"], check=True)
    (clone / "f.txt").write_text("locale divergente")  # impedisce il fast-forward

    monkeypatch.setattr(dashboard, "PROJECT_ROOT", str(clone / "image-studio"))
    esito = dashboard.aggiorna_progetto()
    assert esito is None or "prosegue" in esito


# ------------------------------------------------- parametri passati al motore
#
# Chi esaurisce la memoria video deve poter riavviare in modalita' ridotta senza
# modificare nessun file: sul PC di destinazione i .bat non si eseguono con un
# doppio clic, e il motore lo accende la dashboard, non avvia-comfyui.bat.


def test_senza_parametri_restano_i_default():
    assert dashboard.flag_motore([]) == dashboard.ENGINE_FLAGS


def test_i_parametri_dell_utente_vanno_in_coda():
    """A parita' di nome ComfyUI tiene l'ultimo: chi scrive --reserve-vram 3
    deve vincere sul nostro 1.5."""
    flags = dashboard.flag_motore(["--lowvram", "--reserve-vram", "3"])
    assert flags[: len(dashboard.ENGINE_FLAGS)] == dashboard.ENGINE_FLAGS
    assert flags[-3:] == ["--lowvram", "--reserve-vram", "3"]


def test_cpu_vae_sostituisce_fp32_vae():
    """Sono alternativi: lo stadio finale o sta sul processore o sta in VRAM in
    precisione piena. Tenerli entrambi renderebbe il risultato dipendente
    dall'ordine degli argomenti."""
    flags = dashboard.flag_motore(["--cpu-vae"])
    assert "--fp32-vae" not in flags
    assert flags[-1] == "--cpu-vae"
    assert "--use-pytorch-cross-attention" in flags  # gli altri restano


def test_il_motore_riceve_i_parametri():
    assert dashboard.Engine(extra=["--lowvram"]).flags[-1] == "--lowvram"


# ------------------------------------------------ causa di un motore che muore
#
# Quando ComfyUI viene ucciso a meta' generazione, la dashboard vede solo una
# connessione caduta. Il motivo sta nel registro del motore, che al riavvio
# successivo viene sovrascritto: va allegato all'errore subito.


def test_il_registro_si_allega_a_un_motore_caduto(tmp_path, monkeypatch):
    monkeypatch.setattr(dashboard, "PROJECT_ROOT", str(tmp_path))
    (tmp_path / "motore.log").write_text(
        "caricamento\n\nUR_RESULT_ERROR_OUT_OF_RESOURCES\n", encoding="utf-8"
    )
    esito = dashboard.con_causa("Il server ComfyUI non risponde piu': Connection aborted.")
    assert "UR_RESULT_ERROR_OUT_OF_RESOURCES" in esito
    assert "registro" in esito


def test_gli_altri_errori_restano_puliti(tmp_path, monkeypatch):
    """Allegare il registro a "Descrivi cosa vuoi generare" sarebbe rumore."""
    monkeypatch.setattr(dashboard, "PROJECT_ROOT", str(tmp_path))
    (tmp_path / "motore.log").write_text("roba\n", encoding="utf-8")
    assert dashboard.con_causa("Serve una foto di partenza.") == "Serve una foto di partenza."


def test_senza_registro_il_messaggio_non_peggiora(tmp_path, monkeypatch):
    monkeypatch.setattr(dashboard, "PROJECT_ROOT", str(tmp_path))
    assert dashboard.con_causa("Il motore non risponde.") == "Il motore non risponde."


def test_del_registro_si_tiene_solo_la_coda(tmp_path, monkeypatch):
    monkeypatch.setattr(dashboard, "PROJECT_ROOT", str(tmp_path))
    righe = "\n".join(f"riga {n}" for n in range(100))
    (tmp_path / "motore.log").write_text(righe, encoding="utf-8")
    esito = dashboard.coda_registro()
    assert "riga 99" in esito
    assert "riga 0\n" not in esito
    assert len(esito.splitlines()) == dashboard.RIGHE_REGISTRO


# ------------------------------------------------- stile iniziale per scheda


def _preset_per_modo() -> dict[str, str]:
    """Legge la mappa scheda -> stile dalla pagina.

    La pagina non e' importabile: si estrae l'unica dichiarazione che conta,
    cosi' il test fallisce se qualcuno la rinomina o la toglie.
    """
    pagina = os.path.join(os.path.dirname(__file__), "..", "src", "mondo_image", "web", "index.html")
    with open(pagina, encoding="utf-8") as f:
        testo = f.read()
    corpo = re.search(r"var PRESET_MODO = \{(.*?)\};", testo, re.S)
    assert corpo, "PRESET_MODO sparita dalla pagina"
    return dict(re.findall(r"(\w+):\s*\"(\w+)\"", corpo.group(1)))


def test_ogni_scheda_parte_da_uno_stile_esistente():
    from mondo_image import presets

    mappa = _preset_per_modo()
    assert set(mappa) == {"arreda", "ritocca", "testo"}
    for modo, nome in mappa.items():
        assert nome in presets.PRESETS, f"la scheda {modo} punta a uno stile inesistente: {nome}"


def test_la_scheda_crea_non_parte_dallo_stile_interni():
    """Su "Crea" lo stile d'interni riscriveva ogni soggetto come una stanza.

    Chi chiedeva una spiaggia otteneva una stanza con vista mare, perche' il
    menu restava su 'interior' anche cambiando scheda.
    """
    from mondo_image import presets

    scelto = _preset_per_modo()["testo"]
    assert scelto != "interior"
    suffisso = presets.get(scelto).positive_suffix
    assert "interior" not in suffisso
    assert "windows" not in suffisso


def test_la_pagina_non_forza_piu_uno_stile_fisso():
    pagina = os.path.join(os.path.dirname(__file__), "..", "src", "mondo_image", "web", "index.html")
    with open(pagina, encoding="utf-8") as f:
        testo = f.read()
    assert 'select.value = "interior"' not in testo
    assert "applicaPreset()" in testo
