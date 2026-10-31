#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'assets/local/cf_bio_candidates/zone13/extracted/zm_zone13.bsp');
const outputDir = path.join(root, 'assets/local/cf_bio_candidates/zone13/graybox');
const manifestPath = path.join(outputDir, 'zone13-graybox.json');
const meshPath = path.join(outputDir, 'zone13-graybox.bin');

const SCALE = 0.0254;
const LUMP = {
  entities: 0,
  texdata: 2,
  vertices: 3,
  texinfo: 6,
  faces: 7,
  edges: 12,
  surfedges: 13,
  gameLump: 35,
  texStringData: 43,
  texStringTable: 44,
};

const categories = [
  { id: 'atlas', color: '#ffffff', texture: 'zone13-material-atlas.png' },
  { id: 'stone', color: '#a8ada6' },
  { id: 'concrete', color: '#90989a' },
  { id: 'metal', color: '#71858c' },
  { id: 'wood', color: '#936b4b' },
  { id: 'glass', color: '#69a2ad' },
  { id: 'ground', color: '#78816a' },
  { id: 'detail', color: '#a1937d' },
];
const atlasManifestPath = path.join(outputDir, 'zone13-material-atlas.json');
const atlasManifest = fs.existsSync(atlasManifestPath) ? JSON.parse(fs.readFileSync(atlasManifestPath, 'utf8')) : { slots: [], columns: 4 };
const atlasSlots = new Map(atlasManifest.slots.map((slot) => [slot.name.toLowerCase(), slot]));
const atlasColumns = atlasManifest.columns || 4;

function lump(buffer, index) {
  const base = 8 + index * 16;
  return {
    offset: buffer.readInt32LE(base),
    length: buffer.readInt32LE(base + 4),
    version: buffer.readInt32LE(base + 8),
  };
}

function readCString(buffer, offset, limit = buffer.length) {
  let end = offset;
  while (end < limit && buffer[end] !== 0) end += 1;
  return buffer.toString('utf8', offset, end);
}

function parseEntities(text) {
  const result = [];
  const blocks = text.match(/\{[\s\S]*?\}/g) || [];
  for (const block of blocks) {
    const entity = {};
    for (const match of block.matchAll(/"([^"]*)"\s+"([^"]*)"/g)) entity[match[1]] = match[2];
    result.push(entity);
  }
  return result;
}

function categoryFor(texture) {
  const name = texture.toLowerCase();
  if (/glass|window|water/.test(name)) return 'glass';
  if (/metal|steel|iron|vent|pipe|door/.test(name)) return 'metal';
  if (/wood|plank|crate|board/.test(name)) return 'wood';
  if (/grass|dirt|ground|sand|mud|rock|cliff/.test(name)) return 'ground';
  if (/stone|brick|tile|pave/.test(name)) return 'stone';
  if (/concrete|cement|wall|floor|ceiling|plaster/.test(name)) return 'concrete';
  return 'detail';
}

function sourceToThree(x, y, z) {
  return [x * SCALE, z * SCALE, -y * SCALE];
}

function mdlBounds(modelName) {
  const modelPath = path.join(root, 'assets/local/cf_bio_candidates/zone13/pak', modelName);
  if (!fs.existsSync(modelPath)) return null;
  const model = fs.readFileSync(modelPath);
  if (model.length < 152 || model.toString('ascii', 0, 4) !== 'IDST') return null;
  const min = [104, 108, 112].map((offset) => model.readFloatLE(offset));
  const max = [116, 120, 124].map((offset) => model.readFloatLE(offset));
  if (![...min, ...max].every(Number.isFinite)) return null;
  return { min, max };
}

function fallbackPropSize(modelName) {
  const name = modelName.toLowerCase();
  if (/bus/.test(name)) return [2.5, 3.2, 8.2];
  if (/car/.test(name)) return [2.0, 1.6, 4.6];
  if (/light|lamp/.test(name)) return [.45, 3.2, .45];
  if (/logo|sign/.test(name)) return [2.2, 1.4, .25];
  if (/dianxiang|electric/.test(name)) return [1.1, 2.0, .65];
  return [1.0, 1.0, 1.0];
}

