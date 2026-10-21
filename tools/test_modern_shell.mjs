import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const [html, css, bootCss, main, audio, lobby] = await Promise.all([
  read('index.html'), read('styles/game.css'), read('styles/boot.css'),
  read('scripts/main.js'), read('scripts/audio.js'), read('scripts/lobby.js'),
]);

assert.match(html, /<title>CrossFire<\/title>/);
assert.match(html, /class="lobby-title">CrossFire<\/h1>/);
assert.match(html, /class="lobby-logo"[^>]*>CF<\/span>/);
assert.match(html, /SYSTEM DEPLOYMENT/);
assert.match(html, /<h1>正在进入大厅<\/h1>/);
assert.match(html, /团队竞技 · 经典生化 · 训练模式/);
assert.match(html, /id="mapLoadScreen"[\s\S]*id="mapLoadName"[\s\S]*id="mapLoadProgress"/,
  'selected map gets its own loading screen');
assert.doesNotMatch(main.slice(main.indexOf('async function init()')), /await build(?:Classic|Prison|Survivor|Blacktown|Bio|Lingyin)Map/,
  'initial boot never constructs a map');
for (const id of ['transport', 'prison', 'survivor', 'blacktown', 'lingyin']) {
  assert.match(main, new RegExp(`(?:${id}): \\{ name: '[^']+', poster: '\\./assets/map-posters/${id}\\.jpg'`));
  assert.ok((await stat(new URL(`assets/map-posters/${id}.jpg`, root))).size > 100_000,
    `${id} has a real local loading image`);
}
assert.match(main, /await image\.decode\(\)[\s\S]*await prepareSelectedMap\(id/,
  'poster is decoded before deferred map construction');
assert.match(main, /selectedMapId = button\.dataset\.map;[\s\S]*updateMapChoiceUi\(\)/,
  'map selection only changes lobby state');
assert.doesNotMatch(html + lobby, /战术突击|TACTICAL STRIKE|TACTICAL ASSAULT/,
  'player-facing branding uses CrossFire everywhere');

for (const id of [
  'nicknameGate', 'nicknameInput', 'nicknameEnter', 'lobbyNickname', 'modernPlayerName',
  'hudMuteBtn', 'hudFullscreenBtn', 'hudPauseBtn', 'hudSession',
  'hudBackpackBtn', 'hudChatBtn',
]) assert.match(html, new RegExp(`id="${id}"`), `modern shell contains #${id}`);

assert.match(html, /当前为本地单人房间。真人联机将在后端阶段接入/,
  'modern room is explicit about its current local-only state');
assert.match(html, /styles\/game\.css\?v=modern-shell-/,
  'modern shell CSS has a cache-busting version');
assert.match(html, /styles\/boot\.css\?v=deferred-map-loading-/,
  'deployment CSS has a cache-busting version');

assert.match(css, /#menu\.lobby[\s\S]*modern-room-grid[\s\S]*\.hud-utility/,
  'modern lobby and match chrome are both styled');
assert.match(css, /#menu\.lobby\s*\{[\s\S]{0,220}position:\s*fixed;[\s\S]{0,120}inset:\s*0;[\s\S]{0,120}z-index:\s*10;/,
  'modern lobby owns its full-screen stacking context instead of relying on legacy menu CSS');
assert.match(css, /\.nickname-gate\.hidden\s*\{\s*display:\s*none/,
  'first-run nickname gate can be dismissed');
assert.match(bootCss, /var\(--map-poster\) center \/ cover no-repeat/,
  'map loading artwork follows the selected map');
assert.match(bootCss, /\.boot-percent[\s\S]*\.boot-progress/,
  'loading percent and progress remain visible');

assert.match(main, /localStorage\.getItem\("tactical\.nickname"\)/,
  'nickname is restored locally');
assert.match(main, /localStorage\.setItem\("tactical\.nickname", clean\)/,
  'nickname is persisted locally');
assert.match(main, /debugAutoStart[\s\S]*VIEWMODEL_TUNER_ACTIVE/,
  'automated gameplay and viewmodel QA bypass the first-run gate');
assert.match(main, /bindHudAction\("hudBackpackBtn", \(\) => toggleBackpack\(\)\)/);
assert.match(main, /bindHudAction\("hudChatBtn", \(\) => chat\.open\(\)\)/);
assert.match(main, /bindHudAction\("hudPauseBtn", \(\) => \{[\s\S]*?openGameMenu\(\);\s*toggleMatchPause\(\);/);
assert.match(main, /sfx\.setMuted\(!sfx\.muted\)/);
assert.match(main, /requestFullscreen\(\)/);
assert.match(main, /本地 · \$\{modeLabel\}/,
  'HUD displays a truthful local session label for the selected mode');
assert.match(audio, /setMuted\(muted\)[\s\S]*setTargetAtTime/,
  'mute control changes the real audio buses');
assert.match(lobby, /play: "大厅"[\s\S]*arsenal: "武器图鉴"[\s\S]*storage: "仓库"/,
  'navigation labels match the modern lobby');

console.log('PASS: modern local lobby, deployment screen, match HUD, nickname flow, and functional HUD controls.');
