import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const retained = [
  'HumanM@WeaponHold_AssaultRifle01.fbx',
  'HumanM@AssaultRifle_Aim01.fbx',
  'HumanM@AssaultRifle_Aim01_Shoot01.fbx',
  'HumanM@AssaultRifle_Reload01.fbx',
  'HumanM@Walk01_Forward.fbx',
  'HumanM@Walk01_Left.fbx',
  'HumanM@Walk01_Right.fbx',
  'HumanM@Run01_Forward.fbx',
];
const js = await read('preview/npc-motion.js');
const unity = await read('preview/unity-skin-motion.js');
const html = await read('preview/npc-motion.html');
const game = [await read('scripts/main.js'), await read('scripts/enemies.js'),
  await read('scripts/bio_mode.js')].join('\n');

for (const file of retained) {
  assert.ok((await stat(new URL(`assets/preview/human_soldier/${file}`, root))).size > 30_000);
  assert.ok(js.includes(file));
  assert.ok(unity.includes(file));
}
const actual = (await readdir(new URL('assets/preview/human_soldier/', root)))
  .filter(name => name.endsWith('.fbx')).sort();
assert.deepEqual(actual, [...retained, 'HumanM_Model.fbx', 'Human_AssaultRifle.fbx'].sort(),
  'no unused Human Soldier animation files remain');
assert.match(html, /正式 NPC 已恢复奥摩/);
assert.match(html, /7 CLIPS/);
assert.doesNotMatch(game, /loadHumanSoldier|HumanSoldierRig|human_soldier\.js/);
assert.match(game, /loadFoxSoldier|FoxSoldierRig/);
console.log('PASS: isolated Human Soldier previews remain available; the game uses source Fox.');
