"""Convert a supported user-provided GoldSrc map package into browser assets.

Usage: python3 tools/import_goldsrc_survivor.py cstrike
       python3 tools/import_goldsrc_survivor.py 黑色城镇 blacktown

The importer reads the original BSP v30 brush geometry, embedded palette
textures, RGB lightmaps, entity spawns, skybox and static GoldSrc v10 scenery
models.  It intentionally does not execute any binaries from the package.
Counter-Strike bomb targets are omitted because the browser game uses the two
original spawn banks for team deathmatch.
"""
from __future__ import annotations

import hashlib
import itertools
import json
import math
import re
import shutil
import struct
import sys
import zlib
from collections import defaultdict
from pathlib import Path

import numpy as np


ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "cstrike").resolve()
PROFILE = sys.argv[2] if len(sys.argv) > 2 else "survivor"
REPO = Path(__file__).resolve().parents[1]
PROFILES = {
    "survivor": {
        "dst": "survivor", "bsp": "maps/de_survivor_new.bsp",
        "center": (832.0, 880.0, 96.0), "name": "雪地求生",
        "source": "goldsrc-de-survivor", "sky": "snowlake_",
        "scale": .0254,
        "ambient": "sound/ambience/arcticwind4.wav",
        "missing": ["snow.spr", "flare1.spr", "3dmflared.spr", "3dmflaora.spr"],
    },
    "blacktown": {
        "dst": "blacktown", "bsp": "maps/de_blackwidow.bsp",
        # Horizontal centre comes from the supplied overview.  The CT base
        # floor is used as vertical zero while preserving every authored
        # height difference across this strongly multi-level arena.
        "center": (4.0, 815.0, -301.0), "name": "黑色城镇",
        "source": "goldsrc-de-blackwidow", "sky": "btown",
        # The original conversion at literal inch-to-metre scale felt tight
        # beside this game's actor capsule.  Scale every authored axis,
        # collision plane, spawn and radar landmark together by 1.2x.
        "scale": .0254 * 1.2,
        "ambient": None, "missing": [],
    },
}
if PROFILE not in PROFILES:
    raise SystemExit(f"unknown map profile: {PROFILE}")
CONFIG = PROFILES[PROFILE]
DST = REPO / "assets/classic" / CONFIG["dst"]
DST.mkdir(parents=True, exist_ok=True)
BSP = ROOT / CONFIG["bsp"]
SCALE = CONFIG["scale"]
CENTER = np.array(CONFIG["center"])
HIDDEN_TEXTURES = {"clip", "origin", "aaatrigger", "hint", "skip", "sky"}
VISUAL_BRUSH_CLASSES = {
    "func_wall", "func_illusionary", "func_breakable", "func_water",
    "func_button", "func_tracktrain", "func_ladder",
}
SOLID_BRUSH_CLASSES = {"func_wall", "func_breakable", "func_button"}


def save_png(path: Path, pixels: np.ndarray):
    """Write an RGB/RGBA uint8 array without an external image dependency."""
    height, width, channels = pixels.shape
    assert channels in (3, 4)
    raw = b"".join(b"\0" + pixels[row].tobytes() for row in range(height))

    def chunk(kind, payload):
        return (struct.pack(">I", len(payload)) + kind + payload +
                struct.pack(">I", zlib.crc32(kind + payload) & 0xffffffff))

    color_type = 2 if channels == 3 else 6
    payload = (b"\x89PNG\r\n\x1a\n" +
               chunk(b"IHDR", struct.pack(">2I5B", width, height, 8, color_type, 0, 0, 0)) +
               chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))
    path.write_bytes(payload)


def read_tga(path: Path):
    blob = path.read_bytes()
    ident, cmap, kind, _, _, _, _, _, width, height, depth, flags = struct.unpack_from(
        "<BBBHHBHHHHBB", blob, 0)
    assert cmap == 0 and kind == 2 and depth in (24, 32), f"unsupported TGA: {path}"
    channels = depth // 8
    start = 18 + ident
    image = np.frombuffer(blob, dtype=np.uint8, count=width * height * channels,
                          offset=start).reshape(height, width, channels).copy()
    image = image[:, :, [2, 1, 0] + ([3] if channels == 4 else [])]
    if not flags & 0x20:
        image = image[::-1].copy()
    return image[:, :, :3]


