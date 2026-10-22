// The projectile direction is world-space travel *into* the victim. At yaw 0
// NPCs face +Z. The Fox FBX's authored left/right clip names are mirrored
// relative to that facing: sampling its head bone shows "left" falls +X and
// "right" falls -X. Select by the visible fall, not by the file label.
export function selectFoxDeathDirection(impactDir, yaw, fallback = 'back') {
  const x = Number(impactDir?.x);
  const z = Number(impactDir?.z);
  if (!Number.isFinite(x) || !Number.isFinite(z) || x * x + z * z < 1e-8 ||
      !Number.isFinite(yaw)) return fallback;
  const forward = x * Math.sin(yaw) + z * Math.cos(yaw);
  const right = x * Math.cos(yaw) - z * Math.sin(yaw);
  if (Math.abs(forward) >= Math.abs(right)) return forward >= 0 ? 'forward' : 'back';
  return right >= 0 ? 'left' : 'right';
}
