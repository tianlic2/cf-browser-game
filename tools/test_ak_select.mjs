import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const text = (path) => readFile(new URL(path, root), 'utf8');
const bytes = (path) => readFile(new URL(path, root));

const view = JSON.parse(await text('assets/classic/ak/view/view.json'));
const binary = await bytes('assets/classic/ak/view/view.bin');
const main = await text('scripts/main.js');
const audio = await text('scripts/audio.js');

const select = view.clips.select;
assert.ok(select && select.count > 2, 'classic AK keeps its authored select clip');
assert.equal(select.times.at(-1), .854286, 'AK select keeps its imported source duration');

const boltIndex = view.bones.findIndex(({ name }) => name === 'Bone05');
assert.ok(boltIndex >= 0, 'AK charging-handle bone exists');
const boltX = [];
for (let frame = 0; frame < select.count; frame++) {
  const offset = select.offset + (frame * view.bones.length + boltIndex) * 28;
  boltX.push(binary.readFloatLE(offset));
}
assert.ok(Math.max(...boltX) - Math.min(...boltX) > 7.5,
  'AK select visibly cycles the charging handle instead of remaining static');

assert.match(main, /if \(id === "ak" && activeSkinId\(id\) === "classic"\) return classicView\?\.duration\('select'\) \?\? \.854286/,
  'AK switch duration uses the complete source select clip');
assert.match(main, /if\(classicView&&vid==='ak'[\s\S]*?const deploy=switchState\?\.to===vid[\s\S]*?deploy\?'select'/,
  'AK runtime samples select while the weapon is being drawn');
assert.match(main, /const AK_SELECT_EVENT_AT = 77 \/ 375/,
  'AK draw sound uses the exact Festa MDL event timestamp');
assert.match(main, /akSelectAt:id==='ak'\?AK_SELECT_EVENT_AT:undefined/,
  'AK passes its source event time to the audio layer');
assert.match(audio, /const ak = options\.weaponId === "ak"/);
assert.match(audio, /ak \? "cf_ak_bolt"/,
  'AK draw uses its own imported source charging-handle WAV');

console.log('AK select: complete authored draw/charging-handle clip and exact source sound event wired.');
