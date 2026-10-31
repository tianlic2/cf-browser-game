#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'assets/local/cf_bio_candidates/zone13/graybox');
const nav = JSON.parse(fs.readFileSync(path.join(dir, 'zone13-navmesh.json'), 'utf8'));
const graybox = JSON.parse(fs.readFileSync(path.join(dir, 'zone13-graybox.json'), 'utf8'));
const main = nav.areas.filter((area) => area.component === 0);
const surfaceTriangles = main.flatMap((area) => [[area.corners[0], area.corners[2], area.corners[1]], [area.corners[0], area.corners[3], area.corners[2]]]);
function triangleHeight(x, z, [a, b, c]) {
  const denominator = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
  if (Math.abs(denominator) < 1e-9) return null;
  const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / denominator;
  const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / denominator;
  const w = 1 - u - v;
  return u >= -1e-5 && v >= -1e-5 && w >= -1e-5 ? u * a[1] + v * b[1] + w * c[1] : null;
}
function nearbySurfaceHeight(item) {
  if (!/bus|car|dianxiangan|light3/i.test(item.model)) return null;
  const scale = item.scale || 1;
  const bottom = item.position[1] + (item.localBounds?.min?.[1] || 0) * scale;
  const candidates = [];
  for (const radius of [0, .6, 1.2, 2.2, 3.4]) for (let step = 0; step < (radius ? 12 : 1); step += 1) {
    const angle = step / 12 * Math.PI * 2;
    const x = item.position[0] + Math.cos(angle) * radius, z = item.position[2] + Math.sin(angle) * radius;
    for (const triangle of surfaceTriangles) {
      const height = triangleHeight(x, z, triangle);
      if (height !== null && height <= bottom + 4) candidates.push(height);
    }
  }
  if (!candidates.length) return null;
  return candidates.reduce((best, height) => Math.abs(height - bottom) < Math.abs(best - bottom) ? height : best);
}
const staticPropPlacements = graybox.staticProps.map((item, index) => {
  const surfaceY = nearbySurfaceHeight(item);
  const bottom = item.position[1] + (item.localBounds?.min?.[1] || 0) * (item.scale || 1);
  const correctionY = surfaceY === null || Math.abs(surfaceY - bottom) > 3 ? 0 : surfaceY - bottom;
  return { index, correctionY };
});
const edgeUse = new Map();
const edgeKey = (a, b) => [a, b].sort((p, q) => p.join(',').localeCompare(q.join(',')))
  .map((p) => p.map((value) => Math.round(value * 1000)).join(',')).join('|');
for (const area of main) for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0]]) {
  const key = edgeKey(area.corners[a], area.corners[b]);
  edgeUse.set(key, (edgeUse.get(key) || 0) + 1);
}
const spawnStarts = nav.spawns.map((spawn) => {
  const area = nav.areas.find((candidate) => candidate.id === spawn.nearestAreaId);
  return { name: spawn.name, sourcePosition: spawn.position, position: area?.center || spawn.position, areaId: spawn.nearestAreaId };
});
const propColliders = graybox.staticProps
  .filter((item) => !/light3|walllight/i.test(item.model))
  .map((item) => {
    const correctionY = staticPropPlacements[graybox.staticProps.indexOf(item)].correctionY;
    const scale = item.scale || 1, yaw = -item.angles[1] * Math.PI / 180;
    const min = item.localBounds?.min || [-item.size[0] / 2, 0, -item.size[2] / 2];
    const max = item.localBounds?.max || [item.size[0] / 2, item.size[1], item.size[2] / 2];
    const localX = (min[0] + max[0]) * .5 * scale, localZ = (min[2] + max[2]) * .5 * scale;
    return { model: item.model,
      x: item.position[0] + localX * Math.cos(yaw) + localZ * Math.sin(yaw),
      z: item.position[2] - localX * Math.sin(yaw) + localZ * Math.cos(yaw),
      y0: item.position[1] + correctionY + min[1] * scale, h: item.position[1] + correctionY + max[1] * scale,
      hx: (max[0] - min[0]) * .5 * scale, hz: (max[2] - min[2]) * .5 * scale, yaw };
  });
const payload = {
  format: 'zone13-preview-walkmesh-v1',
  status: 'preview-only',
  actor: { radius: .38, height: 1.72, eyeHeight: 1.58, maxStep: .46, jumpVelocity: 6.2, gravity: 18 },
  stats: { areas: main.length, triangles: main.length * 2, exactBoundaryEdges: [...edgeUse.values()].filter((count) => count === 1).length, spawnStarts: spawnStarts.length, propColliders: propColliders.length },
  areas: main.map(({ id, corners, connections }) => ({ id, corners, connections: connections.filter((target) => nav.areas.some((area) => area.id === target && area.component === 0)) })),
  spawnStarts,
  staticPropPlacements,
  propColliders,
};
const output = path.join(dir, 'zone13-walkmesh.json');
fs.writeFileSync(output, `${JSON.stringify(payload)}\n`);
console.log(JSON.stringify({ output, ...payload.stats }, null, 2));
