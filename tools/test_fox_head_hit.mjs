import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import * as THREE from '../vendor/three/build/three.module.js';
import { FOX_HEAD_PLANE_OFFSET, FOX_HEAD_RADIUS,
  FOX_HEAD_CENTER_OFFSET_X, FOX_HEAD_CENTER_OFFSET_Z,
  isHeadshotIntersection } from '../scripts/head_hit.js';
import { FOX_MODEL_HEIGHT, FOX_MODEL_SCALE } from '../scripts/fox_dimensions.js';

register(new URL('./three_test_loader.mjs', import.meta.url), import.meta.url);
const { FBXLoader } = await import('../vendor/three/examples/jsm/loaders/FBXLoader.js');
THREE.TextureLoader.prototype.load = () => new THREE.Texture();
const bytes = fs.readFileSync(new URL('../assets/local/fox_npc/fox.fbx', import.meta.url));
const actor = new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset,
  bytes.byteOffset + bytes.byteLength), '');
const mesh = actor.getObjectByName('OMOH_GR_gm3');
const headBone = actor.getObjectByName('Bip01_Head');
assert.ok(mesh?.isSkinnedMesh && headBone, 'use the actual approved Fox model and head bone');
assert.equal(mesh.geometry.groups.length, 3, 'source body, face and hair material groups');
assert.equal(mesh.geometry.index, null, 'the source group ranges address triangle vertices');
const testMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
const mixer = new THREE.AnimationMixer(actor);
const idle = actor.animations.find(clip => clip.name.endsWith('|idle1'));
mixer.clipAction(idle).play();
mixer.update(0);
actor.updateMatrixWorld(true);
const bounds = new THREE.Box3().setFromObject(actor);
const scale = FOX_MODEL_HEIGHT / bounds.getSize(new THREE.Vector3()).y;
const headLocalUp = new THREE.Vector3(0, 1, 0).applyQuaternion(
  headBone.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize();
const holder = new THREE.Group();
holder.position.set(-bounds.getCenter(new THREE.Vector3()).x * scale,
  -bounds.min.y * scale, -bounds.getCenter(new THREE.Vector3()).z * scale);
holder.scale.setScalar(scale);
holder.add(actor);
const region = { bone: headBone, upLocal: headLocalUp, axisRoot: holder,
  headBoneIndex: mesh.skeleton.bones.indexOf(headBone) };
// Recreate the two visible, independently raycastable meshes used at runtime.
function split(groups, part) {
  const geometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(mesh.geometry.attributes))
    geometry.setAttribute(name, attribute);
  for (const [materialIndex, group] of groups.entries())
    geometry.addGroup(group.start, group.count, materialIndex);
  const copy = new THREE.SkinnedMesh(geometry, groups.map(() => testMaterial));
  copy.position.copy(mesh.position);
  copy.quaternion.copy(mesh.quaternion);
  copy.scale.copy(mesh.scale);
  copy.bind(mesh.skeleton, mesh.bindMatrix.clone());
  copy.bindMode = mesh.bindMode;
  copy.userData.part = part;
  copy.userData.headRegion = region;
  mesh.parent.add(copy);
  return copy;
}
const bodyMesh = split([mesh.geometry.groups[0]], 'body');
const headMesh = split(mesh.geometry.groups.slice(1), 'head');
mesh.parent.remove(mesh);
holder.updateMatrixWorld(true);
const ray = new THREE.Raycaster();
assert.equal(FOX_MODEL_SCALE, 1.05, 'the complete Fox model is uniformly enlarged by 5%');
assert.equal(FOX_MODEL_HEIGHT, 1.848, 'the approved 1.76m source presentation becomes 1.848m');
assert.equal(FOX_HEAD_PLANE_OFFSET, -.055 * FOX_MODEL_SCALE,
  'the approved plane offset grows with the visible model');
assert.equal(FOX_HEAD_RADIUS, .14 * FOX_MODEL_SCALE,
  'the approved anatomical radius grows with the visible model');
