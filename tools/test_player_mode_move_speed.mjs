// Run with: node tools/test_player_mode_move_speed.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HUMAN_RUN_SPEED, WEAPON_MOVE_SCALE, weaponMoveScale } from '../scripts/move_speed.js';
import { CF_VANILLA } from '../scripts/cf_vanilla_catalog.js';

for (const {id} of CF_VANILLA)
  assert.ok(Object.hasOwn(WEAPON_MOVE_SCALE,id), `${id} must have an explicit movement weight`);
for (const [id, expected] of Object.entries({knife:1,frag:1,flash:1,smoke:1,
  deagle:.9,cfv_elite:.9,cfv_mp5:.85,cfv_p90:.85,ak:.78,m4:.78,
  m200:.78,barrett:.6,cfv_m249:.6,awm_nature:.7,cfv_awp:.7,
  cfv_m3:.76,cfv_g3sg1:.73})) {
  assert.equal(weaponMoveScale(id),expected,`${id} movement weight`);
  assert.ok(HUMAN_RUN_SPEED*weaponMoveScale(id)>0);
}

const main = readFileSync(new URL('../scripts/main.js', import.meta.url), 'utf8');
const speedBlock = main.slice(main.indexOf('function movePlayer(dt)'), main.indexOf('const target = move.multiplyScalar(speed)'));

assert.match(speedBlock,
  /const playerMoveScale = bioMatch\(\) && bioMode\?\.playerZombie \? 1 : weaponMoveScale\(currentId\)/,
  'bio zombie player uses the same unweighted movement scale as a normal-mode knife player');
assert.doesNotMatch(speedBlock, /playerZombie \? 1\.05/,
  'bio mode no longer grants the player a hidden five-percent speed multiplier');
assert.match(speedBlock, /player\.crouching \? CROUCH_SPEED : player\.sneaking \? SNEAK_SPEED : RUN_SPEED/,
  'run, sneak and crouch continue to share the normal player constants');

console.log('PASS: player run, sneak and crouch speeds stay mode-independent; only normal weapon weight remains.');
