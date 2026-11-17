// Zone 13 uses the complete Source BSP mesh for visuals, but gameplay queries
// must never raycast that whole mesh every actor frame. This index keeps the
// authored triangles while restricting each query to the X/Z cells it crosses.

const EPSILON = 1e-7;

function cellKey(x, z) { return `${x},${z}`; }

function segmentHitsTriangle(p0x, p0y, p0z, p1x, p1y, p1z, triangle) {
  const dx = p1x - p0x, dy = p1y - p0y, dz = p1z - p0z;
  const e1x = triangle.bx - triangle.ax;
  const e1y = triangle.by - triangle.ay;
  const e1z = triangle.bz - triangle.az;
  const e2x = triangle.cx - triangle.ax;
  const e2y = triangle.cy - triangle.ay;
  const e2z = triangle.cz - triangle.az;
  const px = dy * e2z - dz * e2y;
  const py = dz * e2x - dx * e2z;
  const pz = dx * e2y - dy * e2x;
  const determinant = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(determinant) < EPSILON) return false;
  const inverse = 1 / determinant;
  const tx = p0x - triangle.ax;
  const ty = p0y - triangle.ay;
  const tz = p0z - triangle.az;
  const u = (tx * px + ty * py + tz * pz) * inverse;
  if (u < -EPSILON || u > 1 + EPSILON) return false;
  const qx = ty * e1z - tz * e1y;
  const qy = tz * e1x - tx * e1z;
  const qz = tx * e1y - ty * e1x;
  const v = (dx * qx + dy * qy + dz * qz) * inverse;
  if (v < -EPSILON || u + v > 1 + EPSILON) return false;
  const t = (e2x * qx + e2y * qy + e2z * qz) * inverse;
  return t > 1e-5 && t <= 1 + EPSILON;
}
function segmentHitsBox(p0x, p0y, p0z, p1x, p1y, p1z, box) {
  const yaw = box.yaw || 0, cos = Math.cos(yaw), sin = Math.sin(yaw);
  const toLocal = (x, z) => {
    const dx = x - box.x, dz = z - box.z;
    return [dx * cos - dz * sin, dx * sin + dz * cos];
  };
  const p0 = toLocal(p0x, p0z), p1 = toLocal(p1x, p1z);
  const hx = box.localHx ?? box.hx, hz = box.localHz ?? box.hz;
  let near = 0, far = 1;
  const testAxis = (start, delta, min, max) => {
    if (Math.abs(delta) < EPSILON) return start >= min && start <= max;
    let a = (min - start) / delta, b = (max - start) / delta;
    if (a > b) [a, b] = [b, a];
    near = Math.max(near, a); far = Math.min(far, b);
    return near <= far;
  };
  return testAxis(p0[0], p1[0] - p0[0], -hx, hx) &&
    testAxis(p0y, p1y - p0y, box.y0 ?? 0, box.h) &&
    testAxis(p0[1], p1[1] - p0[1], -hz, hz) && far > 1e-5;
}

function triangleHeightAt(x, z, triangle) {
  const denominator = (triangle.bz - triangle.cz) * (triangle.ax - triangle.cx) +
    (triangle.cx - triangle.bx) * (triangle.az - triangle.cz);
  if (Math.abs(denominator) < EPSILON) return null;
  const u = ((triangle.bz - triangle.cz) * (x - triangle.cx) +
    (triangle.cx - triangle.bx) * (z - triangle.cz)) / denominator;
  const v = ((triangle.cz - triangle.az) * (x - triangle.cx) +
    (triangle.ax - triangle.cx) * (z - triangle.cz)) / denominator;
  const w = 1 - u - v;
  if (u < -1e-5 || v < -1e-5 || w < -1e-5) return null;
  return u * triangle.ay + v * triangle.by + w * triangle.cy;
}

