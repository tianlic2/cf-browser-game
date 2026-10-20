"""Compose the two Lingyin plaques from new art and exact brush-script glyphs.

Download MasaFont-Medium.ttf from https://github.com/max32002/masafont,
then run: python3 tools/generate_lingyin_plaques.py /path/to/MasaFont-Medium.ttf
The font is used at build time only; the game loads the resulting WebP images.
"""

from pathlib import Path
import random
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
TEXTURES = ROOT / "assets/lingyin/temple-textures"
SIZE = (1536, 440)  # 4.2m / 1.2m world-space plaque ratio


def create(font_path: Path, source: str, output: str, glyphs: str, ink: str) -> None:
    art = Image.open(TEXTURES / source).convert("RGB")
    board = ImageOps.fit(art, SIZE, method=Image.Resampling.LANCZOS, centering=(.5, .5))

    # A quiet centre keeps all four characters legible over the generated relief.
    wash = Image.new("RGBA", SIZE, (236, 187, 98, 0))
    wash_alpha = Image.new("L", SIZE, 0)
    wash_draw = ImageDraw.Draw(wash_alpha)
    wash_draw.rounded_rectangle((57, 26, 1479, 414), 28, fill=44)
    wash.putalpha(wash_alpha.filter(ImageFilter.GaussianBlur(56)))
    board = Image.alpha_composite(board.convert("RGBA"), wash)

    # Read the inscription from right to left, as on the supplied traditional
    # horizontal signboards: "靈隱寺" appears visually as 寺 隱 靈.
    font = ImageFont.truetype(str(font_path), 318 if len(glyphs) == 3 else 283)
    spacing = 416 if len(glyphs) == 3 else 340
    centres = [SIZE[0] / 2 + (i - (len(glyphs) - 1) / 2) * spacing for i in range(len(glyphs))]
    mask = Image.new("L", SIZE, 0)
    draw = ImageDraw.Draw(mask)
    for cx, ch in zip(centres, reversed(glyphs)):
        bounds = draw.textbbox((0, 0), ch, font=font, stroke_width=0)
        width, height = bounds[2] - bounds[0], bounds[3] - bounds[1]
        draw.text((round(cx - width / 2 - bounds[0]), round(SIZE[1] / 2 - height / 2 - bounds[1])), ch, font=font, fill=255)

    # Ink is slightly absorbed into the old gilded surface, not a floating UI label.
    shadow = Image.new("RGBA", SIZE, (23, 12, 7, 0))
    shadow.putalpha(mask.filter(ImageFilter.GaussianBlur(3)).point(lambda v: round(v * .38)))
    board = Image.alpha_composite(board, shadow)
    grain = Image.new("L", SIZE, 255)
    pixels = grain.load()
    rng = random.Random(0x1A6D17)
    for y in range(SIZE[1]):
        for x in range(SIZE[0]):
            pixels[x, y] = 228 + rng.randrange(28)
    mask = Image.blend(mask, Image.new("L", SIZE, 0), .04)
    mask = Image.composite(grain, Image.new("L", SIZE, 0), mask)
    letters = Image.new("RGBA", SIZE, ink)
    letters.putalpha(mask)
    board = Image.alpha_composite(board, letters).convert("RGB")
    board.save(TEXTURES / output, "WEBP", quality=91, method=6)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: generate_lingyin_plaques.py /path/to/MasaFont-Medium.ttf")
    font_file = Path(sys.argv[1])
    create(font_file, "plaque-gate-generated.webp", "plaque-gate.webp", "靈隱寺", "#1b140d")
    create(font_file, "plaque-main-generated.webp", "plaque-main.webp", "大雄寶殿", "#17100a")
