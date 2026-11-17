export const HUMAN_RUN_SPEED = 7.2;

// Weapon weight expressed as a movement multiplier relative to melee. These
// are game-balance values, not real-world mass or official CF client values.
export const WEAPON_MOVE_SCALE = Object.freeze({
  knife: 1,
  frag: 1, flash: 1, smoke: 1,
  deagle: .90,
  m4: .78, scar: .78, akgold: .78, kn57: .78, ak: .78,
  barrett: .60, m200: .78, awm_nature: .70,
  cfv_ak47: .78, cfv_aug: .78, cfv_famas: .78, cfv_galil: .78,
  cfv_m4a1: .78, cfv_sg552: .78,
  cfv_m249: .60,
  cfv_mac10: .85, cfv_mp5: .85, cfv_p90: .85, cfv_tmp: .85, cfv_ump45: .85,
  cfv_deagle: .90, cfv_elite: .90, cfv_fiveseven: .90,
  cfv_glock18: .90, cfv_p228: .90, cfv_usp: .90,
  cfv_awp: .70, cfv_scout: .78, cfv_g3sg1: .73, cfv_sg550: .73,
  cfv_m3: .76, cfv_xm1014: .76,
});

export function weaponMoveScale(id) {
  return WEAPON_MOVE_SCALE[id] ?? 1;
}
