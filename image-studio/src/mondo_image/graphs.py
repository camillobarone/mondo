"""Costruzione dei grafi ComfyUI in formato API.

Ogni funzione qui restituisce un dizionario pronto per POST /prompt. Usiamo il
formato API e non quello della UI perche' e' deterministico: nessun ordinamento
di widget da indovinare, nessuna coordinata, nessun id di link.

Tutti i nodi impiegati sono nativi di ComfyUI. Questa e' una scelta voluta: su
Intel Arc i custom node sono la prima causa di installazioni che si rompono, e
un grafo che usa solo nodi di base sopravvive agli aggiornamenti.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

# Risoluzioni native su cui SDXL e' stato addestrato. Uscire da questi rapporti
# produce composizioni allungate e arti duplicati.
SDXL_BUCKETS: tuple[tuple[int, int], ...] = (
    (1024, 1024),
    (1152, 896),
    (896, 1152),
    (1216, 832),
    (832, 1216),
    (1344, 768),
    (768, 1344),
    (1536, 640),
    (640, 1536),
)

# Il valore che SetUnionControlNetType si aspetta per il canale dei contorni.
UNION_TYPE_CANNY = "canny/lineart/anime_lineart/mlsd"
UNION_TYPE_DEPTH = "depth"

Link = list  # [id_nodo, indice_output]


def best_sdxl_size(width: int, height: int) -> tuple[int, int]:
    """Sceglie il bucket SDXL col rapporto d'aspetto piu' vicino all'originale."""
    if width <= 0 or height <= 0:
        return (1024, 1024)
    target = width / height
    return min(SDXL_BUCKETS, key=lambda wh: abs((wh[0] / wh[1]) - target))


@dataclass
class Graph:
    """Accumulatore di nodi che si serializza nel formato API di ComfyUI."""

    nodes: dict[str, dict[str, Any]] = field(default_factory=dict)
    _counter: int = 0

    def add(self, class_type: str, **inputs: Any) -> str:
        self._counter += 1
        node_id = str(self._counter)
        self.nodes[node_id] = {"class_type": class_type, "inputs": inputs}
        return node_id

    def to_prompt(self) -> dict[str, dict[str, Any]]:
        return self.nodes


@dataclass
class SamplingParams:
    """Parametri di campionamento condivisi da tutte le modalita'."""

    steps: int = 28
    cfg: float = 6.0
    sampler: str = "dpmpp_2m"
    scheduler: str = "karras"
    seed: int = 0
    denoise: float = 1.0


def _model_and_clip(graph: Graph, checkpoint: str, clip_skip: int) -> tuple[Link, Link, Link]:
    """Carica il checkpoint e restituisce i link (model, clip, vae)."""
    ckpt = graph.add("CheckpointLoaderSimple", ckpt_name=checkpoint)
    clip: Link = [ckpt, 1]
    if clip_skip:
        # ComfyUI vuole un valore negativo: -1 = ultimo layer, -2 = penultimo.
        skip = graph.add("CLIPSetLastLayer", clip=clip, stop_at_clip_layer=-abs(clip_skip))
        clip = [skip, 0]
    return [ckpt, 0], clip, [ckpt, 2]


def _vae_link(graph: Graph, ckpt_vae: Link, vae_name: str | None) -> Link:
    """Il VAE esterno fp16-fix evita gli artefatti viola tipici del VAE SDXL in fp16."""
    if not vae_name:
        return ckpt_vae
    loader = graph.add("VAELoader", vae_name=vae_name)
    return [loader, 0]


def _encode_prompts(graph: Graph, clip: Link, positive: str, negative: str) -> tuple[Link, Link]:
    pos = graph.add("CLIPTextEncode", text=positive, clip=clip)
    neg = graph.add("CLIPTextEncode", text=negative, clip=clip)
    return [pos, 0], [neg, 0]


def _apply_loras(graph: Graph, model: Link, clip: Link, loras: list[tuple[str, float]]) -> tuple[Link, Link]:
    for name, strength in loras:
        node = graph.add(
            "LoraLoader",
            model=model,
            clip=clip,
            lora_name=name,
            strength_model=strength,
            strength_clip=strength,
        )
        model, clip = [node, 0], [node, 1]
    return model, clip


