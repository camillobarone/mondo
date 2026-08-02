"""Scarica i modelli descritti in models.json dentro l'installazione di ComfyUI.

Perche' non URL fissi: i nomi dei file nei repository Hugging Face cambiano, gli
identificativi dei repository quasi mai. Qui si interroga l'API del repository e
si sceglie il file con una regex, cosi' un rename a monte non rompe il setup.

I download riprendono da dove si erano interrotti: su una connessione domestica
7 GB possono richiedere piu' tentativi.

    python download_models.py --comfy C:\\Users\\tu\\ComfyUI
    python download_models.py --comfy ... --only juggernaut-xl
    python download_models.py --comfy ... --required-only
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time

import requests

HF_API = "https://huggingface.co/api/models/{repo}/tree/main"
HF_FILE = "https://huggingface.co/{repo}/resolve/main/{path}"
CHUNK = 1024 * 1024


class DownloadError(RuntimeError):
    pass


def _human(num_bytes: float) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if abs(num_bytes) < 1024:
            return f"{num_bytes:.1f}{unit}"
        num_bytes /= 1024
    return f"{num_bytes:.1f}TB"


def resolve_hf_file(repo: str, pattern: str, fallback: str | None = None) -> str:
    """Trova nel repository il primo file che soddisfa la regex."""
    try:
        response = requests.get(HF_API.format(repo=repo), timeout=60)
    except requests.RequestException as exc:
        raise DownloadError(f"Hugging Face irraggiungibile: {exc}") from exc
    if response.status_code == 404:
        raise DownloadError(f"repository '{repo}' inesistente o privato")
    if response.status_code >= 400:
        raise DownloadError(f"errore {response.status_code} interrogando '{repo}'")

    files = [item["path"] for item in response.json() if item.get("type") == "file"]
    for candidate in (pattern, fallback):
        if not candidate:
            continue
        regex = re.compile(candidate)
        matches = sorted(f for f in files if regex.match(f))
        if matches:
            return matches[0]
    listing = ", ".join(f for f in files if f.endswith((".safetensors", ".pth", ".bin"))) or "nessuno"
    raise DownloadError(f"nessun file corrisponde a '{pattern}' in '{repo}'. Presenti: {listing}")


def download(url: str, destination: str) -> None:
    """Scarica con ripresa. Il file finale compare solo a download completato."""
    os.makedirs(os.path.dirname(destination), exist_ok=True)
    partial = destination + ".part"
    existing = os.path.getsize(partial) if os.path.exists(partial) else 0
    headers = {"Range": f"bytes={existing}-"} if existing else {}

    with requests.get(url, headers=headers, stream=True, timeout=120) as response:
        if existing and response.status_code == 416:
            os.replace(partial, destination)  # gia' completo
            return
        if response.status_code == 416:
            os.remove(partial)
            raise DownloadError("intervallo non valido, riprova da capo")
        response.raise_for_status()

        if existing and response.status_code != 206:
            existing = 0  # il server ignora Range: riparti da zero
        total = int(response.headers.get("content-length", 0)) + existing

        mode = "ab" if existing and response.status_code == 206 else "wb"
        done = existing if mode == "ab" else 0
        started = time.monotonic()
        with open(partial, mode) as handle:
            for chunk in response.iter_content(CHUNK):
                handle.write(chunk)
                done += len(chunk)
                elapsed = max(time.monotonic() - started, 0.001)
                speed = (done - existing) / elapsed
                percent = f"{done / total * 100:5.1f}%" if total else "   ? "
                print(
                    f"\r    {percent}  {_human(done)}/{_human(total) if total else '?'}"
                    f"  {_human(speed)}/s   ",
                    end="",
                    flush=True,
                )
    print()
    os.replace(partial, destination)


def process(entry: dict, comfy_path: str, force: bool) -> bool:
    source = entry["source"]
    target_dir = os.path.join(comfy_path, "models", entry["target"])

    if source["type"] == "url":
        url = source["url"]
        filename = source.get("rename_to") or os.path.basename(url)
    else:
        remote = resolve_hf_file(
            source["repo"], source["pattern"], source.get("fallback_pattern")
        )
        url = HF_FILE.format(repo=source["repo"], path=remote)
        filename = source.get("rename_to") or os.path.basename(remote)

    destination = os.path.join(target_dir, filename)
    if os.path.exists(destination) and not force:
        print(f"    gia' presente: {filename}")
        return True

    print(f"    scarico {filename} (~{entry['approx_gb']} GB)")
    download(url, destination)
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Scarica i modelli per Mondo Image Studio.")
    parser.add_argument("--comfy", required=True, help="Cartella dell'installazione ComfyUI")
    parser.add_argument("--manifest", default=os.path.join(os.path.dirname(__file__), "models.json"))
    parser.add_argument("--only", action="append", help="Scarica solo questi id (ripetibile)")
    parser.add_argument("--required-only", action="store_true", help="Salta i modelli opzionali")
    parser.add_argument("--force", action="store_true", help="Riscarica anche se gia' presente")
    args = parser.parse_args()

    if not os.path.isdir(args.comfy):
        print(f"Cartella ComfyUI inesistente: {args.comfy}", file=sys.stderr)
        return 1

    with open(args.manifest, encoding="utf-8") as handle:
        entries = json.load(handle)["models"]
    if args.only:
        entries = [e for e in entries if e["id"] in args.only]
    if args.required_only:
        entries = [e for e in entries if e["required"]]

    failures: list[tuple[str, str, bool]] = []
    for entry in entries:
        print(f"\n[{entry['id']}] {entry['label']}")
        try:
            process(entry, args.comfy, args.force)
        except (DownloadError, requests.RequestException, OSError) as exc:
            marker = "OBBLIGATORIO" if entry["required"] else "opzionale"
            print(f"    NON RIUSCITO ({marker}): {exc}")
            failures.append((entry["id"], str(exc), entry["required"]))

    print("\n" + "=" * 68)
    blocking = [f for f in failures if f[2]]
    if not failures:
        print("Tutti i modelli sono a posto.")
    else:
        for model_id, reason, required in failures:
            print(f"  {'!' if required else '-'} {model_id}: {reason}")
        if blocking:
            print(
                "\nMancano modelli obbligatori. Puoi scaricarli a mano da huggingface.co\n"
                "e metterli nelle sottocartelle di ComfyUI\\models\\ indicate nel README."
            )
        else:
            print("\nSolo modelli opzionali: il sistema funziona lo stesso.")
    return 1 if blocking else 0


if __name__ == "__main__":
    raise SystemExit(main())
