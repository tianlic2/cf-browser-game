"""Import Iron Beast's original GoldSrc SMD viewmodel and QC animation sources.

Usage: python3 tools/import_ironbeast_smd.py /path/to/compile/v_ /path/to/v_ak47.mdl [/path/to/attack-v_ak47.mdl]
The output follows the same SMD-space/skinning convention as import_cf_view.py.
"""
import json, math, re, struct, sys, zlib
from pathlib import Path

src = Path(sys.argv[1])
mdl = Path(sys.argv[2]) if len(sys.argv) > 2 else None
attack_mdl = Path(sys.argv[3]) if len(sys.argv) > 3 else None
out = Path(__file__).resolve().parents[1] / "assets/classic/m4_ironbeast"
out.mkdir(parents=True, exist_ok=True)

def mdl_texture_flags(path):
    """Read the GoldSrc v10 material flags compiled from the source model.

    QC describes the bodygroups, but the additive/fullbright/etc. texture flags
    live in the compiled MDL texture table. Keep those flags in view.json so the
    browser renderer does not have to guess from texture filenames.
    """
    if path is None:
        return {}
    raw = path.read_bytes()
    if raw[:4] != b"IDST" or struct.unpack_from("<i", raw, 4)[0] != 10:
        raise ValueError(f"expected GoldSrc v10 MDL: {path}")
    count, offset = struct.unpack_from("<2i", raw, 180)
    result = {}
    for index in range(count):
        at = offset + index * 80
        name = raw[at:at+64].split(b"\0", 1)[0].decode("utf-8", "replace")
        result[name.lower()] = struct.unpack_from("<i", raw, at + 64)[0]
    return result

source_flags = mdl_texture_flags(mdl)

def quat(v):
    x, y, z = (a / 2 for a in v)
    cx, sx = math.cos(x), math.sin(x)
    cy, sy = math.cos(y), math.sin(y)
    cz, sz = math.cos(z), math.sin(z)
    return [sx*cy*cz-cx*sy*sz, cx*sy*cz+sx*cy*sz,
            cx*cy*sz-sx*sy*cz, cx*cy*cz+sx*sy*sz]

def read_mdl_clip(path, clip_name, expected_nodes, current_idle):
    """Read one missing GoldSrc animation without replacing the SMD model.

    The complete QC/SMD pack used for the final gun appearance omits the
    original package's seventh sequence (knife-attack). Both packages retain
    the exact same 113-bone hierarchy, so the authored local poses can be
    sampled onto the current gun/hands while its geometry and materials stay
    untouched.
    """
    raw = path.read_bytes()
    if raw[:4] != b"IDST" or struct.unpack_from("<i", raw, 4)[0] != 10:
        raise ValueError(f"expected GoldSrc v10 MDL: {path}")
    integer = lambda at: struct.unpack_from("<i", raw, at)[0]
    string = lambda at: raw[at:].split(b"\0", 1)[0].decode("utf-8", "replace")
    bone_count, bone_offset = integer(140), integer(144)
    mdl_nodes = [(index, string(bone_offset + index * 112),
                  integer(bone_offset + index * 112 + 32))
                 for index in range(bone_count)]
    if mdl_nodes != expected_nodes:
        raise ValueError(f"bone hierarchy differs in {path}:{clip_name}")

    def channel(record, offset, frame, default, step):
        if not offset:
            return default
        at, cursor = record + offset, 0
        while True:
            valid, total = struct.unpack_from("<2B", raw, at)
            at += 2
            values = struct.unpack_from("<" + "h" * valid, raw, at)
            at += valid * 2
            if frame < cursor + total:
                return default + values[min(frame - cursor, valid - 1)] * step
            cursor += total

    sequence_count, sequence_offset = integer(164), integer(168)
    for sequence_index in range(sequence_count):
        desc = sequence_offset + sequence_index * 176
        if string(desc) != clip_name:
            continue
        fps = struct.unpack_from("<f", raw, desc + 32)[0]
        frame_count = integer(desc + 56)
        animation = integer(desc + 124)
        values = []
        for frame in range(frame_count):
            for bone_index in range(bone_count):
                # The earlier compiled package uses a different Scene Root
                # axis convention, while its gun/hands bones 1..57 match the
                # final QC/SMD rig exactly. Its 58+ helpers also belong to an
                # older effect layout and would fling the current additive
                # VFX cards across the screen. Keep those non-action bones in
                # the current idle pose and transfer only the compatible
                # authored gun-and-hands motion.
                if bone_index == 0 or bone_index >= 58:
                    pose = current_idle[bone_index]
                else:
                    record = animation + bone_index * 12
                    offsets = struct.unpack_from("<6H", raw, record)
                    source_bone = bone_offset + bone_index * 112
                    defaults = struct.unpack_from("<6f", raw, source_bone + 64)
                    steps = struct.unpack_from("<6f", raw, source_bone + 88)
                    pose = [channel(record, offsets[k], frame, defaults[k], steps[k])
                            for k in range(6)]
                values.extend(pose[:3])
                values.extend(quat(pose[3:]))
        events = []
        event_count, event_offset = struct.unpack_from("<2i", raw, desc + 48)
        for event_index in range(event_count):
            event = event_offset + event_index * 76
            frame, code, event_type = struct.unpack_from("<3i", raw, event)
            events.append({"name": string(event + 12), "code": code, "type": event_type,
                           "frame": frame, "time": round(frame / fps, 6)})
        return ({"times": [round(frame / fps, 6) for frame in range(frame_count)],
                 "count": frame_count}, values, events)
    raise ValueError(f"missing sequence {clip_name!r} in {path}")

