import fs from 'node:fs';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../preview/weapon-tuner.html',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../preview/weapon-tuner.css',import.meta.url),'utf8');
const js=fs.readFileSync(new URL('../preview/weapon-tuner.js',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../scripts/main.js',import.meta.url),'utf8');

assert.match(html,/全武器参数调校台/);
assert.match(html,/全枪矩阵/);
assert.match(html,/gamePreview/);
assert.match(html,/location\.protocol === 'file:'/);
assert.match(html,/127\.0\.0\.1:8123\/preview\/weapon-tuner\.html/);
assert.match(html,/weapon-tuner\.js\?v=approved-20261029/);
for(const id of ['ak','m4','barrett','ironbeast','scar','m200','akgold','kn57','deagle','knife','kukri'])
  assert.match(js,new RegExp(`${id}:gun\\('|id:'${id}'`),`missing ${id}`);
for(const key of ['magSize','reserve','dmg','head','interval','reload','rangeMod','wood'])
  assert.match(js,new RegExp(`key:'${key}'`),`missing combat field ${key}`);
for(const key of ['x','y','z','pitch','yaw','roll','scale'])
  assert.match(js,new RegExp(`key:'${key}'`),`missing pose field ${key}`);
for(const key of ['vertical','horizontal','reset','hold','viewTrack'])
  assert.match(js,new RegExp(`key:'${key}'`),`missing recoil field ${key}`);
assert.match(js,/localStorage\.setItem\(STORAGE_KEY/,'draft must persist locally');
assert.match(js,/WEAPON_TUNING\[id\]/,'formal tuning is the default baseline');
assert.match(js,/effects=\{tracer:WEAPON_TUNING\[id\]\.effects\?\.tracer \?\? true\}/,'each firearm has its own tracer setting');
assert.match(js,/typeof value==='boolean'/,'saved and imported tracer settings survive reload');
assert.match(js,/syncEffectsToGame/,'tracer changes reach the embedded game');
assert.match(main,/if \(playerTracerEnabled\(currentId,activeSkinId\(currentId\)\)\)\s*impactVfx\.tracer\(_playerTraceStart/,'only player tracers are gated');
assert.match(main,/impactVfx\.tracer\(mz, eye, "enemy"\)/,'enemy hit tracers remain enabled');
assert.match(main,/impactVfx\.tracer\(mz, _enemyTraceEnd, "enemy"\)/,'enemy miss tracers remain enabled');
assert.match(js,/undoStack/,'tuner must support undo');
assert.match(js,/schema:'cf-weapon-tuner-v1'/,'export must be versioned');
assert.match(js,/input\[data-key=/,'pose controls must bridge to the existing live tuner');
assert.match(js,/Preview draft only/,'exports must retain the preview-only boundary');
assert.doesNotMatch(main,/cf-weapon-tuner-draft-v1/,'formal game must not read unapproved tuner drafts');
assert.match(css,/\.matrix-view/);
console.log('weapon tuner preview checks passed');
