import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const ignore = readFileSync(new URL('.gitignore', root), 'utf8');
const loader = readFileSync(new URL('scripts/fox_soldier.js', root), 'utf8');
const entry = readFileSync(new URL('index.html', root), 'utf8');
const runtime = ['scripts/main.js', 'scripts/enemies.js', 'scripts/bio_mode.js']
  .map(path => readFileSync(new URL(path, root), 'utf8')).join('\n');
const files = ['fox.fbx', 'body.png', 'face.png', 'ddfcd20.png'];

for (const file of files) {
  assert.ok(ignore.includes(`!/assets/local/fox_npc/${file}\n`),
    `${file} is explicitly published`);
  assert.ok(statSync(new URL(`assets/local/fox_npc/${file}`, root)).size > 60_000,
    `${file} is present and non-empty`);
  assert.ok(loader.includes(`assetUrl('${file}')`),
    `${file} uses the shared cache-versioned URL`);
}
assert.match(loader, /FOX_ASSET_VERSION = 'fox-published-1'/);
assert.match(entry, /scripts\/main\.js\?v=fox-published-1/);
assert.equal((runtime.match(/fox_soldier\.js\?v=fox-published-1/g) || []).length, 3);
assert.doesNotMatch(runtime, /fox_soldier\.js\?v=fox-native-4/);
assert.doesNotMatch(loader, /loadAsync\(BASE \+ '(?:fox\.fbx|body\.png|face\.png|ddfcd20\.png)'\)/);

console.log('PASS: all published Fox runtime assets are unignored, present, and cache-versioned.');
