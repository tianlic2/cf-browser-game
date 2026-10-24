// Lingyin Temple gate — close-up vegetation.
//
// Built as one self-contained module so the framing trees, canopy, bamboo, shrub
// understory and the forest behind the gate all share a single painted leaf atlas,
// one leaf shader (wind + backlit translucency) and one alpha-tested shadow depth
// material. Everything is deterministic through Rng seeds.
//
// Hero-camera notes (the shipped "front" shot is (-1.2, 2, 15.5) -> (0, 3.4, 0)
// at 34 deg vertical FOV; the module is also tuned to read at the nominal
// (0, 2, 14) / wider-FOV framing):
//   * The framing-tree trunks sit just outside the hero frame; their crowns are
//     pulled inward and two rows of arch limbs hang layered leaf cards into the
//     top corners, forming a canopy ceiling over the gate.
//   * No foliage is allowed low over the gate footprint or the approach path;
//     `minCanopyY` lifts the crown over the gate and lets it drop only near the
//     camera, where the top edge of the narrow lens actually is.
//   * Bamboo is clustered in its grove, with leaning outliers and a handful of
//     near-edge fringe culms so several culms and leaf sprays read at frame-left.
//
// Budget: ~92k triangles, 24 draw calls (plus 12 shadow-casting meshes).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ATMO } from '../core/atmosphere';
import { clamp, fbm2, lerp, noise2, Rng, smoothstep } from '../core/math';
import { canvasTexture, procMaterial } from '../core/materials';
import { box, merge, projectedTempleUV } from '../../world/geom';
import { plasterMaterial as gatePlasterMaterial, timberMaterial as gateTimberMaterial } from './materials';
import { graniteMaterial } from './textures';
import { photographedBarkMaterial } from '../../world/materials';
import { bakeSurfaceFinish } from '../../world/surface_finish';
import { runtimeTexture } from '../../world/runtime_textures';

const ATLAS_SIZE = 1024;
const CELLS = 4;
const CELL = ATLAS_SIZE / CELLS;
const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
// Canvas atlas
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

type CellName =
  | 'camphor'
  | 'broad'
  | 'chestnut'
  | 'pinnate'
  | 'young'
  | 'bamboo'
  | 'bambooSmall'
  | 'shrub'
  | 'fern'
  | 'grass'
  | 'dark'
  | 'fallen';

const CELL_AT: Record<CellName, readonly [number, number]> = {
  camphor: [0, 0],
  broad: [1, 0],
  chestnut: [2, 0],
  pinnate: [3, 0],
  young: [0, 1],
  bamboo: [1, 1],
  bambooSmall: [2, 1],
  shrub: [3, 1],
  fern: [0, 2],
  grass: [1, 2],
  dark: [2, 2],
  fallen: [3, 2],
};

function shade(c: RGB, k: number): RGB {
  return [clamp(c[0] * k, 0, 255), clamp(c[1] * k, 0, 255), clamp(c[2] * k, 0, 255)];
}

function css(c: RGB, a = 1): string {
  return `rgba(${Math.round(clamp(c[0], 0, 255))},${Math.round(clamp(c[1], 0, 255))},${Math.round(clamp(c[2], 0, 255))},${a})`;
}

/** Outline of a single leaf, base at (0,0), tip at (len,0), in local space. */
function leafPath(g: CanvasRenderingContext2D, len: number, wid: number, serrated: boolean) {
  g.beginPath();
  g.moveTo(0, 0);
  if (serrated) {
    const n = 8;
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1);
      const w = wid * Math.sin(Math.PI * Math.pow(t, 0.74));
      g.lineTo(len * t, -w * (i % 2 === 0 ? 1 : 0.72));
    }
    g.lineTo(len * 0.985, -wid * 0.1);
    g.lineTo(len, 0);
    for (let i = n; i >= 1; i--) {
      const t = i / (n + 1);
      const w = wid * Math.sin(Math.PI * Math.pow(t, 0.74));
      g.lineTo(len * t, w * (i % 2 === 0 ? 1 : 0.7));
    }
  } else {
    g.bezierCurveTo(len * 0.1, -wid * 0.78, len * 0.54, -wid * 1.02, len * 0.92, -wid * 0.3);
    g.quadraticCurveTo(len * 1.03, -wid * 0.05, len, 0);
    g.quadraticCurveTo(len * 1.0, wid * 0.2, len * 0.86, wid * 0.42);
    g.bezierCurveTo(len * 0.52, wid * 1.0, len * 0.1, wid * 0.72, 0, 0);
  }
  g.closePath();
}

interface LeafPaint {
  serrated?: boolean;
  glow?: number;
}

/** A single painted leaf with midrib, side veins and a sun rim on one edge. */
function drawLeaf(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  len: number,
  wid: number,
  angle: number,
  col: RGB,
  opts: LeafPaint = {},
) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);

  const fill = g.createLinearGradient(0, 0, len, 0);
  fill.addColorStop(0, css(shade(col, 0.66)));
  fill.addColorStop(0.42, css(col));
  fill.addColorStop(1, css(shade(col, opts.glow ?? 1.18)));
  g.fillStyle = fill;
  leafPath(g, len, wid, opts.serrated ?? false);
  g.fill();

  // Spring-soft rim light along the upper edge.
  g.strokeStyle = css(shade(col, 1.62), 0.3);
  g.lineWidth = 0.9;
  g.stroke();

  // Midrib.
  g.strokeStyle = css(shade(col, 1.55), 0.5);
  g.lineWidth = Math.max(0.55, wid * 0.045);
  g.beginPath();
  g.moveTo(len * 0.03, 0);
  g.quadraticCurveTo(len * 0.5, -wid * 0.07, len * 0.95, 0);
  g.stroke();

  // Side veins.
  g.strokeStyle = css(shade(col, 1.75), 0.28);
  g.lineWidth = 0.55;
  for (let i = 1; i <= 4; i++) {
    const t = 0.2 + i * 0.16;
    const px = len * t;
    const vw = wid * (1 - t * 0.52);
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(px, 0);
      g.quadraticCurveTo(px + len * 0.075, s * vw * 0.42, px + len * 0.15, s * vw * 0.64);
      g.stroke();
    }
  }
  g.restore();
}

interface SprayOpts {
  cx: number;
  cy: number;
  branches: number;
  reach: number;
  perBranch: number;
  len: [number, number];
  wid: [number, number];
  palette: RGB[];
  serrated?: boolean;
  sparse?: number;
  droop?: number;
  glow?: number;
}

/** A woody twig with alternating leaves — the basic building block of a cell. */
function paintSpray(g: CanvasRenderingContext2D, rng: Rng, o: SprayOpts) {
  for (let b = 0; b < o.branches; b++) {
    const spread = o.branches === 1 ? 0 : (b / (o.branches - 1) - 0.5) * 2;
    const ang = -Math.PI / 2 + spread * rng.range(0.55, 0.95) + rng.range(-0.22, 0.22);
    const len = o.reach * rng.range(0.62, 1.0);
    const ex = o.cx + Math.cos(ang) * len;
    const ey = o.cy + Math.sin(ang) * len;
    const mx = (o.cx + ex) * 0.5 + rng.range(-8, 8);
    const my = (o.cy + ey) * 0.5 + rng.range(-4, 9);

    g.strokeStyle = 'rgba(56,44,28,0.95)';
    g.lineWidth = rng.range(1.15, 2.2);
    g.beginPath();
    g.moveTo(o.cx, o.cy);
    g.quadraticCurveTo(mx, my, ex, ey);
    g.stroke();

    for (let i = 0; i < o.perBranch; i++) {
      if (rng.chance(o.sparse ?? 0.05)) continue;
      const t = 0.16 + (i / o.perBranch) * 0.9;
      const px = lerp(o.cx, ex, t) + (0.5 - t) * 5;
      const py = lerp(o.cy, ey, t) + Math.sin(t * Math.PI) * (o.droop ?? 0);
      const side = i % 2 === 0 ? -1 : 1;
      const la = ang + side * rng.range(0.5, 1.12) + rng.range(-0.18, 0.18);
      const l = rng.range(o.len[0], o.len[1]) * (1.02 - t * 0.16);
      const w = rng.range(o.wid[0], o.wid[1]);
      drawLeaf(g, px, py, l, w, la, o.palette[rng.int(0, o.palette.length - 1)], {
        serrated: o.serrated,
        glow: o.glow,
      });
    }

    // Terminal leaf continuing the twig direction.
    drawLeaf(
      g,
      ex,
      ey,
      rng.range(o.len[0], o.len[1]) * 0.82,
      rng.range(o.wid[0], o.wid[1]) * 0.9,
      ang + rng.range(-0.3, 0.3),
      o.palette[rng.int(0, o.palette.length - 1)],
      { serrated: o.serrated, glow: o.glow },
    );
  }
}

const GREENS: RGB[] = [
  [44, 68, 30],
  [52, 78, 35],
  [60, 88, 40],
  [70, 98, 45],
  [82, 108, 51],
];
const OLIVE: RGB[] = [
  [56, 74, 35],
  [67, 84, 40],
  [78, 94, 47],
  [89, 102, 53],
];
const LIGHT_GREENS: RGB[] = [
  [88, 112, 52],
  [102, 124, 58],
  [116, 134, 64],
  [130, 144, 72],
];
const BAMBOO_GREENS: RGB[] = [
  [58, 84, 36],
  [70, 96, 42],
  [84, 108, 48],
  [98, 118, 56],
];
const SHRUB_GREENS: RGB[] = [
  [42, 70, 33],
  [52, 80, 38],
  [64, 92, 43],
  [74, 100, 48],
];
const DARK_GREENS: RGB[] = [
  [18, 28, 15],
  [24, 36, 19],
  [30, 42, 23],
];
const FERN_GREENS: RGB[] = [
  [50, 80, 39],
  [62, 92, 44],
  [74, 102, 49],
];
const FALLEN_LEAVES: RGB[] = [
  [92, 66, 32],
  [118, 86, 40],
  [80, 58, 30],
  [132, 96, 46],
  [74, 70, 38],
  [104, 88, 44],
  [66, 82, 42],
];

function paintCamphor(g: CanvasRenderingContext2D, rng: Rng) {
  // Dark leaves behind the spray make the cluster read as depth, not a decal.
  for (let i = 0; i < 26; i++) {
    drawLeaf(
      g,
      CELL * 0.5 + rng.range(-42, 42),
      CELL * 0.58 + rng.range(-38, 38),
      rng.range(26, 44),
      rng.range(9, 15),
      rng.range(-Math.PI, Math.PI),
      [26, 42, 22],
    );
  }
  paintSpray(g, rng, {
    cx: CELL * 0.5,
    cy: CELL * 0.66,
    branches: 5,
    reach: 108,
    perBranch: 9,
    len: [38, 60],
    wid: [13, 19],
    palette: GREENS,
    droop: 6,
  });
  // A few sunlit young leaves on the outside of the cluster.
  for (let i = 0; i < 7; i++) {
    drawLeaf(
      g,
      CELL * 0.5 + rng.range(-70, 70),
      CELL * 0.46 + rng.range(-58, 26),
      rng.range(26, 38),
      rng.range(9, 13),
      rng.range(-Math.PI, Math.PI),
      LIGHT_GREENS[rng.int(0, LIGHT_GREENS.length - 1)],
      { glow: 1.25 },
    );
  }
}

function paintBroad(g: CanvasRenderingContext2D, rng: Rng) {
  for (let i = 0; i < 14; i++) {
    drawLeaf(
      g,
      CELL * 0.5 + rng.range(-40, 40),
      CELL * 0.6 + rng.range(-34, 34),
      rng.range(30, 48),
      rng.range(16, 24),
      rng.range(-Math.PI, Math.PI),
      [44, 54, 30],
    );
  }
  paintSpray(g, rng, {
    cx: CELL * 0.52,
    cy: CELL * 0.64,
    branches: 3,
    reach: 104,
    perBranch: 8,
    len: [42, 66],
    wid: [18, 27],
    palette: OLIVE,
    droop: 9,
  });
}