assert.equal(FOX_HEAD_CENTER_OFFSET_X, -.01 * FOX_MODEL_SCALE,
  'the cylinder local X offset grows with the visible model');
assert.equal(FOX_HEAD_CENTER_OFFSET_Z, .05 * FOX_MODEL_SCALE,
  'the cylinder local Z offset grows with the visible model');

function sourcePart(hit) {
  const vertex = hit.faceIndex * 3;
  const group = mesh.geometry.groups.findIndex(entry =>
    vertex >= entry.start && vertex < entry.start + entry.count);
  assert.notEqual(group, -1, 'raycast triangle belongs to a visible source material');
  const part = group === 0 ? 'body' : 'head';
  assert.equal(hit.object.userData.part, part,
    'the split hit mesh agrees with the source material triangle');
  return part;
}

function classify(hit) {
  return isHeadshotIntersection(hit);
}

for (const clipName of ['idle1', 'run.001']) {
  mixer.stopAllAction();
  const clip = actor.animations.find(item => item.name.endsWith('|' + clipName));
  mixer.clipAction(clip).reset().play();
  mixer.setTime(clipName === 'idle1' ? 0 : clip.duration * .42);
  holder.updateMatrixWorld(true);
  bodyMesh.boundingSphere = headMesh.boundingSphere = null;
  const headY = headBone.getWorldPosition(new THREE.Vector3()).y;
  let skull = 0, mask = 0, neck = 0, body = 0;
  for (const direction of [-1, 1]) {
    for (let y = headY - .13; y <= headY + .20; y += .018) {
      for (let x = -.22; x <= .18; x += .024) {
        ray.set(new THREE.Vector3(x, y, direction * 2),
          new THREE.Vector3(0, 0, -direction));
        ray.far = 4;
        const hit = ray.intersectObjects([bodyMesh, headMesh], false)[0];
        if (!hit) continue;
        const part = sourcePart(hit);
        const result = classify(hit);
        if (part === 'body') {
          if (result) mask++;
          else body++;
        } else if (result) skull++;
        else neck++;
      }
    }
  }
  assert.ok(skull > 30, `${clipName}: visible head triangles are hittable from both sides`);
  assert.ok(mask > 0, `${clipName}: the body-material face mask can be a headshot`);
  assert.ok(neck > 0, `${clipName}: the face material's lower neck is not a headshot`);
  assert.ok(body > 30, `${clipName}: torso triangles still receive body hits`);
}

// A first-hit ray into the visible dark face mask must award head damage even
// though the FBX stores that mask in its body material group.
mixer.stopAllAction();
mixer.clipAction(idle).reset().play();
mixer.update(0);
holder.updateMatrixWorld(true);
const jawY = headBone.getWorldPosition(new THREE.Vector3()).y - .075;
ray.set(new THREE.Vector3(0, jawY, 2), new THREE.Vector3(0, 0, -1));
ray.far = 4;
const maskHit = ray.intersectObjects([bodyMesh, headMesh], false)[0];
assert.equal(maskHit?.object.userData.part, 'body', 'the visible mask comes from the body group');
assert.equal(isHeadshotIntersection(maskHit), false,
  'a face-mask hit below the approved dynamic plane remains a body hit');

// An upward shot from the side strikes the eye/temple surface, but the FBX
// labels that small triangle as body and blends its skin weights with the neck.
const eyeCenter = headBone.getWorldPosition(new THREE.Vector3());
const templeTarget = eyeCenter.clone().add(new THREE.Vector3(0, -.02, 0));
const templeOrigin = templeTarget.clone().add(new THREE.Vector3(2, -.5, 0));
ray.set(templeOrigin, templeTarget.clone().sub(templeOrigin).normalize());
ray.far = 4;
const templeHit = ray.intersectObjects([bodyMesh, headMesh], false)[0];
assert.equal(templeHit?.object.userData.part, 'body',
  'the real upper-face triangle is stored in the body material');
assert.equal(isHeadshotIntersection(templeHit), true,
  'a visible eye/temple surface hit must award head damage');

