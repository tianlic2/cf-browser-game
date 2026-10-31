"""Inspect GoldSrc v10 candidate rigs without executing downloaded content.

Layout reference: ValveSoftware/halflife engine/studio.h. Source files stay in
the ignored local preview area; this report does not grant redistribution.
"""
import argparse
import json
import struct
from pathlib import Path


def inspect(path):
    data = path.read_bytes()
    def get(fmt, at):
        return struct.unpack_from('<' + fmt, data, at)
    def string(raw):
        return raw.split(b'\0', 1)[0].decode('utf-8', 'replace')
    if data[:4] != b'IDST' or get('i', 4)[0] != 10:
        raise ValueError('Expected GoldSrc v10 MDL')
    nb, bo = get('2i', 140)
    ns, so = get('2i', 164)
    nt, to = get('2i', 180)
    np, po = get('2i', 204)
    bones = [string(get('32s', bo + i * 112)[0]) for i in range(nb)]
    clips = []
    for i in range(ns):
        at = so + i * 176
        name = string(get('32s', at)[0])
        fps = get('f', at + 32)[0]
        ne, eo, nf = get('3i', at + 48)
        events = []
        for e in range(ne):
            frame, event, kind, option = get('3i64s', eo + e * 76)
            events.append({'frame': frame, 'id': event, 'option': string(option)})
        clips.append({'name': name, 'frames': nf, 'fps': round(fps, 4),
                      'seconds': round((nf - 1) / fps, 4) if fps else 0,
                      'events': events, 'group': get('i', at + 156)[0]})
    parts = []
    for i in range(np):
        name, count, base, models = get('64s3i', po + i * 76)
        parts.append({'name': string(name), 'models': count,
                      'vertices': [get('i', models + j * 112 + 80)[0]
                                   for j in range(count)]})
    return {'path': str(path), 'bones': nb, 'fingerBones': sum('finger' in n.lower() for n in bones),
            'controllers': get('i', 148)[0], 'clips': clips, 'bodyparts': parts,
            'textures': [string(get('64s', to + i * 80)[0]) for i in range(nt)]}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('paths', nargs='+', type=Path)
    args = parser.parse_args()
    for path in args.paths:
        targets = sorted(path.rglob('v_*.mdl')) if path.is_dir() else [path]
        for model in targets:
            try:
                print(json.dumps(inspect(model), ensure_ascii=False))
            except (ValueError, struct.error) as error:
                print(json.dumps({'path': str(model), 'error': str(error)}))
