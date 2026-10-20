export const ZOMBIE_RESPAWN_SECONDS = 3;
export const BIO_NPC_COUNT = 12;
export const BIO_INITIAL_ZOMBIES = 3;
export const BIO_DAMAGE_MILESTONE = 1000;

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
