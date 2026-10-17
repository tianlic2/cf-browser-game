import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const view = JSON.parse(await read('assets/classic/barrett/view.json'));
const main = await read('scripts/main.js');
const audio = await read('scripts/audio.js');

assert.equal(view.rigs.length, 2, 'the weapon and hands preserve their distinct source bind hierarchies');
assert.equal(view.rigs[0].name, 'weapon');
assert.equal(view.rigs[1].name, 'hands');
assert.ok(view.rigs[0].bones.some((bone) => bone.name === 'Grip'));
assert.ok(view.rigs[1].bones.some((bone) => bone.name === 'v_weapon.Bip01_R_Hand'));
assert.deepEqual(view.parts.map((part) => part.kind), ['weapon', 'hands']);
assert.deepEqual(view.parts.map((part) => part.rig), [0, 1]);
assert.equal(view.parts[0].map, 'PV-BARRET.png');
assert.equal(view.parts[1].map, 'v_hands_uniform.png');
const uniformHands = readFileSync(new URL('assets/classic/barrett/v_hands_uniform.png', root));
assert.equal(uniformHands.toString('hex', 0, 8), '89504e470d0a1a0a',
  'the uniform Barrett arm atlas is a valid PNG');
assert.equal(uniformHands.readUInt32BE(16), 2048);
assert.equal(uniformHands.readUInt32BE(20), 2048,
  'the replacement keeps the exact 2048-square source UV canvas');
const bytes = readFileSync(new URL('assets/classic/barrett/view.bin', root));
assert.equal(view.weaponScale, 1, 'weapon and hands keep the exact source proportions');
assert.equal(view.muzzleAxis, 'z', 'the muzzle follows the source attachment axis after basis conversion');
const weaponPart = view.parts.find((part) => part.weapon);
const weaponBounds = Array.from({ length: 3 }, (_, axis) => {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < weaponPart.count; i++) {
    const value = bytes.readFloatLE(weaponPart.offset + i * 64 + axis * 4);
    min = Math.min(min, value); max = Math.max(max, value);
  }
  return max - min;
});
assert.ok(Math.max(...weaponBounds) > 50,
  'weapon positions must use source vertex coordinates, not the similarly sized normal vectors');
for (const clip of ['idle_0', 'fire', 'select', 'reload'])
  assert.ok(view.rigs.every((rig) => rig.clips[clip]?.times.length), `source ${clip} is retargeted to both rigs`);
assert.equal(view.rigs[0].clips.fire.times.length, 71, 'all original shoot frames are preserved');
assert.equal(view.rigs[1].clips.reload.times.length, 91, 'all original reload frames are preserved');
const weaponRig = view.rigs[0], boltIndex = weaponRig.bones.findIndex((bone) => bone.name === 'Bolt');
assert.ok(boltIndex >= 0, 'the source rig retains its animated bolt bone');
const selectClip = weaponRig.clips.select, boltAtFrame = (frame) =>
  bytes.readFloatLE(selectClip.offset + (frame * weaponRig.bones.length + boltIndex) * 28 + 2 * 4);
assert.notEqual(boltAtFrame(0), boltAtFrame(32),
  'the authored select clip visibly cycles the bolt before returning to idle');
assert.deepEqual(view.events.select, [{ frame: 30, time: 0.857143, name: 'Weapon_AWP.Bolt' }],
  'select sound timing is imported from the supplied QC');
assert.equal(weaponRig.clips.fire.times.at(-1), 2,
  'the supplied Barrett firing and bolt-action clip completes at exactly 2 seconds');
for (const [rigIndex, rig] of view.rigs.entries()) {
  const clip = rig.clips.idle_0;
  for (let i = 0; i < rig.bones.length; i++) {
    const at = clip.offset + i * 7 * 4;
    const bind = rig.bones[i].pose;
    if (rigIndex === 0) {
      for (let k = 0; k < 3; k++) assert.ok(Math.abs(bytes.readFloatLE(at + k * 4) - bind[k]) < 1e-4,
        `${rig.name} weapon idle preserves ${rig.bones[i].name} position`);
      const q = Array.from({length: 4}, (_, k) => bytes.readFloatLE(at + (k + 3) * 4));
      const same = q.every((value, k) => Math.abs(value - bind[k + 3]) < 1e-4);
      const negated = q.every((value, k) => Math.abs(value + bind[k + 3]) < 1e-4);
      assert.ok(same || negated, `${rig.name} weapon idle preserves ${rig.bones[i].name} rotation`);
    }
  }
}
const hands = view.rigs[1], wristIndex = hands.bones.findIndex((bone) => bone.name === 'v_weapon.Bip01_R_Hand');
assert.ok(wristIndex >= 0);
const wristAt = hands.clips.idle_0.offset + wristIndex * 7 * 4;
const wristBind = hands.bones[wristIndex].pose;
const wristIdleQ = Array.from({length: 4}, (_, k) => bytes.readFloatLE(wristAt + (k + 3) * 4));
const wristRotationDot = Math.abs(wristIdleQ.reduce((sum, value, k) => sum + value * wristBind[k + 3], 0));
assert.ok(wristRotationDot < .99,
  'idle hands must use the source weapon-holding pose, not the spread-arm reference bind pose');
