"""Extract a compact, root-motion-free foot trajectory from Quaternius UAL1.

Usage: python3 tools/extract_npc_gait.py /path/to/UAL1_Standard.glb
The generated numbers are an animation profile, not the source character mesh.
"""
import json
import struct
import sys
from pathlib import Path

import numpy as np
from scipy.spatial.transform import Rotation, Slerp

raw = Path(sys.argv[1]).read_bytes()
json_size = struct.unpack_from('<I', raw, 12)[0]
doc = json.loads(raw[20:20 + json_size])
binary_start = 20 + json_size + 8
nodes = doc['nodes']
parents = {}
for i, node in enumerate(nodes):
    for child in node.get('children', []):
        parents[child] = i
names = {node.get('name'): i for i, node in enumerate(nodes)}


def accessor(index):
    item = doc['accessors'][index]
    view = doc['bufferViews'][item['bufferView']]
    components = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}[item['type']]
    if item['componentType'] != 5126:
        raise ValueError('Only float animation data is supported')
    offset = binary_start + view.get('byteOffset', 0) + item.get('byteOffset', 0)
    return np.frombuffer(raw, dtype='<f4', count=item['count'] * components,
                         offset=offset).reshape(item['count'], components)


animation = next(a for a in doc['animations'] if a['name'] == 'Jog_Fwd_Loop')
channels = {}
for channel in animation['channels']:
    sampler = animation['samplers'][channel['sampler']]
    channels[channel['target']['node'], channel['target']['path']] = (
        accessor(sampler['input'])[:, 0], accessor(sampler['output']))
duration = max(times[-1] for times, _ in channels.values())


def value(node, path, time):
    if (node, path) not in channels:
        defaults = {'translation': [0, 0, 0], 'rotation': [0, 0, 0, 1],
                    'scale': [1, 1, 1]}
        return np.asarray(nodes[node].get(path, defaults[path]), dtype=float)
    times, values = channels[node, path]
    if path == 'rotation':
        return Slerp(times, Rotation.from_quat(values))([time]).as_quat()[0]
    return np.asarray([np.interp(time, times, values[:, i])
                       for i in range(values.shape[1])])


def matrix(node, time, cache):
    if node in cache:
        return cache[node]
    transform = np.eye(4)
    transform[:3, :3] = Rotation.from_quat(value(node, 'rotation', time)).as_matrix()
    transform[:3, :3] *= value(node, 'scale', time)
    transform[:3, 3] = value(node, 'translation', time)
    if node in parents:
        transform = matrix(parents[node], time, cache) @ transform
    cache[node] = transform
    return transform


samples = []
for t in np.linspace(0, duration, 32, endpoint=False):
    cache = {}
    pelvis = matrix(names['pelvis'], t, cache)[:3, 3]
    feet = [matrix(names[name], t, cache)[:3, 3] - pelvis
            for name in ('foot_l', 'foot_r')]
    samples.append(feet)
samples = np.asarray(samples)
left = samples[:, 0]
forward = np.clip(left[:, 2] / np.max(np.abs(left[:, 2])), -1, 1)
lift = np.clip((left[:, 1] + .55) / .25, 0, 1)
profile = np.column_stack((forward, lift)).flatten()
output = Path(sys.argv[2] if len(sys.argv) > 2 else 'scripts/npc_gait.js')
output.write_text(
    '// Quaternius Universal Animation Library 1 Standard, Jog_Fwd_Loop; CC0.\n'
    '// Normalized foot travel/lift, sampled at 32 evenly spaced frames.\n'
    'export const NPC_GAIT = new Float32Array([\n  '
    + ', '.join(f'{number:.3f}' for number in profile)
    + '\n]);\n', encoding='utf8')
print(f'wrote {output} ({len(profile)//2} frames)')
