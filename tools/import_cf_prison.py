"""Convert the community Source BSP port of CF Prison to browser assets.

Usage: python3 tools/import_cf_prison.py /path/to/cf_prison_fixed
Only reads BSP/VMT/VTF data; no Source binaries are executed. See
assets/classic/CREDITS.md for provenance and redistribution notes.
"""
import json
import math
import re
import struct
import sys
from collections import defaultdict
from itertools import combinations
from pathlib import Path

import numpy as np
from PIL import Image

from import_cf_source import materials, unpack, string

ROOT = Path(sys.argv[1])
OUT = Path(__file__).resolve().parents[1] / 'assets/classic'
DST = OUT / 'prison'
DST.mkdir(parents=True, exist_ok=True)
b = (ROOT / 'maps/cf_prison.bsp').read_bytes()
assert unpack(b, '4si') == (b'VBSP', 20)
lumps = [unpack(b, '4i', 8 + i * 16) for i in range(64)]


def lump(i):
    p, n, *_ = lumps[i]
    return b[p:p + n]


def rows(i, fmt):
    return list(struct.iter_unpack('<' + fmt, lump(i)))


entities = [dict(re.findall(r'"([^"\n]+)"\s*"([^"\n]*)"', x))
            for x in re.findall(r'\{(.*?)\}', lump(0).decode(errors='replace'), re.S)]
planes = rows(1, '4fi')
verts = np.array(rows(3, '3f'))
edges = rows(12, '2H')
surfedges = [r[0] for r in rows(13, 'i')]
texinfo = rows(6, '16f2i')
texdata = rows(2, '3f5i')
stringtable = rows(44, 'i')
names = [string(lump(43), stringtable[r[3]][0]).lower() for r in texdata]
world = rows(14, '9f3i')[0]
faces = rows(7, 'HBBihhhh4Bif4iiHHI')[world[10]:world[10] + world[11]]

# Align the two spawn banks along world Z, as on the transport ship. Source X
# is the long axis; the cyclic Y,Z,X axis mapping keeps right-handed winding.
center = np.array([-2532.0, 162.0, 0.0])
scale = .0254


def point(v):
    q = (np.asarray(v) - center) * scale
    return [float(q[1]), float(q[2]), float(q[0])]


atlas = Image.new('RGB', (2048, 2048), (255, 255, 255))
ax = ay = 1
rowh = 0
groups = defaultdict(list)
visible = []
light = lump(8)

for f in faces:
    _, _, _, first, n, tex, *_ = f
    if tex < 0 or n < 3:
        continue
    t = texinfo[tex]
    name = names[t[17]]
    if name.startswith(('tools/', 'dev/')) or t[16] & 0x6:
        continue
    ps = [verts[edges[abs(surfedges[first + j])][0 if surfedges[first + j] >= 0 else 1]]
          for j in range(n)]
    tw = max(1, texdata[t[17]][4])
    th = max(1, texdata[t[17]][5])
    uv = [[(np.dot(v, t[:3]) + t[3]) / tw,
           1 - (np.dot(v, t[4:7]) + t[7]) / th] for v in ps]
    ofs, lmmin = f[12], f[14:16]
    lw, lh = [x + 1 for x in f[16:18]]
    luv = [[0, 0]] * n
    if ofs >= 0 and 0 < lw < 1024 and 0 < lh < 1024:
        if ax + lw + 2 > 2048:
            ax = 1
            ay += rowh + 2
            rowh = 0
        assert ay + lh + 2 <= 2048, 'Prison lightmap atlas needs expansion'
        raw = np.frombuffer(light, dtype=np.uint8, count=lw * lh * 4, offset=ofs).reshape(lh, lw, 4)
        exp = raw[:, :, 3].astype(np.int16)
        exp[exp > 127] -= 256
        linear = np.clip(raw[:, :, :3].astype(float) * np.exp2(exp[:, :, None]) / 255 * 2, 0, 1)
        srgb = np.where(linear <= .0031308, linear * 12.92, 1.055 * linear ** (1 / 2.4) - .055)
        tile = Image.fromarray((srgb * 255).astype(np.uint8))
        atlas.paste(tile, (ax, ay))
        atlas.paste(tile.crop((0, 0, lw, 1)), (ax, ay - 1))
        atlas.paste(tile.crop((0, lh - 1, lw, lh)), (ax, ay + lh))
        atlas.paste(tile.crop((0, 0, 1, lh)), (ax - 1, ay))
        atlas.paste(tile.crop((lw - 1, 0, lw, lh)), (ax + lw, ay))
        luv = [[(ax + .5 + np.dot(v, t[8:11]) + t[11] - lmmin[0]) / 2048,
                1 - (ay + .5 + np.dot(v, t[12:15]) + t[15] - lmmin[1]) / 2048] for v in ps]
        ax += lw + 2
        rowh = max(rowh, lh)
    for j in range(1, n - 1):
        for k in (0, j, j + 1):
            groups[name].extend(point(ps[k]) + uv[k] + luv[k])
    visible.append((name, [point(p) for p in ps]))

