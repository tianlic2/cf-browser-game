import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const [catalog, rig, enemies, main, audio, bio, scarInstaller] = await Promise.all([
  read('scripts/guncatalog.js'), read('scripts/enemy_model.js'),
  read('scripts/enemies.js'), read('scripts/main.js'), read('scripts/audio.js'),
  read('scripts/bio_mode.js'), read('tools/install_scar_light.py'),
]);

// Execute the production shuffled-bag function. A normal eight-enemy wave must
// cover every backpack configuration once, including both M4 skins.
const loadouts = catalog.match(/export const ENEMY_GUN_LOADOUTS = Object\.freeze\((\[[\s\S]*?\])\);/)?.[1];
const fn = catalog.match(/export function randomGunRoll\([\s\S]*?\n\}/)?.[0];
assert.ok(loadouts && fn, 'eight-loadout enemy gun draw remains available');
const source = `const ENEMY_GUN_LOADOUTS=Object.freeze(${loadouts});\n`+
  `const DEFAULT_SKIN={ak:'classic',m4:'classic',barrett:'stock',scar:'stock',m200:'stock',akgold:'stock',kn57:'stock'};\n`+
  `const enemyGunBags=new Map();\n${fn.replace('export ', '')}\nrandomGunRoll`;
const draw = vm.runInNewContext(source, { Math: { random: () => .37 }, Map, Set, Object });
const expected = ['ak:classic','m4:classic','barrett:stock','m4:ironbeastgold',
  'scar:stock','m200:stock','akgold:stock','kn57:stock'].sort();
const firstThree = Array.from({length:3}, () => draw());
assert.deepEqual(JSON.parse(JSON.stringify(draw([{id:'barrett',skin:'stock'}]))),
  {id:'barrett',skin:'stock'}, 'a filtered draw retains its requested skin');
const rest = Array.from({length:5}, () => draw());
assert.deepEqual([...firstThree,...rest].map(x=>`${x.id}:${x.skin}`).sort(),expected,
  'a filtered draw does not consume the ordinary eight-backpack bag');

assert.match(enemies, /this\.rig\.setRifle\(opts\.rifle \|\| null, opts\.gunId\)/,
  'pooled enemies replace their visible weapon and skin on respawn');
assert.match(enemies, /this\.sniperCadence \? 1\.35/,
  'both bolt-action rifles use the heavy recoil response');
assert.match(main, /\(PUBLIC_DEPLOY \? BACKPACKS\.slice\(0,3\) : BACKPACKS\.slice\(0,8\)\)/,
  'NPCs retain the eight approved loadouts while public deployment keeps its safe subset');
assert.match(main, /sfx\.enemyShoot\(mz\.x, mz\.y, mz\.z, e\.gunId, e\.gunSkin\)/,
  'enemy shot audio retains both weapon and skin identity');
assert.match(main, /const sniper = d\?\.type === "sniper"/,
  'Barrett and M200 both use their own bolt cadence');
assert.match(rig, /setRifle\(template, gunId\)/,
  'the Fox rig accepts every respawn loadout');
assert.match(bio, /guncatalog\.js\?v=enemy-eight-guns-1/,
  'biochemical human NPCs share the same built world-model catalog instance');
assert.match(scarInstaller, /def axis\(v\): return \(-v\[0\], v\[2\], v\[1\]\)/,
  'BaiHu world import rotates its verified local -Y muzzle onto game -Z without mirroring');
assert.doesNotMatch(main, /iconId === 'scar' \? ' is-mirrored'/,
  'BaiHu icons no longer compensate for a backwards world model with a CSS mirror');

// Player and enemy playback must resolve to the same source recording, rate
// and truncation window. Only enemy spatialisation/air absorption may differ.
const sandbox=vm.createContext({addEventListener(){}});
vm.runInContext(audio.replace(/^import .*cf_vanilla_catalog\.js.*;$/m, 'const CF_VANILLA=[];').replace('export class SFX','class SFX')+'\nglobalThis.SFX=SFX;',sandbox);
const sfx=Object.create(sandbox.SFX.prototype),played=[];
sfx.ready=()=>true;
sfx._playMapped=(method,options)=>played.push({method,...options});
sfx._dist3=()=>4;sfx._absorb=()=>19000;sfx._crackLayer=()=>{};
const expectedSamples = {
  'ak:classic':'cf_ak_fire', 'm4:classic':'cf_m4c_fire',
  'barrett:stock':'barrett_fire', 'm4:ironbeastgold':'ironbeast_fire',
  'scar:stock':'scar_fire', 'm200:stock':'m200_fire',
  'akgold:stock':'akgold_fire', 'kn57:stock':'kn57_fire',
};
for (const pair of expected) {
  const [id,skin]=pair.split(':');
  const kind=['barrett','m200'].includes(id)?'sniper':'rifle';
  played.length=0;sfx.shoot(kind,id,skin);
  const player=played.find(x=>x.method==='shoot');
  played.length=0;sfx.enemyShoot(0,1,0,id,skin);
  const enemy=played.find(x=>x.method==='enemyShoot');
  assert.equal(player.sample,expectedSamples[pair],`${pair} player sample`);
  assert.equal(enemy.sample,player.sample,`${pair} NPC uses the same sample`);
  assert.equal(enemy.rate,player.rate,`${pair} NPC uses the same playback rate`);
  assert.equal(enemy.window,player.window,`${pair} NPC uses the same sample window`);
}

console.log('PASS: eight backpack primaries fill one shuffled NPC wave, retain both M4 skins and share exact player/NPC shot samples.');
