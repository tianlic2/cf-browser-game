export const ZOMBIE_RESPAWN_SECONDS = 3;
export const BIO_NPC_COUNT = 12;
export const BIO_INITIAL_ZOMBIES = 8;
export const BIO_ZOMBIE_HEALTH = 10000;
export const BIO_DAMAGE_PER_ZOMBIE_KILL = .10;
export function bioHumanDamageMultiplier(kills) {
  return 1 + Math.max(0, Math.floor(Number.isFinite(kills) ? kills : 0)) * BIO_DAMAGE_PER_ZOMBIE_KILL;
}
export const BIO_DAMAGE_MILESTONE = 1000;

// Represent the unfinished thousand without changing the actual score.
export function bioDamageBadges(total) {
  const hundreds = Math.floor(Math.max(0, Number(total) || 0) / 100) % 10;
  return [...(hundreds >= 5 ? [500] : []), ...Array(hundreds % 5).fill(100)];
}

export function refillTwoMagazines(reserve, magazineSize, initialReserve) {
  return Math.min(initialReserve, reserve + magazineSize * 2);
}

export function crossedDamageMilestones(previous, total, step = BIO_DAMAGE_MILESTONE) {
  if (!Number.isFinite(previous) || !Number.isFinite(total) || !Number.isFinite(step) || step <= 0)
    return [];
  const first = Math.floor(Math.max(0, previous) / step) + 1;
  const last = Math.floor(Math.max(0, total) / step);
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => (first + i) * step);
}
