// Firearm headshot damage is intentionally independent from body-shot range falloff.
// Direct headshots roll uniformly around the weapon's requested average; penetration
// multipliers are applied later by the firing pipeline so wooden crates still weaken shots.
export const HEADSHOT_DAMAGE_AVERAGES = Object.freeze({
  ak: 140,
  m4: 104,
  barrett: 750,
  deagle: 120,
});

export const HEADSHOT_DAMAGE_MIN_FACTOR = 0.90;
export const HEADSHOT_DAMAGE_MAX_FACTOR = 1.10;

export function rollHeadshotDamage(weaponId, randomValue = Math.random()) {
  const average = HEADSHOT_DAMAGE_AVERAGES[weaponId];
  if (!Number.isFinite(average)) return null;

  const finiteRoll = Number.isFinite(randomValue) ? randomValue : 0.5;
  const roll = Math.min(1, Math.max(0, finiteRoll));
  const factor = HEADSHOT_DAMAGE_MIN_FACTOR
    + (HEADSHOT_DAMAGE_MAX_FACTOR - HEADSHOT_DAMAGE_MIN_FACTOR) * roll;
  return Math.round(average * factor);
}