function paintChestnut(g: CanvasRenderingContext2D, rng: Rng) {
  for (let i = 0; i < 13; i++) {
    drawLeaf(
      g,
      CELL * 0.5 + rng.range(-44, 44),
      CELL * 0.6 + rng.range(-36, 36),
      rng.range(32, 52),
      rng.range(9, 13),
      rng.range(-Math.PI, Math.PI),
      [34, 44, 24],
      { serrated: true },
    );
  }
  paintSpray(g, rng, {
    cx: CELL * 0.5,
    cy: CELL * 0.68,
    branches: 4,
    reach: 110,
    perBranch: 9,
    len: [44, 70],
    wid: [10, 15],
    palette: OLIVE,
    serrated: true,
    droop: 4,
  });
}

function paintPinnate(g: CanvasRenderingContext2D, rng: Rng) {
  // Long, arching compound fronds with small opposite leaflets. This cell is
  // used on the crown silhouette where it breaks up the broadleaf mass.
  for (let f = 0; f < 3; f++) {
    const x0 = CELL * (0.32 + f * 0.18) + rng.range(-10, 10);
    const y0 = CELL - 8;
    const x1 = x0 + rng.range(-70, 70);
    const y1 = rng.range(44, 110);
    const cx = (x0 + x1) * 0.5 + rng.range(-24, 24);
    const cy = (y0 + y1) * 0.5 + 12;
    g.strokeStyle = 'rgba(62,50,32,0.9)';
    g.lineWidth = 1.7;
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo(cx, cy, x1, y1);
    g.stroke();

    const steps = 11;
    for (let i = 2; i <= steps; i++) {
      const t = i / (steps + 1);
      const it = 1 - t;
      const px = it * it * x0 + 2 * it * t * cx + t * t * x1;
      const py = it * it * y0 + 2 * it * t * cy + t * t * y1;
      const dx = 2 * it * (cx - x0) + 2 * t * (x1 - cx);
      const dy = 2 * it * (cy - y0) + 2 * t * (y1 - cy);
      const base = Math.atan2(dy, dx);
      for (const s of [-1, 1]) {
        drawLeaf(
          g,
          px,
          py,
          rng.range(18, 30) * (1.1 - t * 0.35),
          rng.range(5, 8),
          base + s * rng.range(0.95, 1.25),
          GREENS[rng.int(0, GREENS.length - 1)],
        );
      }
    }
    // Terminal leaflet.
    drawLeaf(g, x1, y1, rng.range(22, 32), rng.range(6, 9), Math.atan2(y1 - cy, x1 - cx), GREENS[4]);
  }
}

function paintYoung(g: CanvasRenderingContext2D, rng: Rng) {
  paintSpray(g, rng, {
    cx: CELL * 0.5,
    cy: CELL * 0.64,
    branches: 3,
    reach: 96,
    perBranch: 6,
    len: [32, 50],
    wid: [13, 19],
    palette: LIGHT_GREENS,
    sparse: 0.16,
    glow: 1.28,
  });
  // Pale, almost translucent leaves catch the sky behind them.
  for (let i = 0; i < 5; i++) {
    drawLeaf(
      g,
      CELL * 0.5 + rng.range(-54, 54),
      CELL * 0.52 + rng.range(-48, 18),
      rng.range(22, 34),
      rng.range(10, 14),
      rng.range(-Math.PI, Math.PI),
      [150, 158, 92],
      { glow: 1.1 },
    );
  }
}

function paintBamboo(g: CanvasRenderingContext2D, rng: Rng, small: boolean) {
  const sprays = small ? 5 : 4;
  for (let s = 0; s < sprays; s++) {
    const px = CELL * rng.range(0.25, 0.75);
    const py = CELL * rng.range(0.28, 0.72);
    g.strokeStyle = 'rgba(80,92,44,0.75)';
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(px, py);
    g.lineTo(px + rng.range(-16, 16), py + rng.range(-16, 16));
    g.stroke();
    const count = small ? 12 : 11;
    for (let i = 0; i < count; i++) {
      const a = rng.range(-Math.PI, Math.PI);
      drawLeaf(
        g,
        px + rng.range(-16, 16),
        py + rng.range(-16, 16),
        rng.range(small ? 34 : 46, small ? 58 : 82),
        rng.range(small ? 5 : 7, small ? 8 : 11),
        a,
        BAMBOO_GREENS[rng.int(0, BAMBOO_GREENS.length - 1)],
        { glow: 1.25 },
      );
    }
  }
}

function paintShrub(g: CanvasRenderingContext2D, rng: Rng) {
  for (let i = 0; i < 30; i++) {
    drawLeaf(
      g,
      CELL * 0.5 + rng.range(-58, 58),
      CELL * 0.55 + rng.range(-48, 48),
      rng.range(18, 32),
      rng.range(8, 12),
      rng.range(-Math.PI, Math.PI),
      [32, 52, 27],
    );
  }
  paintSpray(g, rng, {
    cx: CELL * 0.5,
    cy: CELL * 0.62,
    branches: 3,
    reach: 96,
    perBranch: 16,
    len: [20, 34],
    wid: [8, 12],
    palette: SHRUB_GREENS,
    sparse: 0.06,
    droop: 4,
  });
}

function paintFern(g: CanvasRenderingContext2D, rng: Rng) {
  for (let f = 0; f < 4; f++) {
    const x0 = CELL * rng.range(0.34, 0.66);
    const y0 = CELL - 6;
    const x1 = x0 + rng.range(-84, 84);
    const y1 = rng.range(26, 96);
    const cx = (x0 + x1) * 0.5 + rng.range(-16, 16);
    const cy = (y0 + y1) * 0.5 + rng.range(4, 20);
    g.strokeStyle = 'rgba(58,82,38,0.95)';
    g.lineWidth = 1.8;
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo(cx, cy, x1, y1);
    g.stroke();

    const steps = 13;
    for (let i = 3; i <= steps; i++) {
      const t = i / (steps + 1);
      const it = 1 - t;
      const px = it * it * x0 + 2 * it * t * cx + t * t * x1;
      const py = it * it * y0 + 2 * it * t * cy + t * t * y1;
      const dx = 2 * it * (cx - x0) + 2 * t * (x1 - cx);
      const dy = 2 * it * (cy - y0) + 2 * t * (y1 - cy);
      const base = Math.atan2(dy, dx);
      for (const s of [-1, 1]) {
        drawLeaf(
          g,
          px,
          py,
          rng.range(12, 22) * (1.15 - t * 0.5),
          rng.range(3.2, 5),
          base + s * rng.range(1.0, 1.3),
          FERN_GREENS[rng.int(0, FERN_GREENS.length - 1)],
        );
      }
    }
  }
}

function paintGrass(g: CanvasRenderingContext2D, rng: Rng) {
  // Blades are rooted along the bottom edge so the card can pivot there.
  for (let i = 0; i < 26; i++) {
    const x = CELL * 0.5 + rng.range(-88, 88);
    const a = -Math.PI / 2 + rng.range(-0.62, 0.62);
    const len = rng.range(120, 232);
    const bend = rng.range(-0.35, 0.35);
    const col = i % 7 === 0 ? [130, 138, 74] : i % 5 === 0 ? [92, 112, 58] : [70, 96, 52];
    g.strokeStyle = css(col as RGB, 0.96);
    g.lineWidth = rng.range(1.4, 3.2);
    g.beginPath();
    g.moveTo(x, CELL + 4);
    g.quadraticCurveTo(
      x + Math.cos(a) * len * 0.42,
      CELL + Math.sin(a) * len * 0.62,
      x + Math.cos(a) * len * 0.78 + bend * len,
      CELL + Math.sin(a) * len,
    );
    g.stroke();
  }
  // A few seed heads.
  for (let i = 0; i < 3; i++) {
    const x = CELL * 0.5 + rng.range(-52, 52);
    const top = rng.range(36, 78);
    g.strokeStyle = 'rgba(120,116,66,0.85)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(x, CELL);
    g.quadraticCurveTo(x + rng.range(-18, 18), CELL * 0.55, x + rng.range(-26, 26), top);
    g.stroke();
    for (let k = 0; k < 7; k++) {
      g.fillStyle = `rgba(${128 + rng.int(0, 30)},${118 + rng.int(0, 24)},${60 + rng.int(0, 20)},0.9)`;
      g.beginPath();
      g.ellipse(x + rng.range(-7, 7), top + k * 5, 2.2, 4.2, rng.range(-0.3, 0.3), 0, TAU);
      g.fill();
    }
  }
}

function paintDark(g: CanvasRenderingContext2D, rng: Rng) {
  // Interior foliage: dense and very dark, still with a ragged alpha silhouette.
  for (let i = 0; i < 56; i++) {
    drawLeaf(
      g,
      CELL * 0.5 + rng.range(-74, 74),
      CELL * 0.5 + rng.range(-70, 70),
      rng.range(15, 30),
      rng.range(7, 11),
      rng.range(-Math.PI, Math.PI),
      DARK_GREENS[rng.int(0, DARK_GREENS.length - 1)],
      { glow: 1.1 },
    );
  }
  paintSpray(g, rng, {
    cx: CELL * 0.5,
    cy: CELL * 0.56,
    branches: 3,
    reach: 86,
    perBranch: 14,
    len: [18, 30],
    wid: [8, 12],
    palette: DARK_GREENS,
    sparse: 0.08,
    glow: 1.15,
  });
}

function paintFallen(g: CanvasRenderingContext2D, rng: Rng) {
  // Sparse scatter of leaves and a couple of twigs; the quad is laid flat on the
  // paving, so the transparent cell shows the stone between leaves.
  for (let i = 0; i < 26; i++) {
    drawLeaf(
      g,
      rng.range(16, CELL - 16),
      rng.range(16, CELL - 16),
      rng.range(20, 38),
      rng.range(8, 14),
      rng.range(-Math.PI, Math.PI),
      FALLEN_LEAVES[rng.int(0, FALLEN_LEAVES.length - 1)],
      { serrated: rng.chance(0.4) },
    );
  }
  for (let i = 0; i < 3; i++) {
    const x = rng.range(40, CELL - 40);
    const y = rng.range(40, CELL - 40);
    g.strokeStyle = 'rgba(72,58,36,0.9)';
    g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + rng.range(-34, 34), y + rng.range(-34, 34));
    g.stroke();
  }
}

