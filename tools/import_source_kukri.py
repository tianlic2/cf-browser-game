"""Import the user supplied Source v44 Kukri as the melee weapon ``屠龙``.

Usage: python3 tools/import_source_kukri.py 尼伯尔

The pack is read locally.  The complete view rig, all six authored clips,
source textures/material flags, world model and source WAV files are retained.
"""
import io
import json
import math
import shutil
import struct
import sys
import zlib
from pathlib import Path

import numpy as np


def unpack(blob, fmt, at=0):
    return struct.unpack_from("<" + fmt, blob, at)


def string(blob, at):
    return blob[at:blob.index(b"\0", at)].decode("utf8", "replace")


def png_chunk(kind, payload):
    return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload) & 0xffffffff)


def rgba_png(width, height, rgba):
    rows = b"".join(b"\0" + rgba[y*width*4:(y+1)*width*4] for y in range(height))
    return (b"\x89PNG\r\n\x1a\n" + png_chunk(b"IHDR", struct.pack(">2I5B",width,height,8,6,0,0,0))
            + png_chunk(b"IDAT",zlib.compress(rows,9)) + png_chunk(b"IEND",b""))


def rgb565(value):
    return (((value>>11)&31)*255//31, ((value>>5)&63)*255//63, (value&31)*255//31, 255)


def decode_bc1(width, height, payload):
    out=bytearray(width*height*4); at=0
    for by in range((height+3)//4):
        for bx in range((width+3)//4):
            c0,c1,bits=unpack(payload,"HHI",at);at+=8;a,b=rgb565(c0),rgb565(c1)
            pal=[a,b,tuple((2*a[k]+b[k])//3 for k in range(4)),tuple((a[k]+2*b[k])//3 for k in range(4))] if c0>c1 else [a,b,tuple((a[k]+b[k])//2 for k in range(4)),(0,0,0,0)]
            for py in range(4):
                for px in range(4):
                    x,y=bx*4+px,by*4+py
                    if x<width and y<height:out[(y*width+x)*4:(y*width+x+1)*4]=bytes(pal[(bits>>(2*(py*4+px)))&3])
    return out


def vtf_png(path):
    blob=path.read_bytes();assert blob[:4]==b"VTF\0"
    _,minor,header,width,height=unpack(blob,"IIIHH",4);fmt=unpack(blob,"I",52)[0];mips=blob[56]
    low_fmt=unpack(blob,"I",57)[0];low_w,low_h=blob[61:63]
    def size(w,h,f):
        if f in (13,20):return max(1,(w+3)//4)*max(1,(h+3)//4)*8
        if f in (14,15):return max(1,(w+3)//4)*max(1,(h+3)//4)*16
        return w*h*{0:4,2:3,3:3,12:4,16:4}.get(f,4)
    pos=header+(size(low_w,low_h,low_fmt) if low_w and low_h else 0)
    if minor>=3:
        for i in range(unpack(blob,"I",68)[0]):
            tag,off=unpack(blob,"II",80+i*8)
            if tag&0xffffff==0x30:pos=off
    for mip in range(mips-1,0,-1):pos+=size(max(1,width>>mip),max(1,height>>mip),fmt)
    data=blob[pos:pos+size(width,height,fmt)]
    if fmt==13:rgba=decode_bc1(width,height,data)
    elif fmt==0:rgba=bytearray(data)
    elif fmt==12:rgba=bytearray(v for i in range(0,len(data),4) for v in (data[i+2],data[i+1],data[i],data[i+3]))
    elif fmt==3:rgba=bytearray(v for i in range(0,len(data),3) for v in (data[i+2],data[i+1],data[i],255))
    else:raise ValueError(f"unsupported VTF format {fmt}: {path}")
    return rgba_png(width,height,rgba)


ROOT = Path(sys.argv[1])
PROJECT = Path(__file__).resolve().parents[1]
OUT = PROJECT / "assets/classic/kukri_dragon"
OUT.mkdir(parents=True, exist_ok=True)
MODEL_DIR = ROOT / "models/weapons"
MATERIAL_DIR = ROOT / "materials/models/weapons/v_models"


def quat_xyz(angles):
    x, y, z = (v * .5 for v in angles)
    cx, sx = math.cos(x), math.sin(x)
    cy, sy = math.cos(y), math.sin(y)
    cz, sz = math.cos(z), math.sin(z)
    return [sx*cy*cz-cx*sy*sz, cx*sy*cz+sx*cy*sz,
            cx*cy*sz-sx*sy*cz, cx*cy*cz+sx*sy*sz]


def find_vtf(name):
    wanted = name.lower() + ".vtf"
    for path in MATERIAL_DIR.rglob("*.vtf"):
        if path.name.lower() == wanted:
            return path
    raise FileNotFoundError(name)


def png(name, suffix=""):
    target = OUT / (name.lower().replace("-", "_") + suffix + ".png")
    target.write_bytes(vtf_png(find_vtf(name)))
    return target.name


def source_files(stem):
    mdl = (MODEL_DIR / f"{stem}.mdl").read_bytes()
    vvd = (MODEL_DIR / f"{stem}.vvd").read_bytes()
    vtx = (MODEL_DIR / f"{stem}.dx90.vtx").read_bytes()
    assert mdl[:4] == b"IDST" and unpack(mdl, "i", 4)[0] == 44
    assert unpack(mdl, "i", 8)[0] == unpack(vvd, "i", 8)[0] == unpack(vtx, "i", 16)[0]
    return mdl, vvd, vtx


def source_vertices(vvd):
    count = unpack(vvd, "i", 16)[0]
    fix_count, fix_at, vertex_at = unpack(vvd, "3i", 48)
    rows = [unpack(vvd, "3f4B8f", vertex_at + i * 48) for i in range(count)]
    if fix_count:
        fixed = []
        for i in range(fix_count):
            _, start, length = unpack(vvd, "3i", fix_at + i * 12)
            fixed.extend(rows[start:start + length])
        rows = fixed
    return rows


def optimized_parts(mdl, vtx, vertices):
    body_count, body_at = unpack(mdl, "2i", 232)
    vbody_count, vbody_at = unpack(vtx, "2i", 28)
    assert body_count == vbody_count
    result = []
    for body_i in range(body_count):
        body = body_at + body_i * 16
        _, model_count, _, model_off = unpack(mdl, "4i", body)
        vbody = vbody_at + body_i * 8
        vmodel_count, vmodel_off = unpack(vtx, "2i", vbody)
        assert model_count == vmodel_count
        for model_i in range(model_count):
            model = body + model_off + model_i * 148
            vmodel = vbody + vmodel_off + model_i * 8
            mesh_count, mesh_off, _, vertex_base = unpack(mdl, "4i", model + 72)
            lod_count, lod_off = unpack(vtx, "2i", vmodel)
            assert lod_count
            lod = vmodel + lod_off
            vmesh_count, vmesh_off = unpack(vtx, "2i", lod)
            assert mesh_count == vmesh_count
            for mesh_i in range(mesh_count):
                mesh = model + mesh_off + mesh_i * 116
                material, _, _, mesh_vertex_off = unpack(mdl, "4i", mesh)
                vmesh = lod + vmesh_off + mesh_i * 9
                group_count, group_off = unpack(vtx, "2i", vmesh)
                triangles = []
                for group_i in range(group_count):
                    group = vmesh + group_off + group_i * 25
                    vc, vo, ic, io, strip_count, strip_off = unpack(vtx, "6i", group)
                    refs = [unpack(vtx, "H", group + vo + j * 9 + 4)[0]
                            + mesh_vertex_off + vertex_base // 48 for j in range(vc)]
                    indices = unpack(vtx, str(ic) + "H", group + io)
                    for strip_i in range(strip_count):
                        strip = group + strip_off + strip_i * 27
                        count, start = unpack(vtx, "2i", strip)
                        ids = [refs[j] for j in indices[start:start + count]]
                        if vtx[strip + 18] & 1:
                            triangles.extend(ids)
                        else:
                            for j in range(len(ids) - 2):
                                triangles.extend((ids[j+j%2], ids[j+1-j%2], ids[j+2]))
                result.append((body_i, material, triangles))
    return result


def animation_values(mdl, bones_anim, bone_count, descriptor):
    def stream_value(pointer, frame):
        left, at = frame, pointer
        while True:
            valid, total = unpack(mdl, "2B", at)
            assert total and valid <= total
            if left < total:
                sample = min(left, max(0, valid - 1))
                return unpack(mdl, "h", at + 2 + sample * 2)[0] if valid else 0
            left -= total
            at += 2 + valid * 2

    fps = unpack(mdl, "f", descriptor + 8)[0]
    frames = unpack(mdl, "i", descriptor + 16)[0]
    block, anim_off = unpack(mdl, "2i", descriptor + 52)
    assert block == 0 and anim_off > 0
    records, at = {}, descriptor + anim_off
    while True:
        bone, flags, nxt = unpack(mdl, "BBH", at)
        payload, rot_ptr, pos_ptr = at + 4, None, None
        assert not flags & (0x01 | 0x02 | 0x20), hex(flags)
        if flags & 0x08:
            rot_ptr, payload = payload, payload + 6
        if flags & 0x04:
            pos_ptr = payload
        records[bone] = (pos_ptr, rot_ptr)
        if not nxt:
            break
        at += nxt
    values = []
    for frame in range(frames):
        for bone_i in range(bone_count):
            base_pos, base_rot, pos_scale, rot_scale = bones_anim[bone_i]
            pos, rot = list(base_pos), list(base_rot)
            if bone_i in records:
                pos_ptr, rot_ptr = records[bone_i]
                for pointer, target, scale in ((pos_ptr, pos, pos_scale), (rot_ptr, rot, rot_scale)):
                    if pointer is None:
                        continue
                    offsets = unpack(mdl, "3H", pointer)
                    for axis in range(3):
                        if offsets[axis]:
                            target[axis] += stream_value(pointer + offsets[axis], frame) * scale[axis]
            values.extend(pos + quat_xyz(rot))
    return fps, frames, values


def import_view():
    mdl, vvd, vtx = source_files("v_knife_t")
    vertices = source_vertices(vvd)
    texture_count, texture_at = unpack(mdl, "2i", 204)
    names = [string(mdl, texture_at+i*64+unpack(mdl, "i", texture_at+i*64)[0])
             for i in range(texture_count)]
    assert names == ["w4", "0", "Soviet", "PV-KUKRI_BEAST", "v_hands", "Arms"]

    texture_sources = {"PV-KUKRI_BEAST":"KUKRI_BEAST_S", "Arms":"BTR_AF01"}
    maps = {name: png(texture_sources.get(name, name)) for name in names if name != "v_hands"}
    # The MDL references Counter-Strike: Source's stock v_hands sheet but the
    # user pack does not redistribute it. Reuse the exact local dependency
    # already retained by the Barrett/M4A1-C imports.
    stock_hands = PROJECT / "assets/classic/barrett/v_hands.png"
    assert stock_hands.is_file(), "stock Source v_hands texture is missing"
    shutil.copyfile(stock_hands, OUT / "v_hands.png")
    maps["v_hands"] = "v_hands.png"
    maps["KUKRI_MASK"] = png("KUKRI_BEAST_N_S", "_mask")
    maps["HANDS_NORMAL"] = png("BTR_AF01_NORMAL", "_normal")
    maps["HANDS_AO"] = png("BTR_AF01_AO", "_ao")
    maps["HANDS_MASK"] = png("BTR_AF01_MASK", "_mask")

    bone_count, bone_at = unpack(mdl, "2i", 156)
    bones, bone_anim = [], []
    for i in range(bone_count):
        at = bone_at + i * 216
        name = string(mdl, at + unpack(mdl, "i", at)[0])
        parent = unpack(mdl, "i", at + 4)[0]
        pos = list(unpack(mdl, "3f", at + 32))
        quat = list(unpack(mdl, "4f", at + 44))
        rot = list(unpack(mdl, "3f", at + 60))
        bone_anim.append((pos, rot, list(unpack(mdl, "3f", at+72)), list(unpack(mdl, "3f", at+84))))
        bones.append({"name": name, "parent": parent, "pose": pos + quat})

    binary, parts = bytearray(), []
    material_meta = {
        # These two Kukri sheets were authored for Source's direct additive
        # path.  Keep that colour-space exception on the asset itself: other
        # imported weapons (notably Iron Beast) must retain the renderer's
        # original sRGB additive treatment.
        "w4": {"additive": True, "effect": True, "linearAdditive": True},
        "0": {"additive": True, "effect": True, "linearAdditive": True},
        # Source's colour is fully authored into KUKRI_BEAST_S.  Its
        # KUKRI_BEAST_N_S is a coloured $envmapmask, not a PBR metalness map.
        # Keep the base independent of the level's blue sky lighting and add
        # the mask as a restrained second pass, matching Source's material
        # layering without replacing the gold/red albedo.
        "PV-KUKRI_BEAST": {"unlit": True, "reflectionMap": maps["KUKRI_MASK"],
                            "reflectionOpacity": .22},
        "Arms": {"normalMap": maps["HANDS_NORMAL"], "aoMap": maps["HANDS_AO"], "roughness": .72},
    }
    for body, material, indices in optimized_parts(mdl, vtx, vertices):
        packed = bytearray()
        for vertex_i in indices:
            row = vertices[vertex_i]
            weights, bone_ids, used = list(row[:3]), list(row[3:6]), row[6]
            pos, normal, uv = list(row[7:10]), list(row[10:13]), list(row[13:15])
            ids = [float(bone_ids[j]) if j < used else 0. for j in range(4)]
            ws = [weights[j] if j < min(used, 3) else 0. for j in range(4)]
            if used == 1: ws[0] = 1.
            total = sum(ws)
            ws = ([1., 0., 0., 0.] if total <= 0 else [w/total for w in ws])
            packed.extend(struct.pack("<16f", *(pos+normal+uv+ids+ws)))
        entry = {"map": maps[names[material]], "textureName": names[material],
                 "count": len(indices), "offset": len(binary), "weapon": body == 0}
        entry.update(material_meta.get(names[material], {}))
        parts.append(entry); binary.extend(packed)

    animation_count, animation_at = unpack(mdl, "2i", 180)
    source = {}
    for i in range(animation_count):
        descriptor = animation_at + i * 100
        name = string(mdl, descriptor + unpack(mdl, "i", descriptor+4)[0])
        source[name] = animation_values(mdl, bone_anim, bone_count, descriptor)
    mapping = {"@idle":"idle_0", "@draw":"select", "@stab":"stab",
               "@stab_miss":"stab_miss", "@midslash1":"midslash1", "@midslash2":"midslash2"}
    clips = {}
    for source_name, clip_name in mapping.items():
        fps, frames, values = source[source_name]
        clips[clip_name] = {"times":[round(f/fps, 6) for f in range(frames)],
                            "offset":len(binary), "count":frames}
        binary.extend(struct.pack("<"+"f"*len(values), *values))

    # Source viewmodels are already authored around the camera: +X is forward,
    # +Y is camera-left and +Z is up.  Do not recenter the mesh around its raw
    # bind-pose weapon bounds.  The Kukri's bind vertices are intentionally far
    # away from the animated idle pose, so that calibration separates the hands,
    # knife and VFX.  Preserve the authored origin and metre factor instead.
    scale = .01
    transform = [0,-scale,0,0, 0,0,scale,0,
                 -scale,0,0,0, 0,0,0,1]
    (OUT/"view.bin").write_bytes(binary)
    (OUT/"view.json").write_text(json.dumps({
        "bones":bones, "parts":parts, "clips":clips, "events":{},
        "source":"Source v44 Kukri complete first-person rig",
        "weaponLength":.55, "forwardAxis":"x", "transform":transform,
    }, separators=(",",":")), encoding="utf8")
    return len(parts), bone_count, clips


def import_world():
    mdl, vvd, vtx = source_files("w_knife_t")
    vertices = source_vertices(vvd)
    parts = optimized_parts(mdl, vtx, vertices)
    assert len(parts) == 1 and parts[0][1] == 0
    indices = [parts[0][2][i+j] for i in range(0, len(parts[0][2]), 3) for j in (0,2,1)]
    vals = np.array([vertices[i][7:15] for i in indices], dtype="<f4")
    pos, normal, uv = vals[:,:3].copy(), vals[:,3:6].copy(), vals[:,6:8].copy()
    pos[:] = pos[:,[0,2,1]] * [1,1,-1]
    normal[:] = normal[:,[0,2,1]] * [1,1,-1]
    uv[:,1] = 1-uv[:,1]
    image = io.BytesIO(vtf_png(find_vtf("KUKRI_BEAST_S")))
    binary, views, accessors = bytearray(), [], []
    def view(data):
        while len(binary)%4: binary.append(0)
        views.append({"buffer":0,"byteOffset":len(binary),"byteLength":len(data)}); binary.extend(data); return len(views)-1
    def accessor(array, kind, bounds=False):
        a=np.asarray(array,dtype="<f4"); item={"bufferView":view(a.tobytes()),"componentType":5126,"count":len(a),"type":kind}
        if bounds:item.update(min=a.min(0).tolist(),max=a.max(0).tolist())
        accessors.append(item);return len(accessors)-1
    image_view=view(image.getvalue())
    attrs={"POSITION":accessor(pos,"VEC3",True),"NORMAL":accessor(normal,"VEC3"),"TEXCOORD_0":accessor(uv,"VEC2")}
    doc={"asset":{"version":"2.0","generator":"Source v44 Kukri world model"},"scene":0,
         "scenes":[{"nodes":[0]}],"nodes":[{"mesh":0}],"meshes":[{"name":"Kukri_Dragon","primitives":[{"attributes":attrs,"material":0}]}],
         "buffers":[{"byteLength":len(binary)}],"bufferViews":views,"accessors":accessors,
         "images":[{"bufferView":image_view,"mimeType":"image/png"}],"textures":[{"source":0,"sampler":0}],
         "samplers":[{"magFilter":9729,"minFilter":9987,"wrapS":10497,"wrapT":10497}],
         "materials":[{"name":"PV-KUKRI_BEAST","pbrMetallicRoughness":{"baseColorTexture":{"index":0},"metallicFactor":.78,"roughnessFactor":.27}}]}
    while len(binary)%4:binary.append(0)
    doc["buffers"][0]["byteLength"]=len(binary)
    raw=json.dumps(doc,separators=(",",":")).encode();raw+=b" "*(-len(raw)%4)
    (OUT/"world.glb").write_bytes(struct.pack("<4sII",b"glTF",2,28+len(raw)+len(binary))+struct.pack("<I4s",len(raw),b"JSON")+raw+struct.pack("<I4s",len(binary),b"BIN\0")+binary)
    return len(indices)//3


def import_audio():
    src = ROOT / "sound/weapons/knife"
    dst = PROJECT / "audio/classic/kukri_dragon"; dst.mkdir(parents=True, exist_ok=True)
    files = {"knife_deploy1.WAV":"deploy.wav", "knife_slash1.WAV":"slash1.wav",
             "knife_slash2.WAV":"slash2.wav", "knife_stab.WAV":"stab.wav",
             "knife_hit1.WAV":"hit1.wav", "knife_hit2.WAV":"hit2.wav",
             "knife_hit3.WAV":"hit3.wav", "knife_hit4.WAV":"hit4.wav",
             "knife_hitwall1.WAV":"hitwall.wav"}
    for old,new in files.items(): shutil.copyfile(src/old,dst/new)
    return len(files)


view_parts, bones, clips = import_view()
triangles = import_world()
sounds = import_audio()
print("屠龙:", bones, "bones;", view_parts, "view parts;", triangles,
      "world triangles;", sounds, "source WAVs;", {k:v["count"] for k,v in clips.items()})
