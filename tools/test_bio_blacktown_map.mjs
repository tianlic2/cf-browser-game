// Run with: node --experimental-default-type=module tools/test_bio_blacktown_map.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BIO_BLACKTOWN_LAYOUT } from '../scripts/bio_blacktown_config.js';
import { prepareGoldsrcCollision } from '../scripts/goldsrc_surface.js';
import { GroundNavigation } from '../scripts/navigation.js';
import { intersectsBrush } from '../scripts/brush_collision.js';
import { readChunkedMap } from './read_chunked_asset.mjs';

const base = new URL('../assets/classic/blacktown/', import.meta.url);
const { map, binary: bytes } = readChunkedMap(base);
const binary = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const surfaces = prepareGoldsrcCollision(map, binary);
const navigation = new GroundNavigation(map.colliders, map.bounds, {
  maxHeight: 20, step: .85, climb: .56, ...surfaces,
});

for (const [label, points] of [
  ['power box', [BIO_BLACKTOWN_LAYOUT.powerBox]],
  ['wreck', BIO_BLACKTOWN_LAYOUT.wrecks.map(({ x, y, z }) => [x, y, z])],
  ['hold', BIO_BLACKTOWN_LAYOUT.holdPoints],
]) {
  for (const [x, y, z] of points) {
    const visible = surfaces.surfaceAt(x, z, y + .04);
    assert.ok(Number.isFinite(visible) && Math.abs(visible - y) < .035,
      `${label} at ${x},${z} sits on a visible Black Town surface`);
    const node = navigation.nearest(x, z, y);
    assert.ok(node >= 0 && Math.abs(navigation.point(node).y - y) < .57,
      `${label} at ${x},${z} has a nearby navigation node`);
  }
}

// Mode dressing must sit in broad authored spaces, never in the narrow lanes
// where a visible prop plus its collision proxy could seal the only route.
for (const [label, points] of [
  ['power box', [BIO_BLACKTOWN_LAYOUT.powerBox]],
  ['wreck', BIO_BLACKTOWN_LAYOUT.wrecks.map(({ x, y, z }) => [x, y, z])],
]) {
  for (const [x, y, z] of points) {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      const px = x + Math.cos(angle) * 4, pz = z + Math.sin(angle) * 4;
      const floor = surfaces.surfaceAt(px, pz, y + .6);
      assert.ok(Number.isFinite(floor) && Math.abs(floor - y) < .15,
        `${label} at ${x},${z} keeps a four-metre visible floor ring`);
      assert.ok(!map.colliders.some(c => intersectsBrush(c, px, pz, floor,
        .46, .56, 1.78, map.colliders, surfaces.surfaceAt, surfaces.blockerAt)),
      `${label} at ${x},${z} keeps a four-metre walkable clearance ring`);
    }
  }
}

for (const hold of BIO_BLACKTOWN_LAYOUT.holdPoints) {
  navigation.update({ x: hold[0], y: hold[1], z: hold[2] });
  for (const spawn of map.spawns.player.slice(0, 5)) {
    const node = navigation.nearest(spawn[0], spawn[2], spawn[1]);
    assert.ok(node >= 0 && navigation.distance[node] >= 0,
      `human spawn can route to hold point ${hold[0]},${hold[2]}`);
  }
}

const main = readFileSync(new URL('../scripts/main.js', import.meta.url), 'utf8');
const bioMap = readFileSync(new URL('../scripts/bio_map.js', import.meta.url), 'utf8');
const lobby = readFileSync(new URL('../scripts/lobby.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(bioMap, /buildBlacktownMap\(scene/, 'bio mode builds an independent Black Town instance');
assert.match(bioMap, /bio-blacktown-rain/, 'bio Black Town includes dynamic rain');
assert.match(bioMap, /wrecked_suv\.glb/, 'bio Black Town includes wrecked cars');
assert.match(bioMap, /power_box\.glb/, 'the former power box remains as a decorative prop');
assert.doesNotMatch(bioMap, /setPower|defenseLights|powerLight|statusMaterial/,
  'the decorative power box has no lighting or gameplay controller');
assert.doesNotMatch(bioMap, /bio-pyramid|factoryBlock|overhead-crane/,
  'the retired procedural bio arena is no longer built');
assert.match(main, /mapCatalog\.blacktown = await buildBlacktownMap/,
  'TDM Black Town remains registered independently');
assert.match(main, /mapCatalog\.bio = await buildBioMap/,
  'bio Black Town remains registered as the mode-specific map');
assert.doesNotMatch(main, /repairPower|bioObjective|onPowerRestored/,
  'the main loop exposes no power interaction, objective HUD, or restore callback');
assert.doesNotMatch(lobby, /配电箱旁恢复照明|keys:\s*\["E"\]/,
  'the combat manual no longer advertises the removed E-key interaction');
assert.doesNotMatch(html, /bioObjective|EMERGENCY POWER|配电系统离线/,
  'the removed power objective has no dormant HTML panel');

const bioMode = readFileSync(new URL('../scripts/bio_mode.js', import.meta.url), 'utf8');
assert.doesNotMatch(bioMode, /POWER_REPAIR_TIME|POWER_DURATION|repairPower|powerRepair|powerTime|setPower|onPowerRestored/,
  'infection rules contain no power repair state or effects');
assert.doesNotMatch(bioMode, /const lit =|\.78 : 1/,
  'zombie speed is no longer modified by defense lighting');

console.log(`PASS: Bio Black Town uses the original city collision with rain, ` +
  `${BIO_BLACKTOWN_LAYOUT.wrecks.length} wrecks, ${BIO_BLACKTOWN_LAYOUT.holdPoints.length} reachable hold points.`);
