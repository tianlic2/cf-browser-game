// Clone a skinned GLTF hierarchy while rebinding each mesh to the cloned bones.
// Object3D.clone(true) alone keeps Skeleton.bones pointed at the source rig.
export function cloneSkinned(source) {
  const clone = source.clone(true);
  const sourceNodes = [], cloneNodes = [];
  source.traverse(node => sourceNodes.push(node));
  clone.traverse(node => cloneNodes.push(node));
  const counterparts = new Map(sourceNodes.map((node, i) => [node, cloneNodes[i]]));
  for (const node of sourceNodes) {
    if (!node.isSkinnedMesh) continue;
    const copy = counterparts.get(node);
    const bones = node.skeleton.bones.map(bone => counterparts.get(bone));
    if (bones.some(bone => !bone)) throw new Error('生化幽灵骨骼复制失败');
    const skeleton = node.skeleton.clone();
    skeleton.bones = bones;
    copy.bind(skeleton, node.bindMatrix.clone());
  }
  return clone;
}
