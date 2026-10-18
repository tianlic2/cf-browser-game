import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const text = path => readFileSync(new URL(path, root), 'utf8');
const index = text('index.html');
const main = text('scripts/main.js');
const enemies = text('scripts/enemies.js');
const css = text('styles/game.css');
const lobby = text('scripts/lobby.js');

assert.match(index, /data-mode="training"[^>]*>训练模式<\/button>/,
  'lobby exposes Training Mode');
assert.match(index, /id="trainingPanel"[\s\S]*id="trainingDamageTotal"[\s\S]*id="trainingDamageLog"/,
  'the right-side training damage panel is present');
assert.match(css, /\.training-panel\{[^}]*right:18px/,
  'training statistics are placed on the right');

assert.match(main, /const trainingMatch = \(\) => selectedModeId === "training"/,
  'training is an independent game mode');
assert.match(main, /trainingMatch\(\)[\s\S]{0,80}button\.dataset\.map === 'blacktown'/,
  'Training Mode only exposes Black Town');
assert.match(main, /activateMap\(id === 'bio' \? 'bio' : id === 'training' \? 'blacktown' : 'transport'\)/,
  'selecting Training Mode activates Black Town');

const swap = main.slice(main.indexOf('function canSwapBackpack()'), main.indexOf('// ---------- 切枪'));
assert.match(swap, /if \(trainingMatch\(\)\) return true;/,
  'Training Mode bypasses position and acted-this-life backpack gates');

const damage = enemies.slice(enemies.indexOf('takeDamage(amount'), enemies.indexOf('launchHelmet()'));
assert.match(damage, /if \(this\.trainingImmortal\)[\s\S]*this\.onTrainingDamage\?\.\(amount, headshot\)[\s\S]*return false;[\s\S]*this\.health -= amount/,
  'training targets report damage before health is changed and never die');
const reset = enemies.slice(enemies.indexOf('reset(x, z'), enemies.indexOf('// 玩家死亡时'));
assert.match(reset, /this\.trainingImmortal = false;[\s\S]*this\.onTrainingDamage = null;/,
  'pooled enemies lose training-only state before normal reuse');

assert.match(main, /target\.trainingImmortal = true;[\s\S]*target\.onTrainingDamage = \(amount, headshot\) => recordTrainingDamage/,
  'newly placed targets are immortal and wired to the damage logger');
assert.match(main, /trainingTargets\.some\(target =>[\s\S]{0,240}< \.75/,
  'repeated placement cannot stack targets at the same location');
assert.match(main, /if \(trainingMatch\(\)\) \{[\s\S]{0,180}target\.update\(dt, player, trainingTargets, false\);[\s\S]{0,40}return;/,
  'training targets only advance idle/flinch animation and never receive movement/attack AI');
assert.match(main, /if \(!trainingMatch\(\)\) chat\.update\(dt\);/,
  'stationary targets do not emit combat chatter');
assert.match(main, /if \(trainingMatch\(\)\) \{[\s\S]{0,120}roundTimeEl\.textContent = "自由训练"/,
  'training has no round countdown');

const reload = main.slice(main.indexOf('function startReload()'), main.indexOf('// ---------- 粒子池'));
assert.match(reload, /\(!trainingMatch\(\) && WEAPON_STATE\.reserve <= 0\)/,
  'empty finite reserves cannot block a Training Mode reload');
assert.match(reload, /const take = trainingMatch\(\) \? WEAPON_STATE\.magSize - WEAPON_STATE\.mag/,
  'Training Mode always refills the current magazine completely');
assert.match(reload, /if \(!trainingMatch\(\)\) WEAPON_STATE\.reserve -= take/,
  'Training Mode reloads never consume reserve ammunition');

const grenades = main.slice(main.indexOf('function primeGrenade()'), main.indexOf('// ---------- 近战'));
assert.match(grenades, /if\(!trainingMatch\(\)&&c\.state\.count<=0\)/,
  'Training Mode can prime a throwable regardless of its stored finite count');
assert.match(grenades, /if \(!trainingMatch\(\)\) cur\(\)\.state\.count--/,
  'frag, flash and smoke counts are not consumed in Training Mode');
assert.match(main, /ammoReserve\.textContent = trainingMatch\(\) \? "∞" : WEAPON_STATE\.reserve/,
  'the firearm HUD displays an infinite reserve in Training Mode');
assert.match(main, /ammoMag\.textContent = trainingMatch\(\) \? "∞" : cur\(\)\.state\.count;[\s\S]{0,100}ammoReserve\.textContent = trainingMatch\(\) \? "∞" : "0"/,
  'the throwable HUD displays an infinite quantity in Training Mode');
assert.match(main, /slot === "throwable" \? "× " \+ \(trainingMatch\(\) \? "∞" : st\.count\)[\s\S]{0,180}ammo\.mag \+ " \/ " \+ \(trainingMatch\(\) \? "∞" : ammo\.reserve\)/,
  'the backpack preview mirrors infinite throwables and firearm reserves');

for (const [code, action] of [
  ['KeyN', 'addTrainingTargetAtCrosshair'],
  ['Delete', 'removeAimedTrainingTarget'],
  ['F8', 'resetTrainingStats'],
]) assert.match(main, new RegExp(`e\\.code === "${code}"[\\s\\S]{0,180}${action}`),
  `${code} is wired to ${action}`);
assert.match(main, /if \(e\.shiftKey\) clearTrainingTargets\(\)/,
  'Shift+Delete clears all placed targets');
assert.match(lobby, /训练模式：在准心位置放置静止 NPC[\s\S]*训练模式：清空伤害统计/,
  'the controls are documented in the in-game key guide');

console.log('PASS: Training Mode uses Black Town, immortal stationary targets, unlimited time, unrestricted backpacks, infinite firearm reserves and infinite throwables.');
