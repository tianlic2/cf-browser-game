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
const plan = JSON.parse(fs.readFileSync(path.join(root, 'assets/local/cf_bio_candidates/zone13/graybox/zone13-gameplay-plan.json'), 'utf8'));
const payload = JSON.parse(fs.readFileSync(path.join(root, 'assets/local/cf_bio_candidates/zone13/graybox/zone13-walkmesh.json'), 'utf8'));
const walkmesh = createZone13Walkmesh(payload);
const round = createZone13Round(plan, { random: () => 0 });
const system = createZone13Agents(payload, walkmesh, round, { random: () => 0 });

assert.equal(system.agents.length, 12);
assert.equal(system.agents.filter((agent) => agent.team === 'human').length, 12);
assert.ok(Math.hypot(system.agents[0].x - system.agents[10].x, system.agents[0].z - system.agents[10].z) > .75, 'reused spawn points must be separated to avoid instant infection');
system.setControlled(1, { x: payload.spawnStarts[0].position[0] + .1, y: payload.spawnStarts[0].position[1], z: payload.spawnStarts[0].position[2] });
system.update(1 / 60);
assert.ok(Math.abs(system.agents[0].x - (payload.spawnStarts[0].position[0] + .1)) < 1e-6, 'controlled player position must be supplied by the walker');
system.clearControlled();
assert.ok(system.route(payload.spawnStarts[0].areaId, payload.spawnStarts[1].areaId).length > 0, 'spawn areas must have a NAV route');
for (let index = 0; index < 120; index += 1) system.update(1 / 60);
for (const agent of system.agents) assert.ok(Number.isFinite(walkmesh.canStand(agent.x, agent.z, agent.y)), `agent ${agent.id} left the walkmesh`);

round.startInfection(); system.update(1 / 60);
assert.ok(system.agents.filter((agent) => agent.team === 'zombie').length >= 2);
assert.equal(system.agents.filter((agent) => agent.mother).length, 2);

const contactRound = createZone13Round(plan, { playerCount: 2, random: () => 0 });
const contactSystem = createZone13Agents(payload, walkmesh, contactRound, { random: () => 0 });
contactRound.startInfection(); contactSystem.update(1 / 60);
const zombie = contactSystem.agents.find((agent) => agent.team === 'zombie');
const victim = contactSystem.agents.find((agent) => agent.team === 'human');
victim.x = zombie.x + .2; victim.y = zombie.y; victim.z = zombie.z; victim.areaId = zombie.areaId;
for (let index = 0; index < 30; index += 1) contactSystem.update(1 / 60);
assert.equal(contactRound.state.players.find((player) => player.id === victim.id).team, 'zombie', 'close pursuit contact must infect a human');
assert.equal(zombie.attackLanded, true, 'infection must happen on the authored melee impact window');
round.reset(); system.reset();
assert.equal(system.agents.filter((agent) => agent.team === 'human').length, 12);
console.log('zone13 agents ok: 12 spawn agents, NAV routes, walkmesh confinement and contact infection');
