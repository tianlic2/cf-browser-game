import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const text = path => readFileSync(new URL(path, root), 'utf8');
const index = text('index.html');
const main = text('scripts/main.js');
const css = text('styles/game.css');
const readme = text('README.md');

const mapIds = Array.from(index.matchAll(/data-map="([^"]+)"/g), match => match[1]);
assert.deepEqual(mapIds, ['transport', 'prison', 'bio'],
  'the lobby exposes only the three supported maps');

for (const path of [
  'assets/palace/',
  'scripts/palace_map.js',
  'scripts/palace_textures.js',
  'scripts/anime_ship.js',
  'scripts/anime_post.js',
  'artifacts/anime_ship/',
]) assert.equal(existsSync(fileURLToPath(new URL(path, root))), false, `${path} was deleted`);

for (const [name, source] of Object.entries({ index, main, css, readme })) {
  assert.doesNotMatch(source, /王宫回廊|樱港运输船|anime-theme|anime_ship|palace_map|palace_textures|anime_post/,
    `${name} has no retired-map reference`);
}

assert.match(main, /mapCatalog\.transport = mapData/, 'transport remains registered');
assert.match(main, /mapCatalog\.prison = await buildPrisonMap/, 'Watch City remains registered');
assert.match(main, /mapCatalog\.bio = await buildBioMap/, 'Biohazard Zone remains registered');

console.log('PASS: Palace Corridor and Sakura Harbor Transport were fully removed while Transport Ship, Watch City, and Biohazard Zone remain registered.');
