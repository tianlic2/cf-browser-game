import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";

const root = new URL("../", import.meta.url);
const jsonUrl = new URL("assets/classic/m4c_view/view.json", root);
const data = JSON.parse(readFileSync(jsonUrl, "utf8"));

assert.equal(data.source, "Source v44 complete first-person rig");
assert.equal(data.bones.length, 81, "all Source view-model bones must be retained");
assert.equal(data.parts.length, 3, "rifle, accessory and authored hands must all be retained");
assert.deepEqual(data.parts.map(part => part.textureName), [
  "PV-M4A1-CUSTOM", "PV_M4A1EX_ADVANCE", "v_hands",
]);
assert.equal(data.muzzleBone, "attack", "muzzle must follow the authored attack attachment bone");

const expected = {
  idle_0: [102, 101 / 60], reload: [94, 93 / 37], select: [61, 60 / 60],
  fire1: [41, 40 / 60], fire2: [41, 40 / 60], fire3: [41, 40 / 60],
};
for (const [name, [count, duration]] of Object.entries(expected)) {
  const clip = data.clips[name];
  assert.ok(clip, `missing ${name}`);
  assert.equal(clip.count, count, `${name} frame count`);
  assert.ok(Math.abs(clip.times.at(-1) - duration) < 1e-6, `${name} duration`);
}

assert.deepEqual(data.events.reload.map(event => event.name), [
  "Weapon_M4A1.Clipout", "Weapon_M4A1.Clipin", "Weapon_M4A1.Boltpull",
]);
for (const [actual, expectedTime] of data.events.reload.map((event, index) =>
  [event.time, [10, 38, 69][index] / 37])) {
  assert.ok(Math.abs(actual - expectedTime) < 1e-6, "reload event time");
}
assert.equal(data.events.select[0].name, "Weapon_M4A1.Boltpull");
assert.ok(Math.abs(data.events.select[0].time - 1 / 3) < 1e-6, "select event time");

const binUrl = new URL("assets/classic/m4c_view/view.bin", root);
assert.ok(existsSync(binUrl));
const binSize = statSync(binUrl).size;
for (const part of data.parts) {
  assert.ok(existsSync(new URL(`assets/classic/m4c_view/${part.map}`, root)), `missing ${part.map}`);
  assert.ok(part.offset >= 0 && part.offset + part.count * 64 <= binSize,
    `${part.textureName} vertex range must fit view.bin`);
}

const main = readFileSync(new URL("scripts/main.js", root), "utf8");
assert.match(main, /ClassicView\.load\('m4c_view'\)/);
assert.match(main, /const M4C_FIRE_CLIPS = Object\.freeze\(\['fire1','fire2','fire3'\]\)/);
assert.match(main, /m4: Object\.freeze\(\{ x: -\.42, y: -\.20, z: -\.18, pitch: 0, yaw: -1\.58, roll: 0, scale: 1\.230 \}\)/,
  "the user-confirmed M4A1-C view pose must remain the formal default");
assert.match(main, /id==='m4'&&activeSkinId\(id\)==='classic'/,
  "classic M4A1-C must use the imported view rig");
assert.match(main, /def\.id === "m4" && activeSkinId\("m4"\) === "classic"/,
  "source M4A1-C must keep its authored no-muzzle-flash setting");

console.log("M4A1-C view: 81-bone rig, six source clips, authored events and no muzzle flash verified");
