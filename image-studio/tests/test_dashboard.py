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
