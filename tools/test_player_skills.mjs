import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync(new URL('../scripts/main.js', import.meta.url), 'utf8');
const skills = fs.readFileSync(new URL('../scripts/player_skills.js', import.meta.url), 'utf8');
const audio = fs.readFileSync(new URL('../scripts/audio.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

for (const token of [
  'speed: 6', 'fastSpeed: 16', 'takeoffHeight: .35',
  'width: 2.4', 'height: 2.05', 'health: 800', 'life: 120',
  'size: 3.6', 'height: 3.1', 'faceHealth: 800', 'dropHeight: 11', 'dropDuration: .45',
]) assert.ok(skills.includes(token), `skill rules retain ${token}`);

assert.doesNotMatch(skills, /ultimate: Object\.freeze\([^}]*energy/,
  'the old energy-gated ultimate is removed');
assert.doesNotMatch(skills, /infiniteAmmo: true|killExtend|maxExtends/,
  'the old infinite-ammo and kill-extension effects are removed');
assert.doesNotMatch(main,/PLAYER_SKILL_RULES\.dash|playerSkills\.dash/,'super jump and dash velocity are removed');
assert.match(main,/if\(!flying\)player\.vel\.y -= GRAVITY/,'flight suspends gravity');
assert.match(main, /function skillPlacementAtCrosshair\(kind = 'cover'\)/,
  'cover and cage share the crosshair placement resolver');
assert.match(main, /function skyCagePlacementAtCrosshair\(\)/,
  'the cage has its own full-footprint placement probe');
assert.match(main, /KeyC'\) \{ e\.preventDefault\(\); beginSkyCagePreview\(\); return; \}/,
  'pressing C begins the cage preview');
assert.match(main, /KeyC"\) \{ e\.preventDefault\(\); releaseSkyCagePreview\(\); return; \}/,
  'releasing C commits the cage');
assert.match(main, /if \(cagePreviewHeld\) updateSkyCagePreview\(\)/,
  'the cage ghost follows the crosshair every simulation frame');
assert.match(skills, /player-sky-cage-preview/);
assert.match(skills, /player-sky-iron-cage/);
for (const face of ['north', 'south', 'east', 'west', 'roof'])
  assert.match(skills, new RegExp(`addFace\\('${face}'`), `cage contains ${face} face`);
assert.match(skills, /if \(!cage\.landed\)[\s\S]*dropDuration[\s\S]*_activateCage\(cage\)/,
  'the real cage falls before colliders activate');
assert.match(skills, /barrier\.health -= Math\.max\(1, damage \|\| 1\)/,
  'each intercepted enemy shot damages the hit barrier face');
assert.match(main, /interceptEnemyShot\(mz, eye, e\.damage, from\)/,
  'enemy barrier checks start at the body eyeline so a protruding muzzle cannot bypass a cage wall');
assert.match(skills, /_segmentBarrierHit\(barrierOrigin \|\| from, to\)/,
  'the interceptor supports a collision-safe shooter origin separately from the rendered muzzle');
assert.match(skills, /_deactivateCageFace\(hit\.cage, barrier\)/,
  'destroying one face opens only that face');
assert.match(skills, /explosiveScale\(origin, target\).*\.6/s,
  'a crossing cage or cover face reduces grenade damage by 40% without stacking');
assert.match(main, /playerColliders = colliders\.filter\(collider => !collider\.dynamicCover\)/,
  'players ignore dynamic cage walls while NPCs use the shared collider list');
assert.match(skills, /maxCount: null/);
assert.match(skills, /life: PLAYER_SKILL_RULES\.ultimate\.life/);
assert.match(main, /cageLanded.*cageImpact/);
for (const cue of ['dash', 'coverDeploy', 'coverHit', 'cageDrop', 'cageImpact', 'cageHit', 'cageBreak'])
  assert.ok(audio.includes(cue), `${cue} has a dedicated synthesized skill cue`);
assert.match(html, /<b>天降禁闭笼<\/b><small class="skill-value">0个<\/small>/);
assert.match(skills, /cameraProfile\(\) \{ return \{ fovBoost: 0, roll: 0 \}; \}/);
assert.doesNotMatch(html, /skill-fx-layer|overlimit-screen/,
  'the cage avoids persistent screen effects and particle layers');

console.log('PASS: falling cage preview, five independent faces, asymmetric collision, two-minute unlimited lifetime and audio integration are present.');
