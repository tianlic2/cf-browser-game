import assert from 'node:assert/strict';
import fs from 'node:fs';

const model=fs.readFileSync(new URL('../scripts/enemy_model.js',import.meta.url),'utf8');
const preview=fs.readFileSync(new URL('../preview/npc-model-directions/pose-studio.html',import.meta.url),'utf8');
const runtime=fs.readFileSync(new URL('../preview/npc-model-directions/shared.js',import.meta.url),'utf8');

assert.match(model,/this\.poseTuning = null;/,
  'formal actors must keep preview pose tuning disabled by default');
assert.match(model,/pose\.weaponY \|\| 0[\s\S]*pose\.weaponZ \|\| 0[\s\S]*pose\.weaponPitch \|\| 0/,
  'weapon mount tuning drives the shared human rig');
assert.match(model,/ik2\(this\.armR\.sh\.position,[\s\S]*ik2\(this\.armL\.sh\.position/,
  'both hands stay on the tuned rifle through the real two-bone IK');
for(const key of ['torsoLean','torsoYaw','headPitch','headYaw','footOut','footSplit','stanceDrop',
  'weaponX','weaponY','weaponZ','weaponPitch','shoulderOut','shoulderRaise','elbowOut','elbowDrop',
  'supportX','supportY','supportZ','height','width','head','torso','arms','legs'])
  assert.match(preview,new RegExp(`data-param="${key}"`),`pose studio exposes ${key}`);
for(const action of ['carry','aim','walk','strafe','fire','reload','hit','death'])
  assert.match(preview,new RegExp(`data-pose="${action}"`),`pose studio previews ${action}`);
assert.match(runtime,/rig\.poseTuning=editable\?p:null;/,
  'only the editable preview actor receives pose tuning');

console.log('PASS: NPC model/pose studio exposes semantic body, stance, weapon and action controls while production defaults stay unchanged.');
