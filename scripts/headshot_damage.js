import { WEAPON_TUNING } from './weapon_tuning.js?v=approved-20261029';

// Authored firearm hit damage that is intentionally independent from ordinary range falloff.
// Direct hits roll uniformly around the requested average; penetration multipliers are applied
// later by the firing pipeline so wooden crates still weaken both headshots and Barrett body hits.
export const HEADSHOT_DAMAGE_AVERAGES = Object.freeze({
  ak: WEAPON_TUNING.ak.stats.head,
  m4: WEAPON_TUNING.m4.stats.head,
  ironbeast: WEAPON_TUNING.ironbeast.stats.head,
  scar: WEAPON_TUNING.scar.stats.head,
  m200: WEAPON_TUNING.m200.stats.head,
  akgold: WEAPON_TUNING.akgold.stats.head,
  kn57: WEAPON_TUNING.kn57.stats.head,
  barrett: WEAPON_TUNING.barrett.stats.head,
  deagle: WEAPON_TUNING.deagle.stats.head,
});

export const BODYSHOT_DAMAGE_AVERAGES = Object.freeze({
  barrett: WEAPON_TUNING.barrett.stats.dmg,
});

export const HEADSHOT_DAMAGE_MIN_FACTOR = 0.90;
export const HEADSHOT_DAMAGE_MAX_FACTOR = 1.10;

function rollAroundAverage(average, randomValue) {
  if (!Number.isFinite(average)) return null;

  const finiteRoll = Number.isFinite(randomValue) ? randomValue : 0.5;
  const roll = Math.min(1, Math.max(0, finiteRoll));
  const factor = HEADSHOT_DAMAGE_MIN_FACTOR
    + (HEADSHOT_DAMAGE_MAX_FACTOR - HEADSHOT_DAMAGE_MIN_FACTOR) * roll;
  return Math.round(average * factor);
}

export function rollHeadshotDamage(weaponId, randomValue = Math.random()) {
  return rollAroundAverage(HEADSHOT_DAMAGE_AVERAGES[weaponId], randomValue);
}

export function rollBodyshotDamage(weaponId, randomValue = Math.random()) {
  return rollAroundAverage(BODYSHOT_DAMAGE_AVERAGES[weaponId], randomValue);
}