def rows(blob: bytes, fmt: str):
    return list(struct.iter_unpack("<" + fmt, blob))


def cstr(raw: bytes) -> str:
    return raw.split(b"\0", 1)[0].decode("latin1", "replace")


def safe_name(prefix: str, name: str) -> str:
    stem = re.sub(r"[^a-z0-9_-]+", "_", name.lower()).strip("_") or "texture"
    digest = hashlib.sha1(name.encode("latin1", "replace")).hexdigest()[:7]
    return f"{prefix}_{stem}_{digest}.png"


def game_point(value) -> list[float]:
    x, y, z = np.asarray(value, dtype=float) - CENTER
    return [float(x * SCALE), float(z * SCALE), float(-y * SCALE)]


def game_plane(normal, distance) -> list[float]:
    # Source p satisfies n.p <= d.  q=[x,z,-y]*scale after recentering.
    nx, ny, nz = normal
    d = (float(distance) - float(np.dot(normal, CENTER))) * SCALE
    return [float(nx), float(nz), float(-ny), d]


data = BSP.read_bytes()
assert struct.unpack_from("<i", data, 0)[0] == 30, "expected a GoldSrc BSP v30"
lump_defs = [struct.unpack_from("<ii", data, 4 + i * 8) for i in range(15)]


def lump(index: int) -> bytes:
    offset, size = lump_defs[index]
    return data[offset:offset + size]


entity_text = lump(0).split(b"\0", 1)[0].decode("latin1", "replace")
entities = [dict(re.findall(r'"([^"\n]+)"\s*"([^"\n]*)"', block))
            for block in re.findall(r"\{(.*?)\}", entity_text, re.S)]
planes = rows(lump(1), "4fi")
vertices = rows(lump(3), "3f")
nodes = rows(lump(5), "ihh6hHH")
texinfo = rows(lump(6), "8fii")
faces = rows(lump(7), "HHiHH4Bi")
lighting = lump(8)
edges = rows(lump(12), "2H")
surfedges = [item[0] for item in rows(lump(13), "i")]
models = rows(lump(14), "9f7i")


