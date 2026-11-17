import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import { selectFoxDeathDirection } from '../scripts/fox_death_direction.js';

const hit = (x, z, yaw = 0) => selectFoxDeathDirection({ x, z }, yaw);
assert.equal(hit(0, 1), 'forward');
assert.equal(hit(0, -1), 'back');
// The Fox source file's left/right labels are opposite to the visible local
// fall side (head bone moves +X for "left", -X for "right").
assert.equal(hit(1, 0), 'left');
assert.equal(hit(-1, 0), 'right');
assert.equal(hit(1, 1, Math.PI / 2), 'forward');
assert.equal(hit(1, 0, Math.PI / 2), 'forward');
assert.equal(hit(0, -1, Math.PI / 2), 'left');
assert.equal(hit(0, 1, Math.PI / 2), 'right');
assert.equal(hit(0.2, -1), 'back');
assert.equal(hit(2, -1), 'left');
assert.equal(selectFoxDeathDirection(null, 0), 'back');
assert.equal(selectFoxDeathDirection({ x: 0, z: 0 }, 0), 'back');
assert.equal(selectFoxDeathDirection({ x: Infinity, z: 0 }, 0), 'back');

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const enemy = read('scripts/enemies.js');
const fox = read('scripts/fox_soldier.js');
const main = read('scripts/main.js');
assert.match(main, /enemy\.takeDamage\(amount, headshot, impactDir\)/);
assert.match(enemy, /this\.deathDirection = selectFoxDeathDirection\(impactDir, yaw\)/);
assert.match(enemy, /dead: true, deathDirection: this\.deathDirection/);
assert.match(enemy, /this\.deathPushX = length > 1e-4 \? x \/ length/);
assert.match(fox, /const clipName = \['forward', 'back', 'left', 'right'\]/);
assert.match(fox, /settleDeathClip\(clip\)/);
assert.match(fox, /const move = airborne \? 'jump' : crouching[\s\S]*?'crouchrun'[\s\S]*?'run\.001'/);
assert.match(fox, /clips\.set\('death-grounded', clips\.get\('left'\)\.clone\(\)\)/,
  'lateral deaths retain the source fall whose final torso is actually grounded');
assert.match(fox, /nativeBackFall \? 'back' : 'death-grounded'/,
  'a frontal hit uses the anatomically correct native backward fall');
assert.match(fox, /BACK_SETTLE_ROLL \* settle/,
  'the native backward fall continues settling after the head first contacts the floor');
assert.match(fox, /BACK_SETTLE_LIFT \* settle/,
  'the settled body receives a matching floor-clearance correction');
assert.match(fox, /GROUNDED_DEATH_YAW\[clipName\]/,
  'only lateral grounded falls need mirroring');
assert.match(fox, /previous\.crossFadeTo\(death, \.08, false\)/,
  'death blends from the current locomotion pose instead of snapping');
assert.match(fox, /function reactionClip[\s\S]*\^Bip01_\(Spine\|Neck\|Head\)/,
  'hit reactions leave the authored arms and weapon grip untouched');
assert.match(fox, /setDuration\(\.24\)\.setEffectiveWeight\(\.48\)/,
  'hit reaction is brief and partial rather than a full-pose override');
for (const [legacy, png] of [['woman_body_bl.bmp', 'body.png'],
  ['woman_face_bl.bmp', 'face.png'], ['ddfcd20.bmp', 'ddfcd20.png']]) {
  assert.match(fox, new RegExp(`'${legacy}': assetUrl\\('${png.replace('.', '\\.')}\\'\\)`),
    `${legacy} embedded request must resolve to the available PNG`);
}

