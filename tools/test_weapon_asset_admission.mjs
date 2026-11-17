import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const main = read("scripts/main.js");
const catalog = read("scripts/guncatalog.js");
const audio = read("scripts/audio.js");
const entry = read("index.html");
const runtime = [main, catalog, audio, entry].join("\n");

assert.doesNotMatch(runtime, /assets\/weapons\/realistic_pbr|audio\/fps_cc0/,
  "rejected incomplete weapon packs must not be referenced by runtime code");
for (const id of ["smg", "shotgun", "battle"]) {
  assert.doesNotMatch(main, new RegExp(`\\n\\s*${id}:\\s*\\{`),
    `${id} must not remain in the player weapon definitions`);
}

assert.match(main, /\["ak", "m4", "barrett", "scar", "m200", "akgold", "kn57"\]/,
  "only user-approved complete imports extend the restored primary set");
for (const entry of ['ak','m4','barrett','scar','m200','akgold','kn57']) {
  assert.match(catalog, new RegExp(`\\{ id: "${entry}", skin:`),
    `${entry} belongs to an admitted NPC backpack loadout`);
}

const backpacks = main.match(/const BACKPACKS = \[([\s\S]*?)\n\];/)?.[1] ?? "";
assert.equal((backpacks.match(/primary:/g) ?? []).length, 8,
  "all eight admitted primary backpacks remain registered");
assert.match(backpacks, /primary: "scar"/);
assert.match(backpacks, /primary: "m200"/);
assert.match(backpacks, /primary: "akgold"/);
assert.match(backpacks, /primary: "kn57"/);

for (const path of ["assets/weapons/realistic_pbr", "audio/fps_cc0"]) {
  assert.equal(fs.existsSync(new URL(`../${path}`, import.meta.url)), false,
    `${path} must not remain in the project`);
}

console.log("weapon asset admission rollback checks passed");
