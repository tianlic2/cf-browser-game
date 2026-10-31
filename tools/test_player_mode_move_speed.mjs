// Run with: node tools/test_player_mode_move_speed.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
