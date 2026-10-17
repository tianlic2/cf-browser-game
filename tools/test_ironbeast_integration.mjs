import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readJoinedAsset } from './read_chunked_asset.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const view = JSON.parse(await read('assets/classic/m4_ironbeast/view.json'));
const viewBytes = readJoinedAsset(new URL('assets/classic/m4_ironbeast/', root), view.binaryParts);
const audio = await read('scripts/audio.js');
const main = await read('scripts/main.js');
const skins = await read('scripts/skins.js');
const enemies = await read('scripts/enemies.js');
const qc = await read('/Users/chen/Downloads/CrossFire M4A1-S Iron Beast Imperial Gold/compile/v_/sequences.qc');
const sourceMdl = await readFile('/Users/chen/Downloads/m4a1-s_iron_beast_imperial_gold/models/v_ak47.mdl');
const meleeWav = await readFile(new URL('audio/classic/ironbeast/knife_attack.wav', root));
const sourceMeleeWav = await readFile('/Users/chen/Downloads/m4a1-s_iron_beast_imperial_gold/sound/weapons/M4A1-S-Beast_knifeAttack.wav');

assert.equal(view.bones.length, 113, 'Iron Beast source skeleton is retained');
const weaponParts = view.parts.filter((part) => part.kind === 'weapon');
assert.equal(weaponParts.length, 1, 'both original weapon bodygroups are imported');
assert.equal(weaponParts[0].count, (1855 + 2234) * 3, 'both gun meshes are retained');
const specularParts = view.parts.filter((part) => part.kind === 'specular');
assert.equal(specularParts.length, 1, 'both original specular bodygroups are imported');
assert.equal(specularParts[0].count, weaponParts[0].count,
  'the authored specular overlay retains the complete weapon topology');
assert.equal(specularParts[0].sourceFlags, 32,
  'the compiled MDL marks the specular overlay STUDIO_NF_ADDITIVE');
const viewRenderer = await read('scripts/classic_view.js');
assert.match(viewRenderer, /if\(p\.additive\)/,
  'renderer consumes the compiled material flag instead of guessing by filename');
assert.match(viewRenderer, /transparent:true,depthTest:true,depthWrite:false/,
  'source additive layers retain depth testing without writing depth');
assert.doesNotMatch(viewRenderer, /ironBeastColourMaps|idleEnergy|showEffects/,
  'no speculative colour grading or synthetic always-on effect remains');
assert.ok(view.parts.some((part) => part.map === 'FVIEW_HAND_GR.png'));
assert.ok(view.parts.some((part) => part.map === 'FVIEW_ARM_GR.png'));
const effects = view.parts.filter((part) => part.kind === 'effect');
assert.equal(effects.length, 12, 'all twelve source muzzle and shot effect materials are imported');
assert.ok(effects.every((part) => part.additive && part.sourceFlags === 32),
  'all twelve VFX materials use the MDL-authored additive flag, including smoke');
for (const name of ['idle_0', 'reload', 'select', 'fire', 'prefire', 'postfire'])
  assert.ok(view.clips[name]?.times.length, `source animation ${name} is present`);
assert.equal(sourceMdl.readInt32LE(164), 7, 'the original MDL contains seven animation sequences');
const sequenceOffset = sourceMdl.readInt32LE(168);
const sequenceNames = Array.from({length: sourceMdl.readInt32LE(164)}, (_, index) => {
  const at = sequenceOffset + index * 176;
  return sourceMdl.subarray(at, at + 32).toString('utf8').replace(/\0.*$/, '');
});
assert.equal(sequenceNames.at(-1), 'knife-attack',
  'the seventh original sequence is the right-click melee animation');
assert.equal(view.clips['knife-attack'].times.length, 267,
  'all 267 source melee samples are imported');
assert.equal(view.clips['knife-attack'].times.at(-1), .532,
  'the imported melee keeps its authored 500 fps duration');
assert.deepEqual(view.events['knife-attack'], [{
  name: 'weapons/m4a1-s-beast_knifeattack.wav', code: 5004, type: 0, frame: 1, time: .002,
}], 'the source melee sound event is retained at frame 1');
assert.equal(meleeWav.subarray(0, 4).toString('ascii'), 'RIFF',
  'the supplied melee WAV is packaged unchanged as a playable WAV');
