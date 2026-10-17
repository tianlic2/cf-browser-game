import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const text = (path) => readFile(new URL(path, root), 'utf8');
const bytes = (path) => readFile(new URL(path, root));

const view = JSON.parse(await text('assets/classic/axe_festa/view.json'));
const binary = await bytes('assets/classic/axe_festa/view.bin');
const main = await text('scripts/main.js');
const audio = await text('scripts/audio.js');
const melee = await text('scripts/melee.js');

assert.equal(view.bones.length, 47, 'the supplied axe keeps its complete 47-bone first-person rig');
assert.deepEqual(view.parts.map((part) => part.textureName), [
  'view_glove.bmp', 'view_finger.bmp', 'view_skin.BMP', 'PV-BCAxe_Festa_CFS2019.bmp',
]);
assert.equal(view.parts.filter((part) => part.weapon).length, 1,
  'only the authored axe mesh is tagged as the weapon; all three supplied hand/arm meshes remain');
for (const name of ['idle_0', 'select', 'combo_1', 'combo_2', 'bigshot'])
  assert.ok(view.clips[name]?.count > 1, `the original ${name} clip is present`);
assert.deepEqual(view.events.select, [{
  name: 'SND/AXE/AXE_KNIFE_PUT_UP.WAV', code: 5004, type: 0, frame: 1, time: .01,
}]);
assert.deepEqual(view.events.combo_1, [{
  name: 'SND/AXE/AXE_KNIFE_ATTACK_1.WAV', code: 5004, type: 0, frame: 1, time: .01,
}]);
assert.deepEqual(view.events.combo_2, [{
  name: 'SND/AXE/AXE_KNIFE_ATTACK_2.WAV', code: 5004, type: 0, frame: 1, time: .01,
}]);
assert.deepEqual(view.events.bigshot, [{
  name: 'SND/AXE/AXE_KNIFE_ATTACK_3.WAV', code: 5004, type: 0, frame: 57, time: .57,
}]);

for (const part of view.parts)
  assert.ok(part.offset >= 0 && part.offset + part.count * 64 <= binary.length,
    `${part.textureName} vertex payload stays inside view.bin`);
for (const [name, clip] of Object.entries(view.clips))
  assert.ok(clip.offset >= 0 && clip.offset + clip.count * view.bones.length * 28 <= binary.length,
    `${name} animation payload stays inside view.bin`);

const rootBone = view.bones.find((bone) => bone.parent < 0);
assert.ok(Math.abs(rootBone.pose[4]) > .999 && Math.abs(rootBone.pose[3]) < .001 && Math.abs(rootBone.pose[5]) < .001,
  'the (-pi, 0, pi) studio root is correctly composed as a 180-degree Y rotation');

const glb = await bytes('assets/classic/axe_festa/axe.glb');
assert.equal(glb.toString('ascii', 0, 4), 'glTF');
assert.equal(glb.readUInt32LE(4), 2);
assert.equal(glb.readUInt32LE(8), glb.length, 'the lobby/world fallback GLB is complete');
for (const file of ['attack_1.wav', 'attack_2.wav', 'attack_3.wav', 'put_up.wav']) {
  const wav = await bytes(`audio/classic/axe_festa/${file}`);
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF', `${file} preserves the supplied WAV`);
  assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  assert.ok((await stat(new URL(`audio/classic/axe_festa/${file}`, root))).size > 1000);
}

assert.match(main, /id: "knife"[\s\S]*?name: "CFS 2019 凤凰斧"[\s\S]*?model: "\.\/assets\/classic\/axe_festa\/axe\.glb"/);
assert.match(main, /ClassicView\.load\('axe_festa'\)/);
assert.match(main, /const AXE_CLIP_BY_ATTACK = Object\.freeze\(\{ light: "combo_1", thrust: "combo_2", heavy: "bigshot" \}\)/);
assert.match(main, /if\(axeView&&vid==='knife'\)[\s\S]*?viewArms\.root\.visible=false;[\s\S]*?axeView\.sample\(clip,t\)/,
  'the full supplied rig replaces the generic procedural hands in first person');
assert.match(main, /knife: Object\.freeze\(\{ x: \.64, y: -\.42, z: -1\.39, pitch: \.01, yaw: 1\.55, roll: -\.05, scale: 2\.414 \}\)/,
  'the imported rig uses the visually approved right-side composition');
assert.match(main, /const AXE_SELECT_DURATION = 1\.09/);
assert.match(main, /axeAttackSoundAt\(a\.kind,mode\)/,
  'attack foley follows the imported MDL event instead of an unrelated generic swing timestamp');
assert.match(main, /from "\.\/melee\.js\?v=axe-speed-1"/,
  'the browser cannot retain the previous melee timing module from cache');
assert.match(melee, /export const AXE_ACTION_TIME_SCALE = 1 \/ \.8/,
  'all axe action phases use the requested 80% playback speed');

const meleeModule = await import(`data:text/javascript;base64,${Buffer.from(melee).toString('base64')}`);
assert.equal(meleeModule.KNIFE.light.head, 100);
assert.equal(meleeModule.KNIFE.thrust.head, 100);
assert.equal(meleeModule.KNIFE.light.interval, .5);
assert.equal(meleeModule.KNIFE.thrust.interval, .625);
assert.equal(meleeModule.KNIFE.heavy.interval, 1.25);
assert.equal(meleeModule.KNIFE.light.hitStart, .1375);
assert.equal(meleeModule.KNIFE.light.hitEnd, .25);
assert.equal(meleeModule.KNIFE.heavy.hitStart, .475);
assert.equal(meleeModule.KNIFE.heavy.hitEnd, .6);
const oldPose = meleeModule.knifePose('heavy', .43 * 1.25);
assert.ok(oldPose.some((value) => Math.abs(value) > .01),
  'the procedural fallback pose follows the same slowed timeline');

assert.match(audio, /axe_festa_attack_1: \["classic\/axe_festa\/attack_1\.wav"\]/);
assert.match(audio, /axe_festa_attack_2: \["classic\/axe_festa\/attack_2\.wav"\]/);
assert.match(audio, /axe_festa_attack_3: \["classic\/axe_festa\/attack_3\.wav"\]/);
assert.match(audio, /axe_festa_put_up: \["classic\/axe_festa\/put_up\.wav"\]/);

globalThis.addEventListener = () => {};
const { SFX } = await import(`data:text/javascript;base64,${Buffer.from(audio).toString('base64')}`);
const sfx = new SFX();
sfx.ready = () => true;
let attempt;
sfx._playMapped = (method, options) => { attempt = { method, ...options }; return true; };
for (const [kind, id] of [['light', 'axe_festa_attack_1'], ['thrust', 'axe_festa_attack_2'], ['heavy', 'axe_festa_attack_3']]) {
  sfx.melee(kind);
  assert.equal(attempt.id, id);
  assert.equal(attempt.rate, 1);
  assert.equal(attempt.rateJitter, 0, `${kind} preserves the source recording pitch`);
}
sfx.deploy('melee', { weaponId: 'knife', axeSelectAt: .01 });
assert.equal(attempt.id, 'axe_festa_put_up');
assert.equal(attempt.delay, .01);
assert.equal(attempt.rate, 1);
assert.equal(attempt.rateJitter, 0);

console.log('Festa CFS 2019 axe model, complete authored clips, MDL sound events and original WAV mapping verified.');
