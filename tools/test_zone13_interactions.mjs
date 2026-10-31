import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'preview/zone13_interactions.js'), 'utf8');
const { createZone13Interactions } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const plan = JSON.parse(fs.readFileSync(path.join(root, 'assets/local/cf_bio_candidates/zone13/graybox/zone13-gameplay-plan.json'), 'utf8'));
assert.deepEqual(plan.rules.source.airdropSeconds, [60, 120]);
assert.equal(plan.rules.source.weaponPoolWeighted.length, 7);
assert.equal(plan.rules.source.weaponPoolWeighted.filter((item) => item.id === 'weapon_awp').length, 2);

const system = createZone13Interactions(plan, () => .999999);
assert.equal(system.crates.length, 12);
assert.equal(system.waves.length, 2);
assert.equal(system.activeItems().length, 12);
system.update(59.99);
assert.equal(system.waves[0].deployed, false);
system.update(60);
assert.equal(system.waves[0].deployed, true);
assert.equal(system.waves[0].active, true);
assert.ok(plan.points.filter((point) => point.kind === 'supply' && point.name === 'locone').some((point) => point.position.every((value, index) => value === system.waves[0].position[index])));

const crate = system.crates[0];
const weaponResult = system.interact(crate.position);
assert.equal(weaponResult.ok, true);
assert.equal(weaponResult.type, 'weapon');
assert.equal(weaponResult.weapon.id, 'weapon_awp');
assert.equal(system.interact(crate.position).ok, false, 'weapon crate must be single-use');

const supplyResult = system.interact(system.waves[0].position);
assert.equal(supplyResult.ok, true);
assert.equal(supplyResult.type, 'supply');
assert.deepEqual(supplyResult.grenades, ['weapon_hegrenade', 'weapon_flashbang', 'weapon_smokegrenade', 'weapon_molotov']);
assert.equal(supplyResult.refillAmmo, true);
assert.equal(system.interact(system.waves[0].position).ok, false, 'airdrop must be single-use');
assert.deepEqual(system.interact(system.crates[1].position, false), { ok: false, reason: 'human-only' });

system.update(120);
assert.equal(system.waves[1].deployed, true);
assert.ok(plan.points.filter((point) => point.kind === 'supply' && point.name === 'loctwo').some((point) => point.position.every((value, index) => value === system.waves[1].position[index])));
console.log('zone13 interactions ok: 12 single-use weapon crates, 2 timed supply waves');
