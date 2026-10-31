import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../scripts/main.js', import.meta.url), 'utf8');
const start = source.indexOf('function isSecondaryClick(e)');
const end = source.indexOf('document.addEventListener("mousedown"', start);
assert.ok(start >= 0 && end > start, 'secondary-click classifier exists');

const context = {};
vm.createContext(context);
vm.runInContext(`${source.slice(start, end)}; this.isSecondaryClick = isSecondaryClick;`, context);

assert.equal(context.isSecondaryClick({ button: 2 }), true, 'physical right button opens the scope');
assert.equal(context.isSecondaryClick({ button: 0 }), false, 'plain left button remains primary fire');
assert.equal(
  context.isSecondaryClick({ button: 0, ctrlKey: true, which: 1 }),
  false,
  'Ctrl + left button remains primary fire while crouching',
);
assert.equal(
  context.isSecondaryClick({ button: 0, ctrlKey: true, which: 3 }),
  false,
  'legacy which must not override the physical button value',
);

assert.doesNotMatch(source, /CTRL_CLICK_MS|crouchDownAt/, 'obsolete Ctrl-click timing heuristic is removed');
console.log('PASS: combat secondary fire accepts only physical mouse button 2; Ctrl + left remains primary fire.');
