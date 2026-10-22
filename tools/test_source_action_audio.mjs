import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../scripts/audio.js", import.meta.url), "utf8");
const executable = source.replace("export class SFX", "class SFX") + "\nglobalThis.SFX = SFX;";
const context = vm.createContext({ addEventListener() {} });
vm.runInContext(executable, context);
const { SFX } = context;

for (const removed of [
  "_reloadSynth", "_boltSynth", "_holsterSynth", "_deploySynth",
  "_knifeHolsterSynth", "_knifeDeploySynth", "_meleeSynth", "_clink",
]) {
  assert.doesNotMatch(source, new RegExp(`\\b${removed}\\b`),
    `${removed} must not remain as an action-audio fallback`);
}
for (const removedSlot of [
  "reload_1:", "reload_2:", "reload_3:",
  "sw_deploy:", "sw_holster:", "sw_deploy_pistol:", "sw_holster_pistol:",
  "sw_deploy_knife:", "sw_holster_knife:", "knife_swing:",
  "cf_deagle_out:", "cf_deagle_in:", "cf_deagle_deploy:",
]) {
  assert.ok(!source.includes(removedSlot), `${removedSlot} must not be preloaded or selected`);
}

const sfx = Object.create(SFX.prototype);
sfx.ready = () => true;
sfx.maxVoices = 64;
sfx._voices = 0;
sfx.ctx = { currentTime: 10 };
sfx.samples = [];
sfx.notes = [];
sfx._sample = (id, options) => {
  sfx.samples.push({ id, ...options });
  return false;
};
sfx._note = (method, options, reason) => sfx.notes.push({ method, options, reason });
sfx._click = () => { throw new Error("reload must not synthesize a replacement click"); };
sfx._shootSynth = () => {};
sfx.shellPing = () => {};

sfx.holster("rifle");
assert.equal(sfx.samples.length, 0, "holstering is silent without an authored source event");
assert.equal(sfx.notes.at(-1).reason, "silent");

sfx.deploy("rifle", { weaponId: "ak" });
assert.deepEqual(sfx.samples.splice(0).map(({ id }) => id), ["cf_ak_bolt"],
  "AK deploy uses its own supplied charging-handle recording");
assert.equal(sfx.notes.at(-1).reason, "missing");

sfx.deploy("rifle", { weaponId: "ak", akSelectAt: 77 / 375 });
const akSelect = sfx.samples.splice(0);
assert.deepEqual(akSelect.map(({ id }) => id), ["cf_ak_bolt"]);
assert.equal(akSelect[0].delay, 77 / 375, "AK select sound follows the exact source MDL event");
assert.equal(akSelect[0].rate, 1, "AK select sound keeps its original pitch");
assert.equal(akSelect[0].rateJitter, 0, "AK select sound has no pitch randomization");
assert.equal(akSelect[0].volJitter, 0, "AK select sound has no volume randomization");
assert.equal(akSelect[0].wet, 0, "AK select sound is not given synthetic reverb");

sfx.deploy("rifle", { weaponId: "m4", m4c: true, m4cSelectAt: 1 / 3 });
const m4Select = sfx.samples.splice(0);
assert.deepEqual(m4Select.map(({ id }) => id), ["cf_m4c_bolt"],
  "M4A1-C select uses its own source bolt event");
assert.equal(m4Select[0].delay, 1 / 3, "M4A1-C select sound follows the MDL event");
assert.equal(m4Select[0].rate, 1);
assert.equal(m4Select[0].rateJitter, 0);
assert.equal(m4Select[0].volJitter, 0);
assert.equal(m4Select[0].wet, 0);

sfx.shoot("rifle", "m4", "classic");
const [m4Fire, m4Brass] = sfx.samples.splice(0);
assert.equal(m4Fire.sample, "cf_m4c_fire", "classic M4A1-C uses its supplied fire WAV");
assert.equal(m4Fire.rate, 1);
assert.equal(m4Fire.rateJitter, 0);
assert.equal(m4Fire.volJitter, 0);
assert.equal(m4Fire.wet, 0, "classic M4A1-C fire WAV receives no synthetic reverb");
assert.equal(m4Brass.id, "brass", "authored firing sound does not remove the normal casing impact");

sfx.reload({ id: "pistol", dur: 2 });
assert.equal(sfx.samples.length, 0, "USP must not borrow AK reload sounds");
assert.equal(sfx.notes.at(-1).reason, "missing");

