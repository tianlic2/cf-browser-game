import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const text = (path) => readFile(new URL(path, root), 'utf8');
const bytes = (path) => readFile(new URL(path, root));

const view = JSON.parse(await text('assets/classic/deagle_festa/view.json'));
const binary = await bytes('assets/classic/deagle_festa/view.bin');
const main = await text('scripts/main.js');
const audio = await text('scripts/audio.js');
const importer = await text('tools/import_ironbeast_view.py');

assert.equal(view.bones.length, 49, 'the supplied Desert Eagle keeps its complete 49-bone rig');
assert.deepEqual(view.parts.map((part) => part.textureName), [
  'view_glove.bmp', 'view_finger.bmp', 'view_skin.BMP', 'PV-DesertEagle_S_Festa_CFS2019.bmp',
]);
assert.equal(view.parts.filter((part) => part.weapon).length, 1,
  'only the authored Desert Eagle mesh is tagged as the weapon');
assert.equal(view.muzzleAxis, 'x', 'the Festa pistol source barrel points along animated source +X');
assert.equal(view.muzzleSign, 1);
assert.deepEqual(view.transform.slice(0, 3), [0, view.transform[1], 0]);
assert.ok(view.transform[1] > 0 && view.transform[8] < 0,
  'source +X maps to game -Z while source +Y maps to screen +X');

const expectedClips = {
  idle_0: [400, 3.99], fire: [20, .19], prefire: [20, .19], postfire: [20, .19],
  reload: [270, 2.152], select: [80, .79],
};
for (const [name, [count, duration]] of Object.entries(expectedClips)) {
  assert.equal(view.clips[name]?.count, count, `${name} keeps every authored frame`);
  assert.equal(view.clips[name]?.times.at(-1), duration, `${name} keeps its source duration`);
}
assert.deepEqual(view.events.select, [{
  name: 'SND/Desert Eagle-Silence/DesertEagleSilence_Select.WAV',
  code: 5004, type: 0, frame: 1, time: .01,
}]);
assert.deepEqual(view.events.reload.map(({ frame, time }) => [frame, time]), [
  [1, .008], [29, .232], [124, .992], [193, 1.544],
]);

for (const part of view.parts) {
  assert.ok(part.offset >= 0 && part.offset + part.count * 64 <= binary.length,
    `${part.textureName} vertex payload stays inside view.bin`);
  assert.ok((await stat(new URL(`assets/classic/deagle_festa/${part.map}`, root))).size > 100,
    `${part.map} exists`);
}
for (const [name, clip] of Object.entries(view.clips))
  assert.ok(clip.offset >= 0 && clip.offset + clip.count * view.bones.length * 28 <= binary.length,
    `${name} animation payload stays inside view.bin`);

for (const file of [
  'fire_1.wav', 'fire_2.wav', 'select.wav', 'blowback.wav', 'clipout.wav', 'clipin.wav',
  'del_blowback.wav',
]) {
  const wav = await bytes(`audio/classic/deagle_festa/${file}`);
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  assert.ok(wav.length > 1000, `${file} preserves the supplied WAV`);
}

assert.match(importer, /forward_axis = [\s\S]*?assert forward_axis in \("x", "y"\)/,
  'the repeatable importer records the source forward axis instead of guessing it');
assert.match(main, /ClassicView\.load\('deagle_festa'\)/);
assert.match(main, /const DEAGLE_FIRE_CLIPS = Object\.freeze\(\['prefire','fire','postfire'\]\)/);
assert.match(main, /if\(deagleFestaView&&vid==='deagle'\)[\s\S]*?viewArms\.root\.visible=false;[\s\S]*?deagleFestaView\.sample\(clip,t\)/,
  'the full supplied hands, weapon and animation rig replace the old first-person view');
assert.match(main, /deagle: Object\.freeze\(\{ x: \.23, y: -\.19, z: -\.55, pitch: 0, yaw: -\.04, roll: 0, scale: 1\.368 \}\)/,
  'the imported rig uses the user-approved live-tuned pose');
assert.match(main, /\{ id: "deagle", label: "沙漠之鹰", weapon: "deagle", backpack: 0 \}/,
  'the existing real-time tuner still selects the replaced Desert Eagle');
assert.match(audio, /deagle_festa_fire: \["classic\/deagle_festa\/fire_1\.wav", "classic\/deagle_festa\/fire_2\.wav"\]/);
for (const [slot, file] of [
  ['deagle_festa_select', 'select'], ['deagle_festa_blowback', 'blowback'],
  ['deagle_festa_clipout', 'clipout'], ['deagle_festa_clipin', 'clipin'],
  ['deagle_festa_del_blowback', 'del_blowback'],
]) assert.ok(audio.includes(`${slot}: ["classic/deagle_festa/${file}.wav"]`),
  `${slot} preserves the supplied action WAV`);
assert.match(audio, /deagle: \{ sample: "deagle_festa_fire", rate: 1\.00/,
  'shooting uses the two WAV files supplied beside this MDL');
assert.match(audio, /if \(wid === "deagle"\)[\s\S]*?const frames=\[1,29,124,193\];[\s\S]*?frames\[i\]\/269\*dur/,
  'reload sounds follow the four exact MDL event frames');
assert.match(main, /deagleSelectAt:id==='deagle'\?deagleFestaView\?\.eventTime\('select',[\s\S]*?DesertEagleSilence_Select\.WAV/,
  'draw sound timing comes from the supplied MDL event');
assert.doesNotMatch(audio, /cf_deagle_(?:fire|out|in|deploy):/,
  'the new rig does not preload action audio from the previous Desert Eagle package');

console.log('Festa CFS 2019 Desert Eagle: complete MDL rig, six source clips, +X barrel mapping, supplied fire WAVs and tuner wiring verified.');
