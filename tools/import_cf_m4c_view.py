"""Import the complete Source v44 M4A1-C first-person rig.

Usage: python3 tools/import_cf_m4c_view.py /path/to/M4A1_CUSTOM_PACK

The supplied pack depends on Counter-Strike: Source's stock ``v_hands``
material but does not redistribute that texture.  This project already has
the matching stock hand sheet in the imported Barrett assets, so the converter
uses that local dependency for the authored hand mesh.
"""
import json
import math
import shutil
import struct
import sys
import zlib
from pathlib import Path


ROOT = Path(sys.argv[1])
REQUIRED = ROOT / "Required"
TEXTURES = ROOT / "Choose Texture" / "Black (Original)" / "materials/models/weapons/v_models/cf_m4a1custom"
PROJECT = Path(__file__).resolve().parents[1]
OUT = PROJECT / "assets/classic/m4c_view"
OUT.mkdir(parents=True, exist_ok=True)

BASE = REQUIRED / "models/weapons"
MDL = (BASE / "v_rif_sg552.mdl").read_bytes()
VVD = (BASE / "v_rif_sg552.vvd").read_bytes()
VTX = (BASE / "v_rif_sg552.dx90.vtx").read_bytes()


def unpack(blob, fmt, at=0):
    return struct.unpack_from("<" + fmt, blob, at)


def cstring(blob, at):
    return blob[at:blob.index(b"\0", at)].decode("utf-8", "replace")


def quat_xyz(angles):
    x, y, z = (angle * .5 for angle in angles)
    cx, sx = math.cos(x), math.sin(x)
    cy, sy = math.cos(y), math.sin(y)
    cz, sz = math.cos(z), math.sin(z)
    return [sx * cy * cz - cx * sy * sz,
            cx * sy * cz + sx * cy * sz,
            cx * cy * sz - sx * sy * cz,
            cx * cy * cz + sx * sy * sz]


def png_chunk(kind, payload):
    return (struct.pack(">I", len(payload)) + kind + payload
            + struct.pack(">I", zlib.crc32(kind + payload) & 0xffffffff))


def rgba_png(width, height, rgba):
    rows = b"".join(b"\0" + rgba[y * width * 4:(y + 1) * width * 4]
                    for y in range(height))
    return (b"\x89PNG\r\n\x1a\n"
            + png_chunk(b"IHDR", struct.pack(">2I5B", width, height, 8, 6, 0, 0, 0))
            + png_chunk(b"IDAT", zlib.compress(rows, 9))
            + png_chunk(b"IEND", b""))


def rgb565(value):
    r = ((value >> 11) & 31) * 255 // 31
    g = ((value >> 5) & 63) * 255 // 63
    b = (value & 31) * 255 // 31
    return r, g, b, 255


