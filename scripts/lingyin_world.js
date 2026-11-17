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
	eave: 12,
	plinth: 2.1,
	rot: 0
}), C = S.plinth + .25, w = Object.freeze({
	count: 12,
	width: 7.2,
	treadDepth: .42,
	treadHeight: .16,
	frontGap: 1.42,
	railWidth: .32,
	railHeight: .72
}), T = Object.freeze({
	halfClear: w.width / 2,
	jambWidth: .34,
	leafThickness: .22,
	leafDepth: w.width / 2,
	clearHeight: 5.95,
	flankX: 6.76,
	wallZ: S.d / 2 - 1.35
}), E = T.halfClear + T.jambWidth;
function D() {
	let { halfClear: e, jambWidth: t, leafThickness: n, leafDepth: r, clearHeight: i, wallZ: a } = T, o = [], s = (e, t, n, r, i, a, s, c) => o.push({
		name: e,
		role: t,
		w: n,
		h: r,
		d: i,
		x: a,
		y: s,
		z: c
	});
	for (let o of [-1, 1]) s("jamb", "lacquer", t, i, .55, o * (e + t / 2), i / 2, a), s("door-leaf", "lacquer", n, i - .12, r, o * (e + n / 2), i / 2, a - r / 2 - .08);
	s("lintel", "lacquer", 2 * (e + t) + .34, .39, .65, 0, i + .195, a), s("transom-cap", "darkWood", 2 * (e + t) + .54, .22, .69, 0, i + 1.31, a);
	for (let n of [
		-e - t / 2,
		0,
		e + t / 2
	]) s("transom-post", "lacquer", n === 0 ? .15 : t, .81, .29, n, i + .795, a);
	return o;
}
function O(e) {
	let t = Math.max(0, Math.min(w.count - 1, e));
	return {
		z: S.d / 2 + w.frontGap + (w.count - 1 - t) * w.treadDepth,
		top: .24 + t * w.treadHeight
	};
}
var ee = Object.freeze({
	x: S.w / 27,
	z: S.d / 17
}), k = Object.freeze({
	halfPost: .205,
	postTop: 1.09,
	postShoulder: .89,
	capWidth: .3,
	capTop: .74,
	postSteps: Object.freeze([
		0,
		4,
		8,
		11
	]),
	landingBays: 5,
	landingZ: S.d / 2 + 1.05,
	endX: S.w / 2 + 1
}), A = w.width / 2 + k.halfPost, j = [[
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
]], M = 2.45, N = M + .27, te = M + 1.45, ne = 7.2, re = .14, ie = [{
	x: -50,
	z: 62,
	y: 13,
	hx: 5.2,
	hz: 4.2,
	entrySide: "east",
	entryX: -44.8,
	entryZ: 62
}], P = {
	x0: -24,
	x1: 20,
	z0: 45.5,
	z1: 74.5,
	y: 0
};
function ae(e, t = .9) {
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
function oe(e, t, n) {
	let r = Infinity;
	for (let i = 0; i < n.length - 1; i++) {
		let a = n[i], o = n[i + 1], s = o[0] - a[0], c = o[1] - a[1], l = Math.max(0, Math.min(1, ((e - a[0]) * s + (t - a[1]) * c) / (s * s + c * c)));
		r = Math.min(r, Math.hypot(e - a[0] - s * l, t - a[1] - c * l));
	}
	return r;
}
function se(e, t = .9) {
	let n = ae(j[e], t), r = [];
	n.at(-1).along;
	for (let t of [-1, 1]) {
		let i = [];
		for (let a = 0; a < n.length - 1; a++) {
			let o = n[a], s = n[a + 1], c = {
				x: o.x + o.nx * t * N,
				z: o.z + o.nz * t * N,
				y: o.y,
				along: o.along
			}, l = {
				x: s.x + s.nx * t * N,
				z: s.z + s.nz * t * N,
				y: s.y,
				along: s.along
			}, u = (c.x + l.x) / 2, d = (c.z + l.z) / 2, f = (c.along + l.along) / 2 < 2.4, p = ie.some((e) => Math.abs(u - e.x) < e.hx + .3 && Math.abs(d - e.z) < e.hz + .3), m = j.some((t, n) => n !== e && oe(u, d, t) < 2.6100000000000003);
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
function ce(e, t) {
	let n = Infinity, r = null, i = 0;
	for (let a = 0; a < j.length; a++) {
		let o = j[a];
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
function le(e, t) {
	let n = ce(e, t).distance;
	for (let r of ie) n = Math.min(n, Math.hypot(Math.max(0, Math.abs(e - r.x) - r.hx), Math.max(0, Math.abs(t - r.z) - r.hz)));
	return n;
}
//#endregion
//#region src/world/heightfield.ts
var F = {
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
}, ue = [
	[46, -120],
	[43, -82],
	[40, -48],
	[37, -16],
	[36, 10],
	[35, 28],
	[31, 44],
	[24, 56],
	[18, 66]
], de = (() => {
	let e = [];
	for (let t = 0; t < ue.length - 1; t++) {
		let n = ue[t], r = ue[t + 1];
		for (let t = 0; t < 12; t++) e.push([f(n[0], r[0], t / 12), f(n[1], r[1], t / 12)]);
	}
	return e.push(ue[ue.length - 1]), e;
})(), fe = [
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
function pe(e, t) {
	let { d: n, t: r, i } = x(e, t, ue);
	return {
		d: n,
		t: d((i + r) / (ue.length - 1), 0, 1)
	};
}
function me(e) {
	return f(2.8, 7.2, e ** .7);
}
function he(e) {
	return f(6.3, .55, d(e, 0, 1) ** .82);
}
function ge(e, t) {
	return Math.hypot(e - F.pond.x, t - F.pond.z) - F.pond.r;
}
function _e(e, t) {
	let { d: n, t: r } = pe(e, t), i = n - me(r), a = ge(e, t);
	return Math.min(i, a);
}
var ve = F.pond.y;
function ye(e, t, n, r, i, a, o) {
	let s = Math.max(n - e, e - i, 0), c = Math.max(r - t, t - a, 0);
	return p(0, o, Math.hypot(s, c));
}
function be(e, t) {
	return 1.55 + .22 * b(e * .045, t * .045, 3) + .07 * b(e * .18 + 4.2, t * .18 - 2.1, 2);
}
function I(e, t) {
	let n = be(e, t), r = F.platform, i = ye(e, t, r.x0, r.z0, r.x1, r.z1, 13);
	n = f(r.y + .04 * b(e * .12, t * .12, 2), n, i);
	let a = x(e, t, fe).d;
	if (a < 5 && _e(e, t) > .8) {
		let e = p(.9, 4.5, a);
		n = f(Math.max(n, r.y - .7), n, e);
	}
	let { d: o, t: s } = pe(e, t), c = me(s), l = he(s) - .85 - .25 * b(e * .2, t * .2, 2), u = p(c * .55, c * 1.9 + 2.5, o);
	n = f(Math.min(n, l), n, u);
	let d = ge(e, t);
	if (d < 12) {
		let r = F.pond.y - 1.5 - .8 * b(e * .09 + 8, t * .09 - 3, 3);
		n = f(Math.min(n, r), n, p(-2, 11, d));
	}
	let m = P, h = ye(e, t, m.x0, m.z0, m.x1, m.z1, 7);
	n = f(r.y, n, h);
	let g = ce(e, t), _ = 1 - p(te, ne, g.distance);
	_ > 0 && (n = f(n, F.platform.y + g.y, _));
	for (let r of ie) {
		let i = Math.hypot(Math.max(0, Math.abs(e - r.x) - r.hx), Math.max(0, Math.abs(t - r.z) - r.hz)), a = i > 0 && g.distance < 4.9 && g.y < r.y - .8;
		i < 4 && !a && (n = f(F.platform.y + r.y, n, p(0, 4, i)));
	}
	return n;
}
function xe(e, t, n) {
	let r = I(e, t), i = F.platform, a = P, o = e > i.x0 && e < i.x1 && t > i.z0 && t < i.z1, s = e > a.x0 && e < a.x1 && t > a.z0 && t < a.z1;
	if (o || s) return Math.min(r, i.y - .14);
	let c = ce(e, t);
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
		let i = ce(e + n, t + r);
		i.distance < 2.6500000000000004 && (l = Math.min(l, F.platform.y + i.y));
	}
	if (!Number.isFinite(l)) return r;
	let u = d((M + n - c.distance) / n, 0, 1);
	return Math.max(r - .42 * u, Math.min(r, l - .06));
}
function Se(e, t, n = F.terrainSegments) {
	let r = F.size / n, i = F.size / 2, a = (e + i) / r, o = (t + i) / r, s = Math.floor(a), c = Math.floor(o), l = a - s, u = o - c, d = -i + s * r, f = -i + c * r, p = xe(d, f, r), m = xe(d + r, f, r), h = xe(d, f + r, r), g = xe(d + r, f + r, r);
	return l + u <= 1 ? p * (1 - l - u) + m * l + h * u : g * (l + u - 1) + m * (1 - u) + h * (1 - l);
}
function Ce(e, t, n = 1.2) {
	let r = I(e + n, t) - I(e - n, t), i = I(e, t + n) - I(e, t - n), a = -r, o = 2 * n, s = -i, c = Math.hypot(a, o, s) || 1;
	return [
		a / c,
		o / c,
		s / c
	];
}
function we(e, t, n = 1.2) {
	return 1 - Ce(e, t, n)[1];
}
function Te(e, t, n = 0) {
	let r = F.platform;
	return e > r.x0 - n && e < r.x1 + n && t > r.z0 - n && t < r.z1 + n;
}
function Ee(e, t, n = 0) {
	let r = F.size / 2 - n;
	return r > 0 && Math.abs(e) <= r && Math.abs(t) <= r;
}
function De(e, t) {
	return Math.min(x(e, t, fe).d, le(e, t));
}
//#endregion
//#region src/world/terrain_baked.ts
function Oe(e, t, n, r, i, a, o) {
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
	let m = Math.abs(e + 3) < 30 && Math.abs(n) < 44 && Math.abs(t - F.platform.y) < .55, h = .32 + _(Math.floor(e / 1.35), Math.floor(n / .78)) * .14;
	u([
		h,
		h * .99,
		h * .91
	], Math.max(+!!m, 1 - p(.15, .55, i)) * (1 - p(.5, .9, r)));
	let g = (1 - p(.43, .73, (b(e * .011 + 3.2, n * .011 + 3.2) + 1) * .5) * .21) * f(.62, 1, o);
	for (let e = 0; e < 3; e++) l[e] *= g;
	return l;
}
var ke = null, Ae = null, je = null, Me = null, Ne = null;
function Pe() {
	if (Ne) return Ne;
	let t = new e.TextureLoader(), n = async (n, r) => {
		let i = new URL(`./assets/lingyin/runtime-textures/${n}.webp`, document.baseURI).href + "?v=1", a = await t.loadAsync(i);
		return a.name = `lingyin-${n}`, a.colorSpace = r ? e.SRGBColorSpace : e.NoColorSpace, a.wrapS = a.wrapT = e.RepeatWrapping, a.repeat.set(1 / 2.8, 1 / 2.8), a.minFilter = e.LinearMipmapLinearFilter, a.magFilter = e.LinearFilter, a.anisotropy = 8, a;
	};
	return Ne = Promise.all([n("forest-ground-albedo", !0), n("forest-ground-normal", !1)]).then(([e, t]) => {
		je = e, Me = t;
	}), Ne;
}
function Fe() {
	if (je && Me) return new e.MeshStandardMaterial({
		name: "terrain-scanned-forest-floor",
		map: je,
		normalMap: Me,
		normalScale: new e.Vector2(.29, .29),
		color: new e.Color().setRGB(1.38, 1.38, 1.38),
		vertexColors: !0,
		roughness: .97,
		metalness: 0
	});
	if (!ke) {
		let t = document.createElement("canvas");
		t.width = t.height = 512;
		let n = t.getContext("2d"), r = n.createImageData(512, 512), i = new Float32Array(512 * 512);
		for (let e = 0; e < 512; e++) for (let t = 0; t < 512; t++) {
			let n = b(t * .035, e * .035, 3), a = _(t, e) - .5, o = d(.91 + n * .075 + a * .065, .77, 1);
			i[e * 512 + t] = o;
			let s = (e * 512 + t) * 4;
			r.data[s] = Math.round(o * 255), r.data[s + 1] = Math.round(o * 253), r.data[s + 2] = Math.round(o * 247), r.data[s + 3] = 255;
		}
		n.putImageData(r, 0, 0), ke = new e.CanvasTexture(t), ke.name = "terrain-baked-grain", ke.colorSpace = e.SRGBColorSpace, ke.wrapS = ke.wrapT = e.RepeatWrapping, ke.repeat.set(1 / 3, 1 / 3), ke.minFilter = e.LinearMipmapLinearFilter, ke.magFilter = e.LinearFilter, ke.anisotropy = 8;
		let a = document.createElement("canvas");
		a.width = a.height = 512;
		let o = a.getContext("2d"), s = o.createImageData(512, 512), c = (e, t) => i[(t + 512 & 511) * 512 + (e + 512 & 511)];
		for (let e = 0; e < 512; e++) for (let t = 0; t < 512; t++) {
			let n = (c(t + 1, e) - c(t - 1, e)) * 1.9, r = (c(t, e + 1) - c(t, e - 1)) * 1.9, i = 1 / Math.hypot(n, r, 1), a = (e * 512 + t) * 4;
			s.data[a] = Math.round((-.5 * n * i + .5) * 255), s.data[a + 1] = Math.round((-.5 * r * i + .5) * 255), s.data[a + 2] = Math.round((.5 * i + .5) * 255), s.data[a + 3] = 255;
		}
		o.putImageData(s, 0, 0), Ae = new e.CanvasTexture(a), Ae.name = "terrain-baked-normal", Ae.wrapS = Ae.wrapT = e.RepeatWrapping, Ae.repeat.copy(ke.repeat), Ae.minFilter = e.LinearMipmapLinearFilter, Ae.magFilter = e.LinearFilter, Ae.anisotropy = 8;
	}
	return new e.MeshStandardMaterial({
		name: "terrain-baked-pbr",
		map: ke,
		normalMap: Ae,
		normalScale: new e.Vector2(.7, .7),
		vertexColors: !0,
		roughness: .91,
		metalness: 0
	});
}
//#endregion
//#region src/world/terrain.ts
var Ie = class {
	group = new e.Group();
	mesh;
	material;
	constructor(t = 1, n = !1) {
		let r = F.size, i = Math.round(F.terrainSegments * d(t, .5, 1)), a = r / 2, o = i + 1, s = new Float32Array(o * o * 3), c = new Float32Array(o * o * 2), l = new Float32Array(o * o * 3), u = [], f = r / i;
		for (let e = 0; e < o; e++) {
			let t = -a + e * f;
			for (let n = 0; n < o; n++) {
				let r = -a + n * f, i = xe(r, t, f), u = e * o + n;
				s[u * 3] = r, s[u * 3 + 1] = i, s[u * 3 + 2] = t, c[u * 2] = r, c[u * 2 + 1] = t;
				let p = 1 - Ce(r, t, 1.4)[1], m = 0;
				m += I(r + 3, t), m += I(r - 3, t), m += I(r, t + 3), m += I(r, t - 3);
				let h = d((m / 4 - i) / 3.5, -.4, 1), g = Oe(r, i, t, p, d(De(r, t) / 6, 0, 1), d(_e(r, t), -4, 18), d(.35 + p * .9 - h * .55, 0, 1));
				l[u * 3] = g[0], l[u * 3 + 1] = g[1], l[u * 3 + 2] = g[2];
			}
		}
		for (let e = 0; e < i; e++) for (let t = 0; t < i; t++) {
			let r = -a + t * f, i = -a + e * f, s = F.platform;
			if (n && (r > s.x0 + 1.2 && r + f < s.x1 - 1.2 && i > s.z0 + 1.7 && i + f < s.z1 - 1.05 || r > -23.5 && r + f < 19.5 && i > 46 && i + f < 74)) continue;
			let c = e * o + t, l = c + 1, d = c + o, p = d + 1;
			u.push(c, d, l, l, d, p);
		}
		let p = new e.BufferGeometry();
		p.setAttribute("position", new e.BufferAttribute(s, 3)), p.setAttribute("uv", new e.BufferAttribute(c, 2)), p.setAttribute("color", new e.BufferAttribute(l, 3)), p.setIndex(u), p.computeVertexNormals(), p.computeBoundingSphere(), this.material = Fe(), this.mesh = new e.Mesh(p, this.material), this.mesh.name = "terrain", this.mesh.receiveShadow = !0, this.mesh.castShadow = !1, this.group.add(this.mesh);
	}
};
//#endregion
//#region src/world/geom.ts
function Le(t) {
	if (!t.getAttribute("uv")) {
		let n = t.getAttribute("position").count;
		t.setAttribute("uv", new e.BufferAttribute(new Float32Array(n * 2), 2));
	}
	return t;
}
function L(t, n, r, i = 0, a = 0, o = 0, s = 0) {
	let c = new e.BoxGeometry(t, n, r);
	return s && c.rotateY(s), c.translate(i, a, o), Le(c);
}
function R(t, n, r, i, a = 0, o = 0, s = 0) {
	let c = new e.CylinderGeometry(t, n, r, i, 1, !1);
	return c.translate(a, o, s), Le(c);
}
function z(e) {
	let n = e.filter((e) => e && e.getAttribute("position")?.count), r = n.every((e) => e.index !== null), i = t(n.map((e) => Le(r ? e : e.index ? e.toNonIndexed() : e)), !1);
	if (!i) throw Error("merge failed");
	return i.computeBoundingSphere(), i;
}
function B(t, n) {
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
function Re(t) {
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
function ze(t) {
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
function Be(t, n, r, i, a) {
	let o = new e.Shape();
	o.moveTo(-t / 2, 0), o.lineTo(t / 2, 0), o.lineTo(t / 2, n), o.lineTo(-t / 2, n), o.lineTo(-t / 2, 0);
	let s = new e.Path();
	s.moveTo(-i, .2), s.lineTo(-i, a), s.absarc(0, a, i, Math.PI, 0, !0), s.lineTo(i, .2), s.lineTo(-i, .2), o.holes.push(s);
	let c = new e.ExtrudeGeometry(o, {
		depth: r,
		bevelEnabled: !1,
		curveSegments: 16
	});
	return c.translate(0, 0, -r / 2), Le(c);
}
function Ve(e, t, n = .19, r = .055, i = 0) {
	let a = [];
	for (let o = -e / 2; o <= e / 2 + .001; o += n) a.push(L(r, t, .06, o, t / 2, i));
	for (let o = 0; o <= t + .001; o += n * 1.35) a.push(L(e, r, .055, 0, o, i));
	return {
		bars: z(a),
		backing: L(e, t, .04, 0, t / 2, i - .06)
	};
}
function He(t, n = 512, r = 160, i = {}) {
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
var Ue = null, We = null, Ge = null, Ke = null, qe = null, Je = {}, Ye = null, Xe = /* @__PURE__ */ new Map(), Ze = [
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
Ze.filter((e) => !e.startsWith("courtyard-") && e !== "plaque-gate");
function Qe(t) {
	let n = Xe.get(t);
	if (n) return n;
	let r = new URL(`./assets/lingyin/temple-textures/${t}.webp`, document.baseURI).href + "?v=3", i = new e.TextureLoader().loadAsync(r).then((n) => {
		n.name = `lingyin-${t}`, n.colorSpace = t.endsWith("albedo") || t.startsWith("plaque-") ? e.SRGBColorSpace : e.NoColorSpace, n.wrapS = n.wrapT = t.startsWith("plaque-") ? e.ClampToEdgeWrapping : e.RepeatWrapping, n.minFilter = e.LinearMipmapLinearFilter, n.magFilter = e.LinearFilter, n.anisotropy = 16, Je[t] = n;
	});
	return Xe.set(t, i), i;
}
function $e() {
	return Ye || (Ye = Promise.all(Ze.map(Qe)).then(() => {}), Ye);
}
function et(e) {
	return Je[`plaque-${e}`];
}
var tt = null;
function nt() {
	if (tt) return tt;
	let t = Je["courtyard-albedo"], n = Je["courtyard-normal"], r = Je["courtyard-roughness"];
	if (!t || !n || !r) throw Error("Lingyin courtyard maps must be preloaded");
	for (let e of [
		t,
		n,
		r
	]) e.repeat.set(48 / 5.1, 32 / 5.1);
	return tt = new e.MeshStandardMaterial({
		name: "courtyard-photogrammetry",
		map: t,
		normalMap: n,
		roughnessMap: r,
		color: 15656146,
		normalScale: new e.Vector2(.43, .43),
		roughness: .94,
		metalness: 0
	}), tt;
}
function rt(e, t) {
	let n = nt().clone();
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
function it(t, n, r, i, a, o) {
	let s = Je[n];
	return s ? new e.MeshStandardMaterial({
		name: t,
		map: s,
		normalMap: Je[r],
		normalScale: new e.Vector2(o, o),
		roughnessMap: Je[i],
		roughness: a,
		metalness: 0
	}) : null;
}
function at(e, t = !1) {
	let n = it(`gate-photographic-${e}${t ? "-dark" : ""}`, e === "wood" ? "wood-albedo" : "plaster-albedo", e === "wood" ? "wood-normal" : "plaster-normal", e === "wood" ? "wood-roughness" : "plaster-roughness", .94, e === "wood" ? .22 : .2);
	return n && n.color.set(e === "plaster" ? "#b9a276" : t ? "#978575" : "#b39a80"), n;
}
function ot() {
	if (Ge) return Ge;
	let t = document.createElement("canvas");
	t.width = t.height = 256;
	let n = t.getContext("2d"), r = n.createImageData(256, 256), i = 1919509349, a = () => ((i = Math.imul(i, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
	for (let e = 0; e < 256; e++) for (let t = 0; t < 256; t++) {
		let n = Math.sin(t * .36 + e * .015) * .012, i = Math.max(.78, Math.min(.96, .88 + (a() - .5) * .065 + n)), o = (e * 256 + t) * 4;
		r.data[o] = Math.round(i * 255), r.data[o + 1] = Math.round(i * 248), r.data[o + 2] = Math.round(i * 230), r.data[o + 3] = 255;
	}
	return n.putImageData(r, 0, 0), Ge = new e.CanvasTexture(t), Ge.colorSpace = e.SRGBColorSpace, Ge.wrapS = Ge.wrapT = e.RepeatWrapping, Ge.minFilter = e.LinearMipmapLinearFilter, Ge.magFilter = e.LinearFilter, Ge.anisotropy = 8, Ge;
}
function st() {
	if (We) return We;
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
	return n.putImageData(r, 0, 0), We = new e.CanvasTexture(t), We.colorSpace = e.SRGBColorSpace, We.wrapS = We.wrapT = e.RepeatWrapping, We.minFilter = e.LinearMipmapLinearFilter, We.magFilter = e.LinearFilter, We.anisotropy = 8, We;
}
function ct() {
	if (Ue) return Ue;
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
	return d.colorSpace = e.SRGBColorSpace, d.wrapS = d.wrapT = e.RepeatWrapping, d.minFilter = e.LinearMipmapLinearFilter, d.magFilter = e.LinearFilter, d.anisotropy = 8, Ue = new e.MeshStandardMaterial({
		name: "weathered-stone-slabs",
		map: d,
		bumpMap: d,
		bumpScale: .048,
		roughness: .94,
		metalness: 0,
		vertexColors: !0
	}), Ue;
}
function lt(t, n) {
	let r = t.getAttribute("position").count, i = new Float32Array(r * 3);
	for (let e = 0; e < r; e++) {
		let t = n * (.96 + e % 3 * .04);
		i[e * 3] = t, i[e * 3 + 1] = t * .992, i[e * 3 + 2] = t * .978;
	}
	return t.setAttribute("color", new e.BufferAttribute(i, 3)), t;
}
function ut(e = 0) {
	return dt(e) || o({
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
function dt(e = 0) {
	let t = it("stone-photogrammetry", "stone-albedo", "stone-normal", "stone-roughness", .96, .32);
	return t && t.color.set(e > .5 ? 14076600 : 16777215), t;
}
function ft() {
	let e = it("bark-photogrammetry", "wood-albedo", "wood-normal", "wood-roughness", .97, .42);
	return e && (e.color.set(11709588), e.vertexColors = !0), e;
}
function pt() {
	let t = Je["roof-albedo"], n = Je["roof-normal"];
	if (t && n) return t.repeat.set(1 / 5, 1 / 5), n.repeat.set(1 / 5, 1 / 5), new e.MeshStandardMaterial({
		name: "roof-tile-photogrammetry",
		map: t,
		normalMap: n,
		normalScale: new e.Vector2(.28, .28),
		roughness: .86,
		metalness: .02,
		side: e.DoubleSide
	});
	if (!Ke) {
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
		n.putImageData(r, 0, 0), Ke = new e.CanvasTexture(t), Ke.name = "baked-weathered-roof-tiles", Ke.colorSpace = e.SRGBColorSpace, Ke.wrapS = Ke.wrapT = e.RepeatWrapping, Ke.repeat.set(1 / (12 * .34), 1 / (8 * .52)), Ke.minFilter = e.LinearMipmapLinearFilter, Ke.magFilter = e.LinearFilter, Ke.anisotropy = 8;
	}
	return new e.MeshStandardMaterial({
		name: "roof-tile-baked",
		map: Ke,
		bumpMap: Ke,
		bumpScale: .045,
		roughness: .82,
		metalness: .02,
		side: e.DoubleSide
	});
}
function mt() {
	let e = pt();
	return e.name = "main-hall-weathered-red-roof", e.color.set(10178883), e.roughness = .91, e.metalness = 0, e.normalScale && e.normalScale.set(.36, .36), e;
}
function ht() {
	let e = xt();
	return e.name = "main-hall-cool-grey-plaster", e.color.set(12170669), e.roughness = 1, e.normalScale && e.normalScale.set(.24, .24), e;
}
function gt() {
	let e = ut(0);
	return e.name = "main-hall-grey-stone-plinth", e.color.set(11119270), e.roughness = .98, e;
}
function _t(e = !1) {
	let t = St(e);
	return t.name = e ? "main-hall-dark-red-joinery" : "main-hall-weathered-red-timber", t.color.set(e ? 10716535 : 14136229), t.roughness = e ? .9 : .86, t.normalScale && t.normalScale.set(.22, .22), t;
}
function vt() {
	if (qe) return qe;
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
	return qe = new e.CanvasTexture(t), qe.name = "main-hall-painted-beam-pattern", qe.colorSpace = e.SRGBColorSpace, qe.wrapS = qe.wrapT = e.RepeatWrapping, qe.repeat.set(2.5, 1), qe.minFilter = e.LinearMipmapLinearFilter, qe.magFilter = e.LinearFilter, qe.anisotropy = 8, qe;
}
function yt() {
	let t = vt();
	return new e.MeshStandardMaterial({
		name: "main-hall-blue-green-painted-beams",
		map: t,
		bumpMap: t,
		bumpScale: .018,
		roughness: .88,
		metalness: .01
	});
}
function bt() {
	return new e.MeshStandardMaterial({
		name: "main-hall-dark-teal-window",
		color: 1191213,
		emissive: new e.Color(463121),
		emissiveIntensity: .03,
		roughness: .92
	});
}
function xt() {
	let e = it("plaster-photogrammetry", "plaster-albedo", "plaster-normal", "plaster-roughness", .98, .18);
	if (e) return e;
	let t = st();
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
function St(e = !1) {
	return it(e ? "aged-wood" : "red-lacquer-wood", e ? "wood-albedo" : "wood-red-albedo", "wood-normal", "wood-roughness", .82, .16) || o({
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
function Ct() {
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
function wt() {
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
function Tt() {
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
function Et() {
	return it("teal-painted-wood", "wood-teal-albedo", "wood-normal", "wood-roughness", .9, .12) || o({
		name: "dougong",
		params: {
			color: 16777215,
			roughness: .6,
			metalness: .02
		},
		color: "\n      float n = cgNoise2(cgP.xz * 5.0 + cgP.y * 2.0);\n      vec3 teal = mix(vec3(0.035,0.095,0.085), vec3(0.09,0.17,0.145), n);\n      float gold = smoothstep(0.75, 0.95, cgNoise2(cgP.xz * 9.0));\n      vec3 c = mix(teal, vec3(0.55,0.40,0.16), gold * 0.55);\n      diffuseColor.rgb = c;\n    "
	});
}
function Dt() {
	return new e.MeshStandardMaterial({
		color: new e.Color("#2a1a0c"),
		emissive: new e.Color("#8a4a1e"),
		emissiveIntensity: .03,
		roughness: .9
	});
}
function Ot() {
	return new e.MeshStandardMaterial({
		color: new e.Color("#7e1e18"),
		emissive: new e.Color("#ff5a2a"),
		emissiveIntensity: .3,
		roughness: .7
	});
}
function kt() {
	let e = dt(.2);
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
var At = F.platform.y, jt = (t, n, r) => new e.Vector3(t, n, r);
function Mt(t, n, r = .16, i = .14) {
	let a = n.clone().sub(t), o = new e.BoxGeometry(r, i, a.length());
	return o.applyQuaternion(new e.Quaternion().setFromUnitVectors(jt(0, 0, 1), a.clone().normalize())), o.translate((t.x + n.x) / 2, (t.y + n.y) / 2, (t.z + n.z) / 2), o;
}
var Nt = class {
	group = new e.Group();
	constructor() {
		this.group.name = "hillside-pilgrimage-trail";
		let t = ut(.3), n = St(!0), r = [], i = [], a = [], o = [], s = [], c = (e, t) => Math.max(I(e, t) + re, Se(e, t) + .055);
		for (let e of j) {
			let t = ae(e), n = r.length / 3;
			for (let [e, o] of t.entries()) {
				for (let e of [
					-1,
					0,
					1
				]) {
					let t = o.x + o.nx * M * e, n = o.z + o.nz * M * e, a = c(t, n);
					r.push(t, a, n), i.push(o.along / 2.2, (e + 1) * 1.1);
				}
				if (e < t.length - 1) {
					let t = n + e * 3;
					a.push(t, t + 1, t + 3, t + 1, t + 4, t + 3, t + 1, t + 2, t + 4, t + 2, t + 5, t + 4);
				}
			}
		}
		for (let t = 0; t < j.length; t++) for (let n of se(t)) {
			let t = -Infinity;
			for (let [r, i] of n.points.entries()) {
				let a = jt(i.x, At + i.y, i.z);
				if (r === 0 || r === n.points.length - 1 || i.along - t >= 2.25) {
					let n = new e.BoxGeometry(.2, 1.76, .2);
					n.translate(a.x, a.y + .7, a.z), o.push(n);
					let r = new e.BoxGeometry(.36, .28, .36);
					r.translate(a.x, a.y - .05, a.z), s.push(r), t = i.along;
				}
				if (r > 0) {
					let e = n.points[r - 1], t = jt(e.x, At + e.y, e.z);
					s.push(Mt(t.clone().add(jt(0, -.055, 0)), a.clone().add(jt(0, -.055, 0)), .31, .18));
					for (let e of [1.03, 1.45]) o.push(Mt(t.clone().add(jt(0, e, 0)), a.clone().add(jt(0, e, 0))));
				}
			}
		}
		let l = new e.BufferGeometry();
		l.setAttribute("position", new e.Float32BufferAttribute(r, 3)), l.setAttribute("uv", new e.Float32BufferAttribute(i, 2)), l.setIndex(a), l.computeVertexNormals();
		let u = new e.Mesh(l, t);
		u.name = "graded-mountain-stone-path", u.receiveShadow = !0, this.group.add(u);
		for (let [r, i] of ie.entries()) {
			let a = At + i.y, o = new e.Mesh(new e.BoxGeometry(i.hx * 2, .18, i.hz * 2), t);
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
			let f = new e.Mesh(z(s), t);
			f.castShadow = !0, f.receiveShadow = !0, f.name = `overlook-stone-parapet-${r + 1}`, this.group.add(f);
			let p = new e.Mesh(z(c), n);
			p.castShadow = !0, p.name = `overlook-open-rail-${r + 1}`, this.group.add(p);
			let m = i.z - .45, h = [], g = [], _ = 2.9, v = new e.CylinderGeometry(3.35, 3.55, .24, 8);
			v.translate(i.x, a + .12, m), h.push(v);
			let y = [];
			for (let t = 0; t < 8; t++) {
				let n = t / 8 * Math.PI * 2 + Math.PI / 8, r = i.x + Math.cos(n) * _, o = m + Math.sin(n) * _, s = new e.CylinderGeometry(.29, .34, .24, 12);
				s.translate(r, a + .34, o), h.push(s);
				let c = new e.CylinderGeometry(.17, .2, 3.05, 12);
				c.translate(r, a + 1.98, o), g.push(c), y.push(jt(r, a + 3.48, o));
			}
			for (let e = 0; e < 8; e++) g.push(Mt(y[e], y[(e + 1) % 8], .24, .28));
			let b = new e.CircleGeometry(3.48, 8);
			b.rotateZ(Math.PI / 8), b.rotateX(Math.PI / 2), b.translate(i.x, a + 3.55, m), g.push(b);
			let x = jt(i.x, a + 3.49, m);
			for (let e of y) g.push(Mt(x, e, .11, .12));
			let S = new e.Mesh(z(h), t);
			S.name = `ridge-pavilion-stone-${r + 1}`, S.castShadow = !0, S.receiveShadow = !0, this.group.add(S);
			let C = new e.Mesh(z(g), n);
			C.name = `ridge-pavilion-timber-${r + 1}`, C.castShadow = !0, C.receiveShadow = !0, this.group.add(C);
			let w = pt(), T = new e.Mesh(new e.ConeGeometry(3.95, 1.35, 8, 2), w);
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
			let t = new e.Mesh(z(i), a);
			t.name = r, t.castShadow = !0, t.receiveShadow = !0, this.group.add(t);
		}
	}
}, Pt = null, Ft = null, It = null, Lt = null;
function Rt() {
	return Lt || (Lt = nt().clone(), Lt.name = "pavilion-warm-weathered-stone-slabs", Lt.color.set(15129801), Lt.roughness = .94, Lt.normalScale.set(.35, .35), Lt);
}
function zt() {
	if (Pt) return Pt;
	let t = St(!0), n = document.createElement("canvas");
	n.width = n.height = 512;
	let r = n.getContext("2d");
	r.fillStyle = "#695541", r.fillRect(0, 0, 512, 512);
	for (let e = 0; e < 4; e++) {
		t.map?.image && r.drawImage(t.map.image, 0, e * 128, 512, 128), r.fillStyle = e % 2 ? "rgba(179,137,80,.14)" : "rgba(215,182,127,.09)", r.fillRect(0, e * 128, 512, 128), r.fillStyle = "#302a20", r.fillRect(0, e * 128, 512, 3), r.fillStyle = "rgba(227,204,159,.4)", r.fillRect(0, e * 128 + 4, 512, 2);
		for (let t of [12, 499]) r.fillStyle = "#3c3429", r.beginPath(), r.arc(t, e * 128 + 16, 2.2, 0, Math.PI * 2), r.fill();
	}
	let i = new e.CanvasTexture(n);
	return i.name = "lingyin-weathered-deck-planks", i.colorSpace = e.SRGBColorSpace, i.wrapS = i.wrapT = e.RepeatWrapping, i.anisotropy = 16, Pt = new e.MeshStandardMaterial({
		name: "lingyin-reference-wooden-deck",
		map: i,
		bumpMap: i,
		bumpScale: .024,
		roughness: .88,
		metalness: 0
	}), t.dispose(), Pt;
}
function Bt() {
	if (Ft) return Ft;
	let t = document.createElement("canvas");
	t.width = t.height = 256;
	let n = t.getContext("2d"), r = n.createImageData(256, 256);
	for (let e = 0; e < 256; e++) for (let t = 0; t < 256; t++) {
		let n = t / 256 * Math.PI * 2, i = e / 256 * Math.PI * 2, a = Math.cos(n * 4 + Math.sin(i * 2)) * .22 + Math.cos(n * 9 - i * 3) * .08, o = Math.cos(i * 6 + Math.sin(n * 3)) * .18 - Math.cos(n * 9 - i * 3) * .06, s = (e * 256 + t) * 4, c = 1 / Math.hypot(a, o, 1);
		r.data[s] = (a * c * .5 + .5) * 255, r.data[s + 1] = (o * c * .5 + .5) * 255, r.data[s + 2] = (c * .5 + .5) * 255, r.data[s + 3] = 255;
	}
	n.putImageData(r, 0, 0);
	let i = new e.CanvasTexture(t);
	return i.name = "lingyin-fine-stream-ripples", i.wrapS = i.wrapT = e.RepeatWrapping, i.repeat.set(2, 7), Ft = new e.MeshStandardMaterial({
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
	}), Ft;
}
function Vt() {
	if (It) return It;
	let t = document.createElement("canvas");
	t.width = t.height = 256;
	let n = t.getContext("2d"), r = n.createImageData(256, 256);
	for (let e = 0; e < 256; e++) for (let t = 0; t < 256; t++) {
		let n = t / 255, i = e / 256, a = Math.min(1, n * 9, (1 - n) * 9), o = .62 + .18 * Math.sin(n * 180 + Math.sin(i * Math.PI * 6) * .7) + .12 * Math.sin(n * 59 - i * Math.PI * 8), s = (e * 256 + t) * 4;
		r.data[s] = 209, r.data[s + 1] = 230, r.data[s + 2] = 230, r.data[s + 3] = Math.max(0, a * o) * 230;
	}
	n.putImageData(r, 0, 0);
	let i = new e.CanvasTexture(t);
	return i.colorSpace = e.SRGBColorSpace, i.wrapT = e.RepeatWrapping, It = new e.MeshBasicMaterial({
		name: "lingyin-waterfall-white-streams",
		map: i,
		transparent: !0,
		depthWrite: !1,
		side: e.DoubleSide
	}), It;
}
function Ht(e) {
	Ft?.normalMap && (Ft.normalMap.offset.y = -e * .018), It?.map && (It.map.offset.y = e * .24);
}
//#endregion
//#region src/world/boardwalk_layout.ts
function Ut(e, t) {
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
function Wt(e, t) {
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
var Gt = F.platform.y, Kt = [
	[0, 1.8],
	[.65, 1.38],
	[1.7, .82],
	[2.75, .34],
	[3.55, .1],
	[4, .28]
];
function qt(t, n, r, i) {
	let a = n.clone().sub(t), o = new e.BoxGeometry(r, i, a.length());
	return o.applyQuaternion(new e.Quaternion().setFromUnitVectors(new e.Vector3(0, 0, 1), a.clone().normalize())), o.translate((t.x + n.x) / 2, (t.y + n.y) / 2, (t.z + n.z) / 2), o;
}
function Jt(t, n = .3) {
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
	return a.rotateX(-Math.PI / 2), a.translate(0, Gt + t[0].y - n, 0), a;
}
function Yt() {
	let t = Kt, n = [], r = [], i = [];
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
var Xt = class {
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
		Ht(e);
	}
	fitPreviewTerrain(e) {
		this.gradeBoardwalkTerrain(e);
	}
	gradeBoardwalkTerrain(t) {
		let n = (t, n) => {
			let r = Infinity, i = Gt;
			for (let a = 0; a < this.westRoute.length - 1; a++) {
				let o = this.westRoute[a], s = this.westRoute[a + 1], c = s.x - o.x, l = s.z - o.z, u = e.MathUtils.clamp(((t - o.x) * c + (n - o.z) * l) / (c * c + l * l), 0, 1), d = Math.hypot(t - o.x - c * u, n - o.z - l * u);
				d < r && (r = d, i = Gt + e.MathUtils.lerp(o.y, s.y, u));
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
					l = e.MathUtils.lerp(l, Gt + u.entry.y - .6, o), n > 0 && i < 3.6 && (l = Math.min(l, a - .7));
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
						let t = this.westTerrace, n = t.signedDistance(o.x, o.z), r = 1 - e.MathUtils.smoothstep(n, 0, 10), s = (Gt + t.entry.y - .6 - I(o.x, o.z)) * r;
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
		let t = zt(), n = ut(.2), r = St(!0);
		r.color.set("#c2a27f");
		let i = pt();
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
		let f = Ut(d, new Set([
			0,
			3,
			5,
			7,
			9
		]));
		this.westBoardwalk.userData.railLayout = f;
		let p = Wt(d[d.length - 1], d[d.length - 2]);
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
					o.push(L(4.25, .24, s / r, e.MathUtils.lerp(t.x, n.x, a), Gt + l - .12, e.MathUtils.lerp(t.z, n.z, a), c));
				}
			} else {
				let r = new e.Vector3(t.x, Gt + t.y - .15, t.z), i = new e.Vector3(n.x, Gt + t.y - .15, n.z);
				o.push(qt(r, i, 4.25, .3));
			}
		}
		for (let e of f.landings) {
			let t = Jt(e);
			t && o.push(t);
		}
		let m = /* @__PURE__ */ new Set(), h = [], g = (e, t) => {
			let { x: n, z: r } = e, i = Gt + e.y, a = [
				n,
				e.y,
				r
			].map((e) => e.toFixed(4)).join(",");
			if (m.has(a) || h.some((t) => Math.hypot(t.x - n, t.z - r) < .34 && Math.abs(t.y - e.y) < .1)) return;
			m.add(a), h.push(e);
			let o = Math.min(I(n, r), i - 1.1), c = Math.max(1.25, i - o);
			if (s.push(L(.22, c, .22, n, o + c / 2, r)), s.push(L(.2, 1.22, .2, n, i + .61, r)), t) {
				u.push(L(.4, .55, .4, n, i + 1.46, r)), l.push(L(.52, .09, .52, n, i + 1.78, r)), l.push(L(.46, .08, .46, n, i + 1.16, r));
				for (let e of [-.21, .21]) for (let t of [-.21, .21]) l.push(L(.045, .6, .045, n + e, i + 1.47, r + t));
			}
		}, _ = [];
		for (let t of [...f.rails, ...p.rails]) {
			let { a: n, b: r } = t, i = new e.Vector3(n.x, Gt + n.y + 1.02, n.z), a = new e.Vector3(r.x, Gt + r.y + 1.02, r.z);
			s.push(qt(i, a, .14, .15)), s.push(qt(i.clone().add(new e.Vector3(0, -.46, 0)), a.clone().add(new e.Vector3(0, -.46, 0)), .11, .12));
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
		this.westBoardwalk.userData.postPoints = h, this.westBoardwalk.userData.litPostPoints = _, c.push(Jt(p.outline.map((e) => ({
			...e,
			y: e.y - .05
		})), .65));
		for (let t of p.rails) {
			let n = new e.Vector3(t.a.x, Gt + t.a.y + .11, t.a.z), r = new e.Vector3(t.b.x, Gt + t.b.y + .11, t.b.z);
			c.push(qt(n, r, .32, .22));
		}
		for (let e of p.guard) c.push(L(.48, .24, .48, e.x, Gt + e.y + .12, e.z));
		let v = Jt(p.outline, .05), y = v.getAttribute("position"), b = v.getAttribute("uv");
		for (let e = 0; e < y.count; e++) {
			let t = y.getX(e) - p.entry.x, n = y.getZ(e) - p.entry.z;
			b.setXY(e, (t * p.forward.x + n * p.forward.z) * 2.4 / 48, (t * p.normal.x + n * p.normal.z) * 2.4 / 32);
		}
		let x = new e.Mesh(v, Rt());
		x.name = "phase1-pavilion-terrace-paving", x.receiveShadow = !0, this.westBoardwalk.add(x);
		let { x: S, z: C } = p.pavilion, w = Gt + p.entry.y, T = [];
		for (let t = 0; t < 8; t++) {
			let n = t / 8 * Math.PI * 2 + Math.PI / 8, r = S + Math.cos(n) * 2.65, i = C + Math.sin(n) * 2.65;
			c.push(R(.27, .31, .22, 10, r, w + .11, i)), T.push(R(.15, .18, 3.24, 10, r, w + 1.84, i));
			let a = (t + 1) / 8 * Math.PI * 2 + Math.PI / 8;
			T.push(qt(new e.Vector3(r, w + 3.4, i), new e.Vector3(S + Math.cos(a) * 2.65, w + 3.4, C + Math.sin(a) * 2.65), .19, .24));
			for (let t = 1; t < Kt.length; t++) {
				let [r, i] = Kt[t - 1], [a, o] = Kt[t];
				T.push(qt(new e.Vector3(S + Math.cos(n) * r, w + 3.03 + i, C + Math.sin(n) * r), new e.Vector3(S + Math.cos(n) * a, w + 3.03 + o, C + Math.sin(n) * a), .11, .12));
			}
			T.push(qt(new e.Vector3(S + Math.cos(n) * 3.98, w + 3.37, C + Math.sin(n) * 3.98), new e.Vector3(S + Math.cos(a) * 3.98, w + 3.37, C + Math.sin(a) * 3.98), .13, .16));
		}
		let E = new e.Mesh(z(T), r);
		E.name = "phase1-lower-pavilion-posts", E.castShadow = !0, E.renderOrder = 79;
		let D = new e.Mesh(Yt(), i);
		D.position.set(S, w + 3.15, C), c.push(R(.16, .22, .14, 8, S, w + 4.96, C)), c.push(R(.015, .09, .42, 8, S, w + 5.2, C)), D.name = "phase1-lower-pavilion-roof", D.castShadow = !0, D.renderOrder = 80;
		let O = new e.Mesh(B(z(o), 2.4), t);
		O.name = "phase1-boardwalk-deck", O.castShadow = O.receiveShadow = !0, O.renderOrder = 80;
		let ee = new e.Mesh(B(z(s), .9), r);
		ee.name = "phase1-boardwalk-supports", ee.castShadow = ee.receiveShadow = !0, ee.renderOrder = 79;
		let k = new e.Mesh(z(u), a);
		k.name = "phase1-boardwalk-lanterns", k.castShadow = !1, k.renderOrder = 81, this.westBoardwalk.add(O, ee, k, E, D);
		let A = new e.Mesh(z(l), r);
		A.name = "phase1-boardwalk-lantern-frames";
		let j = new e.Mesh(B(z(c), 1.4), n);
		j.name = "phase1-boardwalk-stone-footings", j.castShadow = j.receiveShadow = !0, this.westBoardwalk.add(A, j);
	}
	buildEastRiver() {
		let t = Bt(), n = ut(.2), r = [], i = [], a = de.filter(([e, t]) => e > 25 && t > -62 && t < 70);
		for (let t = 0; t < a.length - 1; t += 2) {
			let [n, o] = a[t], [s, c] = a[Math.min(t + 2, a.length - 1)], l = pe(n, o).t, u = he(l) + .1, d = me(l) * 1.15, f = new e.Vector3(n, u, o), p = new e.Vector3(s, he(pe(s, c).t) + .1, c);
			r.push(qt(f, p, d, .12));
			let m = s - n, h = c - o, g = Math.hypot(m, h) || 1, _ = -h / g, v = m / g;
			for (let t of [-1, 1]) i.push(qt(f.clone().add(new e.Vector3(_ * t * (d * .58), .1, v * t * (d * .58))), p.clone().add(new e.Vector3(_ * t * (d * .58), .1, v * t * (d * .58))), .65, .5));
		}
		let o = new e.Mesh(z(r), t);
		o.name = "phase1-river-ribbon", o.renderOrder = 10;
		let s = new e.Mesh(B(z(i), 1.4), n);
		s.name = "phase1-river-banks", s.castShadow = s.receiveShadow = !0;
		let c = new e.Mesh(new e.CylinderGeometry(4.3, 4.7, .18, 24), t);
		c.name = "phase1-waterfall-upper-pool", c.position.set(43.2, 6.36, -54.4), c.renderOrder = 11;
		let l = new e.Mesh(new e.PlaneGeometry(5.8, 7.6), Vt());
		l.name = "phase1-waterfall-face", l.position.set(42.25, 3, -49.9), l.rotation.set(0, Math.PI - .12, 0), l.renderOrder = 12;
		let u = new e.Mesh(new e.CylinderGeometry(5.4, 5.8, .16, 24), t);
		u.name = "phase1-waterfall-plunge-pool", u.position.set(40.9, -.72, -45.6), u.renderOrder = 11;
		let d = new e.Mesh(new e.BoxGeometry(5.9, .28, .7), n);
		d.name = "phase1-waterfall-stone-lip", d.position.set(42.65, 6.2, -50.45), d.rotation.y = -.12, this.eastRiver.add(o, s, c, l, u, d);
	}
	buildEastCrossing() {
		let t = ut(.2), n = pt(), r = St(!1), i = [];
		for (let t = 0; t < 3; t++) {
			let n = I(44.35, 28), r = e.MathUtils.lerp(n, Gt + .32, (t + 1) / 3);
			i.push(L(.72, .18, 4.75, 44.62 - t * .72, r - .09, 28));
		}
		let a = new e.Mesh(B(z(i), 1.4), t);
		a.name = "phase1-east-bank-approach", a.castShadow = a.receiveShadow = !0;
		let o = new e.Group();
		o.name = "phase1-east-pavilion";
		let s = 43.5, c = 46.5, l = I(s, c) + .1, u = new e.Mesh(new e.CylinderGeometry(3.5, 3.8, .42, 8), t);
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
function Zt(t) {
	let n = new Xt();
	n.group.name = "lingyin-approved-landscape", n.gradeBoardwalkTerrain(t), t.add(n.group);
	let r = t.getObjectByName("hillside-pilgrimage-trail");
	r && (r.visible = !1);
	let i = t.getObjectByName("water");
	i && (i.visible = !1);
	let a = n.westBoardwalk.userData.railLayout, o = n.westBoardwalk.userData.route, s = Wt(o.at(-1), o.at(-2)), c = [], l = [], u = (e, t, n, r = !1) => {
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
	for (let e of n.westBoardwalk.userData.postPoints) f(e.x, e.z, .11, .11, Math.min(I(e.x, e.z) - F.platform.y, e.y - 1.1), e.y + 1.22);
	for (let e of n.westBoardwalk.userData.litPostPoints) f(e.x, e.z, .26, .26, e.y + 1.16, e.y + 1.825);
	for (let e = 0; e < 8; e++) {
		let t = e * Math.PI / 4 + Math.PI / 8;
		f(s.pavilion.x + Math.cos(t) * 2.65, s.pavilion.z + Math.sin(t) * 2.65, .18, .18, 13, 16.71);
	}
	f(s.pavilion.x, s.pavilion.z, 3.55, 3.55, 16.4, 17.95);
	let p = z([
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
//#region src/world/main_hall_stonework.ts
function Qt(t) {
	let n = t - .2, r = .36, i = Math.ceil(n / .03), a = new Float32Array((i + 1) * 17), o = new e.CurvePath();
	function s(t, n, r, i, a, s, c, l) {
		o.add(new e.CubicBezierCurve(new e.Vector2(t, n), new e.Vector2(r, i), new e.Vector2(a, s), new e.Vector2(c, l)));
	}
	s(0, -.11, -.11, -.05, -.068, .055, 0, .135), s(0, .135, .067, .055, .105, -.065, 0, -.11);
	for (let e of [-1, 1]) s(0, -.096, e * .12, -.13, e * .19, -.015, e * .2, .063), s(e * .2, .063, e * .1, .054, e * .065, .011, e * .051, -.014), s(e * .14, -.077, e * .36, -.2, e * .33, .125, e * .53, .089), s(e * .53, .089, e * .68, .057, e * .58, -.088, e * .47, -.026);
	for (let t of o.curves) {
		let o = t.getPoints(18);
		for (let t = 1; t < o.length; t++) {
			let s = o[t - 1], c = o[t], l = s.x * n * .69, u = c.x * n * .69, d = u - l, f = c.y - s.y, p = Math.max(0, Math.floor(((Math.min(l, u) - .032) / n + .5) * i)), m = Math.min(i, Math.ceil(((Math.max(l, u) + .032) / n + .5) * i)), h = Math.max(0, Math.floor(((Math.min(s.y, c.y) - .032) / r + .5) * 16)), g = Math.min(16, Math.ceil(((Math.max(s.y, c.y) + .032) / r + .5) * 16));
			for (let t = h; t <= g; t++) for (let o = p; o <= m; o++) {
				let c = (o / i - .5) * n, u = (t / 16 - .5) * r, p = e.MathUtils.clamp(((c - l) * d + (u - s.y) * f) / (d * d + f * f), 0, 1), m = Math.hypot(c - l - d * p, u - s.y - f * p), h = t * (i + 1) + o;
				a[h] = Math.max(a[h], .03 * Math.max(0, 1 - (m / .032) ** 2));
			}
		}
	}
	let c = new e.PlaneGeometry(n, r, i, 16), l = c.getAttribute("position"), u = new Float32Array(l.count * 3);
	for (let t = 0; t <= 16; t++) for (let o = 0; o <= i; o++) {
		let s = t * (i + 1) + o, c = a[(16 - t) * (i + 1) + o], d = Math.min(o / i * n, (1 - o / i) * n, t / 16 * r, (1 - t / 16) * r);
		l.setZ(s, c + .011 * (1 - e.MathUtils.smoothstep(d, .009, .024))), u.fill(.8 + .16 * c / .03, s * 3, s * 3 + 3);
	}
	return c.setAttribute("color", new e.BufferAttribute(u, 3)), c.computeVertexNormals(), c;
}
function $t(t) {
	let { z: n, top: r } = O(t), i = (w.treadDepth + .02) / 2, a = [], o = (e, t, n, r) => a.push(...e, ...t, ...r, ...t, ...n, ...r), s = (e) => {
		let a = .008 + Math.exp(-(((e + .23 * Math.sin(t * 1.37)) / 2.3) ** 2)) * (.032 + .009 * Math.sin(1.9 * e + t * 2.1) + .004 * Math.sin(6.2 * e - t)), o = [[
			e,
			0,
			n - i
		], [
			e,
			0,
			n + i
		]];
		for (let t = 0; t <= 4; t++) {
			let s = Math.PI * t / 8;
			o.push([
				e,
				r - a + a * Math.sin(s),
				n + i - a + a * Math.cos(s)
			]);
		}
		return o.push([
			e,
			r,
			n - i
		]), o;
	}, c = s(-w.width / 2);
	for (let e = 1; e <= 28; e++) {
		let t = s(w.width * (e / 28 - .5));
		for (let e = 0; e < c.length; e++) {
			let n = (e + 1) % c.length;
			o(c[e], t[e], t[n], c[n]);
		}
		if (e === 1 || e === 28) {
			let n = e === 1 ? c : t;
			for (let t = 1; t < n.length - 1; t++) a.push(...n[0], ...n[e === 1 ? t : t + 1], ...n[e === 1 ? t + 1 : t]);
		}
		c = t;
	}
	let l = new e.BufferGeometry();
	return l.setAttribute("position", new e.Float32BufferAttribute(a, 3)), l.computeVertexNormals(), l;
}
function en() {
	let t = [], n = /* @__PURE__ */ new Map();
	function r(n, r) {
		n.getAttribute("color") || n.setAttribute("color", new e.Float32BufferAttribute(new Float32Array(n.getAttribute("position").count * 3).fill(r), 3)), t.push(n);
	}
	function i(t) {
		let n = k.halfPost * 2;
		r(L(n, .18, n, t.x, t.y + .09, t.z), .85), r(L(n - .07, .65, n - .07, t.x, t.y + .48, t.z), .97), r(L(n - .026, .072, n - .026, t.x, t.y + .81, t.z), .9), r(L(n, .05, n, t.x, t.y + k.postShoulder - .025, t.z), .98);
		let i = new e.LatheGeometry([
			[.082, 0],
			[.11, .03],
			[.113, .07],
			[.097, .116],
			[.06, .164],
			[.018, .194],
			[0, .2]
		].map(([t, n]) => new e.Vector2(t, n)), 48), a = i.getAttribute("position");
		for (let e = 0; e < a.count; e++) {
			let t = a.getX(e), n = a.getY(e), r = a.getZ(e), i = 1 - .135 * ((Math.cos(8 * Math.atan2(t, r) + .32 * Math.sin(n * 19)) + 1) / 2) ** 4 * Math.sin(Math.PI * n / .2);
			a.setXYZ(e, t * i, n, r * i);
		}
		i.computeVertexNormals(), i.translate(t.x, t.y + k.postShoulder, t.z), r(i, 1);
	}
	function a(e, t) {
		let i = t.x - e.x, a = t.z - e.z, o = Math.hypot(i, a), s = (e.y + t.y) / 2, c = o - .335, l = (t.y - e.y) / o, u = -Math.atan2(a, i);
		function d(n, i) {
			let a = n.getAttribute("position");
			for (let e = 0; e < a.count; e++) a.setY(e, a.getY(e) + a.getX(e) * l);
			n.computeVertexNormals(), n.rotateY(u), n.translate((e.x + t.x) / 2, s, (e.z + t.z) / 2), r(n, i);
		}
		d(L(c, .19, .255, 0, .115, 0), .87), d(L(c, .405, .15, 0, .402, 0), .87), d(L(c, .055, .214, 0, .61, 0), .91), d(L(c, .052, k.capWidth, 0, k.capTop - .063, 0), .97), d(L(c, .048, k.capWidth - .042, 0, k.capTop - .024, 0), 1);
		let f = Math.round(c * 1e4);
		n.has(f) || n.set(f, Qt(c));
		for (let e of [-1, 1]) {
			let t = n.get(f).clone();
			e < 0 && t.rotateY(Math.PI), t.translate(0, .405, e * .077), d(t, 1);
		}
	}
	for (let e of [-1, 1]) {
		let t = e * A;
		for (let e = 0; e < w.count; e++) {
			let n = O(e);
			r(L(.29, n.top + .09, w.treadDepth + .003, t, (n.top + .09) / 2, n.z), .84);
		}
		let n = k.postSteps.map((e) => ({
			x: t,
			z: O(e).z,
			y: O(e).top
		}));
		n.forEach(i);
		for (let e = 1; e < n.length; e++) a(n[e - 1], n[e]);
		let o = Math.abs(t), s = Array.from({ length: k.landingBays + 1 }, (t, n) => ({
			x: e * (o + (k.endX - o) * n / k.landingBays),
			y: C,
			z: k.landingZ
		})), c = n[n.length - 1], l = s[0];
		r(L(.285, .52, Math.abs(c.z - l.z), t, l.y + .27, (c.z + l.z) / 2), .92), s.forEach(i);
		for (let e = 1; e < s.length; e++) a(s[e - 1], s[e]);
	}
	let o = B(z(t), .9), s = new e.MeshStandardMaterial({
		name: "main-hall-carved-balustrade",
		color: 12830403,
		roughness: .86,
		metalness: 0,
		vertexColors: !0
	}), c = new e.Mesh(o, s);
	return c.name = "main-hall-stair-carving", c.castShadow = !0, c.receiveShadow = !0, c;
}
//#endregion
//#region src/world/main_hall_roof.ts
var tn = e.MathUtils.lerp, nn = .49, rn = .315;
function an(t, n, r) {
	return (i, a) => {
		let o = t.upper ? Math.min(a / nn, 1) : a, s = tn(t.halfWidth, t.innerWidth, o), c = tn(t.halfDepth, t.innerDepth, a), l = Math.abs(i) ** 7 * (1 - o) ** 2, u = t.lift * l;
		return new e.Vector3(n ? i * (s + .49 * l) : r * (s + .49 * l), t.eave + t.rise * a ** 1.47 + u, n ? r * (c + .49 * l) : i * (c + .49 * l));
	};
}
function on(t, n, r, i, a) {
	let o = [], s = [], c = [], l = n * 4, u = Math.ceil(r * i / .78);
	for (let e = 0; e <= u; e++) {
		let n = i * e / u;
		for (let i = 0; i <= l; i++) {
			let d = t(i / l * 2 - 1, n), f = [
				0,
				.018,
				.085,
				.018
			][i % 4];
			if (d.y += f, o.push(d.x, d.y, d.z), s.push((i / 4 + .04) / 9 * 5, n * r * 1.7), e === u || i === l) continue;
			let p = e * (l + 1) + i, m = p + 1, h = p + l + 1, g = h + 1;
			a ? c.push(p, h, m, m, h, g) : c.push(p, m, h, m, g, h);
		}
	}
	let d = new e.BufferGeometry();
	return d.setAttribute("position", new e.Float32BufferAttribute(o, 3)), d.setAttribute("uv", new e.Float32BufferAttribute(s, 2)), d.setIndex(c), d.computeVertexNormals(), d;
}
function sn(t, n) {
	return new e.TubeGeometry(new e.CatmullRomCurve3(t), t.length * 2, n, 8, !1);
}
function cn(t, n, r, i) {
	let a = L(r, i, n.clone().sub(t).length(), 0, 0, 0), o = new e.Matrix4().lookAt(n, t, new e.Vector3(0, 1, 0));
	return a.applyMatrix4(o).translate((t.x + n.x) / 2, (t.y + n.y) / 2, (t.z + n.z) / 2);
}
function ln(t, n, r) {
	let i = [], a = [];
	for (let e = 0; e < r; e++) {
		let o = e / r, s = (e + 1) / r, c = t(o), l = t(s), u = n(s), d = n(o);
		for (let e of [
			c,
			l,
			u,
			c,
			u,
			d
		]) i.push(e.x, e.y, e.z), a.push(e.x + e.z, e.y);
	}
	let o = new e.BufferGeometry();
	return o.setAttribute("position", new e.Float32BufferAttribute(i, 3)), o.setAttribute("uv", new e.Float32BufferAttribute(a, 2)), o.computeVertexNormals(), o;
}
function un(e) {
	let t = e.getAttribute("position").count;
	e.setIndex(Array.from({ length: t }, (e, t) => t - t % 3 + [
		0,
		2,
		1
	][t % 3])), e.computeVertexNormals();
}
function dn() {
	let t = new e.Shape();
	return t.moveTo(-.51, 0), t.lineTo(-.54, .19), t.quadraticCurveTo(-.69, .28, -.58, .4), t.quadraticCurveTo(-.46, .49, -.26, .42), t.quadraticCurveTo(-.3, .74, -.51, .91), t.quadraticCurveTo(-.08, .93, .06, .61), t.quadraticCurveTo(.4, .93, .21, 1.36), t.quadraticCurveTo(.66, 1.22, .73, .92), t.quadraticCurveTo(.84, .6, .58, .28), t.lineTo(.4, 0), t.closePath(), new e.ExtrudeGeometry(t, {
		depth: .3,
		bevelEnabled: !0,
		bevelSegments: 2,
		bevelSize: .044,
		bevelThickness: .035,
		curveSegments: 7
	}).translate(0, 0, -.15);
}
function fn(t, n, r, i) {
	let a = [], o = [], s = [], c = [], l = {
		halfWidth: t / 2 + 2.8,
		halfDepth: n / 2 + 2.8,
		innerWidth: t / 2 - .6,
		innerDepth: n / 2 - .6,
		eave: r + .1,
		rise: 1.5,
		lift: 1.65,
		upper: !1
	}, u = {
		halfWidth: t / 2 - .08,
		halfDepth: n / 2 - .08,
		innerWidth: t * .356,
		innerDepth: 0,
		eave: r + 3.24,
		rise: i + 2.8,
		lift: 1.83,
		upper: !0
	};
	for (let t of [l, u]) for (let n of [!0, !1]) for (let r of [-1, 1]) {
		let i = an(t, n, r), u = 2 * (n ? t.halfWidth : t.halfDepth), d = Math.round(u / rn), f = t.upper && !n ? nn : 1, p = t.upper ? t.halfDepth : l.halfDepth - l.innerDepth;
		a.push(on(i, d, Math.hypot(p, t.rise), f, n ? r < 0 : r > 0));
		let m = Array.from({ length: 31 }, (e, t) => i(t / 15 - 1, 0));
		s.push(sn(m, .077));
		let h = t.upper ? .3 : .94, g = (t, n, r) => i(t * 2 - 1, n).add(new e.Vector3(0, -r, 0));
		for (let e = 0; e < 5; e++) {
			let t = h * e / 5, n = h * (e + 1) / 5, r = ln((e) => g(e, t, .115), (e) => g(e, n, .115), 56);
			r.getAttribute("normal").getY(0) > 0 && un(r), o.push(r);
		}
		for (let t = 0; t < d; t++) {
			let a = (t + .5) / d, o = i(2 * a - 1, 0), l = new e.CylinderGeometry(.09, .093, .1, 10);
			if (n ? l.rotateX(r * Math.PI / 2) : l.rotateZ(-r * Math.PI / 2), s.push(l.translate(o.x, o.y + .004, o.z)), t % 2 == 0) for (let e = 0; e < 3; e++) {
				let t = g(a, tn(.016, h, e / 3), .19), n = g(a, tn(.016, h, (e + 1) / 3), .19);
				c.push(cn(t, n, .13, .16));
			}
		}
		if (n) for (let n of [-1, 1]) {
			let a = t.upper ? nn : 1, o = Array.from({ length: 15 }, (t, r) => i(n, a * r / 14).add(new e.Vector3(0, .12, 0)));
			s.push(sn(o, t.upper ? .16 : .14));
			let c = o[0], l = new e.Vector3(n, 0, r).normalize(), u = new e.Shape();
			u.moveTo(-.47, -.09), u.quadraticCurveTo(.02, -.07, .4, .14), u.quadraticCurveTo(.58, .35, .6, .54), u.quadraticCurveTo(.27, .25, -.12, .14), u.lineTo(-.47, .085), u.closePath();
			let d = new e.ExtrudeGeometry(u, {
				depth: .19,
				bevelEnabled: !0,
				bevelSize: .025,
				bevelThickness: .024,
				bevelSegments: 1,
				curveSegments: 8
			});
			d.translate(0, 0, -.095);
			let f = d.getAttribute("position");
			for (let t = 0; t < f.count; t++) f.setZ(t, f.getZ(t) * tn(1, .26, e.MathUtils.smoothstep(f.getX(t), -.12, .6)));
			d.computeVertexNormals(), d.rotateY(-Math.atan2(l.z, l.x)), s.push(d.translate(c.x, c.y, c.z));
			for (let t of [
				.06,
				.13,
				.22
			]) {
				let r = i(n, a * t), o = new e.LatheGeometry([
					[.084, 0],
					[.108, .05],
					[.075, .1],
					[.083, .15],
					[.035, .22],
					[0, .26]
				].map(([t, n]) => new e.Vector2(t, n)), 8);
				s.push(o.translate(r.x, r.y + .19, r.z));
			}
		}
	}
	for (let t of [-1, 1]) {
		let n = ln((e) => {
			let n = nn + (1 - nn) * (1 - Math.abs(2 * e - 1));
			return an(u, !0, e < .5 ? -1 : 1)(t, n);
		}, (n) => new e.Vector3(t * u.innerWidth, u.eave + u.rise * nn ** 1.47, (2 * n - 1) * u.halfDepth * (1 - nn)), 32);
		n.getAttribute("normal").getX(0) * t < 0 && un(n), o.push(n);
		for (let n of [-1, 1]) {
			let r = Array.from({ length: 17 }, (r, i) => an(u, !0, n)(t, nn + (1 - nn) * i / 16).add(new e.Vector3(.055 * t, .08, 0)));
			s.push(sn(r, .148));
		}
	}
	let d = u.eave + u.rise, f = u.innerWidth;
	s.push(L(2 * f + .36, .36, .54, 0, d + .19, 0)), s.push(sn([
		-f,
		0,
		f
	].map((t) => new e.Vector3(t, d + .47, 0)), .2));
	for (let t = -Math.floor(f / .84); t <= Math.floor(f / .84); t++) {
		let n = new e.CylinderGeometry(.216, .216, .056, 12).rotateZ(Math.PI / 2);
		s.push(n.translate(t * .84, d + .47, 0));
	}
	for (let e of [-1, 1]) {
		let t = dn();
		e < 0 && t.rotateY(Math.PI), s.push(t.translate(e * f, d + .37, 0));
	}
	for (let e of s) {
		let t = e.getAttribute("uv");
		for (let e = 0; e < t.count; e++) t.setXY(e, .195 + .04 * t.getX(e), .31 + .05 * t.getY(e));
	}
	return {
		tiles: a.concat(s),
		timber: o,
		rafters: c
	};
}
//#endregion
//#region src/gate-kit/core/materials.ts
var pn = "\nfloat cgHash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }\nfloat cgHash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }\nvec3 cgHash33(vec3 p3){ p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }\nfloat cgNoise2(vec2 p){\n  vec2 i = floor(p), f = fract(p);\n  f = f * f * (3.0 - 2.0 * f);\n  float a = cgHash12(i), b = cgHash12(i + vec2(1,0)), c = cgHash12(i + vec2(0,1)), d = cgHash12(i + vec2(1,1));\n  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);\n}\nfloat cgNoise3(vec3 p){\n  vec3 i = floor(p), f = fract(p);\n  f = f * f * (3.0 - 2.0 * f);\n  float n000 = cgHash12(i.xy + i.z * 19.19);\n  float n100 = cgHash12(i.xy + vec2(1,0) + i.z * 19.19);\n  float n010 = cgHash12(i.xy + vec2(0,1) + i.z * 19.19);\n  float n110 = cgHash12(i.xy + vec2(1,1) + i.z * 19.19);\n  float n001 = cgHash12(i.xy + (i.z + 1.0) * 19.19);\n  float n101 = cgHash12(i.xy + vec2(1,0) + (i.z + 1.0) * 19.19);\n  float n011 = cgHash12(i.xy + vec2(0,1) + (i.z + 1.0) * 19.19);\n  float n111 = cgHash12(i.xy + vec2(1,1) + (i.z + 1.0) * 19.19);\n  return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y), mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);\n}\nfloat cgFbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i=0;i<5;i++){ s += a * cgNoise2(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }\nfloat cgFbm3(vec3 p){ float s = 0.0, a = 0.5; for (int i=0;i<4;i++){ s += a * cgNoise3(p); p = p * 2.05 + 7.3; a *= 0.5; } return s; }\nfloat cgRidge2(vec2 p){ float s = 0.0, a = 0.55; for (int i=0;i<4;i++){ float n = 1.0 - abs(cgNoise2(p) * 2.0 - 1.0); s += a * n * n; p = p * 2.1 + 3.1; a *= 0.5; } return s; }\n// anti-aliased thin line: distance d in world units, width w, pixel footprint aa\nfloat cgLine(float d, float w, float aa){ return 1.0 - smoothstep(w, w + aa, abs(d)); }\n", mn = "\nvarying vec3 vCgWorld;\nvarying vec3 vCgNormalW;\nvarying vec3 vCgObj;\nvarying float vCgSeed;\n", hn = "\n{\n  vec4 cgP = vec4(transformed, 1.0);\n  vec3 cgN = objectNormal;\n  float cgSeedV = 0.0;\n  #ifdef USE_INSTANCING\n    cgP = instanceMatrix * cgP;\n    cgN = mat3(instanceMatrix) * cgN;\n    cgSeedV = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);\n  #endif\n  vCgWorld = (modelMatrix * cgP).xyz;\n  vCgNormalW = normalize(mat3(modelMatrix) * cgN);\n  vCgObj = transformed;\n  vCgSeed = cgSeedV;\n}\n";
function gn(t = {}) {
	let n = new e.MeshStandardMaterial(t.params ?? {});
	t.name && (n.name = t.name);
	let r = t.uniforms ?? {}, i = "proc:" + _n([
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
		n = n.replace("#include <common>", `#include <common>\n${mn}\n${t.vertexHead ?? ""}`), t.vertexPre && (n = n.replace("#include <begin_vertex>", `#include <begin_vertex>\n{\n${t.vertexPre}\n}`)), n = n.replace("#include <worldpos_vertex>", `#include <worldpos_vertex>\n${hn}`), i = i.replace("#include <common>", `#include <common>\n${mn}\n${pn}\n${t.head ?? ""}`), i = i.replace("void main() {", "void main() {\nvec3 cgP = vCgWorld; vec3 cgN = normalize(vCgNormalW); vec3 cgO = vCgObj; float cgSeed = vCgSeed; vec3 cgBump = vec3(0.0); float cgAO = 1.0;"), t.color && (i = i.replace("#include <color_fragment>", `#include <color_fragment>\n{\n${t.color}\n}`)), t.roughness && (i = i.replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>\n{\n${t.roughness}\n}`)), t.metalness && (i = i.replace("#include <metalnessmap_fragment>", `#include <metalnessmap_fragment>\n{\n${t.metalness}\n}`)), t.normal && (i = i.replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\n{\n${t.normal}\n}\nnormal = normalize(normal + (viewMatrix * vec4(cgBump, 0.0)).xyz);`)), t.emissive && (i = i.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n{\n${t.emissive}\n}`)), t.ao && (i = i.replace("#include <aomap_fragment>", `#include <aomap_fragment>\n{\n${t.ao}\n}\nreflectedLight.indirectDiffuse *= cgAO; reflectedLight.indirectSpecular *= mix(1.0, cgAO, 0.7);`)), e.vertexShader = n, e.fragmentShader = i;
	}, n;
}
function _n(e) {
	let t = 2166136261;
	for (let n = 0; n < e.length; n++) t ^= e.charCodeAt(n), t = Math.imul(t, 16777619);
	return (t >>> 0).toString(36);
}
function vn(t, n, r, i = !0) {
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
var yn = new e.DataTexture(new Uint8Array([
	255,
	255,
	255,
	255
]), 1, 1);
yn.needsUpdate = !0;
function bn(e = 0) {
	return at("wood", e > .5) || gn({
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
function xn() {
	return at("plaster") || gn({
		name: "plaster",
		params: {
			color: 16777215,
			roughness: .9
		},
		color: "\n      float n = cgFbm2(vec2(cgP.x * 0.9 + cgP.z * 0.9, cgP.y * 0.7));\n      float fine = cgNoise2(vec2(cgP.x * 8.0 + cgP.z * 4.0, cgP.y * 6.0));\n      vec3 c = mix(vec3(0.18, 0.13, 0.052), vec3(0.30, 0.215, 0.09), n * 0.8 + fine * 0.2);\n      // vertical rain wash and hairline cracks\n      float streak = smoothstep(0.6, 0.9, cgNoise2(vec2(cgP.x * 4.0 + cgP.z * 2.0, cgP.y * 0.15)));\n      c *= 1.0 - streak * 0.28;\n      float crack = smoothstep(0.7, 0.9, cgRidge2(vec2((cgP.x + cgP.z) * 5.0, cgP.y * 0.25)));\n      c *= 1.0 - crack * 0.3;\n      c = mix(c, vec3(0.30, 0.245, 0.16), (1.0 - smoothstep(0.35, 1.4, cgP.y - 0.35)) * 0.5);\n      float algae = smoothstep(0.4, 0.85, cgFbm2(vec2(cgP.x * 1.8 + cgP.z, cgP.y * 1.1) + 6.0));\n      c = mix(c, vec3(0.12, 0.15, 0.065), algae * (1.0 - smoothstep(0.3, 1.2, cgP.y - 0.3)) * 0.55);\n      diffuseColor.rgb = c;\n    "
	});
}
function Sn() {
	return gn({
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
function Cn() {
	return gn({
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
function wn(t, n, r) {
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
//#region ../scripts/lingyin_pagoda.js
var Tn = Object.freeze({
	x: -31,
	z: 33,
	segments: 8,
	baseH: .7,
	baseTop: 3.1,
	baseBottom: 3.4,
	tiers: 5,
	initialRadius: 2.1
});
function En() {
	let e = Tn.baseH, t = Tn.initialRadius;
	return Array.from({ length: Tn.tiers }, (n, r) => {
		let i = 2.25 - r * .1, a = {
			index: r,
			base: e,
			radius: t,
			height: i
		};
		return e += i + .5, t *= .87, a;
	});
}
//#endregion
//#region ../scripts/lingyin_main_hall.js?v=grand-portal-1
var Dn = Object.freeze({
	name: "main",
	x: -2,
	z: -26,
	w: 31.5,
	d: 24,
	eave: 12,
	plinth: 2.1,
	rot: 0
});
Dn.plinth + .25;
var On = Object.freeze({
	count: 12,
	width: 7.2,
	treadDepth: .42,
	treadHeight: .16,
	frontGap: 1.42,
	railWidth: .32,
	railHeight: .72
}), kn = Object.freeze({
	halfClear: On.width / 2,
	jambWidth: .34,
	leafThickness: .22,
	leafDepth: On.width / 2,
	clearHeight: 5.95,
	flankX: 6.76,
	wallZ: Dn.d / 2 - 1.35
});
kn.halfClear + kn.jambWidth, Object.freeze({
	x: Dn.w / 27,
	z: Dn.d / 17
});
var An = Object.freeze({
	halfPost: .205,
	postTop: 1.09,
	postShoulder: .89,
	capWidth: .3,
	capTop: .74,
	postSteps: Object.freeze([
		0,
		4,
		8,
		11
	]),
	landingBays: 5,
	landingZ: Dn.d / 2 + 1.05,
	endX: Dn.w / 2 + 1
});
On.width / 2 + An.halfPost;
//#endregion
//#region ../scripts/lingyin_columns.js
var jn = [
	[-9.25, -4.75],
	[9.25, -4.75],
	[-9.25, -2],
	[9.25, -2],
	[-9.25, .5],
	[9.25, .5]
], Mn = [
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
], V = Object.freeze({
	w: 4.74,
	d: .82,
	top: .64,
	z: -1.51,
	legX: 2.13,
	legZ: .29
}), Nn = Object.freeze({
	z: -3.02,
	d: 1.06,
	wingX: 4.67,
	wingW: 4.64,
	wingTop: .86,
	centreTop: .71
}), Pn = {
	x: 0,
	z: V.z,
	scale: .4,
	baseY: V.top - .065 * .4
}, Fn = {
	x: 7.58,
	z: -3.74,
	profile: [
		[.32, .6],
		[.44, .74],
		[.38, .87],
		[.29, 1.07],
		[.34, 1.16],
		[.135, 4.23],
		[.22, 4.34],
		[.09, 4.45],
		[0, 4.66]
	]
}, In = [
	[.43, 0],
	[.72, .14],
	[.92, .48],
	[1.02, .78],
	[.92, .86],
	[.74, .77],
	[.66, .52],
	[.3, .47]
], H = Object.freeze({
	pitch: 5.3,
	scale: 1.27,
	statueZ: -5.1,
	seatY: 1.115,
	frontZ: -4.17,
	backZ: -6.46,
	postWidth: .2,
	sillY: .62,
	corniceY: 7.89
}), U = H, Ln = [
	{
		name: "backscreen",
		role: "darkWood",
		w: 18.65,
		h: 7.82,
		d: .22,
		x: 0,
		y: 3.89,
		z: -6.67,
		support: !1
	},
	{
		name: "dais-lower",
		role: "darkWood",
		w: 18.3,
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
		w: 17.6,
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
		w: V.w,
		h: .08,
		d: V.d,
		x: 0,
		y: V.top - .04,
		z: V.z,
		support: !0
	},
	{
		name: "altar-apron",
		role: "darkWood",
		w: 2 * V.legX,
		h: .15,
		d: .08,
		x: 0,
		y: V.top - .155,
		z: V.z + V.legZ,
		support: !1
	},
	...[-1, 1].flatMap((e) => [-1, 1].map((t) => ({
		name: "altar-leg-" + e + "-" + t,
		role: "darkWood",
		w: .2,
		h: V.top - .08,
		d: .19,
		x: e * V.legX,
		y: (V.top - .08) / 2,
		z: V.z + t * V.legZ,
		support: !1
	}))),
	...[
		-1,
		0,
		1
	].map((e) => {
		let t = Nn, n = e ? t.wingTop : t.centreTop;
		return {
			name: "altar-stone-" + e,
			role: "darkWood",
			w: e ? t.wingW : 2 * t.wingX - t.wingW,
			h: n,
			d: t.d,
			x: e * t.wingX,
			y: n / 2,
			z: t.z,
			support: !0
		};
	}),
	{
		name: "niche-soffit",
		role: "darkWood",
		w: 3 * U.pitch,
		h: .14,
		d: U.frontZ - U.backZ,
		x: 0,
		y: 7.75,
		z: (U.frontZ + U.backZ) / 2,
		support: !0
	},
	...[
		-1.5,
		-.5,
		.5,
		1.5
	].map((e, t) => ({
		name: `niche-return-${t}`,
		role: "darkWood",
		w: U.postWidth,
		h: U.corniceY - U.sillY,
		d: U.frontZ - U.backZ,
		x: e * U.pitch,
		y: (U.corniceY + U.sillY) / 2,
		z: (U.frontZ + U.backZ) / 2,
		support: !1
	})),
	...[
		-U.pitch,
		0,
		U.pitch
	].flatMap((e, t) => [{
		name: `statue-pad-${t}`,
		role: "darkWood",
		w: 4.7,
		h: .39,
		d: 2.63,
		x: e,
		y: .815,
		z: U.statueZ,
		support: !0
	}, {
		name: `statue-pad-cap-${t}`,
		role: "bronze",
		w: 4.58,
		h: .105,
		d: 2.54,
		x: e,
		y: 1.0625,
		z: U.statueZ,
		support: !0
	}])
], Rn = [
	{
		y: 0,
		r: .455
	},
	{
		y: .052,
		r: .455
	},
	{
		y: .082,
		r: .437
	},
	{
		y: .205,
		r: .416
	},
	{
		y: .242,
		r: .425
	},
	{
		y: .267,
		r: .406
	},
	{
		y: .298,
		r: .352
	}
];
function zn(e) {
	let t = [], n = e.w / 2, r = e.d / 2, i = Math.max(3, Math.round(e.w / 3.4)), a = Math.max(2, Math.round(e.d / 3.6)), o = e.eave - e.plinth - .35;
	for (let a of [-1, 1]) for (let s = 0; s <= i; s++) {
		let c = -n + 1 + (e.w - 2) * s / i;
		if (e.name === "main" && a === 1) {
			let e = kn.halfClear + .46, t = n - 1, r = Math.abs(s - i / 2) - .5;
			c = Math.sign(c) * (e + (t - e) * r / ((i - 1) / 2));
		}
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
//#region src/world/eave_rafters.js
function Bn(t, n, r) {
	let i = [], a = t / 2, o = n / 2, s = Math.round((t + 2) / .6);
	for (let n = 0; n <= s; n++) {
		let c = -a - .8 + (t + 1.6) * n / s;
		for (let t of [-1, 1]) {
			let n = new e.BoxGeometry(.1, .12, 1.2);
			n.rotateX(.12 * t), n.translate(c, r + .02, t * (o + .3)), i.push(n);
		}
	}
	let c = Math.round((n + 2) / .6);
	for (let t = 0; t <= c; t++) {
		let s = -o - .8 + (n + 1.6) * t / c;
		for (let t of [-1, 1]) {
			let n = new e.BoxGeometry(1.2, .12, .1);
			n.rotateZ(-.12 * t), n.translate(t * (a + .3), r + .02, s), i.push(n);
		}
	}
	return i;
}
//#endregion
//#region src/world/temple.ts
var Vn = class {
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
		mainWindow: [],
		flyingRafters: []
	};
	constructor(t = {}) {
		this.enrichedSmallHalls = t.enrichedSmallHalls === !0, this.group.name = t.onlyMainHall ? "temple-main-hall-only" : "temple";
		let n = F.platform.y;
		this.materials = {
			stone: ut(.2),
			floor: ct(),
			wall: xt(),
			paper: new e.MeshStandardMaterial({
				color: 12958628,
				map: ot(),
				bumpMap: ot(),
				bumpScale: .009,
				roughness: .96,
				metalness: 0,
				side: e.DoubleSide
			}),
			gatePlaster: xn(),
			wood: St(!1),
			woodDark: bn(1),
			dougong: Et(),
			roof: pt(),
			mainRoof: mt(),
			gateRoof: pt(),
			gold: Ct(),
			bronze: Tt(),
			lattice: St(!0),
			lantern: Ot(),
			window: Dt(),
			mainStone: gt(),
			mainWall: ht(),
			mainWood: _t(!1),
			mainWoodDark: _t(!0),
			mainDougong: yt(),
			mainLattice: _t(!0),
			mainWindow: bt(),
			flyingRafters: new e.MeshStandardMaterial({
				name: "main-hall-painted-flying-rafters",
				color: 5794656,
				roughness: .88,
				metalness: 0
			}),
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
			eave: (t.studyHallEave ?? 8) + 1,
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
		}), this.buildPagoda(Tn.x, Tn.z, n), this.buildEnclosure(n)), t.omitMainHallShrine || this.buildBuddha(n + 1), this.finalize();
	}
	add(e, t) {
		this.roles[e].push(t);
	}
	addAt(e, t, n, r, i, a = 0) {
		a && t.rotateY(a), t.translate(n, r, i), this.roles[e].push(t);
	}
	buildPlatform(e) {
		let t = F.platform;
		this.add("stone", L(2.2, .5, 1, t.x0, e - .05, 0, 0)), this.add("stone", L(2.2, .5, 1, t.x1, e - .05, 0, 0)), this.add("stone", L(t.x1 - t.x0 + 2.2, .5, 1.2, (t.x0 + t.x1) / 2, e - .05, t.z1)), this.add("stone", L(t.x1 - t.x0 + 2.2, .5, 1.2, (t.x0 + t.x1) / 2, e - .05, t.z0));
		for (let n = 0; n < 6; n++) this.add("stone", L(9 - n * .25, .19, .5, -2, e - .2 - n * .19, t.z1 + .6 + n * .48));
		for (let n = 0; n < 5; n++) this.add("stone", L(.55, .2, 5.2, t.x1 + .4 + n * .5, e - .2 - n * .2, 28));
	}
	balustrade(e, t, n, r, i, a = !1) {
		let o = Math.abs(t - e);
		if (o < 1) return;
		let s = Math.max(2, Math.round(o / 2.4));
		for (let a = 0; a <= s; a++) {
			let c = a / s, l = e + (t - e) * c, u = i === "x" ? l : n, d = i === "x" ? n : l;
			if (this.add("stone", L(.24, .95, .24, u, r + .475, d)), this.add("stone", L(.34, .12, .34, u, r + .98, d)), a < s) {
				let c = (a + .5) / s, l = e + (t - e) * c, u = i === "x" ? l : n, d = i === "x" ? n : l, f = i === "x" ? o / s : .14, p = i === "x" ? .14 : o / s;
				this.add("stone", L(f, .16, p, u, r + .74, d));
			}
		}
	}
	buildHall(t) {
		let n = t.name === "gate", r = +(t.name === "main"), i = t.plinth - r, a = t.eave - t.plinth, o = t.w / 2, s = t.d / 2, c = {
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
			mainWindow: [],
			flyingRafters: []
		}, l = !0, u = {
			stone: "mainStone",
			wall: "mainWall",
			wood: "mainWood",
			woodDark: "mainWoodDark",
			dougong: "mainDougong",
			lattice: "mainLattice",
			window: "mainWindow",
			roof: "mainRoof"
		}, d = (e) => l && t.name === "main" ? u[e] ?? e : e, f = (e, t) => c[d(e)].push(t), p = /* @__PURE__ */ new Set(), m = (e, t) => {
			c[d(e)].push(t), p.add(t);
		};
		m("stone", L(t.w + 2.4, t.plinth + .25, t.d + 2.4, 0, (t.plinth + .25) / 2, 0)), m("stone", L(t.w + 2.9, .16, t.d + 2.9, 0, .1, 0));
		let h = t.name === "main" ? w.count : 5;
		for (let e = 0; e < h; e++) t.name === "main" ? m("stone", $t(e)) : m("stone", L(5, .24 + e * .16, .42, 0, (.24 + e * .16) / 2, s + 1.35 + (4 - e) * .4 + (i - .8) * .25)), t.name === "gate" && m("stone", L(5, .24 + e * .16, .42, 0, (.24 + e * .16) / 2, -s - 1.35 - (4 - e) * .4));
		let g = a - .35;
		for (let n of zn(t)) if (this.column(c, n.x, .25, n.z, n.height, d), t.name === "main" && n.z === s - .9) {
			let r = Rn.map((t) => new e.Vector2(t.r, t.y));
			r.push(new e.Vector2(0, r[r.length - 1].y)), m("stone", new e.LatheGeometry(r, 32).translate(n.x, t.plinth + .25, n.z));
		}
		let _ = n ? 3.55 : g - .4, v = .3, y = .25 + _ / 2, b = 1.35, x = (e, t, n, r) => f("stone", L(e + .04, .22, t + .085, n, i + .3, r));
		if (t.openFront) {
			let e = o - 2.05;
			for (let t of [-1, 1]) f("wall", L(3.8, _, v, t * e, y, s - b)), x(3.8, v, t * e, s - b);
		} else {
			let e = t.name === "main" ? 2 * E : t.name === "rear" ? 4.6 : 3.4, n = (t.w - b * 2 - e) / 2;
			f("wall", L(n, _, v, -(e / 2 + n / 2), y, s - b)), f("wall", L(n, _, v, e / 2 + n / 2, y, s - b)), x(n, v, -(e / 2 + n / 2), s - b), x(n, v, e / 2 + n / 2, s - b), t.name === "main" && t.studyFacade || f("wood", L(e + .3, .35, v + .1, 0, .25 + _, s - b));
		}
		if (t.openFront || t.name === "west") {
			let e = t.name === "west" ? 3.4 : 4.6, n = (t.w - b * 2 - e) / 2;
			for (let t of [-1, 1]) f("wall", L(n, _, v, t * (e / 2 + n / 2), y, -s + b));
			for (let t of [-1, 1]) x(n, v, t * (e / 2 + n / 2), -s + b);
			f("wood", L(e + .3, .35, .42, 0, .25 + _, -s + b));
		} else f("wall", L(t.w - b * 2, _, v, 0, y, -s + b)), x(t.w - b * 2, v, 0, -s + b);
		for (let e of [-1, 1]) {
			f("wall", L(v, _, t.d - b * 2, e * (o - b), y, 0)), x(v, t.d - b * 2, e * (o - b), 0);
			let n = Math.min(1.7, _ * .5), r = Ve(Math.min(3.4, t.d * .32), n, .22, .05, .02);
			r.bars.rotateY(e * Math.PI / 2), r.backing.rotateY(e * Math.PI / 2), r.bars.translate(e * (o - b + .18), y + .15, 0), r.backing.translate(e * (o - b + .1), y + .15, 0), f("lattice", r.bars), f("window", r.backing);
		}
		if (!t.openFront) {
			let n = t.w > 20 ? 5 : 3, r = (t.w - 2.2) / n, i = Math.floor(n / 2), a = Array.from({ length: n }, (e, t) => t);
			for (let n of a) {
				let a = -o + 1.1 + r * (n + .5), c = r - .35, l = Math.min(_ - .55, 3.5);
				if (t.name === "main" && t.studyFacade) continue;
				if (n === i) {
					f("gold", L(.16, l, .2, a - c / 2 - .1, .25 + l / 2, s - b + .2)), f("gold", L(.16, l, .2, a + c / 2 + .1, .25 + l / 2, s - b + .2)), t.name === "main" && t.studyFacade || f("gold", L(c + .2, .18, .2, a, .25 + l + .12, s - b + .2));
					continue;
				}
				let u = Ve(c, l, .17, .055, s - b + .18);
				u.bars.translate(a, 0, 0), u.backing.translate(a, 0, 0), f("lattice", u.bars), f("woodDark", u.backing), f("wood", L(c + .18, .16, .24, a, .25 + l + .1, s - b + .18)), f("wood", L(.16, l + .2, .24, a - c / 2 - .09, .25 + l / 2, s - b + .18)), f("wood", L(.16, l + .2, .24, a + c / 2 + .09, .25 + l / 2, s - b + .18)), f("woodDark", L(c, l * .34, .1, a, .25 + l * .17, s - b + .1));
				for (let t = -2; t <= 2; t++) for (let n = 0; n < 2; n++) f("gold", new e.SphereGeometry(.035, 6, 4).translate(a + t * .62, 1 + n * .32, s - b + .06));
			}
		}
		if (t.name === "main") {
			let e = .45, n = t.w / 2 + 1.2, r = t.d / 2 + 1.45, i = en();
			i.position.set(t.x, F.platform.y, t.z), this.group.add(i);
			for (let t = 0; t <= 10; t++) {
				let i = -r + 2 * r * t / 10;
				for (let t of [-1, 1]) f("stone", L(.24, .9, .24, t * n, e + .45, i)), f("stone", L(.26, .1, .26, t * n, e + .92, i));
			}
			for (let t of [-1, 1]) f("stone", L(.16, .16, 2 * r, t * n, e + .8, 0));
		}
		if (l = !1, !(this.enrichedSmallHalls && [
			"west",
			"east",
			"rear"
		].includes(t.name ?? ""))) {
			let r = t.w - b * 2 - .55, c = t.d - b * 2 - .55, l = i + .25, u = 1.35, d = Math.floor(r / u), p = Math.floor(c / u);
			for (let e = 0; e < p; e++) for (let t = 0; t < d; t++) {
				let n = -r / 2 + (t + .5) * r / d, i = -c / 2 + (e + .5) * c / p, a = (t * 11 + e * 7) % 7 * .002;
				f("floor", lt(L(r / d - .018, .045, c / p - .018, n, l + .005 + a, i), .82 + (t * 13 + e * 7) % 11 * .022));
			}
			for (let e of [-1, 1]) {
				f("woodDark", L(.11, .44, c, e * r / 2, l + .22, 0)), f("bronze", L(.025, .035, c, e * r / 2, l + .45, 0));
				for (let t of [-c * .24, c * .24]) {
					let n = Ve(Math.min(2.5, c * .32), 2.1, .26, .055, 0);
					n.bars.rotateY(Math.PI / 2), n.backing.rotateY(Math.PI / 2), n.bars.translate(e * (o - b - .23), l + .77, t), n.backing.translate(e * (o - b - .27), l + .77, t), f("lattice", n.bars), f("paper", n.backing);
				}
			}
			for (let e of [-c / 2, c / 2]) if (e > 0 || t.name === "gate" || t.name === "west") {
				let n = t.name === "main" ? 2 * E : t.name === "rear" || t.name === "gate" ? 4.6 : 3.4, i = (r - n) / 2;
				for (let t of [-1, 1]) {
					let r = t * (n / 2 + i / 2);
					f("woodDark", L(i, .44, .11, r, l + .22, e)), f("bronze", L(i, .035, .025, r, l + .45, e));
				}
			} else f("woodDark", L(r, .44, .11, 0, l + .22, e)), f("bronze", L(r, .035, .025, 0, l + .45, e));
			let m = Math.max(l + 2.9, a - .35), h = !n && !(t.name === "main" && t.studyFacade);
			for (let e = 0; h && e < Math.max(2, Math.floor(c / 3.4)); e++) {
				let t = -c / 2 + (e + .5) * c / Math.max(2, Math.floor(c / 3.4));
				f("wood", L(r + .2, .2, .24, 0, m, t));
				for (let e of [-r / 3, r / 3]) f("dougong", L(.4, .32, .4, e, m - .25, t));
			}
			if (t.name !== "gate" && t.name !== "main" && t.name !== "west") {
				let t = -s + 2.7, n = Math.min(5.5, r * .62);
				f("woodDark", L(n, .16, 1.22, 0, l + .93, t)), f("bronze", L(n + .12, .07, 1.3, 0, l + 1.04, t)), f("woodDark", L(n - .35, .13, 1.05, 0, l + .26, t));
				for (let e of [-1, 1]) for (let r of [-1, 1]) {
					let i = e * (n / 2 - .24), a = t + r * .42;
					f("wood", L(.22, .78, .22, i, l + .45, a)), f("bronze", L(.24, .06, .24, i, l + .83, a));
				}
				f("gold", L(n - .4, .055, .055, 0, l + .73, t + .59)), f("wood", L(n + .3, 2.7, .22, 0, l + 2.35, t - .72)), f("gold", R(.5, .58, .13, 20, 0, l + 1.2, t)), f("gold", R(.34, .51, .63, 20, 0, l + 1.58, t)), f("gold", new e.SphereGeometry(.29, 18, 14).translate(0, l + 2.03, t)), f("gold", new e.TorusGeometry(.44, .045, 8, 28).translate(0, l + 1.99, t - .24));
				for (let r of [-1, 1]) f("bronze", R(.085, .11, .55, 10, r * Math.min(1.75, n * .32), l + 1.24, t + .1)), f("lantern", new e.SphereGeometry(.12, 10, 8).translate(r * Math.min(1.75, n * .32), l + 1.56, t + .1));
				for (let e of [-1, 1]) {
					let r = e * n * .34;
					f("bronze", R(.14, .22, .28, 12, r, l + 1.2, t + .3));
					for (let e = 0; e < 3; e++) f("woodDark", R(.012, .015, .55 + e * .08, 6, r + (e - 1) * .045, l + 1.56, t + .3));
				}
			}
		}
		if (l = !0, !n) {
			f("wood", L(t.w + .4, .42, .42, 0, a - .2, s - .9)), f("wood", L(t.w + .4, .42, .42, 0, a - .2, -s + .9));
			for (let e of [-1, 1]) f("wood", L(.42, .42, t.d - 1.6, e * (o - .9), a - .2, 0));
			f("wood", L(t.w + 1.4, .34, .7, 0, a + .05, s - .3)), f("wood", L(t.w + 1.4, .34, .7, 0, a + .05, -s + .3));
			let n = this.dougongCluster(), r = Math.max(3, Math.round(t.w / 2.3));
			for (let e = 0; e <= r; e++) {
				let i = -o + .9 + (t.w - 1.8) * e / r;
				for (let e of [-1, 1]) {
					let t = n.clone();
					t.translate(i, a - .05, e * (s - .75)), f("dougong", t);
				}
			}
			let i = Math.max(2, Math.round(t.d / 2.5));
			for (let e = 1; e < i; e++) {
				let r = -s + .9 + (t.d - 1.8) * e / i;
				for (let e of [-1, 1]) {
					let t = n.clone();
					t.rotateY(Math.PI / 2), t.translate(e * (o - .75), a - .05, r), f("dougong", t);
				}
			}
			for (let e of Bn(t.w, t.d, a)) f("wood", e);
			let c = Math.max(2, Math.round(t.w / 6));
			for (let n = 0; n <= c; n++) {
				let r = -o + 1.4 + (t.w - 2.8) * n / c, i = a - 1.05, l = s + .15, u = new e.SphereGeometry(.17, 10, 8);
				u.scale(1, 1.18, 1), u.translate(r, i, l), f("lantern", u), f("gold", R(.09, .09, .08, 8, r, i + .3, l)), f("gold", R(.09, .09, .08, 8, r, i - .3, l)), f("gold", R(.012, .012, .55, 4, r, i + .6, l));
			}
		}
		if (n) {
			let e = 9.1, n = a + .16;
			f("gateRoof", Re({
				w: e,
				d: t.d,
				eaveY: n,
				rise: 3.05,
				cornerLift: .88,
				overhang: 1.25,
				nu: 34,
				nv: 14
			})), this.ridgeAndTips(c, e, t.d, n + 3.05, n), f("wood", L(8.9, .14, t.d + .35, 0, a - .1, 0));
			for (let e of [
				-3.45,
				-1.72,
				0,
				1.72,
				3.45
			]) f("woodDark", L(8.9, .2, .24, 0, a - .28, e));
			for (let e of [-3.65, 3.65]) f("woodDark", L(.22, .2, t.d + .35, e, a - .28, 0));
			f("woodDark", L(8.9, 2.1, .32, 0, a - 1.07, -s + 1.35));
			for (let e of [-1, 1]) {
				let n = Re({
					w: 5.6,
					d: t.d,
					eaveY: 3.84,
					rise: 1.45,
					cornerLift: .52,
					overhang: 1.1,
					nu: 24,
					nv: 11
				});
				n.translate(e * 5.15, 0, 0), f("gateRoof", n), f("woodDark", L(6.1, .28, .42, e * 5.15, 3.62, s - .25)), f("woodDark", L(6.1, .28, .42, e * 5.15, 3.62, -s + .25));
			}
			for (let e of [-1, 1]) {
				for (let t of [-s + .82, s - .82]) f("woodDark", L(.62, a - .35, .7, e * 3.22, (a - .35) / 2 + .25, t));
				f("dougong", L(1.22, .29, 1.55, e * 3.22, a - .25, s - .25));
			}
			f("woodDark", L(8.9, .7, .7, 0, a - .63, s - .35)), f("wood", L(9.5, .3, .62, 0, a + .02, s - .3)), f("wood", L(9.5, .3, .62, 0, a + .02, -s + .3)), f("bronze", L(8.75, .05, .75, 0, a - .27, s - .35));
		} else if (t.double) {
			let e = t.name === "main" ? "mainRoof" : "roof";
			if (t.studyFacade) {
				let n = fn(t.w, t.d, a, t.rise);
				for (let t of n.tiles) f(e, t);
				for (let e of n.timber) f("woodDark", e);
				for (let e of n.rafters) f("flyingRafters", e);
			} else f(e, ze({
				wOuter: t.w + 3.4,
				dOuter: t.d + 3.4,
				wInner: t.w - 1.2,
				dInner: t.d - 1.2,
				eaveY: a + .1,
				rise: 1.15,
				cornerLift: .55,
				nu: 34,
				nv: 8
			}));
			let n = a + 3;
			f("wall", L(t.w - 2.2, 3, t.d - 2.2, 0, a + 1.5, 0));
			for (let e = 0; e <= 12; e++) f("wood", L(.1, .7, .1, -o + 1.2 + (t.w - 2.4) * e / 12, a + .55, s - 1.05));
			f("wood", L(t.w - 2.4, .12, .14, 0, a + .9, s - 1.05));
			for (let e = 0; e < 5; e++) {
				let n = -o + 1.6 + (t.w - 3.2) * (e + .5) / 5, r = Ve((t.w - 3.2) / 5 - .25, 1.4, .24, .07, s - .95);
				r.bars.translate(n, a + 1.55, 0), r.backing.translate(n, a + 1.55, 0), f("lattice", r.bars), f("window", r.backing);
				for (let e = 0; e <= 4; e++) f("wood", L(.08, 1.4, .12, n - (t.w - 3.2) / 10 + e * ((t.w - 3.2) / 20), a + 1.55 + .7, s - .88));
			}
			f("wood", L(t.w + .6, .35, .5, 0, n, s - .7)), f("wood", L(t.w + .6, .35, .5, 0, n, -s + .7)), t.studyFacade || (f(e, Re({
				w: t.w - 1.4,
				d: t.d - 1.4,
				eaveY: n + .2,
				rise: t.rise + .4,
				cornerLift: .95,
				overhang: 1.45,
				nu: 38,
				nv: 16
			})), this.ridgeAndTips(c, t.w - 1.4, t.d - 1.4, n + .2 + t.rise + .4, n + .2, e));
		} else f("roof", Re({
			w: t.w,
			d: t.d,
			eaveY: a + .15,
			rise: t.rise,
			cornerLift: .9,
			overhang: 1.25,
			nu: 36,
			nv: 15
		})), this.ridgeAndTips(c, t.w, t.d, a + .15 + t.rise, a + .15);
		if (n) for (let t of [
			{
				x: 0,
				half: 5.75,
				y: a + .12,
				z: s + 1.25
			},
			{
				x: -5.15,
				half: 3.9,
				y: 3.81,
				z: s + 1.1
			},
			{
				x: 5.15,
				half: 3.9,
				y: 3.81,
				z: s + 1.1
			}
		]) {
			let n = Math.round(t.half * 2 / .32);
			for (let r = 0; r <= n; r++) {
				let i = t.x - t.half + 2 * t.half * r / n, a = new e.CylinderGeometry(.065, .065, .075, 8);
				a.rotateX(Math.PI / 2), a.translate(i, t.y, t.z), f("gateRoof", a);
			}
		}
		else if (!t.studyFacade) {
			let n = t.double ? a + 2.1 : a + .15, r = t.w / 2 + 1.1, i = Math.round(r * 2 / .34);
			for (let a = 0; a <= i; a++) {
				let o = -r + 2 * r * a / i;
				for (let r of [-1, 1]) {
					let i = new e.CylinderGeometry(.075, .075, .05, 8);
					i.rotateX(Math.PI / 2), i.translate(o, n - .06, r * (t.d / 2 + 1.1)), f("roof", i);
				}
			}
		}
		for (let t of n ? [] : [-1, 1]) for (let n of [-1, 1]) {
			let r = 1.15;
			f("bronze", R(.14, .2, .5, 8, t * (o + r), a - .55, n * (s + r))), f("bronze", new e.SphereGeometry(.09, 8, 6).translate(t * (o + r), a - .85, n * (s + r)));
		}
		if (n) {
			for (let e of [-1, 1]) {
				let t = e * (o - 2.2), n = s - b + .23;
				f("gatePlaster", L(2.42, 2.57, .045, t, 2.02, n - .08));
				let r = Ve(1.64, 1.67, .21, .065, n + .05);
				r.bars.translate(t, 1.25, 0), r.backing.translate(t, 1.25, 0), f("lattice", r.bars), f("woodDark", r.backing);
				for (let e of [-1.23, 1.23]) f("woodDark", L(.13, 2.72, .16, t + e, 1.98, n + .025));
				for (let e of [.63, 3.34]) f("woodDark", L(2.58, .13, .16, t, e, n + .025));
			}
			f("woodDark", L(8.9, .5, .22, 0, a - 1.06, s + .3));
		}
		if (t.plaque) {
			let n = t.name === "gate" || t.name === "main" ? et(t.name) : void 0, i = n ?? He(t.plaque, 512, 150, {
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
			}), c = t.name === "main" && t.studyFacade, l = t.name === "gate" ? 1.18 : 1.45, u = c ? a + 2.03 : .25 + Math.min(_ - .55, 3.5) + l, d = c ? s - .71 : s + (t.name === "gate" ? .62 : -.35), p = c ? 5.5 : 4.2, m = c ? 1.52 : 1.2, h = new e.Mesh(new e.PlaneGeometry(p, m), o);
			if (h.position.set(t.x, F.platform.y + u + r, t.z + d), h.castShadow = !1, h.name = `plaque-${t.name}`, this.group.add(h), c) {
				f("woodDark", L(p + .36, m + .3, .17, 0, u, d - .16));
				for (let e of [-1, 1]) f("gold", L(p + .34, .055, .05, 0, u + e * (m / 2 + .11), d - .055)), f("gold", L(.055, m + .22, .05, e * (p / 2 + .12), u, d - .055));
			} else f("gold", L(4.5, 1.45, .16, 0, u, s + (t.name === "gate" ? .48 : -.48)));
		}
		let S = t.rotY ?? 0, C = Math.cos(S), T = Math.sin(S);
		for (let e of Object.keys(c)) for (let n of c[e]) r && !p.has(n) && n.translate(0, r, 0), S && n.rotateY(S), n.translate(t.x, F.platform.y, t.z), this.roles[e].push(n);
		let D = this.enrichedSmallHalls && [
			"west",
			"east",
			"rear"
		].includes(t.name ?? ""), O = new e.PointLight(D ? 16768432 : 16758647, t.name === "main" ? 6 : n ? 4.4 : D ? t.name === "rear" ? 14 : 10 : 2.8, t.name === "main" ? 18 : n ? 12 : D ? 13 : 10, 2);
		O.name = `temple-${t.name}-existing-room-light`, O.position.set(t.x, F.platform.y + (n ? 4.1 : D ? a - .88 : Math.max(3.2, t.plinth + 2.3)), t.z), this.group.add(O), this.anchors.eaves.push(new e.Vector3(t.x + T * (s + 1), F.platform.y + a + r, t.z + C * (s + 1))), t.name === "main" && this.anchors.door.set(t.x, F.platform.y + 1.6 + r, t.z + s + 1.5);
	}
	column(e, t, n, r, i, a = (e) => e) {
		e[a("stone")].push(R(.4, .46, .24, 10, t, n + .06, r)), e[a("wood")].push(R(.27, .33, i - .24, 12, t, n + .24 + (i - .24) / 2, r)), e.gold.push(R(.31, .31, .08, 12, t, n + i - .16, r)), e.bronze.push(R(.33, .33, .05, 12, t, n + .36, r));
	}
	dougongCluster() {
		let e = [];
		return e.push(L(.42, .36, .42, 0, .18, 0)), e.push(L(1.5, .2, .3, 0, .46, 0)), e.push(L(.3, .2, 1.1, 0, .46, .2)), e.push(L(.46, .22, .46, -.45, .67, 0)), e.push(L(.46, .22, .46, 0, .67, 0)), e.push(L(.46, .22, .46, .45, .67, 0)), e.push(L(.22, .2, .9, 0, .67, 0)), z(e);
	}
	ridgeAndTips(t, n, r, i, a, o = "roof") {
		let s = n * .52 / 2;
		t[o].push(L(s * 2 + .6, .42, .42, 0, i + .18, 0));
		for (let e of [-1, 1]) {
			t[o].push(L(.34, 1.15, .4, e * (s + .35), i + .55, 0));
			let n = L(.28, .9, .34, e * (s + .55), i + 1.05, .1);
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
			let i = R(.05, .2, 1.15, 6, 0, 0, 0);
			i.rotateZ(-n * .55), i.rotateX(r * .3), i.translate(n * u, a + .45, r * d), t[o].push(i), t.gold.push(new e.SphereGeometry(.11, 8, 6).translate(n * u, a + .95, r * d));
		}
	}
	buildPagoda(t, n, r) {
		this.addAt("stone", R(Tn.baseTop, Tn.baseBottom, Tn.baseH, 8), t, r + Tn.baseH / 2, n), this.addAt("stone", R(3.12, 3.18, .12, 8), t, r + .63, n);
		let i = r + Tn.baseH;
		for (let e of En()) {
			let a = r + e.base, o = e.radius, s = e.height;
			this.addAt("stone", R(o - .12, o, s, 8), t, a + s / 2, n);
			let c = (o - .08) * Math.cos(Math.PI / 8);
			for (let e = 0; e < 8; e++) {
				let r = (e + .5) * Math.PI / 4, i = L(.52, s * .44, .025, 0, 0, 0);
				i.rotateY(r), i.translate(t + Math.sin(r) * c, a + s * .46, n + Math.cos(r) * c), this.add("dark", i);
				for (let e of [-1, 1]) {
					let i = L(.055, s * .48, .045, e * .31, 0, 0);
					i.rotateY(r), i.translate(t + Math.sin(r) * (c + .012), a + s * .46, n + Math.cos(r) * (c + .012)), this.add("stone", i);
				}
			}
			this.addAt("stone", R(o + .85, o + .2, .36, 8), t, a + s + .18, n), this.addAt("stone", R(o + .1, o + .1, .16, 8), t, a + s + .42, n), i = a + s + .5;
		}
		this.addAt("gold", R(.12, .3, 1.6, 8), t, i + .8, n);
		for (let r = 0; r < 4; r++) this.addAt("gold", new e.SphereGeometry(.22 - r * .03, 10, 8), t, i + .4 + r * .3, n);
		this.addAt("gold", new e.SphereGeometry(.16, 8, 6), t, i + 1.7, n);
	}
	buildEnclosure(t) {
		let n = F.platform, r = (n, r, i, a) => {
			let o = i - n, s = a - r, c = Math.hypot(o, s), l = (n + i) / 2, u = (r + a) / 2, d = Math.atan2(o, s), f = Math.cos(d), p = -Math.sin(d), m = -.02, h = 1.11, g = 1.03, _ = 3.33;
			this.add("stone", L(.86, h - m, c + .25, l, t + (m + h) / 2, u, d)), this.add("gatePlaster", L(.34, _ - g, c - .08, l, t + (g + _) / 2, u, d)), this.add("woodDark", L(.5, .18, c + .22, l, t + _ + .015, u, d));
			for (let n of [-1, 1]) {
				this.add("woodDark", L(.1, .16, c + .48, l + n * f * .88, t + _ + .06, u + n * p * .88, d));
				let r = new e.BoxGeometry(.95, .1, c + .5);
				r.rotateZ(n * .34), r.rotateY(d), r.translate(l + f * n * .38, t + _ + .2, u + p * n * .38), this.add("dark", r);
			}
			this.add("dark", L(.18, .14, c + .52, l, t + _ + .36, u, d));
			let v = Math.max(2, Math.ceil(c / 6.4));
			for (let e = 0; e <= v; e++) {
				let i = e / v;
				this.add("woodDark", L(.46, _ - g + .12, .46, n + o * i, t + (g + _) / 2, r + s * i, d));
			}
		};
		r(n.x0 + .5, n.z0 + 1, n.x0 + .5, 3.8), r(n.x0 + .5, 10.2, n.x0 + .5, n.z1 - 1);
		for (let e of [3.8, 10.2]) this.add("stone", L(.75, 3.7, .75, n.x0 + .5, t + 1.85, e));
		this.add("roof", L(1.25, .35, 7.1, n.x0 + .5, t + 4, 7)), this.add("wood", L(.22, .4, 2, n.x0 + .05, t + 3.45, 7));
		let i = new e.Mesh(new e.PlaneGeometry(1.76, .34), new e.MeshStandardMaterial({
			map: He("西山道", 512, 128, {
				bg: "#302923",
				fg: "#d4b674",
				border: "#8f7755"
			}),
			roughness: .88,
			side: e.DoubleSide
		}));
		i.rotation.y = Math.PI / 2, i.position.set(n.x0 + .2, t + 3.45, 7), this.group.add(i), this.add("stone", L(4.25, .95, 3.2, -34.25, t + .475, 7)), this.add("floor", lt(L(4.3, .06, 3.25, -34.25, t + .98, 7), .92)), this.balustrade(4.1, 9.9, n.x0 + .5, t + .98, "z"), r(n.x0 + .5, n.z0 + 1, n.x1 - .5, n.z0 + 1), r(n.x1 - .5, n.z0 + 1, n.x1 - .5, 23), r(n.x1 - .5, 33, n.x1 - .5, n.z1 - 1), this.add("wood", L(.4, 3.2, 1, n.x1 - .5, t + 2, 23.4)), this.add("wood", L(.4, 3.2, 1, n.x1 - .5, t + 2, 32.6)), this.add("roof", L(1.9, .3, 10.4, n.x1 - .5, t + 3.75, 28));
		for (let r of [-1, 1]) {
			let i = 28 + r * 4.58, a = n.x1 + 1.68;
			this.add("wood", L(4.38, 2.72, .22, a, t + 1.71, i));
			for (let e of [-1.98, 1.98]) this.add("bronze", L(.13, 2.8, .3, a + e, t + 1.71, i));
			for (let e of [
				.64,
				1.55,
				2.48
			]) this.add("bronze", L(4.25, .15, .3, a, t + e, i));
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
			let o = R(.09, .09, .055, 8, a - 1.62, t + 1.55, i - .16);
			o.rotateX(Math.PI / 2), this.add("bronze", o);
		}
		let a = [
			.34,
			.52,
			.66,
			.52,
			.34
		];
		for (let e = 0; e < a.length; e++) this.add("stone", L(2.55, .28, 8.2, 30.9 + e * 2.55, t + a[e] - .14, 28));
		for (let e = 0; e < 3; e++) {
			let n = .11 + e * .11;
			this.add("stone", L(.72, .18, 8.2, 28.38 + e * .72, t + n - .09, 28));
		}
		for (let e of [24.05, 31.95]) {
			for (let n = 0; n < a.length; n++) {
				let r = 30.9 + n * 2.55, i = t + a[n];
				this.add("stone", L(2.58, .17, .22, r, i + .93, e));
			}
			for (let n = 0; n <= 10; n++) {
				let r = n / 10, i = Math.min(4, Math.floor(r * 5));
				this.add("stone", L(.18, 1.02, .18, 29.2 + r * 14, t + a[i] + .48, e));
			}
		}
		for (let e of [31.3, 40.9]) this.add("stone", L(.78, 2.2, 7.8, e, t - .78, 28));
	}
	buildBuddha(t) {
		let n = S.x, r = S.z + 1.15, i = t + 1.1;
		this.add("bronze", R(1.58, 1.72, .18, 36).translate(n, i + .09, r)), this.add("bronze", R(1.43, 1.55, .38, 36).translate(n, i + .37, r)), this.add("gold", R(1.48, 1.52, .055, 36).translate(n, i + .19, r)), this.add("gold", R(1.34, 1.4, .07, 36).translate(n, i + .57, r)), this.add("bronze", R(1.17, 1.3, .15, 36).translate(n, i + .67, r));
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
			let r = z(n), i = {
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
			}, a = i[t] ? B(r, i[t]) : r, o = {
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
			o[t] && (wn(a, o[t], o[t] === "plaster" ? void 0 : F.platform.y), this.materials[t].vertexColors = !0);
			let s = new e.Mesh(a, this.materials[t]);
			s.name = `temple-${t}`, s.castShadow = t === "stone" || t === "wall" || t === "gatePlaster" || t === "roof" || t === "mainRoof" || t === "wood" || t === "woodDark" || t === "dark" || t === "dougong" || t === "bronze" || t === "mainStone" || t === "mainWall" || t === "mainWood" || t === "mainWoodDark" || t === "mainDougong", s.receiveShadow = !0, this.group.add(s), n.length = 0;
		}
		this.group.traverse((t) => {
			t instanceof e.Mesh && t.name.startsWith("plaque") && (t.castShadow = !1);
		});
	}
};
//#endregion
//#region src/world/main_hall_brackets.ts
function Hn(t) {
	let n = document.createElement("canvas");
	n.width = 1024, n.height = 256;
	let r = n.getContext("2d");
	r.fillStyle = "#214c58", r.fillRect(0, 0, 1024, 256), r.lineJoin = "round", r.lineCap = "round";
	function i(e, t) {
		r.fillStyle = t, r.fill(e), r.strokeStyle = "#173c47", r.lineWidth = 10, r.stroke(e), r.strokeStyle = "#ccad69", r.lineWidth = 3, r.stroke(e);
	}
	for (let e of [0, 230]) r.fillStyle = "#406d65", r.fillRect(0, e, 1024, 26), r.fillStyle = "#ac8f58", r.fillRect(0, e + 5, 1024, 3), r.fillRect(0, e + 19, 1024, 2);
	let a = new Path2D("M0 0 C14 -28 36 -32 52 -19 C38 -15 23 1 0 0 Z");
	for (let e of [1, -1]) {
		r.save(), e < 0 && (r.translate(1024, 0), r.scale(-1, 1)), i(new Path2D("M5 31 H247 C231 66 182 70 174 102 Q168 125 145 128 Q168 132 175 153 C181 184 229 191 247 225 H5 Z"), "#417e76"), i(new Path2D("M92 128 C64 98 47 112 53 124 C36 108 44 75 73 79 C97 54 131 70 130 92 C150 89 162 103 152 115 C148 97 127 104 118 117 C108 133 90 142 73 134 Q82 134 92 128 Z"), "#7eaea0"), r.strokeStyle = "#85aaa2", r.lineWidth = 5, r.stroke(new Path2D("M200 144 C238 105 250 101 284 139 S349 155 386 105"));
		for (let [e, t, n] of [
			[
				223,
				123,
				-.3
			],
			[
				274,
				131,
				-.88
			],
			[
				315,
				151,
				-.2
			],
			[
				355,
				134,
				-.5
			]
		]) r.save(), r.translate(e, t), r.rotate(n), i(a, "#558c78"), r.restore();
		r.restore();
	}
	i(new Path2D("M375 128 Q400 117 409 86 Q453 92 476 62 Q512 79 548 62 Q571 92 615 86 Q624 117 649 128 Q624 139 615 170 Q571 164 548 194 Q512 177 476 194 Q453 164 409 170 Q400 139 375 128 Z"), "#386879"), r.save(), r.translate(512, 128);
	for (let e = 0; e < 8; e++) r.rotate(Math.PI / 4), i(new Path2D("M0 7 C-15 -4 -13 -24 0 -38 C13 -24 15 -4 0 7 Z"), e % 2 ? "#809d84" : "#bc9a66");
	r.fillStyle = "#975b44", r.beginPath(), r.arc(0, 0, 10, 0, Math.PI * 2), r.fill(), r.restore();
	let o = t.image;
	r.save(), r.globalCompositeOperation = "soft-light", r.globalAlpha = .62, r.drawImage(o, 0, 0, 1024, 256), r.restore();
	for (let e of [1, -1]) r.save(), e < 0 && (r.translate(1024, 0), r.scale(-1, 1)), r.clip(new Path2D("M20 40 H228 Q211 64 176 83 Q161 123 136 128 Q168 149 178 176 Q204 194 229 217 H20 Z")), r.globalAlpha = .59, r.drawImage(o, 70, 164, 570, 396, 16, 36, 214, 185), r.restore();
	r.save(), r.clip(new Path2D("M377 128 Q403 116 413 90 Q455 95 478 68 Q512 85 546 68 Q568 94 610 90 Q623 118 646 128 Q624 142 611 166 Q566 161 546 188 Q512 172 478 188 Q454 160 413 165 Q401 139 377 128 Z")), r.globalAlpha = .86, r.drawImage(o, 853, 156, 476, 403, 392, 59, 240, 138), r.restore();
	let s = 85161, c = () => (s = Math.imul(s, 1664525) + 1013904223 >>> 0) / 4294967296;
	for (let e = 0; e < 6800; e++) r.fillStyle = e % 3 ? "rgba(228,207,159,.058)" : "rgba(33,28,25,.11)", r.fillRect(c() * 1024, c() * 256, 2 + c() * 10, .5 + c() * 1.35);
	let l = new e.CanvasTexture(n);
	return l.name = "main-hall-porch-mineral-paint", l.colorSpace = e.SRGBColorSpace, l.wrapS = e.RepeatWrapping, l.anisotropy = 8, l;
}
function Un(t, n, r, i) {
	let a = [], o = r - n, s = "#365970", c = "#4f796d", l = "#668d79", u = "#8d503d";
	function d(t, n) {
		let r = new e.Color(n), i = t.getAttribute("position"), o = t.getAttribute("normal"), s = new Float32Array(i.count * 3), c = t.getAttribute("uv");
		for (let e = 0; e < i.count; e++) {
			c.setXY(e, (i.getX(e) + i.getZ(e)) * .65, .014 + .004 * Math.sin(i.getY(e) * 18));
			let t = .95 + .04 * Math.abs(o.getX(e)) + .018 * Math.sin(i.getX(e) * 27 + i.getY(e) * 9);
			s.set([
				r.r * t,
				r.g * t,
				r.b * t
			], e * 3);
		}
		t.setAttribute("color", new e.BufferAttribute(s, 3)), a.push(t);
	}
	function f(e, t, n, r, i, a, o) {
		d(L(r, i, a, e, t, n), o);
	}
	function p(t, n, r, i, a, o, s) {
		let c = new e.ExtrudeGeometry(t, {
			depth: n,
			bevelEnabled: !1,
			curveSegments: 5
		});
		c.translate(0, 0, -n / 2), c.rotateY(o), c.translate(r, i, a), d(c, s);
	}
	function m(t, n, r, i, a, o, s) {
		let c = new e.Shape();
		c.moveTo(-i, .21), c.lineTo(i, .21), c.lineTo(i, .08), c.quadraticCurveTo(i * .86, .08, i * .84, .01), c.quadraticCurveTo(i * .8, -.09, i * .55, -.07), c.quadraticCurveTo(i * .38, -.09, i * .32, -.17), c.lineTo(-i * .32, -.17), c.quadraticCurveTo(-i * .38, -.09, -i * .55, -.07), c.quadraticCurveTo(-i * .8, -.09, -i * .84, .01), c.quadraticCurveTo(-i * .86, .08, -i, .08), c.closePath(), p(c, a, t, n, r, o, s);
	}
	function h(t, n, r, i, a) {
		let o = new e.CylinderGeometry(1, .73, .14, 4).rotateY(Math.PI / 4).scale(i / Math.SQRT2, 1, a / Math.SQRT2);
		o.translate(t, n + .07, r), d(o, s), f(t, n + .162, r, i, .045, a, u), f(t, n + .22, r, i + .018, .076, a + .018, l);
	}
	function g(t, n) {
		let r = o - .13, i = o * .55;
		h(t, -.61, .12, .57, .66), m(t, -.22, i * .53, i * .64, .34, -Math.PI / 2, s), h(t, -.025, i, .45, .43), m(t, .38, i, n ? .62 : .91, .34, 0, c);
		let a = n ? .43 : .65;
		for (let e of [-1, 1]) {
			let n = t + e * a;
			h(n, .585, i, .33, .36), m(n, .96, (i + r) / 2, (r - i) / 2 + .19, .24, -Math.PI / 2, s), f(n, 1.185, r, .29, .1, .34, l), f(n, 1.245, r, .28, .025, .32, "#c4a16a");
		}
		let d = new e.Shape();
		d.moveTo(-.35, .18), d.lineTo(.32, .28), d.lineTo(.59, .095), d.lineTo(.51, -.032), d.lineTo(.12, .02), d.lineTo(-.35, .01), d.closePath(), p(d, .22, t, .49, r - .42, -Math.PI / 2, u), f(t, .61, r - .49, .25, .2, r - i + .38, c), m(t, 1.29, r, n ? .63 : .92, .31, 0, l);
	}
	for (let e = 0; e < t.length; e++) g(t[e], !1), e + 1 < t.length && g((t[e] + t[e + 1]) / 2, !0);
	let _ = new e.Mesh(z(a), new e.MeshStandardMaterial({
		name: "main-hall-porch-bracket-paint",
		vertexColors: !0,
		roughness: .88,
		metalness: 0,
		bumpMap: i,
		bumpScale: .003
	}));
	return _.name = "main-hall-porch-brackets", _.receiveShadow = !0, _.castShadow = !0, _;
}
//#endregion
//#region src/world/sanctum_atlas.ts
function Wn(t, n) {
	let r = document.createElement("canvas");
	r.width = 4096, r.height = 2048;
	let i = r.getContext("2d");
	i.drawImage(t.image, 0, 0, 4096, 2048);
	let a = 1024;
	function o(e, t) {
		i.save(), i.translate(e % 4 * a, Math.floor(e / 4) * a), i.beginPath(), i.rect(0, 0, a, a), i.clip(), t(), i.restore();
	}
	function s(e, t, n) {
		i.strokeStyle = n, i.lineWidth = t, i.stroke(e);
	}
	function c(e, t, n, r) {
		let a = new Path2D();
		a.moveTo(0, 0), a.bezierCurveTo(-t * .75, -e * .25, -t * .57, -e * .7, 0, -e), a.bezierCurveTo(t * .6, -e * .7, t * .72, -e * .23, 0, 0), a.closePath(), i.fillStyle = n, i.fill(a), s(a, 2, r), s(new Path2D(`M0 -2 Q${t * .12} ${-e * .5} 0 ${-e * .94}`), 1.6, r);
	}
	o(0, () => {
		i.fillStyle = "#713a29", i.fillRect(0, 0, a, a);
		for (let [e, t, n] of [
			[
				11,
				"#d9b47a",
				9
			],
			[
				29,
				"#647f70",
				14
			],
			[
				45,
				"#e3d0a0",
				4
			]
		]) i.strokeStyle = t, i.lineWidth = n, i.strokeRect(e, e, a - e * 2, a - e * 2);
		i.translate(512, 512), i.fillStyle = "#555441", i.beginPath(), i.arc(0, 0, 407, 0, Math.PI * 2), i.fill();
		for (let [e, t, n] of [
			[
				412,
				"#dbce9f",
				13
			],
			[
				389,
				"#a5ae8d",
				8
			],
			[
				373,
				"#5e7b71",
				13
			],
			[
				363,
				"#d4c39b",
				4
			]
		]) i.strokeStyle = t, i.lineWidth = n, i.beginPath(), i.arc(0, 0, e, 0, Math.PI * 2), i.stroke();
		for (let e = 0; e < 16; e++) {
			i.save(), i.rotate(e * Math.PI / 8), i.translate(0, -296), i.rotate(-e * .13);
			for (let e = 0; e < 5; e++) i.rotate(Math.PI * 2 / 5), c(57, 31, e % 2 ? "#d2cfb0" : "#9baea2", "#ebe0be");
			i.fillStyle = "#b78d55", i.beginPath(), i.arc(0, 0, 9, 0, Math.PI * 2), i.fill(), i.restore();
		}
		for (let e = 0; e < 8; e++) i.save(), i.rotate(e * Math.PI / 4), c(246, 104, "#75998d", "#dcd3ae"), i.translate(0, -143), i.rotate(Math.PI / 3), c(100, 42, "#a4bca8", "#f2deaa"), i.restore();
		for (let e = 0; e < 12; e++) i.save(), i.rotate(e * Math.PI / 6), c(137, 52, e % 2 ? "#d9c499" : "#a4a288", "#eee1be"), i.restore();
		i.fillStyle = "#a2784e", i.beginPath(), i.arc(0, 0, 31, 0, Math.PI * 2), i.fill();
		for (let e = 0; e < 24; e++) {
			let t = e * 2.399, n = 5 + Math.sqrt(e) * 4;
			i.fillStyle = "#d8bc86", i.beginPath(), i.arc(Math.cos(t) * n, Math.sin(t) * n, 2.2, 0, Math.PI * 2), i.fill();
		}
	}), o(1, () => {
		i.fillStyle = "#29282a", i.fillRect(0, 0, a, a), i.lineJoin = "miter";
		let e = new Path2D("M-2 32 H32 V0 H96 V32 H128 V96 H96 V128 H32 V96 H0 V64 H62 V34 H66 V94 H34 V66 H-2");
		for (let t = 0; t < 6; t++) for (let n = 0; n < 6; n++) i.save(), i.translate((n + .5) * a / 6, (t + .5) * a / 6), i.scale(a / 768, a / 768), (t + n) % 2 && i.rotate(Math.PI / 2), i.translate(-64, -64), s(e, 13, "#17181a"), s(e, 8, "#63615c"), i.translate(-1, -1.6), s(e, 2.6, "#a5a098"), i.restore();
	}), o(2, () => {
		i.fillStyle = "#2f2926", i.fillRect(0, 0, a, a);
		for (let e = 0; e < 6; e++) for (let t = 0; t < 6; t++) {
			i.save(), i.translate((t + .5) * a / 6, (e + .5) * a / 6);
			let n = new Path2D("M-64 69 V-12 A64 64 0 0 1 64 -12 V69 Z");
			i.fillStyle = "#181918", i.fill(n), s(n, 5, "#68543c");
			let r = i.createLinearGradient(-30, 0, 36, 0);
			r.addColorStop(0, "#79562f"), r.addColorStop(.45, "#c7a267"), r.addColorStop(1, "#755532"), i.fillStyle = r, i.beginPath(), i.ellipse(0, -28, 17, 22, 0, 0, Math.PI * 2), i.fill(), i.beginPath(), i.ellipse(0, 10, 29, 32, 0, 0, Math.PI * 2), i.fill(), i.beginPath(), i.ellipse(0, 36, 48, 19, 0, 0, Math.PI * 2), i.fill();
			for (let e = 0; e < 5; e++) i.strokeStyle = "#735330", i.lineWidth = 2, i.beginPath(), i.ellipse(0, 2 + e * 6, 14 + e * 2, 9, 0, 0, Math.PI), i.stroke();
			i.fillStyle = "#c1a273", i.fillRect(-51, 56, 102, 5), i.fillStyle = "#483a28", i.fillRect(-54, 62, 108, 9), i.restore();
		}
	}), o(3, () => {
		i.fillStyle = "#3e352b", i.fillRect(0, 0, a, a);
		for (let e = -1; e < 5; e++) for (let t = -1; t < 4; t++) {
			i.save(), i.translate(t * 340 + e % 2 * 170, e * 256 + 123);
			let n = new Path2D("M-170 128 C-30 102 -50 -70 45 -84 C119 -99 154 -3 93 26 C27 60 17 -23 70 -28");
			i.save(), i.translate(5, 6), s(n, 24, "#221e19"), i.restore(), s(n, 19, "#9d7a48"), s(n, 8, "#cfb380"), s(n, 2, "#ead4a6");
			for (let [e, t, n] of [
				[
					-44,
					18,
					-.9
				],
				[
					84,
					-55,
					1.7
				],
				[
					20,
					79,
					-2.3
				]
			]) i.save(), i.translate(e, t), i.rotate(n), c(112, 62, "#ac8c57", "#dfc696"), i.restore();
			i.translate(-92, -35);
			for (let e = 0; e < 8; e++) i.save(), i.rotate(e * Math.PI / 4), c(70, 31, "#bda170", "#eee0b7"), i.restore();
			i.fillStyle = "#836035", i.beginPath(), i.arc(0, 0, 12, 0, Math.PI * 2), i.fill(), i.restore();
		}
	}), o(4, () => {
		i.fillStyle = "#897d6c", i.fillRect(0, 0, a, a);
		let e = n.image;
		for (let t = 0; t < 3; t++) for (let n = -1; n < 3; n++) {
			let r = (n + t % 2 * .5) * 512, o = t * a / 3, s = (t * 117 + n * 83 + 251) % 320, c = (t * 91 + n * 37 + 178) % 240;
			i.drawImage(e, s, c, 640, 400, r + 2, o + 2, 509, a / 3 - 4), i.fillStyle = "rgba(244,236,216,.32)", i.fillRect(r + 2, o + 2, 509, 2);
		}
	});
	let l = 344982, u = () => (l = Math.imul(l, 1664525) + 1013904223 >>> 0) / 4294967296;
	for (let e = 0; e < 42e3; e++) i.fillStyle = e % 3 ? "rgba(243,223,180,.033)" : "rgba(22,24,21,.065)", i.fillRect(u() * 4096, u() * 1024, 1 + u() * 4, .7 + u() * 1.4);
	let d = new e.CanvasTexture(r);
	return d.name = "hall-authored-craft-4k", d.colorSpace = e.SRGBColorSpace, d.anisotropy = 8, d;
}
//#endregion
//#region src/world/main_hall_sanctum.ts
function Gn(t, n, r) {
	let i = document.createElement("canvas");
	i.width = 3072, i.height = 2304;
	let a = i.getContext("2d"), o = i.width / 36, s = i.height / 28, c = t.image;
	a.fillStyle = "#aaa195", a.fillRect(0, 0, i.width, i.height);
	for (let e = 0; e < 28; e++) for (let t = 0; t < 36; t++) {
		let n = Math.min(t, 35 - t), r = Math.min(e, 27 - e), i = Math.min(n - 7, r - 2), l = i >= 0 && i <= 1 && (n + r) % 2 == 0, u = Math.abs(n - 11) + Math.abs(r - 6), d = l || u === 2 || r === 6 && n >= 13 && n <= 16 || n === 11 && r >= 8 && r <= 10, f = (t * 31 + e * 13) % 17 / 16;
		a.fillStyle = d ? "#724a43" : `hsl(${34 + f * 4},${5 + f * 4}%,${56 + f * 9}%)`, a.fillRect(t * o + .5, e * s + .5, o - .6, s - .6), a.save(), a.globalCompositeOperation = "soft-light", a.globalAlpha = d ? .48 : .7;
		let p = (t * 73 + e * 21) % 500 / 1e3 * c.width, m = (e * 63 + t * 19) % 500 / 1e3 * c.height;
		a.drawImage(c, p, m, c.width * .23, c.height * .18, t * o + 1, e * s + 1, o - 1, s - 1), a.restore();
	}
	function l(e, t, o, s, c) {
		a.save(), a.translate((.5 + e / n) * i.width, (.5 + t / r) * i.height), a.scale(o / n * i.width, s / r * i.height);
		let l = a.createRadialGradient(0, 0, 0, 0, 0, 1);
		l.addColorStop(0, "rgba(33,24,18," + c + ")"), l.addColorStop(.55, "rgba(33,24,18," + c * .65 + ")"), l.addColorStop(1, "rgba(33,24,18,0)"), a.fillStyle = l, a.fillRect(-1, -1, 2, 2), a.restore();
	}
	let u = V;
	l(0, u.z - .1, u.w * .66, u.d * 1.07, .39);
	for (let e of [-1, 1]) for (let t of [-1, 1]) l(e * u.legX, u.z + t * u.legZ, .28, .21, .48);
	let d = new e.CanvasTexture(i);
	return d.colorSpace = e.SRGBColorSpace, d.anisotropy = 8, new e.MeshStandardMaterial({
		name: "hall-inlaid-limestone",
		map: d,
		roughness: .54,
		metalness: .012
	});
}
function Kn(t, n, r, i, a, o, s, c, l) {
	t = Wn(t, r);
	let u = new e.Group();
	u.position.set(i, o, a), u.name = "hall-sanctum-joinery";
	let d = [], f = [], p = [], m = [], h = s - o;
	function g(t, n) {
		let r = new e.Color(n), i = new Float32Array(t.getAttribute("position").count * 3);
		for (let e = 0; e < i.length; e += 3) i[e] = r.r, i[e + 1] = r.g, i[e + 2] = r.b;
		return t.setAttribute("color", new e.BufferAttribute(i, 3)), t;
	}
	function _(e, t, n, r, i, a, o) {
		f.push(g(L(e, t, n, r, i, a), o));
	}
	function v(e, t, n = "#ffffff") {
		let r = e.getAttribute("uv");
		for (let e = 0; e < r.count; e++) r.setXY(e, (t % 4 + .004 + .992 * r.getX(e)) / 4, (1 - Math.floor(t / 4) + .004 + .992 * r.getY(e)) / 2);
		d.push(g(e, n));
	}
	function y(t, n, r, i, a, o, s = 0) {
		let c = new e.PlaneGeometry(t, n, 4, 4).rotateY(s).translate(r, i, a);
		v(c, o);
		let l = c.getAttribute("color"), u = c.getAttribute("position");
		for (let t = 0; t < u.count; t++) {
			let r = u.getY(t), a = u.getX(t), s = o === 1 ? .85 : 1;
			if (o === 2) {
				let t = a / H.pitch + .5, n = t - Math.floor(t) - .5;
				s = .22 + .46 * Math.sin(Math.PI * (n + .5)) * (1 - .42 * e.MathUtils.smoothstep(r, 4.4, 6.1));
			}
			if (o === 4) {
				let t = i + n * .5 - r;
				s = .62 + .38 * e.MathUtils.smoothstep(t, 0, .093);
			}
			l.setXYZ(t, s, s, s);
		}
	}
	function b(t, n, r, i, a, o) {
		let s = Math.min(1, Math.abs(r) / (c * .5)), l = new e.Color().setScalar(o === 0 ? .66 + .17 * s : .63);
		v(new e.PlaneGeometry(t, n).rotateX(Math.PI / 2).translate(r, i, a), o, "#" + l.getHexString());
	}
	let x = "#a8583d", S = c / 18, C = l / 14;
	for (let e = 0; e < 18; e++) for (let t = 0; t < 14; t++) {
		if (e >= 6 && e < 12 && t >= 4 && t < 10) continue;
		let n = (e + .5 - 18 / 2) * S, r = (t + .5 - 14 / 2) * C;
		b(S - .036, C - .036, n, h - .14, r, 0);
	}
	for (let e = 0; e <= 18; e++) {
		let t = (e - 18 / 2) * S;
		if (e < 6 || e > 12) _(.055, .1, l, t, h - .15, 0, x);
		else for (let e of [-1, 1]) _(.055, .1, 4 * C, t, h - .15, e * 5 * C, x);
	}
	for (let e = 0; e <= 14; e++) {
		let t = (e - 14 / 2) * C;
		if (e < 4 || e > 10) _(c, .1, .055, 0, h - .15, t, x);
		else for (let e of [-1, 1]) _(6 * S, .1, .055, e * 6 * S, h - .15, t, x);
	}
	let w = 6 * S, E = 6 * C;
	b(w, E, 0, h - .05, 0, 5);
	let D = (t, n, r) => new e.Vector3(Math.cos((t + .5) * Math.PI / 4) * w * n, r, Math.sin((t + .5) * Math.PI / 4) * E * n), O = [
		[
			.46,
			-.21,
			"#a65130"
		],
		[
			.445,
			-.23,
			"#ceac68"
		],
		[
			.431,
			-.15,
			"#366d67"
		],
		[
			.405,
			-.15,
			"#80a48d"
		],
		[
			.391,
			-.1,
			"#cd9c64"
		],
		[
			.38,
			-.095,
			"#735046"
		]
	];
	for (let t = 1; t < O.length; t++) {
		let [n, r] = O[t - 1], [i, a, o] = O[t], s = [];
		for (let e = 0; e < 8; e++) for (let t of [
			D(e, n, h + r),
			D(e + 1, n, h + r),
			D(e, i, h + a),
			D(e + 1, n, h + r),
			D(e + 1, i, h + a),
			D(e, i, h + a)
		]) s.push(t.x, t.y, t.z);
		let c = new e.BufferGeometry();
		c.setAttribute("position", new e.Float32BufferAttribute(s, 3)), c.computeVertexNormals(), f.push(g(c, o));
	}
	let k = new e.CircleGeometry(1, 8, Math.PI / 8).rotateX(Math.PI / 2).scale(w * .381, 1, E * .381), A = k.getAttribute("uv");
	for (let e = 0; e < A.count; e++) A.setXY(e, .14 + .72 * A.getX(e), .14 + .72 * A.getY(e));
	let j = new e.Mesh(k, new e.MeshStandardMaterial({
		name: "hall-dragon-coffer-art",
		map: n,
		emissive: 16777215,
		emissiveMap: n,
		emissiveIntensity: .16,
		roughness: .76
	}));
	j.name = "hall-central-dragon-coffer", j.position.y = h - .09, u.add(j);
	for (let [e, t] of [
		[0, x],
		[.1, "#71a293"],
		[.21, "#b99a62"]
	]) for (let n of [-1, 1]) _(w - 2 * e, .16, .085, 0, h - .19 + e * .25, n * (E / 2 - e), t), _(.085, .16, E - 2 * e, n * (w / 2 - e), h - .19 + e * .25, 0, t);
	let { pitch: M, frontZ: N, backZ: te, postWidth: ne } = H, re = (M - ne) / 2;
	for (let t of [
		-M,
		0,
		M
	]) {
		let n = N;
		for (let e = 0; e < 7; e++) for (let n = 0; n < 7; n++) y(2 * re / 7, .93, t + (n - 3) * 2 * re / 7, 1.38 + e * .93, te + .01, 2);
		for (let e of [-1, 1]) {
			let r = N - te;
			for (let n = 0; n < 7; n++) for (let i = 0; i < 3; i++) y(r / 3, .93, t + e * (re - .006), 1.38 + n * .93, te + r * (i + .5) / 3, 2, -e * Math.PI / 2);
			_(.035, 6.72, .045, t + e * (re - .025), 4.26, n + .02, "#675a48");
		}
		for (let n = 0; n < 3; n++) v(new e.PlaneGeometry(re * 2, (N - te) / 3).rotateX(Math.PI / 2).translate(t, 7.675, te + (n + .5) * (N - te) / 3), 1, "#6d6255");
		let r = (e) => 7.23 - .19 * e * e - .52 * Math.abs(e) ** 4 - .77 * Math.abs(e) ** 13;
		for (let i = 0; i < 32; i++) {
			let a = i / 16 - 1, o = (i + 1) / 16 - 1, s = r(a), c = [
				a,
				s,
				o,
				r(o),
				o,
				7.68,
				a,
				s,
				o,
				7.68,
				a,
				7.68
			], l = [], u = [];
			for (let e = 0; e < c.length; e += 2) l.push(t + c[e] * re, c[e + 1], n + .025), u.push((i % 8 + +(c[e] === o)) / 8, (c[e + 1] - 5.46) / 2.22);
			let d = new e.BufferGeometry();
			d.setAttribute("position", new e.Float32BufferAttribute(l, 3)), d.setAttribute("uv", new e.Float32BufferAttribute(u, 2)), d.computeVertexNormals(), v(d, 1);
			let p = [
				[-.03, -.31],
				[-.03, -.035],
				[-.014, .036],
				[.01, .067],
				[.026, .061],
				[.039, .034],
				[.068, .034],
				[.084, .057],
				[.105, .057],
				[.128, .025]
			], m = [
				"#3d312a",
				"#534337",
				"#856c50",
				"#b09467",
				"#82684c",
				"#4d4035",
				"#725f49",
				"#958167",
				"#625143"
			], h = (e, i) => {
				let [a, o] = p[i], s = (r(e + 1e-4) - r(e - 1e-4)) / (2e-4 * re), c = Math.hypot(s, 1);
				return [
					t + e * re - a * s / c,
					r(e) + a / c,
					n + o
				];
			};
			for (let t = 0; t < m.length; t++) {
				let n = new e.BufferGeometry();
				n.setAttribute("position", new e.Float32BufferAttribute([
					...h(a, t),
					...h(o, t),
					...h(a, t + 1),
					...h(o, t),
					...h(o, t + 1),
					...h(a, t + 1)
				], 3)), n.computeVertexNormals(), f.push(g(n, m[t]));
			}
		}
		for (let e = 0; e < 3; e++) y(M / 3, .4, t + (e - 1) * M / 3, 7.96, n + .018, 1);
		for (let e of [7.7, 8.19]) _(M, .09, .36, t, e, n - .14, "#383331");
		for (let e = 0; e < 3; e++) y(M / 3, .58, t + (e - 1) * M / 3, .34, -2.96, 4);
	}
	let ie = new e.OctahedronGeometry(.024), P = Nn, ae = P.z + P.d / 2 + .004;
	for (let e of [
		-1,
		0,
		1
	]) {
		let t = e ? P.wingW : 2 * P.wingX - P.wingW, n = e ? P.wingTop : P.centreTop, r = e * P.wingX, i = e ? 4 : 5;
		for (let e = 0; e < i; e++) {
			let a = r + t * ((e + .5) / i - .5);
			y(t / i - .016, n - .12, a, n * .5 - .006, ae, 4);
		}
		_(t, .062, .115, r, n - .034, ae - .048, "#c3b8a4"), _(t, .048, .086, r, .04, ae - .033, "#a49b89");
	}
	for (let t of [-1, 1]) {
		let n = t * Fn.x, r = Fn.z, i = Fn.profile;
		f.push(g(new e.LatheGeometry(i.map(([t, n]) => new e.Vector2(t, n)), 24).translate(n, 0, r), "#a6753d"));
		for (let t = 0; t < 27; t++) {
			let i = .33 - t * .0072, a = 1.21 + t * .111;
			p.push(new e.TorusGeometry(i, .018, 5, 24).rotateX(Math.PI / 2).translate(n, a, r));
			for (let e = 0; e < 12; e++) {
				let o = e * 2 * Math.PI / 12 + t * .07;
				m.push(ie.clone().translate(n + i * Math.sin(o), a + .037, r + i * Math.cos(o)));
			}
		}
	}
	for (let t of [-1, 1]) {
		let n = t * (T.halfClear + .025) / ee.x, r = (T.wallZ + .17) / ee.z;
		for (let e = 0; e < 6; e++) y(.5, 1.13, n, .65 + e * 1.13, r - .1, 3, -t * Math.PI / 2);
		_(.105, 6.9, .11, n, 3.43, r + .18, "#ae673a");
		let i = (i, a, o) => new e.Vector3(n - t * o, a, r - .1 + t * i);
		for (let t = 0; t < 6; t++) {
			let n = .65 + t * 1.13, r = Array.from({ length: 25 }, (e, t) => {
				let r = t / 24;
				return i(.16 * Math.sin(r * 2 * Math.PI), n - .49 + r * .98, .015);
			});
			p.push(new e.TubeGeometry(new e.CatmullRomCurve3(r), 36, .012, 6, !1));
			for (let t = 0; t < 8; t++) {
				let r = t * Math.PI / 4, a = [], o = (e, t) => {
					let a = .022 + .16 * t, o = .048 * Math.sin(Math.PI * t) * e;
					return i(Math.cos(r) * a - Math.sin(r) * o, n + Math.sin(r) * a + Math.cos(r) * o, .017 + .033 * Math.sin(Math.PI * t) * (1 - e * e));
				};
				for (let e = 0; e < 7; e++) for (let t of [-1, 0]) for (let n of [
					o(t, e / 7),
					o(t + 1, e / 7),
					o(t, (e + 1) / 7),
					o(t + 1, e / 7),
					o(t + 1, (e + 1) / 7),
					o(t, (e + 1) / 7)
				]) a.push(n.x, n.y, n.z);
				let s = new e.BufferGeometry();
				s.setAttribute("position", new e.Float32BufferAttribute(a, 3)), s.computeVertexNormals(), s.setAttribute("uv", new e.Float32BufferAttribute(new Float32Array(a.length / 3 * 2), 2)), p.push(s);
			}
		}
	}
	function oe(t, n, r) {
		let i = new e.CylinderGeometry(r, r, t.distanceTo(n), 6);
		i.applyQuaternion(new e.Quaternion().setFromUnitVectors(new e.Vector3(0, 1, 0), n.clone().sub(t).normalize()));
		let a = t.clone().lerp(n, .5);
		p.push(i.translate(a.x, a.y, a.z));
	}
	let se = -.68, ce = h - .22, le = (t, n, r) => new e.Vector3(t, n, r + se);
	oe(le(0, ce, 0), le(0, ce - 2.9, 0), .033);
	for (let [t, n, r] of [
		[
			16,
			.81,
			1.38
		],
		[
			12,
			1.48,
			1.02
		],
		[
			9,
			2.12,
			.66
		],
		[
			6,
			2.62,
			.34
		]
	]) {
		let i = ce - n - .16;
		p.push(new e.TorusGeometry(.17, .029, 6, 22).rotateX(Math.PI / 2).translate(0, i, se));
		for (let a = 0; a < t; a++) {
			let o = 2 * Math.PI * a / t + n, s = r * Math.cos(o), c = r * Math.sin(o), l = le(0, i, 0), u = le(.67 * s, i - .18, .67 * c), d = le(s, i + .21, c);
			oe(l, u, .018), oe(u, d, .018), p.push(new e.CylinderGeometry(.071, .045, .085, 8).translate(d.x, d.y, d.z)), m.push(new e.SphereGeometry(.099, 10, 8).scale(.94, 1.11, .94).translate(d.x, d.y + .119, d.z));
		}
	}
	m.push(new e.SphereGeometry(.15, 12, 8).translate(0, ce - 2.97, se));
	let F = [
		"#785294",
		"#b09ac9",
		"#a862ae",
		"#806cad"
	];
	function ue(t, n, r, i) {
		let a = Math.sin(i * 2.399), o = new e.Vector3(t + .08 * a, n + .16 + .05 * Math.cos(i), r + .03 * a), s = new e.CylinderGeometry(.007, .011, o.y - n, 5);
		f.push(g(s.translate(o.x, n + (o.y - n) * .5, o.z), "#546342"));
		for (let t = 0; t < 5; t++) {
			let n = t * 2 * Math.PI / 5 + .68 * a, r = new e.SphereGeometry(1, 8, 5).scale(.03, .052, .012);
			r.rotateX(-.5).rotateZ(-n).translate(o.x + .034 * Math.sin(n), o.y + .03 * Math.cos(n), o.z), f.push(g(r, F[(t + i) % 4]));
		}
		f.push(g(new e.SphereGeometry(.017, 6, 4).translate(o.x, o.y, o.z + .014), "#e5bb76"));
		let c = new e.SphereGeometry(1, 6, 4).scale(.028, .11, .012).rotateZ(a * 1.1);
		f.push(g(c.translate(t, n + .075, r), "#43583a"));
	}
	function de(t, n, r, i, a) {
		f.push(g(new e.CylinderGeometry(1, .86, .072, 28).scale(i / 2, 1, .18).translate(t, n + .036, r), "#645241"));
		for (let e = 0; e < 15; e++) {
			let o = e / 14, s = e * 2.39996 + a;
			ue(t + (o - .5) * i * .91, n + .077 + .038 * Math.sin(Math.PI * o), r + .107 * Math.sin(s), a + e);
		}
	}
	for (let e of [-1, 1]) de(e * 2.95, P.wingTop, P.z + .1, .93, e < 0 ? 13 : 37), de(e * .99, P.centreTop, P.z + .34, 1.48, e < 0 ? 49 : 65);
	for (let t of [
		-5.55,
		-2.68,
		2.68,
		5.55
	]) {
		let n = P.wingTop, r = P.z - .24;
		p.push(new e.CylinderGeometry(.086, .153, .075, 20).translate(t, n + .0375, r)), p.push(new e.CylinderGeometry(.052, .076, .16, 16).translate(t, n + .155, r)), p.push(new e.CylinderGeometry(.117, .057, .063, 20).translate(t, n + .2665, r)), f.push(g(new e.CylinderGeometry(.063, .073, .86, 18).translate(t, n + .728, r), "#a53228")), m.push(new e.SphereGeometry(.03, 8, 6).scale(.67, 1.66, .67).translate(t, n + 1.195, r));
	}
	function fe(t, n, r) {
		let i = new e.Mesh(z(t), n);
		i.receiveShadow = !0, i.name = r, u.add(i);
	}
	return fe(d, new e.MeshStandardMaterial({
		name: "hall-sanctum-painted-carving",
		map: t,
		vertexColors: !0,
		side: e.DoubleSide,
		bumpMap: t,
		bumpScale: .0028,
		roughness: .81
	}), "hall-painted-ceiling-and-niches"), fe(f, new e.MeshStandardMaterial({
		vertexColors: !0,
		name: "hall-sanctum-woodwork",
		side: e.DoubleSide,
		roughness: .68
	}), "hall-sanctum-mouldings"), fe(p, new e.MeshStandardMaterial({
		name: "hall-sanctum-lamp-brass",
		color: 12229736,
		metalness: .68,
		roughness: .32
	}), "hall-pendant-brass"), fe(m, new e.MeshStandardMaterial({
		name: "hall-opal-globes",
		color: 16774105,
		emissive: 16771519,
		emissiveIntensity: 1.45,
		roughness: .32
	}), "hall-pendant-globes"), u;
}
//#endregion
//#region src/world/flame_aureole.ts
function qn(t) {
	let n = [];
	function r(t, n, r) {
		let i = t * Math.PI * 2, a = Math.max(0, Math.cos(i)), o = r ? .105 * Math.max(0, Math.sin(i * 38 + 1.7 * Math.sin(i * 3))) ** 3 : 0;
		return new e.Vector2((1.77 - n + o) * Math.sin(i) * (1 - .27 * a), (2.33 - n + o) * Math.cos(i) + .37 * a ** 9);
	}
	let i = Array.from({ length: 608 }, (e, t) => r(t / 608, 0, !0)), a = new e.ExtrudeGeometry(new e.Shape(i), {
		depth: .066,
		bevelEnabled: !1
	}), o = a.getAttribute("position"), s = a.getAttribute("uv");
	for (let e = 0; e < o.count; e++) s.setXY(e, .5 + o.getX(e) / 3.84, (o.getY(e) + 2.45) / 5.27);
	let c = new e.MeshStandardMaterial({
		name: "hall-gilded-aureole-field",
		map: t,
		bumpMap: t,
		bumpScale: .0038,
		color: 11768164,
		metalness: .49,
		roughness: .59
	}), l = new e.Mesh(a, c);
	function u(t, r, i = !1) {
		n.push(new e.TubeGeometry(new e.CatmullRomCurve3(t, i), i ? 144 : 24, r, 5, i));
	}
	let d = [
		[
			0,
			.066,
			6374185
		],
		[
			.015,
			.09,
			9794110
		],
		[
			.043,
			.142,
			12819033
		],
		[
			.068,
			.153,
			13806439
		],
		[
			.098,
			.097,
			10385734
		],
		[
			.116,
			.084,
			7622957
		],
		[
			.153,
			.092,
			9728067
		],
		[
			.19,
			.124,
			11701328
		],
		[
			.208,
			.12,
			12688222
		],
		[
			.228,
			.068,
			8018232
		]
	], f = [], p = [], m = [];
	for (let t = 0; t < 456; t++) for (let [n, i, a] of d) {
		let o = t / 456, s = r(o, n, !1), c = r(o, n, !0);
		s.lerp(c, Math.max(0, 1 - n / .21)), f.push(s.x, s.y, i);
		let l = new e.Color(a);
		p.push(l.r, l.g, l.b);
	}
	for (let e = 0; e < 456; e++) for (let t = 0; t < d.length - 1; t++) {
		let n = e * d.length + t, r = (e + 1) % 456 * d.length + t;
		m.push(n, n + 1, r, n + 1, r + 1, r);
	}
	let h = new e.BufferGeometry();
	h.setIndex(m), h.setAttribute("position", new e.Float32BufferAttribute(f, 3)), h.setAttribute("color", new e.Float32BufferAttribute(p, 3)), h.computeVertexNormals();
	let g = new e.Mesh(h, new e.MeshStandardMaterial({
		name: "hall-aureole-cast-border",
		vertexColors: !0,
		metalness: .61,
		roughness: .45
	}));
	u(Array.from({ length: 120 }, (t, n) => {
		let i = r(n / 120, .44, !1);
		return new e.Vector3(i.x, i.y, .08);
	}), .016, !0);
	for (let t of [-1, 1]) for (let n = 0; n < 16; n++) {
		let i = .16 + n * .181, a = r(i / (2 * Math.PI), .29, !1);
		u(Array.from({ length: 19 }, (n, r) => {
			let o = r / 18, s = o * 1.62 * Math.PI, c = .18 * (1 - .79 * o);
			return new e.Vector3(t * (a.x + c * Math.cos(s) * Math.cos(i) + .14 * Math.sin(s) * Math.sin(i)), a.y + .21 * Math.cos(s) * Math.sin(i) - c * Math.sin(s) * Math.cos(i), .091 + .035 * Math.sin(o * Math.PI));
		}), .014);
	}
	let _ = new e.Mesh(z(n), new e.MeshStandardMaterial({
		name: "hall-chased-aureole-rims",
		color: 13673298,
		metalness: .62,
		roughness: .43
	})), v = new e.Group();
	return v.name = "hall-statue-halo", v.add(l, g, _), v;
}
//#endregion
//#region src/world/sculpture_occlusion.ts
var Jn = [
	[
		-.7,
		.55,
		.65
	],
	[
		.76,
		.46,
		.55
	],
	[
		-.22,
		.92,
		-.32
	],
	[
		.26,
		.86,
		.51
	],
	[
		-.84,
		.18,
		-.52
	],
	[
		.85,
		.2,
		-.49
	],
	[
		.1,
		-.28,
		.96
	],
	[
		.32,
		-.2,
		-.93
	]
], Yn = 144, Xn = 25;
function Zn(t, n) {
	let r = new e.Vector3(...n).normalize(), i = new e.Vector3(0, 1, 0).cross(r).normalize(), a = r.clone().cross(i), o = new Float32Array(Yn * Yn).fill(-Infinity);
	function s(e, t, n, o) {
		return t -= 2.35, o.set(Yn / 2 + Xn * (e * i.x + t * i.y + n * i.z), Yn / 2 + Xn * (e * a.x + t * a.y + n * a.z), e * r.x + t * r.y + n * r.z);
	}
	let c = [
		new e.Vector3(),
		new e.Vector3(),
		new e.Vector3()
	];
	for (let e of t) {
		let t = e.geometry.getAttribute("position"), n = e.geometry.index;
		for (let e = 0; e < (n?.count ?? t.count); e += 3) {
			for (let r = 0; r < 3; r++) {
				let i = n ? n.getX(e + r) : e + r;
				s(t.getX(i), t.getY(i), t.getZ(i), c[r]);
			}
			let [r, i, a] = c, l = (i.y - a.y) * (r.x - a.x) + (a.x - i.x) * (r.y - a.y);
			if (Math.abs(l) < 1e-4) continue;
			let u = Math.max(0, Math.ceil(Math.min(r.x, i.x, a.x))), d = Math.min(Yn - 1, Math.floor(Math.max(r.x, i.x, a.x))), f = Math.max(0, Math.ceil(Math.min(r.y, i.y, a.y))), p = Math.min(Yn - 1, Math.floor(Math.max(r.y, i.y, a.y)));
			for (let e = f; e <= p; e++) for (let t = u; t <= d; t++) {
				let n = ((i.y - a.y) * (t - a.x) + (a.x - i.x) * (e - a.y)) / l, s = ((a.y - r.y) * (t - a.x) + (r.x - a.x) * (e - a.y)) / l;
				if (n >= 0 && s >= 0 && n + s <= 1) {
					let c = e * Yn + t;
					o[c] = Math.max(o[c], n * r.z + s * i.z + (1 - n - s) * a.z);
				}
			}
		}
	}
	return {
		axis: r,
		depth: o,
		project: s
	};
}
function Qn(t) {
	let n = t.levels[1].object.children, r = Jn.map((e) => Zn(n, e)), i = new e.Vector3(), a = new e.Vector3(), o = new e.Vector3(), s = /* @__PURE__ */ new Map();
	for (let n of t.levels) for (let t of n.object.children) {
		let n = t.geometry, c = n.getAttribute("position"), l = n.getAttribute("normal"), u = new Uint8Array(c.count);
		for (let t = 0; t < c.count; t++) {
			i.fromBufferAttribute(c, t), a.fromBufferAttribute(l, t);
			let n = (Math.round((i.x + 3) * 125) * 1024 + Math.round(i.y * 125)) * 1024 + Math.round((i.z + 2) * 125), d = s.get(n);
			if (d === void 0) {
				let t = 0, c = .15;
				for (let n of r) {
					let r = Math.max(0, a.dot(n.axis));
					if (!r) continue;
					c += r, n.project(i.x, i.y, i.z, o);
					let s = Math.round(o.x) + Yn * Math.round(o.y);
					t += r * e.MathUtils.smoothstep(n.depth[s] - o.z, .065, .23);
				}
				d = Math.round(255 * (1 - .85 * t / c)), s.set(n, d);
			}
			u[t] = d;
		}
		n.setAttribute("sculptVisibility", new e.BufferAttribute(u, 1, !0));
	}
}
//#endregion
//#region src/world/distant_geometry.ts
function $n(t, n = 75) {
	let r = new e.PerspectiveCamera(), i = t.update.bind(t);
	t.update = (e) => {
		let t = e, a = Number.isFinite(t.fov) ? Math.max(1, Math.tan(n * Math.PI / 360) / Math.tan(t.fov * Math.PI / 360)) : 1;
		r.matrixWorld.copy(e.matrixWorld), r.zoom = (t.zoom || 1) * a, i(r);
	};
}
//#endregion
//#region src/world/lotus_buddha_face.ts
var er = [
	[
		3.29,
		.02,
		.09,
		.06
	],
	[
		3.315,
		.18,
		.22,
		.16
	],
	[
		3.38,
		.302,
		.313,
		.25
	],
	[
		3.49,
		.385,
		.346,
		.3
	],
	[
		3.66,
		.445,
		.343,
		.352
	],
	[
		3.84,
		.466,
		.348,
		.374
	],
	[
		4.015,
		.474,
		.36,
		.388
	],
	[
		4.16,
		.466,
		.371,
		.382
	],
	[
		4.28,
		.433,
		.342,
		.344
	],
	[
		4.37,
		.334,
		.252,
		.285
	],
	[
		4.42,
		.02,
		.035,
		.024
	]
];
function tr(e, t) {
	let n = 0;
	for (; n < er.length - 2 && e > er[n + 1][0];) n++;
	let r = er[n], i = er[n + 1], a = er[Math.max(0, n - 1)], o = er[Math.min(er.length - 1, n + 2)], s = i[0] - r[0], c = Math.max(0, Math.min(1, (e - r[0]) / s)), l = s * (i[t] - a[t]) / (i[0] - a[0]), u = s * (o[t] - r[t]) / (o[0] - r[0]);
	return (1 - c) * r[t] + c * i[t] + c * (1 - c) * ((1 - c) * (l - i[t] + r[t]) + c * (i[t] - r[t] - u));
}
var W = (e, t) => Math.exp(-(e * e) / (t * t)), nr = (e, t, n, r) => W(e, n) * W(t, r), rr = (e) => Math.max(0, Math.min(1, e));
function ir(e, t) {
	let n = Math.abs(e), r = rr((n - .053) / .296), i = Math.sin(Math.PI * r), a = i ** .68, o = 3.89 + .051 * r - .024 * i, s = 3.948 + .035 * r + .09 * Math.sin(Math.PI * r) ** .82, c = .014 + .059 * i, l = t - o, u = t - s, d = .061 * nr(n - .245, t - 3.76, .15, .15) - .036 * nr(n - .2, t - 3.942, .145, .084);
	d += a * (.051 * W(l - .52 * c, c * .85) + .023 * W(l + .024, .031) - .022 * W(l, .012 + .005 * i) + .022 * W(u + .007, .043) - .009 * W(u - .026, .029));
	let f = a * (.92 * W(l, .012 + .004 * i) + 1.05 * W(u, .014 + .009 * i)), p = .046 + .019 * W(t - 3.76, .13);
	d += .116 * Math.exp(-((n / p) ** 2.3)) * W(t - 3.856, .184) + .082 * nr(e, t - 3.728, .08, .054) + .043 * nr(n - .07, t - 3.724, .038, .042) + .035 * nr(e, t - 3.693, .029, .033) - .033 * nr(n - .051, t - 3.699, .025, .012) - .024 * nr(n - .103, t - 3.715, .02, .041), f += .79 * nr(n - .051, t - 3.699, .025, .011) + .2 * nr(e, t - 3.692, .085, .02);
	let m = rr(1 - (n / .151) ** 2) ** 1.35, h = t - (3.581 + .02 * (n / .151) ** 2 + .007 * W(n - .047, .034));
	return d += m * (.047 * W(h - .02, .021) + .052 * W(h + .024, .028) - .018 * W(h, .009)) - .02 * nr(n - .149, t - 3.577, .017, .02) - .012 * nr(e, t - 3.627, .022, .035) + .018 * nr(n - .033, t - 3.625, .023, .038), f += m * (.84 * W(h, .007) + .28 * W(h + .05, .012)), d += .033 * nr(e, t - 3.443, .174, .074) - .009 * nr(e, t - 3.496, .115, .023), [d, rr(f)];
}
function ar(e, t) {
	let n = e * Math.PI * 2, r = n - .57 * Math.sin(n), i = 3.29 + 1.13 * t, a = Math.cos(r), o = tr(i, 1) * Math.sin(r), s = Math.max(0, a), [c, l] = s > 0 ? ir(o, i) : [0, 0];
	return {
		x: o,
		y: i,
		z: -.17 + (a < 0 ? tr(i, 3) * a : tr(i, 2) * s ** .77) + c * s ** 1.65,
		patina: l * s
	};
}
//#endregion
//#region src/world/central_robe.js
var or = (e) => Math.max(0, Math.min(1, e));
function sr(e, t, n) {
	let r = or((n - e) / (t - e));
	return r * r * (3 - 2 * r);
}
function G(e, t, n) {
	return Math.exp(-((e - t) ** 2) / (n * n));
}
var cr = 2 * Math.PI;
function lr(e, t) {
	let n = or(t) * (e.length - 1), r = Math.min(e.length - 2, Math.floor(n)), i = n - r, a = e[Math.max(0, r - 1)], o = e[r], s = e[r + 1], c = e[Math.min(e.length - 1, r + 2)];
	return o.map((e, t) => .5 * (2 * e + (-a[t] + s[t]) * i + (2 * a[t] - 5 * e + 4 * s[t] - c[t]) * i * i + (-a[t] + 3 * e - 3 * s[t] + c[t]) * i * i * i));
}
var ur = [
	[.72, .48],
	[.82, .54],
	[.84, .53],
	[.78, .5],
	[.84, .48],
	[.92, .45],
	[.91, .4],
	[.71, .34],
	[.3, .27]
], dr = [
	[
		.35,
		3.1,
		-.18,
		.085,
		.12
	],
	[
		.7,
		2.97,
		-.14,
		.24,
		.24
	],
	[
		.93,
		2.61,
		-.12,
		.24,
		.32
	],
	[
		1,
		2.22,
		-.06,
		.22,
		.3
	],
	[
		1.05,
		1.85,
		.11,
		.25,
		.32
	],
	[
		.94,
		1.66,
		.36,
		.23,
		.28
	],
	[
		.72,
		1.55,
		.53,
		.18,
		.21
	],
	[
		.47,
		1.48,
		.64,
		.146,
		.175
	]
], fr = [
	[
		.22,
		.68,
		-.36,
		.25,
		.28
	],
	[
		.77,
		.75,
		-.32,
		.4,
		.47
	],
	[
		1.32,
		.77,
		-.18,
		.42,
		.45
	],
	[
		1.56,
		.77,
		.1,
		.39,
		.39
	],
	[
		1.38,
		.81,
		.45,
		.34,
		.37
	],
	[
		.96,
		.88,
		.62,
		.29,
		.32
	],
	[
		.43,
		.99,
		.69,
		.225,
		.28
	],
	[
		-.29,
		1.11,
		.71,
		.125,
		.16
	]
], pr = [
	[
		-2.9,
		.22,
		.041
	],
	[
		-2.33,
		.23,
		.054
	],
	[
		-1.69,
		.23,
		.058
	],
	[
		-1.04,
		.24,
		.067
	],
	[
		-.48,
		.19,
		.053
	],
	[
		.02,
		.2,
		.062
	],
	[
		.61,
		.21,
		.058
	],
	[
		1.21,
		.24,
		.071
	],
	[
		1.94,
		.26,
		.057
	],
	[
		2.62,
		.22,
		.046
	]
];
function mr(e, t, n, r) {
	let i = sr(.16, .72, t), a = Math.cos(e), o = n * (.13 + .77 * i) + (r ? .13 : -.1) * Math.sin(Math.PI * t), s = 0;
	for (let [n, r, a] of pr) {
		let c = n + .64 * o - .33 * i * Math.sin(n) + .16 * Math.sin(Math.PI * t + n), l = Math.atan2(Math.sin(e - c), Math.cos(e - c)), u = sr(.008, .13 + .025 * Math.cos(n), t) * (1 - sr(.52 + .09 * Math.sin(n), .76, t));
		s += u * (a * G(l, 0, r) - .037 * G(l, r * 1.21, r * .79));
	}
	let c = t + .062 * a + .04 * n * Math.sin(e), l = (.047 * G(c, .595, .059) - .021 * G(c, .66, .039) + .041 * G(c, .744, .052)) * (.77 + .23 * Math.cos(e - n * .63));
	return s + l + .035 * G(c, .856, .042) + .029 * G(t, .948, .033);
}
function hr(e, t, n, r = !1, i = !1) {
	let a = cr * t, o = Math.cos(a), s = Math.sin(a);
	if (e === 0) {
		let e = 1.03 + 2.26 * n, [t, i] = lr(ur, n), a = t * s, c = (Math.abs(a + .018 * Math.sin(2.4 * e)) ** 2.6 + (Math.max(0, 3.08 - e) * .49) ** 2.6) ** (1 / 2.6), l = G(a, 0, .42) * G(e, 2.74, .52), u = i * o - .19, d = [
			.49,
			.575,
			.665,
			.785,
			.9
		];
		for (let t = 0; t < d.length; t++) {
			let n = c - d[t] - .014 * Math.sin(4.6 * e + t * .95 + a * 3);
			u += Math.max(0, o) * (.042 * G(n, 0, .029) - .027 * G(n, .042, .024));
		}
		return u += Math.max(0, o) * (.065 * l - .031 * G(a, 0, .07) * G(e, 2.75, .31) - .037 * G(e, 2.4, .05) * G(a, 0, .38)), r && (u += .0038 * Math.cos(236 * c + 1.6 * Math.sin(e * 6)) * sr(.45, .59, c) * Math.max(0, o)), [
			a,
			e,
			u
		];
	}
	let c = e === 1 || e === 2, l = e === 1 || e === 3 ? -1 : 1, u = c ? dr : fr, d = lr(u, n), f = lr(u, n - .001), p = lr(u, n + .001), m = l * (p[0] - f[0]), h = p[1] - f[1], g = p[2] - f[2], _ = Math.hypot(m, h, g);
	m /= _, h /= _, g /= _;
	let v = c ? g : h, y = -v * m, b = +!c - v * h, x = +!!c - v * g, S = Math.hypot(y, b, x);
	y /= S, b /= S, x /= S;
	let C = h * x - g * b, w = g * y - m * x, T = m * b - h * y, E = 0;
	if (c) E = mr(a, n, l, i), r && (E += .0018 * Math.sin(19 * a + 4.8 * n) * sr(.04, .21, n) * (1 - sr(.63, .84, n)));
	else {
		let e = n + .083 * Math.sin(a + l * .48) + .028 * o;
		E = .037 * G(e, .44, .081) - .016 * G(e, .528, .055) + .046 * G(e, .63, .072) + .029 * G(e, .82, .054), r && (E += .0018 * Math.cos(82 * e) * sr(.22, .51, n));
	}
	let D = c ? (.34 + .66 * sr(0, .18, n)) * (1 - .26 * sr(.973, 1, n)) : .42 + .58 * sr(0, .12, n), O = (d[3] + E) * D, ee = (d[4] + E) * D, k = c ? 0 : l * .1 * sr(.47, .94, n), A = i && e === 2 ? sr(.72, 1, n) : 0;
	return [
		l * d[0] + .115 * A + y * O * o + C * ee * s,
		d[1] + k + .062 * A + b * O * o + w * ee * s,
		d[2] - .035 * A + x * O * o + T * ee * s
	];
}
//#endregion
//#region src/world/buddha_sculpture.ts
var K = e.MathUtils.smoothstep, q = (e, t, n, r, i, a) => Math.exp(-(((e - n) / i) ** 2 + ((t - r) / a) ** 2));
function gr(t, n, r, i, a) {
	let o = t === 1, s = {
		gold: [],
		lap: [],
		crease: [],
		hair: []
	}, c = Math.max(12, Math.round(48 * n));
	function l(t, n = "gold") {
		if (n === "gold" || n === "lap") {
			let r = t.userData.chart ?? 5, i = o && (r === 1 || r === 2), a = r === 3 || r === 4 || i ? 5 : r, s = t.getAttribute("uv"), c = new Float32Array(s.count * 2);
			for (let e = 0; e < s.count; e++) c[e * 2] = (a % 3 + (5 + 374 * s.getX(e)) / 384) / 3, c[e * 2 + 1] = (Math.floor(a / 3) + (5 + 374 * s.getY(e)) / 384) / 2;
			if (n === "lap") {
				let n = new Float32Array(s.count * 2);
				for (let e = 0; e < s.count; e++) n[2 * e] = t.userData.finish ? s.getX(e) : -1, n[2 * e + 1] = s.getY(e);
				t.setAttribute("apronUv", new e.BufferAttribute(n, 2));
			}
			if (o) {
				let n = new Float32Array(s.count);
				for (let e = 0; e < s.count; e++) i ? n[e] = .58 + .38 * K(s.getY(e), .66, .93) : n[e] = t.userData.finish ?? 0;
				t.setAttribute("robeFinish", new e.BufferAttribute(n, 1));
			}
			t.setAttribute("uv1", new e.BufferAttribute(c, 2));
		}
		s[n].push(t);
	}
	function u(r, i, a, o, s, u, d = "gold") {
		l(new e.SphereGeometry(1, d === "hair" ? n > .5 && t !== 1 ? 8 : 6 : Math.max(8, c / 2), d === "hair" ? n > .5 && t !== 1 ? 6 : 4 : Math.max(5, c / 3)).scale(o, s, u).translate(r, i, a), d);
	}
	function d(t, r, i = "gold", a = 7) {
		let o = new e.CatmullRomCurve3(t.map((t) => new e.Vector3(...t)));
		l(new e.TubeGeometry(o, Math.max(3, Math.round(t.length * 4 * n)), r, n < .3 ? 4 : a, !1), i);
	}
	function f(t, r, i, a = "gold", o = 5, s = 0) {
		let c = [], u = [], d = [];
		t = Math.max(3, Math.round(t * n)), r = Math.max(3, Math.round(r * n));
		for (let e = 0; e <= r; e++) for (let n = 0; n <= t; n++) {
			let a = i(n / t, e / r);
			if (c.push(a.x, a.y, a.z), u.push(n / t, e / r), n < t && e < r) {
				let r = e * (t + 1) + n, i = r + 1, a = r + t + 1, o = a + 1;
				d.push(r, i, a, i, o, a);
			}
		}
		let f = new e.BufferGeometry();
		return f.setAttribute("position", new e.Float32BufferAttribute(c, 3)), f.setAttribute("uv", new e.Float32BufferAttribute(u, 2)), f.setIndex(d), f.computeVertexNormals(), f.userData.chart = o, f.userData.finish = s, l(f, a), f;
	}
	let p = new e.LatheGeometry([
		[0, 0],
		[1.65, 0],
		[1.8, .08],
		[1.89, .19],
		[1.84, .3],
		[1.66, .4],
		[0, .4]
	].map(([t, n]) => new e.Vector2(t, n)), c * 2);
	p.scale(1, 1, .64), l(p);
	let m = Math.max(12, Math.round(26 * n));
	for (let t of [0, 1]) for (let n = 0; n < m; n++) {
		let r = (n + t * .5) * Math.PI * 2 / m;
		f(10, 12, (n, i) => {
			let a = (n - .5) * .24, o = Math.sin(Math.PI * i) * a, s = 1.74 + .17 * Math.sin(Math.PI * i), c = t ? .19 + .2 * i : .2 - .16 * i;
			return new e.Vector3(Math.sin(r + o) * s, c + .035 * Math.sin(Math.PI * i) * (1 - (2 * n - 1) ** 2), Math.cos(r + o) * s * .64);
		});
	}
	let h = t === 1 ? -1 : +(t === 2);
	[
		[134, 118],
		[60, 74],
		[60, 74],
		[68, 82],
		[68, 82]
	].forEach(([t, n], r) => {
		f(t, n, (t, n) => {
			let i = new e.Vector3().fromArray(hr(r, t, n, !1, o));
			if (r === 1 && h === -1 || r === 2 && h === 1) {
				let e = K(n, .58, 1);
				i.x += h * .6 * e, i.y -= .13 * e;
			}
			if (o) {
				if (r <= 2) {
					let e = q(Math.abs(i.x), i.y, .73, 2.98, .46, .37);
					if (i.y -= .16 * e, r > 0) {
						let e = .14 * Math.exp(-((n - .18) ** 2) / .032);
						i.x *= 1 - e;
					}
				}
				if (r === 1) {
					let e = K(n, .54, .93);
					i.y -= .072 * e, i.z += .095 * e;
				}
			}
			return i;
		}, "gold", r);
	});
	let g = h || 1;
	function _(e, t, n) {
		let r = e / t;
		return n * (Math.exp(-r * r * (r > 0 ? .86 : 3.2)) - .29 * Math.exp(-((r + 1.02) ** 2) / .26));
	}
	f(128, 74, (t, n) => {
		let r = 2 * Math.PI * t, i = -Math.cos(Math.PI * n), a = Math.sin(Math.PI * n) ** .46, o = Math.abs(i), s = Math.exp(-((o - .76) ** 2) / .085), c = g * i, l = .72 + .13 * s + .053 * c, u = -Math.sin(r), d = Math.cos(r), f = .43 + .13 * s, p = l - .31, m = l + (u > 0 ? f : p) * a * u, v = 1.04 + .18 * s + .08 * c, y = .21 * o ** 1.65 + .058 * c, b = .87 + .16 * s + .08 * c, x = (m - y - .53) / b + .53, S = q(i, m, h * .57, 1.08, .22, .17), C = _(x - .434, .093, .111) + _(x - .65 - .025 * i, .109, .16) + _(x - .896 + .029 * i, .092, .126) * (1 - .6 * S), w = 1.96 * i, T = Math.max(0, d);
		return new e.Vector3(w, m, -.01 + .14 * s + a * d * (v + C * T));
	}, "lap"), o ? f(86, 44, (t, n) => {
		let r = -1.32 + 2.07 * t + .1 * (1 - n) * Math.sin(2 * Math.PI * t), i = Math.sin(Math.PI * t), a = .88 - .47 * i + .15 * t, o = 1.26 - .18 * i + .2 * t - .065 * q(r, 0, -1.05, 0, .22, 1), s = e.MathUtils.lerp(a, o, n) + .029 * Math.sin(Math.PI * n) * Math.cos(3 * Math.PI * t), c = q(r, s, -1.06, 1.18, .25, .17), l = n + .11 * Math.sin(Math.PI * t * 1.7) + .19 * i, u = _(l - .374, .174, .181) + _(l - .77, .166, .106), d = 1.17 + .17 * i - .12 * r * r + .044 * Math.sin(Math.PI * n) + u * (1 - .78 * c) - .09 * c - .105 * (1 - K(n, 0, .17)), f = .23 * K(n, .8, 1) + .14 * (1 - K(t, 0, .14)) + .14 * K(t, .88, 1);
		return new e.Vector3(r, s, d - f);
	}, "lap", 5, -1) : f(76, 54, (t, n) => {
		let r = 2 * t - 1, i = 1 - r * r, a = .55 + .22 * n, o = .17 * r * r + .044 * g * r, s = .48 + .83 * n + o, c = n - .22 * r * r + .047 * g * r, l = _(c - .22, .16, .161) + _(c - .59, .155, .118), u = .15 * (1 - K(n, 0, .145)) + .13 * K(n, .8, 1);
		return new e.Vector3(a * r, s, 1.18 + .1 * i + .062 * Math.sin(Math.PI * n) + l - u);
	}, "lap", 5, 1);
	let v = (e, t) => {
		let n = (t - 1.03) / 2.26, r = 0, i = .22;
		for (let t = 0; t < 12; t++) {
			let t = (r + i) * .5;
			hr(0, t, n)[0] < Math.abs(e) ? r = t : i = t;
		}
		return hr(0, (r + i) * .5, n)[2];
	};
	for (let t = 0; t < 4; t++) {
		let n = t * Math.PI / 2, r = [
			[0, 0],
			[0, .097],
			[.092, .097]
		].map(([e, t]) => {
			let r = e * Math.cos(n) - t * Math.sin(n), i = 2.73 + e * Math.sin(n) + t * Math.cos(n);
			return [
				r,
				i,
				v(r, i) + .012
			];
		});
		for (let t = 1; t < r.length; t++) {
			let n = new e.Vector3(...r[t - 1]), i = new e.Vector3(...r[t]), a = new e.BoxGeometry(.024, n.distanceTo(i) + .01, .02);
			a.applyQuaternion(new e.Quaternion().setFromUnitVectors(new e.Vector3(0, 1, 0), i.clone().sub(n).normalize()));
			let o = n.lerp(i, .5);
			l(a.translate(o.x, o.y, o.z));
		}
	}
	o ? f(76, 32, (t, n) => {
		let r = 2 * Math.PI * t, i = .315 + .255 * (1 - K(n, 0, .58)) + .042 * K(n, .64, 1), a = .25 + .07 * K(n, 0, .34) - .054 * K(n, .34, .64);
		return new e.Vector3(i * Math.sin(r), 2.94 + .54 * n, -.18 + a * Math.cos(r));
	}) : u(0, 3.23, -.16, .29, .35, .28);
	for (let e of [-1, 1]) {
		let t = e === h;
		o || u(e * (t ? 1.06 : .49), t ? 1.35 : 1.47, .64, .155, .12, .14);
	}
	let y = {
		gold: s.gold.length,
		crease: s.crease.length,
		hair: s.hair.length
	}, b = (t, n) => {
		let r = 3.29 + n * 1.13, i = 2 * Math.PI * t, a = Math.PI * n, o = Math.sin(a) ** .44 * (.94 + .06 * K(n, .32, .65)), s = .485 * Math.sin(i) * o, c = Math.max(0, Math.cos(i)), l = -.17 + .365 * Math.cos(i) * Math.sin(a) ** .45, u = (r - 3.29) / 1.13, d = .155 * q(s, u, 0, .52, .078, .2) + .079 * q(s, u, 0, .41, .087, .052), f = .054 * (q(s, u, -.23, .39, .12, .16) + q(s, u, .23, .39, .12, .16)), p = -.041 * (q(s, u, -.17, .59, .12, .055) + q(s, u, .17, .59, .12, .055)), m = .039 * q(s, u, 0, .255, .122, .026) + .032 * (q(s, u, -.052, .291, .06, .021) + q(s, u, .052, .291, .06, .021)) - .018 * q(s, u, 0, .218, .11, .022), h = .04 * q(s, u, 0, .14, .22, .095), g = .042 * (q(s, u, -.17, .65, .145, .05) + q(s, u, .17, .65, .145, .05)), _ = .047 * (q(s, u, -.16, .57, .11, .037) + q(s, u, .16, .57, .11, .037)), v = .048 * q(Math.abs(s), u, .082, .407, .043, .042), y = -.021 * q(s, u, 0, .335, .023, .038), b = -.023 * q(Math.abs(s), u, .127, .277, .037, .034), x = .069 * q(s, u, 0, .146, .17, .07), S = .046 * q(Math.abs(s), u, .234, .45, .105, .088) - .029 * q(Math.abs(s), u, .164, .315, .052, .067);
		return l += (d + f + p + m + h + g + _ + v + y + b + x + S) * c ** 5, new e.Vector3(s, r, l);
	};
	if (o) {
		let t = f(194, 184, (t, n) => {
			let { x: r, y: i, z: a } = ar(t, n);
			return new e.Vector3(r, i, a);
		}), n = t.getAttribute("uv"), r = t.getAttribute("normal"), i = t.getAttribute("robeFinish"), a = 25e-5, o = new e.Vector3(), s = new e.Vector3();
		for (let e = 0; e < n.count; e++) {
			let t = n.getX(e), c = n.getY(e), l = ar(t - a, c), u = ar(t + a, c), d = ar(t, Math.max(0, c - a)), f = ar(t, Math.min(1, c + a));
			o.set(u.x - l.x, u.y - l.y, u.z - l.z), s.set(f.x - d.x, f.y - d.y, f.z - d.z), o.cross(s).normalize(), r.setXYZ(e, o.x, o.y, o.z), i.setX(e, 2 + ar(t, c).patina);
		}
		let c = ar(0, .7539999999999996 / 1.13);
		u(0, c.y, c.z + .002, .011, .012, .006);
		for (let t of [-1, 1]) f(50, 42, (n, r) => {
			let i = 2 * Math.PI * (t > 0 ? n : 1 - n), a = Math.sin(Math.PI * r) ** .44, o = .063 + .025 * Math.exp(-((r - .77) ** 2) / .038) + .013 * Math.exp(-((r - .14) ** 2) / .022), s = Math.sin(i), c = Math.cos(i), l = Math.exp(-((s - .67) ** 2) / .041), u = Math.exp(-((r - .68) ** 2) / .046);
			return new e.Vector3(t * (.469 + .025 * r + o * a * s), 3.475 + .644 * r, -.13 + a * (.092 * c + Math.max(c, 0) * u * (.038 * l - .065)));
		});
	} else {
		f(144, 112, b);
		let t = (t, n) => {
			let r = e.MathUtils.clamp((n - 3.29) / 1.13, .01, .99), i = .485 * Math.sin(Math.PI * r) ** .44 * (.94 + .06 * K(r, .32, .65));
			return b(Math.asin(e.MathUtils.clamp(t / i, -.99, .99)) / (2 * Math.PI), r).z;
		};
		for (let n of [-1, 1]) {
			let r = [];
			for (let e = 0; e <= 10; e++) {
				let i = e / 10, a = n * (.057 + i * .292), o = 3.924 - .025 * Math.sin(i * Math.PI) + .038 * i;
				r.push([
					a,
					o,
					t(a, o) + .004
				]);
			}
			d(r, .0095, "crease", 5), f(22, 8, (r, i) => {
				r = n < 0 ? 1 - r : r;
				let a = n * (.057 + .292 * r), o = 3.924 - .025 * Math.sin(Math.PI * r) + .038 * r + .091 * Math.sin(Math.PI * r) * i, s = .034 * Math.sin(Math.PI * r) * Math.sin(Math.PI * i);
				return new e.Vector3(a, o, t(a, o) + s + .001);
			});
			let i = [];
			for (let e = 0; e <= 12; e++) {
				let r = e / 12, a = n * (.047 + r * .305), o = 4.008 + .103 * Math.sin(r * Math.PI * .92) - .009 * r;
				i.push([
					a,
					o,
					t(a, o) + .006
				]);
			}
			d(i, .0115, "crease", 6), u(n * .064, 3.745, t(n * .064, 3.745) + .003, .019, .01, .009, "crease"), u(n * .473, 3.83, -.125, .086, .29, .085), u(n * .492, 3.87, -.041, .035, .16, .014);
			let a = [];
			for (let e = 0; e <= 20; e++) {
				let t = e / 20 * Math.PI * 2;
				a.push([
					n * (.489 + .048 * Math.sin(t)),
					3.83 + .244 * Math.cos(t),
					-.035
				]);
			}
			d(a, .013), u(n * .484, 3.58, -.084, .058, .085, .058);
		}
		let n = [];
		for (let e = 0; e <= 12; e++) {
			let r = (e / 12 - .5) * .29, i = 3.6 + .015 * (r / .12) ** 2 + .004 * Math.cos(r / .12 * Math.PI * 2);
			n.push([
				r,
				i,
				t(r, i) + .003
			]);
		}
		d(n, .007, "crease"), d(n.map(([e, n]) => [
			e,
			n - .014,
			t(e, n - .014) + .004
		]), .008), u(0, 4.015, t(0, 4.015) + .008, .019, .019, .01);
	}
	if (o) {
		let t = (t, n) => {
			let r = 2 * Math.PI * t, i = 4.07 + .09 * Math.cos(r), a = n * Math.PI / 2, o = Math.cos(a), s = Math.cos(r);
			return new e.Vector3(.476 * o * Math.sin(r), i + (4.505 - i) * Math.sin(a), -.17 + o * (s < 0 ? .398 * s : .388 * s ** .77));
		};
		f(90, 34, t, "hair"), u(0, 4.474, -.17, .148, .086, .139, "hair");
		let r = Math.max(3, Math.round(14 * n));
		for (let e = 0; e < r; e++) {
			let i = (e + .5) / r, a = Math.cos(i * Math.PI * .5), o = Math.max(5, Math.round(66 * a * n));
			for (let n = 0; n < o; n++) {
				let r = t((n + e % 2 * .5) / o, i);
				u(r.x, r.y, r.z, .033, .031, .034, "hair");
			}
		}
	} else {
		u(0, 4.23, -.18, .479, .26, .38, "hair"), u(0, 4.44, -.18, .19, .14, .19, "hair");
		let e = Math.max(3, Math.round(10 * n));
		for (let t = 0; t < e; t++) {
			let r = (t + .5) / e * Math.PI * .57, i = Math.sin(r), a = Math.max(6, Math.round(42 * i * n));
			for (let e = 0; e < a; e++) {
				let n = (e + t % 2 * .5) * Math.PI * 2 / a;
				u(.48 * i * Math.sin(n), 4.19 + .3 * Math.cos(r), -.18 + .374 * i * Math.cos(n), .038, .037, .038, "hair");
			}
		}
	}
	for (let e of Object.keys(y)) for (let t of s[e].slice(y[e])) t.translate(0, -3.28, .16), o && t.scale(1.09, 1.045, 1.07), t.rotateX(o ? .072 : .11).translate(0, o ? 3.235 : 3.28, -.16);
	function x(t) {
		let n = t === h, r = n ? 1.34 : t < 0 ? 1.46 : 1.54, i = s.gold.length;
		l(new e.SphereGeometry(1, c, c / 2).scale(.24, .083, .17).translate(t * .23, r, .71));
		for (let n = 0; n < 4; n++) {
			let i = [
				.19,
				.24,
				.22,
				.16
			][n];
			f(12, 16, (a, o) => {
				let s = -t * a * 2 * Math.PI, c = (.041 - .012 * o) * (1 - K(o, .81, 1)) + .002;
				return new e.Vector3(t * (.15 - (.13 + i) * o), r + .015 - .033 * o * o + c * .79 * Math.cos(s), .835 - .077 * n + .038 * Math.sin(Math.PI * o) + c * Math.sin(s));
			});
		}
		if (d([
			[
				t * .35,
				r,
				.63
			],
			[
				t * .26,
				r + .08,
				.69
			],
			[
				t * .14,
				r + .1,
				.75
			],
			[
				t * .032,
				r + .096,
				.76
			]
		], .04), n) for (let e of s.gold.slice(i)) e.translate(-t * .23, -r, -.71).rotateZ(t * .26).rotateY(t * 1.34).rotateX(.52).translate(t * 1.08, 1.34, .78);
	}
	if (o || (x(-1), x(1)), o) {
		let t = (t, n) => {
			let r = new e.CatmullRomCurve3(t.map((t) => new e.Vector3(...t)));
			f(12, 22, (t, i) => {
				let a = r.getPoint(i), o = r.getTangent(i), s = new e.Vector3(0, 1, 0).cross(o).normalize(), c = o.clone().cross(s), l = 2 * Math.PI * t, u = n * (1 - .24 * i) * (1 - K(i, .83, 1));
				return a.addScaledVector(s, u * Math.cos(l)).addScaledVector(c, .84 * u * Math.sin(l));
			}, "gold", 5, t[0][0] > 0 ? -2 : 0);
		}, n = (t, n, r, i) => {
			let a = new e.SphereGeometry(1, c, c / 2).scale(...n).rotateX(r).rotateY(i).translate(...t);
			a.userData.finish = t[0] > 0 ? -2 : 0, l(a);
		};
		n([
			-1.075,
			1.263,
			.835
		], [
			.175,
			.117,
			.237
		], .29, -.1);
		for (let e = 0; e < 4; e++) {
			let n = -1.2 + .075 * e, r = [
				1.09,
				1.145,
				1.154,
				1.116
			][e];
			t([
				[
					n,
					1.285,
					.88
				],
				[
					n - .012,
					1.277,
					1.055
				],
				[
					n - .024,
					1.176,
					r + .055
				],
				[
					n - .006,
					1.033 + .018 * Math.abs(e - 1),
					r
				]
			], .048 - .002 * e);
		}
		t([
			[
				-.988,
				1.286,
				.786
			],
			[
				-.916,
				1.268,
				.854
			],
			[
				-.891,
				1.19,
				.93
			],
			[
				-.91,
				1.153,
				.948
			]
		], .061), n([
			.491,
			1.528,
			.661
		], [
			.159,
			.084,
			.13
		], -.1, -.17), n([
			.349,
			1.523,
			.712
		], [
			.242,
			.098,
			.177
		], -.12, -.18);
		for (let e = 0; e < 4; e++) {
			let n = .847 - .076 * e, r = [
				-.124,
				-.156,
				-.127,
				-.065
			][e];
			t([
				[
					.305,
					1.536,
					n
				],
				[
					.166,
					1.512,
					n + .035
				],
				[
					.014,
					1.534,
					n + .024
				],
				[
					r,
					1.572,
					n - .003
				]
			], .049 - .002 * e);
		}
		t([
			[
				.405,
				1.543,
				.647
			],
			[
				.335,
				1.61,
				.637
			],
			[
				.244,
				1.65,
				.677
			],
			[
				.197,
				1.646,
				.73
			]
		], .055);
		let r = .054, i = 1.54, a = .746;
		l(new e.LatheGeometry([
			[0, 0],
			[.074, .002],
			[.113, .044],
			[.168, .099],
			[.204, .157],
			[.181, .154],
			[.107, .067],
			[0, .048]
		].map(([t, n]) => new e.Vector2(t, n)), c).translate(r, i, a));
		for (let t = 0; t < 2; t++) for (let n = 0; n < 8; n++) {
			let o = (n + t * .5) * Math.PI / 4;
			f(10, 14, (n, s) => {
				let c = 2 * n - 1, l = c * (.012 + .092 * Math.sin(Math.PI * s) ** .75), u = .092 + .105 * s + .033 * Math.sin(Math.PI * s) + .026 * c * c - .03 * t;
				return new e.Vector3(r + u * Math.sin(o) + l * Math.cos(o), i + .04 + .195 * s + .035 * t - .025 * c * c, a + u * Math.cos(o) - l * Math.sin(o));
			});
		}
	} else t === 2 && u(-.16, 1.69, .73, .16, .157, .15);
	let S = new e.Group();
	for (let n of Object.keys(s)) {
		if (!s[n].length) continue;
		let c = new e.MeshStandardMaterial({
			name: "hall-authored-buddha-" + n,
			color: n === "lap" ? 13739106 : n === "gold" ? 12684105 : n === "hair" ? o ? 9925444 : 4730908 : 5846307,
			metalness: n === "lap" ? .57 : n === "gold" ? .77 : .55,
			roughness: n === "lap" ? .51 : n === "gold" ? .7 : o ? .4 : .56
		});
		(n === "gold" || n === "lap") && (c.roughnessMap = r, c.bumpMap = r, c.bumpScale = 65e-5, c.normalMap = a, c.normalScale.set(.82, .82));
		let l = o && n === "gold";
		c.onBeforeCompile = (e) => {
			e.uniforms.uChasedDetail = { value: i }, e.vertexShader = "attribute float sculptVisibility; varying float vVisibility; varying vec3 vSculpt;\n" + e.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvVisibility=sculptVisibility; vSculpt=position;"), e.fragmentShader = "uniform sampler2D uChasedDetail; varying float vVisibility; varying vec3 vSculpt;\n" + e.fragmentShader.replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n          #ifdef USE_ROUGHNESSMAP\n            vec2 detailUV=vec2(vSculpt.x/4.1+.5,vSculpt.y/4.7);\n            #ifdef CENTRAL_CARVING\n              if(vSculpt.y>3.36){\n                vec2 yz=vSculpt.yz-vec2(3.28,-.16);\n                detailUV.y=(3.28+cos(.11)*yz.x+sin(.11)*yz.y)/4.7;\n              }\n            #endif\n            float chased=(texture2D(uChasedDetail,detailUV).r-.502)*2.55;\n            float face=smoothstep(3.29,3.47,vSculpt.y)*(1.-smoothstep(4.11,4.24,vSculpt.y));\n            float mantle=smoothstep(1.48,1.68,vSculpt.y)*(1.-smoothstep(3.07,3.22,vSculpt.y));\n            float front=smoothstep(-.04,.16,vSculpt.z);\n            float widthFade=1.-smoothstep(.33,.47,abs(vSculpt.x));\n            diffuseColor.rgb*=exp(chased*front*(.95*face*widthFade+.65*mantle));\n            float oxide=texture2D(roughnessMap,vRoughnessMapUv).b;\n            float lap=1.-smoothstep(1.2,1.6,vSculpt.y);\n            float carvedHem=smoothstep(.36,.52,vSculpt.y)*(1.-smoothstep(1.21,1.42,vSculpt.y));\n            diffuseColor.rgb*=exp(.19*chased*front*carvedHem);\n            float chinShade=1.-vVisibility;\n            diffuseColor.rgb *= mix(vec3(1.),vec3(.56,.36,.27),clamp(oxide+.70*chinShade+.13*lap,0.,1.));\n            roughnessFactor=clamp(roughnessFactor+.12*chinShade-.045*smoothstep(3.3,3.7,vSculpt.y),.27,.64);\n            #ifdef CENTRAL_CARVING\n              float cheek=smoothstep(3.42,3.72,vSculpt.y)*(1.-smoothstep(4.12,4.28,vSculpt.y));\n              float breast=exp(-pow(abs(vSculpt.x)/.49,2.)-pow(abs(vSculpt.y-2.73)/.51,2.));\n              float hand=exp(-pow(abs(vSculpt.x)/.54,2.)-pow(abs(vSculpt.y-1.48)/.14,2.))*front;\n              roughnessFactor=clamp(roughnessFactor+.165*breast+.065*(1.-cheek)-.080*cheek-.047*hand,.24,.69);\n              diffuseColor.rgb*=mix(vec3(.98,.94,.91),vec3(1.20,1.16,1.09),cheek);\n              roughnessFactor-=.055*hand;\n              diffuseColor.rgb*=1.+.09*cheek*front;\n            #endif\n            #ifdef LOTUS_BEARER\n              // Smoother gold leaf across the face, with darker rubbed recesses in the lap.\n              float skin=face*widthFade*front;\n              diffuseColor.rgb*=exp(-chased*front*(.72*face*widthFade+.43*mantle));\n              diffuseColor.rgb*=mix(vec3(1.07,1.11,1.02),vec3(1.20,1.22,1.04),skin);\n              roughnessFactor=mix(roughnessFactor,.43,.66*skin);\n              roughnessFactor=mix(roughnessFactor,.51,.55*breast);\n            #endif\n          #endif").replace("#include <aomap_fragment>", "#include <aomap_fragment>\n          reflectedLight.indirectDiffuse*=.29+.55*vVisibility;\n          reflectedLight.indirectSpecular*=.19+.76*vVisibility;\n          // The indoor probe includes vermilion columns. Soften the red\n          // contribution on worn gilding, especially below the cheek and knees.\n          float warmRebound=max(0.,reflectedLight.indirectSpecular.r-2.20*reflectedLight.indirectSpecular.g);\n          reflectedLight.indirectSpecular+=warmRebound*vec3(-.38,.22,.055);\n          reflectedLight.directDiffuse*=.63+.37*vVisibility;\n          reflectedLight.directSpecular*=.33+.67*vVisibility;"), n === "lap" && (e.vertexShader = "varying float vFoldCrown;\n" + e.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvFoldCrown=smoothstep(.10,.63,normal.y)*(1.-smoothstep(.81,1.,normal.y))*smoothstep(.0,.47,normal.z);"), e.fragmentShader = "varying float vFoldCrown;\n" + e.fragmentShader.replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\n            float crown=clamp(vFoldCrown,0.,1.);\n            // Gold leaf stays cleaner on the rolled lip; oxidation collects in the return.\n            float leaf=texture2D(roughnessMap,vRoughnessMapUv*.68).g;\n            float worn=crown*crown*(.43+.48*smoothstep(.18,.79,leaf));\n            diffuseColor.rgb=mix(diffuseColor.rgb,diffuse*vec3(1.19,1.12,1.01),.06+.58*worn);\n            diffuseColor.rgb*=.98+.12*worn+.18*(leaf-.5);\n            roughnessFactor=mix(.54,.39,worn)+.10*(leaf-.5)+.05*(1.-vVisibility);\n            metalnessFactor=mix(.70,.50,worn);")), n === "lap" && (e.vertexShader = "attribute vec2 apronUv; varying vec2 vApronUv;\n" + e.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvApronUv=apronUv;"), e.fragmentShader = "varying vec2 vApronUv;\n" + e.fragmentShader.replace("#include <normal_fragment_begin>", "\n            #ifdef FLANKING_LAP\n              if(vApronUv.x>=0. || vSculpt.z>.12){\n            #else\n              if(vApronUv.x>=0.){\n            #endif\n              // Lay the leaf along the two curved hems. Sample the existing finish at\n              // two physical scales so broad losses survive minification at the door.\n              float lateral=2.*vApronUv.x-1.;\n              vec2 cloth=vec2(vApronUv.x,vApronUv.y-.22*lateral*lateral+.047*lateral);\n              vec2 patchScale=vec2(1.35,1.11),flakeScale=vec2(6.1,7.3),offset=vec2(.29,.17);\n              float wearBias=0.,polish=1.;\n              #ifdef FLANKING_LAP\n                bool panel=vApronUv.x>=0.;\n                #ifdef LOTUS_BEARER\n                  // Short breaks in the folded breadth pinched beneath the resting palm.\n                  cloth.y=vApronUv.y+.11*sin(5.34*vApronUv.x)+.19*sin(3.14159*vApronUv.x);\n                  patchScale=vec2(1.62,1.14);flakeScale=vec2(8.1,6.6);offset=vec2(.67,.34);\n                  float pinched=exp(-dot((vSculpt.xy-vec2(-.96,1.06))*vec2(2.25,3.4),\n                                         (vSculpt.xy-vec2(-.96,1.06))*vec2(2.25,3.4)));\n                  wearBias=.014+.047*pinched;\n                  polish=.84+.15*(1.-pinched);\n                #else\n                  // Longer intact arcs towards the outside of the raised knee.\n                  patchScale=vec2(.98,1.65);flakeScale=vec2(5.4,9.6);offset=vec2(.13,.81);\n                  wearBias=.018-.058*smoothstep(.22,1.63,vSculpt.x);\n                  polish=.90+.31*smoothstep(-.25,1.45,vSculpt.x);\n                #endif\n                if(!panel){\n                  float sweep=vSculpt.y-.20*pow(abs(vSculpt.x)/1.96,1.65);\n                  cloth=vec2(.53*vSculpt.x+.18*vSculpt.z,sweep+.11*vSculpt.z);\n                }\n              #endif\n              vec3 islands=texture2D(roughnessMap,cloth*patchScale+offset).rgb;\n              vec3 flakes=texture2D(roughnessMap,cloth*flakeScale+vec2(.17,.68)).rgb;\n              float coverage=.60*islands.b+.40*flakes.b+.37*(flakes.r-.50);\n              float missing=smoothstep(.217,.335,coverage+wearBias);\n              float crest=clamp(vFoldCrown,0.,1.);\n              float intact=(1.-missing)*crest*polish;\n              float abrasion=missing*(.32+.68*crest);\n              diffuseColor.rgb*=mix(vec3(1.),vec3(.62,.58,.51),abrasion);\n              diffuseColor.rgb*=1.+intact*(.11+.31*flakes.r);\n              roughnessFactor=clamp(roughnessFactor+.14*abrasion-.064*intact,.28,.79);\n              metalnessFactor=mix(metalnessFactor,.49,abrasion);\n            }\n            #include <normal_fragment_begin>")), l && (e.vertexShader = "attribute float robeFinish; varying float vRobeFinish;\n" + e.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvRobeFinish=robeFinish;"), e.fragmentShader = "varying float vRobeFinish;\n" + e.fragmentShader.replace("#include <aomap_fragment>", "#include <aomap_fragment>\n            // Cut and darkened lines in gilding return much less of the hall\n            // reflection than the rounded lid, even along a grazing view.\n            float cutPatina=smoothstep(.065,.85,clamp(vRobeFinish-2.,0.,1.));\n            reflectedLight.directSpecular*=1.-.94*cutPatina;\n            reflectedLight.indirectSpecular*=1.-.95*cutPatina;\n            reflectedLight.directDiffuse*=1.-.48*cutPatina;\n          ").replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\n            float faceSurface=step(1.5,vRobeFinish);\n            float sleeveFinish=clamp(vRobeFinish,0.,1.)*(1.-faceSurface);\n            float engraving=clamp(vRobeFinish-2.,0.,1.);\n            diffuseColor.rgb*=mix(vec3(1.),vec3(.092,.058,.034),engraving);\n            diffuseColor.rgb*=mix(vec3(1.),vec3(1.25,1.29,1.10),faceSurface*(1.-engraving));\n            roughnessFactor=mix(roughnessFactor,.45+.15*engraving,.82*faceSurface);\n            metalnessFactor=mix(metalnessFactor,.67-.22*engraving,faceSurface);\n            float hemFinish=1.-min(1.,abs(vRobeFinish+1.));\n            float handFinish=max(0.,-vRobeFinish-1.);\n            diffuseColor.rgb*=mix(vec3(1.),vec3(.76,.71,.64),sleeveFinish);\n            diffuseColor.rgb*=exp(-.15*chased*front*carvedHem*hemFinish);\n            diffuseColor.rgb*=mix(vec3(1.),vec3(1.16,1.12,1.02),hemFinish);\n            roughnessFactor=mix(roughnessFactor,.57,.64*sleeveFinish+.48*hemFinish);\n            diffuseColor.rgb*=mix(vec3(1.),vec3(1.48,1.40,1.16),handFinish);\n            roughnessFactor=mix(roughnessFactor,.36,handFinish);\n            metalnessFactor=mix(metalnessFactor,.60,handFinish);\n          "));
		}, c.defines = {
			...c.defines ?? {},
			CENTRAL_CARVING: 1,
			...n === "lap" && t !== 0 ? { FLANKING_LAP: 1 } : {},
			...o ? { LOTUS_BEARER: 1 } : {}
		}, c.customProgramCacheKey = () => n === "lap" ? t === 0 ? "hall-central-apron-leaf-1" : "hall-flanking-apron-leaf-1" : l ? "hall-lotus-face-1" : "hall-gilding-visibility-1";
		let u = new e.Mesh(B(z(s[n]), .72), c);
		u.castShadow = !0, u.receiveShadow = !0, S.add(u);
	}
	return S;
}
function _r(t, n, r, i) {
	let a = new e.LOD();
	return a.addLevel(gr(t, .76, n, r, i), 0), a.addLevel(gr(t, .38, n, r, i), 20, .12), a.addLevel(gr(t, .12, n, r, i), 40, .12), Qn(a), $n(a), a;
}
//#endregion
//#region src/world/main_hall_study.ts
function vr(t, n) {
	let r = new e.Group();
	r.name = "lingyin-main-hall-interior";
	let i = F.temple.x, a = F.temple.z, o = F.platform.y + C, s = F.platform.y + 9.72 + 1, c = (S.w - 3.25) / ee.x, l = (S.d - 3.25) / ee.z, u = F.platform.y + 9.9 + 1;
	function d() {
		let s = t.materials.mainRoof;
		s instanceof e.MeshStandardMaterial && (s.map = n.redRoof, s.normalMap = null, s.bumpMap = n.redRoof, s.bumpScale = .035, s.color.set("#c5a89f"), s.roughness = .88, s.needsUpdate = !0);
		let c = u + 1.55;
		x("darkWood", 24, 2.5, .09, 0, c, 7.45);
		for (let e of [
			-9.2,
			-5.1,
			5.1,
			9.2
		]) {
			x("teal", 3.5, 1.45, .055, e, c, 7.52);
			for (let t = -4; t <= 4; t++) x("darkWood", .055, 1.43, .06, e + t * .39, c, 7.57);
			for (let t = -1; t <= 1; t++) x("gilt", 3.5, .035, .06, e, c + t * .48, 7.58);
		}
		for (let e of [
			-12,
			-7.15,
			-3.25,
			3.25,
			7.15,
			12
		]) x("lacquer", .36, 2.56, .32, e, c, 7.69), x("gilt", .47, .07, .37, e, u + .29, 7.69);
		let l = Hn(n.paintedBeam), d = new e.MeshStandardMaterial({
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
			x("teal", t + .1, n + .06, .16, 0, r, o - .1), x("gilt", t + .12, .035, .17, 0, r - n / 2 - .04, o - .09), x("gilt", t + .12, .035, .17, 0, r + n / 2 + .04, o - .09);
			let s = new e.PlaneGeometry(t, n), c = s.getAttribute("uv");
			for (let e = 0; e < c.count; e++) c.setX(e, c.getX(e) * Math.round(t / 3.1));
			s.translate(i, r, a + o), f.push(s);
		}
		let { x: m, z: g } = ee, _ = (S.d / 2 - 1.35 + .15) / g, v = _ + .064, y = zn(S).filter((e) => e.z > 0 && e.z === S.d / 2 - .9), C = (S.d / 2 - .9) / g, w = u - 1.33;
		x("darkWood", S.w / m, .94, .63, 0, w, C);
		let E = 9.58 * g, O = Un(y.map((e) => e.x), C * g, E, l);
		O.scale.set(1 / m, 1, 1 / g), O.position.set(i, w, a + C), r.add(O);
		for (let t = 0; t < y.length; t++) {
			let n = y[t].x / m;
			if (t + 1 === y.length) continue;
			let r = (y[t + 1].x - y[t].x) / m, o = n + r / 2, s = new e.PlaneGeometry(r - .21, .69);
			s.translate(i + o, w, a + C + .325), f.push(s);
			let c = new e.PlaneGeometry(r - .21, .69);
			c.rotateY(Math.PI), c.translate(i + o, w, a + C - .319);
			let l = new e.PlaneGeometry(r - .14, .56);
			l.rotateX(Math.PI / 2), l.translate(i + o, w - .473, a + C), f.push(c, l);
			let d = new e.PlaneGeometry(r - .05, .46);
			d.rotateX(Math.PI / 2), d.translate(i + o, u - .929, a + 9.52), x("darkWood", r, .16, .49, o, u - .845, 9.52), f.push(d);
			for (let e of [-.395, .395]) x("teal", r, .075, .075, o, w + e, C + .34);
			x("gilt", .075, .74, .07, n + .09, w, C + .34);
		}
		for (let t of [-1, 1]) {
			let n = new e.PlaneGeometry(25.4 / g, .7), r = n.getAttribute("uv");
			for (let e = 0; e < r.count; e++) r.setX(e, r.getX(e) * 7);
			n.rotateY(t * Math.PI / 2);
			let o = t * (S.w / 2 + .38) / m;
			n.translate(i + o, u - .48, a), f.push(n), x("teal", .14, .82, 25.4 / g, o - t * .085, u - .48, 0);
		}
		let k = new e.Mesh(z(f), d);
		k.name = "hall-exterior-painted-eaves", k.receiveShadow = !0, r.add(k);
		for (let t of [-9.2, 9.2]) {
			let n = o + 3.18, s = _ + .037, c = new e.Mesh(new e.CircleGeometry(1.16, 48), p);
			c.name = "hall-exterior-round-window", c.position.set(i + t, n, a + s), r.add(c);
			let l = new e.Mesh(new e.RingGeometry(1.12, 1.25, 48), h);
			l.position.set(i + t, n, a + s + .066), r.add(l);
			for (let e of [
				-.81,
				-.54,
				-.27,
				0,
				.27,
				.54,
				.81
			]) {
				let r = 2 * Math.sqrt(1.13 ** 2 - e ** 2);
				x("teal", .042, r, .044, t + e / m, n, s + .041), x("teal", r / m, .045, .042, t, n + e, s + .032);
			}
		}
		let A = (e, t, n, r, i, a, s) => x(e, t / m, n, r / g, i / m, o + a, s / g);
		for (let e of D()) A(e.role === "lacquer" ? "portalWood" : e.role, e.w, e.h, e.d, e.x, e.y, e.z);
		let { halfClear: j, clearHeight: M, wallZ: N, leafDepth: te } = T;
		A("gilt", 2 * j + .84, .044, .674, 0, M + .13, N);
		for (let t of [-1, 1]) {
			for (let e = 0; e < 6; e++) {
				let n = j / 6, r = t * (e + .5) * n, i = M + .795;
				A("teal", .055, .81, .1, r, i, N), A("teal", n - .055, .064, .1, r + t * n / 2, i + .14, N), A("portalWood", .062, .29, .12, r + t * n * .7, i - .005, N), A("teal", n * .31, .057, .11, r + t * n * .55, i - .15, N);
			}
			let n = t * j, r = N - .08 - te / 2;
			for (let s of [-1, 1]) {
				let c = n + t * (s === 1 ? T.leafThickness + .022 : -.022);
				for (let e of [
					.25,
					2.08,
					4.95,
					M - .22
				]) A("darkWood", .045, .14, te - .14, c, e, r);
				for (let e of [-1.62, 1.62]) A("darkWood", .046, M - .2, .13, c, M / 2, r + e);
				for (let t = 0; t < 3; t++) for (let n = 0; n < 5; n++) {
					let s = new e.SphereGeometry(.058, 10, 7).scale(.56 / m, 1, 1 / g);
					s.translate(i + c / m, o + 2.5 + t * .8, a + (r + (n - 2) * .62) / g), b.bronze.push(s);
				}
			}
			let s = N - te + .47;
			A("bronze", .048, .32, .24, n - t * .044, 1.65, s);
			let c = new e.TorusGeometry(.108, .022, 8, 24).rotateY(Math.PI / 2).scale(1 / m, 1, 1 / g);
			c.translate(i + (n - t * .085) / m, o + 1.54, a + s / g), b.bronze.push(c);
		}
		for (let e of [-1, 1]) {
			let t = e * T.flankX / m, n = .96;
			for (let e = 0; e < 4; e++) {
				let r = t + (e - 1.5) * n;
				x("darkWood", n - .012, 5.04, .1, r, o + 2.54, v);
				for (let e of [-.445, .445]) x("lacquer", .072, 5.04, .09, r + e, o + 2.54, v + .063);
				for (let e of [
					.12,
					1.48,
					1.98,
					4.96
				]) x("lacquer", n - .11, .14, .085, r, o + e, v + .066);
				x("lacquer", .66, 1.08, .065, r, o + .81, v + .057), x("lacquer", .67, .28, .063, r, o + 1.73, v + .055);
				for (let e of [
					-.28,
					-.14,
					0,
					.14,
					.28
				]) x("lacquer", .035, 2.83, .04, r + e, o + 3.48, v + .076);
				for (let e = 0; e < 12; e++) x("lacquer", .8, .033, .04, r, o + 2.15 + e * .236, v + .062);
			}
			for (let e of [-2.01, 2.01]) x("lacquer", .17, 5.3, .18, t + e, o + 2.65, v + .016);
			x("lacquer", 4.18, .2, .19, t, o + 5.24, v + .016);
		}
	}
	let f = new e.MeshStandardMaterial({
		name: "hall-worn-cinnabar-lacquer",
		map: n.redLacquer,
		roughness: .51,
		metalness: .02
	}), p = St(!0);
	p.name = "hall-carved-dark-wood", p.color.set("#aa9381"), p.roughness = .9;
	let m = Et();
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
	}), _ = new e.MeshStandardMaterial({
		name: "hall-portal-cinnabar",
		map: n.redLacquer,
		color: 16777215,
		roughness: .59,
		metalness: .045
	});
	_.onBeforeCompile = (e) => {
		e.fragmentShader = e.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\n      float woodValue=dot(diffuseColor.rgb,vec3(.27,.62,.11));\n      diffuseColor.rgb=vec3(.235,.034,.017)*(.80+.46*sqrt(clamp(woodValue,0.,1.)));\n    ");
	}, _.customProgramCacheKey = () => "hall-portal-painted-timber";
	let v = p.clone();
	v.name = "hall-rubbed-altar-hardwood", v.color.setHex(14794917), v.roughness = .51, v.onBeforeCompile = (e) => {
		e.fragmentShader = e.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\ndiffuseColor.rgb=vec3(.060,.023,.011)+diffuseColor.rgb*.76;");
	}, v.customProgramCacheKey = () => "hall-altar-waxed-hardwood";
	let y = {
		lacquer: f,
		darkWood: p,
		teal: m,
		gilt: h,
		bronze: g,
		portalWood: _,
		altarTimber: v,
		altarStone: new e.MeshStandardMaterial({
			name: "hall-honed-altar-limestone",
			map: n.altarStone,
			color: 14800573,
			roughness: .77
		})
	}, b = {
		lacquer: [],
		darkWood: [],
		teal: [],
		gilt: [],
		bronze: [],
		portalWood: [],
		altarTimber: [],
		altarStone: []
	}, x = (e, t, n, r, o, s, c) => b[e].push(L(t, n, r, i + o, s, a + c)), w = (e, t, n, r, o, s, c, l = 24) => b[e].push(R(t, n, r, l, i + o, s, a + c));
	d();
	let E = Gn(n.altarStone, c - .08, l - .08);
	E.vertexColors = !1;
	let O = new e.Mesh(new e.PlaneGeometry(c - .08, l - .08), E);
	O.name = "hall-stone-floor", O.rotation.x = -Math.PI / 2, O.position.set(i, o + .04, a), O.receiveShadow = !0, r.add(O), x("darkWood", c - .08, .16, l - .08, 0, s + .12, 0), r.add(Kn(n.sanctumCraft, n.coffer, n.altarStone, i, a, o, s, c, l));
	for (let [e, t] of jn) {
		for (let n of Mn) w(n.role, n.rt, n.rb, n.h, e, F.platform.y + 1 + n.y, t, n.segments);
		for (let n = 0; n < 3; n++) {
			let r = s - .44 + n * .16, i = .85 + n * .25;
			x("teal", 2 * i, .16, .58, e, r, t), x("teal", .62, .16, 2 * i, e, r + .07, t), x("gilt", 2 * i, .025, .06, e, r - .09, t + .29);
		}
	}
	let k = new e.MeshStandardMaterial({
		name: "hall-daylit-paper",
		color: "#e4d5b7",
		roughness: 1,
		emissive: "#fff0d0",
		emissiveIntensity: .76,
		side: e.DoubleSide
	}), A = [];
	for (let t of [-1, 1]) for (let n of [
		-3.75,
		0,
		3.75
	]) {
		let r = t * (c / 2 - .22), s = o + 4.18, l = new e.PlaneGeometry(2.7, 5.5);
		l.rotateY(-t * Math.PI / 2), l.translate(i + r, s, a + n), A.push(l);
		for (let e of [-1.39, 1.39]) x("darkWood", .12, 5.7, .13, r - t * .08, s, n + e);
		for (let e of [-2.82, 2.82]) x("darkWood", .12, .14, 2.85, r - t * .08, s + e, n);
		for (let e = -3; e <= 3; e++) x("darkWood", .045, 5.5, .045, r - t * .13, s, n + e * .36);
		for (let e = -6; e <= 6; e++) x("darkWood", .045, .045, 2.7, r - t * .13, s + e * .4, n);
	}
	let j = new e.Mesh(z(A), k);
	j.name = "hall-daylit-lattice-windows", r.add(j);
	for (let e of [-1, 1]) x("darkWood", .18, 1.05, l - .25, e * (c / 2 - .12), o + .57, 0), x("gilt", .035, .035, l - .25, e * (c / 2 - .19), o + 1.12, 0);
	for (let e of Ln) x(e.name.startsWith("altar-stone-") ? "altarStone" : e.name.startsWith("altar-") ? "altarTimber" : e.role, e.w, e.h, e.d, e.x, o + e.y, e.z);
	x("teal", 18, .8, .42, 0, s - .65, -6.23);
	for (let e of [
		-H.pitch,
		0,
		H.pitch
	]) {
		let t = e === 0, s = qn(n.aureoleArt);
		s.position.set(i + e, o + 5.06, a + H.backZ + .43), r.add(s);
		let c = _r(e === 0 ? 0 : e < 0 ? 1 : 2, n.giltLeaf, n.chasedDetail, n.centralRobe);
		c.scale.setScalar(H.scale), c.position.set(i + e, o + H.seatY, a + H.statueZ), c.name = t ? "hall-central-buddha" : "hall-flanking-buddha", r.add(c);
	}
	let M = V;
	for (let t of [-1, 1]) {
		let n = new e.Shape();
		n.moveTo(0, 0), n.lineTo(.54, 0), n.lineTo(.54, -.047), n.bezierCurveTo(.43, -.046, .43, -.127, .325, -.12), n.bezierCurveTo(.22, -.107, .175, -.218, .12, -.268), n.lineTo(0, -.268), n.closePath();
		let r = new e.ExtrudeGeometry(n, {
			depth: .078,
			bevelEnabled: !0,
			bevelThickness: .008,
			bevelSize: .009,
			bevelSegments: 2,
			curveSegments: 10
		});
		t > 0 && r.rotateY(Math.PI), r.translate(i + t * M.legX, o + M.top - .188, a + M.z + M.legZ + (t > 0 ? .039 : -.039)), b.altarTimber.push(r), x("altarTimber", .08, .14, 2 * M.legZ, t * M.legX, o + M.top - .15, M.z);
		for (let e of [-1, 1]) {
			let n = t * M.legX, r = M.z + e * M.legZ;
			x("altarTimber", .24, .072, .22, n, o + .08, r), x("altarTimber", .215, .045, .204, n, o + M.top - .26, r);
		}
	}
	x("altarTimber", M.w - .06, .036, .041, 0, o + M.top - .065, M.z + M.d / 2);
	let N = n.carvedAltar.clone();
	N.wrapS = e.RepeatWrapping, N.repeat.set(2, 1), N.needsUpdate = !0;
	let te = new e.Mesh(new e.PlaneGeometry(2 * M.legX - .2, .14), new e.MeshStandardMaterial({
		name: "hall-carved-altar-front",
		map: N,
		color: 15850691,
		bumpMap: N,
		bumpScale: .006,
		roughness: .56,
		metalness: .025,
		side: e.DoubleSide
	}));
	te.name = "hall-carved-altar-front", te.position.set(i, o + M.top - .155, a + M.z + M.legZ + .041), r.add(te);
	for (let e of [
		-1.74,
		-.99,
		.99,
		1.74
	]) w("bronze", .095, .13, .054, e, o + M.top + .027, M.z - .06, 20), w("gilt", .075, .051, .091, e, o + M.top + .0995, M.z - .06, 16), w("bronze", .134, .072, .091, e, o + M.top + .1905, M.z - .06, 24);
	for (let e of [
		-H.pitch,
		0,
		H.pitch
	]) {
		let t = H.statueZ + 1.315;
		x("darkWood", 4.66, .052, .072, e, o + .976, t), x("bronze", 4.48, .022, .042, e, o + .927, t + .006), x("darkWood", 4.52, .066, .058, e, o + .674, t);
	}
	let ne = yr(g, h, i + Pn.x, o, a + Pn.z);
	ne.scale.setScalar(Pn.scale), ne.position.set((i + Pn.x) * (1 - Pn.scale), o * (1 - Pn.scale) + Pn.baseY, (a + Pn.z) * (1 - Pn.scale)), r.add(ne);
	for (let t of [
		-H.pitch,
		0,
		H.pitch
	]) {
		let n = new e.SpotLight(t > 0 ? 16771020 : 16768951, t === 0 ? 51 : 46, 13, .59, .83, 2);
		n.name = "hall-statue-wash", n.position.set(i + t - 1.42, o + 7.62, a - 2.32), n.target.position.set(i + t, o + 4.69, a + H.statueZ), t === 0 && (n.position.set(i - 1.58, o + 7.68, a - 2.06), n.target.position.set(i, o + 5.58, a + H.statueZ), n.angle = .615, n.penumbra = .8, n.intensity = 61), t < 0 && (n.position.set(i + t - 1.94, o + 7.84, a - 1.96), n.target.position.set(i + t, o + 5.58, a + H.statueZ), n.angle = .65, n.penumbra = .88, n.intensity = 82), r.add(n, n.target);
	}
	for (let t of Object.keys(b)) {
		if (!b[t].length) continue;
		let n = z(b[t]), i = t === "lacquer" || t === "portalWood" ? B(n, 2.4) : t === "altarStone" ? B(n, 1.36) : t === "darkWood" || t === "teal" || t === "altarTimber" ? B(n, .9) : n;
		(t === "lacquer" || t === "darkWood" || t === "teal") && (wn(i, "wood", o), y[t].vertexColors = !0);
		let a = new e.Mesh(i, y[t]);
		a.name = "hall-structure-" + t, a.receiveShadow = !0, r.add(a);
	}
	let re = new e.Group();
	re.name = "main-hall-expanded-layout";
	let { x: ie, z: P } = ee, ae = (t, n) => {
		let i = new e.Group();
		i.name = `${t.name}-proportion-pivot`, i.position.copy(n), i.scale.set(1 / ie, 1, 1 / P), t.position.sub(n), r.remove(t), i.add(t), r.add(i);
	};
	for (let t of [...r.children]) (t instanceof e.LOD || t.name === "hall-statue-halo" || t.name === "hall-exterior-round-window" || t instanceof e.Mesh && t.geometry.type === "RingGeometry") && ae(t, t.position.clone());
	ae(ne, new e.Vector3(i + Pn.x, o, a + Pn.z));
	for (let e of [...r.children]) r.remove(e), re.add(e);
	return re.scale.set(ie, 1, P), re.position.set(i * (1 - ie), 0, a * (1 - P)), r.add(re), r.userData.expandedLayout = {
		width: S.w,
		depth: S.d,
		centerZ: a,
		statueProportionsPreserved: !0
	}, r;
}
function yr(t, n, r, i, a) {
	let o = new e.Group();
	o.name = "hall-tripod-incense-burner";
	let s = In.map(([t, n]) => new e.Vector2(t, n)), c = new e.Mesh(new e.LatheGeometry(s, 28), t);
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
var br = [{
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
function xr(e) {
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
function Sr(t, n) {
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
	o.name = "small-hall-limewash", o.color.set("#dfd7be"), o.vertexColors = !0, o.map = ot(), o.bumpMap = o.map, o.bumpScale = .009, o.normalMap = null, o.roughnessMap = null, o.roughness = .98;
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
		map: ot(),
		bumpMap: ot(),
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
	for (let t of br) {
		let r = t.plinth + .25, a = t.w / 2 - 1.35 - .18, o = t.d / 2 - 1.35 - .18, s = t.eave - t.plinth - .38, c = s - r, l = (n, r, a = 16777215) => {
			if ((n === "timber" || n === "plaster") && (r = B(r, n === "timber" ? .8 : 2.4)), n === "paint" || n === "carving") {
				let t = f[n].map, i = r.getAttribute("uv");
				r.computeBoundingBox();
				let a = r.boundingBox.getSize(new e.Vector3()).length(), o = Math.max(1, a / 2.8);
				for (let e = 0; e < i.count; e++) i.setXY(e, (i.getX(e) * o - t.offset.x) / t.repeat.x, (i.getY(e) - t.offset.y) / t.repeat.y);
			}
			f[n].vertexColors && !r.hasAttribute("color") && p(r, a), r.rotateY(t.rot), r.translate(t.x, F.platform.y, t.z), i[n].push(r);
		}, u = (e, t, n, r, i, a, o, s) => l(e, L(t, n, r, i, a, o), s), d = (t, n, r, i, a, o, s = 0, c) => {
			let u = new e.PlaneGeometry(n, r);
			u.rotateY(s), u.translate(i, a, o), l(t, u, c);
		}, m = new e.PlaneGeometry(a * 2, o * 2, Math.ceil(a * 2 / .8), Math.ceil(o * 2 / .8));
		m.rotateX(-Math.PI / 2), m.translate(0, r + .034, 0);
		let h = m.attributes.uv, g = m.attributes.position;
		for (let e = 0; e < g.count; e++) h.setXY(e, g.getX(e) / (3.3 * n.stoneFloor.repeat.x), g.getZ(e) / (3.3 * n.stoneFloor.repeat.y));
		p(m, 16777215);
		let _ = m.getAttribute("color"), v = t.furniture.map(xr);
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
		for (let e of t.furniture) Cr(e, r, l);
		if (t.name !== "west") {
			let e = t.name === "rear" ? 5.1 : 3.8, n = t.name === "rear" ? 2.65 : 2.12, i = r + (t.name === "rear" ? 2.05 : 1.7), a = -o + .075;
			u("timber", e + .22, n + .22, .085, 0, i, a), d("paper", e + .09, n + .09, 0, i, a + .047, 0, 13153933), d("mural", e, n, 0, i, a + .053);
		}
	}
	let m = 0;
	for (let t of Object.keys(i)) {
		let n = z(i[t]), a = new e.Mesh(n, f[t]);
		a.name = `small-halls-${t}`, a.receiveShadow = !0, a.castShadow = !1, r.add(a), m += (n.index?.count || n.attributes.position.count) / 3;
	}
	return r.userData = {
		halls: br.length,
		batches: r.children.length,
		triangles: m,
		addedLights: 0,
		addedDownloads: 0
	}, r;
}
function Cr(t, n, r) {
	let i = (e, i, a) => {
		i.rotateY(t.rot), i.translate(t.x, n, t.z), r(e, i, a);
	}, a = (e, t, n, r, a, o, s, c) => i(e, L(t, n, r, a, o, s), c), o = (t, n, r, a, o, s, c) => i(t, new e.PlaneGeometry(n, r).translate(a, o, s), c), { w: s, d: c, h: l } = t;
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
			let e = L(.68, .045, .36, 0, 0, 0);
			e.rotateX(-.12), e.translate(0, l + .008, 0), i("paper", e, 13154189);
		} else for (let e of [-1, 1]) i("timber", R(.12, .16, .055, 10, e * s * .32, l + .01, 0)), i("paper", R(.1, .08, .08, 10, e * s * .32, l + .065, 0), 9350314);
		else a("paper", .52, .065, .36, -s * .18, l + .01, 0, 12366739), a("paper", .34, .035, .33, s * .2, l + .006, 0, 10199951);
	}
}
//#endregion
//#region src/world/static_collision.ts
function wr(e) {
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
function Tr(t) {
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
			let t = o.min.y + s * e / 6, i = o.min.y + s * (e + 1) / 6, c = wr(a.filter((e) => e.y >= t - .06 && e.y <= i + .06).map((e) => ({
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
var Er = /* @__PURE__ */ new Map(), Dr = null;
function Or() {
	if (["127.0.0.1", "localhost"].includes(location.hostname) && new URLSearchParams(location.search).get("bakeLingyinTextures") === "1") return Promise.resolve();
	if (Dr) return Dr;
	let t = new e.TextureLoader();
	return Dr = Promise.all([
		"forest-atlas",
		"gate-atlas",
		"gate-paving"
	].map(async (n) => {
		let r = await t.loadAsync(new URL(`./assets/lingyin/runtime-textures/${n}.webp`, document.baseURI).href + "?v=2");
		r.name = `lingyin-baked-${n}`, r.colorSpace = e.SRGBColorSpace, r.minFilter = e.LinearMipmapLinearFilter, r.magFilter = e.LinearFilter, r.anisotropy = 8, n === "gate-paving" && (r.wrapS = r.wrapT = e.RepeatWrapping), Er.set(n, r);
	})).then(() => {}), Dr;
}
function kr(e) {
	return Er.get(e);
}
var Ar = null;
function jr() {
	if (!Ar) {
		let t = document.createElement("canvas");
		t.width = 128, t.height = 512;
		let n = t.getContext("2d"), r = n.createImageData(128, 512);
		for (let e = 0; e < 512; e++) for (let t = 0; t < 128; t++) {
			let n = e * 8 / 512 % 1, i = n < .04 ? .48 : n < .09 ? 1.12 : 1, a = .91 + .09 * Math.sin(t * 1.8 + Math.sin(e * .013)), o = (.85 + .15 * Math.sin(t / 128 * Math.PI * 2)) * i * a, s = (e * 128 + t) * 4;
			r.data[s] = 82 * o, r.data[s + 1] = 103 * o, r.data[s + 2] = 48 * o, r.data[s + 3] = 255;
		}
		n.putImageData(r, 0, 0), Ar = new e.CanvasTexture(t), Ar.name = "lingyin-bamboo-node-and-fibre", Ar.colorSpace = e.SRGBColorSpace, Ar.wrapS = Ar.wrapT = e.RepeatWrapping, Ar.anisotropy = 8;
	}
	return new e.MeshStandardMaterial({
		name: "bamboo-textured-culm",
		map: Ar,
		bumpMap: Ar,
		bumpScale: .008,
		roughness: .8,
		metalness: 0
	});
}
//#endregion
//#region src/data/shots.ts
var Mr = [
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
], Nr = 1024, J = 256, Pr = null, Fr = null;
function Ir() {
	if (kr("forest-atlas")) return Promise.resolve();
	if (Fr) return Fr;
	let e = (e) => new Promise((t, n) => {
		let r = new Image();
		r.onload = () => t(r), r.onerror = () => n(/* @__PURE__ */ Error(`Lingyin foliage image failed: ${e}`)), r.src = new URL(`./assets/lingyin/temple-textures/${e}`, document.baseURI).href + "?v=1";
	});
	return Fr = Promise.all([
		e("pine-foliage-albedo.jpg"),
		e("pine-foliage-alpha.png"),
		e("broad-foliage-albedo.jpg"),
		e("broad-foliage-alpha.png")
	]).then(([e, t, n, r]) => {
		Pr = {
			pine: {
				diffuse: e,
				alpha: t
			},
			broad: {
				diffuse: n,
				alpha: r
			}
		};
	}), Fr;
}
function Lr(e) {
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
function Rr() {
	let t = kr("forest-atlas");
	if (t) return t;
	let n = document.createElement("canvas");
	n.width = Nr, n.height = Nr;
	let r = n.getContext("2d");
	if (!r) throw Error("no 2d");
	r.clearRect(0, 0, Nr, Nr);
	let i = new h("foliage-atlas"), a = (e, t) => {
		let { col: n, row: i } = Lr(e), a = n * J, o = i * J;
		r.save(), r.translate(a, o), r.beginPath(), r.rect(0, 0, J, J), r.clip(), t(r), r.restore();
	};
	if (a("pine", (e) => {
		let t = J / 2, n = J * .62, r = e.createRadialGradient(t, n - 20, 10, t, n - 20, 190);
		r.addColorStop(0, "rgba(22,36,24,0.55)"), r.addColorStop(.6, "rgba(22,36,24,0.22)"), r.addColorStop(1, "rgba(22,36,24,0)"), e.fillStyle = r, e.fillRect(0, 0, J, J);
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
		let t = J / 2, n = J * .6, r = e.createRadialGradient(t, n, 8, t, n, 180);
		r.addColorStop(0, "rgba(24,40,22,0.5)"), r.addColorStop(.65, "rgba(24,40,22,0.18)"), r.addColorStop(1, "rgba(24,40,22,0)"), e.fillStyle = r, e.fillRect(0, 0, J, J);
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
			let n = i.range(30, J - 30), r = i.range(30, J - 30), a = i.range(16, 30);
			e.save(), e.translate(n, r), e.rotate(i.range(0, Math.PI * 2)), e.fillStyle = t[i.int(0, t.length - 1)], e.beginPath();
			for (let t = 0; t < 5; t++) {
				let n = -Math.PI / 2 + (t - 2) * .62, r = Math.cos(n) * a, i = Math.sin(n) * a;
				e.lineTo(r, i), e.lineTo(Math.cos(n + .28) * a * .45, Math.sin(n + .28) * a * .45);
			}
			e.closePath(), e.fill(), e.restore();
		}
	}), a("bamboo", (e) => {
		for (let t = 0; t < 5; t++) {
			let t = i.range(30, J - 30), n = i.range(40, J - 40);
			for (let r = 0; r < 12; r++) {
				let r = i.range(-Math.PI, Math.PI), a = i.range(30, 68);
				e.save(), e.translate(t + i.range(-10, 10), n + i.range(-10, 10)), e.rotate(r), e.fillStyle = `rgba(${70 + i.int(0, 25)},${100 + i.int(0, 30)},${48 + i.int(0, 20)},0.9)`, e.beginPath(), e.ellipse(a * .5, 0, a * .5, 3.2, 0, 0, Math.PI * 2), e.fill(), e.restore();
			}
		}
	}), a("grass", (e) => {
		for (let t = 0; t < 46; t++) {
			let t = J / 2 + i.range(-70, 70), n = -Math.PI / 2 + i.range(-.55, .55), r = i.range(80, 210);
			e.strokeStyle = `rgba(${72 + i.int(0, 35)},${94 + i.int(0, 35)},${44 + i.int(0, 22)},0.95)`, e.lineWidth = i.range(1.5, 3.4), e.beginPath(), e.moveTo(t, J - 4), e.quadraticCurveTo(t + Math.cos(n) * r * .45, J - r * .55, t + Math.cos(n) * r, J - 4 - Math.sin(-n) * r), e.stroke();
		}
	}), a("fern", (e) => {
		for (let t = 0; t < 5; t++) {
			let t = -Math.PI / 2 + i.range(-.8, .8), n = i.range(120, 210), r = J / 2, a = J - 10;
			e.strokeStyle = "#3f5a34", e.lineWidth = 2.2, e.beginPath(), e.moveTo(r, a), e.quadraticCurveTo(r + Math.cos(t) * n * .6, a - n * .6, r + Math.cos(t) * n, a - n * .85), e.stroke();
			for (let o = 4; o < 20; o++) {
				let s = o / 20, c = r + Math.cos(t) * n * s, l = a - n * .85 * s - Math.sin(Math.abs(t)) * 6;
				for (let t of [-1, 1]) e.strokeStyle = `rgba(${54 + i.int(0, 20)},${80 + i.int(0, 22)},${40 + i.int(0, 18)},0.95)`, e.lineWidth = 1.2, e.beginPath(), e.moveTo(c, l), e.lineTo(c + t * 18 * (1 - s), l + 8), e.stroke();
			}
		}
	}), Pr) {
		let e = (e, t, n, i, a, o, s = !1) => {
			let c = document.createElement("canvas"), l = document.createElement("canvas");
			c.width = c.height = J, l.width = l.height = J;
			let u = c.getContext("2d"), d = l.getContext("2d");
			u.drawImage(t.diffuse, n, i, a, o, 12, 12, J - 24, J - 24), d.drawImage(t.alpha, n, i, a, o, 12, 12, J - 24, J - 24);
			let f = u.getImageData(0, 0, J, J), p = d.getImageData(0, 0, J, J);
			for (let t = 0; t < f.data.length; t += 4) {
				let n = f.data[t], r = f.data[t + 1], i = f.data[t + 2], a = e === "pine" ? r > n * .94 && r > i * 1.12 : r > n * 1.025 && r > i * 1.18;
				f.data[t + 3] = a && p.data[t] > 230 ? 255 : 0, f.data[t] = Math.min(255, n * 1.06), f.data[t + 1] = Math.min(255, r * 1.16), s && (f.data[t] = Math.min(255, f.data[t] * 1.5 + 52), f.data[t + 1] = Math.min(255, f.data[t + 1] * .68 + 12), f.data[t + 2] = Math.min(255, f.data[t + 2] * .52));
			}
			u.putImageData(f, 0, 0);
			let { col: m, row: h } = Lr(e);
			r.clearRect(m * J, h * J, J, J), r.drawImage(c, m * J, h * J);
		};
		e("pine", Pr.pine, 30, 42, 197, 360), e("broad", Pr.broad, 560, 35, 290, 620), e("maple", Pr.broad, 560, 35, 290, 620, !0);
	}
	let o = new e.CanvasTexture(n);
	return o.colorSpace = e.SRGBColorSpace, o.anisotropy = 8, o.needsUpdate = !0, o;
}
function zr(t, n, r) {
	let { col: i, row: a } = Lr(t), o = 3 / Nr, s = i / 4 + o, c = 1 - (a + 1) / 4 + o, l = new e.PlaneGeometry(n, r), u = l.getAttribute("uv");
	for (let e = 0; e < u.count; e++) u.setXY(e, s + u.getX(e) * (.25 - o * 2), c + u.getY(e) * (.25 - o * 2));
	return l;
}
function Br(e, t, n, r, i, a = 0, o = !0, s = 0, c = 0) {
	let l = zr(e, t, n);
	return o && l.translate(0, n / 2, 0), l.rotateX(a), l.rotateY(i), l.translate(s, r, c), l;
}
var Vr = class {
	trunk;
	cards;
	blobs;
	constructor(e, t, n) {
		this.trunk = e, this.cards = t, this.blobs = n;
	}
};
function Hr(n) {
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
		c.push(Br("pine", n.range(3.2, 4.6), n.range(2, 2.8), e.y - .9 + n.range(-.4, .4), t / 8 * Math.PI + n.range(-.3, .3), .1, !0, r, i));
	}
	for (let e = 0; e < 6; e++) {
		let t = e / 6 * Math.PI * 2;
		c.push(Br("pine", 3.6, 2.3, r * .82, t, .02, !0, Math.cos(t) * .7, Math.sin(t) * .7));
	}
	return new Vr(t(i, !1), t(c, !1), l.length ? t(l, !1) : new e.BufferGeometry());
}
function Ur(n, r) {
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
		c.push(Br(r, 4.8, 3.3, s - 1.7, t, e % 2 ? .12 : -.12, !0, Math.cos(t * 2) * .24, Math.sin(t * 2) * .24));
	}
	for (let e = 0; e < 72; e++) {
		let e = n.range(0, Math.PI * 2), t = n.range(.3, 2.9), i = s + n.range(-1.5, 1.9), a = n.range(2, 3.4);
		c.push(Br(r, a, a * n.range(.65, .95), i, e, n.range(-.5, .5), !0, Math.cos(e) * t, Math.sin(e) * t));
	}
	for (let e of o) c.push(Br(r, 2, 1.4, e.y, n.range(0, Math.PI), n.range(-.3, .3), !0, e.x, e.z));
	return new Vr(t(a, !1), t(c, !1), new e.BufferGeometry());
}
function Wr(n) {
	let r = n.range(6.5, 10), i = [];
	for (let t = 0; t < 4; t++) {
		let a = t / 4 * Math.PI * 2, o = n.range(.04, .12), s = new e.CylinderGeometry(.035, .05, r, 6);
		s.rotateZ(o), s.rotateY(a), s.translate(Math.cos(a) * .35, r / 2, Math.sin(a) * .35), i.push(s);
	}
	let a = t(i, !1), o = [];
	for (let e = 0; e < 22; e++) {
		let e = n.range(0, Math.PI * 2), t = r * n.range(.55, 1), i = n.range(.2, 1.4);
		o.push(Br("bamboo", n.range(1, 1.7), n.range(.5, .9), t, e, n.range(-.4, .4), !0, Math.cos(e) * i, Math.sin(e) * i));
	}
	return new Vr(a, t(o, !1), new e.BufferGeometry());
}
var Gr = class {
	group = new e.Group();
	tiles = [];
	atlas;
	bark;
	leafMat;
	grassGeo;
	fernGeo;
	time = n.time;
	constructor() {
		this.group.name = "vegetation", this.atlas = Rr(), this.bark = ft() ?? o({
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
		for (let e = 0; e < 3; e++) r.push(Br("grass", 1.1, .85, 0, e / 3 * Math.PI, 0, !0));
		this.grassGeo = t(r, !1);
		let i = [];
		for (let e = 0; e < 4; e++) i.push(Br("fern", 1.3, .9, 0, e / 4 * Math.PI * 2, .1, !0));
		this.fernGeo = t(i, !1), this.populate();
	}
	canPlace(e, t, n) {
		if (!Ee(e, t, n) || Te(e, t, n)) return !1;
		for (let r of Mr) {
			let i = r.pos[0], a = r.pos[2], o = r.target[0], s = r.target[2], c = o - i, l = s - a, u = c * c + l * l || 1, d = ((e - i) * c + (t - a) * l) / u;
			if (d > -.05 && d < .5) {
				let r = i + c * d, o = a + l * d;
				if (Math.hypot(e - r, t - o) < 9 + n) return !1;
			}
		}
		return !(De(e, t) < n + 1.6 || le(e, t) < 2.72 + n + .35 || _e(e, t) < n || we(e, t) > .8);
	}
	populate() {
		let t = new h("vegetation"), n = [
			Hr(new h("pine-a")),
			Hr(new h("pine-b")),
			Hr(new h("pine-c"))
		], r = [Ur(new h("broad-a"), "broad"), Ur(new h("broad-b"), "broad")], i = [Ur(new h("maple-a"), "maple"), Ur(new h("maple-b"), "maple")], a = Wr(new h("bamboo")), o = [], s = [], c = [], l = [], u = new e.Quaternion(), d = new e.Euler(), f = new e.Vector3(), p = (t, n, r, i, a) => (d.set(0, a, 0), u.setFromEuler(d), f.set(i, i, i), new e.Matrix4().compose(new e.Vector3(t, n, r), u, f)), m = 0;
		for (; o.length < 190 && m < 12e3;) {
			m++;
			let r = t.range(-250, 250), i = t.range(-250, 220);
			this.canPlace(r, i, 3.5) && (we(r, i) < .08 && t.chance(.7) || o.push({
				v: t.int(0, n.length - 1),
				m: p(r, I(r, i) - .25, i, t.range(.75, 1.25), t.range(0, 6.28)),
				c: new e.Color().setHSL(.29 + t.range(-.02, .02), .1, .76 + t.range(-.08, .06))
			}));
		}
		for (m = 0; s.length < 120 && m < 7e3;) {
			m++;
			let n = t.range(-210, 210), i = t.range(-190, 200);
			this.canPlace(n, i, 3) && (Math.abs(n + 2) > 90 && t.chance(.5) || s.push({
				v: t.int(0, r.length - 1),
				m: p(n, I(n, i) - .2, i, t.range(.8, 1.3), t.range(0, 6.28)),
				c: new e.Color().setHSL(.27 + t.range(-.03, .03), .1, .74 + t.range(-.08, .06))
			}));
		}
		for (m = 0; c.length < 30 && m < 3e3;) {
			m++;
			let n = t.range(-90, 80), r = t.range(-70, 90);
			this.canPlace(n, r, 3) && (Te(n, r, 5) || c.push({
				v: t.int(0, i.length - 1),
				m: p(n, I(n, r) - .2, r, t.range(.75, 1.15), t.range(0, 6.28)),
				c: new e.Color().setHSL(.05 + t.range(-.02, .02), .12, .82 + t.range(-.06, .05))
			}));
		}
		for (let n = 0; n < 170; n++) {
			let n = t.range(-62, -38), r = t.range(-10, 52);
			this.canPlace(n, r, 1.2) && l.push({
				m: p(n, I(n, r) - .1, r, t.range(.8, 1.2), t.range(0, 6.28)),
				c: new e.Color().setHSL(.24 + t.range(-.02, .02), .1, .8)
			});
		}
		this.buildSpecies(n, o), this.buildSpecies(r, s), this.buildSpecies(i, c), this.buildSpecies([a], l.map((e) => ({
			v: 0,
			...e
		})), jr());
		let g = [], _ = [];
		for (m = 0; g.length < 7e3 && m < 26e3;) {
			m++;
			let e = t.range(-120, 100), n = t.range(-90, 110);
			this.canPlace(e, n, .5) && (Te(e, n, 1.5) || g.push(p(e, I(e, n) - .02, n, t.range(.7, 1.4), t.range(0, 6.28))));
		}
		for (m = 0; _.length < 800 && m < 7e3;) {
			m++;
			let e = t.range(-95, 90), n = t.range(-70, 95);
			this.canPlace(e, n, 1.2) && _.push(p(e, I(e, n) - .02, n, t.range(.7, 1.2), t.range(0, 6.28)));
		}
		this.addInstanced(this.grassGeo, this.leafMat, g, !1, "grass"), this.addInstanced(this.fernGeo, this.leafMat, _, !1, "fern"), this.shrubsAndRocks(t);
	}
	shrubsAndRocks(n) {
		let r = [];
		for (let e = 0; e < 5; e++) {
			let t = e * Math.PI / 5;
			r.push(Br("broad", n.range(1.55, 2.15), n.range(1.1, 1.6), 0, t, n.range(-.16, .16), !0, Math.cos(t * 2) * .28, Math.sin(t * 2) * .28));
		}
		let i = t(r, !1), a = [], o = 0;
		for (; a.length < 260 && o < 4e3;) {
			o++;
			let t = n.range(-140, 130), r = n.range(-100, 120);
			if (!this.canPlace(t, r, 1.7)) continue;
			let i = n.range(.7, 1.7);
			a.push(new e.Matrix4().compose(new e.Vector3(t, I(t, r) - .15, r), new e.Quaternion().setFromEuler(new e.Euler(0, n.range(0, 6.28), 0)), new e.Vector3(i, i * n.range(.8, 1.2), i)));
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
		let c = t(s, !1), l = kt();
		l.name === "limestone-photogrammetry" && (c = wn(B(c, 1.6), "stone"));
		let u = [];
		for (o = 0; u.length < 85 && o < 3e3;) {
			o++;
			let t = n.range(-150, 140), r = n.range(-110, 130);
			if (!Ee(t, r, 2.2)) continue;
			let i = n.range(.5, 2.2);
			Te(t, r, 2.2 * i + 1) || De(t, r) < 3 || le(t, r) < 2.72 + 1.8 * i + .35 || u.push(new e.Matrix4().compose(new e.Vector3(t, I(t, r) - .35 * i, r), new e.Quaternion().setFromEuler(new e.Euler(n.range(-.2, .2), n.range(0, 6.28), n.range(-.2, .2))), new e.Vector3(i, i * n.range(.6, 1.1), i)));
		}
		this.addInstanced(c, l, u, !0, "boulder");
	}
	buildSpecies(e, t, n = this.bark) {
		for (let r = 0; r < e.length; r++) {
			let i = t.filter((e) => e.v === r);
			if (!i.length) continue;
			let a = i.map((e) => e.m), o = i.map((e) => e.c), s = e[r].trunk;
			n.name === "bark-photogrammetry" && (s = wn(B(s, 2.4), "bark")), this.addInstanced(s, n, a, !0, "trunk"), this.addInstanced(e[r].cards, this.leafMat, a, !0, "cards", o);
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
}, Kr = class {
	group = new e.Group();
	smokeOrigin = new e.Vector3(-2, 7.4, 22);
	lanterns = [];
	constructor(e = {}) {
		this.group.name = "details", e.omitBridge || this.bridge(), this.lanternsAlongPath(), this.censer(), this.lions(), this.stele(), this.pavilion(), this.streamRailing(), this.paving();
	}
	paving() {
		let t = F.platform, n = t.x0 + .7, r = t.x1 - .7, i = t.z0 + 1.2, a = t.z1 - .55, o = r - n, s = a - i, c = new e.Mesh(new e.PlaneGeometry(o, s), rt(o, s));
		c.rotation.x = -Math.PI / 2, c.position.set((n + r) / 2, F.platform.y + .025, (i + a) / 2), c.receiveShadow = !0, c.name = "temple-enclosure-photographic-paving", this.group.add(c);
	}
	bridge() {
		let t = ut(.35), n = [], r = Be(13.4, 3.3, .45, 3.15, 1.05);
		for (let e of [26.1, 29.9]) n.push(r.clone().translate(36, .45, e));
		n.push(L(13.6, .34, 4.6, 36, 3.66, 28)), n.push(L(13.9, .18, 4.9, 36, 3.86, 28));
		for (let e of [-1, 1]) {
			for (let t = 0; t <= 12; t++) {
				let r = 29.5 + t * 1.1;
				n.push(L(.2, 1, .2, r, 4.45, 28 + e * 2.05)), t < 12 && n.push(L(1.1, .15, .16, r + .55, 4.88, 28 + e * 2.05));
			}
			n.push(L(13.4, .18, .26, 36, 4.95, 28 + e * 2.05));
		}
		for (let e of [-1, 1]) for (let t = 0; t < 3; t++) n.push(L(1.2, .18, 4.2, 36 + e * (7 + t * .5), 3.4 - t * .18, 28));
		let i = new e.Mesh(B(z(n), 1.4), t);
		i.castShadow = !0, i.receiveShadow = !0, this.group.add(i);
	}
	lanternsAlongPath() {
		let t = ut(.5), n = [];
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
			let i = I(t, r);
			n.push(L(.75, .22, .75, t, i + .11, r)), n.push(R(.16, .2, 1.15, 8, t, i + .78, r)), n.push(L(.55, .55, .55, t, i + 1.62, r)), n.push(new e.ConeGeometry(.62, .42, 6).translate(t, i + 2.1, r)), n.push(new e.SphereGeometry(.09, 6, 4).translate(t, i + 2.38, r)), this.lanterns.push(new e.Vector3(t, i + 1.62, r));
		}
		let r = new e.Mesh(B(z(n), 1.4), t);
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
		a.position.set(-2, F.platform.y + 4.3, 22), this.group.add(a);
	}
	censer() {
		let t = Tt(), n = [], r = F.platform.y;
		for (let t = 0; t < 3; t++) {
			let r = t / 3 * Math.PI * 2, i = new e.Vector3(Math.cos(r) * 1.9, .19, Math.sin(r) * 1.9), a = new e.Vector3(Math.cos(r) * 1.55, 1.96, Math.sin(r) * 1.55);
			n.push(R(.23, .29, .18, 10, i.x, .105, i.z));
			let o = a.clone().sub(i), s = new e.CylinderGeometry(.13, .18, o.length(), 10);
			s.applyQuaternion(new e.Quaternion().setFromUnitVectors(new e.Vector3(0, 1, 0), o.normalize())), s.translate((i.x + a.x) / 2, (i.y + a.y) / 2, (i.z + a.z) / 2), n.push(s);
		}
		n.push(R(1.55, 1.4, .16, 20, 0, 1.91, 0));
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
		n.push(R(1.1, 1.25, .22, 20, 0, 3.17, 0)), n.push(new e.SphereGeometry(.22, 10, 8).translate(0, 3.5, 0)), n.push(new e.ConeGeometry(.2, .55, 8).translate(0, 3.8, 0));
		let o = new e.Mesh(z(n), t);
		o.position.set(-2, r, 22), o.castShadow = !0, o.receiveShadow = !0, this.group.add(o), this.smokeOrigin.set(-2, r + 4.15, 22);
	}
	lions() {
		let t = ut(.55), n = [];
		for (let t of [-10.5, 6.5]) {
			let r = 41.5, i = I(t, r);
			n.push(L(1.4, .5, 1.8, t, i + .25, r)), n.push(new e.SphereGeometry(.55, 12, 10).scale(1, 1.15, 1.25).translate(t, i + 1.1, r)), n.push(new e.SphereGeometry(.42, 12, 10).translate(t, i + 1.75, r + .45));
			for (let a of [-1, 1]) n.push(new e.SphereGeometry(.28, 8, 6).translate(t + a * .38, i + 2, r + .4)), n.push(new e.CylinderGeometry(.12, .15, .8, 6).translate(t + a * .35, i + .65, r + .5));
			n.push(new e.CylinderGeometry(.1, .16, .9, 6).translate(t, i + .9, r + 1.05));
		}
		let r = new e.Mesh(B(z(n), 1.4), t);
		r.castShadow = !0, r.receiveShadow = !0, this.group.add(r);
	}
	stele() {
		let t = ut(.7), n = ut(.42), r = new e.Group(), i = new e.Mesh(new e.BoxGeometry(1.8, .4, 1.1), t);
		i.position.y = .2;
		let a = new e.Mesh(new e.BoxGeometry(1.3, 2.4, .22), n);
		a.position.set(0, 1.55, 0);
		let o = new e.Mesh(new e.BoxGeometry(1.5, .16, .4), t);
		o.position.y = 2.82, r.add(i, a, o), r.position.set(7.5, I(7.5, 36.5), 36.5), r.rotation.y = -.35, r.traverse((t) => {
			t instanceof e.Mesh && (t.castShadow = !0, t.receiveShadow = !0);
		}), this.group.add(r);
	}
	pavilion() {
		let t = St(!1), n = pt(), r = ut(.4), i = new e.Group(), a = Math.max(I(29, 51), ve) + .15, o = new e.Mesh(new e.CylinderGeometry(3.8, 4.1, .5, 6), r);
		o.position.y = .25, o.castShadow = !0, o.receiveShadow = !0, i.add(o);
		for (let n = 0; n < 6; n++) {
			let r = n / 6 * Math.PI * 2 + Math.PI / 6, a = new e.Mesh(new e.CylinderGeometry(.13, .16, 3.1, 8), t);
			a.position.set(Math.cos(r) * 3.1, 2.05, Math.sin(r) * 3.1), a.castShadow = !0, i.add(a);
			let o = new e.Mesh(new e.CylinderGeometry(.18, .18, .08, 8), Ct());
			o.position.set(Math.cos(r) * 3.1, 3.5, Math.sin(r) * 3.1), i.add(o);
		}
		let s = new e.Mesh(new e.CylinderGeometry(.25, 4.6, 1.7, 6), n);
		s.position.y = 4.4, s.castShadow = !0, i.add(s);
		let c = new e.Mesh(new e.ConeGeometry(.18, .8, 8), Ct());
		c.position.y = 5.55, i.add(c);
		for (let t = 0; t < 6; t++) {
			let r = t / 6 * Math.PI * 2 + Math.PI / 6, a = new e.Mesh(new e.CylinderGeometry(.02, .09, .7, 5), n);
			a.position.set(Math.cos(r) * 4.5, 4.95, Math.sin(r) * 4.5), a.rotation.z = .9, a.rotation.y = -r, i.add(a);
		}
		i.position.set(29, a, 51), this.group.add(i);
	}
	streamRailing() {
		let t = ut(.4), n = [];
		for (let e = 0; e < 14; e++) {
			let t = 34 + e * 1.6, r = 31.6 - e * .06, i = I(r, t);
			n.push(L(.18, 1, .18, r, i + .5, t)), e < 13 && n.push(L(.14, .14, 1.6, r - .03, i + .9, t + .8));
		}
		let r = new e.Mesh(B(z(n), 1.4), t);
		r.castShadow = !0, r.receiveShadow = !0, this.group.add(r);
	}
};
//#endregion
//#region src/gate-kit/world/geom.ts
function qr(t) {
	if (!t.getAttribute("uv")) {
		let n = t.getAttribute("position").count;
		t.setAttribute("uv", new e.BufferAttribute(new Float32Array(n * 2), 2));
	}
	return t;
}
function Y(t, n, r, i = 0, a = 0, o = 0, s = 0, c = 0, l = 0) {
	let u = new e.BoxGeometry(t, n, r);
	return c && u.rotateX(c), s && u.rotateY(s), l && u.rotateZ(l), u.translate(i, a, o), qr(u);
}
function Jr(t, n, r, i, a = 0, o = 0, s = 0) {
	let c = new e.CylinderGeometry(t, n, r, i, 1, !1);
	return c.translate(a, o, s), qr(c);
}
function X(e) {
	let n = e.filter((e) => e && e.getAttribute("position")?.count), r = n.every((e) => e.index !== null), i = t(n.map((e) => qr(r ? e : e.index ? e.toNonIndexed() : e)), !1);
	if (!i) throw Error("merge failed");
	return i.computeBoundingSphere(), i;
}
function Yr(t, n) {
	let r = t.getAttribute("position").count, i = new Float32Array(r * 3);
	for (let e = 0; e < r; e++) i[e * 3] = n.r, i[e * 3 + 1] = n.g, i[e * 3 + 2] = n.b;
	return t.setAttribute("color", new e.BufferAttribute(i, 3)), t;
}
function Xr(t, n, r) {
	let i = new e.Shape();
	i.moveTo(0, 0), i.quadraticCurveTo(t * .15, n * .92, t * .55, n * .55), i.quadraticCurveTo(t * .86, n * .3, t, n * .62), i.lineTo(t, 0), i.quadraticCurveTo(t * .45, n * .28, 0, 0);
	let a = new e.ExtrudeGeometry(i, {
		depth: r,
		bevelEnabled: !1,
		curveSegments: 12
	});
	return a.translate(0, 0, -r / 2), qr(a);
}
//#endregion
//#region src/gate-kit/core/math.ts
var Zr = (e, t, n) => e < t ? t : e > n ? n : e, Qr = (e, t, n) => e + (t - e) * n, $r = (e, t, n) => {
	let r = Zr((n - e) / (t - e), 0, 1);
	return r * r * (3 - 2 * r);
};
function ei(e) {
	let t = e >>> 0;
	return () => {
		t |= 0, t = t + 1831565813 | 0;
		let e = Math.imul(t ^ t >>> 15, 1 | t);
		return e = e + Math.imul(e ^ e >>> 7, 61 | e) ^ e, ((e ^ e >>> 14) >>> 0) / 4294967296;
	};
}
var ti = class {
	next;
	constructor(e) {
		let t = typeof e == "number" ? e : ni(e);
		this.next = ei(t);
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
function ni(e) {
	let t = 2166136261;
	for (let n = 0; n < e.length; n++) t ^= e.charCodeAt(n), t = Math.imul(t, 16777619);
	return t >>> 0;
}
function ri(e, t) {
	let n = Math.imul(e | 0, 374761393) + Math.imul(t | 0, 668265263);
	return n = Math.imul(n ^ n >>> 13, 1274126177), ((n ^ n >>> 16) >>> 0) / 4294967296;
}
var ii = (e) => e * e * (3 - 2 * e);
function ai(e, t) {
	let n = Math.floor(e), r = Math.floor(t), i = e - n, a = t - r, o = ii(i), s = ii(a), c = ri(n, r), l = ri(n + 1, r), u = ri(n, r + 1), d = ri(n + 1, r + 1);
	return Qr(Qr(c, l, o), Qr(u, d, o), s) * 2 - 1;
}
function oi(e, t, n = 4, r = 2.02, i = .5) {
	let a = .5, o = 1, s = 0, c = 0;
	for (let l = 0; l < n; l++) s += a * ai(e * o + l * 17.31, t * o - l * 9.13), c += a, a *= i, o *= r;
	return s / c;
}
//#endregion
//#region src/gate-kit/world/textures.ts
var si = /* @__PURE__ */ new Map();
function ci(t = "flagstone", n = 8) {
	let r = `${t}:${n}`, i = si.get(r);
	if (i) return i;
	let a = 2048, o = new ti(t), s = a / n, c = [], l = -o.range(0, s * .4), u = 0;
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
	let d = vn(a, a, (e) => {
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
	let f = vn(a, a, (e) => {
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
	return si.set(r, p), p;
}
function li(e = 6, t = !0, n = 0, r = 0) {
	let i = kr("gate-paving") ?? ci("lingyin-flagstone", 8).map, a = e.toFixed(2);
	return gn({
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
function ui(t = 0) {
	let n = dt(t);
	if (n) return n.name = "granite-photogrammetry", n;
	let r = new ti("granite-tex"), i = vn(512, 512, (e) => {
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
	return i.wrapS = i.wrapT = e.RepeatWrapping, i.anisotropy = 16, gn({
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
var Z = {
	w: 13.8,
	d: 6.4,
	eaveY: 7.02,
	rise: 3.15,
	overhang: .9,
	ridgeFrac: .44,
	cornerLift: .3
}, di = Z.w / 2 + Z.overhang, fi = Z.d / 2 + Z.overhang, pi = Z.w * Z.ridgeFrac / 2;
function mi(t, n, r) {
	let i = (Math.abs(n - .5) * 2) ** 5 * (1 - r) ** 2.15 * Z.cornerLift, a = Z.eaveY + Z.rise * r ** 1.32 + i;
	if (t === "front" || t === "back") {
		let i = t === "front" ? 1 : -1, o = (n - .5) * 2 * (di * (1 - r) + pi * r), s = i * fi * (1 - r) ** .94;
		return new e.Vector3(o, a, s);
	}
	let o = (t === "left" ? -1 : 1) * (di * (1 - r) + pi * r), s = (n - .5) * 2 * fi * (1 - r);
	return new e.Vector3(o, a, s);
}
function hi(t, n, r) {
	let i = .008, a = mi(t, Math.min(1, n + i), r).sub(mi(t, Math.max(0, n - i), r)), o = mi(t, n, Math.min(1, r + i)).sub(mi(t, n, Math.max(0, r - i))), s = new e.Vector3().crossVectors(a, o).normalize();
	return s.y < 0 && s.negate(), s;
}
var gi = class {
	group = new e.Group();
	tileMat = Sn();
	fieldMat = pt();
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
					let a = e / 28, o = mi(n, a, t);
					r.push(o.x, o.y, o.z), i.push((a - .5) * (n === "front" || n === "back" ? di * 2 : fi * 2), t * 6.5);
				}
			}
			for (let e = 0; e < 14; e++) for (let t = 0; t < 28; t++) {
				let n = e * 29 + t, r = n + 1, i = n + 28 + 1, o = i + 1;
				a.push(n, r, i, r, o, i);
			}
			let o = new e.BufferGeometry();
			o.setAttribute("position", new e.Float32BufferAttribute(r, 3)), o.setAttribute("uv", new e.Float32BufferAttribute(i, 2)), o.setIndex(a), o.computeVertexNormals(), t.push(o);
		}
		let n = new e.Mesh(X(t), this.fieldMat);
		n.castShadow = !0, n.receiveShadow = !0, this.group.add(n);
	}
	buildCoverTiles() {
		let t = new ti("roof-tiles"), n = [], r = .095, i = (i, a, o, s) => {
			let c = [], l = [], u = [], d = new e.Color().setHSL(.12 + t.range(-.02, .02), .035, .13 + t.range(-.03, .045)), f = t.chance(.32), p = [], m = [], h = [];
			for (let e = 0; e <= 3; e++) {
				let t = o + (s - o) * (e / 3), n = mi(i, a, t), r = hi(i, a, t), c = .01, l = mi(i, Math.min(1, a + c), t).sub(mi(i, Math.max(0, a - c), t)).normalize();
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
		let a = new e.Mesh(X(n), this.tileMat);
		a.castShadow = !0, a.receiveShadow = !0, this.group.add(a);
	}
	buildRidges() {
		let t = [], n = Z.eaveY + Z.rise;
		t.push(Y(pi * 2 + 1.2, .2, .42, 0, n + .2, 0));
		for (let r = -pi - .4; r <= pi + .4; r += .28) {
			let i = new e.CylinderGeometry(.16, .16, .22, 10);
			i.translate(r, n + .36, 0), t.push(i);
		}
		for (let e = -pi - .3; e <= pi + .3; e += .34) for (let r of [-1, 1]) t.push(Y(.24, .18, .04, e, n + .2, r * .22));
		for (let e of [-1, 1]) {
			t.push(Y(.4, .32, .46, e * (pi + .48), n + .18, 0));
			let r = Y(.3, .5, .34, e * (pi + .6), n + .5, .02);
			r.rotateZ(e * -.8), t.push(r);
			let i = Y(.2, .28, .28, e * (pi + .78), n + .7, .02);
			i.rotateZ(e * -1.25), t.push(i);
		}
		for (let r of [-1, 1]) for (let i of [-1, 1]) {
			let a = new e.Vector3(r * pi, n + .1, 0), o = new e.Vector3(r * di, Z.eaveY + Z.cornerLift * .65, i * fi), s = o.clone().sub(a), c = s.length(), l = new e.BoxGeometry(.3, c, .3);
			l.translate(0, c / 2, 0), l.applyQuaternion(new e.Quaternion().setFromUnitVectors(new e.Vector3(0, 1, 0), s.normalize())), l.translate(a.x, a.y, a.z), t.push(l);
			for (let n = .06; n < .96; n += .1) {
				let r = a.clone().lerp(o, n), i = new e.CylinderGeometry(.13, .13, .2, 8);
				i.translate(r.x, r.y + .18, r.z), t.push(i);
			}
		}
		let r = X(t);
		Yr(r, new e.Color(.14, .15, .14));
		let i = new e.Mesh(r, this.tileMat);
		i.castShadow = !0, i.receiveShadow = !0, this.group.add(i);
	}
	buildMossPatches() {
		let t = new ti("roof-moss-patches"), n = [], r = [];
		for (let i = 0; i < 120; i++) {
			let a = [
				"front",
				"back",
				"left",
				"right"
			][i % 4], o = t.range(.06, .94), s = t.chance(.55) ? t.range(.03, .3) : t.range(.55, .96), c = mi(a, o, s), l = hi(a, o, s), u = mi(a, Math.min(1, o + .01), s).sub(mi(a, Math.max(0, o - .01), s)).normalize(), d = new e.Vector3().crossVectors(l, u).normalize(), f = t.range(.14, .45), p = t.int(6, 9);
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
		let i = X(n.map((t) => (t.setAttribute("color", new e.Float32BufferAttribute(r.slice(0, t.getAttribute("position").count * 3), 3)), t))), a = new e.MeshStandardMaterial({
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
		let t = bn(1), n = [];
		for (let e of [-1, 1]) n.push(Y(di * 2, .2, .16, 0, Z.eaveY - .26, e * fi)), n.push(Y(.16, .2, fi * 2, e * di, Z.eaveY - .26, 0));
		for (let t = -di + .3; t <= di - .3; t += .34) for (let r of [-1, 1]) {
			let i = new e.BoxGeometry(.1, .14, 1.7);
			i.rotateX(r * .22), i.translate(t, Z.eaveY - .3, r * (fi - .8)), n.push(i);
			let a = new e.BoxGeometry(.11, .15, .06);
			a.translate(t, Z.eaveY - .42, r * (fi + .04)), n.push(a);
		}
		for (let t = -fi + .4; t <= fi - .4; t += .36) for (let r of [-1, 1]) {
			let i = new e.BoxGeometry(1.6, .14, .1);
			i.rotateZ(r * -.22), i.translate(r * (di - .8), Z.eaveY - .3, t), n.push(i);
		}
		n.push(Y(di * 2 - .6, .12, fi * 2 - .6, 0, Z.eaveY - .14, 0));
		let r = new e.Mesh(X(n), t);
		r.castShadow = !0, r.receiveShadow = !0, this.group.add(r);
		let i = [];
		for (let t of [-1, 1]) for (let n of [-1, 1]) {
			let r = new e.CylinderGeometry(.04, .12, .75, 8);
			r.rotateZ(t * -.7), r.rotateX(n * .25), r.translate(t * (di - .1), Z.eaveY + .28, n * (fi - .1)), i.push(r);
		}
		let a = X(i);
		Yr(a, new e.Color(.15, .16, .15));
		let o = new e.Mesh(a, this.tileMat);
		o.castShadow = !0, this.group.add(o), this.group.traverse((t) => {
			if (t instanceof e.Mesh) {
				let n = t.geometry;
				!n.getAttribute("color") && t.material === this.tileMat && Yr(n, new e.Color(.16, .17, .16));
			}
		});
	}
};
//#endregion
//#region src/world/static_batch.ts
function _i(n) {
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
var Q = .35, vi = 5.6, yi = [
	-6,
	-2.6,
	2.6,
	6
], bi = 2, xi = class {
	group = new e.Group();
	roof;
	timber = bn(0);
	timberDark = bn(1);
	stone = ui(.12);
	balustradeStone = ut(.2);
	plaster = xn();
	gold = Cn();
	constructor() {
		this.group.name = "gate", this.buildPlatformAndBases(), this.buildColumns(), this.buildBrackets(), this.buildWalls(), this.buildRailings(), this.buildPlaque(), this.buildCeiling(), this.buildWings(), this.buildIvy(), this.buildContactShadow(), this.stone.name === "granite-photogrammetry" && this.group.traverse((t) => {
			!(t instanceof e.Mesh) || t.material !== this.stone || (t.geometry = wn(B(t.geometry, 1.25), "stone"), this.stone.vertexColors = !0);
		}), this.roof = new gi(), this.group.add(this.roof.group);
		for (let t of this.group.children) !(t instanceof e.Mesh) || Array.isArray(t.material) || t.material.name.startsWith("gate-photographic-") && (t.geometry = B(t.geometry, t.material.name.includes("plaster") ? 2 : .8));
		_i(this.group);
	}
	buildPlatformAndBases() {
		let t = [];
		t.push(Y(17.2, .68, 7.4, 0, -.34, 0)), t.push(Y(17.2, .35, 7.4, 0, .175, 0)), t.push(Y(17.6, .12, 7.8, 0, .31, 0));
		for (let n of yi) for (let r of [-bi, bi]) {
			t.push(Y(.95, .2, .95, n, Q + .1, r));
			let i = new e.CylinderGeometry(.42, .47, .42, 16);
			i.translate(n, Q + .41, r), t.push(i);
			let a = new e.TorusGeometry(.43, .035, 6, 16);
			a.rotateX(Math.PI / 2), a.translate(n, Q + .62, r), t.push(a);
			for (let e = 0; e < 12; e++) {
				let i = e / 12 * Math.PI * 2, a = Y(.16, .05, .26, 0, 0, 0);
				a.rotateX(-.28), a.rotateY(-i), a.translate(n + Math.cos(i) * .5, Q + .56, r + Math.sin(i) * .5), t.push(a);
			}
		}
		for (let e = 0; e < 3; e++) {
			let n = .12 * (e + 1), r = n + .68;
			t.push(Y(9.5, r, .5, 0, (n - .68) / 2, 4 + (2 - e) * .5)), t.push(Y(9.5, r, .5, 0, (n - .68) / 2, -4 - (2 - e) * .5));
		}
		for (let e = 0; e < 4; e++) {
			let n = .16 * (e + 1);
			for (let r of [-1, 1]) t.push(Y(5, n, .5, 0, n / 2 - .68, r * (7 - e * .5)));
		}
		let n = new e.Mesh(X(t), this.stone);
		n.castShadow = !0, n.receiveShadow = !0, this.group.add(n);
		let r = li(3.4, !1), i = new e.Mesh(new e.PlaneGeometry(17.6, 7.8), r);
		i.rotation.x = -Math.PI / 2, i.position.set(0, .372, 0), i.receiveShadow = !0, this.group.add(i);
		for (let t = 0; t < 3; t++) for (let n of [-1, 1]) {
			let i = new e.Mesh(new e.PlaneGeometry(9.5, .5), r);
			i.rotation.x = -Math.PI / 2, i.position.set(0, .122 + t * .12, n * (4 + (2 - t) * .5)), i.receiveShadow = !0, this.group.add(i);
		}
		for (let t = 0; t < 4; t++) for (let n of [-1, 1]) {
			let i = new e.Mesh(new e.PlaneGeometry(5, .5), r);
			i.name = "gate-lower-stair-paving", i.rotation.x = -Math.PI / 2, i.position.set(0, .16 * (t + 1) - .68 + .002, n * (7 - t * .5)), i.receiveShadow = !0, this.group.add(i);
		}
	}
	buildColumns() {
		let t = [];
		for (let e of yi) for (let n of [-bi, bi]) {
			let r = vi - (Q + .62);
			t.push(Jr(.23, .28, r, 16, e, Q + .62 + r / 2, n)), t.push(Jr(.295, .295, .06, 16, e, Q + .85, n));
		}
		for (let e of yi) t.push(Y(.26, .32, 4.5, e, vi - .12, 0));
		for (let e = 0; e < yi.length - 1; e++) {
			let n = yi[e + 1] - yi[e] - .5, r = (yi[e] + yi[e + 1]) / 2;
			for (let e of [-bi, bi]) t.push(Y(n, .42, .32, r, vi - .22, e)), t.push(Y(n + .1, .24, .36, r, vi + .08, e));
		}
		for (let e of [-1.5, 1.5]) {
			let n = Jr(.11, .11, 13.4, 10, 0, 6.55, e);
			n.rotateZ(Math.PI / 2), t.push(n);
		}
		for (let e of [-5.2, 5.2]) {
			let n = Jr(.1, .1, 3.6, 10, e, 6.7, 0);
			n.rotateX(Math.PI / 2), t.push(n);
		}
		let n = new e.Mesh(X(t), this.timber);
		n.castShadow = !0, n.receiveShadow = !0, this.group.add(n);
		let r = [];
		for (let e of yi) for (let t of [-bi, bi]) for (let n of [-1, 1]) {
			let i = Xr(1.55, .62, .16);
			n < 0 && i.scale(-1, 1, 1), i.translate(e, vi - .45, t + (t > 0 ? -.15 : .15)), r.push(i);
		}
		let i = new e.Mesh(X(r), this.timberDark);
		i.castShadow = !0, i.receiveShadow = !0, this.group.add(i);
	}
	bracketCluster() {
		let e = [];
		e.push(Y(.58, .26, .58, 0, .13, 0)), e.push(Y(1.18, .15, .3, 0, .34, 0)), e.push(Y(.32, .15, 1.12, 0, .34, .1));
		for (let t of [
			-.46,
			0,
			.46
		]) e.push(Y(.3, .2, .3, t, .5, 0));
		e.push(Y(1.5, .14, .27, 0, .64, .05)), e.push(Y(.29, .14, 1.3, 0, .64, .16));
		for (let t of [
			-.62,
			0,
			.62
		]) e.push(Y(.26, .18, .26, t, .8, .08));
		e.push(Y(1, .12, .24, 0, .92, .16)), e.push(Y(.2, .15, 1.05, 0, .84, .55, 0, .12)), e.push(Y(.44, .2, .42, 0, .98, 1.12));
		for (let t of [-1, 1]) e.push(Y(.09, .5, .13, t * .18, .62, .52, 0, t * .55, t * .16));
		return e.push(Y(.12, .34, .12, 0, .78, 1.13)), X(e);
	}
	buildBrackets() {
		let t = [], n = this.bracketCluster(), r = [];
		for (let e = -6.6; e <= 6.6; e += .68) r.push([
			e,
			6.05,
			bi - .15
		]), r.push([
			e,
			6.05,
			-bi + .15
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
		let i = new e.Mesh(X(t), this.timberDark);
		i.castShadow = !0, i.receiveShadow = !0, this.group.add(i);
		let a = [];
		for (let [e, t, n] of r) a.push(Y(.12, .1, .12, e, t + .98, n + (n > 0 ? 1.05 : -1.05)));
		let o = new e.Mesh(X(a), this.gold);
		o.castShadow = !1, this.group.add(o);
	}
	panelWall(e, t, n, r, i) {
		let a = [], o = Math.max(6, Math.round(e / .34));
		for (let n = 0; n <= o; n++) {
			let r = -e / 2 + e * n / o;
			a.push(Y(.26, t, .12, r, t / 2, 0));
		}
		a.push(Y(e, .22, .18, 0, t * .18, .02)), a.push(Y(e, .26, .2, 0, t * .72, .02)), a.push(Y(e, .24, .2, 0, t - .12, .02));
		let s = X(a);
		return s.translate(n, r, i), s;
	}
	buildWalls() {
		let t = [], n = [[-6, -2.6], [2.6, 6]];
		for (let [e, r] of n) {
			let n = r - e - .55, i = (e + r) / 2;
			for (let a of [-bi, bi]) {
				let o = Y(n, 4.95, .08, 0, 2.47, -.09);
				o.translate(i, Q + .02, a), t.push(o), t.push(this.panelWall(n, 4.95, i, Q + .02, a));
				let s = [];
				for (let t of [
					e + .3,
					(e + r) / 2,
					r - .3
				]) s.push(Y(.2, 4.95, .18, t, Q + .02 + 2.47, a + (a > 0 ? .1 : -.1)));
				for (let e of [
					1.4,
					2.6,
					3.9
				]) s.push(Y(n, .16, .16, i, Q + .02 + e, a + (a > 0 ? .1 : -.1)));
				t.push(X(s));
				let c = [], l = Q + .02 + 2.6;
				for (let e = 0; e <= Math.round(n / .22); e++) c.push(Y(.05, 2, .07, i - n / 2 + n * e / Math.round(n / .22), l + 2 / 2, a + (a > 0 ? .12 : -.12)));
				for (let e = 0; e <= 5; e++) c.push(Y(n, .05, .07, i, l + 2 * e / 5, a + (a > 0 ? .12 : -.12)));
				t.push(X(c));
			}
		}
		for (let e of [-6, 6]) {
			let n = [];
			for (let e = 0; e <= 12; e++) {
				let t = -1.9 + 3.8 * e / 12;
				n.push(Y(.12, 4.95, .28, 0, 2.47, t));
			}
			let r = X(n);
			r.translate(e, Q + .02, 0), t.push(r);
		}
		let r = new e.Mesh(X(t), this.timberDark);
		r.castShadow = !0, r.receiveShadow = !0, this.group.add(r);
		let i = [];
		for (let [t, r] of n) {
			let n = (t + r) / 2;
			for (let t of [-bi, bi]) {
				for (let r = 0; r < 4; r++) for (let a = 0; a < 3; a++) {
					let o = n - .9 + a * .9, s = Q + .9 + r * .85, c = new e.SphereGeometry(.045, 7, 5);
					c.scale(1, 1, .5), c.translate(o, s, t + (t > 0 ? .19 : -.19)), i.push(c);
				}
				let r = new e.TorusGeometry(.13, .022, 6, 12);
				r.translate(n, Q + 1.4, t + (t > 0 ? .2 : -.2)), i.push(r);
			}
		}
		let a = new e.Mesh(X(i), this.gold);
		a.castShadow = !1, this.group.add(a);
		let o = [];
		for (let e of [-1, 1]) o.push(Y(6.4, 2.3, .34, e * 8.95, Q + 1.15, -1.1)), o.push(Y(6.6, .4, .46, e * 8.95, Q + .2, -1.1));
		let s = new e.Mesh(X(o), this.plaster);
		s.castShadow = !0, s.receiveShadow = !0, this.group.add(s);
	}
	buildRailings() {
		let t = [], n = (e, n, r) => {
			let i = Math.abs(n - e), a = Math.max(2, Math.round(i / 2.4));
			for (let o = 0; o <= a; o++) {
				let s = e + (n - e) * o / a;
				if (t.push(Y(.24, .95, .24, s, Q + .475, r)), t.push(Y(.34, .12, .34, s, Q + .98, r)), o < a) {
					let s = e + (n - e) * (o + .5) / a;
					t.push(Y(i / a, .16, .14, s, Q + .74, r));
				}
			}
		};
		n(-5.6, -2.9, 1.35), n(2.9, 5.6, 1.35);
		let r = new e.Mesh(X(t), this.balustradeStone);
		r.name = "gate-stone-balustrades", r.castShadow = !0, r.receiveShadow = !0, this.group.add(r);
	}
	buildCeiling() {
		let t = [];
		for (let e = -6.2; e <= 6.2; e += .5) t.push(Y(.11, .14, 4.2, e, 5.62, 0, 0, .06));
		for (let e of [
			-1.2,
			0,
			1.2
		]) {
			let n = Jr(.09, .09, 12.8, 8, 0, 5.72, e);
			n.rotateZ(Math.PI / 2), t.push(n);
		}
		for (let e of [
			-6.1,
			-2.65,
			2.65,
			6.1
		]) for (let n of [-1.95, 1.95]) t.push(Y(.26, .3, .35, e, 5.62, n));
		let n = new e.Mesh(X(t), this.timber);
		n.castShadow = !0, n.receiveShadow = !0, this.group.add(n);
	}
	buildPlaque() {
		let t = new e.Group(), n = et("gate"), r = new e.Mesh(new e.BoxGeometry(4.5, 1.45, .16), Ct()), i = new e.Mesh(new e.PlaneGeometry(4.2, 1.2), new e.MeshStandardMaterial({
			map: n,
			roughness: .86,
			metalness: .02,
			side: e.DoubleSide
		}));
		i.position.z = .09, t.add(r, i);
		let a = [];
		for (let e of [-1, 1]) a.push(Y(.06, 1, .06, e * 1.2, .95, 0)), a.push(Y(.16, .06, .16, e * 1.2, 1.46, 0));
		let o = new e.Mesh(X(a), this.gold);
		t.add(o), t.position.set(0, 4.5, bi + .24), t.traverse((t) => {
			t instanceof e.Mesh && (t.castShadow = !0);
		}), this.group.add(t);
	}
	buildIvy() {
		let t = vn(256, 256, (e) => {
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
			let r = t * 8.95 - 2.65 + n * .75 + s() * .2, o = Q + 2.52, c = .5 + s() * 1.2, l = new e.CylinderGeometry(.012, .016, c, 5);
			l.rotateZ((s() - .5) * .15), l.translate(r, o - c / 2, -.885), a.push(l);
			for (let t = 0; t < 4; t++) {
				let n = o - c * (.18 + t * .24), a = new e.PlaneGeometry(.28 + s() * .26, .2 + s() * .2);
				a.rotateZ(s() * Math.PI * 2), a.translate(r + (s() - .5) * .2, n, -.875), i.push(a);
			}
		}
		let c = new e.Mesh(X(a), r);
		c.castShadow = !1, this.group.add(c);
		let l = new e.Mesh(X(i), n);
		l.castShadow = !1, this.group.add(l);
	}
	buildContactShadow() {
		let t = vn(512, 256, (e) => {
			let t = e.createRadialGradient(256, 128, 10, 256, 128, 250);
			t.addColorStop(0, "rgba(0,0,0,0.5)"), t.addColorStop(.55, "rgba(0,0,0,0.22)"), t.addColorStop(1, "rgba(0,0,0,0)"), e.fillStyle = t, e.fillRect(0, 0, 512, 256);
		}), n = new e.MeshBasicMaterial({
			map: t,
			transparent: !0,
			depthWrite: !1,
			opacity: .9
		}), r = new e.Mesh(new e.PlaneGeometry(15, 7), n);
		r.rotation.x = -Math.PI / 2, r.position.set(0, Q + .012, .4), this.group.add(r);
	}
	buildWings() {
		let t = new e.MeshStandardMaterial({
			color: new e.Color("#2c322d"),
			roughness: .95,
			metalness: 0
		}), n = new e.MeshStandardMaterial({
			color: new e.Color("#241812"),
			roughness: .95
		}), r = Q + 2.3;
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
			let l = -.7, u = Q + .08, d = u - l, f = new e.Mesh(new e.BoxGeometry(7, d, .86), this.stone);
			f.position.set(a, (l + u) / 2, -1.1), f.castShadow = !0, f.receiveShadow = !0, f.name = "gate-wing-ground-footing", this.group.add(f);
			let p = new e.Mesh(new e.BoxGeometry(7.12, .12, .96), this.stone);
			p.position.set(a, Q + .06, -1.1), p.receiveShadow = !0, this.group.add(p);
			let m = new e.Mesh(new e.BoxGeometry(1.05, 2, .07), n);
			m.position.set(a + i * .4, Q + 1.2, -.91), this.group.add(m);
			let h = new e.Mesh(new e.BoxGeometry(1.26, 2.2, .1), this.timberDark);
			h.position.set(a + i * .4, Q + 1.3, -.94), this.group.add(h);
		}
		let i = [{
			cx: -22.575,
			len: 20.85
		}, {
			cx: 20.575,
			len: 16.85
		}], a = [], o = [], s = [], c = [];
		for (let { cx: t, len: n } of i) {
			a.push(Y(n, 2.3, .34, t, Q + 1.15, -1.1));
			let i = -.7, l = Q + .08;
			o.push(Y(n + .2, l - i, .86, t, (i + l) / 2, -1.1)), o.push(Y(n + .32, .12, .96, t, Q + .06, -1.1)), s.push(Y(n + .18, .18, .5, t, r + .015, -1.1)), s.push(Y(n + .4, .16, .1, t, r + .06, -.22));
			let u = Math.max(2, Math.ceil(n / 6.4));
			for (let e = 0; e <= u; e++) {
				let r = t - n / 2 + n * e / u;
				s.push(Y(.34, 2.38, .4, r, Q + 1.19, -1.1));
			}
			for (let e of [-1, 1]) c.push(Y(n + .4, .1, .95, t, r + .2, -1.1 + e * .38, 0, e * .34));
			c.push(Y(n + .4, .14, .18, t, r + .36, -1.1));
			let d = Math.max(2, Math.floor(n / .44));
			for (let i = 0; i <= d; i++) {
				let a = new e.CylinderGeometry(.055, .055, .06, 8);
				a.rotateX(Math.PI / 2), a.translate(t - n / 2 + n * i / d, r + .02, -.17), c.push(a);
			}
		}
		let l = (t, n, r) => {
			let i = new e.Mesh(X(t), n);
			i.castShadow = !0, i.receiveShadow = !0, i.name = r, this.group.add(i);
		};
		l(a, this.plaster, "gate-wing-terrace-extension-plaster"), l(o, this.stone, "gate-wing-terrace-extension-footing"), l(s, this.timberDark, "gate-wing-terrace-extension-timber"), l(c, t, "gate-wing-terrace-extension-roof");
	}
}, Si = class {
	group = new e.Group();
	gameMap;
	constructor(t = {}) {
		this.gameMap = !!t.gameMap, this.group.name = "ground", this.gameMap || this.buildBase(), this.buildPaving(), this.buildKerbs(), this.gameMap || this.buildMoss(), this.buildRocks(), this.group.traverse((t) => {
			!(t instanceof e.Mesh) || Array.isArray(t.material) || t.material.name !== "granite-photogrammetry" || (t.geometry = B(t.geometry, 1.25));
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
		let t = this.gameMap ? P.x1 - P.x0 : 64, n = this.gameMap ? P.z1 - P.z0 : 64, r = this.gameMap ? rt(t, n) : li(3.6, !0, 0, 0), i = new e.Mesh(new e.PlaneGeometry(t, n), r);
		i.rotation.x = -Math.PI / 2, i.position.set(0, this.gameMap ? .025 : .015, this.gameMap ? (P.z0 + P.z1) / 2 - 40 : 8), i.receiveShadow = !0, i.name = "flagstone-path", this.group.add(i);
	}
	buildKerbs() {
		let t = new ti("kerbs"), n = ui(.06), r = [];
		for (let e of [-1, 1]) for (let n = 5; n < 33; n += 2.1) {
			let i = .12 + t.range(-.015, .025), a = Y(.34, .22, 2, e * 3.55, i, n + 2 / 2);
			a.scale(1, 1, .96), r.push(a);
		}
		let i = new e.Mesh(X(r), n);
		i.castShadow = !0, i.receiveShadow = !0, i.name = "kerbstones", this.group.add(i);
	}
	buildRocks() {
		let t = new ti("ground-rocks"), n = [];
		for (let r = 0; r < 26; r++) {
			let r = (t.chance(.5) ? -1 : 1) * t.range(3.6, 6.8), i = t.range(5, 28), a = t.range(.07, .26), o = new e.IcosahedronGeometry(a, 0);
			o.scale(1.4, t.range(.45, .8), 1), o.rotateY(t.range(0, Math.PI * 2)), o.translate(r, a * .5, i), Yr(o, new e.Color().setHSL(.1 + t.range(-.02, .02), .04, .16 + t.range(0, .1))), n.push(o);
		}
		let r = ui(.02), i = new e.Mesh(X(n), r);
		i.castShadow = !0, i.receiveShadow = !0, i.name = "path-rocks", this.group.add(i);
	}
	buildMoss() {
		let t = new ti("moss"), n = [];
		for (let r = 0; r < 190; r++) {
			let i = t.chance(.5) ? -1 : 1, a = r < 45, o = a ? t.range(-3, 3) : i * t.range(3.1, 16) * (t.chance(.5) ? 1 : .4), s = t.range(4.8, 33), c = a ? t.range(.015, .06) : t.range(.1, .4), l = new e.IcosahedronGeometry(c, 0);
			l.scale(1.6, .22, 1.6), l.translate(o, .035, s), Yr(l, new e.Color().setHSL(.23 + t.range(-.03, .03), .4, .11 + t.range(0, .05))), n.push(l);
		}
		let r = new e.MeshStandardMaterial({
			color: 16777215,
			roughness: 1,
			vertexColors: !0,
			envMapIntensity: .04
		}), i = new e.Mesh(X(n), r);
		i.receiveShadow = !0, i.name = "moss-clumps", this.group.add(i);
	}
}, Ci = {
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
}, wi = 1024, Ti = 4, $ = wi / Ti, Ei = Math.PI * 2, Di = {
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
function Oi(e, t) {
	return [
		Zr(e[0] * t, 0, 255),
		Zr(e[1] * t, 0, 255),
		Zr(e[2] * t, 0, 255)
	];
}
function ki(e, t = 1) {
	return `rgba(${Math.round(Zr(e[0], 0, 255))},${Math.round(Zr(e[1], 0, 255))},${Math.round(Zr(e[2], 0, 255))},${t})`;
}
function Ai(e, t, n, r) {
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
function ji(e, t, n, r, i, a, o, s = {}) {
	e.save(), e.translate(t, n), e.rotate(a);
	let c = e.createLinearGradient(0, 0, r, 0);
	c.addColorStop(0, ki(Oi(o, .66))), c.addColorStop(.42, ki(o)), c.addColorStop(1, ki(Oi(o, s.glow ?? 1.18))), e.fillStyle = c, Ai(e, r, i, s.serrated ?? !1), e.fill(), e.strokeStyle = ki(Oi(o, 1.62), .3), e.lineWidth = .9, e.stroke(), e.strokeStyle = ki(Oi(o, 1.55), .5), e.lineWidth = Math.max(.55, i * .045), e.beginPath(), e.moveTo(r * .03, 0), e.quadraticCurveTo(r * .5, -i * .07, r * .95, 0), e.stroke(), e.strokeStyle = ki(Oi(o, 1.75), .28), e.lineWidth = .55;
	for (let t = 1; t <= 4; t++) {
		let n = .2 + t * .16, a = r * n, o = i * (1 - n * .52);
		for (let t of [-1, 1]) e.beginPath(), e.moveTo(a, 0), e.quadraticCurveTo(a + r * .075, t * o * .42, a + r * .15, t * o * .64), e.stroke();
	}
	e.restore();
}
function Mi(e, t, n) {
	for (let r = 0; r < n.branches; r++) {
		let i = n.branches === 1 ? 0 : (r / (n.branches - 1) - .5) * 2, a = -Math.PI / 2 + i * t.range(.55, .95) + t.range(-.22, .22), o = n.reach * t.range(.62, 1), s = n.cx + Math.cos(a) * o, c = n.cy + Math.sin(a) * o, l = (n.cx + s) * .5 + t.range(-8, 8), u = (n.cy + c) * .5 + t.range(-4, 9);
		e.strokeStyle = "rgba(56,44,28,0.95)", e.lineWidth = t.range(1.15, 2.2), e.beginPath(), e.moveTo(n.cx, n.cy), e.quadraticCurveTo(l, u, s, c), e.stroke();
		for (let r = 0; r < n.perBranch; r++) {
			if (t.chance(n.sparse ?? .05)) continue;
			let i = .16 + r / n.perBranch * .9, o = Qr(n.cx, s, i) + (.5 - i) * 5, l = Qr(n.cy, c, i) + Math.sin(i * Math.PI) * (n.droop ?? 0), u = a + (r % 2 == 0 ? -1 : 1) * t.range(.5, 1.12) + t.range(-.18, .18);
			ji(e, o, l, t.range(n.len[0], n.len[1]) * (1.02 - i * .16), t.range(n.wid[0], n.wid[1]), u, n.palette[t.int(0, n.palette.length - 1)], {
				serrated: n.serrated,
				glow: n.glow
			});
		}
		ji(e, s, c, t.range(n.len[0], n.len[1]) * .82, t.range(n.wid[0], n.wid[1]) * .9, a + t.range(-.3, .3), n.palette[t.int(0, n.palette.length - 1)], {
			serrated: n.serrated,
			glow: n.glow
		});
	}
}
var Ni = [
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
], Pi = [
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
], Fi = [
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
], Ii = [
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
], Li = [
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
], Ri = [
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
], zi = [
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
], Bi = [
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
function Vi(e, t) {
	for (let n = 0; n < 26; n++) ji(e, $ * .5 + t.range(-42, 42), $ * .58 + t.range(-38, 38), t.range(26, 44), t.range(9, 15), t.range(-Math.PI, Math.PI), [
		26,
		42,
		22
	]);
	Mi(e, t, {
		cx: $ * .5,
		cy: $ * .66,
		branches: 5,
		reach: 108,
		perBranch: 9,
		len: [38, 60],
		wid: [13, 19],
		palette: Ni,
		droop: 6
	});
	for (let n = 0; n < 7; n++) ji(e, $ * .5 + t.range(-70, 70), $ * .46 + t.range(-58, 26), t.range(26, 38), t.range(9, 13), t.range(-Math.PI, Math.PI), Fi[t.int(0, Fi.length - 1)], { glow: 1.25 });
}
function Hi(e, t) {
	for (let n = 0; n < 14; n++) ji(e, $ * .5 + t.range(-40, 40), $ * .6 + t.range(-34, 34), t.range(30, 48), t.range(16, 24), t.range(-Math.PI, Math.PI), [
		44,
		54,
		30
	]);
	Mi(e, t, {
		cx: $ * .52,
		cy: $ * .64,
		branches: 3,
		reach: 104,
		perBranch: 8,
		len: [42, 66],
		wid: [18, 27],
		palette: Pi,
		droop: 9
	});
}
function Ui(e, t) {
	for (let n = 0; n < 13; n++) ji(e, $ * .5 + t.range(-44, 44), $ * .6 + t.range(-36, 36), t.range(32, 52), t.range(9, 13), t.range(-Math.PI, Math.PI), [
		34,
		44,
		24
	], { serrated: !0 });
	Mi(e, t, {
		cx: $ * .5,
		cy: $ * .68,
		branches: 4,
		reach: 110,
		perBranch: 9,
		len: [44, 70],
		wid: [10, 15],
		palette: Pi,
		serrated: !0,
		droop: 4
	});
}
function Wi(e, t) {
	for (let n = 0; n < 3; n++) {
		let r = $ * (.32 + n * .18) + t.range(-10, 10), i = $ - 8, a = r + t.range(-70, 70), o = t.range(44, 110), s = (r + a) * .5 + t.range(-24, 24), c = (i + o) * .5 + 12;
		e.strokeStyle = "rgba(62,50,32,0.9)", e.lineWidth = 1.7, e.beginPath(), e.moveTo(r, i), e.quadraticCurveTo(s, c, a, o), e.stroke();
		for (let n = 2; n <= 11; n++) {
			let l = n / 12, u = 1 - l, d = u * u * r + 2 * u * l * s + l * l * a, f = u * u * i + 2 * u * l * c + l * l * o, p = 2 * u * (s - r) + 2 * l * (a - s), m = 2 * u * (c - i) + 2 * l * (o - c), h = Math.atan2(m, p);
			for (let n of [-1, 1]) ji(e, d, f, t.range(18, 30) * (1.1 - l * .35), t.range(5, 8), h + n * t.range(.95, 1.25), Ni[t.int(0, Ni.length - 1)]);
		}
		ji(e, a, o, t.range(22, 32), t.range(6, 9), Math.atan2(o - c, a - s), Ni[4]);
	}
}
function Gi(e, t) {
	Mi(e, t, {
		cx: $ * .5,
		cy: $ * .64,
		branches: 3,
		reach: 96,
		perBranch: 6,
		len: [32, 50],
		wid: [13, 19],
		palette: Fi,
		sparse: .16,
		glow: 1.28
	});
	for (let n = 0; n < 5; n++) ji(e, $ * .5 + t.range(-54, 54), $ * .52 + t.range(-48, 18), t.range(22, 34), t.range(10, 14), t.range(-Math.PI, Math.PI), [
		150,
		158,
		92
	], { glow: 1.1 });
}
function Ki(e, t, n) {
	let r = n ? 5 : 4;
	for (let i = 0; i < r; i++) {
		let r = $ * t.range(.25, .75), i = $ * t.range(.28, .72);
		e.strokeStyle = "rgba(80,92,44,0.75)", e.lineWidth = .9, e.beginPath(), e.moveTo(r, i), e.lineTo(r + t.range(-16, 16), i + t.range(-16, 16)), e.stroke();
		let a = n ? 12 : 11;
		for (let o = 0; o < a; o++) {
			let a = t.range(-Math.PI, Math.PI);
			ji(e, r + t.range(-16, 16), i + t.range(-16, 16), t.range(n ? 34 : 46, n ? 58 : 82), t.range(n ? 5 : 7, n ? 8 : 11), a, Ii[t.int(0, Ii.length - 1)], { glow: 1.25 });
		}
	}
}
function qi(e, t) {
	for (let n = 0; n < 30; n++) ji(e, $ * .5 + t.range(-58, 58), $ * .55 + t.range(-48, 48), t.range(18, 32), t.range(8, 12), t.range(-Math.PI, Math.PI), [
		32,
		52,
		27
	]);
	Mi(e, t, {
		cx: $ * .5,
		cy: $ * .62,
		branches: 3,
		reach: 96,
		perBranch: 16,
		len: [20, 34],
		wid: [8, 12],
		palette: Li,
		sparse: .06,
		droop: 4
	});
}
function Ji(e, t) {
	for (let n = 0; n < 4; n++) {
		let n = $ * t.range(.34, .66), r = $ - 6, i = n + t.range(-84, 84), a = t.range(26, 96), o = (n + i) * .5 + t.range(-16, 16), s = (r + a) * .5 + t.range(4, 20);
		e.strokeStyle = "rgba(58,82,38,0.95)", e.lineWidth = 1.8, e.beginPath(), e.moveTo(n, r), e.quadraticCurveTo(o, s, i, a), e.stroke();
		for (let c = 3; c <= 13; c++) {
			let l = c / 14, u = 1 - l, d = u * u * n + 2 * u * l * o + l * l * i, f = u * u * r + 2 * u * l * s + l * l * a, p = 2 * u * (o - n) + 2 * l * (i - o), m = 2 * u * (s - r) + 2 * l * (a - s), h = Math.atan2(m, p);
			for (let n of [-1, 1]) ji(e, d, f, t.range(12, 22) * (1.15 - l * .5), t.range(3.2, 5), h + n * t.range(1, 1.3), zi[t.int(0, zi.length - 1)]);
		}
	}
}
function Yi(e, t) {
	for (let n = 0; n < 26; n++) {
		let r = $ * .5 + t.range(-88, 88), i = -Math.PI / 2 + t.range(-.62, .62), a = t.range(120, 232), o = t.range(-.35, .35);
		e.strokeStyle = ki(n % 7 == 0 ? [
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
		], .96), e.lineWidth = t.range(1.4, 3.2), e.beginPath(), e.moveTo(r, $ + 4), e.quadraticCurveTo(r + Math.cos(i) * a * .42, $ + Math.sin(i) * a * .62, r + Math.cos(i) * a * .78 + o * a, $ + Math.sin(i) * a), e.stroke();
	}
	for (let n = 0; n < 3; n++) {
		let n = $ * .5 + t.range(-52, 52), r = t.range(36, 78);
		e.strokeStyle = "rgba(120,116,66,0.85)", e.lineWidth = 1.2, e.beginPath(), e.moveTo(n, $), e.quadraticCurveTo(n + t.range(-18, 18), $ * .55, n + t.range(-26, 26), r), e.stroke();
		for (let i = 0; i < 7; i++) e.fillStyle = `rgba(${128 + t.int(0, 30)},${118 + t.int(0, 24)},${60 + t.int(0, 20)},0.9)`, e.beginPath(), e.ellipse(n + t.range(-7, 7), r + i * 5, 2.2, 4.2, t.range(-.3, .3), 0, Ei), e.fill();
	}
}
function Xi(e, t) {
	for (let n = 0; n < 56; n++) ji(e, $ * .5 + t.range(-74, 74), $ * .5 + t.range(-70, 70), t.range(15, 30), t.range(7, 11), t.range(-Math.PI, Math.PI), Ri[t.int(0, Ri.length - 1)], { glow: 1.1 });
	Mi(e, t, {
		cx: $ * .5,
		cy: $ * .56,
		branches: 3,
		reach: 86,
		perBranch: 14,
		len: [18, 30],
		wid: [8, 12],
		palette: Ri,
		sparse: .08,
		glow: 1.15
	});
}
function Zi(e, t) {
	for (let n = 0; n < 26; n++) ji(e, t.range(16, $ - 16), t.range(16, $ - 16), t.range(20, 38), t.range(8, 14), t.range(-Math.PI, Math.PI), Bi[t.int(0, Bi.length - 1)], { serrated: t.chance(.4) });
	for (let n = 0; n < 3; n++) {
		let n = t.range(40, $ - 40), r = t.range(40, $ - 40);
		e.strokeStyle = "rgba(72,58,36,0.9)", e.lineWidth = 1.1, e.beginPath(), e.moveTo(n, r), e.lineTo(n + t.range(-34, 34), r + t.range(-34, 34)), e.stroke();
	}
}
function Qi() {
	let e = vn(wi, wi, (e) => {
		let t = (t, n) => {
			let [r, i] = Di[t];
			e.save(), e.translate(r * $, i * $), e.beginPath(), e.rect(0, 0, $, $), e.clip(), n(e, new ti(`lingyin-veg-atlas-${t}`)), e.restore();
		};
		t("camphor", Vi), t("broad", Hi), t("chestnut", Ui), t("pinnate", Wi), t("young", Gi), t("bamboo", (e, t) => Ki(e, t, !1)), t("bambooSmall", (e, t) => Ki(e, t, !0)), t("shrub", qi), t("fern", Ji), t("grass", Yi), t("dark", Xi), t("fallen", Zi);
	});
	return e.name = "lingyin-veg-leaf-atlas", e.anisotropy = 16, e.needsUpdate = !0, e;
}
var $i = "\n#ifdef USE_INSTANCING\n  float vgPhase = instanceMatrix[3][0] * 0.61 + instanceMatrix[3][2] * 0.83 + instanceMatrix[3][1] * 0.27;\n  float vgSlow = sin(uTime * 0.52 + vgPhase);\n  float vgFast = sin(uTime * 1.87 + vgPhase * 1.93 + transformed.y * 1.7);\n  float vgGust = 0.55 + 0.45 * sin(uTime * 0.23 + vgPhase * 0.31);\n  float vgSway = (vgSlow * 0.05 + vgFast * 0.012) * vgGust;\n  float vgLift = 0.35 + max(transformed.y, 0.0) * 0.22;\n  transformed.x += vgSway * vgLift;\n  transformed.z += vgSway * 0.45 * vgLift;\n#endif\n", ea = "\n#ifdef USE_INSTANCING\n  float vgPhase = instanceMatrix[3][0] * 0.41 + instanceMatrix[3][2] * 0.73;\n  float vgSway = sin(uTime * 0.63 + vgPhase) * 0.014 + sin(uTime * 1.71 + vgPhase * 1.37) * 0.004;\n  float vgBend = transformed.y * transformed.y;\n  transformed.x += vgSway * vgBend;\n  transformed.z += vgSway * 0.45 * vgBend;\n#endif\n";
function ta(e, t) {
	return t < -2.4 ? 3.8 : Math.abs(e) < 8.5 && t < 6 ? 10.4 : Math.abs(e) < 10 && t < 10 ? 9 : 7.2;
}
function na(t) {
	let n = t.getAttribute("position").count, r = new Float32Array(n * 3).fill(1);
	return t.setAttribute("color", new e.BufferAttribute(r, 3)), t;
}
function ra(e) {
	let n = t(e, !1);
	if (!n) throw Error("vegetation: geometry merge failed");
	return n;
}
function ia(t, n, r) {
	let [i, a] = Di[t], o = new e.PlaneGeometry(n, r, 1, 1), s = o.getAttribute("uv"), c = 2 / wi, l = i / Ti + c, u = (i + 1) / Ti - c, d = 1 - (a + 1) / Ti + c, f = 1 - a / Ti - c;
	for (let e = 0; e < s.count; e++) s.setXY(e, Qr(l, u, s.getX(e)), Qr(d, f, s.getY(e)));
	return s.needsUpdate = !0, na(o), o;
}
var aa = /* @__PURE__ */ new Map();
function oa(e, t) {
	let n = `${e}:${t}`, r = aa.get(n);
	if (r) return r;
	let i;
	if (t === "canopy") {
		let t = ia(e, 1, 1), n = ia(e, .94, .88);
		n.rotateY(1.05), n.rotateX(.14), n.translate(.04, -.03, .03);
		let r = ia(e, .8, .72);
		r.rotateY(-.62), r.rotateX(1.06), r.translate(-.03, .15, 0), i = ra([
			t,
			n,
			r
		]);
	} else if (t === "spray") {
		let t = ia(e, 1, .82), n = ia(e, .9, .72);
		n.rotateY(1.16), n.rotateX(-.12), n.translate(.02, .04, .02), i = ra([t, n]);
	} else if (t === "tuft") {
		let t = [];
		for (let n = 0; n < 3; n++) {
			let r = ia(e, .72, 1);
			r.translate(0, .5, 0), r.rotateY(n / 3 * Math.PI + .3), r.rotateX(.05), t.push(r);
		}
		i = ra(t);
	} else if (t === "fern") {
		let t = [];
		for (let n = 0; n < 5; n++) {
			let r = ia(e, .72, 1);
			r.translate(0, .5, 0), r.rotateY(n / 5 * Ei + .2), r.rotateX(.18), t.push(r);
		}
		i = ra(t);
	} else {
		let t = ia(e, 1, 1);
		t.rotateX(-Math.PI / 2), i = t;
	}
	return i.computeBoundingSphere(), aa.set(n, i), i;
}
function sa(t, n, r = .08) {
	let i = [], a = [], o = [], s = t.length, c = new e.Vector3(), l = new e.Vector3(), u = new e.Vector3(), d = new e.Vector3(), f = new e.Vector3(), p = new e.Vector3(), m = new e.Vector3(0, 1, 0), h = new e.Vector3(1, 0, 0);
	for (let e = 0; e < s; e++) {
		l.copy(t[Math.max(0, e - 1)].center), u.copy(t[Math.min(s - 1, e + 1)].center), c.subVectors(u, l).normalize(), d.copy(Math.abs(c.y) > .9 ? h : m), f.crossVectors(d, c).normalize(), p.crossVectors(c, f).normalize();
		for (let o = 0; o < n; o++) {
			let c = o / n * Ei, l = 1 + r * ai(c * 1.9 + e * .37, e * 1.7 + o * .11), u = Math.max(.012, t[e].radius * l), d = Math.cos(c) * u, m = Math.sin(c) * u;
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
function ca(t, n) {
	return new e.CatmullRomCurve3(t, !1, "catmullrom", .5).getPoints(n);
}
function la(t) {
	let n = new e.IcosahedronGeometry(1, t), r = n.getAttribute("position");
	for (let e = 0; e < r.count; e++) {
		let t = r.getX(e), n = r.getY(e), i = r.getZ(e), a = 1 + .17 * oi(t * 1.4 + i * .6 + 4.7, n * 1.6 - i * .9);
		r.setXYZ(e, t * a, n * a * .9, i * a);
	}
	return n.computeVertexNormals(), na(n), n;
}
function ua() {
	let t = new ti("lingyin-veg-shrub-core"), n = [];
	for (let r = 0; r < 3; r++) {
		let i = new e.IcosahedronGeometry(r === 0 ? 1 : .62, +(r === 0)), a = i.getAttribute("position");
		for (let e = 0; e < a.count; e++) {
			let t = a.getX(e), n = a.getY(e), i = a.getZ(e), o = 1 + .15 * oi(t * 2.1 + r * 3.3, i * 2.4 - n * .7);
			a.setXYZ(e, t * o, n * o, i * o);
		}
		i.computeVertexNormals(), i.scale(1.2, .72, 1.1), i.translate(t.range(-.5, .5), .52 + t.range(-.08, .22), t.range(-.5, .5)), na(i), n.push(i);
	}
	return ra(n);
}
function da() {
	let t = new e.CylinderGeometry(.03, .058, .56, 5, 1, !0);
	t.translate(0, .28, 0);
	let n = new e.CylinderGeometry(.017, .032, .47, 5, 1, !0);
	n.translate(0, .765, 0);
	let r = new e.CylinderGeometry(.012, .024, .32, 4, 1, !0);
	return r.rotateZ(.72), r.translate(.1, .74, .02), ra([
		t,
		n,
		r
	]);
}
var fa = [
	.14,
	.29,
	.44,
	.59,
	.74,
	.89
];
function pa(t) {
	let n = t ? 6 : 5, r = new Set([0, 1]);
	for (let e of fa) t ? (r.add(e - .075), r.add(e - .014), r.add(e - .004), r.add(e + .004), r.add(e + .014), r.add(e + .033), r.add(e + .075)) : (r.add(e - .06), r.add(e + .01), r.add(e + .06));
	let i = sa([...r].filter((e) => e >= 0 && e <= 1).sort((e, t) => e - t).map((t) => {
		let n = .052 * (1 - .43 * t);
		for (let e of fa) {
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
		for (let e of fa) {
			let r = t - e;
			Math.abs(r) < .011 ? n *= .55 : Math.abs(r) < .035 && (n *= .86), r > .012 && r < .034 && (n = Math.min(1.16, n * 1.2));
		}
		n *= Qr(.86, 1.06, t), o[e * 3] = n, o[e * 3 + 1] = n * 1.02, o[e * 3 + 2] = n * .9;
	}
	return i.setAttribute("color", new e.BufferAttribute(o, 3)), i;
}
function ma(t, n) {
	let r = new e.Vector3(t.base[0], 0, t.base[1]), i = [];
	for (let n = 0; n <= 5; n++) {
		let a = n / 5, o = ai(a * 2.4 + 3.1, 8.7) * .62 * Math.sin(a * Math.PI), s = oi(a * 2.8 - 4.4, 2.3) * .62 * Math.sin(a * Math.PI);
		i.push(new e.Vector3(r.x + t.lean[0] * a * a + o, t.height * a, r.z + t.lean[1] * a * a + s));
	}
	let a = ca(i, 16), o = [sa(a.map((e, n) => {
		let r = n / (a.length - 1), i = t.radius * (1.06 - .88 * r ** .72) * (1 + .08 * ai(r * 6.3 + 1.7, t.height * .31));
		return {
			center: e.clone(),
			radius: Math.max(.055, i)
		};
	}), 10, .09)];
	for (let i = 0; i < 5; i++) {
		let a = i / 5 * Ei + n.range(-.3, .3), s = new e.Vector3(Math.cos(a), 0, Math.sin(a)), c = r.clone().add(new e.Vector3(s.x * t.radius * .35, t.radius * 1.2, s.z * t.radius * .35)), l = r.clone().addScaledVector(s, t.radius * 1.5 + n.range(0, .25));
		l.y = t.radius * .36;
		let u = r.clone().addScaledVector(s, t.radius * 2.8 + n.range(.1, .55));
		u.y = .02;
		let d = ca([
			c,
			l,
			u
		], 4), f = d.map((e, n) => ({
			center: e,
			radius: Math.max(.035, Qr(t.radius * .3, .045, n / (d.length - 1)))
		}));
		o.push(sa(f, 6, .14));
	}
	let s = [], c = new e.Vector3(...t.crown);
	for (let r = 0; r < t.branches; r++) {
		let i = Qr(.4, .88, (r + n.range(.15, .85)) / t.branches), l = a[Zr(Math.round(i * (a.length - 1)), 1, a.length - 2)].clone(), u = r / t.branches * Ei + n.range(-.55, .55), d = new e.Vector3(Math.cos(u), 0, Math.sin(u)), f = new e.Vector3(c.x, l.y + n.range(.8, 1.9), c.z).sub(l).normalize(), p = d.clone().multiplyScalar(.55).addScaledVector(f, .8).normalize(), m = n.range(2.8, 5.1) * (1.15 - i * .32), h = l.clone().addScaledVector(d, t.radius * .3), g = h.clone().addScaledVector(p, m * .46).add(new e.Vector3(n.range(-.4, .4), n.range(.35, 1.1), n.range(-.4, .4))), _ = h.clone().addScaledVector(p, m).add(new e.Vector3(n.range(-.45, .45), n.range(.8, 2), n.range(-.45, .45))), v = ca([
			h,
			g,
			_
		], 7), y = .07 + t.radius * .22 * (1 - i * .4), b = v.map((e, t) => ({
			center: e,
			radius: Math.max(.028, Qr(y, .032, (t / (v.length - 1)) ** .82))
		}));
		o.push(sa(b, 7, .1)), s.push({
			p: _.clone(),
			dir: p.clone(),
			weight: 1.1
		}), s.push({
			p: v[5].clone(),
			dir: p.clone(),
			weight: .9
		});
		let x = v[4].clone(), S = p.clone().add(new e.Vector3(n.range(-.7, .7), n.range(.35, .9), n.range(-.7, .7))).normalize(), C = x.clone().addScaledVector(S, n.range(1.3, 2.3)), w = ca([
			x,
			x.clone().lerp(C, .55).add(new e.Vector3(0, .3, 0)),
			C
		], 4), T = w.map((e, t) => ({
			center: e,
			radius: Math.max(.02, Qr(y * .42, .022, t / (w.length - 1)))
		}));
		o.push(sa(T, 5, .12)), s.push({
			p: C,
			dir: S,
			weight: .78
		});
	}
	let l = (t, r, a) => {
		let c = new e.CatmullRomCurve3(i, !1, "catmullrom", .5).getPointAt(r), l = ca([
			c,
			c.clone().lerp(t, .5).add(new e.Vector3(0, .8 + n.range(0, .9), 0)),
			c.clone().lerp(t, .78).add(new e.Vector3(0, .25, 0)),
			t
		], 9), u = l.map((e, t) => ({
			center: e,
			radius: Math.max(.026, Qr(a, .028, t / (l.length - 1)))
		}));
		o.push(sa(u, 7, .08));
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
		trunk: ra(o),
		anchors: s,
		lobes: f
	};
}
function ha(t, n) {
	let r = new e.Euler();
	if (n) {
		let e = Math.atan2(n.x, n.z) + t.range(-.85, .85);
		r.set(t.range(-.8, .8), e, t.range(-.75, .75), "YXZ");
	} else r.set(t.range(-1.25, 1.25), t.range(0, Ei), t.range(-1.15, 1.15), "YXZ");
	return new e.Quaternion().setFromEuler(r);
}
function ga(t, n, r) {
	let i = [
		.1,
		.2,
		.08
	], a = [
		.38,
		.56,
		.2
	], o = Zr(t, 0, 1), s = n.chance(.16) ? 1.1 : 1, c = Qr(i[0], a[0], o) * s + n.range(-.045, .045), l = Qr(i[1], a[1], o) + n.range(-.04, .04), u = Qr(i[2], a[2], o) * (s > 1 ? .94 : 1) + n.range(-.035, .035), d = r ? .6 : 1;
	return new e.Color().setRGB(Zr(c * d, 0, 2), Zr(l * d, 0, 2), Zr(u * d, 0, 2));
}
var _a = class {
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
		this.group.name = "vegetation", this.atlas = kr("gate-atlas") ?? Qi(), this.leafMat = gn({
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
				uTime: Ci.time,
				uSunDir: Ci.sunDir
			},
			vertexHead: "uniform float uTime;",
			head: "uniform vec3 uSunDir;",
			vertexPre: $i,
			color: "\n        float vgHigh = smoothstep(1.5, 11.0, cgP.y);\n        diffuseColor.rgb *= mix(0.70, 1.05, vgHigh);\n        diffuseColor.rgb *= 0.93 + 0.14 * cgNoise2(cgP.xz * 0.35 + cgP.y * 0.17);\n        diffuseColor.rgb *= mix(vec3(1.0), vec3(1.06, 1.035, 0.86), smoothstep(7.0, 12.0, cgP.y) * 0.7);\n      ",
			roughness: "\n        roughnessFactor = clamp(roughnessFactor * (0.86 + 0.24 * cgNoise2(cgP.xz * 2.0)), 0.5, 1.0);\n      ",
			emissive: "\n        vec3 vgView = normalize(cameraPosition - cgP);\n        float vgBack = pow(max(dot(-vgView, uSunDir), 0.0), 2.6);\n        float vgThin = 0.55 + 0.45 * cgNoise2(cgO.xy * 5.0 + 17.0);\n        float vgAO = 0.35 + 0.65 * smoothstep(0.0, 9.0, cgP.y);\n        totalEmissiveRadiance += vec3(0.30, 0.38, 0.12) * vgBack * vgThin * vgAO * 0.9;\n      "
		}), this.barkMat = ft() ?? gn({
			name: "lingyin-bark",
			params: {
				color: 16777215,
				roughness: .94,
				metalness: 0
			},
			color: "\n        float barkRidge = cgRidge2(vec2((cgP.x + cgP.z) * 6.0, cgP.y * 0.55));\n        float barkFine = cgFbm2(vec2((cgP.x - cgP.z) * 24.0, cgP.y * 5.5));\n        float barkLichen = smoothstep(0.55, 0.92, cgNoise2(vec2(cgP.y * 2.2, (cgP.x + cgP.z) * 7.0)) * 0.5 + 0.5);\n        float barkMoss = smoothstep(0.35, 0.85, cgFbm2(vec2(cgP.x * 1.3 + 5.0, cgP.z * 1.5)) * 0.5 + 0.5);\n        barkMoss *= 1.0 - smoothstep(0.4, 3.4, cgP.y + barkFine * 0.4);\n        vec3 bark = mix(vec3(0.105, 0.08, 0.058), vec3(0.30, 0.245, 0.175), smoothstep(0.25, 0.95, barkRidge));\n        bark *= 0.72 + 0.4 * barkFine;\n        bark = mix(bark, vec3(0.33, 0.34, 0.27), barkLichen * 0.22);\n        bark = mix(bark, vec3(0.14, 0.21, 0.08), barkMoss * 0.72);\n        diffuseColor.rgb *= bark;\n      ",
			normal: "\n        float e = 0.22;\n        float h0 = cgRidge2(vec2((cgP.x + cgP.z) * 6.0, cgP.y * 0.55));\n        float hx = cgRidge2(vec2((cgP.x + cgP.z + e) * 6.0, cgP.y * 0.55));\n        float hy = cgRidge2(vec2((cgP.x + cgP.z) * 6.0, (cgP.y + e) * 0.55));\n        float hz = cgRidge2(vec2((cgP.x - cgP.z + e) * 6.0, cgP.y * 0.55));\n        cgBump = vec3(hx - h0, hy - h0, hz - h0) * 2.4;\n      ",
			roughness: "\n        roughnessFactor = clamp(0.82 + 0.18 * cgNoise2(cgP.xz * 9.0 + cgP.y), 0.55, 1.0);\n      "
		}), this.massMat = gn({
			name: "lingyin-canopy-mass",
			params: {
				color: 16777215,
				roughness: 1,
				metalness: 0,
				flatShading: !0,
				vertexColors: !0
			},
			color: "\n        float vgN = cgFbm3(cgP * 0.65);\n        vec3 vgMass = mix(vec3(0.065, 0.10, 0.05), vec3(0.16, 0.22, 0.105), smoothstep(0.15, 0.85, vgN));\n        vgMass *= 0.68 + 0.52 * smoothstep(0.0, 9.0, cgP.y);\n        diffuseColor.rgb *= vgMass;\n      "
		}), this.bambooMat = gn({
			name: "lingyin-bamboo-culm",
			params: {
				color: 16777215,
				roughness: .62,
				metalness: 0,
				vertexColors: !0
			},
			uniforms: { uTime: Ci.time },
			vertexHead: "uniform float uTime;",
			vertexPre: ea,
			color: "\n        float bStripe = cgNoise2(vec2((cgP.x + cgP.z) * 18.0, cgP.y * 3.4));\n        float bGrime = cgFbm2(vec2(cgP.x * 2.6 + cgP.z * 1.8, cgP.y * 0.9));\n        vec3 bCol = mix(vec3(0.045, 0.075, 0.028), vec3(0.13, 0.17, 0.052), smoothstep(0.25, 0.9, bStripe * 0.5 + 0.5));\n        bCol *= 0.78 + 0.36 * bGrime;\n        float bPowder = smoothstep(0.7, 0.95, cgNoise2(vec2(cgP.y * 1.3, (cgP.x + cgP.z) * 2.0)) * 0.5 + 0.5);\n        bCol = mix(bCol, vec3(0.34, 0.36, 0.27), bPowder * 0.22);\n        diffuseColor.rgb *= bCol;\n      ",
			roughness: "\n        roughnessFactor = clamp(0.5 + 0.22 * cgNoise2(cgP.xz * 8.0 + cgP.y), 0.35, 0.95);\n      "
		}), this.coreMat = gn({
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
			e.uniforms.uTime = Ci.time, e.vertexShader = e.vertexShader.replace("#include <common>", "#include <common>\nuniform float uTime;").replace("#include <begin_vertex>", `#include <begin_vertex>\n${$i}`);
		}, t.customProgramCacheKey = () => "lingyin-veg-card-depth", t;
	}
	update(e) {
		Ci.time.value = e;
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
		let s = Zr(.26 + .54 * $r(4.5, 11.5, n.y) + .22 * ai(n.x * .35 + 3.1, n.z * .35 - 1.7) + (t.value() - .5) * .18, 0, 1), c = ha(t, i), l = new e.Vector3(Math.min(1.1, r * .62 * t.range(.9, 1.15)), Math.min(1, r * .62 * t.range(.68, .94)), Math.min(1.1, r * .62 * t.range(.9, 1.15)));
		this.pushCard("canopy", "canopy", o, n, c, l, ga(s, t, !1));
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
			let t = new ti(i.seed), a = ma(i, t);
			n.push(a.trunk);
			for (let n of a.anchors) {
				let r = Math.round(t.range(7, 11) * n.weight);
				for (let i = 0; i < r; i++) {
					let r = n.p.clone().add(new e.Vector3(t.gauss(), t.gauss() * .7, t.gauss()).multiplyScalar(.55 + n.weight * .42));
					r.y < ta(r.x, r.z) || this.addCanopyCard(t, r, t.range(.9, 1.7) * (.82 + n.weight * .2), t.chance(.5) ? n.dir : void 0);
				}
			}
			for (let n of a.lobes) {
				for (let r = 0; r < 380; r++) {
					let r = t.range(-1, 1), i = t.range(0, Ei), a = Math.sqrt(1 - r * r), o = t.value() ** .4, s = new e.Vector3(a * Math.cos(i), r, a * Math.sin(i)), c = n.center.clone().add(new e.Vector3(s.x * n.radii.x * o, s.y * n.radii.y * o, s.z * n.radii.z * o));
					if (c.y < ta(c.x, c.z)) continue;
					let l = Qr(.85, 1.9, $r(.5, 1, o) * t.range(.72, 1)) * t.range(.85, 1.15);
					this.addCanopyCard(t, c, l, s);
				}
				for (let r = 0; r < 26; r++) {
					let r = t.range(-.35, .95), i = t.range(0, Ei), a = Math.sqrt(Math.max(0, 1 - r * r)), o = new e.Vector3(a * Math.cos(i), r, a * Math.sin(i)), s = n.center.clone().add(new e.Vector3(o.x * n.radii.x, o.y * n.radii.y, o.z * n.radii.z).multiplyScalar(t.range(.92, 1.1)));
					s.y < ta(s.x, s.z) || this.addCanopyCard(t, s, t.range(1.2, 2), o);
				}
				for (let i = 0; i < 4; i++) {
					let i = n.center.clone().add(new e.Vector3(t.range(-.32, .32) * n.radii.x, t.range(-.28, .28) * n.radii.y, t.range(-.32, .32) * n.radii.z));
					r.push({
						pos: i,
						quat: ha(t),
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
						n.y < ta(n.x, n.z) || this.addCanopyCard(t, n, t.range(1.7, 2.9));
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
						n.y < ta(n.x, n.z) || this.addCanopyCard(t, n, t.range(1.6, 2.6));
					}
				}
			}
		}
		let i = ra(n);
		this.barkMat.name === "bark-photogrammetry" && (i = wn(B(i, 2.4), "bark"));
		let a = new e.Mesh(i, this.barkMat);
		a.name = "framing-trunks", a.castShadow = !0, a.receiveShadow = !0, this.group.add(a);
	}
	addBamboo() {
		let t = new ti("lingyin-veg-bamboo"), n = [], r = 0, i = (r, i, a, o, s, c, l) => {
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
				this.pushCard("bamboo", "spray", r, n, ha(t), new e.Vector3(i, i * t.range(.55, .8), i), new e.Color().setRGB(a * .92, a * 1.02, a * .7));
			}
		};
		for (; n.length < 108 && r < 7e3;) {
			r++;
			let a = n.length >= 96, o = a ? t.range(-9.4, -8.4) : t.range(-15, -9), s = a ? t.range(5.2, 7.8) : t.range(-2, 9);
			this.isPlatform(o, s, .15) || this.isPath(o, s, .3) || this.nearFramingTrunk(o, s, 1.3) || oi(o * .35 + 10.3, s * .35 - 3.1) < -.18 && t.chance(.45) || i(o, s, t.range(6, 10) * (a ? .94 : 1), a ? t.range(.3, .46) : t.range(.01, .09), a ? new e.Vector3(1, 0, t.range(-.3, .3)) : new e.Vector3(t.range(-1, 1), 0, t.range(-1, 1)), t.range(.72, 1.05) * (a ? 1.12 : 1), a || n.length < 24 && s > 2.5);
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
			this.pushCard("bamboo", "spray", t.chance(.6) ? "bamboo" : "bambooSmall", new e.Vector3(n, i, r), ha(t), new e.Vector3(a, a * .55, a), new e.Color().setRGB(o * .9, o * 1.02, o * .68));
		}
		for (let n = 0; n < 85; n++) {
			let n = t.range(-15.2, -8.9), r = t.range(-2, 9), i = t.range(3.4, 9.2), a = t.range(1.9, 3.2), o = t.range(.5, .85);
			this.pushCard("bamboo", "spray", t.chance(.6) ? "bamboo" : "bambooSmall", new e.Vector3(n, i, r), ha(t), new e.Vector3(a, a * .55, a), new e.Color().setRGB(o * .92, o * 1.02, o * .7));
		}
		let o = pa(!0), s = pa(!1), c = n.filter((e) => e.near), l = n.filter((e) => !e.near), u = (t, n, r, i) => {
			if (!t.length) return;
			let a = new e.InstancedMesh(n, this.bambooMat, t.length);
			for (let e = 0; e < t.length; e++) a.setMatrixAt(e, t[e].matrix), a.setColorAt(e, t[e].color);
			a.instanceMatrix.needsUpdate = !0, a.instanceColor && (a.instanceColor.needsUpdate = !0), a.castShadow = r, a.receiveShadow = !0, a.name = i, a.computeBoundingSphere(), this.group.add(a);
		};
		u(c, o, !0, "bamboo-near"), u(l, s, !1, "bamboo-far");
	}
	addShrubs() {
		let t = new ti("lingyin-veg-shrubs"), n = [], r = [], i = 0;
		for (; r.length < 138 && i < 8e3;) {
			i++;
			let e = t.chance(.5) ? -1 : 1, n, a, o, s = r.length;
			s < 44 ? (n = e * t.range(8.25, 10.6), a = t.range(-2.3, 3.7), o = t.range(.8, 1.35)) : s < 86 ? (n = e * t.range(8.2, 12.6), a = t.range(3.9, 10.4), o = t.range(.7, 1.25)) : s < 112 ? (n = e * t.range(10.5, 14.5), a = t.range(-2, 10.5), o = t.range(.85, 1.45)) : s < 128 ? (n = e * t.range(5.4, 7.6), a = t.range(4.6, 9.8), o = t.range(.5, .9)) : (n = e * t.range(8.2, 11), a = t.range(-3.4, -1.8), o = t.range(.75, 1.2)), !this.isPlatform(n, a, .35) && (this.isPath(n, a, .45) || this.nearFramingTrunk(n, a, 1.5) || oi(n * .6 + 2, a * .6 - 8) < -.35 && t.chance(.5) || r.push({
				x: n,
				z: a,
				scale: o
			}));
		}
		for (let i of r) {
			let r = new e.Quaternion().setFromEuler(new e.Euler(0, t.range(0, Ei), 0)), a = new e.Vector3(i.scale * t.range(.16, .26), i.scale * t.range(.12, .2), i.scale * t.range(.16, .26)), o = t.range(.55, 1.15);
			n.push({
				pos: new e.Vector3(i.x, 0, i.z),
				quat: r,
				scale: a,
				color: new e.Color().setRGB(o * .42, o * .56, o * .38)
			});
			let s = t.int(14, 20), c = i.scale * t.range(.85, 1.2);
			for (let n = 0; n < s; n++) {
				let n = t.range(0, Ei), r = t.range(.25, .95) * i.scale, a = new e.Vector3(i.x + Math.cos(n) * r, t.range(.3, 1.05) * c, i.z + Math.sin(n) * r);
				if (this.isPath(a.x, a.z, .05) || this.isPlatform(a.x, a.z, .15)) continue;
				let o = t.range(.3, .62) * i.scale, s = t.range(.34, .8);
				this.pushCard("shrub", "spray", t.chance(.7) ? "shrub" : "camphor", a, ha(t), new e.Vector3(o, o * t.range(.68, .95), o), new e.Color().setRGB(s * .88, s, s * .76));
			}
		}
		let a = new e.InstancedMesh(ua(), this.coreMat, n.length);
		for (let t = 0; t < n.length; t++) {
			let r = n[t];
			a.setMatrixAt(t, new e.Matrix4().compose(r.pos, r.quat, r.scale)), a.setColorAt(t, r.color);
		}
		a.instanceMatrix.needsUpdate = !0, a.instanceColor && (a.instanceColor.needsUpdate = !0), a.castShadow = !0, a.receiveShadow = !0, a.name = "shrub-cores", a.computeBoundingSphere(), this.group.add(a);
	}
	addUnderstory() {
		let t = new ti("lingyin-veg-understory"), n = 0, r = 0;
		for (; n < 260 && r < 7e3;) {
			r++;
			let i = t.chance(.72), a = t.chance(.5) ? -1 : 1, o = i ? a * t.range(3.3, 5.4) : a * t.range(8.1, 10.8), s = i ? t.range(4, 26) : t.range(-3.4, 3.6);
			if (this.isPlatform(o, s, .05) || this.isPath(o, s, .05)) continue;
			let c = t.range(.5, 1.05), l = t.range(.45, 1);
			this.pushCard("under", "tuft", "grass", new e.Vector3(o, 0, s), new e.Quaternion().setFromEuler(new e.Euler(0, t.range(0, Ei), 0)), new e.Vector3(c, c * t.range(.45, .8), c), new e.Color().setRGB(l * .92, l, l * .62)), n++;
		}
		let i = 0;
		for (r = 0; i < 110 && r < 5e3;) {
			r++;
			let n = (t.chance(.5) ? -1 : 1) * t.range(3.5, 6.6), a = t.range(4.2, 15.5);
			if (this.isPlatform(n, a, .1) || this.isPath(n, a, .05)) continue;
			let o = t.range(.75, 1.45), s = t.range(.42, .95);
			this.pushCard("under", "fern", "fern", new e.Vector3(n, 0, a), new e.Quaternion().setFromEuler(new e.Euler(0, t.range(0, Ei), 0)), new e.Vector3(o, o * t.range(.6, 1), o), new e.Color().setRGB(s * .86, s, s * .68)), i++;
		}
	}
	addBackgroundForest() {
		let t = new ti("lingyin-veg-background"), n = [], r = [], i = [], a = (i, a, o, s, c) => {
			let l = t.range(.7, 1.4) * s, u = t.range(0, Ei), d = new e.Matrix4().compose(new e.Vector3(i, 0, a), new e.Quaternion().setFromEuler(new e.Euler(0, u, 0)), new e.Vector3(l, o, l)), f = t.range(.55, .9);
			n.push({
				matrix: d,
				color: new e.Color().setRGB(f, f, f)
			});
			let p = new e.Vector3(i, o * t.range(.72, .9), a), m = o * t.range(.28, .42), h = t.int(2, 3);
			for (let n = 0; n < h; n++) {
				let n = p.clone().add(new e.Vector3(t.range(-m * .55, m * .55), t.range(-m * .3, m * .4), t.range(-m * .55, m * .55))), i = t.range(.3, .52);
				r.push({
					pos: n,
					quat: ha(t),
					scale: new e.Vector3(m * t.range(.7, 1.25), m * t.range(.55, .9), m * t.range(.7, 1.25)),
					color: new e.Color().setRGB(i * .78, i, i * .72)
				});
			}
			if (!c) return;
			let g = t.int(14, 20);
			for (let n = 0; n < g; n++) {
				let n = t.range(0, Ei), r = m * t.range(.3, 1), i = new e.Vector3(p.x + Math.cos(n) * r, p.y + t.range(-m * .6, m * .75), p.z + Math.sin(n) * r);
				if (i.y < 3.2) continue;
				let a = Math.min(4.2, m * t.range(.65, 1.15)), o = t.range(.42, .8);
				this.pushCard("bg", "canopy", t.chance(.5) ? "camphor" : "chestnut", i, ha(t), new e.Vector3(a, a * t.range(.7, .95), a), new e.Color().setRGB(o * .82, o, o * .8));
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
				quat: ha(t),
				scale: new e.Vector3(a, a * t.range(.45, .75), a),
				color: new e.Color().setRGB(.2, .3, .2)
			});
		}
		for (let n = 0; n < 230; n++) {
			let n = t.range(-42, 42), r = t.range(-38, -24), a = t.range(2.2, 4.2);
			i.push({
				pos: new e.Vector3(n, t.range(3, 12), r),
				quat: ha(t),
				scale: new e.Vector3(a, a * t.range(.6, .95), a),
				color: new e.Color().setRGB(t.range(.16, .28), t.range(.24, .4), t.range(.18, .3))
			});
		}
		for (let n = 0; n < 40; n++) {
			let n = t.chance(.5) ? -1 : 1, r = t.range(4, 8);
			i.push({
				pos: new e.Vector3(n * t.range(22, 40), t.range(2, 10), t.range(-18, 18)),
				quat: ha(t),
				scale: new e.Vector3(r, r * t.range(.55, .9), r),
				color: new e.Color().setRGB(.18, .28, .2)
			});
		}
		let c = da();
		this.barkMat.name === "bark-photogrammetry" && (c = wn(B(c, 2.4), "bark"));
		let l = new e.InstancedMesh(c, this.barkMat, n.length);
		for (let e = 0; e < n.length; e++) l.setMatrixAt(e, n[e].matrix), l.setColorAt(e, n[e].color);
		l.instanceMatrix.needsUpdate = !0, l.instanceColor && (l.instanceColor.needsUpdate = !0), l.castShadow = !1, l.receiveShadow = !0, l.name = "background-trunks", l.computeBoundingSphere(), this.group.add(l), this.addBlobInstances;
	}
	addCanopyCeiling() {
		let t = new ti("lingyin-canopy-ceiling");
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
			t.push(L(.86, s - o, f + .25, p, (o + s) / 2, m, h)), n.push(L(.34, l - c, f - .08, p, (c + l) / 2, m, h)), i.push(L(.5, .18, f + .22, p, l + .015, m, h));
			for (let e of [-1, 1]) i.push(L(.1, .16, f + .48, p + e * g * .88, l + .06, m + e * _ * .88, h));
			for (let t of [-1, 1]) {
				let n = new e.BoxGeometry(.95, .1, f + .5);
				n.rotateZ(t * .34), n.rotateY(h), n.translate(p + g * t * .38, l + .2, m + _ * t * .38), r.push(n);
			}
			r.push(L(.18, .14, f + .52, p, l + .36, m, h));
			let v = Math.max(2, Math.ceil(f / 6.4));
			for (let e = 0; e <= v; e++) {
				let t = e / v;
				i.push(L(.46, l - c + .12, .46, u.x0 + a * t, (c + l) / 2, u.z0 + d * t, h));
			}
		}
		let u = (t, n, r, i) => {
			let a = new e.Mesh(B(z(t), i), n);
			a.castShadow = !0, a.receiveShadow = !0, a.name = r, this.group.add(a);
		};
		u(t, ui(.12), "forecourt-boundary-stone-base", 1.25), u(n, xn(), "forecourt-boundary-plaster", 1.8), u(r, new e.MeshStandardMaterial({
			color: new e.Color("#2c322d"),
			roughness: .95,
			metalness: 0
		}), "forecourt-boundary-roof-cap", .72), u(i, bn(1), "forecourt-boundary-timber-posts", .7);
	}
	addGroundDetails(t = !1) {
		let n = new ti("lingyin-veg-ground"), r = 0, i = 0;
		for (; r < 130 && i < 3e3;) {
			i++;
			let t = (n.chance(.5) ? -1 : 1) * n.range(3.35, 7.6), a = n.range(4, 13.5);
			if (this.isPlatform(t, a, 0)) continue;
			let o = n.range(.55, 1.15), s = n.range(.55, 1.15);
			this.pushCard("ground", "scatter", "fallen", new e.Vector3(t, n.range(.015, .04), a), new e.Quaternion().setFromEuler(new e.Euler(-Math.PI / 2 + n.range(-.12, .12), n.range(0, Ei), 0, "YXZ")), new e.Vector3(o * n.range(.85, 1.2), o, o), new e.Color().setRGB(s, s * .94, s * .86)), r++;
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
				quat: ha(n),
				scale: new e.Vector3(o * n.range(1.1, 1.7), o * .45, o * n.range(1.1, 1.7)),
				color: new e.Color().setRGB(n.range(1.1, 1.55), n.range(1.35, 1.9), n.range(.7, 1))
			});
		}
		let o = new e.InstancedMesh(la(0), this.coreMat, a.length);
		for (let t = 0; t < a.length; t++) {
			let n = a[t];
			o.setMatrixAt(t, new e.Matrix4().compose(n.pos, n.quat, n.scale)), o.setColorAt(t, n.color);
		}
		o.instanceMatrix.needsUpdate = !0, o.instanceColor && (o.instanceColor.needsUpdate = !0), o.castShadow = !1, o.receiveShadow = !0, o.name = "moss-clumps", o.computeBoundingSphere(), this.group.add(o);
	}
	flushCards() {
		for (let t of this.buckets.values()) {
			if (!t.matrices.length) continue;
			let n = oa(t.cell, t.shape), r = new e.InstancedMesh(n, this.leafMat, t.matrices.length);
			for (let e = 0; e < t.matrices.length; e++) r.setMatrixAt(e, t.matrices[e]), r.setColorAt(e, t.colors[e]);
			r.instanceMatrix.needsUpdate = !0, r.instanceColor && (r.instanceColor.needsUpdate = !0);
			let i = t.layer === "canopy" || t.layer === "bamboo";
			r.castShadow = i, r.receiveShadow = !0, i && (r.customDepthMaterial = this.depthMat), r.name = `veg-cards-${t.layer}-${t.cell}`, r.computeBoundingSphere(), this.group.add(r);
		}
	}
}, va = "\nattribute float aDepth;\nattribute float aFlow;\nvarying float vDepth;\nvarying float vFlow;\nvarying vec2 vUvW;\nvoid main(){\n  vDepth = aDepth;\n  vFlow = aFlow;\n  vUvW = uv;\n  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n}\n", ya = class {
	group = new e.Group();
	material;
	waterfall;
	fallMat;
	constructor() {
		this.group.name = "water", this.material = this.makeWaterMaterial();
		let n = [], r = de.filter(([e, t]) => Ee(e, t, 1)), i = [], a = [], o = [], s = [], c = [], l = r.length, u = 0;
		for (let e = 0; e < l; e++) {
			let [t, n] = r[e], f = r[Math.max(0, e - 1)], p = r[Math.min(l - 1, e + 1)], m = p[0] - f[0], h = p[1] - f[1], g = Math.hypot(m, h) || 1;
			m /= g, h /= g;
			let _ = -h, v = m;
			e > 0 && (u += Math.hypot(t - r[e - 1][0], n - r[e - 1][1]));
			let y = pe(t, n).t, b = me(y) * .54, x = he(y);
			for (let e of [-1, 1]) {
				let r = t + _ * b * e, c = n + v * b * e, l = x - I(r, c);
				i.push(r, x + .015, c), a.push(e < 0 ? 0 : 1, u / 4.5), o.push(d(l, 0, 4)), s.push(.7 + y * .6);
			}
			if (e < l - 1) {
				let t = e * 2;
				c.push(t, t + 2, t + 1, t + 1, t + 2, t + 3);
			}
		}
		let f = new e.BufferGeometry();
		f.setAttribute("position", new e.Float32BufferAttribute(i, 3)), f.setAttribute("uv", new e.Float32BufferAttribute(a, 2)), f.setAttribute("aDepth", new e.Float32BufferAttribute(o, 1)), f.setAttribute("aFlow", new e.Float32BufferAttribute(s, 1)), f.setIndex(c), f.computeVertexNormals(), n.push(f);
		let p = new e.CircleGeometry(F.pond.r, 64, 0, Math.PI * 2);
		p.rotateX(-Math.PI / 2);
		let m = p.getAttribute("position"), h = [], g = [];
		for (let e = 0; e < m.count; e++) {
			let t = m.getX(e) + F.pond.x, n = m.getZ(e) + F.pond.z;
			m.setX(e, t), m.setZ(e, n), m.setY(e, ve), h.push(d(ve - I(t, n), 0, 4)), g.push(.28);
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
			vertexShader: va,
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
function ba(t) {
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
var xa = "\nattribute vec3 aPos;\nattribute vec2 aScale;\nattribute float aRot;\nattribute float aAlpha;\nvarying vec2 vUv;\nvarying float vAlpha;\n", Sa = `
${xa}
void main(){
  float c = cos(aRot), s = sin(aRot);
  vec2 p = mat2(c, -s, s, c) * position.xy;
  vec3 wp = aPos + vec3(p.x * aScale.x, 0.0, p.y * aScale.y);
  vUv = uv;
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`, Ca = `
${xa}
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
`, wa = "\nuniform sampler2D uMap;\nuniform vec3 uTint;\nvarying vec2 vUv;\nvarying float vAlpha;\nvoid main(){\n  float a = texture2D(uMap, vUv).a;\n  if (a < 0.002) discard;\n  gl_FragColor = vec4(uTint, a * vAlpha);\n}\n", Ta = class {
	group = new e.Group();
	tex = ba("mist");
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
		this.uniforms.uMap.value = this.tex, this.ground = this.makeLayer(this.banks.length, Sa), this.billboard = this.makeLayer(this.puffs.length, Ca);
		let r = new e.Mesh(this.ground.geo, new e.ShaderMaterial({
			uniforms: this.uniforms,
			vertexShader: Sa,
			fragmentShader: wa,
			transparent: !0,
			depthWrite: !1,
			side: e.DoubleSide
		}));
		r.frustumCulled = !1, r.renderOrder = 18, this.group.add(r);
		let i = new e.Mesh(this.billboard.geo, new e.ShaderMaterial({
			uniforms: this.uniforms,
			vertexShader: Ca,
			fragmentShader: wa,
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
export { n as ATMO, Kr as Details, xi as ForestGate, _a as GateFramingTrees, Si as GateGround, Nt as HillsideTrail, Xt as LingyinMasterplanBlockout, Ta as Mist, u as Sky, Vn as Temple, Ie as Terrain, Gr as Vegetation, F as WORLD, ya as Water, wt as buddhaMaterial, Zt as createApprovedLingyinLandscape, vr as createMainHallInterior, Sr as createSmallHallInteriors, I as heightAt, Tr as mainHallStatueSolids, Ir as preloadFoliagePhotos, Or as preloadRuntimeTextures, $e as preloadTempleTextures, Pe as preloadTerrainTextures };
