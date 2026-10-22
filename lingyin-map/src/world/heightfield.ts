// The valley's analytic height field and water layout.
// One function drives terrain meshing, placement, water depth and every prop's footing.
import { clamp, distToPolyline, fbm2, gauss, lerp, ridged2, smoothstep } from '../core/math';
import { FRONT_GATE_FORECOURT, RIDGE_GRADED_WIDTH, RIDGE_HALF_WIDTH, RIDGE_LOOKOUTS, RIDGE_SHOULDER, ridgeTrailAt,
  ridgeTrailDistance } from '../../../scripts/lingyin_hillside_route.js';

export const WORLD = {
  size: 620,
  center: [0, 0],
  temple: { x: -2, z: -12 },
  platform: { x0: -36, x1: 28, z0: -48, z1: 46, y: 3.25 },
  pond: { x: 18, z: 66, r: 15, y: 0.55 },
  bridge: { x: 36, z: 28 },
};

export const STREAM_CTRL: [number, number][] = [
  [46, -120],
  [43, -82],
  [40, -48],
  [37, -16],
  [36, 10],
  [35, 28],
  [31, 44],
  [24, 56],
  [18, 66],
];

export const STREAM = (() => {
  const pts: [number, number][] = [];
  for (let i = 0; i < STREAM_CTRL.length - 1; i++) {
    const a = STREAM_CTRL[i];
    const b = STREAM_CTRL[i + 1];
    const n = 12;
    for (let s = 0; s < n; s++) pts.push([lerp(a[0], b[0], s / n), lerp(a[1], b[1], s / n)]);
  }
  pts.push(STREAM_CTRL[STREAM_CTRL.length - 1]);
  return pts;
})();

export const PATH: [number, number][] = [
  [-2, 46],
  [-2, 56],
  [4, 63],
  [14, 68],
  [24, 64],
  [31, 56],
  [34, 46],
  [34, 36],
  [36, 28],
];

/** 0 at the source, 1 at the pond */
export function streamT(x: number, z: number) {
  const { d, t, i } = distToPolyline(x, z, STREAM_CTRL);
  const seg = i + t;
  return { d, t: clamp(seg / (STREAM_CTRL.length - 1), 0, 1) };
}

export function streamWidth(t: number) {
  return lerp(2.8, 7.2, Math.pow(t, 0.7));
}

/** water surface height at a stream parameter */
export function streamLevel(t: number) {
  return lerp(6.3, 0.55, Math.pow(clamp(t, 0, 1), 0.82));
}

export function pondDepth(x: number, z: number) {
  const d = Math.hypot(x - WORLD.pond.x, z - WORLD.pond.z);
  return d - WORLD.pond.r;
}

/** signed distance to the water edge (negative inside), approximate but continuous */
export function waterEdge(x: number, z: number) {
  const { d, t } = streamT(x, z);
  const w = streamWidth(t);
  const streamEdge = d - w;
  const pondEdge = pondDepth(x, z);
  return Math.min(streamEdge, pondEdge);
}

export function waterLevelAt(x: number, z: number) {
  const { t } = streamT(x, z);
  const pond = WATER_POND;
  const stream = streamLevel(t);
  const dp = pondDepth(x, z);
  return dp < 0 ? pond : stream;
}

export const WATER_POND = WORLD.pond.y;

function rectMask(x: number, z: number, x0: number, z0: number, x1: number, z1: number, feather: number) {
  const dx = Math.max(x0 - x, x - x1, 0);
  const dz = Math.max(z0 - z, z - z1, 0);
  return smoothstep(0, feather, Math.hypot(dx, dz));
}

function baseHeight(x: number, z: number) {
  let h = 1.6;
  // gentle climb toward the north
  h += smoothstep(44, -110, z) * 5.5;
  // forested east ridge (the crag sits on its shoulder)
  h += 36 * gauss(x - 118, z + 44, 92);
  // west ridge, lower and softer
  h += 30 * gauss(x + 118, z - 6, 104);
  // northern massif
  const north = smoothstep(-40, -230, z);
  const n = 0.55 + 0.45 * ridged2(x * 0.012 + 3.1, z * 0.012 - 1.7, 4);
  h += north * 62 * n;
  // southern opening stays low so the valley reads as an entrance
  h *= lerp(1, 0.55, smoothstep(55, 150, z));
  // rolling detail
  h += 1.35 * fbm2(x * 0.035, z * 0.035, 4);
  h += 0.38 * fbm2(x * 0.16 + 4.2, z * 0.16 - 2.1, 3);
  return h;
}

