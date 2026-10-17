// Stretch the imported arena while leaving players and weapons at their normal
// size. Source brush planes use n·p < d, so each normal coefficient must be
// divided by the scale applied to its corresponding coordinate.
// The arena was previously 2x wide/long and 1.3x high. Keep 80% of that size:
// X/Z = 1.6x and Y = 1.04x relative to the imported source map.
export const PRISON_HORIZONTAL_SCALE = 1.6;
export const PRISON_VERTICAL_SCALE = 1.04;

export function expandPrisonLayout(
  source, horizontalScale = PRISON_HORIZONTAL_SCALE, verticalScale = PRISON_VERTICAL_SCALE,
) {
  const data = structuredClone(source);
  for (const c of data.colliders) {
    c.x *= horizontalScale; c.z *= horizontalScale;
    c.hx *= horizontalScale; c.hz *= horizontalScale;
    c.h *= verticalScale;
    if (c.y0 !== undefined) c.y0 *= verticalScale;
    for (const plane of c.planes || []) {
      plane[0] /= horizontalScale;
      plane[1] /= verticalScale;
      plane[2] /= horizontalScale;
    }
  }
  for (const team of Object.values(data.spawns))
    for (const point of team) {
      point[0] *= horizontalScale;
      point[1] *= verticalScale;
      point[2] *= horizontalScale;
    }
  for (const item of data.topdown || []) {
    item.x *= horizontalScale; item.z *= horizontalScale;
    item.hx *= horizontalScale; item.hz *= horizontalScale;
    if (item.y0 !== undefined) item.y0 *= verticalScale;
  }
  data.bounds.hw *= horizontalScale;
  data.bounds.hl *= horizontalScale;
  if (data.floorY !== undefined) data.floorY *= verticalScale;
  data.horizontalScale = horizontalScale;
  data.verticalScale = verticalScale;
  return data;
}
