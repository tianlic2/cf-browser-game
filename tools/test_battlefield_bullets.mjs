import fs from 'node:fs';
import assert from 'node:assert/strict';

const main = fs.readFileSync(new URL('../scripts/main.js', import.meta.url), 'utf8');
const vfx = fs.readFileSync(new URL('../scripts/impact_vfx.js', import.meta.url), 'utf8');

assert.match(main, /const terminalImpact = impacts\[impacts\.length - 1\]/,
  'player tracer must derive its endpoint from the resolved hit sequence');
assert.match(main, /impactVfx\.tracer\(_playerTraceStart,_playerTraceEnd,"player",\{launchDirection:_playerTraceLaunchDir\}\)/,
  'player shots must emit a tracer from the first-person muzzle area');
assert.match(main, /impactVfx\.tracer\(mz, eye, "enemy"\)/,
  'enemy hits must trace from the real enemy muzzle');
assert.match(main, /raycaster\.set\(mz, _enemyMissDir\)[\s\S]*?impactVfx\.surface\(missHit\)[\s\S]*?impactVfx\.tracer\(mz, _enemyTraceEnd, "enemy"\)/,
  'enemy misses must raycast into the world, leave a surface mark and draw their actual path');

assert.match(vfx, /this\.markLimit = 144/,
  'bullet marks must use a bounded circular instanced pool');
assert.match(vfx, /for \(let i = 0; i < 40; i\+\+\)/,
  'tracers must use a fixed-size object pool');
assert.match(vfx, /const head = Math\.min\(tracer\.distance, travel\)[\s\S]*?const tail = Math\.max\(0, travel - tracer\.segment\)/,
  'tracers must be moving short segments instead of full laser beams');
assert.match(vfx, /for \(const tracer of this\.tracers\) \{ tracer\.t = tracer\.life; tracer\.mesh\.visible = false; \}/,
  'match cleanup must hide every pooled tracer');
assert.match(vfx, /tracers: this\.tracers\.filter/,
  'debug stats must report active tracers');

console.log('battlefield bullet VFX checks passed');