function parseStaticProps(buffer, gameLump) {
  if (!gameLump.length) return [];
  const lumpCount = buffer.readInt32LE(gameLump.offset);
  let entry = null;
  for (let i = 0; i < lumpCount; i += 1) {
    const at = gameLump.offset + 4 + i * 16;
    if (buffer.toString('ascii', at, at + 4) === 'prps') {
      entry = { version: buffer.readUInt16LE(at + 6), offset: buffer.readInt32LE(at + 8), length: buffer.readInt32LE(at + 12) };
      break;
    }
  }
  if (!entry) return [];
  let cursor = entry.offset;
  const dictionaryCount = buffer.readInt32LE(cursor); cursor += 4;
  const dictionary = [];
  for (let i = 0; i < dictionaryCount; i += 1) {
    dictionary.push(readCString(buffer, cursor, cursor + 128));
    cursor += 128;
  }
  const leafCount = buffer.readInt32LE(cursor); cursor += 4 + leafCount * 2;
  const propCount = buffer.readInt32LE(cursor); cursor += 4;
  const stride = Math.floor((entry.offset + entry.length - cursor) / propCount);
  if (stride < 56) throw new Error(`Unsupported static prop stride ${stride}, version ${entry.version}`);
  const props = [];
  for (let i = 0; i < propCount; i += 1) {
    const at = cursor + i * stride;
    const origin = [0, 4, 8].map((offset) => buffer.readFloatLE(at + offset));
    const angles = [12, 16, 20].map((offset) => buffer.readFloatLE(at + offset));
    const model = dictionary[buffer.readUInt16LE(at + 24)] || 'unknown.mdl';
    // Standard SDK 2013 v11 stores scale at +72. This Zone13 port leaves that
    // slot at zero and stores a stable per-model scale in the trailing +76
    // extension, so accept either layout without shrinking the props to toys.
    const standardScale = entry.version >= 11 && stride >= 76 ? buffer.readFloatLE(at + 72) : 1;
    const extendedScale = entry.version >= 11 && stride >= 80 ? buffer.readFloatLE(at + 76) : 1;
    const uniformScale = Number.isFinite(standardScale) && standardScale > 0 ? standardScale : extendedScale;
    const safeScale = Number.isFinite(uniformScale) && uniformScale > 0 ? uniformScale : 1;
    const bounds = mdlBounds(model);
    let size, localBounds = null;
    if (bounds) {
      const sourceSize = bounds.max.map((value, axis) => Math.abs(value - bounds.min[axis]) * safeScale * SCALE);
      size = [sourceSize[0], sourceSize[2], sourceSize[1]];
      const transformed = [sourceToThree(...bounds.min), sourceToThree(...bounds.max)];
      localBounds = {
        min: [0, 1, 2].map((axis) => Math.min(transformed[0][axis], transformed[1][axis])),
        max: [0, 1, 2].map((axis) => Math.max(transformed[0][axis], transformed[1][axis])),
      };
    } else size = fallbackPropSize(model).map((value) => value * Math.min(safeScale, 4));
    size = size.map((value) => Math.max(.08, Math.min(value, 30)));
    props.push({ model, position: sourceToThree(...origin), angles, scale: safeScale, size, localBounds });
  }
  return props;
}

function pushTriangle(target, a, b, c, uvs = [[0, 0], [0, 0], [0, 0]], atlasIndex = -1) {
  const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
  const acx = c[0] - a[0], acy = c[1] - a[1], acz = c[2] - a[2];
  let nx = aby * acz - abz * acy;
  let ny = abz * acx - abx * acz;
  let nz = abx * acy - aby * acx;
  const length = Math.hypot(nx, ny, nz) || 1;
  nx /= length; ny /= length; nz /= length;
  [a, b, c].forEach((p, index) => target.push(p[0], p[1], p[2], nx, ny, nz, uvs[index][0], uvs[index][1], atlasIndex));
}

if (!fs.existsSync(source)) {
  console.error(`Missing local BSP: ${source}`);
  process.exit(1);
}

const bsp = fs.readFileSync(source);
if (bsp.toString('ascii', 0, 4) !== 'VBSP') throw new Error('Not a Source BSP');

