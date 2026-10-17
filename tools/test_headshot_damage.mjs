import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const damageModuleSource = readFileSync(new URL('../scripts/headshot_damage.js', import.meta.url), 'utf8');
const damageModuleUrl = `data:text/javascript;base64,${Buffer.from(damageModuleSource).toString('base64')}`;
const {
  HEADSHOT_DAMAGE_AVERAGES,
  HEADSHOT_DAMAGE_MIN_FACTOR,
  HEADSHOT_DAMAGE_MAX_FACTOR,
  rollHeadshotDamage,
} = await import(damageModuleUrl);

const expected = { ak: 140, m4: 104, barrett: 750, deagle: 120 };
assert.deepEqual({ ...HEADSHOT_DAMAGE_AVERAGES }, expected, 'configured averages');
assert.equal(HEADSHOT_DAMAGE_MIN_FACTOR, .9, 'minimum factor');
assert.equal(HEADSHOT_DAMAGE_MAX_FACTOR, 1.1, 'maximum factor');

for (const [id, average] of Object.entries(expected)) {
  const lower = Math.round(average * .9);
  const upper = Math.round(average * 1.1);
  assert.equal(rollHeadshotDamage(id, 0), lower, `${id} lower endpoint`);
  assert.equal(rollHeadshotDamage(id, .5), average, `${id} midpoint`);
  assert.equal(rollHeadshotDamage(id, 1), upper, `${id} upper endpoint`);

  let total = 0;
  const samples = 10001;
  for (let i = 0; i < samples; i++) {
    const damage = rollHeadshotDamage(id, i / (samples - 1));
    assert.ok(damage >= lower && damage <= upper, `${id} sample stays inside bounds`);
    total += damage;
  }
  assert.ok(Math.abs(total / samples - average) < .01, `${id} samples average to ${average}`);
}

assert.equal(rollHeadshotDamage('unknown', .5), null, 'unknown weapons have no authored headshot value');
assert.equal(rollHeadshotDamage('ak', -10), 126, 'random input clamps at the lower bound');
assert.equal(rollHeadshotDamage('ak', 10), 154, 'random input clamps at the upper bound');

const main = readFileSync(new URL('../scripts/main.js', import.meta.url), 'utf8');
const fire = main.slice(main.indexOf('function fire()'), main.indexOf('// 黄金爆头'));
assert.match(main, /import \{ rollHeadshotDamage \} from "\.\/headshot_damage\.js\?v=headshot-random-1";/,
  'game imports the shared headshot roller');
assert.match(fire, /const baseDamage = head \? headshotDamage\(def\) : damageAt\(def, h\.distance\);/,
  'headshots use the independent random damage while body shots retain distance falloff');
assert.match(fire, /baseDamage \* \(h\.damageMultiplier \?\? 1\)/,
  'wood penetration attenuation is applied after headshot randomization');
assert.doesNotMatch(fire, /Math\.max\(enemy\.maxHealth, directDamage\)|directDamage \* \(head \? 2\.2 : 1\)/,
  'legacy guaranteed-kill and bio 2.2x headshot rules are removed');

console.log('PASS: AK 140, M4/炫金雷神 104, Barrett 750, and Desert Eagle 120 headshots roll uniformly within 90%-110%; body falloff and wood attenuation remain separate.');
