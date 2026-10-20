import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const [catalog, rig, enemies, main, bio] = await Promise.all([
  read('scripts/guncatalog.js'), read('scripts/human_soldier.js'),
  read('scripts/enemies.js'), read('scripts/main.js'), read('scripts/bio_mode.js'),
]);

// Execute the real draw function with a fixed random source. Every complete
// bag must contain each available primary, while the sniper-only override must
// not drain or change the ordinary match's next bag.
const bag = catalog.match(/const ENEMY_GUN_BAG = (\[[^;]+\]);/)?.[1];
const fn = catalog.match(/export function randomGunRoll\([\s\S]*?\n\}/)?.[0];
assert.ok(bag && fn, 'enemy gun draw remains available');
const source = `const ENEMY_GUN_IDS=['ak','m4','barrett'];\n`+
  `const ENEMY_GUN_BAG=${bag};\nlet remainingEnemyGuns=[];\n`+
  `${fn.replace('export ', '')}\nrandomGunRoll`;
const draw = vm.runInNewContext(source, {
  Math: { random: () => .37 },
  DEFAULT_SKIN: { ak: 'classic', m4: 'classic', barrett: 'stock' },
});
const first = Array.from({length: 5}, () => draw());
assert.deepEqual(Object.fromEntries(['ak','m4','barrett'].map(id =>
  [id, first.filter(roll => roll.id === id).length])),
{ ak: 2, m4: 2, barrett: 1 });
assert.deepEqual(JSON.parse(JSON.stringify(draw(['barrett']))), { id: 'barrett', skin: 'stock' });
const second = Array.from({length: 5}, () => draw());
assert.deepEqual(Object.fromEntries(['ak','m4','barrett'].map(id =>
  [id, second.filter(roll => roll.id === id).length])),
{ ak: 2, m4: 2, barrett: 1 });

assert.match(enemies, /const load = this\.loadoutPicker \? this\.loadoutPicker\(\) : null/,
  'pooled enemies draw a new weapon on every spawn');
assert.match(enemies, /e\.reset\(x, z, Object\.assign\(/);
assert.match(enemies, /this\.rig\.setRifle\(opts\.rifle \|\| null, opts\.gunId\)/,
  'reused enemies replace the prior visible weapon even when an asset is absent');
assert.match(main, /sniperOnly \? \["barrett"\] : undefined/,
  'Watch City remains sniper-only');
assert.match(main, /r\.id === "barrett" \? \(sniperOnly \? d\.stats\.interval : d\.stats\.boltTime\) : 0/,
  'a Barrett in an ordinary match still uses single-shot bolt cadence');
assert.match(main, /sfx\.enemyShoot\(mz\.x, mz\.y, mz\.z, e\.gunId\)/,
  'shot audio follows the equipped gun');
assert.match(rig, /holder\.add\(template\.clone\(true\)\);this\.nativeWeaponSocket\.add\(holder\)/,
  'the real catalog weapon is drawn in the animated right hand');
assert.match(rig, /this\.visualWeapon\.visible=!this\.nativeLoadout/,
  'the fixed authored rifle disappears when a real loadout is attached');
assert.match(rig, /this\.nativeLoadout\.localToWorld\(out\)/,
  'gunfire position follows the visible gun barrel');
assert.match(bio, /guncatalog\.js\?v=enemy-loadouts-1/,
  'biochemical NPCs share the same prebuilt world catalog');

console.log('PASS: enemy respawn loadouts span AK/M4/Barrett, sniper rules persist, and native hands/audio show the equipped gun.');
