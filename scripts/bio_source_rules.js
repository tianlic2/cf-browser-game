// Faithful, data-only ports of the three local Squirrel rule sets. The browser
// never executes workshop scripts; BioMode consumes these reviewed values.
const COMMON = {
  preparationSeconds: 20, roundSeconds: 180, humanHealth: 1000,
  knockbackScale: 6, knockbackLift: 150, regenDelay: 3,
  bgmLength: 53, bgmRepeat: 54, secondMotherAt: 6,
  airdropSeconds: [60, 120], damagePerInfection: .20,
  weaponRewards: ['scar', 'm4', 'ak', 'akgold', 'm200', 'barrett'],
};

export const BIO_SOURCE_RULES = Object.freeze({
  zone13zm: Object.freeze({ ...COMMON, id: 'zone13zm', label: 'Zone 13 原版',
    humanSpeed: 1.1, humanGravity: .85, zombieHealthBase: 400,
    zombieHealthOffset: 1000, zombieSpeed: 1.2, zombieGravity: .85,
    zombieRegen: 350, lowHealthBlink: 300 }),
  lczm: Object.freeze({ ...COMMON, id: 'lczm', label: 'Lost Cities 变体',
    humanSpeed: 1, humanGravity: 1, zombieHealthBase: 450,
    zombieHealthOffset: 2000, zombieSpeed: 1.1, zombieGravity: .7,
    zombieRegen: 200, lowHealthBlink: 600 }),
  resortzm: Object.freeze({ ...COMMON, id: 'resortzm', label: 'Resort 变体',
    humanSpeed: 1, humanGravity: 1, zombieHealthBase: 450,
    zombieHealthOffset: 1850, zombieSpeed: 1.1, zombieGravity: .85,
    zombieRegen: 200, lowHealthBlink: 300 }),
});

export function bioSourceRules(id = 'zone13zm') {
  return BIO_SOURCE_RULES[id] || BIO_SOURCE_RULES.zone13zm;
}

export function sourceMotherCount(players, rules = BIO_SOURCE_RULES.zone13zm) {
  return players >= rules.secondMotherAt ? 2 : 1;
}

export function sourceZombieHealth(humans, rules = BIO_SOURCE_RULES.zone13zm) {
  return humans * rules.zombieHealthBase + rules.zombieHealthOffset;
}
