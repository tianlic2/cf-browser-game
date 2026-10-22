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
}, r = "\nuniform vec3 uSunDir;\nuniform vec3 uSunColor;\nuniform vec3 uHazeColor;\nuniform vec3 uMistColor;\nuniform float uHazeDensity;\nuniform float uHazeHeight;\nuniform float uMistDensity;\nuniform float uMistHeight;\nuniform float uHazeFar;\nuniform float uTime;\n\nfloat atmoHG(float mu, float g){\n  float g2 = g * g;\n  return (1.0 - g2) / (12.5663706 * pow(max(1.0 + g2 - 2.0 * g * mu, 1e-4), 1.5));\n}\n// optical depth of an exponential height layer along a ray\nfloat atmoOD(float y0, float dy, float dist, float dens, float H){\n  float a = dens * exp(clamp(-y0 / H, -40.0, 40.0));\n  float k = dy * dist / H;\n  float f = abs(k) > 1e-3 ? (1.0 - exp(-clamp(k, -40.0, 40.0))) / k : 1.0 - 0.5 * k;\n  return a * dist * f;\n}\nvec3 atmoApply(vec3 col, vec3 camPos, vec3 wp){\n  vec3 V = wp - camPos;\n  float dist = length(V);\n  if (dist < 0.01) return col;\n  vec3 dir = V / dist;\n  float odH = atmoOD(camPos.y, dir.y, dist, uHazeDensity, uHazeHeight);\n  float odM = atmoOD(camPos.y, dir.y, dist, uMistDensity, uMistHeight);\n  odH += uHazeFar * dist * dist;\n  vec3 TH = exp(-odH * vec3(0.85, 1.0, 1.18));\n  float TM = exp(-odM);\n  float mu = dot(dir, uSunDir);\n  float phase = atmoHG(mu, 0.72) * 12.5663706;\n  vec3 hz = uHazeColor + uSunColor * (0.22 * phase);\n  vec3 mz = uMistColor + uSunColor * (0.10 * (atmoHG(mu, 0.45) * 12.5663706));\n  // warm sun-side tint low in the valley, cool shade away from it\n  hz = mix(hz, hz * vec3(1.06, 1.0, 0.92), smoothstep(0.0, 0.5, mu));\n  col = col * TH + hz * (1.0 - TH);\n  col = col * TM + mz * (1.0 - TM);\n  return col;\n}\n", i = "\nfloat cgHash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }\nfloat cgHash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }\nvec3 cgHash33(vec3 p3){ p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }\nfloat cgNoise2(vec2 p){\n  vec2 i = floor(p), f = fract(p);\n  f = f * f * (3.0 - 2.0 * f);\n  float a = cgHash12(i), b = cgHash12(i + vec2(1,0)), c = cgHash12(i + vec2(0,1)), d = cgHash12(i + vec2(1,1));\n  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);\n}\nfloat cgNoise3(vec3 p){\n  vec3 i = floor(p), f = fract(p);\n  f = f * f * (3.0 - 2.0 * f);\n  float n000 = cgHash12(i.xy + i.z * 19.19);\n  float n100 = cgHash12(i.xy + vec2(1,0) + i.z * 19.19);\n  float n010 = cgHash12(i.xy + vec2(0,1) + i.z * 19.19);\n  float n110 = cgHash12(i.xy + vec2(1,1) + i.z * 19.19);\n  float n001 = cgHash12(i.xy + (i.z + 1.0) * 19.19);\n  float n101 = cgHash12(i.xy + vec2(1,0) + (i.z + 1.0) * 19.19);\n  float n011 = cgHash12(i.xy + vec2(0,1) + (i.z + 1.0) * 19.19);\n  float n111 = cgHash12(i.xy + vec2(1,1) + (i.z + 1.0) * 19.19);\n  return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y), mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);\n}\nfloat cgFbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i=0;i<5;i++){ s += a * cgNoise2(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }\nfloat cgFbm3(vec3 p){ float s = 0.0, a = 0.5; for (int i=0;i<4;i++){ s += a * cgNoise3(p); p = p * 2.05 + 7.3; a *= 0.5; } return s; }\nfloat cgRidge2(vec2 p){ float s = 0.0, a = 0.55; for (int i=0;i<4;i++){ float n = 1.0 - abs(cgNoise2(p) * 2.0 - 1.0); s += a * n * n; p = p * 2.1 + 3.1; a *= 0.5; } return s; }\n// anti-aliased thin line: distance d in world units, width w, pixel footprint aa\nfloat cgLine(float d, float w, float aa){ return 1.0 - smoothstep(w, w + aa, abs(d)); }\n", a = "\nvarying vec3 vCgWorld;\nvarying vec3 vCgNormalW;\nvarying vec3 vCgObj;\nvarying float vCgSeed;\n", o = "\n{\n  vec4 cgP = vec4(transformed, 1.0);\n  vec3 cgN = objectNormal;\n  float cgSeedV = 0.0;\n  #ifdef USE_INSTANCING\n    cgP = instanceMatrix * cgP;\n    cgN = mat3(instanceMatrix) * cgN;\n    cgSeedV = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);\n  #endif\n  vCgWorld = (modelMatrix * cgP).xyz;\n  vCgNormalW = normalize(mat3(modelMatrix) * cgN);\n  vCgObj = transformed;\n  vCgSeed = cgSeedV;\n}\n";
function s(t = {}) {
	let n = new e.MeshStandardMaterial(t.params ?? {});
	t.name && (n.name = t.name);
	let r = t.uniforms ?? {}, s = "proc:" + c([
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
	return n.customProgramCacheKey = () => s, n.onBeforeCompile = (e) => {
		Object.assign(e.uniforms, r);
		let n = e.vertexShader, s = e.fragmentShader;
		n = n.replace("#include <common>", `#include <common>\n${a}\n${t.vertexHead ?? ""}`), t.vertexPre && (n = n.replace("#include <begin_vertex>", `#include <begin_vertex>\n{\n${t.vertexPre}\n}`)), n = n.replace("#include <worldpos_vertex>", `#include <worldpos_vertex>\n${o}`), s = s.replace("#include <common>", `#include <common>\n${a}\n${i}\n${t.head ?? ""}`), s = s.replace("void main() {", "void main() {\nvec3 cgP = vCgWorld; vec3 cgN = normalize(vCgNormalW); vec3 cgO = vCgObj; float cgSeed = vCgSeed; vec3 cgBump = vec3(0.0); float cgAO = 1.0;"), t.color && (s = s.replace("#include <color_fragment>", `#include <color_fragment>\n{\n${t.color}\n}`)), t.roughness && (s = s.replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>\n{\n${t.roughness}\n}`)), t.metalness && (s = s.replace("#include <metalnessmap_fragment>", `#include <metalnessmap_fragment>\n{\n${t.metalness}\n}`)), t.normal && (s = s.replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\n{\n${t.normal}\n}\nnormal = normalize(normal + (viewMatrix * vec4(cgBump, 0.0)).xyz);`)), t.emissive && (s = s.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n{\n${t.emissive}\n}`)), t.ao && (s = s.replace("#include <aomap_fragment>", `#include <aomap_fragment>\n{\n${t.ao}\n}\nreflectedLight.indirectDiffuse *= cgAO; reflectedLight.indirectSpecular *= mix(1.0, cgAO, 0.7);`)), e.vertexShader = n, e.fragmentShader = s;
	}, n;
}
function c(e) {
	let t = 2166136261;
	for (let n = 0; n < e.length; n++) t ^= e.charCodeAt(n), t = Math.imul(t, 16777619);
	return (t >>> 0).toString(36);
}
//#endregion
//#region src/core/sky.ts
var l = "\nvarying vec3 vDir;\nvoid main(){\n  vDir = position;\n  vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);\n  gl_Position = p.xyww;\n}\n", u = `
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
${i}

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
}
`, d = class {
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
			vertexShader: l,
			fragmentShader: u,
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
}, f = class {
	group = new e.Group();
	constructor() {
		this.group.name = "backdrop", this.addRidge(360, 58, .82, "#7f8d91", 17), this.addRidge(560, 92, .68, "#8d989a", 29), this.addRidge(880, 150, .5, "#9aa4a5", 41), this.addRidge(1280, 210, .36, "#a7afaf", 57);
	}
	addRidge(t, i, a, o, s) {
		let c = [], l = [], u = [], d = new e.Color(o).multiplyScalar(a);
		for (let e = 0; e <= 220; e++) {
			let n = e / 220 * Math.PI * 2, r = Math.cos(n) * t, a = Math.sin(n) * t, o = .5 + .5 * Math.sin(n * 7 + s) * Math.sin(n * 3.1 + s * 2.3), f = .5 + .5 * Math.sin(n * 17 + s * 1.7), p = i * (.5 + .5 * o) * (.72 + .28 * f);
			c.push(r, -8, a, r, p, a);
			let m = .72 + .28 * f;
			if (l.push(d.r * m, d.g * m, d.b * m, d.r * 1.05, d.g * 1.05, d.b * 1.05), e < 220) {
				let t = e * 2;
				u.push(t, t + 2, t + 1, t + 1, t + 2, t + 3);
			}
		}
		let f = new e.BufferGeometry();
		f.setAttribute("position", new e.Float32BufferAttribute(c, 3)), f.setAttribute("color", new e.Float32BufferAttribute(l, 3)), f.setIndex(u);
		let p = new e.ShaderMaterial({
			uniforms: {
				uSunDir: n.sunDir,
				uSunColor: n.sunColor,
				uHazeColor: n.hazeColor,
				uMistColor: n.mistColor,
				uHazeDensity: n.hazeDensity,
				uHazeHeight: n.hazeHeight,
				uMistDensity: n.mistDensity,
				uMistHeight: n.mistHeight,
				uHazeFar: n.hazeFar,
				uTime: n.time
			},
			vertexShader: "\n        varying vec3 vColor;\n        varying vec3 vWorld;\n        void main(){\n          vColor = color;\n          vec4 wp = modelMatrix * vec4(position, 1.0);\n          vWorld = wp.xyz;\n          gl_Position = projectionMatrix * viewMatrix * wp;\n        }\n      ",
			fragmentShader: `
        varying vec3 vColor;
        varying vec3 vWorld;
        ${r}
        void main(){
          vec3 c = atmoApply(vColor, cameraPosition, vWorld);
          gl_FragColor = vec4(c, 1.0);
        }
      `,
			vertexColors: !0,
			side: e.DoubleSide,
			depthWrite: !0
		}), m = new e.Mesh(f, p);
		m.frustumCulled = !1, m.renderOrder = -5, this.group.add(m);
	}
}, p = (e, t, n) => e < t ? t : e > n ? n : e, m = (e, t, n) => e + (t - e) * n, h = (e, t, n) => {
	let r = p((n - e) / (t - e), 0, 1);
	return r * r * (3 - 2 * r);
}, g = (e, t, n) => Math.exp(-(e * e + t * t) / (n * n));
function _(e) {
	let t = e >>> 0;
	return () => {
		t |= 0, t = t + 1831565813 | 0;
		let e = Math.imul(t ^ t >>> 15, 1 | t);
		return e = e + Math.imul(e ^ e >>> 7, 61 | e) ^ e, ((e ^ e >>> 14) >>> 0) / 4294967296;
	};
}
var v = class {
	next;
	constructor(e) {
		let t = typeof e == "number" ? e : y(e);
		this.next = _(t);
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
function y(e) {
	let t = 2166136261;
	for (let n = 0; n < e.length; n++) t ^= e.charCodeAt(n), t = Math.imul(t, 16777619);
	return t >>> 0;
}
function b(e, t) {
	let n = Math.imul(e | 0, 374761393) + Math.imul(t | 0, 668265263);
	return n = Math.imul(n ^ n >>> 13, 1274126177), ((n ^ n >>> 16) >>> 0) / 4294967296;
}
var x = (e) => e * e * (3 - 2 * e);
function S(e, t) {
	let n = Math.floor(e), r = Math.floor(t), i = e - n, a = t - r, o = x(i), s = x(a), c = b(n, r), l = b(n + 1, r), u = b(n, r + 1), d = b(n + 1, r + 1);
	return m(m(c, l, o), m(u, d, o), s) * 2 - 1;
}
function C(e, t, n = 4, r = 2.02, i = .5) {
	let a = .5, o = 1, s = 0, c = 0;
	for (let l = 0; l < n; l++) s += a * S(e * o + l * 17.31, t * o - l * 9.13), c += a, a *= i, o *= r;
	return s / c;
}
function ee(e, t, n = 4) {
	let r = .55, i = 1, a = 0, o = 0;
	for (let s = 0; s < n; s++) {
		let n = 1 - Math.abs(S(e * i + s * 3.7, t * i + s * 11.2));
		a += r * n * n, o += r, r *= .5, i *= 2.03;
	}
	return a / o;
}
function w(e, t, n) {
	let r = Infinity, i = 0, a = 0;
	for (let o = 0; o < n.length - 1; o++) {
		let s = n[o][0], c = n[o][1], l = n[o + 1][0], u = n[o + 1][1], d = l - s, f = u - c, m = d * d + f * f || 1, h = p(((e - s) * d + (t - c) * f) / m, 0, 1), g = s + d * h, _ = c + f * h, v = Math.hypot(e - g, t - _);
		v < r && (r = v, i = h, a = o);
	}
	return {
		d: r,
		t: i,
		i: a
	};
}
var T = [[
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
]], te = 2.45, ne = te + .27, re = te + 1.45, ie = 7.2, ae = .14, oe = [{
	x: -50,
	z: 62,
	y: 13,
	hx: 5.2,
	hz: 4.2,
	entrySide: "east",
	entryX: -44.8,
	entryZ: 62
}], se = {
	x0: -24,
	x1: 20,
	z0: 45.5,
	z1: 74.5,
	y: 0
};
function ce(e, t = .9) {
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
function le(e, t, n) {
	let r = Infinity;
	for (let i = 0; i < n.length - 1; i++) {
		let a = n[i], o = n[i + 1], s = o[0] - a[0], c = o[1] - a[1], l = Math.max(0, Math.min(1, ((e - a[0]) * s + (t - a[1]) * c) / (s * s + c * c)));
		r = Math.min(r, Math.hypot(e - a[0] - s * l, t - a[1] - c * l));
	}
	return r;
}
function ue(e, t = .9) {
	let n = ce(T[e], t), r = [];
	n.at(-1).along;
	for (let t of [-1, 1]) {
		let i = [];
		for (let a = 0; a < n.length - 1; a++) {
			let o = n[a], s = n[a + 1], c = {
				x: o.x + o.nx * t * ne,
				z: o.z + o.nz * t * ne,
				y: o.y,
				along: o.along
			}, l = {
				x: s.x + s.nx * t * ne,
				z: s.z + s.nz * t * ne,
				y: s.y,
				along: s.along
			}, u = (c.x + l.x) / 2, d = (c.z + l.z) / 2, f = (c.along + l.along) / 2 < 2.4, p = oe.some((e) => Math.abs(u - e.x) < e.hx + .3 && Math.abs(d - e.z) < e.hz + .3), m = T.some((t, n) => n !== e && le(u, d, t) < 2.6100000000000003);
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
function de(e, t) {
	let n = Infinity, r = null, i = 0;
	for (let a = 0; a < T.length; a++) {
		let o = T[a];
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
function fe(e, t) {
	let n = de(e, t).distance;
	for (let r of oe) n = Math.min(n, Math.hypot(Math.max(0, Math.abs(e - r.x) - r.hx), Math.max(0, Math.abs(t - r.z) - r.hz)));
	return n;
}
//#endregion
//#region src/world/heightfield.ts
var E = {
	size: 620,
	center: [0, 0],
	temple: {
		x: -2,
		z: -12
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
}, D = [
	[46, -120],
	[43, -82],
	[40, -48],
	[37, -16],
	[36, 10],
	[35, 28],
	[31, 44],
	[24, 56],
	[18, 66]
], pe = (() => {
	let e = [];
	for (let t = 0; t < D.length - 1; t++) {
		let n = D[t], r = D[t + 1];
		for (let t = 0; t < 12; t++) e.push([m(n[0], r[0], t / 12), m(n[1], r[1], t / 12)]);
	}
	return e.push(D[D.length - 1]), e;
})(), me = [
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
function he(e, t) {
	let { d: n, t: r, i } = w(e, t, D);
	return {
		d: n,
		t: p((i + r) / (D.length - 1), 0, 1)
	};
}
function ge(e) {
	return m(2.8, 7.2, e ** .7);
}
function _e(e) {
	return m(6.3, .55, p(e, 0, 1) ** .82);
}
function ve(e, t) {
	return Math.hypot(e - E.pond.x, t - E.pond.z) - E.pond.r;
}
function ye(e, t) {
	let { d: n, t: r } = he(e, t), i = n - ge(r), a = ve(e, t);
	return Math.min(i, a);
}
var be = E.pond.y;
function xe(e, t, n, r, i, a, o) {
	let s = Math.max(n - e, e - i, 0), c = Math.max(r - t, t - a, 0);
	return h(0, o, Math.hypot(s, c));
}
function Se(e, t) {
	let n = 1.6;
	n += h(44, -110, t) * 5.5, n += 36 * g(e - 118, t + 44, 92), n += 30 * g(e + 118, t - 6, 104);
	let r = h(-40, -230, t), i = .55 + .45 * ee(e * .012 + 3.1, t * .012 - 1.7, 4);
	return n += r * 62 * i, n *= m(1, .55, h(55, 150, t)), n += 1.35 * C(e * .035, t * .035, 4), n += .38 * C(e * .16 + 4.2, t * .16 - 2.1, 3), n;
}
function O(e, t) {
	let n = Se(e, t), r = E.platform, i = xe(e, t, r.x0, r.z0, r.x1, r.z1, 13);
	n = m(r.y + .04 * C(e * .12, t * .12, 2), n, i), n += 6.5 * g(e - 78, t + 22, 26) * (.6 + .4 * C(e * .08, t * .08, 3));
	let a = w(e, t, me).d;
	if (a < 5 && ye(e, t) > .8) {
		let e = h(.9, 4.5, a);
		n = m(Math.max(n, r.y - .7), n, e);
	}
	let { d: o, t: s } = he(e, t), c = ge(s), l = _e(s) - .85 - .25 * C(e * .2, t * .2, 2), u = h(c * .55, c * 1.9 + 2.5, o);
	n = m(Math.min(n, l), n, u);
	let d = ve(e, t);
	if (d < 12) {
		let r = E.pond.y - 1.5 - .8 * C(e * .09 + 8, t * .09 - 3, 3);
		n = m(Math.min(n, r), n, h(-2, 11, d));
	}
	let f = se, p = xe(e, t, f.x0, f.z0, f.x1, f.z1, 7);
	n = m(r.y, n, p);
	let _ = de(e, t), v = 1 - h(re, ie, _.distance);
	v > 0 && (n = m(n, E.platform.y + _.y, v));
	for (let r of oe) {
		let i = Math.hypot(Math.max(0, Math.abs(e - r.x) - r.hx), Math.max(0, Math.abs(t - r.z) - r.hz)), a = i > 0 && _.distance < 4.9 && _.y < r.y - .8;
		i < 4 && !a && (n = m(E.platform.y + r.y, n, h(0, 4, i)));
	}
	return n;
}
function Ce(e, t, n) {
	let r = O(e, t), i = de(e, t);
	if (i.distance > 2.45 + n) return r;
	let a = Infinity;
	for (let n of [
		-1.4,
		0,
		1.4
	]) for (let r of [
		-1.4,
		0,
		1.4
	]) {
		let i = de(e + n, t + r);
		i.distance < 2.6500000000000004 && (a = Math.min(a, E.platform.y + i.y));
	}
	if (!Number.isFinite(a)) return r;
	let o = p((te + n - i.distance) / n, 0, 1);
	return Math.max(r - .42 * o, Math.min(r, a - .06));
}
function we(e, t, n = 260) {
	let r = E.size / n, i = E.size / 2, a = (e + i) / r, o = (t + i) / r, s = Math.floor(a), c = Math.floor(o), l = a - s, u = o - c, d = -i + s * r, f = -i + c * r, p = Ce(d, f, r), m = Ce(d + r, f, r), h = Ce(d, f + r, r), g = Ce(d + r, f + r, r);
	return l + u <= 1 ? p * (1 - l - u) + m * l + h * u : g * (l + u - 1) + m * (1 - u) + h * (1 - l);
}
function Te(e, t, n = 1.2) {
	let r = O(e + n, t) - O(e - n, t), i = O(e, t + n) - O(e, t - n), a = -r, o = 2 * n, s = -i, c = Math.hypot(a, o, s) || 1;
	return [
		a / c,
		o / c,
		s / c
	];
}
function Ee(e, t, n = 1.2) {
	return 1 - Te(e, t, n)[1];
}
function De(e, t, n = 0) {
	let r = E.platform;
	return e > r.x0 - n && e < r.x1 + n && t > r.z0 - n && t < r.z1 + n;
}
function Oe(e, t) {
	return Math.min(w(e, t, me).d, fe(e, t));
}
//#endregion
//#region src/world/terrain_baked.ts
function ke(e, t, n, r, i, a, o) {
	let s = p((C(e * .045, n * .045) + 1) * .5, 0, 1), c = p((C(e * .22 + 7.3, n * .22 + 7.3) + 1) * .5, 0, 1), l = [
		m(.055, .135, s * .7 + c * .3),
		m(.082, .17, s * .7 + c * .3),
		m(.032, .062, s * .7 + c * .3)
	], u = (e, t) => {
		for (let n = 0; n < 3; n++) l[n] = m(l[n], e[n], p(t, 0, 1));
	};
	u([
		.12 + c * .08,
		.09 + c * .07,
		.06 + c * .05
	], h(.42, .82, s) * .34), u([
		.26 + s * .16,
		.255 + s * .15,
		.225 + s * .12
	], h(.13, .56, r)), u([
		.078,
		.095,
		.057
	], (1 - h(0, 2.2, a)) * .72);
	let d = Math.abs(e + 3) < 30 && Math.abs(n) < 44 && Math.abs(t - E.platform.y) < .55, f = .32 + b(Math.floor(e / 1.35), Math.floor(n / .78)) * .14;
	u([
		f,
		f * .99,
		f * .91
	], Math.max(+!!d, 1 - h(.15, .55, i)) * (1 - h(.5, .9, r)));
	let g = (1 - h(.43, .73, (C(e * .011 + 3.2, n * .011 + 3.2) + 1) * .5) * .21) * m(.62, 1, o);
	for (let e = 0; e < 3; e++) l[e] *= g;
	return l;
}
var k = null, Ae = null, je = null, Me = null, Ne = null;
function Pe() {
	if (Ne) return Ne;
	let t = new e.TextureLoader(), n = async (n, r) => {
		let i = new URL(`./assets/lingyin/temple-textures/${n}.jpg`, document.baseURI).href + "?v=1", a = await t.loadAsync(i);
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
	if (!k) {
		let t = document.createElement("canvas");
		t.width = t.height = 512;
		let n = t.getContext("2d"), r = n.createImageData(512, 512), i = new Float32Array(512 * 512);
		for (let e = 0; e < 512; e++) for (let t = 0; t < 512; t++) {
			let n = C(t * .035, e * .035, 3), a = b(t, e) - .5, o = p(.91 + n * .075 + a * .065, .77, 1);
			i[e * 512 + t] = o;
			let s = (e * 512 + t) * 4;
			r.data[s] = Math.round(o * 255), r.data[s + 1] = Math.round(o * 253), r.data[s + 2] = Math.round(o * 247), r.data[s + 3] = 255;
		}
		n.putImageData(r, 0, 0), k = new e.CanvasTexture(t), k.name = "terrain-baked-grain", k.colorSpace = e.SRGBColorSpace, k.wrapS = k.wrapT = e.RepeatWrapping, k.repeat.set(1 / 3, 1 / 3), k.minFilter = e.LinearMipmapLinearFilter, k.magFilter = e.LinearFilter, k.anisotropy = 8;
		let a = document.createElement("canvas");
		a.width = a.height = 512;
		let o = a.getContext("2d"), s = o.createImageData(512, 512), c = (e, t) => i[(t + 512 & 511) * 512 + (e + 512 & 511)];
		for (let e = 0; e < 512; e++) for (let t = 0; t < 512; t++) {
			let n = (c(t + 1, e) - c(t - 1, e)) * 1.9, r = (c(t, e + 1) - c(t, e - 1)) * 1.9, i = 1 / Math.hypot(n, r, 1), a = (e * 512 + t) * 4;
			s.data[a] = Math.round((-.5 * n * i + .5) * 255), s.data[a + 1] = Math.round((-.5 * r * i + .5) * 255), s.data[a + 2] = Math.round((.5 * i + .5) * 255), s.data[a + 3] = 255;
		}
		o.putImageData(s, 0, 0), Ae = new e.CanvasTexture(a), Ae.name = "terrain-baked-normal", Ae.wrapS = Ae.wrapT = e.RepeatWrapping, Ae.repeat.copy(k.repeat), Ae.minFilter = e.LinearMipmapLinearFilter, Ae.magFilter = e.LinearFilter, Ae.anisotropy = 8;
	}
	return new e.MeshStandardMaterial({
		name: "terrain-baked-pbr",
		map: k,
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
	constructor(t = 1) {
		let n = E.size, r = Math.round(260 * p(t, .5, 1)), i = n / 2, a = r + 1, o = new Float32Array(a * a * 3), s = new Float32Array(a * a * 2), c = new Float32Array(a * a * 3), l = [], u = n / r;
		for (let e = 0; e < a; e++) {
			let t = -i + e * u;
			for (let n = 0; n < a; n++) {
				let r = -i + n * u, l = Ce(r, t, u), d = e * a + n;
				o[d * 3] = r, o[d * 3 + 1] = l, o[d * 3 + 2] = t, s[d * 2] = r, s[d * 2 + 1] = t;
				let f = 1 - Te(r, t, 1.4)[1], m = 0;
				m += O(r + 3, t), m += O(r - 3, t), m += O(r, t + 3), m += O(r, t - 3);
				let h = p((m / 4 - l) / 3.5, -.4, 1), g = ke(r, l, t, f, p(Oe(r, t) / 6, 0, 1), p(ye(r, t), -4, 18), p(.35 + f * .9 - h * .55, 0, 1));
				c[d * 3] = g[0], c[d * 3 + 1] = g[1], c[d * 3 + 2] = g[2];
			}
		}
		for (let e = 0; e < r; e++) for (let t = 0; t < r; t++) {
			let n = e * a + t, r = n + 1, i = n + a, o = i + 1;
			l.push(n, i, r, r, i, o);
		}
		let d = new e.BufferGeometry();
		d.setAttribute("position", new e.BufferAttribute(o, 3)), d.setAttribute("uv", new e.BufferAttribute(s, 2)), d.setAttribute("color", new e.BufferAttribute(c, 3)), d.setIndex(l), d.computeVertexNormals(), d.computeBoundingSphere(), this.material = Fe(), this.mesh = new e.Mesh(d, this.material), this.mesh.name = "terrain", this.mesh.receiveShadow = !0, this.mesh.castShadow = !1, this.group.add(this.mesh);
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
function A(t, n, r, i = 0, a = 0, o = 0, s = 0) {
	let c = new e.BoxGeometry(t, n, r);
	return s && c.rotateY(s), c.translate(i, a, o), Le(c);
}
function j(t, n, r, i, a = 0, o = 0, s = 0) {
	let c = new e.CylinderGeometry(t, n, r, i, 1, !1);
	return c.translate(a, o, s), Le(c);
}
function M(e) {
	let n = e.filter((e) => e && e.getAttribute("position")?.count), r = n.every((e) => e.index !== null), i = t(n.map((e) => Le(r ? e : e.index ? e.toNonIndexed() : e)), !1);
	if (!i) throw Error("merge failed");
	return i.computeBoundingSphere(), i;
}
function Re(t, n) {
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
function ze(t) {
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
function Be(t) {
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
function Ve(t, n, r, i, a) {
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
function He(e, t, n = .19, r = .055, i = 0) {
	let a = [];
	for (let o = -e / 2; o <= e / 2 + .001; o += n) a.push(A(r, t, .06, o, t / 2, i));
	for (let o = 0; o <= t + .001; o += n * 1.35) a.push(A(e, r, .055, 0, o, i));
	return {
		bars: M(a),
		backing: A(e, t, .04, 0, t / 2, i - .06)
	};
}
function Ue(t, n = 512, r = 160, i = {}) {
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
var We = null, Ge = null, Ke = null, N = null, P = {}, qe = null, Je = /* @__PURE__ */ new Map(), Ye = [
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
Ye.filter((e) => !e.startsWith("courtyard-") && e !== "plaque-gate");
function Xe(t) {
	let n = Je.get(t);
	if (n) return n;
	let r = new URL(`./assets/lingyin/temple-textures/${t}.webp`, document.baseURI).href + "?v=3", i = new e.TextureLoader().loadAsync(r).then((n) => {
		n.name = `lingyin-${t}`, n.colorSpace = t.endsWith("albedo") || t.startsWith("plaque-") ? e.SRGBColorSpace : e.NoColorSpace, n.wrapS = n.wrapT = t.startsWith("plaque-") ? e.ClampToEdgeWrapping : e.RepeatWrapping, n.minFilter = e.LinearMipmapLinearFilter, n.magFilter = e.LinearFilter, n.anisotropy = 8, P[t] = n;
	});
	return Je.set(t, i), i;
}
function Ze() {
	return qe || (qe = Promise.all(Ye.map(Xe)).then(() => {}), qe);
}
function Qe(e) {
	return P[`plaque-${e}`];
}
var $e = null;
function et() {
	if ($e) return $e;
	let t = P["courtyard-albedo"], n = P["courtyard-normal"], r = P["courtyard-roughness"];
	if (!t || !n || !r) throw Error("Lingyin courtyard maps must be preloaded");
	for (let e of [
		t,
		n,
		r
	]) e.repeat.set(48 / 5.1, 32 / 5.1);
	return $e = new e.MeshStandardMaterial({
		name: "courtyard-photogrammetry",
		map: t,
		normalMap: n,
		roughnessMap: r,
		normalScale: new e.Vector2(.34, .34),
		roughness: 1,
		metalness: 0
	}), $e;
}
function tt(e, t) {
	let n = et().clone();
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
function nt(t, n, r, i, a, o) {
	let s = P[n];
	return s ? new e.MeshStandardMaterial({
		name: t,
		map: s,
		normalMap: P[r],
		normalScale: new e.Vector2(o, o),
		roughnessMap: P[i],
		roughness: a,
		metalness: 0
	}) : null;
}
function rt() {
	if (Ke) return Ke;
	let t = document.createElement("canvas");
	t.width = t.height = 256;
	let n = t.getContext("2d"), r = n.createImageData(256, 256), i = 1919509349, a = () => ((i = Math.imul(i, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
	for (let e = 0; e < 256; e++) for (let t = 0; t < 256; t++) {
		let n = Math.sin(t * .36 + e * .015) * .012, i = Math.max(.78, Math.min(.96, .88 + (a() - .5) * .065 + n)), o = (e * 256 + t) * 4;
		r.data[o] = Math.round(i * 255), r.data[o + 1] = Math.round(i * 248), r.data[o + 2] = Math.round(i * 230), r.data[o + 3] = 255;
	}
	return n.putImageData(r, 0, 0), Ke = new e.CanvasTexture(t), Ke.colorSpace = e.SRGBColorSpace, Ke.minFilter = e.LinearMipmapLinearFilter, Ke.magFilter = e.LinearFilter, Ke.anisotropy = 8, Ke;
}
function it() {
	if (Ge) return Ge;
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
	return n.putImageData(r, 0, 0), Ge = new e.CanvasTexture(t), Ge.colorSpace = e.SRGBColorSpace, Ge.wrapS = Ge.wrapT = e.RepeatWrapping, Ge.minFilter = e.LinearMipmapLinearFilter, Ge.magFilter = e.LinearFilter, Ge.anisotropy = 8, Ge;
}
function at() {
	if (We) return We;
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
	return d.colorSpace = e.SRGBColorSpace, d.wrapS = d.wrapT = e.RepeatWrapping, d.minFilter = e.LinearMipmapLinearFilter, d.magFilter = e.LinearFilter, d.anisotropy = 8, We = new e.MeshStandardMaterial({
		name: "weathered-stone-slabs",
		map: d,
		bumpMap: d,
		bumpScale: .048,
		roughness: .94,
		metalness: 0,
		vertexColors: !0
	}), We;
}
function ot(t, n) {
	let r = t.getAttribute("position").count, i = new Float32Array(r * 3);
	for (let e = 0; e < r; e++) {
		let t = n * (.96 + e % 3 * .04);
		i[e * 3] = t, i[e * 3 + 1] = t * .992, i[e * 3 + 2] = t * .978;
	}
	return t.setAttribute("color", new e.BufferAttribute(i, 3)), t;
}
function F(e = 0) {
	let t = nt("stone-photogrammetry", "stone-albedo", "stone-normal", "stone-roughness", .98, .23);
	return t ? (t.color.set(e > .5 ? 14076600 : 16777215), t) : s({
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
function st() {
	let t = P["roof-albedo"], n = P["roof-normal"];
	if (t && n) return t.repeat.set(1 / 5, 1 / 5), n.repeat.set(1 / 5, 1 / 5), new e.MeshStandardMaterial({
		name: "roof-tile-photogrammetry",
		map: t,
		normalMap: n,
		normalScale: new e.Vector2(.28, .28),
		roughness: .86,
		metalness: .02,
		side: e.DoubleSide
	});
	if (!N) {
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
		n.putImageData(r, 0, 0), N = new e.CanvasTexture(t), N.name = "baked-weathered-roof-tiles", N.colorSpace = e.SRGBColorSpace, N.wrapS = N.wrapT = e.RepeatWrapping, N.repeat.set(1 / (12 * .34), 1 / (8 * .52)), N.minFilter = e.LinearMipmapLinearFilter, N.magFilter = e.LinearFilter, N.anisotropy = 8;
	}
	return new e.MeshStandardMaterial({
		name: "roof-tile-baked",
		map: N,
		bumpMap: N,
		bumpScale: .045,
		roughness: .82,
		metalness: .02,
		side: e.DoubleSide
	});
}
function ct() {
	let e = nt("plaster-photogrammetry", "plaster-albedo", "plaster-normal", "plaster-roughness", .98, .18);
	if (e) return e;
	let t = it();
	return s({
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
function lt(e = !1) {
	return nt(e ? "aged-wood" : "red-lacquer-wood", e ? "wood-albedo" : "wood-red-albedo", "wood-normal", "wood-roughness", .82, .16) || s({
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
function ut() {
	return s({
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
function dt() {
	return s({
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
function ft() {
	return s({
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
function pt() {
	return nt("teal-painted-wood", "wood-teal-albedo", "wood-normal", "wood-roughness", .9, .12) || s({
		name: "dougong",
		params: {
			color: 16777215,
			roughness: .6,
			metalness: .02
		},
		color: "\n      float n = cgNoise2(cgP.xz * 5.0 + cgP.y * 2.0);\n      vec3 teal = mix(vec3(0.035,0.095,0.085), vec3(0.09,0.17,0.145), n);\n      float gold = smoothstep(0.75, 0.95, cgNoise2(cgP.xz * 9.0));\n      vec3 c = mix(teal, vec3(0.55,0.40,0.16), gold * 0.55);\n      diffuseColor.rgb = c;\n    "
	});
}
function mt() {
	return new e.MeshStandardMaterial({
		color: new e.Color("#2a1a0c"),
		emissive: new e.Color("#8a4a1e"),
		emissiveIntensity: .03,
		roughness: .9
	});
}
function ht() {
	return new e.MeshStandardMaterial({
		color: new e.Color("#7e1e18"),
		emissive: new e.Color("#ff5a2a"),
		emissiveIntensity: .3,
		roughness: .7
	});
}
function gt() {
	return s({
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
var _t = E.platform.y, vt = (t, n, r) => new e.Vector3(t, n, r);
function yt(t, n, r = .16, i = .14) {
	let a = n.clone().sub(t), o = new e.BoxGeometry(r, i, a.length());
	return o.applyQuaternion(new e.Quaternion().setFromUnitVectors(vt(0, 0, 1), a.clone().normalize())), o.translate((t.x + n.x) / 2, (t.y + n.y) / 2, (t.z + n.z) / 2), o;
}
var bt = class {
	group = new e.Group();
	constructor() {
		this.group.name = "hillside-pilgrimage-trail";
		let t = F(.3), n = lt(!0), r = [], i = [], a = [], o = [], s = [], c = (e, t) => Math.max(O(e, t) + ae, we(e, t) + .055);
		for (let e of T) {
			let t = ce(e), n = r.length / 3;
			for (let [e, o] of t.entries()) {
				for (let e of [
					-1,
					0,
					1
				]) {
					let t = o.x + o.nx * te * e, n = o.z + o.nz * te * e, a = c(t, n);
					r.push(t, a, n), i.push(o.along / 2.2, (e + 1) * 1.1);
				}
				if (e < t.length - 1) {
					let t = n + e * 3;
					a.push(t, t + 1, t + 3, t + 1, t + 4, t + 3, t + 1, t + 2, t + 4, t + 2, t + 5, t + 4);
				}
			}
		}
		for (let t = 0; t < T.length; t++) for (let n of ue(t)) {
			let t = -Infinity;
			for (let [r, i] of n.points.entries()) {
				let a = vt(i.x, _t + i.y, i.z);
				if (r === 0 || r === n.points.length - 1 || i.along - t >= 2.25) {
					let n = new e.BoxGeometry(.2, 1.76, .2);
					n.translate(a.x, a.y + .7, a.z), o.push(n);
					let r = new e.BoxGeometry(.36, .28, .36);
					r.translate(a.x, a.y - .05, a.z), s.push(r), t = i.along;
				}
				if (r > 0) {
					let e = n.points[r - 1], t = vt(e.x, _t + e.y, e.z);
					s.push(yt(t.clone().add(vt(0, -.055, 0)), a.clone().add(vt(0, -.055, 0)), .31, .18));
					for (let e of [1.03, 1.45]) o.push(yt(t.clone().add(vt(0, e, 0)), a.clone().add(vt(0, e, 0))));
				}
			}
		}
		let l = new e.BufferGeometry();
		l.setAttribute("position", new e.Float32BufferAttribute(r, 3)), l.setAttribute("uv", new e.Float32BufferAttribute(i, 2)), l.setIndex(a), l.computeVertexNormals();
		let u = new e.Mesh(l, t);
		u.name = "graded-mountain-stone-path", u.receiveShadow = !0, this.group.add(u);
		for (let [r, i] of oe.entries()) {
			let a = _t + i.y, o = new e.Mesh(new e.BoxGeometry(i.hx * 2, .18, i.hz * 2), t);
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
			let f = new e.Mesh(M(s), t);
			f.castShadow = !0, f.receiveShadow = !0, f.name = `overlook-stone-parapet-${r + 1}`, this.group.add(f);
			let p = new e.Mesh(M(c), n);
			p.castShadow = !0, p.name = `overlook-open-rail-${r + 1}`, this.group.add(p);
			let m = i.z - .45, h = [], g = [], _ = 2.9, v = new e.CylinderGeometry(3.35, 3.55, .24, 8);
			v.translate(i.x, a + .12, m), h.push(v);
			let y = [];
			for (let t = 0; t < 8; t++) {
				let n = t / 8 * Math.PI * 2 + Math.PI / 8, r = i.x + Math.cos(n) * _, o = m + Math.sin(n) * _, s = new e.CylinderGeometry(.29, .34, .24, 12);
				s.translate(r, a + .34, o), h.push(s);
				let c = new e.CylinderGeometry(.17, .2, 3.05, 12);
				c.translate(r, a + 1.98, o), g.push(c), y.push(vt(r, a + 3.48, o));
			}
			for (let e = 0; e < 8; e++) g.push(yt(y[e], y[(e + 1) % 8], .24, .28));
			let b = new e.CircleGeometry(3.48, 8);
			b.rotateZ(Math.PI / 8), b.rotateX(Math.PI / 2), b.translate(i.x, a + 3.55, m), g.push(b);
			let x = vt(i.x, a + 3.49, m);
			for (let e of y) g.push(yt(x, e, .11, .12));
			let S = new e.Mesh(M(h), t);
			S.name = `ridge-pavilion-stone-${r + 1}`, S.castShadow = !0, S.receiveShadow = !0, this.group.add(S);
			let C = new e.Mesh(M(g), n);
			C.name = `ridge-pavilion-timber-${r + 1}`, C.castShadow = !0, C.receiveShadow = !0, this.group.add(C);
			let ee = st(), w = new e.Mesh(new e.ConeGeometry(3.95, 1.35, 8, 2), ee);
			w.position.set(i.x, a + 4.15, m), w.rotation.y = Math.PI / 8, w.name = `ridge-pavilion-roof-${r + 1}`, w.castShadow = !0, w.receiveShadow = !0, this.group.add(w);
			let T = new e.Mesh(new e.CylinderGeometry(.08, .13, .75, 10), n);
			T.position.set(i.x, a + 5.15, m), T.name = `ridge-pavilion-finial-${r + 1}`, T.castShadow = !0, this.group.add(T);
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
			let t = new e.Mesh(M(i), a);
			t.name = r, t.castShadow = !0, t.receiveShadow = !0, this.group.add(t);
		}
	}
}, xt = class {
	group = new e.Group();
	materials;
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
		window: []
	};
	constructor(t = {}) {
		this.group.name = t.onlyMainHall ? "temple-main-hall-only" : "temple";
		let n = E.platform.y;
		this.materials = {
			stone: F(.2),
			floor: at(),
			wall: ct(),
			paper: new e.MeshStandardMaterial({
				color: 12958628,
				map: rt(),
				bumpMap: rt(),
				bumpScale: .009,
				roughness: .96,
				metalness: 0,
				side: e.DoubleSide
			}),
			gatePlaster: new e.MeshStandardMaterial({
				color: 12946786,
				map: rt(),
				roughness: .96,
				metalness: 0,
				emissive: 5122580,
				emissiveIntensity: .16
			}),
			wood: lt(!1),
			woodDark: lt(!0),
			dougong: pt(),
			roof: st(),
			mainRoof: st(),
			gateRoof: st(),
			gold: ut(),
			bronze: ft(),
			lattice: lt(!0),
			lantern: ht(),
			window: mt(),
			dark: new e.MeshStandardMaterial({
				color: 1183500,
				roughness: 1
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
			x: -2,
			z: -12,
			w: 27,
			d: 17,
			eave: t.studyHallEave ?? 8,
			rise: 5,
			plinth: 1.1,
			double: !0,
			name: "main",
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
		}), this.buildHall({
			x: -2,
			z: -38,
			w: 17,
			d: 10,
			eave: 6.4,
			rise: 3.5,
			plinth: .9,
			name: "rear",
			plaque: "法堂"
		}), this.buildPagoda(-31, 33, n), this.buildEnclosure(n)), t.omitMainHallShrine || this.buildBuddha(n), this.finalize();
	}
	add(e, t) {
		this.roles[e].push(t);
	}
	addAt(e, t, n, r, i, a = 0) {
		a && t.rotateY(a), t.translate(n, r, i), this.roles[e].push(t);
	}
	buildPlatform(e) {
		let t = E.platform;
		this.add("stone", A(2.2, .5, 1, t.x0, e - .05, 0, 0)), this.add("stone", A(2.2, .5, 1, t.x1, e - .05, 0, 0)), this.add("stone", A(t.x1 - t.x0 + 2.2, .5, 1.2, (t.x0 + t.x1) / 2, e - .05, t.z1)), this.add("stone", A(t.x1 - t.x0 + 2.2, .5, 1.2, (t.x0 + t.x1) / 2, e - .05, t.z0));
		for (let n = 0; n < 6; n++) this.add("stone", A(9 - n * .25, .19, .5, -2, e - .2 - n * .19, t.z1 + .6 + n * .48));
		for (let n = 0; n < 5; n++) this.add("stone", A(.55, .2, 5.2, t.x1 + .4 + n * .5, e - .2 - n * .2, 28));
		this.balustrade(t.x0 + 1, -14, t.z1 - .3, e + .1, "x"), this.balustrade(10, t.x1 - 1, t.z1 - .3, e + .1, "x");
	}
	balustrade(e, t, n, r, i, a = !1) {
		let o = Math.abs(t - e);
		if (o < 1) return;
		let s = Math.max(2, Math.round(o / 2.4));
		for (let a = 0; a <= s; a++) {
			let c = a / s, l = e + (t - e) * c, u = i === "x" ? l : n, d = i === "x" ? n : l;
			if (this.add("stone", A(.24, .95, .24, u, r + .475, d)), this.add("stone", A(.34, .12, .34, u, r + .98, d)), a < s) {
				let c = (a + .5) / s, l = e + (t - e) * c, u = i === "x" ? l : n, d = i === "x" ? n : l, f = i === "x" ? o / s : .14, p = i === "x" ? .14 : o / s;
				this.add("stone", A(f, .16, p, u, r + .74, d));
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
			window: []
		}, s = (e, t) => o[e].push(t);
		s("stone", A(t.w + 2.4, t.plinth + .25, t.d + 2.4, 0, (t.plinth + .25) / 2, 0)), s("stone", A(t.w + 2.9, .16, t.d + 2.9, 0, .1, 0));
		for (let e = 0; e < 5; e++) s("stone", A(5, .16, .42, 0, .16 + e * .16, a + 1.35 + (4 - e) * .4 + (t.plinth - .8) * .25)), t.name === "gate" && s("stone", A(5, .16, .42, 0, .16 + e * .16, -a - 1.35 - (4 - e) * .4));
		let c = Math.max(3, Math.round(t.w / 3.4)), l = Math.max(2, Math.round(t.d / 3.6)), u = r - .35;
		for (let e of [-1, 1]) for (let r = 0; r <= c; r++) {
			let s = -i + 1 + (t.w - 2) * r / c;
			t.name === "main" && e === 1 && Math.abs(s) < 1.6 || t.name === "gate" && Math.abs(s) < 1 || this.column(o, s, .25, e * (a - .9), n && Math.abs(s) > 4 ? 3.7 : u);
		}
		for (let e of [-1, 1]) for (let r = 1; r < l; r++) {
			let s = -a + 1 + (t.d - 2) * r / l;
			this.column(o, e * (i - .9), .25, s, n ? 3.7 : u);
		}
		let d = n ? 3.55 : u - .4, f = .3, p = .25 + d / 2, m = 1.35, h = (e, n, r, i) => s("stone", A(e + .04, .22, n + .085, r, t.plinth + .3, i));
		if (t.openFront) {
			let e = i - 2.05;
			for (let t of [-1, 1]) s("wall", A(3.8, d, f, t * e, p, a - m)), h(3.8, f, t * e, a - m);
		} else {
			let e = t.name === "main" ? 5.4 : t.name === "rear" ? 4.6 : 3.4, n = (t.w - m * 2 - e) / 2;
			s("wall", A(n, d, f, -(e / 2 + n / 2), p, a - m)), s("wall", A(n, d, f, e / 2 + n / 2, p, a - m)), h(n, f, -(e / 2 + n / 2), a - m), h(n, f, e / 2 + n / 2, a - m), t.name === "main" && t.studyFacade || s("wood", A(e + .3, .35, f + .1, 0, .25 + d, a - m));
		}
		if (t.openFront || t.name === "west") {
			let e = t.name === "west" ? 3.4 : 4.6, n = (t.w - m * 2 - e) / 2;
			for (let t of [-1, 1]) s("wall", A(n, d, f, t * (e / 2 + n / 2), p, -a + m));
			for (let t of [-1, 1]) h(n, f, t * (e / 2 + n / 2), -a + m);
			s("wood", A(e + .3, .35, .42, 0, .25 + d, -a + m));
		} else s("wall", A(t.w - m * 2, d, f, 0, p, -a + m)), h(t.w - m * 2, f, 0, -a + m);
		for (let e of [-1, 1]) {
			s("wall", A(f, d, t.d - m * 2, e * (i - m), p, 0)), h(f, t.d - m * 2, e * (i - m), 0);
			let n = Math.min(1.7, d * .5), r = He(Math.min(3.4, t.d * .32), n, .22, .05, .02);
			r.bars.rotateY(e * Math.PI / 2), r.backing.rotateY(e * Math.PI / 2), r.bars.translate(e * (i - m + .18), p + .15, 0), r.backing.translate(e * (i - m + .1), p + .15, 0), s("lattice", r.bars), s("window", r.backing);
		}
		if (!t.openFront) {
			let n = t.w > 20 ? 5 : 3, r = (t.w - 2.2) / n, o = Math.floor(n / 2), c = Array.from({ length: n }, (e, t) => t);
			for (let n of c) {
				let c = -i + 1.1 + r * (n + .5), l = r - .35, u = Math.min(d - .55, 3.5);
				if (n === o) {
					s("gold", A(.16, u, .2, c - l / 2 - .1, .25 + u / 2, a - m + .2)), s("gold", A(.16, u, .2, c + l / 2 + .1, .25 + u / 2, a - m + .2)), t.name === "main" && t.studyFacade || s("gold", A(l + .2, .18, .2, c, .25 + u + .12, a - m + .2));
					continue;
				}
				let f = He(l, u, .17, .055, a - m + .18);
				f.bars.translate(c, 0, 0), f.backing.translate(c, 0, 0), s("lattice", f.bars), s("woodDark", f.backing), s("wood", A(l + .18, .16, .24, c, .25 + u + .1, a - m + .18)), s("wood", A(.16, u + .2, .24, c - l / 2 - .09, .25 + u / 2, a - m + .18)), s("wood", A(.16, u + .2, .24, c + l / 2 + .09, .25 + u / 2, a - m + .18)), s("woodDark", A(l, u * .34, .1, c, .25 + u * .17, a - m + .1));
				for (let t = -2; t <= 2; t++) for (let n = 0; n < 2; n++) s("gold", new e.SphereGeometry(.035, 6, 4).translate(c + t * .62, 1 + n * .32, a - m + .06));
			}
		}
		if (t.name === "main") {
			let e = .45, n = t.w / 2 + 1.2, r = t.d / 2 + 1.45;
			for (let t = 0; t <= 14; t++) {
				let i = -n + 2 * n * t / 14;
				Math.abs(i) < 3.6 || (s("stone", A(.24, .9, .24, i, e + .45, r)), s("stone", A(.26, .1, .26, i, e + .92, r)));
			}
			for (let t = 0; t <= 10; t++) {
				let i = -r + 2 * r * t / 10;
				for (let t of [-1, 1]) s("stone", A(.24, .9, .24, t * n, e + .45, i)), s("stone", A(.26, .1, .26, t * n, e + .92, i));
			}
			for (let t of [-1, 1]) s("stone", A(.16, .16, 2 * r, t * n, e + .8, 0));
			for (let t of [-1, 1]) s("stone", A(n - 3.6, .16, .16, t * (n + 3.6) / 2, e + .8, r));
		}
		let g = t.w - m * 2 - .55, _ = t.d - m * 2 - .55, v = t.plinth + .25, y = 1.35, b = Math.floor(g / y), x = Math.floor(_ / y);
		for (let e = 0; e < x; e++) for (let t = 0; t < b; t++) {
			let n = -g / 2 + (t + .5) * g / b, r = -_ / 2 + (e + .5) * _ / x, i = (t * 11 + e * 7) % 7 * .002;
			s("floor", ot(A(g / b - .018, .045, _ / x - .018, n, v + .005 + i, r), .82 + (t * 13 + e * 7) % 11 * .022));
		}
		for (let e of [-1, 1]) {
			s("woodDark", A(.11, .44, _, e * g / 2, v + .22, 0)), s("bronze", A(.025, .035, _, e * g / 2, v + .45, 0));
			for (let t of [-_ * .24, _ * .24]) {
				let n = He(Math.min(2.5, _ * .32), 2.1, .26, .055, 0);
				n.bars.rotateY(Math.PI / 2), n.backing.rotateY(Math.PI / 2), n.bars.translate(e * (i - m - .23), v + .77, t), n.backing.translate(e * (i - m - .27), v + .77, t), s("lattice", n.bars), s("paper", n.backing);
			}
		}
		for (let e of [-_ / 2, _ / 2]) if (e > 0 || t.name === "gate" || t.name === "west") {
			let n = t.name === "main" ? 5.4 : t.name === "rear" || t.name === "gate" ? 4.6 : 3.4, r = (g - n) / 2;
			for (let t of [-1, 1]) {
				let i = t * (n / 2 + r / 2);
				s("woodDark", A(r, .44, .11, i, v + .22, e)), s("bronze", A(r, .035, .025, i, v + .45, e));
			}
		} else s("woodDark", A(g, .44, .11, 0, v + .22, e)), s("bronze", A(g, .035, .025, 0, v + .45, e));
		let S = Math.max(v + 2.9, r - .35);
		for (let e = 0; !n && e < Math.max(2, Math.floor(_ / 3.4)); e++) {
			let t = -_ / 2 + (e + .5) * _ / Math.max(2, Math.floor(_ / 3.4));
			s("wood", A(g + .2, .2, .24, 0, S, t));
			for (let e of [-g / 3, g / 3]) s("dougong", A(.4, .32, .4, e, S - .25, t));
		}
		if (t.name !== "gate" && t.name !== "main" && t.name !== "west") {
			let t = -a + 2.7, n = Math.min(5.5, g * .62);
			s("woodDark", A(n, .16, 1.22, 0, v + .93, t)), s("bronze", A(n + .12, .07, 1.3, 0, v + 1.04, t)), s("woodDark", A(n - .35, .13, 1.05, 0, v + .26, t));
			for (let e of [-1, 1]) for (let r of [-1, 1]) {
				let i = e * (n / 2 - .24), a = t + r * .42;
				s("wood", A(.22, .78, .22, i, v + .45, a)), s("bronze", A(.24, .06, .24, i, v + .83, a));
			}
			s("gold", A(n - .4, .055, .055, 0, v + .73, t + .59)), s("wood", A(n + .3, 2.7, .22, 0, v + 2.35, t - .72)), s("gold", j(.5, .58, .13, 20, 0, v + 1.2, t)), s("gold", j(.34, .51, .63, 20, 0, v + 1.58, t)), s("gold", new e.SphereGeometry(.29, 18, 14).translate(0, v + 2.03, t)), s("gold", new e.TorusGeometry(.44, .045, 8, 28).translate(0, v + 1.99, t - .24));
			for (let r of [-1, 1]) s("bronze", j(.085, .11, .55, 10, r * Math.min(1.75, n * .32), v + 1.24, t + .1)), s("lantern", new e.SphereGeometry(.12, 10, 8).translate(r * Math.min(1.75, n * .32), v + 1.56, t + .1));
			for (let e of [-1, 1]) {
				let r = e * n * .34;
				s("bronze", j(.14, .22, .28, 12, r, v + 1.2, t + .3));
				for (let e = 0; e < 3; e++) s("woodDark", j(.012, .015, .55 + e * .08, 6, r + (e - 1) * .045, v + 1.56, t + .3));
			}
		}
		if (!n) {
			s("wood", A(t.w + .4, .42, .42, 0, r - .2, a - .9)), s("wood", A(t.w + .4, .42, .42, 0, r - .2, -a + .9));
			for (let e of [-1, 1]) s("wood", A(.42, .42, t.d - 1.6, e * (i - .9), r - .2, 0));
			s("wood", A(t.w + 1.4, .34, .7, 0, r + .05, a - .3)), s("wood", A(t.w + 1.4, .34, .7, 0, r + .05, -a + .3));
			let n = this.dougongCluster(), o = Math.max(3, Math.round(t.w / 2.3));
			for (let e = 0; e <= o; e++) {
				let c = -i + .9 + (t.w - 1.8) * e / o;
				for (let e of [-1, 1]) {
					let t = n.clone();
					t.translate(c, r - .05, e * (a - .75)), s("dougong", t);
				}
			}
			let c = Math.max(2, Math.round(t.d / 2.5));
			for (let e = 1; e < c; e++) {
				let o = -a + .9 + (t.d - 1.8) * e / c;
				for (let e of [-1, 1]) {
					let t = n.clone();
					t.rotateY(Math.PI / 2), t.translate(e * (i - .75), r - .05, o), s("dougong", t);
				}
			}
			let l = Math.round((t.w + 2) / .42);
			for (let e = 0; e <= l; e++) {
				let n = -i - .8 + (t.w + 1.6) * e / l;
				for (let t of [-1, 1]) {
					let i = A(.1, .12, 1.45, n, r + .02, t * (a + .45));
					i.rotateX(.12 * t), s(e % 2 ? "wood" : "dougong", i);
				}
			}
			let u = Math.round((t.d + 2) / .42);
			for (let e = 0; e <= u; e++) {
				let n = -a - .8 + (t.d + 1.6) * e / u;
				for (let t of [-1, 1]) {
					let a = A(1.45, .12, .1, t * (i + .45), r + .02, n);
					a.rotateZ(-.12 * t), s(e % 2 ? "wood" : "dougong", a);
				}
			}
			let d = Math.max(2, Math.round(t.w / 6));
			for (let n = 0; n <= d; n++) {
				let o = -i + 1.4 + (t.w - 2.8) * n / d, c = r - 1.05, l = a + .15, u = new e.SphereGeometry(.17, 10, 8);
				u.scale(1, 1.18, 1), u.translate(o, c, l), s("lantern", u), s("gold", j(.09, .09, .08, 8, o, c + .3, l)), s("gold", j(.09, .09, .08, 8, o, c - .3, l)), s("gold", j(.012, .012, .55, 4, o, c + .6, l));
			}
		}
		if (n) {
			let e = 9.1, n = r + .16;
			s("gateRoof", ze({
				w: e,
				d: t.d,
				eaveY: n,
				rise: 3.05,
				cornerLift: .88,
				overhang: 1.25,
				nu: 34,
				nv: 14
			})), this.ridgeAndTips(o, e, t.d, n + 3.05, n), s("wood", A(8.9, .14, t.d + .35, 0, r - .1, 0));
			for (let e of [
				-3.45,
				-1.72,
				0,
				1.72,
				3.45
			]) s("woodDark", A(8.9, .2, .24, 0, r - .28, e));
			for (let e of [-3.65, 3.65]) s("woodDark", A(.22, .2, t.d + .35, e, r - .28, 0));
			s("woodDark", A(8.9, 2.1, .32, 0, r - 1.07, -a + 1.35));
			for (let e of [-1, 1]) {
				let n = ze({
					w: 5.6,
					d: t.d,
					eaveY: 3.84,
					rise: 1.45,
					cornerLift: .52,
					overhang: 1.1,
					nu: 24,
					nv: 11
				});
				n.translate(e * 5.15, 0, 0), s("gateRoof", n), s("woodDark", A(6.1, .28, .42, e * 5.15, 3.62, a - .25)), s("woodDark", A(6.1, .28, .42, e * 5.15, 3.62, -a + .25));
			}
			for (let e of [-1, 1]) {
				for (let t of [-a + .82, a - .82]) s("woodDark", A(.62, r - .35, .7, e * 3.22, (r - .35) / 2 + .25, t));
				s("dougong", A(1.22, .29, 1.55, e * 3.22, r - .25, a - .25));
			}
			s("woodDark", A(8.9, .7, .7, 0, r - .63, a - .35)), s("wood", A(9.5, .3, .62, 0, r + .02, a - .3)), s("wood", A(9.5, .3, .62, 0, r + .02, -a + .3)), s("bronze", A(8.75, .05, .75, 0, r - .27, a - .35));
		} else if (t.double) {
			let e = t.studyFacade ? "mainRoof" : "roof";
			s(e, Be({
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
			s("wall", A(t.w - 2.2, 3, t.d - 2.2, 0, r + 1.5, 0));
			for (let e = 0; e <= 12; e++) s("wood", A(.1, .7, .1, -i + 1.2 + (t.w - 2.4) * e / 12, r + .55, a - 1.05));
			s("wood", A(t.w - 2.4, .12, .14, 0, r + .9, a - 1.05));
			for (let e = 0; e < 5; e++) {
				let n = -i + 1.6 + (t.w - 3.2) * (e + .5) / 5, o = He((t.w - 3.2) / 5 - .25, 1.4, .24, .07, a - .95);
				o.bars.translate(n, r + 1.55, 0), o.backing.translate(n, r + 1.55, 0), s("lattice", o.bars), s("window", o.backing);
				for (let e = 0; e <= 4; e++) s("wood", A(.08, 1.4, .12, n - (t.w - 3.2) / 10 + e * ((t.w - 3.2) / 20), r + 1.55 + .7, a - .88));
			}
			s("wood", A(t.w + .6, .35, .5, 0, n, a - .7)), s("wood", A(t.w + .6, .35, .5, 0, n, -a + .7)), s(e, ze({
				w: t.w - 1.4,
				d: t.d - 1.4,
				eaveY: n + .2,
				rise: t.rise + .4,
				cornerLift: .95,
				overhang: 1.45,
				nu: 38,
				nv: 16
			})), this.ridgeAndTips(o, t.w - 1.4, t.d - 1.4, n + .2 + t.rise + .4, n + .2, e);
		} else s("roof", ze({
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
				a.rotateX(Math.PI / 2), a.translate(i, t.y, t.z), s("gateRoof", a);
			}
		}
		else if (!t.studyFacade) {
			let n = t.double ? r + 2.1 : r + .15, i = t.w / 2 + 1.1, a = Math.round(i * 2 / .34);
			for (let r = 0; r <= a; r++) {
				let o = -i + 2 * i * r / a;
				for (let r of [-1, 1]) {
					let i = new e.CylinderGeometry(.075, .075, .05, 8);
					i.rotateX(Math.PI / 2), i.translate(o, n - .06, r * (t.d / 2 + 1.1)), s("roof", i);
				}
			}
		}
		for (let t of n ? [] : [-1, 1]) for (let n of [-1, 1]) {
			let o = 1.15;
			s("bronze", j(.14, .2, .5, 8, t * (i + o), r - .55, n * (a + o))), s("bronze", new e.SphereGeometry(.09, 8, 6).translate(t * (i + o), r - .85, n * (a + o)));
		}
		if (n) {
			for (let e of [-1, 1]) {
				let t = e * (i - 2.2), n = a - m + .23;
				s("gatePlaster", A(2.42, 2.57, .045, t, 2.02, n - .08));
				let r = He(1.64, 1.67, .21, .065, n + .05);
				r.bars.translate(t, 1.25, 0), r.backing.translate(t, 1.25, 0), s("lattice", r.bars), s("woodDark", r.backing);
				for (let e of [-1.23, 1.23]) s("woodDark", A(.13, 2.72, .16, t + e, 1.98, n + .025));
				for (let e of [.63, 3.34]) s("woodDark", A(2.58, .13, .16, t, e, n + .025));
			}
			s("woodDark", A(8.9, .5, .22, 0, r - 1.06, a + .3));
		}
		if (t.plaque) {
			let n = t.name === "gate" || t.name === "main" ? Qe(t.name) : void 0, i = n ?? Ue(t.plaque, 512, 150, {
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
			}), c = t.name === "main" && t.studyFacade, l = t.name === "gate" ? 1.18 : 1.45, u = c ? r + 2.03 : .25 + Math.min(d - .55, 3.5) + l, f = c ? a - .71 : a + (t.name === "gate" ? .62 : -.35), p = c ? 5.5 : 4.2, m = c ? 1.52 : 1.2, h = new e.Mesh(new e.PlaneGeometry(p, m), o);
			if (h.position.set(t.x, E.platform.y + u, t.z + f), h.castShadow = !1, h.name = `plaque-${t.name}`, this.group.add(h), c) {
				s("woodDark", A(p + .36, m + .3, .17, 0, u, f - .16));
				for (let e of [-1, 1]) s("gold", A(p + .34, .055, .05, 0, u + e * (m / 2 + .11), f - .055)), s("gold", A(.055, m + .22, .05, e * (p / 2 + .12), u, f - .055));
			} else s("gold", A(4.5, 1.45, .16, 0, u, a + (t.name === "gate" ? .48 : -.48)));
		}
		let C = t.rotY ?? 0, ee = Math.cos(C), w = Math.sin(C);
		for (let e of Object.keys(o)) for (let n of o[e]) C && n.rotateY(C), n.translate(t.x, E.platform.y, t.z), this.roles[e].push(n);
		let T = new e.PointLight(16758647, t.name === "main" ? 6 : n ? 4.4 : 2.8, t.name === "main" ? 18 : n ? 12 : 10, 2);
		T.position.set(t.x, E.platform.y + (n ? 4.1 : Math.max(3.2, t.plinth + 2.3)), t.z), this.group.add(T), this.anchors.eaves.push(new e.Vector3(t.x + w * (a + 1), E.platform.y + r, t.z + ee * (a + 1))), t.name === "main" && this.anchors.door.set(t.x, E.platform.y + 1.6, t.z + a + 1.5);
	}
	column(e, t, n, r, i) {
		e.stone.push(j(.4, .46, .24, 10, t, n + .06, r)), e.wood.push(j(.27, .33, i - .24, 12, t, n + .24 + (i - .24) / 2, r)), e.gold.push(j(.31, .31, .08, 12, t, n + i - .16, r)), e.bronze.push(j(.33, .33, .05, 12, t, n + .36, r));
	}
	dougongCluster() {
		let e = [];
		return e.push(A(.42, .36, .42, 0, .18, 0)), e.push(A(1.5, .2, .3, 0, .46, 0)), e.push(A(.3, .2, 1.1, 0, .46, .2)), e.push(A(.46, .22, .46, -.45, .67, 0)), e.push(A(.46, .22, .46, 0, .67, 0)), e.push(A(.46, .22, .46, .45, .67, 0)), e.push(A(.22, .2, .9, 0, .67, 0)), M(e);
	}
	ridgeAndTips(t, n, r, i, a, o = "roof") {
		let s = n * .52 / 2;
		t[o].push(A(s * 2 + .6, .42, .42, 0, i + .18, 0));
		for (let e of [-1, 1]) {
			t[o].push(A(.34, 1.15, .4, e * (s + .35), i + .55, 0));
			let n = A(.28, .9, .34, e * (s + .55), i + 1.05, .1);
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
			let i = j(.05, .2, 1.15, 6, 0, 0, 0);
			i.rotateZ(-n * .55), i.rotateX(r * .3), i.translate(n * u, a + .45, r * d), t[o].push(i), t.gold.push(new e.SphereGeometry(.11, 8, 6).translate(n * u, a + .95, r * d));
		}
	}
	buildPagoda(t, n, r) {
		this.addAt("stone", j(3.1, 3.4, .7, 8), t, r + .35, n);
		let i = r + .7, a = 2.1;
		for (let e = 0; e < 5; e++) {
			let r = 2.25 - e * .1;
			this.addAt("stone", j(a - .12, a, r, 8), t, i + r / 2, n), this.addAt("dark", A(.7, 1.25, .2, 0, 0, 0), t, i + .75, n + a - .02), this.addAt("stone", j(a + .85, a + .2, .36, 8), t, i + r + .18, n), this.addAt("stone", j(a + .1, a + .1, .16, 8), t, i + r + .42, n);
			for (let e = 0; e < 8; e++) {
				let o = e / 8 * Math.PI * 2 + Math.PI / 8, s = j(.03, .1, .55, 5, 0, 0, 0);
				s.rotateZ(.7), s.rotateY(-o), s.translate(t + Math.cos(o) * (a + .85), i + r + .45, n + Math.sin(o) * (a + .85)), this.add("stone", s);
			}
			i += r + .5, a *= .87;
		}
		this.addAt("gold", j(.12, .3, 1.6, 8), t, i + .8, n);
		for (let r = 0; r < 4; r++) this.addAt("gold", new e.SphereGeometry(.22 - r * .03, 10, 8), t, i + .4 + r * .3, n);
		this.addAt("gold", new e.SphereGeometry(.16, 8, 6), t, i + 1.7, n);
	}
	buildEnclosure(t) {
		let n = E.platform, r = 1.5, i = .38, a = (e, n, a, o) => {
			let s = Math.hypot(a - e, o - n), c = Math.atan2(a - e, o - n);
			this.add("stone", A(.55, .35, s, (e + a) / 2, t + .17, (n + o) / 2, c)), this.add("wall", A(i, r, s, (e + a) / 2, t + .35 + r / 2, (n + o) / 2, c)), this.add("roof", A(i + .55, .18, s, (e + a) / 2, t + .35 + r + .09, (n + o) / 2, c)), this.add("roof", A(i + .2, .16, s, (e + a) / 2, t + .35 + r + .24, (n + o) / 2, c));
		};
		a(n.x0 + .5, n.z0 + 1, n.x0 + .5, 3.8), a(n.x0 + .5, 10.2, n.x0 + .5, n.z1 - 1);
		for (let e of [3.8, 10.2]) this.add("stone", A(.75, 3.7, .75, n.x0 + .5, t + 1.85, e));
		this.add("roof", A(1.25, .35, 7.1, n.x0 + .5, t + 4, 7)), this.add("wood", A(.22, .4, 2, n.x0 + .05, t + 3.45, 7));
		let o = new e.Mesh(new e.PlaneGeometry(1.76, .34), new e.MeshStandardMaterial({
			map: Ue("西山道", 512, 128, {
				bg: "#302923",
				fg: "#d4b674",
				border: "#8f7755"
			}),
			roughness: .88,
			side: e.DoubleSide
		}));
		o.rotation.y = Math.PI / 2, o.position.set(n.x0 + .2, t + 3.45, 7), this.group.add(o), this.add("stone", A(4.25, .95, 3.2, -34.25, t + .475, 7)), this.add("floor", ot(A(4.3, .06, 3.25, -34.25, t + .98, 7), .92)), a(n.x0 + .5, n.z0 + 1, n.x1 - .5, n.z0 + 1), a(n.x1 - .5, n.z0 + 1, n.x1 - .5, 23), a(n.x1 - .5, 33, n.x1 - .5, n.z1 - 1), this.add("wood", A(.4, 3.2, 1, n.x1 - .5, t + 2, 23.4)), this.add("wood", A(.4, 3.2, 1, n.x1 - .5, t + 2, 32.6)), this.add("roof", A(1.9, .3, 10.4, n.x1 - .5, t + 3.75, 28));
		for (let r of [-1, 1]) {
			let i = 28 + r * 2.2;
			this.add("wood", A(.22, 2.72, 4.38, n.x1 - .5, t + 1.71, i));
			for (let e of [-1.98, 1.98]) this.add("bronze", A(.3, 2.8, .13, n.x1 - .63, t + 1.71, i + e));
			for (let e of [
				.64,
				1.55,
				2.48
			]) this.add("bronze", A(.3, .15, 4.25, n.x1 - .63, t + e, i));
			for (let r of [
				-1.4,
				-.7,
				.7,
				1.4
			]) for (let a of [
				.56,
				1.08,
				1.85,
				2.37
			]) this.add("gold", new e.SphereGeometry(.055, 8, 6).translate(n.x1 - .68, t + a, i + r));
			this.add("bronze", j(.09, .09, .055, 8, n.x1 - .72, t + 1.55, i - r * 1.62));
		}
	}
	buildBuddha(t) {
		let n = -10.85, r = t + 1.1;
		this.add("bronze", j(1.58, 1.72, .18, 36).translate(-2, r + .09, n)), this.add("bronze", j(1.43, 1.55, .38, 36).translate(-2, r + .37, n)), this.add("gold", j(1.48, 1.52, .055, 36).translate(-2, r + .19, n)), this.add("gold", j(1.34, 1.4, .07, 36).translate(-2, r + .57, n)), this.add("bronze", j(1.17, 1.3, .15, 36).translate(-2, r + .67, n));
		for (let t = 0; t < 2; t++) for (let i = 0; i < 18; i++) {
			let a = (i + t * .5) * Math.PI * 2 / 18, o = [], s = [], c = [];
			for (let e = 0; e <= 7; e++) {
				let i = e / 7, l = 1.09 + t * .07 + i * (t ? .28 : .38), u = (t ? .17 : .19) * Math.sin(Math.PI * (.12 + i * .88));
				for (let d = 0; d <= 5; d++) {
					let f = d / 5 * 2 - 1, p = a + f * u, m = .3 + t * .17 + i * (t ? .26 : .32) + (1 - f * f) * Math.sin(Math.PI * i) * .075;
					if (o.push(-2 + Math.sin(p) * l, r + m, n + Math.cos(p) * l), s.push(d / 5, i), e < 7 && d < 5) {
						let t = e * 6 + d;
						c.push(t, t + 5 + 1, t + 1, t + 1, t + 5 + 1, t + 5 + 2);
					}
				}
			}
			let l = new e.BufferGeometry();
			l.setAttribute("position", new e.Float32BufferAttribute(o, 3)), l.setAttribute("uv", new e.Float32BufferAttribute(s, 2)), l.setIndex(c), l.computeVertexNormals(), this.add("bronze", l);
		}
		let i = new e.MeshStandardMaterial({
			color: 1182470,
			emissive: new e.Color("#7a3510"),
			emissiveIntensity: .3,
			roughness: 1
		}), a = new e.Mesh(new e.BoxGeometry(8.5, 7, .2), i);
		a.position.set(-2, r + 2.8, -11.4), this.group.add(a);
	}
	finalize() {
		for (let t of Object.keys(this.roles)) {
			let n = this.roles[t];
			if (!n.length) continue;
			let r = M(n), i = {
				stone: 1.4,
				wall: 2,
				wood: .75,
				woodDark: .75,
				dougong: .7,
				lattice: .75
			}, a = i[t] ? Re(r, i[t]) : r, o = new e.Mesh(a, this.materials[t]);
			o.name = `temple-${t}`, o.castShadow = t === "stone" || t === "wall" || t === "roof" || t === "mainRoof" || t === "wood" || t === "dougong" || t === "bronze", o.receiveShadow = !0, this.group.add(o), n.length = 0;
		}
		this.group.traverse((t) => {
			t instanceof e.Mesh && t.name.startsWith("plaque") && (t.castShadow = !1);
		});
	}
};
//#endregion
//#region src/world/main_hall_study.ts
function St(t, n) {
	let r = new e.Group();
	r.name = "lingyin-main-hall-interior";
	let i = E.temple.x, a = E.temple.z, o = E.platform.y + 1.35, s = E.platform.y + 9.72, c = 23.75, l = 13.75, u = E.platform.y + 9.9;
	function d() {
		let s = t.materials.mainRoof;
		s instanceof e.MeshStandardMaterial && (s.map = n.redRoof, s.normalMap = null, s.color.set("#f3dfd4"), s.roughness = .79, s.needsUpdate = !0);
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
		});
		for (let [t, n, o, s] of [
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
			y("teal", t + .1, n + .06, .16, 0, o, s - .1), y("gilt", t + .12, .035, .17, 0, o - n / 2 - .04, s - .09), y("gilt", t + .12, .035, .17, 0, o + n / 2 + .04, s - .09);
			let c = new e.Mesh(new e.PlaneGeometry(t, n), d);
			c.name = "hall-exterior-painted-eaves", c.position.set(i, o, a + s), r.add(c);
		}
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
	}), p = new e.MeshStandardMaterial({
		name: "hall-carved-dark-wood",
		color: "#44251d",
		roughness: .68
	}), m = new e.MeshStandardMaterial({
		name: "hall-painted-dougong",
		color: "#2b4b4d",
		roughness: .72
	}), h = new e.MeshStandardMaterial({
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
	}, y = (e, t, n, r, o, s, c) => v[e].push(A(t, n, r, i + o, s, a + c)), b = (e, t, n, r, o, s, c, l = 24) => v[e].push(j(t, n, r, l, i + o, s, a + c));
	d();
	let x = t.materials.stone.clone();
	x.name = "hall-weathered-stone-floor", x.color.set("#e3dfd6"), x.roughness = .72, x.map = n.stoneFloor, x.map.wrapS = x.map.wrapT = e.RepeatWrapping, x.map.repeat.set(7, 4), x.map.needsUpdate = !0, x.normalMap && (x.normalMap = x.normalMap.clone(), x.normalMap.wrapS = x.normalMap.wrapT = e.RepeatWrapping, x.normalMap.repeat.set(8, 5), x.normalMap.needsUpdate = !0);
	let S = new e.Mesh(new e.PlaneGeometry(c - .08, l - .08), x);
	S.name = "hall-stone-floor", S.rotation.x = -Math.PI / 2, S.position.set(i, o + .04, a), S.receiveShadow = !0, r.add(S), y("darkWood", c - .08, .16, l - .08, 0, s, 0);
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
	let C = n.paintedBeam.clone();
	C.wrapS = e.RepeatWrapping, C.repeat.set(8, 1), C.needsUpdate = !0;
	let ee = new e.MeshStandardMaterial({
		name: "hall-painted-beam-art",
		map: C,
		roughness: .74,
		metalness: .03,
		side: e.DoubleSide
	}), w = [];
	for (let t of [
		-5.55,
		-2,
		1.55,
		5.35
	]) {
		let n = new e.PlaneGeometry(c - .25, .61);
		n.translate(i, s - .37, a + t + .286), w.push(n);
	}
	let T = new e.Mesh(M(w), ee);
	T.name = "hall-painted-crossbeams", r.add(T);
	let te = new e.MeshStandardMaterial({
		name: "hall-dragon-coffer-art",
		map: n.coffer,
		roughness: .76,
		side: e.DoubleSide,
		emissive: "#45301d",
		emissiveIntensity: .08
	}), ne = new e.Mesh(new e.PlaneGeometry(6.75, 6.15), te);
	ne.name = "hall-central-dragon-coffer", ne.rotation.x = Math.PI / 2, ne.position.set(i, s - .11, a + .1), r.add(ne);
	for (let e of [-1, 1]) y("gilt", .09, .045, 6.48, e * 3.43, s - .12, .1), y("gilt", 6.95, .045, .09, 0, s - .12, .1 + e * 3.15);
	for (let [e, t] of [
		[-7.7, -4.75],
		[7.7, -4.75],
		[-7.7, -2],
		[7.7, -2],
		[-5.5, .5],
		[5.5, .5]
	]) {
		b("bronze", .79, .85, .24, e, o + .12, t, 32), b("lacquer", .58, .66, s - o - .7, e, o + (s - o) / 2, t, 32), b("gilt", .63, .63, .075, e, o + .38, t, 32), b("gilt", .66, .62, .12, e, s - .53, t, 32);
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
	let ae = new e.Mesh(M(ie), re);
	ae.name = "hall-daylit-lattice-windows", r.add(ae);
	for (let e of [-1, 1]) y("darkWood", .18, 1.05, l - .25, e * (c / 2 - .12), o + .57, 0), y("gilt", .035, .035, l - .25, e * (c / 2 - .19), o + 1.12, 0);
	y("darkWood", 17.4, 7.65, .22, 0, o + 3.89, -6.67), y("teal", 18, .8, .42, 0, s - .65, -6.23);
	for (let e of [
		-6.9,
		-2.3,
		2.3,
		6.9
	]) y("lacquer", .18, 6.95, .13, e, o + 4.1, -6.48), y("gilt", .035, 6.9, .04, e + .13, o + 4.1, -6.4);
	for (let e of [o + 5.5, o + 7.15]) y("teal", 17.1, .24, .2, 0, e, -6.45), y("gilt", 17.1, .035, .22, 0, e - .13, -6.45);
	y("darkWood", 16.2, .38, 3.5, 0, o + .19, -4.72), y("darkWood", 14.4, .28, 2.8, 0, o + .48, -4.8);
	for (let e of [-8.75, 8.75]) y("lacquer", .4, 4.8, .36, e, o + 2.5, -6.35), y("gilt", .07, 4.4, .04, e + (e < 0 ? .23 : -.23), o + 2.52, -6.12);
	for (let e of [
		-4.6,
		0,
		4.6
	]) {
		let t = e === 0;
		y("bronze", t ? 3.85 : 3, .24, 2.1, e, o + .71, -4.85), y("gilt", t ? 3.7 : 2.88, .07, 2, e, o + .87, -4.85);
	}
	let oe = wt(), se = new e.MeshBasicMaterial({
		name: "hall-gilt-halos",
		map: oe,
		transparent: !0,
		depthWrite: !1,
		side: e.DoubleSide
	});
	for (let t of [
		-4.6,
		0,
		4.6
	]) {
		let s = t === 0, c = new e.Mesh(new e.PlaneGeometry(s ? 4.5 : 3.55, s ? 4.5 : 3.55), se);
		c.name = "hall-statue-halo", c.position.set(i + t, o + (s ? 4.05 : 3.56), a - 6.37), r.add(c);
		let l = Ct(s ? n.buddhaScan : n.buddhaSideLod, h, s ? 1.35 : 1.05, i + t, o + .9, a - 4.82);
		l.name = s ? "hall-central-buddha" : "hall-flanking-buddha", r.add(l);
	}
	y("darkWood", 13.5, .2, 1.25, 0, o + 1.2, -2.06), y("darkWood", 13.3, .48, .22, 0, o + .84, -1.44), y("gilt", 13.4, .035, .06, 0, o + 1.07, -1.3), y("gilt", 13.4, .035, .06, 0, o + .59, -1.3);
	let ce = n.carvedAltar.clone();
	ce.wrapS = e.RepeatWrapping, ce.repeat.set(5, 1), ce.needsUpdate = !0;
	let le = new e.Mesh(new e.PlaneGeometry(13.26, .7), new e.MeshStandardMaterial({
		name: "hall-carved-altar-front",
		map: ce,
		roughness: .68,
		metalness: .04,
		side: e.DoubleSide
	}));
	le.position.set(i, o + .84, a - 1.31), r.add(le);
	for (let e of [
		-6.3,
		-3.2,
		0,
		3.2,
		6.3
	]) y("lacquer", .34, 1, .37, e, o + .57, -2.55), y("gilt", .08, .45, .08, e, o + .87, -1.15);
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
	let de = new e.Mesh(M(ue), new e.MeshBasicMaterial({ color: "#ffd185" }));
	de.name = "hall-altar-flames", r.add(de);
	let fe = new e.Mesh(new e.PlaneGeometry(3.65, 11.6), new e.MeshStandardMaterial({
		name: "hall-woven-carpet",
		map: Tt(),
		roughness: .94,
		metalness: 0
	}));
	fe.name = "hall-processional-carpet", fe.rotation.x = -Math.PI / 2, fe.position.set(i, o + .055, a + 1.38), r.add(fe);
	let D = Et(g, h, i, o, a - .55);
	D.scale.setScalar(.66), D.position.set(i * .34, o * .34, (a - .55) * .34), r.add(D);
	let pe = new e.PointLight(16759920, 13, 16, 2);
	pe.position.set(i, o + 3.6, a - 3), r.add(pe);
	for (let t of [-1, 1]) {
		let n = new e.PointLight(16770494, 6, 8, 2);
		n.position.set(i + t * 9, o + 3.2, a + .2), r.add(n);
	}
	for (let t of Object.keys(v)) {
		if (!v[t].length) continue;
		let n = M(v[t]), i = t === "lacquer" ? Re(n, 2.4) : t === "darkWood" ? Re(n, .9) : n, a = new e.Mesh(i, _[t]);
		a.name = "hall-structure-" + t, a.receiveShadow = !0, r.add(a);
	}
	return r;
}
function Ct(t, n, r, i, a, o) {
	let s = t.clone(!0);
	s.rotation.x = Math.PI / 2, s.scale.setScalar(.027 * r), s.position.set(0, 0, 0), s.traverse((t) => {
		t instanceof e.Mesh && (t.material = n);
	}), s.updateMatrixWorld(!0);
	let c = new e.Box3().setFromObject(s);
	return s.position.set(i - (c.min.x + c.max.x) / 2, a - c.min.y, o - (c.min.z + c.max.z) / 2), s;
}
function wt() {
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
function Tt() {
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
function Et(t, n, r, i, a) {
	let o = new e.Group();
	o.name = "hall-tripod-incense-burner";
	let s = [
		new e.Vector2(.43, 0),
		new e.Vector2(.72, .14),
		new e.Vector2(.92, .48),
		new e.Vector2(1.02, .78),
		new e.Vector2(.92, .86),
		new e.Vector2(.74, .77),
		new e.Vector2(.66, .52),
		new e.Vector2(.3, .47)
	], c = new e.Mesh(new e.LatheGeometry(s, 28), t);
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
//#region src/data/shots.ts
var Dt = [
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
], Ot = 1024, kt = -2, At = -8, I = 256, jt = null, Mt = null;
function Nt() {
	if (Mt) return Mt;
	let e = (e) => new Promise((t, n) => {
		let r = new Image();
		r.onload = () => t(r), r.onerror = () => n(/* @__PURE__ */ Error(`Lingyin foliage image failed: ${e}`)), r.src = new URL(`./assets/lingyin/temple-textures/${e}`, document.baseURI).href + "?v=1";
	});
	return Mt = Promise.all([
		e("pine-foliage-albedo.jpg"),
		e("pine-foliage-alpha.png"),
		e("broad-foliage-albedo.jpg"),
		e("broad-foliage-alpha.png")
	]).then(([e, t, n, r]) => {
		jt = {
			pine: {
				diffuse: e,
				alpha: t
			},
			broad: {
				diffuse: n,
				alpha: r
			}
		};
	}), Mt;
}
function Pt(e) {
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
function Ft() {
	let t = document.createElement("canvas");
	t.width = Ot, t.height = Ot;
	let n = t.getContext("2d");
	if (!n) throw Error("no 2d");
	n.clearRect(0, 0, Ot, Ot);
	let r = new v("foliage-atlas"), i = (e, t) => {
		let { col: r, row: i } = Pt(e), a = r * I, o = i * I;
		n.save(), n.translate(a, o), n.beginPath(), n.rect(0, 0, I, I), n.clip(), t(n), n.restore();
	};
	if (i("pine", (e) => {
		let t = I / 2, n = I * .62, i = e.createRadialGradient(t, n - 20, 10, t, n - 20, 190);
		i.addColorStop(0, "rgba(22,36,24,0.55)"), i.addColorStop(.6, "rgba(22,36,24,0.22)"), i.addColorStop(1, "rgba(22,36,24,0)"), e.fillStyle = i, e.fillRect(0, 0, I, I);
		for (let i = 0; i < 10; i++) {
			let a = -Math.PI * .95 + i / 6 * Math.PI * 1.9;
			e.strokeStyle = `rgb(${34 + r.int(0, 16)},${44 + r.int(0, 20)},${30 + r.int(0, 14)})`, e.lineWidth = 2, e.beginPath(), e.moveTo(t, n);
			let o = t + Math.cos(a) * 110, s = n + Math.sin(a) * 95;
			e.lineTo(o, s), e.stroke();
			for (let i = 0; i < 44; i++) {
				let c = .15 + i / 34 * .85, l = m(t, o, c), u = m(n, s, c), d = a + (r.chance(.5) ? 1 : -1) * (.5 + r.value() * .45), f = 22 + r.value() * 34 * (1 - c * .4);
				e.strokeStyle = `rgba(${40 + r.int(0, 22)},${62 + r.int(0, 32)},${36 + r.int(0, 18)},0.85)`, e.lineWidth = 1.15, e.beginPath(), e.moveTo(l, u), e.lineTo(l + Math.cos(d) * f, u + Math.sin(d) * f), e.stroke();
			}
		}
	}), i("broad", (e) => {
		let t = I / 2, n = I * .6, i = e.createRadialGradient(t, n, 8, t, n, 180);
		i.addColorStop(0, "rgba(24,40,22,0.5)"), i.addColorStop(.65, "rgba(24,40,22,0.18)"), i.addColorStop(1, "rgba(24,40,22,0)"), e.fillStyle = i, e.fillRect(0, 0, I, I);
		for (let i = 0; i < 12; i++) {
			let i = r.range(-Math.PI, Math.PI), a = r.range(40, 105), o = t + Math.cos(i) * a, s = n + Math.sin(i) * a;
			e.strokeStyle = "#3b3122", e.lineWidth = 2.4, e.beginPath(), e.moveTo(t, n), e.lineTo(o, s), e.stroke();
			for (let a = 0; a < 7; a++) {
				let c = .25 + a / 7 * .75, l = m(t, o, c), u = m(n, s, c), d = i + (a % 2 ? 1 : -1) * 1.2, f = r.range(12, 22);
				e.save(), e.translate(l, u), e.rotate(d), e.fillStyle = `rgba(${44 + r.int(0, 26)},${78 + r.int(0, 40)},${40 + r.int(0, 22)},0.94)`, e.beginPath(), e.ellipse(f * .6, 0, f, f * .42, 0, 0, Math.PI * 2), e.fill(), e.restore();
			}
		}
	}), i("maple", (e) => {
		let t = [
			"#a3402a",
			"#b6552c",
			"#8f3520",
			"#c06a33",
			"#7d2f22"
		];
		for (let n = 0; n < 72; n++) {
			let n = r.range(30, I - 30), i = r.range(30, I - 30), a = r.range(16, 30);
			e.save(), e.translate(n, i), e.rotate(r.range(0, Math.PI * 2)), e.fillStyle = t[r.int(0, t.length - 1)], e.beginPath();
			for (let t = 0; t < 5; t++) {
				let n = -Math.PI / 2 + (t - 2) * .62, r = Math.cos(n) * a, i = Math.sin(n) * a;
				e.lineTo(r, i), e.lineTo(Math.cos(n + .28) * a * .45, Math.sin(n + .28) * a * .45);
			}
			e.closePath(), e.fill(), e.restore();
		}
	}), i("bamboo", (e) => {
		for (let t = 0; t < 5; t++) {
			let t = r.range(30, I - 30), n = r.range(40, I - 40);
			for (let i = 0; i < 12; i++) {
				let i = r.range(-Math.PI, Math.PI), a = r.range(30, 68);
				e.save(), e.translate(t + r.range(-10, 10), n + r.range(-10, 10)), e.rotate(i), e.fillStyle = `rgba(${70 + r.int(0, 25)},${100 + r.int(0, 30)},${48 + r.int(0, 20)},0.9)`, e.beginPath(), e.ellipse(a * .5, 0, a * .5, 3.2, 0, 0, Math.PI * 2), e.fill(), e.restore();
			}
		}
	}), i("grass", (e) => {
		for (let t = 0; t < 46; t++) {
			let t = I / 2 + r.range(-70, 70), n = -Math.PI / 2 + r.range(-.55, .55), i = r.range(80, 210);
			e.strokeStyle = `rgba(${72 + r.int(0, 35)},${94 + r.int(0, 35)},${44 + r.int(0, 22)},0.95)`, e.lineWidth = r.range(1.5, 3.4), e.beginPath(), e.moveTo(t, I - 4), e.quadraticCurveTo(t + Math.cos(n) * i * .45, I - i * .55, t + Math.cos(n) * i, I - 4 - Math.sin(-n) * i), e.stroke();
		}
	}), i("fern", (e) => {
		for (let t = 0; t < 5; t++) {
			let t = -Math.PI / 2 + r.range(-.8, .8), n = r.range(120, 210), i = I / 2, a = I - 10;
			e.strokeStyle = "#3f5a34", e.lineWidth = 2.2, e.beginPath(), e.moveTo(i, a), e.quadraticCurveTo(i + Math.cos(t) * n * .6, a - n * .6, i + Math.cos(t) * n, a - n * .85), e.stroke();
			for (let o = 4; o < 20; o++) {
				let s = o / 20, c = i + Math.cos(t) * n * s, l = a - n * .85 * s - Math.sin(Math.abs(t)) * 6;
				for (let t of [-1, 1]) e.strokeStyle = `rgba(${54 + r.int(0, 20)},${80 + r.int(0, 22)},${40 + r.int(0, 18)},0.95)`, e.lineWidth = 1.2, e.beginPath(), e.moveTo(c, l), e.lineTo(c + t * 18 * (1 - s), l + 8), e.stroke();
			}
		}
	}), jt) {
		let e = (e, t, r, i, a, o, s = !1) => {
			let c = document.createElement("canvas"), l = document.createElement("canvas");
			c.width = c.height = I, l.width = l.height = I;
			let u = c.getContext("2d"), d = l.getContext("2d");
			u.drawImage(t.diffuse, r, i, a, o, 0, 0, I, I), d.drawImage(t.alpha, r, i, a, o, 0, 0, I, I);
			let f = u.getImageData(0, 0, I, I), p = d.getImageData(0, 0, I, I);
			for (let e = 0; e < f.data.length; e += 4) f.data[e + 3] = p.data[e], s && (f.data[e] = Math.min(255, f.data[e] * 1.5 + 52), f.data[e + 1] = Math.min(255, f.data[e + 1] * .68 + 12), f.data[e + 2] = Math.min(255, f.data[e + 2] * .52));
			u.putImageData(f, 0, 0);
			let { col: m, row: h } = Pt(e);
			n.clearRect(m * I, h * I, I, I), n.drawImage(c, m * I, h * I);
		};
		e("pine", jt.pine, 700, 340, 280, 185), e("broad", jt.broad, 20, 35, 440, 545), e("maple", jt.broad, 20, 35, 440, 545, !0);
	}
	let a = new e.CanvasTexture(t);
	return a.colorSpace = e.SRGBColorSpace, a.anisotropy = 8, a.needsUpdate = !0, a;
}
function It(t, n, r) {
	let { col: i, row: a } = Pt(t), o = i / 4, s = 1 - (a + 1) / 4, c = new e.PlaneGeometry(n, r), l = c.getAttribute("uv");
	for (let e = 0; e < l.count; e++) l.setXY(e, o + l.getX(e) * .25, s + l.getY(e) * .25);
	return c;
}
function Lt(e, t, n, r, i, a = 0, o = !0, s = 0, c = 0) {
	let l = It(e, t, n);
	return o && l.translate(0, n / 2, 0), l.rotateX(a), l.rotateY(i), l.translate(s, r, c), l;
}
var Rt = class {
	trunk;
	cards;
	blobs;
	constructor(e, t, n) {
		this.trunk = e, this.cards = t, this.blobs = n;
	}
};
function zt(n) {
	let r = n.range(10, 16), i = [], a = 0, o = 0;
	for (let t = 0; t < 5; t++) {
		let s = t / 5 * r, c = (t + 1) / 5 * r, l = m(.42, .1, t / 5), u = m(.42, .1, (t + 1) / 5), d = new e.CylinderGeometry(u, l, c - s, 8);
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
		c.push(Lt("pine", n.range(3.2, 4.6), n.range(2, 2.8), e.y - .9 + n.range(-.4, .4), t / 8 * Math.PI + n.range(-.3, .3), .1, !0, r, i));
	}
	for (let e = 0; e < 6; e++) {
		let t = e / 6 * Math.PI * 2;
		c.push(Lt("pine", 3.6, 2.3, r * .82, t, .02, !0, Math.cos(t) * .7, Math.sin(t) * .7));
	}
	return new Rt(t(i, !1), t(c, !1), l.length ? t(l, !1) : new e.BufferGeometry());
}
function Bt(n, r) {
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
		c.push(Lt(r, 4.8, 3.3, s - 1.7, t, e % 2 ? .12 : -.12, !0, Math.cos(t * 2) * .24, Math.sin(t * 2) * .24));
	}
	for (let e = 0; e < 72; e++) {
		let e = n.range(0, Math.PI * 2), t = n.range(.3, 2.9), i = s + n.range(-1.5, 1.9), a = n.range(2, 3.4);
		c.push(Lt(r, a, a * n.range(.65, .95), i, e, n.range(-.5, .5), !0, Math.cos(e) * t, Math.sin(e) * t));
	}
	for (let e of o) c.push(Lt(r, 2, 1.4, e.y, n.range(0, Math.PI), n.range(-.3, .3), !0, e.x, e.z));
	return new Rt(t(a, !1), t(c, !1), new e.BufferGeometry());
}
function Vt(n) {
	let r = n.range(6.5, 10), i = [];
	for (let t = 0; t < 4; t++) {
		let a = t / 4 * Math.PI * 2, o = n.range(.04, .12), s = new e.CylinderGeometry(.035, .05, r, 6);
		s.rotateZ(o), s.rotateY(a), s.translate(Math.cos(a) * .35, r / 2, Math.sin(a) * .35), i.push(s);
		for (let t = 1; t < 8; t++) {
			let n = t / 8 * r, o = new e.CylinderGeometry(.055, .055, .035, 6);
			o.translate(Math.cos(a) * .35 - Math.sin(a) * 0, n, Math.sin(a) * .35), i.push(o);
		}
	}
	let a = t(i, !1), o = [];
	for (let e = 0; e < 22; e++) {
		let e = n.range(0, Math.PI * 2), t = r * n.range(.55, 1), i = n.range(.2, 1.4);
		o.push(Lt("bamboo", n.range(1, 1.7), n.range(.5, .9), t, e, n.range(-.4, .4), !0, Math.cos(e) * i, Math.sin(e) * i));
	}
	return new Rt(a, t(o, !1), new e.BufferGeometry());
}
var Ht = class {
	group = new e.Group();
	tiles = [];
	atlas;
	bark;
	leafMat;
	grassGeo;
	fernGeo;
	time = n.time;
	constructor() {
		this.group.name = "vegetation", this.atlas = Ft(), this.bark = s({
			name: "bark",
			params: {
				color: 16777215,
				roughness: .95
			},
			color: "\n        float n = cgFbm2(vec2(cgP.x * 6.0 + cgP.z * 2.0, cgP.y * 0.9));\n        vec3 c = mix(vec3(0.10,0.075,0.055), vec3(0.24,0.19,0.14), n);\n        c *= 0.8 + 0.3 * smoothstep(0.2, 0.9, cgNoise2(vec2(cgP.y * 3.0, cgP.x * 2.0)));\n        diffuseColor.rgb = c;\n      "
		}), this.leafMat = s({
			name: "leaf-card",
			params: {
				color: 16777215,
				map: this.atlas,
				alphaTest: .42,
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
		for (let e = 0; e < 3; e++) r.push(Lt("grass", 1.1, .85, 0, e / 3 * Math.PI, 0, !0));
		this.grassGeo = t(r, !1);
		let i = [];
		for (let e = 0; e < 4; e++) i.push(Lt("fern", 1.3, .9, 0, e / 4 * Math.PI * 2, .1, !0));
		this.fernGeo = t(i, !1), this.populate();
	}
	canPlace(e, t, n) {
		if (De(e, t, n)) return !1;
		for (let r of Dt) {
			let i = r.pos[0], a = r.pos[2], o = r.target[0], s = r.target[2], c = o - i, l = s - a, u = c * c + l * l || 1, d = ((e - i) * c + (t - a) * l) / u;
			if (d > -.05 && d < .5) {
				let r = i + c * d, o = a + l * d;
				if (Math.hypot(e - r, t - o) < 9 + n) return !1;
			}
		}
		return !(Oe(e, t) < n + 1.6 || fe(e, t) < 2.72 + n + .35 || ye(e, t) < n || Ee(e, t) > .8);
	}
	populate() {
		let t = new v("vegetation"), n = [
			zt(new v("pine-a")),
			zt(new v("pine-b")),
			zt(new v("pine-c"))
		], r = [Bt(new v("broad-a"), "broad"), Bt(new v("broad-b"), "broad")], i = [Bt(new v("maple-a"), "maple"), Bt(new v("maple-b"), "maple")], a = Vt(new v("bamboo")), o = [], s = [], c = [], l = [], u = new e.Quaternion(), d = new e.Euler(), f = new e.Vector3(), p = (t, n, r, i, a) => (d.set(0, a, 0), u.setFromEuler(d), f.set(i, i, i), new e.Matrix4().compose(new e.Vector3(t, n, r), u, f)), m = 0;
		for (; o.length < 190 && m < 12e3;) {
			m++;
			let r = t.range(-250, 250), i = t.range(-250, 220);
			this.canPlace(r, i, 3.5) && (this.cragDistance(r, i) < 22 || Ee(r, i) < .08 && t.chance(.7) || o.push({
				v: t.int(0, n.length - 1),
				m: p(r, O(r, i) - .25, i, t.range(.75, 1.25), t.range(0, 6.28)),
				c: new e.Color().setHSL(.29 + t.range(-.02, .02), .1, .76 + t.range(-.08, .06))
			}));
		}
		for (let [n, r, i] of [
			[
				78,
				-20,
				.9
			],
			[
				93,
				-34,
				.8
			],
			[
				69,
				-34,
				.7
			]
		]) o.push({
			v: 0,
			m: p(n, O(n, r) + 17 * i, r, i, t.range(0, 6.28)),
			c: new e.Color("#3d5135")
		});
		for (m = 0; s.length < 120 && m < 7e3;) {
			m++;
			let n = t.range(-210, 210), i = t.range(-190, 200);
			this.canPlace(n, i, 3) && (this.cragDistance(n, i) < 20 || Math.abs(n + 2) > 90 && t.chance(.5) || s.push({
				v: t.int(0, r.length - 1),
				m: p(n, O(n, i) - .2, i, t.range(.8, 1.3), t.range(0, 6.28)),
				c: new e.Color().setHSL(.27 + t.range(-.03, .03), .1, .74 + t.range(-.08, .06))
			}));
		}
		for (m = 0; c.length < 30 && m < 3e3;) {
			m++;
			let n = t.range(-90, 80), r = t.range(-70, 90);
			this.canPlace(n, r, 3) && (De(n, r, 5) || c.push({
				v: t.int(0, i.length - 1),
				m: p(n, O(n, r) - .2, r, t.range(.75, 1.15), t.range(0, 6.28)),
				c: new e.Color().setHSL(.05 + t.range(-.02, .02), .12, .82 + t.range(-.06, .05))
			}));
		}
		for (let n = 0; n < 170; n++) {
			let n = t.range(-62, -38), r = t.range(-10, 52);
			this.canPlace(n, r, 1.2) && l.push({
				m: p(n, O(n, r) - .1, r, t.range(.8, 1.2), t.range(0, 6.28)),
				c: new e.Color().setHSL(.24 + t.range(-.02, .02), .1, .8)
			});
		}
		this.buildSpecies(n, o), this.buildSpecies(r, s), this.buildSpecies(i, c), this.buildSpecies([a], l.map((e) => ({
			v: 0,
			...e
		})));
		let h = [], g = [];
		for (m = 0; h.length < 7e3 && m < 26e3;) {
			m++;
			let e = t.range(-120, 100), n = t.range(-90, 110);
			this.canPlace(e, n, .5) && (De(e, n, 1.5) || h.push(p(e, O(e, n) - .02, n, t.range(.7, 1.4), t.range(0, 6.28))));
		}
		for (m = 0; g.length < 800 && m < 7e3;) {
			m++;
			let e = t.range(-95, 90), n = t.range(-70, 95);
			this.canPlace(e, n, 1.2) && g.push(p(e, O(e, n) - .02, n, t.range(.7, 1.2), t.range(0, 6.28)));
		}
		this.addInstanced(this.grassGeo, this.leafMat, h, !1, "grass"), this.addInstanced(this.fernGeo, this.leafMat, g, !1, "fern"), this.farForest(t), this.shrubsAndRocks(t);
	}
	shrubsAndRocks(n) {
		let r = [];
		for (let e = 0; e < 5; e++) {
			let t = e * Math.PI / 5;
			r.push(Lt("broad", n.range(1.55, 2.15), n.range(1.1, 1.6), 0, t, n.range(-.16, .16), !0, Math.cos(t * 2) * .28, Math.sin(t * 2) * .28));
		}
		let i = t(r, !1), a = [], o = 0;
		for (; a.length < 260 && o < 4e3;) {
			o++;
			let t = n.range(-140, 130), r = n.range(-100, 120);
			if (!this.canPlace(t, r, 1.7)) continue;
			let i = n.range(.7, 1.7);
			a.push(new e.Matrix4().compose(new e.Vector3(t, O(t, r) - .15, r), new e.Quaternion().setFromEuler(new e.Euler(0, n.range(0, 6.28), 0)), new e.Vector3(i, i * n.range(.8, 1.2), i)));
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
		let c = t(s, !1), l = [];
		for (o = 0; l.length < 85 && o < 3e3;) {
			o++;
			let t = n.range(-150, 140), r = n.range(-110, 130);
			if (De(t, r, 2)) continue;
			let i = n.range(.5, 2.2);
			Oe(t, r) < 3 || fe(t, r) < 2.72 + 1.8 * i + .35 || l.push(new e.Matrix4().compose(new e.Vector3(t, O(t, r) - .35 * i, r), new e.Quaternion().setFromEuler(new e.Euler(n.range(-.2, .2), n.range(0, 6.28), n.range(-.2, .2))), new e.Vector3(i, i * n.range(.6, 1.1), i)));
		}
		this.addInstanced(c, gt(), l, !0, "boulder");
	}
	farForest(n) {
		let r = [];
		r.push(new e.CylinderGeometry(.18, .3, 3, 5).translate(0, 1.5, 0));
		for (let [t, n, i] of [
			[
				3.2,
				2.4,
				3.6
			],
			[
				5.2,
				1.8,
				3
			],
			[
				7,
				1.2,
				2.4
			]
		]) r.push(new e.ConeGeometry(n, i, 7).translate(0, t, 0));
		let i = t(r, !1), a = new e.MeshStandardMaterial({
			color: 1846299,
			roughness: 1,
			flatShading: !0
		}), o = [], s = 0;
		for (; o.length < 520 && s < 12e3;) {
			s++;
			let t = n.range(-300, 300), r = n.range(-300, 260);
			if (Math.hypot(t - kt, r - At) < 185 || De(t, r, 6) || ye(t, r) < 3 || Ee(t, r) > .85) continue;
			let i = n.range(.9, 1.9), a = new e.Matrix4().compose(new e.Vector3(t, O(t, r) - .3, r), new e.Quaternion().setFromEuler(new e.Euler(0, n.range(0, 6.28), 0)), new e.Vector3(i, i, i));
			o.push(a);
		}
		this.addInstanced(i, a, o, !1, "far-forest");
	}
	cragDistance(e, t) {
		return Math.hypot(e - 80, t + 20);
	}
	buildSpecies(e, t) {
		for (let n = 0; n < e.length; n++) {
			let r = t.filter((e) => e.v === n);
			if (!r.length) continue;
			let i = r.map((e) => e.m), a = r.map((e) => e.c);
			this.addInstanced(e[n].trunk, this.bark, i, !0, "trunk"), this.addInstanced(e[n].cards, this.leafMat, i, !0, "cards", a);
		}
	}
	addInstanced(t, n, r, i, a, o) {
		if (!t.getAttribute("position") || t.getAttribute("position").count === 0 || !r.length) return;
		let s = a === "far-forest" ? 200 : a === "grass" || a === "fern" ? 96 : 128, c = a === "grass" ? 75 : a === "fern" ? 100 : a === "shrub" ? 125 : a === "far-forest" ? 380 : 185, l = /* @__PURE__ */ new Map();
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
}, Ut = class {
	group = new e.Group();
	smokeOrigin = new e.Vector3(-2, 7.4, 22);
	lanterns = [];
	constructor() {
		this.group.name = "details", this.bridge(), this.lanternsAlongPath(), this.censer(), this.lions(), this.stele(), this.pavilion(), this.streamRailing(), this.prayerRibbons(), this.paving(), this.puddles();
	}
	paving() {
		let t = new e.Mesh(new e.PlaneGeometry(48, 32), et());
		t.rotation.x = -Math.PI / 2, t.position.set(-2, E.platform.y + .025, 18), t.receiveShadow = !0, t.name = "courtyard-photographic-paving", this.group.add(t);
	}
	puddles() {
		let t = new e.MeshStandardMaterial({
			color: new e.Color("#333d33"),
			roughness: .32,
			metalness: 0,
			transparent: !0,
			opacity: .17,
			depthWrite: !1
		}), n = new v("puddles");
		for (let r = 0; r < 6; r++) {
			let i = n.range(-18, 16), a = n.range(8, 30), o = n.range(.9, 2.25), s = new e.Shape();
			for (let e = 0; e <= 28; e++) {
				let t = e / 28 * Math.PI * 2, n = .82 + .13 * Math.sin(t * 3 + r * 2.4) + .08 * Math.sin(t * 7 - r * .8), i = Math.cos(t) * o * n, a = Math.sin(t) * o * n;
				e === 0 ? s.moveTo(i, a) : s.lineTo(i, a);
			}
			let c = new e.ShapeGeometry(s);
			c.rotateX(-Math.PI / 2), c.scale(1, 1, n.range(.45, .8)), c.translate(i, E.platform.y + .035, a);
			let l = new e.Mesh(c, t);
			l.receiveShadow = !0, this.group.add(l);
		}
	}
	bridge() {
		let t = F(.35), n = [], r = Ve(13.4, 3.3, .45, 3.15, 1.05);
		for (let e of [26.1, 29.9]) n.push(r.clone().translate(36, .45, e));
		n.push(A(13.6, .34, 4.6, 36, 3.66, 28)), n.push(A(13.9, .18, 4.9, 36, 3.86, 28));
		for (let e of [-1, 1]) {
			for (let t = 0; t <= 12; t++) {
				let r = 29.5 + t * 1.1;
				n.push(A(.2, 1, .2, r, 4.45, 28 + e * 2.05)), t < 12 && n.push(A(1.1, .15, .16, r + .55, 4.88, 28 + e * 2.05));
			}
			n.push(A(13.4, .18, .26, 36, 4.95, 28 + e * 2.05));
		}
		for (let e of [-1, 1]) for (let t = 0; t < 3; t++) n.push(A(1.2, .18, 4.2, 36 + e * (7 + t * .5), 3.4 - t * .18, 28));
		let i = new e.Mesh(Re(M(n), 1.4), t);
		i.castShadow = !0, i.receiveShadow = !0, this.group.add(i);
	}
	lanternsAlongPath() {
		let t = F(.5), n = [];
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
			let i = O(t, r);
			n.push(A(.75, .22, .75, t, i + .11, r)), n.push(j(.16, .2, 1.15, 8, t, i + .78, r)), n.push(A(.55, .55, .55, t, i + 1.62, r)), n.push(new e.ConeGeometry(.62, .42, 6).translate(t, i + 2.1, r)), n.push(new e.SphereGeometry(.09, 6, 4).translate(t, i + 2.38, r)), this.lanterns.push(new e.Vector3(t, i + 1.62, r));
		}
		let r = new e.Mesh(Re(M(n), 1.4), t);
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
		a.position.set(-2, E.platform.y + 4.3, 22), this.group.add(a);
	}
	censer() {
		let t = ft(), n = [], r = E.platform.y;
		for (let t = 0; t < 3; t++) {
			let r = t / 3 * Math.PI * 2, i = new e.Vector3(Math.cos(r) * 1.9, .19, Math.sin(r) * 1.9), a = new e.Vector3(Math.cos(r) * 1.55, 1.96, Math.sin(r) * 1.55);
			n.push(j(.23, .29, .18, 10, i.x, .105, i.z));
			let o = a.clone().sub(i), s = new e.CylinderGeometry(.13, .18, o.length(), 10);
			s.applyQuaternion(new e.Quaternion().setFromUnitVectors(new e.Vector3(0, 1, 0), o.normalize())), s.translate((i.x + a.x) / 2, (i.y + a.y) / 2, (i.z + a.z) / 2), n.push(s);
		}
		n.push(j(1.55, 1.4, .16, 20, 0, 1.91, 0));
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
		n.push(j(1.1, 1.25, .22, 20, 0, 3.17, 0)), n.push(new e.SphereGeometry(.22, 10, 8).translate(0, 3.5, 0)), n.push(new e.ConeGeometry(.2, .55, 8).translate(0, 3.8, 0));
		let o = new e.Mesh(M(n), t);
		o.position.set(-2, r, 22), o.castShadow = !0, o.receiveShadow = !0, this.group.add(o), this.smokeOrigin.set(-2, r + 4.15, 22);
	}
	lions() {
		let t = F(.55), n = [];
		for (let t of [-10.5, 6.5]) {
			let r = 41.5, i = O(t, r);
			n.push(A(1.4, .5, 1.8, t, i + .25, r)), n.push(new e.SphereGeometry(.55, 12, 10).scale(1, 1.15, 1.25).translate(t, i + 1.1, r)), n.push(new e.SphereGeometry(.42, 12, 10).translate(t, i + 1.75, r + .45));
			for (let a of [-1, 1]) n.push(new e.SphereGeometry(.28, 8, 6).translate(t + a * .38, i + 2, r + .4)), n.push(new e.CylinderGeometry(.12, .15, .8, 6).translate(t + a * .35, i + .65, r + .5));
			n.push(new e.CylinderGeometry(.1, .16, .9, 6).translate(t, i + .9, r + 1.05));
		}
		let r = new e.Mesh(Re(M(n), 1.4), t);
		r.castShadow = !0, r.receiveShadow = !0, this.group.add(r);
	}
	stele() {
		let t = F(.7), n = Ue("冷泉", 256, 512, {
			bg: "#5b5b52",
			fg: "#2c2a24"
		}), r = new e.MeshStandardMaterial({
			map: n,
			roughness: .9
		}), i = new e.Group(), a = new e.Mesh(new e.BoxGeometry(1.8, .4, 1.1), t);
		a.position.y = .2;
		let o = new e.Mesh(new e.BoxGeometry(1.3, 2.4, .22), r);
		o.position.set(0, 1.55, 0);
		let s = new e.Mesh(new e.BoxGeometry(1.5, .16, .4), t);
		s.position.y = 2.82, i.add(a, o, s), i.position.set(7.5, O(7.5, 33), 33), i.rotation.y = -.35, i.traverse((t) => {
			t instanceof e.Mesh && (t.castShadow = !0, t.receiveShadow = !0);
		}), this.group.add(i);
	}
	pavilion() {
		let t = lt(!1), n = st(), r = F(.4), i = new e.Group(), a = Math.max(O(29, 51), be) + .15, o = new e.Mesh(new e.CylinderGeometry(3.8, 4.1, .5, 6), r);
		o.position.y = .25, o.castShadow = !0, o.receiveShadow = !0, i.add(o);
		for (let n = 0; n < 6; n++) {
			let r = n / 6 * Math.PI * 2 + Math.PI / 6, a = new e.Mesh(new e.CylinderGeometry(.13, .16, 3.1, 8), t);
			a.position.set(Math.cos(r) * 3.1, 2.05, Math.sin(r) * 3.1), a.castShadow = !0, i.add(a);
			let o = new e.Mesh(new e.CylinderGeometry(.18, .18, .08, 8), ut());
			o.position.set(Math.cos(r) * 3.1, 3.5, Math.sin(r) * 3.1), i.add(o);
		}
		let s = new e.Mesh(new e.CylinderGeometry(.25, 4.6, 1.7, 6), n);
		s.position.y = 4.4, s.castShadow = !0, i.add(s);
		let c = new e.Mesh(new e.ConeGeometry(.18, .8, 8), ut());
		c.position.y = 5.55, i.add(c);
		for (let t = 0; t < 6; t++) {
			let r = t / 6 * Math.PI * 2 + Math.PI / 6, a = new e.Mesh(new e.CylinderGeometry(.02, .09, .7, 5), n);
			a.position.set(Math.cos(r) * 4.5, 4.95, Math.sin(r) * 4.5), a.rotation.z = .9, a.rotation.y = -r, i.add(a);
		}
		i.position.set(29, a, 51), this.group.add(i);
	}
	streamRailing() {
		let t = F(.4), n = [];
		for (let e = 0; e < 14; e++) {
			let t = 34 + e * 1.6, r = 31.6 - e * .06, i = O(r, t);
			n.push(A(.18, 1, .18, r, i + .5, t)), e < 13 && n.push(A(.14, .14, 1.6, r - .03, i + .9, t + .8));
		}
		let r = new e.Mesh(Re(M(n), 1.4), t);
		r.castShadow = !0, r.receiveShadow = !0, this.group.add(r);
	}
	prayerRibbons() {
		let t = lt(!0), n = new e.Group();
		for (let [r, i] of [[-12, 37], [8, 37]]) {
			let a = O(r, i), o = new e.Mesh(new e.CylinderGeometry(.08, .1, 4.2, 6), t);
			o.position.set(r, a + 2.1, i), n.add(o);
		}
		let r = O(0, 37) + 3.9, i = new e.MeshStandardMaterial({
			color: new e.Color("#8e2f24"),
			roughness: .8,
			side: e.DoubleSide
		});
		for (let t = 0; t < 22; t++) {
			let a = -12 + 20 * ((t + .5) / 22), o = .16 + Math.random() * .05, s = .55 + Math.random() * .35, c = new e.Mesh(new e.PlaneGeometry(o, s), i);
			c.position.set(a, r - .5 - s / 2, 37 + (Math.random() - .5) * .05), c.rotation.y = (Math.random() - .5) * .3, n.add(c);
		}
		let a = new e.Mesh(new e.CylinderGeometry(.015, .015, 20, 4).rotateZ(Math.PI / 2), t);
		a.position.set(-4 / 2, r, 37), n.add(a), n.traverse((t) => {
			t instanceof e.Mesh && t.geometry.type === "PlaneGeometry" && (t.castShadow = !0);
		}), this.group.add(n);
	}
};
//#endregion
//#region src/gate-kit/world/geom.ts
function Wt(t) {
	if (!t.getAttribute("uv")) {
		let n = t.getAttribute("position").count;
		t.setAttribute("uv", new e.BufferAttribute(new Float32Array(n * 2), 2));
	}
	return t;
}
function L(t, n, r, i = 0, a = 0, o = 0, s = 0, c = 0, l = 0) {
	let u = new e.BoxGeometry(t, n, r);
	return c && u.rotateX(c), s && u.rotateY(s), l && u.rotateZ(l), u.translate(i, a, o), Wt(u);
}
function Gt(t, n, r, i, a = 0, o = 0, s = 0) {
	let c = new e.CylinderGeometry(t, n, r, i, 1, !1);
	return c.translate(a, o, s), Wt(c);
}
function R(e) {
	let n = e.filter((e) => e && e.getAttribute("position")?.count), r = n.every((e) => e.index !== null), i = t(n.map((e) => Wt(r ? e : e.index ? e.toNonIndexed() : e)), !1);
	if (!i) throw Error("merge failed");
	return i.computeBoundingSphere(), i;
}
function Kt(t, n) {
	let r = t.getAttribute("position").count, i = new Float32Array(r * 3);
	for (let e = 0; e < r; e++) i[e * 3] = n.r, i[e * 3 + 1] = n.g, i[e * 3 + 2] = n.b;
	return t.setAttribute("color", new e.BufferAttribute(i, 3)), t;
}
function qt(t, n, r) {
	let i = new e.Shape();
	i.moveTo(0, 0), i.quadraticCurveTo(t * .15, n * .92, t * .55, n * .55), i.quadraticCurveTo(t * .86, n * .3, t, n * .62), i.lineTo(t, 0), i.quadraticCurveTo(t * .45, n * .28, 0, 0);
	let a = new e.ExtrudeGeometry(i, {
		depth: r,
		bevelEnabled: !1,
		curveSegments: 12
	});
	return a.translate(0, 0, -r / 2), Wt(a);
}
//#endregion
//#region src/gate-kit/core/materials.ts
var Jt = "\nfloat cgHash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }\nfloat cgHash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }\nvec3 cgHash33(vec3 p3){ p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }\nfloat cgNoise2(vec2 p){\n  vec2 i = floor(p), f = fract(p);\n  f = f * f * (3.0 - 2.0 * f);\n  float a = cgHash12(i), b = cgHash12(i + vec2(1,0)), c = cgHash12(i + vec2(0,1)), d = cgHash12(i + vec2(1,1));\n  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);\n}\nfloat cgNoise3(vec3 p){\n  vec3 i = floor(p), f = fract(p);\n  f = f * f * (3.0 - 2.0 * f);\n  float n000 = cgHash12(i.xy + i.z * 19.19);\n  float n100 = cgHash12(i.xy + vec2(1,0) + i.z * 19.19);\n  float n010 = cgHash12(i.xy + vec2(0,1) + i.z * 19.19);\n  float n110 = cgHash12(i.xy + vec2(1,1) + i.z * 19.19);\n  float n001 = cgHash12(i.xy + (i.z + 1.0) * 19.19);\n  float n101 = cgHash12(i.xy + vec2(1,0) + (i.z + 1.0) * 19.19);\n  float n011 = cgHash12(i.xy + vec2(0,1) + (i.z + 1.0) * 19.19);\n  float n111 = cgHash12(i.xy + vec2(1,1) + (i.z + 1.0) * 19.19);\n  return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y), mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);\n}\nfloat cgFbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i=0;i<5;i++){ s += a * cgNoise2(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }\nfloat cgFbm3(vec3 p){ float s = 0.0, a = 0.5; for (int i=0;i<4;i++){ s += a * cgNoise3(p); p = p * 2.05 + 7.3; a *= 0.5; } return s; }\nfloat cgRidge2(vec2 p){ float s = 0.0, a = 0.55; for (int i=0;i<4;i++){ float n = 1.0 - abs(cgNoise2(p) * 2.0 - 1.0); s += a * n * n; p = p * 2.1 + 3.1; a *= 0.5; } return s; }\n// anti-aliased thin line: distance d in world units, width w, pixel footprint aa\nfloat cgLine(float d, float w, float aa){ return 1.0 - smoothstep(w, w + aa, abs(d)); }\n", Yt = "\nvarying vec3 vCgWorld;\nvarying vec3 vCgNormalW;\nvarying vec3 vCgObj;\nvarying float vCgSeed;\n", Xt = "\n{\n  vec4 cgP = vec4(transformed, 1.0);\n  vec3 cgN = objectNormal;\n  float cgSeedV = 0.0;\n  #ifdef USE_INSTANCING\n    cgP = instanceMatrix * cgP;\n    cgN = mat3(instanceMatrix) * cgN;\n    cgSeedV = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);\n  #endif\n  vCgWorld = (modelMatrix * cgP).xyz;\n  vCgNormalW = normalize(mat3(modelMatrix) * cgN);\n  vCgObj = transformed;\n  vCgSeed = cgSeedV;\n}\n";
function z(t = {}) {
	let n = new e.MeshStandardMaterial(t.params ?? {});
	t.name && (n.name = t.name);
	let r = t.uniforms ?? {}, i = "proc:" + Zt([
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
		n = n.replace("#include <common>", `#include <common>\n${Yt}\n${t.vertexHead ?? ""}`), t.vertexPre && (n = n.replace("#include <begin_vertex>", `#include <begin_vertex>\n{\n${t.vertexPre}\n}`)), n = n.replace("#include <worldpos_vertex>", `#include <worldpos_vertex>\n${Xt}`), i = i.replace("#include <common>", `#include <common>\n${Yt}\n${Jt}\n${t.head ?? ""}`), i = i.replace("void main() {", "void main() {\nvec3 cgP = vCgWorld; vec3 cgN = normalize(vCgNormalW); vec3 cgO = vCgObj; float cgSeed = vCgSeed; vec3 cgBump = vec3(0.0); float cgAO = 1.0;"), t.color && (i = i.replace("#include <color_fragment>", `#include <color_fragment>\n{\n${t.color}\n}`)), t.roughness && (i = i.replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>\n{\n${t.roughness}\n}`)), t.metalness && (i = i.replace("#include <metalnessmap_fragment>", `#include <metalnessmap_fragment>\n{\n${t.metalness}\n}`)), t.normal && (i = i.replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\n{\n${t.normal}\n}\nnormal = normalize(normal + (viewMatrix * vec4(cgBump, 0.0)).xyz);`)), t.emissive && (i = i.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n{\n${t.emissive}\n}`)), t.ao && (i = i.replace("#include <aomap_fragment>", `#include <aomap_fragment>\n{\n${t.ao}\n}\nreflectedLight.indirectDiffuse *= cgAO; reflectedLight.indirectSpecular *= mix(1.0, cgAO, 0.7);`)), e.vertexShader = n, e.fragmentShader = i;
	}, n;
}
function Zt(e) {
	let t = 2166136261;
	for (let n = 0; n < e.length; n++) t ^= e.charCodeAt(n), t = Math.imul(t, 16777619);
	return (t >>> 0).toString(36);
}
function Qt(t, n, r, i = !0) {
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
var $t = new e.DataTexture(new Uint8Array([
	255,
	255,
	255,
	255
]), 1, 1);
$t.needsUpdate = !0;
function en(e = 0) {
	return z({
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
function tn() {
	return z({
		name: "plaster",
		params: {
			color: 16777215,
			roughness: .9
		},
		color: "\n      float n = cgFbm2(vec2(cgP.x * 0.9 + cgP.z * 0.9, cgP.y * 0.7));\n      float fine = cgNoise2(vec2(cgP.x * 8.0 + cgP.z * 4.0, cgP.y * 6.0));\n      vec3 c = mix(vec3(0.18, 0.13, 0.052), vec3(0.30, 0.215, 0.09), n * 0.8 + fine * 0.2);\n      // vertical rain wash and hairline cracks\n      float streak = smoothstep(0.6, 0.9, cgNoise2(vec2(cgP.x * 4.0 + cgP.z * 2.0, cgP.y * 0.15)));\n      c *= 1.0 - streak * 0.28;\n      float crack = smoothstep(0.7, 0.9, cgRidge2(vec2((cgP.x + cgP.z) * 5.0, cgP.y * 0.25)));\n      c *= 1.0 - crack * 0.3;\n      c = mix(c, vec3(0.30, 0.245, 0.16), (1.0 - smoothstep(0.35, 1.4, cgP.y - 0.35)) * 0.5);\n      float algae = smoothstep(0.4, 0.85, cgFbm2(vec2(cgP.x * 1.8 + cgP.z, cgP.y * 1.1) + 6.0));\n      c = mix(c, vec3(0.12, 0.15, 0.065), algae * (1.0 - smoothstep(0.3, 1.2, cgP.y - 0.3)) * 0.55);\n      diffuseColor.rgb = c;\n    "
	});
}
function nn() {
	return z({
		name: "roof-field",
		params: {
			color: 16777215,
			roughness: 1,
			metalness: 0,
			map: $t,
			envMapIntensity: .05
		},
		color: "\n      // vMapUv.x/y are metres across and up the slope\n      float course = abs(fract(vMapUv.y / 0.36) - 0.5) * 2.0;\n      float rowLine = smoothstep(0.82, 0.98, course);\n      float pan = abs(fract(vMapUv.x / 0.32) - 0.5) * 2.0;\n      vec3 tile = mix(vec3(0.052,0.054,0.056), vec3(0.105,0.108,0.11), cgHash12(floor(vec2(vMapUv.x/0.32, vMapUv.y/0.36))) * 0.35 + (1.0-pan)*0.15);\n      tile *= 1.0 - rowLine * 0.32;\n      // green moss, denser near the ridge and in the pan valleys\n      float moss = smoothstep(0.38, 0.68, cgFbm2(vMapUv * 0.45 + 4.0));\n      moss *= 0.4 + 0.6 * (1.0 - pan);\n      tile = mix(tile, vec3(0.16,0.19,0.08), moss * 0.8);\n      // pale lichen spots\n      tile = mix(tile, vec3(0.34,0.34,0.30), smoothstep(0.72,0.86, cgNoise2(vMapUv*3.2)) * 0.25);\n      diffuseColor.rgb = tile;\n    ",
		normal: "\n      float course = abs(fract(vMapUv.y / 0.36) - 0.5) * 2.0;\n      cgBump = vec3(0.0, 0.0, -sign(fract(vMapUv.y/0.36)-0.5) * course * 0.4);\n    "
	});
}
function rn() {
	return z({
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
function an() {
	return z({
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
//#region src/gate-kit/core/math.ts
var B = (e, t, n) => e < t ? t : e > n ? n : e, V = (e, t, n) => e + (t - e) * n, on = (e, t, n) => {
	let r = B((n - e) / (t - e), 0, 1);
	return r * r * (3 - 2 * r);
};
function sn(e) {
	let t = e >>> 0;
	return () => {
		t |= 0, t = t + 1831565813 | 0;
		let e = Math.imul(t ^ t >>> 15, 1 | t);
		return e = e + Math.imul(e ^ e >>> 7, 61 | e) ^ e, ((e ^ e >>> 14) >>> 0) / 4294967296;
	};
}
var H = class {
	next;
	constructor(e) {
		let t = typeof e == "number" ? e : cn(e);
		this.next = sn(t);
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
function cn(e) {
	let t = 2166136261;
	for (let n = 0; n < e.length; n++) t ^= e.charCodeAt(n), t = Math.imul(t, 16777619);
	return t >>> 0;
}
function ln(e, t) {
	let n = Math.imul(e | 0, 374761393) + Math.imul(t | 0, 668265263);
	return n = Math.imul(n ^ n >>> 13, 1274126177), ((n ^ n >>> 16) >>> 0) / 4294967296;
}
var un = (e) => e * e * (3 - 2 * e);
function dn(e, t) {
	let n = Math.floor(e), r = Math.floor(t), i = e - n, a = t - r, o = un(i), s = un(a), c = ln(n, r), l = ln(n + 1, r), u = ln(n, r + 1), d = ln(n + 1, r + 1);
	return V(V(c, l, o), V(u, d, o), s) * 2 - 1;
}
function fn(e, t, n = 4, r = 2.02, i = .5) {
	let a = .5, o = 1, s = 0, c = 0;
	for (let l = 0; l < n; l++) s += a * dn(e * o + l * 17.31, t * o - l * 9.13), c += a, a *= i, o *= r;
	return s / c;
}
//#endregion
//#region src/gate-kit/world/textures.ts
var pn = /* @__PURE__ */ new Map();
function mn(t = "flagstone", n = 8) {
	let r = `${t}:${n}`, i = pn.get(r);
	if (i) return i;
	let a = 2048, o = new H(t), s = a / n, c = [], l = -o.range(0, s * .4), u = 0;
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
	let d = Qt(a, a, (e) => {
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
	let f = Qt(a, a, (e) => {
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
	return pn.set(r, p), p;
}
function hn(e = 6, t = !0, n = 0, r = 0) {
	let { map: i } = mn("lingyin-flagstone", 8), a = e.toFixed(2);
	return z({
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
function gn(t = 0) {
	let n = new H("granite-tex"), r = Qt(512, 512, (e) => {
		e.fillStyle = "#4a4a45", e.fillRect(0, 0, 512, 512);
		for (let t = 0; t < 9e3; t++) {
			let t = 60 + Math.floor(n.range(0, 80));
			e.fillStyle = `rgba(${t},${t + n.range(-3, 3)},${t - n.range(0, 8)},${n.range(.15, .6)})`, e.fillRect(n.range(0, 512), n.range(0, 512), n.range(1, 3), n.range(1, 3));
		}
		for (let t = 0; t < 700; t++) e.fillStyle = n.chance(.5) ? "rgba(200,196,180,0.35)" : "rgba(20,20,18,0.4)", e.fillRect(n.range(0, 512), n.range(0, 512), n.range(1, 4), n.range(1, 4));
		for (let t = 0; t < 12; t++) {
			let t = n.range(0, 512), r = n.range(0, 512), i = n.range(20, 90), a = e.createRadialGradient(t, r, 0, t, r, i);
			a.addColorStop(0, "rgba(40,60,26,0.32)"), a.addColorStop(1, "rgba(40,60,26,0)"), e.fillStyle = a, e.fillRect(t - i, r - i, i * 2, i * 2);
		}
	});
	return r.wrapS = r.wrapT = e.RepeatWrapping, r.anisotropy = 16, z({
		name: "granite-textured",
		params: {
			color: 16777215,
			map: r,
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
var U = {
	w: 13.8,
	d: 6.4,
	eaveY: 7.02,
	rise: 3.15,
	overhang: .9,
	ridgeFrac: .44,
	cornerLift: .3
}, W = U.w / 2 + U.overhang, G = U.d / 2 + U.overhang, K = U.w * U.ridgeFrac / 2;
function q(t, n, r) {
	let i = (Math.abs(n - .5) * 2) ** 5 * (1 - r) ** 2.15 * U.cornerLift, a = U.eaveY + U.rise * r ** 1.32 + i;
	if (t === "front" || t === "back") {
		let i = t === "front" ? 1 : -1, o = (n - .5) * 2 * (W * (1 - r) + K * r), s = i * G * (1 - r) ** .94;
		return new e.Vector3(o, a, s);
	}
	let o = (t === "left" ? -1 : 1) * (W * (1 - r) + K * r), s = (n - .5) * 2 * G * (1 - r);
	return new e.Vector3(o, a, s);
}
function _n(t, n, r) {
	let i = .008, a = q(t, Math.min(1, n + i), r).sub(q(t, Math.max(0, n - i), r)), o = q(t, n, Math.min(1, r + i)).sub(q(t, n, Math.max(0, r - i))), s = new e.Vector3().crossVectors(a, o).normalize();
	return s.y < 0 && s.negate(), s;
}
var vn = class {
	group = new e.Group();
	tileMat = rn();
	fieldMat = nn();
	constructor() {
		this.group.name = "roof", this.buildField(), this.buildCoverTiles(), this.buildRidges(), this.buildEaves(), this.buildMossPatches();
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
			for (let e = 0; e <= 26; e++) {
				let t = e / 26;
				for (let e = 0; e <= 56; e++) {
					let a = e / 56, o = q(n, a, t);
					r.push(o.x, o.y, o.z), i.push((a - .5) * (n === "front" || n === "back" ? W * 2 : G * 2), t * 6.5);
				}
			}
			for (let e = 0; e < 26; e++) for (let t = 0; t < 56; t++) {
				let n = e * 57 + t, r = n + 1, i = n + 56 + 1, o = i + 1;
				a.push(n, r, i, r, o, i);
			}
			let o = new e.BufferGeometry();
			o.setAttribute("position", new e.Float32BufferAttribute(r, 3)), o.setAttribute("uv", new e.Float32BufferAttribute(i, 2)), o.setIndex(a), o.computeVertexNormals(), t.push(o);
		}
		let n = new e.Mesh(R(t), this.fieldMat);
		n.castShadow = !0, n.receiveShadow = !0, this.group.add(n);
	}
	buildCoverTiles() {
		let t = new H("roof-tiles"), n = [], r = .095, i = (i, a, o, s) => {
			let c = [], l = [], u = [], d = new e.Color().setHSL(.12 + t.range(-.02, .02), .035, .13 + t.range(-.03, .045)), f = t.chance(.32), p = [], m = [], h = [];
			for (let e = 0; e <= 3; e++) {
				let t = o + (s - o) * (e / 3), n = q(i, a, t), r = _n(i, a, t), c = .01, l = q(i, Math.min(1, a + c), t).sub(q(i, Math.max(0, a - c), t)).normalize();
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
			for (let e = 0; e < 12; e++) {
				let n = e / 12, r = Math.min(1, (e + 1) / 12 + .018);
				i("front", t, n, r), i("back", t, n, r);
			}
		}
		for (let e = 0; e <= 20; e++) {
			let t = e / 20;
			for (let e = 0; e < 12; e++) {
				let n = e / 12, r = Math.min(1, (e + 1) / 12 + .018);
				i("left", t, n, r), i("right", t, n, r);
			}
		}
		let a = new e.Mesh(R(n), this.tileMat);
		a.castShadow = !0, a.receiveShadow = !0, this.group.add(a);
	}
	buildRidges() {
		let t = [], n = U.eaveY + U.rise;
		t.push(L(K * 2 + 1.2, .2, .42, 0, n + .2, 0));
		for (let r = -K - .4; r <= K + .4; r += .28) {
			let i = new e.CylinderGeometry(.16, .16, .22, 10);
			i.translate(r, n + .36, 0), t.push(i);
		}
		for (let e = -K - .3; e <= K + .3; e += .34) for (let r of [-1, 1]) t.push(L(.24, .18, .04, e, n + .2, r * .22));
		for (let e of [-1, 1]) {
			t.push(L(.4, .32, .46, e * (K + .48), n + .18, 0));
			let r = L(.3, .5, .34, e * (K + .6), n + .5, .02);
			r.rotateZ(e * -.8), t.push(r);
			let i = L(.2, .28, .28, e * (K + .78), n + .7, .02);
			i.rotateZ(e * -1.25), t.push(i);
		}
		for (let r of [-1, 1]) for (let i of [-1, 1]) {
			let a = new e.Vector3(r * K, n + .1, 0), o = new e.Vector3(r * W, U.eaveY + U.cornerLift * .65, i * G), s = o.clone().sub(a), c = s.length(), l = new e.BoxGeometry(.3, c, .3);
			l.translate(0, c / 2, 0), l.applyQuaternion(new e.Quaternion().setFromUnitVectors(new e.Vector3(0, 1, 0), s.normalize())), l.translate(a.x, a.y, a.z), t.push(l);
			for (let n = .06; n < .96; n += .1) {
				let r = a.clone().lerp(o, n), i = new e.CylinderGeometry(.13, .13, .2, 8);
				i.translate(r.x, r.y + .18, r.z), t.push(i);
			}
		}
		let r = R(t);
		Kt(r, new e.Color(.14, .15, .14));
		let i = new e.Mesh(r, this.tileMat);
		i.castShadow = !0, i.receiveShadow = !0, this.group.add(i);
	}
	buildMossPatches() {
		let t = new H("roof-moss-patches"), n = [], r = [];
		for (let i = 0; i < 120; i++) {
			let a = [
				"front",
				"back",
				"left",
				"right"
			][i % 4], o = t.range(.06, .94), s = t.chance(.55) ? t.range(.03, .3) : t.range(.55, .96), c = q(a, o, s), l = _n(a, o, s), u = q(a, Math.min(1, o + .01), s).sub(q(a, Math.max(0, o - .01), s)).normalize(), d = new e.Vector3().crossVectors(l, u).normalize(), f = t.range(.14, .45), p = t.int(6, 9);
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
		let i = R(n.map((t) => (t.setAttribute("color", new e.Float32BufferAttribute(r.slice(0, t.getAttribute("position").count * 3), 3)), t))), a = new e.MeshStandardMaterial({
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
		let t = en(1), n = [];
		for (let e of [-1, 1]) n.push(L(W * 2, .2, .16, 0, U.eaveY - .26, e * G)), n.push(L(.16, .2, G * 2, e * W, U.eaveY - .26, 0));
		for (let t = -W + .3; t <= W - .3; t += .34) for (let r of [-1, 1]) {
			let i = new e.BoxGeometry(.1, .14, 1.7);
			i.rotateX(r * .22), i.translate(t, U.eaveY - .3, r * (G - .8)), n.push(i);
			let a = new e.BoxGeometry(.11, .15, .06);
			a.translate(t, U.eaveY - .42, r * (G + .04)), n.push(a);
		}
		for (let t = -G + .4; t <= G - .4; t += .36) for (let r of [-1, 1]) {
			let i = new e.BoxGeometry(1.6, .14, .1);
			i.rotateZ(r * -.22), i.translate(r * (W - .8), U.eaveY - .3, t), n.push(i);
		}
		n.push(L(W * 2 - .6, .12, G * 2 - .6, 0, U.eaveY - .14, 0));
		let r = new e.Mesh(R(n), t);
		r.castShadow = !0, r.receiveShadow = !0, this.group.add(r);
		let i = [];
		for (let t of [-1, 1]) for (let n of [-1, 1]) {
			let r = new e.CylinderGeometry(.04, .12, .75, 8);
			r.rotateZ(t * -.7), r.rotateX(n * .25), r.translate(t * (W - .1), U.eaveY + .28, n * (G - .1)), i.push(r);
		}
		let a = R(i);
		Kt(a, new e.Color(.15, .16, .15));
		let o = new e.Mesh(a, this.tileMat);
		o.castShadow = !0, this.group.add(o), this.group.traverse((t) => {
			if (t instanceof e.Mesh) {
				let n = t.geometry;
				!n.getAttribute("color") && t.material === this.tileMat && Kt(n, new e.Color(.16, .17, .16));
			}
		});
	}
}, J = .35, yn = 5.6, bn = [
	-6,
	-2.6,
	2.6,
	6
], Y = 2, xn = class {
	group = new e.Group();
	roof;
	timber = en(0);
	timberDark = en(1);
	stone = gn(.12);
	balustradeStone = F(.2);
	plaster = tn();
	gold = an();
	constructor() {
		this.group.name = "gate", this.buildPlatformAndBases(), this.buildColumns(), this.buildBrackets(), this.buildWalls(), this.buildRailings(), this.buildPlaque(), this.buildCeiling(), this.buildWings(), this.buildIvy(), this.buildContactShadow(), this.roof = new vn(), this.group.add(this.roof.group);
	}
	buildPlatformAndBases() {
		let t = [];
		t.push(L(17.2, .68, 7.4, 0, -.34, 0)), t.push(L(17.2, .35, 7.4, 0, .175, 0)), t.push(L(17.6, .12, 7.8, 0, .31, 0));
		for (let n of bn) for (let r of [-Y, Y]) {
			t.push(L(.95, .2, .95, n, J + .1, r));
			let i = new e.CylinderGeometry(.42, .47, .42, 16);
			i.translate(n, J + .41, r), t.push(i);
			let a = new e.TorusGeometry(.43, .035, 6, 16);
			a.rotateX(Math.PI / 2), a.translate(n, J + .62, r), t.push(a);
			for (let e = 0; e < 12; e++) {
				let i = e / 12 * Math.PI * 2, a = L(.16, .05, .26, 0, 0, 0);
				a.rotateX(-.28), a.rotateY(-i), a.translate(n + Math.cos(i) * .5, J + .56, r + Math.sin(i) * .5), t.push(a);
			}
		}
		for (let e = 0; e < 3; e++) t.push(L(9.5, .12, .5, 0, .06 + e * .12, 4 + (2 - e) * .5)), t.push(L(9.5, .12, .5, 0, .06 + e * .12, -4 - (2 - e) * .5));
		for (let e = 0; e < 4; e++) {
			let n = .16 * (e + 1);
			for (let r of [-1, 1]) t.push(L(5, .15, .5, 0, n - .68 - .075, r * (7 - e * .5)));
		}
		let n = new e.Mesh(R(t), this.stone);
		n.castShadow = !0, n.receiveShadow = !0, this.group.add(n);
		let r = hn(3.4, !1), i = new e.Mesh(new e.PlaneGeometry(16.7, 7), r);
		i.rotation.x = -Math.PI / 2, i.position.set(0, .356, 0), i.receiveShadow = !0, this.group.add(i);
		for (let t = 0; t < 3; t++) for (let n of [-1, 1]) {
			let i = new e.Mesh(new e.PlaneGeometry(9.4, .48), r);
			i.rotation.x = -Math.PI / 2, i.position.set(0, .122 + t * .12, n * (4 + (2 - t) * .5)), i.receiveShadow = !0, this.group.add(i);
		}
	}
	buildColumns() {
		let t = [];
		for (let e of bn) for (let n of [-Y, Y]) {
			let r = yn - (J + .62);
			t.push(Gt(.23, .28, r, 16, e, J + .62 + r / 2, n)), t.push(Gt(.295, .295, .06, 16, e, J + .85, n));
		}
		for (let e of bn) t.push(L(.26, .32, 4.5, e, yn - .12, 0));
		for (let e = 0; e < bn.length - 1; e++) {
			let n = bn[e + 1] - bn[e] - .5, r = (bn[e] + bn[e + 1]) / 2;
			for (let e of [-Y, Y]) t.push(L(n, .42, .32, r, yn - .22, e)), t.push(L(n + .1, .24, .36, r, yn + .08, e));
		}
		for (let e of [-1.5, 1.5]) {
			let n = Gt(.11, .11, 13.4, 10, 0, 6.55, e);
			n.rotateZ(Math.PI / 2), t.push(n);
		}
		for (let e of [-5.2, 5.2]) {
			let n = Gt(.1, .1, 3.6, 10, e, 6.7, 0);
			n.rotateX(Math.PI / 2), t.push(n);
		}
		let n = new e.Mesh(R(t), this.timber);
		n.castShadow = !0, n.receiveShadow = !0, this.group.add(n);
		let r = [];
		for (let e of bn) for (let t of [-Y, Y]) for (let n of [-1, 1]) {
			let i = qt(1.55, .62, .16);
			n < 0 && i.scale(-1, 1, 1), i.translate(e, yn - .45, t + (t > 0 ? -.15 : .15)), r.push(i);
		}
		let i = new e.Mesh(R(r), this.timberDark);
		i.castShadow = !0, i.receiveShadow = !0, this.group.add(i);
	}
	bracketCluster() {
		let e = [];
		e.push(L(.58, .26, .58, 0, .13, 0)), e.push(L(1.18, .15, .3, 0, .34, 0)), e.push(L(.32, .15, 1.12, 0, .34, .1));
		for (let t of [
			-.46,
			0,
			.46
		]) e.push(L(.3, .2, .3, t, .5, 0));
		e.push(L(1.5, .14, .27, 0, .64, .05)), e.push(L(.29, .14, 1.3, 0, .64, .16));
		for (let t of [
			-.62,
			0,
			.62
		]) e.push(L(.26, .18, .26, t, .8, .08));
		e.push(L(1, .12, .24, 0, .92, .16)), e.push(L(.2, .15, 1.05, 0, .84, .55, 0, .12)), e.push(L(.44, .2, .42, 0, .98, 1.12));
		for (let t of [-1, 1]) e.push(L(.09, .5, .13, t * .18, .62, .52, 0, t * .55, t * .16));
		return e.push(L(.12, .34, .12, 0, .78, 1.13)), R(e);
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
		let i = new e.Mesh(R(t), this.timberDark);
		i.castShadow = !0, i.receiveShadow = !0, this.group.add(i);
		let a = [];
		for (let [e, t, n] of r) a.push(L(.12, .1, .12, e, t + .98, n + (n > 0 ? 1.05 : -1.05)));
		let o = new e.Mesh(R(a), this.gold);
		o.castShadow = !1, this.group.add(o);
	}
	panelWall(e, t, n, r, i) {
		let a = [], o = Math.max(6, Math.round(e / .34));
		for (let n = 0; n <= o; n++) {
			let r = -e / 2 + e * n / o;
			a.push(L(.26, t, .12, r, t / 2, 0));
		}
		a.push(L(e, .22, .18, 0, t * .18, .02)), a.push(L(e, .26, .2, 0, t * .72, .02)), a.push(L(e, .24, .2, 0, t - .12, .02));
		let s = R(a);
		return s.translate(n, r, i), s;
	}
	buildWalls() {
		let t = [], n = [[-6, -2.6], [2.6, 6]];
		for (let [e, r] of n) {
			let n = r - e - .55, i = (e + r) / 2;
			for (let a of [-Y, Y]) {
				let o = L(n, 4.95, .08, 0, 2.47, -.09);
				o.translate(i, J + .02, a), t.push(o), t.push(this.panelWall(n, 4.95, i, J + .02, a));
				let s = [];
				for (let t of [
					e + .3,
					(e + r) / 2,
					r - .3
				]) s.push(L(.2, 4.95, .18, t, J + .02 + 2.47, a + (a > 0 ? .1 : -.1)));
				for (let e of [
					1.4,
					2.6,
					3.9
				]) s.push(L(n, .16, .16, i, J + .02 + e, a + (a > 0 ? .1 : -.1)));
				t.push(R(s));
				let c = [], l = J + .02 + 2.6;
				for (let e = 0; e <= Math.round(n / .22); e++) c.push(L(.05, 2, .07, i - n / 2 + n * e / Math.round(n / .22), l + 2 / 2, a + (a > 0 ? .12 : -.12)));
				for (let e = 0; e <= 5; e++) c.push(L(n, .05, .07, i, l + 2 * e / 5, a + (a > 0 ? .12 : -.12)));
				t.push(R(c));
			}
		}
		for (let e of [-6, 6]) {
			let n = [];
			for (let e = 0; e <= 12; e++) {
				let t = -1.9 + 3.8 * e / 12;
				n.push(L(.12, 4.95, .28, 0, 2.47, t));
			}
			let r = R(n);
			r.translate(e, J + .02, 0), t.push(r);
		}
		let r = new e.Mesh(R(t), this.timberDark);
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
		let a = new e.Mesh(R(i), this.gold);
		a.castShadow = !1, this.group.add(a);
		let o = [];
		for (let e of [-1, 1]) o.push(L(6.4, 2.3, .34, e * 8.95, J + 1.15, -1.1)), o.push(L(6.6, .4, .46, e * 8.95, J + .2, -1.1));
		let s = new e.Mesh(R(o), this.plaster);
		s.castShadow = !0, s.receiveShadow = !0, this.group.add(s);
	}
	buildRailings() {
		let t = [], n = (e, n, r) => {
			let i = Math.abs(n - e), a = Math.max(2, Math.round(i / 2.4));
			for (let o = 0; o <= a; o++) {
				let s = e + (n - e) * o / a;
				if (t.push(L(.24, .95, .24, s, J + .475, r)), t.push(L(.34, .12, .34, s, J + .98, r)), o < a) {
					let s = e + (n - e) * (o + .5) / a;
					t.push(L(i / a, .16, .14, s, J + .74, r));
				}
			}
		};
		n(-5.6, -2.9, 1.35), n(2.9, 5.6, 1.35);
		let r = new e.Mesh(R(t), this.balustradeStone);
		r.name = "gate-stone-balustrades", r.castShadow = !0, r.receiveShadow = !0, this.group.add(r);
	}
	buildCeiling() {
		let t = [];
		for (let e = -6.2; e <= 6.2; e += .5) t.push(L(.11, .14, 4.2, e, 5.62, 0, 0, .06));
		for (let e of [
			-1.2,
			0,
			1.2
		]) {
			let n = Gt(.09, .09, 12.8, 8, 0, 5.72, e);
			n.rotateZ(Math.PI / 2), t.push(n);
		}
		for (let e of [
			-6.1,
			-2.65,
			2.65,
			6.1
		]) for (let n of [-1.95, 1.95]) t.push(L(.26, .3, .35, e, 5.62, n));
		let n = new e.Mesh(R(t), this.timber);
		n.castShadow = !0, n.receiveShadow = !0, this.group.add(n);
	}
	buildPlaque() {
		let t = new e.Group(), n = Qe("gate"), r = new e.Mesh(new e.BoxGeometry(4.5, 1.45, .16), ut()), i = new e.Mesh(new e.PlaneGeometry(4.2, 1.2), new e.MeshStandardMaterial({
			map: n,
			roughness: .86,
			metalness: .02,
			side: e.DoubleSide
		}));
		i.position.z = .09, t.add(r, i);
		let a = [];
		for (let e of [-1, 1]) a.push(L(.06, 1, .06, e * 1.2, .95, 0)), a.push(L(.16, .06, .16, e * 1.2, 1.46, 0));
		let o = new e.Mesh(R(a), this.gold);
		t.add(o), t.position.set(0, 4.5, Y + .24), t.traverse((t) => {
			t instanceof e.Mesh && (t.castShadow = !0);
		}), this.group.add(t);
	}
	buildIvy() {
		let t = Qt(256, 256, (e) => {
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
		let c = new e.Mesh(R(a), r);
		c.castShadow = !1, this.group.add(c);
		let l = new e.Mesh(R(i), n);
		l.castShadow = !1, this.group.add(l);
	}
	buildContactShadow() {
		let t = Qt(512, 256, (e) => {
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
		});
		for (let r of [-1, 1]) {
			let i = r * 8.95;
			for (let n of [-1, 1]) {
				let r = new e.Mesh(new e.BoxGeometry(6.8, .1, .95), t);
				r.rotation.x = n * .34, r.position.set(i, J + 3, -1.1 + n * .38), r.castShadow = !0, r.receiveShadow = !0, this.group.add(r);
			}
			let a = new e.Mesh(new e.BoxGeometry(6.8, .14, .18), t);
			a.position.set(i, J + 3.16, -1.1), this.group.add(a);
			let o = new e.Mesh(new e.BoxGeometry(6.8, .16, .1), this.timberDark);
			o.position.set(i, J + 2.86, -.22), this.group.add(o);
			for (let n = 0; n < 15; n++) {
				let r = new e.Mesh(new e.CylinderGeometry(.055, .055, .06, 8), t);
				r.rotation.x = Math.PI / 2, r.position.set(i - 3.2 + n * .44, J + 2.82, -.17), this.group.add(r);
			}
			let s = new e.Mesh(new e.BoxGeometry(7, .62, .86), this.stone);
			s.position.set(i, .04, -1.1), s.castShadow = !0, s.receiveShadow = !0, this.group.add(s);
			let c = new e.Mesh(new e.BoxGeometry(7.12, .12, .96), this.stone);
			c.position.set(i, J + .06, -1.1), c.receiveShadow = !0, this.group.add(c);
			let l = new e.Mesh(new e.BoxGeometry(1.05, 2, .07), n);
			l.position.set(i + r * .4, J + 1.2, -.91), this.group.add(l);
			let u = new e.Mesh(new e.BoxGeometry(1.26, 2.2, .1), this.timberDark);
			u.position.set(i + r * .4, J + 1.3, -.94), this.group.add(u);
		}
	}
}, Sn = class {
	group = new e.Group();
	gameMap;
	constructor(e = {}) {
		this.gameMap = !!e.gameMap, this.group.name = "ground", this.gameMap || this.buildBase(), this.buildPaving(), this.buildKerbs(), this.buildMoss(), this.buildRocks();
	}
	buildBase() {
		let t = new e.MeshStandardMaterial({
			color: new e.Color("#211f17"),
			roughness: 1
		}), n = new e.Mesh(new e.PlaneGeometry(90, 90), t);
		n.rotation.x = -Math.PI / 2, n.position.y = -.06, n.receiveShadow = !0, this.group.add(n);
	}
	buildPaving() {
		let t = this.gameMap ? 44 : 64, n = this.gameMap ? 40.5 : 64, r = this.gameMap ? tt(t, n) : hn(3.6, !0, 0, 0), i = new e.Mesh(new e.PlaneGeometry(t, n), r);
		i.rotation.x = -Math.PI / 2, i.position.set(0, this.gameMap ? .025 : .015, this.gameMap ? 14.25 : 8), i.receiveShadow = !0, i.name = "flagstone-path", this.group.add(i);
	}
	buildKerbs() {
		let t = new H("kerbs"), n = gn(.06), r = [];
		for (let e of [-1, 1]) for (let n = 5; n < 33; n += 2.1) {
			let i = .12 + t.range(-.015, .025), a = L(.34, .22, 2, e * 3.55, i, n + 2 / 2);
			a.scale(1, 1, .96), r.push(a);
		}
		let i = new e.Mesh(R(r), n);
		i.castShadow = !0, i.receiveShadow = !0, i.name = "kerbstones", this.group.add(i);
	}
	buildRocks() {
		let t = new H("ground-rocks"), n = [];
		for (let r = 0; r < 26; r++) {
			let r = (t.chance(.5) ? -1 : 1) * t.range(3.6, 6.8), i = t.range(5, 28), a = t.range(.07, .26), o = new e.IcosahedronGeometry(a, 0);
			o.scale(1.4, t.range(.45, .8), 1), o.rotateY(t.range(0, Math.PI * 2)), o.translate(r, a * .5, i), Kt(o, new e.Color().setHSL(.1 + t.range(-.02, .02), .04, .16 + t.range(0, .1))), n.push(o);
		}
		let r = gn(.02), i = new e.Mesh(R(n), r);
		i.castShadow = !0, i.receiveShadow = !0, i.name = "path-rocks", this.group.add(i);
	}
	buildMoss() {
		let t = new H("moss"), n = [];
		for (let r = 0; r < 190; r++) {
			let i = t.chance(.5) ? -1 : 1, a = r < 45, o = a ? t.range(-3, 3) : i * t.range(3.1, 16) * (t.chance(.5) ? 1 : .4), s = t.range(4.8, 33), c = a ? t.range(.015, .06) : t.range(.1, .4), l = new e.IcosahedronGeometry(c, 0);
			l.scale(1.6, .22, 1.6), l.translate(o, .035, s), Kt(l, new e.Color().setHSL(.23 + t.range(-.03, .03), .4, .11 + t.range(0, .05))), n.push(l);
		}
		let r = new e.MeshStandardMaterial({
			color: 16777215,
			roughness: 1,
			vertexColors: !0,
			envMapIntensity: .04
		}), i = new e.Mesh(R(n), r);
		i.receiveShadow = !0, i.name = "moss-clumps", this.group.add(i);
	}
}, Cn = {
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
}, wn = 1024, Tn = 4, X = wn / Tn, Z = Math.PI * 2, En = {
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
function Dn(e, t) {
	return [
		B(e[0] * t, 0, 255),
		B(e[1] * t, 0, 255),
		B(e[2] * t, 0, 255)
	];
}
function On(e, t = 1) {
	return `rgba(${Math.round(B(e[0], 0, 255))},${Math.round(B(e[1], 0, 255))},${Math.round(B(e[2], 0, 255))},${t})`;
}
function kn(e, t, n, r) {
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
	c.addColorStop(0, On(Dn(o, .66))), c.addColorStop(.42, On(o)), c.addColorStop(1, On(Dn(o, s.glow ?? 1.18))), e.fillStyle = c, kn(e, r, i, s.serrated ?? !1), e.fill(), e.strokeStyle = On(Dn(o, 1.62), .3), e.lineWidth = .9, e.stroke(), e.strokeStyle = On(Dn(o, 1.55), .5), e.lineWidth = Math.max(.55, i * .045), e.beginPath(), e.moveTo(r * .03, 0), e.quadraticCurveTo(r * .5, -i * .07, r * .95, 0), e.stroke(), e.strokeStyle = On(Dn(o, 1.75), .28), e.lineWidth = .55;
	for (let t = 1; t <= 4; t++) {
		let n = .2 + t * .16, a = r * n, o = i * (1 - n * .52);
		for (let t of [-1, 1]) e.beginPath(), e.moveTo(a, 0), e.quadraticCurveTo(a + r * .075, t * o * .42, a + r * .15, t * o * .64), e.stroke();
	}
	e.restore();
}
function An(e, t, n) {
	for (let r = 0; r < n.branches; r++) {
		let i = n.branches === 1 ? 0 : (r / (n.branches - 1) - .5) * 2, a = -Math.PI / 2 + i * t.range(.55, .95) + t.range(-.22, .22), o = n.reach * t.range(.62, 1), s = n.cx + Math.cos(a) * o, c = n.cy + Math.sin(a) * o, l = (n.cx + s) * .5 + t.range(-8, 8), u = (n.cy + c) * .5 + t.range(-4, 9);
		e.strokeStyle = "rgba(56,44,28,0.95)", e.lineWidth = t.range(1.15, 2.2), e.beginPath(), e.moveTo(n.cx, n.cy), e.quadraticCurveTo(l, u, s, c), e.stroke();
		for (let r = 0; r < n.perBranch; r++) {
			if (t.chance(n.sparse ?? .05)) continue;
			let i = .16 + r / n.perBranch * .9, o = V(n.cx, s, i) + (.5 - i) * 5, l = V(n.cy, c, i) + Math.sin(i * Math.PI) * (n.droop ?? 0), u = a + (r % 2 == 0 ? -1 : 1) * t.range(.5, 1.12) + t.range(-.18, .18);
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
var jn = [
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
], Mn = [
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
], Nn = [
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
], Pn = [
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
], Fn = [
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
], In = [
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
], Ln = [
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
], Rn = [
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
function zn(e, t) {
	for (let n = 0; n < 26; n++) Q(e, X * .5 + t.range(-42, 42), X * .58 + t.range(-38, 38), t.range(26, 44), t.range(9, 15), t.range(-Math.PI, Math.PI), [
		26,
		42,
		22
	]);
	An(e, t, {
		cx: X * .5,
		cy: X * .66,
		branches: 5,
		reach: 108,
		perBranch: 9,
		len: [38, 60],
		wid: [13, 19],
		palette: jn,
		droop: 6
	});
	for (let n = 0; n < 7; n++) Q(e, X * .5 + t.range(-70, 70), X * .46 + t.range(-58, 26), t.range(26, 38), t.range(9, 13), t.range(-Math.PI, Math.PI), Nn[t.int(0, Nn.length - 1)], { glow: 1.25 });
}
function Bn(e, t) {
	for (let n = 0; n < 14; n++) Q(e, X * .5 + t.range(-40, 40), X * .6 + t.range(-34, 34), t.range(30, 48), t.range(16, 24), t.range(-Math.PI, Math.PI), [
		44,
		54,
		30
	]);
	An(e, t, {
		cx: X * .52,
		cy: X * .64,
		branches: 3,
		reach: 104,
		perBranch: 8,
		len: [42, 66],
		wid: [18, 27],
		palette: Mn,
		droop: 9
	});
}
function Vn(e, t) {
	for (let n = 0; n < 13; n++) Q(e, X * .5 + t.range(-44, 44), X * .6 + t.range(-36, 36), t.range(32, 52), t.range(9, 13), t.range(-Math.PI, Math.PI), [
		34,
		44,
		24
	], { serrated: !0 });
	An(e, t, {
		cx: X * .5,
		cy: X * .68,
		branches: 4,
		reach: 110,
		perBranch: 9,
		len: [44, 70],
		wid: [10, 15],
		palette: Mn,
		serrated: !0,
		droop: 4
	});
}
function Hn(e, t) {
	for (let n = 0; n < 3; n++) {
		let r = X * (.32 + n * .18) + t.range(-10, 10), i = X - 8, a = r + t.range(-70, 70), o = t.range(44, 110), s = (r + a) * .5 + t.range(-24, 24), c = (i + o) * .5 + 12;
		e.strokeStyle = "rgba(62,50,32,0.9)", e.lineWidth = 1.7, e.beginPath(), e.moveTo(r, i), e.quadraticCurveTo(s, c, a, o), e.stroke();
		for (let n = 2; n <= 11; n++) {
			let l = n / 12, u = 1 - l, d = u * u * r + 2 * u * l * s + l * l * a, f = u * u * i + 2 * u * l * c + l * l * o, p = 2 * u * (s - r) + 2 * l * (a - s), m = 2 * u * (c - i) + 2 * l * (o - c), h = Math.atan2(m, p);
			for (let n of [-1, 1]) Q(e, d, f, t.range(18, 30) * (1.1 - l * .35), t.range(5, 8), h + n * t.range(.95, 1.25), jn[t.int(0, jn.length - 1)]);
		}
		Q(e, a, o, t.range(22, 32), t.range(6, 9), Math.atan2(o - c, a - s), jn[4]);
	}
}
function Un(e, t) {
	An(e, t, {
		cx: X * .5,
		cy: X * .64,
		branches: 3,
		reach: 96,
		perBranch: 6,
		len: [32, 50],
		wid: [13, 19],
		palette: Nn,
		sparse: .16,
		glow: 1.28
	});
	for (let n = 0; n < 5; n++) Q(e, X * .5 + t.range(-54, 54), X * .52 + t.range(-48, 18), t.range(22, 34), t.range(10, 14), t.range(-Math.PI, Math.PI), [
		150,
		158,
		92
	], { glow: 1.1 });
}
function Wn(e, t, n) {
	let r = n ? 5 : 4;
	for (let i = 0; i < r; i++) {
		let r = X * t.range(.25, .75), i = X * t.range(.28, .72);
		e.strokeStyle = "rgba(80,92,44,0.75)", e.lineWidth = .9, e.beginPath(), e.moveTo(r, i), e.lineTo(r + t.range(-16, 16), i + t.range(-16, 16)), e.stroke();
		let a = n ? 12 : 11;
		for (let o = 0; o < a; o++) {
			let a = t.range(-Math.PI, Math.PI);
			Q(e, r + t.range(-16, 16), i + t.range(-16, 16), t.range(n ? 34 : 46, n ? 58 : 82), t.range(n ? 5 : 7, n ? 8 : 11), a, Pn[t.int(0, Pn.length - 1)], { glow: 1.25 });
		}
	}
}
function Gn(e, t) {
	for (let n = 0; n < 30; n++) Q(e, X * .5 + t.range(-58, 58), X * .55 + t.range(-48, 48), t.range(18, 32), t.range(8, 12), t.range(-Math.PI, Math.PI), [
		32,
		52,
		27
	]);
	An(e, t, {
		cx: X * .5,
		cy: X * .62,
		branches: 3,
		reach: 96,
		perBranch: 16,
		len: [20, 34],
		wid: [8, 12],
		palette: Fn,
		sparse: .06,
		droop: 4
	});
}
function Kn(e, t) {
	for (let n = 0; n < 4; n++) {
		let n = X * t.range(.34, .66), r = X - 6, i = n + t.range(-84, 84), a = t.range(26, 96), o = (n + i) * .5 + t.range(-16, 16), s = (r + a) * .5 + t.range(4, 20);
		e.strokeStyle = "rgba(58,82,38,0.95)", e.lineWidth = 1.8, e.beginPath(), e.moveTo(n, r), e.quadraticCurveTo(o, s, i, a), e.stroke();
		for (let c = 3; c <= 13; c++) {
			let l = c / 14, u = 1 - l, d = u * u * n + 2 * u * l * o + l * l * i, f = u * u * r + 2 * u * l * s + l * l * a, p = 2 * u * (o - n) + 2 * l * (i - o), m = 2 * u * (s - r) + 2 * l * (a - s), h = Math.atan2(m, p);
			for (let n of [-1, 1]) Q(e, d, f, t.range(12, 22) * (1.15 - l * .5), t.range(3.2, 5), h + n * t.range(1, 1.3), Ln[t.int(0, Ln.length - 1)]);
		}
	}
}
function qn(e, t) {
	for (let n = 0; n < 26; n++) {
		let r = X * .5 + t.range(-88, 88), i = -Math.PI / 2 + t.range(-.62, .62), a = t.range(120, 232), o = t.range(-.35, .35);
		e.strokeStyle = On(n % 7 == 0 ? [
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
function Jn(e, t) {
	for (let n = 0; n < 56; n++) Q(e, X * .5 + t.range(-74, 74), X * .5 + t.range(-70, 70), t.range(15, 30), t.range(7, 11), t.range(-Math.PI, Math.PI), In[t.int(0, In.length - 1)], { glow: 1.1 });
	An(e, t, {
		cx: X * .5,
		cy: X * .56,
		branches: 3,
		reach: 86,
		perBranch: 14,
		len: [18, 30],
		wid: [8, 12],
		palette: In,
		sparse: .08,
		glow: 1.15
	});
}
function Yn(e, t) {
	for (let n = 0; n < 26; n++) Q(e, t.range(16, X - 16), t.range(16, X - 16), t.range(20, 38), t.range(8, 14), t.range(-Math.PI, Math.PI), Rn[t.int(0, Rn.length - 1)], { serrated: t.chance(.4) });
	for (let n = 0; n < 3; n++) {
		let n = t.range(40, X - 40), r = t.range(40, X - 40);
		e.strokeStyle = "rgba(72,58,36,0.9)", e.lineWidth = 1.1, e.beginPath(), e.moveTo(n, r), e.lineTo(n + t.range(-34, 34), r + t.range(-34, 34)), e.stroke();
	}
}
function Xn() {
	let e = Qt(wn, wn, (e) => {
		let t = (t, n) => {
			let [r, i] = En[t];
			e.save(), e.translate(r * X, i * X), e.beginPath(), e.rect(0, 0, X, X), e.clip(), n(e, new H(`lingyin-veg-atlas-${t}`)), e.restore();
		};
		t("camphor", zn), t("broad", Bn), t("chestnut", Vn), t("pinnate", Hn), t("young", Un), t("bamboo", (e, t) => Wn(e, t, !1)), t("bambooSmall", (e, t) => Wn(e, t, !0)), t("shrub", Gn), t("fern", Kn), t("grass", qn), t("dark", Jn), t("fallen", Yn);
	});
	return e.name = "lingyin-veg-leaf-atlas", e.anisotropy = 16, e.needsUpdate = !0, e;
}
var Zn = "\n#ifdef USE_INSTANCING\n  float vgPhase = instanceMatrix[3][0] * 0.61 + instanceMatrix[3][2] * 0.83 + instanceMatrix[3][1] * 0.27;\n  float vgSlow = sin(uTime * 0.52 + vgPhase);\n  float vgFast = sin(uTime * 1.87 + vgPhase * 1.93 + transformed.y * 1.7);\n  float vgGust = 0.55 + 0.45 * sin(uTime * 0.23 + vgPhase * 0.31);\n  float vgSway = (vgSlow * 0.05 + vgFast * 0.012) * vgGust;\n  float vgLift = 0.35 + max(transformed.y, 0.0) * 0.22;\n  transformed.x += vgSway * vgLift;\n  transformed.z += vgSway * 0.45 * vgLift;\n#endif\n", Qn = "\n#ifdef USE_INSTANCING\n  float vgPhase = instanceMatrix[3][0] * 0.41 + instanceMatrix[3][2] * 0.73;\n  float vgSway = sin(uTime * 0.63 + vgPhase) * 0.014 + sin(uTime * 1.71 + vgPhase * 1.37) * 0.004;\n  float vgBend = transformed.y * transformed.y;\n  transformed.x += vgSway * vgBend;\n  transformed.z += vgSway * 0.45 * vgBend;\n#endif\n";
function $n(e, t) {
	return t < -2.4 ? 3.8 : Math.abs(e) < 8.5 && t < 6 ? 10.4 : Math.abs(e) < 10 && t < 10 ? 9 : 7.2;
}
function er(t) {
	let n = t.getAttribute("position").count, r = new Float32Array(n * 3).fill(1);
	return t.setAttribute("color", new e.BufferAttribute(r, 3)), t;
}
function tr(e) {
	let n = t(e, !1);
	if (!n) throw Error("vegetation: geometry merge failed");
	return n;
}
function nr(t, n, r) {
	let [i, a] = En[t], o = new e.PlaneGeometry(n, r, 1, 1), s = o.getAttribute("uv"), c = 2 / wn, l = i / Tn + c, u = (i + 1) / Tn - c, d = 1 - (a + 1) / Tn + c, f = 1 - a / Tn - c;
	for (let e = 0; e < s.count; e++) s.setXY(e, V(l, u, s.getX(e)), V(d, f, s.getY(e)));
	return s.needsUpdate = !0, er(o), o;
}
var rr = /* @__PURE__ */ new Map();
function ir(e, t) {
	let n = `${e}:${t}`, r = rr.get(n);
	if (r) return r;
	let i;
	if (t === "canopy") {
		let t = nr(e, 1, 1), n = nr(e, .94, .88);
		n.rotateY(1.05), n.rotateX(.14), n.translate(.04, -.03, .03);
		let r = nr(e, .8, .72);
		r.rotateY(-.62), r.rotateX(1.06), r.translate(-.03, .15, 0), i = tr([
			t,
			n,
			r
		]);
	} else if (t === "spray") {
		let t = nr(e, 1, .82), n = nr(e, .9, .72);
		n.rotateY(1.16), n.rotateX(-.12), n.translate(.02, .04, .02), i = tr([t, n]);
	} else if (t === "tuft") {
		let t = [];
		for (let n = 0; n < 3; n++) {
			let r = nr(e, .72, 1);
			r.translate(0, .5, 0), r.rotateY(n / 3 * Math.PI + .3), r.rotateX(.05), t.push(r);
		}
		i = tr(t);
	} else if (t === "fern") {
		let t = [];
		for (let n = 0; n < 5; n++) {
			let r = nr(e, .72, 1);
			r.translate(0, .5, 0), r.rotateY(n / 5 * Z + .2), r.rotateX(.18), t.push(r);
		}
		i = tr(t);
	} else {
		let t = nr(e, 1, 1);
		t.rotateX(-Math.PI / 2), i = t;
	}
	return i.computeBoundingSphere(), rr.set(n, i), i;
}
function ar(t, n, r = .08) {
	let i = [], a = [], o = [], s = t.length, c = new e.Vector3(), l = new e.Vector3(), u = new e.Vector3(), d = new e.Vector3(), f = new e.Vector3(), p = new e.Vector3(), m = new e.Vector3(0, 1, 0), h = new e.Vector3(1, 0, 0);
	for (let e = 0; e < s; e++) {
		l.copy(t[Math.max(0, e - 1)].center), u.copy(t[Math.min(s - 1, e + 1)].center), c.subVectors(u, l).normalize(), d.copy(Math.abs(c.y) > .9 ? h : m), f.crossVectors(d, c).normalize(), p.crossVectors(c, f).normalize();
		for (let o = 0; o < n; o++) {
			let c = o / n * Z, l = 1 + r * dn(c * 1.9 + e * .37, e * 1.7 + o * .11), u = Math.max(.012, t[e].radius * l), d = Math.cos(c) * u, m = Math.sin(c) * u;
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
function or(t, n) {
	return new e.CatmullRomCurve3(t, !1, "catmullrom", .5).getPoints(n);
}
function sr(t) {
	let n = new e.IcosahedronGeometry(1, t), r = n.getAttribute("position");
	for (let e = 0; e < r.count; e++) {
		let t = r.getX(e), n = r.getY(e), i = r.getZ(e), a = 1 + .17 * fn(t * 1.4 + i * .6 + 4.7, n * 1.6 - i * .9);
		r.setXYZ(e, t * a, n * a * .9, i * a);
	}
	return n.computeVertexNormals(), er(n), n;
}
function cr() {
	let t = new H("lingyin-veg-shrub-core"), n = [];
	for (let r = 0; r < 3; r++) {
		let i = new e.IcosahedronGeometry(r === 0 ? 1 : .62, +(r === 0)), a = i.getAttribute("position");
		for (let e = 0; e < a.count; e++) {
			let t = a.getX(e), n = a.getY(e), i = a.getZ(e), o = 1 + .15 * fn(t * 2.1 + r * 3.3, i * 2.4 - n * .7);
			a.setXYZ(e, t * o, n * o, i * o);
		}
		i.computeVertexNormals(), i.scale(1.2, .72, 1.1), i.translate(t.range(-.5, .5), .52 + t.range(-.08, .22), t.range(-.5, .5)), er(i), n.push(i);
	}
	return tr(n);
}
function lr() {
	let t = new e.CylinderGeometry(.03, .058, .56, 5, 1, !0);
	t.translate(0, .28, 0);
	let n = new e.CylinderGeometry(.017, .032, .47, 5, 1, !0);
	n.translate(0, .765, 0);
	let r = new e.CylinderGeometry(.012, .024, .32, 4, 1, !0);
	return r.rotateZ(.72), r.translate(.1, .74, .02), tr([
		t,
		n,
		r
	]);
}
var ur = [
	.14,
	.29,
	.44,
	.59,
	.74,
	.89
];
function dr(t) {
	let n = t ? 6 : 5, r = new Set([0, 1]);
	for (let e of ur) t ? (r.add(e - .075), r.add(e - .014), r.add(e - .004), r.add(e + .004), r.add(e + .014), r.add(e + .033), r.add(e + .075)) : (r.add(e - .06), r.add(e + .01), r.add(e + .06));
	let i = ar([...r].filter((e) => e >= 0 && e <= 1).sort((e, t) => e - t).map((t) => {
		let n = .052 * (1 - .43 * t);
		for (let e of ur) {
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
		for (let e of ur) {
			let r = t - e;
			Math.abs(r) < .011 ? n *= .55 : Math.abs(r) < .035 && (n *= .86), r > .012 && r < .034 && (n = Math.min(1.16, n * 1.2));
		}
		n *= V(.86, 1.06, t), o[e * 3] = n, o[e * 3 + 1] = n * 1.02, o[e * 3 + 2] = n * .9;
	}
	return i.setAttribute("color", new e.BufferAttribute(o, 3)), i;
}
function fr(t, n) {
	let r = new e.Vector3(t.base[0], 0, t.base[1]), i = [];
	for (let n = 0; n <= 5; n++) {
		let a = n / 5, o = dn(a * 2.4 + 3.1, 8.7) * .62 * Math.sin(a * Math.PI), s = fn(a * 2.8 - 4.4, 2.3) * .62 * Math.sin(a * Math.PI);
		i.push(new e.Vector3(r.x + t.lean[0] * a * a + o, t.height * a, r.z + t.lean[1] * a * a + s));
	}
	let a = or(i, 16), o = [ar(a.map((e, n) => {
		let r = n / (a.length - 1), i = t.radius * (1.06 - .88 * r ** .72) * (1 + .08 * dn(r * 6.3 + 1.7, t.height * .31));
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
		let d = or([
			c,
			l,
			u
		], 4), f = d.map((e, n) => ({
			center: e,
			radius: Math.max(.035, V(t.radius * .3, .045, n / (d.length - 1)))
		}));
		o.push(ar(f, 6, .14));
	}
	let s = [], c = new e.Vector3(...t.crown);
	for (let r = 0; r < t.branches; r++) {
		let i = V(.4, .88, (r + n.range(.15, .85)) / t.branches), l = a[B(Math.round(i * (a.length - 1)), 1, a.length - 2)].clone(), u = r / t.branches * Z + n.range(-.55, .55), d = new e.Vector3(Math.cos(u), 0, Math.sin(u)), f = new e.Vector3(c.x, l.y + n.range(.8, 1.9), c.z).sub(l).normalize(), p = d.clone().multiplyScalar(.55).addScaledVector(f, .8).normalize(), m = n.range(2.8, 5.1) * (1.15 - i * .32), h = l.clone().addScaledVector(d, t.radius * .3), g = h.clone().addScaledVector(p, m * .46).add(new e.Vector3(n.range(-.4, .4), n.range(.35, 1.1), n.range(-.4, .4))), _ = h.clone().addScaledVector(p, m).add(new e.Vector3(n.range(-.45, .45), n.range(.8, 2), n.range(-.45, .45))), v = or([
			h,
			g,
			_
		], 7), y = .07 + t.radius * .22 * (1 - i * .4), b = v.map((e, t) => ({
			center: e,
			radius: Math.max(.028, V(y, .032, (t / (v.length - 1)) ** .82))
		}));
		o.push(ar(b, 7, .1)), s.push({
			p: _.clone(),
			dir: p.clone(),
			weight: 1.1
		}), s.push({
			p: v[5].clone(),
			dir: p.clone(),
			weight: .9
		});
		let x = v[4].clone(), S = p.clone().add(new e.Vector3(n.range(-.7, .7), n.range(.35, .9), n.range(-.7, .7))).normalize(), C = x.clone().addScaledVector(S, n.range(1.3, 2.3)), ee = or([
			x,
			x.clone().lerp(C, .55).add(new e.Vector3(0, .3, 0)),
			C
		], 4), w = ee.map((e, t) => ({
			center: e,
			radius: Math.max(.02, V(y * .42, .022, t / (ee.length - 1)))
		}));
		o.push(ar(w, 5, .12)), s.push({
			p: C,
			dir: S,
			weight: .78
		});
	}
	let l = (t, r, a) => {
		let c = new e.CatmullRomCurve3(i, !1, "catmullrom", .5).getPointAt(r), l = or([
			c,
			c.clone().lerp(t, .5).add(new e.Vector3(0, .8 + n.range(0, .9), 0)),
			c.clone().lerp(t, .78).add(new e.Vector3(0, .25, 0)),
			t
		], 9), u = l.map((e, t) => ({
			center: e,
			radius: Math.max(.026, V(a, .028, t / (l.length - 1)))
		}));
		o.push(ar(u, 7, .08));
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
		trunk: tr(o),
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
function pr(t, n, r) {
	let i = [
		.1,
		.2,
		.08
	], a = [
		.38,
		.56,
		.2
	], o = B(t, 0, 1), s = n.chance(.16) ? 1.1 : 1, c = V(i[0], a[0], o) * s + n.range(-.045, .045), l = V(i[1], a[1], o) + n.range(-.04, .04), u = V(i[2], a[2], o) * (s > 1 ? .94 : 1) + n.range(-.035, .035), d = r ? .6 : 1;
	return new e.Color().setRGB(B(c * d, 0, 2), B(l * d, 0, 2), B(u * d, 0, 2));
}
var mr = class {
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
		this.group.name = "vegetation", this.atlas = Xn(), this.leafMat = z({
			name: "lingyin-leaf-card",
			params: {
				color: 16777215,
				map: this.atlas,
				alphaTest: .32,
				side: e.DoubleSide,
				roughness: .84,
				metalness: 0,
				vertexColors: !0
			},
			uniforms: {
				uTime: Cn.time,
				uSunDir: Cn.sunDir
			},
			vertexHead: "uniform float uTime;",
			head: "uniform vec3 uSunDir;",
			vertexPre: Zn,
			color: "\n        float vgHigh = smoothstep(1.5, 11.0, cgP.y);\n        diffuseColor.rgb *= mix(0.70, 1.05, vgHigh);\n        diffuseColor.rgb *= 0.93 + 0.14 * cgNoise2(cgP.xz * 0.35 + cgP.y * 0.17);\n        diffuseColor.rgb *= mix(vec3(1.0), vec3(1.06, 1.035, 0.86), smoothstep(7.0, 12.0, cgP.y) * 0.7);\n      ",
			roughness: "\n        roughnessFactor = clamp(roughnessFactor * (0.86 + 0.24 * cgNoise2(cgP.xz * 2.0)), 0.5, 1.0);\n      ",
			emissive: "\n        vec3 vgView = normalize(cameraPosition - cgP);\n        float vgBack = pow(max(dot(-vgView, uSunDir), 0.0), 2.6);\n        float vgThin = 0.55 + 0.45 * cgNoise2(cgO.xy * 5.0 + 17.0);\n        float vgAO = 0.35 + 0.65 * smoothstep(0.0, 9.0, cgP.y);\n        totalEmissiveRadiance += vec3(0.30, 0.38, 0.12) * vgBack * vgThin * vgAO * 0.9;\n      "
		}), this.barkMat = z({
			name: "lingyin-bark",
			params: {
				color: 16777215,
				roughness: .94,
				metalness: 0
			},
			color: "\n        float barkRidge = cgRidge2(vec2((cgP.x + cgP.z) * 6.0, cgP.y * 0.55));\n        float barkFine = cgFbm2(vec2((cgP.x - cgP.z) * 24.0, cgP.y * 5.5));\n        float barkLichen = smoothstep(0.55, 0.92, cgNoise2(vec2(cgP.y * 2.2, (cgP.x + cgP.z) * 7.0)) * 0.5 + 0.5);\n        float barkMoss = smoothstep(0.35, 0.85, cgFbm2(vec2(cgP.x * 1.3 + 5.0, cgP.z * 1.5)) * 0.5 + 0.5);\n        barkMoss *= 1.0 - smoothstep(0.4, 3.4, cgP.y + barkFine * 0.4);\n        vec3 bark = mix(vec3(0.105, 0.08, 0.058), vec3(0.30, 0.245, 0.175), smoothstep(0.25, 0.95, barkRidge));\n        bark *= 0.72 + 0.4 * barkFine;\n        bark = mix(bark, vec3(0.33, 0.34, 0.27), barkLichen * 0.22);\n        bark = mix(bark, vec3(0.14, 0.21, 0.08), barkMoss * 0.72);\n        diffuseColor.rgb *= bark;\n      ",
			normal: "\n        float e = 0.22;\n        float h0 = cgRidge2(vec2((cgP.x + cgP.z) * 6.0, cgP.y * 0.55));\n        float hx = cgRidge2(vec2((cgP.x + cgP.z + e) * 6.0, cgP.y * 0.55));\n        float hy = cgRidge2(vec2((cgP.x + cgP.z) * 6.0, (cgP.y + e) * 0.55));\n        float hz = cgRidge2(vec2((cgP.x - cgP.z + e) * 6.0, cgP.y * 0.55));\n        cgBump = vec3(hx - h0, hy - h0, hz - h0) * 2.4;\n      ",
			roughness: "\n        roughnessFactor = clamp(0.82 + 0.18 * cgNoise2(cgP.xz * 9.0 + cgP.y), 0.55, 1.0);\n      "
		}), this.massMat = z({
			name: "lingyin-canopy-mass",
			params: {
				color: 16777215,
				roughness: 1,
				metalness: 0,
				flatShading: !0,
				vertexColors: !0
			},
			color: "\n        float vgN = cgFbm3(cgP * 0.65);\n        vec3 vgMass = mix(vec3(0.065, 0.10, 0.05), vec3(0.16, 0.22, 0.105), smoothstep(0.15, 0.85, vgN));\n        vgMass *= 0.68 + 0.52 * smoothstep(0.0, 9.0, cgP.y);\n        diffuseColor.rgb *= vgMass;\n      "
		}), this.bambooMat = z({
			name: "lingyin-bamboo-culm",
			params: {
				color: 16777215,
				roughness: .62,
				metalness: 0,
				vertexColors: !0
			},
			uniforms: { uTime: Cn.time },
			vertexHead: "uniform float uTime;",
			vertexPre: Qn,
			color: "\n        float bStripe = cgNoise2(vec2((cgP.x + cgP.z) * 18.0, cgP.y * 3.4));\n        float bGrime = cgFbm2(vec2(cgP.x * 2.6 + cgP.z * 1.8, cgP.y * 0.9));\n        vec3 bCol = mix(vec3(0.045, 0.075, 0.028), vec3(0.13, 0.17, 0.052), smoothstep(0.25, 0.9, bStripe * 0.5 + 0.5));\n        bCol *= 0.78 + 0.36 * bGrime;\n        float bPowder = smoothstep(0.7, 0.95, cgNoise2(vec2(cgP.y * 1.3, (cgP.x + cgP.z) * 2.0)) * 0.5 + 0.5);\n        bCol = mix(bCol, vec3(0.34, 0.36, 0.27), bPowder * 0.22);\n        diffuseColor.rgb *= bCol;\n      ",
			roughness: "\n        roughnessFactor = clamp(0.5 + 0.22 * cgNoise2(cgP.xz * 8.0 + cgP.y), 0.35, 0.95);\n      "
		}), this.coreMat = z({
			name: "lingyin-shrub-core",
			params: {
				color: 16777215,
				roughness: 1,
				metalness: 0,
				flatShading: !0,
				vertexColors: !0
			},
			color: "\n        float sN = cgFbm3(cgP * 1.5);\n        vec3 sC = mix(vec3(0.03, 0.05, 0.026), vec3(0.09, 0.13, 0.058), smoothstep(0.1, 0.9, sN));\n        diffuseColor.rgb *= sC;\n      "
		}), this.depthMat = this.makeCardDepthMaterial(), t.gamePerimeter ? (this.leafMat.color.setRGB(.52, .62, .5), this.bambooMat.color.setRGB(.64, .72, .57), this.addFramingTrees(), this.addBamboo(), this.addShrubs(), this.addUnderstory(), this.addGroundDetails(), this.addCanopyCeiling(), this.addBoundaryGrove(), this.flushCards()) : this.populate();
	}
	makeCardDepthMaterial() {
		let t = new e.MeshDepthMaterial({
			depthPacking: e.RGBADepthPacking,
			map: this.atlas,
			alphaTest: .32,
			side: e.DoubleSide
		});
		return t.onBeforeCompile = (e) => {
			e.uniforms.uTime = Cn.time, e.vertexShader = e.vertexShader.replace("#include <common>", "#include <common>\nuniform float uTime;").replace("#include <begin_vertex>", `#include <begin_vertex>\n${Zn}`);
		}, t.customProgramCacheKey = () => "lingyin-veg-card-depth", t;
	}
	update(e) {
		Cn.time.value = e;
	}
	isPlatform(e, t, n) {
		return Math.abs(e) < 8 + n && t > -3.8 - n && t < 4 + n;
	}
	isPath(e, t, n) {
		return Math.abs(e) < 3.2 + n && t > 3.8 - n;
	}
	nearFramingTrunk(e, t, n) {
		return Math.hypot(e + 8.5, t - 7) < n || Math.hypot(e - 9.5, t - 5.5) < n || Math.hypot(e + 11, t + 4) < n;
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
		let s = B(.26 + .54 * on(4.5, 11.5, n.y) + .22 * dn(n.x * .35 + 3.1, n.z * .35 - 1.7) + (t.value() - .5) * .18, 0, 1), c = $(t, i), l = new e.Vector3(Math.min(1.1, r * .62 * t.range(.9, 1.15)), Math.min(1, r * .62 * t.range(.68, .94)), Math.min(1.1, r * .62 * t.range(.9, 1.15)));
		this.pushCard("canopy", "canopy", o, n, c, l, pr(s, t, !1));
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
				base: [-8.5, 7],
				height: 12.8,
				radius: .8,
				crown: [
					-2.2,
					9.6,
					4
				],
				crownRadius: 4.8,
				reach: [
					-.6,
					10.4,
					1.8
				],
				frame: [
					-4.2,
					5.9,
					7.7
				],
				branches: 6,
				lean: [1.1, -.5]
			},
			{
				seed: "lingyin-veg-tree-right",
				side: "right",
				base: [9.5, 5.5],
				height: 12.2,
				radius: .72,
				crown: [
					2.8,
					9.1,
					3
				],
				crownRadius: 4.5,
				reach: [
					.8,
					9.9,
					1
				],
				frame: [
					4.3,
					5.8,
					7.8
				],
				branches: 6,
				lean: [-1.2, -.3]
			},
			{
				seed: "lingyin-veg-tree-back",
				side: "back",
				base: [-11, -4],
				height: 13.6,
				radius: .86,
				crown: [
					-5.2,
					9.2,
					-3.4
				],
				crownRadius: 4.8,
				reach: [
					-2.6,
					10.6,
					-1.8
				],
				frame: [
					-8,
					8,
					1.5
				],
				branches: 5,
				lean: [.9, .6]
			},
			{
				seed: "lingyin-veg-tree-right-back",
				side: "back",
				base: [12.6, -5.2],
				height: 12.6,
				radius: .8,
				crown: [
					7.4,
					9.9,
					-5.4
				],
				crownRadius: 4.7,
				reach: [
					5,
					10.4,
					-2.6
				],
				frame: [
					9.6,
					8,
					1
				],
				branches: 5,
				lean: [-.7, .2]
			}
		], n = [], r = [];
		for (let i of t) {
			let t = new H(i.seed), a = fr(i, t);
			n.push(a.trunk);
			for (let n of a.anchors) {
				let r = Math.round(t.range(7, 11) * n.weight);
				for (let i = 0; i < r; i++) {
					let r = n.p.clone().add(new e.Vector3(t.gauss(), t.gauss() * .7, t.gauss()).multiplyScalar(.55 + n.weight * .42));
					r.y < $n(r.x, r.z) || this.addCanopyCard(t, r, t.range(.9, 1.7) * (.82 + n.weight * .2), t.chance(.5) ? n.dir : void 0);
				}
			}
			for (let n of a.lobes) {
				for (let r = 0; r < 380; r++) {
					let r = t.range(-1, 1), i = t.range(0, Z), a = Math.sqrt(1 - r * r), o = t.value() ** .4, s = new e.Vector3(a * Math.cos(i), r, a * Math.sin(i)), c = n.center.clone().add(new e.Vector3(s.x * n.radii.x * o, s.y * n.radii.y * o, s.z * n.radii.z * o));
					if (c.y < $n(c.x, c.z)) continue;
					let l = V(.85, 1.9, on(.5, 1, o) * t.range(.72, 1)) * t.range(.85, 1.15);
					this.addCanopyCard(t, c, l, s);
				}
				for (let r = 0; r < 26; r++) {
					let r = t.range(-.35, .95), i = t.range(0, Z), a = Math.sqrt(Math.max(0, 1 - r * r)), o = new e.Vector3(a * Math.cos(i), r, a * Math.sin(i)), s = n.center.clone().add(new e.Vector3(o.x * n.radii.x, o.y * n.radii.y, o.z * n.radii.z).multiplyScalar(t.range(.92, 1.1)));
					s.y < $n(s.x, s.z) || this.addCanopyCard(t, s, t.range(1.2, 2), o);
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
						n.y < $n(n.x, n.z) || this.addCanopyCard(t, n, t.range(1.7, 2.9));
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
						n.y < $n(n.x, n.z) || this.addCanopyCard(t, n, t.range(1.6, 2.6));
					}
				}
			}
		}
		let i = new e.Mesh(tr(n), this.barkMat);
		i.name = "framing-trunks", i.castShadow = !0, i.receiveShadow = !0, this.group.add(i);
	}
	addBamboo() {
		let t = new H("lingyin-veg-bamboo"), n = [], r = 0, i = (r, i, a, o, s, c, l) => {
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
			this.isPlatform(o, s, .15) || this.isPath(o, s, .3) || this.nearFramingTrunk(o, s, 1.3) || fn(o * .35 + 10.3, s * .35 - 3.1) < -.18 && t.chance(.45) || i(o, s, t.range(6, 10) * (a ? .94 : 1), a ? t.range(.3, .46) : t.range(.01, .09), a ? new e.Vector3(1, 0, t.range(-.3, .3)) : new e.Vector3(t.range(-1, 1), 0, t.range(-1, 1)), t.range(.72, 1.05) * (a ? 1.12 : 1), a || n.length < 24 && s > 2.5);
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
		let o = dr(!0), s = dr(!1), c = n.filter((e) => e.near), l = n.filter((e) => !e.near), u = (t, n, r, i) => {
			if (!t.length) return;
			let a = new e.InstancedMesh(n, this.bambooMat, t.length);
			for (let e = 0; e < t.length; e++) a.setMatrixAt(e, t[e].matrix), a.setColorAt(e, t[e].color);
			a.instanceMatrix.needsUpdate = !0, a.instanceColor && (a.instanceColor.needsUpdate = !0), a.castShadow = r, a.receiveShadow = !0, a.name = i, a.computeBoundingSphere(), this.group.add(a);
		};
		u(c, o, !0, "bamboo-near"), u(l, s, !1, "bamboo-far");
	}
	addShrubs() {
		let t = new H("lingyin-veg-shrubs"), n = [], r = [], i = 0;
		for (; r.length < 138 && i < 8e3;) {
			i++;
			let e = t.chance(.5) ? -1 : 1, n, a, o, s = r.length;
			s < 44 ? (n = e * t.range(8.25, 10.6), a = t.range(-2.3, 3.7), o = t.range(.8, 1.35)) : s < 86 ? (n = e * t.range(8.2, 12.6), a = t.range(3.9, 10.4), o = t.range(.7, 1.25)) : s < 112 ? (n = e * t.range(10.5, 14.5), a = t.range(-2, 10.5), o = t.range(.85, 1.45)) : s < 128 ? (n = e * t.range(5.4, 7.6), a = t.range(4.6, 9.8), o = t.range(.5, .9)) : (n = e * t.range(8.2, 11), a = t.range(-3.4, -1.8), o = t.range(.75, 1.2)), !this.isPlatform(n, a, .35) && (this.isPath(n, a, .45) || this.nearFramingTrunk(n, a, 1.5) || fn(n * .6 + 2, a * .6 - 8) < -.35 && t.chance(.5) || r.push({
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
		let a = new e.InstancedMesh(cr(), this.coreMat, n.length);
		for (let t = 0; t < n.length; t++) {
			let r = n[t];
			a.setMatrixAt(t, new e.Matrix4().compose(r.pos, r.quat, r.scale)), a.setColorAt(t, r.color);
		}
		a.instanceMatrix.needsUpdate = !0, a.instanceColor && (a.instanceColor.needsUpdate = !0), a.castShadow = !0, a.receiveShadow = !0, a.name = "shrub-cores", a.computeBoundingSphere(), this.group.add(a);
	}
	addUnderstory() {
		let t = new H("lingyin-veg-understory"), n = 0, r = 0;
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
		let t = new H("lingyin-veg-background"), n = [], r = [], i = [], a = (i, a, o, s, c) => {
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
		let c = new e.InstancedMesh(lr(), this.barkMat, n.length);
		for (let e = 0; e < n.length; e++) c.setMatrixAt(e, n[e].matrix), c.setColorAt(e, n[e].color);
		c.instanceMatrix.needsUpdate = !0, c.instanceColor && (c.instanceColor.needsUpdate = !0), c.castShadow = !1, c.receiveShadow = !0, c.name = "background-trunks", c.computeBoundingSphere(), this.group.add(c), this.addBlobInstances;
	}
	addCanopyCeiling() {
		let t = new H("lingyin-canopy-ceiling");
		for (let n = 0; n < 90; n++) {
			let n = t.range(-13, 13), r = t.range(1.5, 14), i = t.range(9.8, 12.8), a = new e.Vector3(n, i, r);
			this.addCanopyCard(t, a, t.range(1, 2));
		}
	}
	addBoundaryGrove() {
		let t = new H("lingyin-game-boundary-grove"), n = [];
		for (let e of [-22, 22]) for (let r = 7; r <= 34; r += 2.45) n.push({
			x: e + t.range(-.28, .28),
			z: r + t.range(-.35, .35),
			h: t.range(7.4, 11.2),
			r: t.range(.38, .58)
		});
		for (let e = -19.5; e <= 19.5; e += 2.45) n.push({
			x: e + t.range(-.35, .35),
			z: 34.5 + t.range(-.25, .28),
			h: t.range(7.8, 11.8),
			r: t.range(.4, .62)
		});
		let r = lr(), i = new e.InstancedMesh(r, this.barkMat, n.length), a = [];
		for (let [r, o] of n.entries()) {
			let n = t.range(0, Z);
			i.setMatrixAt(r, new e.Matrix4().compose(new e.Vector3(o.x, 0, o.z), new e.Quaternion().setFromEuler(new e.Euler(0, n, 0)), new e.Vector3(o.r, o.h, o.r))), i.setColorAt(r, new e.Color().setRGB(t.range(.58, .82), t.range(.55, .76), t.range(.5, .68)));
			let s = o.h * t.range(.72, .82);
			for (let n = 0; n < 2; n++) {
				let n = o.h * t.range(.2, .28);
				a.push({
					pos: new e.Vector3(o.x + t.range(-1.2, 1.2), s + t.range(-.6, 1.1), o.z + t.range(-1.1, 1.1)),
					quat: $(t),
					scale: new e.Vector3(n * t.range(.9, 1.25), n * t.range(.65, .9), n),
					color: new e.Color().setRGB(t.range(.38, .55), t.range(.58, .78), t.range(.3, .48))
				});
			}
			for (let n = 0; n < 7; n++) {
				let n = t.range(0, Z), r = t.range(.5, 2.3);
				this.addCanopyCard(t, new e.Vector3(o.x + Math.cos(n) * r, s + t.range(-1.1, 2), o.z + Math.sin(n) * r), t.range(2.5, 4));
			}
		}
		i.instanceMatrix.needsUpdate = !0, i.instanceColor && (i.instanceColor.needsUpdate = !0), i.castShadow = !0, i.receiveShadow = !0, i.name = "forecourt-boundary-trunks", i.computeBoundingSphere(), this.group.add(i), this.addBlobInstances(a, sr(1), !1, "forecourt-boundary-canopy");
	}
	addGroundDetails() {
		let t = new H("lingyin-veg-ground"), n = 0, r = 0;
		for (; n < 130 && r < 3e3;) {
			r++;
			let i = (t.chance(.5) ? -1 : 1) * t.range(3.35, 7.6), a = t.range(4, 13.5);
			if (this.isPlatform(i, a, 0)) continue;
			let o = t.range(.55, 1.15), s = t.range(.55, 1.15);
			this.pushCard("ground", "scatter", "fallen", new e.Vector3(i, t.range(.015, .04), a), new e.Quaternion().setFromEuler(new e.Euler(-Math.PI / 2 + t.range(-.12, .12), t.range(0, Z), 0, "YXZ")), new e.Vector3(o * t.range(.85, 1.2), o, o), new e.Color().setRGB(s, s * .94, s * .86)), n++;
		}
		let i = [];
		for (let n = 0; n < 46; n++) {
			let r, a;
			if (n < 14) r = -8.5 + t.range(-1.4, 1.4), a = 7 + t.range(-1.4, 1.4);
			else if (n < 26) r = 9.5 + t.range(-1.4, 1.4), a = 5.5 + t.range(-1.4, 1.4);
			else if (n < 34) r = -11 + t.range(-1.6, 1.6), a = -4 + t.range(-1.6, 1.6);
			else if (r = (t.chance(.5) ? -1 : 1) * t.range(8.2, 10.5), a = t.range(-3.4, 3.6), this.isPlatform(r, a, .05)) continue;
			let o = t.range(.22, .55);
			i.push({
				pos: new e.Vector3(r, .02, a),
				quat: $(t),
				scale: new e.Vector3(o * t.range(1.1, 1.7), o * .45, o * t.range(1.1, 1.7)),
				color: new e.Color().setRGB(t.range(1.1, 1.55), t.range(1.35, 1.9), t.range(.7, 1))
			});
		}
		let a = new e.InstancedMesh(sr(0), this.coreMat, i.length);
		for (let t = 0; t < i.length; t++) {
			let n = i[t];
			a.setMatrixAt(t, new e.Matrix4().compose(n.pos, n.quat, n.scale)), a.setColorAt(t, n.color);
		}
		a.instanceMatrix.needsUpdate = !0, a.instanceColor && (a.instanceColor.needsUpdate = !0), a.castShadow = !1, a.receiveShadow = !0, a.name = "moss-clumps", a.computeBoundingSphere(), this.group.add(a);
	}
	flushCards() {
		for (let t of this.buckets.values()) {
			if (!t.matrices.length) continue;
			let n = ir(t.cell, t.shape), r = new e.InstancedMesh(n, this.leafMat, t.matrices.length);
			for (let e = 0; e < t.matrices.length; e++) r.setMatrixAt(e, t.matrices[e]), r.setColorAt(e, t.colors[e]);
			r.instanceMatrix.needsUpdate = !0, r.instanceColor && (r.instanceColor.needsUpdate = !0);
			let i = t.layer === "canopy" || t.layer === "bamboo";
			r.castShadow = i, r.receiveShadow = !0, i && (r.customDepthMaterial = this.depthMat), r.name = `veg-cards-${t.layer}-${t.cell}`, r.computeBoundingSphere(), this.group.add(r);
		}
	}
}, hr = "\nattribute float aDepth;\nattribute float aFlow;\nvarying float vDepth;\nvarying float vFlow;\nvarying vec2 vUvW;\nvoid main(){\n  vDepth = aDepth;\n  vFlow = aFlow;\n  vUvW = uv;\n  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n}\n", gr = class {
	group = new e.Group();
	material;
	waterfall;
	fallMat;
	constructor() {
		this.group.name = "water", this.material = this.makeWaterMaterial();
		let n = [], r = pe, i = [], a = [], o = [], s = [], c = [], l = r.length, u = 0;
		for (let e = 0; e < l; e++) {
			let [t, n] = r[e], d = r[Math.max(0, e - 1)], f = r[Math.min(l - 1, e + 1)], m = f[0] - d[0], h = f[1] - d[1], g = Math.hypot(m, h) || 1;
			m /= g, h /= g;
			let _ = -h, v = m;
			e > 0 && (u += Math.hypot(t - r[e - 1][0], n - r[e - 1][1]));
			let y = e / (l - 1), b = ge(y) * .54, x = _e(y);
			for (let e of [-1, 1]) {
				let r = t + _ * b * e, c = n + v * b * e, l = x - O(r, c);
				i.push(r, x + .015, c), a.push(e < 0 ? 0 : 1, u / 4.5), o.push(p(l, 0, 4)), s.push(.7 + y * .6);
			}
			if (e < l - 1) {
				let t = e * 2;
				c.push(t, t + 2, t + 1, t + 1, t + 2, t + 3);
			}
		}
		let d = new e.BufferGeometry();
		d.setAttribute("position", new e.Float32BufferAttribute(i, 3)), d.setAttribute("uv", new e.Float32BufferAttribute(a, 2)), d.setAttribute("aDepth", new e.Float32BufferAttribute(o, 1)), d.setAttribute("aFlow", new e.Float32BufferAttribute(s, 1)), d.setIndex(c), d.computeVertexNormals(), n.push(d);
		let f = new e.CircleGeometry(E.pond.r, 64, 0, Math.PI * 2);
		f.rotateX(-Math.PI / 2);
		let m = f.getAttribute("position"), h = [], g = [];
		for (let e = 0; e < m.count; e++) {
			let t = m.getX(e) + E.pond.x, n = m.getZ(e) + E.pond.z;
			m.setX(e, t), m.setZ(e, n), m.setY(e, be), h.push(p(be - O(t, n), 0, 4)), g.push(.28);
		}
		f.setAttribute("aDepth", new e.Float32BufferAttribute(h, 1)), f.setAttribute("aFlow", new e.Float32BufferAttribute(g, 1)), f.computeVertexNormals(), n.push(f);
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
		return s({
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
			color: "\n        float d = clamp(vDepthW / 2.0, 0.0, 1.0);\n        vec3 deep = vec3(0.012, 0.034, 0.034);\n        vec3 shallow = vec3(0.10, 0.145, 0.115);\n        vec3 c = mix(shallow, deep, d);\n        float flow = uTime * (0.35 + vFlowW * 0.5);\n        float fn = cgNoise2(vec2(cgP.x * 1.7, cgP.z * 0.8 - flow));\n        fn *= cgNoise2(vec2(cgP.x * 4.2 + 7.0, cgP.z * 1.7 - flow * 1.6));\n        float edge = 1.0 - smoothstep(0.0, 0.28, vDepthW);\n        float foam = smoothstep(0.3, 0.62, fn + edge * 0.42) * (0.3 + edge * 1.2);\n        c = mix(c, vec3(0.78, 0.80, 0.76), clamp(foam, 0.0, 1.0) * 0.8);\n        diffuseColor.rgb = c;\n        diffuseColor.a = mix(0.78, 0.95, d) + foam * 0.2;\n      ",
			normal: "\n        float t = uTime;\n        vec2 p = cgP.xz;\n        float n1 = cgNoise2(p * 1.3 + vec2(0.0, -t * 0.5));\n        float n2 = cgNoise2(p * 2.7 + vec2(t * 0.35, -t * 0.8));\n        float n3 = cgNoise2(p * 6.1 + vec2(-t * 0.6, -t * 1.4));\n        cgBump = vec3((n1 - n2) * 0.10 + (n2 - n3) * 0.05, 0.0, (n2 - n1) * 0.10 + (n3 - n2) * 0.05);\n      ",
			roughness: "\n        roughnessFactor = mix(0.06, 0.22, smoothstep(0.0, 0.4, 1.0 - vDepthW));\n      "
		});
	}
	makeFallMaterial() {
		return new e.ShaderMaterial({
			uniforms: { uTime: n.time },
			vertexShader: hr,
			fragmentShader: "\n        uniform float uTime;\n        varying float vDepth;\n        varying float vFlow;\n        varying vec2 vUvW;\n        float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }\n        float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h12(i),h12(i+vec2(1,0)),f.x), mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),f.x), f.y); }\n        void main(){\n          float t = uTime;\n          float streak = n2(vec2(vUvW.x * 8.0, vUvW.y * 2.0 - t * 1.8));\n          streak *= n2(vec2(vUvW.x * 22.0 + 3.0, vUvW.y * 4.0 - t * 3.1));\n          float edge = smoothstep(0.0, 0.18, vUvW.x) * smoothstep(1.0, 0.82, vUvW.x);\n          float top = smoothstep(0.0, 0.08, vUvW.y);\n          float a = edge * top * (0.55 + streak * 0.65);\n          vec3 c = mix(vec3(0.55,0.68,0.68), vec3(0.95,0.97,0.94), streak);\n          gl_FragColor = vec4(c, clamp(a, 0.0, 0.9));\n        }\n      ",
			transparent: !0,
			depthWrite: !1,
			side: e.DoubleSide
		});
	}
	update(e) {
		this.fallMat.uniforms.uTime = n.time;
	}
}, _r = [
	{
		x: 84,
		z: -24,
		rx: 13,
		ry: 21,
		rz: 12,
		seed: 2.1,
		rot: .4
	},
	{
		x: 98,
		z: -40,
		rx: 10,
		ry: 17,
		rz: 10,
		seed: 5.7,
		rot: 1.2
	},
	{
		x: 66,
		z: -50,
		rx: 9,
		ry: 15,
		rz: 8,
		seed: 8.3,
		rot: -.6
	},
	{
		x: 106,
		z: -8,
		rx: 12,
		ry: 21,
		rz: 11,
		seed: 3.4,
		rot: 2
	},
	{
		x: 86,
		z: 6,
		rx: 7.5,
		ry: 11,
		rz: 7,
		seed: 9.1,
		rot: 1.7
	},
	{
		x: 62,
		z: -34,
		rx: 5.5,
		ry: 8,
		rz: 5,
		seed: 4.2,
		rot: .1
	}
];
function vr(t) {
	let n = new e.SphereGeometry(1, 52, 36), r = n.getAttribute("position"), i = new e.Vector3();
	for (let e = 0; e < r.count; e++) {
		i.set(r.getX(e), r.getY(e), r.getZ(e));
		let n = i.clone().normalize(), a = Math.atan2(n.z, n.x), o = C(n.x * 3.1 + t.seed, n.y * 2.3 + n.z * 1.7 - t.seed, 4), s = C(n.x * 9 - t.seed, n.y * 7 + n.z * 8 + t.seed, 3), c = Math.sin(a * 13 + o * 7) * .045 + Math.sin(a * 29 + s * 3) * .018, l = 1 - Math.abs(n.y) * .35, u = 1 + o * .16 + s * .055 + c * l, d = Math.max(0, n.y), f = i.x * t.rx * u, p = (i.y * t.ry * (1 - d * .08) + d * d * 1.2) * (1 + s * .04), m = i.z * t.rz * u;
		r.setXYZ(e, f, p, m);
	}
	return n.computeVertexNormals(), n.rotateY(t.rot), n.translate(t.x, O(t.x, t.z) - 1.8, t.z), n;
}
var yr = class {
	group = new e.Group();
	buddhaMaterial = ut();
	constructor() {
		this.group.name = "feilaifeng";
		let n = t(_r.map(vr), !1);
		if (!n) throw Error("crag merge failed");
		let r = new e.Mesh(n, gt());
		r.name = "crag-rock", r.castShadow = !0, r.receiveShadow = !0, this.group.add(r), this.buildNiches();
	}
	buildNiches() {
		let t = F(.4), n = this.buddhaMaterial, r = O(47, 3), i = new e.Group();
		i.position.set(47, r, 3), i.rotation.y = -.9, this.group.add(i);
		let a = (n) => {
			let r = new e.Mesh(n, t);
			return r.castShadow = !0, r.receiveShadow = !0, i.add(r), r;
		};
		a(new e.BoxGeometry(11, 9.5, 1.6).translate(0, 4.75, 0));
		let o = new e.Mesh(new e.BoxGeometry(4.6, 5.6, 1.9), new e.MeshStandardMaterial({
			color: 920843,
			roughness: 1
		}));
		o.position.set(0, 3.4, .55), i.add(o), a(new e.BoxGeometry(5.6, .45, 2.6).translate(0, 6.35, .5)), a(new e.BoxGeometry(.55, 5.5, 2.4).translate(-2.65, 3.35, .5)), a(new e.BoxGeometry(.55, 5.5, 2.4).translate(2.65, 3.35, .5));
		let s = new e.Group();
		s.position.set(0, .55, 1.25), s.scale.setScalar(.92);
		let c = (t) => {
			let r = new e.Mesh(t, n);
			return r.castShadow = !0, s.add(r), r;
		};
		c(new e.CylinderGeometry(1.35, 1.65, .5, 20).translate(0, .25, 0));
		for (let t = 0; t < 10; t++) {
			let n = t / 10 * Math.PI * 2, r = new e.SphereGeometry(.4, 8, 6);
			r.scale(1, .32, .6), r.rotateY(-n), r.translate(Math.cos(n) * 1.3, .52, Math.sin(n) * 1.3), c(r);
		}
		let l = new e.SphereGeometry(1.05, 20, 14);
		l.scale(1.32, .55, .85), c(l.translate(0, 1, 0));
		let u = new e.SphereGeometry(1, 20, 16);
		u.scale(.86, 1.15, .62), c(u.translate(0, 2.1, 0)), c(new e.SphereGeometry(.44, 20, 16).scale(1, 1.08, .95).translate(0, 3.22, .02));
		for (let t of [-1, 1]) {
			c(new e.CylinderGeometry(.075, .1, .42, 8).translate(t * .45, 3.16, 0));
			let n = new e.CylinderGeometry(.14, .18, 1.1, 8);
			n.rotateZ(t * .95), c(n.translate(t * .9, 1.95, .2));
		}
		c(new e.TorusGeometry(.9, .05, 8, 32).translate(0, 3.3, -.5)), i.add(s);
		for (let [t, r, o] of [[
			-6.8,
			2.4,
			.55
		], [
			6.6,
			1.8,
			.45
		]]) {
			a(new e.BoxGeometry(3 * o + 1.2, 3.6 * o + 1.2, 1.2).translate(t, r + 2.4 * o, -.3));
			let s = new e.Mesh(new e.BoxGeometry(3 * o, 3.6 * o, 1.4), new e.MeshStandardMaterial({
				color: 855050,
				roughness: 1
			}));
			s.position.set(t, r + 2.4 * o, 0), i.add(s);
			let c = new e.Group();
			c.position.set(t, r + .4, .35), c.scale.setScalar(o);
			let l = new e.Mesh(new e.SphereGeometry(1, 14, 12).scale(.8, 1.1, .6), n);
			l.position.y = 1.9, c.add(l);
			let u = new e.Mesh(new e.SphereGeometry(.42, 14, 12), n);
			u.position.y = 2.95, c.add(u), i.add(c);
		}
		for (let t = -5; t <= 5; t++) a(new e.BoxGeometry(.16, 1, .16).translate(t * 1.1, .5, 2.4));
		a(new e.BoxGeometry(12, .16, .2).translate(0, .95, 2.4)), a(new e.BoxGeometry(12, .16, .2).translate(0, .55, 2.4));
	}
};
//#endregion
//#region src/world/mist.ts
function br(t) {
	let n = document.createElement("canvas");
	n.width = 256, n.height = 256;
	let r = n.getContext("2d");
	if (!r) throw Error("no 2d");
	let i = new v(t), a = r.createRadialGradient(256 / 2, 256 / 2, 2, 256 / 2, 256 / 2, 256 / 2);
	a.addColorStop(0, "rgba(255,255,255,0.9)"), a.addColorStop(.35, "rgba(255,255,255,0.4)"), a.addColorStop(.7, "rgba(255,255,255,0.12)"), a.addColorStop(1, "rgba(255,255,255,0)"), r.fillStyle = a, r.fillRect(0, 0, 256, 256), r.globalCompositeOperation = "destination-out";
	for (let e = 0; e < 70; e++) {
		let e = i.range(36, 220), t = i.range(36, 220), n = i.range(8, 38), a = r.createRadialGradient(e, t, 0, e, t, n);
		a.addColorStop(0, `rgba(0,0,0,${i.range(.08, .24)})`), a.addColorStop(1, "rgba(0,0,0,0)"), r.fillStyle = a, r.beginPath(), r.arc(e, t, n, 0, Math.PI * 2), r.fill();
	}
	let o = new e.CanvasTexture(n);
	return o.colorSpace = e.SRGBColorSpace, o;
}
var xr = "\nattribute vec3 aPos;\nattribute vec2 aScale;\nattribute float aRot;\nattribute float aAlpha;\nvarying vec2 vUv;\nvarying float vAlpha;\n", Sr = `
${xr}
void main(){
  float c = cos(aRot), s = sin(aRot);
  vec2 p = mat2(c, -s, s, c) * position.xy;
  vec3 wp = aPos + vec3(p.x * aScale.x, 0.0, p.y * aScale.y);
  vUv = uv;
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`, Cr = `
${xr}
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
`, wr = "\nuniform sampler2D uMap;\nuniform vec3 uTint;\nvarying vec2 vUv;\nvarying float vAlpha;\nvoid main(){\n  float a = texture2D(uMap, vUv).a;\n  if (a < 0.002) discard;\n  gl_FragColor = vec4(uTint, a * vAlpha);\n}\n", Tr = class {
	group = new e.Group();
	tex = br("mist");
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
		let n = new v("mist");
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
		this.uniforms.uMap.value = this.tex, this.ground = this.makeLayer(this.banks.length, Sr), this.billboard = this.makeLayer(this.puffs.length, Cr);
		let r = new e.Mesh(this.ground.geo, new e.ShaderMaterial({
			uniforms: this.uniforms,
			vertexShader: Sr,
			fragmentShader: wr,
			transparent: !0,
			depthWrite: !1,
			side: e.DoubleSide
		}));
		r.frustumCulled = !1, r.renderOrder = 18, this.group.add(r);
		let i = new e.Mesh(this.billboard.geo, new e.ShaderMaterial({
			uniforms: this.uniforms,
			vertexShader: Cr,
			fragmentShader: wr,
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
export { n as ATMO, f as Backdrop, yr as Crag, Ut as Details, xn as ForestGate, mr as GateFramingTrees, Sn as GateGround, bt as HillsideTrail, Tr as Mist, d as Sky, xt as Temple, Ie as Terrain, Ht as Vegetation, E as WORLD, gr as Water, dt as buddhaMaterial, St as createMainHallInterior, O as heightAt, Nt as preloadFoliagePhotos, Ze as preloadTempleTextures, Pe as preloadTerrainTextures };
