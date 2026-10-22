import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../scripts/main.js', import.meta.url), 'utf8');
const switching = source.slice(source.indexOf('// ---------- 切枪：目标武器直接出枪 ----------'),
  source.indexOf('function canQuickSwitchTo('));

assert.doesNotMatch(switching, /SWITCH_HOLSTER|sfx\.holster\(/,
  'switching must not retain a source-weapon holster phase or event');
assert.match(switching,
  /switchState = \{ from, to: id, kind: draw \? "draw" : "swap", holster: 0, dur: deploy, t: 0, committed: true \};\s*commitWeaponVisual\(id\)/,
  'the target weapon is committed immediately and starts its deploy animation');
assert.match(switching, /return \{ holster: 0, deploy: switchDeployDuration\(id\) \}/,
  'the public timing probe reports zero holster duration');
assert.doesNotMatch(switching, /if \(!s\.committed/,
  'the update loop no longer waits for a holster boundary before showing the target');
assert.match(switching, /function switchWeapon\(id, force, opts\)[\s\S]*?sfx\.cancelPendingDeploy\(\);[\s\S]*?commitWeaponVisual\(id\)/,
  'switching away cancels an unreached draw event before the next weapon schedules its own event');

const poseStart = source.indexOf('const _swEase =');
const poseEnd = source.indexOf('// 时间线推进。', poseStart);
const context = vm.createContext({
  state: { to: 'm4', kind: 'swap', holster: 0, dur: 1, t: 0, committed: true },
  WEAPON_DEFS: { m4: { type: 'rifle' } },
  SWITCH_POSE: { dip: .28, back: .22, rot: .95, roll: .45, yaw: .30 },
});
vm.runInContext(`let switchState=state;${source.slice(poseStart, poseEnd)};globalThis.pose=switchPoseAt;`, context);
assert.equal(context.pose(0).q, 1, 'the target starts in its fully lowered deploy pose');
assert.ok(context.pose(.5).q > 0 && context.pose(.5).q < 1,
  'the target advances smoothly through its deploy pose');
assert.equal(context.pose(1).q, 0, 'the target finishes exactly at its resting pose');

console.log('PASS: every weapon switch skips the old weapon holster and immediately plays the target deploy.');