const lumps = Object.fromEntries(Object.entries(LUMP).map(([key, value]) => [key, lump(bsp, value)]));
const vertexCount = Math.floor(lumps.vertices.length / 12);
const vertices = new Array(vertexCount);
const sourceVertices = new Array(vertexCount);
for (let i = 0; i < vertexCount; i += 1) {
  const at = lumps.vertices.offset + i * 12;
  sourceVertices[i] = [bsp.readFloatLE(at), bsp.readFloatLE(at + 4), bsp.readFloatLE(at + 8)];
  vertices[i] = sourceToThree(...sourceVertices[i]);
}

const edgeCount = Math.floor(lumps.edges.length / 4);
const edges = new Array(edgeCount);
for (let i = 0; i < edgeCount; i += 1) {
  const at = lumps.edges.offset + i * 4;
  edges[i] = [bsp.readUInt16LE(at), bsp.readUInt16LE(at + 2)];
}

const surfEdgeCount = Math.floor(lumps.surfedges.length / 4);
const surfEdges = new Int32Array(surfEdgeCount);
for (let i = 0; i < surfEdgeCount; i += 1) surfEdges[i] = bsp.readInt32LE(lumps.surfedges.offset + i * 4);

const stringTableCount = Math.floor(lumps.texStringTable.length / 4);
const textureStrings = new Array(stringTableCount);
for (let i = 0; i < stringTableCount; i += 1) {
  const relative = bsp.readInt32LE(lumps.texStringTable.offset + i * 4);
  textureStrings[i] = readCString(bsp, lumps.texStringData.offset + relative, lumps.texStringData.offset + lumps.texStringData.length);
}

const texDataCount = Math.floor(lumps.texdata.length / 32);
const texDataRecords = new Array(texDataCount);
for (let i = 0; i < texDataCount; i += 1) {
  const at = lumps.texdata.offset + i * 32;
  const stringId = bsp.readInt32LE(at + 12);
  texDataRecords[i] = { name: textureStrings[stringId] || 'unknown', width: Math.max(1, bsp.readInt32LE(at + 16)), height: Math.max(1, bsp.readInt32LE(at + 20)) };
}

const texInfoCount = Math.floor(lumps.texinfo.length / 72);
const texInfos = new Array(texInfoCount);
for (let i = 0; i < texInfoCount; i += 1) {
  const at = lumps.texinfo.offset + i * 72;
  const texDataId = bsp.readInt32LE(at + 68);
  const data = texDataRecords[texDataId] || { name: 'unknown', width: 1, height: 1 };
  texInfos[i] = {
    flags: bsp.readInt32LE(at + 64), texture: data.name, width: data.width, height: data.height,
    u: [0, 4, 8, 12].map((offset) => bsp.readFloatLE(at + offset)),
    v: [16, 20, 24, 28].map((offset) => bsp.readFloatLE(at + offset)),
  };
}

const buckets = Object.fromEntries(categories.map(({ id }) => [id, []]));
const usedTextures = new Map();
const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
let skippedFaces = 0;
let triangleCount = 0;
const faceCount = Math.floor(lumps.faces.length / 56);

for (let i = 0; i < faceCount; i += 1) {
  const at = lumps.faces.offset + i * 56;
  const firstEdge = bsp.readInt32LE(at + 4);
  const numEdges = bsp.readUInt16LE(at + 8);
  const texInfoId = bsp.readInt16LE(at + 10);
  const info = texInfos[texInfoId];
  if (!info || numEdges < 3 || /^tools\//i.test(info.texture) ||
      (info.flags & 0x80) || (info.flags & 0x4) || (info.flags & 0x2)) {
    skippedFaces += 1;
    continue;
  }
  const polygon = [];
  const rawPolygon = [];
  for (let j = 0; j < numEdges; j += 1) {
    const signedEdge = surfEdges[firstEdge + j];
    const edge = edges[Math.abs(signedEdge)];
    if (!edge) continue;
    const vertexIndex = signedEdge >= 0 ? edge[0] : edge[1];
    const vertex = vertices[vertexIndex];
    if (vertex) { polygon.push(vertex); rawPolygon.push(sourceVertices[vertexIndex]); }
  }
  if (polygon.length < 3) {
    skippedFaces += 1;
    continue;
  }
  const atlasSlot = atlasSlots.get(info.texture.toLowerCase());
  const category = atlasSlot ? 'atlas' : categoryFor(info.texture);
  usedTextures.set(info.texture, (usedTextures.get(info.texture) || 0) + 1);
  for (const vertex of polygon) {
    for (let axis = 0; axis < 3; axis += 1) {
      bounds.min[axis] = Math.min(bounds.min[axis], vertex[axis]);
      bounds.max[axis] = Math.max(bounds.max[axis], vertex[axis]);
    }
  }
  for (let j = 1; j < polygon.length - 1; j += 1) {
    const indices = [0, j, j + 1];
    const uvs = atlasSlot ? indices.map((index) => {
      const point = rawPolygon[index];
      const sourceU = (point[0] * info.u[0] + point[1] * info.u[1] + point[2] * info.u[2] + info.u[3]) / info.width;
      const sourceV = (point[0] * info.v[0] + point[1] * info.v[1] + point[2] * info.v[2] + info.v[3]) / info.height;
      return [sourceU, sourceV];
    }) : [[0, 0], [0, 0], [0, 0]];
    const atlasIndex = atlasSlot ? atlasSlot.row * atlasColumns + atlasSlot.column : -1;
    pushTriangle(buckets[category], polygon[0], polygon[j], polygon[j + 1], uvs, atlasIndex);
    triangleCount += 1;
  }
}

