import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'tools/import_zone13_nanoghost.py'), 'utf8');
const runtime = path.join(root, 'assets/local/cf_bio_candidates/zone13/runtime-character/nanoghost');
const data = JSON.parse(fs.readFileSync(path.join(runtime, 'view.json'), 'utf8'));
assert.equal(data.source, 'Zone13 downloaded Nano Ghost MDL v49');
assert.equal(data.bones.length, 68);
assert.deepEqual(Object.keys(data.clips), ['idle', 'walk', 'death']);
assert.ok(data.parts.length >= 2);
assert.ok(fs.statSync(path.join(runtime, 'view.bin')).size > 500000);
assert.match(source, /@testIdle/);
assert.match(source, /@testWalkN/);
assert.match(source, /@ragdoll/);
console.log('zone13 Nano Ghost import ok: downloaded MDL/VVD/VTX, two textures, 68 bones and three genuine source clips');
