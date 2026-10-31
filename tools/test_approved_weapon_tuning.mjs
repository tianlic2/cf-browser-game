import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const tuningSource = fs.readFileSync(new URL('scripts/weapon_tuning.js', root), 'utf8');
const tuningUrl = `data:text/javascript;base64,${Buffer.from(tuningSource).toString('base64')}`;
const { WEAPON_TUNING: actual } = await import(tuningUrl);
const approvedStats = {
  ak: { magSize: 36, reserve: 108, dmg: 37, head: 140, interval: .1, reload: 2.43, rangeMod: .98, wood: .4 },
  m4: { magSize: 30, reserve: 90, dmg: 33, head: 104, interval: .0901, reload: 3.1, rangeMod: .99, wood: .85 },
  barrett: { magSize: 15, reserve: 30, dmg: 300, head: 750, interval: 1.55, reload: 3.85, rangeMod: .99, wood: .8 },
  ironbeast: { magSize: 41, reserve: 123, dmg: 35, head: 104, interval: .0901, reload: 3.1, rangeMod: .99, wood: .85 },
  scar: { magSize: 41, reserve: 123, dmg: 35, head: 104, interval: .0901, reload: 2.47, rangeMod: .99, wood: .85 },
  m200: { magSize: 15, reserve: 30, dmg: 220, head: 500, interval: 1.55, reload: 3.42, rangeMod: .99, wood: .8 },
  akgold: { magSize: 41, reserve: 123, dmg: 37, head: 130, interval: .1, reload: 2.71, rangeMod: .98, wood: .4 },
  kn57: { magSize: 70, reserve: 210, dmg: 500, head: 1000, interval: .15, reload: 91/37, rangeMod: .98, wood: .4 },
  deagle: { magSize: 12, reserve: 48, dmg: 54, head: 120, interval: .24, reload: 2.35, rangeMod: .92, wood: .35 },
  knife: { range: 1.5, lightDmg: 60, lightHead: 130, heavyDmg: 150, heavyHead: 180, lightInterval: .4, heavyInterval: 1 },
  kukri: { range: 1.45, lightDmg: 60, lightHead: 100, heavyDmg: 130, heavyHead: 180, lightInterval: .87, heavyInterval: .36 },
};

for (const [id, stats] of Object.entries(approvedStats)) {
  assert.ok(actual[id], `formal tuning missing ${id}`);
  assert.deepEqual(actual[id].stats, stats, `${id} stats diverged from approved export`);
  assert.ok(actual[id].pose, `${id} viewmodel pose missing`);
  assert.ok(actual[id].recoil, `${id} recoil tuning missing`);
  assert.ok(actual[id].inacc, `${id} spread tuning missing`);
}
assert.deepEqual(actual.barrett.pose,
  { x: .9, y: 0, z: .34, pitch: -.03, yaw: -.02, roll: 0, scale: 5 });
assert.deepEqual(actual.scar.pose,
  { x: -.12, y: .01, z: .11, pitch: 0, yaw: -.16, roll: 0, scale: 1 });
assert.deepEqual(actual.ak.recoil,
  { vertical: 2.01, horizontal: 1.95, reset: .55, hold: .15, viewTrack: 1 });
assert.deepEqual(actual.ironbeast.recoil,
  { vertical: 4.16, horizontal: 2.73, reset: .45, hold: .12, viewTrack: 1 });
assert.deepEqual(actual.ak.inacc,
  { stand: .0025, crouch: 0, move: .17506, jump: .14076, fire: 0, recover: .368 });
assert.deepEqual(actual.ironbeast.inacc,
  { stand: .0313, crouch: .00443, move: .1309, jump: .1295, fire: .0198, recover: .33856 });

const main = fs.readFileSync(new URL('scripts/main.js', root), 'utf8');
const headshots = fs.readFileSync(new URL('scripts/headshot_damage.js', root), 'utf8');
const melee = fs.readFileSync(new URL('scripts/melee.js', root), 'utf8');
assert.match(main, /function activeWeaponDef/);
assert.match(main, /IRONBEAST_RUNTIME_DEF/);
assert.match(main, /const def = activeWeaponDef\(currentId\);/);
assert.match(main, /IRONBEAST_MAG_SIZE = WEAPON_TUNING\.ironbeast\.stats\.magSize/);
assert.match(main, /VIEWMODEL_POSE_DEFAULTS[\s\S]*scar: WEAPON_TUNING\.scar\.pose/);
assert.match(headshots, /m200: WEAPON_TUNING\.m200\.stats\.head/);
assert.match(headshots, /akgold: WEAPON_TUNING\.akgold\.stats\.head/);
assert.match(melee, /approved\.lightDmg/);
assert.doesNotMatch(main, /cf-weapon-tuner-draft-v1/,
  'formal game must not read mutable browser preview drafts');

console.log('approved weapon tuning checks passed');
