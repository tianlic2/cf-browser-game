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
assert.match(fox, /createFoxHelmet\(source\.headLocalUp\)/,
  'the formal Fox receives a head-bone-following headshot-effect template');
assert.match(fox, /this\.helmetMeshes = helmet\.meshes/,
  'the inherited helmet detach path receives real Fox helmet meshes');
assert.match(fox, /for \(const mesh of this\.helmetMeshes \|\| \[\]\) mesh\.visible = false/,
  'living and pooled Fox enemies keep the effect-only helmet hidden');
assert.match(fox, /detachHelmet\(\) \{[\s\S]*mesh\.visible = true;[\s\S]*super\.detachHelmet\(\)[\s\S]*mesh\.visible = false/,
  'the hidden template is exposed only while baking the lethal-headshot prop');
assert.match(enemies, /add\(new THREE\.Vector3\(0, 4\.25, 0\)\)/,
  'a lethal headshot launches the detached helmet visibly upward');
assert.match(enemies, /drop\.bounces === 0 && impactSpeed > 1\.25/,
  'the helmet performs at most one restrained landing bounce');
assert.match(enemies, /drop\.velocity\.set\(0, 0, 0\)[\s\S]*drop\.landed = true/,
  'the helmet reaches a stable grounded state before cleanup');

assert.match(main, /enemyDrop: lifecycle\?\.enemyDrop === true/,
  'enemy weapon drops have an explicit lifecycle type');
assert.match(main, /if \(it\.enemyDrop\) \{[\s\S]*?it\.age \+= dt;[\s\S]*?scene\.remove\(it\.root\)/,
  'enemy weapon drops expire and are removed from the scene');
const enemyBranch = main.match(/if \(it\.enemyDrop\) \{[\s\S]*?\n    \} else if/)?.[0] || '';
assert.ok(enemyBranch, 'enemy weapon drop update branch exists');
assert.doesNotMatch(enemyBranch, /rotation\.y|Math\.sin/,
  'enemy weapon drops neither rotate nor bob');
assert.match(main, /const GROUND_MAX = 10/,
  'the ground keeps at most ten guns in total');
assert.match(main, /const ENEMY_DROP_LIFETIME = 20/,
  'enemy guns keep an independent twenty-second lifetime');
assert.match(main, /while \(groundItems\.length > GROUND_MAX\) scene\.remove\(groundItems\.shift\(\)\.root\)/,
  'the oldest gun is removed first when the cap is exceeded');
assert.match(main, /enemyDrop: true,[\s\S]*?lifetime: ENEMY_DROP_LIFETIME,[\s\S]*?restYaw: e\.group\.rotation\.y/,
  'enemy weapon lifetime is decoupled from corpse cleanup while preserving death yaw');
assert.match(main, /\} else \{[\s\S]*?it\.root\.rotation\.y = it\.t \* 0\.9/,
  'player-dropped weapons retain their existing pickup presentation');
assert.match(main, /PLAYER_DROP_FORWARD = 1\.35[\s\S]*?GROUND_PICKUP_RADIUS = 1\.15/,
  'player guns spawn just beyond the unchanged pickup radius');
assert.match(main, /const PLAYER_DROP_FLIGHT_TIME = \.52/,
  'player drops use a short authored throw interval');
assert.match(main, /playerThrow: \{ start: dropStart\.toArray\(\), yaw: player\.yaw \}/,
  'the player drop begins at the first-person hand-side launch position');
assert.match(main, /q \* q \* motion\.start\.x[\s\S]*?2 \* q \* p \* motion\.control\.y[\s\S]*?p \* p \* motion\.end\.z/,
  'the dropped gun follows a quadratic forward arc to the ground');
assert.match(main, /it\.root\.rotation\.y = motion\.startYaw[\s\S]*?it\.root\.rotation\.x = Math\.sin/,
  'the flying gun tumbles before settling');
assert.match(main, /true, ammo, \{[\s\S]*?playerThrow: \{/,
  'player-dropped guns remain armed while receiving the throw lifecycle');
assert.doesNotMatch(main, /d > 2\.2/,
  'the old walk-away-and-return pickup gate is removed');
assert.match(html, /main\.js\?v=/,
  'the entry page invalidates the gameplay module cache');

console.log('PASS: corpses still clear quickly, enemy guns persist for 20s with a ten-gun cap, and player drops are immediately armed.');
