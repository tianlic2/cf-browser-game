"""Install the two user-approved GameBanana candidates for local gameplay only."""
import hashlib
import json
from pathlib import Path
import shutil
import struct
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/preview/gamebanana-weapons'

WEAPONS = {
    'cheytac-m200': {
        'id': 'm200', 'name': 'CheyTac M200 Dominator Gaming Glory',
        'source': 'https://gamebanana.com/mods/620567',
        'authors': 'TenTails / Compete-King / Smilegate / Valve', 'length': 1.14,
    },
    'ak47-imperial-gold': {
        'id': 'akgold', 'name': 'AK47-Knife Transformers Imperial Gold',
        'source': 'https://gamebanana.com/mods/223752',
        'authors': 'Lycanth / Smilegate', 'length': .82,
    },
}


def static_world_glb(candidate, output, node_name, target_length):
    data = json.loads((candidate / 'view.json').read_text())
    raw = b''.join((candidate / name).read_bytes() for name in data.get('binaryParts', ['view.bin']))
    # ClassicView passes this array to Matrix4.set(), whose arguments are rows.
    transform = data.get('transform', [.01,0,0,0, 0,0,.01,0, 0,.01,0,0, 0,0,0,1])
    matrix = np.array(transform, dtype=float).reshape(4, 4)
    bones = data['bones']
    clip = data.get('clips', {}).get('idle_0')
    idle = struct.unpack_from('<' + str(len(bones) * 7) + 'f', raw, clip['offset']) if clip else None

    def pose_matrix(pose):
        x,y,z,w = pose[3:7]
        out = np.eye(4)
        out[:3,:3] = [[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
                      [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
                      [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]
        out[:3,3] = pose[:3]
        return out

    bind_world, idle_world = [], []
    for index, bone in enumerate(bones):
        parent = bone['parent']
        parent_bind = bind_world[parent] if parent >= 0 else np.eye(4)
        parent_idle = idle_world[parent] if parent >= 0 else np.eye(4)
        bind_world.append(parent_bind @ pose_matrix(bone['pose']))
        values = idle[index*7:index*7+7] if idle else bone['pose']
        idle_world.append(parent_idle @ pose_matrix(values))
    skin = [idle_world[i] @ np.linalg.inv(bind_world[i]) for i in range(len(bones))]
    parts = [p for p in data['parts'] if p['weapon'] and not p.get('additive')]
    assert parts
    doc = {'asset': {'version': '2.0', 'generator': 'Local approved GameBanana static world import'},
           'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0, 'name': node_name}],
           'meshes': [{'primitives': []}], 'buffers': [], 'bufferViews': [], 'accessors': [],
           'materials': [], 'textures': [], 'samplers': [{'wrapS': 10497, 'wrapT': 10497}], 'images': []}
    binary = bytearray()

    def view(blob):
        binary.extend(b'\0' * (-len(binary) % 4))
        index = len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(blob)})
        binary.extend(blob)
        return index

    positions = []
    prepared = []
    magazine_flags = []
    for part in parts:
        values = struct.unpack_from('<' + str(part['count'] * 16) + 'f', raw, part['offset'])
        rows = []
        for i in range(part['count']):
            row = values[i * 16:(i + 1) * 16]
            # Reload-only spare magazines live in the weapon mesh, but their
            # dummy bones are parked outside the gun in the idle sequence.
            bone_name = bones[int(row[8])]['name'].lower()
            reload_only = ('mag_dummy' in bone_name or 'mag02_dummy' in bone_name or
                (node_name.startswith('akgold') and bone_name in ('bone-box002', 'bone-mac03')))
            if node_name.startswith(('akgold', 'ironbeast')) and reload_only:
                continue
            skinned = sum((skin[int(row[8+j])] * row[12+j] for j in range(4) if row[12+j]), np.zeros((4,4)))
            if not np.any(skinned): skinned = np.eye(4)
            posed = matrix @ skinned
            source_pos = list(row[:3])
            if node_name.startswith('kn57') and bone_name.endswith('weapon_bone_clip'):
                # The world model's clip bone is offset from its parent in the
                # reference pose; restore the authored magazine attachment.
                source_pos[2] += bones[int(row[8])]['pose'][2]
            p = (posed @ np.array([*source_pos,1.]))[:3].tolist()
            n = (posed[:3,:3] @ np.array(row[3:6])).tolist()
            length = sum(v * v for v in n) ** .5 or 1
            n = [v / length for v in n]
            uv = [row[6], 1 - row[7]]
            positions.extend(p)
            rows.extend((*p, *n, *uv))
            magazine_flags.append((node_name.startswith('akgold') and bone_name == 'bone_mac2') or
                (node_name.startswith('ironbeast') and bone_name == 'box007'))
        assert len(rows) % 24 == 0, 'removing a reload-only bone must preserve complete triangles'
        prepared.append(({**part, 'count': len(rows)//8}, rows))
    # Reorient the baked long axis horizontally along -Z, matching the game's
    # rigid drop/preview convention while retaining the authored gun mesh.
    cloud = np.array(positions).reshape(-1,3)
    magazine_flags = np.array(magazine_flags, dtype=bool)
    body = cloud[~magazine_flags]
    _, vectors = np.linalg.eigh(np.cov(body.T))
    axis = vectors[:,-1]
    if axis[2] > 0 or (abs(axis[2]) < .1 and axis[0] > 0): axis = -axis
    yaw = np.arctan2(-axis[0], -axis[2])
    cy,sy=np.cos(yaw),np.sin(yaw)
    ry=np.array([[cy,0,sy],[0,1,0],[-sy,0,cy]])
    oriented=ry@axis
    pitch=np.arctan2(-oriented[1], -oriented[2])
    cx,sx=np.cos(pitch),np.sin(pitch)
    rx=np.array([[1,0,0],[0,cx,-sx],[0,sx,cx]])
    rotate=rx@ry
    rotated=np.einsum('ij,kj->ik',cloud,rotate)
    magazine_shift=0.
    if np.any(magazine_flags):
        mag=rotated[magazine_flags]; body=rotated[~magazine_flags]
        near=body[np.abs(body[:,2] - np.mean(mag[:,2])) < max(.03, np.ptp(body[:,2])*.09)]
        if len(near) < 20: near=body
        magazine_shift=np.mean(near[:,1]) - np.ptp(near[:,1])*.1 - np.max(mag[:,1])
    positions=[]
    vertex_index=0
    for part, rows in prepared:
        for i in range(part['count']):
            offset=i*8
            rows[offset:offset+3]=(rotate@rows[offset:offset+3]).tolist()
            if magazine_flags[vertex_index]: rows[offset+1] += magazine_shift
            rows[offset+3:offset+6]=(rotate@rows[offset+3:offset+6]).tolist()
            positions.extend(rows[offset:offset+3])
            vertex_index += 1
    lo = [min(positions[i] for i in range(k, len(positions), 3)) for k in range(3)]
    hi = [max(positions[i] for i in range(k, len(positions), 3)) for k in range(3)]
    center = [(lo[k] + hi[k]) / 2 for k in range(3)]
    scale = target_length / max(hi[k] - lo[k] for k in range(3))

    for part, rows in prepared:
        image = (candidate / part['map']).read_bytes()
        image_index = len(doc['images'])
        doc['images'].append({'bufferView': view(image), 'mimeType': 'image/png'})
        doc['textures'].append({'source': image_index, 'sampler': 0})
        material_index = len(doc['materials'])
        doc['materials'].append({'name': part['textureName'], 'pbrMetallicRoughness': {
            'baseColorTexture': {'index': image_index}, 'metallicFactor': .04, 'roughnessFactor': .85}})
        attrs = {}
        for name, column, size in [('POSITION', 0, 3), ('NORMAL', 3, 3), ('TEXCOORD_0', 6, 2)]:
            values = []
            for i in range(part['count']):
                row = rows[i * 8:(i + 1) * 8]
                for k in range(column, column + size):
                    values.append((row[k] - center[k]) * scale if name == 'POSITION' else row[k])
            blob = struct.pack('<' + str(len(values)) + 'f', *values)
            accessor = {'bufferView': view(blob), 'componentType': 5126,
                        'count': part['count'], 'type': 'VEC2' if size == 2 else 'VEC3'}
            if name == 'POSITION':
                accessor.update(min=[(lo[k] - center[k]) * scale for k in range(3)],
                                max=[(hi[k] - center[k]) * scale for k in range(3)])
            attrs[name] = len(doc['accessors'])
            doc['accessors'].append(accessor)
        doc['meshes'][0]['primitives'].append({'attributes': attrs, 'material': material_index, 'mode': 4})
    binary.extend(b'\0' * (-len(binary) % 4))
    doc['buffers'].append({'byteLength': len(binary)})
    encoded = json.dumps(doc, separators=(',', ':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    output.write_bytes(struct.pack('<4sII', b'glTF', 2, 28 + len(encoded) + len(binary)) +
                       struct.pack('<I4s', len(encoded), b'JSON') + encoded +
                       struct.pack('<I4s', len(binary), b'BIN\0') + binary)
    return {'triangles': sum(p['count'] for p, _ in prepared) // 3, 'length': target_length,
            'parts': len(parts)}


def main():
    report = []
    for candidate_name, meta in WEAPONS.items():
        candidate = SOURCE / candidate_name
        data = json.loads((candidate / 'view.json').read_text())
        assert data['uvConvention'] == 'classic-smd-v'
        assert all(data['candidate']['checks'].values()) and not data['candidate']['missingSounds']
        destination = ROOT / 'assets/local' / meta['id']
        destination.mkdir(parents=True, exist_ok=True)
        files = {'view.json', 'view.bin', *(p['map'] for p in data['parts']), *data['fireSounds'],
                 *(e['audio'] for events in data['events'].values() for e in events)}
        for name in sorted(files):
            target = destination / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(candidate / name, target)
        world = static_world_glb(candidate, destination / 'world.glb', meta['id'] + '-world', meta['length'])
        manifest = {**meta, 'scope': 'user-approved-local-gameplay-only',
                    'license': 'Restricted mod port: CC BY-NC-ND / original game rights; local non-commercial use only.',
                    'userApprovedAt': '2026-10-24',
                    'publicRedistributionApproved': False, 'world': world,
                    'sourceViewSha256': data['candidate']['sha256'],
                    'files': {name: hashlib.sha256((destination / name).read_bytes()).hexdigest()
                              for name in sorted(files)}}
        (destination / 'provenance.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
        report.append({'id': meta['id'], 'files': len(files), 'world': world})
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
