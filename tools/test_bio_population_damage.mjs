// Run with: node --experimental-default-type=module tools/test_bio_population_damage.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BIO_DAMAGE_MILESTONE, BIO_NPC_COUNT, BIO_INITIAL_ZOMBIES, BIO_ZOMBIE_HEALTH, bioHumanDamageMultiplier, bioDamageBadges,
  crossedDamageMilestones } from '../scripts/bio_rules.js';
import { sourceMotherCount } from '../scripts/bio_source_rules.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const bio = read('scripts/bio_mode.js');
const map = read('scripts/zone13_map.js');
const main = read('scripts/main.js');
const audio = read('scripts/audio.js');
const css = read('styles/game.css');

assert.equal(BIO_NPC_COUNT, 12, 'bio mode deploys twelve NPCs');
assert.equal(sourceMotherCount(5), 1, 'small matches begin with one mother zombie');
assert.equal(sourceMotherCount(6), 2, 'six or more participants add the second mother zombie');
assert.equal(BIO_DAMAGE_MILESTONE, 1000, 'player damage reward interval is 1000');
assert.deepEqual(crossedDamageMilestones(0, 999), [], 'no reward before 1000 damage');
assert.deepEqual(crossedDamageMilestones(999, 1000), [1000], 'exact boundary triggers once');
assert.deepEqual(crossedDamageMilestones(850, 3150), [1000, 2000, 3000],
  'a large damage update cannot skip crossed rewards');
assert.deepEqual(crossedDamageMilestones(2000, 2000), [], 'repeated totals do not duplicate rewards');
assert.deepEqual(crossedDamageMilestones(90, 350, 100), [100, 200, 300], 'one hit emits each crossed hundred');
assert.deepEqual(crossedDamageMilestones(950, 1050, 100), [1000], 'the thousand boundary also triggers its hundred indicator');
assert.deepEqual(crossedDamageMilestones(1000, 1000, 100), [], 'zero new damage cannot repeat the indicator');
assert.deepEqual(bioDamageBadges(499), [100,100,100,100]);
assert.deepEqual(bioDamageBadges(500), [500]);
assert.deepEqual(bioDamageBadges(799), [500,100,100]);
assert.deepEqual(bioDamageBadges(1000), []);
assert.deepEqual(bioDamageBadges(1700), [500,100,100]);

assert.match(map, /while \(spawns\.length < 12/,
  'Zone 13 exposes twelve distinct mercenary spawns');
assert.match(bio, /Math\.min\(BIO_NPC_COUNT, spawns\.length\)/,
  'the mode consumes the shared NPC count instead of a stale hard-coded five');
assert.equal(BIO_INITIAL_ZOMBIES,8);assert.equal(BIO_ZOMBIE_HEALTH,10000);
assert.equal(bioHumanDamageMultiplier(0),1);assert.equal(bioHumanDamageMultiplier(3),1.3);
assert.match(bio, /const candidates = this\.humans\.filter\(h => h\.alive\)/, 'initial pool excludes player');
assert.match(bio, /spawned >= BIO_INITIAL_ZOMBIES/, 'initial infection stops at eight NPC zombies');
assert.match(bio, /this\.sound\?\.bio\('mother'\);[\s\S]*?this\.phase = 'live'/,
  'the triple infection uses one global mother cue rather than stacking three copies');
assert.match(bio, /recordPlayerDamage\(amount\)[\s\S]*?crossedDamageMilestones[\s\S]*?onDamageMilestone/,
  'player damage accumulation emits every crossed 1000-damage boundary');
assert.match(bio, /playerDamage: this\.playerDamage[\s\S]*?nextDamageMilestone/,
  'bio status exposes progress for runtime QA');
assert.match(bio, /scoreKills: this\.playerKills \+ Math\.floor\(this\.playerDamage \/ BIO_DAMAGE_MILESTONE\)/,
  'score credits player kills and every thousand actual damage without crediting AI kills');
assert.match(bio, /crossedDamageMilestones\(previous, this\.playerDamage, 100\)/,
  'each hundred damage is emitted from the same accumulated damage');
assert.match(main, /onDamageProgress: showBioDamageProgress/,
  'the hundred damage event drives HUD feedback');

assert.match(main, /function damageEnemyByPlayer\([\s\S]*?before - \(Number\(enemy\.health\) \|\| 0\)/,
  'only actual health removed counts, excluding overkill');
assert.ok((main.match(/damageEnemyByPlayer\(/g) || []).length >= 5,
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

console.log('PASS: bio mode selects eight NPC zombies and preserves 1000-damage audiovisual milestones.');
