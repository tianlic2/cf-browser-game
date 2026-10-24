import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Small architectural parts with identical material/render state can share
// one draw call. Named/editor objects, transparent surfaces and animated
// objects retain their identity. Matrices are baked in parent-local space.
export function batchStaticSiblings(group: THREE.Group) {
  const buckets = new Map<string, THREE.Mesh[]>();
  for (const object of [...group.children]) {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || object.name ||
      Array.isArray(object.material) || object.material.transparent || !object.visible) continue;
    const geometry = object.geometry;
    if (geometry.morphAttributes.position || object.customDepthMaterial) continue;
    const attributes = Object.keys(geometry.attributes).sort().map(name =>
      `${name}:${geometry.attributes[name].itemSize}:${geometry.attributes[name].normalized}`).join(',');
    const key = `${object.material.uuid}:${object.castShadow}:${object.receiveShadow}:${object.renderOrder}:${attributes}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(object); buckets.set(key, bucket);
  }
  for (const objects of buckets.values()) {
    if (objects.length < 2) continue;
    const geometries = objects.map(object => {
      object.updateMatrix();
      const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
      geometry.applyMatrix4(object.matrix);
      return geometry;
    });
    const geometry = mergeGeometries(geometries, false);
    geometries.forEach(g => g.dispose());
    if (!geometry) continue;
    geometry.computeBoundingSphere();
    const first = objects[0];
    const material = first.material as THREE.Material;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `static-batch-${material.name || material.uuid}`;
    mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow;
    mesh.renderOrder = first.renderOrder;
    group.add(mesh);
    objects.forEach(object => group.remove(object));
  }
}
