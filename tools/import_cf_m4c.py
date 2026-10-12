"""Import the black M4A1-C model and its sounds from GameBanana mod 211325.

Usage: python3 tools/import_cf_m4c.py /path/to/M4A1_CUSTOM_PACK
The Source model is converted to an embedded, static GLB; no Source executable runs.
See assets/classic/CREDITS.md for the source and rights notes.
"""
import io
import json
import shutil
import struct
import sys
from pathlib import Path

import numpy as np

from import_cf_source import unpack, string, vtf

ROOT = Path(sys.argv[1])
REQUIRED = ROOT / "Required"
TEXTURES = ROOT / "Choose Texture" / "Black (Original)" / "materials/models/weapons/v_models/cf_m4a1custom"
PROJECT = Path(__file__).resolve().parents[1]
OUT = PROJECT / "assets/classic/m4c"
OUT.mkdir(parents=True, exist_ok=True)

stem = "w_rif_sg552"
base = REQUIRED / "models/weapons"
mdl = (base / (stem + ".mdl")).read_bytes()
vvd = (base / (stem + ".vvd")).read_bytes()
vtx = (base / (stem + ".dx90.vtx")).read_bytes()
assert mdl[:4] == b"IDST" and unpack(mdl, "i", 4)[0] == 44
assert unpack(mdl, "i", 8)[0] == unpack(vvd, "i", 8)[0] == unpack(vtx, "i", 16)[0]

nt, texoff = unpack(mdl, "2i", 204)
names = [string(mdl, texoff + i * 64 + unpack(mdl, "i", texoff + i * 64)[0]) for i in range(nt)]
assert names == ["PV-M4A1-CUSTOM", "PV_M4A1EX_ADVANCE"], names

nv = unpack(vvd, "i", 16)[0]
nfix, fixoff, vertoff = unpack(vvd, "3i", 48)
vertices = [unpack(vvd, "3f4B8f", vertoff + i * 48) for i in range(nv)]
if nfix:
    remapped = []
    for i in range(nfix):
        _, start, count = unpack(vvd, "3i", fixoff + i * 12)
        remapped.extend(vertices[start:start + count])
    vertices = remapped

bodycount, bodyoff = unpack(mdl, "2i", 232)
vbodycount, vbodyoff = unpack(vtx, "2i", 28)
assert bodycount == vbodycount == 1
body = bodyoff
_, modelcount, _, modeloff = unpack(mdl, "4i", body)
vbody = vbodyoff
_, vmodeloff = unpack(vtx, "2i", vbody)
assert modelcount == 1
model = body + modeloff
vmodel = vbody + vmodeloff
meshcount, meshoff, _, vertexbase = unpack(mdl, "4i", model + 72)
lodcount, vlodoff = unpack(vtx, "2i", vmodel)
vlod = vmodel + vlodoff
vlodmeshcount, vmeshoff = unpack(vtx, "2i", vlod)
assert lodcount >= 1 and meshcount == vlodmeshcount == 2