// The same low viewing angle can reach the torso or raised hand before the
// head. Height alone must not promote that distant first surface to a headshot.
const chestOrigin = eyeCenter.clone().add(new THREE.Vector3(0, -.48, 2));
ray.set(chestOrigin, eyeCenter.clone().add(new THREE.Vector3(0, .02, 0))
  .sub(chestOrigin).normalize());
const chestHit = ray.intersectObjects([bodyMesh, headMesh], false)[0];
assert.equal(chestHit?.object.userData.part, 'body');
assert.equal(isHeadshotIntersection(chestHit), false,
  'an arm or torso in front of the face remains a body hit');
assert.equal(isHeadshotIntersection(chestHit,
  { worldCutoffY: chestHit.point.y - .01, radialLimit: .16 }), false,
  'body/clothing remains a body hit even when it is above the horizontal cutoff');
assert.equal(isHeadshotIntersection(maskHit,
  { worldCutoffY: maskHit.point.y - .01, radialLimit: .14 }), true,
  'face-mask anatomy above the dynamic horizontal cutoff remains a headshot');
assert.equal(isHeadshotIntersection(maskHit,
  { worldCutoffY: maskHit.point.y + .01 }), false,
  'face-mask anatomy below the dynamic horizontal cutoff remains a body hit');

// A turned head must carry the jaw plane with it, even when world Y is equal.
const rotated = new THREE.Bone();
rotated.rotation.z = Math.PI / 2;
rotated.updateMatrixWorld(true);
const fake = point => ({ point, object: { userData: {
  part: 'head', headRegion: { bone: rotated, upLocal: new THREE.Vector3(0, 1, 0) },
} } });
assert.equal(isHeadshotIntersection(fake(new THREE.Vector3(-.08, 0, 0))), true);
assert.equal(isHeadshotIntersection(fake(new THREE.Vector3(.08, 0, 0))), true,
  'the approved plane stays horizontal even when the head bone tilts');
assert.equal(isHeadshotIntersection(fake(new THREE.Vector3(0, -.06, 0))), false,
  'a point more than 5.5cm below the animated head center is a body hit');
assert.equal(isHeadshotIntersection(fake(new THREE.Vector3(.15, .08, 0)),
  { worldCutoffY: 0, radialLimit: .14 }), false,
  'a high head-material surface outside the anatomical radius is not a headshot');

// The confirmed X/Z center offset is character-local: it rotates with facing,
// but the cylinder itself stays vertical. The exact same geometric rule applies
// to a visible body-material triangle; no anatomy/material exception remains.
const axisRoot = new THREE.Object3D();
axisRoot.rotation.y = Math.PI / 2;
axisRoot.updateMatrixWorld(true);
const offsetDirection = new THREE.Vector3(
  FOX_HEAD_CENTER_OFFSET_X, 0, FOX_HEAD_CENTER_OFFSET_Z)
  .applyQuaternion(axisRoot.getWorldQuaternion(new THREE.Quaternion()));
const shiftedCenter = offsetDirection.clone();
const outward = offsetDirection.clone().normalize();
const geometricBodyHit = point => ({ point, object: { userData: {
  part: 'body', headRegion: { bone: rotated, axisRoot },
} } });
assert.equal(isHeadshotIntersection(geometricBodyHit(
  shiftedCenter.clone().addScaledVector(outward, .13)), { worldCutoffY: 0 }), true,
  'a body-material surface inside the shifted cylinder uses the pure geometry rule');
assert.equal(isHeadshotIntersection(geometricBodyHit(
  shiftedCenter.clone().addScaledVector(outward, -.152)), { worldCutoffY: 0 }), false,
  'the shifted cylinder rejects a point outside its moved axis even if near the old axis');
assert.equal(isHeadshotIntersection({ object: { userData: { part: 'head' } } }), true,
  'non-Fox characters retain their existing head-mesh semantics');
console.log('PASS: Fox uses the approved animated plane and shifted local-X/Z cylinder.');
