import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../scripts/main.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/game.css', import.meta.url), 'utf8');
const styles = ['classic', 'wide', 'fine', 'cross', 'tshape', 'dot', 'ring', 'hybrid'];

assert.doesNotMatch(html + main + css, /style-compact|data-crosshair-style="compact"|"compact"/,
  'the retired compact crosshair is removed from UI, runtime and CSS');
for (const style of styles) {
  assert.match(html, new RegExp(`data-crosshair-style="${style}"`), `${style} appears in settings`);
  assert.match(main, new RegExp(`"${style}"`), `${style} is accepted by runtime`);
}
assert.equal((html.match(/data-crosshair-color=/g) || []).length, 8,
  'eight preset colours are exposed');
assert.match(html, /id="crosshairCustomColor" type="color"/,
  'a native custom colour picker is exposed');
assert.match(main, /cf\.crosshairColor/,
  'selected colour persists locally');
assert.match(css, /var\(--crosshair-color, #78ff8c\)/,
  'lines, dots and rings consume the selected colour variable');
assert.match(css, /\.crosshair\.hit[\s\S]*#ff3030/,
  'enemy-hit feedback still overrides the chosen colour with red');

console.log('PASS: compact crosshair removed; 8 styles, 8 presets, custom colour and red hit feedback are wired.');
