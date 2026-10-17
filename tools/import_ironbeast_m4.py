"""Convert the gun meshes and embedded palette texture from a GoldSrc v10 MDL to GLB.

Usage: python3 tools/import_ironbeast_m4.py /path/to/models/v_ak47.mdl [asset-relative-output] [weapon-length]
The first-person arms and animation/effect bodyparts are intentionally omitted; the
game uses its existing M4 arms, behavior, and animation timeline.
"""
import json, math, struct, sys, zlib
from pathlib import Path

src = Path(sys.argv[1])
b = src.read_bytes()
assert b[:4] == b"IDST" and struct.unpack_from("<i", b, 4)[0] == 10, "expected GoldSrc v10 MDL"
repo = Path(__file__).resolve().parents[1]
relative_output = sys.argv[2] if len(sys.argv)>2 else "m4_ironbeast/ironbeast.glb"
weapon_length = float(sys.argv[3]) if len(sys.argv)>3 else .82
out = repo / "assets/classic" / relative_output
out.parent.mkdir(parents=True, exist_ok=True)

def i32(p): return struct.unpack_from("<i", b, p)[0]
def cstr(raw): return raw.split(b"\0", 1)[0].decode("utf-8", "replace")

# GoldSrc studiohdr_t fields.
texture_count, texture_offset, texture_data = i32(180), i32(184), i32(188)
skin_count, skin_families, skin_offset = i32(192), i32(196), i32(200)
body_count, body_offset = i32(204), i32(208)
bone_count, bone_offset = i32(140), i32(144)
textures = []
for n in range(texture_count):
    p = texture_offset + n * 80
    name, flags, w, h, pixels = struct.unpack_from("<64s4i", b, p)
    size = w * h
    palette = b[pixels + size:pixels + size + 256 * 3]
    assert len(palette) == 256 * 3
    rgba = bytearray()
    for index in b[pixels:pixels + size]:
        rgba.extend(palette[index * 3:index * 3 + 3]); rgba.append(255)
    # Encode RGBA PNG with standard-library zlib (avoids image-tool dependencies).
    raw = b"".join(b"\0" + rgba[y * w * 4:(y + 1) * w * 4] for y in range(h))
    def chunk(tag, payload):
        return struct.pack(">I", len(payload)) + tag + payload + struct.pack(">I", zlib.crc32(tag + payload) & 0xffffffff)
    png = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">2I5B", w, h, 8, 6, 0, 0, 0)) +
           chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))
    textures.append({"name": cstr(name), "png": png, "size": (w, h)})

# Keep the user's Iron Beast texture when present; otherwise use the first non-effect texture.
tex_index = next((i for i, t in enumerate(textures) if "IRONBEAST" in t["name"].upper() and "IMPERIAL" in t["name"].upper()), None)
if tex_index is None:
    tex_index = next(i for i, t in enumerate(textures) if t["name"].upper().startswith("PV-") and "MUZ" not in t["name"].upper())
skin_map = struct.unpack_from("<" + "H" * (skin_count * skin_families), b, skin_offset)

# Bake each single-bone vertex into the neutral/default pose using GoldSrc's
# parent-relative bone transforms, so the resulting GLB needs no skeleton.
def mul(a, c):
    out = [[0.0] * 4 for _ in range(3)]
    for r in range(3):
        for col in range(3): out[r][col] = sum(a[r][k] * c[k][col] for k in range(3))
        out[r][3] = sum(a[r][k] * c[k][3] for k in range(3)) + a[r][3]
    return out

def angle_matrix(angles, pos):
    x, y, z = angles
    sx, cx = math.sin(x), math.cos(x)
    sy, cy = math.sin(y), math.cos(y)
    sz, cz = math.sin(z), math.cos(z)
    return [
        [cz*cy, cz*sy*sx-sz*cx, cz*sy*cx+sz*sx, pos[0]],
        [sz*cy, sz*sy*sx+cz*cx, sz*sy*cx-cz*sx, pos[1]],
        [-sy, cy*sx, cy*cx, pos[2]],
    ]

bones = []
for n in range(bone_count):
    p = bone_offset + n * 112
    rec = struct.unpack_from("<32sii6i12f", b, p)
    parent, values = rec[1], rec[9:15]
    local = angle_matrix(values[3:6], values[:3])
    bones.append(mul(bones[parent], local) if parent >= 0 else local)

def transform_point(m, p):
    return tuple(sum(m[r][c] * p[c] for c in range(3)) + m[r][3] for r in range(3))

def transform_normal(m, p):
    out = tuple(sum(m[r][c] * p[c] for c in range(3)) for r in range(3))
    length = math.sqrt(sum(v*v for v in out)) or 1.0
    return tuple(v / length for v in out)

