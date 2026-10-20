import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const main = readFileSync(new URL('../scripts/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/game.css', import.meta.url), 'utf8');
const nodes = new Map();
function node(id) {
  if (!nodes.has(id)) {
    const classes = new Set(id === 'gameMenu' ? ['hidden'] : []);
    nodes.set(id, { id, attrs: {}, listeners: {}, textContent: '',
      classList: { contains: c => classes.has(c), add: c => classes.add(c), remove: c => classes.delete(c) },
      setAttribute(k, v) { this.attrs[k] = v; },
      appendChild(child) { child.parentElement = this; },
      addEventListener(type, handler) { this.listeners[type] = handler; },
      focus() {}, blur() {},
    });
  }
  return nodes.get(id);
}
let exitLocks = 0, lockRequests = 0, inputClears = 0, fullscreenRequests = 0;
const document = { getElementById: node, pointerLockElement: null,
  querySelector: () => null, activeElement: node('active'),
  exitPointerLock() { exitLocks++; this.pointerLockElement = null; },
  addEventListener() {}, fullscreenElement: null,
  documentElement: { async requestFullscreen() { fullscreenRequests++; document.fullscreenElement = this; } },
  async exitFullscreen() { document.fullscreenElement = null; },
};
const context = vm.createContext({ document, console, state: 'playing', matchPaused: false, dead: false,
  hud: node('hud'), menu: node('menu'), gameover: node('gameover'), viewport: node('viewport'),
  backpackResumePending: false, closeBackpack() {}, toggleBackpack() {}, chat: { open() {} },
  clearBackpackInput() { inputClears++; }, requestLock() { lockRequests++; }, showToast() {},
  sfx: { muted: false, cancelStreak() {}, setMuted(value) { this.muted = value; return value; } },
});
vm.runInContext(main.slice(main.indexOf('function gameMenuOpen()'), main.indexOf('function toggleMatchPause()')) +
  main.slice(main.indexOf('function toggleMatchPause()'), main.indexOf('\n}', main.indexOf('function toggleMatchPause()')) + 2), context);
vm.runInContext(main.slice(main.indexOf('function bindHudAction('), main.indexOf('\nfunction showUnlockedMenu()')), context);
node('hud').appendChild(node('hudUtility'));
document.pointerLockElement = node('viewport');
vm.runInContext('openGameMenu()', context);
assert.equal(exitLocks, 1, 'Esc menu releases the cursor');
assert.equal(node('hudUtility').parentElement, node('gameMenu'), 'buttons belong to the modal, not the covered HUD');
assert.equal(context.matchPaused, false, 'Esc alone does not pause');
assert.match(main, /querySelectorAll\("#gameMenu button"\)/, 'relocated controls join existing focus loop');

function click(id) {
  let prevented = false, stopped = false;
  node(id).listeners.click({ preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } });
  assert.ok(prevented && stopped, 'HUD click cannot leak into gameplay');
}
for (const id of ['hudMuteBtn', 'hudFullscreenBtn', 'hudPauseBtn']) {
  for (const type of ['pointerdown', 'mousedown', 'mouseup']) {
    let stopped = false;
    node(id).listeners[type]({ stopPropagation() { stopped = true; } });
    assert.ok(stopped);
  }
}
click('hudMuteBtn');
assert.equal(context.sfx.muted, true);
assert.equal(node('hudMuteBtn').attrs['aria-label'], '恢复声音');
click('hudMuteBtn');
assert.equal(context.sfx.muted, false);
click('hudFullscreenBtn');
await new Promise(setImmediate);
assert.equal(fullscreenRequests, 1);
assert.equal(node('hudFullscreenBtn').attrs['aria-pressed'], 'true');
click('hudFullscreenBtn');
await new Promise(setImmediate);
assert.equal(document.fullscreenElement, null);
click('hudPauseBtn');
assert.equal(context.matchPaused, true);
assert.equal(node('hudPauseBtn').attrs['aria-pressed'], 'true');
assert.match(node('gameMenuStatus').textContent, /游戏已暂停/);
click('hudPauseBtn');
assert.equal(lockRequests, 1);
assert.equal(context.matchPaused, true, 'resume waits for pointer lock; denial must not unpause');
context.matchPaused = false;
vm.runInContext('closeGameMenu()', context);
assert.equal(node('hudUtility').parentElement, node('hud'));
assert.equal(node('hudPauseBtn').attrs['aria-pressed'], 'false');
assert.ok(inputClears > 0);
assert.match(html, /Esc 显示鼠标/);
assert.match(css, /#gameMenu > \.hud-utility/);
console.log('PASS: menu ownership, mute/fullscreen toggles, real pause, safe resume and no fire propagation');
