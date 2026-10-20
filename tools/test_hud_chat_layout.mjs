import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, css] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('styles/game.css', root), 'utf8'),
]);

assert.match(html, /styles\/game\.css\?v=modern-shell-chat-layout-/,
  'the corrected HUD layout bypasses stale CSS caches');
assert.match(css, /\.hud \.hud-chat-action \{ bottom: 148px; \}\s*\.hud \.chat \{ bottom: 188px; \}/,
  'desktop stacks the chat content above its button and status panel');
assert.match(css, /@media \(max-width: 820px\)[\s\S]*?\.hud \.hud-chat-action \{ bottom: 120px; \}[\s\S]*?\.hud \.chat \{ bottom: 162px; \}/,
  'tablet layout keeps the same non-overlapping stack');
assert.match(css, /@media \(max-width: 600px\)[\s\S]*?\.hud \.hud-chat-action \{ bottom: 112px; \}[\s\S]*?\.hud \.chat \{ bottom: 154px; \}/,
  'compact layout keeps the same non-overlapping stack');

console.log('PASS: chat log, chat action, and player status occupy separate vertical bands');