assert.match(main, /ClassicView\.load\('barrett'\)/);
assert.match(main, /if\(barrettView&&vid==='barrett'\)/);
assert.match(main, /BARRETT_VIEW_POSE = Object\.freeze\(\{[\s\S]*?x: \.99, y: -\.12, z: -\.07, pitch: 0, yaw: \.14, roll: 0, scale: 4\.35,[\s\S]*?\}\)/,
  'the Barrett should match the supplied reference position, scale and three-axis angle');
assert.match(main, /const pose=viewmodelPoseLive\.barrett;[\s\S]*?barrettView\.root\.position\.set\(pose\.x\+bobX,[\s\S]*?pose\.y\+bobY[\s\S]*?pose\.z/,
  'the Barrett view uses its calibrated pose without changing internal proportions');
assert.match(main, /ClassicView\.load\('barrett'\)\.then\(v=>\{[\s\S]*?v\.root\.scale\.setScalar\(viewmodelPoseLive\.barrett\.scale\)/,
  'the Barrett uses one uniform root scale instead of distorting gun-to-hand proportions');
assert.match(main, /VIEWMODEL_TUNER_ITEMS = Object\.freeze\(\[[\s\S]*?id: "ak"[\s\S]*?id: "m4"[\s\S]*?id: "barrett"[\s\S]*?id: "ironbeast"[\s\S]*?id: "deagle"[\s\S]*?id: "knife"/,
  'the tuner covers every remaining firearm, the separate Iron Beast rig and the knife');
const tunerItems = main.slice(main.indexOf('const VIEWMODEL_TUNER_ITEMS'), main.indexOf('const VIEWMODEL_POSE_DEFAULTS'));
assert.doesNotMatch(tunerItems, /id: "(?:awm|pistol)"/,
  'removed AWM and USP do not remain in the live tuner');
assert.match(main, /deagle: Object\.freeze\(\{ x: \.23, y: -\.19, z: -\.55, pitch: 0, yaw: -\.04, roll: 0, scale: 1\.368 \}\)/,
  'the newly imported Desert Eagle uses the user-approved live-tuned pose');
assert.match(main, /key: "yaw"[^\n]*min: -6\.28, max: 6\.28/,
  'the tuner yaw range preserves the authored Desert Eagle angle');
assert.match(main, /key: "scale"[^\n]*min: \.001[^\n]*step: \.001, digits: 3/,
  'the tuner preserves the Desert Eagle authored scale at millesimal precision');
assert.doesNotMatch(main, /vid === "awm"|vid === "pistol"/,
  'removed AWM and USP no longer participate in standard viewmodel posing');
assert.match(main, /const pose=viewmodelPoseLive\.deagle;[\s\S]*?deagleFestaView\.root\.scale\.setScalar\(pose\.scale\);[\s\S]*?deagleFestaView\.root\.position\.set\(pose\.x\+bobX,[\s\S]*?deagleFestaView\.root\.rotation\.set\(pose\.pitch\+\(deploy\?0:swRx\),[\s\S]*?pose\.yaw\+\(deploy\?0:swRy\),pose\.roll\+\(deploy\?0:swRz\)\)/,
  'the Desert Eagle applies all seven live pose fields to the complete authored rig');
assert.match(main, /ak: Object\.freeze\(\{ x: \.38, y: -\.18, z: \.01, pitch: \.01, yaw: \.02, roll: 0, scale: 2\.63 \}\)/,
  'the AK uses the user-approved live-tuned pose');
assert.match(main, /m4: Object\.freeze\(\{ x: -\.42, y: -\.20, z: -\.18, pitch: 0, yaw: -1\.58, roll: 0, scale: 1\.230 \}\)/,
  'the M4 uses the user-approved live-tuned pose');
assert.match(main, /knife: Object\.freeze\(\{ x: \.64, y: -\.42, z: -1\.39, pitch: \.01, yaw: 1\.55, roll: -\.05, scale: 2\.414 \}\)/,
  'the imported Festa axe uses its calibrated complete-rig pose');
assert.match(main, /VIEWMODEL_TUNER_ACTIVE[\s\S]*?mountViewmodelTuner\(\)/,
  'the opt-in multi-weapon tuner auto-starts a live preview without affecting the normal game URL');
assert.match(main, /history\.replaceState\(null, "", url\)/,
  'the tuner persists all live pose values into the URL for handoff');
assert.match(main, /const BARRETT_SELECT_DURATION = 1\.371429/,
  'the Barrett deploy plays its complete authored bolt-rack animation at source timing');
assert.match(main, /stats: \{ magSize: 10, reserve: 20, interval: 1\.55,[^\n]*boltTime: 2\.36/,
  'Barrett firing stays locked for the deliberately slowed 2.36-second bolt cycle');
assert.match(main, /const BARRETT_FIRE_LEAD = \.20;[\s\S]*?const BARRETT_BOLT_SLOWDOWN = 1\.20/,
  'the initial firing snap stays fast while only the post-shot bolt segment is slowed by 20%');
assert.match(main, /function barrettFireElapsedAt\(sourceTime\)[\s\S]*?function barrettFireSourceAt\(elapsed\)/,
  'Barrett wall-clock and source-animation timelines have matching inverse mappings');
assert.match(main, /const authoredBoltTime = def\.id === "barrett" \? barrettBoltCycleDuration\(\) : 0;[\s\S]*?WEAPON_STATE\.boltT = Number\.isFinite\(authoredBoltTime\)/,
  'the runtime gate is synchronized to the imported Barrett fire animation duration');
assert.match(main, /clip==='fire'\?barrettFireSourceAt\(barrettFireT\)/,
  'the authored Barrett fire clip is sampled on the slowed bolt timeline');
assert.match(main, /sfx\.bolt\(def\.id, def\.id === "barrett"[\s\S]*?barrettFireElapsedAt\(50 \/ 35\)/,
  'the source bolt sound event follows the same slowed timeline');
assert.match(main, /if \(stage > 0 && WEAPON_STATE && WEAPON_STATE\.boltT > 0\) stage = 0/,
  'scope input remains blocked until the bolt cycle reaches zero');
assert.match(main, /if \(WEAPON_STATE\.boltT > 0\) return/,
  'firing remains blocked until the bolt cycle reaches zero');
assert.match(main, /if \(id === "barrett"\) return BARRETT_SELECT_DURATION/,
  'Barrett deploy timing is distinct from generic sniper timing');
assert.match(main, /barrettView\.root\.rotation\.set\(pose\.pitch\+\(deploy\?0:swRx\),[\s\S]*?pose\.yaw\+\(deploy\?0:swRy\),pose\.roll\+\(deploy\?0:swRz\)\)/,
  'the Barrett keeps its calibrated pitch/yaw/roll without adding generic switch rotation to source draw');
assert.match(main, /model: "\.\/assets\/classic\/barrett\/world\.glb"/);
assert.match(audio, /barrett \? "barrett_bolt"/,
  'Barrett switching plays only the QC-declared bolt foley');
assert.match(audio, /Number\.isFinite\(options\.selectBoltAt\) \? options\.selectBoltAt : 30 \/ 35/,
  'Barrett bolt foley uses the QC event at frame 30 of the 35 FPS clip');
assert.doesNotMatch(audio, /barrett \? "barrett_draw"/,
  'the unreferenced awp_draw sample is not layered over the QC event');
assert.match(audio, /barrett_clipout: \["classic\/barrett_clipout\.wav"\]/);
assert.match(audio, /barrett_clipin: \["classic\/barrett_clipin\.wav"\]/);
assert.match(audio, /frames=\[10,35,70\],ids=\["barrett_clipout","barrett_clipin","barrett_bolt"\]/);

globalThis.addEventListener = () => {};
const { SFX } = await import(`data:text/javascript;base64,${Buffer.from(audio).toString('base64')}`);
const sfx = new SFX();
sfx.ready = () => true;
let deployAttempt = null, extraSamples = 0;
sfx._playMapped = (method, options) => { deployAttempt = { method, ...options }; return true; };
sfx._sample = () => { extraSamples++; return {}; };
sfx.deploy('sniper', { weaponId: 'barrett', selectDur: 48 / 35, selectBoltAt: 30 / 35 });
assert.equal(deployAttempt.method, 'deploy');
assert.equal(deployAttempt.id, 'barrett_bolt');
assert.equal(deployAttempt.delay, 30 / 35);
assert.equal(deployAttempt.rate, 1);
assert.equal(deployAttempt.rateJitter, 0);
assert.equal(deployAttempt.schedule, 'bolt');
assert.equal(extraSamples, 0, 'Barrett deploy must not layer a second sniper bolt sample');
const slowedBoltDelay = .20 + (50 / 35 - .20) * 1.20;
sfx.bolt('barrett', { delay: slowedBoltDelay });
assert.equal(deployAttempt.method, 'bolt');
assert.equal(deployAttempt.id, 'barrett_bolt');
assert.equal(deployAttempt.delay, slowedBoltDelay,
  'Barrett bolt audio follows the slowed post-shot animation timeline');

const world = readFileSync(new URL('assets/classic/barrett/world.glb', root));
assert.equal(world.toString('ascii', 0, 4), 'glTF', 'source Barrett world/drop model is a GLB');
const jsonLength = world.readUInt32LE(12);
const gltf = JSON.parse(world.toString('utf8', 20, 20 + jsonLength));
assert.equal(gltf.asset.version, '2.0');
assert.ok(gltf.meshes[0].primitives[0].attributes.POSITION !== undefined);
const positionBounds = gltf.accessors[gltf.meshes[0].primitives[0].attributes.POSITION];
assert.ok(Math.max(...positionBounds.max.map((value, axis) => value - positionBounds.min[axis])) > 50,
  'world Barrett geometry preserves the source model dimensions');

console.log('PASS: Barrett source viewmodel, separate bind hierarchies, four retargeted animation clips, world GLB and source foley wiring.');