function pointSegmentDistanceSq(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const lengthSq = dx * dx + dz * dz;
  const t = lengthSq > EPSILON ? Math.max(0, Math.min(1,
    ((px - ax) * dx + (pz - az) * dz) / lengthSq)) : 0;
  const qx = ax + dx * t, qz = az + dz * t;
  return (px - qx) ** 2 + (pz - qz) ** 2;
}

function segmentsIntersect2d(a, b, c, d) {
  const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) -
    (q[1] - p[1]) * (r[0] - p[0]);
  const abC = cross(a, b, c), abD = cross(a, b, d);
  const cdA = cross(c, d, a), cdB = cross(c, d, b);
  return abC * abD <= EPSILON && cdA * cdB <= EPSILON &&
    Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])) <=
      Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0])) + EPSILON &&
    Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1])) <=
      Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1])) + EPSILON;
}

function segmentDistanceSq2d(a, b, c, d) {
  if (segmentsIntersect2d(a, b, c, d)) return 0;
  return Math.min(
    pointSegmentDistanceSq(a[0], a[1], c[0], c[1], d[0], d[1]),
    pointSegmentDistanceSq(b[0], b[1], c[0], c[1], d[0], d[1]),
    pointSegmentDistanceSq(c[0], c[1], a[0], a[1], b[0], b[1]),
    pointSegmentDistanceSq(d[0], d[1], a[0], a[1], b[0], b[1]),
  );
}

// Intersect a non-horizontal BSP triangle with a horizontal actor sample.
// The resulting X/Z segment is the exact visible wall cross-section at that
// height, so capsule corners cannot slip between three approximate rays.
function triangleSliceAtY(triangle, y) {
  if (y < triangle.minY - 1e-5 || y > triangle.maxY + 1e-5) return null;
  const vertices = [
    [triangle.ax, triangle.ay, triangle.az],
    [triangle.bx, triangle.by, triangle.bz],
    [triangle.cx, triangle.cy, triangle.cz],
  ];
  const points = [];
  const add = (x, z) => {
    if (!points.some((point) => Math.hypot(point[0] - x, point[1] - z) < 1e-5))
      points.push([x, z]);
  };
  for (let i = 0; i < 3; i++) {
    const a = vertices[i], b = vertices[(i + 1) % 3];
    if (Math.abs(a[1] - y) < 1e-6) add(a[0], a[2]);
    const span = b[1] - a[1];
    if (Math.abs(span) < EPSILON) continue;
    const t = (y - a[1]) / span;
    if (t >= -1e-6 && t <= 1 + 1e-6)
      add(a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t);
  }
  if (points.length < 2) return null;
  let pair = [points[0], points[1]], farthest = -Infinity;
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    const distance = (points[i][0] - points[j][0]) ** 2 + (points[i][1] - points[j][1]) ** 2;
    if (distance > farthest) { farthest = distance; pair = [points[i], points[j]]; }
  }
  return pair;
}

function pointOnPropTop(x, z, collider, padding = 0) {
  const dx = x - collider.x, dz = z - collider.z;
  const yaw = collider.yaw || 0;
  const localX = dx * Math.cos(yaw) - dz * Math.sin(yaw);
  const localZ = dx * Math.sin(yaw) + dz * Math.cos(yaw);
  return Math.abs(localX) <= (collider.localHx ?? collider.hx) + padding &&
    Math.abs(localZ) <= (collider.localHz ?? collider.hz) + padding;
}

