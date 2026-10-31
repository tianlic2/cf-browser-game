// Run with: node --experimental-default-type=module tools/test_zone13_formal_map.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const map = read('scripts/zone13_map.js');
const main = read('scripts/main.js');
const bio = read('scripts/bio_mode.js');
const html = read('index.html');
const ignore = read('.gitignore');
const world = JSON.parse(read('assets/local/cf_bio_candidates/zone13/graybox/zone13-graybox.json'));
const atlas = JSON.parse(read('assets/local/cf_bio_candidates/zone13/graybox/zone13-material-atlas.json'));
const walk = JSON.parse(read('assets/local/cf_bio_candidates/zone13/graybox/zone13-walkmesh.json'));

assert.deepEqual(world.groups.filter((group) => group.vertexCount > 0).map((group) => group.id),
  ['atlas', 'glass'], 'all authored opaque BSP surfaces use the atlas; only Source patch glass stays separate');
assert.equal(atlas.slots.length, 70, 'all 70 locally available authored BSP textures are baked');
assert.equal(atlas.columns, 8, 'expanded atlas is indexed with its declared dynamic grid');
assert.ok(world.stats.triangles > 20000, 'formal map contains the complete Zone 13 graybox geometry');
assert.ok(walk.areas.length > 1000, 'formal map contains the Source navigation areas');
assert.ok(walk.spawnStarts.length >= 10, 'formal map has authored Source spawn starts');
assert.match(map, /zone13-material-atlas\.png/, 'formal map loads the baked material atlas');
assert.match(map, /zone13-material-atlas\.json/, 'formal map loads atlas dimensions instead of assuming 4x4');
assert.match(map, /weaponbox\.png/, 'normal weapon crates use their Source texture');
assert.match(map, /supplybox\.png/, 'airdrop crates use their Source texture');
assert.match(map, /addStaticProps[\s\S]*staticProps/, 'formal map instantiates converted vehicles and lights');
assert.match(map, /canMoveSegment/, 'formal map exposes wall-safe segment movement');
assert.match(map, /grounded && !walk\.canTraverse/,
  'airborne box approaches are not rejected by the grounded foot-support ring');
assert.match(map, /hasVerticalClearance: spatialCollision\.hasVerticalClearance/,
  'the formal map exposes stance-height ceiling checks');
assert.match(map, /supportSurfaceAt: spatialCollision\.supportSurfaceAt/,
  'visible crate and slab tops remain standing support even when NAV omits them');
assert.match(main, /const CROUCH_TOP = 1\.12/,
  'crouching has a real reduced collision hull');
assert.match(main, /staticStepHeight, actorHeight, PLAYER_RADIUS, player\.onGround/,
  'player movement passes stance and airborne state to Zone13 collision');
assert.match(map, /createZone13SpatialCollision/, 'formal map builds a local BSP collision index');
assert.match(map, /lineClear: spatialCollision\.lineClear/, 'bio LOS shares the accelerated collision index');
assert.doesNotMatch(map, /intersectObjects\(obstacles/, 'actor movement no longer raycasts the complete render mesh');
assert.match(map, /while \(spawns\.length < 12/, 'formal bio population receives twelve distinct starts');
assert.match(main, /bio: \(\) => import\('\.\/zone13_map\.js\?v=zone13-jump-2'/,
  'the game bio route loads Zone 13');
assert.match(main, /Zone 13（生化）/, 'the game metadata names the playable map');
assert.match(html, /<b>Zone 13（生化）<\/b>/, 'the lobby displays Zone 13');
assert.ok((main.match(/mapData\?\.canMoveSegment/g) || []).length >= 2,
  'player movement checks Zone 13 wall segments on both axes');
assert.ok((bio.match(/this\.map\.canMoveSegment/g) || []).length >= 2,
  'bio NPC movement checks Zone 13 wall segments on both axes');
assert.match(ignore, /\/assets\/local\/cf_bio_candidates\//,
  'third-party Zone 13 source assets remain local-only');

console.log(`PASS: Zone 13 formal integration has ${world.groups.filter((group) => group.vertexCount > 0).length} geometry batches, ` +
  `${world.stats.triangles} triangles, ${walk.areas.length} NAV areas and ${walk.spawnStarts.length} authored starts.`);
