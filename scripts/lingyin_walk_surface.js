// Index the actual rendered mountain paving triangles in X/Z. The authored
// centreline is useful for grading and rails, but its constant-width distance
// test does not cover mitered corners or the terrain-adjusted vertex heights.
export function triangulatedWalkSurface(geometry, verticalOffset = 0, cellSize = 2) {
  const positions = geometry.getAttribute('position');
  const indices = geometry.getIndex();
  const cells = new Map();
  const triangles = [];
  const key = (ix, iz) => `${ix},${iz}`;
  for (let i = 0; i < indices.count; i += 3) {
    const ia = indices.getX(i), ib = indices.getX(i + 1), ic = indices.getX(i + 2);
    const ax = positions.getX(ia), az = positions.getZ(ia), ay = positions.getY(ia) + verticalOffset;
    const bx = positions.getX(ib), bz = positions.getZ(ib), by = positions.getY(ib) + verticalOffset;
    const cx = positions.getX(ic), cz = positions.getZ(ic), cy = positions.getY(ic) + verticalOffset;
    const area = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(area) < 1e-8) continue;
    const triangle = {ax, az, ay, bx, bz, by, cx, cz, cy, invArea: 1 / area};
    const id = triangles.push(triangle) - 1;
    const x0 = Math.floor(Math.min(ax, bx, cx) / cellSize);
    const x1 = Math.floor(Math.max(ax, bx, cx) / cellSize);
    const z0 = Math.floor(Math.min(az, bz, cz) / cellSize);
    const z1 = Math.floor(Math.max(az, bz, cz) / cellSize);
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
      const k = key(ix, iz);
      if (!cells.has(k)) cells.set(k, []);
      cells.get(k).push(id);
    }
  }
  return (x, z) => {
    const hits = [];
    for (const id of cells.get(key(Math.floor(x / cellSize), Math.floor(z / cellSize))) || []) {
      const t = triangles[id];
      const a = ((t.bz - t.cz) * (x - t.cx) + (t.cx - t.bx) * (z - t.cz)) * t.invArea;
      const b = ((t.cz - t.az) * (x - t.cx) + (t.ax - t.cx) * (z - t.cz)) * t.invArea;
      const c = 1 - a - b;
      if (a >= -1e-5 && b >= -1e-5 && c >= -1e-5)
        hits.push(a * t.ay + b * t.by + c * t.cy);
    }
    return hits;
  };
}
