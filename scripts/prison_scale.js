// map.json/map.bin already use the source BSP dimensions converted from Source
// inches to metres. Keep every axis at that authored size. The transform below
// is retained so geometry, collision, spawns and radar always share one scale.
export const PRISON_HORIZONTAL_SCALE = 1;
export const PRISON_VERTICAL_SCALE = 1;

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
