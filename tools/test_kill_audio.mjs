import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../scripts/audio.js", import.meta.url), "utf8")
  .replace("export class SFX", "class SFX") + "\nglobalThis.SFX = SFX;";
const context = vm.createContext({});
vm.runInContext(source, context);
const { SFX } = context;
const main = readFileSync(new URL("../scripts/main.js", import.meta.url), "utf8");

const sfx = Object.create(SFX.prototype);
sfx.ready = () => true;
sfx.cancelled = [];
sfx.cancelScheduled = (...args) => sfx.cancelled.push(args);
sfx.played = [];
sfx._playMapped = (method, options) => sfx.played.push({ method, options });
sfx._killSynth = () => { throw new Error("sample path should be selected in this test"); };

sfx.kill(false, false);
sfx.kill(false, true);
sfx.kill(true, true);

assert.equal(sfx.played.length, 3, "every kill must start its own confirmation sound");
assert.deepEqual(sfx.played.map(({ options }) => options.id), [
  "kill_confirm", "kill_confirm", "kill_confirm",
]);
assert.deepEqual(sfx.played.map(({ options }) => options.kind), [
  "normal", "streak", "head",
]);
assert.ok(sfx.played.every(({ method, options }) =>
  method === "kill" && !options.schedule),
"kill confirmations must not enter a cancellable schedule");
assert.deepEqual(sfx.cancelled, [], "new kills must not cancel an earlier confirmation");

const voiceGate = Object.create(SFX.prototype);
voiceGate.maxVoices = 64;
voiceGate._voices = 64;
voiceGate._note = (_method, _options, reason) => { voiceGate.reason = reason; };
voiceGate._sample = () => ({ dur: 1 });
let fallbackCount = 0;
assert.equal(voiceGate._playMapped("impact", { id: "impact" }, () => fallbackCount++), false,
  "ordinary effects still respect the global voice safety cap");
assert.equal(voiceGate.reason, "capped");
assert.equal(voiceGate._playMapped("kill", { id: "kill_confirm" }, () => fallbackCount++), true,
  "kill confirmation gets priority voices after ordinary polyphony is full");
voiceGate._voices = 80;
assert.equal(voiceGate._playMapped("kill", { id: "kill_confirm" }, () => fallbackCount++), false,
  "the dedicated kill reserve remains bounded");
assert.equal(voiceGate.reason, "capped");
assert.equal(fallbackCount, 0);

const onKill = main.slice(main.indexOf("function onKill("), main.indexOf("function refillEnemies()"));
assert.match(onKill, /sfx\.kill\(!!headshot, streakCount >= 2\);/,
  "onKill must request a confirmation for every kill, including non-streak kills");
const beginDeath = main.slice(main.indexOf("function beginDeath("), main.indexOf("function cancelDeath()"));
assert.doesNotMatch(beginDeath, /sfx\.cancelStreak\(/,
  "being killed must not cancel an already playing kill or streak sound");
assert.match(beginDeath, /streakCount = 0;[\s\S]*lastKillAt = -Infinity;/,
  "death must still reset the streak state");

console.log("kill audio: 64 normal voices + 16 reserved kill voices; confirmations remain independent");
