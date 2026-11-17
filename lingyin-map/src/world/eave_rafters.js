import * as THREE from 'three';

// Build each rafter about its own centre before placing it under the roof.
export function hallEaveRafters(width, depth, eaveHeight) {
  const rafters = [];
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const frontCount = Math.round((width + 2) / 0.6);
  for (let i = 0; i <= frontCount; i++) {
    const x = -halfWidth - 0.8 + ((width + 1.6) * i) / frontCount;
    for (const side of [-1, 1]) {
      const g = new THREE.BoxGeometry(0.1, 0.12, 1.2);
      g.rotateX(0.12 * side);
      g.translate(x, eaveHeight + 0.02, side * (halfDepth + 0.3));
      rafters.push(g);
    }
  }
  const sideCount = Math.round((depth + 2) / 0.6);
  for (let i = 0; i <= sideCount; i++) {
    const z = -halfDepth - 0.8 + ((depth + 1.6) * i) / sideCount;
    for (const side of [-1, 1]) {
      const g = new THREE.BoxGeometry(1.2, 0.12, 0.1);
      g.rotateZ(-0.12 * side);
      g.translate(side * (halfWidth + 0.3), eaveHeight + 0.02, z);
      rafters.push(g);
    }
  }
  return rafters;
}
