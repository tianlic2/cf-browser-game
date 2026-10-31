import * as THREE from 'three';

// Back faces of the same skinned geometry form a thin silhouette. Depth
// testing against the existing scene keeps the effect hidden behind walls.
const material = new THREE.MeshBasicMaterial({
  color: 0xffdf27, side: THREE.BackSide, depthTest: true, depthWrite: false,
  toneMapped: false,
});
const worldScale = new THREE.Vector3();
material.onBeforeCompile = shader => {
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    '#include <begin_vertex>\ntransformed += normalize(normal) * outlineWidth;',
  );
  shader.vertexShader = 'uniform float outlineWidth;\n' + shader.vertexShader;
  shader.uniforms.outlineWidth = { value: 1 };
  material.userData.shader = shader;
};
material.customProgramCacheKey = () => 'enemy-outline-normal-extrusion-v1';

export function addEnemyOutline(meshes) {
  const shells = [];
  for (const mesh of meshes) {
    if (!mesh.isSkinnedMesh || !mesh.parent) continue;
    const shell = new THREE.SkinnedMesh(mesh.geometry, material);
    shell.name = 'enemy-yellow-outline';
    shell.position.copy(mesh.position);
    shell.quaternion.copy(mesh.quaternion);
    shell.scale.copy(mesh.scale);
    shell.bind(mesh.skeleton, mesh.bindMatrix.clone());
    shell.bindMode = mesh.bindMode;
    shell.frustumCulled = false;
    shell.castShadow = false;
    shell.receiveShadow = false;
    shell.raycast = () => {};
    shell.renderOrder = 1;
    shell.onBeforeRender = () => {
      // FBX parts can have radically different local units. Keep thickness in
      // world space rather than assuming the exported vertices are metres.
      shell.getWorldScale(worldScale);
      const scale = Math.max(0.000001, (worldScale.x + worldScale.y + worldScale.z) / 3);
      if (material.userData.shader) material.userData.shader.uniforms.outlineWidth.value = .012 / scale;
    };
    mesh.parent.add(shell);
    shells.push(shell);
  }
  return shells;
}
