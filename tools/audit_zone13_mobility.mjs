#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'assets/local/cf_bio_candidates/zone13/graybox');
const nav = JSON.parse(fs.readFileSync(path.join(dir, 'zone13-navmesh.json'), 'utf8'));
const walk = JSON.parse(fs.readFileSync(path.join(dir, 'zone13-walkmesh.json'), 'utf8'));
const areas = nav.areas.filter((area) => area.component === 0);
const byId = new Map(areas.map((area) => [area.id, area]));

function transitionRise(a, b) {
  const ax = a.corners.map((point) => point[0]), az = a.corners.map((point) => point[2]);
  const bx = b.corners.map((point) => point[0]), bz = b.corners.map((point) => point[2]);
  const minX = Math.max(Math.min(...ax), Math.min(...bx)), maxX = Math.min(Math.max(...ax), Math.max(...bx));
  const minZ = Math.max(Math.min(...az), Math.min(...bz)), maxZ = Math.min(Math.max(...az), Math.max(...bz));
  const gapX = Math.max(0, minX - maxX), gapZ = Math.max(0, minZ - maxZ);
  const planarGap = Math.hypot(gapX, gapZ);
  const x = gapX ? (minX + maxX) * .5 : (minX + maxX) * .5;
  const z = gapZ ? (minZ + maxZ) * .5 : (minZ + maxZ) * .5;
  const height = (area) => {
    for (const ids of [[0, 2, 1], [0, 3, 2]]) {
      const [p, q, r] = ids.map((index) => area.corners[index]);
      const denominator = (q[2] - r[2]) * (p[0] - r[0]) + (r[0] - q[0]) * (p[2] - r[2]);
      if (Math.abs(denominator) < 1e-9) continue;
      const u = ((q[2] - r[2]) * (x - r[0]) + (r[0] - q[0]) * (z - r[2])) / denominator;
      const v = ((r[2] - p[2]) * (x - r[0]) + (p[0] - r[0]) * (z - r[2])) / denominator;
      const w = 1 - u - v;
      if (u >= -.01 && v >= -.01 && w >= -.01) return u * p[1] + v * q[1] + w * r[1];
    }
    return area.center[1];
  };
  return { rise: Math.abs(height(a) - height(b)), sharedBoundary: planarGap <= .08 };
}

const transitions = [];
for (const area of areas) for (const targetId of area.connections) {
  if (area.id >= targetId || !byId.has(targetId)) continue;
  const target = byId.get(targetId);
  const { rise, sharedBoundary } = transitionRise(area, target);
  const reverse = target.connections.includes(area.id);
  const oneWayDown = !reverse && area.center[1] > target.center[1];
  const mode = !sharedBoundary
    ? (oneWayDown ? 'drop' : 'offmesh')
    : rise <= walk.actor.maxStep ? 'walk' : rise <= 1.25 ? 'jump' : oneWayDown ? 'drop' : 'blocked';
  transitions.push({ from: area.id, to: targetId, rise, sharedBoundary, reverse, mode });
}

const allowed = new Map(areas.map((area) => [area.id, []]));
for (const edge of transitions) if (!['blocked', 'offmesh'].includes(edge.mode)) {
  allowed.get(edge.from).push(edge.to);
  allowed.get(edge.to).push(edge.from);
}
const startId = walk.spawnStarts[0]?.areaId;
const visited = new Set(startId ? [startId] : []), queue = startId ? [startId] : [];
while (queue.length) {
  const id = queue.shift();
  for (const next of allowed.get(id) || []) if (!visited.has(next)) { visited.add(next); queue.push(next); }
}
const deadEnds = [...allowed].filter(([, links]) => links.length <= 1).map(([id]) => id);
const payload = {
  format: 'zone13-mobility-audit-v1',
  status: 'preview-only',
  actor: walk.actor,
  summary: {
    areas: areas.length,
    transitions: transitions.length,
    walkingTransitions: transitions.filter((edge) => edge.mode === 'walk').length,
    jumpTransitions: transitions.filter((edge) => edge.mode === 'jump').length,
    dropTransitions: transitions.filter((edge) => edge.mode === 'drop').length,
    offmeshTransitions: transitions.filter((edge) => edge.mode === 'offmesh').length,
    blockedTransitions: transitions.filter((edge) => edge.mode === 'blocked').length,
    reachableAreas: visited.size,
    unreachableAreas: areas.length - visited.size,
    spawnStarts: walk.spawnStarts.length,
    reachableSpawnStarts: walk.spawnStarts.filter((spawn) => visited.has(spawn.areaId)).length,
    deadEnds: deadEnds.length,
    propColliders: walk.propColliders.length,
  },
  blockedTransitions: transitions.filter((edge) => edge.mode === 'blocked'),
  riskTransitions: transitions.filter((edge) => ['blocked', 'offmesh'].includes(edge.mode)),
  offmeshTransitions: transitions.filter((edge) => edge.mode === 'offmesh'),
  dropTransitions: transitions.filter((edge) => edge.mode === 'drop'),
  jumpTransitions: transitions.filter((edge) => edge.mode === 'jump'),
  deadEnds,
};
const output = path.join(dir, 'zone13-mobility-audit.json');
fs.writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify({ output, ...payload.summary }, null, 2));