def read_smd(path):
    text = path.read_text(encoding="utf-8-sig").replace("\r", "")
    lines = text.splitlines()
    def section(tag):
        start = lines.index(tag) + 1
        end = lines.index("end", start)
        return lines[start:end]
    nodes = []
    for line in section("nodes"):
        match = re.fullmatch(r'\s*(\d+)\s+"(.*)"\s+(-?\d+)\s*', line)
        if match:
            nodes.append((int(match[1]), match[2], int(match[3])))
    skeleton_lines = section("skeleton")
    frames, current = [], None
    for line in skeleton_lines:
        if line.startswith("time "):
            if current is not None: frames.append(current)
            current = {"time": int(line.split()[1]), "bones": {}}
        elif line.strip() and current is not None:
            values = line.split()
            current["bones"][int(values[0])] = list(map(float, values[1:7]))
    if current is not None: frames.append(current)
    return nodes, frames, lines

def read_indexed_bmp(path, transparent_zero=False):
    bmp = path.read_bytes()
    if bmp[:2] != b"BM": raise ValueError(f"unsupported texture: {path}")
    offset = struct.unpack_from("<I", bmp, 10)[0]
    dib = struct.unpack_from("<I", bmp, 14)[0]
    w, h = struct.unpack_from("<ii", bmp, 18)
    planes, bpp = struct.unpack_from("<HH", bmp, 26)
    compression = struct.unpack_from("<I", bmp, 30)[0]
    if planes != 1 or bpp != 8 or compression != 0:
        raise ValueError(f"expected uncompressed 8-bit BMP: {path}")
    colors = struct.unpack_from("<I", bmp, 46)[0] or 256
    palette_at = 14 + dib
    palette = [bmp[palette_at+i*4:palette_at+i*4+4] for i in range(colors)]
    stride = ((w + 3) // 4) * 4
    rgba = bytearray(w*h*4)
    for y in range(h):
        sy = h - 1 - y if h > 0 else y
        row = offset + sy*stride
        for x in range(w):
            b, g, r, _ = palette[bmp[row+x]]
            at = (y*w+x)*4
            alpha = 0 if transparent_zero and bmp[row+x] == 0 else 255
            rgba[at:at+4] = bytes((r,g,b,alpha))
    return w, abs(h), rgba

def png_chunk(tag, payload):
    return (struct.pack(">I", len(payload)) + tag + payload +
            struct.pack(">I", zlib.crc32(tag+payload) & 0xffffffff))

def rgba_png(w, h, rgba):
    raw = b"".join(b"\0" + rgba[y*w*4:(y+1)*w*4] for y in range(h))
    return (b"\x89PNG\r\n\x1a\n" +
            png_chunk(b"IHDR", struct.pack(">2I5B",w,h,8,6,0,0,0)) +
            png_chunk(b"IDAT", zlib.compress(raw,9)) + png_chunk(b"IEND",b""))

model_files = [
    ("PV-M4A1_S_IronBeast_ImperialGold_01.smd", "weapon"),
    ("PV-M4A1_S_IronBeast_ImperialGold_02.smd", "weapon"),
    ("M4A1_S_IronBeast_ImperialGold_S_01.smd", "specular"),
    ("M4A1_S_IronBeast_ImperialGold_S_02.smd", "specular"),
    ("PV-M4A1_S_IronBeast_ImperialGold_GR.smd", "hands"),
    ("PV-M4A1_S_IronBeast_ImperialGold_VFX.smd", "effect"),
]
parsed = [(read_smd(src/name), kind) for name, kind in model_files]
reference_nodes = parsed[0][0][0]
for (nodes, _, _), _ in parsed[1:]:
    if nodes != reference_nodes:
        raise ValueError("SMD model files do not share the same bone hierarchy")
if [n[0] for n in reference_nodes] != list(range(len(reference_nodes))):
    raise ValueError("SMD bone indices are not contiguous")
bind = parsed[0][0][1][0]["bones"]
bones = [{"name": name, "parent": parent,
          "pose": bind[index][:3] + quat(bind[index][3:6])}
         for index, name, parent in reference_nodes]

texture_png = {}
parts, blob = [], bytearray()
for ((nodes, frames, lines), kind) in parsed:
    try:
        start = lines.index("triangles") + 1
        end = lines.index("end", start)
    except ValueError:
        raise ValueError("model SMD has no triangles section")
    at = start
    while at < end:
        material = Path(lines[at].strip().strip('"')).name
        at += 1
        rows = []
        while at < end and len(rows) < 3:
            if lines[at].strip(): rows.append(lines[at].split())
            at += 1
        if len(rows) != 3: raise ValueError(f"incomplete triangle in {material}")
        tex_name = Path(material).stem + ".png"
        bmp = src / material
        if not bmp.is_file():
            matches = list(src.rglob(material))
            if not matches: raise FileNotFoundError(f"SMD texture not found: {material}")
            bmp = matches[0]
        flags = source_flags.get(material.lower(), 0)
        if tex_name not in texture_png:
            w,h,rgba = read_indexed_bmp(bmp, transparent_zero=bool(flags & (16 | 32 | 64)))
            texture_png[tex_name] = rgba_png(w,h,rgba)
            (out / tex_name).write_bytes(texture_png[tex_name])
        verts = []
        for row in rows:
            if len(row) < 9: raise ValueError(f"invalid SMD vertex: {row}")
            joint = int(row[0]); vals = list(map(float,row[1:9]))
            if joint < 0 or joint >= len(bones): raise ValueError(f"invalid SMD joint {joint}")
            verts.append(vals + [joint,0,0,0,1,0,0,0])
        a,c,d = verts
        u = [c[k]-a[k] for k in range(3)]; v = [d[k]-a[k] for k in range(3)]
        cross = (u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])
        if sum(cross[k]*a[3+k] for k in range(3)) < 0: verts[1],verts[2] = verts[2],verts[1]
        # Preserve every QC bodygroup as its own mesh. In particular the S_
        # geometry is a compiled additive overlay, not a PBR metalness map.
        part = {"map":tex_name,"textureName":material,"count":0,"offset":len(blob),
                "weapon":kind == "weapon","effect":kind == "effect",
                "specular":kind == "specular","kind":kind,"sourceFlags":flags,
                "additive":bool(flags & 32)}
        key = (tex_name,kind,flags)
        if not parts or (parts[-1]["map"],parts[-1]["kind"],parts[-1]["sourceFlags"]) != key:
            parts.append(part)
        for vert in verts:
            blob.extend(struct.pack("<16f",*vert[:8],float(vert[8]),*vert[9:]))
            parts[-1]["count"] += 1