prims = []
for k in range(meshcount):
    mesh = model + meshoff + k * 116
    material, _, _, offset = unpack(mdl, "4i", mesh)
    vmesh = vlod + vmeshoff + k * 9
    stripgroups, stripoff = unpack(vtx, "2i", vmesh)
    triangles = []
    for g in range(stripgroups):
        group = vmesh + stripoff + g * 25
        vcount, vo, icount, indexoff, nstrips, so = unpack(vtx, "6i", group)
        refs = [unpack(vtx, "H", group + vo + j * 9 + 4)[0] + offset + vertexbase // 48 for j in range(vcount)]
        indices = unpack(vtx, str(icount) + "H", group + indexoff)
        for s in range(nstrips):
            strip = group + so + s * 27
            count, start = unpack(vtx, "2i", strip)
            flags = vtx[strip + 18]
            ids = [refs[j] for j in indices[start:start + count]]
            if flags & 1:
                triangles.extend(ids)
            else:
                for j in range(len(ids) - 2):
                    triangles.extend((ids[j + j % 2], ids[j + 1 - j % 2], ids[j + 2]))
    assert len(triangles) % 3 == 0 and all(0 <= i < len(vertices) for i in triangles)
    # Source's optimized VTX winding is clockwise. The coordinate conversion
    # below is a pure rotation, so invert each triangle for glTF's CCW front.
    triangles = [triangles[i + j] for i in range(0, len(triangles), 3) for j in (0, 2, 1)]
    vals = np.array([vertices[i][7:15] for i in triangles], dtype="<f4")
    pos = vals[:, :3].copy()
    normal = vals[:, 3:6].copy()
    # Source: +Z up, barrel toward -Y. glTF: +Y up, barrel initially +Z.
    pos[:] = pos[:, [0, 2, 1]] * [1, 1, -1]
    normal[:] = normal[:, [0, 2, 1]] * [1, 1, -1]
    uv = vals[:, 6:8].copy()
    uv[:, 1] = 1 - uv[:, 1]
    prims.append((material, pos, normal, uv))

doc = {
    "asset": {"version": "2.0", "generator": "CF M4A1-C Source MDL conversion; see assets/classic/CREDITS.md"},
    "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0}],
    "meshes": [{"name": "CF_M4A1_C", "primitives": []}],
    "buffers": [], "bufferViews": [], "accessors": [], "materials": [],
    "textures": [], "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}],
    "images": [],
}
binary = bytearray()

def view(data):
    while len(binary) % 4:
        binary.append(0)
    idx = len(doc["bufferViews"])
    doc["bufferViews"].append({"buffer": 0, "byteOffset": len(binary), "byteLength": len(data)})
    binary.extend(data)
    return idx

def accessor(arr, kind, bounds=False):
    arr = np.asarray(arr, dtype="<f4")
    acc = {"bufferView": view(arr.tobytes()), "componentType": 5126, "count": len(arr), "type": kind}
    if bounds:
        acc.update(min=arr.min(axis=0).tolist(), max=arr.max(axis=0).tolist())
    idx = len(doc["accessors"])
    doc["accessors"].append(acc)
    return idx

for name in names:
    png = io.BytesIO()
    vtf(TEXTURES / (name + ".vtf")).convert("RGB").save(png, format="PNG", optimize=True)
    image = len(doc["images"])
    doc["images"].append({"bufferView": view(png.getvalue()), "mimeType": "image/png"})
    texture = len(doc["textures"])
    doc["textures"].append({"source": image, "sampler": 0})
    doc["materials"].append({"name": name, "pbrMetallicRoughness": {
        "baseColorTexture": {"index": texture}, "metallicFactor": 0.18, "roughnessFactor": 0.72,
    }})

for material, pos, normal, uv in prims:
    attrs = {
        "POSITION": accessor(pos, "VEC3", True),
        "NORMAL": accessor(normal, "VEC3"),
        "TEXCOORD_0": accessor(uv, "VEC2"),
    }
    doc["meshes"][0]["primitives"].append({"attributes": attrs, "material": material})

while len(binary) % 4:
    binary.append(0)
doc["buffers"].append({"byteLength": len(binary)})
j = json.dumps(doc, separators=(",", ":")).encode()
j += b" " * (-len(j) % 4)
(OUT / "m4a1_custom.glb").write_bytes(
    struct.pack("<4sII", b"glTF", 2, 28 + len(j) + len(binary))
    + struct.pack("<I4s", len(j), b"JSON") + j
    + struct.pack("<I4s", len(binary), b"BIN\0") + binary
)

audio = PROJECT / "audio/classic"
audio.mkdir(exist_ok=True)
for src, dest in (
    ("sg552/sg552-1.WAV", "m4c_fire.wav"),
    ("m4a1/m4a1_clipout.WAV", "m4c_out.wav"),
    ("m4a1/m4a1_clipin.WAV", "m4c_in.wav"),
    ("m4a1/m4a1_boltpull.WAV", "m4c_bolt.wav"),
):
    shutil.copyfile(REQUIRED / "sound/weapons" / src, audio / dest)

print("M4A1-C:", sum(len(p[1]) // 3 for p in prims), "triangles;", (OUT / "m4a1_custom.glb").stat().st_size, "GLB bytes; 4 WAV sounds")
