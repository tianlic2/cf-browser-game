import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createNpcNamePool } from '../scripts/npc_names.js';

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const first = createNpcNamePool(48, seeded(17));
const second = createNpcNamePool(48, seeded(91));
assert.equal(first.length, 48);
assert.equal(new Set(first).size, first.length, 'one NPC name pool must not contain duplicates');
assert.ok(first.every(name => name.length > 0 && name.length <= 16), 'names must fit the UI limit');
assert.notDeepEqual(first, second, 'new matches must not reuse one fixed roster');
assert.ok(first.some(name => /[\u4e00-\u9fff]/.test(name)), 'pool should contain natural Chinese nicknames');
assert.ok(first.some(name => /[A-Za-z]/.test(name)), 'pool should contain English/player handles');

const main = fs.readFileSync(new URL('../scripts/main.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const bio = fs.readFileSync(new URL('../scripts/bio_mode.js', import.meta.url), 'utf8');
const enemies = fs.readFileSync(new URL('../scripts/enemies.js', import.meta.url), 'utf8');

for (const id of ['renameNicknameBtn', 'renameNicknameCardBtn', 'nicknameCancel']) {
  assert.match(html, new RegExp(`id="${id}"`), `${id} must exist in the lobby UI`);
}
assert.match(main, /renameNicknameBtn\?\.addEventListener\("click", openNicknameEditor\)/);
assert.match(main, /localStorage\.setItem\("tactical\.nickname", clean\)/,
  'renamed player names must persist locally');
assert.match(main, /lobbyNpcNames = createNpcNamePool/,
  'team roster must use the randomized name pool');
assert.match(enemies, /resetNamePool\(\)[\s\S]*?createNpcNamePool\(32\)/,
  'pooled enemies must reshuffle names for a new match');
assert.match(bio, /const mercenaryNames = createNpcNamePool/,
  'bio mercenaries must use the same human-style name generator');

console.log('player rename and randomized NPC name checks passed');