def _sample_and_save(
    graph: Graph,
    *,
    model: Link,
    positive: Link,
    negative: Link,
    latent: Link,
    vae: Link,
    params: SamplingParams,
    prefix: str,
) -> Graph:
    sampler = graph.add(
        "KSampler",
        model=model,
        seed=params.seed,
        steps=params.steps,
        cfg=params.cfg,
        sampler_name=params.sampler,
        scheduler=params.scheduler,
        positive=positive,
        negative=negative,
        latent_image=latent,
        denoise=params.denoise,
    )
    decode = graph.add("VAEDecode", samples=[sampler, 0], vae=vae)
    graph.add("SaveImage", images=[decode, 0], filename_prefix=prefix)
    return graph


def text_to_image(
    *,
    checkpoint: str,
    positive: str,
    negative: str,
    width: int = 1024,
    height: int = 1024,
    batch_size: int = 1,
    params: SamplingParams | None = None,
    vae_name: str | None = None,
    clip_skip: int = 0,
    loras: list[tuple[str, float]] | None = None,
    prefix: str = "mondo/text",
) -> dict[str, Any]:
    """Generazione da solo testo. Usata per grafiche social e immagini di stock."""
    params = params or SamplingParams()
    graph = Graph()
    model, clip, ckpt_vae = _model_and_clip(graph, checkpoint, clip_skip)
    model, clip = _apply_loras(graph, model, clip, loras or [])
    pos, neg = _encode_prompts(graph, clip, positive, negative)
    latent = graph.add("EmptyLatentImage", width=width, height=height, batch_size=batch_size)
    _sample_and_save(
        graph,
        model=model,
        positive=pos,
        negative=neg,
        latent=[latent, 0],
        vae=_vae_link(graph, ckpt_vae, vae_name),
        params=params,
        prefix=prefix,
    )
    return graph.to_prompt()


def virtual_staging(
    *,
    checkpoint: str,
    image_name: str,
    positive: str,
    negative: str,
    width: int,
    height: int,
    controlnet_name: str,
    control_strength: float = 0.75,
    control_end: float = 0.85,
    canny_low: float = 0.25,
    canny_high: float = 0.6,
    is_union: bool = True,
    control_type: str = UNION_TYPE_CANNY,
    params: SamplingParams | None = None,
    vae_name: str | None = None,
    clip_skip: int = 0,
    loras: list[tuple[str, float]] | None = None,
    prefix: str = "mondo/staging",
) -> dict[str, Any]:
    """Arreda o ristruttura una stanza reale mantenendone la geometria.

    La foto viene ridotta ai contorni con Canny e questi vengono dati in pasto al
    ControlNet: muri, finestre e prospettiva restano al loro posto mentre il
    sampler riempie il resto. `denoise` controlla quanta liberta' ha il modello.
    Canny e' un nodo nativo, quindi non serve nessun preprocessore esterno.
    """
    params = params or SamplingParams(denoise=0.72)
    graph = Graph()
    model, clip, ckpt_vae = _model_and_clip(graph, checkpoint, clip_skip)
    model, clip = _apply_loras(graph, model, clip, loras or [])
    vae = _vae_link(graph, ckpt_vae, vae_name)

    load = graph.add("LoadImage", image=image_name)
    scaled = graph.add(
        "ImageScale",
        image=[load, 0],
        upscale_method="lanczos",
        width=width,
        height=height,
        crop="center",
    )
    hint = graph.add(
        "Canny", image=[scaled, 0], low_threshold=canny_low, high_threshold=canny_high
    )

    controlnet = graph.add("ControlNetLoader", control_net_name=controlnet_name)
    control_link: Link = [controlnet, 0]
    if is_union:
        typed = graph.add("SetUnionControlNetType", control_net=control_link, type=control_type)
        control_link = [typed, 0]

    pos, neg = _encode_prompts(graph, clip, positive, negative)
    applied = graph.add(
        "ControlNetApplyAdvanced",
        positive=pos,
        negative=neg,
        control_net=control_link,
        image=[hint, 0],
        strength=control_strength,
        start_percent=0.0,
        end_percent=control_end,
    )
    latent = graph.add("VAEEncode", pixels=[scaled, 0], vae=vae)
    _sample_and_save(
        graph,
        model=model,
        positive=[applied, 0],
        negative=[applied, 1],
        latent=[latent, 0],
        vae=vae,
        params=params,
        prefix=prefix,
    )
    return graph.to_prompt()


