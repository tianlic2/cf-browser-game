// Relative to the knife's 7.2 m/s running speed. These are gameplay tuning
// ratios inspired by classic CF's weapon-weight ordering, not client data.
export const WEAPON_MOVE_SCALE = Object.freeze({
  knife: 1,
  frag: .98, flash: .98, smoke: .98,
  pistol: .97,
  deagle: .94,
  m4: .91,
  ak: .89,
  awm: .82,
  barrett: .72,
});

export function weaponMoveScale(id) {
  return WEAPON_MOVE_SCALE[id] ?? 1;
}
