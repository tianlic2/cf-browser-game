import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SHOT_SHAKE_PROFILES,
  createShotShakeState,
  resetShotShake,
  triggerShotShake,
  stepShotShake,
} from "../scripts/shot_feedback.js";

const main = readFileSync(new URL("../scripts/main.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles/game.css", import.meta.url), "utf8");

for (const id of ["ak", "m4", "deagle", "barrett"]) {
  const state = createShotShakeState();
  triggerShotShake(state, id, false, 1);
  const first = stepShotShake(state, 1 / 120);
  assert.ok(Math.abs(first.pitch) + Math.abs(first.yaw) + Math.abs(first.roll) > 0,
    `${id} must produce a visible camera impulse`);
  for (let i = 0; i < 90; i++) stepShotShake(state, 1 / 120);
  assert.equal(state.active, false, `${id} shake must finish quickly`);
}

const hip = createShotShakeState();
const zoom = createShotShakeState();
triggerShotShake(hip, "barrett", false, 2);
triggerShotShake(zoom, "barrett", true, 2);
assert.ok(zoom.pitch < hip.pitch && zoom.roll < hip.roll,
  "scope shake must be restrained at high magnification");

const burst = createShotShakeState();
for (let i = 0; i < 12; i++) triggerShotShake(burst, "ak", false, i);
assert.ok(burst.pitch <= SHOT_SHAKE_PROFILES.ak.pitch * 1.42 + 1e-12,
  "full-auto camera shake must stay capped");
resetShotShake(burst);
assert.equal(burst.active, false);

const fire = main.slice(main.indexOf("function fire()"), main.indexOf("// 栓动狙", main.indexOf("function fire()")));
assert.ok(fire.indexOf("const impacts = bulletImpactSequence") < fire.indexOf("triggerShotShake(shotShake"),
  "the current bullet must resolve before visual shake is triggered");
assert.doesNotMatch(fire.slice(fire.indexOf("triggerShotShake(shotShake")), /dir\.applyEuler|raycaster\.set/,
  "visual shake must not feed back into the current shot ray");
assert.match(main, /camera\.rotation\.x = player\.pitch \+ recoilPitch \+ deathCam\.pitchOff \+ shotView\.pitch/);
assert.match(main, /camera\.rotation\.y = player\.yaw \+ recoilYaw \+ deathCam\.yawOff \+ shotView\.yaw/);

assert.match(css, /\.killicon \{[\s\S]*?width: 138px; height: 138px;/,
  "kill and streak medals must use the larger desktop footprint");
assert.match(css, /scale\(1\.42\)/, "kill medal must enter with a stronger impact scale");
assert.match(css, /translateX\(calc\(-50% \+ 8px\)\)/,
  "kill medal must use a clearly visible shake amplitude");

console.log("shot impact feedback: visual-only weapon shake, capped full-auto impulse, larger and stronger kill medals");
