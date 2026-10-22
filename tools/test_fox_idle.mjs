import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/build/three.module.js';
import { createFoxBreathingIdle, FOX_BREATH_PERIOD } from '../scripts/fox_idle.js';

const source = new THREE.AnimationClip('idle1', 1 / 6, [
  new THREE.VectorKeyframeTrack('Bip01_Pelvis.position', [0, 1 / 12, 1 / 6],
    [0, 1, 0, 0, 1.1, 0, 0, .9, 0]),
  new THREE.QuaternionKeyframeTrack('Bip01_L_Thigh.quaternion', [0, 1 / 12, 1 / 6],
    [0, 0, 0, 1, .1, 0, 0, .995, 0, 0, 0, 1]),
  new THREE.VectorKeyframeTrack('Bip01_R_Foot.position', [0, 1 / 12, 1 / 6],
    [0, 0, 0, 0, .1, 0, 0, 0, 0]),
  ...['Bip01_Spine1', 'Bip01_Spine2'].map(name =>
    new THREE.QuaternionKeyframeTrack(name + '.quaternion', [0, 1 / 6],
      [0, 0, 0, 1, 0, 0, 0, 1])),
]);
const original = source.tracks.map(track => Array.from(track.values));
const idle = createFoxBreathingIdle(source);
assert.equal(idle.duration, FOX_BREATH_PERIOD);
assert.deepEqual(source.tracks.map(track => Array.from(track.values)), original,
  'the original FBX idle clip is untouched');

const sample = (track, time) => Array.from(track.createInterpolant().evaluate(time));
for (const name of ['Bip01_Pelvis.position', 'Bip01_L_Thigh.quaternion',
  'Bip01_R_Foot.position']) {
  const track = idle.tracks.find(item => item.name === name);
  const initial = sample(track, 0);
  for (const fraction of [.1, .25, .5, .75, .99, 1])
    assert.deepEqual(sample(track, FOX_BREATH_PERIOD * fraction), initial,
      `${name} must stay planted throughout idle`);
}
for (const name of ['Bip01_Spine1.quaternion', 'Bip01_Spine2.quaternion']) {
  const track = idle.tracks.find(item => item.name === name);
  assert.notDeepEqual(sample(track, FOX_BREATH_PERIOD / 4), sample(track, 0),
    `${name} should breathe`);
  assert.deepEqual(sample(track, FOX_BREATH_PERIOD), sample(track, 0),
    `${name} should loop without a snap`);
  const q = new THREE.Quaternion().fromArray(sample(track, FOX_BREATH_PERIOD / 4));
  assert.ok(q.angleTo(new THREE.Quaternion()) < .025,
    `${name} breathing angle should remain subtle`);
}
console.log('PASS: Fox idle keeps hips and feet fixed while the chest breathes slowly.');
