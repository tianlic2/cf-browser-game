#!/usr/bin/env python3
"""Build local-only Zone13 presentation assets from the imported Source pack.

The inputs and outputs stay below assets/local/cf_bio_candidates, which is
gitignored.  No game executable or Squirrel script is executed.
"""
from __future__ import annotations

import hashlib
import json
import struct
import zlib
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PAK = ROOT / "assets/local/cf_bio_candidates/zone13/pak"
OUT = ROOT / "assets/local/cf_bio_candidates/zone13/runtime-extras"


def png_chunk(kind: bytes, payload: bytes) -> bytes:
    return (struct.pack(">I", len(payload)) + kind + payload +
            struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF))


def rgba_png(width: int, height: int, rgba: bytes) -> bytes:
    rows = b"".join(b"\0" + rgba[y * width * 4:(y + 1) * width * 4]
                    for y in range(height))
    return (b"\x89PNG\r\n\x1a\n" +
            png_chunk(b"IHDR", struct.pack(">2I5B", width, height, 8, 6, 0, 0, 0)) +
            png_chunk(b"IDAT", zlib.compress(rows, 9)) + png_chunk(b"IEND", b""))


def rgb565(value: int) -> tuple[int, int, int, int]:
    return (((value >> 11) & 31) * 255 // 31,
            ((value >> 5) & 63) * 255 // 63,
            (value & 31) * 255 // 31, 255)


def decode_bc3(width: int, height: int, data: bytes) -> bytearray:
    out = bytearray(width * height * 4)
    at = 0
    for by in range((height + 3) // 4):
        for bx in range((width + 3) // 4):
            a0, a1 = data[at], data[at + 1]
            abits = int.from_bytes(data[at + 2:at + 8], "little")
            c0, c1, cbits = struct.unpack_from("<HHI", data, at + 8)
            at += 16
            alphas = [a0, a1]
            if a0 > a1:
                alphas += [((7 - i) * a0 + (i - 1) * a1) // 7 for i in range(2, 8)]
            else:
                alphas += [((5 - i) * a0 + (i - 1) * a1) // 5 for i in range(2, 6)] + [0, 255]
            ca, cb = rgb565(c0), rgb565(c1)
            colors = [ca, cb,
                      tuple((2 * ca[k] + cb[k]) // 3 for k in range(4)),
                      tuple((ca[k] + 2 * cb[k]) // 3 for k in range(4))]
            for py in range(4):
                for px in range(4):
                    x, y = bx * 4 + px, by * 4 + py
                    if x >= width or y >= height:
                        continue
                    n = py * 4 + px
                    color = colors[(cbits >> (2 * n)) & 3]
                    alpha = alphas[(abits >> (3 * n)) & 7]
                    off = (y * width + x) * 4
                    out[off:off + 4] = bytes((*color[:3], alpha))
    return out


def vtf_size(width: int, height: int, fmt: int) -> int:
    if fmt in (13, 20):
        return max(1, (width + 3) // 4) * max(1, (height + 3) // 4) * 8
    if fmt in (14, 15):
        return max(1, (width + 3) // 4) * max(1, (height + 3) // 4) * 16
    return width * height * {0: 4, 1: 4, 2: 3, 3: 3, 11: 4, 12: 4, 16: 4}.get(fmt, 4)


def convert_vtf(source: Path, destination: Path) -> dict:
    blob = source.read_bytes()
    if blob[:4] != b"VTF\0":
        raise ValueError(f"Not a VTF: {source}")
    major, minor, header, width, height = struct.unpack_from("<IIIHH", blob, 4)
    fmt = struct.unpack_from("<I", blob, 52)[0]
    mips = blob[56]
    low_fmt = struct.unpack_from("<I", blob, 57)[0]
    low_w, low_h = blob[61:63]
    pos = header + (vtf_size(low_w, low_h, low_fmt) if low_w and low_h else 0)
    if minor >= 3:
        for index in range(struct.unpack_from("<I", blob, 68)[0]):
            tag, offset = struct.unpack_from("<II", blob, 80 + index * 8)
            if tag & 0xFFFFFF == 0x30:
                pos = offset
    for mip in range(mips - 1, 0, -1):
        pos += vtf_size(max(1, width >> mip), max(1, height >> mip), fmt)
    data = blob[pos:pos + vtf_size(width, height, fmt)]
    if fmt != 15:
        raise ValueError(f"Unsupported Zone13 runtime VTF format {fmt}: {source}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(rgba_png(width, height, decode_bc3(width, height, data)))
    return {"width": width, "height": height, "format": fmt}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    records = []
    for folder, names in {
        "overlays": ["ghostwin", "soldierwin", "zbeye", "zbview"] +
                    [f"power{i}" for i in range(11)],
        "skybox": [f"gray_sky{face}" for face in ("bk", "dn", "ft", "lf", "rt", "up")],
    }.items():
        for name in names:
            source = PAK / "materials" / folder / f"{name}.vtf"
            destination = OUT / folder / f"{name}.png"
            meta = convert_vtf(source, destination)
            records.append({"kind": folder, "name": name,
                            "source": str(source.relative_to(ROOT)),
                            "output": str(destination.relative_to(ROOT)),
                            "sourceSha256": sha256(source),
                            "outputSha256": sha256(destination), **meta})

    infected_source = PAK / "materials/crossfire_infected/infected.vtf"
    infected_output = OUT / "events/infected.png"
    infected_meta = convert_vtf(infected_source, infected_output)
    records.append({"kind": "events", "name": "infected",
                    "source": str(infected_source.relative_to(ROOT)),
                    "output": str(infected_output.relative_to(ROOT)),
                    "sourceSha256": sha256(infected_source),
                    "outputSha256": sha256(infected_output), **infected_meta})

    radar_source = PAK / "resource/overviews/zm_zone13_radar.dds"
    radar_output = OUT / "radar/zm_zone13_radar.png"
    radar_output.parent.mkdir(parents=True, exist_ok=True)
    Image.MAX_IMAGE_PIXELS = None
    with Image.open(radar_source) as image:
        image.convert("RGBA").save(radar_output, optimize=True)
        radar_size = image.size
    overview = {"posX": -3832, "posY": 2501, "scale": 5, "sourcePixels": list(radar_size)}
    records.append({"kind": "radar", "name": "zm_zone13_radar",
                    "source": str(radar_source.relative_to(ROOT)),
                    "output": str(radar_output.relative_to(ROOT)),
                    "sourceSha256": sha256(radar_source), "outputSha256": sha256(radar_output),
                    "width": radar_size[0], "height": radar_size[1], "overview": overview})
    manifest = {"version": 1, "localOnly": True,
                "notice": "Converted from the locally imported Zone13 Source pack; do not publish.",
                "overview": overview, "files": records}
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"output": str(OUT), "files": len(records)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
