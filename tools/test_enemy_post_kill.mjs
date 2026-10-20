import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [enemies, main] = await Promise.all([
  readFile(new URL('scripts/enemies.js', root), 'utf8'),
  readFile(new URL('scripts/main.js', root), 'utf8'),
]);

assert.match(main, /enemyManager\.loseTarget\(killer, player\.pos\)/,
  'death handoff includes the killer and the downed position');
assert.match(enemies, /_postKillDestination\(e, killer = false\)/,
  'enemy manager provides a tactical post-kill destination');
assert.match(enemies, /e\.update\(dt, \{ pos: goal \}, this\.enemies, true, false, goal\)/,
  'dead-player interval keeps relocation simulation active while shooting stays gated');
assert.doesNotMatch(enemies, /if \(!targetAlive\) \{ e\.update\(dt, player, this\.enemies, false\); continue; \}/,
  'the old stand-still branch is removed');
assert.match(enemies, /!blind && !canSee && walkingDist <= \.75/,
  'arrived searchers preserve heading instead of snapping to world yaw zero');
assert.match(enemies, /this\.vel\.multiplyScalar\(\.55\)/,
  'kill transition preserves some movement momentum');

console.log('PASS: post-kill relocation and stable search heading are connected.');
