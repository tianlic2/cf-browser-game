import * as e from "three";
import { mergeGeometries as t } from "three/addons/utils/BufferGeometryUtils.js";
//#region src/core/atmosphere.ts
var n = {
	sunDir: { value: new e.Vector3(.55, .3, -.78).normalize() },
	sunColor: { value: new e.Color(1, .82, .62) },
	hazeColor: { value: new e.Color(.18, .235, .28) },
	mistColor: { value: new e.Color(.3, .36, .35) },
	sunIrr: { value: new e.Vector3(4.2, 3.4, 2.6) },
	hazeDensity: { value: 8e-4 },
	hazeHeight: { value: 62 },
	mistDensity: { value: .0026 },
	mistHeight: { value: 20 },
	hazeFar: { value: 11e-6 },
	time: { value: 0 }
}, r = "\nfloat cgHash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }\nfloat cgHash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }\nvec3 cgHash33(vec3 p3){ p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }\nfloat cgNoise2(vec2 p){\n  vec2 i = floor(p), f = fract(p);\n  f = f * f * (3.0 - 2.0 * f);\n  float a = cgHash12(i), b = cgHash12(i + vec2(1,0)), c = cgHash12(i + vec2(0,1)), d = cgHash12(i + vec2(1,1));\n  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);\n}\nfloat cgNoise3(vec3 p){\n  vec3 i = floor(p), f = fract(p);\n  f = f * f * (3.0 - 2.0 * f);\n  float n000 = cgHash12(i.xy + i.z * 19.19);\n  float n100 = cgHash12(i.xy + vec2(1,0) + i.z * 19.19);\n  float n010 = cgHash12(i.xy + vec2(0,1) + i.z * 19.19);\n  float n110 = cgHash12(i.xy + vec2(1,1) + i.z * 19.19);\n  float n001 = cgHash12(i.xy + (i.z + 1.0) * 19.19);\n  float n101 = cgHash12(i.xy + vec2(1,0) + (i.z + 1.0) * 19.19);\n  float n011 = cgHash12(i.xy + vec2(0,1) + (i.z + 1.0) * 19.19);\n  float n111 = cgHash12(i.xy + vec2(1,1) + (i.z + 1.0) * 19.19);\n  return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y), mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);\n}\nfloat cgFbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i=0;i<5;i++){ s += a * cgNoise2(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }\nfloat cgFbm3(vec3 p){ float s = 0.0, a = 0.5; for (int i=0;i<4;i++){ s += a * cgNoise3(p); p = p * 2.05 + 7.3; a *= 0.5; } return s; }\nfloat cgRidge2(vec2 p){ float s = 0.0, a = 0.55; for (int i=0;i<4;i++){ float n = 1.0 - abs(cgNoise2(p) * 2.0 - 1.0); s += a * n * n; p = p * 2.1 + 3.1; a *= 0.5; } return s; }\n// anti-aliased thin line: distance d in world units, width w, pixel footprint aa\nfloat cgLine(float d, float w, float aa){ return 1.0 - smoothstep(w, w + aa, abs(d)); }\n", i = "\nvarying vec3 vCgWorld;\nvarying vec3 vCgNormalW;\nvarying vec3 vCgObj;\nvarying float vCgSeed;\n", a = "\n{\n  vec4 cgP = vec4(transformed, 1.0);\n  vec3 cgN = objectNormal;\n  float cgSeedV = 0.0;\n  #ifdef USE_INSTANCING\n    cgP = instanceMatrix * cgP;\n    cgN = mat3(instanceMatrix) * cgN;\n    cgSeedV = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);\n  #endif\n  vCgWorld = (modelMatrix * cgP).xyz;\n  vCgNormalW = normalize(mat3(modelMatrix) * cgN);\n  vCgObj = transformed;\n  vCgSeed = cgSeedV;\n}\n";
function o(t = {}) {
	let n = new e.MeshStandardMaterial(t.params ?? {});
	t.name && (n.name = t.name);
	let o = t.uniforms ?? {}, c = "proc:" + s([
		t.head,
		t.vertexHead,
		t.vertexPre,
		t.color,
		t.roughness,
		t.metalness,
		t.normal,
		t.emissive,
		t.ao
	].join("|"));
	return n.customProgramCacheKey = () => c, n.onBeforeCompile = (e) => {
		Object.assign(e.uniforms, o);
		let n = e.vertexShader, s = e.fragmentShader;
		n = n.replace("#include <common>", `#include <common>\n${i}\n${t.vertexHead ?? ""}`), t.vertexPre && (n = n.replace("#include <begin_vertex>", `#include <begin_vertex>\n{\n${t.vertexPre}\n}`)), n = n.replace("#include <worldpos_vertex>", `#include <worldpos_vertex>\n${a}`), s = s.replace("#include <common>", `#include <common>\n${i}\n${r}\n${t.head ?? ""}`), s = s.replace("void main() {", "void main() {\nvec3 cgP = vCgWorld; vec3 cgN = normalize(vCgNormalW); vec3 cgO = vCgObj; float cgSeed = vCgSeed; vec3 cgBump = vec3(0.0); float cgAO = 1.0;"), t.color && (s = s.replace("#include <color_fragment>", `#include <color_fragment>\n{\n${t.color}\n}`)), t.roughness && (s = s.replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>\n{\n${t.roughness}\n}`)), t.metalness && (s = s.replace("#include <metalnessmap_fragment>", `#include <metalnessmap_fragment>\n{\n${t.metalness}\n}`)), t.normal && (s = s.replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\n{\n${t.normal}\n}\nnormal = normalize(normal + (viewMatrix * vec4(cgBump, 0.0)).xyz);`)), t.emissive && (s = s.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n{\n${t.emissive}\n}`)), t.ao && (s = s.replace("#include <aomap_fragment>", `#include <aomap_fragment>\n{\n${t.ao}\n}\nreflectedLight.indirectDiffuse *= cgAO; reflectedLight.indirectSpecular *= mix(1.0, cgAO, 0.7);`)), e.vertexShader = n, e.fragmentShader = s;
	}, n;
}
function s(e) {
	let t = 2166136261;
	for (let n = 0; n < e.length; n++) t ^= e.charCodeAt(n), t = Math.imul(t, 16777619);
	return (t >>> 0).toString(36);
}
//#endregion
//#region src/core/sky.ts
var c = "\nvarying vec3 vDir;\nvoid main(){\n  vDir = position;\n  vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);\n  gl_Position = p.xyww;\n}\n", l = `
varying vec3 vDir;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform float uSunSize;
uniform float uSunDisk;
uniform float uCloudCover;
uniform float uCloudScale;
uniform float uCloudSpeed;
uniform float uTime;
uniform float uEnvPass;
uniform vec3 uHazeColor;
${r}

vec3 skyHeight(vec3 d){
  float mu = dot(d, uSunDir);
  float h = clamp(d.y, -1.0, 1.0);
  float hh = max(h, 0.0);
  float t = pow(1.0 - hh, 5.0);
  vec3 zen = uZenith * (1.0 + 0.25 * (1.0 - hh));
  vec3 col = mix(zen, uHorizon, t);
  // warm band near the horizon on the sun side
  float band = smoothstep(0.0, 0.35, 1.0 - hh) * smoothstep(-0.05, 0.12, h);
  col = mix(col, col * vec3(1.16, 1.02, 0.86), band * smoothstep(-0.2, 0.9, mu) * 0.55);
  // soft aureole
  float m = max(mu, 0.0);
  col += uSunColor * (0.16 * pow(m, 6.0) + 0.5 * pow(m, 90.0) + 1.6 * pow(m, 900.0)) * (0.35 + 0.65 * t);
  return col;
}

// thin cloud deck: fbm on a projected plane, lit from the sun side
vec3 clouds(vec3 d, float quality){
  if (d.y < 0.015) return vec3(0.0);
  float H = 420.0;
  vec2 p = d.xz / max(d.y, 0.06) * H * 0.001;
  p = p * uCloudScale + vec2(uTime * uCloudSpeed * 0.002, uTime * uCloudSpeed * 0.0009);
  float n = cgFbm2(p * 0.55);
  float n2 = cgFbm2(p * 1.75 + 13.0);
  float cover = mix(n, n2, 0.4);
  float mask = smoothstep(0.62 - uCloudCover * 0.34, 0.78 - uCloudCover * 0.22, cover);
  mask *= smoothstep(0.02, 0.2, d.y);
  float mu = dot(d, uSunDir);
  float lit = 0.55 + 0.45 * smoothstep(-0.2, 0.7, mu);
  float thick = smoothstep(0.55, 0.9, n2);
  vec3 c = mix(vec3(0.55, 0.58, 0.61), vec3(1.1, 1.02, 0.9), lit);
  c *= mix(1.0, 0.72, thick);
  // bright silver rim where the sun grazes the deck
  c += uSunColor * pow(max(mu, 0.0), 18.0) * 0.5 * mask;
  return c * mask * 0.85;
}

vec3 cirrus(vec3 d){
  if (d.y < 0.08) return vec3(0.0);
  vec2 p = d.xz / d.y;
  p = mat2(0.86, -0.5, 0.5, 0.86) * p;
  vec2 q = vec2(p.x * 0.22, p.y * 1.35);
  float n = cgFbm2(q * 1.6 + vec2(uTime * 0.0007, 0.0));
  float streak = smoothstep(0.5, 0.82, n) * smoothstep(0.08, 0.22, d.y) * (1.0 - smoothstep(0.35, 0.75, d.y));
  return vec3(0.92, 0.93, 0.95) * streak * 0.14;
}

void main(){
  vec3 d = normalize(vDir);
  vec3 col = skyHeight(d);
  if (d.y > 0.0) {
    col = mix(col, col + clouds(d, 0.0), 0.85);
    col += cirrus(d);
  }
  if (d.y < 0.0) col = mix(col, uGround, smoothstep(0.0, -0.16, d.y));
  // sun disk (not in the IBL pass)
  if (uEnvPass < 0.5) {
    float mu = dot(d, uSunDir);
    float cosR = cos(uSunSize);
    float disk = smoothstep(cosR - 0.00003, cosR + 0.00001, mu);
    col += uSunColor * uSunDisk * disk * smoothstep(0.0, 0.06, d.y);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`, u = class {
	mesh;
	material;
	uniforms;
	constructor() {
		this.uniforms = {
			uSunDir: n.sunDir,
			uSunColor: n.sunColor,
			uZenith: { value: new e.Color("#6689a6") },
			uHorizon: { value: new e.Color("#bfc6c4") },
			uGround: { value: new e.Color("#4a4b42") },
			uSunSize: { value: .012 },
			uSunDisk: { value: 34 },
			uCloudCover: { value: .29 },
			uCloudScale: { value: 1 },
			uCloudSpeed: { value: 1 },
			uTime: n.time,
			uEnvPass: { value: 0 },
			uHazeColor: n.hazeColor
		}, this.material = new e.ShaderMaterial({
			uniforms: this.uniforms,
			vertexShader: c,
			fragmentShader: l,
			side: e.BackSide,
			depthWrite: !1,
			depthTest: !0,
			fog: !1
		});
		let t = new e.SphereGeometry(1, 64, 40);
		this.mesh = new e.Mesh(t, this.material), this.mesh.name = "sky", this.mesh.frustumCulled = !1, this.mesh.renderOrder = 1e6, this.mesh.scale.setScalar(4e3);
	}
	makeEnvSky() {
		let e = this.mesh.clone();
		return e.material = this.material.clone(), e.material.uniforms = {
			...this.uniforms,
			uEnvPass: { value: 1 }
		}, e.scale.setScalar(100), e;
	}
}, d = (e, t, n) => e < t ? t : e > n ? n : e, f = (e, t, n) => e + (t - e) * n, p = (e, t, n) => {
	let r = d((n - e) / (t - e), 0, 1);
	return r * r * (3 - 2 * r);
};
function m(e) {
	let t = e >>> 0;
	return () => {
		t |= 0, t = t + 1831565813 | 0;
		let e = Math.imul(t ^ t >>> 15, 1 | t);
		return e = e + Math.imul(e ^ e >>> 7, 61 | e) ^ e, ((e ^ e >>> 14) >>> 0) / 4294967296;
	};
}
var h = class {
	next;
	constructor(e) {
		let t = typeof e == "number" ? e : g(e);
		this.next = m(t);
	}
	value() {
		return this.next();
	}
	range(e, t) {
		return e + (t - e) * this.next();
	}
	int(e, t) {
		return Math.floor(this.range(e, t + 1));
	}
	pick(e) {
		return e[Math.floor(this.next() * e.length) % e.length];
	}
	chance(e) {
		return this.next() < e;
	}
	sign() {
		return this.next() < .5 ? -1 : 1;
	}
	gauss() {
		let e = Math.max(1e-6, this.next());
		return Math.sqrt(-2 * Math.log(e)) * Math.cos(6.2831853 * this.next());
	}
};
function g(e) {
	let t = 2166136261;
	for (let n = 0; n < e.length; n++) t ^= e.charCodeAt(n), t = Math.imul(t, 16777619);
	return t >>> 0;
}
function _(e, t) {
	let n = Math.imul(e | 0, 374761393) + Math.imul(t | 0, 668265263);
	return n = Math.imul(n ^ n >>> 13, 1274126177), ((n ^ n >>> 16) >>> 0) / 4294967296;
}
var v = (e) => e * e * (3 - 2 * e);
function y(e, t) {
	let n = Math.floor(e), r = Math.floor(t), i = e - n, a = t - r, o = v(i), s = v(a), c = _(n, r), l = _(n + 1, r), u = _(n, r + 1), d = _(n + 1, r + 1);
	return f(f(c, l, o), f(u, d, o), s) * 2 - 1;
}
function b(e, t, n = 4, r = 2.02, i = .5) {
	let a = .5, o = 1, s = 0, c = 0;
	for (let l = 0; l < n; l++) s += a * y(e * o + l * 17.31, t * o - l * 9.13), c += a, a *= i, o *= r;
	return s / c;
}
function x(e, t, n) {
	let r = Infinity, i = 0, a = 0;
	for (let o = 0; o < n.length - 1; o++) {
		let s = n[o][0], c = n[o][1], l = n[o + 1][0], u = n[o + 1][1], f = l - s, p = u - c, m = f * f + p * p || 1, h = d(((e - s) * f + (t - c) * p) / m, 0, 1), g = s + f * h, _ = c + p * h, v = Math.hypot(e - g, t - _);
		v < r && (r = v, i = h, a = o);
	}
	return {
		d: r,
		t: i,
		i: a
	};
}
//#endregion
//#region ../scripts/lingyin_main_hall.js
var S = Object.freeze({
	name: "main",
	x: -2,
	z: -26,
	w: 31.5,
	d: 24,
	eave: 11,
	plinth: 1.1,
	rot: 0
}), C = Object.freeze({
	x: S.w / 27,
	z: S.d / 17
}), w = [[
	[
		-36.4,
		7,
		.95
	],
	[
		-40,
		7,
		1.25
	],
	[
		-44,
		9,
		2
	],
	[
		-47,
		14,
		3
	],
	[
		-47,
		20,
		4.05
	],
	[
		-43,
		25,
		5.15
	],
	[
		-47,
		30,
		6.25
	],
	[
		-50,
		36,
		7.45
	],
	[
		-49,
		43,
		8.65
	],
	[
		-43,
		48,
		9.95
	],
	[
		-37,
		54,
		11.05
	],
	[
		-40,
		59,
		12
	],
	[
		-44.8,
		62,
		13
	]
]], T = 2.45, E = T + .27, ee = T + 1.45, te = 7.2, ne = .14, D = [{
	x: -50,
	z: 62,
	y: 13,
	hx: 5.2,
	hz: 4.2,
	entrySide: "east",
	entryX: -44.8,
	entryZ: 62
}], re = {
	x0: -24,
	x1: 20,
	z0: 45.5,
	z1: 74.5,
	y: 0
};
function ie(e, t = .9) {
	let n = [];
	for (let t = 0; t < e.length - 1; t++) {
		let r = e[t + 1][0] - e[t][0], i = e[t + 1][1] - e[t][1], a = Math.hypot(r, i);
		n.push({
			x: -i / a,
			z: r / a
		});
	}
	let r = e.map((t, r) => {
		if (r === 0) return n[0];
		if (r === e.length - 1) return n.at(-1);
		let i = n[r - 1], a = n[r], o = i.x + a.x, s = i.z + a.z, c = Math.hypot(o, s), l = o / c, u = s / c, d = Math.min(1.45, 1 / (l * a.x + u * a.z));
		return {
			x: l * d,
			z: u * d
		};
	}), i = [], a = 0;
	for (let o = 0; o < e.length - 1; o++) {
		let s = e[o], c = e[o + 1], l = c[0] - s[0], u = c[1] - s[1], d = Math.hypot(l, u), f = Math.ceil(d / t), p = Math.min(3, d * .45);
		for (let e = 0; e < f; e++) {
			let t = e / f, m = Math.max(0, 1 - d * t / p), h = Math.max(0, 1 - d * (1 - t) / p), g = {
				x: n[o].x * (1 - m - h) + r[o].x * m + r[o + 1].x * h,
				z: n[o].z * (1 - m - h) + r[o].z * m + r[o + 1].z * h
			};
			i.push({
				x: s[0] + l * t,
				z: s[1] + u * t,
				y: s[2] + (c[2] - s[2]) * t,
				nx: g.x,
				nz: g.z,
				along: a + d * t
			});
		}
		a += d;
	}
	let o = e.at(-1), s = r.at(-1);
	return i.push({
		x: o[0],
		z: o[1],
		y: o[2],
		nx: s.x,
		nz: s.z,
		along: a
	}), i;
}
function ae(e, t, n) {
	let r = Infinity;
	for (let i = 0; i < n.length - 1; i++) {
		let a = n[i], o = n[i + 1], s = o[0] - a[0], c = o[1] - a[1], l = Math.max(0, Math.min(1, ((e - a[0]) * s + (t - a[1]) * c) / (s * s + c * c)));
		r = Math.min(r, Math.hypot(e - a[0] - s * l, t - a[1] - c * l));
	}
	return r;
}
function oe(e, t = .9) {
	let n = ie(w[e], t), r = [];
	n.at(-1).along;
	for (let t of [-1, 1]) {
		let i = [];
		for (let a = 0; a < n.length - 1; a++) {
			let o = n[a], s = n[a + 1], c = {
				x: o.x + o.nx * t * E,
				z: o.z + o.nz * t * E,
				y: o.y,
				along: o.along
			}, l = {
				x: s.x + s.nx * t * E,
				z: s.z + s.nz * t * E,
				y: s.y,
				along: s.along
			}, u = (c.x + l.x) / 2, d = (c.z + l.z) / 2, f = (c.along + l.along) / 2 < 2.4, p = D.some((e) => Math.abs(u - e.x) < e.hx + .3 && Math.abs(d - e.z) < e.hz + .3), m = w.some((t, n) => n !== e && ae(u, d, t) < 2.6100000000000003);
			!f && !p && !m ? (i.length || i.push(c), i.push(l)) : i.length && (i.length > 1 && r.push({
				routeIndex: e,
				side: t,
				points: i
			}), i = []);
		}
		i.length > 1 && r.push({
			routeIndex: e,
			side: t,
			points: i
		});
	}
	return r;
}
function se(e, t) {
	let n = Infinity, r = null, i = 0;
	for (let a = 0; a < w.length; a++) {
		let o = w[a];
		for (let s = 0; s < o.length - 1; s++) {
			let c = o[s], l = o[s + 1], u = l[0] - c[0], d = l[1] - c[1], f = Math.hypot(u, d), p = Math.max(0, Math.min(1, ((e - c[0]) * u + (t - c[1]) * d) / (f * f))), m = c[0] + u * p, h = c[1] + d * p, g = Math.hypot(e - m, t - h);
			g < n && (n = g, r = {
				distance: g,
				y: c[2] + (l[2] - c[2]) * p,
				x: m,
				z: h,
				trail: a,
				segment: s,
				t: p,
				along: i + f * p
			}), i += f;
		}
	}
	return r;
}
function ce(e, t) {
	let n = se(e, t).distance;
	for (let r of D) n = Math.min(n, Math.hypot(Math.max(0, Math.abs(e - r.x) - r.hx), Math.max(0, Math.abs(t - r.z) - r.hz)));
	return n;
}
//#endregion
//#region src/world/heightfield.ts
var O = {
	size: 170,
	terrainSegments: 180,
	center: [0, 0],
	temple: {
		x: S.x,
		z: S.z
	},
	platform: {
		x0: -36,
		x1: 28,
		z0: -48,
		z1: 46,
		y: 3.25
	},
	pond: {
		x: 18,
		z: 66,
		r: 15,
		y: .55
	},
	bridge: {
		x: 36,
		z: 28
	}
}, k = [
	[46, -120],
	[43, -82],
	[40, -48],
	[37, -16],
	[36, 10],
	[35, 28],
	[31, 44],
	[24, 56],
	[18, 66]
], le = (() => {
	let e = [];
	for (let t = 0; t < k.length - 1; t++) {
		let n = k[t], r = k[t + 1];
		for (let t = 0; t < 12; t++) e.push([f(n[0], r[0], t / 12), f(n[1], r[1], t / 12)]);
	}
	return e.push(k[k.length - 1]), e;
})(), ue = [
	[-2, 46],
	[-2, 56],
	[4, 63],
	[14, 68],
	[24, 64],
	[31, 56],
	[34, 46],
	[34, 36],
	[36, 28]
];
function de(e, t) {
	let { d: n, t: r, i } = x(e, t, k);
	return {
		d: n,
		t: d((i + r) / (k.length - 1), 0, 1)
	};
}
function fe(e) {
	return f(2.8, 7.2, e ** .7);
}
function pe(e) {
	return f(6.3, .55, d(e, 0, 1) ** .82);
}
function me(e, t) {
	return Math.hypot(e - O.pond.x, t - O.pond.z) - O.pond.r;
}
function he(e, t) {
	let { d: n, t: r } = de(e, t), i = n - fe(r), a = me(e, t);
	return Math.min(i, a);
}
var ge = O.pond.y;
function _e(e, t, n, r, i, a, o) {
	let s = Math.max(n - e, e - i, 0), c = Math.max(r - t, t - a, 0);
	return p(0, o, Math.hypot(s, c));
}
function ve(e, t) {
	return 1.55 + .22 * b(e * .045, t * .045, 3) + .07 * b(e * .18 + 4.2, t * .18 - 2.1, 2);
}
function A(e, t) {
	let n = ve(e, t), r = O.platform, i = _e(e, t, r.x0, r.z0, r.x1, r.z1, 13);
	n = f(r.y + .04 * b(e * .12, t * .12, 2), n, i);
	let a = x(e, t, ue).d;
	if (a < 5 && he(e, t) > .8) {
		let e = p(.9, 4.5, a);
		n = f(Math.max(n, r.y - .7), n, e);
	}
	let { d: o, t: s } = de(e, t), c = fe(s), l = pe(s) - .85 - .25 * b(e * .2, t * .2, 2), u = p(c * .55, c * 1.9 + 2.5, o);
	n = f(Math.min(n, l), n, u);
	let d = me(e, t);
	if (d < 12) {
		let r = O.pond.y - 1.5 - .8 * b(e * .09 + 8, t * .09 - 3, 3);
		n = f(Math.min(n, r), n, p(-2, 11, d));
	}
	let m = re, h = _e(e, t, m.x0, m.z0, m.x1, m.z1, 7);
	n = f(r.y, n, h);
	let g = se(e, t), _ = 1 - p(ee, te, g.distance);
	_ > 0 && (n = f(n, O.platform.y + g.y, _));
	for (let r of D) {
		let i = Math.hypot(Math.max(0, Math.abs(e - r.x) - r.hx), Math.max(0, Math.abs(t - r.z) - r.hz)), a = i > 0 && g.distance < 4.9 && g.y < r.y - .8;
		i < 4 && !a && (n = f(O.platform.y + r.y, n, p(0, 4, i)));
	}
	return n;
}
function ye(e, t, n) {
	let r = A(e, t), i = O.platform, a = re, o = e > i.x0 && e < i.x1 && t > i.z0 && t < i.z1, s = e > a.x0 && e < a.x1 && t > a.z0 && t < a.z1;
	if (o || s) return Math.min(r, i.y - .14);
	let c = se(e, t);
	if (c.distance > 2.45 + n) return r;
	let l = Infinity;
	for (let n of [
		-1.4,
		0,
		1.4
	]) for (let r of [
		-1.4,
		0,
		1.4
	]) {
		let i = se(e + n, t + r);
		i.distance < 2.6500000000000004 && (l = Math.min(l, O.platform.y + i.y));
	}
	if (!Number.isFinite(l)) return r;
	let u = d((T + n - c.distance) / n, 0, 1);
	return Math.max(r - .42 * u, Math.min(r, l - .06));
}
function be(e, t, n = O.terrainSegments) {
	let r = O.size / n, i = O.size / 2, a = (e + i) / r, o = (t + i) / r, s = Math.floor(a), c = Math.floor(o), l = a - s, u = o - c, d = -i + s * r, f = -i + c * r, p = ye(d, f, r), m = ye(d + r, f, r), h = ye(d, f + r, r), g = ye(d + r, f + r, r);
	return l + u <= 1 ? p * (1 - l - u) + m * l + h * u : g * (l + u - 1) + m * (1 - u) + h * (1 - l);
}
function xe(e, t, n = 1.2) {
	let r = A(e + n, t) - A(e - n, t), i = A(e, t + n) - A(e, t - n), a = -r, o = 2 * n, s = -i, c = Math.hypot(a, o, s) || 1;
	return [
		a / c,
		o / c,
		s / c
	];
}
function Se(e, t, n = 1.2) {
	return 1 - xe(e, t, n)[1];
}
function Ce(e, t, n = 0) {
	let r = O.platform;
	return e > r.x0 - n && e < r.x1 + n && t > r.z0 - n && t < r.z1 + n;
}
function we(e, t, n = 0) {
	let r = O.size / 2 - n;
	return r > 0 && Math.abs(e) <= r && Math.abs(t) <= r;
}
function Te(e, t) {
	return Math.min(x(e, t, ue).d, ce(e, t));
}
//#endregion
//#region src/world/terrain_baked.ts
function Ee(e, t, n, r, i, a, o) {
	let s = d((b(e * .045, n * .045) + 1) * .5, 0, 1), c = d((b(e * .22 + 7.3, n * .22 + 7.3) + 1) * .5, 0, 1), l = [
		f(.055, .135, s * .7 + c * .3),
		f(.082, .17, s * .7 + c * .3),
		f(.032, .062, s * .7 + c * .3)
	], u = (e, t) => {
		for (let n = 0; n < 3; n++) l[n] = f(l[n], e[n], d(t, 0, 1));
	};
	u([
		.12 + c * .08,
		.09 + c * .07,
		.06 + c * .05
	], p(.42, .82, s) * .34), u([
		.26 + s * .16,
		.255 + s * .15,
		.225 + s * .12
	], p(.13, .56, r)), u([
		.078,
		.095,
		.057
	], (1 - p(0, 2.2, a)) * .72);
	let m = Math.abs(e + 3) < 30 && Math.abs(n) < 44 && Math.abs(t - O.platform.y) < .55, h = .32 + _(Math.floor(e / 1.35), Math.floor(n / .78)) * .14;
	u([
		h,
		h * .99,
		h * .91
	], Math.max(+!!m, 1 - p(.15, .55, i)) * (1 - p(.5, .9, r)));
	let g = (1 - p(.43, .73, (b(e * .011 + 3.2, n * .011 + 3.2) + 1) * .5) * .21) * f(.62, 1, o);
	for (let e = 0; e < 3; e++) l[e] *= g;
	return l;
}
var j = null, De = null, Oe = null, ke = null, Ae = null;
function je() {
	if (Ae) return Ae;
	let t = new e.TextureLoader(), n = async (n, r) => {
		let i = new URL(`./assets/lingyin/runtime-textures/${n}.webp`, document.baseURI).href + "?v=1", a = await t.loadAsync(i);
		return a.name = `lingyin-${n}`, a.colorSpace = r ? e.SRGBColorSpace : e.NoColorSpace, a.wrapS = a.wrapT = e.RepeatWrapping, a.repeat.set(1 / 2.8, 1 / 2.8), a.minFilter = e.LinearMipmapLinearFilter, a.magFilter = e.LinearFilter, a.anisotropy = 8, a;
	};
	return Ae = Promise.all([n("forest-ground-albedo", !0), n("forest-ground-normal", !1)]).then(([e, t]) => {
		Oe = e, ke = t;
	}), Ae;
}
function Me() {
	if (Oe && ke) return new e.MeshStandardMaterial({
		name: "terrain-scanned-forest-floor",
		map: Oe,
		normalMap: ke,
		normalScale: new e.Vector2(.29, .29),
		color: new e.Color().setRGB(1.38, 1.38, 1.38),
		vertexColors: !0,
		roughness: .97,
		metalness: 0
	});
	if (!j) {
		let t = document.createElement("canvas");
		t.width = t.height = 512;
		let n = t.getContext("2d"), r = n.createImageData(512, 512), i = new Float32Array(512 * 512);
		for (let e = 0; e < 512; e++) for (let t = 0; t < 512; t++) {
			let n = b(t * .035, e * .035, 3), a = _(t, e) - .5, o = d(.91 + n * .075 + a * .065, .77, 1);
			i[e * 512 + t] = o;
			let s = (e * 512 + t) * 4;
			r.data[s] = Math.round(o * 255), r.data[s + 1] = Math.round(o * 253), r.data[s + 2] = Math.round(o * 247), r.data[s + 3] = 255;
		}
		n.putImageData(r, 0, 0), j = new e.CanvasTexture(t), j.name = "terrain-baked-grain", j.colorSpace = e.SRGBColorSpace, j.wrapS = j.wrapT = e.RepeatWrapping, j.repeat.set(1 / 3, 1 / 3), j.minFilter = e.LinearMipmapLinearFilter, j.magFilter = e.LinearFilter, j.anisotropy = 8;
		let a = document.createElement("canvas");
		a.width = a.height = 512;
		let o = a.getContext("2d"), s = o.createImageData(512, 512), c = (e, t) => i[(t + 512 & 511) * 512 + (e + 512 & 511)];
		for (let e = 0; e < 512; e++) for (let t = 0; t < 512; t++) {
			let n = (c(t + 1, e) - c(t - 1, e)) * 1.9, r = (c(t, e + 1) - c(t, e - 1)) * 1.9, i = 1 / Math.hypot(n, r, 1), a = (e * 512 + t) * 4;
			s.data[a] = Math.round((-.5 * n * i + .5) * 255), s.data[a + 1] = Math.round((-.5 * r * i + .5) * 255), s.data[a + 2] = Math.round((.5 * i + .5) * 255), s.data[a + 3] = 255;
		}
		o.putImageData(s, 0, 0), De = new e.CanvasTexture(a), De.name = "terrain-baked-normal", De.wrapS = De.wrapT = e.RepeatWrapping, De.repeat.copy(j.repeat), De.minFilter = e.LinearMipmapLinearFilter, De.magFilter = e.LinearFilter, De.anisotropy = 8;
	}
	return new e.MeshStandardMaterial({
		name: "terrain-baked-pbr",
		map: j,
		normalMap: De,
		normalScale: new e.Vector2(.7, .7),
		vertexColors: !0,
		roughness: .91,
		metalness: 0
	});
}
//#endregion
//#region src/world/terrain.ts
var Ne = class {
	group = new e.Group();
	mesh;
	material;
	constructor(t = 1, n = !1) {
		let r = O.size, i = Math.round(O.terrainSegments * d(t, .5, 1)), a = r / 2, o = i + 1, s = new Float32Array(o * o * 3), c = new Float32Array(o * o * 2), l = new Float32Array(o * o * 3), u = [], f = r / i;
		for (let e = 0; e < o; e++) {
			let t = -a + e * f;
			for (let n = 0; n < o; n++) {
				let r = -a + n * f, i = ye(r, t, f), u = e * o + n;
				s[u * 3] = r, s[u * 3 + 1] = i, s[u * 3 + 2] = t, c[u * 2] = r, c[u * 2 + 1] = t;
				let p = 1 - xe(r, t, 1.4)[1], m = 0;
				m += A(r + 3, t), m += A(r - 3, t), m += A(r, t + 3), m += A(r, t - 3);
				let h = d((m / 4 - i) / 3.5, -.4, 1), g = Ee(r, i, t, p, d(Te(r, t) / 6, 0, 1), d(he(r, t), -4, 18), d(.35 + p * .9 - h * .55, 0, 1));
				l[u * 3] = g[0], l[u * 3 + 1] = g[1], l[u * 3 + 2] = g[2];
			}
		}
		for (let e = 0; e < i; e++) for (let t = 0; t < i; t++) {
			let r = -a + t * f, i = -a + e * f, s = O.platform;
			if (n && (r > s.x0 + 1.2 && r + f < s.x1 - 1.2 && i > s.z0 + 1.7 && i + f < s.z1 - 1.05 || r > -23.5 && r + f < 19.5 && i > 46 && i + f < 74)) continue;
			let c = e * o + t, l = c + 1, d = c + o, p = d + 1;
			u.push(c, d, l, l, d, p);
		}
		let p = new e.BufferGeometry();
		p.setAttribute("position", new e.BufferAttribute(s, 3)), p.setAttribute("uv", new e.BufferAttribute(c, 2)), p.setAttribute("color", new e.BufferAttribute(l, 3)), p.setIndex(u), p.computeVertexNormals(), p.computeBoundingSphere(), this.material = Me(), this.mesh = new e.Mesh(p, this.material), this.mesh.name = "terrain", this.mesh.receiveShadow = !0, this.mesh.castShadow = !1, this.group.add(this.mesh);
	}
};
//#endregion
//#region src/world/geom.ts
function Pe(t) {
	if (!t.getAttribute("uv")) {
		let n = t.getAttribute("position").count;
		t.setAttribute("uv", new e.BufferAttribute(new Float32Array(n * 2), 2));
	}
	return t;
}
function M(t, n, r, i = 0, a = 0, o = 0, s = 0) {
	let c = new e.BoxGeometry(t, n, r);
	return s && c.rotateY(s), c.translate(i, a, o), Pe(c);
}
function N(t, n, r, i, a = 0, o = 0, s = 0) {
	let c = new e.CylinderGeometry(t, n, r, i, 1, !1);
	return c.translate(a, o, s), Pe(c);
}
function P(e) {
	let n = e.filter((e) => e && e.getAttribute("position")?.count), r = n.every((e) => e.index !== null), i = t(n.map((e) => Pe(r ? e : e.index ? e.toNonIndexed() : e)), !1);
	if (!i) throw Error("merge failed");
	return i.computeBoundingSphere(), i;
}
function F(t, n) {
	let r = t.index ? t.toNonIndexed() : t, i = r.getAttribute("position"), a = r.getAttribute("normal"), o = new Float32Array(i.count * 2);
	for (let e = 0; e < i.count; e += 3) {
		let t = Math.abs(a.getX(e) + a.getX(e + 1) + a.getX(e + 2)), r = Math.abs(a.getY(e) + a.getY(e + 1) + a.getY(e + 2)), s = Math.abs(a.getZ(e) + a.getZ(e + 1) + a.getZ(e + 2));
		for (let a = e; a < e + 3; a++) {
			let e = i.getX(a), c = i.getY(a), l = i.getZ(a), u = r > t && r > s ? e : t > s ? l : e, d = r > t && r > s ? l : c;
			o[a * 2] = u / n, o[a * 2 + 1] = d / n;
		}
	}
	return r.setAttribute("uv", new e.BufferAttribute(o, 2)), r;
}
function Fe(t) {
	let { w: n, d: r, eaveY: i, rise: a } = t, o = t.overhang ?? 1.1, s = t.cornerLift ?? .85, c = t.ridgeFrac ?? .52, l = t.nu ?? 40, u = t.nv ?? 18, d = n / 2 + o, f = r / 2 + o, p = n * c / 2, m = [], h = [], g = [], _ = Math.hypot(f, a), v = (e, t, n) => {
		let r = m.length / 3;
		for (let r = 0; r <= u; r++) {
			let i = r / u;
			for (let r = 0; r <= l; r++) {
				let a = r / l, [o, s, c] = e(a, i);
				m.push(o, s, c), h.push((a - .5) * t, i * n);
			}
		}
		for (let e = 0; e < u; e++) for (let t = 0; t < l; t++) {
			let n = r + e * (l + 1) + t, i = n + 1, a = n + l + 1, o = a + 1;
			g.push(n, a, i, i, a, o);
		}
	}, y = (e, t) => {
		let n = (Math.abs(e - .5) * 2) ** 5 * (1 - t) ** 2.1 * s;
		return i + a * t ** 1.32 + n;
	};
	for (let e of [1, -1]) v((t, n) => {
		let r = (t - .5) * 2 * (d * (1 - n) + p * n), i = e * f * (1 - n) ** .94;
		return [
			r,
			y(t, n),
			i
		];
	}, d * 2, _);
	for (let e of [1, -1]) v((t, n) => {
		let r = e * (d * (1 - n) + p * n), i = (t - .5) * 2 * f * (1 - n);
		return [
			r,
			y(t, n),
			i
		];
	}, f * 2, _);
	let b = new e.BufferGeometry();
	return b.setAttribute("position", new e.Float32BufferAttribute(m, 3)), b.setAttribute("uv", new e.Float32BufferAttribute(h, 2)), b.setIndex(g), b.computeVertexNormals(), b.computeBoundingSphere(), b;
}
function Ie(t) {
	let { wOuter: n, dOuter: r, wInner: i, dInner: a, eaveY: o, rise: s } = t, c = t.cornerLift ?? .7, l = t.nu ?? 40, u = t.nv ?? 10, d = n / 2, f = r / 2, p = i / 2, m = a / 2, h = [], g = [], _ = [], v = (e, t) => {
		let n = h.length / 3;
		for (let n = 0; n <= u; n++) {
			let r = n / u;
			for (let n = 0; n <= l; n++) {
				let i = n / l, [a, o, s] = e(i, r);
				h.push(a, o, s), g.push((i - .5) * t, r * 4.2);
			}
		}
		for (let e = 0; e < u; e++) for (let t = 0; t < l; t++) {
			let r = n + e * (l + 1) + t, i = r + 1, a = r + l + 1, o = a + 1;
			_.push(r, a, i, i, a, o);
		}
	}, y = (e, t) => o + s * t ** 1.18 + (Math.abs(e - .5) * 2) ** 4 * (1 - t) ** 2 * c;
	for (let e of [1, -1]) v((t, n) => {
		let r = (t - .5) * 2 * (d * (1 - n) + p * n), i = e * (f * (1 - n) + m * n);
		return [
			r,
			y(t, n),
			i
		];
	}, d * 2);
	for (let e of [1, -1]) v((t, n) => {
		let r = e * (d * (1 - n) + p * n), i = (t - .5) * 2 * (f * (1 - n) + m * n);
		return [
			r,
			y(t, n),
			i
		];
	}, f * 2);
	let b = new e.BufferGeometry();
	return b.setAttribute("position", new e.Float32BufferAttribute(h, 3)), b.setAttribute("uv", new e.Float32BufferAttribute(g, 2)), b.setIndex(_), b.computeVertexNormals(), b.computeBoundingSphere(), b;
}
function Le(t, n, r, i, a) {
	let o = new e.Shape();
	o.moveTo(-t / 2, 0), o.lineTo(t / 2, 0), o.lineTo(t / 2, n), o.lineTo(-t / 2, n), o.lineTo(-t / 2, 0);
	let s = new e.Path();
	s.moveTo(-i, .2), s.lineTo(-i, a), s.absarc(0, a, i, Math.PI, 0, !0), s.lineTo(i, .2), s.lineTo(-i, .2), o.holes.push(s);
	let c = new e.ExtrudeGeometry(o, {
		depth: r,
		bevelEnabled: !1,
		curveSegments: 16
	});
	return c.translate(0, 0, -r / 2), Pe(c);
}
function Re(e, t, n = .19, r = .055, i = 0) {
	let a = [];
	for (let o = -e / 2; o <= e / 2 + .001; o += n) a.push(M(r, t, .06, o, t / 2, i));
	for (let o = 0; o <= t + .001; o += n * 1.35) a.push(M(e, r, .055, 0, o, i));
	return {
		bars: P(a),
		backing: M(e, t, .04, 0, t / 2, i - .06)
	};
}
function ze(t, n = 512, r = 160, i = {}) {
	let a = document.createElement("canvas");
	a.width = n, a.height = r;
	let o = a.getContext("2d");
	if (!o) throw Error("no 2d context");
	o.fillStyle = i.bg ?? "#221a14", o.fillRect(0, 0, n, r), i.border && (o.strokeStyle = i.border, o.lineWidth = 6, o.strokeRect(8, 8, n - 16, r - 16)), o.fillStyle = i.fg ?? "#d8b268", o.font = `600 ${Math.floor(r * .56)}px "Songti SC", "STSong", "Noto Serif SC", serif`, o.textAlign = "center", o.textBaseline = "middle", o.fillText(t, n / 2, r / 2 + 3);
	let s = new e.CanvasTexture(a);
	return s.colorSpace = e.SRGBColorSpace, s.anisotropy = 4, s;
}
//#endregion
//#region src/world/materials.ts
var Be = null, Ve = null, He = null, I = null, L = null, Ue = {}, We = null, Ge = /* @__PURE__ */ new Map(), Ke = [
	"courtyard-albedo",
	"courtyard-normal",
	"courtyard-roughness",
	"roof-albedo",
	"roof-normal",
	"plaster-albedo",
	"plaster-normal",
	"plaster-roughness",
	"stone-albedo",
	"stone-normal",
	"stone-roughness",
	"wood-albedo",
	"wood-red-albedo",
	"wood-teal-albedo",
	"wood-normal",
	"wood-roughness",
	"plaque-gate",
	"plaque-main"
];
Ke.filter((e) => !e.startsWith("courtyard-") && e !== "plaque-gate");
function qe(t) {
	let n = Ge.get(t);
	if (n) return n;
	let r = new URL(`./assets/lingyin/temple-textures/${t}.webp`, document.baseURI).href + "?v=3", i = new e.TextureLoader().loadAsync(r).then((n) => {
		n.name = `lingyin-${t}`, n.colorSpace = t.endsWith("albedo") || t.startsWith("plaque-") ? e.SRGBColorSpace : e.NoColorSpace, n.wrapS = n.wrapT = t.startsWith("plaque-") ? e.ClampToEdgeWrapping : e.RepeatWrapping, n.minFilter = e.LinearMipmapLinearFilter, n.magFilter = e.LinearFilter, n.anisotropy = 16, Ue[t] = n;
	});
	return Ge.set(t, i), i;
}
function Je() {
	return We || (We = Promise.all(Ke.map(qe)).then(() => {}), We);
}
function Ye(e) {
	return Ue[`plaque-${e}`];
}
var Xe = null;
function Ze() {
	if (Xe) return Xe;
	let t = Ue["courtyard-albedo"], n = Ue["courtyard-normal"], r = Ue["courtyard-roughness"];
	if (!t || !n || !r) throw Error("Lingyin courtyard maps must be preloaded");
	for (let e of [
		t,
		n,
		r
	]) e.repeat.set(48 / 5.1, 32 / 5.1);
	return Xe = new e.MeshStandardMaterial({
		name: "courtyard-photogrammetry",
		map: t,
		normalMap: n,
		roughnessMap: r,
		color: 15656146,
		normalScale: new e.Vector2(.43, .43),
		roughness: .94,
		metalness: 0
	}), Xe;
}
function Qe(e, t) {
	let n = Ze().clone();
	n.name = "courtyard-photogrammetry-extension";
	for (let r of [
		"map",
		"normalMap",
		"roughnessMap"
	]) {
		let i = n[r];
		if (!i) continue;
		let a = i.clone();
		a.repeat.set(e / 5.1, t / 5.1), a.needsUpdate = !0, n[r] = a;
	}
	return n;
}
function $e(t, n, r, i, a, o) {
	let s = Ue[n];
	return s ? new e.MeshStandardMaterial({
		name: t,
		map: s,
		normalMap: Ue[r],
		normalScale: new e.Vector2(o, o),
		roughnessMap: Ue[i],
		roughness: a,
		metalness: 0
	}) : null;
}
function et(e, t = !1) {
	let n = $e(`gate-photographic-${e}${t ? "-dark" : ""}`, e === "wood" ? "wood-albedo" : "plaster-albedo", e === "wood" ? "wood-normal" : "plaster-normal", e === "wood" ? "wood-roughness" : "plaster-roughness", .94, e === "wood" ? .22 : .2);
	return n && n.color.set(e === "plaster" ? "#b9a276" : t ? "#978575" : "#b39a80"), n;
}
function tt() {
	if (He) return He;
	let t = document.createElement("canvas");
	t.width = t.height = 256;
	let n = t.getContext("2d"), r = n.createImageData(256, 256), i = 1919509349, a = () => ((i = Math.imul(i, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
	for (let e = 0; e < 256; e++) for (let t = 0; t < 256; t++) {
		let n = Math.sin(t * .36 + e * .015) * .012, i = Math.max(.78, Math.min(.96, .88 + (a() - .5) * .065 + n)), o = (e * 256 + t) * 4;
		r.data[o] = Math.round(i * 255), r.data[o + 1] = Math.round(i * 248), r.data[o + 2] = Math.round(i * 230), r.data[o + 3] = 255;
	}
	return n.putImageData(r, 0, 0), He = new e.CanvasTexture(t), He.colorSpace = e.SRGBColorSpace, He.wrapS = He.wrapT = e.RepeatWrapping, He.minFilter = e.LinearMipmapLinearFilter, He.magFilter = e.LinearFilter, He.anisotropy = 8, He;
}
function nt() {
	if (Ve) return Ve;
	let t = document.createElement("canvas");
	t.width = t.height = 512;
	let n = t.getContext("2d"), r = n.createImageData(512, 512), i = 44444561, a = () => ((i = Math.imul(i, 1664525) + 1013904223 | 0) >>> 0) / 4294967296, o = new Float32Array(1024);
	for (let e = 0; e < o.length; e++) o[e] = a();
	let s = (e, t) => {
		let n = e / 16, r = t / 16, i = Math.floor(n), a = Math.floor(r), s = (n - i) ** 2 * (3 - 2 * (n - i)), c = (r - a) ** 2 * (3 - 2 * (r - a)), l = (e, t) => o[Math.min(31, t) * 32 + Math.min(31, e)];
		return (l(i, a) * (1 - s) + l(i + 1, a) * s) * (1 - c) + (l(i, a + 1) * (1 - s) + l(i + 1, a + 1) * s) * c;
	};
	for (let e = 0; e < 512; e++) for (let t = 0; t < 512; t++) {
		let n = s(t, e), i = a() - .5, o = Math.max(.57, Math.min(.96, .75 + n * .15 + i * .07)), c = (e * 512 + t) * 4, l = Math.round(o * 255);
		r.data[c] = r.data[c + 1] = r.data[c + 2] = l, r.data[c + 3] = 255;
	}
	return n.putImageData(r, 0, 0), Ve = new e.CanvasTexture(t), Ve.colorSpace = e.SRGBColorSpace, Ve.wrapS = Ve.wrapT = e.RepeatWrapping, Ve.minFilter = e.LinearMipmapLinearFilter, Ve.magFilter = e.LinearFilter, Ve.anisotropy = 8, Ve;
}
function rt() {
	if (Be) return Be;
	let t = document.createElement("canvas");
	t.width = t.height = 512;
	let n = t.getContext("2d"), r = n.createImageData(512, 512), i = 6396596, a = () => ((i = Math.imul(i, 1664525) + 1013904223 | 0) >>> 0) / 4294967296, o = new Float32Array(4096);
	for (let e = 0; e < o.length; e++) o[e] = a();
	let s = new Float32Array(256);
	for (let e = 0; e < s.length; e++) s[e] = a();
	let c = (e, t, n, r) => e[Math.min(t - 1, r) * t + Math.min(t - 1, n)], l = (e) => e * e * (3 - 2 * e), u = (e, t, n, r) => {
		let i = Math.floor(n), a = Math.floor(r), o = l(n - i), s = l(r - a);
		return (c(e, t, i, a) * (1 - o) + c(e, t, i + 1, a) * o) * (1 - s) + (c(e, t, i, a + 1) * (1 - o) + c(e, t, i + 1, a + 1) * o) * s;
	};
	for (let e = 0; e < 512; e++) for (let t = 0; t < 512; t++) {
		let n = t / 8, i = e / 8, l = Math.floor(n), d = Math.floor(i), f = (n - l) ** 2 * (3 - 2 * (n - l)), p = (i - d) ** 2 * (3 - 2 * (i - d)), m = (c(o, 64, l, d) * (1 - f) + c(o, 64, l + 1, d) * f) * (1 - p) + (c(o, 64, l, d + 1) * (1 - f) + c(o, 64, l + 1, d + 1) * f) * p, h = u(s, 16, t / 32, e / 32), g = a() - .5, _ = Math.min(t, 511 - t, e, 511 - e), v = (1 - Math.min(1, _ / 27)) * .105, y = Math.max(0, h - .57) * .13, b = Math.max(.45, Math.min(.86, .63 + m * .13 + (h - .5) * .085 + g * .048 - v - y)), x = (e * 512 + t) * 4;
		r.data[x] = Math.round(b * 217), r.data[x + 1] = Math.round(b * 212), r.data[x + 2] = Math.round(b * 199), r.data[x + 3] = 255;
	}
	n.putImageData(r, 0, 0);
	let d = new e.CanvasTexture(t);
	return d.colorSpace = e.SRGBColorSpace, d.wrapS = d.wrapT = e.RepeatWrapping, d.minFilter = e.LinearMipmapLinearFilter, d.magFilter = e.LinearFilter, d.anisotropy = 8, Be = new e.MeshStandardMaterial({
		name: "weathered-stone-slabs",
		map: d,
		bumpMap: d,
		bumpScale: .048,
		roughness: .94,
		metalness: 0,
		vertexColors: !0
	}), Be;
}
function it(t, n) {
	let r = t.getAttribute("position").count, i = new Float32Array(r * 3);
	for (let e = 0; e < r; e++) {
		let t = n * (.96 + e % 3 * .04);
		i[e * 3] = t, i[e * 3 + 1] = t * .992, i[e * 3 + 2] = t * .978;
	}
	return t.setAttribute("color", new e.BufferAttribute(i, 3)), t;
}
function R(e = 0) {
	return at(e) || o({
		name: "stone",
		params: {
			color: 16777215,
			roughness: .9,
			metalness: 0
		},
		uniforms: { uWarm: { value: e } },
		head: "uniform float uWarm;",
		color: "\n      float n = cgFbm3(cgP * vec3(.52,.43,.52));\n      float fine = cgNoise3(cgP * 5.8);\n      float quartz = smoothstep(.73,.9,cgNoise3(cgP * 19.0));\n      vec3 base = mix(vec3(.235,.234,.225),vec3(.425,.412,.385),n*.86+fine*.14);\n      base = mix(base,base*vec3(1.10,1.04,.93),uWarm*.55);\n      base += quartz*.019;\n      // Water-darkened joints, fine mineral deposits and moss on top faces.\n      float streak = smoothstep(.57,.78,cgNoise2(vec2(cgP.x*.8+cgP.z*.33,cgP.y*.18)));\n      base *= 1.0-streak*.22;\n      float moss=smoothstep(.57,.76,cgFbm2(cgP.xz*.87+4.0))*smoothstep(.43,.91,cgN.y);\n      base=mix(base,vec3(.145,.18,.105),moss*.42);\n      base*=.87+.20*smoothstep(.1,.9,cgN.y);\n      diffuseColor.rgb = base;\n    ",
		normal: "\n      float h0=cgNoise3(cgP*6.0);\n      cgBump=vec3(h0-cgNoise3(cgP*6.0+vec3(.13,0,0)),\n                  h0-cgNoise3(cgP*6.0+vec3(0,.13,0)),\n                  h0-cgNoise3(cgP*6.0+vec3(0,0,.13)))*.25;\n    ",
		roughness: "\n      roughnessFactor = .82+.15*cgNoise3(cgP*2.3);\n    "
	});
}
function at(e = 0) {
	let t = $e("stone-photogrammetry", "stone-albedo", "stone-normal", "stone-roughness", .96, .32);
	return t && t.color.set(e > .5 ? 14076600 : 16777215), t;
}
function ot() {
	let e = $e("bark-photogrammetry", "wood-albedo", "wood-normal", "wood-roughness", .97, .42);
	return e && (e.color.set(11709588), e.vertexColors = !0), e;
}
function st() {
	let t = Ue["roof-albedo"], n = Ue["roof-normal"];
	if (t && n) return t.repeat.set(1 / 5, 1 / 5), n.repeat.set(1 / 5, 1 / 5), new e.MeshStandardMaterial({
		name: "roof-tile-photogrammetry",
		map: t,
		normalMap: n,
		normalScale: new e.Vector2(.28, .28),
		roughness: .86,
		metalness: .02,
		side: e.DoubleSide
	});
	if (!I) {
		let t = document.createElement("canvas");
		t.width = 768, t.height = 512;
		let n = t.getContext("2d"), r = n.createImageData(t.width, t.height), i = (e, t) => {
			let n = Math.imul(e + 31, 374761393) + Math.imul(t + 17, 668265263);
			return n = Math.imul(n ^ n >>> 13, 1274126177), ((n ^ n >>> 16) >>> 0) / 4294967296;
		};
		for (let e = 0; e < t.height; e++) for (let n = 0; n < t.width; n++) {
			let a = n / 64, o = e / 64, s = a - Math.floor(a), c = o - Math.floor(o), l = Math.sqrt(Math.max(0, 1 - (Math.abs(s - .5) * 2) ** 2)), u = Math.max(0, (Math.abs(c - .5) * 2 - .58) / .28), d = i(Math.floor(a), Math.floor(o)), f = i(Math.floor(a * 3), Math.floor(o * 3)), p = i(n, e) - .5, m = Math.max(0, i(Math.floor(a * .5), Math.floor(o * .5)) - .58) * (1 - l), h = (76 + l * 29 + d * 22 + (f - .5) * 18 + p * 13) * (1 - u * .27), g = (e * t.width + n) * 4;
			r.data[g] = Math.max(0, Math.min(255, h + m * 2)), r.data[g + 1] = Math.max(0, Math.min(255, h + 3 + m * 30)), r.data[g + 2] = Math.max(0, Math.min(255, h + 5 - m * 20)), r.data[g + 3] = 255;
		}
		n.putImageData(r, 0, 0), I = new e.CanvasTexture(t), I.name = "baked-weathered-roof-tiles", I.colorSpace = e.SRGBColorSpace, I.wrapS = I.wrapT = e.RepeatWrapping, I.repeat.set(1 / (12 * .34), 1 / (8 * .52)), I.minFilter = e.LinearMipmapLinearFilter, I.magFilter = e.LinearFilter, I.anisotropy = 8;
	}
	return new e.MeshStandardMaterial({
		name: "roof-tile-baked",
		map: I,
		bumpMap: I,
		bumpScale: .045,
		roughness: .82,
		metalness: .02,
		side: e.DoubleSide
	});
}
function ct() {
	let e = st();
	return e.name = "main-hall-weathered-red-roof", e.color.set(10178883), e.roughness = .91, e.metalness = 0, e.normalScale && e.normalScale.set(.36, .36), e;
}
function lt() {
	let e = ht();
	return e.name = "main-hall-cool-grey-plaster", e.color.set(12170669), e.roughness = 1, e.normalScale && e.normalScale.set(.24, .24), e;
}
function ut() {
	let e = R(0);
	return e.name = "main-hall-grey-stone-plinth", e.color.set(11119270), e.roughness = .98, e;
}
function dt(e = !1) {
	let t = gt(e);
	return t.name = e ? "main-hall-dark-red-joinery" : "main-hall-weathered-red-timber", t.color.set(e ? 10716535 : 14136229), t.roughness = e ? .9 : .86, t.normalScale && t.normalScale.set(.22, .22), t;
}
function ft() {
	if (L) return L;
	let t = document.createElement("canvas");
	t.width = 1024, t.height = 256;
	let n = t.getContext("2d");
	n.fillStyle = "#173f3d", n.fillRect(0, 0, t.width, t.height), n.fillStyle = "#102d2d", n.fillRect(0, 0, t.width, 26), n.fillRect(0, 230, t.width, 26), n.fillStyle = "#a87832", n.fillRect(0, 27, t.width, 8), n.fillRect(0, 221, t.width, 8);
	for (let e = 0; e < t.width; e += 128) n.save(), n.translate(e + 64, 128), n.rotate(Math.PI / 4), n.fillStyle = "#b68a42", n.fillRect(-35, -35, 70, 70), n.fillStyle = "#762f27", n.fillRect(-25, -25, 50, 50), n.fillStyle = "#1d5651", n.fillRect(-15, -15, 30, 30), n.restore(), n.strokeStyle = "#c49b56", n.lineWidth = 7, n.beginPath(), n.arc(e + 64, 128, 20, 0, Math.PI * 2), n.stroke();
	let r = 1296124238, i = () => ((r = Math.imul(r, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
	for (let e = 0; e < 4200; e++) {
		let e = i() * .1;
		n.fillStyle = `rgba(${i() > .5 ? 235 : 18},${i() > .5 ? 215 : 25},${i() > .5 ? 170 : 25},${e})`, n.fillRect(i() * t.width, i() * t.height, 1 + i() * 3, 1 + i() * 2);
	}
	return L = new e.CanvasTexture(t), L.name = "main-hall-painted-beam-pattern", L.colorSpace = e.SRGBColorSpace, L.wrapS = L.wrapT = e.RepeatWrapping, L.repeat.set(2.5, 1), L.minFilter = e.LinearMipmapLinearFilter, L.magFilter = e.LinearFilter, L.anisotropy = 8, L;
}
function pt() {
	let t = ft();
	return new e.MeshStandardMaterial({
		name: "main-hall-blue-green-painted-beams",
		map: t,
		bumpMap: t,
		bumpScale: .018,
		roughness: .88,
		metalness: .01
	});
}
function mt() {
	return new e.MeshStandardMaterial({
		name: "main-hall-dark-teal-window",
		color: 1191213,
		emissive: new e.Color(463121),
		emissiveIntensity: .03,
		roughness: .92
	});
}
function ht() {
	let e = $e("plaster-photogrammetry", "plaster-albedo", "plaster-normal", "plaster-roughness", .98, .18);
	if (e) return e;
	let t = nt();
	return o({
		name: "ochre-wall",
		params: {
			color: 16777215,
			map: t,
			bumpMap: t,
			bumpScale: .05,
			roughness: .86,
			metalness: 0
		},
		color: "\n      float n=cgFbm3(cgP*vec3(.56,.45,.56));\n      float fine=cgNoise3(cgP*3.9);\n      vec3 c=mix(vec3(.43,.38,.30),vec3(.63,.55,.43),n*.77+fine*.23);\n      float streak=smoothstep(.57,.78,cgNoise2(vec2(cgP.x*1.9+cgP.z*1.2,cgP.y*.13)));\n      c*=1.0-streak*.21;\n      float damp=1.0-smoothstep(3.2,4.7,cgO.y);\n      c=mix(c,vec3(.31,.29,.25),damp*.30);\n      float salt=smoothstep(.62,.77,cgFbm3(cgP*vec3(1.2,.65,1.2)));\n      c=mix(c,vec3(.67,.63,.55),salt*.16);\n      float pits=smoothstep(.69,.82,cgNoise3(cgP*5.6));\n      c*=1.0-pits*.08;\n      diffuseColor.rgb = c * mix(.88,1.12,diffuseColor.r);\n    ",
		normal: "\n      float grain=cgNoise3(cgP*5.0);\n      cgBump=vec3(grain-cgNoise3(cgP*5.0+vec3(.09,0,0)),\n                  grain-cgNoise3(cgP*5.0+vec3(0,.09,0)),\n                  grain-cgNoise3(cgP*5.0+vec3(0,0,.09)))*.25;\n    ",
		roughness: "roughnessFactor=.84+.13*cgNoise3(cgP*2.0);"
	});
}
function gt(e = !1) {
	return $e(e ? "aged-wood" : "red-lacquer-wood", e ? "wood-albedo" : "wood-red-albedo", "wood-normal", "wood-roughness", .82, .16) || o({
		name: e ? "wood-dark" : "wood-red",
		params: {
			color: 16777215,
			roughness: .52,
			metalness: 0
		},
		uniforms: { uDark: { value: +!!e } },
		head: "uniform float uDark;",
		color: "\n      float grain=cgFbm2(vec2(cgP.x*2.0+cgP.z*1.4,cgP.y*12.0));\n      float wear=cgFbm3(cgP*vec3(.36,.46,.36));\n      vec3 red=mix(vec3(.165,.044,.035),vec3(.29,.095,.07),grain*.70+.2);\n      vec3 darkw=mix(vec3(.063,.043,.035),vec3(.14,.092,.069),grain);\n      vec3 c = mix(red, darkw, uDark);\n      c=mix(c,c*vec3(.78,.82,.81),smoothstep(.58,.79,wear)*.39);\n      c*=.92+.17*smoothstep(.2,.9,cgN.y);\n      float fineGrain=smoothstep(.62,.84,cgNoise2(vec2(cgP.x*.9+cgP.z*.9,cgP.y*17.0)));\n      c*=1.0-fineGrain*.10;\n      diffuseColor.rgb = c;\n    ",
		roughness: "roughnessFactor = 0.46 + 0.14 * cgNoise2(cgP.xz * 4.0);"
	});
}
function _t() {
	return o({
		name: "gold",
		params: {
			color: 16777215,
			roughness: .42,
			metalness: .46,
			emissive: 3481610,
			emissiveIntensity: .12
		},
		color: "\n      float n = cgFbm2(cgP.xy * 3.0 + cgP.z * 2.0);\n      vec3 c = mix(vec3(0.50,0.33,0.10), vec3(0.95,0.72,0.32), n * 0.65 + 0.35);\n      diffuseColor.rgb = c;\n    ",
		roughness: "roughnessFactor = 0.30 + 0.18 * cgNoise2(cgP.xz * 5.0);"
	});
}
function vt() {
	return o({
		name: "buddha-aged-gilt",
		params: {
			color: 16777215,
			roughness: .72,
			metalness: .16,
			emissive: 3350797,
			emissiveIntensity: .12
		},
		color: "\n      float large = cgFbm2(cgP.xy * 2.7 + cgP.z * 1.2);\n      float grain = cgNoise2(cgP.xz * 18.0 + cgP.y * 9.0);\n      float wear = smoothstep(0.34, 0.78, large);\n      vec3 clay = vec3(0.34, 0.245, 0.125);\n      vec3 gilt = vec3(0.77, 0.595, 0.315);\n      vec3 c = mix(clay, gilt, 0.45 + wear * 0.43);\n      c *= 0.91 + grain * 0.13;\n      diffuseColor.rgb = c;\n    ",
		roughness: "roughnessFactor = 0.62 + 0.18 * cgNoise2(cgP.xz * 7.0 + cgP.y * 2.0);"
	});
}
function yt() {
	return o({
		name: "bronze",
		params: {
			color: 16777215,
			roughness: .6,
			metalness: .42
		},
		color: "\n      float n = cgFbm2(cgP.xy * 4.0 + cgP.z * 3.0);\n      vec3 c = mix(vec3(0.16,0.115,0.065), vec3(0.36,0.27,0.14), n);\n      float patina = smoothstep(0.58, 0.8, cgFbm2(cgP.xz * 2.2 + 9.0));\n      c = mix(c, vec3(0.14,0.22,0.17), patina * 0.55);\n      diffuseColor.rgb = c;\n    ",
		roughness: "roughnessFactor = 0.42 + 0.25 * cgNoise2(cgP.xz * 3.0);"
	});
}
function bt() {
	return $e("teal-painted-wood", "wood-teal-albedo", "wood-normal", "wood-roughness", .9, .12) || o({
		name: "dougong",
		params: {
			color: 16777215,
			roughness: .6,
			metalness: .02
		},
		color: "\n      float n = cgNoise2(cgP.xz * 5.0 + cgP.y * 2.0);\n      vec3 teal = mix(vec3(0.035,0.095,0.085), vec3(0.09,0.17,0.145), n);\n      float gold = smoothstep(0.75, 0.95, cgNoise2(cgP.xz * 9.0));\n      vec3 c = mix(teal, vec3(0.55,0.40,0.16), gold * 0.55);\n      diffuseColor.rgb = c;\n    "
	});
}
function xt() {
	return new e.MeshStandardMaterial({
		color: new e.Color("#2a1a0c"),
		emissive: new e.Color("#8a4a1e"),
		emissiveIntensity: .03,
		roughness: .9
	});
}
function St() {
	return new e.MeshStandardMaterial({
		color: new e.Color("#7e1e18"),
		emissive: new e.Color("#ff5a2a"),
		emissiveIntensity: .3,
		roughness: .7
	});
}
function Ct() {
	let e = at(.2);
	return e ? (e.name = "limestone-photogrammetry", e.color.set(11843493), e.vertexColors = !0, e) : o({
		name: "limestone-crag",
		params: {
			color: 16777215,
			roughness: .95,
			metalness: 0
		},
		color: "\n      float n = cgFbm2(cgP.xz * 0.09 + cgP.y * 0.06);\n      float fine = cgNoise2(cgP.xz * 0.9 + cgP.y * 0.35);\n      vec3 c = mix(vec3(0.10,0.105,0.10), vec3(0.29,0.285,0.26), n * 0.8 + fine * 0.2);\n      // vertical karst flutes / rain streaks\n      float flute = cgNoise2(vec2(cgP.x * 0.25 + cgP.z * 0.2, cgP.y * 0.035));\n      c *= 0.78 + 0.3 * smoothstep(0.2, 0.8, flute);\n      float streak = smoothstep(0.62, 0.9, cgNoise2(vec2(cgP.x * 1.3 + cgP.z * 0.7, cgP.y * 0.06)));\n      c *= 1.0 - streak * 0.35;\n      // moss and lichen on upward faces and in the damp crevices\n      float up = smoothstep(0.25, 0.85, cgN.y);\n      float moss = smoothstep(0.45, 0.72, cgFbm2(cgP.xz * 0.55 + cgP.y * 0.2));\n      c = mix(c, vec3(0.16,0.21,0.075), moss * (0.35 + up * 0.45));\n      c = mix(c, vec3(0.34,0.37,0.26), smoothstep(0.65, 0.85, cgNoise2(cgP.xz * 2.1)) * 0.3);\n      diffuseColor.rgb = c;\n    ",
		normal: "\n      float e = 0.08;\n      float h0 = cgFbm2(cgP.xz * 0.6 + cgP.y * 0.4);\n      float hx = cgFbm2((cgP.xz + vec2(e,0.0)) * 0.6 + cgP.y * 0.4);\n      float hz = cgFbm2((cgP.xz + vec2(0.0,e)) * 0.6 + cgP.y * 0.4);\n      cgBump = vec3(h0-hx, 0.0, h0-hz) * 0.9;\n    "
	});
}
//#endregion
//#region src/world/hillside.ts
var wt = O.platform.y, Tt = (t, n, r) => new e.Vector3(t, n, r);
function Et(t, n, r = .16, i = .14) {
	let a = n.clone().sub(t), o = new e.BoxGeometry(r, i, a.length());
	return o.applyQuaternion(new e.Quaternion().setFromUnitVectors(Tt(0, 0, 1), a.clone().normalize())), o.translate((t.x + n.x) / 2, (t.y + n.y) / 2, (t.z + n.z) / 2), o;
}
var Dt = class {
	group = new e.Group();
	constructor() {
		this.group.name = "hillside-pilgrimage-trail";
		let t = R(.3), n = gt(!0), r = [], i = [], a = [], o = [], s = [], c = (e, t) => Math.max(A(e, t) + ne, be(e, t) + .055);
		for (let e of w) {
			let t = ie(e), n = r.length / 3;
			for (let [e, o] of t.entries()) {
				for (let e of [
					-1,
					0,
					1
				]) {
					let t = o.x + o.nx * T * e, n = o.z + o.nz * T * e, a = c(t, n);
					r.push(t, a, n), i.push(o.along / 2.2, (e + 1) * 1.1);
				}
				if (e < t.length - 1) {
					let t = n + e * 3;
					a.push(t, t + 1, t + 3, t + 1, t + 4, t + 3, t + 1, t + 2, t + 4, t + 2, t + 5, t + 4);
				}
			}
		}
		for (let t = 0; t < w.length; t++) for (let n of oe(t)) {
			let t = -Infinity;
			for (let [r, i] of n.points.entries()) {
				let a = Tt(i.x, wt + i.y, i.z);
				if (r === 0 || r === n.points.length - 1 || i.along - t >= 2.25) {
					let n = new e.BoxGeometry(.2, 1.76, .2);
					n.translate(a.x, a.y + .7, a.z), o.push(n);
					let r = new e.BoxGeometry(.36, .28, .36);
					r.translate(a.x, a.y - .05, a.z), s.push(r), t = i.along;
				}
				if (r > 0) {
					let e = n.points[r - 1], t = Tt(e.x, wt + e.y, e.z);
					s.push(Et(t.clone().add(Tt(0, -.055, 0)), a.clone().add(Tt(0, -.055, 0)), .31, .18));
					for (let e of [1.03, 1.45]) o.push(Et(t.clone().add(Tt(0, e, 0)), a.clone().add(Tt(0, e, 0))));
				}
			}
		}
		let l = new e.BufferGeometry();
		l.setAttribute("position", new e.Float32BufferAttribute(r, 3)), l.setAttribute("uv", new e.Float32BufferAttribute(i, 2)), l.setIndex(a), l.computeVertexNormals();
		let u = new e.Mesh(l, t);
		u.name = "graded-mountain-stone-path", u.receiveShadow = !0, this.group.add(u);
		for (let [r, i] of D.entries()) {
			let a = wt + i.y, o = new e.Mesh(new e.BoxGeometry(i.hx * 2, .18, i.hz * 2), t);
			o.position.set(i.x, a - .09, i.z), o.castShadow = !0, o.receiveShadow = !0, o.name = `temple-overlook-terrace-${r + 1}`, this.group.add(o);
			let s = [], c = [], l = (t, n, r, i) => {
				let o = new e.BoxGeometry(r, .72, i);
				o.translate(t, a + .36, n), s.push(o);
				let l = new e.BoxGeometry(r + .04, .12, i + .04);
				l.translate(t, a + 1.02, n), c.push(l);
				let u = r > i, d = u ? r : i, f = Math.max(1, Math.round(d / 2.4));
				for (let r = 0; r <= f; r++) {
					let i = (r / f - .5) * d, o = new e.BoxGeometry(.18, .36, .18);
					o.translate(t + (u ? i : 0), a + .9, n + (u ? 0 : i)), c.push(o);
				}
			}, u = (e, t) => {
				let n = i.z - i.hz, r = i.z + i.hz, a = Math.max(n, t - 1.5), o = Math.min(r, t + 1.5);
				a - n > .2 && l(e, (n + a) / 2, .34, a - n), r - o > .2 && l(e, (o + r) / 2, .34, r - o);
			}, d = (e, t) => {
				let n = i.x - i.hx, r = i.x + i.hx, a = Math.max(n, t - 1.5), o = Math.min(r, t + 1.5);
				a - n > .2 && l((n + a) / 2, e, a - n, .34), r - o > .2 && l((o + r) / 2, e, r - o, .34);
			};
			i.entrySide === "west" ? u(i.x - i.hx, i.entryZ) : l(i.x - i.hx, i.z, .34, i.hz * 2), i.entrySide === "east" ? u(i.x + i.hx, i.entryZ) : l(i.x + i.hx, i.z, .34, i.hz * 2), i.entrySide === "south" ? d(i.z - i.hz, i.entryX) : l(i.x, i.z - i.hz, i.hx * 2, .34), i.entrySide === "north" ? d(i.z + i.hz, i.entryX) : l(i.x, i.z + i.hz, i.hx * 2, .34);
			let f = new e.Mesh(P(s), t);
			f.castShadow = !0, f.receiveShadow = !0, f.name = `overlook-stone-parapet-${r + 1}`, this.group.add(f);
			let p = new e.Mesh(P(c), n);
			p.castShadow = !0, p.name = `overlook-open-rail-${r + 1}`, this.group.add(p);
			let m = i.z - .45, h = [], g = [], _ = 2.9, v = new e.CylinderGeometry(3.35, 3.55, .24, 8);
			v.translate(i.x, a + .12, m), h.push(v);
			let y = [];
			for (let t = 0; t < 8; t++) {
				let n = t / 8 * Math.PI * 2 + Math.PI / 8, r = i.x + Math.cos(n) * _, o = m + Math.sin(n) * _, s = new e.CylinderGeometry(.29, .34, .24, 12);
				s.translate(r, a + .34, o), h.push(s);
				let c = new e.CylinderGeometry(.17, .2, 3.05, 12);
				c.translate(r, a + 1.98, o), g.push(c), y.push(Tt(r, a + 3.48, o));
			}
			for (let e = 0; e < 8; e++) g.push(Et(y[e], y[(e + 1) % 8], .24, .28));
			let b = new e.CircleGeometry(3.48, 8);
			b.rotateZ(Math.PI / 8), b.rotateX(Math.PI / 2), b.translate(i.x, a + 3.55, m), g.push(b);
			let x = Tt(i.x, a + 3.49, m);
			for (let e of y) g.push(Et(x, e, .11, .12));
			let S = new e.Mesh(P(h), t);
			S.name = `ridge-pavilion-stone-${r + 1}`, S.castShadow = !0, S.receiveShadow = !0, this.group.add(S);
			let C = new e.Mesh(P(g), n);
			C.name = `ridge-pavilion-timber-${r + 1}`, C.castShadow = !0, C.receiveShadow = !0, this.group.add(C);
			let w = st(), T = new e.Mesh(new e.ConeGeometry(3.95, 1.35, 8, 2), w);
			T.position.set(i.x, a + 4.15, m), T.rotation.y = Math.PI / 8, T.name = `ridge-pavilion-roof-${r + 1}`, T.castShadow = !0, T.receiveShadow = !0, this.group.add(T);
			let E = new e.Mesh(new e.CylinderGeometry(.08, .13, .75, 10), n);
			E.position.set(i.x, a + 5.15, m), E.name = `ridge-pavilion-finial-${r + 1}`, E.castShadow = !0, this.group.add(E);
		}
		for (let [r, i, a] of [[
			"mountain-guardrail",
			o,
			n
		], [
			"mountain-post-foundations",
			s,
			t
		]]) {
			let t = new e.Mesh(P(i), a);
			t.name = r, t.castShadow = !0, t.receiveShadow = !0, this.group.add(t);
		}
	}
}, Ot = null, kt = null, At = null, jt = null;
function Mt() {
	return jt || (jt = Ze().clone(), jt.name = "pavilion-warm-weathered-stone-slabs", jt.color.set(15129801), jt.roughness = .94, jt.normalScale.set(.35, .35), jt);
}
function Nt() {
	if (Ot) return Ot;
	let t = gt(!0), n = document.createElement("canvas");
	n.width = n.height = 512;
	let r = n.getContext("2d");
	r.fillStyle = "#695541", r.fillRect(0, 0, 512, 512);
	for (let e = 0; e < 4; e++) {
		t.map?.image && r.drawImage(t.map.image, 0, e * 128, 512, 128), r.fillStyle = e % 2 ? "rgba(179,137,80,.14)" : "rgba(215,182,127,.09)", r.fillRect(0, e * 128, 512, 128), r.fillStyle = "#302a20", r.fillRect(0, e * 128, 512, 3), r.fillStyle = "rgba(227,204,159,.4)", r.fillRect(0, e * 128 + 4, 512, 2);
		for (let t of [12, 499]) r.fillStyle = "#3c3429", r.beginPath(), r.arc(t, e * 128 + 16, 2.2, 0, Math.PI * 2), r.fill();
	}
	let i = new e.CanvasTexture(n);
	return i.name = "lingyin-weathered-deck-planks", i.colorSpace = e.SRGBColorSpace, i.wrapS = i.wrapT = e.RepeatWrapping, i.anisotropy = 16, Ot = new e.MeshStandardMaterial({
		name: "lingyin-reference-wooden-deck",
		map: i,
		bumpMap: i,
		bumpScale: .024,
		roughness: .88,
		metalness: 0
	}), t.dispose(), Ot;
}
function Pt() {
	if (kt) return kt;
	let t = document.createElement("canvas");
	t.width = t.height = 256;
	let n = t.getContext("2d"), r = n.createImageData(256, 256);
	for (let e = 0; e < 256; e++) for (let t = 0; t < 256; t++) {
		let n = t / 256 * Math.PI * 2, i = e / 256 * Math.PI * 2, a = Math.cos(n * 4 + Math.sin(i * 2)) * .22 + Math.cos(n * 9 - i * 3) * .08, o = Math.cos(i * 6 + Math.sin(n * 3)) * .18 - Math.cos(n * 9 - i * 3) * .06, s = (e * 256 + t) * 4, c = 1 / Math.hypot(a, o, 1);
		r.data[s] = (a * c * .5 + .5) * 255, r.data[s + 1] = (o * c * .5 + .5) * 255, r.data[s + 2] = (c * .5 + .5) * 255, r.data[s + 3] = 255;
	}
	n.putImageData(r, 0, 0);
	let i = new e.CanvasTexture(t);
	return i.name = "lingyin-fine-stream-ripples", i.wrapS = i.wrapT = e.RepeatWrapping, i.repeat.set(2, 7), kt = new e.MeshStandardMaterial({
		name: "lingyin-reference-jade-stream",
		color: 3767416,
		normalMap: i,
		normalScale: new e.Vector2(.33, .33),
		roughness: .26,
		metalness: .12,
		transparent: !0,
		opacity: .83,
		depthWrite: !1,
		side: e.DoubleSide
	}), kt;
}
function Ft() {
	if (At) return At;
	let t = document.createElement("canvas");
	t.width = t.height = 256;
	let n = t.getContext("2d"), r = n.createImageData(256, 256);
	for (let e = 0; e < 256; e++) for (let t = 0; t < 256; t++) {
		let n = t / 255, i = e / 256, a = Math.min(1, n * 9, (1 - n) * 9), o = .62 + .18 * Math.sin(n * 180 + Math.sin(i * Math.PI * 6) * .7) + .12 * Math.sin(n * 59 - i * Math.PI * 8), s = (e * 256 + t) * 4;
		r.data[s] = 209, r.data[s + 1] = 230, r.data[s + 2] = 230, r.data[s + 3] = Math.max(0, a * o) * 230;
	}
	n.putImageData(r, 0, 0);
	let i = new e.CanvasTexture(t);
	return i.colorSpace = e.SRGBColorSpace, i.wrapT = e.RepeatWrapping, At = new e.MeshBasicMaterial({
		name: "lingyin-waterfall-white-streams",
		map: i,
		transparent: !0,
		depthWrite: !1,
		side: e.DoubleSide
	}), At;
}
function It(e) {
	kt?.normalMap && (kt.normalMap.offset.y = -e * .018), At?.map && (At.map.offset.y = e * .24);
}
//#endregion
//#region src/world/boardwalk_layout.ts
function Lt(e, t) {
	let n = e.slice(1).map((t, n) => {
		let r = e[n], i = Math.hypot(t.x - r.x, t.z - r.z);
		return {
			x: (t.x - r.x) / i,
			z: (t.z - r.z) / i,
			length: i
		};
	}), r = e.map((t, r) => {
		if (r === 0 || r === e.length - 1) return {
			inset: 0,
			mx: 0,
			mz: 0
		};
		let i = n[r - 1], a = n[r], o = i.x * a.x + i.z * a.z, s = -i.z - a.z, c = i.x + a.x, l = 1 + o;
		if (l < .1) throw Error("Boardwalk needs a wider hairpin landing");
		return {
			inset: 2.325 * Math.sqrt(Math.max(0, (1 - o) / l)),
			mx: s / l,
			mz: c / l
		};
	}), i = (e, t, n) => ({
		x: e.x + t.x * n,
		y: e.y,
		z: e.z + t.z * n
	}), a = (e, t, n, r) => ({
		x: e.x - t.z * n * r,
		y: e.y,
		z: e.z + t.x * n * r
	}), o = n.map((n, a) => {
		let o = r[a].inset, s = r[a + 1].inset;
		if (o + s > n.length - .2) throw Error(`Boardwalk span ${a} has no clear flight`);
		return {
			a: i(e[a], n, o),
			b: i(e[a + 1], n, -s),
			stair: t.has(a),
			index: a
		};
	}), s = [], c = [], l = (e, t, n = !1) => {
		Math.hypot(t.x - e.x, t.z - e.z) > .001 && s.push({
			a: e,
			b: t,
			corner: n
		});
	};
	return o.forEach((t, i) => {
		for (let e of [-1, 1]) l(a(t.a, n[i], e, 2.05), a(t.b, n[i], e, 2.05));
		if (i === o.length - 1) return;
		let s = e[i + 1], u = r[i + 1], d = o[i + 1], f = n[i], p = n[i + 1];
		for (let e of [-1, 1]) {
			let n = {
				x: s.x + u.mx * e * 2.05,
				y: s.y,
				z: s.z + u.mz * e * 2.05
			};
			l(a(t.b, f, e, 2.05), n, !0), l(n, a(d.a, p, e, 2.05), !0);
		}
		let m = (e) => ({
			x: s.x + u.mx * e * 2.125,
			y: s.y,
			z: s.z + u.mz * e * 2.125
		});
		c.push([
			a(t.b, f, 1, 2.125),
			m(1),
			a(d.a, p, 1, 2.125),
			a(d.a, p, -1, 2.125),
			m(-1),
			a(t.b, f, -1, 2.125)
		]);
	}), {
		spans: o,
		rails: s,
		landings: c
	};
}
//#endregion
//#region src/world/pavilion_terrace.ts
function Rt(e, t) {
	let n = Math.hypot(e.x - t.x, e.z - t.z), r = {
		x: (e.x - t.x) / n,
		z: (e.z - t.z) / n
	}, i = {
		x: -r.z,
		z: r.x
	}, a = (t, n) => ({
		x: e.x + r.x * t + i.x * n,
		y: e.y,
		z: e.z + r.z * t + i.z * n
	}), o = [
		[0, -3.95],
		[1.4, -5.65],
		[10.6, -5.65],
		[13.15, -3.7],
		[13.15, 3.7],
		[10.6, 5.65],
		[1.4, 5.65],
		[0, 3.95]
	].map(([e, t]) => a(e, t)), s = [
		[0, -2.05],
		[0, -3.8],
		[1.5, -5.5],
		[10.5, -5.5],
		[13, -3.6],
		[13, 3.6],
		[10.5, 5.5],
		[1.5, 5.5],
		[0, 3.8],
		[0, 2.05]
	].map(([e, t]) => a(e, t));
	return {
		entry: e,
		forward: r,
		normal: i,
		outline: o,
		guard: s,
		rails: s.slice(1).map((e, t) => ({
			a: s[t],
			b: e,
			corner: !0
		})),
		pavilion: a(8.7, -.45),
		signedDistance: (e, t) => {
			let n = !0, r = Infinity;
			for (let i = 0; i < o.length; i++) {
				let a = o[i], s = o[(i + 1) % o.length], c = s.x - a.x, l = s.z - a.z;
				c * (t - a.z) - l * (e - a.x) < -1e-7 && (n = !1);
				let u = Math.max(0, Math.min(1, ((e - a.x) * c + (t - a.z) * l) / (c * c + l * l)));
				r = Math.min(r, Math.hypot(e - a.x - c * u, t - a.z - l * u));
			}
			return n ? -r : r;
		}
	};
}
//#endregion
//#region src/world/masterplan_blockout.ts
var z = O.platform.y, zt = [
	[0, 1.8],
	[.65, 1.38],
	[1.7, .82],
	[2.75, .34],
	[3.55, .1],
	[4, .28]
];
function Bt(t, n, r, i) {
	let a = n.clone().sub(t), o = new e.BoxGeometry(r, i, a.length());
	return o.applyQuaternion(new e.Quaternion().setFromUnitVectors(new e.Vector3(0, 0, 1), a.clone().normalize())), o.translate((t.x + n.x) / 2, (t.y + n.y) / 2, (t.z + n.z) / 2), o;
}
function Vt(t, n = .3) {
	let r = t.reduce((e, n, r) => {
		let i = t[(r + 1) % t.length];
		return e + n.x * i.z - i.x * n.z;
	}, 0);
	if (Math.abs(r) < 1e-6) return null;
	let i = new e.Shape();
	t.forEach((e, t) => t ? i.lineTo(e.x, -e.z) : i.moveTo(e.x, -e.z)), i.closePath();
	let a = new e.ExtrudeGeometry(i, {
		depth: n,
		bevelEnabled: !1,
		steps: 1
	});
	return a.rotateX(-Math.PI / 2), a.translate(0, z + t[0].y - n, 0), a;
}
function Ht() {
	let t = zt, n = [], r = [], i = [];
	for (let e = 0; e < 8; e++) {
		let a = n.length / 3;
		for (let [i, a] of t) for (let t = 0; t < 2; t++) {
			let o = (e + t) * Math.PI / 4 + Math.PI / 8;
			n.push(Math.cos(o) * i, a, Math.sin(o) * i), r.push((t - .5) * 2 * Math.sin(Math.PI / 8) * i * 3, i * 3);
		}
		for (let e = 0; e < t.length - 1; e++) {
			let t = a + e * 2, n = t + 1, r = t + 2, o = t + 3;
			e > 0 && i.push(t, n, r), i.push(n, o, r);
		}
	}
	let a = new e.BufferGeometry();
	return a.setAttribute("position", new e.Float32BufferAttribute(n, 3)), a.setAttribute("uv", new e.Float32BufferAttribute(r, 2)), a.setIndex(i), a.computeVertexNormals(), a;
}
var Ut = class {
	group = new e.Group();
	westBoardwalk = new e.Group();
	eastRiver = new e.Group();
	eastCrossing = new e.Group();
	westRoute = [];
	westTerrace = null;
	constructor() {
		this.group.name = "lingyin-masterplan-blockout", this.westBoardwalk.name = "phase1-west-boardwalk-v3", this.eastRiver.name = "phase1-east-river", this.eastCrossing.name = "phase1-east-crossing", this.group.add(this.westBoardwalk, this.eastRiver, this.eastCrossing), this.buildWestBoardwalk(), this.buildEastRiver(), this.buildEastCrossing();
	}
	update(e) {
		It(e);
	}
	fitPreviewTerrain(e) {
		this.gradeBoardwalkTerrain(e);
	}
	gradeBoardwalkTerrain(t) {
		let n = (t, n) => {
			let r = Infinity, i = z;
			for (let a = 0; a < this.westRoute.length - 1; a++) {
				let o = this.westRoute[a], s = this.westRoute[a + 1], c = s.x - o.x, l = s.z - o.z, u = e.MathUtils.clamp(((t - o.x) * c + (n - o.z) * l) / (c * c + l * l), 0, 1), d = Math.hypot(t - o.x - c * u, n - o.z - l * u);
				d < r && (r = d, i = z + e.MathUtils.lerp(o.y, s.y, u));
			}
			return {
				distance: r,
				top: i
			};
		}, r = t.getObjectByName("terrain");
		if (r instanceof e.Mesh) {
			r.geometry = r.geometry.clone();
			let t = r.geometry.getAttribute("position");
			for (let r = 0; r < t.count; r++) {
				let { distance: i, top: a } = n(t.getX(r), t.getZ(r)), o = t.getY(r), s = Math.min(o, a - 1.1), c = 1 - e.MathUtils.smoothstep(i, 3.6, 11), l = e.MathUtils.lerp(o, s, c), u = this.westTerrace;
				if (u) {
					let n = u.signedDistance(t.getX(r), t.getZ(r)), o = 1 - e.MathUtils.smoothstep(n, 0, 10);
					l = e.MathUtils.lerp(l, z + u.entry.y - .6, o), n > 0 && i < 3.6 && (l = Math.min(l, a - .7));
				}
				t.setY(r, l);
			}
			t.needsUpdate = !0, r.geometry.computeVertexNormals(), r.geometry.computeBoundingSphere();
		}
		t.updateMatrixWorld(!0);
		let i = new e.Matrix4().copy(t.matrixWorld).invert(), a = new e.Matrix4(), o = new e.Vector3(), s = /* @__PURE__ */ new Set(), c = t.getObjectsByProperty("name", "vegetation"), l = t.getObjectByName("lingyin-gate-framing-trees");
		l && c.push(l);
		for (let r of c) r.traverse((c) => {
			if (!(c instanceof e.InstancedMesh) || s.has(c)) return;
			s.add(c);
			let l = new e.Matrix4().multiplyMatrices(i, c.matrixWorld);
			for (let i = 0; i < c.count; i++) {
				if (c.getMatrixAt(i, a), o.setFromMatrixPosition(a).applyMatrix4(l), n(o.x, o.z).distance > 4.5 && (!this.westTerrace || this.westTerrace.signedDistance(o.x, o.z) > 3)) {
					if (r.parent === t && this.westTerrace) {
						let t = this.westTerrace, n = t.signedDistance(o.x, o.z), r = 1 - e.MathUtils.smoothstep(n, 0, 10), s = (z + t.entry.y - .6 - A(o.x, o.z)) * r;
						a.elements[13] += s, c.setMatrixAt(i, a);
					}
					continue;
				}
				a.scale(new e.Vector3(0, 0, 0)), c.setMatrixAt(i, a);
			}
			c.instanceMatrix.needsUpdate = !0, c.computeBoundingSphere();
		});
	}
	buildWestBoardwalk() {
		let t = Nt(), n = R(.2), r = gt(!0);
		r.color.set("#c2a27f");
		let i = st();
		i.name = "pavilion-weathered-grey-roof", i.color.set(9871002), i.roughness = .92, i.metalness = 0;
		let a = new e.MeshStandardMaterial({
			name: "boardwalk-warm-lantern-glass",
			color: 16761972,
			emissive: 16753722,
			emissiveIntensity: 2.8,
			roughness: .66
		}), o = [], s = [], c = [], l = [], u = [], d = [
			{
				x: -31.2,
				z: -18,
				y: 0
			},
			{
				x: -31.2,
				z: -27,
				y: 4.35
			},
			{
				x: -39.4,
				z: -27,
				y: 4.35
			},
			{
				x: -42,
				z: 12,
				y: 4.35
			},
			{
				x: -49,
				z: 20,
				y: 6.4
			},
			{
				x: -51,
				z: 36,
				y: 6.4
			},
			{
				x: -47,
				z: 42,
				y: 9
			},
			{
				x: -39.5,
				z: 49,
				y: 9
			},
			{
				x: -45.5,
				z: 57,
				y: 11.95
			},
			{
				x: -47,
				z: 59,
				y: 11.95
			},
			{
				x: -49.5,
				z: 61,
				y: 13
			}
		];
		this.westRoute = d, this.westBoardwalk.userData.route = d;
		let f = Lt(d, new Set([
			0,
			3,
			5,
			7,
			9
		]));
		this.westBoardwalk.userData.railLayout = f;
		let p = Rt(d[d.length - 1], d[d.length - 2]);
		this.westTerrace = p, this.westBoardwalk.userData.terraceLayout = {
			...p,
			signedDistance: void 0
		};
		for (let { a: t, b: n, stair: r } of f.spans) {
			let i = n.x - t.x, a = n.z - t.z, s = Math.hypot(i, a) || 1, c = Math.atan2(i, a);
			if (r) {
				let r = Math.max(5, Math.ceil(s / .48), Math.ceil(Math.abs(n.y - t.y) / .18));
				for (let i = 0; i < r; i++) {
					let a = (i + .5) / r, l = e.MathUtils.lerp(t.y, n.y, (i + 1) / r);
					o.push(M(4.25, .24, s / r, e.MathUtils.lerp(t.x, n.x, a), z + l - .12, e.MathUtils.lerp(t.z, n.z, a), c));
				}
			} else {
				let r = new e.Vector3(t.x, z + t.y - .15, t.z), i = new e.Vector3(n.x, z + t.y - .15, n.z);
				o.push(Bt(r, i, 4.25, .3));
			}
		}
		for (let e of f.landings) {
			let t = Vt(e);
			t && o.push(t);
		}
		let m = /* @__PURE__ */ new Set(), h = [], g = (e, t) => {
			let { x: n, z: r } = e, i = z + e.y, a = [
				n,
				e.y,
				r
			].map((e) => e.toFixed(4)).join(",");
			if (m.has(a) || h.some((t) => Math.hypot(t.x - n, t.z - r) < .34 && Math.abs(t.y - e.y) < .1)) return;
			m.add(a), h.push(e);
			let o = Math.min(A(n, r), i - 1.1), c = Math.max(1.25, i - o);
			if (s.push(M(.22, c, .22, n, o + c / 2, r)), s.push(M(.2, 1.22, .2, n, i + .61, r)), t) {
				u.push(M(.4, .55, .4, n, i + 1.46, r)), l.push(M(.52, .09, .52, n, i + 1.78, r)), l.push(M(.46, .08, .46, n, i + 1.16, r));
				for (let e of [-.21, .21]) for (let t of [-.21, .21]) l.push(M(.045, .6, .045, n + e, i + 1.47, r + t));
			}
		}, _ = [];
		for (let t of [...f.rails, ...p.rails]) {
			let { a: n, b: r } = t, i = new e.Vector3(n.x, z + n.y + 1.02, n.z), a = new e.Vector3(r.x, z + r.y + 1.02, r.z);
			s.push(Bt(i, a, .14, .15)), s.push(Bt(i.clone().add(new e.Vector3(0, -.46, 0)), a.clone().add(new e.Vector3(0, -.46, 0)), .11, .12));
			let o = Math.hypot(r.x - n.x, r.z - n.z), c = Math.max(1, Math.ceil(o / 4.2));
			for (let t = 0; t <= c; t++) {
				let i = t / c, a = {
					x: e.MathUtils.lerp(n.x, r.x, i),
					y: e.MathUtils.lerp(n.y, r.y, i),
					z: e.MathUtils.lerp(n.z, r.z, i)
				}, o = (t === 0 || t === c) && _.every((e) => Math.hypot(e.x - a.x, e.z - a.z) > 2.8);
				g(a, o), o && _.push(a);
			}
		}
		this.westBoardwalk.userData.postPoints = h, this.westBoardwalk.userData.litPostPoints = _, c.push(Vt(p.outline.map((e) => ({
			...e,
			y: e.y - .05
		})), .65));
		for (let t of p.rails) {
			let n = new e.Vector3(t.a.x, z + t.a.y + .11, t.a.z), r = new e.Vector3(t.b.x, z + t.b.y + .11, t.b.z);
			c.push(Bt(n, r, .32, .22));
		}
		for (let e of p.guard) c.push(M(.48, .24, .48, e.x, z + e.y + .12, e.z));
		let v = Vt(p.outline, .05), y = v.getAttribute("position"), b = v.getAttribute("uv");
		for (let e = 0; e < y.count; e++) {
			let t = y.getX(e) - p.entry.x, n = y.getZ(e) - p.entry.z;
			b.setXY(e, (t * p.forward.x + n * p.forward.z) * 2.4 / 48, (t * p.normal.x + n * p.normal.z) * 2.4 / 32);
		}
		let x = new e.Mesh(v, Mt());
		x.name = "phase1-pavilion-terrace-paving", x.receiveShadow = !0, this.westBoardwalk.add(x);
		let { x: S, z: C } = p.pavilion, w = z + p.entry.y, T = [];
		for (let t = 0; t < 8; t++) {
			let n = t / 8 * Math.PI * 2 + Math.PI / 8, r = S + Math.cos(n) * 2.65, i = C + Math.sin(n) * 2.65;
			c.push(N(.27, .31, .22, 10, r, w + .11, i)), T.push(N(.15, .18, 3.24, 10, r, w + 1.84, i));
			let a = (t + 1) / 8 * Math.PI * 2 + Math.PI / 8;
			T.push(Bt(new e.Vector3(r, w + 3.4, i), new e.Vector3(S + Math.cos(a) * 2.65, w + 3.4, C + Math.sin(a) * 2.65), .19, .24));
			for (let t = 1; t < zt.length; t++) {
				let [r, i] = zt[t - 1], [a, o] = zt[t];
				T.push(Bt(new e.Vector3(S + Math.cos(n) * r, w + 3.03 + i, C + Math.sin(n) * r), new e.Vector3(S + Math.cos(n) * a, w + 3.03 + o, C + Math.sin(n) * a), .11, .12));
			}
			T.push(Bt(new e.Vector3(S + Math.cos(n) * 3.98, w + 3.37, C + Math.sin(n) * 3.98), new e.Vector3(S + Math.cos(a) * 3.98, w + 3.37, C + Math.sin(a) * 3.98), .13, .16));
		}
		let E = new e.Mesh(P(T), r);
		E.name = "phase1-lower-pavilion-posts", E.castShadow = !0, E.renderOrder = 79;
		let ee = new e.Mesh(Ht(), i);
		ee.position.set(S, w + 3.15, C), c.push(N(.16, .22, .14, 8, S, w + 4.96, C)), c.push(N(.015, .09, .42, 8, S, w + 5.2, C)), ee.name = "phase1-lower-pavilion-roof", ee.castShadow = !0, ee.renderOrder = 80;
		let te = new e.Mesh(F(P(o), 2.4), t);
		te.name = "phase1-boardwalk-deck", te.castShadow = te.receiveShadow = !0, te.renderOrder = 80;
		let ne = new e.Mesh(F(P(s), .9), r);
		ne.name = "phase1-boardwalk-supports", ne.castShadow = ne.receiveShadow = !0, ne.renderOrder = 79;
		let D = new e.Mesh(P(u), a);
		D.name = "phase1-boardwalk-lanterns", D.castShadow = !1, D.renderOrder = 81, this.westBoardwalk.add(te, ne, D, E, ee);
		let re = new e.Mesh(P(l), r);
		re.name = "phase1-boardwalk-lantern-frames";
		let ie = new e.Mesh(F(P(c), 1.4), n);
		ie.name = "phase1-boardwalk-stone-footings", ie.castShadow = ie.receiveShadow = !0, this.westBoardwalk.add(re, ie);
	}
	buildEastRiver() {
		let t = Pt(), n = R(.2), r = [], i = [], a = le.filter(([e, t]) => e > 25 && t > -62 && t < 70);
		for (let t = 0; t < a.length - 1; t += 2) {
			let [n, o] = a[t], [s, c] = a[Math.min(t + 2, a.length - 1)], l = de(n, o).t, u = pe(l) + .1, d = fe(l) * 1.15, f = new e.Vector3(n, u, o), p = new e.Vector3(s, pe(de(s, c).t) + .1, c);
			r.push(Bt(f, p, d, .12));
			let m = s - n, h = c - o, g = Math.hypot(m, h) || 1, _ = -h / g, v = m / g;
			for (let t of [-1, 1]) i.push(Bt(f.clone().add(new e.Vector3(_ * t * (d * .58), .1, v * t * (d * .58))), p.clone().add(new e.Vector3(_ * t * (d * .58), .1, v * t * (d * .58))), .65, .5));
		}
		let o = new e.Mesh(P(r), t);
		o.name = "phase1-river-ribbon", o.renderOrder = 10;
		let s = new e.Mesh(F(P(i), 1.4), n);
		s.name = "phase1-river-banks", s.castShadow = s.receiveShadow = !0;
		let c = new e.Mesh(new e.CylinderGeometry(4.3, 4.7, .18, 24), t);
		c.name = "phase1-waterfall-upper-pool", c.position.set(43.2, 6.36, -54.4), c.renderOrder = 11;
		let l = new e.Mesh(new e.PlaneGeometry(5.8, 7.6), Ft());
		l.name = "phase1-waterfall-face", l.position.set(42.25, 3, -49.9), l.rotation.set(0, Math.PI - .12, 0), l.renderOrder = 12;
		let u = new e.Mesh(new e.CylinderGeometry(5.4, 5.8, .16, 24), t);
		u.name = "phase1-waterfall-plunge-pool", u.position.set(40.9, -.72, -45.6), u.renderOrder = 11;
		let d = new e.Mesh(new e.BoxGeometry(5.9, .28, .7), n);
		d.name = "phase1-waterfall-stone-lip", d.position.set(42.65, 6.2, -50.45), d.rotation.y = -.12, this.eastRiver.add(o, s, c, l, u, d);
	}
	buildEastCrossing() {
		let t = R(.2), n = st(), r = gt(!1), i = [];
		for (let t = 0; t < 3; t++) {
			let n = A(44.35, 28), r = e.MathUtils.lerp(n, z + .32, (t + 1) / 3);
			i.push(M(.72, .18, 4.75, 44.62 - t * .72, r - .09, 28));
		}
		let a = new e.Mesh(F(P(i), 1.4), t);
		a.name = "phase1-east-bank-approach", a.castShadow = a.receiveShadow = !0;
		let o = new e.Group();
		o.name = "phase1-east-pavilion";
		let s = 43.5, c = 46.5, l = A(s, c) + .1, u = new e.Mesh(new e.CylinderGeometry(3.5, 3.8, .42, 8), t);
		u.position.set(s, l + .21, c), o.add(u);
		for (let t = 0; t < 8; t++) {
			let n = t / 8 * Math.PI * 2 + Math.PI / 8, i = new e.Mesh(new e.CylinderGeometry(.13, .17, 3.2, 8), r);
			i.position.set(s + Math.cos(n) * 2.8, l + 1.8, c + Math.sin(n) * 2.8), o.add(i);
		}
		let d = new e.Mesh(new e.ConeGeometry(4.4, 1.45, 8), n);
		d.position.set(s, l + 4, c), d.rotation.y = Math.PI / 8, o.add(d);
		for (let n = 0; n < 3; n++) {
			let r = new e.Mesh(new e.BoxGeometry(1.15, .16, 3.2), t);
			r.name = `phase1-east-pavilion-step-${n + 1}`, r.position.set(s - 4.05 - n * .9, l - .08 - n * .12, c), o.add(r);
		}
		o.traverse((t) => {
			t instanceof e.Mesh && (t.castShadow = t.receiveShadow = !0);
		}), this.eastCrossing.add(a, o);
	}
};
//#endregion
//#region src/world/game_landscape.ts
function Wt(t) {
	let n = new Ut();
	n.group.name = "lingyin-approved-landscape", n.gradeBoardwalkTerrain(t), t.add(n.group);
	let r = t.getObjectByName("hillside-pilgrimage-trail");
	r && (r.visible = !1);
	let i = t.getObjectByName("water");
	i && (i.visible = !1);
	let a = n.westBoardwalk.userData.railLayout, o = n.westBoardwalk.userData.route, s = Rt(o.at(-1), o.at(-2)), c = [], l = [], u = (e, t, n, r = !1) => {
		let i = e.map((e) => e.x), a = e.map((e) => e.z), o = (Math.min(...i) + Math.max(...i)) / 2, s = (Math.min(...a) + Math.max(...a)) / 2, l = e.reduce((t, n, r) => t + n.x * e[(r + 1) % e.length].z - n.z * e[(r + 1) % e.length].x, 0);
		if (Math.abs(l) < 1e-7) return;
		let u = [[
			0,
			1,
			0,
			n
		], [
			0,
			-1,
			0,
			-t
		]];
		e.forEach((t, n) => {
			let r = e[(n + 1) % e.length], i = r.x - t.x, a = r.z - t.z, o = Math.hypot(i, a);
			if (o < 1e-7) return;
			let s = l > 0 ? 1 : -1, c = s * a / o, d = -s * i / o;
			u.push([
				c,
				0,
				d,
				c * t.x + d * t.z
			]);
		}), c.push({
			x: o,
			z: s,
			hx: (Math.max(...i) - Math.min(...i)) / 2,
			hz: (Math.max(...a) - Math.min(...a)) / 2,
			y0: t,
			h: n,
			planes: u,
			stepSurface: r,
			walkable: !1
		});
	}, d = (e, t, n, r, i, a = !1) => {
		let o = t.x - e.x, s = t.z - e.z, c = Math.hypot(o, s), l = -s / c * n / 2, d = o / c * n / 2;
		u([
			{
				x: e.x + l,
				z: e.z + d,
				y: 0
			},
			{
				x: t.x + l,
				z: t.z + d,
				y: 0
			},
			{
				x: t.x - l,
				z: t.z - d,
				y: 0
			},
			{
				x: e.x - l,
				z: e.z - d,
				y: 0
			}
		], r, i, a);
	};
	for (let t of a.spans) {
		let n = Math.hypot(t.b.x - t.a.x, t.b.z - t.a.z), r = t.stair ? Math.max(5, Math.ceil(n / .48), Math.ceil(Math.abs(t.b.y - t.a.y) / .18)) : 1;
		for (let n = 0; n < r; n++) {
			let i = (n) => ({
				x: e.MathUtils.lerp(t.a.x, t.b.x, n),
				z: e.MathUtils.lerp(t.a.z, t.b.z, n),
				y: 0
			}), a = e.MathUtils.lerp(t.a.y, t.b.y, (n + 1) / r);
			d(i(n / r), i((n + 1) / r), 4.25, a - (t.stair ? .24 : .3), a, t.stair);
		}
		l.push({
			kind: "walk",
			x: (t.a.x + t.b.x) / 2,
			z: (t.a.z + t.b.z) / 2,
			hx: Math.abs(t.b.x - t.a.x) / 2 + 2.125,
			hz: Math.abs(t.b.z - t.a.z) / 2 + 2.125
		});
	}
	for (let e of a.landings) u(e, e[0].y - .3, e[0].y);
	u(s.outline, s.entry.y - .7, s.entry.y);
	let f = (e, t, n, r, i, a) => c.push({
		x: e,
		z: t,
		hx: n,
		hz: r,
		y0: i,
		h: a,
		walkable: !1
	});
	for (let e of n.westBoardwalk.userData.postPoints) f(e.x, e.z, .11, .11, Math.min(A(e.x, e.z) - O.platform.y, e.y - 1.1), e.y + 1.22);
	for (let e of n.westBoardwalk.userData.litPostPoints) f(e.x, e.z, .26, .26, e.y + 1.16, e.y + 1.825);
	for (let e = 0; e < 8; e++) {
		let t = e * Math.PI / 4 + Math.PI / 8;
		f(s.pavilion.x + Math.cos(t) * 2.65, s.pavilion.z + Math.sin(t) * 2.65, .18, .18, 13, 16.71);
	}
	f(s.pavilion.x, s.pavilion.z, 3.55, 3.55, 16.4, 17.95);
	let p = P([
		"phase1-boardwalk-deck",
		"phase1-pavilion-terrace-paving",
		"phase1-boardwalk-supports",
		"phase1-boardwalk-lantern-frames",
		"phase1-boardwalk-lanterns"
	].map((e) => n.group.getObjectByName(e).geometry.clone()));
	return {
		group: n.group,
		solids: c,
		rails: [...a.rails, ...s.rails],
		radar: l,
		walkGeometry: p,
		nodes: o,
		terrace: s,
		update: (e) => n.update(e)
	};
}
//#endregion
//#region src/gate-kit/core/materials.ts
var Gt = "\nfloat cgHash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }\nfloat cgHash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }\nvec3 cgHash33(vec3 p3){ p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }\nfloat cgNoise2(vec2 p){\n  vec2 i = floor(p), f = fract(p);\n  f = f * f * (3.0 - 2.0 * f);\n  float a = cgHash12(i), b = cgHash12(i + vec2(1,0)), c = cgHash12(i + vec2(0,1)), d = cgHash12(i + vec2(1,1));\n  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);\n}\nfloat cgNoise3(vec3 p){\n  vec3 i = floor(p), f = fract(p);\n  f = f * f * (3.0 - 2.0 * f);\n  float n000 = cgHash12(i.xy + i.z * 19.19);\n  float n100 = cgHash12(i.xy + vec2(1,0) + i.z * 19.19);\n  float n010 = cgHash12(i.xy + vec2(0,1) + i.z * 19.19);\n  float n110 = cgHash12(i.xy + vec2(1,1) + i.z * 19.19);\n  float n001 = cgHash12(i.xy + (i.z + 1.0) * 19.19);\n  float n101 = cgHash12(i.xy + vec2(1,0) + (i.z + 1.0) * 19.19);\n  float n011 = cgHash12(i.xy + vec2(0,1) + (i.z + 1.0) * 19.19);\n  float n111 = cgHash12(i.xy + vec2(1,1) + (i.z + 1.0) * 19.19);\n  return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y), mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);\n}\nfloat cgFbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i=0;i<5;i++){ s += a * cgNoise2(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }\nfloat cgFbm3(vec3 p){ float s = 0.0, a = 0.5; for (int i=0;i<4;i++){ s += a * cgNoise3(p); p = p * 2.05 + 7.3; a *= 0.5; } return s; }\nfloat cgRidge2(vec2 p){ float s = 0.0, a = 0.55; for (int i=0;i<4;i++){ float n = 1.0 - abs(cgNoise2(p) * 2.0 - 1.0); s += a * n * n; p = p * 2.1 + 3.1; a *= 0.5; } return s; }\n// anti-aliased thin line: distance d in world units, width w, pixel footprint aa\nfloat cgLine(float d, float w, float aa){ return 1.0 - smoothstep(w, w + aa, abs(d)); }\n", Kt = "\nvarying vec3 vCgWorld;\nvarying vec3 vCgNormalW;\nvarying vec3 vCgObj;\nvarying float vCgSeed;\n", qt = "\n{\n  vec4 cgP = vec4(transformed, 1.0);\n  vec3 cgN = objectNormal;\n  float cgSeedV = 0.0;\n  #ifdef USE_INSTANCING\n    cgP = instanceMatrix * cgP;\n    cgN = mat3(instanceMatrix) * cgN;\n    cgSeedV = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);\n  #endif\n  vCgWorld = (modelMatrix * cgP).xyz;\n  vCgNormalW = normalize(mat3(modelMatrix) * cgN);\n  vCgObj = transformed;\n  vCgSeed = cgSeedV;\n}\n";
function Jt(t = {}) {
	let n = new e.MeshStandardMaterial(t.params ?? {});
	t.name && (n.name = t.name);
	let r = t.uniforms ?? {}, i = "proc:" + Yt([
		t.head,
		t.vertexHead,
		t.vertexPre,
		t.color,
		t.roughness,
		t.metalness,
		t.normal,
		t.emissive,
		t.ao
	].join("|"));
	return n.customProgramCacheKey = () => i, n.onBeforeCompile = (e) => {
		Object.assign(e.uniforms, r);
		let n = e.vertexShader, i = e.fragmentShader;
		n = n.replace("#include <common>", `#include <common>\n${Kt}\n${t.vertexHead ?? ""}`), t.vertexPre && (n = n.replace("#include <begin_vertex>", `#include <begin_vertex>\n{\n${t.vertexPre}\n}`)), n = n.replace("#include <worldpos_vertex>", `#include <worldpos_vertex>\n${qt}`), i = i.replace("#include <common>", `#include <common>\n${Kt}\n${Gt}\n${t.head ?? ""}`), i = i.replace("void main() {", "void main() {\nvec3 cgP = vCgWorld; vec3 cgN = normalize(vCgNormalW); vec3 cgO = vCgObj; float cgSeed = vCgSeed; vec3 cgBump = vec3(0.0); float cgAO = 1.0;"), t.color && (i = i.replace("#include <color_fragment>", `#include <color_fragment>\n{\n${t.color}\n}`)), t.roughness && (i = i.replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>\n{\n${t.roughness}\n}`)), t.metalness && (i = i.replace("#include <metalnessmap_fragment>", `#include <metalnessmap_fragment>\n{\n${t.metalness}\n}`)), t.normal && (i = i.replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\n{\n${t.normal}\n}\nnormal = normalize(normal + (viewMatrix * vec4(cgBump, 0.0)).xyz);`)), t.emissive && (i = i.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n{\n${t.emissive}\n}`)), t.ao && (i = i.replace("#include <aomap_fragment>", `#include <aomap_fragment>\n{\n${t.ao}\n}\nreflectedLight.indirectDiffuse *= cgAO; reflectedLight.indirectSpecular *= mix(1.0, cgAO, 0.7);`)), e.vertexShader = n, e.fragmentShader = i;
	}, n;
}
function Yt(e) {
	let t = 2166136261;
	for (let n = 0; n < e.length; n++) t ^= e.charCodeAt(n), t = Math.imul(t, 16777619);
	return (t >>> 0).toString(36);
}
function Xt(t, n, r, i = !0) {
	let a = document.createElement("canvas");
	a.width = t, a.height = n;
	let o = a.getContext("2d");
	if (!o) throw Error("2D canvas unavailable");
	r(o);
	let s = new e.CanvasTexture(a);
	return i && (s.colorSpace = e.SRGBColorSpace), s.anisotropy = 4, s.needsUpdate = !0, s;
}
//#endregion
//#region src/gate-kit/world/materials.ts
var Zt = new e.DataTexture(new Uint8Array([
	255,
	255,
	255,
	255
]), 1, 1);
Zt.needsUpdate = !0;
function Qt(e = 0) {
	return et("wood", e > .5) || Jt({
		name: e ? "timber-dark" : "timber",
		params: {
			color: 16777215,
			roughness: .92,
			metalness: 0,
			envMapIntensity: .05
		},
		uniforms: { uDark: { value: e } },
		head: "uniform float uDark;",
		color: "\n      // vertical grain and long weather streaks\n      float grain = cgFbm2(vec2(cgP.x * 5.0 + cgP.z * 3.0, cgP.y * 0.55));\n      float fine = cgNoise2(vec2(cgP.x * 22.0 + cgP.z * 14.0, cgP.y * 2.2));\n      vec3 warm = mix(vec3(0.055, 0.033, 0.026), vec3(0.115, 0.07, 0.048), grain * 0.8 + fine * 0.2);\n      vec3 grey = mix(vec3(0.07, 0.066, 0.058), vec3(0.155, 0.148, 0.132), grain);\n      // old red lacquer survives in patches, mostly near the top\n      float paint = smoothstep(0.52, 0.72, cgFbm2(vec2(cgP.x * 1.3 + cgP.z * 1.1, cgP.y * 1.4) + 3.1));\n      paint *= smoothstep(0.4, 3.0, cgP.y) * (1.0 - smoothstep(4.2, 5.4, cgP.y));\n      vec3 c = mix(warm, grey, smoothstep(0.35, 0.7, grain) * 0.35);\n      // long vertical checking cracks and sun cracks\n      float crack = smoothstep(0.72, 0.88, cgRidge2(vec2((cgP.x + cgP.z) * 10.0, cgP.y * 0.55)));\n      c *= 1.0 - crack * 0.55;\n      // knots and resin scars\n      float knot = smoothstep(0.82, 0.94, cgNoise2(vec2((cgP.x - cgP.z) * 7.0, cgP.y * 1.1)));\n      c = mix(c, vec3(0.045, 0.028, 0.018), knot * 0.6);\n      c = mix(c, vec3(0.16, 0.045, 0.03), paint * 0.45);\n      // soot / damp at the foot, green algae in the lowest 0.8 m\n      c = mix(c, vec3(0.045, 0.038, 0.032), (1.0 - smoothstep(0.0, 1.1, cgP.y - 0.35)) * 0.55);\n      float algae = smoothstep(0.45, 0.8, cgFbm2(vec2(cgP.x * 2.2, cgP.y * 0.7) + 7.0)) * (1.0 - smoothstep(0.4, 2.2, cgP.y));\n      c = mix(c, vec3(0.10, 0.14, 0.07), algae * 0.45);\n      c = mix(c, c * 0.55, uDark);\n      c *= 0.9 + 0.18 * smoothstep(0.1, 2.0, cgN.y);\n      diffuseColor.rgb = c;\n    ",
		roughness: "\n      float grain = cgFbm2(vec2(cgP.x * 6.0, cgP.y * 0.7));\n      float damp = (1.0 - smoothstep(0.5, 2.2, cgP.y)) * 0.2;\n      roughnessFactor = clamp(0.72 + 0.2 * grain - damp, 0.36, 1.0);\n    ",
		normal: "\n      float e = 0.025;\n      float h0 = cgFbm2(vec2(cgP.x * 18.0, cgP.y * 1.1));\n      float hx = cgFbm2(vec2((cgP.x + e) * 18.0, cgP.y * 1.1));\n      float hz = cgFbm2(vec2(cgP.x * 18.0, (cgP.y + e) * 1.1));\n      cgBump = vec3(h0 - hx, h0 - hz, 0.0) * 1.5;\n    "
	});
}
function $t() {
	return et("plaster") || Jt({
		name: "plaster",
		params: {
			color: 16777215,
			roughness: .9
		},
		color: "\n      float n = cgFbm2(vec2(cgP.x * 0.9 + cgP.z * 0.9, cgP.y * 0.7));\n      float fine = cgNoise2(vec2(cgP.x * 8.0 + cgP.z * 4.0, cgP.y * 6.0));\n      vec3 c = mix(vec3(0.18, 0.13, 0.052), vec3(0.30, 0.215, 0.09), n * 0.8 + fine * 0.2);\n      // vertical rain wash and hairline cracks\n      float streak = smoothstep(0.6, 0.9, cgNoise2(vec2(cgP.x * 4.0 + cgP.z * 2.0, cgP.y * 0.15)));\n      c *= 1.0 - streak * 0.28;\n      float crack = smoothstep(0.7, 0.9, cgRidge2(vec2((cgP.x + cgP.z) * 5.0, cgP.y * 0.25)));\n      c *= 1.0 - crack * 0.3;\n      c = mix(c, vec3(0.30, 0.245, 0.16), (1.0 - smoothstep(0.35, 1.4, cgP.y - 0.35)) * 0.5);\n      float algae = smoothstep(0.4, 0.85, cgFbm2(vec2(cgP.x * 1.8 + cgP.z, cgP.y * 1.1) + 6.0));\n      c = mix(c, vec3(0.12, 0.15, 0.065), algae * (1.0 - smoothstep(0.3, 1.2, cgP.y - 0.3)) * 0.55);\n      diffuseColor.rgb = c;\n    "
	});
}
function en() {
	return Jt({
		name: "cover-tile",
		params: {
			color: 16777215,
			roughness: .95,
			metalness: 0,
			side: e.DoubleSide,
			vertexColors: !0,
			envMapIntensity: .06
		},
		color: "\n      float n = cgNoise2(cgP.xz * 3.0 + cgP.y * 2.0);\n      vec3 c = mix(vec3(0.07,0.072,0.074), vec3(0.15,0.152,0.155), n);\n      float moss = smoothstep(0.55, 0.8, cgFbm2(vec2(cgP.x * 0.9, cgP.z * 0.9) + 3.0));\n      c = mix(c, vec3(0.18,0.23,0.08), moss * 0.65);\n      c *= 0.85 + 0.25 * smoothstep(0.2, 1.0, cgN.y);\n      diffuseColor.rgb = c;\n    "
	});
}
function tn() {
	return Jt({
		name: "gold",
		params: {
			color: 16777215,
			roughness: .42,
			metalness: .75
		},
		color: "\n      float n = cgFbm2(cgP.xy * 3.0 + cgP.z * 2.0);\n      vec3 c = mix(vec3(0.42,0.28,0.08), vec3(0.82,0.60,0.22), n * 0.7 + 0.3);\n      diffuseColor.rgb = c;\n    "
	});
}
//#endregion
//#region src/world/surface_finish.ts
function nn(t, n, r) {
	let i = t.getAttribute("position"), a = t.getAttribute("normal"), o = t.getAttribute("color");
	t.computeBoundingBox();
	let s = r ?? t.boundingBox.min.y, c = new Uint8Array(i.count * 3);
	for (let t = 0; t < i.count; t++) {
		let r = i.getX(t), l = i.getY(t), u = i.getZ(t), d = .965 + .025 * Math.sin(r * .37 + u * .29) + .01 * Math.cos(l * .8 + u * .17), f = 1 - e.MathUtils.smoothstep(l - s, .04, n === "bark" ? 1.65 : 1.1), p = f * (1 - Math.abs(a?.getY(t) ?? 0)) * (n === "plaster" ? .16 : n === "bark" ? .2 : .11), m = n === "bark" ? f * .035 : n === "stone" ? f * .012 : 0, h = [
			d * (1 - p) - m,
			d * (1 - p),
			d * (1 - p) - m * 1.25
		];
		for (let n = 0; n < 3; n++) {
			let r = o ? n === 0 ? o.getX(t) : n === 1 ? o.getY(t) : o.getZ(t) : 1;
			c[t * 3 + n] = Math.round(e.MathUtils.clamp(r * h[n], 0, 1) * 255);
		}
	}
	return t.setAttribute("color", new e.Uint8BufferAttribute(c, 3, !0)), t.userData.surfaceFinish = n, t;
}
//#endregion
//#region ../scripts/lingyin_columns.js
var rn = [
	[-7.7, -4.75],
	[7.7, -4.75],
	[-7.7, -2],
	[7.7, -2],
	[-5.5, .5],
	[5.5, .5]
], an = [
	{
		role: "bronze",
		rt: .79,
		rb: .85,
		h: .24,
		y: 1.47,
		segments: 32
	},
	{
		role: "lacquer",
		rt: .58,
		rb: .66,
		h: 7.67,
		y: 5.535,
		segments: 32
	},
	{
		role: "gilt",
		rt: .63,
		rb: .63,
		h: .075,
		y: 1.73,
		segments: 32
	},
	{
		role: "gilt",
		rt: .66,
		rb: .62,
		h: .12,
		y: 9.19,
		segments: 32
	}
], on = {
	x: 0,
	z: -.55,
	scale: .66
}, sn = [
	[.43, 0],
	[.72, .14],
	[.92, .48],
	[1.02, .78],
	[.92, .86],
	[.74, .77],
	[.66, .52],
	[.3, .47]
], cn = [
	{
		name: "backscreen",
		role: "darkWood",
		w: 17.4,
		h: 7.65,
		d: .22,
		x: 0,
		y: 3.89,
		z: -6.67,
		support: !1
	},
	{
		name: "dais-lower",
		role: "darkWood",
		w: 16.2,
		h: .38,
		d: 3.5,
		x: 0,
		y: .19,
		z: -4.72,
		support: !0
	},
	{
		name: "dais-upper",
		role: "darkWood",
		w: 14.4,
		h: .28,
		d: 2.8,
		x: 0,
		y: .48,
		z: -4.8,
		support: !0
	},
	{
		name: "altar-top",
		role: "darkWood",
		w: 13.5,
		h: .2,
		d: 1.25,
		x: 0,
		y: 1.2,
		z: -2.06,
		support: !0
	},
	{
		name: "altar-apron",
		role: "darkWood",
		w: 13.3,
		h: .48,
		d: .22,
		x: 0,
		y: .84,
		z: -1.44,
		support: !1
	},
	...[
		-4.6,
		0,
		4.6
	].flatMap((e, t) => [{
		name: `statue-pad-${t}`,
		role: "bronze",
		w: e === 0 ? 3.85 : 3,
		h: .24,
		d: 2.1,
		x: e,
		y: .71,
		z: -4.85,
		support: !0
	}, {
		name: `statue-pad-cap-${t}`,
		role: "gilt",
		w: e === 0 ? 3.7 : 2.88,
		h: .07,
		d: 2,
		x: e,
		y: .87,
		z: -4.85,
		support: !0
	}]),
	...[
		-6.3,
		-3.2,
		0,
		3.2,
		6.3
	].map((e, t) => ({
		name: `altar-leg-${t}`,
		role: "lacquer",
		w: .34,
		h: 1,
		d: .37,
		x: e,
		y: .57,
		z: -2.55,
		support: !1
	}))
];
function ln(e) {
	let t = [], n = e.w / 2, r = e.d / 2, i = Math.max(3, Math.round(e.w / 3.4)), a = Math.max(2, Math.round(e.d / 3.6)), o = e.eave - e.plinth - .35;
	for (let a of [-1, 1]) for (let s = 0; s <= i; s++) {
		let c = -n + 1 + (e.w - 2) * s / i;
		e.name === "main" && a === 1 && Math.abs(c) < 1.6 || e.name === "gate" && Math.abs(c) < 1 || t.push({
			x: c,
			z: a * (r - .9),
			height: e.name === "gate" && Math.abs(c) > 4 ? 3.7 : o
		});
	}
	for (let i of [-1, 1]) for (let s = 1; s < a; s++) t.push({
		x: i * (n - .9),
		z: -r + 1 + (e.d - 2) * s / a,
		height: e.name === "gate" ? 3.7 : o
	});
	return t;
}
//#endregion
//#region src/world/temple.ts
var un = class {
	group = new e.Group();
	materials;
	enrichedSmallHalls;
	anchors = {
		burner: new e.Vector3(-2, 3.25, 22),
		door: new e.Vector3(-2, 4.4, 2),
		eaves: []
	};
	roles = {
		stone: [],
		floor: [],
		wall: [],
		paper: [],
		gatePlaster: [],
		wood: [],
		woodDark: [],
		dougong: [],
		roof: [],
		mainRoof: [],
		gateRoof: [],
		gold: [],
		bronze: [],
		lattice: [],
		lantern: [],
		dark: [],
		window: [],
		mainStone: [],
		mainWall: [],
		mainWood: [],
		mainWoodDark: [],
		mainDougong: [],
		mainLattice: [],
		mainWindow: []
	};
	constructor(t = {}) {
		this.enrichedSmallHalls = t.enrichedSmallHalls === !0, this.group.name = t.onlyMainHall ? "temple-main-hall-only" : "temple";
		let n = O.platform.y;
		this.materials = {
			stone: R(.2),
			floor: rt(),
			wall: ht(),
			paper: new e.MeshStandardMaterial({
				color: 12958628,
				map: tt(),
				bumpMap: tt(),
				bumpScale: .009,
				roughness: .96,
				metalness: 0,
				side: e.DoubleSide
			}),
			gatePlaster: $t(),
			wood: gt(!1),
			woodDark: Qt(1),
			dougong: bt(),
			roof: st(),
			mainRoof: ct(),
			gateRoof: st(),
			gold: _t(),
			bronze: yt(),
			lattice: gt(!0),
			lantern: St(),
			window: xt(),
			mainStone: ut(),
			mainWall: lt(),
			mainWood: dt(!1),
			mainWoodDark: dt(!0),
			mainDougong: pt(),
			mainLattice: dt(!0),
			mainWindow: mt(),
			dark: new e.MeshStandardMaterial({
				color: 2896429,
				roughness: .95,
				metalness: 0
			})
		}, this.materials.gateRoof.color.set("#aab89a"), t.onlyMainHall || (this.buildPlatform(n), t.omitGateVisual || this.buildHall({
			x: -2,
			z: 40,
			w: 15,
			d: 8.5,
			eave: 6.6,
			rise: 2.9,
			plinth: .8,
			name: "gate",
			openFront: !0,
			plaque: "靈隱寺"
		})), this.buildHall({
			...S,
			eave: t.studyHallEave ?? 8,
			rise: 5,
			double: !0,
			plaque: "大雄寶殿",
			studyFacade: t.studyFacade
		}), t.onlyMainHall || (this.buildHall({
			x: -25.5,
			z: 7,
			w: 9,
			d: 16,
			eave: 5,
			rise: 2.5,
			plinth: .7,
			rotY: Math.PI / 2,
			name: "west"
		}), this.buildHall({
			x: 19,
			z: 7,
			w: 9,
			d: 16,
			eave: 5,
			rise: 2.5,
			plinth: .7,
			rotY: -Math.PI / 2,
			name: "east"
		}), this.buildPagoda(-31, 33, n), this.buildEnclosure(n)), t.omitMainHallShrine || this.buildBuddha(n), this.finalize();
	}
	add(e, t) {
		this.roles[e].push(t);
	}
	addAt(e, t, n, r, i, a = 0) {
		a && t.rotateY(a), t.translate(n, r, i), this.roles[e].push(t);
	}
	buildPlatform(e) {
		let t = O.platform;
		this.add("stone", M(2.2, .5, 1, t.x0, e - .05, 0, 0)), this.add("stone", M(2.2, .5, 1, t.x1, e - .05, 0, 0)), this.add("stone", M(t.x1 - t.x0 + 2.2, .5, 1.2, (t.x0 + t.x1) / 2, e - .05, t.z1)), this.add("stone", M(t.x1 - t.x0 + 2.2, .5, 1.2, (t.x0 + t.x1) / 2, e - .05, t.z0));
		for (let n = 0; n < 6; n++) this.add("stone", M(9 - n * .25, .19, .5, -2, e - .2 - n * .19, t.z1 + .6 + n * .48));
		for (let n = 0; n < 5; n++) this.add("stone", M(.55, .2, 5.2, t.x1 + .4 + n * .5, e - .2 - n * .2, 28));
	}
	balustrade(e, t, n, r, i, a = !1) {
		let o = Math.abs(t - e);
		if (o < 1) return;
		let s = Math.max(2, Math.round(o / 2.4));
		for (let a = 0; a <= s; a++) {
			let c = a / s, l = e + (t - e) * c, u = i === "x" ? l : n, d = i === "x" ? n : l;
			if (this.add("stone", M(.24, .95, .24, u, r + .475, d)), this.add("stone", M(.34, .12, .34, u, r + .98, d)), a < s) {
				let c = (a + .5) / s, l = e + (t - e) * c, u = i === "x" ? l : n, d = i === "x" ? n : l, f = i === "x" ? o / s : .14, p = i === "x" ? .14 : o / s;
				this.add("stone", M(f, .16, p, u, r + .74, d));
			}
		}
	}
	buildHall(t) {
		let n = t.name === "gate", r = t.eave - t.plinth, i = t.w / 2, a = t.d / 2, o = {
			stone: [],
			floor: [],
			wall: [],
			paper: [],
			gatePlaster: [],
			wood: [],
			woodDark: [],
			dougong: [],
			roof: [],
			mainRoof: [],
			gateRoof: [],
			gold: [],
			bronze: [],
			lattice: [],
			lantern: [],
			dark: [],
			window: [],
			mainStone: [],
			mainWall: [],
			mainWood: [],
			mainWoodDark: [],
			mainDougong: [],
			mainLattice: [],
			mainWindow: []
		}, s = !0, c = {
			stone: "mainStone",
			wall: "mainWall",
			wood: "mainWood",
			woodDark: "mainWoodDark",
			dougong: "mainDougong",
			lattice: "mainLattice",
			window: "mainWindow",
			roof: "mainRoof"
		}, l = (e) => s && t.name === "main" ? c[e] ?? e : e, u = (e, t) => o[l(e)].push(t);
		u("stone", M(t.w + 2.4, t.plinth + .25, t.d + 2.4, 0, (t.plinth + .25) / 2, 0)), u("stone", M(t.w + 2.9, .16, t.d + 2.9, 0, .1, 0));
		for (let e = 0; e < 5; e++) u("stone", M(5, .16, .42, 0, .16 + e * .16, a + 1.35 + (4 - e) * .4 + (t.plinth - .8) * .25)), t.name === "gate" && u("stone", M(5, .16, .42, 0, .16 + e * .16, -a - 1.35 - (4 - e) * .4));
		let d = r - .35;
		for (let e of ln(t)) this.column(o, e.x, .25, e.z, e.height, l);
		let f = n ? 3.55 : d - .4, p = .3, m = .25 + f / 2, h = 1.35, g = (e, n, r, i) => u("stone", M(e + .04, .22, n + .085, r, t.plinth + .3, i));
		if (t.openFront) {
			let e = i - 2.05;
			for (let t of [-1, 1]) u("wall", M(3.8, f, p, t * e, m, a - h)), g(3.8, p, t * e, a - h);
		} else {
			let e = t.name === "main" ? 5.4 : t.name === "rear" ? 4.6 : 3.4, n = (t.w - h * 2 - e) / 2;
			u("wall", M(n, f, p, -(e / 2 + n / 2), m, a - h)), u("wall", M(n, f, p, e / 2 + n / 2, m, a - h)), g(n, p, -(e / 2 + n / 2), a - h), g(n, p, e / 2 + n / 2, a - h), t.name === "main" && t.studyFacade || u("wood", M(e + .3, .35, p + .1, 0, .25 + f, a - h));
		}
		if (t.openFront || t.name === "west") {
			let e = t.name === "west" ? 3.4 : 4.6, n = (t.w - h * 2 - e) / 2;
			for (let t of [-1, 1]) u("wall", M(n, f, p, t * (e / 2 + n / 2), m, -a + h));
			for (let t of [-1, 1]) g(n, p, t * (e / 2 + n / 2), -a + h);
			u("wood", M(e + .3, .35, .42, 0, .25 + f, -a + h));
		} else u("wall", M(t.w - h * 2, f, p, 0, m, -a + h)), g(t.w - h * 2, p, 0, -a + h);
		for (let e of [-1, 1]) {
			u("wall", M(p, f, t.d - h * 2, e * (i - h), m, 0)), g(p, t.d - h * 2, e * (i - h), 0);
			let n = Math.min(1.7, f * .5), r = Re(Math.min(3.4, t.d * .32), n, .22, .05, .02);
			r.bars.rotateY(e * Math.PI / 2), r.backing.rotateY(e * Math.PI / 2), r.bars.translate(e * (i - h + .18), m + .15, 0), r.backing.translate(e * (i - h + .1), m + .15, 0), u("lattice", r.bars), u("window", r.backing);
		}
		if (!t.openFront) {
			let n = t.w > 20 ? 5 : 3, r = (t.w - 2.2) / n, o = Math.floor(n / 2), s = Array.from({ length: n }, (e, t) => t);
			for (let n of s) {
				let s = -i + 1.1 + r * (n + .5), c = r - .35, l = Math.min(f - .55, 3.5);
				if (n === o) {
					u("gold", M(.16, l, .2, s - c / 2 - .1, .25 + l / 2, a - h + .2)), u("gold", M(.16, l, .2, s + c / 2 + .1, .25 + l / 2, a - h + .2)), t.name === "main" && t.studyFacade || u("gold", M(c + .2, .18, .2, s, .25 + l + .12, a - h + .2));
					continue;
				}
				let d = Re(c, l, .17, .055, a - h + .18);
				d.bars.translate(s, 0, 0), d.backing.translate(s, 0, 0), u("lattice", d.bars), u("woodDark", d.backing), u("wood", M(c + .18, .16, .24, s, .25 + l + .1, a - h + .18)), u("wood", M(.16, l + .2, .24, s - c / 2 - .09, .25 + l / 2, a - h + .18)), u("wood", M(.16, l + .2, .24, s + c / 2 + .09, .25 + l / 2, a - h + .18)), u("woodDark", M(c, l * .34, .1, s, .25 + l * .17, a - h + .1));
				for (let t = -2; t <= 2; t++) for (let n = 0; n < 2; n++) u("gold", new e.SphereGeometry(.035, 6, 4).translate(s + t * .62, 1 + n * .32, a - h + .06));
			}
		}
		if (t.name === "main") {
			let e = .45, n = t.w / 2 + 1.2, r = t.d / 2 + 1.45;
			for (let t = 0; t <= 14; t++) {
				let i = -n + 2 * n * t / 14;
				Math.abs(i) < 3.6 || (u("stone", M(.24, .9, .24, i, e + .45, r)), u("stone", M(.26, .1, .26, i, e + .92, r)));
			}
			for (let t = 0; t <= 10; t++) {
				let i = -r + 2 * r * t / 10;
				for (let t of [-1, 1]) u("stone", M(.24, .9, .24, t * n, e + .45, i)), u("stone", M(.26, .1, .26, t * n, e + .92, i));
			}
			for (let t of [-1, 1]) u("stone", M(.16, .16, 2 * r, t * n, e + .8, 0));
			for (let t of [-1, 1]) u("stone", M(n - 3.6, .16, .16, t * (n + 3.6) / 2, e + .8, r));
		}
		if (s = !1, !(this.enrichedSmallHalls && [
			"west",
			"east",
			"rear"
		].includes(t.name ?? ""))) {
			let o = t.w - h * 2 - .55, s = t.d - h * 2 - .55, c = t.plinth + .25, l = 1.35, d = Math.floor(o / l), f = Math.floor(s / l);
			for (let e = 0; e < f; e++) for (let t = 0; t < d; t++) {
				let n = -o / 2 + (t + .5) * o / d, r = -s / 2 + (e + .5) * s / f, i = (t * 11 + e * 7) % 7 * .002;
				u("floor", it(M(o / d - .018, .045, s / f - .018, n, c + .005 + i, r), .82 + (t * 13 + e * 7) % 11 * .022));
			}
			for (let e of [-1, 1]) {
				u("woodDark", M(.11, .44, s, e * o / 2, c + .22, 0)), u("bronze", M(.025, .035, s, e * o / 2, c + .45, 0));
				for (let t of [-s * .24, s * .24]) {
					let n = Re(Math.min(2.5, s * .32), 2.1, .26, .055, 0);
					n.bars.rotateY(Math.PI / 2), n.backing.rotateY(Math.PI / 2), n.bars.translate(e * (i - h - .23), c + .77, t), n.backing.translate(e * (i - h - .27), c + .77, t), u("lattice", n.bars), u("paper", n.backing);
				}
			}
			for (let e of [-s / 2, s / 2]) if (e > 0 || t.name === "gate" || t.name === "west") {
				let n = t.name === "main" ? 5.4 : t.name === "rear" || t.name === "gate" ? 4.6 : 3.4, r = (o - n) / 2;
				for (let t of [-1, 1]) {
					let i = t * (n / 2 + r / 2);
					u("woodDark", M(r, .44, .11, i, c + .22, e)), u("bronze", M(r, .035, .025, i, c + .45, e));
				}
			} else u("woodDark", M(o, .44, .11, 0, c + .22, e)), u("bronze", M(o, .035, .025, 0, c + .45, e));
			let p = Math.max(c + 2.9, r - .35);
			for (let e = 0; !n && e < Math.max(2, Math.floor(s / 3.4)); e++) {
				let t = -s / 2 + (e + .5) * s / Math.max(2, Math.floor(s / 3.4));
				u("wood", M(o + .2, .2, .24, 0, p, t));
				for (let e of [-o / 3, o / 3]) u("dougong", M(.4, .32, .4, e, p - .25, t));
			}
			if (t.name !== "gate" && t.name !== "main" && t.name !== "west") {
				let t = -a + 2.7, n = Math.min(5.5, o * .62);
				u("woodDark", M(n, .16, 1.22, 0, c + .93, t)), u("bronze", M(n + .12, .07, 1.3, 0, c + 1.04, t)), u("woodDark", M(n - .35, .13, 1.05, 0, c + .26, t));
				for (let e of [-1, 1]) for (let r of [-1, 1]) {
					let i = e * (n / 2 - .24), a = t + r * .42;
					u("wood", M(.22, .78, .22, i, c + .45, a)), u("bronze", M(.24, .06, .24, i, c + .83, a));
				}
				u("gold", M(n - .4, .055, .055, 0, c + .73, t + .59)), u("wood", M(n + .3, 2.7, .22, 0, c + 2.35, t - .72)), u("gold", N(.5, .58, .13, 20, 0, c + 1.2, t)), u("gold", N(.34, .51, .63, 20, 0, c + 1.58, t)), u("gold", new e.SphereGeometry(.29, 18, 14).translate(0, c + 2.03, t)), u("gold", new e.TorusGeometry(.44, .045, 8, 28).translate(0, c + 1.99, t - .24));
				for (let r of [-1, 1]) u("bronze", N(.085, .11, .55, 10, r * Math.min(1.75, n * .32), c + 1.24, t + .1)), u("lantern", new e.SphereGeometry(.12, 10, 8).translate(r * Math.min(1.75, n * .32), c + 1.56, t + .1));
				for (let e of [-1, 1]) {
					let r = e * n * .34;
					u("bronze", N(.14, .22, .28, 12, r, c + 1.2, t + .3));
					for (let e = 0; e < 3; e++) u("woodDark", N(.012, .015, .55 + e * .08, 6, r + (e - 1) * .045, c + 1.56, t + .3));
				}
			}
		}
		if (s = !0, !n) {
			u("wood", M(t.w + .4, .42, .42, 0, r - .2, a - .9)), u("wood", M(t.w + .4, .42, .42, 0, r - .2, -a + .9));
			for (let e of [-1, 1]) u("wood", M(.42, .42, t.d - 1.6, e * (i - .9), r - .2, 0));
			u("wood", M(t.w + 1.4, .34, .7, 0, r + .05, a - .3)), u("wood", M(t.w + 1.4, .34, .7, 0, r + .05, -a + .3));
			let n = this.dougongCluster(), o = Math.max(3, Math.round(t.w / 2.3));
			for (let e = 0; e <= o; e++) {
				let s = -i + .9 + (t.w - 1.8) * e / o;
				for (let e of [-1, 1]) {
					let t = n.clone();
					t.translate(s, r - .05, e * (a - .75)), u("dougong", t);
				}
			}
			let s = Math.max(2, Math.round(t.d / 2.5));
			for (let e = 1; e < s; e++) {
				let o = -a + .9 + (t.d - 1.8) * e / s;
				for (let e of [-1, 1]) {
					let t = n.clone();
					t.rotateY(Math.PI / 2), t.translate(e * (i - .75), r - .05, o), u("dougong", t);
				}
			}
			let c = Math.round((t.w + 2) / .42);
			for (let e = 0; e <= c; e++) {
				let n = -i - .8 + (t.w + 1.6) * e / c;
				for (let t of [-1, 1]) {
					let i = M(.1, .12, 1.45, n, r + .02, t * (a + .45));
					i.rotateX(.12 * t), u(e % 2 ? "wood" : "dougong", i);
				}
			}
			let l = Math.round((t.d + 2) / .42);
			for (let e = 0; e <= l; e++) {
				let n = -a - .8 + (t.d + 1.6) * e / l;
				for (let t of [-1, 1]) {
					let a = M(1.45, .12, .1, t * (i + .45), r + .02, n);
					a.rotateZ(-.12 * t), u(e % 2 ? "wood" : "dougong", a);
				}
			}
			let d = Math.max(2, Math.round(t.w / 6));
			for (let n = 0; n <= d; n++) {
				let o = -i + 1.4 + (t.w - 2.8) * n / d, s = r - 1.05, c = a + .15, l = new e.SphereGeometry(.17, 10, 8);
				l.scale(1, 1.18, 1), l.translate(o, s, c), u("lantern", l), u("gold", N(.09, .09, .08, 8, o, s + .3, c)), u("gold", N(.09, .09, .08, 8, o, s - .3, c)), u("gold", N(.012, .012, .55, 4, o, s + .6, c));
			}
		}
		if (n) {
			let e = 9.1, n = r + .16;
			u("gateRoof", Fe({
				w: e,
				d: t.d,
				eaveY: n,
				rise: 3.05,
				cornerLift: .88,
				overhang: 1.25,
				nu: 34,
				nv: 14
			})), this.ridgeAndTips(o, e, t.d, n + 3.05, n), u("wood", M(8.9, .14, t.d + .35, 0, r - .1, 0));
			for (let e of [
				-3.45,
				-1.72,
				0,
				1.72,
				3.45
			]) u("woodDark", M(8.9, .2, .24, 0, r - .28, e));
			for (let e of [-3.65, 3.65]) u("woodDark", M(.22, .2, t.d + .35, e, r - .28, 0));
			u("woodDark", M(8.9, 2.1, .32, 0, r - 1.07, -a + 1.35));
			for (let e of [-1, 1]) {
				let n = Fe({
					w: 5.6,
					d: t.d,
					eaveY: 3.84,
					rise: 1.45,
					cornerLift: .52,
					overhang: 1.1,
					nu: 24,
					nv: 11
				});
				n.translate(e * 5.15, 0, 0), u("gateRoof", n), u("woodDark", M(6.1, .28, .42, e * 5.15, 3.62, a - .25)), u("woodDark", M(6.1, .28, .42, e * 5.15, 3.62, -a + .25));
			}
			for (let e of [-1, 1]) {
				for (let t of [-a + .82, a - .82]) u("woodDark", M(.62, r - .35, .7, e * 3.22, (r - .35) / 2 + .25, t));
				u("dougong", M(1.22, .29, 1.55, e * 3.22, r - .25, a - .25));
			}
			u("woodDark", M(8.9, .7, .7, 0, r - .63, a - .35)), u("wood", M(9.5, .3, .62, 0, r + .02, a - .3)), u("wood", M(9.5, .3, .62, 0, r + .02, -a + .3)), u("bronze", M(8.75, .05, .75, 0, r - .27, a - .35));
		} else if (t.double) {
			let e = t.name === "main" ? "mainRoof" : "roof";
			u(e, Ie({
				wOuter: t.w + 3.4,
				dOuter: t.d + 3.4,
				wInner: t.w - 1.2,
				dInner: t.d - 1.2,
				eaveY: r + .1,
				rise: 1.15,
				cornerLift: .55,
				nu: 34,
				nv: 8
			}));
			let n = r + 3;
			u("wall", M(t.w - 2.2, 3, t.d - 2.2, 0, r + 1.5, 0));
			for (let e = 0; e <= 12; e++) u("wood", M(.1, .7, .1, -i + 1.2 + (t.w - 2.4) * e / 12, r + .55, a - 1.05));
			u("wood", M(t.w - 2.4, .12, .14, 0, r + .9, a - 1.05));
			for (let e = 0; e < 5; e++) {
				let n = -i + 1.6 + (t.w - 3.2) * (e + .5) / 5, o = Re((t.w - 3.2) / 5 - .25, 1.4, .24, .07, a - .95);
				o.bars.translate(n, r + 1.55, 0), o.backing.translate(n, r + 1.55, 0), u("lattice", o.bars), u("window", o.backing);
				for (let e = 0; e <= 4; e++) u("wood", M(.08, 1.4, .12, n - (t.w - 3.2) / 10 + e * ((t.w - 3.2) / 20), r + 1.55 + .7, a - .88));
			}
			u("wood", M(t.w + .6, .35, .5, 0, n, a - .7)), u("wood", M(t.w + .6, .35, .5, 0, n, -a + .7)), u(e, Fe({
				w: t.w - 1.4,
				d: t.d - 1.4,
				eaveY: n + .2,
				rise: t.rise + .4,
				cornerLift: .95,
				overhang: 1.45,
				nu: 38,
				nv: 16
			})), this.ridgeAndTips(o, t.w - 1.4, t.d - 1.4, n + .2 + t.rise + .4, n + .2, e);
		} else u("roof", Fe({
			w: t.w,
			d: t.d,
			eaveY: r + .15,
			rise: t.rise,
			cornerLift: .9,
			overhang: 1.25,
			nu: 36,
			nv: 15
		})), this.ridgeAndTips(o, t.w, t.d, r + .15 + t.rise, r + .15);
		if (n) for (let t of [
			{
				x: 0,
				half: 5.75,
				y: r + .12,
				z: a + 1.25
			},
			{
				x: -5.15,
				half: 3.9,
				y: 3.81,
				z: a + 1.1
			},
			{
				x: 5.15,
				half: 3.9,
				y: 3.81,
				z: a + 1.1
			}
		]) {
			let n = Math.round(t.half * 2 / .32);
			for (let r = 0; r <= n; r++) {
				let i = t.x - t.half + 2 * t.half * r / n, a = new e.CylinderGeometry(.065, .065, .075, 8);
				a.rotateX(Math.PI / 2), a.translate(i, t.y, t.z), u("gateRoof", a);
			}
		}
		else if (!t.studyFacade) {
			let n = t.double ? r + 2.1 : r + .15, i = t.w / 2 + 1.1, a = Math.round(i * 2 / .34);
			for (let r = 0; r <= a; r++) {
				let o = -i + 2 * i * r / a;
				for (let r of [-1, 1]) {
					let i = new e.CylinderGeometry(.075, .075, .05, 8);
					i.rotateX(Math.PI / 2), i.translate(o, n - .06, r * (t.d / 2 + 1.1)), u("roof", i);
				}
			}
		}
		for (let t of n ? [] : [-1, 1]) for (let n of [-1, 1]) {
			let o = 1.15;
			u("bronze", N(.14, .2, .5, 8, t * (i + o), r - .55, n * (a + o))), u("bronze", new e.SphereGeometry(.09, 8, 6).translate(t * (i + o), r - .85, n * (a + o)));
		}
		if (n) {
			for (let e of [-1, 1]) {
				let t = e * (i - 2.2), n = a - h + .23;
				u("gatePlaster", M(2.42, 2.57, .045, t, 2.02, n - .08));
				let r = Re(1.64, 1.67, .21, .065, n + .05);
				r.bars.translate(t, 1.25, 0), r.backing.translate(t, 1.25, 0), u("lattice", r.bars), u("woodDark", r.backing);
				for (let e of [-1.23, 1.23]) u("woodDark", M(.13, 2.72, .16, t + e, 1.98, n + .025));
				for (let e of [.63, 3.34]) u("woodDark", M(2.58, .13, .16, t, e, n + .025));
			}
			u("woodDark", M(8.9, .5, .22, 0, r - 1.06, a + .3));
		}
		if (t.plaque) {
			let n = t.name === "gate" || t.name === "main" ? Ye(t.name) : void 0, i = n ?? ze(t.plaque, 512, 150, {
				bg: "#17130f",
				fg: "#d9b46b",
				border: "#7b5a2a"
			}), o = n ? new e.MeshStandardMaterial({
				name: `lingyin-${t.name}-gilded-plaque`,
				map: i,
				roughness: .86,
				metalness: .02,
				side: e.DoubleSide
			}) : new e.MeshStandardMaterial({
				map: i,
				roughness: .55,
				metalness: .15,
				emissive: new e.Color("#3a2a12"),
				emissiveIntensity: .18
			}), s = t.name === "main" && t.studyFacade, c = t.name === "gate" ? 1.18 : 1.45, l = s ? r + 2.03 : .25 + Math.min(f - .55, 3.5) + c, d = s ? a - .71 : a + (t.name === "gate" ? .62 : -.35), p = s ? 5.5 : 4.2, m = s ? 1.52 : 1.2, h = new e.Mesh(new e.PlaneGeometry(p, m), o);
			if (h.position.set(t.x, O.platform.y + l, t.z + d), h.castShadow = !1, h.name = `plaque-${t.name}`, this.group.add(h), s) {
				u("woodDark", M(p + .36, m + .3, .17, 0, l, d - .16));
				for (let e of [-1, 1]) u("gold", M(p + .34, .055, .05, 0, l + e * (m / 2 + .11), d - .055)), u("gold", M(.055, m + .22, .05, e * (p / 2 + .12), l, d - .055));
			} else u("gold", M(4.5, 1.45, .16, 0, l, a + (t.name === "gate" ? .48 : -.48)));
		}
		let _ = t.rotY ?? 0, v = Math.cos(_), y = Math.sin(_);
		for (let e of Object.keys(o)) for (let n of o[e]) _ && n.rotateY(_), n.translate(t.x, O.platform.y, t.z), this.roles[e].push(n);
		let b = this.enrichedSmallHalls && [
			"west",
			"east",
			"rear"
		].includes(t.name ?? ""), x = new e.PointLight(b ? 16768432 : 16758647, t.name === "main" ? 6 : n ? 4.4 : b ? t.name === "rear" ? 14 : 10 : 2.8, t.name === "main" ? 18 : n ? 12 : b ? 13 : 10, 2);
		x.name = `temple-${t.name}-existing-room-light`, x.position.set(t.x, O.platform.y + (n ? 4.1 : b ? r - .88 : Math.max(3.2, t.plinth + 2.3)), t.z), this.group.add(x), this.anchors.eaves.push(new e.Vector3(t.x + y * (a + 1), O.platform.y + r, t.z + v * (a + 1))), t.name === "main" && this.anchors.door.set(t.x, O.platform.y + 1.6, t.z + a + 1.5);
	}
	column(e, t, n, r, i, a = (e) => e) {
		e[a("stone")].push(N(.4, .46, .24, 10, t, n + .06, r)), e[a("wood")].push(N(.27, .33, i - .24, 12, t, n + .24 + (i - .24) / 2, r)), e.gold.push(N(.31, .31, .08, 12, t, n + i - .16, r)), e.bronze.push(N(.33, .33, .05, 12, t, n + .36, r));
	}
	dougongCluster() {
		let e = [];
		return e.push(M(.42, .36, .42, 0, .18, 0)), e.push(M(1.5, .2, .3, 0, .46, 0)), e.push(M(.3, .2, 1.1, 0, .46, .2)), e.push(M(.46, .22, .46, -.45, .67, 0)), e.push(M(.46, .22, .46, 0, .67, 0)), e.push(M(.46, .22, .46, .45, .67, 0)), e.push(M(.22, .2, .9, 0, .67, 0)), P(e);
	}
	ridgeAndTips(t, n, r, i, a, o = "roof") {
		let s = n * .52 / 2;
		t[o].push(M(s * 2 + .6, .42, .42, 0, i + .18, 0));
		for (let e of [-1, 1]) {
			t[o].push(M(.34, 1.15, .4, e * (s + .35), i + .55, 0));
			let n = M(.28, .9, .34, e * (s + .55), i + 1.05, .1);
			n.rotateZ(-e * .35), t[o].push(n);
		}
		let c = n / 2 + 1.15, l = r / 2 + 1.15;
		for (let n of [-1, 1]) for (let r of [-1, 1]) {
			let u = new e.Vector3(n * s, i + .1, 0), d = new e.Vector3(n * c, a + .35, r * l).clone().sub(u), f = d.length(), p = new e.BoxGeometry(.34, f, .28);
			p.translate(0, f / 2, 0);
			let m = new e.Quaternion().setFromUnitVectors(new e.Vector3(0, 1, 0), d.normalize());
			p.applyQuaternion(m), p.translate(u.x, u.y, u.z), t[o].push(p);
		}
		let u = n / 2 + 1.15, d = r / 2 + 1.15;
		for (let n of [-1, 1]) for (let r of [-1, 1]) {
			let i = N(.05, .2, 1.15, 6, 0, 0, 0);
			i.rotateZ(-n * .55), i.rotateX(r * .3), i.translate(n * u, a + .45, r * d), t[o].push(i), t.gold.push(new e.SphereGeometry(.11, 8, 6).translate(n * u, a + .95, r * d));
		}
	}
	buildPagoda(t, n, r) {
		this.addAt("stone", N(3.1, 3.4, .7, 8), t, r + .35, n);
		let i = r + .7, a = 2.1;
		for (let e = 0; e < 5; e++) {
			let r = 2.25 - e * .1;
			this.addAt("stone", N(a - .12, a, r, 8), t, i + r / 2, n), this.addAt("dark", M(.7, 1.25, .2, 0, 0, 0), t, i + .75, n + a - .02), this.addAt("stone", N(a + .85, a + .2, .36, 8), t, i + r + .18, n), this.addAt("stone", N(a + .1, a + .1, .16, 8), t, i + r + .42, n);
			for (let e = 0; e < 8; e++) {
				let o = e / 8 * Math.PI * 2 + Math.PI / 8, s = N(.03, .1, .55, 5, 0, 0, 0);
				s.rotateZ(.7), s.rotateY(-o), s.translate(t + Math.cos(o) * (a + .85), i + r + .45, n + Math.sin(o) * (a + .85)), this.add("stone", s);
			}
			i += r + .5, a *= .87;
		}
		this.addAt("gold", N(.12, .3, 1.6, 8), t, i + .8, n);
		for (let r = 0; r < 4; r++) this.addAt("gold", new e.SphereGeometry(.22 - r * .03, 10, 8), t, i + .4 + r * .3, n);
		this.addAt("gold", new e.SphereGeometry(.16, 8, 6), t, i + 1.7, n);
	}
	buildEnclosure(t) {
		let n = O.platform, r = (n, r, i, a) => {
			let o = i - n, s = a - r, c = Math.hypot(o, s), l = (n + i) / 2, u = (r + a) / 2, d = Math.atan2(o, s), f = Math.cos(d), p = -Math.sin(d), m = -.02, h = 1.11, g = 1.03, _ = 3.33;
			this.add("stone", M(.86, h - m, c + .25, l, t + (m + h) / 2, u, d)), this.add("gatePlaster", M(.34, _ - g, c - .08, l, t + (g + _) / 2, u, d)), this.add("woodDark", M(.5, .18, c + .22, l, t + _ + .015, u, d));
			for (let n of [-1, 1]) {
				this.add("woodDark", M(.1, .16, c + .48, l + n * f * .88, t + _ + .06, u + n * p * .88, d));
				let r = new e.BoxGeometry(.95, .1, c + .5);
				r.rotateZ(n * .34), r.rotateY(d), r.translate(l + f * n * .38, t + _ + .2, u + p * n * .38), this.add("dark", r);
			}
			this.add("dark", M(.18, .14, c + .52, l, t + _ + .36, u, d));
			let v = Math.max(2, Math.ceil(c / 6.4));
			for (let e = 0; e <= v; e++) {
				let i = e / v;
				this.add("woodDark", M(.46, _ - g + .12, .46, n + o * i, t + (g + _) / 2, r + s * i, d));
			}
		};
		r(n.x0 + .5, n.z0 + 1, n.x0 + .5, 3.8), r(n.x0 + .5, 10.2, n.x0 + .5, n.z1 - 1);
		for (let e of [3.8, 10.2]) this.add("stone", M(.75, 3.7, .75, n.x0 + .5, t + 1.85, e));
		this.add("roof", M(1.25, .35, 7.1, n.x0 + .5, t + 4, 7)), this.add("wood", M(.22, .4, 2, n.x0 + .05, t + 3.45, 7));
		let i = new e.Mesh(new e.PlaneGeometry(1.76, .34), new e.MeshStandardMaterial({
			map: ze("西山道", 512, 128, {
				bg: "#302923",
				fg: "#d4b674",
				border: "#8f7755"
			}),
			roughness: .88,
			side: e.DoubleSide
		}));
		i.rotation.y = Math.PI / 2, i.position.set(n.x0 + .2, t + 3.45, 7), this.group.add(i), this.add("stone", M(4.25, .95, 3.2, -34.25, t + .475, 7)), this.add("floor", it(M(4.3, .06, 3.25, -34.25, t + .98, 7), .92)), this.balustrade(4.1, 9.9, n.x0 + .5, t + .98, "z"), r(n.x0 + .5, n.z0 + 1, n.x1 - .5, n.z0 + 1), r(n.x1 - .5, n.z0 + 1, n.x1 - .5, 23), r(n.x1 - .5, 33, n.x1 - .5, n.z1 - 1), this.add("wood", M(.4, 3.2, 1, n.x1 - .5, t + 2, 23.4)), this.add("wood", M(.4, 3.2, 1, n.x1 - .5, t + 2, 32.6)), this.add("roof", M(1.9, .3, 10.4, n.x1 - .5, t + 3.75, 28));
		for (let r of [-1, 1]) {
			let i = 28 + r * 4.58, a = n.x1 + 1.68;
			this.add("wood", M(4.38, 2.72, .22, a, t + 1.71, i));
			for (let e of [-1.98, 1.98]) this.add("bronze", M(.13, 2.8, .3, a + e, t + 1.71, i));
			for (let e of [
				.64,
				1.55,
				2.48
			]) this.add("bronze", M(4.25, .15, .3, a, t + e, i));
			for (let n of [
				-1.4,
				-.7,
				.7,
				1.4
			]) for (let r of [
				.56,
				1.08,
				1.85,
				2.37
			]) this.add("gold", new e.SphereGeometry(.055, 8, 6).translate(a + n, t + r, i - .14));
			let o = N(.09, .09, .055, 8, a - 1.62, t + 1.55, i - .16);
			o.rotateX(Math.PI / 2), this.add("bronze", o);
		}
		let a = [
			.34,
			.52,
			.66,
			.52,
			.34
		];
		for (let e = 0; e < a.length; e++) this.add("stone", M(2.55, .28, 4.6, 30.9 + e * 2.55, t + a[e] - .14, 28));
		for (let e = 0; e < 3; e++) {
			let n = .11 + e * .11;
			this.add("stone", M(.72, .18, 4.75, 28.38 + e * .72, t + n - .09, 28));
		}
		for (let e of [25.9, 30.1]) {
			for (let n = 0; n < a.length; n++) {
				let r = 30.9 + n * 2.55, i = t + a[n];
				this.add("stone", M(2.58, .17, .22, r, i + .93, e));
			}
			for (let n = 0; n <= 10; n++) {
				let r = n / 10, i = Math.min(4, Math.floor(r * 5));
				this.add("stone", M(.18, 1.02, .18, 29.2 + r * 14, t + a[i] + .48, e));
			}
		}
		for (let e of [31.3, 40.9]) this.add("stone", M(.78, 2.2, 3.8, e, t - .78, 28));
	}
	buildBuddha(t) {
		let n = S.x, r = S.z + 1.15, i = t + 1.1;
		this.add("bronze", N(1.58, 1.72, .18, 36).translate(n, i + .09, r)), this.add("bronze", N(1.43, 1.55, .38, 36).translate(n, i + .37, r)), this.add("gold", N(1.48, 1.52, .055, 36).translate(n, i + .19, r)), this.add("gold", N(1.34, 1.4, .07, 36).translate(n, i + .57, r)), this.add("bronze", N(1.17, 1.3, .15, 36).translate(n, i + .67, r));
		for (let t = 0; t < 2; t++) for (let a = 0; a < 18; a++) {
			let o = (a + t * .5) * Math.PI * 2 / 18, s = [], c = [], l = [];
			for (let e = 0; e <= 7; e++) {
				let a = e / 7, u = 1.09 + t * .07 + a * (t ? .28 : .38), d = (t ? .17 : .19) * Math.sin(Math.PI * (.12 + a * .88));
				for (let f = 0; f <= 5; f++) {
					let p = f / 5 * 2 - 1, m = o + p * d, h = .3 + t * .17 + a * (t ? .26 : .32) + (1 - p * p) * Math.sin(Math.PI * a) * .075;
					if (s.push(n + Math.sin(m) * u, i + h, r + Math.cos(m) * u), c.push(f / 5, a), e < 7 && f < 5) {
						let t = e * 6 + f;
						l.push(t, t + 5 + 1, t + 1, t + 1, t + 5 + 1, t + 5 + 2);
					}
				}
			}
			let u = new e.BufferGeometry();
			u.setAttribute("position", new e.Float32BufferAttribute(s, 3)), u.setAttribute("uv", new e.Float32BufferAttribute(c, 2)), u.setIndex(l), u.computeVertexNormals(), this.add("bronze", u);
		}
		let a = new e.MeshStandardMaterial({
			color: 1182470,
			emissive: new e.Color("#7a3510"),
			emissiveIntensity: .3,
			roughness: 1
		}), o = new e.Mesh(new e.BoxGeometry(8.5, 7, .2), a);
		o.position.set(n, i + 2.8, S.z + .6), this.group.add(o);
	}
	finalize() {
		for (let t of Object.keys(this.roles)) {
			let n = this.roles[t];
			if (!n.length) continue;
			let r = P(n), i = {
				stone: 1.4,
				wall: 2,
				gatePlaster: 1.8,
				wood: .75,
				woodDark: .7,
				dougong: .7,
				lattice: .75,
				mainStone: 1.4,
				mainWall: 2,
				mainWood: .75,
				mainWoodDark: .7,
				mainDougong: .7,
				mainLattice: .75
			}, a = i[t] ? F(r, i[t]) : r, o = {
				stone: "stone",
				mainStone: "stone",
				wall: "plaster",
				mainWall: "plaster",
				gatePlaster: "plaster",
				wood: "wood",
				woodDark: "wood",
				mainWood: "wood",
				mainWoodDark: "wood",
				lattice: "wood",
				mainLattice: "wood"
			};
			o[t] && (nn(a, o[t], o[t] === "plaster" ? void 0 : O.platform.y), this.materials[t].vertexColors = !0);
			let s = new e.Mesh(a, this.materials[t]);
			s.name = `temple-${t}`, s.castShadow = t === "stone" || t === "wall" || t === "gatePlaster" || t === "roof" || t === "mainRoof" || t === "wood" || t === "woodDark" || t === "dark" || t === "dougong" || t === "bronze" || t === "mainStone" || t === "mainWall" || t === "mainWood" || t === "mainWoodDark" || t === "mainDougong", s.receiveShadow = !0, this.group.add(s), n.length = 0;
		}
		this.group.traverse((t) => {
			t instanceof e.Mesh && t.name.startsWith("plaque") && (t.castShadow = !1);
		});
	}
};
//#endregion
//#region src/world/distant_geometry.ts
function dn(t, n = 28) {
	if (t.hasAttribute("skinIndex") || t.morphAttributes.position?.length) throw Error("Distant clustering is only for static, untextured decoration");
	let r = t.getAttribute("position");
	t.computeBoundingBox();
	let i = t.boundingBox, a = i.getSize(new e.Vector3()), o = Math.max(a.x, a.y, a.z) / n;
	if (!(o > 0)) return t.clone();
	let s = /* @__PURE__ */ new Map(), c = new Uint32Array(r.count);
	for (let e = 0; e < r.count; e++) {
		let t = r.getX(e), n = r.getY(e), a = r.getZ(e), l = `${Math.floor((t - i.min.x) / o)},${Math.floor((n - i.min.y) / o)},${Math.floor((a - i.min.z) / o)}`, u = s.get(l);
		u || (u = {
			id: s.size,
			x: 0,
			y: 0,
			z: 0,
			n: 0
		}, s.set(l, u)), u.x += t, u.y += n, u.z += a, u.n++, c[e] = u.id;
	}
	let l = new Float32Array(s.size * 3);
	for (let e of s.values()) l.set([
		e.x / e.n,
		e.y / e.n,
		e.z / e.n
	], e.id * 3);
	let u = t.index?.count ?? r.count, d = [], f = /* @__PURE__ */ new Set();
	for (let e = 0; e < u; e += 3) {
		let n = c[t.index ? t.index.getX(e) : e], r = c[t.index ? t.index.getX(e + 1) : e + 1], i = c[t.index ? t.index.getX(e + 2) : e + 2];
		if (n === r || r === i || n === i) continue;
		let a = [
			n,
			r,
			i
		].sort((e, t) => e - t).join(",");
		f.has(a) || (f.add(a), d.push(n, r, i));
	}
	let p = new e.BufferGeometry();
	return p.setAttribute("position", new e.BufferAttribute(l, 3)), p.setIndex(d), p.computeVertexNormals(), p.computeBoundingSphere(), p.userData.distantOnly = !0, p;
}
function fn(t) {
	let n = t.clone(!0), r = /* @__PURE__ */ new Map();
	return n.traverse((t) => {
		if (!(t instanceof e.Mesh)) return;
		let n = r.get(t.geometry);
		n || (n = dn(t.geometry), r.set(t.geometry, n)), t.geometry = n;
	}), n;
}
function pn(t, n = 75) {
	let r = new e.PerspectiveCamera(), i = t.update.bind(t);
	t.update = (e) => {
		let t = e, a = Number.isFinite(t.fov) ? Math.max(1, Math.tan(n * Math.PI / 360) / Math.tan(t.fov * Math.PI / 360)) : 1;
		r.matrixWorld.copy(e.matrixWorld), r.zoom = (t.zoom || 1) * a, i(r);
	};
}
//#endregion
//#region src/world/main_hall_study.ts
function mn(t, n) {
	let r = new e.Group();
	r.name = "lingyin-main-hall-interior";
	let i = O.temple.x, a = O.temple.z, o = O.platform.y + 1.35, s = O.platform.y + 9.72, c = (S.w - 3.25) / C.x, l = (S.d - 3.25) / C.z, u = O.platform.y + 9.9;
	function d() {
		let s = t.materials.mainRoof;
		s instanceof e.MeshStandardMaterial && (s.map = n.redRoof, s.normalMap = null, s.bumpMap = n.redRoof, s.bumpScale = .035, s.color.set("#f3dfd4"), s.roughness = .88, s.needsUpdate = !0);
		let c = u + 1.55;
		y("darkWood", 24, 2.5, .09, 0, c, 7.45);
		for (let e of [
			-9.2,
			-5.1,
			5.1,
			9.2
		]) {
			y("teal", 3.5, 1.45, .055, e, c, 7.52);
			for (let t = -4; t <= 4; t++) y("darkWood", .055, 1.43, .06, e + t * .39, c, 7.57);
			for (let t = -1; t <= 1; t++) y("gilt", 3.5, .035, .06, e, c + t * .48, 7.58);
		}
		for (let e of [
			-12,
			-7.15,
			-3.25,
			3.25,
			7.15,
			12
		]) y("lacquer", .36, 2.56, .32, e, c, 7.69), y("gilt", .47, .07, .37, e, u + .29, 7.69);
		let l = n.paintedBeam.clone();
		l.wrapS = e.RepeatWrapping, l.repeat.set(9, 1), l.needsUpdate = !0;
		let d = new e.MeshStandardMaterial({
			name: "hall-exterior-blue-gold-caihua",
			map: l,
			roughness: .78,
			metalness: .02,
			side: e.DoubleSide
		}), f = [];
		for (let [t, n, r, o] of [
			[
				27.8,
				.72,
				u - .48,
				9.58
			],
			[
				26.5,
				.62,
				u + 2.85,
				8.77
			],
			[
				23.9,
				.38,
				u + .33,
				7.82
			]
		]) {
			y("teal", t + .1, n + .06, .16, 0, r, o - .1), y("gilt", t + .12, .035, .17, 0, r - n / 2 - .04, o - .09), y("gilt", t + .12, .035, .17, 0, r + n / 2 + .04, o - .09);
			let s = new e.PlaneGeometry(t, n);
			s.translate(i, r, a + o), f.push(s);
		}
		let p = new e.Mesh(P(f), d);
		p.name = "hall-exterior-painted-eaves", r.add(p);
		for (let t of [-9.2, 9.2]) {
			let n = new e.Mesh(new e.CircleGeometry(1.28, 32), new e.MeshStandardMaterial({
				color: "#244448",
				roughness: .82,
				metalness: .06,
				side: e.DoubleSide
			}));
			n.name = "hall-exterior-round-window", n.position.set(i + t, o + 3.95, a + 7.47), r.add(n);
			let s = new e.Mesh(new e.RingGeometry(1.2, 1.34, 48), new e.MeshStandardMaterial({
				color: "#ae8542",
				roughness: .58,
				metalness: .4,
				side: e.DoubleSide
			}));
			s.position.set(i + t, o + 3.95, a + 7.49), r.add(s);
		}
		for (let e of [-5.75, 5.75]) {
			y("darkWood", 3.65, 5.25, .085, e, o + 3.05, 7.51);
			for (let t of [-1.87, 1.87]) y("lacquer", .16, 5.48, .12, e + t, o + 3.05, 7.59);
			for (let t of [-2.7, 2.7]) y("lacquer", 3.95, .16, .12, e, o + 3.05 + t, 7.59);
			for (let t of [
				-1.15,
				-.58,
				0,
				.58,
				1.15
			]) y("teal", .055, 5.1, .09, e + t, o + 3.05, 7.61);
			for (let t of [
				-1.8,
				-.9,
				0,
				.9,
				1.8
			]) y("teal", 3.55, .055, .09, e, o + 3.05 + t, 7.61);
		}
	}
	let f = new e.MeshStandardMaterial({
		name: "hall-worn-cinnabar-lacquer",
		map: n.redLacquer,
		roughness: .51,
		metalness: .02
	}), p = gt(!0);
	p.name = "hall-carved-dark-wood", p.color.set("#aa9381"), p.roughness = .9;
	let m = bt();
	m.name = "hall-painted-dougong", m.color.set("#8bafa7"), m.roughness = .92;
	let h = new e.MeshStandardMaterial({
		name: "hall-aged-gilt",
		color: "#b98737",
		metalness: .54,
		roughness: .39,
		emissive: "#2d1907",
		emissiveIntensity: .12
	}), g = new e.MeshStandardMaterial({
		name: "hall-cast-bronze",
		color: "#77603d",
		metalness: .57,
		roughness: .48
	}), _ = {
		lacquer: f,
		darkWood: p,
		teal: m,
		gilt: h,
		bronze: g
	}, v = {
		lacquer: [],
		darkWood: [],
		teal: [],
		gilt: [],
		bronze: []
	}, y = (e, t, n, r, o, s, c) => v[e].push(M(t, n, r, i + o, s, a + c)), b = (e, t, n, r, o, s, c, l = 24) => v[e].push(N(t, n, r, l, i + o, s, a + c));
	d();
	let x = t.materials.stone.clone();
	x.name = "hall-weathered-stone-floor", x.vertexColors = !1, x.color.set("#e3dfd6"), x.roughness = .9, x.map = n.stoneFloor, x.map.wrapS = x.map.wrapT = e.RepeatWrapping, x.map.repeat.set(7 * C.x, 4 * C.z), x.map.needsUpdate = !0, x.normalMap = null, x.roughnessMap = null, x.bumpMap = n.stoneFloor, x.bumpScale = .024;
	let w = new e.Mesh(new e.PlaneGeometry(c - .08, l - .08), x);
	w.name = "hall-stone-floor", w.rotation.x = -Math.PI / 2, w.position.set(i, o + .04, a), w.receiveShadow = !0, r.add(w), y("darkWood", c - .08, .16, l - .08, 0, s, 0);
	for (let e of [
		-5.55,
		-2,
		1.55,
		5.35
	]) y("teal", c - .2, .72, .54, 0, s - .38, e), y("gilt", c - .2, .045, .62, 0, s - .76, e);
	for (let e of [
		-10,
		-7.7,
		-3.8,
		3.8,
		7.7,
		10
	]) y("teal", .54, .55, l - .2, e, s - .28, 0);
	for (let e of [-10.7, 10.7]) y("gilt", .035, .06, l - .2, e, s - .58, 0);
	let T = n.paintedBeam.clone();
	T.wrapS = e.RepeatWrapping, T.repeat.set(8, 1), T.needsUpdate = !0;
	let E = new e.MeshStandardMaterial({
		name: "hall-painted-beam-art",
		map: T,
		roughness: .74,
		metalness: .03,
		side: e.DoubleSide
	}), ee = [];
	for (let t of [
		-5.55,
		-2,
		1.55,
		5.35
	]) {
		let n = new e.PlaneGeometry(c - .25, .61);
		n.translate(i, s - .37, a + t + .286), ee.push(n);
	}
	let te = new e.Mesh(P(ee), E);
	te.name = "hall-painted-crossbeams", r.add(te);
	let ne = new e.MeshStandardMaterial({
		name: "hall-dragon-coffer-art",
		map: n.coffer,
		roughness: .76,
		side: e.DoubleSide,
		emissive: "#45301d",
		emissiveIntensity: .08
	}), D = new e.Mesh(new e.PlaneGeometry(6.75, 6.15), ne);
	D.name = "hall-central-dragon-coffer", D.rotation.x = Math.PI / 2, D.position.set(i, s - .11, a + .1), r.add(D);
	for (let e of [-1, 1]) y("gilt", .09, .045, 6.48, e * 3.43, s - .12, .1), y("gilt", 6.95, .045, .09, 0, s - .12, .1 + e * 3.15);
	for (let [e, t] of rn) {
		for (let n of an) b(n.role, n.rt, n.rb, n.h, e, O.platform.y + n.y, t, n.segments);
		for (let n = 0; n < 3; n++) {
			let r = s - .44 + n * .16, i = .85 + n * .25;
			y("teal", 2 * i, .16, .58, e, r, t), y("teal", .62, .16, 2 * i, e, r + .07, t), y("gilt", 2 * i, .025, .06, e, r - .09, t + .29);
		}
	}
	for (let e of [
		-10.1,
		-5.15,
		5.15,
		10.1
	]) for (let t of [
		-5.55,
		-2,
		1.55,
		5.35
	]) y("teal", 1.42, .16, .38, e, s - .82, t), y("teal", .47, .22, .9, e, s - .68, t), y("gilt", 1.32, .035, .04, e, s - .92, t + .22);
	let re = new e.MeshStandardMaterial({
		name: "hall-daylit-paper",
		color: "#e4d5b7",
		roughness: 1,
		emissive: "#fff0d0",
		emissiveIntensity: .76,
		side: e.DoubleSide
	}), ie = [];
	for (let t of [-1, 1]) for (let n of [
		-3.75,
		0,
		3.75
	]) {
		let r = t * (c / 2 - .22), s = o + 4.18, l = new e.PlaneGeometry(2.7, 5.5);
		l.rotateY(-t * Math.PI / 2), l.translate(i + r, s, a + n), ie.push(l);
		for (let e of [-1.39, 1.39]) y("darkWood", .12, 5.7, .13, r - t * .08, s, n + e);
		for (let e of [-2.82, 2.82]) y("darkWood", .12, .14, 2.85, r - t * .08, s + e, n);
		for (let e = -3; e <= 3; e++) y("darkWood", .045, 5.5, .045, r - t * .13, s, n + e * .36);
		for (let e = -6; e <= 6; e++) y("darkWood", .045, .045, 2.7, r - t * .13, s + e * .4, n);
	}
	let ae = new e.Mesh(P(ie), re);
	ae.name = "hall-daylit-lattice-windows", r.add(ae);
	for (let e of [-1, 1]) y("darkWood", .18, 1.05, l - .25, e * (c / 2 - .12), o + .57, 0), y("gilt", .035, .035, l - .25, e * (c / 2 - .19), o + 1.12, 0);
	for (let e of cn) y(e.role, e.w, e.h, e.d, e.x, o + e.y, e.z);
	y("teal", 18, .8, .42, 0, s - .65, -6.23);
	for (let e of [
		-6.9,
		-2.3,
		2.3,
		6.9
	]) y("lacquer", .18, 6.95, .13, e, o + 4.1, -6.48), y("gilt", .035, 6.9, .04, e + .13, o + 4.1, -6.4);
	for (let e of [o + 5.5, o + 7.15]) y("teal", 17.1, .24, .2, 0, e, -6.45), y("gilt", 17.1, .035, .22, 0, e - .13, -6.45);
	for (let e of [-8.75, 8.75]) y("lacquer", .4, 4.8, .36, e, o + 2.5, -6.35), y("gilt", .07, 4.4, .04, e + (e < 0 ? .23 : -.23), o + 2.52, -6.12);
	let oe = gn(), se = new e.MeshBasicMaterial({
		name: "hall-gilt-halos",
		map: oe,
		transparent: !0,
		depthWrite: !1,
		side: e.DoubleSide
	}), ce = fn(n.buddhaSideLod);
	for (let t of [
		-4.6,
		0,
		4.6
	]) {
		let s = t === 0, c = new e.Mesh(new e.PlaneGeometry(s ? 4.5 : 3.55, s ? 4.5 : 3.55), se);
		c.name = "hall-statue-halo", c.position.set(i + t, o + (s ? 4.05 : 3.56), a - 6.37), r.add(c);
		let l = new e.LOD();
		l.position.set(i + t, o + .9, a - 4.82), l.addLevel(hn(s ? n.buddhaScan : n.buddhaSideLod, h, s ? 1.35 : 1.05, 0, 0, 0), 0), s && l.addLevel(hn(n.buddhaSideLod, h, 1.35, 0, 0, 0), 20, .12), l.addLevel(hn(ce, h, s ? 1.35 : 1.05, 0, 0, 0), 40, .12), pn(l), l.name = s ? "hall-central-buddha" : "hall-flanking-buddha", r.add(l);
	}
	y("gilt", 13.4, .035, .06, 0, o + 1.07, -1.3), y("gilt", 13.4, .035, .06, 0, o + .59, -1.3);
	let k = n.carvedAltar.clone();
	k.wrapS = e.RepeatWrapping, k.repeat.set(5, 1), k.needsUpdate = !0;
	let le = new e.Mesh(new e.PlaneGeometry(13.26, .7), new e.MeshStandardMaterial({
		name: "hall-carved-altar-front",
		map: k,
		roughness: .68,
		metalness: .04,
		side: e.DoubleSide
	}));
	le.name = "hall-carved-altar-front", le.position.set(i, o + .84, a - 1.31), r.add(le);
	for (let e of [
		-6.3,
		-3.2,
		0,
		3.2,
		6.3
	]) y("gilt", .08, .45, .08, e, o + .87, -1.15);
	let ue = [];
	for (let t of [
		-5.7,
		-4.4,
		-2.8,
		-1.4,
		1.4,
		2.8,
		4.4,
		5.7
	]) {
		b("bronze", .13, .2, .25, t, o + 1.45, -2.04, 12), b("gilt", .045, .07, .28, t, o + 1.72, -2.04, 10);
		let n = new e.SphereGeometry(.08, 10, 8);
		n.scale(.75, 1.7, .75), n.translate(i + t, o + 1.93, a - 2.04), ue.push(n);
	}
	let de = new e.Mesh(P(ue), new e.MeshBasicMaterial({ color: "#ffd185" }));
	de.name = "hall-altar-flames", r.add(de);
	let fe = new e.Mesh(new e.PlaneGeometry(3.65, 11.6), new e.MeshStandardMaterial({
		name: "hall-woven-carpet",
		map: _n(),
		roughness: .94,
		metalness: 0
	}));
	fe.name = "hall-processional-carpet", fe.rotation.x = -Math.PI / 2, fe.position.set(i, o + .055, a + 1.38), r.add(fe);
	let pe = vn(g, h, i + on.x, o, a + on.z);
	pe.scale.setScalar(on.scale), pe.position.set((i + on.x) * (1 - on.scale), o * (1 - on.scale), (a + on.z) * (1 - on.scale)), r.add(pe);
	let me = new e.PointLight(16759920, 13, 16, 2);
	me.position.set(i, o + 3.6, a - 3), r.add(me);
	for (let t of [-1, 1]) {
		let n = new e.PointLight(16770494, 6, 8, 2);
		n.position.set(i + t * 9, o + 3.2, a + .2), r.add(n);
	}
	for (let t of Object.keys(v)) {
		if (!v[t].length) continue;
		let n = P(v[t]), i = t === "lacquer" ? F(n, 2.4) : t === "darkWood" || t === "teal" ? F(n, .9) : n;
		(t === "lacquer" || t === "darkWood" || t === "teal") && (nn(i, "wood", o), _[t].vertexColors = !0);
		let a = new e.Mesh(i, _[t]);
		a.name = "hall-structure-" + t, a.receiveShadow = !0, r.add(a);
	}
	let he = new e.Group();
	he.name = "main-hall-expanded-layout";
	let { x: ge, z: _e } = C, ve = (t, n) => {
		let i = new e.Group();
		i.name = `${t.name}-proportion-pivot`, i.position.copy(n), i.scale.set(1 / ge, 1, 1 / _e), t.position.sub(n), r.remove(t), i.add(t), r.add(i);
	};
	for (let t of [...r.children]) (t instanceof e.LOD || t.name === "hall-statue-halo" || t.name === "hall-exterior-round-window" || t instanceof e.Mesh && t.geometry.type === "RingGeometry") && ve(t, t.position.clone());
	ve(pe, new e.Vector3(i + on.x, o, a + on.z));
	for (let e of [...r.children]) r.remove(e), he.add(e);
	return he.scale.set(ge, 1, _e), he.position.set(i * (1 - ge), 0, a * (1 - _e)), r.add(he), r.userData.expandedLayout = {
		width: S.w,
		depth: S.d,
		centerZ: a,
		statueProportionsPreserved: !0
	}, r;
}
function hn(t, n, r, i, a, o) {
	let s = t.clone(!0);
	s.rotation.x = Math.PI / 2, s.scale.setScalar(.027 * r), s.position.set(0, 0, 0), s.traverse((t) => {
		t instanceof e.Mesh && (t.material = n);
	}), s.updateMatrixWorld(!0);
	let c = new e.Box3().setFromObject(s);
	return s.position.set(i - (c.min.x + c.max.x) / 2, a - c.min.y, o - (c.min.z + c.max.z) / 2), s;
}
function gn() {
	let t = document.createElement("canvas");
	t.width = t.height = 512;
	let n = t.getContext("2d"), r = (e, t, r) => {
		n.strokeStyle = r, n.lineWidth = t, n.beginPath(), n.arc(256, 256, e, 0, Math.PI * 2), n.stroke();
	};
	r(218, 14, "#76511e"), r(202, 5, "#edc66c"), r(174, 8, "#9b6c2d"), r(166, 4, "#f4d787"), r(92, 5, "#d5a64e");
	for (let e = 0; e < 32; e++) {
		let t = e * Math.PI * 2 / 32;
		n.save(), n.translate(256, 256), n.rotate(t), n.fillStyle = e % 2 ? "#a77330" : "#dcad55", n.beginPath(), n.moveTo(0, -178), n.quadraticCurveTo(14, -198, 0, -216), n.quadraticCurveTo(-14, -198, 0, -178), n.fill(), n.restore();
	}
	for (let e = 0; e < 16; e++) {
		let t = e * Math.PI * 2 / 16;
		n.save(), n.translate(256, 256), n.rotate(t), n.fillStyle = "#bd873a", n.beginPath(), n.ellipse(0, -119, 13, 39, 0, 0, Math.PI * 2), n.fill(), n.restore();
	}
	let i = new e.CanvasTexture(t);
	return i.colorSpace = e.SRGBColorSpace, i.anisotropy = 8, i;
}
function _n() {
	let t = document.createElement("canvas");
	t.width = 384, t.height = 1024;
	let n = t.getContext("2d");
	n.fillStyle = "#6f2520", n.fillRect(0, 0, 384, 1024);
	for (let e = 0; e < 4800; e++) {
		let t = (Math.imul(e, 1597334677) >>> 0) % 384, r = (Math.imul(e, 3812015801) >>> 0) % 1024;
		n.fillStyle = e % 3 ? "#8c332a22" : "#32141322", n.fillRect(t, r, 2, 5);
	}
	for (let e of [
		18,
		31,
		353,
		366
	]) n.fillStyle = "#b48a49", n.fillRect(e, 0, e === 18 || e === 366 ? 3 : 7, 1024);
	n.strokeStyle = "#aa7c43", n.lineWidth = 3;
	for (let e of [43, 341]) for (let t = 0; t < 1024; t += 32) n.beginPath(), n.moveTo(e, t), n.lineTo(e + (e < 100 ? 11 : -11), t + 16), n.lineTo(e, t + 32), n.stroke();
	let r = new e.CanvasTexture(t);
	return r.colorSpace = e.SRGBColorSpace, r.anisotropy = 8, r;
}
function vn(t, n, r, i, a) {
	let o = new e.Group();
	o.name = "hall-tripod-incense-burner";
	let s = sn.map(([t, n]) => new e.Vector2(t, n)), c = new e.Mesh(new e.LatheGeometry(s, 28), t);
	c.position.set(r, i + .4, a), o.add(c);
	let l = new e.Mesh(new e.TorusGeometry(.88, .055, 8, 32), n);
	l.rotation.x = Math.PI / 2, l.position.set(r, i + 1.2, a), o.add(l);
	for (let n = 0; n < 3; n++) {
		let s = n * Math.PI * 2 / 3, c = new e.Mesh(new e.CylinderGeometry(.08, .13, .43, 9), t);
		c.position.set(r + Math.cos(s) * .58, i + .28, a + Math.sin(s) * .58), o.add(c);
	}
	for (let n of [-1, 1]) {
		let s = new e.Mesh(new e.TorusGeometry(.22, .055, 8, 20), t);
		s.position.set(r + n * 1.03, i + 1.04, a), o.add(s);
	}
	return o;
}
//#endregion
//#region ../scripts/lingyin_small_halls.js
var yn = [{
	name: "west",
	x: -25.5,
	z: 7,
	w: 9,
	d: 16,
	plinth: .7,
	eave: 5,
	rot: Math.PI / 2,
	theme: "scripture",
	furniture: [...[-1, 1].flatMap((e) => [-3.7, 3.7].map((t) => ({
		kind: "bookcase",
		x: e * 2.57,
		z: t,
		w: 2.15,
		d: .62,
		h: 1.95,
		rot: -e * Math.PI / 2
	}))), ...[-1, 1].map((e) => ({
		kind: "desk",
		x: e * 2.57,
		z: 0,
		w: 1.8,
		d: .62,
		h: .78,
		rot: -e * Math.PI / 2
	}))]
}, {
	name: "east",
	x: 19,
	z: 7,
	w: 9,
	d: 16,
	plinth: .7,
	eave: 5,
	rot: -Math.PI / 2,
	theme: "lotus",
	furniture: [
		{
			kind: "altar",
			x: 0,
			z: -5.3,
			w: 3.565,
			d: 1.3,
			h: 1.08,
			rot: 0
		},
		...[-1, 1].map((e) => ({
			kind: "cabinet",
			x: e * 2.57,
			z: -1.5,
			w: 1.9,
			d: .62,
			h: 1.1,
			rot: -e * Math.PI / 2
		})),
		...[-1, 1].map((e) => ({
			kind: "bench",
			x: e * 2.57,
			z: 2.8,
			w: 1.9,
			d: .62,
			h: .88,
			rot: -e * Math.PI / 2
		}))
	]
}];
function bn(e) {
	let t = Math.abs(Math.cos(e.rot)), n = Math.abs(Math.sin(e.rot));
	return {
		x: e.x,
		z: e.z,
		hx: (e.w * t + e.d * n) / 2,
		hz: (e.w * n + e.d * t) / 2,
		h: e.h + (e.kind === "altar" ? .11 : e.kind === "bookcase" ? .04 : e.kind === "desk" ? .05 : e.kind === "lectern" ? .055 : 0)
	};
}
//#endregion
//#region src/world/small_hall_interior.ts
function xn(t, n) {
	let r = new e.Group();
	r.name = "lingyin-small-hall-interiors";
	let i = {
		timber: [],
		plaster: [],
		floor: [],
		paper: [],
		paint: [],
		carving: [],
		mural: [],
		glow: []
	}, a = t.materials.woodDark.clone();
	a.name = "small-hall-worn-timber", a.color.set("#e0c5a9"), a.roughness = .84, a.vertexColors = !0;
	let o = t.materials.wall.clone();
	o.name = "small-hall-limewash", o.color.set("#dfd7be"), o.vertexColors = !0, o.map = tt(), o.bumpMap = o.map, o.bumpScale = .009, o.normalMap = null, o.roughnessMap = null, o.roughness = .98;
	let s = new e.MeshStandardMaterial({
		name: "small-hall-aged-stone",
		map: n.stoneFloor,
		bumpMap: n.stoneFloor,
		bumpScale: .022,
		color: 15130575,
		roughness: .92,
		vertexColors: !0
	}), c = new e.MeshStandardMaterial({
		name: "small-hall-paper-and-woven-fabric",
		map: tt(),
		bumpMap: tt(),
		bumpScale: .006,
		roughness: .94,
		vertexColors: !0
	}), l = (e, n) => t.group.getObjectByName(e)?.material?.map ?? n, u = l("hall-painted-crossbeams", n.paintedBeam), d = l("hall-carved-altar-front", n.carvedAltar), f = {
		timber: a,
		plaster: o,
		floor: s,
		paper: c,
		paint: new e.MeshStandardMaterial({
			name: "small-hall-painted-frieze",
			map: u,
			color: 12694939,
			roughness: .9
		}),
		carving: new e.MeshStandardMaterial({
			name: "small-hall-carved-apron",
			map: d,
			color: 11707276,
			roughness: .87
		}),
		mural: new e.MeshStandardMaterial({
			name: "small-hall-antique-lotus-art",
			map: n.mural,
			color: 12956813,
			roughness: .96
		}),
		glow: new e.MeshStandardMaterial({
			name: "small-hall-lantern-paper",
			color: 15058573,
			emissive: 16759647,
			emissiveIntensity: .8,
			roughness: .92
		})
	}, p = (t, n) => {
		let r = new e.Color(n), i = t.attributes.position, a = new Uint8Array(i.count * 3);
		for (let e = 0; e < i.count; e++) {
			let n = .94 + .06 * Math.max(0, t.attributes.normal.getY(e));
			a.set([
				Math.round(r.r * n * 255),
				Math.round(r.g * n * 255),
				Math.round(r.b * n * 255)
			], e * 3);
		}
		return t.setAttribute("color", new e.BufferAttribute(a, 3, !0)), t;
	};
	for (let t of yn) {
		let r = t.plinth + .25, a = t.w / 2 - 1.35 - .18, o = t.d / 2 - 1.35 - .18, s = t.eave - t.plinth - .38, c = s - r, l = (n, r, a = 16777215) => {
			if ((n === "timber" || n === "plaster") && (r = F(r, n === "timber" ? .8 : 2.4)), n === "paint" || n === "carving") {
				let t = f[n].map, i = r.getAttribute("uv");
				r.computeBoundingBox();
				let a = r.boundingBox.getSize(new e.Vector3()).length(), o = Math.max(1, a / 2.8);
				for (let e = 0; e < i.count; e++) i.setXY(e, (i.getX(e) * o - t.offset.x) / t.repeat.x, (i.getY(e) - t.offset.y) / t.repeat.y);
			}
			f[n].vertexColors && !r.hasAttribute("color") && p(r, a), r.rotateY(t.rot), r.translate(t.x, O.platform.y, t.z), i[n].push(r);
		}, u = (e, t, n, r, i, a, o, s) => l(e, M(t, n, r, i, a, o), s), d = (t, n, r, i, a, o, s = 0, c) => {
			let u = new e.PlaneGeometry(n, r);
			u.rotateY(s), u.translate(i, a, o), l(t, u, c);
		}, m = new e.PlaneGeometry(a * 2, o * 2, Math.ceil(a * 2 / .8), Math.ceil(o * 2 / .8));
		m.rotateX(-Math.PI / 2), m.translate(0, r + .034, 0);
		let h = m.attributes.uv, g = m.attributes.position;
		for (let e = 0; e < g.count; e++) h.setXY(e, g.getX(e) / (3.3 * n.stoneFloor.repeat.x), g.getZ(e) / (3.3 * n.stoneFloor.repeat.y));
		p(m, 16777215);
		let _ = m.getAttribute("color"), v = t.furniture.map(bn);
		for (let e = 0; e < g.count; e++) {
			let t = g.getX(e), n = g.getZ(e), r = Math.min(a - Math.abs(t), o - Math.abs(n)), i = .88 + .12 * Math.min(1, r / .4);
			for (let e of v) {
				let r = Math.hypot(Math.max(0, Math.abs(t - e.x) - e.hx), Math.max(0, Math.abs(n - e.z) - e.hz));
				i = Math.min(i, .76 + .24 * Math.min(1, r / .35));
			}
			_.setXYZ(e, _.getX(e) * i, _.getY(e) * i, _.getZ(e) * i);
		}
		l("floor", m);
		for (let e of [-1, 1]) {
			u("plaster", .04, c, o * 2, e * (a + .035), r + c / 2, 0), u("timber", .065, .52, o * 2, e * (a - .003), r + .26, 0, 12235171), u("timber", .085, .07, o * 2, e * (a - .02), r + .55, 0);
			for (let t of [
				-o * .6,
				0,
				o * .6
			]) u("timber", .07, c, .085, e * (a - .025), r + c / 2, t);
			for (let n of t.name === "rear" ? [-.1] : [-3.3, 3.3]) {
				let i = t.name === "rear" ? 2 : 2.15, o = 1.15, s = r + 1.88, c = e * (a - .075);
				d("paper", i, o, c, s, n, -e * Math.PI / 2, 14340270);
				for (let e of [-1, 1]) u("timber", .09, .075, i + .16, c, r + 1.88 + e * (o / 2 + .035), n);
				for (let t = -3; t <= 3; t++) u("timber", .095, o, .035, c - e * .014, s, n + t * i / 7);
				u("timber", .095, .035, i, c - e * .014, s, n);
			}
		}
		for (let e of [-1, 1]) {
			let n = e > 0 || t.name === "west", i = t.name === "rear" ? 4.6 : 3.4, s = n ? [-1, 1] : [0];
			for (let t of s) {
				let s = n ? a - i / 2 : a * 2, l = n ? t * (i / 2 + s / 2) : 0;
				u("plaster", s, c, .04, l, r + c / 2, e * (o + .035)), u("timber", s, .52, .065, l, r + .26, e * (o - .003), 12235171), u("timber", s, .07, .085, l, r + .55, e * (o - .02));
			}
		}
		u("timber", a * 2 + .12, .09, o * 2 + .12, 0, s + .045, 0, 12498854);
		let y = t.name === "rear" ? [-2, 1.8] : [
			-4.4,
			0,
			4.4
		];
		for (let e of y) u("timber", a * 2, .18, .22, 0, s - .09, e), d("paint", a * 2 - .35, .16, 0, s - .1, e + .114);
		for (let e of [
			-a * .66,
			-a * .33,
			0,
			a * .33,
			a * .66
		]) u("timber", .055, .07, o * 2, e, s - .07, 0, 12827302);
		let b = s - .5;
		u("timber", .035, .26, .035, 0, s - .18, 0), u("glow", .36, .38, .36, 0, b, 0);
		for (let e of [-1, 1]) {
			u("timber", .48, .065, .48, 0, b + e * .22, 0);
			for (let t of [-1, 1]) u("timber", .035, .43, .035, e * .195, b, t * .195);
		}
		for (let e of t.furniture) Sn(e, r, l);
		if (t.name !== "west") {
			let e = t.name === "rear" ? 5.1 : 3.8, n = t.name === "rear" ? 2.65 : 2.12, i = r + (t.name === "rear" ? 2.05 : 1.7), a = -o + .075;
			u("timber", e + .22, n + .22, .085, 0, i, a), d("paper", e + .09, n + .09, 0, i, a + .047, 0, 13153933), d("mural", e, n, 0, i, a + .053);
		}
	}
	let m = 0;
	for (let t of Object.keys(i)) {
		let n = P(i[t]), a = new e.Mesh(n, f[t]);
		a.name = `small-halls-${t}`, a.receiveShadow = !0, a.castShadow = !1, r.add(a), m += (n.index?.count || n.attributes.position.count) / 3;
	}
	return r.userData = {
		halls: yn.length,
		batches: r.children.length,
		triangles: m,
		addedLights: 0,
		addedDownloads: 0
	}, r;
}
function Sn(t, n, r) {
	let i = (e, i, a) => {
		i.rotateY(t.rot), i.translate(t.x, n, t.z), r(e, i, a);
	}, a = (e, t, n, r, a, o, s, c) => i(e, M(t, n, r, a, o, s), c), o = (t, n, r, a, o, s, c) => i(t, new e.PlaneGeometry(n, r).translate(a, o, s), c), { w: s, d: c, h: l } = t;
	if (t.kind === "bookcase") {
		a("timber", s - .06, l - .08, .045, 0, l / 2, -c / 2 + .04, 8549736);
		for (let e of [-1, 1]) a("timber", .075, l, c, e * (s / 2 - .038), l / 2, 0);
		for (let e = 0; e < 4; e++) {
			let t = .13 + e * (l - .2) / 3;
			if (a("timber", s, .065, c, 0, t, 0), e !== 3) for (let n = 0; n < 4; n++) {
				let r = -s / 2 + .31 + n * (s - .6) / 3, i = .24 + (n + e) % 3 * .055;
				a("paper", .36, i, c - .15, r, t + .04 + i / 2, .015, [
					12562572,
					10594712,
					9993314
				][(n + e) % 3]);
				for (let e = 1; e <= 3; e++) o("paper", .34, .012, r, t + .06 + e * i / 4, c / 2 - .048, 14536875);
				o("paper", .032, i + .005, r + .075, t + .04 + i / 2, c / 2 - .044, 5919041);
			}
		}
		a("timber", s + .12, .08, c + .08, 0, l, 0);
	} else if (t.kind === "bench") {
		a("timber", s, .09, c, 0, .43, 0), a("timber", s, .14, .065, 0, .78, -c / 2 + .04);
		for (let e of [-1, 1]) for (let t of [-1, 1]) a("timber", .07, .4, .075, e * (s / 2 - .12), .2, t * (c / 2 - .1));
		for (let e of [-1, 1]) a("timber", .055, .45, .055, e * (s / 2 - .12), .64, -c / 2 + .04);
		for (let e of [-1, 1]) a("paper", s * .37, .035, c * .7, e * s * .23, .492, 0, 10655606);
	} else {
		let e = l - .07;
		for (let t of [-1, 1]) for (let n of [-1, 1]) a("timber", .105, e - .09, .105, t * (s / 2 - .12), (e - .09) / 2, n * (c / 2 - .12));
		if (a("timber", s, .1, c, 0, e, 0), a("timber", s - .14, .16, .07, 0, e - .14, c / 2 - .04), a("timber", s - .15, .055, c - .14, 0, .16, 0), t.kind === "cabinet") {
			a("timber", s - .16, e - .2, c - .1, 0, (e + .1) / 2, 0);
			for (let e of [-1, 1]) a("paper", s * .43, .42, .008, e * s * .235, .64, c / 2 - .045, 9074272), a("timber", .025, .09, .035, e * .07, .7, c / 2 - .018);
		} else if (t.kind === "altar" || t.kind === "lectern") if (o("carving", s - .3, .28, 0, e - .21, c / 2 + .002), t.kind === "lectern") {
			let e = M(.68, .045, .36, 0, 0, 0);
			e.rotateX(-.12), e.translate(0, l + .008, 0), i("paper", e, 13154189);
		} else for (let e of [-1, 1]) i("timber", N(.12, .16, .055, 10, e * s * .32, l + .01, 0)), i("paper", N(.1, .08, .08, 10, e * s * .32, l + .065, 0), 9350314);
		else a("paper", .52, .065, .36, -s * .18, l + .01, 0, 12366739), a("paper", .34, .035, .33, s * .2, l + .006, 0, 10199951);
	}
}
//#endregion
//#region src/world/static_collision.ts
function Cn(e) {
	e.sort((e, t) => e.x - t.x || e.z - t.z);
	let t = (e, t, n) => (t.x - e.x) * (n.z - e.z) - (t.z - e.z) * (n.x - e.x), n = (e) => {
		let n = [];
		for (let r of e) {
			for (; n.length >= 2 && t(n[n.length - 2], n[n.length - 1], r) <= 1e-8;) n.pop();
			n.push(r);
		}
		return n;
	}, r = n(e), i = n([...e].reverse());
	return [...r.slice(0, -1), ...i.slice(0, -1)];
}
function wn(t) {
	t.updateMatrixWorld(!0);
	let n = [], r = 0;
	return t.traverse((t) => {
		if (!(t instanceof e.LOD) || !["hall-central-buddha", "hall-flanking-buddha"].includes(t.name)) return;
		let i = (t.levels.find((e) => e.distance === 20) ?? t.levels[0]).object, a = [];
		i.traverse((t) => {
			if (!(t instanceof e.Mesh)) return;
			let n = t.geometry.getAttribute("position");
			for (let r = 0; r < n.count; r++) a.push(new e.Vector3().fromBufferAttribute(n, r).applyMatrix4(t.matrixWorld));
		});
		let o = new e.Box3().setFromPoints(a), s = o.max.y - o.min.y;
		for (let e = 0; e < 6; e++) {
			let t = o.min.y + s * e / 6, i = o.min.y + s * (e + 1) / 6, c = Cn(a.filter((e) => e.y >= t - .06 && e.y <= i + .06).map((e) => ({
				x: e.x,
				z: e.z
			})));
			if (c.length < 3) continue;
			let l = c.map((e) => e.x), u = c.map((e) => e.z), d = (Math.min(...l) + Math.max(...l)) / 2, f = (Math.min(...u) + Math.max(...u)) / 2, p = [[
				0,
				1,
				0,
				i
			], [
				0,
				-1,
				0,
				-t
			]];
			c.forEach((e, t) => {
				let n = c[(t + 1) % c.length], r = Math.hypot(n.x - e.x, n.z - e.z), i = (n.z - e.z) / r, a = -(n.x - e.x) / r;
				p.push([
					i,
					0,
					a,
					i * e.x + a * e.z
				]);
			}), n.push({
				name: `main-buddha-body-${r}-${e}`,
				x: d,
				z: f,
				y0: t,
				h: i,
				hx: (Math.max(...l) - Math.min(...l)) / 2,
				hz: (Math.max(...u) - Math.min(...u)) / 2,
				planes: p,
				polygon: c,
				preciseEscape: !0,
				walkable: !1
			});
		}
		r++;
	}), n;
}
//#endregion
//#region src/world/runtime_textures.ts
var Tn = /* @__PURE__ */ new Map(), En = null;
function Dn() {
	if (["127.0.0.1", "localhost"].includes(location.hostname) && new URLSearchParams(location.search).get("bakeLingyinTextures") === "1") return Promise.resolve();
	if (En) return En;
	let t = new e.TextureLoader();
	return En = Promise.all([
		"forest-atlas",
		"gate-atlas",
		"gate-paving"
	].map(async (n) => {
		let r = await t.loadAsync(new URL(`./assets/lingyin/runtime-textures/${n}.webp`, document.baseURI).href + "?v=2");
		r.name = `lingyin-baked-${n}`, r.colorSpace = e.SRGBColorSpace, r.minFilter = e.LinearMipmapLinearFilter, r.magFilter = e.LinearFilter, r.anisotropy = 8, n === "gate-paving" && (r.wrapS = r.wrapT = e.RepeatWrapping), Tn.set(n, r);
	})).then(() => {}), En;
}
function On(e) {
	return Tn.get(e);
}
var kn = null;
function An() {
	if (!kn) {
		let t = document.createElement("canvas");
		t.width = 128, t.height = 512;
		let n = t.getContext("2d"), r = n.createImageData(128, 512);
		for (let e = 0; e < 512; e++) for (let t = 0; t < 128; t++) {
			let n = e * 8 / 512 % 1, i = n < .04 ? .48 : n < .09 ? 1.12 : 1, a = .91 + .09 * Math.sin(t * 1.8 + Math.sin(e * .013)), o = (.85 + .15 * Math.sin(t / 128 * Math.PI * 2)) * i * a, s = (e * 128 + t) * 4;
			r.data[s] = 82 * o, r.data[s + 1] = 103 * o, r.data[s + 2] = 48 * o, r.data[s + 3] = 255;
		}
		n.putImageData(r, 0, 0), kn = new e.CanvasTexture(t), kn.name = "lingyin-bamboo-node-and-fibre", kn.colorSpace = e.SRGBColorSpace, kn.wrapS = kn.wrapT = e.RepeatWrapping, kn.anisotropy = 8;
	}
	return new e.MeshStandardMaterial({
		name: "bamboo-textured-culm",
		map: kn,
		bumpMap: kn,
		bumpScale: .008,
		roughness: .8,
		metalness: 0
	});
}
//#endregion
//#region src/data/shots.ts
var jn = [
	{
		id: "gate",
		index: 1,
		name: "山門",
		en: "THE GATE",
		pos: [
			0,
			8.4,
			70
		],
		target: [
			0,
			9.2,
			-8
		],
		fov: 38
	},
	{
		id: "hall",
		index: 2,
		name: "大雄寶殿",
		en: "MAIN HALL",
		pos: [
			16,
			5.5,
			28
		],
		target: [
			-2,
			9,
			-8
		],
		fov: 46
	},
	{
		id: "court",
		index: 3,
		name: "庭院",
		en: "COURTYARD",
		pos: [
			22,
			5.2,
			32
		],
		target: [
			-12,
			9,
			8
		],
		fov: 44
	},
	{
		id: "aerial",
		index: 4,
		name: "遠眺",
		en: "THE VALLEY",
		pos: [
			30,
			42,
			92
		],
		target: [
			-2,
			7,
			-12
		],
		fov: 38
	}
], Mn = 1024, B = 256, Nn = null, Pn = null;
function Fn() {
	if (On("forest-atlas")) return Promise.resolve();
	if (Pn) return Pn;
	let e = (e) => new Promise((t, n) => {
		let r = new Image();
		r.onload = () => t(r), r.onerror = () => n(/* @__PURE__ */ Error(`Lingyin foliage image failed: ${e}`)), r.src = new URL(`./assets/lingyin/temple-textures/${e}`, document.baseURI).href + "?v=1";
	});
	return Pn = Promise.all([
		e("pine-foliage-albedo.jpg"),
		e("pine-foliage-alpha.png"),
		e("broad-foliage-albedo.jpg"),
		e("broad-foliage-alpha.png")
	]).then(([e, t, n, r]) => {
		Nn = {
			pine: {
				diffuse: e,
				alpha: t
			},
			broad: {
				diffuse: n,
				alpha: r
			}
		};
	}), Pn;
}
function In(e) {
	let t = {
		pine: 0,
		broad: 1,
		maple: 2,
		bamboo: 3,
		grass: 4,
		fern: 5
	}[e];
	return {
		col: t % 4,
		row: Math.floor(t / 4)
	};
}
function Ln() {
	let t = On("forest-atlas");
	if (t) return t;
	let n = document.createElement("canvas");
	n.width = Mn, n.height = Mn;
	let r = n.getContext("2d");
	if (!r) throw Error("no 2d");
	r.clearRect(0, 0, Mn, Mn);
	let i = new h("foliage-atlas"), a = (e, t) => {
		let { col: n, row: i } = In(e), a = n * B, o = i * B;
		r.save(), r.translate(a, o), r.beginPath(), r.rect(0, 0, B, B), r.clip(), t(r), r.restore();
	};
	if (a("pine", (e) => {
		let t = B / 2, n = B * .62, r = e.createRadialGradient(t, n - 20, 10, t, n - 20, 190);
		r.addColorStop(0, "rgba(22,36,24,0.55)"), r.addColorStop(.6, "rgba(22,36,24,0.22)"), r.addColorStop(1, "rgba(22,36,24,0)"), e.fillStyle = r, e.fillRect(0, 0, B, B);
		for (let r = 0; r < 10; r++) {
			let a = -Math.PI * .95 + r / 6 * Math.PI * 1.9;
			e.strokeStyle = `rgb(${34 + i.int(0, 16)},${44 + i.int(0, 20)},${30 + i.int(0, 14)})`, e.lineWidth = 2, e.beginPath(), e.moveTo(t, n);
			let o = t + Math.cos(a) * 110, s = n + Math.sin(a) * 95;
			e.lineTo(o, s), e.stroke();
			for (let r = 0; r < 44; r++) {
				let c = .15 + r / 34 * .85, l = f(t, o, c), u = f(n, s, c), d = a + (i.chance(.5) ? 1 : -1) * (.5 + i.value() * .45), p = 22 + i.value() * 34 * (1 - c * .4);
				e.strokeStyle = `rgba(${40 + i.int(0, 22)},${62 + i.int(0, 32)},${36 + i.int(0, 18)},0.85)`, e.lineWidth = 1.15, e.beginPath(), e.moveTo(l, u), e.lineTo(l + Math.cos(d) * p, u + Math.sin(d) * p), e.stroke();
			}
		}
	}), a("broad", (e) => {
		let t = B / 2, n = B * .6, r = e.createRadialGradient(t, n, 8, t, n, 180);
		r.addColorStop(0, "rgba(24,40,22,0.5)"), r.addColorStop(.65, "rgba(24,40,22,0.18)"), r.addColorStop(1, "rgba(24,40,22,0)"), e.fillStyle = r, e.fillRect(0, 0, B, B);
		for (let r = 0; r < 12; r++) {
			let r = i.range(-Math.PI, Math.PI), a = i.range(40, 105), o = t + Math.cos(r) * a, s = n + Math.sin(r) * a;
			e.strokeStyle = "#3b3122", e.lineWidth = 2.4, e.beginPath(), e.moveTo(t, n), e.lineTo(o, s), e.stroke();
			for (let a = 0; a < 7; a++) {
				let c = .25 + a / 7 * .75, l = f(t, o, c), u = f(n, s, c), d = r + (a % 2 ? 1 : -1) * 1.2, p = i.range(12, 22);
				e.save(), e.translate(l, u), e.rotate(d), e.fillStyle = `rgba(${44 + i.int(0, 26)},${78 + i.int(0, 40)},${40 + i.int(0, 22)},0.94)`, e.beginPath(), e.ellipse(p * .6, 0, p, p * .42, 0, 0, Math.PI * 2), e.fill(), e.restore();
			}
		}
	}), a("maple", (e) => {
		let t = [
			"#a3402a",
			"#b6552c",
			"#8f3520",
			"#c06a33",
			"#7d2f22"
		];
		for (let n = 0; n < 72; n++) {
			let n = i.range(30, B - 30), r = i.range(30, B - 30), a = i.range(16, 30);
			e.save(), e.translate(n, r), e.rotate(i.range(0, Math.PI * 2)), e.fillStyle = t[i.int(0, t.length - 1)], e.beginPath();
			for (let t = 0; t < 5; t++) {
				let n = -Math.PI / 2 + (t - 2) * .62, r = Math.cos(n) * a, i = Math.sin(n) * a;
				e.lineTo(r, i), e.lineTo(Math.cos(n + .28) * a * .45, Math.sin(n + .28) * a * .45);
			}
			e.closePath(), e.fill(), e.restore();
		}
	}), a("bamboo", (e) => {
		for (let t = 0; t < 5; t++) {
			let t = i.range(30, B - 30), n = i.range(40, B - 40);
			for (let r = 0; r < 12; r++) {
				let r = i.range(-Math.PI, Math.PI), a = i.range(30, 68);
				e.save(), e.translate(t + i.range(-10, 10), n + i.range(-10, 10)), e.rotate(r), e.fillStyle = `rgba(${70 + i.int(0, 25)},${100 + i.int(0, 30)},${48 + i.int(0, 20)},0.9)`, e.beginPath(), e.ellipse(a * .5, 0, a * .5, 3.2, 0, 0, Math.PI * 2), e.fill(), e.restore();
			}
		}
	}), a("grass", (e) => {
		for (let t = 0; t < 46; t++) {
			let t = B / 2 + i.range(-70, 70), n = -Math.PI / 2 + i.range(-.55, .55), r = i.range(80, 210);
			e.strokeStyle = `rgba(${72 + i.int(0, 35)},${94 + i.int(0, 35)},${44 + i.int(0, 22)},0.95)`, e.lineWidth = i.range(1.5, 3.4), e.beginPath(), e.moveTo(t, B - 4), e.quadraticCurveTo(t + Math.cos(n) * r * .45, B - r * .55, t + Math.cos(n) * r, B - 4 - Math.sin(-n) * r), e.stroke();
		}
	}), a("fern", (e) => {
		for (let t = 0; t < 5; t++) {
			let t = -Math.PI / 2 + i.range(-.8, .8), n = i.range(120, 210), r = B / 2, a = B - 10;
			e.strokeStyle = "#3f5a34", e.lineWidth = 2.2, e.beginPath(), e.moveTo(r, a), e.quadraticCurveTo(r + Math.cos(t) * n * .6, a - n * .6, r + Math.cos(t) * n, a - n * .85), e.stroke();
			for (let o = 4; o < 20; o++) {
				let s = o / 20, c = r + Math.cos(t) * n * s, l = a - n * .85 * s - Math.sin(Math.abs(t)) * 6;
				for (let t of [-1, 1]) e.strokeStyle = `rgba(${54 + i.int(0, 20)},${80 + i.int(0, 22)},${40 + i.int(0, 18)},0.95)`, e.lineWidth = 1.2, e.beginPath(), e.moveTo(c, l), e.lineTo(c + t * 18 * (1 - s), l + 8), e.stroke();
			}
		}
	}), Nn) {
		let e = (e, t, n, i, a, o, s = !1) => {
			let c = document.createElement("canvas"), l = document.createElement("canvas");
			c.width = c.height = B, l.width = l.height = B;
			let u = c.getContext("2d"), d = l.getContext("2d");
			u.drawImage(t.diffuse, n, i, a, o, 12, 12, B - 24, B - 24), d.drawImage(t.alpha, n, i, a, o, 12, 12, B - 24, B - 24);
			let f = u.getImageData(0, 0, B, B), p = d.getImageData(0, 0, B, B);
			for (let t = 0; t < f.data.length; t += 4) {
				let n = f.data[t], r = f.data[t + 1], i = f.data[t + 2], a = e === "pine" ? r > n * .94 && r > i * 1.12 : r > n * 1.025 && r > i * 1.18;
				f.data[t + 3] = a && p.data[t] > 230 ? 255 : 0, f.data[t] = Math.min(255, n * 1.06), f.data[t + 1] = Math.min(255, r * 1.16), s && (f.data[t] = Math.min(255, f.data[t] * 1.5 + 52), f.data[t + 1] = Math.min(255, f.data[t + 1] * .68 + 12), f.data[t + 2] = Math.min(255, f.data[t + 2] * .52));
			}
			u.putImageData(f, 0, 0);
			let { col: m, row: h } = In(e);
			r.clearRect(m * B, h * B, B, B), r.drawImage(c, m * B, h * B);
		};
		e("pine", Nn.pine, 30, 42, 197, 360), e("broad", Nn.broad, 560, 35, 290, 620), e("maple", Nn.broad, 560, 35, 290, 620, !0);
	}
	let o = new e.CanvasTexture(n);
	return o.colorSpace = e.SRGBColorSpace, o.anisotropy = 8, o.needsUpdate = !0, o;
}
function Rn(t, n, r) {
	let { col: i, row: a } = In(t), o = 3 / Mn, s = i / 4 + o, c = 1 - (a + 1) / 4 + o, l = new e.PlaneGeometry(n, r), u = l.getAttribute("uv");
	for (let e = 0; e < u.count; e++) u.setXY(e, s + u.getX(e) * (.25 - o * 2), c + u.getY(e) * (.25 - o * 2));
	return l;
}
function zn(e, t, n, r, i, a = 0, o = !0, s = 0, c = 0) {
	let l = Rn(e, t, n);
	return o && l.translate(0, n / 2, 0), l.rotateX(a), l.rotateY(i), l.translate(s, r, c), l;
}
var Bn = class {
	trunk;
	cards;
	blobs;
	constructor(e, t, n) {
		this.trunk = e, this.cards = t, this.blobs = n;
	}
};
function Vn(n) {
	let r = n.range(10, 16), i = [], a = 0, o = 0;
	for (let t = 0; t < 5; t++) {
		let s = t / 5 * r, c = (t + 1) / 5 * r, l = f(.42, .1, t / 5), u = f(.42, .1, (t + 1) / 5), d = new e.CylinderGeometry(u, l, c - s, 8);
		d.translate(a, (s + c) / 2, o), i.push(d), a += n.range(-.35, .35), o += n.range(-.35, .35);
	}
	let s = [];
	for (let t = 0; t < 9; t++) {
		let t = r * n.range(.42, .95), a = n.range(0, Math.PI * 2), o = n.range(1.6, 3.6) * (1 - t / r * .5), c = Math.cos(a) * o, l = Math.sin(a) * o, u = new e.CylinderGeometry(.045, .14, o, 6);
		u.rotateZ(Math.PI / 2 - .35), u.rotateY(-a), u.translate(c * .5, t + .15, l * .5), i.push(u), s.push(new e.Vector3(c, t, l));
	}
	let c = [], l = [];
	for (let e of s) for (let t = 0; t < 8; t++) {
		let r = e.x + n.range(-1, 1), i = e.z + n.range(-1, 1);
		c.push(zn("pine", n.range(3.2, 4.6), n.range(2, 2.8), e.y - .9 + n.range(-.4, .4), t / 8 * Math.PI + n.range(-.3, .3), .1, !0, r, i));
	}
	for (let e = 0; e < 6; e++) {
		let t = e / 6 * Math.PI * 2;
		c.push(zn("pine", 3.6, 2.3, r * .82, t, .02, !0, Math.cos(t) * .7, Math.sin(t) * .7));
	}
	return new Bn(t(i, !1), t(c, !1), l.length ? t(l, !1) : new e.BufferGeometry());
}
function Hn(n, r) {
	let i = n.range(5.5, 9), a = [];
	a.push(new e.CylinderGeometry(.16, .38, i * .62, 8).translate(0, i * .31, 0));
	let o = [];
	for (let t = 0; t < 6; t++) {
		let r = t / 6 * Math.PI * 2 + n.range(-.3, .3), s = i * n.range(.4, .68), c = n.range(1.4, 2.6), l = new e.CylinderGeometry(.07, .16, c, 6);
		l.rotateZ(.8), l.rotateY(-r), l.translate(Math.cos(r) * c * .4, s + .5, Math.sin(r) * c * .4), a.push(l), o.push(new e.Vector3(Math.cos(r) * c * .8, s + .9, Math.sin(r) * c * .8));
	}
	let s = i * .78, c = [];
	for (let e = 0; e < 8; e++) {
		let t = e * Math.PI / 8;
		c.push(zn(r, 4.8, 3.3, s - 1.7, t, e % 2 ? .12 : -.12, !0, Math.cos(t * 2) * .24, Math.sin(t * 2) * .24));
	}
	for (let e = 0; e < 72; e++) {
		let e = n.range(0, Math.PI * 2), t = n.range(.3, 2.9), i = s + n.range(-1.5, 1.9), a = n.range(2, 3.4);
		c.push(zn(r, a, a * n.range(.65, .95), i, e, n.range(-.5, .5), !0, Math.cos(e) * t, Math.sin(e) * t));
	}
	for (let e of o) c.push(zn(r, 2, 1.4, e.y, n.range(0, Math.PI), n.range(-.3, .3), !0, e.x, e.z));
	return new Bn(t(a, !1), t(c, !1), new e.BufferGeometry());
}
function Un(n) {
	let r = n.range(6.5, 10), i = [];
	for (let t = 0; t < 4; t++) {
		let a = t / 4 * Math.PI * 2, o = n.range(.04, .12), s = new e.CylinderGeometry(.035, .05, r, 6);
		s.rotateZ(o), s.rotateY(a), s.translate(Math.cos(a) * .35, r / 2, Math.sin(a) * .35), i.push(s);
	}
	let a = t(i, !1), o = [];
	for (let e = 0; e < 22; e++) {
		let e = n.range(0, Math.PI * 2), t = r * n.range(.55, 1), i = n.range(.2, 1.4);
		o.push(zn("bamboo", n.range(1, 1.7), n.range(.5, .9), t, e, n.range(-.4, .4), !0, Math.cos(e) * i, Math.sin(e) * i));
	}
	return new Bn(a, t(o, !1), new e.BufferGeometry());
}
var Wn = class {
	group = new e.Group();
	tiles = [];
	atlas;
	bark;
	leafMat;
	grassGeo;
	fernGeo;
	time = n.time;
	constructor() {
		this.group.name = "vegetation", this.atlas = Ln(), this.bark = ot() ?? o({
			name: "bark",
			params: {
				color: 16777215,
				roughness: .95
			},
			color: "\n        float n = cgFbm2(vec2(cgP.x * 6.0 + cgP.z * 2.0, cgP.y * 0.9));\n        vec3 c = mix(vec3(0.10,0.075,0.055), vec3(0.24,0.19,0.14), n);\n        c *= 0.8 + 0.3 * smoothstep(0.2, 0.9, cgNoise2(vec2(cgP.y * 3.0, cgP.x * 2.0)));\n        diffuseColor.rgb = c;\n      "
		}), this.leafMat = o({
			name: "leaf-card",
			params: {
				color: 16777215,
				map: this.atlas,
				alphaTest: .42,
				alphaToCoverage: !0,
				side: e.DoubleSide,
				roughness: .92,
				metalness: 0
			},
			uniforms: {
				uTime: this.time,
				uSunDir: n.sunDir
			},
			vertexHead: "uniform float uTime;",
			head: "uniform vec3 uSunDir;",
			vertexPre: "\n        #ifdef USE_INSTANCING\n          float ph = instanceMatrix[3][0] * 0.7 + instanceMatrix[3][2] * 0.9;\n          float sway = sin(uTime * 0.65 + ph) * 0.045 + sin(uTime * 1.7 + ph * 1.7) * 0.015;\n          transformed.x += sway * max(transformed.y, 0.0) * 0.6;\n          transformed.z += sway * max(transformed.y, 0.0) * 0.35;\n        #endif\n      ",
			color: "\n        float ao = 0.7 + 0.3 * smoothstep(0.0, 7.0, cgP.y);\n        diffuseColor.rgb *= ao;\n      ",
			emissive: "\n        vec3 V = normalize(cameraPosition - cgP);\n        float back = pow(max(dot(-V, uSunDir), 0.0), 2.2);\n        totalEmissiveRadiance += vec3(0.10, 0.13, 0.05) * back * (0.45 + 0.55 * cgN.y);\n      "
		});
		let r = [];
		for (let e = 0; e < 3; e++) r.push(zn("grass", 1.1, .85, 0, e / 3 * Math.PI, 0, !0));
		this.grassGeo = t(r, !1);
		let i = [];
		for (let e = 0; e < 4; e++) i.push(zn("fern", 1.3, .9, 0, e / 4 * Math.PI * 2, .1, !0));
		this.fernGeo = t(i, !1), this.populate();
	}
	canPlace(e, t, n) {
		if (!we(e, t, n) || Ce(e, t, n)) return !1;
		for (let r of jn) {
			let i = r.pos[0], a = r.pos[2], o = r.target[0], s = r.target[2], c = o - i, l = s - a, u = c * c + l * l || 1, d = ((e - i) * c + (t - a) * l) / u;
			if (d > -.05 && d < .5) {
				let r = i + c * d, o = a + l * d;
				if (Math.hypot(e - r, t - o) < 9 + n) return !1;
			}
		}
		return !(Te(e, t) < n + 1.6 || ce(e, t) < 2.72 + n + .35 || he(e, t) < n || Se(e, t) > .8);
	}
	populate() {
		let t = new h("vegetation"), n = [
			Vn(new h("pine-a")),
			Vn(new h("pine-b")),
			Vn(new h("pine-c"))
		], r = [Hn(new h("broad-a"), "broad"), Hn(new h("broad-b"), "broad")], i = [Hn(new h("maple-a"), "maple"), Hn(new h("maple-b"), "maple")], a = Un(new h("bamboo")), o = [], s = [], c = [], l = [], u = new e.Quaternion(), d = new e.Euler(), f = new e.Vector3(), p = (t, n, r, i, a) => (d.set(0, a, 0), u.setFromEuler(d), f.set(i, i, i), new e.Matrix4().compose(new e.Vector3(t, n, r), u, f)), m = 0;
		for (; o.length < 190 && m < 12e3;) {
			m++;
			let r = t.range(-250, 250), i = t.range(-250, 220);
			this.canPlace(r, i, 3.5) && (Se(r, i) < .08 && t.chance(.7) || o.push({
				v: t.int(0, n.length - 1),
				m: p(r, A(r, i) - .25, i, t.range(.75, 1.25), t.range(0, 6.28)),
				c: new e.Color().setHSL(.29 + t.range(-.02, .02), .1, .76 + t.range(-.08, .06))
			}));
		}
		for (m = 0; s.length < 120 && m < 7e3;) {
			m++;
			let n = t.range(-210, 210), i = t.range(-190, 200);
			this.canPlace(n, i, 3) && (Math.abs(n + 2) > 90 && t.chance(.5) || s.push({
				v: t.int(0, r.length - 1),
				m: p(n, A(n, i) - .2, i, t.range(.8, 1.3), t.range(0, 6.28)),
				c: new e.Color().setHSL(.27 + t.range(-.03, .03), .1, .74 + t.range(-.08, .06))
			}));
		}
		for (m = 0; c.length < 30 && m < 3e3;) {
			m++;
			let n = t.range(-90, 80), r = t.range(-70, 90);
			this.canPlace(n, r, 3) && (Ce(n, r, 5) || c.push({
				v: t.int(0, i.length - 1),
				m: p(n, A(n, r) - .2, r, t.range(.75, 1.15), t.range(0, 6.28)),
				c: new e.Color().setHSL(.05 + t.range(-.02, .02), .12, .82 + t.range(-.06, .05))
			}));
		}
		for (let n = 0; n < 170; n++) {
			let n = t.range(-62, -38), r = t.range(-10, 52);
			this.canPlace(n, r, 1.2) && l.push({
				m: p(n, A(n, r) - .1, r, t.range(.8, 1.2), t.range(0, 6.28)),
				c: new e.Color().setHSL(.24 + t.range(-.02, .02), .1, .8)
			});
		}
		this.buildSpecies(n, o), this.buildSpecies(r, s), this.buildSpecies(i, c), this.buildSpecies([a], l.map((e) => ({
			v: 0,
			...e
		})), An());
		let g = [], _ = [];
		for (m = 0; g.length < 7e3 && m < 26e3;) {
			m++;
			let e = t.range(-120, 100), n = t.range(-90, 110);
			this.canPlace(e, n, .5) && (Ce(e, n, 1.5) || g.push(p(e, A(e, n) - .02, n, t.range(.7, 1.4), t.range(0, 6.28))));
		}
		for (m = 0; _.length < 800 && m < 7e3;) {
			m++;
			let e = t.range(-95, 90), n = t.range(-70, 95);
			this.canPlace(e, n, 1.2) && _.push(p(e, A(e, n) - .02, n, t.range(.7, 1.2), t.range(0, 6.28)));
		}
		this.addInstanced(this.grassGeo, this.leafMat, g, !1, "grass"), this.addInstanced(this.fernGeo, this.leafMat, _, !1, "fern"), this.shrubsAndRocks(t);
	}
	shrubsAndRocks(n) {
		let r = [];
		for (let e = 0; e < 5; e++) {
			let t = e * Math.PI / 5;
			r.push(zn("broad", n.range(1.55, 2.15), n.range(1.1, 1.6), 0, t, n.range(-.16, .16), !0, Math.cos(t * 2) * .28, Math.sin(t * 2) * .28));
		}
		let i = t(r, !1), a = [], o = 0;
		for (; a.length < 260 && o < 4e3;) {
			o++;
			let t = n.range(-140, 130), r = n.range(-100, 120);
			if (!this.canPlace(t, r, 1.7)) continue;
			let i = n.range(.7, 1.7);
			a.push(new e.Matrix4().compose(new e.Vector3(t, A(t, r) - .15, r), new e.Quaternion().setFromEuler(new e.Euler(0, n.range(0, 6.28), 0)), new e.Vector3(i, i * n.range(.8, 1.2), i)));
		}
		this.addInstanced(i, this.leafMat, a, !0, "shrub");
		let s = [];
		for (let t = 0; t < 3; t++) {
			let r = new e.IcosahedronGeometry(n.range(.8, 1.8), 2), i = r.getAttribute("position");
			for (let e = 0; e < i.count; e++) {
				let n = i.getX(e), r = i.getY(e), a = i.getZ(e), o = 1 + .22 * Math.sin(n * 4 + t) * Math.cos(a * 5 - t) + .1 * Math.sin(r * 9);
				i.setXYZ(e, n * o, r * o * .7, a * o);
			}
			r.computeVertexNormals(), s.push(r);
		}
		let c = t(s, !1), l = Ct();
		l.name === "limestone-photogrammetry" && (c = nn(F(c, 1.6), "stone"));
		let u = [];
		for (o = 0; u.length < 85 && o < 3e3;) {
			o++;
			let t = n.range(-150, 140), r = n.range(-110, 130);
			if (!we(t, r, 2.2)) continue;
			let i = n.range(.5, 2.2);
			Ce(t, r, 2.2 * i + 1) || Te(t, r) < 3 || ce(t, r) < 2.72 + 1.8 * i + .35 || u.push(new e.Matrix4().compose(new e.Vector3(t, A(t, r) - .35 * i, r), new e.Quaternion().setFromEuler(new e.Euler(n.range(-.2, .2), n.range(0, 6.28), n.range(-.2, .2))), new e.Vector3(i, i * n.range(.6, 1.1), i)));
		}
		this.addInstanced(c, l, u, !0, "boulder");
	}
	buildSpecies(e, t, n = this.bark) {
		for (let r = 0; r < e.length; r++) {
			let i = t.filter((e) => e.v === r);
			if (!i.length) continue;
			let a = i.map((e) => e.m), o = i.map((e) => e.c), s = e[r].trunk;
			n.name === "bark-photogrammetry" && (s = nn(F(s, 2.4), "bark")), this.addInstanced(s, n, a, !0, "trunk"), this.addInstanced(e[r].cards, this.leafMat, a, !0, "cards", o);
		}
	}
	addInstanced(t, n, r, i, a, o) {
		if (!t.getAttribute("position") || t.getAttribute("position").count === 0 || !r.length) return;
		let s = a === "far-forest" ? 200 : a === "grass" || a === "fern" ? 48 : 96, c = a === "grass" ? 75 : a === "fern" ? 100 : a === "shrub" ? 125 : a === "far-forest" ? 380 : 185, l = /* @__PURE__ */ new Map();
		for (let e = 0; e < r.length; e++) {
			let t = r[e].elements, n = `${Math.floor(t[12] / s)},${Math.floor(t[14] / s)}`, i = l.get(n);
			i ? i.push(e) : l.set(n, [e]);
		}
		for (let [u, d] of l) {
			let [l, f] = u.split(",").map(Number), p = new e.InstancedMesh(t, n, d.length);
			p.name = `${a}-${this.group.children.length}`;
			for (let e = 0; e < d.length; e++) {
				let t = d[e];
				p.setMatrixAt(e, r[t]), o && p.setColorAt(e, o[t]);
			}
			p.instanceMatrix.needsUpdate = !0, p.instanceColor && (p.instanceColor.needsUpdate = !0), p.castShadow = i, p.receiveShadow = !0, p.frustumCulled = !0, p.computeBoundingSphere(), i && n.map && (p.customDepthMaterial = new e.MeshDepthMaterial({
				depthPacking: e.RGBADepthPacking,
				map: n.map,
				alphaTest: n.alphaTest,
				side: e.DoubleSide
			})), this.group.add(p), this.tiles.push({
				mesh: p,
				x: (l + .5) * s,
				z: (f + .5) * s,
				range: c + s * .75
			});
		}
	}
	update(e) {
		if (this.time, !e) return;
		let t = e.position.x, n = e.position.z;
		for (let e of this.tiles) {
			let r = t - e.x, i = n - e.z;
			e.mesh.visible = r * r + i * i < e.range * e.range;
		}
	}
}, Gn = class {
	group = new e.Group();
	smokeOrigin = new e.Vector3(-2, 7.4, 22);
	lanterns = [];
	constructor() {
		this.group.name = "details", this.bridge(), this.lanternsAlongPath(), this.censer(), this.lions(), this.stele(), this.pavilion(), this.streamRailing(), this.paving();
	}
	paving() {
		let t = O.platform, n = t.x0 + .7, r = t.x1 - .7, i = t.z0 + 1.2, a = t.z1 - .55, o = r - n, s = a - i, c = new e.Mesh(new e.PlaneGeometry(o, s), Qe(o, s));
		c.rotation.x = -Math.PI / 2, c.position.set((n + r) / 2, O.platform.y + .025, (i + a) / 2), c.receiveShadow = !0, c.name = "temple-enclosure-photographic-paving", this.group.add(c);
	}
	bridge() {
		let t = R(.35), n = [], r = Le(13.4, 3.3, .45, 3.15, 1.05);
		for (let e of [26.1, 29.9]) n.push(r.clone().translate(36, .45, e));
		n.push(M(13.6, .34, 4.6, 36, 3.66, 28)), n.push(M(13.9, .18, 4.9, 36, 3.86, 28));
		for (let e of [-1, 1]) {
			for (let t = 0; t <= 12; t++) {
				let r = 29.5 + t * 1.1;
				n.push(M(.2, 1, .2, r, 4.45, 28 + e * 2.05)), t < 12 && n.push(M(1.1, .15, .16, r + .55, 4.88, 28 + e * 2.05));
			}
			n.push(M(13.4, .18, .26, 36, 4.95, 28 + e * 2.05));
		}
		for (let e of [-1, 1]) for (let t = 0; t < 3; t++) n.push(M(1.2, .18, 4.2, 36 + e * (7 + t * .5), 3.4 - t * .18, 28));
		let i = new e.Mesh(F(P(n), 1.4), t);
		i.castShadow = !0, i.receiveShadow = !0, this.group.add(i);
	}
	lanternsAlongPath() {
		let t = R(.5), n = [];
		for (let [t, r] of [
			[-7.5, 44],
			[3.5, 44],
			[-10, 34],
			[6, 34],
			[5, 10],
			[-10, 10],
			[25, 33],
			[29, 52]
		]) {
			let i = A(t, r);
			n.push(M(.75, .22, .75, t, i + .11, r)), n.push(N(.16, .2, 1.15, 8, t, i + .78, r)), n.push(M(.55, .55, .55, t, i + 1.62, r)), n.push(new e.ConeGeometry(.62, .42, 6).translate(t, i + 2.1, r)), n.push(new e.SphereGeometry(.09, 6, 4).translate(t, i + 2.38, r)), this.lanterns.push(new e.Vector3(t, i + 1.62, r));
		}
		let r = new e.Mesh(F(P(n), 1.4), t);
		r.castShadow = !0, r.receiveShadow = !0, this.group.add(r);
		let i = new e.Mesh(new e.SphereGeometry(.2, 8, 6), new e.MeshStandardMaterial({
			color: 2759181,
			emissive: new e.Color("#ffb45a"),
			emissiveIntensity: .9
		}));
		for (let e of this.lanterns) {
			let t = i.clone();
			t.position.copy(e), this.group.add(t);
		}
		for (let t = 0; t < Math.min(3, this.lanterns.length); t++) {
			let n = new e.PointLight(16756838, 7, 9, 2);
			n.position.copy(this.lanterns[t]).add(new e.Vector3(0, .05, 0)), this.group.add(n);
		}
		let a = new e.PointLight(16747068, 9, 8, 2);
		a.position.set(-2, O.platform.y + 4.3, 22), this.group.add(a);
	}
	censer() {
		let t = yt(), n = [], r = O.platform.y;
		for (let t = 0; t < 3; t++) {
			let r = t / 3 * Math.PI * 2, i = new e.Vector3(Math.cos(r) * 1.9, .19, Math.sin(r) * 1.9), a = new e.Vector3(Math.cos(r) * 1.55, 1.96, Math.sin(r) * 1.55);
			n.push(N(.23, .29, .18, 10, i.x, .105, i.z));
			let o = a.clone().sub(i), s = new e.CylinderGeometry(.13, .18, o.length(), 10);
			s.applyQuaternion(new e.Quaternion().setFromUnitVectors(new e.Vector3(0, 1, 0), o.normalize())), s.translate((i.x + a.x) / 2, (i.y + a.y) / 2, (i.z + a.z) / 2), n.push(s);
		}
		n.push(N(1.55, 1.4, .16, 20, 0, 1.91, 0));
		let i = [];
		for (let t = 0; t <= 12; t++) {
			let n = t / 12;
			i.push(new e.Vector2(1.18 + Math.sin(n * Math.PI) * .25 + .1 * n, n * 1.15));
		}
		let a = new e.LatheGeometry(i, 24);
		a.translate(0, 1.9, 0), n.push(a), n.push(new e.TorusGeometry(1.28, .09, 8, 28).rotateX(Math.PI / 2).translate(0, 3.05, 0));
		for (let t of [-1, 1]) {
			let r = new e.TorusGeometry(.38, .07, 8, 16, Math.PI * 1.2);
			r.rotateY(Math.PI / 2), r.translate(t * 1.35, 2.6, 0), n.push(r);
		}
		n.push(N(1.1, 1.25, .22, 20, 0, 3.17, 0)), n.push(new e.SphereGeometry(.22, 10, 8).translate(0, 3.5, 0)), n.push(new e.ConeGeometry(.2, .55, 8).translate(0, 3.8, 0));
		let o = new e.Mesh(P(n), t);
		o.position.set(-2, r, 22), o.castShadow = !0, o.receiveShadow = !0, this.group.add(o), this.smokeOrigin.set(-2, r + 4.15, 22);
	}
	lions() {
		let t = R(.55), n = [];
		for (let t of [-10.5, 6.5]) {
			let r = 41.5, i = A(t, r);
			n.push(M(1.4, .5, 1.8, t, i + .25, r)), n.push(new e.SphereGeometry(.55, 12, 10).scale(1, 1.15, 1.25).translate(t, i + 1.1, r)), n.push(new e.SphereGeometry(.42, 12, 10).translate(t, i + 1.75, r + .45));
			for (let a of [-1, 1]) n.push(new e.SphereGeometry(.28, 8, 6).translate(t + a * .38, i + 2, r + .4)), n.push(new e.CylinderGeometry(.12, .15, .8, 6).translate(t + a * .35, i + .65, r + .5));
			n.push(new e.CylinderGeometry(.1, .16, .9, 6).translate(t, i + .9, r + 1.05));
		}
		let r = new e.Mesh(F(P(n), 1.4), t);
		r.castShadow = !0, r.receiveShadow = !0, this.group.add(r);
	}
	stele() {
		let t = R(.7), n = R(.42), r = new e.Group(), i = new e.Mesh(new e.BoxGeometry(1.8, .4, 1.1), t);
		i.position.y = .2;
		let a = new e.Mesh(new e.BoxGeometry(1.3, 2.4, .22), n);
		a.position.set(0, 1.55, 0);
		let o = new e.Mesh(new e.BoxGeometry(1.5, .16, .4), t);
		o.position.y = 2.82, r.add(i, a, o), r.position.set(7.5, A(7.5, 36.5), 36.5), r.rotation.y = -.35, r.traverse((t) => {
			t instanceof e.Mesh && (t.castShadow = !0, t.receiveShadow = !0);
		}), this.group.add(r);
	}
	pavilion() {
		let t = gt(!1), n = st(), r = R(.4), i = new e.Group(), a = Math.max(A(29, 51), ge) + .15, o = new e.Mesh(new e.CylinderGeometry(3.8, 4.1, .5, 6), r);
		o.position.y = .25, o.castShadow = !0, o.receiveShadow = !0, i.add(o);
		for (let n = 0; n < 6; n++) {
			let r = n / 6 * Math.PI * 2 + Math.PI / 6, a = new e.Mesh(new e.CylinderGeometry(.13, .16, 3.1, 8), t);
			a.position.set(Math.cos(r) * 3.1, 2.05, Math.sin(r) * 3.1), a.castShadow = !0, i.add(a);
			let o = new e.Mesh(new e.CylinderGeometry(.18, .18, .08, 8), _t());
			o.position.set(Math.cos(r) * 3.1, 3.5, Math.sin(r) * 3.1), i.add(o);
		}
		let s = new e.Mesh(new e.CylinderGeometry(.25, 4.6, 1.7, 6), n);
		s.position.y = 4.4, s.castShadow = !0, i.add(s);
		let c = new e.Mesh(new e.ConeGeometry(.18, .8, 8), _t());
		c.position.y = 5.55, i.add(c);
		for (let t = 0; t < 6; t++) {
			let r = t / 6 * Math.PI * 2 + Math.PI / 6, a = new e.Mesh(new e.CylinderGeometry(.02, .09, .7, 5), n);
			a.position.set(Math.cos(r) * 4.5, 4.95, Math.sin(r) * 4.5), a.rotation.z = .9, a.rotation.y = -r, i.add(a);
		}
		i.position.set(29, a, 51), this.group.add(i);
	}
	streamRailing() {
		let t = R(.4), n = [];
		for (let e = 0; e < 14; e++) {
			let t = 34 + e * 1.6, r = 31.6 - e * .06, i = A(r, t);
			n.push(M(.18, 1, .18, r, i + .5, t)), e < 13 && n.push(M(.14, .14, 1.6, r - .03, i + .9, t + .8));
		}
		let r = new e.Mesh(F(P(n), 1.4), t);
		r.castShadow = !0, r.receiveShadow = !0, this.group.add(r);
	}
};
//#endregion
//#region src/gate-kit/world/geom.ts
function Kn(t) {
	if (!t.getAttribute("uv")) {
		let n = t.getAttribute("position").count;
		t.setAttribute("uv", new e.BufferAttribute(new Float32Array(n * 2), 2));
	}
	return t;
}
function V(t, n, r, i = 0, a = 0, o = 0, s = 0, c = 0, l = 0) {
	let u = new e.BoxGeometry(t, n, r);
	return c && u.rotateX(c), s && u.rotateY(s), l && u.rotateZ(l), u.translate(i, a, o), Kn(u);
}
function qn(t, n, r, i, a = 0, o = 0, s = 0) {
	let c = new e.CylinderGeometry(t, n, r, i, 1, !1);
	return c.translate(a, o, s), Kn(c);
}
function H(e) {
	let n = e.filter((e) => e && e.getAttribute("position")?.count), r = n.every((e) => e.index !== null), i = t(n.map((e) => Kn(r ? e : e.index ? e.toNonIndexed() : e)), !1);
	if (!i) throw Error("merge failed");
	return i.computeBoundingSphere(), i;
}
function Jn(t, n) {
	let r = t.getAttribute("position").count, i = new Float32Array(r * 3);
	for (let e = 0; e < r; e++) i[e * 3] = n.r, i[e * 3 + 1] = n.g, i[e * 3 + 2] = n.b;
	return t.setAttribute("color", new e.BufferAttribute(i, 3)), t;
}
function Yn(t, n, r) {
	let i = new e.Shape();
	i.moveTo(0, 0), i.quadraticCurveTo(t * .15, n * .92, t * .55, n * .55), i.quadraticCurveTo(t * .86, n * .3, t, n * .62), i.lineTo(t, 0), i.quadraticCurveTo(t * .45, n * .28, 0, 0);
	let a = new e.ExtrudeGeometry(i, {
		depth: r,
		bevelEnabled: !1,
		curveSegments: 12
	});
	return a.translate(0, 0, -r / 2), Kn(a);
}
//#endregion
//#region src/gate-kit/core/math.ts
var U = (e, t, n) => e < t ? t : e > n ? n : e, W = (e, t, n) => e + (t - e) * n, Xn = (e, t, n) => {
	let r = U((n - e) / (t - e), 0, 1);
	return r * r * (3 - 2 * r);
};
function Zn(e) {
	let t = e >>> 0;
	return () => {
		t |= 0, t = t + 1831565813 | 0;
		let e = Math.imul(t ^ t >>> 15, 1 | t);
		return e = e + Math.imul(e ^ e >>> 7, 61 | e) ^ e, ((e ^ e >>> 14) >>> 0) / 4294967296;
	};
}
var G = class {
	next;
	constructor(e) {
		let t = typeof e == "number" ? e : Qn(e);
		this.next = Zn(t);
	}
	value() {
		return this.next();
	}
	range(e, t) {
		return e + (t - e) * this.next();
	}
	int(e, t) {
		return Math.floor(this.range(e, t + 1));
	}
	pick(e) {
		return e[Math.floor(this.next() * e.length) % e.length];
	}
	chance(e) {
		return this.next() < e;
	}
	sign() {
		return this.next() < .5 ? -1 : 1;
	}
	gauss() {
		let e = Math.max(1e-6, this.next());
		return Math.sqrt(-2 * Math.log(e)) * Math.cos(6.2831853 * this.next());
	}
};
function Qn(e) {
	let t = 2166136261;
	for (let n = 0; n < e.length; n++) t ^= e.charCodeAt(n), t = Math.imul(t, 16777619);
	return t >>> 0;
}
function $n(e, t) {
	let n = Math.imul(e | 0, 374761393) + Math.imul(t | 0, 668265263);
	return n = Math.imul(n ^ n >>> 13, 1274126177), ((n ^ n >>> 16) >>> 0) / 4294967296;
}
var er = (e) => e * e * (3 - 2 * e);
function tr(e, t) {
	let n = Math.floor(e), r = Math.floor(t), i = e - n, a = t - r, o = er(i), s = er(a), c = $n(n, r), l = $n(n + 1, r), u = $n(n, r + 1), d = $n(n + 1, r + 1);
	return W(W(c, l, o), W(u, d, o), s) * 2 - 1;
}
function nr(e, t, n = 4, r = 2.02, i = .5) {
	let a = .5, o = 1, s = 0, c = 0;
	for (let l = 0; l < n; l++) s += a * tr(e * o + l * 17.31, t * o - l * 9.13), c += a, a *= i, o *= r;
	return s / c;
}
//#endregion
//#region src/gate-kit/world/textures.ts
var rr = /* @__PURE__ */ new Map();
function ir(t = "flagstone", n = 8) {
	let r = `${t}:${n}`, i = rr.get(r);
	if (i) return i;
	let a = 2048, o = new G(t), s = a / n, c = [], l = -o.range(0, s * .4), u = 0;
	for (; l < a;) {
		let e = s * o.range(.62, 1.02), t = -o.range(0, s * .8);
		for (; t < a;) {
			let n = s * o.range(.62, 1.28), r = t + 2.5, i = t + n - 2.5, a = l + 2.5, u = l + e - 2.5;
			if (i - r > 20 && u - a > 20) {
				let e = Math.min(i - r, u - a) * o.range(.06, .18), t = () => o.range(-1.8, 1.8), n = [
					[r + e + t(), a + t()],
					[(r + i) / 2 + t(), a + o.range(-1, 2)],
					[i - e + t(), a + t()],
					[i + t(), a + e + t()],
					[i + t(), (a + u) / 2 + t()],
					[i + t(), u - e + t()],
					[i - e + t(), u + t()],
					[(r + i) / 2 + t(), u + o.range(-2, 1)],
					[r + e + t(), u + t()],
					[r + t(), u - e + t()],
					[r + t(), (a + u) / 2 + t()],
					[r + t(), a + e + t()]
				], l = [];
				for (let e = 0; e < o.int(0, 2); e++) {
					let e = o.range(0, Math.PI * 2), t = o.range(s * .12, s * .35);
					l.push([
						(r + i) / 2,
						(a + u) / 2,
						(r + i) / 2 + Math.cos(e) * t,
						(a + u) / 2 + Math.sin(e) * t
					]);
				}
				c.push({
					pts: n,
					tone: o.range(.3, .48),
					moss: o.range(0, 1),
					cracks: l
				});
			}
			t += n;
		}
		l += e, u++;
	}
	let d = Xt(a, a, (e) => {
		e.fillStyle = "#1b1c17", e.fillRect(0, 0, a, a);
		for (let t = 0; t < 1e4; t++) {
			let t = 18 + Math.floor(o.range(0, 22));
			e.fillStyle = `rgba(${t},${t + 2},${t - 1},0.45)`, e.fillRect(o.range(0, a), o.range(0, a), o.range(1, 4), o.range(1, 4));
		}
		let t = (e, t, n) => {
			n.beginPath(), n.moveTo(e.pts[0][0], e.pts[0][1]);
			for (let t = 1; t < e.pts.length; t++) n.lineTo(e.pts[t][0], e.pts[t][1]);
			if (n.closePath(), t) {
				let t = Math.floor(130 + e.tone * 210);
				n.fillStyle = `rgb(${t},${t},${t})`, n.fill(), n.strokeStyle = "#080808", n.lineWidth = 5, n.stroke();
				return;
			}
			let r = e.tone * 100;
			n.fillStyle = `hsl(${40 + o.range(-5, 5)}, ${2 + o.range(0, 3)}%, ${r}%)`, n.fill(), n.save(), n.clip();
			let i = n.createLinearGradient(0, 0, a * .1, a * .1);
			i.addColorStop(0, "rgba(255,250,240,0.10)"), i.addColorStop(.6, "rgba(255,250,240,0.02)"), i.addColorStop(1, "rgba(0,0,0,0.10)"), n.fillStyle = i, n.fillRect(0, 0, a, a);
			for (let t = 0; t < 520; t++) n.fillStyle = o.range(-18, 18) > 0 ? `rgba(210,208,196,${o.range(.02, .07)})` : `rgba(8,9,8,${o.range(.02, .09)})`, n.beginPath(), n.arc(e.pts[0][0] + o.range(-s, s), e.pts[0][1] + o.range(-s, s), o.range(.5, 2.6), 0, Math.PI * 2), n.fill();
			for (let t = 0; t < 4; t++) {
				let t = e.pts[0][0] + o.range(-s * .5, s), r = e.pts[0][1] + o.range(-s * .5, s), i = o.range(s * .12, s * .4), a = n.createRadialGradient(t, r, 0, t, r, i);
				a.addColorStop(0, "rgba(14,16,12,0.16)"), a.addColorStop(1, "rgba(14,16,12,0)"), n.fillStyle = a, n.fillRect(t - i, r - i, i * 2, i * 2);
			}
			let c = .08 + e.moss * .2, l = n.createLinearGradient(0, e.pts[1][1], 0, e.pts[8][1]);
			l.addColorStop(0, "rgba(46,64,26,0)"), l.addColorStop(1, `rgba(46,64,26,${c})`), n.fillStyle = l, n.fillRect(0, 0, a, a), n.strokeStyle = "rgba(10,12,9,0.5)", n.lineWidth = 1.1;
			for (let t of e.cracks) n.beginPath(), n.moveTo(t[0], t[1]), n.lineTo((t[0] + t[2]) / 2 + o.range(-5, 5), (t[1] + t[3]) / 2 + o.range(-5, 5)), n.lineTo(t[2], t[3]), n.stroke();
			n.restore(), n.strokeStyle = "rgba(8,10,8,0.55)", n.lineWidth = 2.2, n.stroke(), n.strokeStyle = `rgba(48,62,26,${.035 + e.moss * .09})`, n.lineWidth = 3.6, n.stroke();
		};
		c.forEach((n) => t(n, !1, e));
		for (let t = 0; t < 70; t++) {
			let t = o.range(0, a), n = o.range(0, a);
			e.fillStyle = `rgba(${64 + o.range(0, 45)},${40 + o.range(0, 25)},${18 + o.range(0, 15)},0.35)`, e.beginPath(), e.ellipse(t, n, o.range(2, 6), o.range(.8, 2.2), o.range(0, 3), 0, Math.PI * 2), e.fill();
		}
	});
	d.wrapS = d.wrapT = e.RepeatWrapping, d.anisotropy = 16;
	let f = Xt(a, a, (e) => {
		e.fillStyle = "#090909", e.fillRect(0, 0, a, a);
		for (let t of c) {
			e.beginPath(), e.moveTo(t.pts[0][0], t.pts[0][1]);
			for (let n = 1; n < t.pts.length; n++) e.lineTo(t.pts[n][0], t.pts[n][1]);
			e.closePath();
			let n = Math.floor(120 + t.tone * 230);
			e.fillStyle = `rgb(${n},${n},${n})`, e.fill(), e.strokeStyle = "#080808", e.lineWidth = 5, e.stroke();
		}
	}, !1);
	f.wrapS = f.wrapT = e.RepeatWrapping, f.anisotropy = 16;
	let p = {
		map: d,
		height: f
	};
	return rr.set(r, p), p;
}
function ar(e = 6, t = !0, n = 0, r = 0) {
	let i = On("gate-paving") ?? ir("lingyin-flagstone", 8).map, a = e.toFixed(2);
	return Jt({
		name: t ? "flagstone-path" : "flagstone-platform",
		params: {
			color: 16777215,
			map: i,
			roughness: 1,
			metalness: 0,
			envMapIntensity: .1
		},
		color: `
      vec2 warp = (vec2(cgFbm2(cgP.xz * 0.33 + 1.0), cgFbm2(cgP.xz * 0.33 + 5.0)) - 0.5) * 0.5;
      vec2 suv = cgP.xz / ${a} + warp;
      vec3 st = texture2D(map, suv).rgb;
      float lum = dot(st, vec3(0.333));
      // soil and leaf litter outside the paved path
      float n = cgFbm2(cgP.xz * 0.55 + 3.0);
      float fine = cgNoise2(cgP.xz * 5.0);
      vec3 soil = mix(vec3(0.035,0.033,0.024), vec3(0.115,0.095,0.058), n * 0.8 + fine * 0.2);
      float moss = smoothstep(0.52, 0.78, cgFbm2(cgP.xz * 1.35 + 8.0));
      soil = mix(soil, vec3(0.075,0.105,0.035), moss * 0.7);

      vec2 gatePos = cgP.xz - vec2(${n.toFixed(2)}, ${r.toFixed(2)});
      float halfW = mix(3.3, 4.8, 1.0 - smoothstep(7.0, 13.0, gatePos.y));
      halfW += (cgFbm2(gatePos * 0.7 + 2.0) - 0.5) * 1.5;
      float path = smoothstep(halfW + 0.6, halfW - 0.9, abs(gatePos.x)) * smoothstep(3.6, 4.8, gatePos.y);
      float courtyard = smoothstep(-20.0, -16.0, gatePos.y) * (1.0 - smoothstep(3.0, 4.2, gatePos.y)) * smoothstep(6.4, 4.8, abs(gatePos.x));
      path = max(path, courtyard);
      ${t ? "" : "path = 1.0;"}

      // stone: warm grey, with dark mortar and green in the joints
      vec3 stone = mix(vec3(dot(st, vec3(0.333))), st, 0.78) * 1.06;
      float joint = smoothstep(0.34, 0.16, lum);
      stone = mix(stone, stone * 0.62, joint * 0.5);
      float jointMoss = joint * smoothstep(0.25, 0.75, moss + 0.15);
      stone = mix(stone, vec3(0.11,0.15,0.05), jointMoss * 0.26);
      // damp, darker and slightly cooler in low spots
      float damp = smoothstep(0.58, 0.78, cgFbm2(cgP.xz * 0.45 + 17.0));
      stone = mix(stone, stone * vec3(0.62,0.66,0.66), damp * 0.5);
      // fine mineral variation
      stone *= 0.9 + 0.18 * cgNoise2(cgP.xz * 11.0);

      vec3 c = mix(soil, stone, path);
      // dappled sunlight: broad soft pools, not a uniform multiplier
      float dapple = smoothstep(0.55, 0.72, cgFbm2(cgP.xz * 0.95 + 8.0));
      c *= 0.93 + 0.1 * dapple * (0.35 + 0.65 * path);
      // scattered leaves on the flags
      float leaf = smoothstep(0.78, 0.84, cgNoise2(cgP.xz * 3.2 + 1.7));
      c = mix(c, vec3(0.22,0.12,0.045), leaf * path * 0.18);
      diffuseColor.rgb = c;
    `,
		roughness: "\n      float damp = smoothstep(0.58, 0.78, cgFbm2(cgP.xz * 0.45 + 17.0));\n      float l = dot(diffuseColor.rgb, vec3(0.333));\n      roughnessFactor = clamp(0.82 + 0.14 * l - damp * 0.28, 0.35, 1.0);\n    ",
		normal: `
      vec2 buv = cgP.xz / ${a} + (vec2(cgFbm2(cgP.xz * 0.33 + 1.0), cgFbm2(cgP.xz * 0.33 + 5.0)) - 0.5) * 0.5;
      float e = 0.012;
      float h0 = dot(texture2D(map, buv).rgb, vec3(0.333));
      float hx = dot(texture2D(map, buv + vec2(e, 0.0)).rgb, vec3(0.333));
      float hz = dot(texture2D(map, buv + vec2(0.0, e)).rgb, vec3(0.333));
      cgBump = vec3(h0 - hx, 0.0, h0 - hz) * 3.4;
    `
	});
}
function or(t = 0) {
	let n = at(t);
	if (n) return n.name = "granite-photogrammetry", n;
	let r = new G("granite-tex"), i = Xt(512, 512, (e) => {
		e.fillStyle = "#4a4a45", e.fillRect(0, 0, 512, 512);
		for (let t = 0; t < 9e3; t++) {
			let t = 60 + Math.floor(r.range(0, 80));
			e.fillStyle = `rgba(${t},${t + r.range(-3, 3)},${t - r.range(0, 8)},${r.range(.15, .6)})`, e.fillRect(r.range(0, 512), r.range(0, 512), r.range(1, 3), r.range(1, 3));
		}
		for (let t = 0; t < 700; t++) e.fillStyle = r.chance(.5) ? "rgba(200,196,180,0.35)" : "rgba(20,20,18,0.4)", e.fillRect(r.range(0, 512), r.range(0, 512), r.range(1, 4), r.range(1, 4));
		for (let t = 0; t < 12; t++) {
			let t = r.range(0, 512), n = r.range(0, 512), i = r.range(20, 90), a = e.createRadialGradient(t, n, 0, t, n, i);
			a.addColorStop(0, "rgba(40,60,26,0.32)"), a.addColorStop(1, "rgba(40,60,26,0)"), e.fillStyle = a, e.fillRect(t - i, n - i, i * 2, i * 2);
		}
	});
	return i.wrapS = i.wrapT = e.RepeatWrapping, i.anisotropy = 16, Jt({
		name: "granite-textured",
		params: {
			color: 16777215,
			map: i,
			roughness: 1,
			metalness: 0,
			envMapIntensity: .12
		},
		uniforms: { uWarm: { value: t } },
		head: "uniform float uWarm;",
		color: "\n      vec3 c = texture2D(map, cgP.xz * 0.55 + cgP.y * 0.35).rgb;\n      c = mix(c, c * vec3(1.06, 0.98, 0.88), uWarm * 0.6);\n      float moss = smoothstep(0.55, 0.8, cgFbm2(cgP.xz * 1.8 + 5.0));\n      c = mix(c, vec3(0.11,0.15,0.055), moss * 0.45);\n      c *= 1.0 - (1.0 - smoothstep(0.0, 0.7, cgP.y - 0.3)) * 0.3;\n      diffuseColor.rgb = c;\n    ",
		normal: "\n      float e = 0.02;\n      float h0 = dot(texture2D(map, cgP.xz * 0.55 + cgP.y * 0.35).rgb, vec3(0.333));\n      float hx = dot(texture2D(map, (cgP.xz + vec2(e,0.0)) * 0.55 + cgP.y * 0.35).rgb, vec3(0.333));\n      float hz = dot(texture2D(map, (cgP.xz + vec2(0.0,e)) * 0.55 + cgP.y * 0.35).rgb, vec3(0.333));\n      cgBump = vec3(h0-hx, 0.0, h0-hz) * 2.0;\n    "
	});
}
//#endregion
//#region src/gate-kit/world/roof.ts
var K = {
	w: 13.8,
	d: 6.4,
	eaveY: 7.02,
	rise: 3.15,
	overhang: .9,
	ridgeFrac: .44,
	cornerLift: .3
}, sr = K.w / 2 + K.overhang, q = K.d / 2 + K.overhang, cr = K.w * K.ridgeFrac / 2;
function lr(t, n, r) {
	let i = (Math.abs(n - .5) * 2) ** 5 * (1 - r) ** 2.15 * K.cornerLift, a = K.eaveY + K.rise * r ** 1.32 + i;
	if (t === "front" || t === "back") {
		let i = t === "front" ? 1 : -1, o = (n - .5) * 2 * (sr * (1 - r) + cr * r), s = i * q * (1 - r) ** .94;
		return new e.Vector3(o, a, s);
	}
	let o = (t === "left" ? -1 : 1) * (sr * (1 - r) + cr * r), s = (n - .5) * 2 * q * (1 - r);
	return new e.Vector3(o, a, s);
}
function ur(t, n, r) {
	let i = .008, a = lr(t, Math.min(1, n + i), r).sub(lr(t, Math.max(0, n - i), r)), o = lr(t, n, Math.min(1, r + i)).sub(lr(t, n, Math.max(0, r - i))), s = new e.Vector3().crossVectors(a, o).normalize();
	return s.y < 0 && s.negate(), s;
}
var dr = class {
	group = new e.Group();
	tileMat = en();
	fieldMat = st();
	constructor() {
		this.group.name = "roof", this.fieldMat.name = "gate-photographic-roof", this.fieldMat.color.set("#a3a99b"), this.buildField(), this.buildCoverTiles(), this.buildRidges(), this.buildEaves(), this.buildMossPatches();
	}
	buildField() {
		let t = [];
		for (let n of [
			"front",
			"back",
			"left",
			"right"
		]) {
			let r = [], i = [], a = [];
			for (let e = 0; e <= 14; e++) {
				let t = e / 14;
				for (let e = 0; e <= 28; e++) {
					let a = e / 28, o = lr(n, a, t);
					r.push(o.x, o.y, o.z), i.push((a - .5) * (n === "front" || n === "back" ? sr * 2 : q * 2), t * 6.5);
				}
			}
			for (let e = 0; e < 14; e++) for (let t = 0; t < 28; t++) {
				let n = e * 29 + t, r = n + 1, i = n + 28 + 1, o = i + 1;
				a.push(n, r, i, r, o, i);
			}
			let o = new e.BufferGeometry();
			o.setAttribute("position", new e.Float32BufferAttribute(r, 3)), o.setAttribute("uv", new e.Float32BufferAttribute(i, 2)), o.setIndex(a), o.computeVertexNormals(), t.push(o);
		}
		let n = new e.Mesh(H(t), this.fieldMat);
		n.castShadow = !0, n.receiveShadow = !0, this.group.add(n);
	}
	buildCoverTiles() {
		let t = new G("roof-tiles"), n = [], r = .095, i = (i, a, o, s) => {
			let c = [], l = [], u = [], d = new e.Color().setHSL(.12 + t.range(-.02, .02), .035, .13 + t.range(-.03, .045)), f = t.chance(.32), p = [], m = [], h = [];
			for (let e = 0; e <= 3; e++) {
				let t = o + (s - o) * (e / 3), n = lr(i, a, t), r = ur(i, a, t), c = .01, l = lr(i, Math.min(1, a + c), t).sub(lr(i, Math.max(0, a - c), t)).normalize();
				p.push(n), m.push(l), h.push(r);
			}
			for (let n = 0; n <= 3; n++) {
				let i = p[n], a = m[n], o = h[n], s = r * (n === 0 ? 1.14 : .98), u = .035 + (n === 0 ? .02 : 0);
				for (let r = 0; r <= 5; r++) {
					let p = r / 5 * Math.PI, m = i.clone().addScaledVector(a, Math.cos(p) * s).addScaledVector(o, u + Math.sin(p) * s);
					c.push(m.x, m.y, m.z);
					let h = n === 0 ? .72 : .14, g = d.clone().lerp(new e.Color(.15, .21, .055), h * t.value() * 1.1 + (f ? .35 : 0));
					n === 0 && g.multiplyScalar(.8), l.push(g.r, g.g, g.b);
				}
			}
			for (let e = 0; e < 3; e++) for (let t = 0; t < 5; t++) {
				let n = e * 6 + t, r = n + 5 + 1;
				u.push(n, n + 1, r, n + 1, r + 1, r);
			}
			let g = p[0], _ = h[0], v = m[0], y = g.clone().addScaledVector(_, .03), b = c.length / 3;
			c.push(y.x, y.y, y.z), l.push(d.r * .7, d.g * .7, d.b * .7);
			let x = r * 1.16;
			for (let e = 0; e <= 10; e++) {
				let t = e / 10 * Math.PI * 2, n = y.clone().addScaledVector(v, Math.cos(t) * x).addScaledVector(_, Math.sin(t) * x);
				c.push(n.x, n.y, n.z), l.push(d.r * .62, d.g * .62, d.b * .62);
			}
			for (let e = 0; e < 10; e++) u.push(b, b + 1 + e, b + 2 + e);
			let S = new e.BufferGeometry();
			S.setAttribute("position", new e.Float32BufferAttribute(c, 3)), S.setAttribute("color", new e.Float32BufferAttribute(l, 3)), S.setIndex(u), S.computeVertexNormals(), n.push(S);
		};
		for (let e = 0; e <= 52; e++) {
			let t = e / 52;
			for (let e = 0; e < 1; e++) {
				let n = e / 12, r = Math.min(1, (e + 1) / 12 + .018);
				i("front", t, n, r), i("back", t, n, r);
			}
		}
		for (let e = 0; e <= 20; e++) {
			let t = e / 20;
			for (let e = 0; e < 1; e++) {
				let n = e / 12, r = Math.min(1, (e + 1) / 12 + .018);
				i("left", t, n, r), i("right", t, n, r);
			}
		}
		let a = new e.Mesh(H(n), this.tileMat);
		a.castShadow = !0, a.receiveShadow = !0, this.group.add(a);
	}
	buildRidges() {
		let t = [], n = K.eaveY + K.rise;
		t.push(V(cr * 2 + 1.2, .2, .42, 0, n + .2, 0));
		for (let r = -cr - .4; r <= cr + .4; r += .28) {
			let i = new e.CylinderGeometry(.16, .16, .22, 10);
			i.translate(r, n + .36, 0), t.push(i);
		}
		for (let e = -cr - .3; e <= cr + .3; e += .34) for (let r of [-1, 1]) t.push(V(.24, .18, .04, e, n + .2, r * .22));
		for (let e of [-1, 1]) {
			t.push(V(.4, .32, .46, e * (cr + .48), n + .18, 0));
			let r = V(.3, .5, .34, e * (cr + .6), n + .5, .02);
			r.rotateZ(e * -.8), t.push(r);
			let i = V(.2, .28, .28, e * (cr + .78), n + .7, .02);
			i.rotateZ(e * -1.25), t.push(i);
		}
		for (let r of [-1, 1]) for (let i of [-1, 1]) {
			let a = new e.Vector3(r * cr, n + .1, 0), o = new e.Vector3(r * sr, K.eaveY + K.cornerLift * .65, i * q), s = o.clone().sub(a), c = s.length(), l = new e.BoxGeometry(.3, c, .3);
			l.translate(0, c / 2, 0), l.applyQuaternion(new e.Quaternion().setFromUnitVectors(new e.Vector3(0, 1, 0), s.normalize())), l.translate(a.x, a.y, a.z), t.push(l);
			for (let n = .06; n < .96; n += .1) {
				let r = a.clone().lerp(o, n), i = new e.CylinderGeometry(.13, .13, .2, 8);
				i.translate(r.x, r.y + .18, r.z), t.push(i);
			}
		}
		let r = H(t);
		Jn(r, new e.Color(.14, .15, .14));
		let i = new e.Mesh(r, this.tileMat);
		i.castShadow = !0, i.receiveShadow = !0, this.group.add(i);
	}
	buildMossPatches() {
		let t = new G("roof-moss-patches"), n = [], r = [];
		for (let i = 0; i < 120; i++) {
			let a = [
				"front",
				"back",
				"left",
				"right"
			][i % 4], o = t.range(.06, .94), s = t.chance(.55) ? t.range(.03, .3) : t.range(.55, .96), c = lr(a, o, s), l = ur(a, o, s), u = lr(a, Math.min(1, o + .01), s).sub(lr(a, Math.max(0, o - .01), s)).normalize(), d = new e.Vector3().crossVectors(l, u).normalize(), f = t.range(.14, .45), p = t.int(6, 9);
			n.length;
			let m = [], h = [];
			m.push(c.x + l.x * .012, c.y + l.y * .012, c.z + l.z * .012);
			for (let e = 0; e <= p; e++) {
				let n = e / p * Math.PI * 2, r = f * t.range(.6, 1), i = c.clone().addScaledVector(u, Math.cos(n) * r).addScaledVector(d, Math.sin(n) * r * t.range(.55, 1)).addScaledVector(l, .012);
				m.push(i.x, i.y, i.z), e < p && h.push(0, e + 1, e + 2);
			}
			let g = new e.BufferGeometry();
			g.setAttribute("position", new e.Float32BufferAttribute(m, 3)), g.setIndex(h), g.computeVertexNormals(), n.push(g);
			let _ = new e.Color().setHSL(.22 + t.range(-.02, .02), .5, .09 + t.range(0, .04));
			for (let e = 0; e < m.length / 3; e++) r.push(_.r, _.g, _.b);
		}
		let i = H(n.map((t) => (t.setAttribute("color", new e.Float32BufferAttribute(r.slice(0, t.getAttribute("position").count * 3), 3)), t))), a = new e.MeshStandardMaterial({
			color: 5466936,
			roughness: 1,
			vertexColors: !0,
			polygonOffset: !0,
			polygonOffsetFactor: -1,
			polygonOffsetUnits: -1,
			side: e.DoubleSide
		}), o = new e.Mesh(i, a);
		o.receiveShadow = !0, this.group.add(o);
	}
	buildEaves() {
		let t = Qt(1), n = [];
		for (let e of [-1, 1]) n.push(V(sr * 2, .2, .16, 0, K.eaveY - .26, e * q)), n.push(V(.16, .2, q * 2, e * sr, K.eaveY - .26, 0));
		for (let t = -sr + .3; t <= sr - .3; t += .34) for (let r of [-1, 1]) {
			let i = new e.BoxGeometry(.1, .14, 1.7);
			i.rotateX(r * .22), i.translate(t, K.eaveY - .3, r * (q - .8)), n.push(i);
			let a = new e.BoxGeometry(.11, .15, .06);
			a.translate(t, K.eaveY - .42, r * (q + .04)), n.push(a);
		}
		for (let t = -q + .4; t <= q - .4; t += .36) for (let r of [-1, 1]) {
			let i = new e.BoxGeometry(1.6, .14, .1);
			i.rotateZ(r * -.22), i.translate(r * (sr - .8), K.eaveY - .3, t), n.push(i);
		}
		n.push(V(sr * 2 - .6, .12, q * 2 - .6, 0, K.eaveY - .14, 0));
		let r = new e.Mesh(H(n), t);
		r.castShadow = !0, r.receiveShadow = !0, this.group.add(r);
		let i = [];
		for (let t of [-1, 1]) for (let n of [-1, 1]) {
			let r = new e.CylinderGeometry(.04, .12, .75, 8);
			r.rotateZ(t * -.7), r.rotateX(n * .25), r.translate(t * (sr - .1), K.eaveY + .28, n * (q - .1)), i.push(r);
		}
		let a = H(i);
		Jn(a, new e.Color(.15, .16, .15));
		let o = new e.Mesh(a, this.tileMat);
		o.castShadow = !0, this.group.add(o), this.group.traverse((t) => {
			if (t instanceof e.Mesh) {
				let n = t.geometry;
				!n.getAttribute("color") && t.material === this.tileMat && Jn(n, new e.Color(.16, .17, .16));
			}
		});
	}
};
//#endregion
//#region src/world/static_batch.ts
function fr(n) {
	let r = /* @__PURE__ */ new Map();
	for (let t of [...n.children]) {
		if (!(t instanceof e.Mesh) || t instanceof e.InstancedMesh || t.name || Array.isArray(t.material) || t.material.transparent || !t.visible) continue;
		let n = t.geometry;
		if (n.morphAttributes.position || t.customDepthMaterial) continue;
		let i = Object.keys(n.attributes).sort().map((e) => `${e}:${n.attributes[e].itemSize}:${n.attributes[e].normalized}`).join(","), a = `${t.material.uuid}:${t.castShadow}:${t.receiveShadow}:${t.renderOrder}:${i}`, o = r.get(a) ?? [];
		o.push(t), r.set(a, o);
	}
	for (let i of r.values()) {
		if (i.length < 2) continue;
		let r = i.map((e) => {
			e.updateMatrix();
			let t = e.geometry.index ? e.geometry.toNonIndexed() : e.geometry.clone();
			return t.applyMatrix4(e.matrix), t;
		}), a = t(r, !1);
		if (r.forEach((e) => e.dispose()), !a) continue;
		a.computeBoundingSphere();
		let o = i[0], s = o.material, c = new e.Mesh(a, s);
		c.name = `static-batch-${s.name || s.uuid}`, c.castShadow = o.castShadow, c.receiveShadow = o.receiveShadow, c.renderOrder = o.renderOrder, n.add(c), i.forEach((e) => n.remove(e));
	}
}
//#endregion
//#region src/gate-kit/world/gate.ts
var J = .35, pr = 5.6, mr = [
	-6,
	-2.6,
	2.6,
	6
], Y = 2, hr = class {
	group = new e.Group();
	roof;
	timber = Qt(0);
	timberDark = Qt(1);
	stone = or(.12);
	balustradeStone = R(.2);
	plaster = $t();
	gold = tn();
	constructor() {
		this.group.name = "gate", this.buildPlatformAndBases(), this.buildColumns(), this.buildBrackets(), this.buildWalls(), this.buildRailings(), this.buildPlaque(), this.buildCeiling(), this.buildWings(), this.buildIvy(), this.buildContactShadow(), this.stone.name === "granite-photogrammetry" && this.group.traverse((t) => {
			!(t instanceof e.Mesh) || t.material !== this.stone || (t.geometry = nn(F(t.geometry, 1.25), "stone"), this.stone.vertexColors = !0);
		}), this.roof = new dr(), this.group.add(this.roof.group);
		for (let t of this.group.children) !(t instanceof e.Mesh) || Array.isArray(t.material) || t.material.name.startsWith("gate-photographic-") && (t.geometry = F(t.geometry, t.material.name.includes("plaster") ? 2 : .8));
		fr(this.group);
	}
	buildPlatformAndBases() {
		let t = [];
		t.push(V(17.2, .68, 7.4, 0, -.34, 0)), t.push(V(17.2, .35, 7.4, 0, .175, 0)), t.push(V(17.6, .12, 7.8, 0, .31, 0));
		for (let n of mr) for (let r of [-Y, Y]) {
			t.push(V(.95, .2, .95, n, J + .1, r));
			let i = new e.CylinderGeometry(.42, .47, .42, 16);
			i.translate(n, J + .41, r), t.push(i);
			let a = new e.TorusGeometry(.43, .035, 6, 16);
			a.rotateX(Math.PI / 2), a.translate(n, J + .62, r), t.push(a);
			for (let e = 0; e < 12; e++) {
				let i = e / 12 * Math.PI * 2, a = V(.16, .05, .26, 0, 0, 0);
				a.rotateX(-.28), a.rotateY(-i), a.translate(n + Math.cos(i) * .5, J + .56, r + Math.sin(i) * .5), t.push(a);
			}
		}
		for (let e = 0; e < 3; e++) t.push(V(9.5, .12, .5, 0, .06 + e * .12, 4 + (2 - e) * .5)), t.push(V(9.5, .12, .5, 0, .06 + e * .12, -4 - (2 - e) * .5));
		for (let e = 0; e < 4; e++) {
			let n = .16 * (e + 1);
			for (let r of [-1, 1]) t.push(V(5, .15, .5, 0, n - .68 - .075, r * (7 - e * .5)));
		}
		let n = new e.Mesh(H(t), this.stone);
		n.castShadow = !0, n.receiveShadow = !0, this.group.add(n);
		let r = ar(3.4, !1), i = new e.Mesh(new e.PlaneGeometry(16.7, 7), r);
		i.rotation.x = -Math.PI / 2, i.position.set(0, .356, 0), i.receiveShadow = !0, this.group.add(i);
		for (let t = 0; t < 3; t++) for (let n of [-1, 1]) {
			let i = new e.Mesh(new e.PlaneGeometry(9.4, .48), r);
			i.rotation.x = -Math.PI / 2, i.position.set(0, .122 + t * .12, n * (4 + (2 - t) * .5)), i.receiveShadow = !0, this.group.add(i);
		}
	}
	buildColumns() {
		let t = [];
		for (let e of mr) for (let n of [-Y, Y]) {
			let r = pr - (J + .62);
			t.push(qn(.23, .28, r, 16, e, J + .62 + r / 2, n)), t.push(qn(.295, .295, .06, 16, e, J + .85, n));
		}
		for (let e of mr) t.push(V(.26, .32, 4.5, e, pr - .12, 0));
		for (let e = 0; e < mr.length - 1; e++) {
			let n = mr[e + 1] - mr[e] - .5, r = (mr[e] + mr[e + 1]) / 2;
			for (let e of [-Y, Y]) t.push(V(n, .42, .32, r, pr - .22, e)), t.push(V(n + .1, .24, .36, r, pr + .08, e));
		}
		for (let e of [-1.5, 1.5]) {
			let n = qn(.11, .11, 13.4, 10, 0, 6.55, e);
			n.rotateZ(Math.PI / 2), t.push(n);
		}
		for (let e of [-5.2, 5.2]) {
			let n = qn(.1, .1, 3.6, 10, e, 6.7, 0);
			n.rotateX(Math.PI / 2), t.push(n);
		}
		let n = new e.Mesh(H(t), this.timber);
		n.castShadow = !0, n.receiveShadow = !0, this.group.add(n);
		let r = [];
		for (let e of mr) for (let t of [-Y, Y]) for (let n of [-1, 1]) {
			let i = Yn(1.55, .62, .16);
			n < 0 && i.scale(-1, 1, 1), i.translate(e, pr - .45, t + (t > 0 ? -.15 : .15)), r.push(i);
		}
		let i = new e.Mesh(H(r), this.timberDark);
		i.castShadow = !0, i.receiveShadow = !0, this.group.add(i);
	}
	bracketCluster() {
		let e = [];
		e.push(V(.58, .26, .58, 0, .13, 0)), e.push(V(1.18, .15, .3, 0, .34, 0)), e.push(V(.32, .15, 1.12, 0, .34, .1));
		for (let t of [
			-.46,
			0,
			.46
		]) e.push(V(.3, .2, .3, t, .5, 0));
		e.push(V(1.5, .14, .27, 0, .64, .05)), e.push(V(.29, .14, 1.3, 0, .64, .16));
		for (let t of [
			-.62,
			0,
			.62
		]) e.push(V(.26, .18, .26, t, .8, .08));
		e.push(V(1, .12, .24, 0, .92, .16)), e.push(V(.2, .15, 1.05, 0, .84, .55, 0, .12)), e.push(V(.44, .2, .42, 0, .98, 1.12));
		for (let t of [-1, 1]) e.push(V(.09, .5, .13, t * .18, .62, .52, 0, t * .55, t * .16));
		return e.push(V(.12, .34, .12, 0, .78, 1.13)), H(e);
	}
	buildBrackets() {
		let t = [], n = this.bracketCluster(), r = [];
		for (let e = -6.6; e <= 6.6; e += .68) r.push([
			e,
			6.05,
			Y - .15
		]), r.push([
			e,
			6.05,
			-Y + .15
		]);
		for (let e = -1.35; e <= 1.35; e += .78) r.push([
			-6.35,
			6.05,
			e
		]), r.push([
			6.35,
			6.05,
			e
		]);
		for (let [e, i, a] of r) {
			let r = n.clone();
			r.scale(.7, .76, .7), Math.abs(e) > 6.2 && r.rotateY(Math.PI / 2), r.translate(e, i, a), t.push(r);
		}
		for (let [e, i, a] of r) {
			if (!(Math.round(e / .68) & 1)) continue;
			let r = n.clone();
			r.scale(.5, .55, .5), Math.abs(e) > 6.2 && r.rotateY(Math.PI / 2), r.translate(e + (Math.abs(e) > 6.2 ? 0 : .34), i + .5, a - .05), t.push(r);
		}
		for (let [e, i, a] of r) {
			let r = n.clone();
			r.scale(.48, .52, .48), Math.abs(e) > 6.2 && r.rotateY(Math.PI / 2), r.translate(e, i - .04, a + (a > 0 ? .42 : -.42)), t.push(r);
		}
		for (let e of [-1, 1]) for (let r of [-1, 1]) {
			let i = n.clone();
			i.rotateY(e * r * Math.PI / 4), i.translate(e * 6.55, 6.1, r * 1.55), t.push(i);
		}
		let i = new e.Mesh(H(t), this.timberDark);
		i.castShadow = !0, i.receiveShadow = !0, this.group.add(i);
		let a = [];
		for (let [e, t, n] of r) a.push(V(.12, .1, .12, e, t + .98, n + (n > 0 ? 1.05 : -1.05)));
		let o = new e.Mesh(H(a), this.gold);
		o.castShadow = !1, this.group.add(o);
	}
	panelWall(e, t, n, r, i) {
		let a = [], o = Math.max(6, Math.round(e / .34));
		for (let n = 0; n <= o; n++) {
			let r = -e / 2 + e * n / o;
			a.push(V(.26, t, .12, r, t / 2, 0));
		}
		a.push(V(e, .22, .18, 0, t * .18, .02)), a.push(V(e, .26, .2, 0, t * .72, .02)), a.push(V(e, .24, .2, 0, t - .12, .02));
		let s = H(a);
		return s.translate(n, r, i), s;
	}
	buildWalls() {
		let t = [], n = [[-6, -2.6], [2.6, 6]];
		for (let [e, r] of n) {
			let n = r - e - .55, i = (e + r) / 2;
			for (let a of [-Y, Y]) {
				let o = V(n, 4.95, .08, 0, 2.47, -.09);
				o.translate(i, J + .02, a), t.push(o), t.push(this.panelWall(n, 4.95, i, J + .02, a));
				let s = [];
				for (let t of [
					e + .3,
					(e + r) / 2,
					r - .3
				]) s.push(V(.2, 4.95, .18, t, J + .02 + 2.47, a + (a > 0 ? .1 : -.1)));
				for (let e of [
					1.4,
					2.6,
					3.9
				]) s.push(V(n, .16, .16, i, J + .02 + e, a + (a > 0 ? .1 : -.1)));
				t.push(H(s));
				let c = [], l = J + .02 + 2.6;
				for (let e = 0; e <= Math.round(n / .22); e++) c.push(V(.05, 2, .07, i - n / 2 + n * e / Math.round(n / .22), l + 2 / 2, a + (a > 0 ? .12 : -.12)));
				for (let e = 0; e <= 5; e++) c.push(V(n, .05, .07, i, l + 2 * e / 5, a + (a > 0 ? .12 : -.12)));
				t.push(H(c));
			}
		}
		for (let e of [-6, 6]) {
			let n = [];
			for (let e = 0; e <= 12; e++) {
				let t = -1.9 + 3.8 * e / 12;
				n.push(V(.12, 4.95, .28, 0, 2.47, t));
			}
			let r = H(n);
			r.translate(e, J + .02, 0), t.push(r);
		}
		let r = new e.Mesh(H(t), this.timberDark);
		r.castShadow = !0, r.receiveShadow = !0, this.group.add(r);
		let i = [];
		for (let [t, r] of n) {
			let n = (t + r) / 2;
			for (let t of [-Y, Y]) {
				for (let r = 0; r < 4; r++) for (let a = 0; a < 3; a++) {
					let o = n - .9 + a * .9, s = J + .9 + r * .85, c = new e.SphereGeometry(.045, 7, 5);
					c.scale(1, 1, .5), c.translate(o, s, t + (t > 0 ? .19 : -.19)), i.push(c);
				}
				let r = new e.TorusGeometry(.13, .022, 6, 12);
				r.translate(n, J + 1.4, t + (t > 0 ? .2 : -.2)), i.push(r);
			}
		}
		let a = new e.Mesh(H(i), this.gold);
		a.castShadow = !1, this.group.add(a);
		let o = [];
		for (let e of [-1, 1]) o.push(V(6.4, 2.3, .34, e * 8.95, J + 1.15, -1.1)), o.push(V(6.6, .4, .46, e * 8.95, J + .2, -1.1));
		let s = new e.Mesh(H(o), this.plaster);
		s.castShadow = !0, s.receiveShadow = !0, this.group.add(s);
	}
	buildRailings() {
		let t = [], n = (e, n, r) => {
			let i = Math.abs(n - e), a = Math.max(2, Math.round(i / 2.4));
			for (let o = 0; o <= a; o++) {
				let s = e + (n - e) * o / a;
				if (t.push(V(.24, .95, .24, s, J + .475, r)), t.push(V(.34, .12, .34, s, J + .98, r)), o < a) {
					let s = e + (n - e) * (o + .5) / a;
					t.push(V(i / a, .16, .14, s, J + .74, r));
				}
			}
		};
		n(-5.6, -2.9, 1.35), n(2.9, 5.6, 1.35);
		let r = new e.Mesh(H(t), this.balustradeStone);
		r.name = "gate-stone-balustrades", r.castShadow = !0, r.receiveShadow = !0, this.group.add(r);
	}
	buildCeiling() {
		let t = [];
		for (let e = -6.2; e <= 6.2; e += .5) t.push(V(.11, .14, 4.2, e, 5.62, 0, 0, .06));
		for (let e of [
			-1.2,
			0,
			1.2
		]) {
			let n = qn(.09, .09, 12.8, 8, 0, 5.72, e);
			n.rotateZ(Math.PI / 2), t.push(n);
		}
		for (let e of [
			-6.1,
			-2.65,
			2.65,
			6.1
		]) for (let n of [-1.95, 1.95]) t.push(V(.26, .3, .35, e, 5.62, n));
		let n = new e.Mesh(H(t), this.timber);
		n.castShadow = !0, n.receiveShadow = !0, this.group.add(n);
	}
	buildPlaque() {
		let t = new e.Group(), n = Ye("gate"), r = new e.Mesh(new e.BoxGeometry(4.5, 1.45, .16), _t()), i = new e.Mesh(new e.PlaneGeometry(4.2, 1.2), new e.MeshStandardMaterial({
			map: n,
			roughness: .86,
			metalness: .02,
			side: e.DoubleSide
		}));
		i.position.z = .09, t.add(r, i);
		let a = [];
		for (let e of [-1, 1]) a.push(V(.06, 1, .06, e * 1.2, .95, 0)), a.push(V(.16, .06, .16, e * 1.2, 1.46, 0));
		let o = new e.Mesh(H(a), this.gold);
		t.add(o), t.position.set(0, 4.5, Y + .24), t.traverse((t) => {
			t instanceof e.Mesh && (t.castShadow = !0);
		}), this.group.add(t);
	}
	buildIvy() {
		let t = Xt(256, 256, (e) => {
			e.clearRect(0, 0, 256, 256);
			let t = 98765, n = () => (t = t * 1664525 + 1013904223 >>> 0, t / 4294967296);
			for (let t = 0; t < 14; t++) {
				let t = 26 + n() * 204, r = 26 + n() * 204, i = 12 + n() * 20, a = n() * Math.PI * 2;
				e.save(), e.translate(t, r), e.rotate(a);
				let o = e.createLinearGradient(-i, 0, i, 0);
				o.addColorStop(0, "#263a18"), o.addColorStop(.5, "#557034"), o.addColorStop(1, "#2c421c"), e.fillStyle = o, e.beginPath(), e.ellipse(0, 0, i, i * .55, 0, 0, Math.PI * 2), e.fill(), e.strokeStyle = "rgba(24,36,14,0.75)", e.lineWidth = 1.2, e.beginPath(), e.moveTo(-i, 0), e.lineTo(i, 0), e.stroke(), e.restore();
			}
		});
		t.anisotropy = 4;
		let n = new e.MeshStandardMaterial({
			map: t,
			alphaTest: .45,
			side: e.DoubleSide,
			roughness: .95,
			envMapIntensity: .05
		}), r = new e.MeshStandardMaterial({
			color: new e.Color("#2a341a"),
			roughness: 1
		}), i = [], a = [], o = 24680, s = () => (o = o * 1664525 + 1013904223 >>> 0, o / 4294967296);
		for (let t of [-1, 1]) for (let n = 0; n < 8; n++) {
			let r = t * 8.95 - 2.65 + n * .75 + s() * .2, o = J + 2.52, c = .5 + s() * 1.2, l = new e.CylinderGeometry(.012, .016, c, 5);
			l.rotateZ((s() - .5) * .15), l.translate(r, o - c / 2, -.885), a.push(l);
			for (let t = 0; t < 4; t++) {
				let n = o - c * (.18 + t * .24), a = new e.PlaneGeometry(.28 + s() * .26, .2 + s() * .2);
				a.rotateZ(s() * Math.PI * 2), a.translate(r + (s() - .5) * .2, n, -.875), i.push(a);
			}
		}
		let c = new e.Mesh(H(a), r);
		c.castShadow = !1, this.group.add(c);
		let l = new e.Mesh(H(i), n);
		l.castShadow = !1, this.group.add(l);
	}
	buildContactShadow() {
		let t = Xt(512, 256, (e) => {
			let t = e.createRadialGradient(256, 128, 10, 256, 128, 250);
			t.addColorStop(0, "rgba(0,0,0,0.5)"), t.addColorStop(.55, "rgba(0,0,0,0.22)"), t.addColorStop(1, "rgba(0,0,0,0)"), e.fillStyle = t, e.fillRect(0, 0, 512, 256);
		}), n = new e.MeshBasicMaterial({
			map: t,
			transparent: !0,
			depthWrite: !1,
			opacity: .9
		}), r = new e.Mesh(new e.PlaneGeometry(15, 7), n);
		r.rotation.x = -Math.PI / 2, r.position.set(0, J + .012, .4), this.group.add(r);
	}
	buildWings() {
		let t = new e.MeshStandardMaterial({
			color: new e.Color("#2c322d"),
			roughness: .95,
			metalness: 0
		}), n = new e.MeshStandardMaterial({
			color: new e.Color("#241812"),
			roughness: .95
		}), r = J + 2.3;
		for (let i of [-1, 1]) {
			let a = i * 8.95, o = new e.Mesh(new e.BoxGeometry(6.58, .18, .5), this.timberDark);
			o.position.set(a, r + .015, -1.1), o.castShadow = !0, o.receiveShadow = !0, o.name = "gate-wing-roof-bearing", this.group.add(o);
			for (let n of [-1, 1]) {
				let i = new e.Mesh(new e.BoxGeometry(6.8, .1, .95), t);
				i.rotation.x = n * .34, i.position.set(a, r + .2, -1.1 + n * .38), i.castShadow = !0, i.receiveShadow = !0, this.group.add(i);
			}
			let s = new e.Mesh(new e.BoxGeometry(6.8, .14, .18), t);
			s.position.set(a, r + .36, -1.1), this.group.add(s);
			let c = new e.Mesh(new e.BoxGeometry(6.8, .16, .1), this.timberDark);
			c.position.set(a, r + .06, -.22), this.group.add(c);
			for (let n = 0; n < 15; n++) {
				let i = new e.Mesh(new e.CylinderGeometry(.055, .055, .06, 8), t);
				i.rotation.x = Math.PI / 2, i.position.set(a - 3.2 + n * .44, r + .02, -.17), this.group.add(i);
			}
			let l = -.7, u = J + .08, d = u - l, f = new e.Mesh(new e.BoxGeometry(7, d, .86), this.stone);
			f.position.set(a, (l + u) / 2, -1.1), f.castShadow = !0, f.receiveShadow = !0, f.name = "gate-wing-ground-footing", this.group.add(f);
			let p = new e.Mesh(new e.BoxGeometry(7.12, .12, .96), this.stone);
			p.position.set(a, J + .06, -1.1), p.receiveShadow = !0, this.group.add(p);
			let m = new e.Mesh(new e.BoxGeometry(1.05, 2, .07), n);
			m.position.set(a + i * .4, J + 1.2, -.91), this.group.add(m);
			let h = new e.Mesh(new e.BoxGeometry(1.26, 2.2, .1), this.timberDark);
			h.position.set(a + i * .4, J + 1.3, -.94), this.group.add(h);
		}
		let i = [{
			cx: -22.575,
			len: 20.85
		}, {
			cx: 20.575,
			len: 16.85
		}], a = [], o = [], s = [], c = [];
		for (let { cx: t, len: n } of i) {
			a.push(V(n, 2.3, .34, t, J + 1.15, -1.1));
			let i = -.7, l = J + .08;
			o.push(V(n + .2, l - i, .86, t, (i + l) / 2, -1.1)), o.push(V(n + .32, .12, .96, t, J + .06, -1.1)), s.push(V(n + .18, .18, .5, t, r + .015, -1.1)), s.push(V(n + .4, .16, .1, t, r + .06, -.22));
			let u = Math.max(2, Math.ceil(n / 6.4));
			for (let e = 0; e <= u; e++) {
				let r = t - n / 2 + n * e / u;
				s.push(V(.34, 2.38, .4, r, J + 1.19, -1.1));
			}
			for (let e of [-1, 1]) c.push(V(n + .4, .1, .95, t, r + .2, -1.1 + e * .38, 0, e * .34));
			c.push(V(n + .4, .14, .18, t, r + .36, -1.1));
			let d = Math.max(2, Math.floor(n / .44));
			for (let i = 0; i <= d; i++) {
				let a = new e.CylinderGeometry(.055, .055, .06, 8);
				a.rotateX(Math.PI / 2), a.translate(t - n / 2 + n * i / d, r + .02, -.17), c.push(a);
			}
		}
		let l = (t, n, r) => {
			let i = new e.Mesh(H(t), n);
			i.castShadow = !0, i.receiveShadow = !0, i.name = r, this.group.add(i);
		};
		l(a, this.plaster, "gate-wing-terrace-extension-plaster"), l(o, this.stone, "gate-wing-terrace-extension-footing"), l(s, this.timberDark, "gate-wing-terrace-extension-timber"), l(c, t, "gate-wing-terrace-extension-roof");
	}
}, gr = class {
	group = new e.Group();
	gameMap;
	constructor(t = {}) {
		this.gameMap = !!t.gameMap, this.group.name = "ground", this.gameMap || this.buildBase(), this.buildPaving(), this.buildKerbs(), this.gameMap || this.buildMoss(), this.buildRocks(), this.group.traverse((t) => {
			!(t instanceof e.Mesh) || Array.isArray(t.material) || t.material.name !== "granite-photogrammetry" || (t.geometry = F(t.geometry, 1.25));
		});
	}
	buildBase() {
		let t = new e.MeshStandardMaterial({
			color: new e.Color("#211f17"),
			roughness: 1
		}), n = new e.Mesh(new e.PlaneGeometry(90, 90), t);
		n.rotation.x = -Math.PI / 2, n.position.y = -.06, n.receiveShadow = !0, this.group.add(n);
	}
	buildPaving() {
		let t = this.gameMap ? re.x1 - re.x0 : 64, n = this.gameMap ? re.z1 - re.z0 : 64, r = this.gameMap ? Qe(t, n) : ar(3.6, !0, 0, 0), i = new e.Mesh(new e.PlaneGeometry(t, n), r);
		i.rotation.x = -Math.PI / 2, i.position.set(0, this.gameMap ? .025 : .015, this.gameMap ? (re.z0 + re.z1) / 2 - 40 : 8), i.receiveShadow = !0, i.name = "flagstone-path", this.group.add(i);
	}
	buildKerbs() {
		let t = new G("kerbs"), n = or(.06), r = [];
		for (let e of [-1, 1]) for (let n = 5; n < 33; n += 2.1) {
			let i = .12 + t.range(-.015, .025), a = V(.34, .22, 2, e * 3.55, i, n + 2 / 2);
			a.scale(1, 1, .96), r.push(a);
		}
		let i = new e.Mesh(H(r), n);
		i.castShadow = !0, i.receiveShadow = !0, i.name = "kerbstones", this.group.add(i);
	}
	buildRocks() {
		let t = new G("ground-rocks"), n = [];
		for (let r = 0; r < 26; r++) {
			let r = (t.chance(.5) ? -1 : 1) * t.range(3.6, 6.8), i = t.range(5, 28), a = t.range(.07, .26), o = new e.IcosahedronGeometry(a, 0);
			o.scale(1.4, t.range(.45, .8), 1), o.rotateY(t.range(0, Math.PI * 2)), o.translate(r, a * .5, i), Jn(o, new e.Color().setHSL(.1 + t.range(-.02, .02), .04, .16 + t.range(0, .1))), n.push(o);
		}
		let r = or(.02), i = new e.Mesh(H(n), r);
		i.castShadow = !0, i.receiveShadow = !0, i.name = "path-rocks", this.group.add(i);
	}
	buildMoss() {
		let t = new G("moss"), n = [];
		for (let r = 0; r < 190; r++) {
			let i = t.chance(.5) ? -1 : 1, a = r < 45, o = a ? t.range(-3, 3) : i * t.range(3.1, 16) * (t.chance(.5) ? 1 : .4), s = t.range(4.8, 33), c = a ? t.range(.015, .06) : t.range(.1, .4), l = new e.IcosahedronGeometry(c, 0);
			l.scale(1.6, .22, 1.6), l.translate(o, .035, s), Jn(l, new e.Color().setHSL(.23 + t.range(-.03, .03), .4, .11 + t.range(0, .05))), n.push(l);
		}
		let r = new e.MeshStandardMaterial({
			color: 16777215,
			roughness: 1,
			vertexColors: !0,
			envMapIntensity: .04
		}), i = new e.Mesh(H(n), r);
		i.receiveShadow = !0, i.name = "moss-clumps", this.group.add(i);
	}
}, _r = {
	sunDir: { value: new e.Vector3(.55, .3, -.78).normalize() },
	sunColor: { value: new e.Color(1, .82, .62) },
	hazeColor: { value: new e.Color(.18, .235, .28) },
	mistColor: { value: new e.Color(.3, .36, .35) },
	sunIrr: { value: new e.Vector3(4.2, 3.4, 2.6) },
	hazeDensity: { value: 8e-4 },
	hazeHeight: { value: 62 },
	mistDensity: { value: .0026 },
	mistHeight: { value: 20 },
	hazeFar: { value: 11e-6 },
	time: { value: 0 }
}, vr = 1024, yr = 4, X = vr / yr, Z = Math.PI * 2, br = {
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
	fallen: [3, 2]
};
function xr(e, t) {
	return [
		U(e[0] * t, 0, 255),
		U(e[1] * t, 0, 255),
		U(e[2] * t, 0, 255)
	];
}
function Sr(e, t = 1) {
	return `rgba(${Math.round(U(e[0], 0, 255))},${Math.round(U(e[1], 0, 255))},${Math.round(U(e[2], 0, 255))},${t})`;
}
function Cr(e, t, n, r) {
	if (e.beginPath(), e.moveTo(0, 0), r) {
		for (let r = 1; r <= 8; r++) {
			let i = r / 9, a = n * Math.sin(Math.PI * i ** .74);
			e.lineTo(t * i, -a * (r % 2 == 0 ? 1 : .72));
		}
		e.lineTo(t * .985, -n * .1), e.lineTo(t, 0);
		for (let r = 8; r >= 1; r--) {
			let i = r / 9, a = n * Math.sin(Math.PI * i ** .74);
			e.lineTo(t * i, a * (r % 2 == 0 ? 1 : .7));
		}
	} else e.bezierCurveTo(t * .1, -n * .78, t * .54, -n * 1.02, t * .92, -n * .3), e.quadraticCurveTo(t * 1.03, -n * .05, t, 0), e.quadraticCurveTo(t * 1, n * .2, t * .86, n * .42), e.bezierCurveTo(t * .52, n * 1, t * .1, n * .72, 0, 0);
	e.closePath();
}
function Q(e, t, n, r, i, a, o, s = {}) {
	e.save(), e.translate(t, n), e.rotate(a);
	let c = e.createLinearGradient(0, 0, r, 0);
	c.addColorStop(0, Sr(xr(o, .66))), c.addColorStop(.42, Sr(o)), c.addColorStop(1, Sr(xr(o, s.glow ?? 1.18))), e.fillStyle = c, Cr(e, r, i, s.serrated ?? !1), e.fill(), e.strokeStyle = Sr(xr(o, 1.62), .3), e.lineWidth = .9, e.stroke(), e.strokeStyle = Sr(xr(o, 1.55), .5), e.lineWidth = Math.max(.55, i * .045), e.beginPath(), e.moveTo(r * .03, 0), e.quadraticCurveTo(r * .5, -i * .07, r * .95, 0), e.stroke(), e.strokeStyle = Sr(xr(o, 1.75), .28), e.lineWidth = .55;
	for (let t = 1; t <= 4; t++) {
		let n = .2 + t * .16, a = r * n, o = i * (1 - n * .52);
		for (let t of [-1, 1]) e.beginPath(), e.moveTo(a, 0), e.quadraticCurveTo(a + r * .075, t * o * .42, a + r * .15, t * o * .64), e.stroke();
	}
	e.restore();
}
function wr(e, t, n) {
	for (let r = 0; r < n.branches; r++) {
		let i = n.branches === 1 ? 0 : (r / (n.branches - 1) - .5) * 2, a = -Math.PI / 2 + i * t.range(.55, .95) + t.range(-.22, .22), o = n.reach * t.range(.62, 1), s = n.cx + Math.cos(a) * o, c = n.cy + Math.sin(a) * o, l = (n.cx + s) * .5 + t.range(-8, 8), u = (n.cy + c) * .5 + t.range(-4, 9);
		e.strokeStyle = "rgba(56,44,28,0.95)", e.lineWidth = t.range(1.15, 2.2), e.beginPath(), e.moveTo(n.cx, n.cy), e.quadraticCurveTo(l, u, s, c), e.stroke();
		for (let r = 0; r < n.perBranch; r++) {
			if (t.chance(n.sparse ?? .05)) continue;
			let i = .16 + r / n.perBranch * .9, o = W(n.cx, s, i) + (.5 - i) * 5, l = W(n.cy, c, i) + Math.sin(i * Math.PI) * (n.droop ?? 0), u = a + (r % 2 == 0 ? -1 : 1) * t.range(.5, 1.12) + t.range(-.18, .18);
			Q(e, o, l, t.range(n.len[0], n.len[1]) * (1.02 - i * .16), t.range(n.wid[0], n.wid[1]), u, n.palette[t.int(0, n.palette.length - 1)], {
				serrated: n.serrated,
				glow: n.glow
			});
		}
		Q(e, s, c, t.range(n.len[0], n.len[1]) * .82, t.range(n.wid[0], n.wid[1]) * .9, a + t.range(-.3, .3), n.palette[t.int(0, n.palette.length - 1)], {
			serrated: n.serrated,
			glow: n.glow
		});
	}
}
var Tr = [
	[
		44,
		68,
		30
	],
	[
		52,
		78,
		35
	],
	[
		60,
		88,
		40
	],
	[
		70,
		98,
		45
	],
	[
		82,
		108,
		51
	]
], Er = [
	[
		56,
		74,
		35
	],
	[
		67,
		84,
		40
	],
	[
		78,
		94,
		47
	],
	[
		89,
		102,
		53
	]
], Dr = [
	[
		88,
		112,
		52
	],
	[
		102,
		124,
		58
	],
	[
		116,
		134,
		64
	],
	[
		130,
		144,
		72
	]
], Or = [
	[
		58,
		84,
		36
	],
	[
		70,
		96,
		42
	],
	[
		84,
		108,
		48
	],
	[
		98,
		118,
		56
	]
], kr = [
	[
		42,
		70,
		33
	],
	[
		52,
		80,
		38
	],
	[
		64,
		92,
		43
	],
	[
		74,
		100,
		48
	]
], Ar = [
	[
		18,
		28,
		15
	],
	[
		24,
		36,
		19
	],
	[
		30,
		42,
		23
	]
], jr = [
	[
		50,
		80,
		39
	],
	[
		62,
		92,
		44
	],
	[
		74,
		102,
		49
	]
], Mr = [
	[
		92,
		66,
		32
	],
	[
		118,
		86,
		40
	],
	[
		80,
		58,
		30
	],
	[
		132,
		96,
		46
	],
	[
		74,
		70,
		38
	],
	[
		104,
		88,
		44
	],
	[
		66,
		82,
		42
	]
];
function Nr(e, t) {
	for (let n = 0; n < 26; n++) Q(e, X * .5 + t.range(-42, 42), X * .58 + t.range(-38, 38), t.range(26, 44), t.range(9, 15), t.range(-Math.PI, Math.PI), [
		26,
		42,
		22
	]);
	wr(e, t, {
		cx: X * .5,
		cy: X * .66,
		branches: 5,
		reach: 108,
		perBranch: 9,
		len: [38, 60],
		wid: [13, 19],
		palette: Tr,
		droop: 6
	});
	for (let n = 0; n < 7; n++) Q(e, X * .5 + t.range(-70, 70), X * .46 + t.range(-58, 26), t.range(26, 38), t.range(9, 13), t.range(-Math.PI, Math.PI), Dr[t.int(0, Dr.length - 1)], { glow: 1.25 });
}
function Pr(e, t) {
	for (let n = 0; n < 14; n++) Q(e, X * .5 + t.range(-40, 40), X * .6 + t.range(-34, 34), t.range(30, 48), t.range(16, 24), t.range(-Math.PI, Math.PI), [
		44,
		54,
		30
	]);
	wr(e, t, {
		cx: X * .52,
		cy: X * .64,
		branches: 3,
		reach: 104,
		perBranch: 8,
		len: [42, 66],
		wid: [18, 27],
		palette: Er,
		droop: 9
	});
}
function Fr(e, t) {
	for (let n = 0; n < 13; n++) Q(e, X * .5 + t.range(-44, 44), X * .6 + t.range(-36, 36), t.range(32, 52), t.range(9, 13), t.range(-Math.PI, Math.PI), [
		34,
		44,
		24
	], { serrated: !0 });
	wr(e, t, {
		cx: X * .5,
		cy: X * .68,
		branches: 4,
		reach: 110,
		perBranch: 9,
		len: [44, 70],
		wid: [10, 15],
		palette: Er,
		serrated: !0,
		droop: 4
	});
}
function Ir(e, t) {
	for (let n = 0; n < 3; n++) {
		let r = X * (.32 + n * .18) + t.range(-10, 10), i = X - 8, a = r + t.range(-70, 70), o = t.range(44, 110), s = (r + a) * .5 + t.range(-24, 24), c = (i + o) * .5 + 12;
		e.strokeStyle = "rgba(62,50,32,0.9)", e.lineWidth = 1.7, e.beginPath(), e.moveTo(r, i), e.quadraticCurveTo(s, c, a, o), e.stroke();
		for (let n = 2; n <= 11; n++) {
			let l = n / 12, u = 1 - l, d = u * u * r + 2 * u * l * s + l * l * a, f = u * u * i + 2 * u * l * c + l * l * o, p = 2 * u * (s - r) + 2 * l * (a - s), m = 2 * u * (c - i) + 2 * l * (o - c), h = Math.atan2(m, p);
			for (let n of [-1, 1]) Q(e, d, f, t.range(18, 30) * (1.1 - l * .35), t.range(5, 8), h + n * t.range(.95, 1.25), Tr[t.int(0, Tr.length - 1)]);
		}
		Q(e, a, o, t.range(22, 32), t.range(6, 9), Math.atan2(o - c, a - s), Tr[4]);
	}
}
function Lr(e, t) {
	wr(e, t, {
		cx: X * .5,
		cy: X * .64,
		branches: 3,
		reach: 96,
		perBranch: 6,
		len: [32, 50],
		wid: [13, 19],
		palette: Dr,
		sparse: .16,
		glow: 1.28
	});
	for (let n = 0; n < 5; n++) Q(e, X * .5 + t.range(-54, 54), X * .52 + t.range(-48, 18), t.range(22, 34), t.range(10, 14), t.range(-Math.PI, Math.PI), [
		150,
		158,
		92
	], { glow: 1.1 });
}
function Rr(e, t, n) {
	let r = n ? 5 : 4;
	for (let i = 0; i < r; i++) {
		let r = X * t.range(.25, .75), i = X * t.range(.28, .72);
		e.strokeStyle = "rgba(80,92,44,0.75)", e.lineWidth = .9, e.beginPath(), e.moveTo(r, i), e.lineTo(r + t.range(-16, 16), i + t.range(-16, 16)), e.stroke();
		let a = n ? 12 : 11;
		for (let o = 0; o < a; o++) {
			let a = t.range(-Math.PI, Math.PI);
			Q(e, r + t.range(-16, 16), i + t.range(-16, 16), t.range(n ? 34 : 46, n ? 58 : 82), t.range(n ? 5 : 7, n ? 8 : 11), a, Or[t.int(0, Or.length - 1)], { glow: 1.25 });
		}
	}
}
function zr(e, t) {
	for (let n = 0; n < 30; n++) Q(e, X * .5 + t.range(-58, 58), X * .55 + t.range(-48, 48), t.range(18, 32), t.range(8, 12), t.range(-Math.PI, Math.PI), [
		32,
		52,
		27
	]);
	wr(e, t, {
		cx: X * .5,
		cy: X * .62,
		branches: 3,
		reach: 96,
		perBranch: 16,
		len: [20, 34],
		wid: [8, 12],
		palette: kr,
		sparse: .06,
		droop: 4
	});
}
function Br(e, t) {
	for (let n = 0; n < 4; n++) {
		let n = X * t.range(.34, .66), r = X - 6, i = n + t.range(-84, 84), a = t.range(26, 96), o = (n + i) * .5 + t.range(-16, 16), s = (r + a) * .5 + t.range(4, 20);
		e.strokeStyle = "rgba(58,82,38,0.95)", e.lineWidth = 1.8, e.beginPath(), e.moveTo(n, r), e.quadraticCurveTo(o, s, i, a), e.stroke();
		for (let c = 3; c <= 13; c++) {
			let l = c / 14, u = 1 - l, d = u * u * n + 2 * u * l * o + l * l * i, f = u * u * r + 2 * u * l * s + l * l * a, p = 2 * u * (o - n) + 2 * l * (i - o), m = 2 * u * (s - r) + 2 * l * (a - s), h = Math.atan2(m, p);
			for (let n of [-1, 1]) Q(e, d, f, t.range(12, 22) * (1.15 - l * .5), t.range(3.2, 5), h + n * t.range(1, 1.3), jr[t.int(0, jr.length - 1)]);
		}
	}
}
function Vr(e, t) {
	for (let n = 0; n < 26; n++) {
		let r = X * .5 + t.range(-88, 88), i = -Math.PI / 2 + t.range(-.62, .62), a = t.range(120, 232), o = t.range(-.35, .35);
		e.strokeStyle = Sr(n % 7 == 0 ? [
			130,
			138,
			74
		] : n % 5 == 0 ? [
			92,
			112,
			58
		] : [
			70,
			96,
			52
		], .96), e.lineWidth = t.range(1.4, 3.2), e.beginPath(), e.moveTo(r, X + 4), e.quadraticCurveTo(r + Math.cos(i) * a * .42, X + Math.sin(i) * a * .62, r + Math.cos(i) * a * .78 + o * a, X + Math.sin(i) * a), e.stroke();
	}
	for (let n = 0; n < 3; n++) {
		let n = X * .5 + t.range(-52, 52), r = t.range(36, 78);
		e.strokeStyle = "rgba(120,116,66,0.85)", e.lineWidth = 1.2, e.beginPath(), e.moveTo(n, X), e.quadraticCurveTo(n + t.range(-18, 18), X * .55, n + t.range(-26, 26), r), e.stroke();
		for (let i = 0; i < 7; i++) e.fillStyle = `rgba(${128 + t.int(0, 30)},${118 + t.int(0, 24)},${60 + t.int(0, 20)},0.9)`, e.beginPath(), e.ellipse(n + t.range(-7, 7), r + i * 5, 2.2, 4.2, t.range(-.3, .3), 0, Z), e.fill();
	}
}
function Hr(e, t) {
	for (let n = 0; n < 56; n++) Q(e, X * .5 + t.range(-74, 74), X * .5 + t.range(-70, 70), t.range(15, 30), t.range(7, 11), t.range(-Math.PI, Math.PI), Ar[t.int(0, Ar.length - 1)], { glow: 1.1 });
	wr(e, t, {
		cx: X * .5,
		cy: X * .56,
		branches: 3,
		reach: 86,
		perBranch: 14,
		len: [18, 30],
		wid: [8, 12],
		palette: Ar,
		sparse: .08,
		glow: 1.15
	});
}
function Ur(e, t) {
	for (let n = 0; n < 26; n++) Q(e, t.range(16, X - 16), t.range(16, X - 16), t.range(20, 38), t.range(8, 14), t.range(-Math.PI, Math.PI), Mr[t.int(0, Mr.length - 1)], { serrated: t.chance(.4) });
	for (let n = 0; n < 3; n++) {
		let n = t.range(40, X - 40), r = t.range(40, X - 40);
		e.strokeStyle = "rgba(72,58,36,0.9)", e.lineWidth = 1.1, e.beginPath(), e.moveTo(n, r), e.lineTo(n + t.range(-34, 34), r + t.range(-34, 34)), e.stroke();
	}
}
function Wr() {
	let e = Xt(vr, vr, (e) => {
		let t = (t, n) => {
			let [r, i] = br[t];
			e.save(), e.translate(r * X, i * X), e.beginPath(), e.rect(0, 0, X, X), e.clip(), n(e, new G(`lingyin-veg-atlas-${t}`)), e.restore();
		};
		t("camphor", Nr), t("broad", Pr), t("chestnut", Fr), t("pinnate", Ir), t("young", Lr), t("bamboo", (e, t) => Rr(e, t, !1)), t("bambooSmall", (e, t) => Rr(e, t, !0)), t("shrub", zr), t("fern", Br), t("grass", Vr), t("dark", Hr), t("fallen", Ur);
	});
	return e.name = "lingyin-veg-leaf-atlas", e.anisotropy = 16, e.needsUpdate = !0, e;
}
var Gr = "\n#ifdef USE_INSTANCING\n  float vgPhase = instanceMatrix[3][0] * 0.61 + instanceMatrix[3][2] * 0.83 + instanceMatrix[3][1] * 0.27;\n  float vgSlow = sin(uTime * 0.52 + vgPhase);\n  float vgFast = sin(uTime * 1.87 + vgPhase * 1.93 + transformed.y * 1.7);\n  float vgGust = 0.55 + 0.45 * sin(uTime * 0.23 + vgPhase * 0.31);\n  float vgSway = (vgSlow * 0.05 + vgFast * 0.012) * vgGust;\n  float vgLift = 0.35 + max(transformed.y, 0.0) * 0.22;\n  transformed.x += vgSway * vgLift;\n  transformed.z += vgSway * 0.45 * vgLift;\n#endif\n", Kr = "\n#ifdef USE_INSTANCING\n  float vgPhase = instanceMatrix[3][0] * 0.41 + instanceMatrix[3][2] * 0.73;\n  float vgSway = sin(uTime * 0.63 + vgPhase) * 0.014 + sin(uTime * 1.71 + vgPhase * 1.37) * 0.004;\n  float vgBend = transformed.y * transformed.y;\n  transformed.x += vgSway * vgBend;\n  transformed.z += vgSway * 0.45 * vgBend;\n#endif\n";
function qr(e, t) {
	return t < -2.4 ? 3.8 : Math.abs(e) < 8.5 && t < 6 ? 10.4 : Math.abs(e) < 10 && t < 10 ? 9 : 7.2;
}
function Jr(t) {
	let n = t.getAttribute("position").count, r = new Float32Array(n * 3).fill(1);
	return t.setAttribute("color", new e.BufferAttribute(r, 3)), t;
}
function Yr(e) {
	let n = t(e, !1);
	if (!n) throw Error("vegetation: geometry merge failed");
	return n;
}
function Xr(t, n, r) {
	let [i, a] = br[t], o = new e.PlaneGeometry(n, r, 1, 1), s = o.getAttribute("uv"), c = 2 / vr, l = i / yr + c, u = (i + 1) / yr - c, d = 1 - (a + 1) / yr + c, f = 1 - a / yr - c;
	for (let e = 0; e < s.count; e++) s.setXY(e, W(l, u, s.getX(e)), W(d, f, s.getY(e)));
	return s.needsUpdate = !0, Jr(o), o;
}
var Zr = /* @__PURE__ */ new Map();
function Qr(e, t) {
	let n = `${e}:${t}`, r = Zr.get(n);
	if (r) return r;
	let i;
	if (t === "canopy") {
		let t = Xr(e, 1, 1), n = Xr(e, .94, .88);
		n.rotateY(1.05), n.rotateX(.14), n.translate(.04, -.03, .03);
		let r = Xr(e, .8, .72);
		r.rotateY(-.62), r.rotateX(1.06), r.translate(-.03, .15, 0), i = Yr([
			t,
			n,
			r
		]);
	} else if (t === "spray") {
		let t = Xr(e, 1, .82), n = Xr(e, .9, .72);
		n.rotateY(1.16), n.rotateX(-.12), n.translate(.02, .04, .02), i = Yr([t, n]);
	} else if (t === "tuft") {
		let t = [];
		for (let n = 0; n < 3; n++) {
			let r = Xr(e, .72, 1);
			r.translate(0, .5, 0), r.rotateY(n / 3 * Math.PI + .3), r.rotateX(.05), t.push(r);
		}
		i = Yr(t);
	} else if (t === "fern") {
		let t = [];
		for (let n = 0; n < 5; n++) {
			let r = Xr(e, .72, 1);
			r.translate(0, .5, 0), r.rotateY(n / 5 * Z + .2), r.rotateX(.18), t.push(r);
		}
		i = Yr(t);
	} else {
		let t = Xr(e, 1, 1);
		t.rotateX(-Math.PI / 2), i = t;
	}
	return i.computeBoundingSphere(), Zr.set(n, i), i;
}
function $r(t, n, r = .08) {
	let i = [], a = [], o = [], s = t.length, c = new e.Vector3(), l = new e.Vector3(), u = new e.Vector3(), d = new e.Vector3(), f = new e.Vector3(), p = new e.Vector3(), m = new e.Vector3(0, 1, 0), h = new e.Vector3(1, 0, 0);
	for (let e = 0; e < s; e++) {
		l.copy(t[Math.max(0, e - 1)].center), u.copy(t[Math.min(s - 1, e + 1)].center), c.subVectors(u, l).normalize(), d.copy(Math.abs(c.y) > .9 ? h : m), f.crossVectors(d, c).normalize(), p.crossVectors(c, f).normalize();
		for (let o = 0; o < n; o++) {
			let c = o / n * Z, l = 1 + r * tr(c * 1.9 + e * .37, e * 1.7 + o * .11), u = Math.max(.012, t[e].radius * l), d = Math.cos(c) * u, m = Math.sin(c) * u;
			i.push(t[e].center.x + f.x * d + p.x * m, t[e].center.y + f.y * d + p.y * m, t[e].center.z + f.z * d + p.z * m), a.push(o / n, e / (s - 1));
		}
	}
	for (let e = 0; e < s - 1; e++) for (let t = 0; t < n; t++) {
		let r = e * n + t, i = e * n + (t + 1) % n, a = (e + 1) * n + t, s = (e + 1) * n + (t + 1) % n;
		o.push(r, i, a, i, s, a);
	}
	let g = new e.BufferGeometry();
	return g.setAttribute("position", new e.Float32BufferAttribute(i, 3)), g.setAttribute("uv", new e.Float32BufferAttribute(a, 2)), g.setIndex(o), g.computeVertexNormals(), g;
}
function ei(t, n) {
	return new e.CatmullRomCurve3(t, !1, "catmullrom", .5).getPoints(n);
}
function ti(t) {
	let n = new e.IcosahedronGeometry(1, t), r = n.getAttribute("position");
	for (let e = 0; e < r.count; e++) {
		let t = r.getX(e), n = r.getY(e), i = r.getZ(e), a = 1 + .17 * nr(t * 1.4 + i * .6 + 4.7, n * 1.6 - i * .9);
		r.setXYZ(e, t * a, n * a * .9, i * a);
	}
	return n.computeVertexNormals(), Jr(n), n;
}
function ni() {
	let t = new G("lingyin-veg-shrub-core"), n = [];
	for (let r = 0; r < 3; r++) {
		let i = new e.IcosahedronGeometry(r === 0 ? 1 : .62, +(r === 0)), a = i.getAttribute("position");
		for (let e = 0; e < a.count; e++) {
			let t = a.getX(e), n = a.getY(e), i = a.getZ(e), o = 1 + .15 * nr(t * 2.1 + r * 3.3, i * 2.4 - n * .7);
			a.setXYZ(e, t * o, n * o, i * o);
		}
		i.computeVertexNormals(), i.scale(1.2, .72, 1.1), i.translate(t.range(-.5, .5), .52 + t.range(-.08, .22), t.range(-.5, .5)), Jr(i), n.push(i);
	}
	return Yr(n);
}
function ri() {
	let t = new e.CylinderGeometry(.03, .058, .56, 5, 1, !0);
	t.translate(0, .28, 0);
	let n = new e.CylinderGeometry(.017, .032, .47, 5, 1, !0);
	n.translate(0, .765, 0);
	let r = new e.CylinderGeometry(.012, .024, .32, 4, 1, !0);
	return r.rotateZ(.72), r.translate(.1, .74, .02), Yr([
		t,
		n,
		r
	]);
}
var ii = [
	.14,
	.29,
	.44,
	.59,
	.74,
	.89
];
function ai(t) {
	let n = t ? 6 : 5, r = new Set([0, 1]);
	for (let e of ii) t ? (r.add(e - .075), r.add(e - .014), r.add(e - .004), r.add(e + .004), r.add(e + .014), r.add(e + .033), r.add(e + .075)) : (r.add(e - .06), r.add(e + .01), r.add(e + .06));
	let i = $r([...r].filter((e) => e >= 0 && e <= 1).sort((e, t) => e - t).map((t) => {
		let n = .052 * (1 - .43 * t);
		for (let e of ii) {
			let r = Math.abs(t - e);
			r < .012 ? n += .017 : r < .04 && (n += .008 * (1 - (r - .012) / .028));
		}
		let r = .11 * t * t + .028 * Math.sin(t * 5.2);
		return {
			center: new e.Vector3(r, t, .02 * Math.sin(t * 3.4)),
			radius: n
		};
	}), n, t ? .035 : .02), a = i.getAttribute("position"), o = new Float32Array(a.count * 3);
	for (let e = 0; e < a.count; e++) {
		let t = a.getY(e), n = .9 + .1 * Math.sin(t * 41);
		for (let e of ii) {
			let r = t - e;
			Math.abs(r) < .011 ? n *= .55 : Math.abs(r) < .035 && (n *= .86), r > .012 && r < .034 && (n = Math.min(1.16, n * 1.2));
		}
		n *= W(.86, 1.06, t), o[e * 3] = n, o[e * 3 + 1] = n * 1.02, o[e * 3 + 2] = n * .9;
	}
	return i.setAttribute("color", new e.BufferAttribute(o, 3)), i;
}
function oi(t, n) {
	let r = new e.Vector3(t.base[0], 0, t.base[1]), i = [];
	for (let n = 0; n <= 5; n++) {
		let a = n / 5, o = tr(a * 2.4 + 3.1, 8.7) * .62 * Math.sin(a * Math.PI), s = nr(a * 2.8 - 4.4, 2.3) * .62 * Math.sin(a * Math.PI);
		i.push(new e.Vector3(r.x + t.lean[0] * a * a + o, t.height * a, r.z + t.lean[1] * a * a + s));
	}
	let a = ei(i, 16), o = [$r(a.map((e, n) => {
		let r = n / (a.length - 1), i = t.radius * (1.06 - .88 * r ** .72) * (1 + .08 * tr(r * 6.3 + 1.7, t.height * .31));
		return {
			center: e.clone(),
			radius: Math.max(.055, i)
		};
	}), 10, .09)];
	for (let i = 0; i < 5; i++) {
		let a = i / 5 * Z + n.range(-.3, .3), s = new e.Vector3(Math.cos(a), 0, Math.sin(a)), c = r.clone().add(new e.Vector3(s.x * t.radius * .35, t.radius * 1.2, s.z * t.radius * .35)), l = r.clone().addScaledVector(s, t.radius * 1.5 + n.range(0, .25));
		l.y = t.radius * .36;
		let u = r.clone().addScaledVector(s, t.radius * 2.8 + n.range(.1, .55));
		u.y = .02;
		let d = ei([
			c,
			l,
			u
		], 4), f = d.map((e, n) => ({
			center: e,
			radius: Math.max(.035, W(t.radius * .3, .045, n / (d.length - 1)))
		}));
		o.push($r(f, 6, .14));
	}
	let s = [], c = new e.Vector3(...t.crown);
	for (let r = 0; r < t.branches; r++) {
		let i = W(.4, .88, (r + n.range(.15, .85)) / t.branches), l = a[U(Math.round(i * (a.length - 1)), 1, a.length - 2)].clone(), u = r / t.branches * Z + n.range(-.55, .55), d = new e.Vector3(Math.cos(u), 0, Math.sin(u)), f = new e.Vector3(c.x, l.y + n.range(.8, 1.9), c.z).sub(l).normalize(), p = d.clone().multiplyScalar(.55).addScaledVector(f, .8).normalize(), m = n.range(2.8, 5.1) * (1.15 - i * .32), h = l.clone().addScaledVector(d, t.radius * .3), g = h.clone().addScaledVector(p, m * .46).add(new e.Vector3(n.range(-.4, .4), n.range(.35, 1.1), n.range(-.4, .4))), _ = h.clone().addScaledVector(p, m).add(new e.Vector3(n.range(-.45, .45), n.range(.8, 2), n.range(-.45, .45))), v = ei([
			h,
			g,
			_
		], 7), y = .07 + t.radius * .22 * (1 - i * .4), b = v.map((e, t) => ({
			center: e,
			radius: Math.max(.028, W(y, .032, (t / (v.length - 1)) ** .82))
		}));
		o.push($r(b, 7, .1)), s.push({
			p: _.clone(),
			dir: p.clone(),
			weight: 1.1
		}), s.push({
			p: v[5].clone(),
			dir: p.clone(),
			weight: .9
		});
		let x = v[4].clone(), S = p.clone().add(new e.Vector3(n.range(-.7, .7), n.range(.35, .9), n.range(-.7, .7))).normalize(), C = x.clone().addScaledVector(S, n.range(1.3, 2.3)), w = ei([
			x,
			x.clone().lerp(C, .55).add(new e.Vector3(0, .3, 0)),
			C
		], 4), T = w.map((e, t) => ({
			center: e,
			radius: Math.max(.02, W(y * .42, .022, t / (w.length - 1)))
		}));
		o.push($r(T, 5, .12)), s.push({
			p: C,
			dir: S,
			weight: .78
		});
	}
	let l = (t, r, a) => {
		let c = new e.CatmullRomCurve3(i, !1, "catmullrom", .5).getPointAt(r), l = ei([
			c,
			c.clone().lerp(t, .5).add(new e.Vector3(0, .8 + n.range(0, .9), 0)),
			c.clone().lerp(t, .78).add(new e.Vector3(0, .25, 0)),
			t
		], 9), u = l.map((e, t) => ({
			center: e,
			radius: Math.max(.026, W(a, .028, t / (l.length - 1)))
		}));
		o.push($r(u, 7, .08));
		for (let e of [
			3,
			6,
			8
		]) s.push({
			p: l[e].clone(),
			dir: l[Math.min(e + 1, l.length - 1)].clone().sub(l[e]).normalize(),
			weight: e === 8 ? 1.3 : 1
		});
	};
	l(new e.Vector3(...t.reach), .62, .22), l(new e.Vector3(...t.frame), .5, .17);
	let u = new e.Vector3(-r.x, 0, -r.z).normalize(), d = new e.Vector3(-u.z, 0, u.x), f = [
		{
			center: c.clone(),
			radii: new e.Vector3(t.crownRadius, t.crownRadius * .56, t.crownRadius)
		},
		{
			center: c.clone().addScaledVector(u, t.crownRadius * .34).add(new e.Vector3(0, t.crownRadius * .1, 0)),
			radii: new e.Vector3(t.crownRadius * .82, t.crownRadius * .46, t.crownRadius * .82)
		},
		{
			center: c.clone().addScaledVector(d, t.crownRadius * .52).add(new e.Vector3(n.range(-.5, .5), n.range(-.6, .4), n.range(-.5, .5))),
			radii: new e.Vector3(t.crownRadius * .72, t.crownRadius * .42, t.crownRadius * .72)
		}
	];
	return {
		trunk: Yr(o),
		anchors: s,
		lobes: f
	};
}
function $(t, n) {
	let r = new e.Euler();
	if (n) {
		let e = Math.atan2(n.x, n.z) + t.range(-.85, .85);
		r.set(t.range(-.8, .8), e, t.range(-.75, .75), "YXZ");
	} else r.set(t.range(-1.25, 1.25), t.range(0, Z), t.range(-1.15, 1.15), "YXZ");
	return new e.Quaternion().setFromEuler(r);
}
function si(t, n, r) {
	let i = [
		.1,
		.2,
		.08
	], a = [
		.38,
		.56,
		.2
	], o = U(t, 0, 1), s = n.chance(.16) ? 1.1 : 1, c = W(i[0], a[0], o) * s + n.range(-.045, .045), l = W(i[1], a[1], o) + n.range(-.04, .04), u = W(i[2], a[2], o) * (s > 1 ? .94 : 1) + n.range(-.035, .035), d = r ? .6 : 1;
	return new e.Color().setRGB(U(c * d, 0, 2), U(l * d, 0, 2), U(u * d, 0, 2));
}
var ci = class {
	group = new e.Group();
	atlas;
	leafMat;
	barkMat;
	massMat;
	bambooMat;
	coreMat;
	depthMat;
	buckets = /* @__PURE__ */ new Map();
	constructor(t = {}) {
		this.group.name = "vegetation", this.atlas = On("gate-atlas") ?? Wr(), this.leafMat = Jt({
			name: "lingyin-leaf-card",
			params: {
				color: 16777215,
				map: this.atlas,
				alphaTest: .32,
				alphaToCoverage: !0,
				side: e.DoubleSide,
				roughness: .84,
				metalness: 0,
				vertexColors: !0
			},
			uniforms: {
				uTime: _r.time,
				uSunDir: _r.sunDir
			},
			vertexHead: "uniform float uTime;",
			head: "uniform vec3 uSunDir;",
			vertexPre: Gr,
			color: "\n        float vgHigh = smoothstep(1.5, 11.0, cgP.y);\n        diffuseColor.rgb *= mix(0.70, 1.05, vgHigh);\n        diffuseColor.rgb *= 0.93 + 0.14 * cgNoise2(cgP.xz * 0.35 + cgP.y * 0.17);\n        diffuseColor.rgb *= mix(vec3(1.0), vec3(1.06, 1.035, 0.86), smoothstep(7.0, 12.0, cgP.y) * 0.7);\n      ",
			roughness: "\n        roughnessFactor = clamp(roughnessFactor * (0.86 + 0.24 * cgNoise2(cgP.xz * 2.0)), 0.5, 1.0);\n      ",
			emissive: "\n        vec3 vgView = normalize(cameraPosition - cgP);\n        float vgBack = pow(max(dot(-vgView, uSunDir), 0.0), 2.6);\n        float vgThin = 0.55 + 0.45 * cgNoise2(cgO.xy * 5.0 + 17.0);\n        float vgAO = 0.35 + 0.65 * smoothstep(0.0, 9.0, cgP.y);\n        totalEmissiveRadiance += vec3(0.30, 0.38, 0.12) * vgBack * vgThin * vgAO * 0.9;\n      "
		}), this.barkMat = ot() ?? Jt({
			name: "lingyin-bark",
			params: {
				color: 16777215,
				roughness: .94,
				metalness: 0
			},
			color: "\n        float barkRidge = cgRidge2(vec2((cgP.x + cgP.z) * 6.0, cgP.y * 0.55));\n        float barkFine = cgFbm2(vec2((cgP.x - cgP.z) * 24.0, cgP.y * 5.5));\n        float barkLichen = smoothstep(0.55, 0.92, cgNoise2(vec2(cgP.y * 2.2, (cgP.x + cgP.z) * 7.0)) * 0.5 + 0.5);\n        float barkMoss = smoothstep(0.35, 0.85, cgFbm2(vec2(cgP.x * 1.3 + 5.0, cgP.z * 1.5)) * 0.5 + 0.5);\n        barkMoss *= 1.0 - smoothstep(0.4, 3.4, cgP.y + barkFine * 0.4);\n        vec3 bark = mix(vec3(0.105, 0.08, 0.058), vec3(0.30, 0.245, 0.175), smoothstep(0.25, 0.95, barkRidge));\n        bark *= 0.72 + 0.4 * barkFine;\n        bark = mix(bark, vec3(0.33, 0.34, 0.27), barkLichen * 0.22);\n        bark = mix(bark, vec3(0.14, 0.21, 0.08), barkMoss * 0.72);\n        diffuseColor.rgb *= bark;\n      ",
			normal: "\n        float e = 0.22;\n        float h0 = cgRidge2(vec2((cgP.x + cgP.z) * 6.0, cgP.y * 0.55));\n        float hx = cgRidge2(vec2((cgP.x + cgP.z + e) * 6.0, cgP.y * 0.55));\n        float hy = cgRidge2(vec2((cgP.x + cgP.z) * 6.0, (cgP.y + e) * 0.55));\n        float hz = cgRidge2(vec2((cgP.x - cgP.z + e) * 6.0, cgP.y * 0.55));\n        cgBump = vec3(hx - h0, hy - h0, hz - h0) * 2.4;\n      ",
			roughness: "\n        roughnessFactor = clamp(0.82 + 0.18 * cgNoise2(cgP.xz * 9.0 + cgP.y), 0.55, 1.0);\n      "
		}), this.massMat = Jt({
			name: "lingyin-canopy-mass",
			params: {
				color: 16777215,
				roughness: 1,
				metalness: 0,
				flatShading: !0,
				vertexColors: !0
			},
			color: "\n        float vgN = cgFbm3(cgP * 0.65);\n        vec3 vgMass = mix(vec3(0.065, 0.10, 0.05), vec3(0.16, 0.22, 0.105), smoothstep(0.15, 0.85, vgN));\n        vgMass *= 0.68 + 0.52 * smoothstep(0.0, 9.0, cgP.y);\n        diffuseColor.rgb *= vgMass;\n      "
		}), this.bambooMat = Jt({
			name: "lingyin-bamboo-culm",
			params: {
				color: 16777215,
				roughness: .62,
				metalness: 0,
				vertexColors: !0
			},
			uniforms: { uTime: _r.time },
			vertexHead: "uniform float uTime;",
			vertexPre: Kr,
			color: "\n        float bStripe = cgNoise2(vec2((cgP.x + cgP.z) * 18.0, cgP.y * 3.4));\n        float bGrime = cgFbm2(vec2(cgP.x * 2.6 + cgP.z * 1.8, cgP.y * 0.9));\n        vec3 bCol = mix(vec3(0.045, 0.075, 0.028), vec3(0.13, 0.17, 0.052), smoothstep(0.25, 0.9, bStripe * 0.5 + 0.5));\n        bCol *= 0.78 + 0.36 * bGrime;\n        float bPowder = smoothstep(0.7, 0.95, cgNoise2(vec2(cgP.y * 1.3, (cgP.x + cgP.z) * 2.0)) * 0.5 + 0.5);\n        bCol = mix(bCol, vec3(0.34, 0.36, 0.27), bPowder * 0.22);\n        diffuseColor.rgb *= bCol;\n      ",
			roughness: "\n        roughnessFactor = clamp(0.5 + 0.22 * cgNoise2(cgP.xz * 8.0 + cgP.y), 0.35, 0.95);\n      "
		}), this.coreMat = Jt({
			name: "lingyin-shrub-core",
			params: {
				color: 16777215,
				roughness: 1,
				metalness: 0,
				flatShading: !0,
				vertexColors: !0
			},
			color: "\n        float sN = cgFbm3(cgP * 1.5);\n        vec3 sC = mix(vec3(0.03, 0.05, 0.026), vec3(0.09, 0.13, 0.058), smoothstep(0.1, 0.9, sN));\n        diffuseColor.rgb *= sC;\n      "
		}), this.depthMat = this.makeCardDepthMaterial(), t.gamePerimeter ? (this.leafMat.color.setRGB(.6, .75, .52), this.bambooMat.color.setRGB(.64, .72, .57), this.addFramingTrees(), this.addBamboo(), this.addShrubs(), this.addUnderstory(), this.addGroundDetails(!0), this.addCanopyCeiling(), this.addBoundaryWall(), this.flushCards()) : this.populate();
	}
	makeCardDepthMaterial() {
		let t = new e.MeshDepthMaterial({
			depthPacking: e.RGBADepthPacking,
			map: this.atlas,
			alphaTest: .32,
			side: e.DoubleSide
		});
		return t.onBeforeCompile = (e) => {
			e.uniforms.uTime = _r.time, e.vertexShader = e.vertexShader.replace("#include <common>", "#include <common>\nuniform float uTime;").replace("#include <begin_vertex>", `#include <begin_vertex>\n${Gr}`);
		}, t.customProgramCacheKey = () => "lingyin-veg-card-depth", t;
	}
	update(e) {
		_r.time.value = e;
	}
	isPlatform(e, t, n) {
		return Math.abs(e) < 8 + n && t > -3.8 - n && t < 4 + n;
	}
	isPath(e, t, n) {
		return Math.abs(e) < 3.2 + n && t > 3.8 - n;
	}
	nearFramingTrunk(e, t, n) {
		return Math.hypot(e + 8.5, t - 8.7) < n || Math.hypot(e - 9.5, t - 8.7) < n || Math.hypot(e + 12.8, t + .5) < n || Math.hypot(e - 12.6, t + 1.7) < n;
	}
	pushCard(t, n, r, i, a, o, s) {
		let c = `${t}:${n}:${r}`, l = this.buckets.get(c);
		l || (l = {
			cell: r,
			shape: n,
			layer: t,
			matrices: [],
			colors: []
		}, this.buckets.set(c, l));
		let u = new e.Matrix4().compose(i, a, o);
		l.matrices.push(u), l.colors.push(s);
	}
	addCanopyCard(t, n, r, i) {
		let a = t.value(), o;
		o = a < .32 ? "camphor" : a < .46 ? "broad" : a < .6 ? "chestnut" : a < .72 ? "pinnate" : a < .86 ? "young" : "camphor";
		let s = U(.26 + .54 * Xn(4.5, 11.5, n.y) + .22 * tr(n.x * .35 + 3.1, n.z * .35 - 1.7) + (t.value() - .5) * .18, 0, 1), c = $(t, i), l = new e.Vector3(Math.min(1.1, r * .62 * t.range(.9, 1.15)), Math.min(1, r * .62 * t.range(.68, .94)), Math.min(1.1, r * .62 * t.range(.9, 1.15)));
		this.pushCard("canopy", "canopy", o, n, c, l, si(s, t, !1));
	}
	addBlobInstances(t, n, r, i) {
		if (!t.length) return;
		let a = new e.InstancedMesh(n, this.massMat, t.length);
		for (let n = 0; n < t.length; n++) {
			let r = t[n], i = new e.Matrix4().compose(r.pos, r.quat, r.scale);
			a.setMatrixAt(n, i), a.setColorAt(n, r.color);
		}
		a.instanceMatrix.needsUpdate = !0, a.instanceColor && (a.instanceColor.needsUpdate = !0), a.castShadow = r, a.receiveShadow = !0, a.name = i, a.computeBoundingSphere(), this.group.add(a);
	}
	populate() {
		this.addFramingTrees(), this.addBamboo(), this.addShrubs(), this.addUnderstory(), this.addBackgroundForest(), this.addGroundDetails(), this.addCanopyCeiling(), this.flushCards();
	}
	addFramingTrees() {
		let t = [
			{
				seed: "lingyin-veg-tree-left",
				side: "left",
				base: [-8.5, 8.7],
				height: 12.8,
				radius: .8,
				crown: [
					-2.2,
					9.6,
					5.7
				],
				crownRadius: 4.8,
				reach: [
					-.6,
					10.4,
					3.5
				],
				frame: [
					-4.2,
					5.9,
					9.4
				],
				branches: 6,
				lean: [1.1, -.5]
			},
			{
				seed: "lingyin-veg-tree-right",
				side: "right",
				base: [9.5, 8.7],
				height: 12.2,
				radius: .72,
				crown: [
					2.8,
					9.1,
					6.2
				],
				crownRadius: 4.5,
				reach: [
					.8,
					9.9,
					4.2
				],
				frame: [
					4.3,
					5.8,
					11
				],
				branches: 6,
				lean: [-1.2, -.3]
			},
			{
				seed: "lingyin-veg-tree-back",
				side: "back",
				base: [-12.8, -.5],
				height: 13.6,
				radius: .86,
				crown: [
					-7,
					9.2,
					.1
				],
				crownRadius: 4.8,
				reach: [
					-4.4,
					10.6,
					1.7
				],
				frame: [
					-9.8,
					8,
					5
				],
				branches: 5,
				lean: [.9, .6]
			},
			{
				seed: "lingyin-veg-tree-right-back",
				side: "back",
				base: [12.6, -1.7],
				height: 12.6,
				radius: .8,
				crown: [
					7.4,
					9.9,
					-1.9
				],
				crownRadius: 4.7,
				reach: [
					5,
					10.4,
					.9
				],
				frame: [
					9.6,
					8,
					4.5
				],
				branches: 5,
				lean: [-.7, .2]
			}
		], n = [], r = [];
		for (let i of t) {
			let t = new G(i.seed), a = oi(i, t);
			n.push(a.trunk);
			for (let n of a.anchors) {
				let r = Math.round(t.range(7, 11) * n.weight);
				for (let i = 0; i < r; i++) {
					let r = n.p.clone().add(new e.Vector3(t.gauss(), t.gauss() * .7, t.gauss()).multiplyScalar(.55 + n.weight * .42));
					r.y < qr(r.x, r.z) || this.addCanopyCard(t, r, t.range(.9, 1.7) * (.82 + n.weight * .2), t.chance(.5) ? n.dir : void 0);
				}
			}
			for (let n of a.lobes) {
				for (let r = 0; r < 380; r++) {
					let r = t.range(-1, 1), i = t.range(0, Z), a = Math.sqrt(1 - r * r), o = t.value() ** .4, s = new e.Vector3(a * Math.cos(i), r, a * Math.sin(i)), c = n.center.clone().add(new e.Vector3(s.x * n.radii.x * o, s.y * n.radii.y * o, s.z * n.radii.z * o));
					if (c.y < qr(c.x, c.z)) continue;
					let l = W(.85, 1.9, Xn(.5, 1, o) * t.range(.72, 1)) * t.range(.85, 1.15);
					this.addCanopyCard(t, c, l, s);
				}
				for (let r = 0; r < 26; r++) {
					let r = t.range(-.35, .95), i = t.range(0, Z), a = Math.sqrt(Math.max(0, 1 - r * r)), o = new e.Vector3(a * Math.cos(i), r, a * Math.sin(i)), s = n.center.clone().add(new e.Vector3(o.x * n.radii.x, o.y * n.radii.y, o.z * n.radii.z).multiplyScalar(t.range(.92, 1.1)));
					s.y < qr(s.x, s.z) || this.addCanopyCard(t, s, t.range(1.2, 2), o);
				}
				for (let i = 0; i < 4; i++) {
					let i = n.center.clone().add(new e.Vector3(t.range(-.32, .32) * n.radii.x, t.range(-.28, .28) * n.radii.y, t.range(-.32, .32) * n.radii.z));
					r.push({
						pos: i,
						quat: $(t),
						scale: new e.Vector3(n.radii.x * t.range(.26, .42), n.radii.y * t.range(.28, .46), n.radii.z * t.range(.26, .42)),
						color: new e.Color().setRGB(t.range(.3, .44), t.range(.42, .56), t.range(.27, .38))
					});
				}
			}
			if (i.side !== "back") {
				let n = i.side === "left" ? 1 : -1;
				for (let [r, i, a] of [
					[
						-4.3,
						8.3,
						7.9
					],
					[
						-3.5,
						8.7,
						7.35
					],
					[
						-2.65,
						9.2,
						6.6
					],
					[
						-1.7,
						9.8,
						5.55
					],
					[
						-.7,
						10.4,
						4.15
					]
				]) {
					let o = new e.Vector3(r * n, i, a), s = t.int(7, 10);
					for (let n = 0; n < s; n++) {
						let n = o.clone().add(new e.Vector3(t.range(-1.15, 1.15), t.range(-.65, .95), t.range(-.95, .95)));
						n.y < qr(n.x, n.z) || this.addCanopyCard(t, n, t.range(1.7, 2.9));
					}
				}
				let r = [
					[
						-4.6,
						4.5,
						8.5
					],
					[
						-4,
						4.8,
						8.1
					],
					[
						-3.4,
						5.15,
						7.6
					],
					[
						-2.7,
						5.6,
						7
					],
					[
						-2,
						6.15,
						6.2
					]
				];
				i.side === "left" && r.push([
					-4.2,
					4.4,
					8.6
				], [
					-3.5,
					4.7,
					8.2
				]);
				for (let [i, a, o] of r) {
					let r = new e.Vector3(i * n, a, o), s = t.int(7, 10);
					for (let n = 0; n < s; n++) {
						let n = r.clone().add(new e.Vector3(t.range(-.95, .95), t.range(-.55, .7), t.range(-.8, .8)));
						n.y < qr(n.x, n.z) || this.addCanopyCard(t, n, t.range(1.6, 2.6));
					}
				}
			}
		}
		let i = Yr(n);
		this.barkMat.name === "bark-photogrammetry" && (i = nn(F(i, 2.4), "bark"));
		let a = new e.Mesh(i, this.barkMat);
		a.name = "framing-trunks", a.castShadow = !0, a.receiveShadow = !0, this.group.add(a);
	}
	addBamboo() {
		let t = new G("lingyin-veg-bamboo"), n = [], r = 0, i = (r, i, a, o, s, c, l) => {
			let u = s.clone().normalize(), d = new e.Vector3(-u.z, 0, u.x).normalize(), f = new e.Quaternion().setFromAxisAngle(d, o), p = new e.Matrix4().compose(new e.Vector3(r, 0, i), f, new e.Vector3(c, a, c)), m = [
				[
					.62,
					.86,
					.44
				],
				[
					.75,
					.95,
					.5
				],
				[
					.86,
					1,
					.56
				],
				[
					.54,
					.78,
					.42
				]
			][t.int(0, 3)];
			n.push({
				matrix: p,
				color: new e.Color().setRGB(m[0], m[1], m[2]),
				near: l
			});
			let h = t.int(4, 6);
			for (let n = 0; n < h; n++) {
				let n = new e.Vector3(0, t.range(.62, 1), 0).applyMatrix4(p).add(new e.Vector3(t.range(-1.15, 1.15), t.range(-.55, .5), t.range(-1.15, 1.15))), r = t.chance(.62) ? "bamboo" : "bambooSmall", i = t.range(1.05, 1.95), a = t.range(.72, 1.14);
				this.pushCard("bamboo", "spray", r, n, $(t), new e.Vector3(i, i * t.range(.55, .8), i), new e.Color().setRGB(a * .92, a * 1.02, a * .7));
			}
		};
		for (; n.length < 108 && r < 7e3;) {
			r++;
			let a = n.length >= 96, o = a ? t.range(-9.4, -8.4) : t.range(-15, -9), s = a ? t.range(5.2, 7.8) : t.range(-2, 9);
			this.isPlatform(o, s, .15) || this.isPath(o, s, .3) || this.nearFramingTrunk(o, s, 1.3) || nr(o * .35 + 10.3, s * .35 - 3.1) < -.18 && t.chance(.45) || i(o, s, t.range(6, 10) * (a ? .94 : 1), a ? t.range(.3, .46) : t.range(.01, .09), a ? new e.Vector3(1, 0, t.range(-.3, .3)) : new e.Vector3(t.range(-1, 1), 0, t.range(-1, 1)), t.range(.72, 1.05) * (a ? 1.12 : 1), a || n.length < 24 && s > 2.5);
		}
		let a = [
			[
				-4.5,
				5.6,
				6.8
			],
			[
				-4.7,
				6.4,
				7.2
			],
			[
				-4.4,
				7.4,
				7.6
			],
			[
				-6.4,
				4.4,
				7.3
			],
			[
				-6.8,
				4.2,
				6.7
			],
			[
				-6.1,
				5.1,
				7.8
			],
			[
				-7.1,
				4.6,
				6.9
			]
		];
		for (let t = 0; t < a.length; t++) {
			let [n, r, o] = a[t];
			i(n, r, o, .05 + t * .012, new e.Vector3(1, 0, -.35), .92 + t * .04, !0);
		}
		for (let n = 0; n < 26; n++) {
			let n = t.range(-5.35, -4.05), r = t.range(6.2, 8.4), i = t.range(4, 6.1), a = t.range(1.2, 2.1), o = t.range(.6, 1.05);
			this.pushCard("bamboo", "spray", t.chance(.6) ? "bamboo" : "bambooSmall", new e.Vector3(n, i, r), $(t), new e.Vector3(a, a * .55, a), new e.Color().setRGB(o * .9, o * 1.02, o * .68));
		}
		for (let n = 0; n < 85; n++) {
			let n = t.range(-15.2, -8.9), r = t.range(-2, 9), i = t.range(3.4, 9.2), a = t.range(1.9, 3.2), o = t.range(.5, .85);
			this.pushCard("bamboo", "spray", t.chance(.6) ? "bamboo" : "bambooSmall", new e.Vector3(n, i, r), $(t), new e.Vector3(a, a * .55, a), new e.Color().setRGB(o * .92, o * 1.02, o * .7));
		}
		let o = ai(!0), s = ai(!1), c = n.filter((e) => e.near), l = n.filter((e) => !e.near), u = (t, n, r, i) => {
			if (!t.length) return;
			let a = new e.InstancedMesh(n, this.bambooMat, t.length);
			for (let e = 0; e < t.length; e++) a.setMatrixAt(e, t[e].matrix), a.setColorAt(e, t[e].color);
			a.instanceMatrix.needsUpdate = !0, a.instanceColor && (a.instanceColor.needsUpdate = !0), a.castShadow = r, a.receiveShadow = !0, a.name = i, a.computeBoundingSphere(), this.group.add(a);
		};
		u(c, o, !0, "bamboo-near"), u(l, s, !1, "bamboo-far");
	}
	addShrubs() {
		let t = new G("lingyin-veg-shrubs"), n = [], r = [], i = 0;
		for (; r.length < 138 && i < 8e3;) {
			i++;
			let e = t.chance(.5) ? -1 : 1, n, a, o, s = r.length;
			s < 44 ? (n = e * t.range(8.25, 10.6), a = t.range(-2.3, 3.7), o = t.range(.8, 1.35)) : s < 86 ? (n = e * t.range(8.2, 12.6), a = t.range(3.9, 10.4), o = t.range(.7, 1.25)) : s < 112 ? (n = e * t.range(10.5, 14.5), a = t.range(-2, 10.5), o = t.range(.85, 1.45)) : s < 128 ? (n = e * t.range(5.4, 7.6), a = t.range(4.6, 9.8), o = t.range(.5, .9)) : (n = e * t.range(8.2, 11), a = t.range(-3.4, -1.8), o = t.range(.75, 1.2)), !this.isPlatform(n, a, .35) && (this.isPath(n, a, .45) || this.nearFramingTrunk(n, a, 1.5) || nr(n * .6 + 2, a * .6 - 8) < -.35 && t.chance(.5) || r.push({
				x: n,
				z: a,
				scale: o
			}));
		}
		for (let i of r) {
			let r = new e.Quaternion().setFromEuler(new e.Euler(0, t.range(0, Z), 0)), a = new e.Vector3(i.scale * t.range(.16, .26), i.scale * t.range(.12, .2), i.scale * t.range(.16, .26)), o = t.range(.55, 1.15);
			n.push({
				pos: new e.Vector3(i.x, 0, i.z),
				quat: r,
				scale: a,
				color: new e.Color().setRGB(o * .42, o * .56, o * .38)
			});
			let s = t.int(14, 20), c = i.scale * t.range(.85, 1.2);
			for (let n = 0; n < s; n++) {
				let n = t.range(0, Z), r = t.range(.25, .95) * i.scale, a = new e.Vector3(i.x + Math.cos(n) * r, t.range(.3, 1.05) * c, i.z + Math.sin(n) * r);
				if (this.isPath(a.x, a.z, .05) || this.isPlatform(a.x, a.z, .15)) continue;
				let o = t.range(.3, .62) * i.scale, s = t.range(.34, .8);
				this.pushCard("shrub", "spray", t.chance(.7) ? "shrub" : "camphor", a, $(t), new e.Vector3(o, o * t.range(.68, .95), o), new e.Color().setRGB(s * .88, s, s * .76));
			}
		}
		let a = new e.InstancedMesh(ni(), this.coreMat, n.length);
		for (let t = 0; t < n.length; t++) {
			let r = n[t];
			a.setMatrixAt(t, new e.Matrix4().compose(r.pos, r.quat, r.scale)), a.setColorAt(t, r.color);
		}
		a.instanceMatrix.needsUpdate = !0, a.instanceColor && (a.instanceColor.needsUpdate = !0), a.castShadow = !0, a.receiveShadow = !0, a.name = "shrub-cores", a.computeBoundingSphere(), this.group.add(a);
	}
	addUnderstory() {
		let t = new G("lingyin-veg-understory"), n = 0, r = 0;
		for (; n < 260 && r < 7e3;) {
			r++;
			let i = t.chance(.72), a = t.chance(.5) ? -1 : 1, o = i ? a * t.range(3.3, 5.4) : a * t.range(8.1, 10.8), s = i ? t.range(4, 26) : t.range(-3.4, 3.6);
			if (this.isPlatform(o, s, .05) || this.isPath(o, s, .05)) continue;
			let c = t.range(.5, 1.05), l = t.range(.45, 1);
			this.pushCard("under", "tuft", "grass", new e.Vector3(o, 0, s), new e.Quaternion().setFromEuler(new e.Euler(0, t.range(0, Z), 0)), new e.Vector3(c, c * t.range(.45, .8), c), new e.Color().setRGB(l * .92, l, l * .62)), n++;
		}
		let i = 0;
		for (r = 0; i < 110 && r < 5e3;) {
			r++;
			let n = (t.chance(.5) ? -1 : 1) * t.range(3.5, 6.6), a = t.range(4.2, 15.5);
			if (this.isPlatform(n, a, .1) || this.isPath(n, a, .05)) continue;
			let o = t.range(.75, 1.45), s = t.range(.42, .95);
			this.pushCard("under", "fern", "fern", new e.Vector3(n, 0, a), new e.Quaternion().setFromEuler(new e.Euler(0, t.range(0, Z), 0)), new e.Vector3(o, o * t.range(.6, 1), o), new e.Color().setRGB(s * .86, s, s * .68)), i++;
		}
	}
	addBackgroundForest() {
		let t = new G("lingyin-veg-background"), n = [], r = [], i = [], a = (i, a, o, s, c) => {
			let l = t.range(.7, 1.4) * s, u = t.range(0, Z), d = new e.Matrix4().compose(new e.Vector3(i, 0, a), new e.Quaternion().setFromEuler(new e.Euler(0, u, 0)), new e.Vector3(l, o, l)), f = t.range(.55, .9);
			n.push({
				matrix: d,
				color: new e.Color().setRGB(f, f, f)
			});
			let p = new e.Vector3(i, o * t.range(.72, .9), a), m = o * t.range(.28, .42), h = t.int(2, 3);
			for (let n = 0; n < h; n++) {
				let n = p.clone().add(new e.Vector3(t.range(-m * .55, m * .55), t.range(-m * .3, m * .4), t.range(-m * .55, m * .55))), i = t.range(.3, .52);
				r.push({
					pos: n,
					quat: $(t),
					scale: new e.Vector3(m * t.range(.7, 1.25), m * t.range(.55, .9), m * t.range(.7, 1.25)),
					color: new e.Color().setRGB(i * .78, i, i * .72)
				});
			}
			if (!c) return;
			let g = t.int(14, 20);
			for (let n = 0; n < g; n++) {
				let n = t.range(0, Z), r = m * t.range(.3, 1), i = new e.Vector3(p.x + Math.cos(n) * r, p.y + t.range(-m * .6, m * .75), p.z + Math.sin(n) * r);
				if (i.y < 3.2) continue;
				let a = Math.min(4.2, m * t.range(.65, 1.15)), o = t.range(.42, .8);
				this.pushCard("bg", "canopy", t.chance(.5) ? "camphor" : "chestnut", i, $(t), new e.Vector3(a, a * t.range(.7, .95), a), new e.Color().setRGB(o * .82, o, o * .8));
			}
		}, o = 0, s = 0;
		for (; s < 62 && o < 4e3;) {
			o++;
			let e = t.range(-31, 31), n = t.range(-24, -10);
			Math.abs(e) < 9 && n > -13 || this.isPlatform(e, n, 1.5) || this.isPath(e, n, 2) || (a(e, n, t.range(7, 14), 1, n > -21 && Math.abs(e) < 26), s++);
		}
		for (o = 0; s < 88 && o < 4e3;) {
			o++;
			let e = (t.chance(.5) ? -1 : 1) * t.range(15, 33), n = t.range(-7, 16);
			this.isPlatform(e, n, 1.5) || this.isPath(e, n, 2.2) || this.nearFramingTrunk(e, n, 3) || (a(e, n, t.range(6, 13), 1, n < 9), s++);
		}
		for (let n = 0; n < 34; n++) {
			let n = t.range(-26, 26), i = t.range(-21, -8);
			if (Math.abs(n) < 8 && i > -12) continue;
			let a = t.range(1, 2.2);
			r.push({
				pos: new e.Vector3(n, t.range(.4, 2), i),
				quat: $(t),
				scale: new e.Vector3(a, a * t.range(.45, .75), a),
				color: new e.Color().setRGB(.2, .3, .2)
			});
		}
		for (let n = 0; n < 230; n++) {
			let n = t.range(-42, 42), r = t.range(-38, -24), a = t.range(2.2, 4.2);
			i.push({
				pos: new e.Vector3(n, t.range(3, 12), r),
				quat: $(t),
				scale: new e.Vector3(a, a * t.range(.6, .95), a),
				color: new e.Color().setRGB(t.range(.16, .28), t.range(.24, .4), t.range(.18, .3))
			});
		}
		for (let n = 0; n < 40; n++) {
			let n = t.chance(.5) ? -1 : 1, r = t.range(4, 8);
			i.push({
				pos: new e.Vector3(n * t.range(22, 40), t.range(2, 10), t.range(-18, 18)),
				quat: $(t),
				scale: new e.Vector3(r, r * t.range(.55, .9), r),
				color: new e.Color().setRGB(.18, .28, .2)
			});
		}
		let c = ri();
		this.barkMat.name === "bark-photogrammetry" && (c = nn(F(c, 2.4), "bark"));
		let l = new e.InstancedMesh(c, this.barkMat, n.length);
		for (let e = 0; e < n.length; e++) l.setMatrixAt(e, n[e].matrix), l.setColorAt(e, n[e].color);
		l.instanceMatrix.needsUpdate = !0, l.instanceColor && (l.instanceColor.needsUpdate = !0), l.castShadow = !1, l.receiveShadow = !0, l.name = "background-trunks", l.computeBoundingSphere(), this.group.add(l), this.addBlobInstances;
	}
	addCanopyCeiling() {
		let t = new G("lingyin-canopy-ceiling");
		for (let n = 0; n < 90; n++) {
			let n = t.range(-13, 13), r = t.range(1.5, 14), i = t.range(9.8, 12.8), a = new e.Vector3(n, i, r);
			this.addCanopyCard(t, a, t.range(1, 2));
		}
	}
	addBoundaryWall() {
		let t = [], n = [], r = [], i = [], a = [
			{
				x0: -22,
				z0: 5.5,
				x1: -22,
				z1: 34.5
			},
			{
				x0: 22,
				z0: 5.5,
				x1: 22,
				z1: 34.5
			},
			{
				x0: -22,
				z0: 34.5,
				x1: 22,
				z1: 34.5
			}
		], o = -.02, s = 1.11, c = 1.03, l = 3.33;
		for (let u of a) {
			let a = u.x1 - u.x0, d = u.z1 - u.z0, f = Math.hypot(a, d), p = (u.x0 + u.x1) / 2, m = (u.z0 + u.z1) / 2, h = Math.atan2(a, d), g = Math.cos(h), _ = -Math.sin(h);
			t.push(M(.86, s - o, f + .25, p, (o + s) / 2, m, h)), n.push(M(.34, l - c, f - .08, p, (c + l) / 2, m, h)), i.push(M(.5, .18, f + .22, p, l + .015, m, h));
			for (let e of [-1, 1]) i.push(M(.1, .16, f + .48, p + e * g * .88, l + .06, m + e * _ * .88, h));
			for (let t of [-1, 1]) {
				let n = new e.BoxGeometry(.95, .1, f + .5);
				n.rotateZ(t * .34), n.rotateY(h), n.translate(p + g * t * .38, l + .2, m + _ * t * .38), r.push(n);
			}
			r.push(M(.18, .14, f + .52, p, l + .36, m, h));
			let v = Math.max(2, Math.ceil(f / 6.4));
			for (let e = 0; e <= v; e++) {
				let t = e / v;
				i.push(M(.46, l - c + .12, .46, u.x0 + a * t, (c + l) / 2, u.z0 + d * t, h));
			}
		}
		let u = (t, n, r, i) => {
			let a = new e.Mesh(F(P(t), i), n);
			a.castShadow = !0, a.receiveShadow = !0, a.name = r, this.group.add(a);
		};
		u(t, or(.12), "forecourt-boundary-stone-base", 1.25), u(n, $t(), "forecourt-boundary-plaster", 1.8), u(r, new e.MeshStandardMaterial({
			color: new e.Color("#2c322d"),
			roughness: .95,
			metalness: 0
		}), "forecourt-boundary-roof-cap", .72), u(i, Qt(1), "forecourt-boundary-timber-posts", .7);
	}
	addGroundDetails(t = !1) {
		let n = new G("lingyin-veg-ground"), r = 0, i = 0;
		for (; r < 130 && i < 3e3;) {
			i++;
			let t = (n.chance(.5) ? -1 : 1) * n.range(3.35, 7.6), a = n.range(4, 13.5);
			if (this.isPlatform(t, a, 0)) continue;
			let o = n.range(.55, 1.15), s = n.range(.55, 1.15);
			this.pushCard("ground", "scatter", "fallen", new e.Vector3(t, n.range(.015, .04), a), new e.Quaternion().setFromEuler(new e.Euler(-Math.PI / 2 + n.range(-.12, .12), n.range(0, Z), 0, "YXZ")), new e.Vector3(o * n.range(.85, 1.2), o, o), new e.Color().setRGB(s, s * .94, s * .86)), r++;
		}
		if (t) return;
		let a = [];
		for (let t = 0; t < 46; t++) {
			let r, i;
			if (t < 14) r = -8.5 + n.range(-1.4, 1.4), i = 7 + n.range(-1.4, 1.4);
			else if (t < 26) r = 9.5 + n.range(-1.4, 1.4), i = 5.5 + n.range(-1.4, 1.4);
			else if (t < 34) r = -12.8 + n.range(-1.6, 1.6), i = -.5 + n.range(-1.6, 1.6);
			else if (r = (n.chance(.5) ? -1 : 1) * n.range(8.2, 10.5), i = n.range(-3.4, 3.6), this.isPlatform(r, i, .05)) continue;
			if (i < 5.7) continue;
			let o = n.range(.22, .55);
			a.push({
				pos: new e.Vector3(r, .02, i),
				quat: $(n),
				scale: new e.Vector3(o * n.range(1.1, 1.7), o * .45, o * n.range(1.1, 1.7)),
				color: new e.Color().setRGB(n.range(1.1, 1.55), n.range(1.35, 1.9), n.range(.7, 1))
			});
		}
		let o = new e.InstancedMesh(ti(0), this.coreMat, a.length);
		for (let t = 0; t < a.length; t++) {
			let n = a[t];
			o.setMatrixAt(t, new e.Matrix4().compose(n.pos, n.quat, n.scale)), o.setColorAt(t, n.color);
		}
		o.instanceMatrix.needsUpdate = !0, o.instanceColor && (o.instanceColor.needsUpdate = !0), o.castShadow = !1, o.receiveShadow = !0, o.name = "moss-clumps", o.computeBoundingSphere(), this.group.add(o);
	}
	flushCards() {
		for (let t of this.buckets.values()) {
			if (!t.matrices.length) continue;
			let n = Qr(t.cell, t.shape), r = new e.InstancedMesh(n, this.leafMat, t.matrices.length);
			for (let e = 0; e < t.matrices.length; e++) r.setMatrixAt(e, t.matrices[e]), r.setColorAt(e, t.colors[e]);
			r.instanceMatrix.needsUpdate = !0, r.instanceColor && (r.instanceColor.needsUpdate = !0);
			let i = t.layer === "canopy" || t.layer === "bamboo";
			r.castShadow = i, r.receiveShadow = !0, i && (r.customDepthMaterial = this.depthMat), r.name = `veg-cards-${t.layer}-${t.cell}`, r.computeBoundingSphere(), this.group.add(r);
		}
	}
}, li = "\nattribute float aDepth;\nattribute float aFlow;\nvarying float vDepth;\nvarying float vFlow;\nvarying vec2 vUvW;\nvoid main(){\n  vDepth = aDepth;\n  vFlow = aFlow;\n  vUvW = uv;\n  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n}\n", ui = class {
	group = new e.Group();
	material;
	waterfall;
	fallMat;
	constructor() {
		this.group.name = "water", this.material = this.makeWaterMaterial();
		let n = [], r = le.filter(([e, t]) => we(e, t, 1)), i = [], a = [], o = [], s = [], c = [], l = r.length, u = 0;
		for (let e = 0; e < l; e++) {
			let [t, n] = r[e], f = r[Math.max(0, e - 1)], p = r[Math.min(l - 1, e + 1)], m = p[0] - f[0], h = p[1] - f[1], g = Math.hypot(m, h) || 1;
			m /= g, h /= g;
			let _ = -h, v = m;
			e > 0 && (u += Math.hypot(t - r[e - 1][0], n - r[e - 1][1]));
			let y = de(t, n).t, b = fe(y) * .54, x = pe(y);
			for (let e of [-1, 1]) {
				let r = t + _ * b * e, c = n + v * b * e, l = x - A(r, c);
				i.push(r, x + .015, c), a.push(e < 0 ? 0 : 1, u / 4.5), o.push(d(l, 0, 4)), s.push(.7 + y * .6);
			}
			if (e < l - 1) {
				let t = e * 2;
				c.push(t, t + 2, t + 1, t + 1, t + 2, t + 3);
			}
		}
		let f = new e.BufferGeometry();
		f.setAttribute("position", new e.Float32BufferAttribute(i, 3)), f.setAttribute("uv", new e.Float32BufferAttribute(a, 2)), f.setAttribute("aDepth", new e.Float32BufferAttribute(o, 1)), f.setAttribute("aFlow", new e.Float32BufferAttribute(s, 1)), f.setIndex(c), f.computeVertexNormals(), n.push(f);
		let p = new e.CircleGeometry(O.pond.r, 64, 0, Math.PI * 2);
		p.rotateX(-Math.PI / 2);
		let m = p.getAttribute("position"), h = [], g = [];
		for (let e = 0; e < m.count; e++) {
			let t = m.getX(e) + O.pond.x, n = m.getZ(e) + O.pond.z;
			m.setX(e, t), m.setZ(e, n), m.setY(e, ge), h.push(d(ge - A(t, n), 0, 4)), g.push(.28);
		}
		p.setAttribute("aDepth", new e.Float32BufferAttribute(h, 1)), p.setAttribute("aFlow", new e.Float32BufferAttribute(g, 1)), p.computeVertexNormals(), n.push(p);
		let _ = t(n.map((t) => (t.getAttribute("uv") || t.setAttribute("uv", new e.BufferAttribute(new Float32Array(t.getAttribute("position").count * 2), 2)), t)), !1);
		if (!_) throw Error("water merge failed");
		let v = new e.Mesh(_, this.material);
		v.name = "water-surface", v.receiveShadow = !0, v.renderOrder = 2, this.group.add(v), this.fallMat = this.makeFallMaterial();
		let y = [], b = [], x = [];
		for (let e = 0; e <= 26; e++) {
			let t = e / 26;
			for (let e = 0; e <= 6; e++) {
				let n = e / 6, r = Math.sin(t * Math.PI) * .9 + .2;
				y.push(44 + (n - .5) * 4.2 * (1 + t * .15), 13.2 - t * 9.5, -51 + r * t), b.push(n, t);
			}
		}
		for (let e = 0; e < 26; e++) for (let t = 0; t < 6; t++) {
			let n = e * 7 + t;
			x.push(n, n + 7, n + 1, n + 1, n + 7, n + 8);
		}
		let S = new e.BufferGeometry();
		S.setAttribute("position", new e.Float32BufferAttribute(y, 3)), S.setAttribute("uv", new e.Float32BufferAttribute(b, 2)), S.setIndex(x), S.computeVertexNormals(), this.waterfall = new e.Mesh(S, this.fallMat), this.waterfall.name = "waterfall", this.waterfall.renderOrder = 4, this.group.add(this.waterfall);
	}
	makeWaterMaterial() {
		return o({
			name: "water",
			params: {
				color: 16777215,
				roughness: .06,
				metalness: 0,
				transparent: !0,
				depthWrite: !1,
				side: e.DoubleSide,
				envMapIntensity: 1.5
			},
			uniforms: { uTime: n.time },
			head: "uniform float uTime; varying float vDepthW; varying float vFlowW;",
			vertexHead: "\n        attribute float aDepth;\n        attribute float aFlow;\n        varying float vDepthW;\n        varying float vFlowW;\n      ",
			vertexPre: "\n        vDepthW = aDepth;\n        vFlowW = aFlow;\n      ",
			color: "\n        float d = clamp(vDepthW / 2.0, 0.0, 1.0);\n        vec3 deep = vec3(0.018, 0.073, 0.078);\n        vec3 shallow = vec3(0.13, 0.23, 0.19);\n        vec3 c = mix(shallow, deep, d);\n        float flow = uTime * (0.35 + vFlowW * 0.5);\n        float fn = cgNoise2(vec2(cgP.x * 1.7, cgP.z * 0.8 - flow));\n        fn *= cgNoise2(vec2(cgP.x * 4.2 + 7.0, cgP.z * 1.7 - flow * 1.6));\n        float edge = 1.0 - smoothstep(0.0, 0.28, vDepthW);\n        float foam = smoothstep(0.3, 0.62, fn + edge * 0.42) * (0.3 + edge * 1.2);\n        c = mix(c, vec3(0.78, 0.80, 0.76), clamp(foam, 0.0, 1.0) * 0.8);\n        diffuseColor.rgb = c;\n        diffuseColor.a = mix(0.78, 0.95, d) + foam * 0.2;\n      ",
			normal: "\n        float t = uTime;\n        vec2 p = cgP.xz;\n        float n1 = cgNoise2(p * 1.3 + vec2(0.0, -t * 0.5));\n        float n2 = cgNoise2(p * 2.7 + vec2(t * 0.35, -t * 0.8));\n        float n3 = cgNoise2(p * 6.1 + vec2(-t * 0.6, -t * 1.4));\n        cgBump = vec3((n1 - n2) * 0.10 + (n2 - n3) * 0.05, 0.0, (n2 - n1) * 0.10 + (n3 - n2) * 0.05);\n      ",
			roughness: "\n        roughnessFactor = mix(0.06, 0.22, smoothstep(0.0, 0.4, 1.0 - vDepthW));\n      "
		});
	}
	makeFallMaterial() {
		return new e.ShaderMaterial({
			uniforms: { uTime: n.time },
			vertexShader: li,
			fragmentShader: "\n        uniform float uTime;\n        varying float vDepth;\n        varying float vFlow;\n        varying vec2 vUvW;\n        float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }\n        float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h12(i),h12(i+vec2(1,0)),f.x), mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),f.x), f.y); }\n        void main(){\n          float t = uTime;\n          float streak = n2(vec2(vUvW.x * 8.0, vUvW.y * 2.0 - t * 1.8));\n          streak *= n2(vec2(vUvW.x * 22.0 + 3.0, vUvW.y * 4.0 - t * 3.1));\n          float edge = smoothstep(0.0, 0.18, vUvW.x) * smoothstep(1.0, 0.82, vUvW.x);\n          float top = smoothstep(0.0, 0.08, vUvW.y);\n          float a = edge * top * (0.55 + streak * 0.65);\n          vec3 c = mix(vec3(0.55,0.68,0.68), vec3(0.95,0.97,0.94), streak);\n          gl_FragColor = vec4(c, clamp(a, 0.0, 0.9));\n        }\n      ",
			transparent: !0,
			depthWrite: !1,
			side: e.DoubleSide
		});
	}
	update(e) {
		this.fallMat.uniforms.uTime = n.time;
	}
};
//#endregion
//#region src/world/mist.ts
function di(t) {
	let n = document.createElement("canvas");
	n.width = 256, n.height = 256;
	let r = n.getContext("2d");
	if (!r) throw Error("no 2d");
	let i = new h(t), a = r.createRadialGradient(256 / 2, 256 / 2, 2, 256 / 2, 256 / 2, 256 / 2);
	a.addColorStop(0, "rgba(255,255,255,0.9)"), a.addColorStop(.35, "rgba(255,255,255,0.4)"), a.addColorStop(.7, "rgba(255,255,255,0.12)"), a.addColorStop(1, "rgba(255,255,255,0)"), r.fillStyle = a, r.fillRect(0, 0, 256, 256), r.globalCompositeOperation = "destination-out";
	for (let e = 0; e < 70; e++) {
		let e = i.range(36, 220), t = i.range(36, 220), n = i.range(8, 38), a = r.createRadialGradient(e, t, 0, e, t, n);
		a.addColorStop(0, `rgba(0,0,0,${i.range(.08, .24)})`), a.addColorStop(1, "rgba(0,0,0,0)"), r.fillStyle = a, r.beginPath(), r.arc(e, t, n, 0, Math.PI * 2), r.fill();
	}
	let o = new e.CanvasTexture(n);
	return o.colorSpace = e.SRGBColorSpace, o;
}
var fi = "\nattribute vec3 aPos;\nattribute vec2 aScale;\nattribute float aRot;\nattribute float aAlpha;\nvarying vec2 vUv;\nvarying float vAlpha;\n", pi = `
${fi}
void main(){
  float c = cos(aRot), s = sin(aRot);
  vec2 p = mat2(c, -s, s, c) * position.xy;
  vec3 wp = aPos + vec3(p.x * aScale.x, 0.0, p.y * aScale.y);
  vUv = uv;
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`, mi = `
${fi}
uniform vec3 uRight;
uniform vec3 uUp;
void main(){
  float c = cos(aRot), s = sin(aRot);
  vec2 p = mat2(c, -s, s, c) * position.xy;
  vec3 wp = aPos + uRight * p.x * aScale.x + uUp * p.y * aScale.y;
  vUv = uv;
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`, hi = "\nuniform sampler2D uMap;\nuniform vec3 uTint;\nvarying vec2 vUv;\nvarying float vAlpha;\nvoid main(){\n  float a = texture2D(uMap, vUv).a;\n  if (a < 0.002) discard;\n  gl_FragColor = vec4(uTint, a * vAlpha);\n}\n", gi = class {
	group = new e.Group();
	tex = di("mist");
	banks = [];
	puffs = [];
	ground;
	billboard;
	uniforms = {
		uRight: { value: new e.Vector3(1, 0, 0) },
		uUp: { value: new e.Vector3(0, 1, 0) },
		uMap: { value: null },
		uTint: { value: new e.Color("#aebbb6") }
	};
	constructor(t) {
		this.group.name = "mist";
		let n = new h("mist");
		for (let e = 0; e < 12; e++) this.banks.push({
			x: n.chance(.5) ? n.range(-150, -70) : n.range(60, 130),
			y: n.range(1.5, 6),
			z: n.range(-120, 80),
			s: n.range(16, 42),
			phase: n.range(0, 6.28),
			speed: n.range(.03, .1),
			opacity: n.range(.03, .07)
		});
		for (let t = 0; t < 14; t++) this.puffs.push({
			origin: new e.Vector3(44 + n.range(-3.5, 3.5), n.range(3.8, 8), -50 + n.range(-2.5, 2.5)),
			scale: n.range(3, 8),
			phase: n.range(0, 6.28),
			speed: n.range(.4, 1),
			kind: "spray",
			seed: n.range(0, 1)
		});
		for (let e = 0; e < 34; e++) this.puffs.push({
			origin: t.clone(),
			scale: 1,
			phase: e / 26,
			speed: n.range(.045, .075),
			kind: "smoke",
			seed: n.range(0, 1)
		});
		this.uniforms.uMap.value = this.tex, this.ground = this.makeLayer(this.banks.length, pi), this.billboard = this.makeLayer(this.puffs.length, mi);
		let r = new e.Mesh(this.ground.geo, new e.ShaderMaterial({
			uniforms: this.uniforms,
			vertexShader: pi,
			fragmentShader: hi,
			transparent: !0,
			depthWrite: !1,
			side: e.DoubleSide
		}));
		r.frustumCulled = !1, r.renderOrder = 18, this.group.add(r);
		let i = new e.Mesh(this.billboard.geo, new e.ShaderMaterial({
			uniforms: this.uniforms,
			vertexShader: mi,
			fragmentShader: hi,
			transparent: !0,
			depthWrite: !1,
			side: e.DoubleSide
		}));
		i.frustumCulled = !1, i.renderOrder = 22, this.group.add(i), this.update(0, new e.PerspectiveCamera());
	}
	makeLayer(t, n) {
		let r = new e.PlaneGeometry(1, 1), i = new e.InstancedBufferGeometry();
		i.index = r.index, i.setAttribute("position", r.getAttribute("position")), i.setAttribute("uv", r.getAttribute("uv"));
		let a = new e.InstancedBufferAttribute(new Float32Array(t * 3), 3), o = new e.InstancedBufferAttribute(new Float32Array(t * 2), 2), s = new e.InstancedBufferAttribute(new Float32Array(t), 1), c = new e.InstancedBufferAttribute(new Float32Array(t), 1);
		return i.setAttribute("aPos", a), i.setAttribute("aScale", o), i.setAttribute("aRot", s), i.setAttribute("aAlpha", c), i.instanceCount = t, i.boundingSphere = new e.Sphere(new e.Vector3(0, 20, 0), 500), {
			geo: i,
			pos: a,
			scl: o,
			rot: s,
			alpha: c,
			count: t
		};
	}
	update(t, n) {
		let r = new e.Vector3().setFromMatrixColumn(n.matrixWorld, 0), i = new e.Vector3().setFromMatrixColumn(n.matrixWorld, 1);
		this.uniforms.uRight.value.copy(r), this.uniforms.uUp.value.copy(i);
		for (let e = 0; e < this.banks.length; e++) {
			let n = this.banks[e], r = t * n.speed + n.phase, i = n.x + Math.sin(r) * 6, a = n.z + Math.cos(r * .7) * 4, o = n.opacity * (.72 + .28 * Math.sin(r * 2));
			this.ground.pos.setXYZ(e, i, n.y, a), this.ground.scl.setXY(e, n.s, n.s * .7), this.ground.rot.setX(e, n.phase + t * .01), this.ground.alpha.setX(e, o);
		}
		this.ground.pos.needsUpdate = !0, this.ground.scl.needsUpdate = !0, this.ground.rot.needsUpdate = !0, this.ground.alpha.needsUpdate = !0;
		for (let e = 0; e < this.puffs.length; e++) {
			let n = this.puffs[e], r = t * n.speed + n.phase, i = n.origin.x, a = n.origin.y, o = n.origin.z, s = n.scale, c = n.scale, l = 0, u = 0;
			if (n.kind === "spray") i += Math.sin(r * 2.3) * .8, a += Math.sin(r * 1.7) * .5, l = .14 * (.7 + .3 * Math.sin(r * 2.1)), s = n.scale * (.9 + .1 * Math.sin(r)), c = n.scale * .8, u = n.seed * 3;
			else {
				let e = (t * n.speed + n.phase) % 1;
				a = n.origin.y + e * 8, i = n.origin.x + e * e * 2.2 + Math.sin(e * 5) * .4, o = n.origin.z + e * e * .8;
				let r = .5 + e * 3.4;
				s = r, c = r * 1.15, l = .16 * (1 - e) * Math.min(1, e * 8), u = e * 1.2;
			}
			this.billboard.pos.setXYZ(e, i, a, o), this.billboard.scl.setXY(e, s, c), this.billboard.rot.setX(e, u), this.billboard.alpha.setX(e, Math.max(0, l));
		}
		this.billboard.pos.needsUpdate = !0, this.billboard.scl.needsUpdate = !0, this.billboard.rot.needsUpdate = !0, this.billboard.alpha.needsUpdate = !0;
	}
};
//#endregion
export { n as ATMO, Gn as Details, hr as ForestGate, ci as GateFramingTrees, gr as GateGround, Dt as HillsideTrail, Ut as LingyinMasterplanBlockout, gi as Mist, u as Sky, un as Temple, Ne as Terrain, Wn as Vegetation, O as WORLD, ui as Water, vt as buddhaMaterial, Wt as createApprovedLingyinLandscape, mn as createMainHallInterior, xn as createSmallHallInteriors, A as heightAt, wn as mainHallStatueSolids, Fn as preloadFoliagePhotos, Dn as preloadRuntimeTextures, Je as preloadTempleTextures, je as preloadTerrainTextures };
