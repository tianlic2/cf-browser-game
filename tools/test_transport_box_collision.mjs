import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { intersectsBrush, canMoveThroughBrushes, brushHorizontalEscape } from '../scripts/brush_collision.js';

const mainSource = readFileSync(new URL('../scripts/main.js', import.meta.url), 'utf8');
assert.match(mainSource, /const staticStepHeight = player\.onGround \?[\s\S]*? : 0;/,
  'airborne movement must use zero step allowance');
assert.ok((mainSource.match(/canMoveThroughBrushes\(/g) || []).length >= 2,
  'both horizontal player axes must use monotonic brush recovery');
assert.match(mainSource, /depenetratePlayerFromBrushes\(0\)/,
  'vertical side overlap must be corrected before landing');

const map = JSON.parse(readFileSync(new URL('../assets/classic/transport/map.json', import.meta.url)));
for (const c of map.colliders) {
  c.x = -c.x;
  for (const plane of c.planes || []) plane[0] = -plane[0];
}

const radius = .45;
const height = 1.78;
const crates = map.colliders.filter(c => {
  const y0 = c.y0 ?? 0;
  const h = c.h - y0;
  return Math.abs(y0) < .05 && h > .9 && h < 1.15 &&
    c.hx > .5 && c.hx < 1.1 && c.hz > .5 && c.hz < 1.1;
});
assert.ok(crates.length >= 5, `expected real transport crates, got ${crates.length}`);

for (const c of crates) {
  const feet = c.h - .2;
  const sideX = c.x + c.hx + radius - .08;
  const insideX = sideX - .04;
  const outsideX = sideX + .04;

  assert.equal(intersectsBrush(c, sideX, c.z, feet, radius, .5, height), false,
    'old airborne step allowance demonstrates the early-release condition');
  assert.equal(intersectsBrush(c, sideX, c.z, feet, radius, 0, height), true,
    'airborne collision remains solid below the crate top');
  assert.equal(canMoveThroughBrushes([c], sideX, c.z, insideX, c.z,
    feet, radius, 0, height), false, 'an overlap cannot move deeper into the crate');
  assert.equal(canMoveThroughBrushes([c], sideX, c.z, outsideX, c.z,
    feet, radius, 0, height), true, 'an overlap can move back out');

  const push = brushHorizontalEscape(c, sideX, c.z, radius);
  assert.ok(push.x > 0 && Math.abs(push.z) < 1e-9, 'nearest escape points out through the contacted side');
  assert.equal(intersectsBrush(c, sideX + push.x, c.z + push.z,
    feet, radius, 0, height), false, 'side-fall recovery leaves the expanded crate bounds');
  assert.equal(intersectsBrush(c, c.x, c.z, c.h, radius, 0, height), false,
    'standing exactly on the crate top remains valid');
}

console.log(`PASS: ${crates.length} real transport crates block airborne side entry, allow outward recovery, and retain valid top landing.`);
