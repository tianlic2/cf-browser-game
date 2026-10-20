// Run with: node --experimental-default-type=module tools/test_bio_performance.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BIO_HUMAN_SENSE_INTERVAL, BIO_ZOMBIE_ROUTE_INTERVAL,
  BIO_ZOMBIE_SENSE_INTERVAL, bioAnimationInterval, bioBudgetDue,
  bioSenseOffset } from '../scripts/bio_performance.js';
import { intersectsBrush } from '../scripts/brush_collision.js';
import { prepareGoldsrcCollision } from '../scripts/goldsrc_surface.js';
import { GroundNavigation } from '../scripts/navigation.js';
import { readChunkedMap } from './read_chunked_asset.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const bio = read('scripts/bio_mode.js');
const main = read('scripts/main.js');

assert.equal(BIO_ZOMBIE_SENSE_INTERVAL, .12, 'zombie LOS refreshes at about 8 Hz');
assert.equal(BIO_HUMAN_SENSE_INTERVAL, .14, 'human LOS refreshes at about 7 Hz');
assert.equal(BIO_ZOMBIE_ROUTE_INTERVAL, .18, 'zombie flow-field steering is cached');
assert.ok(bioSenseOffset(5, 12, .12) > bioSenseOffset(4, 12, .12),
  'initial perception work is staggered instead of spiking on one frame');
assert.equal(bioAnimationInterval(true, 20), 0,
  'on-screen mid-range actors keep full-rate animation');
assert.equal(bioAnimationInterval(false, 12), .10,
  'near off-screen actors use a responsive 10 Hz pose update');
assert.equal(bioAnimationInterval(false, 40), .25,
  'far off-screen actors use a 4 Hz pose update');
assert.equal(bioAnimationInterval(true, 40), .05,
  'far but visible actors retain 20 Hz animation');
assert.equal(bioBudgetDue(.119, .12), false);
assert.equal(bioBudgetDue(.12, .12), true);

assert.match(main, /new BioMode\(\{\s*scene, camera, sound: sfx/,
  'BioMode receives the live player camera for frustum LOD');
assert.match(bio, /_updateViewFrustum\(\)[\s\S]*?setFromProjectionMatrix/,
  'the camera frustum is refreshed once per bio frame');
assert.match(bio, /_nearbyColliders\(x, z\)[\s\S]*?3×3[\s\S]*?_localColliderCache/,
  'movement collision reuses a cached 3x3 spatial neighborhood');
const canMove = bio.slice(bio.indexOf('_canMove(x, z'), bio.indexOf('_actorSupport(', bio.indexOf('_canMove(x, z')));
assert.match(canMove, /const colliders = this\._nearbyColliders\(x, z\)/,
  'bio movement no longer scans every GoldSrc convex leaf');
assert.doesNotMatch(canMove, /this\.map\.colliders\.some/,
  'the full-map collision scan is absent from the hot movement path');
assert.match(bio, /z\.senseCache = refreshed;[\s\S]*?BIO_ZOMBIE_SENSE_INTERVAL/,
  'zombie perception reuses a bounded cache between LOS refreshes');
assert.match(bio, /h\.senseCache = refreshed;[\s\S]*?BIO_HUMAN_SENSE_INTERVAL/,
  'human perception reuses a bounded cache between LOS refreshes');
assert.doesNotMatch(bio, /z\.mixer\.update\(dt\)/,
  'zombie skeleton mixers are no longer advanced unconditionally every frame');
assert.match(bio, /const zombieAnimDt = this\._animationStep\(z, dt\)/,
  'zombie authored animations use visibility/distance LOD');
assert.match(bio, /const animDt = this\._animationStep\(h, dt\)/,
  'mercenary procedural skeletons use the same LOD budget');
assert.match(bio, /_zombieRoute\(z, target, dt[\s\S]*?BIO_ZOMBIE_ROUTE_INTERVAL/,
  'zombie navigation steering is reused for several render frames');
assert.match(bio, /performanceStats\(\)[\s\S]*?animationSkipRate/,
  'runtime QA exposes actual skipped animation work');

// Real-map safety proof: the cached 3×3 neighborhood must return the same
// capsule blockers as the complete 1,541-leaf list at representative nodes.
const base = new URL('../assets/classic/blacktown/', import.meta.url);
const { map, binary: bytes } = readChunkedMap(base);
const binary = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const surfaces = prepareGoldsrcCollision(map, binary);
const navigation = new GroundNavigation(map.colliders, map.bounds, {
  maxHeight: 20, step: .85, climb: .56, ...surfaces,
});
const neighborhood = cell => {
  const out = [], seen = new Set();
  const cx = cell % navigation.w, cz = Math.floor(cell / navigation.w);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const nx = cx + dx, nz = cz + dz;
    if (nx < 0 || nx >= navigation.w || nz < 0 || nz >= navigation.h) continue;
    for (const collider of navigation.local[nz * navigation.w + nx] || []) {
      if (!seen.has(collider)) { seen.add(collider); out.push(collider); }
    }
  }
  return out;
};
let samples = 0, blocked = 0, candidateTotal = 0;
for (let i = 0; i < navigation.points.length; i += 47) {
  const point = navigation.points[i];
  for (const [ox, oz] of [[0, 0], [.38, 0], [-.38, 0], [0, .38], [0, -.38]]) {
    const x = point.x + ox, z = point.z + oz;
    const cell = navigation.cell(x, z);
    if (cell < 0) continue;
    const local = neighborhood(cell);
    const fullBlocked = map.colliders.some(c => intersectsBrush(c, x, z, point.y,
      .45, .56, 1.78, map.colliders, surfaces.surfaceAt, surfaces.blockerAt));
    const localBlocked = local.some(c => intersectsBrush(c, x, z, point.y,
      .45, .56, 1.78, local, surfaces.surfaceAt, surfaces.blockerAt));
    assert.equal(localBlocked, fullBlocked,
      `local collision matches full map at ${x.toFixed(2)},${point.y.toFixed(2)},${z.toFixed(2)}`);
    samples++; blocked += Number(fullBlocked); candidateTotal += local.length;
  }
}
assert.ok(samples > 800 && blocked > 20, 'real-map audit covers open ground and solid walls');
assert.ok(candidateTotal / samples < map.colliders.length * .12,
  'the local collision list is at least eight times smaller than the full map');

console.log(`PASS: bio mode uses spatial collision, staggered perception, cached routes and frustum-aware animation LOD; ` +
  `${samples} real-map capsule samples matched full collision at ${(candidateTotal / samples).toFixed(1)} average candidates.`);
