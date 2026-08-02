"""Preset di prompt e parametri.

L'utente descrive il soggetto; il preset aggiunge il gergo tecnico che sposta
davvero il risultato (obiettivo, luce, resa) e il negativo che tiene lontani gli
artefatti tipici. Tenerli qui significa che si migliorano in un posto solo.
"""

from __future__ import annotations

from dataclasses import dataclass

# Difetti ricorrenti di SDXL, validi per qualsiasi soggetto.
BASE_NEGATIVE = (
    "lowres, blurry, out of focus, jpeg artifacts, oversaturated, overexposed, "
    "watermark, signature, text, logo, deformed, distorted, extra limbs, "
    "bad anatomy, cartoon, illustration, 3d render, cgi"
)

# Nel fotografico d'interni gli errori peggiori sono geometrici: linee storte,
# prospettive impossibili, stanze che non tornano.
ARCHITECTURE_NEGATIVE = (
    "warped walls, crooked lines, tilted horizon, impossible geometry, "
    "duplicated windows, floating furniture, cluttered, messy, dirty, "
    "fisheye distortion, unrealistic scale"
)


@dataclass(frozen=True)
class Preset:
    name: str
    description: str
    positive_suffix: str
    negative: str
    steps: int = 28
    cfg: float = 6.0
    sampler: str = "dpmpp_2m"
    scheduler: str = "karras"
    denoise: float = 1.0
    control_strength: float = 0.75

    def build_positive(self, subject: str) -> str:
        subject = subject.strip().rstrip(",")
        return f"{subject}, {self.positive_suffix}" if subject else self.positive_suffix

    def build_negative(self, extra: str = "") -> str:
        extra = extra.strip().rstrip(",")
        return f"{self.negative}, {extra}" if extra else self.negative


PRESETS: dict[str, Preset] = {
    "interior": Preset(
        name="interior",
        description="Interni arredati per annunci: virtual staging e ambienti residenziali",
        positive_suffix=(
            "professional real estate interior photography, natural daylight from windows, "
            "soft diffused light, wide angle 24mm lens, straight vertical lines, "
            "tidy and staged, warm inviting atmosphere, high detail, photorealistic"
        ),
        negative=f"{BASE_NEGATIVE}, {ARCHITECTURE_NEGATIVE}, people, faces",
        cfg=5.5,
        denoise=0.72,
        control_strength=0.8,
    ),
    "exterior": Preset(
        name="exterior",
        description="Esterni: facciate, ville, masserie, viste sul mare",
        positive_suffix=(
            "professional real estate exterior photography, golden hour light, clear sky, "
            "wide angle lens, straight vertical lines, well maintained landscaping, "
            "high detail, photorealistic"
        ),
        negative=f"{BASE_NEGATIVE}, {ARCHITECTURE_NEGATIVE}, people, cars, power lines",
        cfg=5.5,
        denoise=0.7,
        control_strength=0.8,
    ),
    "renovation": Preset(
        name="renovation",
        description="Simulazione di ristrutturazione: piu' liberta' sui materiali, geometria intatta",
        positive_suffix=(
            "fully renovated interior, new flooring, freshly painted walls, modern finishes, "
            "professional architectural photography, natural light, high detail, photorealistic"
        ),
        negative=f"{BASE_NEGATIVE}, {ARCHITECTURE_NEGATIVE}, construction debris, unfinished",
        cfg=6.0,
        denoise=0.85,
        control_strength=0.9,
    ),
    "social": Preset(
        name="social",
        description="Grafiche per social e copertine articoli: pulite, con spazio per il testo",
        positive_suffix=(
            "clean editorial composition, negative space for text overlay, "
            "soft natural colour grading, magazine quality, sharp focus, high detail"
        ),
        negative=f"{BASE_NEGATIVE}, busy background, cluttered composition",
        cfg=6.5,
        steps=30,
    ),
    "photo": Preset(
        name="photo",
        description="Fotorealismo generico senza vincoli di stile",
        positive_suffix=(
            "photorealistic, shot on full frame camera, 50mm lens, natural lighting, "
            "shallow depth of field, sharp focus, high detail, film grain"
        ),
        negative=BASE_NEGATIVE,
        cfg=6.0,
        steps=30,
    ),
}

DEFAULT_PRESET = "photo"


def get(name: str) -> Preset:
    try:
        return PRESETS[name]
    except KeyError:
        options = ", ".join(sorted(PRESETS))
        raise SystemExit(f"Preset '{name}' inesistente. Disponibili: {options}") from None