def retouch(
    *,
    checkpoint: str,
    image_name: str,
    mask_name: str,
    positive: str,
    negative: str,
    width: int,
    height: int,
    mask_channel: str = "red",  # canale RGB del PNG di maschera
    grow_mask: int = 12,
    feather: int = 16,
    hard: bool = False,
    params: SamplingParams | None = None,
    vae_name: str | None = None,
    clip_skip: int = 0,
    prefix: str = "mondo/retouch",
) -> dict[str, Any]:
    """Rigenera solo la zona bianca della maschera: togliere mobili, cambiare un pavimento.

    Due strategie:
      - `hard=False` (default) VAEEncode + SetLatentNoiseMask con denoise parziale.
        Funziona con qualsiasi checkpoint SDXL normale ed e' il caso comune.
      - `hard=True` VAEEncodeForInpaint, che azzera l'area mascherata. Ricostruisce
        da zero ma da' il meglio con un checkpoint addestrato per l'inpainting.
    """
    params = params or SamplingParams(denoise=1.0 if hard else 0.85)
    graph = Graph()
    model, clip, ckpt_vae = _model_and_clip(graph, checkpoint, clip_skip)
    vae = _vae_link(graph, ckpt_vae, vae_name)

    load = graph.add("LoadImage", image=image_name)
    scaled = graph.add(
        "ImageScale",
        image=[load, 0],
        upscale_method="lanczos",
        width=width,
        height=height,
        crop="center",
    )
    # La maschera deve subire lo stesso riscalamento e lo stesso ritaglio della
    # foto, altrimenti su un'immagine con proporzioni diverse dal bucket SDXL le
    # due si disallineano e la zona rigenerata finisce fuori posto. Passarla per
    # LoadImageMask non basta: quella strada la stira soltanto.
    # Interpolazione bilineare e non lanczos: su una maschera binaria il lanczos
    # crea sovraelongazioni ai bordi, cioe' aloni.
    mask_image = graph.add("LoadImage", image=mask_name)
    mask_scaled = graph.add(
        "ImageScale",
        image=[mask_image, 0],
        upscale_method="bilinear",
        width=width,
        height=height,
        crop="center",
    )
    mask_node = graph.add("ImageToMask", image=[mask_scaled, 0], channel=mask_channel)
    mask: Link = [mask_node, 0]
    if grow_mask:
        grown = graph.add("GrowMask", mask=mask, expand=grow_mask, tapered_corners=True)
        mask = [grown, 0]
    if feather:
        # Bordi sfumati: evita lo stacco netto fra zona rigenerata e foto originale.
        feathered = graph.add(
            "FeatherMask", mask=mask, left=feather, top=feather, right=feather, bottom=feather
        )
        mask = [feathered, 0]

    pos, neg = _encode_prompts(graph, clip, positive, negative)
    if hard:
        latent_node = graph.add(
            "VAEEncodeForInpaint", pixels=[scaled, 0], vae=vae, mask=mask, grow_mask_by=6
        )
        latent: Link = [latent_node, 0]
    else:
        encoded = graph.add("VAEEncode", pixels=[scaled, 0], vae=vae)
        masked = graph.add("SetLatentNoiseMask", samples=[encoded, 0], mask=mask)
        latent = [masked, 0]

    _sample_and_save(
        graph,
        model=model,
        positive=pos,
        negative=neg,
        latent=latent,
        vae=vae,
        params=params,
        prefix=prefix,
    )
    return graph.to_prompt()


def upscale(
    *,
    image_name: str,
    model_name: str,
    scale_back_to: float | None = None,
    prefix: str = "mondo/upscale",
) -> dict[str, Any]:
    """Ingrandimento con modello ESRGAN. Nessuna diffusione, quindi pochissima VRAM.

    Il modello e' 4x; `scale_back_to` (es. 0.5) riduce dopo l'ingrandimento per
    ottenere un 2x piu' pulito, che e' quello che serve per il web.
    """
    graph = Graph()
    load = graph.add("LoadImage", image=image_name)
    upscaler = graph.add("UpscaleModelLoader", model_name=model_name)
    result = graph.add("ImageUpscaleWithModel", upscale_model=[upscaler, 0], image=[load, 0])
    images: Link = [result, 0]
    if scale_back_to and scale_back_to != 1.0:
        resized = graph.add(
            "ImageScaleBy", image=images, upscale_method="lanczos", scale_by=scale_back_to
        )
        images = [resized, 0]
    graph.add("SaveImage", images=images, filename_prefix=prefix)
    return graph.to_prompt()