atlas.save(DST / 'lightmap.png', optimize=True)
mats = materials(ROOT, list(groups), DST)
for mat in mats:
    if mat.get('map'):
        continue
    # The port references a few stock CS:S materials that are not in its
    # archive. Provide small neutral replacements rather than flat gray faces
    # or external Source-game dependencies.
    name = mat['name']
    seed = sum((i + 1) * ord(c) for i, c in enumerate(name))
    rng = np.random.default_rng(seed)
    h = w = 256
    noise = rng.normal(0, 8, (h, w, 1))
    if 'concrete' in name or 'marketwall' in name:
        base = np.array([118, 113, 102] if 'floor' in name else [148, 139, 122])
        image = np.clip(base + noise, 0, 255).astype(np.uint8)
        image[::64, :, :] = np.clip(image[::64, :, :].astype(int) - 26, 0, 255)
        image[:, ::64, :] = np.clip(image[:, ::64, :].astype(int) - 20, 0, 255)
    elif 'glass' in name or 'offwnd' in name:
        base = np.array([98, 122, 135])
        image = np.clip(base + noise * .35, 0, 255).astype(np.uint8)
        for k in (3, 252):
            image[k:k + 2] = [38, 46, 49]
            image[:, k:k + 2] = [38, 46, 49]
        mat['opacity'] = .37
    else:
        base = np.array([71, 75, 76]) if 'metal' in name else np.array([43, 48, 50])
        image = np.clip(base + noise * .45, 0, 255).astype(np.uint8)
        if 'pipe' in name or 'rail' in name:
            image[::12, :, :] = np.clip(image[::12, :, :].astype(int) + 12, 0, 255)
    dest = DST / ('fallback_' + re.sub(r'[^a-z0-9_-]', '_', name) + '.png')
    Image.fromarray(image).save(dest, optimize=True)
    mat['map'] = str(dest.relative_to(OUT))
binary = bytearray()
parts = []
for mat, values in zip(mats, groups.values()):
    parts.append({'material': mat, 'offset': len(binary), 'count': len(values) // 7})
    binary.extend(np.asarray(values, dtype='<f4').tobytes())
(DST / 'map.bin').write_bytes(binary)

brushsides = rows(19, 'Hhhh')
colliders = []
for first, n, contents in rows(18, '3i'):
    if not contents & (1 | 2 | 0x10000):
        continue
    ps = np.array([planes[brushsides[first + j][0]][:4] for j in range(n)])
    corners = []
    for ids in combinations(range(n), 3):
        a = ps[list(ids), :3]
        if abs(np.linalg.det(a)) < 1e-5:
            continue
        v = np.linalg.solve(a, ps[list(ids), 3])
        if np.all(ps[:, :3] @ v <= ps[:, 3] + .02):
            corners.append(v)
    if not corners:
        continue
    worldpts = np.array([point(v) for v in corners])
    lo, hi = worldpts.min(0), worldpts.max(0)
    if hi[1] < -2.5 or lo[1] > 15 or max(abs(lo[0]), abs(hi[0])) > 29 or max(abs(lo[2]), abs(hi[2])) > 30:
        continue
    texture_names = sorted({names[texinfo[brushsides[first + j][1]][17]]
                            for j in range(n) if brushsides[first + j][1] >= 0})
    if texture_names and all('skybox' in t for t in texture_names):
        continue
    pw = [[float(p[1]), float(p[2]), float(p[0]),
           float((p[3] - np.dot(p[:3], center)) * scale)] for p in ps]
    colliders.append({'x': float((lo[0] + hi[0]) / 2), 'z': float((lo[2] + hi[2]) / 2),
                      'hx': float((hi[0] - lo[0]) / 2), 'hz': float((hi[2] - lo[2]) / 2),
                      'h': float(hi[1]), 'y0': float(lo[1]), 'planes': pw,
                      'textures': texture_names})

spawns = {team: [point(list(map(float, e['origin'].split()))) for e in entities
                 if e.get('classname') == cls]
          for team, cls in [('player', 'info_player_counterterrorist'),
                            ('enemy', 'info_player_terrorist')]}
for team in spawns.values():
    for p in team:
        p[1] = 0.0

topdown = []
for name, pts in visible:
    p = np.array(pts)
    lo, hi = p.min(0), p.max(0)
    if hi[1] - lo[1] > .015 or not -.05 < hi[1] < 6 or hi[0] - lo[0] < .3 or hi[2] - lo[2] < .3:
        continue
    topdown.append({'x': float((lo[0] + hi[0]) / 2), 'z': float((lo[2] + hi[2]) / 2),
                    'hx': float((hi[0] - lo[0]) / 2), 'hz': float((hi[2] - lo[2]) / 2),
                    'kind': 'container', 'y0': float(hi[1])})

(DST / 'map.json').write_text(json.dumps({
    'parts': parts, 'colliders': colliders, 'spawns': spawns, 'topdown': topdown,
    'bounds': {'hw': 26, 'hl': 29}, 'floorY': 0,
}, separators=(',', ':')), encoding='utf8')
print('Prison:', len(parts), 'materials,', len(binary) // 84, 'triangles,',
      len(colliders), 'brushes,', len(topdown), 'radar surfaces')
