// Deterministic math helpers: seeded RNG, value noise, fbm, Halton, easing.
// Everything the world generates goes through these so a reload always rebuilds the same valley.

export const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const smootherstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
export const gauss = (x: number, z: number, r: number) => Math.exp(-(x * x + z * z) / (r * r));

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  private next: () => number;
  constructor(seed: number | string) {
    const s = typeof seed === 'number' ? seed : hashString(seed);
    this.next = mulberry32(s);
  }
  value() {
    return this.next();
  }
  range(a: number, b: number) {
    return a + (b - a) * this.next();
  }
  int(a: number, b: number) {
    return Math.floor(this.range(a, b + 1));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length) % arr.length];
  }
  chance(p: number) {
    return this.next() < p;
  }
  sign() {
    return this.next() < 0.5 ? -1 : 1;
  }
  gauss() {
    const u = Math.max(1e-6, this.next());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2831853 * this.next());
  }
}

export function hashString(str: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function hash2(x: number, z: number) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const fade = (t: number) => t * t * (3 - 2 * t);

/** value noise 2D, [-1, 1] */
export function noise2(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = fade(xf);
  const v = fade(yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return (lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1);
}

export function fbm2(x: number, y: number, octaves = 4, lacunarity = 2.02, gain = 0.5) {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x * freq + i * 17.31, y * freq - i * 9.13);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

export function ridged2(x: number, y: number, octaves = 4) {
  let amp = 0.55;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(noise2(x * freq + i * 3.7, y * freq + i * 11.2));
    sum += amp * n * n;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

/** polyline distance in XZ, plus nearest segment parameter and side */
export function distToPolyline(x: number, z: number, pts: readonly [number, number][]) {
  let best = Infinity;
  let bestT = 0;
  let bestI = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i][0];
    const az = pts[i][1];
    const bx = pts[i + 1][0];
    const bz = pts[i + 1][1];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz || 1;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / len2, 0, 1);
    const px = ax + dx * t;
    const pz = az + dz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best) {
      best = d;
      bestT = t;
      bestI = i;
    }
  }
  return { d: best, t: bestT, i: bestI };
}

function cr(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

export function sampleSpline(pts: readonly [number, number][], n: number): [number, number][] {
  const out: [number, number][] = [];
  const ext: [number, number][] = [pts[0], ...pts, pts[pts.length - 1]];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = ext[i];
    const p1 = ext[i + 1];
    const p2 = ext[i + 2];
    const p3 = ext[i + 3];
    const steps = Math.max(2, Math.round(n / (pts.length - 1)));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      out.push([cr(p0[0], p1[0], p2[0], p3[0], t), cr(p0[1], p1[1], p2[1], p3[1], t)]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export function halton(index: number, base: number) {
  let f = 1;
  let r = 0;
  let i = index;
  while (i > 0) {
    f /= base;
    r += f * (i % base);
    i = Math.floor(i / base);
  }
  return r;
}

export function smoothDamp(current: number, target: number, velocity: number, smoothTime: number, dt: number) {
  const omega = 2 / Math.max(0.0001, smoothTime);
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (velocity + omega * change) * dt;
  const newVelocity = (velocity - omega * temp) * exp;
  return { value: target + (change + temp) * exp, velocity: newVelocity };
}

export function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