// Exercise the real FBX loader, runtime action map, and source skinned meshes.
// The browser supplies these APIs; Node stubs only the image/canvas decoding.
register(new URL('./three_test_loader.mjs', import.meta.url), import.meta.url);
const THREE = await import('three');
const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js');
THREE.TextureLoader.prototype.loadAsync = async () => new THREE.Texture();
THREE.TextureLoader.prototype.load = () => new THREE.Texture();
FBXLoader.prototype.loadAsync = async function () {
  const bytes = fs.readFileSync(new URL('../assets/local/fox_npc/fox.fbx', import.meta.url));
  return this.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
};
globalThis.document = { createElement: () => ({ getContext: () => ({
  createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  putImageData() {}, setLineDash() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
}) }) };
const { loadFoxSoldier, FoxSoldierRig } = await import('../scripts/fox_soldier.js');
const { Enemy } = await import('../scripts/enemies.js');
const { isHeadshotIntersection } = await import('../scripts/head_hit.js');
assert.equal(await loadFoxSoldier(), true, 'the native Fox source loads');
const rig = new FoxSoldierRig(null);
assert.equal(rig.source, 'fox-original-fbx');
const skinnedMinY = () => {
  rig.root.updateMatrixWorld(true);
  const mesh = rig.meshes[0], positions = mesh.geometry.attributes.position;
  const point = new THREE.Vector3();
  let minY = Infinity;
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i);
    mesh.applyBoneTransform(i, point).applyMatrix4(mesh.matrixWorld);
    minY = Math.min(minY, point.y);
  }
  return minY;
};
for (const clip of ['jump', 'crouch-calm', 'crouchrun', 'reload-crouch-ak',
  'reload-crouch-rifle'])
  assert.ok(rig.actions.has(clip), `the runtime action map contains ${clip}`);
rig.animate(1 / 60, { dead: false, airborne: true, jumpPhase: .35,
  speed: 3, flinch: 0, reload: 0 });
assert.equal(rig.baseName, 'jump', 'airborne Fox uses the authored jump action');
assert.ok(Math.abs(rig.baseAction.time / rig.baseAction.getClip().duration - .35) < 1e-5,
  'jump pose follows ballistic progress instead of animation frame rate');
rig.animate(1 / 60, { dead: false, airborne: true, jumpPhase: 1,
  speed: 3, flinch: 0, reload: 0 });
assert.ok(Math.abs(rig.baseAction.time - rig.baseAction.getClip().duration) < 1e-5,
  'the landing sample clamps on the final jump pose instead of looping to takeoff');
rig.reset();
for (let i = 0; i < 20; i++) rig.animate(1 / 60,
  { dead: false, airborne: false, crouching: false, speed: 0, flinch: 0, reload: 0 });
rig.root.updateMatrixWorld(true);
const standingHeadY = rig.headBone.getWorldPosition(new THREE.Vector3()).y;
rig.animate(1 / 60, { dead: false, airborne: false, crouching: true,
  speed: 0, flinch: 0, reload: .2 });
assert.equal(rig.baseName, 'crouch-calm', 'stationary crouch uses the planted authored stance');
assert.equal(rig.reloadAction?.getClip().name, 'reload-crouch-rifle',
  'crouched rifle reload keeps the native upper-body action');
for (let i = 0; i < 35; i++) rig.animate(1 / 60,
  { dead: false, airborne: false, crouching: true, speed: 0, flinch: 0, reload: .3 });
rig.root.updateMatrixWorld(true);
const crouchedHeadY = rig.headBone.getWorldPosition(new THREE.Vector3()).y;
const crouchedMinY = skinnedMinY();
assert.ok(crouchedMinY >= -.008 && crouchedMinY <= .035,
  `crouched Fox must keep its visible feet on the floor (${crouchedMinY})`);
assert.ok(standingHeadY - crouchedHeadY > .22,
  `crouching must lower the head instead of lifting the feet (${standingHeadY}, ${crouchedHeadY})`);
rig.animate(1 / 60, { dead: false, crouching: true,
  speed: 2, flinch: 0, reload: .3 });
assert.equal(rig.baseName, 'crouchrun', 'moving crouch uses the authored crouch run');
assert.ok(rig.meshes.every(mesh => mesh.userData.headRegion?.bone === rig.headBone),
  'both the body material and face material carry head-region metadata');
rig.root.updateMatrixWorld(true);
const headCenter = rig.headBone.getWorldPosition(new THREE.Vector3());
let nativeMaskHit = null;
for (let y = headCenter.y - .05; y <= headCenter.y + .16 && !nativeMaskHit; y += .01) {
  for (let x = headCenter.x - .16; x <= headCenter.x + .16; x += .01) {
    const maskRay = new THREE.Raycaster(new THREE.Vector3(x, y, 2),
      new THREE.Vector3(0, 0, -1), 0, 4);
    const candidate = maskRay.intersectObjects(rig.meshes, false)[0];
    if (candidate?.object.userData.part === 'body' && isHeadshotIntersection(candidate)) {
      nativeMaskHit = candidate;
      break;
    }
  }
}
assert.ok(nativeMaskHit,
  'the formal in-game Fox rig classifies a visible body-material face surface inside the approved cylinder');