def decode_bsp_textures():
    blob = lump(2)
    count = struct.unpack_from("<i", blob, 0)[0]
    offsets = struct.unpack_from("<" + "i" * count, blob, 4)
    result = []
    for index, offset in enumerate(offsets):
        if offset <= 0:
            result.append({"name": f"missing_{index}", "size": (1, 1), "image": None})
            continue
        raw_name, width, height, *mips = struct.unpack_from("<16sII4I", blob, offset)
        name = cstr(raw_name)
        image = None
        if mips[0] and width and height:
            size = width * height
            pixels = blob[offset + mips[0]:offset + mips[0] + size]
            palette_at = offset + mips[3] + max(1, size // 64)
            palette_count = struct.unpack_from("<H", blob, palette_at)[0]
            palette = blob[palette_at + 2:palette_at + 2 + palette_count * 3]
            rgba = np.zeros((height, width, 4), dtype=np.uint8)
            indices = np.frombuffer(pixels, dtype=np.uint8).reshape(height, width)
            rgb = np.frombuffer(palette, dtype=np.uint8).reshape(palette_count, 3)
            rgba[:, :, :3] = rgb[np.minimum(indices, palette_count - 1)]
            rgba[:, :, 3] = 255
            if name.startswith("{"):
                rgba[:, :, 3][indices == 255] = 0
            image = rgba
        result.append({"name": name, "size": (width, height), "image": image})
    return result


bsp_textures = decode_bsp_textures()


def face_points(face):
    first, count = face[2], face[3]
    return [np.asarray(vertices[edges[abs(surfedges[first + i])]
                                [0 if surfedges[first + i] >= 0 else 1]], dtype=float)
            for i in range(count)]


def face_light_size(face, points):
    info = texinfo[face[4]]
    s = [float(np.dot(point, info[:3]) + info[3]) for point in points]
    t = [float(np.dot(point, info[4:7]) + info[7]) for point in points]
    mins = (math.floor(min(s) / 16), math.floor(min(t) / 16))
    maxs = (math.ceil(max(s) / 16), math.ceil(max(t) / 16))
    return s, t, mins, (maxs[0] - mins[0] + 1, maxs[1] - mins[1] + 1)


# Bind every BSP submodel to its entity.  Faces are already authored in world
# coordinates; an entity origin on a static brush is its pivot, not a second
# translation.  The moving train uses a tiny origin brush and is not gameplay
# collision in the TDM conversion.
brush_entities = {int(e["model"][1:]): e for e in entities
                  if e.get("model", "").startswith("*")}
render_models = [(0, {"classname": "worldspawn"})]
for model_index, entity in sorted(brush_entities.items()):
    if entity.get("classname") in VISUAL_BRUSH_CLASSES:
        render_models.append((model_index, entity))

# Allocate one atlas shared by all brush faces.  A white border also supplies
# neutral uv1 coordinates for unlit scenery models.
light_faces = []
for model_index, entity in render_models:
    model = models[model_index]
    for face_index in range(model[-2], model[-2] + model[-1]):
        face = faces[face_index]
        texture_name = bsp_textures[texinfo[face[4]][8]]["name"].lower()
        if texture_name in HIDDEN_TEXTURES or texture_name.startswith("sky"):
            continue
        points = face_points(face)
        if len(points) < 3 or face[-1] < 0 or face[5] == 255:
            continue
        s, t, mins, size = face_light_size(face, points)
        if 0 < size[0] <= 512 and 0 < size[1] <= 512:
            light_faces.append((face_index, face, points, s, t, mins, size))

ATLAS = 1024
atlas = np.full((ATLAS, ATLAS, 3), 255, dtype=np.uint8)
placements = {}
x = y = 2
row_height = 0
for face_index, face, points, s, t, mins, (width, height) in sorted(
        light_faces, key=lambda item: item[-1][1], reverse=True):
    if x + width + 2 > ATLAS:
        x = 2
        y += row_height + 2
        row_height = 0
    if y + height + 2 > ATLAS:
        raise RuntimeError(f"{PROFILE} lightmap atlas needs expansion")
    count = width * height * 3
    raw = np.frombuffer(lighting, dtype=np.uint8, count=count, offset=face[-1])
    # GoldSrc displays lightmaps with a 2x overbright pass.  Baking the same
    # factor keeps snowy surfaces from turning charcoal in a basic material.
    rgb = np.minimum(raw.reshape(height, width, 3).astype(np.uint16) * 2, 255).astype(np.uint8)
    atlas[y:y + height, x:x + width] = rgb
    atlas[y - 1, x:x + width] = rgb[0]
    atlas[y + height, x:x + width] = rgb[-1]
    atlas[y:y + height, x - 1] = rgb[:, 0]
    atlas[y:y + height, x + width] = rgb[:, -1]
    placements[face_index] = (x, y, width, height, mins)
    x += width + 2
    row_height = max(row_height, height)
save_png(DST / "lightmap.png", atlas)


materials = {}
groups = defaultdict(list)
visible_faces = []


def register_material(key, name, image, *, alpha=False, opacity=1.0, prop=False):
    if key in materials:
        return materials[key]
    path = None
    if image is not None:
        filename = safe_name("prop" if prop else "map", name)
        save_png(DST / filename, image)
        path = filename
    material = {"name": name, "map": path}
    if alpha:
        material["alphaTest"] = .45
    if opacity < 1:
        material["opacity"] = opacity
    if prop:
        material["unlit"] = True
    materials[key] = material
    return material


for model_index, entity in render_models:
    model = models[model_index]
    class_name = entity.get("classname", "")
    entity_opacity = 1.0
    if class_name == "func_water":
        entity_opacity = max(.12, min(.82, float(entity.get("renderamt", 150)) / 255))
    elif entity.get("rendermode", "0") not in ("", "0"):
        entity_opacity = max(.2, min(1.0, float(entity.get("renderamt", 255)) / 255))
    for face_index in range(model[-2], model[-2] + model[-1]):
        face = faces[face_index]
        info = texinfo[face[4]]
        texture = bsp_textures[info[8]]
        name = texture["name"]
        low = name.lower()
        if low in HIDDEN_TEXTURES or low.startswith("sky"):
            continue
        points = face_points(face)
        if len(points) < 3:
            continue
        width, height = texture["size"]
        width, height = max(1, width), max(1, height)
        uv = [[(float(np.dot(point, info[:3])) + info[3]) / width,
               1 - (float(np.dot(point, info[4:7])) + info[7]) / height]
              for point in points]
        luv = [[.001, .999] for _ in points]
        placement = placements.get(face_index)
        if placement:
            ax, ay, lw, lh, mins = placement
            s, t, _, _ = face_light_size(face, points)
            luv = [[(ax + .5 + s[i] / 16 - mins[0]) / ATLAS,
                    1 - (ay + .5 + t[i] / 16 - mins[1]) / ATLAS]
                   for i in range(len(points))]
        key = ("bsp", info[8], round(entity_opacity, 3))
        register_material(key, name, texture["image"], alpha=name.startswith("{"),
                          opacity=entity_opacity)
        world_points = [game_point(point) for point in points]
        visible_faces.append((low, world_points))
        for i in range(1, len(points) - 1):
            for j in (0, i, i + 1):
                groups[key].extend(world_points[j] + uv[j] + luv[j])


def matrix_multiply(a, b):
    out = [[0.0] * 4 for _ in range(3)]
    for row in range(3):
        for column in range(3):
            out[row][column] = sum(a[row][k] * b[k][column] for k in range(3))
        out[row][3] = sum(a[row][k] * b[k][3] for k in range(3)) + a[row][3]
    return out


def bone_matrix(angles, position):
    x, y, z = angles
    sx, cx = math.sin(x), math.cos(x)
    sy, cy = math.sin(y), math.cos(y)
    sz, cz = math.sin(z), math.cos(z)
    return [
        [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx, position[0]],
        [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx, position[1]],
        [-sy, cy * sx, cy * cx, position[2]],
    ]


def transform(matrix, point):
    return np.array([sum(matrix[row][column] * point[column] for column in range(3)) + matrix[row][3]
                     for row in range(3)])


model_cache = {}


def decode_model(path: Path, body_value: int):
    cache_key = (path, body_value)
    if cache_key in model_cache:
        return model_cache[cache_key]
    blob = path.read_bytes()
    assert blob[:4] == b"IDST" and struct.unpack_from("<i", blob, 4)[0] == 10
    bone_count, bone_offset = struct.unpack_from("<2i", blob, 140)
    texture_count, texture_offset = struct.unpack_from("<2i", blob, 180)
    skin_count, skin_families, skin_offset = struct.unpack_from("<3i", blob, 192)
    body_count, body_offset = struct.unpack_from("<2i", blob, 204)
    texture_data = []
    for index in range(texture_count):
        at = texture_offset + index * 80
        raw_name, flags, width, height, pixels_at = struct.unpack_from("<64s4i", blob, at)
        name = cstr(raw_name)
        pixels = np.frombuffer(blob, dtype=np.uint8, count=width * height, offset=pixels_at).reshape(height, width)
        palette_at = pixels_at + width * height
        palette = np.frombuffer(blob, dtype=np.uint8, count=256 * 3, offset=palette_at).reshape(256, 3)
        rgba = np.empty((height, width, 4), dtype=np.uint8)
        rgba[:, :, :3] = palette[pixels]
        rgba[:, :, 3] = 255
        if flags & 64:
            rgba[:, :, 3][pixels == 255] = 0
        texture_data.append({"name": name, "flags": flags, "size": (width, height),
                             "image": rgba})
    skin_map = struct.unpack_from("<" + "H" * (skin_count * skin_families), blob, skin_offset)
    bones = []
    for index in range(bone_count):
        record = struct.unpack_from("<32sii6i12f", blob, bone_offset + index * 112)
        parent, values = record[1], record[9:15]
        local = bone_matrix(values[3:6], values[:3])
        bones.append(matrix_multiply(bones[parent], local) if parent >= 0 else local)
    output = []
    for body_index in range(body_count):
        at = body_offset + body_index * 76
        _, model_count, base, model_offset = struct.unpack_from("<64s3i", blob, at)
        chosen = (body_value // max(1, base)) % max(1, model_count)
        model_at = model_offset + chosen * 112
        (_, _, _, mesh_count, mesh_offset, vertex_count, bone_index_offset, vertex_offset,
         normal_count, normal_bone_offset, normal_offset, _, _) = struct.unpack_from("<64sif10i", blob, model_at)
        raw_vertices = [struct.unpack_from("<3f", blob, vertex_offset + i * 12)
                        for i in range(vertex_count)]
        bone_indices = blob[bone_index_offset:bone_index_offset + vertex_count]
        baked = [transform(bones[bone_indices[i]], raw_vertices[i]) for i in range(vertex_count)]
        for mesh_index in range(mesh_count):
            mesh_at = mesh_offset + mesh_index * 20
            _, commands_at, skinref, _, _ = struct.unpack_from("<5i", blob, mesh_at)
            material_index = skin_map[skinref] if skinref < skin_count else 0
            texture = texture_data[material_index]
            command = commands_at
            triangles = []
            while True:
                count = struct.unpack_from("<h", blob, command)[0]
                command += 2
                if count == 0:
                    break
                records = [struct.unpack_from("<4h", blob, command + i * 8)
                           for i in range(abs(count))]
                command += abs(count) * 8
                for i in range(2, len(records)):
                    if count > 0:
                        tri = (records[i - 2], records[i - 1], records[i]) if i % 2 == 0 \
                            else (records[i - 1], records[i - 2], records[i])
                    else:
                        tri = (records[0], records[i - 1], records[i])
                    triangles.append(tri)
            output.append((texture, baked, triangles))
    model_cache[cache_key] = output
    return output


def entity_rotation(text: str):
    values = [float(value) for value in (text or "0 0 0").split()]
    while len(values) < 3:
        values.append(0.0)
    pitch, yaw, roll = [math.radians(value) for value in values[:3]]
    cp, sp, cy, sy, cr, sr = math.cos(pitch), math.sin(pitch), math.cos(yaw), math.sin(yaw), math.cos(roll), math.sin(roll)
    rz = np.array([[cy, -sy, 0], [sy, cy, 0], [0, 0, 1]], dtype=float)
    ry = np.array([[cp, 0, -sp], [0, 1, 0], [sp, 0, cp]], dtype=float)
    rx = np.array([[1, 0, 0], [0, cr, -sr], [0, sr, cr]], dtype=float)
    return rz @ ry @ rx


prop_instances = 0
for entity in entities:
    model_name = entity.get("model", "").replace("\\", "/")
    if entity.get("classname") != "cycler_sprite" or not model_name.lower().endswith(".mdl"):
        continue
    path = ROOT / model_name
    if not path.exists():
        continue
    origin = np.array([float(value) for value in entity.get("origin", "0 0 0").split()])
    rotation = entity_rotation(entity.get("angles", "0 0 0"))
    body = int(entity.get("body", "0") or 0)
    for texture, baked, triangles in decode_model(path, body):
        key = ("mdl", str(path.relative_to(ROOT)).lower(), texture["name"], texture["flags"])
        register_material(key, f"{model_name}:{texture['name']}", texture["image"],
                          alpha=bool(texture["flags"] & 64), prop=True)
        width, height = texture["size"]
        for triangle in triangles:
            for vertex_index, _, u, v in triangle:
                world = rotation @ baked[vertex_index] + origin
                groups[key].extend(game_point(world) + [u / width, 1 - v / height, .001, .999])
    prop_instances += 1


# Convert the six original skybox faces.  CubeTextureLoader uses the same face
# order as the existing imported transport map.
sky = {}
for face in ("up", "dn", "ft", "bk", "lf", "rt"):
    source = ROOT / f"gfx/env/{CONFIG['sky']}{face}.tga"
    output = DST / f"sky_{face}.png"
    save_png(output, read_tga(source))
    sky[face] = output.name

# This is the map's authored global wind bed (ambient_generic, spawnflags=1),
# copied byte-for-byte rather than replaced by a synthesized ambience.
ambient_output = None
if CONFIG["ambient"]:
    ambient_source = ROOT / CONFIG["ambient"]
    ambient_output = DST / Path(CONFIG["ambient"]).name
    shutil.copyfile(ambient_source, ambient_output)


binary = bytearray()
parts = []
for key, values in groups.items():
    if not values:
        continue
    parts.append({"material": materials[key], "offset": len(binary), "count": len(values) // 7})
    binary.extend(np.asarray(values, dtype="<f4").tobytes())
(DST / "map.bin").write_bytes(binary)


def solid_paths(model_index: int):
    model = models[model_index]
    collected = []
    bounds = [
        (np.array([1., 0., 0.]), model[3]), (np.array([-1., 0., 0.]), -model[0]),
        (np.array([0., 1., 0.]), model[4]), (np.array([0., -1., 0.]), -model[1]),
        (np.array([0., 0., 1.]), model[5]), (np.array([0., 0., -1.]), -model[2]),
    ]

    def visit(node_index, path):
        if node_index < 0:
            if node_index == -1:
                collected.append(bounds + path)
            return
        plane_index = nodes[node_index][0]
        normal = np.asarray(planes[plane_index][:3], dtype=float)
        distance = planes[plane_index][3]
        # Child zero is the front side (n.p >= d), child one the back.
        visit(nodes[node_index][1], path + [(-normal, -distance)])
        visit(nodes[node_index][2], path + [(normal, distance)])

    visit(model[9], [])
    return collected


def path_collider(path):
    normals = np.asarray([item[0] for item in path])
    distances = np.asarray([item[1] for item in path])
    points = []
    for indices in itertools.combinations(range(len(path)), 3):
        matrix = normals[list(indices)]
        if abs(np.linalg.det(matrix)) < 1e-6:
            continue
        point = np.linalg.solve(matrix, distances[list(indices)])
        if np.all(normals @ point <= distances + .05):
            points.append(point)
    if not points:
        return None
    world = np.asarray([game_point(point) for point in points])
    low, high = world.min(0), world.max(0)
    if np.any(high - low < .002):
        return None
    planes_world = [game_plane(normal, distance) for normal, distance in path]
    collider = {"x": float((low[0] + high[0]) / 2), "z": float((low[2] + high[2]) / 2),
                "hx": float((high[0] - low[0]) / 2), "hz": float((high[2] - low[2]) / 2),
                "h": float(high[1]), "y0": float(low[1]), "planes": planes_world}
    # Mandatory for every GoldSrc profile: global leaf bounds are not valid
    # step heights on ramps, and internal BSP partition caps are not floors.
    collider["localStep"] = True
    return collider


colliders = []
collision_models = [0] + [index for index, entity in brush_entities.items()
                          if entity.get("classname") in SOLID_BRUSH_CLASSES
                          # A solid entity with no render faces is an authored
                          # invisible blocker, not map geometry.  Keeping it in
                          # a TDM conversion creates literal air walls.
                          and models[index][-1] > 0]
for model_index in collision_models:
    for path in solid_paths(model_index):
        collider = path_collider(path)
        if collider:
            colliders.append(collider)


def top_at(x, z, ceiling):
    result = -math.inf
    for collider in colliders:
        if abs(x - collider["x"]) > collider["hx"] or abs(z - collider["z"]) > collider["hz"]:
            continue
        top, bottom = math.inf, -math.inf
        for nx, ny, nz, distance in collider["planes"]:
            remaining = distance - nx * x - nz * z
            if abs(ny) < 1e-7:
                if remaining < -.001:
                    top = -math.inf
                    break
            elif ny > 0:
                top = min(top, remaining / ny)
            else:
                bottom = max(bottom, remaining / ny)
        if bottom <= top <= ceiling + .2:
            result = max(result, top)
    return result


spawns = {"player": [], "enemy": []}
spawn_yaws = {"player": [], "enemy": []}
for team, class_name in (("player", "info_player_start"),
                         ("enemy", "info_player_deathmatch")):
    for entity in entities:
        if entity.get("classname") != class_name:
            continue
        point = game_point([float(value) for value in entity["origin"].split()])
        floor = top_at(point[0], point[2], point[1])
        if math.isfinite(floor):
            point[1] = floor
        else:
            point[1] -= 36 * SCALE
        spawns[team].append(point)
        source_yaw = float((entity.get("angles", "0 0 0").split() + ["0", "0"])[1])
        spawn_yaws[team].append(math.radians(source_yaw - 90))


# Radar landmarks are the larger horizontal snow/roof faces.  Keep this list
# compact because the minimap bakes rectangles, not arbitrary polygons.
topdown = []
for name, points in visible_faces:
    array = np.asarray(points)
    low, high = array.min(0), array.max(0)
    if high[1] - low[1] > .03 or high[0] - low[0] < .6 or high[2] - low[2] < .6:
        continue
    if not -13 < high[1] < 9:
        continue
    kind = "house" if any(word in name for word in ("house", "build", "tower")) else "walk"
    topdown.append({"x": float((low[0] + high[0]) / 2), "z": float((low[2] + high[2]) / 2),
                    "hx": float((high[0] - low[0]) / 2), "hz": float((high[2] - low[2]) / 2),
                    "kind": kind, "y0": float(high[1])})


sprite_points = []
for entity in entities:
    if entity.get("classname") != "env_sprite":
        continue
    model_name = entity.get("model", "").lower()
    if not any(token in model_name for token in ("flare", "3dmfla")):
        continue
    sprite_points.append({"position": game_point([float(value) for value in entity["origin"].split()]),
                          "color": entity.get("rendercolor", "255 160 64").strip(),
                          "scale": float(entity.get("scale", "1") or 1)})


world_bounds = models[0][:6]
low = game_point(world_bounds[:3])
high = game_point(world_bounds[3:6])
bounds = {"hw": max(abs(low[0]), abs(high[0])), "hl": max(abs(low[2]), abs(high[2]))}
map_json = {
    "name": CONFIG["name"], "source": CONFIG["source"],
    "collisionSurfaceMode": "visible-mesh-v1",
    "parts": parts, "colliders": colliders, "spawns": spawns, "spawnYaws": spawn_yaws,
    "topdown": topdown, "sky": sky, "bounds": bounds,
    "ambient": ambient_output.name if ambient_output else None,
    "floorY": min(spawn[1] for team in spawns.values() for spawn in team),
    "fog": {"color": "#c2cbdc", "density": .0006 / SCALE},
    "spritePoints": sprite_points,
    "missingSourceSprites": CONFIG["missing"],
}
(DST / "map.json").write_text(json.dumps(map_json, ensure_ascii=False, separators=(",", ":")),
                               encoding="utf8")

print(f"{CONFIG['name']}: {len(parts)} material parts, {len(binary) // 28 // 3} triangles, "
      f"{len(colliders)} convex collision cells, {prop_instances} scenery instances, "
      f"{len(spawns['player'])}+{len(spawns['enemy'])} spawns")
