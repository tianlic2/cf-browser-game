import * as THREE from 'three';
import { buildMaps, field, lowField, fbm, hash2, hexLin, sstep, vnoise } from './texturekit.js';

const S = 256;
const TAU = Math.PI * 2;

function material(maps, tileSize, options = {}) {
  const result = new THREE.MeshStandardMaterial({
    ...maps, color: 0xffffff, roughness: 1, metalness: 0, ...options,
  });
  // Box geometry gets world-scaled UVs; the three maps keep identical transforms.
  result.userData.tileSize = tileSize;
  for (const map of [result.map, result.normalMap, result.roughnessMap])
    map.anisotropy = 8;
  return result;
}

export function palaceMaterials() {
  // A 2 m repeat contains offset ashlar courses, recessed mortar and softly
  // varied limestone. The rows meet cleanly at all four texture boundaries.
  const limestoneNoise = lowField(S, (u, v) => fbm(u, v, 4, 3, 419), 4);
  const mortar = new Float32Array(S * S);
  const blockTone = new Float32Array(S * S);
  let index = 0;
  const limestoneHeight = field(S, (u, v) => {
    const row = Math.floor(v * 4);
    const col = Math.floor(u * 2 + (row & 1) * .5);
    const fu = (u * 2 + (row & 1) * .5) % 1;
    const fv = v * 4 - row;
    const edge = Math.min(fu, 1 - fu, fv, 1 - fv);
    const joint = sstep(.006, .035, edge);
    const n = limestoneNoise[index];
    mortar[index] = joint;
    blockTone[index] = hash2(col, row, 87);
    index++;
    return .27 * joint + .14 * n + .02 * (blockTone[index - 1] - .5);
  });
  const limestoneBase = hexLin(0xdcc8a9);
  const limestoneMaps = buildMaps(S, limestoneHeight, 2.2, .72, (i, out) => {
    const grain = limestoneNoise[i] - .5;
    const value = (.70 + .30 * mortar[i]) *
      (1 + grain * .40 + (blockTone[i] - .5) * .22);
    for (let c = 0; c < 3; c++) out[c] = limestoneBase[c] * value;
  }, (i) => .86 + (.07 * (1 - mortar[i])) - .09 * limestoneNoise[i]);

  // Long, irregular walnut fibres run along V. Both noise axes are periodic,
  // so the dais sides and end grain never acquire a hard texture seam.
  const woodHeight = field(S, (u, v) => {
    const bend = vnoise(u * 4, v * 3, 4, 811, 3) - .5;
    const fine = vnoise(u * 32, v * 4, 32, 812, 4) - .5;
    return .48 + .075 * Math.sin(TAU * (u * 7 + bend * .55)) + .17 * fine;
  });
  const woodBase = hexLin(0x74452d);
  const woodMaps = buildMaps(S, woodHeight, 1.75, .55, (i, out) => {
    const grain = woodHeight[i] - .48;
    const value = 1 + grain * 1.10;
    out[0] = woodBase[0] * value;
    out[1] = woodBase[1] * value * .94;
    out[2] = woodBase[2] * value * .90;
  }, (i) => .75 - (woodHeight[i] - .48) * .16);

  // Velvet has a short woven nap and a quiet, large-scale damask repeat.
  const velvetNoise = lowField(S, (u, v) => fbm(u, v, 4, 3, 1021), 4);
  let velvetIndex = 0;
  const velvetHeight = field(S, (u, v) => {
    const weave = Math.sin(TAU * u * 48) * Math.sin(TAU * v * 48);
    const damask = Math.cos(TAU * u * 4) * Math.cos(TAU * v * 4);
    return .46 + .045 * weave + .045 * damask + .07 * (velvetNoise[velvetIndex++] - .5);
  });
  const velvetBase = hexLin(0x9a2333);
  const velvetMaps = buildMaps(S, velvetHeight, 1.25, .48, (i, out) => {
    const motif = velvetHeight[i] - .46;
    const value = 1 + motif * 1.35 + (velvetNoise[i] - .5) * .22;
    out[0] = velvetBase[0] * value;
    out[1] = velvetBase[1] * value * .87;
    out[2] = velvetBase[2] * value * .94;
  }, (i) => .90 - (velvetHeight[i] - .46) * .25);

  // Cut marble for columns and lintels has quiet mineral veins, without the
  // floor tile's grout lines wrapping around a round column.
  const marbleNoise = lowField(S, (u, v) => fbm(u, v, 3, 3, 1207), 4);
  const vein = new Float32Array(S * S);
  let veinIndex = 0;
  const paleHeight = field(S, (u, v) => {
    const n = marbleNoise[veinIndex];
    const wave = Math.sin(TAU * (u * 3 + v * 2 + (n - .5) * .8));
    const line = Math.pow(Math.max(0, wave), 16);
    vein[veinIndex++] = line;
    return .42 + .13 * n - .035 * line;
  });
  const paleBase = hexLin(0xf0e5cf);
  const paleMaps = buildMaps(S, paleHeight, 1.35, .45, (i, out) => {
    const value = 1 + (marbleNoise[i] - .5) * .16 - vein[i] * .07;
    for (let c = 0; c < 3; c++) out[c] = paleBase[c] * value;
  }, (i) => .68 + .10 * vein[i] + .10 * marbleNoise[i]);

  const cream = material(limestoneMaps, 2);
  const stone = material(limestoneMaps, 2, { color: 0xc8b8a5 });
  const pale = material(paleMaps, 2.8, { metalness: .03 });
  const wood = material(woodMaps, 1.4);
  const dark = material(woodMaps, 2, { color: 0xc4b1a4 });
  const red = material(velvetMaps, 1.6);
  const burgundy = material(velvetMaps, 1.6, { color: 0xb8858d });
  return { cream, stone, pale, wood, dark, red, burgundy };
}