rig.reset();
rig.animate(0, { dead: false, speed: 0, flinch: 0, reload: 0 });
const armBones = ['Bip01_L_UpperArm', 'Bip01_L_Forearm', 'Bip01_L_Hand',
  'Bip01_R_UpperArm', 'Bip01_R_Forearm', 'Bip01_R_Hand'];
const armBefore = new Map(armBones.map(name => [name,
  rig.fox.getObjectByName(name).quaternion.clone()]));
rig.animate(.08, { dead: false, speed: 0, flinch: 1, reload: 0 });
for (const name of armBones) {
  const angle = rig.fox.getObjectByName(name).quaternion.angleTo(armBefore.get(name));
  assert.ok(angle < .002, `${name} local grip pose must survive the hit reaction (${angle})`);
}
for (const [impact, direction] of [
  [{ x: 0, z: 1 }, 'forward'], [{ x: 0, z: -1 }, 'back'],
  [{ x: 1, z: 0 }, 'left'], [{ x: -1, z: 0 }, 'right'],
]) {
  rig.reset();
  const enemy = { dead: false, trainingImmortal: false, health: 10, rig,
    group: { rotation: { y: 0 } }, setFlash() {}, applyFlash() {}, launchHelmet() {} };
  assert.equal(Enemy.prototype.takeDamage.call(enemy, 10, false, impact), true);
  assert.equal(enemy.deathDirection, direction);
  for (let i = 0; i < 90; i++) rig.animate(1 / 60,
    { dead: true, deathDirection: enemy.deathDirection, flinch: 0, speed: 0 });
  assert.equal(rig.baseName, direction, 'the authored directional fall is played');
  const expectedYaw = { left: 0, right: Math.PI, forward: -Math.PI / 2, back: 0 }[direction];
  assert.ok(Math.abs(rig.fox.rotation.y - expectedYaw) < 1e-6,
    `${direction} must preserve the native front/back pose or mirror only a lateral fall`);
  rig.root.updateMatrixWorld(true);
  const mesh = rig.meshes[0], positions = mesh.geometry.attributes.position;
  const point = new THREE.Vector3();
  let minY = Infinity;
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i);
    mesh.applyBoneTransform(i, point).applyMatrix4(mesh.matrixWorld);
    minY = Math.min(minY, point.y);
  }
  assert.ok(minY >= -0.005, `${direction} corpse must not sink under the floor (${minY})`);
  const boneLimits = direction === 'back'
    ? { Bip01_Head: .38, Bip01_Pelvis: .38, Bip01_Spine2: .38 }
    : { Bip01_Head: .34, Bip01_Pelvis: .34, Bip01_Spine2: .34 };
  for (const boneName of ['Bip01_Head', 'Bip01_Pelvis', 'Bip01_Spine2']) {
    const y = rig.fox.getObjectByName(boneName).getWorldPosition(new THREE.Vector3()).y;
    assert.ok(y < boneLimits[boneName],
      `${direction} ${boneName} must remain within its authored grounded envelope (${y})`);
  }
  if (direction === 'back') {
    const head = rig.fox.getObjectByName('Bip01_Head').getWorldPosition(new THREE.Vector3());
    assert.ok(head.z < -.6 && Math.abs(head.z) > Math.abs(head.x) * 4,
      `a frontal kill must visibly carry the head backward, not sideways (${head.x}, ${head.z})`);
    const pelvis = rig.fox.getObjectByName('Bip01_Pelvis').getWorldPosition(new THREE.Vector3());
    assert.ok(Math.abs(pelvis.y - head.y) < .08,
      `head and hips must finish on the same grounded plane (${head.y}, ${pelvis.y})`);
    for (const footName of ['Bip01_L_Foot', 'Bip01_R_Foot']) {
      const foot = rig.fox.getObjectByName(footName).getWorldPosition(new THREE.Vector3());
      assert.ok(foot.y < .25, `${footName} must not remain suspended after the backward fall (${foot.y})`);
    }
  }
}
console.log('PASS: Fox hit reaction preserves the grip; directional deaths settle head, chest and hips on the floor.');