assert.ok(meleeWav.equals(sourceMeleeWav), 'the packaged melee WAV is byte-for-byte identical to the source');
const bonePositionRange = (clipName, boneName, channel = 0) => {
  const clip = view.clips[clipName];
  const bone = view.bones.findIndex((item) => item.name === boneName);
  assert.ok(bone >= 0, `${boneName} is retained`);
  const values = new Float32Array(viewBytes.buffer,
    viewBytes.byteOffset + clip.offset, clip.count * view.bones.length * 7);
  const samples = Array.from({length: clip.count}, (_, frame) =>
    values[(frame * view.bones.length + bone) * 7 + channel]);
  return Math.max(...samples) - Math.min(...samples);
};
assert.ok(bonePositionRange('select', 'Box001') > 4,
  'select retains the authored Box001 mechanism travel');
assert.ok(bonePositionRange('select', 'Bone04') > 7,
  'select retains the authored Bone04 charging travel');
assert.equal(bonePositionRange('knife-attack', 'Scene Root'), 0,
  'the older MDL scene root is aligned to the current SMD coordinate convention');
assert.ok(bonePositionRange('knife-attack', 'FvARM-bone Prop1') > 30,
  'the original rifle swing remains present after root retargeting');
assert.equal(bonePositionRange('knife-attack', 'MUZ1'), 0,
  'incompatible old VFX helpers stay in the current idle pose during melee');
assert.match(main, /IRONBEAST_FIRE_CLIPS = Object\.freeze\(\['prefire','fire','postfire'\]\)/,
  'all three source muzzle-effect variants are selected across shots');
assert.match(main, /const IRONBEAST_SELECT_DURATION = 319 \/ 400/,
  'the complete 320-frame source select duration is retained');
assert.match(main, /id === "m4" && activeSkinId\(id\) === "ironbeastgold"\) return IRONBEAST_SELECT_DURATION/,
  'only the Iron Beast skin uses its authored select duration');
const ironbeastRenderStart = main.indexOf("if(ironbeastView&&vid==='m4'");
const ironbeastRenderEnd = main.indexOf("if(barrettView&&vid==='barrett')", ironbeastRenderStart);
const ironbeastRender = main.slice(ironbeastRenderStart, ironbeastRenderEnd);
assert.match(ironbeastRender, /pose\.y\+bobY\+\(deploy\?0:swDy\),pose\.z\+\(deploy\?0:swDz\)/,
  'the source select translation is not hidden under the generic deploy pose');
assert.match(ironbeastRender, /pose\.pitch\+\(deploy\?0:swRx\)[\s\S]*pose\.yaw\+\(deploy\?0:swRy\)[\s\S]*pose\.roll\+\(deploy\?0:swRz\)/,
  'the source select rotation is not hidden under the generic deploy pose');
assert.doesNotMatch(main, /IRONBEAST_BOLT_TRAVEL|ironbeastBoltPull|offsetBones/,
  'no invented bolt movement is layered over the source clip');
