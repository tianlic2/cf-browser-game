import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function localModule(name) {
  const source = fs.readFileSync(path.join(root, `preview/${name}.js`), 'utf8');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}
const { createZone13Walkmesh } = await localModule('zone13_walkmesh');
const { createZone13Round } = await localModule('zone13_round');
const { createZone13Agents } = await localModule('zone13_agents');
const { createZone13Combat, raySphere } = await localModule('zone13_combat');
const plan = JSON.parse(fs.readFileSync(path.join(root, 'assets/local/cf_bio_candidates/zone13/graybox/zone13-gameplay-plan.json'), 'utf8'));
const payload = JSON.parse(fs.readFileSync(path.join(root, 'assets/local/cf_bio_candidates/zone13/graybox/zone13-walkmesh.json'), 'utf8'));
const walkmesh = createZone13Walkmesh(payload);
const round = createZone13Round(plan, { protectedPlayerId: 1, random: () => 0 });
const agents = createZone13Agents(payload, walkmesh, round, { random: () => 0 });
const combat = createZone13Combat(agents, walkmesh, round, plan);

assert.equal(combat.maxHealth, 5800);
assert.equal(raySphere({ x: 0, y: 0, z: -5 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }, 1), 4);
round.startInfection(); agents.update(1 / 60); combat.update(1 / 60);
const target = agents.agents.find((agent) => agent.team === 'zombie' && !agent.dead);
const origin = { x: target.x, y: target.y + .9, z: target.z - 5 };
const direction = { x: 0, y: 0, z: 1 };
const first = combat.shoot(origin, direction, { damage: 36, headMultiplier: 4, knockback: 4.2 });
assert.equal(first.hit, true);
assert.equal(first.damage, 36);
assert.equal(target.health, 5764);
const beforeZ = target.z;
combat.update(.05);
assert.ok(target.z > beforeZ, 'hit direction must apply walkmesh-constrained knockback');
while (!target.dead) combat.shoot({ x: target.x, y: target.y + .9, z: target.z - 5 }, direction, { damage: 1000 });
assert.equal(combat.stats.kills, 1);
for (let index = 0; index < 61; index += 1) combat.update(.05);
assert.equal(target.dead, false);
assert.equal(target.health, 5800);
assert.equal(combat.stats.respawns, 1);
console.log('zone13 combat ok: existing AK damage, ray hit, constrained knockback, death and 3s zombie respawn');
