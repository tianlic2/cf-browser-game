#!/usr/bin/env python3
"""Split large generated assets without changing their reconstructed bytes."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CHUNK_BYTES = 600 * 1024


def split_file(path: Path) -> list[str]:
    prefix = path.name + ".part"
    for stale in path.parent.glob(prefix + "[0-9][0-9]"):
        stale.unlink()
    names: list[str] = []
    with path.open("rb") as source:
        index = 0
        while chunk := source.read(CHUNK_BYTES):
            name = f"{prefix}{index:02d}"
            (path.parent / name).write_bytes(chunk)
            names.append(name)
            index += 1
    return names


def chunk_map(folder: str) -> None:
    directory = ROOT / "assets" / "classic" / folder
    manifest = {
        "format": 1,
        "jsonParts": split_file(directory / "map.json"),
        "binaryParts": split_file(directory / "map.bin"),
    }
    (directory / "map.assets.json").write_text(
        json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )


def chunk_ironbeast() -> None:
    directory = ROOT / "assets" / "classic" / "m4_ironbeast"
    view_path = directory / "view.json"
    view = json.loads(view_path.read_text(encoding="utf-8"))
    view["binaryParts"] = split_file(directory / "view.bin")
    view_path.write_text(
        json.dumps(view, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    chunk_ironbeast()
    chunk_map("blacktown")
    chunk_map("survivor")