qc = (src / "sequences.qc").read_text(encoding="utf-8-sig").replace("\r", "")
fps_by_name = {m[1]: float(m[3]) for m in re.finditer(
    r'^\s*\$sequence\s+"([^"]+)"\s+"([^"]+)"\s+fps\s+([0-9.]+)', qc, re.M)}
clips = {}
events = {}
for name in ("idle_0","reload","select","fire","prefire","postfire"):
    path = src / f"{name}.smd"
    if not path.is_file(): continue
    anim_nodes, anim_frames, _ = read_smd(path)
    if anim_nodes != reference_nodes: raise ValueError(f"bone hierarchy differs in {name}.smd")
    if name not in fps_by_name: raise ValueError(f"QC frame rate missing for {name}")
    fps = fps_by_name[name]
    values = []
    for frame in anim_frames:
        if len(frame["bones"]) != len(bones): raise ValueError(f"incomplete skeleton in {name}.smd")
        for i in range(len(bones)):
            pose = frame["bones"][i]
            values.extend(pose[:3]); values.extend(quat(pose[3:6]))
    clips[name] = {"times":[round(frame["time"]/fps,6) for frame in anim_frames],
                   "offset":len(blob),"count":len(anim_frames)}
    blob.extend(struct.pack("<"+"f"*len(values),*values))

if attack_mdl is not None:
    current_idle = read_smd(src / "idle_0.smd")[1][0]["bones"]
    clip, values, clip_events = read_mdl_clip(
        attack_mdl, "knife-attack", reference_nodes, current_idle)
    clip["offset"] = len(blob)
    clips["knife-attack"] = clip
    events["knife-attack"] = clip_events
    blob.extend(struct.pack("<" + "f" * len(values), *values))

(out / "view.bin").write_bytes(blob)
(out / "view.json").write_text(json.dumps({"bones":bones,"parts":parts,"clips":clips,"events":events,
    "source":"Iron Beast original QC/SMD bodygroups, compiled GoldSrc material flags, and original MDL knife-attack"},separators=(",",":")))
print(f"Imported {len(bones)} bones, {len(parts)} material parts and clips "
      f"{[(name,len(clip['times'])) for name,clip in clips.items()]} from original SMD/QC")
