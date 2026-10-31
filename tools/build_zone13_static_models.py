#!/usr/bin/env python3
"""Convert the seven Zone13 static Source models for the isolated local preview."""

import json
import re
import struct
from pathlib import Path

import numpy as np
from import_cf_source import vtf

ROOT = Path(__file__).resolve().parents[1]
PAK = ROOT / 'assets/local/cf_bio_candidates/zone13/pak'
OUT = ROOT / 'assets/local/cf_bio_candidates/zone13/graybox/static-models'
SCALE = .0254


def unpack(data, fmt, offset=0):
    return struct.unpack_from('<' + fmt, data, offset)


def cstring(data, offset):
    return data[offset:data.index(b'\0', offset)].decode(errors='replace')


def material_texture(mdl, index):
    count, table = unpack(mdl, '2i', 204)
    if index < 0 or index >= count:
        return None
    entry = table + index * 64
    name = cstring(mdl, entry + unpack(mdl, 'i', entry)[0]).lower()
    _, directories = unpack(mdl, '2i', 212)
    directory_count = unpack(mdl, 'i', 212)[0]
    candidates = []
    for i in range(directory_count):
        pointer = unpack(mdl, 'i', directories + i * 4)[0]
        directory = cstring(mdl, pointer).replace('\\', '/').strip('/').lower()
        candidates.append(PAK / 'materials' / directory / f'{name}.vmt')
    candidates.extend((PAK / 'materials').rglob(f'{name}.vmt'))
    vmt = next((path for path in candidates if path.exists()), None)
    if not vmt:
        return None
    text = vmt.read_text(errors='replace')
    match = re.search(r'"?\$basetexture"?\s+"?([^"\s]+)', text, re.I)
    source = PAK / 'materials' / f'{(match.group(1) if match else vmt.relative_to(PAK / "materials").with_suffix(""))}.vtf'
    return source if source.exists() else None


def convert(model_path):
    mdl_path = PAK / model_path
    stem = model_path.removeprefix('models/').removesuffix('.mdl').replace('/', '__')
    base = mdl_path.with_suffix('')
    mdl, vvd, vtx = mdl_path.read_bytes(), base.with_suffix('.vvd').read_bytes(), Path(str(base) + '.dx90.vtx').read_bytes()
    assert mdl[:4] == b'IDST' and unpack(mdl, 'i', 4)[0] in (44, 48, 49)
    checksum = unpack(mdl, 'i', 8)[0]
    assert checksum == unpack(vvd, 'i', 8)[0] == unpack(vtx, 'i', 16)[0]
    vertex_count = unpack(vvd, 'i', 16)[0]
    fixup_count, fixup_offset, vertex_offset = unpack(vvd, '3i', 48)
    vertices = [unpack(vvd, '3f4B8f', vertex_offset + i * 48) for i in range(vertex_count)]
    if fixup_count:
        fixed = []
        for i in range(fixup_count):
            lod, start, count = unpack(vvd, '3i', fixup_offset + i * 12)
            if lod == 0:
                fixed.extend(vertices[start:start + count])
        vertices = fixed
    body_count, body_offset = unpack(mdl, '2i', 232)
    vbody_count, vbody_offset = unpack(vtx, '2i', 28)
    assert body_count == vbody_count
    groups = {}
    for body_index in range(body_count):
        body = body_offset + body_index * 16
        _, model_count, _, model_relative = unpack(mdl, '4i', body)
        vbody = vbody_offset + body_index * 8
        _, vmodel_relative = unpack(vtx, '2i', vbody)
        for model_index in range(model_count):
            model = body + model_relative + model_index * 148
            mesh_count, mesh_relative, _, vertex_base = unpack(mdl, '4i', model + 72)
            vmodel = vbody + vmodel_relative + model_index * 8
            lod_count, lod_relative = unpack(vtx, '2i', vmodel)
            if not lod_count:
                continue
            lod = vmodel + lod_relative
            vmesh_count, vmesh_relative = unpack(vtx, '2i', lod)
            for mesh_index in range(min(mesh_count, vmesh_count)):
                mesh = model + mesh_relative + mesh_index * 116
                material, _, _, vertex_mesh_offset = unpack(mdl, '4i', mesh)
                vmesh = lod + vmesh_relative + mesh_index * 9
                strip_group_count, strip_group_relative = unpack(vtx, '2i', vmesh)
                indices = []
                for group_index in range(strip_group_count):
                    group = vmesh + strip_group_relative + group_index * 25
                    group_vertex_count, group_vertices, index_count, indices_offset, strip_count, strips_offset = unpack(vtx, '6i', group)
                    mapped = [unpack(vtx, 'H', group + group_vertices + i * 9 + 4)[0] + vertex_mesh_offset + vertex_base // 48 for i in range(group_vertex_count)]
                    raw_indices = unpack(vtx, f'{index_count}H', group + indices_offset)
                    for strip_index in range(strip_count):
                        strip = group + strips_offset + strip_index * 27
                        strip_indices, strip_start = unpack(vtx, '2i', strip)
                        flags = vtx[strip + 18]
                        sequence = [mapped[i] for i in raw_indices[strip_start:strip_start + strip_indices]]
                        if flags & 1:
                            for i in range(0, len(sequence) - 2, 3):
                                indices.extend((sequence[i], sequence[i + 2], sequence[i + 1]))
                        else:
                            for i in range(len(sequence) - 2):
                                triangle = (sequence[i + i % 2], sequence[i + 2], sequence[i + 1 - i % 2])
                                indices.extend(triangle)
                rows = groups.setdefault(material, [])
                for index in indices:
                    vertex = vertices[index]
                    position = vertex[7:10]
                    normal = vertex[10:13]
                    uv = vertex[13:15]
                    rows.extend((position[0] * SCALE, position[2] * SCALE, -position[1] * SCALE,
                                 normal[0], normal[2], -normal[1], uv[0], uv[1]))
    binary = bytearray()
    parts = []
    for material, values in groups.items():
        texture = material_texture(mdl, material)
        texture_name = None
        if texture:
            texture_name = f'{stem}__m{material}.png'
            image = vtf(texture)
            if max(image.size) > 1024:
                image.thumbnail((1024, 1024))
            image.save(OUT / texture_name, optimize=True)
        blob = np.asarray(values, dtype='<f4').tobytes()
        parts.append({'material': material, 'byteOffset': len(binary), 'byteLength': len(blob),
                      'vertexCount': len(values) // 8, 'texture': texture_name})
        binary.extend(blob)
    bin_name = f'{stem}.bin'
    (OUT / bin_name).write_bytes(binary)
    return {'model': model_path, 'binary': bin_name, 'parts': parts,
            'triangles': sum(part['vertexCount'] for part in parts) // 3}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((OUT.parent / 'zone13-graybox.json').read_text())
    models = sorted({item['model'] for item in manifest['staticProps']})
    converted = [convert(model) for model in models]
    payload = {'format': 'zone13-source-static-models-v1', 'status': 'preview-only',
               'models': converted, 'triangles': sum(item['triangles'] for item in converted)}
    (OUT / 'manifest.json').write_text(json.dumps(payload, separators=(',', ':')), encoding='utf8')
    print(json.dumps({'models': len(converted), 'triangles': payload['triangles'],
                      'textures': sum(bool(part['texture']) for item in converted for part in item['parts'])}, indent=2))


if __name__ == '__main__':
    main()
