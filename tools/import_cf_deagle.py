"""Convert the original-color CF Desert Eagle Source world model to static GLB.

Usage: python3 tools/import_cf_deagle.py /path/to/cf_deagle_pack
The world model contains only the gun, so the game can retain its own unified
first-person arms. See assets/classic/CREDITS.md for provenance and rights.
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
PROJECT = Path(__file__).resolve().parents[1]
OUT = PROJECT / 'assets/classic/deagle'
OUT.mkdir(parents=True, exist_ok=True)
base = ROOT / 'Required/models/weapons'
stem = 'w_pist_deagle'
mdl = (base / (stem + '.mdl')).read_bytes()
vvd = (base / (stem + '.vvd')).read_bytes()
vtx = (base / (stem + '.dx90.vtx')).read_bytes()
assert mdl[:4] == b'IDST' and unpack(mdl, 'i', 4)[0] == 44
assert unpack(mdl, 'i', 8)[0] == unpack(vvd, 'i', 8)[0] == unpack(vtx, 'i', 16)[0]

nt, texoff = unpack(mdl, '2i', 204)
names = [string(mdl, texoff + i * 64 + unpack(mdl, 'i', texoff + i * 64)[0]) for i in range(nt)]
assert names == ['PV-DEAGLE-CAMO'], names
nv = unpack(vvd, 'i', 16)[0]
nfix, fixoff, vertoff = unpack(vvd, '3i', 48)
vertices = [unpack(vvd, '3f4B8f', vertoff + i * 48) for i in range(nv)]
if nfix:
    remapped = []
    for i in range(nfix):
        _, start, count = unpack(vvd, '3i', fixoff + i * 12)
        remapped.extend(vertices[start:start + count])
    vertices = remapped

bodyoff = unpack(mdl, '2i', 232)[1]
vbodyoff = unpack(vtx, '2i', 28)[1]
_, modelcount, _, modeloff = unpack(mdl, '4i', bodyoff)
_, vmodeloff = unpack(vtx, '2i', vbodyoff)
assert modelcount == 1
model = bodyoff + modeloff
vmodel = vbodyoff + vmodeloff
meshcount, meshoff, _, vertexbase = unpack(mdl, '4i', model + 72)
lodcount, vlodoff = unpack(vtx, '2i', vmodel)
vlod = vmodel + vlodoff
vlodmeshcount, vmeshoff = unpack(vtx, '2i', vlod)
assert lodcount >= 1 and meshcount == vlodmeshcount == 1

mesh = model + meshoff
material, _, _, offset = unpack(mdl, '4i', mesh)
assert material == 0
vmesh = vlod + vmeshoff
stripgroups, stripoff = unpack(vtx, '2i', vmesh)
triangles = []
for g in range(stripgroups):
    group = vmesh + stripoff + g * 25
    vcount, vo, icount, indexoff, nstrips, so = unpack(vtx, '6i', group)
    refs = [unpack(vtx, 'H', group + vo + j * 9 + 4)[0] + offset + vertexbase // 48
            for j in range(vcount)]
    indices = unpack(vtx, str(icount) + 'H', group + indexoff)
    for s in range(nstrips):
        strip = group + so + s * 27
        count, start = unpack(vtx, '2i', strip)
        flags = vtx[strip + 18]
        ids = [refs[j] for j in indices[start:start + count]]
        if flags & 1:
            triangles.extend(ids)
        else:
            for j in range(len(ids) - 2):
                triangles.extend((ids[j + j % 2], ids[j + 1 - j % 2], ids[j + 2]))
assert len(triangles) % 3 == 0 and all(0 <= i < len(vertices) for i in triangles)
triangles = [triangles[i + j] for i in range(0, len(triangles), 3) for j in (0, 2, 1)]
vals = np.array([vertices[i][7:15] for i in triangles], dtype='<f4')
pos = vals[:, :3].copy()
normal = vals[:, 3:6].copy()
pos[:] = pos[:, [0, 2, 1]] * [1, 1, -1]
normal[:] = normal[:, [0, 2, 1]] * [1, 1, -1]
uv = vals[:, 6:8].copy()
uv[:, 1] = 1 - uv[:, 1]

texture = io.BytesIO()
vtf(ROOT / 'Choose Texture/Original/materials/models/weapons/v_models/cf_deagle/PV-DEAGLE-CAMO.vtf') \
    .convert('RGB').save(texture, format='PNG', optimize=True)
binary = bytearray()
views = []
accessors = []


def view(data):
    while len(binary) % 4:
        binary.append(0)
    idx = len(views)
    views.append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(data)})
    binary.extend(data)
    return idx


def accessor(arr, kind, bounds=False):
    arr = np.asarray(arr, dtype='<f4')
    entry = {'bufferView': view(arr.tobytes()), 'componentType': 5126,
             'count': len(arr), 'type': kind}
    if bounds:
        entry.update(min=arr.min(axis=0).tolist(), max=arr.max(axis=0).tolist())
    accessors.append(entry)
    return len(accessors) - 1


texview = view(texture.getvalue())
attrs = {'POSITION': accessor(pos, 'VEC3', True),
         'NORMAL': accessor(normal, 'VEC3'),
         'TEXCOORD_0': accessor(uv, 'VEC2')}
while len(binary) % 4:
    binary.append(0)
doc = {
    'asset': {'version': '2.0', 'generator': 'CF Deagle Source MDL conversion'},
    'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0}],
    'meshes': [{'name': 'CF_Desert_Eagle', 'primitives': [{'attributes': attrs, 'material': 0}]}],
    'buffers': [{'byteLength': len(binary)}], 'bufferViews': views,
    'accessors': accessors, 'images': [{'bufferView': texview, 'mimeType': 'image/png'}],
    'textures': [{'source': 0, 'sampler': 0}],
    'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}],
    'materials': [{'name': names[0], 'pbrMetallicRoughness': {
        'baseColorTexture': {'index': 0}, 'metallicFactor': .28, 'roughnessFactor': .57}}],
}
j = json.dumps(doc, separators=(',', ':')).encode()
j += b' ' * (-len(j) % 4)
(OUT / 'desert_eagle.glb').write_bytes(
    struct.pack('<4sII', b'glTF', 2, 28 + len(j) + len(binary))
    + struct.pack('<I4s', len(j), b'JSON') + j
    + struct.pack('<I4s', len(binary), b'BIN\0') + binary)

audio = PROJECT / 'audio/classic'
audio.mkdir(exist_ok=True)
for src, dst in [('deagle-1.WAV', 'deagle_fire.wav'),
                 ('de_clipout.WAV', 'deagle_clipout.wav'),
                 ('de_clipin.WAV', 'deagle_clipin.wav'),
                 ('de_deploy.WAV', 'deagle_deploy.wav')]:
    shutil.copyfile(ROOT / 'Required/sound/weapons/deagle' / src, audio / dst)
print('Desert Eagle:', len(triangles) // 3, 'triangles;',
      (OUT / 'desert_eagle.glb').stat().st_size, 'GLB bytes; 4 WAV sounds')