sfx.reload({ id: "deagle", dur: 2.35 });
const deagleReload = sfx.samples.splice(0);
assert.deepEqual(deagleReload.map(({ id }) => id), [
  "deagle_festa_blowback", "deagle_festa_clipout", "deagle_festa_clipin",
  "deagle_festa_del_blowback",
], "Festa Desert Eagle uses the four action WAVs referenced by its MDL");
assert.deepEqual(deagleReload.map(({ delay }) => delay), [1, 29, 124, 193].map(frame => frame / 269 * 2.35),
  "the four Desert Eagle reload sounds keep their exact normalized MDL event frames");
assert.ok(deagleReload.every(({ rate, rateJitter, volJitter, wet, schedule }) =>
  rate === 1 && rateJitter === 0 && volJitter === 0 && wet === 0 && schedule === "reload"),
  "the supplied Desert Eagle WAVs are not pitch-randomized or given synthetic reverb");
assert.equal(sfx.notes.at(-1).reason, "missing");

sfx.reload({ id: "ak", dur: 2 });
assert.deepEqual(sfx.samples.splice(0).map(({ id }) => id), ["cf_ak_out", "cf_ak_in", "cf_ak_bolt"],
  "AK keeps only its imported source reload events");

sfx.reload({ id: "m4", skin: "classic", dur: 3.1 });
const m4Reload = sfx.samples.splice(0);
assert.deepEqual(m4Reload.map(({ id }) => id), ["cf_m4c_out", "cf_m4c_in", "cf_m4c_bolt"],
  "M4A1-C reload uses the three WAVs referenced by its source events");
assert.deepEqual(m4Reload.map(({ delay }) => delay), [10, 38, 69].map(frame => frame / 93 * 3.1),
  "M4A1-C reload sounds follow exact normalized MDL frames");
assert.ok(m4Reload.every(({ rate, rateJitter, volJitter, wet, schedule }) =>
  rate === 1 && rateJitter === 0 && volJitter === 0 && wet === 0 && schedule === "reload"),
  "M4A1-C source reload WAVs are not pitch-randomized or given synthetic reverb");

sfx.deploy("melee", { weaponId: "knife", axeSelectAt: .01 });
assert.deepEqual(sfx.samples.splice(0).map(({ id }) => id), ["axe_festa_put_up"],
  "the axe keeps its authored select event");

sfx.deploy("pistol", { weaponId: "deagle", deagleSelectAt: .01 });
const deagleDeploy = sfx.samples.splice(0);
assert.deepEqual(deagleDeploy.map(({ id }) => id), ["deagle_festa_select"],
  "the Festa Desert Eagle keeps its authored select event");
assert.equal(deagleDeploy[0].schedule, "deploy",
  "the Desert Eagle select event can be withdrawn when its animation is interrupted");

const cancelled = [];
sfx.ctx = { currentTime: 10 };
sfx._scheduled = new Set([
  { method: "deploy", at: 10.8, cancelPending: () => cancelled.push("future-deploy") },
  { method: "deploy", at: 9.9, cancelPending: () => cancelled.push("started-deploy") },
  { method: "bolt", at: 10.8, cancelPending: () => cancelled.push("shot-bolt") },
]);
sfx.cancelPendingDeploy();
assert.deepEqual(cancelled, ["future-deploy"],
  "switching cancels only an unreached deploy event, while started audio and post-shot bolts remain");

sfx.melee("heavy");
assert.deepEqual(sfx.samples.splice(0).map(({ id }) => id), ["axe_festa_attack_3"],
  "the axe keeps its authored heavy-attack event");
assert.equal(sfx.notes.at(-1).reason, "missing",
  "a missing authored melee sample stays silent instead of synthesizing a whoosh");

sfx.bolt("barrett", { delay: .5 });
assert.deepEqual(sfx.samples.splice(0).map(({ id }) => id), ["barrett_bolt"],
  "the Barrett still requests its supplied bolt recording");
assert.equal(sfx.notes.at(-1).reason, "missing",
  "a missing bolt sample stays silent instead of creating oscillator scratches");

sfx.throwGrenade();
assert.equal(sfx.notes.at(-1).reason, "silent",
  "grenade throwing no longer reuses the removed synthetic melee whoosh");

console.log("weapon action audio: source recordings only; generated and generic substitutes removed");
