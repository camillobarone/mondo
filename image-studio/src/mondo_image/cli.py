"""Interfaccia a riga di comando di Mondo Image Studio.

Il server ComfyUI resta il motore; questa CLI ci parla via API e incapsula le
scelte che altrimenti andrebbero rifatte a mano ogni volta: risoluzione SDXL
corretta, preset di prompt, selezione dei modelli installati.

    python -m mondo_image doctor
    python -m mondo_image text "trullo in campagna al tramonto" --preset exterior
    python -m mondo_image staging foto.jpg "soggiorno moderno, divano grigio"
    python -m mondo_image retouch foto.jpg maschera.png "parete bianca pulita"
    python -m mondo_image upscale foto.jpg
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
from typing import Sequence

from . import graphs, presets
from .client import ComfyClient, ComfyError, DEFAULT_SERVER

# A parita' di risultato preferiamo i checkpoint fotorealistici: sono quelli
# che reggono il confronto su un annuncio immobiliare.
CHECKPOINT_PREFERENCE = ("juggernaut", "realvis", "epicrealism", "sd_xl_base", "sdxl")
VAE_PREFERENCE = ("fp16", "sdxl")
CONTROLNET_PREFERENCE = ("union", "canny")
UPSCALER_PREFERENCE = ("ultrasharp", "realesrgan_x4plus", "esrgan")

MAX_SEED = 2**32 - 1


def _pick(options: Sequence[str], preference: Sequence[str]) -> str | None:
    """Sceglie l'opzione migliore fra quelle installate, in ordine di preferenza."""
    if not options:
        return None
    for token in preference:
        for option in options:
            if token in option.lower():
                return option
    return options[0]


def _resolve_model(
    client: ComfyClient, explicit: str | None, node: str, field: str,
    preference: Sequence[str], label: str, required: bool = True,
    placeholder: bool = False,
) -> str | None:
    """Sceglie un modello fra quelli installati sul server.

    Con `placeholder` (attivo in --dry-run) non serve un server acceso: si mette
    un segnaposto, cosi' il grafo si puo' ispezionare anche a ComfyUI spento.
    """
    installed = client.available(node, field)
    if explicit:
        if installed and explicit not in installed:
            listing = "\n  ".join(installed) or "(nessuno)"
            raise SystemExit(
                f"{label} '{explicit}' non e' installato.\nDisponibili:\n  {listing}"
            )
        return explicit
    chosen = _pick(installed, preference)
    if chosen:
        return chosen
    if placeholder:
        return f"<{label}>"
    if required:
        raise SystemExit(
            f"Nessun {label} trovato. Esegui install\\2-scarica-modelli.ps1 "
            f"e riavvia ComfyUI."
        )
    return None


def _image_size(path: str) -> tuple[int, int]:
    try:
        from PIL import Image  # dipendenza gia' presente nel venv di ComfyUI
    except ImportError:
        print("Pillow non disponibile: uso 1024x1024.", file=sys.stderr)
        return (1024, 1024)
    try:
        with Image.open(path) as img:
            return img.size
    except OSError as exc:
        raise SystemExit(f"Impossibile leggere l'immagine {path}: {exc}") from None


def _sampling(args: argparse.Namespace, preset: presets.Preset, denoise: float) -> graphs.SamplingParams:
    return graphs.SamplingParams(
        steps=args.steps if args.steps is not None else preset.steps,
        cfg=args.cfg if args.cfg is not None else preset.cfg,
        sampler=args.sampler or preset.sampler,
        scheduler=args.scheduler or preset.scheduler,
        seed=args.seed if args.seed is not None else random.randint(0, MAX_SEED),
        denoise=args.denoise if args.denoise is not None else denoise,
    )


def _parse_loras(values: Sequence[str] | None) -> list[tuple[str, float]]:
    loras: list[tuple[str, float]] = []
    for value in values or []:
        name, _, strength = value.partition(":")
        try:
            loras.append((name, float(strength) if strength else 1.0))
        except ValueError:
            raise SystemExit(f"LoRA non valida: '{value}'. Usa nome.safetensors:0.8") from None
    return loras


