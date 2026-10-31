import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BIO_SOURCE_RULES, sourceMotherCount, sourceZombieHealth } from '../scripts/bio_source_rules.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const mode = read('scripts/bio_mode.js');
const map = read('scripts/zone13_map.js');
const main = read('scripts/main.js');
const audio = read('scripts/audio.js');

assert.deepEqual(Object.keys(BIO_SOURCE_RULES), ['zone13zm', 'lczm', 'resortzm']);
assert.equal(BIO_SOURCE_RULES.zone13zm.preparationSeconds, 20);
assert.equal(sourceMotherCount(5), 1);
assert.equal(sourceMotherCount(6), 2);
assert.equal(sourceZombieHealth(13), 6200);
assert.equal(sourceZombieHealth(13, BIO_SOURCE_RULES.lczm), 7850);
assert.equal(sourceZombieHealth(13, BIO_SOURCE_RULES.resortzm), 7700);
assert.match(mode, /z\.regenT >= this\.rules\.regenDelay/);
assert.match(mode, /this\.humanDamageMultiplier = bioHumanDamageMultiplier\(this\.kills\)/);
assert.doesNotMatch(mode, /this\.infections \* this\.rules\.damagePerInfection/);
assert.match(mode, /tryInteract\(player\)/);
assert.match(map, /weaponCrates, supplyWaves/);
assert.match(main, /get\('bioRules'\)/);
assert.match(main, /\['zone13zm', 'lczm', 'resortzm'\]/);
assert.match(main, /e\.code === 'KeyE'.*tryInteract/s);
assert.match(audio, /zombie_infec1\.wav/);
assert.match(audio, /nanoghostbreath5\.wav/);
assert.match(audio, /win_zombie1\.wav/);
assert.match(audio, /bio_bgm/);
assert.match(audio, /ok111\.wav/);

console.log('PASS: all three reviewed Squirrel rule profiles, profile metadata, fixed live health, regen, kill-based damage growth, crates, airdrops and source audio are wired.');
