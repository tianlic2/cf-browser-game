// Authored firearm hit damage that is intentionally independent from ordinary range falloff.
// Direct hits roll uniformly around the requested average; penetration multipliers are applied
// later by the firing pipeline so wooden crates still weaken both headshots and Barrett body hits.
export const HEADSHOT_DAMAGE_AVERAGES = Object.freeze({
  ak: 140,
  m4: 104,
  barrett: 750,
  deagle: 120,
});

export const BODYSHOT_DAMAGE_AVERAGES = Object.freeze({
  barrett: 300,
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