const entityText = bsp.toString('utf8', lumps.entities.offset, lumps.entities.offset + lumps.entities.length).replace(/\0+$/, '');
const entities = parseEntities(entityText);
const staticProps = parseStaticProps(bsp, lumps.gameLump);
const markers = entities.flatMap((entity) => {
  if (!entity.origin) return [];
  const [x, y, z] = entity.origin.trim().split(/\s+/).map(Number);
  if (![x, y, z].every(Number.isFinite)) return [];
  const classname = entity.classname || 'unknown';
  const name = entity.targetname || '';
  let kind = null;
  if (classname.startsWith('info_player_')) kind = 'spawn';
  else if (/^box\d+$/i.test(name)) kind = 'weapon';
  else if (/button|trigger|breakable|rotating/.test(classname)) kind = 'interactive';
  else if (/prop_(static|dynamic)/.test(classname)) kind = 'prop';
  if (!kind) return [];
  return [{ kind, classname, name, position: sourceToThree(x, y, z) }];
});
const zoneScript = fs.readFileSync(path.join(root, 'assets/local/cf_bio_candidates/zone13/pak/scripts/vscripts/zone13zm.nut'), 'utf8');
for (const listName of ['locone', 'loctwo']) {
  const list = zoneScript.match(new RegExp(`${listName}\\s*<-\\s*\\[([\\s\\S]*?)\\];`))?.[1] || '';
  for (const match of list.matchAll(/Vector\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/g)) {
    const [, x, y, z] = match.map(Number);
    markers.push({ kind: 'supply', classname: 'script_candidate', name: listName, position: sourceToThree(x, y, z) });
  }
}

fs.mkdirSync(outputDir, { recursive: true });
const chunks = [];
const groups = [];
let byteOffset = 0;
for (const category of categories) {
  const data = new Float32Array(buckets[category.id]);
  const bytes = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  chunks.push(bytes);
  groups.push({ ...category, byteOffset, byteLength: bytes.length, vertexCount: data.length / 9, strideFloats: 9 });
  byteOffset += bytes.length;
}
fs.writeFileSync(meshPath, Buffer.concat(chunks));

const manifest = {
  format: 'zone13-graybox-v1',
  source: 'Steam Workshop 1590504756 / zm_zone13.bsp',
  sourceVersion: bsp.readInt32LE(4),
  scaleMetersPerSourceUnit: SCALE,
  bounds,
  stats: {
    sourceBytes: bsp.length,
    faces: faceCount,
    skippedFaces,
    triangles: triangleCount,
    vertices: triangleCount * 3,
    materials: groups.filter((group) => group.vertexCount > 0).length,
    textureNames: usedTextures.size,
    entities: entities.length,
    markers: markers.length,
    staticProps: staticProps.length,
  },
  groups,
  markers,
  staticProps,
  // Keep the full BSP material inventory. The atlas builder filters tool faces
  // and absent source textures, so authored surfaces never silently fall back
  // to category colours merely because they were outside an arbitrary top-N.
  topTextures: [...usedTextures.entries()].sort((a, b) => b[1] - a[1]).map(([name, faces]) => ({ name, faces })),
};
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ manifestPath, meshPath, ...manifest.stats, meshBytes: byteOffset }, null, 2));
