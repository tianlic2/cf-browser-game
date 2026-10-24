import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html,css,js]=await Promise.all([
  readFile(new URL('../preview/lingyin-editor.html',import.meta.url),'utf8'),
  readFile(new URL('../preview/lingyin-editor.css',import.meta.url),'utf8'),
  readFile(new URL('../preview/lingyin-editor.js',import.meta.url),'utf8')
]);
const blockout=await readFile(new URL(
  '../lingyin-map/src/world/masterplan_blockout.ts',import.meta.url),'utf8');

assert.match(html,/灵隐寺地图编辑预览/);
assert.match(html,/"three":"\.\/vendor\/three\/build\/three\.module\.js"/);
assert.doesNotMatch(html,/node_modules/,'published editor must not depend on ignored local packages');
assert.match(await readFile(new URL('../vendor/three/examples/jsm/controls/TransformControls.js',import.meta.url),'utf8'),/class TransformControls extends Object3D/);
assert.match(html,/data-mode="translate"/);
assert.match(html,/id="collision-toggle"/);
assert.match(html,/id="undo"/);
assert.match(html,/id="copy-config"/);
assert.match(html,/data-view="boardwalk"/);
assert.match(html,/data-view="pavilion"/);
assert.match(html,/data-view="river"/);
assert.match(css,/\.panel\{/);

assert.match(js,/buildLingyinMap/,'editor must load the real in-game Lingyin scene');
assert.match(js,/map\.visuals\[1\]/,'editor must expose the low-poly collision proxies');
assert.match(js,/new TransformControls/,'editor must provide direct scene manipulation');
assert.match(js,/history\.replaceState/,'edits must survive in a shareable URL');
assert.match(js,/localStorage\.setItem/,'edits must persist locally');
assert.match(js,/undoStack/);
assert.match(js,/hillside-pilgrimage-trail/);
assert.match(js,/hall-tripod-incense-burner/);
assert.match(js,/new LingyinMasterplanBlockout/,
  'phase-one composition must remain an isolated editor overlay');
assert.match(js,/plan\.group\.position\.y=0/,
  'the blockout must inherit the world offset exactly once');
assert.doesNotMatch(js,/plan\.group\.position\.y=-3\.25/,
  'the editor must not bury the blockout with a duplicate platform offset');
assert.match(js,/phase1-west-boardwalk-v3/);
assert.match(js,/const entry=byId\.get\(id\);if\(entry\)applySnapshot/,
  'stale editor URL keys must be ignored instead of crashing the preview');
assert.match(js,/phase1-east-river/);
assert.match(js,/phase1-east-crossing/);
assert.doesNotMatch(blockout,/RIDGE_TRAILS/,
  'the reference boardwalk must not inherit the old stone-road centreline');
assert.match(blockout,/const nodes = \[/);
assert.match(blockout,/\{x:-31\.2,z:-18,y:0\}/,
  'the proposal includes a ground-level courtyard entrance');
assert.match(blockout,/\{x:-31\.2,z:-27,y:4\.35\}/,
  'the reference-like entry stair rises parallel to the courtyard wall');
assert.match(blockout,/\{x:-39\.4,z:-27,y:4\.35\}/,
  'the upper entry landing turns west onto the elevated gallery');
assert.match(blockout,/\{x:-49\.5,z:61,y:13\}/,
  'the terrace entrance keeps the original high-ridge elevation');
assert.match(blockout,/const stairSegments = new Set\(\[0,3,5,7,9\]\)/);
assert.match(blockout,/phase1-lower-pavilion-roof/);
assert.match(blockout,/phase1-west-boardwalk-v3/,
  'west-boardwalk v3 must reject stale editor transforms from the low landing');
assert.match(blockout,/phase1-waterfall-upper-pool/);
assert.match(blockout,/phase1-waterfall-plunge-pool/);
assert.doesNotMatch(blockout,/const crown=/,
  'the editor must not overlay a duplicate coplanar bridge on the permanent one');
assert.match(blockout,/phase1-east-bank-approach/);
assert.match(blockout,/const pavilionY=heightAt\(px,pz\)\+\.1/,
  'east pavilion must be grounded from the authored terrain height');
assert.match(blockout,/phase1-east-pavilion-step-/,
  'east pavilion needs a visible bank-side entrance');
assert.match(js,/oldTrail\.visible=false/,
  'the old stone route is hidden by default so it cannot obscure the proposal');
assert.match(js,/if\(params\.has\('view'\)\)applyView/,
  'proposal views can be opened directly for stable review');

console.log('lingyin editor checks passed');
