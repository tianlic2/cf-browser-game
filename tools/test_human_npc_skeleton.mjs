import assert from 'node:assert/strict';
import fs from 'node:fs';

const model = fs.readFileSync(new URL('../scripts/enemy_model.js', import.meta.url), 'utf8');
const classic = fs.readFileSync(new URL('../scripts/classic_soldier.js', import.meta.url), 'utf8');
const bio = fs.readFileSync(new URL('../scripts/bio_mode.js', import.meta.url), 'utf8');
const enemies = fs.readFileSync(new URL('../scripts/enemies.js', import.meta.url), 'utf8');
const native = fs.readFileSync(new URL('../scripts/human_soldier.js', import.meta.url), 'utf8');

assert.match(model, /export const HUMAN_NPC_POSE = Object\.freeze/,
  'all human NPCs share one explicit CF pose configuration');
assert.doesNotMatch(model, /poseProfile|MERCENARY_POSE|_mercPole/,
  'there is no mode-specific human skeleton branch');
assert.match(classic, /constructor\(rifle\)\s*\{\s*super\(rifle\)/,
  'the classic skin always uses the shared human driver');
assert.match(bio, /new HumanSoldierRig\(enemyModel\('m4'\)\)/,
  'bio mercenaries use the same native constructor as other human NPCs');
assert.match(enemies, /HumanSoldierRig as SoldierRig/,
  'TDM and training use the shared native human rig');
assert.match(enemies, /new Enemy\(this\.scene, x, z, load \|\| \{\}\)/,
  'TDM and training targets keep using the common enemy pool');
assert.match(model, /const SHOULDER_X = 0\.185[\s\S]*const SHOULDER_Y = 0\.205/,
  'the shared driver uses the narrower and lower CF shoulder line');
assert.match(model, /const footOut = HUMAN_NPC_POSE\.idleFootOut \+ \(pose\.footOut \|\| 0\);[\s\S]*const footSplit = HUMAN_NPC_POSE\.idleFootSplit \+ \(pose\.footSplit \|\| 0\);[\s\S]*footOut \* stance[\s\S]*footSplit \* stance/,
  'every idle human uses the stable staggered stance with optional isolated-preview offsets');
assert.match(model, /this\.poseTuning = null;/,
  'production human actors leave semantic pose tuning disabled by default');
assert.match(model, /this\.neck\.rotation\.y = blind[\s\S]*: 0;/,
  'idle heads stay aligned instead of oscillating');
assert.doesNotMatch(model, /human_soldier|HumanM@|FBXLoader/,
  'the gameplay hitbox driver stays independent of FBX loading');
assert.match(native, /extends ClassicSoldierRig/,
  'the approved native visual suite keeps the proven shared hitbox driver');
assert.match(model, /this\.motionSpeed \+= \(rawSpeed - this\.motionSpeed\) \* \(1 - Math\.exp\(-dt \* speedRate\)\)/,
  'locomotion speed transitions are frame-rate independent');
assert.match(model, /const locomotionRate = targetWalkW > this\.walkW \? 10\.0 : 6\.0;[\s\S]*this\.walkW \+=/,
  'start and stop use continuous gait blending instead of one-frame snaps');
assert.doesNotMatch(model, /this\.walkW = clamp01\(\(speed - 0\.25\)/,
  'raw per-frame movement speed no longer writes gait weight directly');

console.log('PASS: all human NPCs share the approved native visual suite, stable gameplay hitboxes, and smooth locomotion signals.');
