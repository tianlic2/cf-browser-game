import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../scripts/main.js', import.meta.url), 'utf8');
const start = source.indexOf('function bulletImpactSequence(');
const end = source.indexOf('// 不开镜狙击枪', start);
assert.ok(start >= 0 && end > start, 'bullet impact selector exists');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(source.slice(start, end), ctx);

const enemy = name => ({ name, dead: false });
const target = (userData = {}) => ({ userData });
const wood = target({ bulletMaterial: 'wood' });
const solid = target();
const a = enemy('front'), b = enemy('rear'), c = enemy('behind-wall');
const flesh = actor => target({ enemy: actor, part: 'body' });
const hit = (distance, object) => ({ distance, object });

const ordinary = ctx.bulletImpactSequence([
  hit(2, wood), hit(2, wood), // two coplanar triangles are one entry face
  hit(3, wood),               // exit face does not attenuate again
  hit(5, flesh(a)),
  hit(8, flesh(b)),
], { woodDamageMultiplier: .4 });
assert.deepEqual(Array.from(ordinary, h => h.distance), [2, 5],
  'ordinary firearm crosses a wood box and stops on its first enemy');
assert.equal(ordinary[0].woodEntry, true, 'wood entry remains available for impact VFX');
assert.equal(ordinary[1].damageMultiplier, .4, 'one box applies one attenuation factor');
assert.equal(ordinary[1].penetratedWood, true,
  'an enemy impact records that the bullet passed through wood first');

const twoBoxes = ctx.bulletImpactSequence([
  hit(2, wood), hit(3, wood),
  hit(6, wood), hit(7, wood),
  hit(9, flesh(a)),
], { woodDamageMultiplier: .4 });
assert.deepEqual(Array.from(twoBoxes, h => h.distance), [2, 6, 9],
  'two boxes merged into one mesh still produce two entry impacts');
assert.ok(Math.abs(twoBoxes.at(-1).damageMultiplier - .16) < 1e-12,
  'each additional wooden box multiplies the remaining damage');

const blocked = ctx.bulletImpactSequence([
  hit(2, wood), hit(3, wood), hit(4, solid), hit(5, flesh(a)),
], { woodDamageMultiplier: .4 });
assert.deepEqual(Array.from(blocked, h => h.distance), [2, 4],
  'a non-wood obstacle remains a hard stop after a penetrated crate');

const barrett = ctx.bulletImpactSequence([
  hit(1, flesh(a)), hit(1.1, flesh(a)),
  hit(2, wood), hit(3, wood),
  hit(5, flesh(b)), hit(6, solid), hit(7, flesh(c)),
], { penetratesEnemies: true, woodDamageMultiplier: .8 });
assert.deepEqual(Array.from(barrett, h => h.distance), [1, 2, 5, 6],
  'Barrett enemy penetration composes with wood penetration and stops at a solid wall');
assert.equal(barrett[0].damageMultiplier, 1, 'enemy before the box takes direct damage');
assert.equal(barrett[0].penetratedWood, false,
  'an enemy before the box remains a direct hit');
assert.equal(barrett[2].damageMultiplier, .8, 'enemy behind the box takes attenuated damage');
assert.equal(barrett[2].penetratedWood, true,
  'a Barrett target behind the box is marked as a penetrated hit');

const defs = source.slice(source.indexOf('const WEAPON_DEFS ='), source.indexOf('const PRIMARY_IDS'));
const expected = { ak: .40, m4: .85, barrett: .80, deagle: .35 };
const baseDamage = { ak: 36, m4: 33, barrett: 130, deagle: 54 };
const expectedAfterOneBox = { ak: 14, m4: 28, barrett: 104, deagle: 19 };
for (const [id, ratio] of Object.entries(expected)) {
  const from = defs.indexOf(`  ${id}:`);
  const to = defs.indexOf('\n  },', from);
  const block = defs.slice(from, to);
  const match = block.match(/woodPenetration:\s*([.\d]+)/);
  assert.ok(match, `${id} must opt into wood penetration`);
  assert.equal(Number(match[1]), ratio, `${id} wood multiplier`);
  assert.equal(Math.round(baseDamage[id] * ratio), expectedAfterOneBox[id],
    `${id} one-box close-range body damage`);
}

const fire = source.slice(source.indexOf('function fire()'), source.indexOf('// 黄金爆头'));
assert.match(fire, /woodDamageMultiplier:\s*def\.woodPenetration/,
  'live firing passes the held weapon wood multiplier');
assert.match(fire, /baseDamage \* \(h\.damageMultiplier \?\? 1\)/,
  'live damage applies the penetration multiplier after range/head calculation');
assert.match(fire, /if \(!h\.penetratedWood\) flashCrosshairHit\(\)/,
  'wood-penetrated enemy hits do not flash the crosshair red');

const classicMap = readFileSync(new URL('../scripts/classic_map.js', import.meta.url), 'utf8');
assert.match(classicMap, /'transportship\/texture_234'/, 'bare wood crate material is tagged');
assert.match(classicMap, /'transportship\/texture_80'/, 'painted wood crate material is tagged');
assert.match(classicMap, /mesh\.userData\.bulletMaterial='wood'/,
  'classic transport meshes receive semantic wood metadata');

console.log('PASS: all four firearms penetrate classic transport wooden boxes with CF-inspired per-weapon attenuation; multiple boxes stack, solid walls stop, and Barrett composes with enemy penetration.');