# Bodypart zero is the authored hands. Every following bodypart belongs to the
# held item; keep all of them so the converter also supports single-part melee
# models in addition to Iron Beast's split rifle body.
chosen = []
for n in range(1, body_count):
    name, models, base, model_offset = struct.unpack_from("<64s3i", b, body_offset + n * 76)
    assert models == 1
    m = model_offset
    mname, model_type, radius, meshes, mesh_offset, nv, bone_index, vertex_offset, nn, normal_bone_index, normal_offset, ng, groups = struct.unpack_from("<64sif10i", b, m)
    raw_verts = [struct.unpack_from("<3f", b, vertex_offset + 12 * j) for j in range(nv)]
    raw_norms = [struct.unpack_from("<3f", b, normal_offset + 12 * j) for j in range(nn)]
    vertex_bones = b[bone_index:bone_index + nv]
    normal_bones = b[normal_bone_index:normal_bone_index + nn]
    verts = [transform_point(bones[vertex_bones[j]], raw_verts[j]) for j in range(nv)]
    norms = [transform_normal(bones[normal_bones[j]], raw_norms[j]) for j in range(nn)]
    for mi in range(meshes):
        mesh = mesh_offset + mi * 20
        ntris, tri_offset, skinref, mesh_normals, mesh_normal_offset = struct.unpack_from("<5i", b, mesh)
        material_id = skin_map[skinref] if skinref < skin_count else tex_index
        # GoldSrc triangle commands: positive = strip, negative = fan, zero terminates.
        at = tri_offset
        vertices = []
        while True:
            count = struct.unpack_from("<h", b, at)[0]; at += 2
            if count == 0: break
            records = [struct.unpack_from("<4h", b, at + 8 * j) for j in range(abs(count))]
            at += abs(count) * 8
            for j in range(2, len(records)):
                if count > 0:
                    tri = [records[j - 2], records[j - 1], records[j]] if j % 2 == 0 else [records[j - 1], records[j - 2], records[j]]
                else:
                    tri = [records[0], records[j - 1], records[j]]
                for vi, ni, s, t in tri:
                    # The neutral bone pose rotates the authored +X barrel axis onto +Z.
                    # Map that baked pose into this game's Y-up, -Z-forward weapon frame.
                    x, y, z = verts[vi]
                    nx, ny, nz = norms[ni]
                    vertices.append((-y, x, -z, -ny, nx, -nz, s / textures[material_id]["size"][0], 1 - t / textures[material_id]["size"][1]))
        chosen.append((material_id, vertices))

# Shared authored bounds, centered and scaled to the requested in-game length.
positions = [(v[0], v[1], v[2]) for _, arr in chosen for v in arr]
mins = [min(p[a] for p in positions) for a in range(3)]
maxs = [max(p[a] for p in positions) for a in range(3)]
scale = weapon_length / max(maxs[a] - mins[a] for a in range(3))
center = [(mins[a] + maxs[a]) * .5 for a in range(3)]

doc = {"asset": {"version": "2.0", "generator": "GoldSrc v10 static weapon conversion"}, "scene": 0,
       "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0}], "meshes": [{"primitives": []}],
       "buffers": [], "bufferViews": [], "accessors": [], "materials": [], "textures": [],
       "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}], "images": []}
binary = bytearray()
def view(data):
    while len(binary) % 4: binary.append(0)
    idx = len(doc["bufferViews"])
    doc["bufferViews"].append({"buffer": 0, "byteOffset": len(binary), "byteLength": len(data)})
    binary.extend(data)
    return idx

image_index = len(doc["images"])
doc["images"].append({"bufferView": view(textures[tex_index]["png"]), "mimeType": "image/png"})
doc["textures"].append({"source": image_index, "sampler": 0})
doc["materials"].append({"name": textures[tex_index]["name"], "pbrMetallicRoughness": {
    "baseColorTexture": {"index": 0}, "metallicFactor": .42, "roughnessFactor": .38}})

allv = [v for _, arr in chosen for v in arr]
attrs = {}
for name, column, typ in (("POSITION", 0, "VEC3"), ("NORMAL", 3, "VEC3"), ("TEXCOORD_0", 6, "VEC2")):
    vals = []
    for v in allv:
        if name == "POSITION": vals.extend(((v[0] - center[0]) * scale, (v[1] - center[1]) * scale, (v[2] - center[2]) * scale))
        else: vals.extend(v[column:column + (3 if typ == "VEC3" else 2)])
    blob = struct.pack("<" + "f" * len(vals), *vals)
    acc = {"bufferView": view(blob), "componentType": 5126, "count": len(allv), "type": typ}
    if name == "POSITION":
        acc.update(min=[(mins[i] - center[i]) * scale for i in range(3)], max=[(maxs[i] - center[i]) * scale for i in range(3)])
    attrs[name] = len(doc["accessors"]); doc["accessors"].append(acc)

# Correct winding against the source normals after the axis conversion.
for material_id, arr in chosen:
    if not arr: continue
    idxs = []
    for i in range(0, len(arr), 3):
        a, c, d = arr[i:i + 3]
        u = (c[0]-a[0], c[1]-a[1], c[2]-a[2]); v = (d[0]-a[0], d[1]-a[1], d[2]-a[2])
        cross = (u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0])
        if sum(cross[k] * a[3+k] for k in range(3)) < 0: idxs.extend((i, i+2, i+1))
        else: idxs.extend((i, i+1, i+2))
    # Each primitive uses the shared attribute buffers but indexes only its own contiguous vertices.
    # Rebuild indices for this primitive from the flattening order.
    start = 0
    for cm, ca in chosen:
        if ca is arr: break
        start += len(ca)
    idxs = [start + i for i in idxs]
    ib = struct.pack("<" + "I" * len(idxs), *idxs)
    ia = len(doc["accessors"]); doc["accessors"].append({"bufferView": view(ib), "componentType": 5125, "count": len(idxs), "type": "SCALAR"})
    doc["meshes"][0]["primitives"].append({"attributes": attrs, "indices": ia, "material": 0, "mode": 4})

while len(binary) % 4: binary.append(0)
doc["buffers"].append({"byteLength": len(binary)})
j = json.dumps(doc, separators=(",", ":")).encode(); j += b" " * (-len(j) % 4)
out.write_bytes(struct.pack("<4sII", b"glTF", 2, 28 + len(j) + len(binary)) +
                struct.pack("<I4s", len(j), b"JSON") + j + struct.pack("<I4s", len(binary), b"BIN\0") + binary)
dimensions = tuple(round((maxs[i] - mins[i]) * scale, 4) for i in range(3))
print(f"Wrote {out} from {src.name}; texture={textures[tex_index]['name']} {textures[tex_index]['size']}; vertices={len(allv)}; dimensions={dimensions}m; length={weapon_length}m")
