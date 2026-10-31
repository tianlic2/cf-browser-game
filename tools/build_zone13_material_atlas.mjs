#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { PNG } = require(path.join(root, 'lingyin-map/node_modules/pngjs'));
const grayboxDir = path.join(root, 'assets/local/cf_bio_candidates/zone13/graybox');
const pakMaterials = path.join(root, 'assets/local/cf_bio_candidates/zone13/pak/materials');
const manifest = JSON.parse(fs.readFileSync(path.join(grayboxDir, 'zone13-graybox.json'), 'utf8'));
const TILE = 256;
const COLUMNS = 8;
const candidates = manifest.topTextures.filter(({ name }) =>
  !/^tools\//i.test(name) && fs.existsSync(path.join(pakMaterials, `${name}.vtf`)));

function imageBytes(format, width, height) {
  if (format === 13) return Math.max(1, Math.ceil(width / 4)) * Math.max(1, Math.ceil(height / 4)) * 8;
  if (format === 14 || format === 15) return Math.max(1, Math.ceil(width / 4)) * Math.max(1, Math.ceil(height / 4)) * 16;
  if (format === 0 || format === 12) return width * height * 4;
  if (format === 3) return width * height * 3;
  throw new Error(`Unsupported VTF format ${format}`);
}

function rgb565(value) {
  return [Math.round(((value >> 11) & 31) * 255 / 31), Math.round(((value >> 5) & 63) * 255 / 63), Math.round((value & 31) * 255 / 31)];
}

function decodeVtf(file) {
  const b = fs.readFileSync(file);
  const width = b.readUInt16LE(16), height = b.readUInt16LE(18), frames = b.readUInt16LE(24);
  const format = b.readUInt32LE(52), mipCount = b.readUInt8(56);
  const lowFormat = b.readUInt32LE(57), lowWidth = b.readUInt8(61), lowHeight = b.readUInt8(62);
  let highOffset = b.readUInt32LE(12) + (lowWidth && lowHeight && lowFormat !== 0xffffffff ? imageBytes(lowFormat, lowWidth, lowHeight) : 0);
  let cursor = highOffset;
  for (let mip = mipCount - 1; mip > 0; mip -= 1) cursor += imageBytes(format, Math.max(1, width >> mip), Math.max(1, height >> mip)) * Math.max(1, frames);
  const rgba = Buffer.alloc(width * height * 4);
  if ([13, 14, 15].includes(format)) {
    const blockBytes = format === 13 ? 8 : 16;
    for (let by = 0; by < Math.ceil(height / 4); by += 1) for (let bx = 0; bx < Math.ceil(width / 4); bx += 1) {
      const at = cursor + (by * Math.ceil(width / 4) + bx) * blockBytes;
      let colorAt = at;
      const alpha = new Array(16).fill(255);
      if (format === 14) {
        for (let row = 0; row < 4; row += 1) {
          const bits = b.readUInt16LE(at + row * 2);
          for (let col = 0; col < 4; col += 1) alpha[row * 4 + col] = ((bits >> (col * 4)) & 15) * 17;
        }
        colorAt += 8;
      } else if (format === 15) {
        const a0 = b[at], a1 = b[at + 1], palette = [a0, a1];
        if (a0 > a1) for (let i = 1; i <= 6; i += 1) palette.push(Math.round(((7 - i) * a0 + i * a1) / 7));
        else { for (let i = 1; i <= 4; i += 1) palette.push(Math.round(((5 - i) * a0 + i * a1) / 5)); palette.push(0, 255); }
        let bits = 0n; for (let i = 0; i < 6; i += 1) bits |= BigInt(b[at + 2 + i]) << BigInt(i * 8);
        for (let i = 0; i < 16; i += 1) alpha[i] = palette[Number((bits >> BigInt(i * 3)) & 7n)];
        colorAt += 8;
      }
      const c0 = rgb565(b.readUInt16LE(colorAt)), c1 = rgb565(b.readUInt16LE(colorAt + 2));
      const colors = [c0, c1];
      if (b.readUInt16LE(colorAt) > b.readUInt16LE(colorAt + 2) || format !== 13) {
        colors.push(c0.map((v, i) => Math.round((2 * v + c1[i]) / 3)), c0.map((v, i) => Math.round((v + 2 * c1[i]) / 3)));
      } else colors.push(c0.map((v, i) => Math.round((v + c1[i]) / 2)), [0, 0, 0]);
      const colorBits = b.readUInt32LE(colorAt + 4);
      for (let py = 0; py < 4; py += 1) for (let px = 0; px < 4; px += 1) {
        const x = bx * 4 + px, y = by * 4 + py; if (x >= width || y >= height) continue;
        const index = py * 4 + px, color = colors[(colorBits >> (index * 2)) & 3], out = (y * width + x) * 4;
        rgba[out] = color[0]; rgba[out + 1] = color[1]; rgba[out + 2] = color[2]; rgba[out + 3] = alpha[index];
      }
    }
  } else {
    for (let i = 0; i < width * height; i += 1) {
      const src = cursor + i * (format === 3 ? 3 : 4), out = i * 4;
      if (format === 12) { rgba[out] = b[src + 2]; rgba[out + 1] = b[src + 1]; rgba[out + 2] = b[src]; rgba[out + 3] = b[src + 3]; }
      else { rgba[out] = b[src]; rgba[out + 1] = b[src + 1]; rgba[out + 2] = b[src + 2]; rgba[out + 3] = format === 3 ? 255 : b[src + 3]; }
    }
  }
  return { width, height, rgba };
}

const rows = Math.ceil(candidates.length / COLUMNS);
const atlas = new PNG({ width: COLUMNS * TILE, height: rows * TILE });
const slots = [];
for (let index = 0; index < candidates.length; index += 1) {
  const candidate = candidates[index];
  const file = path.join(pakMaterials, `${candidate.name}.vtf`);
  if (!fs.existsSync(file)) continue;
  const image = decodeVtf(file);
  const column = index % COLUMNS, row = Math.floor(index / COLUMNS);
  for (let y = 0; y < TILE; y += 1) for (let x = 0; x < TILE; x += 1) {
    const sx = Math.min(image.width - 1, Math.floor(x * image.width / TILE));
    const sy = Math.min(image.height - 1, Math.floor(y * image.height / TILE));
    const sourceAt = (sy * image.width + sx) * 4;
    const targetAt = ((row * TILE + y) * atlas.width + column * TILE + x) * 4;
    image.rgba.copy(atlas.data, targetAt, sourceAt, sourceAt + 4);
  }
  slots.push({ name: candidate.name, faces: candidate.faces, column, row, u0: column / COLUMNS, v0: row / rows, du: 1 / COLUMNS, dv: 1 / rows });
}
fs.writeFileSync(path.join(grayboxDir, 'zone13-material-atlas.png'), PNG.sync.write(atlas, { colorType: 6 }));
fs.writeFileSync(path.join(grayboxDir, 'zone13-material-atlas.json'), `${JSON.stringify({
  format: 'zone13-atlas-v2', width: atlas.width, height: atlas.height,
  columns: COLUMNS, rows, tile: TILE, slots,
}, null, 2)}\n`);
for (const name of ['weaponbox', 'supplybox']) {
  const source = path.join(pakMaterials, 'xmfls', `${name}.vtf`);
  const image = decodeVtf(source);
  const output = new PNG({ width: image.width, height: image.height });
  image.rgba.copy(output.data);
  fs.writeFileSync(path.join(grayboxDir, `${name}.png`), PNG.sync.write(output, { colorType: 6 }));
}
console.log(JSON.stringify({ textures: slots.length, width: atlas.width, height: atlas.height }, null, 2));
