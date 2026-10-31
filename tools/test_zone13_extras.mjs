import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const extras = path.join(root, 'assets/local/cf_bio_candidates/zone13/runtime-extras');
const manifest = JSON.parse(fs.readFileSync(path.join(extras, 'manifest.json'), 'utf8'));
const map = read('scripts/zone13_map.js');
const events = read('scripts/zone13_events.js');
const audio = read('scripts/audio.js');
const main = read('scripts/main.js');
const minimap = read('scripts/minimap.js');

assert.equal(manifest.localOnly, true, 'converted Source assets remain explicitly local-only');
assert.equal(manifest.files.filter((file) => file.kind === 'overlays').length, 15,
  'all 11 power, two victory and two mutant overlays were converted');
assert.equal(manifest.files.filter((file) => file.kind === 'skybox').length, 6,
  'all six gray_sky faces were converted');
assert.equal(manifest.files.filter((file) => file.kind === 'radar').length, 1,
  'the Source overview radar was converted');
for (const file of manifest.files) {
  const output = path.join(root, file.output);
  assert.ok(fs.existsSync(output) && fs.statSync(output).size > 128, `${file.name} output exists`);
  assert.equal(fs.readFileSync(output).subarray(0, 8).toString('hex'), '89504e470d0a1a0a',
    `${file.name} is a real PNG`);
}

assert.match(map, /gray_sky.*CubeTextureLoader|CubeTextureLoader[\s\S]*gray_sky/,
  'formal Zone13 loads the six-face Source skybox');
assert.match(map, /radarOverview:[\s\S]*posX: -3832[\s\S]*posY: 2501[\s\S]*scale: 5/,
  'formal Zone13 exposes the original overview calibration');
assert.match(minimap, /setSourceOverview\(config\)[\s\S]*sourceX = wx \/ metres[\s\S]*sourceY = -wz \/ metres/,
  'radar markers use the Source-to-Three coordinate conversion');
assert.match(main, /countdown_\$\{second\}/,
  'the final ten preparation seconds use individual Source cues');
assert.match(audio, /const BIO_EXTRA_SAMPLES = \{/,
  'Zone13-only audio is kept outside the global lobby preload table');
assert.doesNotMatch(audio.slice(audio.indexOf('const SAMPLES ='), audio.indexOf('const BIO_EXTRA_SAMPLES')),
  /bio_countdown_1:/, 'Zone13 countdown does not preload before map selection');
assert.match(audio, /preloadBioExtras\(\)[\s\S]*Object\.entries\(BIO_EXTRA_SAMPLES\)/,
  'the audio controller exposes a dedicated Zone13 preload stage');
assert.match(main, /id === 'bio'\) await sfx\.preloadBioExtras\(\)/,
  'the Zone13 loading screen awaits its dedicated audio package');
for (let second = 1; second <= 10; second++)
  assert.match(audio, new RegExp(`bio_countdown_${second}:[\\s\\S]*z${second}\\.wav`), `z${second}.wav is admitted`);
for (const name of ['carstart', 'shutdown', 'drop', 'hoho', 'laser', 'container', 'drop4'])
  assert.match(audio, new RegExp(`bio_${name}:`), `${name} audio is admitted`);
assert.match(events, /cross\(10, 'hoho'\)[\s\S]*cross\(20, 'drop'\)[\s\S]*cross\(30, 'bus'\)/,
  'the first Source event chain is scheduled');
assert.match(events, /cross\(90, 'container'\)[\s\S]*cross\(130, 'drop4'\)[\s\S]*cross\(155, 'cameo'\)/,
  'the late Source event chain is scheduled');
assert.match(events, /colliders\.push\(crateCollider\)/,
  'the falling visible container installs its collider only after landing');
assert.match(events, /obstacles\.push\(crate\)/,
  'the same visible container participates in the shared bullet raycast list');
assert.match(events, /colliders\.splice\(index, 1\)/,
  'dynamic collision is removed when a round resets');
assert.match(main, /Zone13Presentation[\s\S]*zone13Presentation\.flashInfection\(\)[\s\S]*zone13Presentation\.showVictory\(winner\)/,
  'infection and victory states drive the Source overlays');

console.log('PASS: Zone13 Source HUD, radar, skybox, audio and event assets are wired as a local-only package.');
