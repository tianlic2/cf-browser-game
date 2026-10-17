import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../scripts/actor_collision.js', import.meta.url), 'utf8');
const { overlapsActors, sweepActorAxis, findActorSpawn } = await import(
  `data:text/javascript,${encodeURIComponent(source)}`);

const person = (x, y, z) => ({ group: { position: { x, y, z } } });
const one = person(0, 0, 0);
const two = person(0, 0, 1.8);

assert.equal(sweepActorAxis(-3, 5, 0, 0, [one], null, 'x'), 3 - .908);
assert.equal(sweepActorAxis(3, -5, 0, 0, [one], null, 'x'), -(3 - .908));
assert.equal(sweepActorAxis(-.908, .5, 0, 0, [one], null, 'x'), 0);
assert.equal(sweepActorAxis(-.5, -.5, 0, 0, [one], null, 'x'), -.5);
assert.equal(sweepActorAxis(-3, 5, 0, 2.5, [one], null, 'x'), 5);
assert.equal(overlapsActors(0, 0, .5, [one]), true);
assert.equal(overlapsActors(0, 2.5, 0, [one]), false);
assert.equal(overlapsActors(0, 0, 0, [one], one), false);
const placed = findActorSpawn(0, 0, 0, [one, two], () => true);
assert.ok(placed && !overlapsActors(placed[0], placed[1], placed[2], [one, two]));
console.log('actor collision: sweep, slide, height, self exclusion and spawn clearance passed');
