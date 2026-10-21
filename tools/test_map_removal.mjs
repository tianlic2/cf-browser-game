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
assert.deepEqual(mapIds, ['transport', 'prison', 'survivor', 'blacktown', 'lingyin', 'bio'],
  'the lobby exposes the six supported maps');

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

for (const id of ['transport', 'prison', 'survivor', 'blacktown', 'lingyin', 'bio']) {
  assert.match(main, new RegExp(`${id}: \\{ name: '[^']+', poster:`), `${id} remains selectable`);
  assert.match(main, new RegExp(`${id}: \\n?\\s*\\(\\) => import\\(`), `${id} has a deferred loader`);
}

console.log('PASS: retired maps stay removed while all six supported maps remain registered.');
