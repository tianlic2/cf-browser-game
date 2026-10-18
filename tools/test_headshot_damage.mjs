import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const damageModuleSource = readFileSync(new URL('../scripts/headshot_damage.js', import.meta.url), 'utf8');
const damageModuleUrl = `data:text/javascript;base64,${Buffer.from(damageModuleSource).toString('base64')}`;
const {
  HEADSHOT_DAMAGE_AVERAGES,
  BODYSHOT_DAMAGE_AVERAGES,
  HEADSHOT_DAMAGE_MIN_FACTOR,
  HEADSHOT_DAMAGE_MAX_FACTOR,
  rollHeadshotDamage,
  rollBodyshotDamage,
} = await import(damageModuleUrl);

const expected = { ak: 140, m4: 104, barrett: 750, deagle: 120 };
assert.deepEqual({ ...HEADSHOT_DAMAGE_AVERAGES }, expected, 'configured averages');
assert.equal(HEADSHOT_DAMAGE_MIN_FACTOR, .9, 'minimum factor');
assert.equal(HEADSHOT_DAMAGE_MAX_FACTOR, 1.1, 'maximum factor');
assert.deepEqual({ ...BODYSHOT_DAMAGE_AVERAGES }, { barrett: 300 },
  'Barrett has an authored body-shot average');

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
assert.equal(rollBodyshotDamage('barrett', 0), 270, 'Barrett body lower endpoint');
assert.equal(rollBodyshotDamage('barrett', .5), 300, 'Barrett body midpoint');
assert.equal(rollBodyshotDamage('barrett', 1), 330, 'Barrett body upper endpoint');
let barrettBodyTotal = 0;
for (let i = 0; i <= 10000; i++) {
  const damage = rollBodyshotDamage('barrett', i / 10000);
  assert.ok(damage >= 270 && damage <= 330, 'Barrett body sample stays inside 270-330');
  barrettBodyTotal += damage;
}
assert.ok(Math.abs(barrettBodyTotal / 10001 - 300) < .01,
  'Barrett body samples average to 300');
assert.equal(rollBodyshotDamage('ak', .5), null,
  'other firearms keep their existing body-damage path');

const main = readFileSync(new URL('../scripts/main.js', import.meta.url), 'utf8');
const fire = main.slice(main.indexOf('function fire()'), main.indexOf('// 黄金爆头'));
assert.match(main, /import \{ rollHeadshotDamage, rollBodyshotDamage \} from "\.\/headshot_damage\.js\?v=barrett-body-random-1";/,
  'game imports the shared headshot and Barrett body rollers');
assert.match(main, /function bodyshotDamage\(def, dist, randomValue = Math\.random\(\)\)[\s\S]*rollBodyshotDamage\(def\.id, randomValue\)[\s\S]*rolled \?\? damageAt\(def, dist\)/,
  'only authored body values bypass ordinary distance falloff');
assert.match(fire, /const baseDamage = head \? headshotDamage\(def\) : bodyshotDamage\(def, h\.distance\);/,
  'live Barrett body hits use the independent random damage');
assert.match(fire, /baseDamage \* \(h\.damageMultiplier \?\? 1\)/,
  'wood penetration attenuation is applied after headshot/body randomization');
assert.doesNotMatch(fire, /Math\.max\(enemy\.maxHealth, directDamage\)|directDamage \* \(head \? 2\.2 : 1\)/,
  'legacy guaranteed-kill and bio 2.2x headshot rules are removed');

console.log('PASS: four firearm headshot averages and Barrett 300 body damage roll uniformly within 90%-110%; wood attenuation remains a later multiplier.');
