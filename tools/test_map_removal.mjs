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
assert.deepEqual(mapIds, ['transport', 'blacktown', 'lingyin', 'bio'],
  'the lobby exposes only the four retained maps');

for (const path of [
  'assets/palace/',
  'scripts/palace_map.js',
  'scripts/palace_textures.js',
  'scripts/anime_ship.js',
  'scripts/anime_post.js',
  'artifacts/anime_ship/',
  'assets/classic/prison/',
  'assets/classic/survivor/',
  'assets/map-posters/prison.jpg',
  'assets/map-posters/survivor.jpg',
  'scripts/prison_map.js',
  'scripts/prison_scale.js',
  'scripts/prison_uv.js',
  'scripts/survivor_map.js',
  'tools/import_cf_prison.py',
  'tools/import_goldsrc_survivor.py',
  'tools/test_prison_map.mjs',
  'tools/test_survivor_map.mjs',
]) assert.equal(existsSync(fileURLToPath(new URL(path, root))), false, `${path} was deleted`);

for (const [name, source] of Object.entries({ index, main, css, readme })) {
  assert.doesNotMatch(source, /王宫回廊|樱港运输船|守望之城|雪地求生|anime-theme|anime_ship|palace_map|palace_textures|anime_post|prison|survivor/i,
    `${name} has no retired-map reference`);
}

for (const id of ['transport', 'blacktown', 'lingyin', 'bio']) {
  assert.match(main, new RegExp(`${id}: \\{ name: '[^']+', poster:`), `${id} remains selectable`);
  assert.match(main, new RegExp(`${id}: \\n?\\s*\\(\\) => import\\(`), `${id} has a deferred loader`);
}

console.log('PASS: retired maps and files stay removed while the four retained maps remain registered.');
