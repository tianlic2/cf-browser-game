export const ZOMBIE_RESPAWN_SECONDS = 3;

export function refillTwoMagazines(reserve, magazineSize, initialReserve) {
  return Math.min(initialReserve, reserve + magazineSize * 2);
}
