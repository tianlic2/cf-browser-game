"""Build lighter Black List-inspired diffuse maps from the original SWAT UVs.

The source diffuse and normal maps stay untouched. Run from the repo root:
    python3 tools/recolor_swat.py
"""

from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1] / "assets/classic/swat"
DIFFUSE = (
    "models_player_cf_swat_eb9a780.png",  # trousers and sleeves
    "models_player_cf_swat_ct_urban.png",  # torso, sleeves and tactical vest
    "models_player_cf_swat_backpack.png",
    "models_player_cf_swat_ec17ee0.png",  # tactical pouches
    "models_player_cf_swat_ebc2ae0.png",  # face covering; skin stays untouched
    "models_player_cf_swat_ec02a80.png",  # helmet; goggle lenses stay dark
)


def recolor(source: Path) -> None:
    image = Image.open(source).convert("RGBA")
    pixels = np.asarray(image, dtype=np.float32).copy()
    rgb = pixels[:, :, :3]
    red, green, blue = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    brightness = red * 0.25 + green * 0.60 + blue * 0.15

    # The source uniform is blue while its armour and webbing are near-neutral.
    # Sand cloth and olive-brown armour keep the original folds and straps.
    fabric = (blue > red + 7) & (blue > green + 3)
    cloth_value = np.clip(103 + brightness * 1.10, 0, 220)
    armour_value = np.clip(73 + brightness, 0, 215)
    head_map = source.stem.endswith(("ebc2ae0", "ec02a80"))
    value = (np.clip(103 + brightness * 1.05, 0, 205) if head_map
             else np.where(fabric, cloth_value, armour_value))
    ratios = np.where(fabric[:, :, None],
                      np.array([1.10, 0.94, 0.70]),
                      np.array([1.08, 0.94, 0.76]))
    target = np.clip(value[:, :, None] * ratios, 0, 255)

    # White insignia and metal highlights should stay light.
    highlight = np.clip((brightness - 145) / 70, 0, 1)[:, :, None]
    target = target * (1 - highlight) + rgb * highlight
    preserve = (red > green * 1.18) & (red > blue * 1.30) & (red > 60)
    if source.stem.endswith("ebc2ae0"):
        y, x = np.indices(brightness.shape)
        # Preserve the complete face island, including its shadowed pixels.
        preserve = ((x - 42) / 45) ** 2 + ((y - 126) / 130) ** 2 < 1
    elif source.stem.endswith("ec02a80"):
        y, x = np.indices(brightness.shape)
        # Keep the complete cool visor glass, not just individual blue pixels.
        preserve = ((x - 385) / 125) ** 2 + ((y - 93) / 58) ** 2 < 1
    pixels[:, :, :3] = np.where(preserve[:, :, None], rgb, target)
    output = source.with_name(source.stem + "_bl.png")
    Image.fromarray(pixels.astype(np.uint8)).save(output, optimize=True)
    print(output.relative_to(ROOT.parent.parent.parent))


if __name__ == "__main__":
    for name in DIFFUSE:
        recolor(ROOT / name)
