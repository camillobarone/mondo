"""Valida i grafi generati contro il registro estratto dal sorgente di ComfyUI.

Il rischio concreto di scrivere grafi ComfyUI a mano e' sbagliare il nome di un
nodo o di un input: l'errore salta fuori solo quando il grafo viene accodato, e
il messaggio di ComfyUI non e' sempre leggibile. Qui lo intercettiamo prima.

Lo snapshot `comfy_registry.json` si rigenera con:
    python tools/extract_comfy_registry.py /percorso/a/ComfyUI tests/comfy_registry.json
"""

from __future__ import annotations

import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from mondo_image import graphs, presets  # noqa: E402

REGISTRY = json.load(
    open(os.path.join(os.path.dirname(__file__), "comfy_registry.json"), encoding="utf-8")
)
NODES = REGISTRY["nodes"]


def validate(prompt: dict) -> None:
    """Ogni nodo esiste, ogni input e' dichiarato, ogni link punta a un nodo reale."""
    assert prompt, "grafo vuoto"
    for node_id, node in prompt.items():
        class_type = node["class_type"]
        assert class_type in NODES, f"nodo inesistente: {class_type}"

        spec = NODES[class_type]
        allowed = set(spec["required"]) | set(spec["optional"])
        for field, value in node["inputs"].items():
            if not spec["spread"]:
                assert field in allowed, (
                    f"{class_type}.{field} non esiste; ammessi: {sorted(allowed)}"
                )
            # Un link e' [id_nodo, indice_output].
            if isinstance(value, list) and len(value) == 2 and isinstance(value[0], str):
                assert value[0] in prompt, (
                    f"{class_type}.{field} punta al nodo {value[0]} che non esiste"
                )
                assert isinstance(value[1], int), f"{class_type}.{field} indice non valido"

        # Gli input obbligatori vanno tutti forniti, altrimenti ComfyUI rifiuta.
        if not spec["spread"]:
            for field in spec["required"]:
                assert field in node["inputs"], f"{class_type}: manca l'input '{field}'"

    saves = [n for n in prompt.values() if n["class_type"] == "SaveImage"]
    assert len(saves) == 1, "il grafo deve salvare esattamente un'uscita"


def test_text_to_image():
    validate(
        graphs.text_to_image(
            checkpoint="sd_xl_base_1.0.safetensors",
            positive="una masseria in Salento",
            negative="lowres",
            vae_name="sdxl.vae.safetensors",
            clip_skip=2,
            loras=[("stile.safetensors", 0.7)],
        )
    )


def test_text_to_image_minimo():
    """Senza VAE esterno, senza LoRA, senza clip skip: deve restare valido."""
    validate(
        graphs.text_to_image(
            checkpoint="modello.safetensors", positive="soggetto", negative=""
        )
    )


@pytest.mark.parametrize("is_union", [True, False])
def test_virtual_staging(is_union):
    validate(
        graphs.virtual_staging(
            checkpoint="juggernaut.safetensors",
            image_name="mondo/stanza.jpg",
            positive="soggiorno arredato",
            negative="disordine",
            width=1216,
            height=832,
            controlnet_name="union_promax.safetensors",
            is_union=is_union,
            vae_name="sdxl.vae.safetensors",
        )
    )


@pytest.mark.parametrize("hard", [True, False])
def test_retouch(hard):
    validate(
        graphs.retouch(
            checkpoint="juggernaut.safetensors",
            image_name="mondo/cucina.jpg",
            mask_name="mondo/maschera.png",
            positive="parete intonacata bianca",
            negative="",
            width=1024,
            height=1024,
            hard=hard,
        )
    )