def decode_bc1(width, height, payload):
    rgba = bytearray(width * height * 4)
    at = 0
    for by in range((height + 3) // 4):
        for bx in range((width + 3) // 4):
            c0, c1, indices = unpack(payload, "HHI", at)
            at += 8
            a, b = rgb565(c0), rgb565(c1)
            if c0 > c1:
                palette = [a, b,
                           tuple((2 * a[k] + b[k]) // 3 for k in range(4)),
                           tuple((a[k] + 2 * b[k]) // 3 for k in range(4))]
            else:
                palette = [a, b,
                           tuple((a[k] + b[k]) // 2 for k in range(4)),
                           (0, 0, 0, 0)]
            for py in range(4):
                for px in range(4):
                    x, y = bx * 4 + px, by * 4 + py
                    if x >= width or y >= height:
                        continue
                    color = palette[(indices >> (2 * (py * 4 + px))) & 3]
                    off = (y * width + x) * 4
                    rgba[off:off + 4] = bytes(color)
    return rgba


def vtf_top_png(path):
    blob = path.read_bytes()
    assert blob[:4] == b"VTF\0", path
    major, minor, header, width, height = unpack(blob, "IIIHH", 4)
    fmt = unpack(blob, "I", 52)[0]
    mip_count = blob[56]
    low_fmt = unpack(blob, "I", 57)[0]
    low_w, low_h = blob[61:63]

    def image_size(w, h, image_fmt):
        if image_fmt in (13, 20):
            return max(1, (w + 3) // 4) * max(1, (h + 3) // 4) * 8
        if image_fmt in (14, 15):
            return max(1, (w + 3) // 4) * max(1, (h + 3) // 4) * 16
        return w * h * {0: 4, 1: 4, 2: 3, 3: 3, 16: 4}.get(image_fmt, 4)

    pos = header + (image_size(low_w, low_h, low_fmt) if low_w and low_h else 0)
    if minor >= 3:
        for resource in range(unpack(blob, "I", 68)[0]):
            tag, offset = unpack(blob, "II", 80 + resource * 8)
            if tag & 0xffffff == 0x30:
                pos = offset
    for mip in range(mip_count - 1, 0, -1):
        pos += image_size(max(1, width >> mip), max(1, height >> mip), fmt)
    assert fmt == 13, f"M4A1-C black texture is no longer BC1: {path} (format {fmt})"
    payload = blob[pos:pos + image_size(width, height, fmt)]
    return rgba_png(width, height, decode_bc1(width, height, payload))


assert MDL[:4] == b"IDST" and unpack(MDL, "i", 4)[0] == 44
assert unpack(MDL, "i", 8)[0] == unpack(VVD, "i", 8)[0] == unpack(VTX, "i", 16)[0]

# Bones: Source vertices are stored in model-space bind coordinates.  Keeping
# the authored local bind hierarchy lets Three.js calculate the inverse binds
# and apply every Source animation channel without baking or approximating it.
bone_count, bone_offset = unpack(MDL, "2i", 156)
bones = []
bone_anim = []
for index in range(bone_count):
    at = bone_offset + index * 216
    name = cstring(MDL, at + unpack(MDL, "i", at)[0])
    parent = unpack(MDL, "i", at + 4)[0]
    pos = list(unpack(MDL, "3f", at + 32))
    bind_quat = list(unpack(MDL, "4f", at + 44))
    base_rot = list(unpack(MDL, "3f", at + 60))
    pos_scale = list(unpack(MDL, "3f", at + 72))
    rot_scale = list(unpack(MDL, "3f", at + 84))
    bones.append({"name": name, "parent": parent, "pose": pos + bind_quat})
    bone_anim.append((pos, base_rot, pos_scale, rot_scale))

# VVD's 48-byte mstudiovertex_t contains three weights, three bone ids and a
# bone count, followed by model-space position, normal and UV.
vertex_count = unpack(VVD, "i", 16)[0]
fixup_count, fixup_offset, vertex_offset = unpack(VVD, "3i", 48)
vertices = [unpack(VVD, "3f4B8f", vertex_offset + index * 48)
            for index in range(vertex_count)]
if fixup_count:
    remapped = []
    for index in range(fixup_count):
        _, start, count = unpack(VVD, "3i", fixup_offset + index * 12)
        remapped.extend(vertices[start:start + count])
    vertices = remapped

# Texture order comes from the MDL.  The two rifle sheets are contained in the
# mod; v_hands is an explicit stock CSS dependency omitted from the archive.
texture_count, texture_offset = unpack(MDL, "2i", 204)
texture_names = [cstring(MDL, texture_offset + index * 64
                         + unpack(MDL, "i", texture_offset + index * 64)[0])
                 for index in range(texture_count)]
assert texture_names == ["PV-M4A1-CUSTOM", "PV_M4A1EX_ADVANCE", "v_hands"]
(OUT / "tex0.png").write_bytes(vtf_top_png(TEXTURES / "PV-M4A1-CUSTOM.vtf"))
(OUT / "tex1.png").write_bytes(vtf_top_png(TEXTURES / "PV_M4A1EX_ADVANCE.vtf"))
stock_hands = PROJECT / "assets/classic/barrett/v_hands.png"
assert stock_hands.is_file(), "stock CSS v_hands dependency is missing"
shutil.copyfile(stock_hands, OUT / "tex2.png")

# Rebuild every optimized LOD0 triangle while retaining the original Source
# skin weights. VTX strips are clockwise; the view transform below mirrors X
# to convert the Source left-handed presentation, making them CCW in Three.
body_count, body_offset = unpack(MDL, "2i", 232)
vtx_body_count, vtx_body_offset = unpack(VTX, "2i", 28)
assert body_count == vtx_body_count == 2
parts = []
binary = bytearray()
weapon_points = []
for body_index in range(body_count):
    body = body_offset + body_index * 16
    model_count, _, model_offset = unpack(MDL, "3i", body + 4)
    vtx_body = vtx_body_offset + body_index * 8
    vtx_model_count, vtx_model_offset = unpack(VTX, "2i", vtx_body)
    assert model_count == vtx_model_count == 1
    model = body + model_offset
    vtx_model = vtx_body + vtx_model_offset
    mesh_count, mesh_offset, _, model_vertex_offset = unpack(MDL, "4i", model + 72)
    lod_count, vtx_lod_offset = unpack(VTX, "2i", vtx_model)
    assert lod_count >= 1
    lod = vtx_model + vtx_lod_offset
    lod_mesh_count, vtx_mesh_offset = unpack(VTX, "2i", lod)
    assert mesh_count == lod_mesh_count
    for mesh_index in range(mesh_count):
        mesh = model + mesh_offset + mesh_index * 116
        material, _, _, mesh_vertex_offset = unpack(MDL, "4i", mesh)
        vtx_mesh = lod + vtx_mesh_offset + mesh_index * 9
        strip_group_count, strip_group_offset = unpack(VTX, "2i", vtx_mesh)
        triangle_indices = []
        for group_index in range(strip_group_count):
            group = vtx_mesh + strip_group_offset + group_index * 25
            group_vertex_count, group_vertex_offset, index_count, index_offset, strip_count, strip_offset = unpack(VTX, "6i", group)
            refs = [unpack(VTX, "H", group + group_vertex_offset + item * 9 + 4)[0]
                    + mesh_vertex_offset + model_vertex_offset // 48
                    for item in range(group_vertex_count)]
            indices = unpack(VTX, str(index_count) + "H", group + index_offset)
            for strip_index in range(strip_count):
                strip = group + strip_offset + strip_index * 27
                count, start = unpack(VTX, "2i", strip)
                flags = VTX[strip + 18]
                ids = [refs[item] for item in indices[start:start + count]]
                if flags & 1:
                    triangle_indices.extend(ids)
                else:
                    for item in range(len(ids) - 2):
                        triangle_indices.extend((ids[item + item % 2], ids[item + 1 - item % 2], ids[item + 2]))
        assert len(triangle_indices) % 3 == 0
        packed = bytearray()
        for vertex_index in triangle_indices:
            row = vertices[vertex_index]
            weights = list(row[:3])
            bone_ids = list(row[3:6])
            used = row[6]
            position = list(row[7:10])
            normal = list(row[10:13])
            uv = list(row[13:15])
            if body_index == 0:
                weapon_points.append(position)
            skin_ids = [float(bone_ids[item]) if item < used else 0. for item in range(4)]
            skin_weights = [weights[item] if item < min(used, 3) else 0. for item in range(4)]
            if used == 1:
                skin_weights[0] = 1.
            total = sum(skin_weights)
            if total <= 0:
                skin_weights[0] = 1.
            elif abs(total - 1.) > 1e-5:
                skin_weights = [weight / total for weight in skin_weights]
            packed.extend(struct.pack("<16f", *(position + normal + uv + skin_ids + skin_weights)))
        parts.append({"map": f"tex{material}.png", "textureName": texture_names[material],
                      "count": len(triangle_indices), "offset": len(binary),
                      "weapon": body_index == 0})
        binary.extend(packed)


def anim_value(pointer, frame):
    """Decode Source's run-length mstudioanimvalue_t stream."""
    remaining = frame
    at = pointer
    while True:
        valid, total = unpack(MDL, "2B", at)
        assert total > 0 and valid <= total
        if remaining < total:
            sample = min(remaining, valid - 1)
            return unpack(MDL, "h", at + 2 + sample * 2)[0] if valid else 0
        remaining -= total
        at += 2 + valid * 2


def animation_records(anim_at):
    records = {}
    at = anim_at
    while True:
        bone, flags, next_offset = unpack(MDL, "BBH", at)
        payload = at + 4
        pos_ptr = rot_ptr = None
        # This pack uses animated Euler/position channels only.  Fail loudly if
        # a future replacement introduces compressed raw quaternion variants.
        assert not flags & (0x01 | 0x02 | 0x20), f"unsupported raw animation flags {flags:#x}"
        if flags & 0x08:
            rot_ptr = payload
            payload += 6
        if flags & 0x04:
            pos_ptr = payload
        records[bone] = (flags, pos_ptr, rot_ptr)
        if not next_offset:
            break
        at += next_offset
    return records


animation_count, animation_offset = unpack(MDL, "2i", 180)
source_anims = {}
for animation_index in range(animation_count):
    descriptor = animation_offset + animation_index * 100
    name = cstring(MDL, descriptor + unpack(MDL, "i", descriptor + 4)[0])
    fps = unpack(MDL, "f", descriptor + 8)[0]
    frame_count = unpack(MDL, "i", descriptor + 16)[0]
    anim_block, anim_index = unpack(MDL, "2i", descriptor + 52)
    assert anim_block == 0 and anim_index > 0
    records = animation_records(descriptor + anim_index)
    values = []
    for frame in range(frame_count):
        for bone_index in range(bone_count):
            base_pos, base_rot, pos_scale, rot_scale = bone_anim[bone_index]
            position, rotation = list(base_pos), list(base_rot)
            record = records.get(bone_index)
            if record:
                _, pos_ptr, rot_ptr = record
                if pos_ptr is not None:
                    offsets = unpack(MDL, "3H", pos_ptr)
                    for axis in range(3):
                        if offsets[axis]:
                            position[axis] += anim_value(pos_ptr + offsets[axis], frame) * pos_scale[axis]
                if rot_ptr is not None:
                    offsets = unpack(MDL, "3H", rot_ptr)
                    for axis in range(3):
                        if offsets[axis]:
                            rotation[axis] += anim_value(rot_ptr + offsets[axis], frame) * rot_scale[axis]
            values.extend(position)
            values.extend(quat_xyz(rotation))
    source_anims[name] = {"fps": fps, "frames": frame_count, "values": values}

clip_names = {"@idle": "idle_0", "@reload": "reload", "@draw": "select",
              "@shoot1": "fire1", "@shoot2": "fire2", "@shoot3": "fire3"}
clips = {}
for source_name, clip_name in clip_names.items():
    source = source_anims[source_name]
    values = source.pop("values")
    clips[clip_name] = {"times": [round(frame / source["fps"], 6)
                                  for frame in range(source["frames"])],
                        "offset": len(binary), "count": source["frames"]}
    binary.extend(struct.pack("<" + "f" * len(values), *values))

# Sequence events are normalized cycles in Source v44.  Preserve the exact
# authored event names/times so runtime audio follows the animation itself.
sequence_count, sequence_offset = unpack(MDL, "2i", 188)
events = {}
sequence_clip = {"idle": "idle_0", "reload": "reload", "draw": "select",
                 "shoot1": "fire1", "shoot2": "fire2", "shoot3": "fire3"}
for sequence_index in range(sequence_count):
    descriptor = sequence_offset + sequence_index * 212
    name = cstring(MDL, descriptor + unpack(MDL, "i", descriptor + 4)[0])
    event_count, event_offset = unpack(MDL, "2i", descriptor + 24)
    clip_name = sequence_clip[name]
    duration = clips[clip_name]["times"][-1]
    if event_count:
        events[clip_name] = []
    for event_index in range(event_count):
        event = descriptor + event_offset + event_index * 80
        cycle = unpack(MDL, "f", event)[0]
        code, event_type = unpack(MDL, "2i", event + 4)
        option = MDL[event + 12:event + 76].split(b"\0", 1)[0].decode("utf-8", "replace")
        events[clip_name].append({"name": option, "code": code, "type": event_type,
                                  "time": round(cycle * duration, 6)})

# Calibrate only the rifle, not the arms: the user's existing M4 pose then
# remains a useful screen-space placement control. The animated Source barrel
# extends toward -Y, so map -Y to camera-forward -Z while keeping source +Z up.
# Mirroring X converts the Source viewmodel's handed presentation so the stock
# rifle is held on the player's right, with the muzzle pointing toward center.
mins = [min(point[axis] for point in weapon_points) for axis in range(3)]
maxs = [max(point[axis] for point in weapon_points) for axis in range(3)]
center = [(mins[axis] + maxs[axis]) * .5 for axis in range(3)]
scale = .82 / (maxs[1] - mins[1])
transform = [-scale, 0, 0, center[0] * scale,
             0, 0, scale, -center[2] * scale,
             0, -scale, 0, center[1] * scale,
             0, 0, 0, 1]

(OUT / "view.bin").write_bytes(binary)
(OUT / "view.json").write_text(json.dumps({
    "bones": bones, "parts": parts, "clips": clips, "events": events,
    "source": "Source v44 complete first-person rig",
    "weaponLength": .82, "muzzleBone": "attack", "transform": transform,
}, separators=(",", ":")), encoding="utf-8")

print("M4A1-C view:", bone_count, "bones;", len(parts), "parts;",
      [(name, clip["count"]) for name, clip in clips.items()],
      ";", len(binary), "bytes")
