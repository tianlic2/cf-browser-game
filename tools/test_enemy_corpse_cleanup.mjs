import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [enemies, main, html, fox] = await Promise.all([
  readFile(new URL('scripts/enemies.js', root), 'utf8'),
  readFile(new URL('scripts/main.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/fox_soldier.js', root), 'utf8'),
]);

assert.match(fox, /death\.setDuration\(\.70\)/,
  'the Fox authored death fall remains 0.70 seconds');
assert.match(enemies, /const CORPSE_GROUND_HOLD = 1\.0/,
  'the grounded corpse hold is one second');
assert.match(enemies, /return this\.corpseFallDuration \+ CORPSE_GROUND_HOLD/,
  'corpse cleanup begins after the fall plus the grounded hold');
assert.match(enemies, /return this\.dead && this\.corpseT >= this\.corpseLifetime/,
  'corpse pooling uses the direct lifetime threshold');
assert.doesNotMatch(enemies, /CORPSE_SINK|this\.tilt\.position\.y -= sink/,
  'the corpse no longer sinks below the floor');
assert.doesNotMatch(enemies, /drop\.group\.scale\.setScalar\(fade\)/,
  'the detached helmet is removed with the corpse instead of shrinking away');

assert.match(main, /enemyDrop: lifecycle\?\.enemyDrop === true/,
  'enemy weapon drops have an explicit lifecycle type');
assert.match(main, /if \(it\.enemyDrop\) \{[\s\S]*?it\.age \+= dt;[\s\S]*?scene\.remove\(it\.root\)/,
  'enemy weapon drops expire and are removed from the scene');
const enemyBranch = main.match(/if \(it\.enemyDrop\) \{[\s\S]*?\n    \} else \{/)?.[0] || '';
assert.ok(enemyBranch, 'enemy weapon drop update branch exists');
assert.doesNotMatch(enemyBranch, /rotation\.y|Math\.sin/,
  'enemy weapon drops neither rotate nor bob');
assert.match(main, /enemyDrop: true,[\s\S]*?lifetime: e\.corpseLifetime,[\s\S]*?restYaw: e\.group\.rotation\.y/,
  'enemy weapon and corpse share the same cleanup lifetime and death yaw');
assert.match(main, /\} else \{[\s\S]*?it\.root\.rotation\.y = it\.t \* 0\.9/,
  'player-dropped weapons retain their existing pickup presentation');
assert.match(html, /main\.js\?v=public-deploy-1/,
  'the entry page invalidates the gameplay module cache');

console.log('PASS: enemy corpses and their static dropped guns disappear together without sinking.');