def _run(client: ComfyClient, prompt: dict, args: argparse.Namespace, tag: str) -> int:
    if args.dry_run:
        print(json.dumps(prompt, indent=2, ensure_ascii=False))
        return 0

    if not client.is_up():
        raise SystemExit(
            f"ComfyUI non risponde su {client.server}.\n"
            f"Avvialo con avvia-comfyui.bat e riprova."
        )

    prompt_id = client.queue(prompt)
    started = time.monotonic()

    def tick(elapsed: float) -> None:
        print(f"\r  generazione in corso... {elapsed:5.1f}s", end="", flush=True)

    images = client.wait(prompt_id, on_tick=tick)
    print(f"\r  completato in {time.monotonic() - started:.1f}s" + " " * 12)

    os.makedirs(args.out, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    for index, image in enumerate(images, start=1):
        suffix = f"-{index}" if len(images) > 1 else ""
        destination = os.path.join(args.out, f"{stamp}-{tag}{suffix}.png")
        client.download(image, destination)
        print(f"  -> {destination}")
    return 0


# --------------------------------------------------------------------- comandi


def cmd_doctor(args: argparse.Namespace) -> int:
    client = ComfyClient(args.server)
    print(f"Server:      {client.server}")
    if not client.is_up():
        print("Stato:       NON RAGGIUNGIBILE")
        print("\nAvvia ComfyUI con avvia-comfyui.bat, poi rilancia questo comando.")
        return 1
    print("Stato:       attivo")

    for label, node, field, preference in (
        ("Checkpoint", "CheckpointLoaderSimple", "ckpt_name", CHECKPOINT_PREFERENCE),
        ("VAE", "VAELoader", "vae_name", VAE_PREFERENCE),
        ("ControlNet", "ControlNetLoader", "control_net_name", CONTROLNET_PREFERENCE),
        ("Upscaler", "UpscaleModelLoader", "model_name", UPSCALER_PREFERENCE),
        ("LoRA", "LoraLoader", "lora_name", ()),
    ):
        installed = client.available(node, field)
        chosen = _pick(installed, preference)
        if installed:
            print(f"\n{label} ({len(installed)}):")
            for option in installed:
                print(f"  {'*' if option == chosen else ' '} {option}")
        else:
            print(f"\n{label}: nessuno installato")

    installed_nodes = client.object_info()
    missing = [
        n for n in ("Canny", "SetUnionControlNetType", "FeatherMask", "GrowMask")
        if n not in installed_nodes
    ]
    if missing:
        print(f"\nATTENZIONE: nodi mancanti nel tuo ComfyUI: {', '.join(missing)}")
        print("Aggiorna ComfyUI (git pull nella cartella ComfyUI).")
    print("\n* = scelto automaticamente quando non specifichi --checkpoint / --vae / ecc.")
    return 0


def cmd_text(args: argparse.Namespace) -> int:
    client = ComfyClient(args.server)
    preset = presets.get(args.preset)
    checkpoint = _resolve_model(
        client, args.checkpoint, "CheckpointLoaderSimple", "ckpt_name",
        CHECKPOINT_PREFERENCE, "checkpoint", placeholder=args.dry_run,
    )
    vae = _resolve_model(
        client, args.vae, "VAELoader", "vae_name", VAE_PREFERENCE, "VAE", required=False,
    )
    width, height = (args.width, args.height) if args.width and args.height else graphs.best_sdxl_size(
        *_ASPECTS.get(args.aspect, (1, 1))
    )
    prompt = graphs.text_to_image(
        checkpoint=checkpoint,
        positive=preset.build_positive(args.prompt),
        negative=preset.build_negative(args.negative),
        width=width,
        height=height,
        batch_size=args.count,
        params=_sampling(args, preset, denoise=1.0),
        vae_name=vae,
        loras=_parse_loras(args.lora),
        prefix="mondo/text",
    )
    return _run(client, prompt, args, "text")


def cmd_staging(args: argparse.Namespace) -> int:
    client = ComfyClient(args.server)
    preset = presets.get(args.preset)
    checkpoint = _resolve_model(
        client, args.checkpoint, "CheckpointLoaderSimple", "ckpt_name",
        CHECKPOINT_PREFERENCE, "checkpoint", placeholder=args.dry_run,
    )
    vae = _resolve_model(
        client, args.vae, "VAELoader", "vae_name", VAE_PREFERENCE, "VAE", required=False,
    )
    controlnet = _resolve_model(
        client, args.controlnet, "ControlNetLoader", "control_net_name",
        CONTROLNET_PREFERENCE, "ControlNet", placeholder=args.dry_run,
    )
    width, height = graphs.best_sdxl_size(*_image_size(args.image))

    if args.dry_run:
        image_name = os.path.basename(args.image)
    else:
        if not client.is_up():
            raise SystemExit(f"ComfyUI non risponde su {client.server}. Avvia avvia-comfyui.bat.")
        image_name = client.upload_image(args.image)

    prompt = graphs.virtual_staging(
        checkpoint=checkpoint,
        image_name=image_name,
        positive=preset.build_positive(args.prompt),
        negative=preset.build_negative(args.negative),
        width=width,
        height=height,
        controlnet_name=controlnet,
        control_strength=args.control if args.control is not None else preset.control_strength,
        is_union="union" in (controlnet or "").lower(),
        params=_sampling(args, preset, denoise=preset.denoise),
        vae_name=vae,
        loras=_parse_loras(args.lora),
        prefix="mondo/staging",
    )
    return _run(client, prompt, args, "staging")


def cmd_retouch(args: argparse.Namespace) -> int:
    client = ComfyClient(args.server)
    preset = presets.get(args.preset)
    checkpoint = _resolve_model(
        client, args.checkpoint, "CheckpointLoaderSimple", "ckpt_name",
        CHECKPOINT_PREFERENCE, "checkpoint", placeholder=args.dry_run,
    )
    vae = _resolve_model(
        client, args.vae, "VAELoader", "vae_name", VAE_PREFERENCE, "VAE", required=False,
    )
    width, height = graphs.best_sdxl_size(*_image_size(args.image))

    if args.dry_run:
        image_name, mask_name = os.path.basename(args.image), os.path.basename(args.mask)
    else:
        if not client.is_up():
            raise SystemExit(f"ComfyUI non risponde su {client.server}. Avvia avvia-comfyui.bat.")
        image_name = client.upload_image(args.image)
        mask_name = client.upload_image(args.mask)

    prompt = graphs.retouch(
        checkpoint=checkpoint,
        image_name=image_name,
        mask_name=mask_name,
        positive=preset.build_positive(args.prompt),
        negative=preset.build_negative(args.negative),
        width=width,
        height=height,
        mask_channel=args.channel,
        grow_mask=args.grow,
        feather=args.feather,
        hard=args.hard,
        params=_sampling(args, preset, denoise=1.0 if args.hard else 0.85),
        vae_name=vae,
        prefix="mondo/retouch",
    )
    return _run(client, prompt, args, "retouch")


def cmd_upscale(args: argparse.Namespace) -> int:
    client = ComfyClient(args.server)
    model = _resolve_model(
        client, args.model, "UpscaleModelLoader", "model_name",
        UPSCALER_PREFERENCE, "modello di upscaling", placeholder=args.dry_run,
    )
    if args.dry_run:
        image_name = os.path.basename(args.image)
    else:
        if not client.is_up():
            raise SystemExit(f"ComfyUI non risponde su {client.server}. Avvia avvia-comfyui.bat.")
        image_name = client.upload_image(args.image)

    prompt = graphs.upscale(
        image_name=image_name,
        model_name=model,
        scale_back_to=0.5 if args.factor == 2 else None,
        prefix="mondo/upscale",
    )
    return _run(client, prompt, args, "upscale")


_ASPECTS = {
    "square": (1, 1),
    "landscape": (4, 3),
    "wide": (16, 9),
    "portrait": (3, 4),
    "story": (9, 16),
}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="mondo-image",
        description="Generazione di immagini in locale su GPU Intel Arc, tramite ComfyUI.",
    )
    parser.add_argument("--server", default=DEFAULT_SERVER, help="URL del server ComfyUI")
    parser.add_argument("--out", default="output", help="Cartella dove salvare i risultati")
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Stampa il grafo JSON senza generare nulla (utile per capire cosa succede)",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    def add_common(sub: argparse.ArgumentParser, *, with_preset: bool = True) -> None:
        if with_preset:
            sub.add_argument(
                "--preset", default=presets.DEFAULT_PRESET, choices=sorted(presets.PRESETS),
                help="Stile e parametri di partenza",
            )
            sub.add_argument("--negative", default="", help="Testo negativo aggiuntivo")
            sub.add_argument("--checkpoint", help="Nome del checkpoint (default: auto)")
            sub.add_argument("--vae", help="Nome del VAE (default: auto)")
            sub.add_argument("--steps", type=int, help="Passi di denoising")
            sub.add_argument("--cfg", type=float, help="Aderenza al prompt (5-7 consigliato)")
            sub.add_argument("--sampler", help="Sampler ComfyUI")
            sub.add_argument("--scheduler", help="Scheduler ComfyUI")
            sub.add_argument("--seed", type=int, help="Seed fisso per risultati riproducibili")
            sub.add_argument("--denoise", type=float, help="Quanto il modello puo' allontanarsi dall'originale")
            sub.add_argument(
                "--lora", action="append",
                help="LoRA da applicare, formato nome.safetensors:0.8 (ripetibile)",
            )

    text = subparsers.add_parser("text", help="Genera un'immagine dal solo testo")
    text.add_argument("prompt", help="Descrizione del soggetto")
    text.add_argument("--aspect", default="landscape", choices=sorted(_ASPECTS))
    text.add_argument("--width", type=int, help="Larghezza esplicita (sovrascrive --aspect)")
    text.add_argument("--height", type=int, help="Altezza esplicita (sovrascrive --aspect)")
    text.add_argument("-n", "--count", type=int, default=1, help="Quante varianti generare")
    add_common(text)
    text.set_defaults(func=cmd_text)

    staging = subparsers.add_parser(
        "staging", help="Arreda o ristruttura una stanza reale mantenendo la geometria"
    )
    staging.add_argument("image", help="Foto della stanza")
    staging.add_argument("prompt", help="Come vuoi che diventi")
    staging.add_argument("--controlnet", help="Nome del ControlNet (default: auto)")
    staging.add_argument(
        "--control", type=float,
        help="Quanto tenere la geometria originale, 0-1 (piu' alto = piu' fedele)",
    )
    add_common(staging)
    staging.set_defaults(func=cmd_staging, preset="interior")

    retouch = subparsers.add_parser("retouch", help="Rigenera solo la zona bianca di una maschera")
    retouch.add_argument("image", help="Foto da modificare")
    retouch.add_argument("mask", help="Maschera PNG: bianco = zona da rigenerare")
    retouch.add_argument("prompt", help="Cosa deve comparire nella zona mascherata")
    retouch.add_argument(
        "--channel", default="red", choices=["red", "green", "blue"],
        help="Canale del PNG da cui leggere la maschera (bianco = zona da rigenerare)",
    )
    retouch.add_argument("--grow", type=int, default=12, help="Allarga la maschera di N pixel")
    retouch.add_argument("--feather", type=int, default=16, help="Sfuma i bordi di N pixel")
    retouch.add_argument(
        "--hard", action="store_true",
        help="Ricostruisce da zero invece di ritoccare (serve un checkpoint da inpainting)",
    )
    add_common(retouch)
    retouch.set_defaults(func=cmd_retouch, preset="interior")

    up = subparsers.add_parser("upscale", help="Ingrandisce un'immagine senza diffusione")
    up.add_argument("image", help="Immagine da ingrandire")
    up.add_argument("--model", help="Modello di upscaling (default: auto)")
    up.add_argument("--factor", type=int, default=2, choices=[2, 4], help="Fattore finale")
    up.set_defaults(func=cmd_upscale)

    doctor = subparsers.add_parser(
        "doctor", help="Verifica il server e mostra i modelli installati"
    )
    doctor.set_defaults(func=cmd_doctor)

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except ComfyError as exc:
        print(f"\nErrore: {exc}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\nInterrotto.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
