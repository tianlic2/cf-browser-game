"""Install only the user-approved BaiHu locally; never install the other candidates.

The view/PNG/WAV payloads are copied unchanged from the reviewed preview. The
separate authored w_galil.mdl supplies the low-poly, arm-free world/drop model.
No archive code is executed and no public redistribution rights are implied.
"""
import hashlib
import json
from pathlib import Path
import shutil
import struct

from import_gamebanana_weapon import png


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/preview/gamebanana-weapons'
DEST = ROOT / 'assets/local/scar_light'


def world_glb(source, output):
    b = source.read_bytes()
    def get(fmt, at): return struct.unpack_from('<' + fmt, b, at)
    assert b[:4] == b'IDST' and get('i', 4)[0] == 10
    assert get('i', 140)[0] == 1, 'Only this authored one-bone world model is supported'
    nt, to = get('2i', 180)
    assert nt == 1
    name, flags, w, h, pixels = get('64s4i', to)
    texture = png(w, h, b[pixels:pixels+w*h], b[pixels+w*h:pixels+w*h+768], flags & 64)
    skin_at = get('i', 200)[0]
    np, po = get('2i', 204)
    assert np == 1
    _, count, _, model = get('64s3i', po)
    assert count == 1
    r = get('64sif10i', model)
    meshes, mesh_at, nv, vi, vertices, nn, ni, normals = r[3:11]
    assert not any(b[vi:vi+nv]) and not any(b[ni:ni+nn])
    # The single root bone only places the dropped gun on its side. Export its
    # local mesh upright for the shared catalog (local Y barrel -> game -Z,
    # local Z height -> game Y). The drop system owns its final floor pose.
    def axis(v): return (v[0], v[2], -v[1])
    positions = [axis(get('3f', vertices+i*12)) for i in range(nv)]
    norms = [axis(get('3f', normals+i*12)) for i in range(nn)]
    rows = []
    for mi in range(meshes):
        _, at, skin, _, _ = get('5i', mesh_at+mi*20)
        assert get('H', skin_at+skin*2)[0] == 0
        while True:
            n = get('h', at)[0]; at += 2
            if not n: break
            records = [get('4h', at+i*8) for i in range(abs(n))]; at += abs(n)*8
            for i in range(2, len(records)):
                tri = ([records[i-2], records[i-1], records[i]] if i % 2 == 0 else
                       [records[i-1], records[i-2], records[i]]) if n > 0 else [records[0], records[i-1], records[i]]
                a, c, d = [positions[v[0]] for v in tri]
                u = [c[k]-a[k] for k in range(3)]; v = [d[k]-a[k] for k in range(3)]
                cross = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
                if sum(cross[k]*norms[tri[0][1]][k] for k in range(3)) < 0: tri[1], tri[2] = tri[2], tri[1]
                for vi_, ni_, s, t in tri: rows.append((*positions[vi_], *norms[ni_], s/w, t/h))
    lo = [min(v[k] for v in rows) for k in range(3)]
    hi = [max(v[k] for v in rows) for k in range(3)]
    center = [(lo[k]+hi[k])/2 for k in range(3)]
    scale = .82 / (hi[2]-lo[2])
    doc = {'asset': {'version': '2.0', 'generator': 'Local BaiHu authored world-model import'},
           'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0, 'name': 'scar-light-baihu-world'}],
           'meshes': [{'primitives': []}], 'buffers': [], 'bufferViews': [], 'accessors': [],
           'materials': [{'name': name.split(b'\0')[0].decode(), 'pbrMetallicRoughness': {
               'baseColorTexture': {'index': 0}, 'metallicFactor': .04, 'roughnessFactor': .85}}],
           'textures': [{'source': 0, 'sampler': 0}], 'samplers': [{'wrapS': 10497, 'wrapT': 10497}], 'images': []}
    binary = bytearray()
    def view(blob):
        binary.extend(b'\0' * (-len(binary) % 4))
        i = len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(blob)})
        binary.extend(blob); return i
    doc['images'].append({'bufferView': view(texture), 'mimeType': 'image/png'})
    attrs = {}
    for key, column, size in [('POSITION', 0, 3), ('NORMAL', 3, 3), ('TEXCOORD_0', 6, 2)]:
        vals = [(v[k]-center[k])*scale if key == 'POSITION' else v[k] for v in rows for k in range(column, column+size)]
        a = {'bufferView': view(struct.pack('<' + str(len(vals)) + 'f', *vals)), 'componentType': 5126,
             'count': len(rows), 'type': 'VEC2' if size == 2 else 'VEC3'}
        if key == 'POSITION': a.update(min=[(lo[k]-center[k])*scale for k in range(3)], max=[(hi[k]-center[k])*scale for k in range(3)])
        attrs[key] = len(doc['accessors']); doc['accessors'].append(a)
    doc['meshes'][0]['primitives'].append({'attributes': attrs, 'material': 0, 'mode': 4})
    binary.extend(b'\0' * (-len(binary) % 4)); doc['buffers'].append({'byteLength': len(binary)})
    j = json.dumps(doc, separators=(',', ':')).encode(); j += b' ' * (-len(j) % 4)
    output.write_bytes(struct.pack('<4sII', b'glTF', 2, 28+len(j)+len(binary)) +
                       struct.pack('<I4s', len(j), b'JSON') + j + struct.pack('<I4s', len(binary), b'BIN\0') + binary)
    return {'source': str(source.relative_to(ROOT)), 'sha256': hashlib.sha256(b).hexdigest(),
            'triangles': len(rows)//3, 'length': .82}


def main():
    candidate = SOURCE / 'scar-light'
    d = json.loads((candidate/'view.json').read_text())
    assert d['uvConvention'] == 'classic-smd-v' and all(d['candidate']['checks'].values())
    assert hashlib.sha256((SOURCE/'sources/scar/GR-Hands/v_galil.mdl').read_bytes()).hexdigest() == d['candidate']['sha256']
    DEST.mkdir(parents=True, exist_ok=True)
    files = {'view.json', 'view.bin', *(p['map'] for p in d['parts']), *d['fireSounds'],
             *(e['audio'] for events in d['events'].values() for e in events)}
    for name in sorted(files):
        target = DEST / name; target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(candidate/name, target)
    world = world_glb(SOURCE/'sources/scar/models/w_galil.mdl', DEST/'world.glb')
    manifest = {'id': 'scar', 'name': 'SCAR Light 白虎', 'scope': 'user-approved-local-gameplay-only',
                'source': 'https://gamebanana.com/mods/468236', 'authors': 'HLXX50 / Smilegate',
                'publicRedistributionApproved': False, 'world': world,
                'files': {f: hashlib.sha256((DEST/f).read_bytes()).hexdigest() for f in sorted(files)}}
    (DEST/'provenance.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    print(json.dumps({'installed': str(DEST), 'files': len(files), 'world': world}, ensure_ascii=False))


if __name__ == '__main__': main()
