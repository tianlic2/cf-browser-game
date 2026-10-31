import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'preview/zone13_walkmesh.js'), 'utf8');
const module = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const payload = JSON.parse(fs.readFileSync(path.join(root, 'assets/local/cf_bio_candidates/zone13/graybox/zone13-walkmesh.json'), 'utf8'));
const walkmesh = module.createZone13Walkmesh(payload);

assert.equal(walkmesh.triangleCount, 2364);
for (const spawn of payload.spawnStarts) {
  const height = walkmesh.canStand(spawn.position[0], spawn.position[2], spawn.position[1]);
  assert.ok(Number.isFinite(height), `spawn ${spawn.areaId} must stand on the walkmesh`);
}
assert.equal(walkmesh.canStand(500, 500, 0), null, 'far outside the map must be blocked');
assert.equal(payload.propColliders.length, 10, 'vehicles and utility props need collision');
assert.equal(payload.staticPropPlacements.length, 46, 'every Source static prop needs a placement record');
assert.ok(payload.staticPropPlacements.filter((placement) => placement.correctionY > 0).length >= 10, 'ground-mounted vehicles and lights need surface alignment');
const start = payload.spawnStarts[0].position;
const blocked = walkmesh.move({ x: start[0], y: start[1], z: start[2] }, 1000, 1000);
assert.deepEqual(blocked, { x: start[0], y: start[1], z: start[2] }, 'a single move cannot escape the walkmesh');
const controller = module.createZone13Controller(walkmesh, payload.actor, { x: start[0], y: start[1], z: start[2] });
const takeoff = controller.step({ dx: 0, dz: 0, jump: true }, 1 / 60);
assert.ok(takeoff.y > start[1] && !takeoff.grounded, 'jump must leave the navigation surface immediately');
let peak = takeoff.y;
for (let i = 0; i < 180; i += 1) peak = Math.max(peak, controller.step({ dx: 0, dz: 0, jump: false }, 1 / 60).y);
assert.ok(peak > start[1] + .8, 'jump needs enough clearance for map traversal testing');
assert.ok(controller.state.grounded, 'jump must land back on the navigation surface');
assert.ok(Math.abs(controller.state.y - start[1]) < .02, 'landing height must match the original floor');
const dropWalkmesh = {
  move: (position, dx, dz) => ({ x: position.x + dx, y: 0, z: position.z + dz }),
  moveAirborne: (position, dx, dz) => ({ ...position, x: position.x + dx, z: position.z + dz }),
  groundBelow: () => 0,
};
const dropController = module.createZone13Controller(dropWalkmesh, payload.actor, { x: 0, y: 2, z: 0 });
const ledgeStep = dropController.step({ dx: .1, dz: 0, jump: false }, 1 / 60);
assert.equal(ledgeStep.grounded, false, 'a downward transition must start a fall instead of snapping to the lower floor');
assert.ok(ledgeStep.y < 2 && ledgeStep.y > 1.9, 'the first drop frame must preserve continuous vertical motion');
console.log(`zone13 walkmesh ok: ${walkmesh.triangleCount} triangles, ${payload.spawnStarts.length} valid starts`);