function paintAtlas(): THREE.Texture {
  const tex = canvasTexture(ATLAS_SIZE, ATLAS_SIZE, (g) => {
    const drawCell = (cell: CellName, paint: (ctx: CanvasRenderingContext2D, rng: Rng) => void) => {
      const [col, row] = CELL_AT[cell];
      g.save();
      g.translate(col * CELL, row * CELL);
      g.beginPath();
      g.rect(0, 0, CELL, CELL);
      g.clip();
      paint(g, new Rng(`lingyin-veg-atlas-${cell}`));
      g.restore();
    };

    drawCell('camphor', paintCamphor);
    drawCell('broad', paintBroad);
    drawCell('chestnut', paintChestnut);
    drawCell('pinnate', paintPinnate);
    drawCell('young', paintYoung);
    drawCell('bamboo', (c, r) => paintBamboo(c, r, false));
    drawCell('bambooSmall', (c, r) => paintBamboo(c, r, true));
    drawCell('shrub', paintShrub);
    drawCell('fern', paintFern);
    drawCell('grass', paintGrass);
    drawCell('dark', paintDark);
    drawCell('fallen', paintFallen);
  });
  tex.name = 'lingyin-veg-leaf-atlas';
  tex.anisotropy = 16;
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// Shared shader snippets
// ---------------------------------------------------------------------------

// Wind is evaluated in card-local space, so a card flutters around its own
// centre while the instance matrix gives it its place in the crown.
const CARD_WIND_GLSL = /* glsl */ `
#ifdef USE_INSTANCING
  float vgPhase = instanceMatrix[3][0] * 0.61 + instanceMatrix[3][2] * 0.83 + instanceMatrix[3][1] * 0.27;
  float vgSlow = sin(uTime * 0.52 + vgPhase);
  float vgFast = sin(uTime * 1.87 + vgPhase * 1.93 + transformed.y * 1.7);
  float vgGust = 0.55 + 0.45 * sin(uTime * 0.23 + vgPhase * 0.31);
  float vgSway = (vgSlow * 0.05 + vgFast * 0.012) * vgGust;
  float vgLift = 0.35 + max(transformed.y, 0.0) * 0.22;
  transformed.x += vgSway * vgLift;
  transformed.z += vgSway * 0.45 * vgLift;
#endif
`;

const CULM_WIND_GLSL = /* glsl */ `
#ifdef USE_INSTANCING
  float vgPhase = instanceMatrix[3][0] * 0.41 + instanceMatrix[3][2] * 0.73;
  float vgSway = sin(uTime * 0.63 + vgPhase) * 0.014 + sin(uTime * 1.71 + vgPhase * 1.37) * 0.004;
  float vgBend = transformed.y * transformed.y;
  transformed.x += vgSway * vgBend;
  transformed.z += vgSway * 0.45 * vgBend;
#endif
`;

/**
 * Height below which crown cards are not allowed. Behind the gate anything goes
 * (it reads as forest through the doorways); in front of it the crown is lifted
 * over the roof, then allowed to drop toward the camera where the frame top is
 * low enough for a canopy overhang.
 */
function minCanopyY(x: number, z: number): number {
  if (z < -2.4) return 3.8;
  if (Math.abs(x) < 8.5 && z < 6.0) return 10.4;
  if (Math.abs(x) < 10.0 && z < 10.0) return 9.0;
  return 7.2;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function addWhiteColor(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const count = geo.getAttribute('position').count;
  const colors = new Float32Array(count * 3).fill(1);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error('vegetation: geometry merge failed');
  return merged;
}

/** Plane whose UVs map to one atlas cell, with a small inset to avoid bleed. */
function cellQuad(cell: CellName, w: number, h: number): THREE.PlaneGeometry {
  const [col, row] = CELL_AT[cell];
  const geo = new THREE.PlaneGeometry(w, h, 1, 1);
  const uv = geo.getAttribute('uv');
  const inset = 2 / ATLAS_SIZE;
  const u0 = col / CELLS + inset;
  const u1 = (col + 1) / CELLS - inset;
  const v0 = 1 - (row + 1) / CELLS + inset;
  const v1 = 1 - row / CELLS - inset;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, lerp(u0, u1, uv.getX(i)), lerp(v0, v1, uv.getY(i)));
  }
  uv.needsUpdate = true;
  addWhiteColor(geo);
  return geo;
}

type CardShape = 'canopy' | 'spray' | 'tuft' | 'fern' | 'scatter';

const CARD_GEOMETRY_CACHE = new Map<string, THREE.BufferGeometry>();

/**
 * A card instance is itself a small cluster of 2-4 quads. Crossed planes give
 * real volume under random instance rotations, which is what keeps individual
 * rectangles from reading as billboards in the close-up.
 */
function cardGeometry(cell: CellName, shape: CardShape): THREE.BufferGeometry {
  const key = `${cell}:${shape}`;
  const cached = CARD_GEOMETRY_CACHE.get(key);
  if (cached) return cached;

  let geo: THREE.BufferGeometry;
  if (shape === 'canopy') {
    const a = cellQuad(cell, 1, 1);
    const b = cellQuad(cell, 0.94, 0.88);
    b.rotateY(1.05);
    b.rotateX(0.14);
    b.translate(0.04, -0.03, 0.03);
    const c = cellQuad(cell, 0.8, 0.72);
    c.rotateY(-0.62);
    c.rotateX(1.06);
    c.translate(-0.03, 0.15, 0);
    geo = mergeParts([a, b, c]);
  } else if (shape === 'spray') {
    const a = cellQuad(cell, 1, 0.82);
    const b = cellQuad(cell, 0.9, 0.72);
    b.rotateY(1.16);
    b.rotateX(-0.12);
    b.translate(0.02, 0.04, 0.02);
    geo = mergeParts([a, b]);
  } else if (shape === 'tuft') {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 3; i++) {
      const q = cellQuad(cell, 0.72, 1);
      q.translate(0, 0.5, 0);
      q.rotateY((i / 3) * Math.PI + 0.3);
      q.rotateX(0.05);
      parts.push(q);
    }
    geo = mergeParts(parts);
  } else if (shape === 'fern') {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) {
      const q = cellQuad(cell, 0.72, 1);
      q.translate(0, 0.5, 0);
      q.rotateY((i / 5) * TAU + 0.2);
      q.rotateX(0.18);
      parts.push(q);
    }
    geo = mergeParts(parts);
  } else {
    const q = cellQuad(cell, 1, 1);
    q.rotateX(-Math.PI / 2);
    geo = q;
  }

  geo.computeBoundingSphere();
  CARD_GEOMETRY_CACHE.set(key, geo);
  return geo;
}

interface Ring {
  center: THREE.Vector3;
  radius: number;
}

/** Tapered, slightly gnarly tube through a polyline of rings. */
function buildTube(rings: Ring[], radial: number, gnarl = 0.08): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const n = rings.length;
  const tangent = new THREE.Vector3();
  const prev = new THREE.Vector3();
  const next = new THREE.Vector3();
  const ref = new THREE.Vector3();
  const nx = new THREE.Vector3();
  const bz = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const xAxis = new THREE.Vector3(1, 0, 0);

  for (let i = 0; i < n; i++) {
    prev.copy(rings[Math.max(0, i - 1)].center);
    next.copy(rings[Math.min(n - 1, i + 1)].center);
    tangent.subVectors(next, prev).normalize();
    ref.copy(Math.abs(tangent.y) > 0.9 ? xAxis : up);
    nx.crossVectors(ref, tangent).normalize();
    bz.crossVectors(tangent, nx).normalize();

    for (let j = 0; j < radial; j++) {
      const ang = (j / radial) * TAU;
      const wobble = 1 + gnarl * noise2(ang * 1.9 + i * 0.37, i * 1.7 + j * 0.11);
      const r = Math.max(0.012, rings[i].radius * wobble);
      const cx = Math.cos(ang) * r;
      const sz = Math.sin(ang) * r;
      pos.push(
        rings[i].center.x + nx.x * cx + bz.x * sz,
        rings[i].center.y + nx.y * cx + bz.y * sz,
        rings[i].center.z + nx.z * cx + bz.z * sz,
      );
      uv.push(j / radial, i / (n - 1));
    }
  }

  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j;
      const b = i * radial + ((j + 1) % radial);
      const c = (i + 1) * radial + j;
      const d = (i + 1) * radial + ((j + 1) % radial);
      idx.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function curvePoints(ctrl: THREE.Vector3[], count: number): THREE.Vector3[] {
  return new THREE.CatmullRomCurve3(ctrl, false, 'catmullrom', 0.5).getPoints(count);
}

function makeBlobGeometry(detail: number): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, detail);
  const p = geo.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const d = 1 + 0.17 * fbm2(x * 1.4 + z * 0.6 + 4.7, y * 1.6 - z * 0.9);
    p.setXYZ(i, x * d, y * d * 0.9, z * d);
  }
  geo.computeVertexNormals();
  addWhiteColor(geo);
  return geo;
}

function makeShrubCoreGeometry(): THREE.BufferGeometry {
  const rng = new Rng('lingyin-veg-shrub-core');
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.IcosahedronGeometry(i === 0 ? 1 : 0.62, i === 0 ? 1 : 0);
    const p = geo.getAttribute('position');
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k);
      const y = p.getY(k);
      const z = p.getZ(k);
      const d = 1 + 0.15 * fbm2(x * 2.1 + i * 3.3, z * 2.4 - y * 0.7);
      p.setXYZ(k, x * d, y * d, z * d);
    }
    geo.computeVertexNormals();
    geo.scale(1.2, 0.72, 1.1);
    geo.translate(rng.range(-0.5, 0.5), 0.52 + rng.range(-0.08, 0.22), rng.range(-0.5, 0.5));
    addWhiteColor(geo);
    parts.push(geo);
  }
  return mergeParts(parts);
}

function buildBackgroundTrunk(): THREE.BufferGeometry {
  const lower = new THREE.CylinderGeometry(0.03, 0.058, 0.56, 5, 1, true);
  lower.translate(0, 0.28, 0);
  const upper = new THREE.CylinderGeometry(0.017, 0.032, 0.47, 5, 1, true);
  upper.translate(0, 0.765, 0);
  const branch = new THREE.CylinderGeometry(0.012, 0.024, 0.32, 4, 1, true);
  branch.rotateZ(0.72);
  branch.translate(0.1, 0.74, 0.02);
  return mergeParts([lower, upper, branch]);
}

const BAMBOO_NODES = [0.14, 0.29, 0.44, 0.59, 0.74, 0.89];

/** Unit-height culm; instances scale it to 6-10 m. Node rings are modelled and
 *  also darkened through a per-vertex colour so they read from any angle. */
