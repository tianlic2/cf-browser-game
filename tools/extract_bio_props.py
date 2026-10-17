"""Extract separately licensed Sketchfab props from the Zeta Airbase GLB.

Run with the source project's map.glb as the only argument. The combined map
contains assets with incompatible licenses, so it must never ship as-is.
This copies only the selected node dependencies and their compressed bytes.
"""

from __future__ import annotations

import copy
import json
import struct
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROPS = {
    "power_box": ([2], "YannickGodeau", "Electric Box", "CC-BY-4.0"),
    "wrecked_suv": ([16], "Rashad Ibrahimli", "Crashed Abandoned Car - Game Ready", "CC-BY-4.0"),
    "watchtower": ([3, 4, 5, 6], "standerwickd", "WWII Air Trafic Control Tower", "CC-BY-4.0"),
}


def read_glb(path: Path):
    data = path.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", data)
    if magic != b"glTF" or version != 2 or length != len(data):
        raise ValueError("Expected a complete GLB 2.0 file")
    offset = 12
    chunks = {}
    while offset < length:
        size, kind = struct.unpack_from("<I4s", data, offset)
        offset += 8
        chunks[kind] = data[offset:offset + size]
        offset += size
    return json.loads(chunks[b"JSON"]), chunks[b"BIN\0"]


def extract(source, binary, selected, author, title, license_name):
    doc = {"asset": copy.deepcopy(source["asset"]), "scene": 0}
    doc["asset"]["generator"] = "Tactical Assault licensed prop extraction"
    doc["asset"]["extras"] = {"title": title, "author": author, "license": license_name,
                                 "source": "RohanVashisht1234/threejs-zombieshooter-game public/map.glb"}
    remap = {kind: {} for kind in ("nodes", "meshes", "materials", "textures", "images",
                                   "samplers", "accessors", "bufferViews")}
    blob = bytearray()

    def copy_item(kind, old):
        if old in remap[kind]:
            return remap[kind][old]
        new = len(remap[kind])
        remap[kind][old] = new
        doc.setdefault(kind, []).append(None)
        item = copy.deepcopy(source[kind][old])
        if kind == "nodes":
            if "mesh" in item:
                item["mesh"] = copy_item("meshes", item["mesh"])
            if "children" in item:
                item["children"] = [copy_item("nodes", child) for child in item["children"]]
        elif kind == "meshes":
            for primitive in item["primitives"]:
                primitive["attributes"] = {key: copy_item("accessors", value)
                                           for key, value in primitive["attributes"].items()}
                if "indices" in primitive:
                    primitive["indices"] = copy_item("accessors", primitive["indices"])
                if "material" in primitive:
                    primitive["material"] = copy_item("materials", primitive["material"])
                if "targets" in primitive:
                    primitive["targets"] = [{key: copy_item("accessors", value)
                                              for key, value in target.items()}
                                             for target in primitive["targets"]]
        elif kind == "materials":
            def remap_textures(value):
                if isinstance(value, dict):
                    for key, child in value.items():
                        if key.endswith("Texture") and isinstance(child, dict) and "index" in child:
                            child["index"] = copy_item("textures", child["index"])
                        else:
                            remap_textures(child)
                elif isinstance(value, list):
                    for child in value:
                        remap_textures(child)
            remap_textures(item)
        elif kind == "textures":
            if "sampler" in item:
                item["sampler"] = copy_item("samplers", item["sampler"])
            if "source" in item:
                item["source"] = copy_item("images", item["source"])
            for extension in item.get("extensions", {}).values():
                if "source" in extension:
                    extension["source"] = copy_item("images", extension["source"])
        elif kind == "images":
            if "bufferView" in item:
                item["bufferView"] = copy_item("bufferViews", item["bufferView"])
        elif kind == "accessors":
            if "sparse" in item:
                raise ValueError("Sparse accessor not supported by this extractor")
            if "bufferView" in item:
                item["bufferView"] = copy_item("bufferViews", item["bufferView"])
        elif kind == "bufferViews":
            while len(blob) % 4:
                blob.append(0)
            extension = item.get("extensions", {}).get("EXT_meshopt_compression")
            if extension:
                start, size = extension["byteOffset"], extension["byteLength"]
                if extension["buffer"] != 0:
                    raise ValueError("Unexpected compressed buffer")
                extension["byteOffset"] = len(blob)
            else:
                start, size = item.get("byteOffset", 0), item["byteLength"]
                if item["buffer"] != 0:
                    raise ValueError("Unexpected uncompressed buffer")
                item["byteOffset"] = len(blob)
            blob.extend(binary[start:start + size])
            if len(binary[start:start + size]) != size:
                raise ValueError("Truncated source buffer")
        doc[kind][new] = item
        return new

    doc["scenes"] = [{"nodes": [copy_item("nodes", node) for node in selected]}]
    doc["extensionsUsed"] = [ext for ext in source.get("extensionsUsed", [])
                             if ext != "KHR_lights_punctual"]
    doc["extensionsRequired"] = [ext for ext in source.get("extensionsRequired", [])
                                 if ext != "KHR_lights_punctual"]
    doc["buffers"] = [{"byteLength": len(blob)},
                      {"byteLength": source["buffers"][1]["byteLength"],
                       "extensions": copy.deepcopy(source["buffers"][1]["extensions"])}]
    while len(blob) % 4:
        blob.append(0)
    encoded = json.dumps(doc, separators=(",", ":"), ensure_ascii=False).encode()
    encoded += b" " * (-len(encoded) % 4)
    payload = struct.pack("<I4s", len(encoded), b"JSON") + encoded
    payload += struct.pack("<I4s", len(blob), b"BIN\0") + blob
    return struct.pack("<4sII", b"glTF", 2, len(payload) + 12) + payload


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: extract_bio_props.py path/to/map.glb")
    source, binary = read_glb(Path(sys.argv[1]))
    output = ROOT / "assets" / "bio" / "props"
    output.mkdir(parents=True, exist_ok=True)
    for name, (nodes, author, title, license_name) in PROPS.items():
        path = output / f"{name}.glb"
        path.write_bytes(extract(source, binary, nodes, author, title, license_name))
        print(f"{path.name}: {path.stat().st_size} bytes / nodes {nodes}")


if __name__ == "__main__":
    main()
