import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VIEWMODEL_BOB_AMPLITUDE_SCALE, VIEWMODEL_BOB_FREQUENCY_SCALE,
  VIEWMODEL_BOB_DISTANCE, KN57_BOB_SCALE, viewmodelBobProfile } from '../scripts/viewmodel_bob.js';

assert.equal(VIEWMODEL_BOB_AMPLITUDE_SCALE, .5);
assert.equal(VIEWMODEL_BOB_FREQUENCY_SCALE, .5);
assert.equal(VIEWMODEL_BOB_DISTANCE, .013);
assert.equal(KN57_BOB_SCALE, .3);

const walk = viewmodelBobProfile(4, true, false, false, 'rifle');
assert.deepEqual(walk, { moving: true, rate: 4, amplitude: .5 },
  'normal first-person movement uses half the old rate and amplitude');
const run = viewmodelBobProfile(6, true, false, false, 'rifle');
assert.deepEqual(run, { moving: true, rate: 6, amplitude: .65 },
  'running retains its relative emphasis after both values are halved');
const careful = viewmodelBobProfile(2, true, true, false, 'pistol');
assert.deepEqual(careful, { moving: true, rate: 3, amplitude: .275 },
  'crouched and sneaking hand motion is also halved');
const grenade = viewmodelBobProfile(4, true, false, false, 'grenade');
assert.equal(grenade.rate, 4);
assert.ok(Math.abs(grenade.amplitude - .075) < 1e-12,
  'grenades preserve their existing 15% relative damping under the global half amplitude');
const kn57Walk = viewmodelBobProfile(4, true, false, false, 'rifle', 'kn57');
assert.deepEqual(kn57Walk, { moving: true, rate: 1.2, amplitude: .15 },
  'KN-57 uses 30% of the current movement bob frequency and amplitude');
const otherRifle = viewmodelBobProfile(4, true, false, false, 'rifle', 'ak');
assert.deepEqual(otherRifle, walk, 'the KN-57 override does not affect other rifles');
assert.deepEqual(viewmodelBobProfile(6, false, false, false, 'rifle'),
  { moving: false, rate: 0, amplitude: 0 }, 'airborne movement does not create walk bob');

const main = fs.readFileSync(new URL('../scripts/main.js', import.meta.url), 'utf8');
assert.match(main, /const bob = viewmodelBobProfile\(hSpeed, player\.onGround,/);
assert.match(main, /player\.crouching, player\.sneaking, def\.type, currentId\)/,
  'runtime passes the active weapon id into the bob profile');
assert.match(main, /bobT \+= dt \* bob\.rate/);
assert.match(main, /VIEWMODEL_BOB_DISTANCE \* bob\.amplitude/g,
  'position, authored views and fallback arms share one reduced bob source');
console.log('PASS: shared viewmodel bob is preserved and KN-57 amplitude/frequency use a dedicated 30% multiplier.');
