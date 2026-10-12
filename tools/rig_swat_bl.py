"""Attach the user-supplied static SWAT BL GLB to the game's animated SWAT rig.

Usage: python3 tools/rig_swat_bl.py /path/to/swat_bl.glb
Requires NumPy and SciPy. The original GLB is copied unchanged; this script
only derives compact skin weights by proximity to the existing CF SWAT skin.
"""
import json
import shutil
import struct
import sys
from pathlib import Path

import numpy as np
from scipy.spatial import cKDTree


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(sys.argv[1])
TARGET = ROOT / "models/swat_bl.glb"
WEIGHTS = ROOT / "assets/classic/swat/swat_bl_weights.bin"
SCALE = 0.00957
FLOOR = 109.597


def read_glb(path):
    raw = path.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", raw)
    if (magic, version, length) != (b"glTF", 2, len(raw)):
        raise ValueError("Expected an intact glTF 2.0 binary file")
    json_size, json_type = struct.unpack_from("<I4s", raw, 12)
    if json_type != b"JSON":
        raise ValueError("Missing GLB JSON chunk")
    document = json.loads(raw[20:20 + json_size])
    offset = 20 + json_size
    bin_size, bin_type = struct.unpack_from("<I4s", raw, offset)
    if bin_type != b"BIN\0":
        raise ValueError("Missing GLB binary chunk")
    return document, raw[offset + 8:offset + 8 + bin_size]


def accessor(document, binary, index):
    item = document["accessors"][index]
    view = document["bufferViews"][item["bufferView"]]
    if item["componentType"] != 5126 or item["type"] != "VEC3":
        raise ValueError("Expected float32 VEC3 positions")
    stride = view.get("byteStride", 12)
    offset = view.get("byteOffset", 0) + item.get("byteOffset", 0)
    return np.ndarray((item["count"], 3), dtype="<f4", buffer=binary,
                      offset=offset, strides=(stride, 4)).copy()


def limb_components(document, binary, primitive, points):
    """Identify disconnected sleeves and gloves in the static source mesh."""
    item = document["accessors"][primitive["indices"]]
    view = document["bufferViews"][item["bufferView"]]
    dtype = {5123: "<u2", 5125: "<u4"}[item["componentType"]]
    offset = view.get("byteOffset", 0) + item.get("byteOffset", 0)
    triangles = np.frombuffer(binary, dtype=dtype, count=item["count"],
                              offset=offset).reshape((-1, 3))
    parent = np.arange(len(points))

    def find(v):
        while parent[v] != v:
            parent[v] = parent[parent[v]]
            v = parent[v]
        return v

    for a, b, c in triangles:
        root = find(int(a))
        parent[find(int(b))] = root
        parent[find(int(c))] = root
    islands = {}
    for vertex in range(len(points)):
        islands.setdefault(find(vertex), []).append(vertex)
    hands = np.zeros(len(points), dtype=np.uint8)
    arms = np.zeros(len(points), dtype=np.uint8)
    for ids in islands.values():
        patch = points[ids]
        if len(ids) >= 80 and np.min(np.abs(patch[:, 0])) > 44 and patch[:, 2].max() < 25:
            # Source +X becomes game -X after correcting its 180° facing.
            hands[ids] = 31 if patch[:, 0].mean() > 0 else 18
        elif len(ids) >= 140 and patch[:, 0].max() < -19 and patch[:, 2].min() > 10 and patch[:, 2].max() > 55:
            arms[ids] = 1  # left sleeve: upper arm through wrist
        elif 80 <= len(ids) <= 100 and patch[:, 0].min() > 19 and patch[:, 2].min() > 25 and patch[:, 2].max() > 55:
            arms[ids] = 2  # right upper sleeve
        elif 60 <= len(ids) <= 80 and patch[:, 0].min() > 32 and patch[:, 2].min() > 10 and patch[:, 2].max() < 45:
            arms[ids] = 3  # right lower sleeve
    if sorted(np.unique(hands[hands > 0]).tolist()) != [18, 31]:
        raise ValueError("Could not identify both separated glove islands")
    if sorted(np.unique(arms[arms > 0]).tolist()) != [1, 2, 3]:
        raise ValueError("Could not identify the three sleeve islands")
    return hands, arms


