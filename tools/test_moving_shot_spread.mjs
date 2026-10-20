import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { movementSpreadTangent, sampleShotOffset } from '../scripts/shot_spread.js';

const main = readFileSync(new URL('../scripts/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ak = { stand: 0.00641, crouch: 0.00481, move: 0.17506, jumpInitial: 0.10094, jump: 0.14076 };
const still = { onGround: true, crouching: false, sneaking: false,
  horizontalSpeed: 0, verticalSpeed: 0, runSpeed: 8, jumpVelocity: 7.5 };
const walking = { ...still, horizontalSpeed: 4 };
const running = { ...still, horizontalSpeed: 8 };
const sneaking = { ...walking, sneaking: true };
const jumping = { ...still, onGround: false, verticalSpeed: 7.5 };

assert.equal(movementSpreadTangent(ak, still), 0, 'stationary shots remain centered');
assert.equal(movementSpreadTangent(ak, { ...still, horizontalSpeed: 0.03 }), 0,
  'sub-centimeter velocity noise does not trigger spread');
assert.ok(movementSpreadTangent(ak, running) > movementSpreadTangent(ak, walking),
  'running scatters more than walking');
assert.ok(movementSpreadTangent(ak, sneaking) > 0 && movementSpreadTangent(ak, sneaking) < movementSpreadTangent(ak, walking),
  'quiet movement still scatters, but less');
assert.ok(movementSpreadTangent(ak, jumping) > movementSpreadTangent(ak, running),
  'airborne shots scatter more than ground movement');

const centered = sampleShotOffset(0, 0, 0, () => { throw Error('stationary shot used randomness'); });
assert.deepEqual(centered, { x: 0, y: 0 });
const movingRadius = movementSpreadTangent(ak, running);
for (let i = 0; i < 100; i++) {
  let n = 0;
  const shot = sampleShotOffset(movingRadius, 0, 0,
    () => ((i * 37 + n++ * 19) % 101) / 101);
  assert.ok(Math.hypot(shot.x, shot.y) <= movingRadius + 1e-12,
    'moving shot stays inside the displayed radius');
}
const hip = sampleShotOffset(movingRadius, 0.045, 0.12, () => 0.5);
assert.ok(Math.hypot(hip.x, hip.y) > 0.045, 'moving sniper retains and expands its hip-fire ring');

assert.match(main, /pattern: AK_LIVE_PATTERN/);
assert.match(main, /pattern: M4_LIVE_PATTERN/);
assert.match(main, /const AK_LIVE_PATTERN = scalePattern\(akPattern\(\), 1\.25, 1\.25\)/);
assert.match(main, /const M4_LIVE_PATTERN = scalePattern\(M4_PATTERN, 1\.25, 1\.25\)/);
assert.match(main, /function baseInaccuracy\(def\)[\s\S]*?movementShotSpread\(def\)/,
  'HUD crosshair includes the same movement radius');
assert.match(main, /const offset = sampleShotOffset\(movementShotSpread\(def\)/,
  'actual shot ray samples movement spread');
assert.match(main, /new THREE\.Vector3\(offset\.x, offset\.y, -1\)\.normalize\(\)/);
assert.match(main, /WEAPON_STATE\.sinceShot = 0;\s*advancePunch\(\)/,
  'the current bullet resolves before next-shot recoil');
assert.match(html, /main\.js\?v=lingyin-hillside-24/);
console.log('PASS: stronger recoil and real walking, sneaking and jumping shot spread; stationary aim and sniper hip ring preserved.');
