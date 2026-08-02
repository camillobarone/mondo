"""Client HTTP per un'istanza ComfyUI in esecuzione in locale.

ComfyUI espone un'API semplice: si carica un'immagine, si accoda un grafo, si
interroga la cronologia finche' non compaiono gli output. Facciamo polling
invece di usare il websocket perche' e' una dipendenza in meno e su una coda
locale la differenza di latenza e' irrilevante.
"""

from __future__ import annotations

import json
import os
import time
import uuid
from dataclasses import dataclass
from typing import Any

import requests

DEFAULT_SERVER = "http://127.0.0.1:8188"


class ComfyError(RuntimeError):
    pass


@dataclass
class GeneratedImage:
    filename: str
    subfolder: str
    type: str


class ComfyClient:
    def __init__(self, server: str = DEFAULT_SERVER, timeout: int = 30) -> None:
        self.server = server.rstrip("/")
        self.timeout = timeout
        self.client_id = str(uuid.uuid4())

    # ------------------------------------------------------------------ stato

    def is_up(self) -> bool:
        try:
            requests.get(f"{self.server}/system_stats", timeout=5).raise_for_status()
            return True
        except requests.RequestException:
            return False

    def object_info(self) -> dict[str, Any]:
        """Elenco dei nodi realmente installati, con le opzioni valide dei combo."""
        response = requests.get(f"{self.server}/object_info", timeout=self.timeout)
        response.raise_for_status()
        return response.json()

    def available(self, node: str, field: str) -> list[str]:
        """Valori ammessi per un input combo, es. i checkpoint installati.

        Serve per fallire con un messaggio utile ("questi sono i modelli che hai")
        invece di lasciare che ComfyUI restituisca un errore di validazione opaco.
        """
        try:
            info = self.object_info()[node]["input"]
            for section in ("required", "optional"):
                spec = info.get(section, {}).get(field)
                if spec and isinstance(spec[0], list):
                    return list(spec[0])
        except (requests.RequestException, KeyError, IndexError, TypeError):
            pass
        return []

    # ----------------------------------------------------------------- upload

    def upload_image(self, path: str, subfolder: str = "mondo") -> str:
        """Carica un file nella cartella input di ComfyUI e ne restituisce il riferimento."""
        if not os.path.isfile(path):
            raise ComfyError(f"File non trovato: {path}")
        with open(path, "rb") as handle:
            response = requests.post(
                f"{self.server}/upload/image",
                files={"image": (os.path.basename(path), handle, "application/octet-stream")},
                data={"overwrite": "true", "type": "input", "subfolder": subfolder},
                timeout=120,
            )
        if response.status_code >= 400:
            raise ComfyError(f"Upload fallito ({response.status_code}): {response.text[:300]}")
        payload = response.json()
        name, folder = payload.get("name"), payload.get("subfolder", "")
        return f"{folder}/{name}" if folder else name

    # ------------------------------------------------------------------- coda

    def queue(self, prompt: dict[str, Any]) -> str:
        response = requests.post(
            f"{self.server}/prompt",
            json={"prompt": prompt, "client_id": self.client_id},
            timeout=self.timeout,
        )
        if response.status_code >= 400:
            raise ComfyError(_format_validation_error(response))
        prompt_id = response.json().get("prompt_id")
        if not prompt_id:
            raise ComfyError(f"Risposta inattesa da /prompt: {response.text[:300]}")
        return prompt_id

    def wait(
        self, prompt_id: str, poll: float = 1.0, max_wait: float = 1800.0, on_tick=None
    ) -> list[GeneratedImage]:
        started = time.monotonic()
        while True:
            elapsed = time.monotonic() - started
            if elapsed > max_wait:
                raise ComfyError(f"Nessun risultato dopo {int(elapsed)}s. Generazione interrotta.")
            try:
                response = requests.get(f"{self.server}/history/{prompt_id}", timeout=self.timeout)
                response.raise_for_status()
                history = response.json().get(prompt_id)
            except requests.RequestException as exc:
                raise ComfyError(f"Il server ComfyUI non risponde piu': {exc}") from exc

            if history:
                status = history.get("status", {})
                if status.get("status_str") == "error":
                    raise ComfyError(_format_history_error(status))
                images = _collect_images(history.get("outputs", {}))
                if images:
                    return images
                if status.get("completed"):
                    raise ComfyError("Esecuzione completata ma nessuna immagine prodotta.")

            if on_tick:
                on_tick(elapsed)
            time.sleep(poll)

    def download(self, image: GeneratedImage, destination: str) -> str:
        response = requests.get(
            f"{self.server}/view",
            params={
                "filename": image.filename,
                "subfolder": image.subfolder,
                "type": image.type,
            },
            timeout=120,
        )
        response.raise_for_status()
        os.makedirs(os.path.dirname(destination) or ".", exist_ok=True)
        with open(destination, "wb") as handle:
            handle.write(response.content)
        return destination


def _collect_images(outputs: dict[str, Any]) -> list[GeneratedImage]:
    found: list[GeneratedImage] = []
    for node_output in outputs.values():
        for entry in node_output.get("images", []):
            if entry.get("type") == "temp":
                continue  # anteprime, non risultati salvati
            found.append(
                GeneratedImage(
                    filename=entry.get("filename", ""),
                    subfolder=entry.get("subfolder", ""),
                    type=entry.get("type", "output"),
                )
            )
    return found


def _format_validation_error(response: requests.Response) -> str:
    """ComfyUI annida gli errori di validazione: srotolarli evita ore perse."""
    try:
        payload = response.json()
    except json.JSONDecodeError:
        return f"ComfyUI ha rifiutato il grafo ({response.status_code}): {response.text[:300]}"

    lines = [payload.get("error", {}).get("message", "grafo rifiutato")]
    details = payload.get("error", {}).get("details")
    if details:
        lines.append(f"  {details}")
    for node_id, info in (payload.get("node_errors") or {}).items():
        for err in info.get("errors", []):
            lines.append(
                f"  nodo {node_id} ({info.get('class_type', '?')}): "
                f"{err.get('message')} {err.get('details', '')}".rstrip()
            )
    return "\n".join(lines)


def _format_history_error(status: dict[str, Any]) -> str:
    for kind, data in status.get("messages", []):
        if kind == "execution_error":
            return (
                f"Errore nel nodo {data.get('node_type', '?')}: "
                f"{data.get('exception_message', 'causa sconosciuta')}"
            )
    return "Esecuzione fallita senza dettagli."
