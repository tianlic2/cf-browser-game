import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, css, main] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('styles/game.css', root), 'utf8'),
  readFile(new URL('scripts/main.js', root), 'utf8'),
]);

for (const id of [
  'deathCountdown', 'deathKillerHealth', 'deathWeaponIcon', 'deathWeaponMeta',
  'deathKillerMarker', 'deathMarkerName', 'deathMarkerDistance',
]) assert.match(html, new RegExp(`id="${id}"`), `death review contains #${id}`);

assert.match(html, /你已阵亡 · 追踪击杀者/,
  'death review explains that the camera tracks the killer');
assert.match(css, /\.death-review[\s\S]*border-top:\s*2px solid #d69b45/,
  'death review uses the compact tactical card treatment');
assert.match(css, /\.death-enemy-marker[\s\S]*\.death-enemy-marker\.hidden/,
  'killer marker has visible and hidden states');
assert.match(css, /\.death-review[\s\S]*margin-left:\s*auto;[\s\S]*margin-right:\s*6vw/,
  'wide screens keep the review card clear of the centered killer marker');
assert.match(css, /\.hud\.dead-state \.hud-bottom-left[\s\S]*\.hud-shortcuts/,
  'death state removes irrelevant lower combat HUD');
assert.match(main, /weaponIconSvg\(weaponId, "death-weapon-svg"\)/,
  'death review uses the local weapon silhouette library');
assert.match(main, /剩余生命 \$\{Math\.max\(0, Math\.ceil\(killer\.health \|\| 0\)\)\}/,
  'killer remaining health is based on live enemy state');
assert.match(main, /距离 \$\{distance\.toFixed\(1\)\} 米/,
  'death review reports the actual horizontal kill distance');
assert.match(main, /function updateDeathKillerMarker\(\)[\s\S]*\.project\(camera\)/,
  'killer world position is projected into the death HUD');
assert.match(main, /if \(!lobbyCover && !dead\)/,
  'the first-person weapon is not rendered over the death camera');
assert.match(main, /deathCountdownEl\.textContent = `\$\{Math\.max\(0, deathT\)\.toFixed\(1\)\} 秒后复活`/,
  'countdown follows the real death timer rather than a CSS animation');
assert.match(main, /bootFinish\(\);[\s\S]*debugDeathPreview/,
  'death visual QA is gated behind an explicit local debug query');
assert.match(main, /debugDeathPreview[\s\S]*if \(dead\) deathT = 12/,
  'the isolated death preview stays visible long enough for screenshots without changing DEATH_DELAY');

console.log('PASS: death review shows killer, health, weapon, distance, world marker, and live respawn countdown.');