def test_maschera_allineata_alla_foto():
    """Foto e maschera devono subire lo stesso riscalamento e lo stesso ritaglio.

    Se la maschera venisse solo stirata, su una foto con proporzioni diverse dal
    bucket SDXL la zona rigenerata finirebbe spostata rispetto a quella marcata.
    """
    prompt = graphs.retouch(
        checkpoint="m.safetensors", image_name="foto.jpg", mask_name="maschera.png",
        positive="p", negative="", width=1216, height=832,
    )
    scales = [n["inputs"] for n in prompt.values() if n["class_type"] == "ImageScale"]
    assert len(scales) == 2, "servono due riscalamenti: uno per la foto, uno per la maschera"
    for inputs in scales:
        assert (inputs["width"], inputs["height"]) == (1216, 832)
        assert inputs["crop"] == "center"

    # La maschera si ricava dal canale colore dell'immagine riscalata.
    to_mask = next(n for n in prompt.values() if n["class_type"] == "ImageToMask")
    source_id = to_mask["inputs"]["image"][0]
    assert prompt[source_id]["class_type"] == "ImageScale"
    # Interpolazione senza sovraelongazioni: niente aloni sui bordi della maschera.
    assert prompt[source_id]["inputs"]["upscale_method"] == "bilinear"


def test_retouch_senza_bordi():
    validate(
        graphs.retouch(
            checkpoint="m.safetensors", image_name="a.jpg", mask_name="b.png",
            positive="p", negative="", width=1024, height=1024, grow_mask=0, feather=0,
        )
    )


@pytest.mark.parametrize("scale_back", [None, 0.5])
def test_upscale(scale_back):
    validate(
        graphs.upscale(
            image_name="foto.png", model_name="RealESRGAN_x4plus.pth", scale_back_to=scale_back
        )
    )


def test_valori_enum_ammessi():
    """Sampler, scheduler e tipo di ControlNet devono essere valori che ComfyUI accetta."""
    prompt = graphs.virtual_staging(
        checkpoint="m.safetensors", image_name="a.jpg", positive="p", negative="",
        width=1024, height=1024, controlnet_name="union.safetensors",
    )
    ksampler = next(n for n in prompt.values() if n["class_type"] == "KSampler")
    assert ksampler["inputs"]["sampler_name"] in REGISTRY["samplers"]
    assert ksampler["inputs"]["scheduler"] in REGISTRY["schedulers"]

    union = next(n for n in prompt.values() if n["class_type"] == "SetUnionControlNetType")
    assert union["inputs"]["type"] in REGISTRY["union_controlnet_types"]

    scale = next(n for n in prompt.values() if n["class_type"] == "ImageScale")
    assert scale["inputs"]["upscale_method"] in ("nearest-exact", "bilinear", "area", "bicubic", "lanczos")
    assert scale["inputs"]["crop"] in ("disabled", "center")


def test_preset_sampler_validi():
    for preset in presets.PRESETS.values():
        assert preset.sampler in REGISTRY["samplers"], preset.name
        assert preset.scheduler in REGISTRY["schedulers"], preset.name
        assert 0.0 < preset.denoise <= 1.0, preset.name


@pytest.mark.parametrize(
    "size,expected_ratio",
    [((4000, 3000), 4 / 3), ((3000, 4000), 3 / 4), ((1920, 1080), 16 / 9), ((1000, 1000), 1.0)],
)
def test_bucket_sdxl(size, expected_ratio):
    """La risoluzione scelta deve stare vicino al rapporto d'aspetto della foto."""
    width, height = graphs.best_sdxl_size(*size)
    assert (width, height) in graphs.SDXL_BUCKETS
    assert abs((width / height) - expected_ratio) < 0.2
    assert width % 64 == 0 and height % 64 == 0


def test_bucket_dimensioni_invalide():
    assert graphs.best_sdxl_size(0, 0) == (1024, 1024)


def test_preset_compone_prompt():
    preset = presets.get("interior")
    positive = preset.build_positive("soggiorno con divano,")
    assert positive.startswith("soggiorno con divano,")
    assert "photorealistic" in positive
    assert "people" in preset.build_negative()
    assert "senza tende" in preset.build_negative("senza tende")


def test_preset_inesistente():
    with pytest.raises(SystemExit):
        presets.get("inesistente")