function buildBambooCulm(detailed: boolean): THREE.BufferGeometry {
  const radial = detailed ? 6 : 5;
  const heights = new Set<number>([0, 1]);
  for (const n of BAMBOO_NODES) {
    if (detailed) {
      heights.add(n - 0.075);
      heights.add(n - 0.014);
      heights.add(n - 0.004);
      heights.add(n + 0.004);
      heights.add(n + 0.014);
      heights.add(n + 0.033);
      heights.add(n + 0.075);
    } else {
      heights.add(n - 0.06);
      heights.add(n + 0.01);
      heights.add(n + 0.06);
    }
  }
  const hs = [...heights].filter((h) => h >= 0 && h <= 1).sort((a, b) => a - b);
  const rings: Ring[] = hs.map((h) => {
    let radius = 0.052 * (1 - 0.43 * h);
    for (const n of BAMBOO_NODES) {
      const d = Math.abs(h - n);
      if (d < 0.012) radius += 0.017;
      else if (d < 0.04) radius += 0.008 * (1 - (d - 0.012) / 0.028);
    }
    const bend = 0.11 * h * h + 0.028 * Math.sin(h * 5.2);
    return {
      center: new THREE.Vector3(bend, h, 0.02 * Math.sin(h * 3.4)),
      radius,
    };
  });
  const geo = buildTube(rings, radial, detailed ? 0.035 : 0.02);

  // Node bands: dark line at the joint, pale bloom just above it.
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    let v = 0.9 + 0.1 * Math.sin(y * 41.0);
    for (const n of BAMBOO_NODES) {
      const d = y - n;
      if (Math.abs(d) < 0.011) v *= 0.55;
      else if (Math.abs(d) < 0.035) v *= 0.86;
      if (d > 0.012 && d < 0.034) v = Math.min(1.16, v * 1.2);
    }
    v *= lerp(0.86, 1.06, y);
    colors[i * 3] = v;
    colors[i * 3 + 1] = v * 1.02;
    colors[i * 3 + 2] = v * 0.9;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

// ---------------------------------------------------------------------------
// Framing tree generation
// ---------------------------------------------------------------------------

interface TreeSpec {
  seed: string;
  side: 'left' | 'right' | 'back';
  base: readonly [number, number];
  height: number;
  radius: number;
  crown: readonly [number, number, number];
  crownRadius: number;
  reach: readonly [number, number, number];
  frame: readonly [number, number, number];
  branches: number;
  lean: readonly [number, number];
}

interface CardAnchor {
  p: THREE.Vector3;
  dir: THREE.Vector3;
  weight: number;
}

interface Lobe {
  center: THREE.Vector3;
  radii: THREE.Vector3;
}

interface GrownTree {
  trunk: THREE.BufferGeometry;
  anchors: CardAnchor[];
  lobes: Lobe[];
}

function growFramingTree(spec: TreeSpec, rng: Rng): GrownTree {
  const base = new THREE.Vector3(spec.base[0], 0, spec.base[1]);

  // Slightly wandering spine, still inside the 10-14 m height envelope.
  const ctrl: THREE.Vector3[] = [];
  for (let i = 0; i <= 5; i++) {
    const t = i / 5;
    const wobX = noise2(t * 2.4 + 3.1, 8.7) * 0.62 * Math.sin(t * Math.PI);
    const wobZ = fbm2(t * 2.8 - 4.4, 2.3) * 0.62 * Math.sin(t * Math.PI);
    ctrl.push(
      new THREE.Vector3(
        base.x + spec.lean[0] * t * t + wobX,
        spec.height * t,
        base.z + spec.lean[1] * t * t + wobZ,
      ),
    );
  }
  const spine = curvePoints(ctrl, 16);
  const rings: Ring[] = spine.map((p, i) => {
    const t = i / (spine.length - 1);
    const r =
      spec.radius *
      (1.06 - 0.88 * Math.pow(t, 0.72)) *
      (1 + 0.08 * noise2(t * 6.3 + 1.7, spec.height * 0.31));
    return { center: p.clone(), radius: Math.max(0.055, r) };
  });
  const trunkParts: THREE.BufferGeometry[] = [buildTube(rings, 10, 0.09)];

  // Buttress roots fanning out of the base.
  for (let i = 0; i < 5; i++) {
    const az = (i / 5) * TAU + rng.range(-0.3, 0.3);
    const dir = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
    const start = base
      .clone()
      .add(new THREE.Vector3(dir.x * spec.radius * 0.35, spec.radius * 1.2, dir.z * spec.radius * 0.35));
    const mid = base
      .clone()
      .addScaledVector(dir, spec.radius * 1.5 + rng.range(0, 0.25));
    mid.y = spec.radius * 0.36;
    const end = base.clone().addScaledVector(dir, spec.radius * 2.8 + rng.range(0.1, 0.55));
    end.y = 0.02;
    const pts = curvePoints([start, mid, end], 4);
    const rootRings = pts.map((p, k) => ({
      center: p,
      radius: Math.max(0.035, lerp(spec.radius * 0.3, 0.045, k / (pts.length - 1))),
    }));
    trunkParts.push(buildTube(rootRings, 6, 0.14));
  }

  const anchors: CardAnchor[] = [];
  const crown = new THREE.Vector3(...spec.crown);

  // Main limbs: a mix of outward-spreading and crown-seeking directions.
  for (let b = 0; b < spec.branches; b++) {
    const t = lerp(0.4, 0.88, (b + rng.range(0.15, 0.85)) / spec.branches);
    const idx = Math.round(t * (spine.length - 1));
    const attach = spine[clamp(idx, 1, spine.length - 2)].clone();
    const az = (b / spec.branches) * TAU + rng.range(-0.55, 0.55);
    const outward = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
    const towardCrown = new THREE.Vector3(crown.x, attach.y + rng.range(0.8, 1.9), crown.z)
      .sub(attach)
      .normalize();
    const dir = outward.clone().multiplyScalar(0.55).addScaledVector(towardCrown, 0.8).normalize();
    const len = rng.range(2.8, 5.1) * (1.15 - t * 0.32);
    const start = attach.clone().addScaledVector(outward, spec.radius * 0.3);
    const mid = start
      .clone()
      .addScaledVector(dir, len * 0.46)
      .add(new THREE.Vector3(rng.range(-0.4, 0.4), rng.range(0.35, 1.1), rng.range(-0.4, 0.4)));
    const tip = start
      .clone()
      .addScaledVector(dir, len)
      .add(new THREE.Vector3(rng.range(-0.45, 0.45), rng.range(0.8, 2.0), rng.range(-0.45, 0.45)));
    const pts = curvePoints([start, mid, tip], 7);
    const r0 = 0.07 + spec.radius * 0.22 * (1 - t * 0.4);
    const limbRings = pts.map((p, k) => ({
      center: p,
      radius: Math.max(0.028, lerp(r0, 0.032, Math.pow(k / (pts.length - 1), 0.82))),
    }));
    trunkParts.push(buildTube(limbRings, 7, 0.1));
    anchors.push({ p: tip.clone(), dir: dir.clone(), weight: 1.1 });
    anchors.push({ p: pts[5].clone(), dir: dir.clone(), weight: 0.9 });

    // One fork per limb keeps the silhouette twiggy.
    const forkStart = pts[4].clone();
    const forkDir = dir
      .clone()
      .add(new THREE.Vector3(rng.range(-0.7, 0.7), rng.range(0.35, 0.9), rng.range(-0.7, 0.7)))
      .normalize();
    const forkTip = forkStart.clone().addScaledVector(forkDir, rng.range(1.3, 2.3));
    const forkPts = curvePoints(
      [forkStart, forkStart.clone().lerp(forkTip, 0.55).add(new THREE.Vector3(0, 0.3, 0)), forkTip],
      4,
    );
    const forkRings = forkPts.map((p, k) => ({
      center: p,
      radius: Math.max(0.02, lerp(r0 * 0.42, 0.022, k / (forkPts.length - 1))),
    }));
    trunkParts.push(buildTube(forkRings, 5, 0.12));
    anchors.push({ p: forkTip, dir: forkDir, weight: 0.78 });
  }

  // Two hero limbs are explicitly routed: one high over the gate, one low and
  // close to camera so cards land in the top corners of the hero frame.
  const addHeroLimb = (target: THREE.Vector3, t0: number, thickness: number) => {
    const attach = new THREE.CatmullRomCurve3(ctrl, false, 'catmullrom', 0.5).getPointAt(t0);
    const mid = attach
      .clone()
      .lerp(target, 0.5)
      .add(new THREE.Vector3(0, 0.8 + rng.range(0, 0.9), 0));
    const pts = curvePoints(
      [attach, mid, attach.clone().lerp(target, 0.78).add(new THREE.Vector3(0, 0.25, 0)), target],
      9,
    );
    const limbRings = pts.map((p, k) => ({
      center: p,
      radius: Math.max(0.026, lerp(thickness, 0.028, k / (pts.length - 1))),
    }));
    trunkParts.push(buildTube(limbRings, 7, 0.08));
    for (const k of [3, 6, 8]) {
      anchors.push({
        p: pts[k].clone(),
        dir: pts[Math.min(k + 1, pts.length - 1)].clone().sub(pts[k]).normalize(),
        weight: k === 8 ? 1.3 : 1.0,
      });
    }
  };
  addHeroLimb(new THREE.Vector3(...spec.reach), 0.62, 0.22);
  addHeroLimb(new THREE.Vector3(...spec.frame), 0.5, 0.17);

  // Three overlapping lobes stop the crown from reading as one sphere.
  const towardCenter = new THREE.Vector3(-base.x, 0, -base.z).normalize();
  const side = new THREE.Vector3(-towardCenter.z, 0, towardCenter.x);
  const lobes: Lobe[] = [
    {
      center: crown.clone(),
      radii: new THREE.Vector3(spec.crownRadius, spec.crownRadius * 0.56, spec.crownRadius),
    },
    {
      center: crown
        .clone()
        .addScaledVector(towardCenter, spec.crownRadius * 0.34)
        .add(new THREE.Vector3(0, spec.crownRadius * 0.1, 0)),
      radii: new THREE.Vector3(spec.crownRadius * 0.82, spec.crownRadius * 0.46, spec.crownRadius * 0.82),
    },
    {
      center: crown
        .clone()
        .addScaledVector(side, spec.crownRadius * 0.52)
        .add(new THREE.Vector3(rng.range(-0.5, 0.5), rng.range(-0.6, 0.4), rng.range(-0.5, 0.5))),
      radii: new THREE.Vector3(spec.crownRadius * 0.72, spec.crownRadius * 0.42, spec.crownRadius * 0.72),
    },
  ];

  return { trunk: mergeParts(trunkParts), anchors, lobes };
}

// ---------------------------------------------------------------------------
// Card placement helpers
// ---------------------------------------------------------------------------

function randomCardQuat(rng: Rng, outward?: THREE.Vector3): THREE.Quaternion {
  const e = new THREE.Euler();
  if (outward) {
    const yaw = Math.atan2(outward.x, outward.z) + rng.range(-0.85, 0.85);
    e.set(rng.range(-0.8, 0.8), yaw, rng.range(-0.75, 0.75), 'YXZ');
  } else {
    e.set(rng.range(-1.25, 1.25), rng.range(0, TAU), rng.range(-1.15, 1.15), 'YXZ');
  }
  return new THREE.Quaternion().setFromEuler(e);
}

/** Linear-space instance tint; dark shade vs sunlit yellow-green. */
function leafTint(exposure: number, rng: Rng, dark: boolean): THREE.Color {
  const deep: RGB = [0.10, 0.20, 0.08];
  const sun: RGB = [0.38, 0.56, 0.2];
  const k = clamp(exposure, 0, 1);
  const warm = rng.chance(0.16) ? 1.1 : 1;
  const r = lerp(deep[0], sun[0], k) * warm + rng.range(-0.045, 0.045);
  const g = lerp(deep[1], sun[1], k) + rng.range(-0.04, 0.04);
  const b = lerp(deep[2], sun[2], k) * (warm > 1 ? 0.94 : 1) + rng.range(-0.035, 0.035);
  const m = dark ? 0.6 : 1;
  return new THREE.Color().setRGB(clamp(r * m, 0, 2), clamp(g * m, 0, 2), clamp(b * m, 0, 2));
}

type Layer = 'canopy' | 'bamboo' | 'shrub' | 'under' | 'bg' | 'ground';

interface CardBucket {
  cell: CellName;
  shape: CardShape;
  layer: Layer;
  matrices: THREE.Matrix4[];
  colors: THREE.Color[];
}

interface BlobSlot {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  scale: THREE.Vector3;
  color: THREE.Color;
}

// ---------------------------------------------------------------------------
// Vegetation
// ---------------------------------------------------------------------------

export class Vegetation {
  readonly group = new THREE.Group();

  private readonly atlas: THREE.Texture;
  private readonly leafMat: THREE.MeshStandardMaterial;
  private readonly barkMat: THREE.MeshStandardMaterial;
  private readonly massMat: THREE.MeshStandardMaterial;
  private readonly bambooMat: THREE.MeshStandardMaterial;
  private readonly coreMat: THREE.MeshStandardMaterial;
  private readonly depthMat: THREE.MeshDepthMaterial;
  private readonly buckets = new Map<string, CardBucket>();

  constructor(options: { gamePerimeter?: boolean } = {}) {
    this.group.name = 'vegetation';
    this.atlas = runtimeTexture('gate-atlas') ?? paintAtlas();

    this.leafMat = procMaterial({
      name: 'lingyin-leaf-card',
      params: {
        color: 0xffffff,
        map: this.atlas,
        alphaTest: 0.32,
        alphaToCoverage:true,
        side: THREE.DoubleSide,
        roughness: 0.84,
        metalness: 0,
        vertexColors: true,
      },
      uniforms: { uTime: ATMO.time, uSunDir: ATMO.sunDir },
      vertexHead: 'uniform float uTime;',
      head: 'uniform vec3 uSunDir;',
      vertexPre: CARD_WIND_GLSL,
      color: /* glsl */ `
        float vgHigh = smoothstep(1.5, 11.0, cgP.y);
        diffuseColor.rgb *= mix(0.70, 1.05, vgHigh);
        diffuseColor.rgb *= 0.93 + 0.14 * cgNoise2(cgP.xz * 0.35 + cgP.y * 0.17);
        diffuseColor.rgb *= mix(vec3(1.0), vec3(1.06, 1.035, 0.86), smoothstep(7.0, 12.0, cgP.y) * 0.7);
      `,
      roughness: /* glsl */ `
        roughnessFactor = clamp(roughnessFactor * (0.86 + 0.24 * cgNoise2(cgP.xz * 2.0)), 0.5, 1.0);
      `,
      // Backlit translucency: looking toward the sun through the canopy glows.
      emissive: /* glsl */ `
        vec3 vgView = normalize(cameraPosition - cgP);
        float vgBack = pow(max(dot(-vgView, uSunDir), 0.0), 2.6);
        float vgThin = 0.55 + 0.45 * cgNoise2(cgO.xy * 5.0 + 17.0);
        float vgAO = 0.35 + 0.65 * smoothstep(0.0, 9.0, cgP.y);
        totalEmissiveRadiance += vec3(0.30, 0.38, 0.12) * vgBack * vgThin * vgAO * 0.9;
      `,
    });

    this.barkMat = photographedBarkMaterial() ?? procMaterial({
      name: 'lingyin-bark',
      params: { color: 0xffffff, roughness: 0.94, metalness: 0 },
      color: /* glsl */ `
        float barkRidge = cgRidge2(vec2((cgP.x + cgP.z) * 6.0, cgP.y * 0.55));
        float barkFine = cgFbm2(vec2((cgP.x - cgP.z) * 24.0, cgP.y * 5.5));
        float barkLichen = smoothstep(0.55, 0.92, cgNoise2(vec2(cgP.y * 2.2, (cgP.x + cgP.z) * 7.0)) * 0.5 + 0.5);
        float barkMoss = smoothstep(0.35, 0.85, cgFbm2(vec2(cgP.x * 1.3 + 5.0, cgP.z * 1.5)) * 0.5 + 0.5);
        barkMoss *= 1.0 - smoothstep(0.4, 3.4, cgP.y + barkFine * 0.4);
        vec3 bark = mix(vec3(0.105, 0.08, 0.058), vec3(0.30, 0.245, 0.175), smoothstep(0.25, 0.95, barkRidge));
        bark *= 0.72 + 0.4 * barkFine;
        bark = mix(bark, vec3(0.33, 0.34, 0.27), barkLichen * 0.22);
        bark = mix(bark, vec3(0.14, 0.21, 0.08), barkMoss * 0.72);
        diffuseColor.rgb *= bark;
      `,
      normal: /* glsl */ `
        float e = 0.22;
        float h0 = cgRidge2(vec2((cgP.x + cgP.z) * 6.0, cgP.y * 0.55));
        float hx = cgRidge2(vec2((cgP.x + cgP.z + e) * 6.0, cgP.y * 0.55));
        float hy = cgRidge2(vec2((cgP.x + cgP.z) * 6.0, (cgP.y + e) * 0.55));
        float hz = cgRidge2(vec2((cgP.x - cgP.z + e) * 6.0, cgP.y * 0.55));
        cgBump = vec3(hx - h0, hy - h0, hz - h0) * 2.4;
      `,
      roughness: /* glsl */ `
        roughnessFactor = clamp(0.82 + 0.18 * cgNoise2(cgP.xz * 9.0 + cgP.y), 0.55, 1.0);
      `,
    });

    this.massMat = procMaterial({
      name: 'lingyin-canopy-mass',
      params: { color: 0xffffff, roughness: 1, metalness: 0, flatShading: true, vertexColors: true },
      color: /* glsl */ `
        float vgN = cgFbm3(cgP * 0.65);
        vec3 vgMass = mix(vec3(0.065, 0.10, 0.05), vec3(0.16, 0.22, 0.105), smoothstep(0.15, 0.85, vgN));
        vgMass *= 0.68 + 0.52 * smoothstep(0.0, 9.0, cgP.y);
        diffuseColor.rgb *= vgMass;
      `,
    });

    this.bambooMat = procMaterial({
      name: 'lingyin-bamboo-culm',
      params: { color: 0xffffff, roughness: 0.62, metalness: 0, vertexColors: true },
      uniforms: { uTime: ATMO.time },
      vertexHead: 'uniform float uTime;',
      vertexPre: CULM_WIND_GLSL,
      color: /* glsl */ `
        float bStripe = cgNoise2(vec2((cgP.x + cgP.z) * 18.0, cgP.y * 3.4));
        float bGrime = cgFbm2(vec2(cgP.x * 2.6 + cgP.z * 1.8, cgP.y * 0.9));
        vec3 bCol = mix(vec3(0.045, 0.075, 0.028), vec3(0.13, 0.17, 0.052), smoothstep(0.25, 0.9, bStripe * 0.5 + 0.5));
        bCol *= 0.78 + 0.36 * bGrime;
        float bPowder = smoothstep(0.7, 0.95, cgNoise2(vec2(cgP.y * 1.3, (cgP.x + cgP.z) * 2.0)) * 0.5 + 0.5);
        bCol = mix(bCol, vec3(0.34, 0.36, 0.27), bPowder * 0.22);
        diffuseColor.rgb *= bCol;
      `,
      roughness: /* glsl */ `
        roughnessFactor = clamp(0.5 + 0.22 * cgNoise2(cgP.xz * 8.0 + cgP.y), 0.35, 0.95);
      `,
    });

    this.coreMat = procMaterial({
      name: 'lingyin-shrub-core',
      params: { color: 0xffffff, roughness: 1, metalness: 0, flatShading: true, vertexColors: true },
      color: /* glsl */ `
        float sN = cgFbm3(cgP * 1.5);
        vec3 sC = mix(vec3(0.03, 0.05, 0.026), vec3(0.09, 0.13, 0.058), smoothstep(0.1, 0.9, sN));
        diffuseColor.rgb *= sC;
      `,
    });

    this.depthMat = this.makeCardDepthMaterial();
    if (options.gamePerimeter) {
      // The FPS uses ACES at 1.18 exposure; the standalone gate's custom
      // grading is darker. Compensate only the imported foliage palette.
      this.leafMat.color.setRGB(.60, .75, .52);
      this.bambooMat.color.setRGB(.64, .72, .57);
      // The FPS already has its own distant forest. Import the updated gate's
      // nearby tree, bamboo, shrub and ground layers without duplicating it.
      this.addFramingTrees();
      this.addBamboo();
      this.addShrubs();
      this.addUnderstory();
      this.addGroundDetails(true);
      this.addCanopyCeiling();
      this.addBoundaryWall();
      this.flushCards();
    } else this.populate();
  }

  /** Leaf cards cast real, dappled shadows through the same atlas alpha. */
  private makeCardDepthMaterial(): THREE.MeshDepthMaterial {
    const mat = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      map: this.atlas,
      alphaTest: 0.32,
      side: THREE.DoubleSide,
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = ATMO.time;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${CARD_WIND_GLSL}`);
    };
    mat.customProgramCacheKey = () => 'lingyin-veg-card-depth';
    return mat;
  }

  // -- public API ------------------------------------------------------------

  update(time: number): void {
    // ATMO.time is the single shared clock; every material above references it.
    ATMO.time.value = time;
  }

  // -- placement helpers -----------------------------------------------------

  private isPlatform(x: number, z: number, pad: number): boolean {
    return Math.abs(x) < 8 + pad && z > -3.8 - pad && z < 4.0 + pad;
  }

  private isPath(x: number, z: number, pad: number): boolean {
    return Math.abs(x) < 3.2 + pad && z > 3.8 - pad;
  }

  private nearFramingTrunk(x: number, z: number, pad: number): boolean {
    return (
      Math.hypot(x + 8.5, z - 8.7) < pad ||
      Math.hypot(x - 9.5, z - 8.7) < pad ||
      Math.hypot(x + 12.8, z + 0.5) < pad ||
      Math.hypot(x - 12.6, z + 1.7) < pad
    );
  }

  private pushCard(
    layer: Layer,
    shape: CardShape,
    cell: CellName,
    pos: THREE.Vector3,
    quat: THREE.Quaternion,
    scale: THREE.Vector3,
    color: THREE.Color,
  ) {
    const key = `${layer}:${shape}:${cell}`;
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { cell, shape, layer, matrices: [], colors: [] };
      this.buckets.set(key, bucket);
    }
    const matrix = new THREE.Matrix4().compose(pos, quat, scale);
    bucket.matrices.push(matrix);
    bucket.colors.push(color);
  }

  private addCanopyCard(rng: Rng, pos: THREE.Vector3, size: number, outward?: THREE.Vector3) {
    const pick = rng.value();
    let cell: CellName;
    if (pick < 0.32) cell = 'camphor';
    else if (pick < 0.46) cell = 'broad';
    else if (pick < 0.6) cell = 'chestnut';
    else if (pick < 0.72) cell = 'pinnate';
    else if (pick < 0.86) cell = 'young';
    else cell = 'camphor';

    const exposure = clamp(
      0.26 +
        0.54 * smoothstep(4.5, 11.5, pos.y) +
        0.22 * noise2(pos.x * 0.35 + 3.1, pos.z * 0.35 - 1.7) +
        (rng.value() - 0.5) * 0.18,
      0,
      1,
    );
    const quat = randomCardQuat(rng, outward);
    // Keep every canopy card inside the requested 1.5-4 m envelope.
    const scale = new THREE.Vector3(
      Math.min(1.1, size * 0.62 * rng.range(0.9, 1.15)),
      Math.min(1.0, size * 0.62 * rng.range(0.68, 0.94)),
      Math.min(1.1, size * 0.62 * rng.range(0.9, 1.15)),
    );
    this.pushCard('canopy', 'canopy', cell, pos, quat, scale, leafTint(exposure, rng, false));
  }

  private addBlobInstances(slots: BlobSlot[], geo: THREE.BufferGeometry, cast: boolean, name: string) {
    if (!slots.length) return;
    const mesh = new THREE.InstancedMesh(geo, this.massMat, slots.length);
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      const m = new THREE.Matrix4().compose(s.pos, s.quat, s.scale);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, s.color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    mesh.name = name;
    mesh.computeBoundingSphere();
    this.group.add(mesh);
  }

  // -- layout ----------------------------------------------------------------

  private populate() {
    this.addFramingTrees();
    this.addBamboo();
    this.addShrubs();
    this.addUnderstory();
    this.addBackgroundForest();
    this.addGroundDetails();
    this.addCanopyCeiling();
    this.flushCards();
  }

  private addFramingTrees() {
    const specs: TreeSpec[] = [
      {
        seed: 'lingyin-veg-tree-left',
        side: 'left',
        base: [-8.5, 8.7],
        height: 12.8,
        radius: 0.8,
        crown: [-2.2, 9.6, 5.7],
        crownRadius: 4.8,
        reach: [-0.6, 10.4, 3.5],
        frame: [-4.2, 5.9, 9.4],
        branches: 6,
        lean: [1.1, -0.5],
      },
      {
        seed: 'lingyin-veg-tree-right',
        side: 'right',
        base: [9.5, 8.7],
        height: 12.2,
        radius: 0.72,
        crown: [2.8, 9.1, 6.2],
        crownRadius: 4.5,
        reach: [0.8, 9.9, 4.2],
        frame: [4.3, 5.8, 11.0],
        branches: 6,
        lean: [-1.2, -0.3],
      },
      {
        seed: 'lingyin-veg-tree-back',
        side: 'back',
        base: [-12.8, -0.5],
        height: 13.6,
        radius: 0.86,
        crown: [-7.0, 9.2, 0.1],
        crownRadius: 4.8,
        reach: [-4.4, 10.6, 1.7],
        frame: [-9.8, 8.0, 5.0],
        branches: 5,
        lean: [0.9, 0.6],
      },
      {
        // Rear-right canopy: the counterweight to the big left-hand crown, and
        // what actually fills the upper-right corner of the hero frame.
        seed: 'lingyin-veg-tree-right-back',
        side: 'back',
        base: [12.6, -1.7],
        height: 12.6,
        radius: 0.8,
        crown: [7.4, 9.9, -1.9],
        crownRadius: 4.7,
        reach: [5.0, 10.4, 0.9],
        frame: [9.6, 8.0, 4.5],
        branches: 5,
        lean: [-0.7, 0.2],
      },
    ];

    const trunkParts: THREE.BufferGeometry[] = [];
    const blobs: BlobSlot[] = [];

    for (const spec of specs) {
      const rng = new Rng(spec.seed);
      const tree = growFramingTree(spec, rng);
      trunkParts.push(tree.trunk);

      // Cards clustered around every branch tip / fork.
      for (const anchor of tree.anchors) {
        const count = Math.round(rng.range(7, 11) * anchor.weight);
        for (let i = 0; i < count; i++) {
          const p = anchor.p
            .clone()
            .add(
              new THREE.Vector3(rng.gauss(), rng.gauss() * 0.7, rng.gauss()).multiplyScalar(
                0.55 + anchor.weight * 0.42,
              ),
            );
          if (p.y < minCanopyY(p.x, p.z)) continue;
          this.addCanopyCard(
            rng,
            p,
            rng.range(0.9, 1.7) * (0.82 + anchor.weight * 0.2),
            rng.chance(0.5) ? anchor.dir : undefined,
          );
        }
      }

      // Layered ellipsoid shells around the lobes: bias toward the outer shell
      // but keep some inner cards for depth between the dark masses and the rim.
      for (const lobe of tree.lobes) {
        for (let i = 0; i < 380; i++) {
          const u = rng.range(-1, 1);
          const theta = rng.range(0, TAU);
          const s = Math.sqrt(1 - u * u);
          const r = Math.pow(rng.value(), 0.4);
          const outward = new THREE.Vector3(s * Math.cos(theta), u, s * Math.sin(theta));
          const p = lobe.center.clone().add(
            new THREE.Vector3(outward.x * lobe.radii.x * r, outward.y * lobe.radii.y * r, outward.z * lobe.radii.z * r),
          );
          if (p.y < minCanopyY(p.x, p.z)) continue;
          const outer = smoothstep(0.5, 1.0, r);
          const size = lerp(0.85, 1.9, outer * rng.range(0.72, 1.0)) * rng.range(0.85, 1.15);
          this.addCanopyCard(rng, p, size, outward);
        }

        // Silhouette cards: slightly larger, sparser leaf clumps on the rim.
        for (let i = 0; i < 26; i++) {
          const u = rng.range(-0.35, 0.95);
          const theta = rng.range(0, TAU);
          const s = Math.sqrt(Math.max(0, 1 - u * u));
          const outward = new THREE.Vector3(s * Math.cos(theta), u, s * Math.sin(theta));
          const p = lobe.center.clone().add(
            new THREE.Vector3(outward.x * lobe.radii.x, outward.y * lobe.radii.y, outward.z * lobe.radii.z).multiplyScalar(
              rng.range(0.92, 1.1),
            ),
          );
          if (p.y < minCanopyY(p.x, p.z)) continue;
          this.addCanopyCard(rng, p, rng.range(1.2, 2.0), outward);
        }

        // Opaque inner mass, low poly and very dark, behind the cards.
        for (let i = 0; i < 4; i++) {
          const p = lobe.center
            .clone()
            .add(
              new THREE.Vector3(
                rng.range(-0.32, 0.32) * lobe.radii.x,
                rng.range(-0.28, 0.28) * lobe.radii.y,
                rng.range(-0.32, 0.32) * lobe.radii.z,
              ),
            );
          blobs.push({
            pos: p,
            quat: randomCardQuat(rng),
            scale: new THREE.Vector3(
              lobe.radii.x * rng.range(0.26, 0.42),
              lobe.radii.y * rng.range(0.28, 0.46),
              lobe.radii.z * rng.range(0.26, 0.42),
            ),
            color: new THREE.Color().setRGB(
              rng.range(0.3, 0.44),
              rng.range(0.42, 0.56),
              rng.range(0.27, 0.38),
            ),
          });
        }
      }

      // Explicit hero arch: five anchors stepping from the tree's low inner
      // limb up and over toward the frame centre. These fill the top corners.
      if (spec.side !== 'back') {
        const mirror = spec.side === 'left' ? 1 : -1;
        const arch: Array<[number, number, number]> = [
          [-4.3, 8.3, 7.9],
          [-3.5, 8.7, 7.35],
          [-2.65, 9.2, 6.6],
          [-1.7, 9.8, 5.55],
          [-0.7, 10.4, 4.15],
        ];
        for (const [ax, ay, az] of arch) {
          const center = new THREE.Vector3(ax * mirror, ay, az);
          const n = rng.int(7, 10);
          for (let i = 0; i < n; i++) {
            const p = center
              .clone()
              .add(new THREE.Vector3(rng.range(-1.15, 1.15), rng.range(-0.65, 0.95), rng.range(-0.95, 0.95)));
            if (p.y < minCanopyY(p.x, p.z)) continue;
            this.addCanopyCard(rng, p, rng.range(1.7, 2.9));
          }
        }

        // A lower second row, inside the 34 deg hero cone. The arch above is
        // mostly above the frame with the real lens; these are the leaves that
        // actually sit in the top corners.
        const lowArch: Array<[number, number, number]> = [
          [-4.6, 4.5, 8.5],
          [-4.0, 4.8, 8.1],
          [-3.4, 5.15, 7.6],
          [-2.7, 5.6, 7.0],
          [-2.0, 6.15, 6.2],
        ];
        // The hero camera sits slightly left of the gate, so the screen-left
        // corner needs a little more leaf mass than the right one.
        if (spec.side === 'left') {
          lowArch.push([-4.2, 4.4, 8.6], [-3.5, 4.7, 8.2]);
        }
        for (const [ax, ay, az] of lowArch) {
          const center = new THREE.Vector3(ax * mirror, ay, az);
          const n = rng.int(7, 10);
          for (let i = 0; i < n; i++) {
            const p = center
              .clone()
              .add(new THREE.Vector3(rng.range(-0.95, 0.95), rng.range(-0.55, 0.7), rng.range(-0.8, 0.8)));
            if (p.y < minCanopyY(p.x, p.z)) continue;
            this.addCanopyCard(rng, p, rng.range(1.6, 2.6));
          }
        }
      }
    }

    let trunkGeometry=mergeParts(trunkParts);
    if(this.barkMat.name==='bark-photogrammetry')
      trunkGeometry=bakeSurfaceFinish(projectedTempleUV(trunkGeometry,2.4),'bark');
    const trunkMesh = new THREE.Mesh(trunkGeometry, this.barkMat);
    trunkMesh.name = 'framing-trunks';
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    this.group.add(trunkMesh);

    // inner mass blobs are intentionally omitted at this close range: cards carry the canopy
    void blobs;
  }

  private addBamboo() {
    const rng = new Rng('lingyin-veg-bamboo');
    const culms: Array<{ matrix: THREE.Matrix4; color: THREE.Color; near: boolean }> = [];
    let tries = 0;

    const plantCulm = (
      x: number,
      z: number,
      height: number,
      leanAngle: number,
      leanDir: THREE.Vector3,
      thickness: number,
      detailed: boolean,
    ) => {
      const dir = leanDir.clone().normalize();
      const axis = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
      const quat = new THREE.Quaternion().setFromAxisAngle(axis, leanAngle);
      const matrix = new THREE.Matrix4().compose(
        new THREE.Vector3(x, 0, z),
        quat,
        new THREE.Vector3(thickness, height, thickness),
      );
      const tint = [
        [0.62, 0.86, 0.44],
        [0.75, 0.95, 0.5],
        [0.86, 1.0, 0.56],
        [0.54, 0.78, 0.42],
      ][rng.int(0, 3)] as RGB;
      culms.push({
        matrix,
        color: new THREE.Color().setRGB(tint[0], tint[1], tint[2]),
        near: detailed,
      });

      // Leaf sprays clustered near the top of the culm, in world space so the
      // leaning instanced culm and its leaves stay together.
      const cardCount = rng.int(4, 6);
      for (let i = 0; i < cardCount; i++) {
        const onCulm = new THREE.Vector3(0, rng.range(0.62, 1.0), 0).applyMatrix4(matrix);
        const p = onCulm.add(
          new THREE.Vector3(rng.range(-1.15, 1.15), rng.range(-0.55, 0.5), rng.range(-1.15, 1.15)),
        );
        const cell: CellName = rng.chance(0.62) ? 'bamboo' : 'bambooSmall';
        const size = rng.range(1.05, 1.95);
        const tintDark = rng.range(0.72, 1.14);
        this.pushCard(
          'bamboo',
          'spray',
          cell,
          p,
          randomCardQuat(rng),
          new THREE.Vector3(size, size * rng.range(0.55, 0.8), size),
          new THREE.Color().setRGB(tintDark * 0.92, tintDark * 1.02, tintDark * 0.7),
        );
      }
    };

    while (culms.length < 108 && tries < 7000) {
      tries++;
      const outlier = culms.length >= 96;
      const x = outlier ? rng.range(-9.4, -8.4) : rng.range(-15, -9);
      const z = outlier ? rng.range(5.2, 7.8) : rng.range(-2, 9);
      if (this.isPlatform(x, z, 0.15)) continue;
      if (this.isPath(x, z, 0.3)) continue;
      if (this.nearFramingTrunk(x, z, 1.3)) continue;

      // Clumped density rather than an even carpet.
      const clump = fbm2(x * 0.35 + 10.3, z * 0.35 - 3.1);
      if (clump < -0.18 && rng.chance(0.45)) continue;

      const height = rng.range(6.0, 10.0) * (outlier ? 0.94 : 1);
      const leanAngle = outlier ? rng.range(0.3, 0.46) : rng.range(0.01, 0.09);
      const leanDir = outlier
        ? new THREE.Vector3(1, 0, rng.range(-0.3, 0.3))
        : new THREE.Vector3(rng.range(-1, 1), 0, rng.range(-1, 1));
      const thickness = rng.range(0.72, 1.05) * (outlier ? 1.12 : 1);
      const detailed = outlier || (culms.length < 24 && z > 2.5);
      plantCulm(x, z, height, leanAngle, leanDir, thickness, detailed);
    }

    // Rhizome strays at the near edge of the grove. These stand just outside the
    // path / platform keep-clear band (|x| > 3.2, z > 3.8) but close enough to the
    // hero camera that at least a few full culms read in the left of the frame.
    const fringe: Array<[number, number, number]> = [
      [-4.5, 5.6, 6.8],
      [-4.7, 6.4, 7.2],
      [-4.4, 7.4, 7.6],
      [-6.4, 4.4, 7.3],
      [-6.8, 4.2, 6.7],
      [-6.1, 5.1, 7.8],
      [-7.1, 4.6, 6.9],
    ];
    for (let i = 0; i < fringe.length; i++) {
      const [x, z, h] = fringe[i];
      plantCulm(x, z, h, 0.05 + i * 0.012, new THREE.Vector3(1, 0, -0.35), 0.92 + i * 0.04, true);
    }

    // Near-left bamboo foliage: grown from the fringe culms above, this is the
    // bamboo that actually overlaps the left edge of the 34 deg hero frame.
    for (let i = 0; i < 26; i++) {
      const x = rng.range(-5.35, -4.05);
      const z = rng.range(6.2, 8.4);
      const y = rng.range(4.0, 6.1);
      const size = rng.range(1.2, 2.1);
      const dark = rng.range(0.6, 1.05);
      this.pushCard(
        'bamboo',
        'spray',
        rng.chance(0.6) ? 'bamboo' : 'bambooSmall',
        new THREE.Vector3(x, y, z),
        randomCardQuat(rng),
        new THREE.Vector3(size, size * 0.55, size),
        new THREE.Color().setRGB(dark * 0.9, dark * 1.02, dark * 0.68),
      );
    }

    // Extra feathery sprays that give the grove a soft wall behind the culms.
    for (let i = 0; i < 85; i++) {
      const x = rng.range(-15.2, -8.9);
      const z = rng.range(-2, 9);
      const y = rng.range(3.4, 9.2);
      const size = rng.range(1.9, 3.2);
      const dark = rng.range(0.5, 0.85);
      this.pushCard(
        'bamboo',
        'spray',
        rng.chance(0.6) ? 'bamboo' : 'bambooSmall',
        new THREE.Vector3(x, y, z),
        randomCardQuat(rng),
        new THREE.Vector3(size, size * 0.55, size),
        new THREE.Color().setRGB(dark * 0.92, dark * 1.02, dark * 0.7),
      );
    }

    const nearGeo = buildBambooCulm(true);
    const farGeo = buildBambooCulm(false);
    const near = culms.filter((c) => c.near);
    const far = culms.filter((c) => !c.near);

    const buildCulmMesh = (list: typeof culms, geo: THREE.BufferGeometry, cast: boolean, name: string) => {
      if (!list.length) return;
      const mesh = new THREE.InstancedMesh(geo, this.bambooMat, list.length);
      for (let i = 0; i < list.length; i++) {
        mesh.setMatrixAt(i, list[i].matrix);
        mesh.setColorAt(i, list[i].color);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      mesh.name = name;
      mesh.computeBoundingSphere();
      this.group.add(mesh);
    };
    buildCulmMesh(near, nearGeo, true, 'bamboo-near');
    buildCulmMesh(far, farGeo, false, 'bamboo-far');
  }

  private addShrubs() {
    const rng = new Rng('lingyin-veg-shrubs');
    const cores: BlobSlot[] = [];
    const placements: Array<{ x: number; z: number; scale: number }> = [];
    let tries = 0;

    while (placements.length < 138 && tries < 8000) {
      tries++;
      const side = rng.chance(0.5) ? -1 : 1;
      let x: number;
      let z: number;
      let scale: number;
      const band = placements.length;
      if (band < 44) {
        // Gate flanks: visible in the lower corners beside the platform.
        x = side * rng.range(8.25, 10.6);
        z = rng.range(-2.3, 3.7);
        scale = rng.range(0.8, 1.35);
      } else if (band < 86) {
        x = side * rng.range(8.2, 12.6);
        z = rng.range(3.9, 10.4);
        scale = rng.range(0.7, 1.25);
      } else if (band < 112) {
        x = side * rng.range(10.5, 14.5);
        z = rng.range(-2, 10.5);
        scale = rng.range(0.85, 1.45);
      } else if (band < 128) {
        // Low screen either side of the approach, still outside the path.
        x = side * rng.range(5.4, 7.6);
        z = rng.range(4.6, 9.8);
        scale = rng.range(0.5, 0.9);
      } else {
        x = side * rng.range(8.2, 11);
        z = rng.range(-3.4, -1.8);
        scale = rng.range(0.75, 1.2);
      }
      if (this.isPlatform(x, z, 0.35)) continue;
      if (this.isPath(x, z, 0.45)) continue;
      if (this.nearFramingTrunk(x, z, 1.5)) continue;
      if (fbm2(x * 0.6 + 2.0, z * 0.6 - 8.0) < -0.35 && rng.chance(0.5)) continue;
      placements.push({ x, z, scale });
    }

    for (const p of placements) {
      const quat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, rng.range(0, TAU), 0),
      );
      const coreScale = new THREE.Vector3(
        p.scale * rng.range(0.16, 0.26),
        p.scale * rng.range(0.12, 0.2),
        p.scale * rng.range(0.16, 0.26),
      );
      const shade = rng.range(0.55, 1.15);
      cores.push({
        pos: new THREE.Vector3(p.x, 0, p.z),
        quat,
        scale: coreScale,
        color: new THREE.Color().setRGB(shade * 0.42, shade * 0.56, shade * 0.38),
      });

      // Cards around the top and sides of the opaque core.
      const cardCount = rng.int(14, 20);
      const h = p.scale * rng.range(0.85, 1.2);
      for (let i = 0; i < cardCount; i++) {
        const a = rng.range(0, TAU);
        const r = rng.range(0.25, 0.95) * p.scale;
        const pos = new THREE.Vector3(
          p.x + Math.cos(a) * r,
          rng.range(0.3, 1.05) * h,
          p.z + Math.sin(a) * r,
        );
        if (this.isPath(pos.x, pos.z, 0.05)) continue;
        if (this.isPlatform(pos.x, pos.z, 0.15)) continue;
        const size = rng.range(0.3, 0.62) * p.scale;
        const tintK = rng.range(0.34, 0.8);
        this.pushCard(
          'shrub',
          'spray',
          rng.chance(0.7) ? 'shrub' : 'camphor',
          pos,
          randomCardQuat(rng),
          new THREE.Vector3(size, size * rng.range(0.68, 0.95), size),
          new THREE.Color().setRGB(tintK * 0.88, tintK, tintK * 0.76),
        );
      }
    }

    const mesh = new THREE.InstancedMesh(makeShrubCoreGeometry(), this.coreMat, cores.length);
    for (let i = 0; i < cores.length; i++) {
      const c = cores[i];
      mesh.setMatrixAt(i, new THREE.Matrix4().compose(c.pos, c.quat, c.scale));
      mesh.setColorAt(i, c.color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'shrub-cores';
    mesh.computeBoundingSphere();
    this.group.add(mesh);
  }

  private addUnderstory() {
    const rng = new Rng('lingyin-veg-understory');

    // Grass tufts along the paving kerbs and the platform edge.
    let grass = 0;
    let tries = 0;
    while (grass < 260 && tries < 7000) {
      tries++;
      const nearKerb = rng.chance(0.72);
      const side = rng.chance(0.5) ? -1 : 1;
      const x = nearKerb ? side * rng.range(3.3, 5.4) : side * rng.range(8.1, 10.8);
      const z = nearKerb ? rng.range(4.0, 26) : rng.range(-3.4, 3.6);
      if (this.isPlatform(x, z, 0.05)) continue;
      if (this.isPath(x, z, 0.05)) continue;
      const size = rng.range(0.5, 1.05);
      const tint = rng.range(0.45, 1.0);
      this.pushCard(
        'under',
        'tuft',
        'grass',
        new THREE.Vector3(x, 0, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rng.range(0, TAU), 0)),
        new THREE.Vector3(size, size * rng.range(0.45, 0.8), size),
        new THREE.Color().setRGB(tint * 0.92, tint, tint * 0.62),
      );
      grass++;
    }

    // Ferns in the shaded edges near the planting beds.
    let ferns = 0;
    tries = 0;
    while (ferns < 110 && tries < 5000) {
      tries++;
      const side = rng.chance(0.5) ? -1 : 1;
      const x = side * rng.range(3.5, 6.6);
      const z = rng.range(4.2, 15.5);
      if (this.isPlatform(x, z, 0.1)) continue;
      if (this.isPath(x, z, 0.05)) continue;
      const size = rng.range(0.75, 1.45);
      const tint = rng.range(0.42, 0.95);
      this.pushCard(
        'under',
        'fern',
        'fern',
        new THREE.Vector3(x, 0, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rng.range(0, TAU), 0)),
        new THREE.Vector3(size, size * rng.range(0.6, 1.0), size),
        new THREE.Color().setRGB(tint * 0.86, tint, tint * 0.68),
      );
      ferns++;
    }
  }

  private addBackgroundForest() {
    const rng = new Rng('lingyin-veg-background');
    const trunkSlots: Array<{ matrix: THREE.Matrix4; color: THREE.Color }> = [];
    const midBlobs: BlobSlot[] = [];
    const farBlobs: BlobSlot[] = [];

    const addTree = (x: number, z: number, h: number, width: number, withCards: boolean) => {
      const scaleXZ = rng.range(0.7, 1.4) * width;
      const yaw = rng.range(0, TAU);
      const matrix = new THREE.Matrix4().compose(
        new THREE.Vector3(x, 0, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)),
        new THREE.Vector3(scaleXZ, h, scaleXZ),
      );
      const shade = rng.range(0.55, 0.9);
      trunkSlots.push({
        matrix,
        color: new THREE.Color().setRGB(shade, shade, shade),
      });

      const crown = new THREE.Vector3(x, h * rng.range(0.72, 0.9), z);
      const crownR = h * rng.range(0.28, 0.42);
      const lobeCount = rng.int(2, 3);
      for (let i = 0; i < lobeCount; i++) {
        const p = crown
          .clone()
          .add(
            new THREE.Vector3(
              rng.range(-crownR * 0.55, crownR * 0.55),
              rng.range(-crownR * 0.3, crownR * 0.4),
              rng.range(-crownR * 0.55, crownR * 0.55),
            ),
          );
        const dark = rng.range(0.3, 0.52);
        midBlobs.push({
          pos: p,
          quat: randomCardQuat(rng),
          scale: new THREE.Vector3(
            crownR * rng.range(0.7, 1.25),
            crownR * rng.range(0.55, 0.9),
            crownR * rng.range(0.7, 1.25),
          ),
          color: new THREE.Color().setRGB(dark * 0.78, dark, dark * 0.72),
        });
      }

      if (!withCards) return;
      const cardCount = rng.int(14, 20);
      for (let i = 0; i < cardCount; i++) {
        const a = rng.range(0, TAU);
        const r = crownR * rng.range(0.3, 1.0);
        const p = new THREE.Vector3(
          crown.x + Math.cos(a) * r,
          crown.y + rng.range(-crownR * 0.6, crownR * 0.75),
          crown.z + Math.sin(a) * r,
        );
        if (p.y < 3.2) continue;
        const size = Math.min(4.2, crownR * rng.range(0.65, 1.15));
        const dark = rng.range(0.42, 0.8);
        this.pushCard(
          'bg',
          'canopy',
          rng.chance(0.5) ? 'camphor' : 'chestnut',
          p,
          randomCardQuat(rng),
          new THREE.Vector3(size, size * rng.range(0.7, 0.95), size),
          new THREE.Color().setRGB(dark * 0.82, dark, dark * 0.8),
        );
      }
    };

    // Layered wall directly behind the gate (seen through and above it).
    let tries = 0;
    let count = 0;
    while (count < 62 && tries < 4000) {
      tries++;
      const x = rng.range(-31, 31);
      const z = rng.range(-24, -10);
      if (Math.abs(x) < 9 && z > -13) continue;
      if (this.isPlatform(x, z, 1.5) || this.isPath(x, z, 2.0)) continue;
      const h = rng.range(7, 14);
      addTree(x, z, h, 1, z > -21 && Math.abs(x) < 26);
      count++;
    }

    // Side wings outside the framing trees, for depth when the camera pans.
    tries = 0;
    while (count < 88 && tries < 4000) {
      tries++;
      const side = rng.chance(0.5) ? -1 : 1;
      const x = side * rng.range(15, 33);
      const z = rng.range(-7, 16);
      if (this.isPlatform(x, z, 1.5) || this.isPath(x, z, 2.2)) continue;
      if (this.nearFramingTrunk(x, z, 3)) continue;
      const h = rng.range(6, 13);
      addTree(x, z, h, 1, z < 9);
      count++;
    }

    // Low understory wall behind the gate so the doorways read as forest, not void.
    for (let i = 0; i < 34; i++) {
      const x = rng.range(-26, 26);
      const z = rng.range(-21, -8);
      if (Math.abs(x) < 8 && z > -12) continue;
      const s = rng.range(1.0, 2.2);
      midBlobs.push({
        pos: new THREE.Vector3(x, rng.range(0.4, 2.0), z),
        quat: randomCardQuat(rng),
        scale: new THREE.Vector3(s, s * rng.range(0.45, 0.75), s),
        color: new THREE.Color().setRGB(0.2, 0.3, 0.2),
      });
    }

    // Far silhouettes: cheap blobs, left for the scene fog to soften.
    for (let i = 0; i < 230; i++) {
      const x = rng.range(-42, 42);
      const z = rng.range(-38, -24);
      const s = rng.range(2.2, 4.2);
      farBlobs.push({
        pos: new THREE.Vector3(x, rng.range(3, 12), z),
        quat: randomCardQuat(rng),
        scale: new THREE.Vector3(s, s * rng.range(0.6, 0.95), s),
        color: new THREE.Color().setRGB(
          rng.range(0.16, 0.28),
          rng.range(0.24, 0.4),
          rng.range(0.18, 0.3),
        ),
      });
    }
    for (let i = 0; i < 40; i++) {
      const side = rng.chance(0.5) ? -1 : 1;
      const s = rng.range(4, 8);
      farBlobs.push({
        pos: new THREE.Vector3(side * rng.range(22, 40), rng.range(2, 10), rng.range(-18, 18)),
        quat: randomCardQuat(rng),
        scale: new THREE.Vector3(s, s * rng.range(0.55, 0.9), s),
        color: new THREE.Color().setRGB(0.18, 0.28, 0.2),
      });
    }

    let trunkGeometry=buildBackgroundTrunk();
    if(this.barkMat.name==='bark-photogrammetry')
      trunkGeometry=bakeSurfaceFinish(projectedTempleUV(trunkGeometry,2.4),'bark');
    const trunkMesh = new THREE.InstancedMesh(trunkGeometry, this.barkMat, trunkSlots.length);
    for (let i = 0; i < trunkSlots.length; i++) {
      trunkMesh.setMatrixAt(i, trunkSlots[i].matrix);
      trunkMesh.setColorAt(i, trunkSlots[i].color);
    }
    trunkMesh.instanceMatrix.needsUpdate = true;
    if (trunkMesh.instanceColor) trunkMesh.instanceColor.needsUpdate = true;
    trunkMesh.castShadow = false;
    trunkMesh.receiveShadow = true;
    trunkMesh.name = 'background-trunks';
    trunkMesh.computeBoundingSphere();
    this.group.add(trunkMesh);

    // background silhouettes come from the painted forest curtain; keep only sparse low blobs
    void midBlobs;
    void this.addBlobInstances;
    void farBlobs;
  }

  /** A loose ceiling of leaves above the gate, so the top of the frame is not empty sky. */
  private addCanopyCeiling() {
    const rng = new Rng('lingyin-canopy-ceiling');
    for (let i = 0; i < 90; i++) {
      const x = rng.range(-13, 13);
      const z = rng.range(1.5, 14);
      const y = rng.range(9.8, 12.8);
      const p = new THREE.Vector3(x, y, z);
      this.addCanopyCard(rng, p, rng.range(1.0, 2.0));
    }
  }

  /**
   * Extend the mountain gate's repaired ochre side-wing language around the
   * three closed sides of the forecourt.  The temple-facing side remains open.
   * All repeated bays are merged by material, so the taller wall still costs
   * only four architectural draw calls.
   */
  private addBoundaryWall() {
    const bases:THREE.BufferGeometry[]=[];
    const panels:THREE.BufferGeometry[]=[];
    const roofs:THREE.BufferGeometry[]=[];
    const timbers:THREE.BufferGeometry[]=[];
    const segments=[
      {x0:-22,z0:5.5,x1:-22,z1:34.5},
      {x0:22,z0:5.5,x1:22,z1:34.5},
      {x0:-22,z0:34.5,x1:22,z1:34.5},
    ];
    // Match the repaired side wing after its .68m runtime placement offset:
    // stone -.02..1.11, plaster 1.03..3.33, roof ridge at 3.69m.
    const footingBottom=-.02,footingTop=1.11;
    const wallBottom=1.03,wallTop=3.33;
    for(const s of segments) {
      const dx=s.x1-s.x0,dz=s.z1-s.z0,len=Math.hypot(dx,dz);
      const cx=(s.x0+s.x1)/2,cz=(s.z0+s.z1)/2,rot=Math.atan2(dx,dz);
      const nx=Math.cos(rot),nz=-Math.sin(rot);
      bases.push(box(.86,footingTop-footingBottom,len+.25,cx,
        (footingBottom+footingTop)/2,cz,rot));
      panels.push(box(.34,wallTop-wallBottom,len-.08,cx,
        (wallBottom+wallTop)/2,cz,rot));

      // Continuous bearing beam and paired front/back fascia boards.
      timbers.push(box(.5,.18,len+.22,cx,wallTop+.015,cz,rot));
      for(const side of [-1,1])
        timbers.push(box(.1,.16,len+.48,cx+side*nx*.88,wallTop+.06,
          cz+side*nz*.88,rot));

      // Two shallow roof pitches meet at one continuous ridge. Build in the
      // segment's local frame, then rotate the complete piece around Y.
      for(const side of [-1,1]) {
        const slab=new THREE.BoxGeometry(.95,.1,len+.5);
        slab.rotateZ(side*.34);
        slab.rotateY(rot);
        slab.translate(cx+nx*side*.38,wallTop+.2,cz+nz*side*.38);
        roofs.push(slab);
      }
      roofs.push(box(.18,.14,len+.52,cx,wallTop+.36,cz,rot));

      // Dark bay posts repeat the original 6.4m side-wing rhythm without
      // introducing fake doors that could be mistaken for playable exits.
      const count=Math.max(2,Math.ceil(len/6.4));
      for(let i=0;i<=count;i++) {
        const t=i/count;
        timbers.push(box(.46,wallTop-wallBottom+.12,.46,
          s.x0+dx*t,(wallBottom+wallTop)/2,s.z0+dz*t,rot));
      }
    }
    const add=(geos:THREE.BufferGeometry[],material:THREE.Material,name:string,uvScale:number)=>{
      const mesh=new THREE.Mesh(projectedTempleUV(merge(geos),uvScale),material);
      mesh.castShadow=true;mesh.receiveShadow=true;mesh.name=name;this.group.add(mesh);
    };
    add(bases,graniteMaterial(.12),'forecourt-boundary-stone-base',1.25);
    add(panels,gatePlasterMaterial(),'forecourt-boundary-plaster',1.8);
    add(roofs,new THREE.MeshStandardMaterial({color:new THREE.Color('#2c322d'),
      roughness:.95,metalness:0}),'forecourt-boundary-roof-cap',.72);
    add(timbers,gateTimberMaterial(1),'forecourt-boundary-timber-posts',.7);
  }

  private addGroundDetails(gamePaving=false) {
    const rng = new Rng('lingyin-veg-ground');

    // Fallen leaves scattered on the paving edges and under the trees.
    let leaves = 0;
    let tries = 0;
    while (leaves < 130 && tries < 3000) {
      tries++;
      const side = rng.chance(0.5) ? -1 : 1;
      const x = side * rng.range(3.35, 7.6);
      const z = rng.range(4.0, 13.5);
      if (this.isPlatform(x, z, 0)) continue;
      const size = rng.range(0.55, 1.15);
      const tint = rng.range(0.55, 1.15);
      this.pushCard(
        'ground',
        'scatter',
        'fallen',
        new THREE.Vector3(x, rng.range(0.015, 0.04), z),
        new THREE.Quaternion().setFromEuler(
          new THREE.Euler(-Math.PI / 2 + rng.range(-0.12, 0.12), rng.range(0, TAU), 0, 'YXZ'),
        ),
        new THREE.Vector3(size * rng.range(0.85, 1.2), size, size),
        new THREE.Color().setRGB(tint, tint * 0.94, tint * 0.86),
      );
      leaves++;
    }

    // Keep flat leaf litter, but do not put bright low-poly moss lumps on
    // the game's photographed stone court/forecourt. Source study is intact.
    if(gamePaving)return;
    // Moss clumps at tree bases and along the platform kerb.
    const moss: BlobSlot[] = [];
    for (let i = 0; i < 46; i++) {
      let x: number;
      let z: number;
      if (i < 14) {
        x = -8.5 + rng.range(-1.4, 1.4);
        z = 7 + rng.range(-1.4, 1.4);
      } else if (i < 26) {
        x = 9.5 + rng.range(-1.4, 1.4);
        z = 5.5 + rng.range(-1.4, 1.4);
      } else if (i < 34) {
        x = -12.8 + rng.range(-1.6, 1.6);
        z = -0.5 + rng.range(-1.6, 1.6);
      } else {
        const side = rng.chance(0.5) ? -1 : 1;
        x = side * rng.range(8.2, 10.5);
        z = rng.range(-3.4, 3.6);
        if (this.isPlatform(x, z, 0.05)) continue;
      }
      // In the game this group is placed at world z=40.  Local z<5.7 is
      // therefore inside the temple enclosure, where raised low-poly moss
      // blobs look like debris on the photographed flagstones.
      if (z < 5.7) continue;
      const s = rng.range(0.22, 0.55);
      moss.push({
        pos: new THREE.Vector3(x, 0.02, z),
        quat: randomCardQuat(rng),
        scale: new THREE.Vector3(s * rng.range(1.1, 1.7), s * 0.45, s * rng.range(1.1, 1.7)),
        color: new THREE.Color().setRGB(
          rng.range(1.1, 1.55),
          rng.range(1.35, 1.9),
          rng.range(0.7, 1.0),
        ),
      });
    }
    const mossMesh = new THREE.InstancedMesh(makeBlobGeometry(0), this.coreMat, moss.length);
    for (let i = 0; i < moss.length; i++) {
      const m = moss[i];
      mossMesh.setMatrixAt(i, new THREE.Matrix4().compose(m.pos, m.quat, m.scale));
      mossMesh.setColorAt(i, m.color);
    }
    mossMesh.instanceMatrix.needsUpdate = true;
    if (mossMesh.instanceColor) mossMesh.instanceColor.needsUpdate = true;
    mossMesh.castShadow = false;
    mossMesh.receiveShadow = true;
    mossMesh.name = 'moss-clumps';
    mossMesh.computeBoundingSphere();
    this.group.add(mossMesh);
  }

  private flushCards() {
    for (const bucket of this.buckets.values()) {
      if (!bucket.matrices.length) continue;
      const geo = cardGeometry(bucket.cell, bucket.shape);
      const mesh = new THREE.InstancedMesh(geo, this.leafMat, bucket.matrices.length);
      for (let i = 0; i < bucket.matrices.length; i++) {
        mesh.setMatrixAt(i, bucket.matrices[i]);
        mesh.setColorAt(i, bucket.colors[i]);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

      const casts = bucket.layer === 'canopy' || bucket.layer === 'bamboo';
      mesh.castShadow = casts;
      mesh.receiveShadow = true;
      if (casts) mesh.customDepthMaterial = this.depthMat;
      mesh.name = `veg-cards-${bucket.layer}-${bucket.cell}`;
      mesh.computeBoundingSphere();
      this.group.add(mesh);
    }
  }
}
