#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'assets/local/cf_bio_candidates/zone13/pak/maps/zm_zone13.nav');
const grayboxDir = path.join(root, 'assets/local/cf_bio_candidates/zone13/graybox');
const output = path.join(grayboxDir, 'zone13-navmesh.json');
const SCALE = 0.0254;
const b = fs.readFileSync(source);
let cursor = 0;
const u8 = () => b.readUInt8(cursor++);
const u16 = () => { const value = b.readUInt16LE(cursor); cursor += 2; return value; };
const u32 = () => { const value = b.readUInt32LE(cursor); cursor += 4; return value; };
const f32 = () => { const value = b.readFloatLE(cursor); cursor += 4; return value; };
const vec3 = () => [f32(), f32(), f32()];
const convert = ([x, y, z]) => [x * SCALE, z * SCALE, -y * SCALE];

const magic = u32();
if (magic !== 0xfeedface) throw new Error('Invalid Source NAV magic');
const majorVersion = u32();
const minorVersion = majorVersion >= 10 ? u32() : 0;
const bspSize = u32();
const analyzed = majorVersion >= 14 ? Boolean(u8()) : false;
const placeCount = u16();
const places = [];
for (let i = 0; i < placeCount; i += 1) {
  const length = u16();
  const name = b.toString('utf8', cursor, cursor + Math.max(0, length - 1));
  cursor += length;
  places.push(name);
}
const hasUnnamedAreas = majorVersion > 11 ? Boolean(u8()) : false;
const areaCount = u32();
const areas = [];
for (let areaIndex = 0; areaIndex < areaCount; areaIndex += 1) {
  const id = u32();
  const flags = majorVersion <= 8 ? u8() : majorVersion < 13 ? u16() : u32();
  const nw = vec3(), se = vec3(), northEastZ = f32(), southWestZ = f32();
  const connections = [];
  for (let direction = 0; direction < 4; direction += 1) {
    const count = u32();
    for (let i = 0; i < count; i += 1) connections.push(u32());
  }
  const hidingSpotCount = u8();
  cursor += hidingSpotCount * 17;
  if (majorVersion < 15) {
    const approachCount = u8();
    cursor += approachCount * 15;
  }
  const encounterPathCount = u32();
  for (let i = 0; i < encounterPathCount; i += 1) {
    u32(); u8(); u32(); u8();
    const encounterSpotCount = u8();
    cursor += encounterSpotCount * 5;
  }
  const placeId = u16();
  const ladderConnections = [];
  for (let direction = 0; direction < 2; direction += 1) {
    const count = u32();
    for (let i = 0; i < count; i += 1) ladderConnections.push(u32());
  }
  const earliestOccupy = [f32(), f32()];
  const light = majorVersion >= 11 ? [f32(), f32(), f32(), f32()] : [1, 1, 1, 1];
  const visible = [];
  if (majorVersion >= 16) {
    const count = u32();
    for (let i = 0; i < count; i += 1) visible.push([u32(), u8()]);
  }
  const inheritVisibilityFrom = u32();
  const customCount = u8();
  cursor += customCount * 14;
  const corners = [convert(nw), convert([se[0], nw[1], northEastZ]), convert(se), convert([nw[0], se[1], southWestZ])];
  const center = corners.reduce((sum, corner) => sum.map((value, axis) => value + corner[axis] / 4), [0, 0, 0]);
  areas.push({ id, flags, placeId, corners, center, connections, ladderConnections, earliestOccupy, light, visibleCount: visible.length, inheritVisibilityFrom });
}

const ladderCount = u32();
const ladders = [];
for (let i = 0; i < ladderCount; i += 1) {
  const id = u32(), width = f32(), top = convert(vec3()), bottom = convert(vec3()), length = f32(), direction = u32();
  const areaIds = [u32(), u32(), u32(), u32(), u32()];
  ladders.push({ id, width: width * SCALE, top, bottom, length: length * SCALE, direction, areaIds });
}

const byId = new Map(areas.map((area) => [area.id, area]));
const adjacency = new Map(areas.map((area) => [area.id, new Set([...area.connections, ...area.ladderConnections])]));
for (const [id, neighbors] of adjacency) for (const neighbor of neighbors) if (adjacency.has(neighbor)) adjacency.get(neighbor).add(id);
const visited = new Set();
const components = [];
for (const area of areas) {
  if (visited.has(area.id)) continue;
  const queue = [area.id], ids = [];
  visited.add(area.id);
  while (queue.length) {
    const id = queue.pop(), current = byId.get(id);
    if (!current) continue;
    ids.push(id);
    for (const neighbor of adjacency.get(id)) if (byId.has(neighbor) && !visited.has(neighbor)) { visited.add(neighbor); queue.push(neighbor); }
  }
  components.push(ids);
}
components.sort((a, c) => c.length - a.length);
const largest = new Set(components[0] || []);
for (const area of areas) area.component = largest.has(area.id) ? 0 : components.findIndex((component) => component.includes(area.id));

const graybox = JSON.parse(fs.readFileSync(path.join(grayboxDir, 'zone13-graybox.json'), 'utf8'));
const spawns = graybox.markers.filter((marker) => marker.kind === 'spawn').map((marker) => {
  let nearest = null, distance = Infinity;
  for (const area of areas) {
    const dx = marker.position[0] - area.center[0], dz = marker.position[2] - area.center[2], dy = marker.position[1] - area.center[1];
    const score = dx * dx + dz * dz + dy * dy * 2;
    if (score < distance) { distance = score; nearest = area; }
  }
  return { ...marker, nearestAreaId: nearest?.id || 0, component: nearest?.component ?? -1, distance: Math.sqrt(distance) };
});

const payload = {
  format: 'zone13-source-nav-v16', majorVersion, minorVersion, bspSize, analyzed, hasUnnamedAreas, places,
  stats: { areas: areas.length, ladders: ladders.length, connections: areas.reduce((sum, area) => sum + area.connections.length, 0), components: components.length, largestComponent: components[0]?.length || 0, spawns: spawns.length, spawnsOnLargestComponent: spawns.filter((spawn) => spawn.component === 0).length, parsedBytes: cursor, sourceBytes: b.length },
  areas, ladders, spawns,
};
fs.writeFileSync(output, `${JSON.stringify(payload)}\n`);
console.log(JSON.stringify({ output, ...payload.stats }, null, 2));
