import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const fox = read('scripts/fox_soldier.js');
const main = read('scripts/main.js');
const enemies = read('scripts/enemies.js');
const bio = read('scripts/bio_mode.js');
const source = new URL('../assets/local/fox_npc/', import.meta.url);

assert.ok(fs.statSync(new URL('fox.fbx', source)).size > 1_000_000,
  'the approved source FBX is present for local play');
for (const texture of ['body.png', 'face.png', 'ddfcd20.png'])
  assert.ok(fs.statSync(new URL(texture, source)).size > 10_000,
    `the original ${texture} texture is present`);
assert.match(main, /trackAsset\(loadFoxSoldier\(\)\)/,
  'source character loads before NPCs spawn');
assert.match(enemies, /FoxSoldierRig as SoldierRig/,
  'team enemies and training targets use the same Fox rig');
assert.match(bio, /new FoxSoldierRig\(enemyModel\('m4'\)\)/,
  'bio mercenaries use the same Fox rig');
assert.match(fox, /cloneSkinned\(source\.actor\)/,
  'each NPC has independent source bones while sharing mesh data');
assert.doesNotMatch(fox, /loadClassicSoldier/,
  'a Fox load failure must not silently replace the approved visible character');
assert.match(fox, /throw new Error\('Fox 人物模型加载失败，请重试'/,
  'a Fox load failure is surfaced by the loading screen retry flow');
assert.match(fox, /if \(!source\) throw new Error\('FoxSoldierRig 创建前必须先加载 Fox 源模型'/,
  'runtime construction cannot expose the inherited classic fallback');
assert.match(fox, /this\.nativeDeath = true/,
  'native deaths do not also receive the old whole-body fall rotation');
assert.match(fox, /part === headMesh \? 'head' : 'body'/,
  'head and body remain independent hit surfaces');
assert.match(fox, /headRegion = \{/,
  'the Fox head carries an anatomical jaw boundary');
assert.equal((main.match(/isHeadshotIntersection\(h\)/g) || []).length, 3,
  'bullets, knife and rifle-butt attacks share the same headshot classification');
assert.match(fox, /this\.mixer\.update\(/,
  'source actions drive the visible skeleton');
assert.match(fox, /const move = speed > \.3 \? 'run\.001' : 'idle-calm'/,
  'all moving directions use the authored run.001 clip');
assert.match(fox, /createFoxBreathingIdle\(clips\.get\('idle1'\)\)/,
  'the short source idle is replaced with a calm stance before spawning NPCs');
assert.doesNotMatch(fox, /\? 'right'|\? 'left'|\? 'back'|\? 'walk'/,
  'directional fall clips and the extra walk clip are not selected for locomotion');
assert.doesNotMatch(fox, /bone\?\.rotateX|upperSpine\.rotateX/,
  'finger and spine bones are not incrementally rotated on every frame');
assert.doesNotMatch(fox, /\(forward\|back\|left\|right\)/,
  'directional fall clip rotations are no longer stripped as if they were movement');
assert.match(fox, /this\.hand\.getWorldPosition\(W\)/,
  'game weapon follows the source right hand');
assert.match(fox, /this\.mixer\.stopAllAction\(\)/,
  'object-pool reset clears the preceding life’s actions');
assert.doesNotMatch(main + enemies + bio, /loadClassicSoldier|ClassicSoldierRig/,
  'formal mode entry points no longer choose the old character');

console.log('PASS: the approved source Fox mesh and motions drive all three human NPC modes.');