def old_skin():
    meta = json.loads((ROOT / "assets/classic/swat/swat.json").read_text())
    binary = (ROOT / "assets/classic/swat/swat.bin").read_bytes()
    positions, indices, weights = [], [], []
    for part in meta["parts"]:
        values = np.frombuffer(binary, dtype="<f4", count=part["count"] * 16,
                               offset=part["offset"]).reshape((-1, 16))
        p = values[:, :3]
        positions.append(np.stack((p[:, 0], p[:, 2], -p[:, 1]), axis=1) * .0254)
        indices.append(values[:, 8:12].astype(np.uint8))
        weights.append(values[:, 12:16])
    return np.concatenate(positions), np.concatenate(indices), np.concatenate(weights)


def main():
    document, binary = read_glb(SOURCE)
    meshes = document.get("meshes", [])
    if len(meshes) != 4 or document.get("skins") or document.get("animations"):
        raise ValueError("Expected the four-part static SWAT BL reference GLB")
    reference_pos, reference_joints, reference_weights = old_skin()
    tree = cKDTree(reference_pos)
    output = bytearray()
    for mesh_id, mesh in enumerate(meshes):
        primitive, = mesh["primitives"]
        p = accessor(document, binary, primitive["attributes"]["POSITION"])
        hand_bones,arm_regions = limb_components(document, binary, primitive, p) if mesh_id == 3 else (np.zeros(len(p), dtype=np.uint8),np.zeros(len(p), dtype=np.uint8))
        # The GLB's scene root turns source Z-up into Three's Y-up. Its floor
        # is at -109.597 cm; match the existing ~1.96 m animated soldier.
        # The imported mesh faces the opposite way from the game's +Z rifle.
        # Rotate it 180° before matching the existing skeleton's left/right.
        world = np.stack((-p[:, 0], p[:, 2] + FLOOR, p[:, 1]), axis=1) * SCALE
        nearest_distance, nearest = tree.query(world, k=6)
        neighbour_weight = 1 / (nearest_distance ** 2 + .0025)
        neighbour_weight /= neighbour_weight.sum(axis=1, keepdims=True)
        for vertex in range(len(p)):
            if mesh_id in (0, 1):
                # Face and helmet must stay rigidly attached to the head; this
                # also makes the detached helmet agree with the head hitbox.
                joints = [14, 0, 0, 0]
                values = [255, 0, 0, 0]
            elif hand_bones[vertex]:
                # Spatial nearest-neighbour alone mistakes the lower-pose
                # gloves for forearms. The disconnected glove islands must
                # follow the hand bones to remain attached to the gun grips.
                joints = [int(hand_bones[vertex]), 0, 0, 0]
                values = [255, 0, 0, 0]
            elif arm_regions[vertex]:
                reach = abs(float(p[vertex, 0]))
                region = arm_regions[vertex]
                if region == 1:
                    if reach < 37:
                        a,b,t = 16,17,np.clip((reach-26)/11,0,1)
                    else:
                        a,b,t = 17,18,np.clip((reach-44)/10,0,1)
                elif region == 2:
                    a,b,t = 29,30,np.clip((reach-27)/12,0,1)
                else:
                    a,b,t = 30,31,np.clip((reach-46)/8,0,1)
                v = int(round(255*t))
                joints = [a,b,0,0]
                values = [255-v,v,0,0]
            else:
                blend = np.zeros(50)
                for slot, old_index in enumerate(nearest[vertex]):
                    for influence in range(4):
                        bone = int(reference_joints[old_index, influence])
                        blend[bone] += neighbour_weight[vertex, slot] * reference_weights[old_index, influence]
                chosen = np.argsort(blend)[-4:][::-1]
                strengths = blend[chosen]
                strengths /= strengths.sum()
                values = np.rint(strengths * 255).astype(np.int32)
                values[0] += 255 - int(values.sum())
                joints = chosen.tolist()
            output.extend(bytes(joints))
            output.extend(bytes(values.tolist() if isinstance(values, np.ndarray) else values))
        print(f"mesh {mesh_id}: {len(p)} vertices, median match {np.median(nearest_distance[:, 0]):.3f} m")
    shutil.copyfile(SOURCE, TARGET)
    WEIGHTS.write_bytes(output)
    print(f"wrote {TARGET} and {WEIGHTS} ({len(output)} weight bytes)")


if __name__ == "__main__":
    main()