export function createZone13SpatialCollision(worldData, buffer, propColliders = [], options = {}) {
  const cellSize = options.cellSize || 4;
  const triangles = [];
  const cells = new Map(), wallCells = new Map();
  const addToCells = (table, triangle, index) => {
    const minX = Math.floor(triangle.minX / cellSize), maxX = Math.floor(triangle.maxX / cellSize);
    const minZ = Math.floor(triangle.minZ / cellSize), maxZ = Math.floor(triangle.maxZ / cellSize);
    for (let z = minZ; z <= maxZ; z++) for (let x = minX; x <= maxX; x++) {
      const key = cellKey(x, z);
      let bucket = table.get(key);
      if (!bucket) table.set(key, bucket = []);
      bucket.push(index);
    }
  };
  for (const group of worldData.groups) {
    if (!group.vertexCount) continue;
    const stride = group.strideFloats || 8;
    const packed = new Float32Array(buffer, group.byteOffset, group.byteLength / 4);
    for (let vertex = 0; vertex + 2 < group.vertexCount; vertex += 3) {
      const a = vertex * stride, b = (vertex + 1) * stride, c = (vertex + 2) * stride;
      const triangle = {
        ax: packed[a], ay: packed[a + 1], az: packed[a + 2],
        bx: packed[b], by: packed[b + 1], bz: packed[b + 2],
        cx: packed[c], cy: packed[c + 1], cz: packed[c + 2],
      };
      const e1x = triangle.bx - triangle.ax, e1y = triangle.by - triangle.ay, e1z = triangle.bz - triangle.az;
      const e2x = triangle.cx - triangle.ax, e2y = triangle.cy - triangle.ay, e2z = triangle.cz - triangle.az;
      const nx = e1y * e2z - e1z * e2y;
      const ny = e1z * e2x - e1x * e2z;
      const nz = e1x * e2y - e1y * e2x;
      const length = Math.hypot(nx, ny, nz);
      if (length < EPSILON) continue;
      triangle.normalY = ny / length;
      triangle.minX = Math.min(triangle.ax, triangle.bx, triangle.cx);
      triangle.maxX = Math.max(triangle.ax, triangle.bx, triangle.cx);
      triangle.minY = Math.min(triangle.ay, triangle.by, triangle.cy);
      triangle.maxY = Math.max(triangle.ay, triangle.by, triangle.cy);
      triangle.minZ = Math.min(triangle.az, triangle.bz, triangle.cz);
      triangle.maxZ = Math.max(triangle.az, triangle.bz, triangle.cz);
      const index = triangles.push(triangle) - 1;
      addToCells(cells, triangle, index);
      if (Math.abs(triangle.normalY) < .72) addToCells(wallCells, triangle, index);
    }
  }

  const marks = new Uint32Array(triangles.length);
  let generation = 0;
  const candidates = [];
  const stats = { triangleCount: triangles.length, wallCellCount: wallCells.size,
    allCellCount: cells.size, movementQueries: 0, lineQueries: 0,
    triangleTests: 0, candidateTotal: 0, maxCandidates: 0 };
  const collect = (table, x0, z0, x1, z1, padding = 0) => {
    candidates.length = 0;
    generation++;
    if (generation === 0xffffffff) { marks.fill(0); generation = 1; }
    const minX = Math.floor((Math.min(x0, x1) - padding) / cellSize);
    const maxX = Math.floor((Math.max(x0, x1) + padding) / cellSize);
    const minZ = Math.floor((Math.min(z0, z1) - padding) / cellSize);
    const maxZ = Math.floor((Math.max(z0, z1) + padding) / cellSize);
    for (let z = minZ; z <= maxZ; z++) for (let x = minX; x <= maxX; x++) {
      for (const index of table.get(cellKey(x, z)) || []) {
        if (marks[index] === generation) continue;
        marks[index] = generation; candidates.push(index);
      }
    }
    stats.candidateTotal += candidates.length;
    stats.maxCandidates = Math.max(stats.maxCandidates, candidates.length);
    return candidates;
  };

  const segmentBlocked = (p0x, p0y, p0z, p1x, p1y, p1z, list) => {
    for (const index of list) {
      const triangle = triangles[index];
      if (triangle.maxY < Math.min(p0y, p1y) - .01 || triangle.minY > Math.max(p0y, p1y) + .01) continue;
      stats.triangleTests++;
      if (segmentHitsTriangle(p0x, p0y, p0z, p1x, p1y, p1z, triangle)) return true;
    }
    return false;
  };

  const blocksMovement = (x0, z0, x1, z1, feetY, radius = .38,
      stepHeight = .46, actorHeight = 1.72) => {
    stats.movementQueries++;
    const distance = Math.hypot(x1 - x0, z1 - z0);
    if (distance < 1e-5) return false;
    const dx = (x1 - x0) / distance, dz = (z1 - z0) / distance;
    const sideX = -dz, sideZ = dx;
    const list = collect(wallCells, x0, z0, x1, z1, radius + .06);
    // Source's standing hull can step over an 18-unit (.4572m) curb. Sampling
    // every segment at .3m incorrectly turns those risers into walls. Begin
    // just above the admitted step while grounded; airborne callers pass zero
    // so crate sides remain solid until the feet really clear the top. The
    // upper sample follows the current stance, which is what makes jump-duck
    // through a window physically possible instead of merely lowering camera.
    const low = Math.min(actorHeight - .06, Math.max(.08, stepHeight + .035));
    const high = Math.max(low, actorHeight - .08);
    const heights = high - low > .28 ? [low, (low + high) * .5, high] : [low, high];
    for (const lateral of [-radius, 0, radius]) for (const height of heights) {
      const startX = x0 + sideX * lateral + dx * .025;
      const startZ = z0 + sideZ * lateral + dz * .025;
      const endX = x0 + sideX * lateral + dx * (distance + .04);
      const endZ = z0 + sideZ * lateral + dz * (distance + .04);
      if (segmentBlocked(startX, feetY + height, startZ,
        endX, feetY + height, endZ, list)) return true;
    }
    // Three offset rays are fast and catch broad faces, but a short crate
    // triangle or diagonal corner can sit between them. Compare the swept
    // circle with every exact horizontal wall slice as a second, local pass.
    // If the capsule already touches a wall, parallel/outward motion remains
    // legal so the player can slide free instead of becoming trapped.
    const moveA = [x0, z0], moveB = [x1, z1];
    const radiusSq = Math.max(0, radius - 1e-4) ** 2;
    for (const height of heights) {
      const y = feetY + height, slices = [];
      for (const index of list) {
        const triangle = triangles[index];
        if (triangle.maxY < y - .01 || triangle.minY > y + .01) continue;
        const slice = triangleSliceAtY(triangle, y);
        if (slice) slices.push(slice);
      }
      if (!slices.length) continue;
      let startDistance = Infinity, endDistance = Infinity, sweptDistance = Infinity;
      for (const [a, b] of slices) {
        startDistance = Math.min(startDistance,
          pointSegmentDistanceSq(x0, z0, a[0], a[1], b[0], b[1]));
        endDistance = Math.min(endDistance,
          pointSegmentDistanceSq(x1, z1, a[0], a[1], b[0], b[1]));
        sweptDistance = Math.min(sweptDistance, segmentDistanceSq2d(moveA, moveB, a, b));
      }
      if (startDistance <= radiusSq + 1e-6) {
        if (endDistance < startDistance - 1e-6) return true;
      } else if (sweptDistance <= radiusSq) return true;
    }
    return false;
  };

  const hasVerticalClearance = (x, z, feetY, actorHeight = 1.72, radius = .38) => {
    const startY = feetY + .045, endY = feetY + actorHeight - .018;
    if (endY <= startY) return true;
    const list = collect(cells, x, z, x, z, radius + .035);
    for (let i = 0; i < 9; i++) {
      const angle = i / 8 * Math.PI * 2;
      const px = x + (i ? Math.cos(angle) * radius : 0);
      const pz = z + (i ? Math.sin(angle) * radius : 0);
      if (segmentBlocked(px, startY, pz, px, endY, pz, list)) return false;
    }
    for (const collider of propColliders) {
      if (collider.active === false) continue;
      if ((collider.y0 ?? 0) >= endY || collider.h <= startY) continue;
      if (pointOnPropTop(x, z, collider, radius)) return false;
    }
    return true;
  };

  // Highest authored horizontal surface crossed by a descending foot. Source
  // NAV does not cover every crate top, narrow slab or static prop, so using it
  // alone lets a fast falling frame tunnel through those visible surfaces.
  const horizontalSurfaceAt = (x, z, maxFeet, radius = .38, probeScale = .82) => {
    let top = -Infinity;
    const probes = [[x, z]];
    for (let i = 0; i < 8; i++) {
      const angle = i / 8 * Math.PI * 2;
      probes.push([x + Math.cos(angle) * radius * probeScale,
        z + Math.sin(angle) * radius * probeScale]);
    }
    const list = [...collect(cells, x, z, x, z, radius + .03)];
    for (const [px, pz] of probes) {
      for (const index of list) {
        const triangle = triangles[index];
        if (Math.abs(triangle.normalY) < .58 || triangle.minY > maxFeet + .035) continue;
        const height = triangleHeightAt(px, pz, triangle);
        if (height !== null && height <= maxFeet + .035) top = Math.max(top, height);
      }
      for (const collider of propColliders) {
        if (collider.active === false || collider.h > maxFeet + .035) continue;
        if (pointOnPropTop(px, pz, collider)) top = Math.max(top, collider.h);
      }
    }
    return top;
  };
  const landingSurfaceAt = (x, z, maxFeet, radius = .38) =>
    horizontalSurfaceAt(x, z, maxFeet, radius, .82);
  // Persistent support for visible crate/slab tops that Source NAV omits.
  // Standing uses a smaller foot patch than landing so edge catches remain
  // possible without bridging broad empty gaps.
  const supportSurfaceAt = (x, z, maxFeet, radius = .38) =>
    horizontalSurfaceAt(x, z, maxFeet, radius, .48);

  // Lowest visible BSP surface crossed by a rising head. Horizontal movement
  // already checks wall triangles, but without this vertical query a jump can
  // enter a crate, balcony or thin ceiling from below.
  const ceilingSurfaceAt = (x, z, minHead, maxHead, radius = .38) => {
    if (maxHead <= minHead + 1e-6) return Infinity;
    let ceiling = Infinity;
    const probes = [[x, z]];
    for (let i = 0; i < 8; i++) {
      const angle = i / 8 * Math.PI * 2;
      probes.push([x + Math.cos(angle) * radius * .82,
        z + Math.sin(angle) * radius * .82]);
    }
    const list = [...collect(cells, x, z, x, z, radius + .03)];
    for (const [px, pz] of probes) for (const index of list) {
      const triangle = triangles[index];
      if (Math.abs(triangle.normalY) < .2 || triangle.maxY < minHead - .01 ||
          triangle.minY > maxHead + .01) continue;
      const height = triangleHeightAt(px, pz, triangle);
      if (height !== null && height >= minHead - .005 && height <= maxHead + .005)
        ceiling = Math.min(ceiling, height);
    }
    return ceiling;
  };

  const lineClear = (a, b, eyeHeight = 1.2) => {
    stats.lineQueries++;
    const p0y = (a.y || 0) + eyeHeight, p1y = (b.y || 0) + eyeHeight;
    const list = collect(cells, a.x, a.z, b.x, b.z, .02);
    if (segmentBlocked(a.x, p0y, a.z, b.x, p1y, b.z, list)) return false;
    for (const collider of propColliders) {
      if (collider.active === false) continue;
      if (segmentHitsBox(a.x, p0y, a.z, b.x, p1y, b.z, collider)) return false;
    }
    return true;
  };

  return { blocksMovement, hasVerticalClearance, landingSurfaceAt, supportSurfaceAt,
    ceilingSurfaceAt,
    lineClear, stats,
    resetStats() { stats.movementQueries = stats.lineQueries = stats.triangleTests = 0;
      stats.candidateTotal = stats.maxCandidates = 0; } };
}