export function heightAt(x: number, z: number) {
  let h = baseHeight(x, z);

  // ---- temple terrace: a flat platform cut into the slope
  const P = WORLD.platform;
  const flat = rectMask(x, z, P.x0, P.z0, P.x1, P.z1, 13);
  const terrace = P.y + 0.04 * fbm2(x * 0.12, z * 0.12, 2);
  h = lerp(terrace, h, flat);

  // ---- crag footing: a stony shoulder under Feilai Feng
  h += 6.5 * gauss(x - 78, z + 22, 26) * (0.6 + 0.4 * fbm2(x * 0.08, z * 0.08, 3));

  // ---- processional path: gentle smoothing, never a trench, never across water
  const pathD = distToPolyline(x, z, PATH).d;
  if (pathD < 5 && waterEdge(x, z) > 0.8) {
    const bank = smoothstep(0.9, 4.5, pathD);
    h = lerp(Math.max(h, P.y - 0.7), h, bank);
  }

  // ---- stream channel: carve a bed, leave a raised bank (last, so it wins over the terrace)
  const { d, t } = streamT(x, z);
  const w = streamWidth(t);
  const level = streamLevel(t);
  const bed = level - 0.85 - 0.25 * fbm2(x * 0.2, z * 0.2, 2);
  const streamBlend = smoothstep(w * 0.55, w * 1.9 + 2.5, d);
  h = lerp(Math.min(h, bed), h, streamBlend);

  // ---- pond basin
  const pd = pondDepth(x, z);
  if (pd < 12) {
    const bedP = WORLD.pond.y - 1.5 - 0.8 * fbm2(x * 0.09 + 8.0, z * 0.09 - 3.0, 3);
    h = lerp(Math.min(h, bedP), h, smoothstep(-2, 11, pd));
  }

  // The former climb directly outside the mountain gate has been removed.
  // Keep its lower arrival area as a continuous level forecourt, feathered
  // into the surrounding terrain; the surviving west-gate trail lies well
  // outside this footprint and is still graded below.
  const F=FRONT_GATE_FORECOURT;
  const frontForecourt = rectMask(x, z, F.x0, F.z0, F.x1, F.z1, 7);
  h = lerp(P.y, h, frontForecourt);

  // Grade a narrow bench into the existing mountainside. The authored path
  // and the FPS floor use the same centreline, so the view and feet agree.
  const trail = ridgeTrailAt(x,z);
  // Keep the entire paving and rail footing on the graded bench. The old
  // fade began at the paving edge; the coarse terrain triangles then crossed
  // over the path by as much as a metre on the west ascent.
  const trailBlend=1-smoothstep(RIDGE_GRADED_WIDTH,RIDGE_SHOULDER,trail.distance);
  const grade=trailBlend;
  if(grade>0)h=lerp(h,WORLD.platform.y+trail.y,grade);
  for(const lookout of RIDGE_LOOKOUTS) {
    const deckDist=Math.hypot(
      Math.max(0,Math.abs(x-lookout.x)-lookout.hx),
      Math.max(0,Math.abs(z-lookout.z)-lookout.hz));
    // The elevated deck has a short earthen shoulder, but that shoulder must
    // never rise through a lower trail passing beside it.
    const lowerTrail=deckDist>0&&trail.distance<RIDGE_GRADED_WIDTH+1&&
      trail.y<lookout.y-.8;
    if(deckDist<4&&!lowerTrail)
      h=lerp(WORLD.platform.y+lookout.y,h,smoothstep(0,4,deckDist));
  }

  return h;
}

// The global valley mesh is intentionally economical. Near the narrow stone
// road, ease its grid vertices down by at most 42 cm so a coarse triangle
// cannot cut across the graded walkway or the side of a switchback.
export function terrainMeshHeightAt(x:number,z:number,gridStep:number) {
  const h=heightAt(x,z);
  const near=ridgeTrailAt(x,z);
  if(near.distance>RIDGE_HALF_WIDTH+gridStep)return h;
  let low=Infinity;
  for(const dx of [-1.4,0,1.4])for(const dz of [-1.4,0,1.4]) {
    const p=ridgeTrailAt(x+dx,z+dz);
    if(p.distance<RIDGE_HALF_WIDTH+.2)low=Math.min(low,WORLD.platform.y+p.y);
  }
  if(!Number.isFinite(low))return h;
  const fade=clamp((RIDGE_HALF_WIDTH+gridStep-near.distance)/gridStep,0,1);
  return Math.max(h-.42*fade,Math.min(h,low-.06));
}

// Match the exact two triangles that Terrain uses, rather than a bilinear
// approximation. Paving vertices are kept just above this visible surface.
export function terrainRenderedHeightAt(x:number,z:number,segments=260) {
  const step=WORLD.size/segments,half=WORLD.size/2;
  const gx=(x+half)/step,gz=(z+half)/step;
  const ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz;
  const x0=-half+ix*step,z0=-half+iz*step;
  const a=terrainMeshHeightAt(x0,z0,step);
  const b=terrainMeshHeightAt(x0+step,z0,step);
  const c=terrainMeshHeightAt(x0,z0+step,step);
  const d=terrainMeshHeightAt(x0+step,z0+step,step);
  return u+v<=1?a*(1-u-v)+b*u+c*v:d*(u+v-1)+b*(1-v)+c*(1-u);
}

export function normalAt(x: number, z: number, e = 1.2) {
  const hx = heightAt(x + e, z) - heightAt(x - e, z);
  const hz = heightAt(x, z + e) - heightAt(x, z - e);
  const nx = -hx;
  const ny = 2 * e;
  const nz = -hz;
  const l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}

export function slopeAt(x: number, z: number, e = 1.2) {
  return 1 - normalAt(x, z, e)[1];
}

export function insidePlatform(x: number, z: number, pad = 0) {
  const P = WORLD.platform;
  return x > P.x0 - pad && x < P.x1 + pad && z > P.z0 - pad && z < P.z1 + pad;
}

export function waterDepthAt(x: number, z: number) {
  return waterLevelAt(x, z) - heightAt(x, z);
}

export function pathDistance(x: number, z: number) {
  return Math.min(distToPolyline(x, z, PATH).d,ridgeTrailDistance(x,z));
}