assert.match(main, /const IRONBEAST_MELEE = Object\.freeze\(\{[\s\S]*duration: 266 \/ 500, hitStart: 70 \/ 500, hitEnd: 145 \/ 500,[\s\S]*range: 1\.5, dmg: 100, head: 100/,
  'right-click melee uses the source duration and explicit project hit tuning');
assert.match(main, /currentId==="m4" && activeSkinId\("m4"\)==="ironbeastgold"[\s\S]*ironbeastMeleeAttack\(\)/,
  'right click routes only the Iron Beast skin into its melee action');
assert.match(ironbeastRender, /const clip=melee\?'knife-attack'/,
  'the authored melee clip has rendering priority while the attack is active');
assert.match(ironbeastRender, /for\(const effect of ironbeastView\.effects\)effect\.visible=!melee/,
  'shot-only additive cards are hidden while the rifle is used as a melee weapon');
assert.match(audio, /ironbeastMelee\(delay = 1 \/ 500\)[\s\S]*id: "ironbeast_knife_attack"[\s\S]*rate: 1, rateJitter: 0, wet: 0/,
  'the original melee WAV plays unpitched and without synthesized replacement');

assert.match(qc, /\$sequence "reload" "reload" fps 122 .*event 5004 115 .*clipin_imperialgold\.wav.*event 5004 206 .*g_mzc_m4a1_clipin\.wav/);
assert.match(qc, /\$sequence "select" "select" fps 400 \{ event 5004 135 .*g_reload_m4a1\.wav/);
assert.match(audio, /frames=\[115,206\],ids=\["ironbeast_clipin_gold","ironbeast_clipin"\]/);
assert.match(audio, /selectEventDelay\s*=\s*ironbeast\s*\?\s*\(options\.selectDur\s*\|\|\s*0\)\s*\*\s*135\s*\/\s*319/);
assert.match(main, /skin:ironbeastSkin\?'ironbeastgold':undefined/);
assert.match(skins, /id: "ironbeastgold", name: "炫金雷神", displayName: "炫金雷神"/,
  'the imported weapon is named 炫金雷神 everywhere through its shared display name');
assert.match(main, /id: "ironbeast", label: "炫金雷神"/,
  'the viewmodel tuner uses the renamed weapon');
assert.match(main, /ironbeast: Object\.freeze\(\{ x: 0, y: 0, z: \.03, pitch: 0, yaw: 0, roll: 0, scale: 1 \}\)/,
  '炫金雷神 uses the user-approved live-tuned viewmodel pose');

const ammoStart = main.indexOf('const IRONBEAST_MAG_SIZE = 35;');
const ammoEnd = main.indexOf('// 换主武器时用', ammoStart);
assert.ok(ammoStart >= 0 && ammoEnd > ammoStart, 'skin-specific magazine helpers exist');
const ammoCtx = {
  WEAPON_DEFS: { m4: { type: 'rifle', stats: { magSize: 30, reserve: 90 } } },
  owned: { m4: { state: { mag: 30, magSize: 30, reserve: 90 } } },
  activeSkinId: () => 'ironbeastgold',
  bioMatch: () => false,
};
vm.createContext(ammoCtx);
vm.runInContext(main.slice(ammoStart, ammoEnd), ammoCtx);
assert.equal(ammoCtx.magazineSizeFor('m4', 'ironbeastgold'), 35,
  '炫金雷神 has a 35-round magazine');
assert.equal(ammoCtx.magazineSizeFor('m4', 'classic'), 30,
  'the ordinary M4 keeps its 30-round magazine');
assert.equal(ammoCtx.startingReserve('m4', ammoCtx.WEAPON_DEFS.m4.stats, 'ironbeastgold'), 105,
  '炫金雷神 carries three 35-round spare magazines');
assert.equal(ammoCtx.startingReserve('m4', ammoCtx.WEAPON_DEFS.m4.stats, 'classic'), 90,
  'the ordinary M4 keeps three 30-round spare magazines');
ammoCtx.syncMagazineCapacity('m4', 'ironbeastgold', true);
assert.deepEqual(ammoCtx.owned.m4.state, { mag: 35, magSize: 35, reserve: 105 },
  'selecting 炫金雷神 before acting equips its full 35/105 loadout');
ammoCtx.syncMagazineCapacity('m4', 'classic');
assert.deepEqual(ammoCtx.owned.m4.state, { mag: 30, magSize: 30, reserve: 110 },
  'switching back returns the five excess rounds to reserve');
ammoCtx.syncMagazineCapacity('m4', 'ironbeastgold');
assert.deepEqual(ammoCtx.owned.m4.state, { mag: 30, magSize: 35, reserve: 110 },
  'switching after acting changes capacity without refilling the magazine');
assert.match(main, /magSize: magazineSizeFor\(r\.id, r\.skin\)/,
  'enemy loadouts use the same skin-specific magazine capacity');
assert.match(enemies, /this\.magSize = opts\.magSize \?\?/,
  'enemy reload cadence accepts the selected weapon magazine capacity');

console.log(`PASS: 炫金雷神 source gun-butt action/audio, ${effects.length} VFX layers, 35-round magazines, and exact event frames.`);
