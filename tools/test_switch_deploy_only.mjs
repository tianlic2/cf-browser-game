import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../scripts/main.js', import.meta.url), 'utf8');
const switching = source.slice(source.indexOf('// ---------- 切枪：目标武器直接出枪 ----------'),
  source.indexOf('function canQuickSwitchTo('));

// Existing guns have no authored holster and should commit the target immediately.
assert.match(switching, /const holster = !draw && !force && from === 'hbr7' && from !== id \? HARBOR_ACTION_SECONDS\.holster : 0/);
assert.match(switching, /if \(!holster\) commitWeaponVisual\(id\)/);
assert.match(switching, /if \(!s\.committed && s\.t >= s\.holster\)/);
assert.match(switching, /if \(!continuingHolster\) sfx\.cancelPendingDeploy\(\)/);

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

context.state.holster=.34;context.state.dur=1.34;
assert.equal(context.pose(.2).q,1);
assert.equal(context.pose(.34).q,1);
assert.ok(Math.abs(context.pose(.84).q-.5)<.00001);
assert.equal(context.pose(1.34).q,0);
console.log('PASS: immediate legacy deploy, HBR-7 holster boundary and complete target draw.');
