import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const [html, css, main, audio] = await Promise.all([
  read('index.html'), read('styles/game.css'), read('scripts/main.js'), read('scripts/audio.js'),
]);

for (const id of [
  'goTitle', 'goMine', 'goEnemy', 'goMap', 'goMode', 'goDuration', 'goLimit',
  'goBlueRows', 'goRedRows', 'goPlayerKD', 'goPlayerScore', 'goWeaponName',
  'goLobbyBtn', 'restartBtn',
]) assert.match(html, new RegExp(`id="${id}"`), `result UI contains #${id}`);

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, 'result redesign introduces no duplicate DOM ids');
assert.match(html, /go-team-blue[\s\S]*go-team-red/, 'both CF team sections are present');
assert.match(css, /#gameover \.go-shell[\s\S]*grid-template-columns: minmax\(0, 1fr\) 286px/,
  'desktop settlement uses a scoreboard plus profile rail');
assert.match(css, /@media \(max-width: 820px\)[\s\S]*grid-template-columns: 1fr/,
  'settlement collapses safely on narrow screens');
assert.match(main, /function renderGameover\(result\)/);
assert.match(main, /roster\.slice\(\)\.sort\(\(a, b\) => b\.kills - a\.kills\)/,
  'enemy rows are ranked by their real in-match kills');
assert.match(main, /document\.getElementById\("goLobbyBtn"\).*quitMatchToLobby\(\)/,
  'the settlement can return to the room');
assert.doesNotMatch(main, /sfx\.roundEnd\(/,
  'match completion must not trigger the former synthesized result jingle');
assert.doesNotMatch(audio, /\n\s*roundEnd\s*\(/,
  'the unwanted synthesized result jingle has been removed from SFX');

console.log('PASS: CF-style dual-team result board, real roster stats, responsive layout, room/restart actions, and silent match completion.');
