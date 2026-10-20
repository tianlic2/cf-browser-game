// Run with: node --experimental-default-type=module tools/test_bio_population_damage.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BIO_DAMAGE_MILESTONE, BIO_INITIAL_ZOMBIES, BIO_NPC_COUNT,
  crossedDamageMilestones } from '../scripts/bio_rules.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const bio = read('scripts/bio_mode.js');
const map = read('scripts/bio_map.js');
const main = read('scripts/main.js');
const audio = read('scripts/audio.js');
const css = read('styles/game.css');

assert.equal(BIO_NPC_COUNT, 12, 'bio mode deploys twelve NPCs');
assert.equal(BIO_INITIAL_ZOMBIES, 3, 'infection begins with three zombies');
assert.equal(BIO_DAMAGE_MILESTONE, 1000, 'player damage reward interval is 1000');
assert.deepEqual(crossedDamageMilestones(0, 999), [], 'no reward before 1000 damage');
assert.deepEqual(crossedDamageMilestones(999, 1000), [1000], 'exact boundary triggers once');
assert.deepEqual(crossedDamageMilestones(850, 3150), [1000, 2000, 3000],
  'a large damage update cannot skip crossed rewards');
assert.deepEqual(crossedDamageMilestones(2000, 2000), [], 'repeated totals do not duplicate rewards');

assert.match(map, /humans: map\.spawns\.player\.slice\(0, 12\)/,
  'bio Black Town exposes twelve distinct mercenary spawns');
assert.match(bio, /Math\.min\(BIO_NPC_COUNT, spawns\.length\)/,
  'the mode consumes the shared NPC count instead of a stale hard-coded five');
assert.match(bio, /candidates\.slice\(0, Math\.min\(BIO_INITIAL_ZOMBIES, candidates\.length\)\)/,
  'initial infection samples three participants without replacement');
assert.match(bio, /this\.sound\?\.bio\('mother'\);[\s\S]*?this\.phase = 'live'/,
  'the triple infection uses one global mother cue rather than stacking three copies');
assert.match(bio, /recordPlayerDamage\(amount\)[\s\S]*?crossedDamageMilestones[\s\S]*?onDamageMilestone/,
  'player damage accumulation emits every crossed 1000-damage boundary');
assert.match(bio, /playerDamage: this\.playerDamage[\s\S]*?nextDamageMilestone/,
  'bio status exposes progress for runtime QA');

assert.match(main, /function damageEnemyByPlayer\([\s\S]*?before - \(Number\(enemy\.health\) \|\| 0\)/,
  'only actual health removed counts, excluding overkill');
assert.equal((main.match(/damageEnemyByPlayer\(/g) || []).length, 5,
  'bullets, grenades, melee sweeps and Iron Beast melee all share the player damage path');
assert.match(main, /onDamageMilestone: showBioDamageMilestone/,
  'the mode milestone is connected to visual and audio feedback');
assert.match(main, /className = "bio-damage-award"[\s\S]*?1000|className = "bio-damage-award"/,
  'the HUD creates its original vector damage badge');
assert.match(css, /\.fx-layer \.bio-damage-award[\s\S]*?@keyframes bioDamageAward/,
  'the badge has a dedicated punch-and-fade animation');
assert.match(audio, /damageMilestone\(\)[\s\S]*?id: "kill_confirm"/,
  'the damage milestone reuses the requested kill confirmation sample');
assert.match(audio, /\["kill", "damageMilestone"\]\.includes\(method\)/,
  'damage rewards share the protected kill-feedback voice reserve');

console.log('PASS: bio mode has 12 NPCs, 3 initial zombies, and protected 1000-damage audiovisual milestones.');
