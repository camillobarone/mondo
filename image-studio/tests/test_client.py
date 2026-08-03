"""Test sulla lettura di /object_info.

ComfyUI descrive gli input a tendina in due forme diverse a seconda di come il
nodo e' dichiarato. Leggerne una sola faceva sparire dall'elenco i modelli dei
nodi in schema V3, con l'effetto che `doctor` diceva "nessuno installato" per un
file che era regolarmente sul disco.
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from mondo_image.client import combo_options  # noqa: E402

# Forma legacy: la lista delle scelte e' il primo elemento della tupla.
LEGACY = {
    "required": {
        "ckpt_name": [["sd_xl_base_1.0.safetensors", "juggernaut.safetensors"]],
    }
}

# Forma dello schema V3: tipo "COMBO" piu' un dizionario con le opzioni.
# E' quella di UpscaleModelLoader, ImageToMask, Canny e compagnia.
V3 = {
    "required": {
        "model_name": [
            "COMBO",
            {"options": ["RealESRGAN_x4plus.pth"], "tooltip": "modello di upscaling"},
        ],
    }
}


def test_forma_legacy():
    assert combo_options(LEGACY, "ckpt_name") == [
        "sd_xl_base_1.0.safetensors",
        "juggernaut.safetensors",
    ]


def test_forma_schema_v3():
    """Il caso che sfuggiva: le opzioni stanno nel dizionario, non in testa."""
    assert combo_options(V3, "model_name") == ["RealESRGAN_x4plus.pth"]


def test_input_opzionale():
    spec = {"optional": {"vae_name": ["COMBO", {"options": ["sdxl.vae.safetensors"]}]}}
    assert combo_options(spec, "vae_name") == ["sdxl.vae.safetensors"]


def test_campo_inesistente():
    assert combo_options(LEGACY, "campo_che_non_esiste") == []


def test_elenco_vuoto_quando_nulla_e_installato():
    assert combo_options({"required": {"lora_name": [[]]}}, "lora_name") == []
    assert combo_options({"required": {"m": ["COMBO", {"options": []}]}}, "m") == []


def test_forme_impreviste_non_esplodono():
    """Meglio un elenco vuoto che un errore: la CLI deve restare utilizzabile."""
    for strano in (
        {"required": {"x": ["INT", {"default": 1}]}},   # non e' un combo
        {"required": {"x": ["COMBO"]}},                  # dizionario assente
        {"required": {"x": ["COMBO", {"options": "no"}]}},  # opzioni non lista
        {},
    ):
        assert combo_options(strano, "x") == []


def test_valori_non_stringa_diventano_stringhe():
    spec = {"required": {"n": ["COMBO", {"options": [1, 2]}]}}
    assert combo_options(spec, "n") == ["1", "2"]


# --------------------------------------------------------- selezione modelli

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
from mondo_image.cli import _pick, VAE_PREFERENCE, CHECKPOINT_PREFERENCE  # noqa: E402


def test_scarta_le_voci_che_non_sono_file():
    """`pixel_space` e' una modalita' interna di ComfyUI, non un VAE su disco."""
    opzioni = ["pixel_space", "sdxl-vae-fp16-fix.safetensors"]
    assert _pick(opzioni, VAE_PREFERENCE) == "sdxl-vae-fp16-fix.safetensors"
    # Anche quando la voce spuria viene prima e nessuna preferenza combacia.
    assert _pick(["pixel_space", "diffusion_pytorch_model.safetensors"], ()) == \
        "diffusion_pytorch_model.safetensors"


def test_rispetta_l_ordine_di_preferenza():
    opzioni = ["sd_xl_base_1.0.safetensors", "juggernautXL_v9.safetensors"]
    assert _pick(opzioni, CHECKPOINT_PREFERENCE) == "juggernautXL_v9.safetensors"


def test_ripiega_sul_primo_quando_nessuna_preferenza_combacia():
    assert _pick(["ignoto.safetensors"], VAE_PREFERENCE) == "ignoto.safetensors"


def test_nessuna_opzione():
    assert _pick([], VAE_PREFERENCE) is None


def test_solo_voci_spurie_meglio_di_niente():
    """Se non c'e' nessun file, restituire comunque qualcosa da mostrare."""
    assert _pick(["pixel_space"], VAE_PREFERENCE) == "pixel_space"
