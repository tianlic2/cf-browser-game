import assert from 'node:assert/strict';
import { register } from 'node:module';
register(new URL('./three_test_loader.mjs', import.meta.url), import.meta.url);

const THREE = await import('../lingyin-map/node_modules/three/build/three.module.js');
const { createZone13EventDirector } = await import('../scripts/zone13_events.js');

const root = new THREE.Group();
const colliders = [];
const obstacles = [];
const world = {
  staticProps: [
    { model: 'models/cf/zone13/bus.mdl', position: [-40, 3, 4], angles: [0, 0, 0] },
    { model: 'models/cf/zone13/bus.mdl', position: [2, 3, -12], angles: [0, 90, 0] },
  ],
  markers: [
    { name: 'hac', position: [-75.8, 33.4, -47] },
    { name: 'hurt4', position: [37.8, 13.8, -62] },
    { name: 'hp', position: [-69.1, 32.3, -28.6] },
  ],
};
const heard = [];
const sound = { bio(kind, x, y, z) { heard.push({ kind, x, y, z }); } };
const director = createZone13EventDirector(root, colliders, obstacles, world, null);
director.reset(sound);

assert.equal(obstacles.length, 1, 'the falling container is in the render-raycast list from construction');
assert.equal(colliders.length, 0, 'the airborne hidden container does not create an air wall');
director.update(89.9, sound);
assert.deepEqual(director.state().fired, ['hoho', 'drop', 'bus', 'busoff', 'laser'],
  'early event timing is deterministic and ordered');
assert.equal(director.state().containerVisible, false, 'the 20-second sound cue does not leave a floating crate');
director.update(90, sound);
assert.equal(director.state().containerVisible, true, 'the 90-second container event reveals the falling prop');
assert.equal(colliders.length, 0, 'the falling prop remains non-solid while visibly airborne');
director.update(91.5, sound);
assert.equal(director.state().containerLanded, true);
assert.equal(colliders.length, 1, 'landing and collision activation happen in the same update');
director.update(155, sound);
assert.equal(director.state().cameo, true, 'the rooftop easter egg is visible in its authored window');
assert.deepEqual([...new Set(heard.map((entry) => entry.kind))],
  ['hoho', 'drop', 'carstart', 'shutdown', 'laser', 'container', 'drop4'],
  'every admitted event sound has a live trigger');
director.reset(sound);
assert.equal(colliders.length, 0, 'round reset removes the dynamic collider');
assert.equal(director.state().containerVisible, false, 'round reset hides event visuals');

console.log('PASS: Zone13 event timing, sounds, visuals and landing collision stay synchronized.');
