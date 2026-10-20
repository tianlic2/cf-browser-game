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

const enemy = (name) => ({ name, dead: false });
const hit = (distance, target = null, part = 'body') => ({
  distance,
  object: { userData: target ? { enemy: target, part } : {} },
});

const a = enemy('front');
const b = enemy('middle');
const c = enemy('behind-wall');
const ordered = [
  hit(4, a, 'body'),
  hit(4.15, a, 'head'), // same actor's overlapping mesh must not double damage
  hit(8, b, 'head'),
  hit(11),              // wall stops penetration
  hit(14, c, 'body'),
];

const piercing = ctx.bulletImpactSequence(ordered, { penetratesEnemies: true });
assert.deepEqual(Array.from(piercing, h => h.distance), [4, 8, 11],
  'Barrett hits each enemy once and then stops at the wall');
assert.deepEqual(Array.from(piercing.slice(0, 2), h => h.object.userData.enemy.name), ['front', 'middle']);
assert.equal(piercing.at(-1).object.userData.enemy, undefined, 'wall impact is retained');
assert.deepEqual(Array.from(ctx.bulletImpactSequence([
  hit(3, a), hit(7, b), hit(12, c),
], { penetratesEnemies: true }), h => h.object.userData.enemy.name), ['front', 'middle', 'behind-wall'],
  'every aligned enemy is selected when no wall intervenes');

const ordinary = ctx.bulletImpactSequence(ordered);
assert.deepEqual(Array.from(ordinary, h => h.distance), [4],
  'non-penetrating weapons still resolve only the first hit');
assert.deepEqual(Array.from(ctx.bulletImpactSequence([hit(2), hit(3, a)],
  { penetratesEnemies: true }), h => h.distance), [2],
  'a wall in front blocks every enemy');
assert.equal(ctx.bulletImpactSequence([], true).length, 0, 'a miss stays a miss');

const defs = source.slice(source.indexOf('const WEAPON_DEFS ='), source.indexOf('const PRIMARY_IDS'));
assert.match(defs.slice(defs.indexOf('barrett:'), defs.indexOf('deagle:')), /penetratesEnemies:\s*true/,
  'Barrett opts into enemy penetration');
for (const id of ['ak', 'm4', 'deagle']) {
  const from = defs.indexOf(`${id}:`);
  const to = defs.indexOf('\n  },', from);
  assert.doesNotMatch(defs.slice(from, to), /penetratesEnemies/,
    `${id} must not gain enemy penetration`);
}
const fire = source.slice(source.indexOf('function fire()'), source.indexOf('// 黄金爆头'));
assert.match(fire, /bulletImpactSequence\(hits,\s*\{[\s\S]*penetratesEnemies:\s*!!def\.penetratesEnemies/,
  'the live firing path uses the weapon penetration options');
assert.match(fire, /for \(const h of impacts\)[\s\S]*damageEnemyByPlayer\(enemy,dmg,head,dir\)/,
  'the live firing path applies damage to every selected impact');

console.log('PASS: Barrett penetrates distinct aligned enemies once each, walls stop the shot, and every other gun remains first-hit only.');
