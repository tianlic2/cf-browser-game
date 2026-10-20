import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../scripts/main.js', import.meta.url), 'utf8');
const cancelStart = main.indexOf('function cancelWeaponReload(');
const cancelEnd = main.indexOf('// 每帧给小地图喂一份数据', cancelStart);
const attackStart = main.indexOf('function ironbeastMeleeAttack()');
const attackEnd = main.indexOf('function updateIronbeastMelee', attackStart);
assert.ok(cancelStart >= 0 && cancelEnd > cancelStart && attackStart >= 0 && attackEnd > attackStart);

const ammo = { reloading: true, reloadT: 1.25, mag: 12, reserve: 105, boltT: 0, cooldown: .08 };
let skin = 'ironbeastgold';
let toast = '换弹中';
let cancelCount = 0;
const ctx = {
  WEAPON_STATE: ammo, currentId: 'm4', state: 'playing', dead: false,
  activeSkinId: () => skin, switchBlocking: () => false,
  ironbeastMeleeState: null, IRONBEAST_MELEE: { duration: .532 }, ironbeastFireT: 0,
  actedThisLife: false, ironbeastView: { eventTime: () => .002 },
  showToast: value => { toast = value; },
  sfx: { cancelReload: () => { cancelCount++; }, ironbeastMelee() {} },
};
vm.createContext(ctx);
vm.runInContext(main.slice(cancelStart, cancelEnd) + main.slice(attackStart, attackEnd), ctx);

assert.equal(vm.runInContext('ironbeastMeleeAttack()', ctx), true);
assert.equal(ammo.reloading, false);
assert.equal(ammo.reloadT, 0);
assert.deepEqual({ mag: ammo.mag, reserve: ammo.reserve }, { mag: 12, reserve: 105 },
  'interrupted reload neither fills the magazine nor consumes reserve ammunition');
assert.equal(cancelCount, 1, 'pending reload audio is cancelled exactly once');
assert.equal(toast, '');
assert.equal(ctx.ironbeastMeleeState.t, 0);
assert.equal(ctx.ironbeastMeleeState.hit, false);

ctx.ironbeastMeleeState = null;
ammo.reloading = true;
ammo.reloadT = .6;
skin = 'classic';
assert.equal(vm.runInContext('ironbeastMeleeAttack()', ctx), false);
assert.equal(ammo.reloading, true, 'ordinary M4 right click does not cancel its reload');
assert.equal(cancelCount, 1);

console.log('PASS: 炫金雷神枪托打断换弹，不补弹、不扣备弹，并取消后续换弹音效');
