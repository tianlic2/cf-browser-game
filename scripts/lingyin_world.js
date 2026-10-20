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
var T = [
	[
		[
			-2,
			47.2,
			.24
		],
		[
			-2,
			49,
			1.1
		],
		[
			-2,
			52,
			3
		],
		[
			-3,
			55,
			4.75
		],
		[
			-5,
			58,
			6.3
		],
		[
			-10,
			61,
			7.4
		],
		[
			-22,
			64,
			8.5
		],
		[
			-35,
			67,
			10.2
		],
		[
			-44,
			66,
			11.75
		],
		[
			-50,
			58,
			13.8
		],
		[
			-58,
			58,
			15.8
		],
		[
			-63,
			65,
			15.25
		],
		[
			-72,
			63,
			16.5
		],
		[
			-78,
			58,
			19
		],
		[
			-78,
			55,
			19.6
		],
		[
			-78,
			52,
			19.8
		],
		[
			-75,
			50,
			19.8
		]
	],
	[
		[
			-58,
			58,
			15.8
		],
		[
			-58,
			55,
			15.8
		],
		[
			-58,
			52,
			15.8
		],
		[
			-58,
			50,
			15.8
		]
	],
	[
		[
			-36.4,
			7,
			.95
		],
		[
			-40,
			7,
			1.4
		],
		[
			-44,
			8,
			2.6
		],
		[
			-47,
			12,
			4
		],
		[
			-47,
			18,
			5.3
		],
		[
			-44,
			22,
			6.2
		],
		[
			-47,
			27,
			8
		],
		[
			-49,
			33,
			10
		],
		[
			-49,
			40,
			11.5
		],
		[
			-37,
			46,
			11.8
		],
		[
			-37,
			57,
			12.4
		],
		[
			-50,
			58,
			13.8
		]
	]
], E = 2.45, D = E + .27, te = E + 1.45, ne = 7.2, O = .14, re = {
	x: -50,
	z: 58,
	radius: 4.5
}, k = [{
	x: -58,
	z: 49,
	hx: 4,
	hz: 2.5,
	y: 15.8,
	entryX: -58
}, {
	x: -75,
	z: 50,
	hx: 5,
	hz: 4.5,
	y: 19.8,
	entryX: -78
}];
function A(e, t = .9) {
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
function ie(e, t, n) {
	let r = Infinity;
	for (let i = 0; i < n.length - 1; i++) {
		let a = n[i], o = n[i + 1], s = o[0] - a[0], c = o[1] - a[1], l = Math.max(0, Math.min(1, ((e - a[0]) * s + (t - a[1]) * c) / (s * s + c * c)));
		r = Math.min(r, Math.hypot(e - a[0] - s * l, t - a[1] - c * l));
	}
	return r;
}
function ae(e, t = .9) {
	let n = A(T[e], t), r = [];
	n.at(-1).along;
	for (let t of [-1, 1]) {
		let i = [];
		for (let a = 0; a < n.length - 1; a++) {
			let o = n[a], s = n[a + 1], c = {
				x: o.x + o.nx * t * D,
				z: o.z + o.nz * t * D,
				y: o.y,
				along: o.along
			}, l = {
				x: s.x + s.nx * t * D,
				z: s.z + s.nz * t * D,
				y: s.y,
				along: s.along
			}, u = (c.x + l.x) / 2, d = (c.z + l.z) / 2, f = (c.along + l.along) / 2, p = e === 0 && f < 2.2 || e === 2 && f < 2.4, m = k.some((e) => Math.abs(u - e.x) < e.hx + .3 && Math.abs(d - e.z) < e.hz + .3), h = T.some((t, n) => n !== e && ie(u, d, t) < 2.6100000000000003);
			!p && !m && !h ? (i.length || i.push(c), i.push(l)) : i.length && (i.length > 1 && r.push({
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
function oe(e, t) {
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
function se(e, t) {
	let n = oe(e, t).distance;
	for (let r of k) n = Math.min(n, Math.hypot(Math.max(0, Math.abs(e - r.x) - r.hx), Math.max(0, Math.abs(t - r.z) - r.hz)));
	return n;
}
//#endregion
//#region src/world/heightfield.ts
var j = {
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
}, M = [
	[46, -120],
	[43, -82],
	[40, -48],
	[37, -16],
	[36, 10],
	[35, 28],
	[31, 44],
	[24, 56],
	[18, 66]
], ce = (() => {
	let e = [];
	for (let t = 0; t < M.length - 1; t++) {
		let n = M[t], r = M[t + 1];
		for (let t = 0; t < 12; t++) e.push([m(n[0], r[0], t / 12), m(n[1], r[1], t / 12)]);
	}
	return e.push(M[M.length - 1]), e;
})(), le = [
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
function ue(e, t) {
	let { d: n, t: r, i } = w(e, t, M);
	return {
		d: n,
		t: p((i + r) / (M.length - 1), 0, 1)
	};
}
function de(e) {
	return m(2.8, 7.2, e ** .7);
}
function fe(e) {
	return m(6.3, .55, p(e, 0, 1) ** .82);
}
function pe(e, t) {
	return Math.hypot(e - j.pond.x, t - j.pond.z) - j.pond.r;
}
function me(e, t) {
	let { d: n, t: r } = ue(e, t), i = n - de(r), a = pe(e, t);
	return Math.min(i, a);
}
var he = j.pond.y;
function ge(e, t, n, r, i, a, o) {
	let s = Math.max(n - e, e - i, 0), c = Math.max(r - t, t - a, 0);
	return h(0, o, Math.hypot(s, c));
}
function _e(e, t) {
	let n = 1.6;
	n += h(44, -110, t) * 5.5, n += 36 * g(e - 118, t + 44, 92), n += 30 * g(e + 118, t - 6, 104);
	let r = h(-40, -230, t), i = .55 + .45 * ee(e * .012 + 3.1, t * .012 - 1.7, 4);
	return n += r * 62 * i, n *= m(1, .55, h(55, 150, t)), n += 1.35 * C(e * .035, t * .035, 4), n += .38 * C(e * .16 + 4.2, t * .16 - 2.1, 3), n;
}
function N(e, t) {
	let n = _e(e, t), r = j.platform, i = ge(e, t, r.x0, r.z0, r.x1, r.z1, 13);
	n = m(r.y + .04 * C(e * .12, t * .12, 2), n, i), n += 6.5 * g(e - 78, t + 22, 26) * (.6 + .4 * C(e * .08, t * .08, 3));
	let a = w(e, t, le).d;
	if (a < 5 && me(e, t) > .8) {
		let e = h(.9, 4.5, a);
		n = m(Math.max(n, r.y - .7), n, e);
	}
	let { d: o, t: s } = ue(e, t), c = de(s), l = fe(s) - .85 - .25 * C(e * .2, t * .2, 2), u = h(c * .55, c * 1.9 + 2.5, o);
	n = m(Math.min(n, l), n, u);
	let d = pe(e, t);
	if (d < 12) {
		let r = j.pond.y - 1.5 - .8 * C(e * .09 + 8, t * .09 - 3, 3);
		n = m(Math.min(n, r), n, h(-2, 11, d));
	}
	let f = oe(e, t), p = Math.hypot(e - re.x, t - re.z), _ = 1 - h(te, ne, f.distance), v = 1 - h(re.radius, ne, p), y = Math.max(_, v);
	y > 0 && (n = m(n, j.platform.y + f.y, y));
	for (let r of k) {
		let i = Math.hypot(Math.max(0, Math.abs(e - r.x) - r.hx), Math.max(0, Math.abs(t - r.z) - r.hz)), a = i > 0 && f.distance < 4.9 && f.y < r.y - .8;
		i < 4 && !a && (n = m(j.platform.y + r.y, n, h(0, 4, i)));
	}
	return n;
}
function P(e, t, n) {
	let r = N(e, t), i = oe(e, t);
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
		let i = oe(e + n, t + r);
		i.distance < 2.6500000000000004 && (a = Math.min(a, j.platform.y + i.y));
	}
	if (!Number.isFinite(a)) return r;
	let o = p((E + n - i.distance) / n, 0, 1);
	return Math.max(r - .42 * o, Math.min(r, a - .06));
}
function ve(e, t, n = 260) {
	let r = j.size / n, i = j.size / 2, a = (e + i) / r, o = (t + i) / r, s = Math.floor(a), c = Math.floor(o), l = a - s, u = o - c, d = -i + s * r, f = -i + c * r, p = P(d, f, r), m = P(d + r, f, r), h = P(d, f + r, r), g = P(d + r, f + r, r);
	return l + u <= 1 ? p * (1 - l - u) + m * l + h * u : g * (l + u - 1) + m * (1 - u) + h * (1 - l);
}
function ye(e, t, n = 1.2) {
	let r = N(e + n, t) - N(e - n, t), i = N(e, t + n) - N(e, t - n), a = -r, o = 2 * n, s = -i, c = Math.hypot(a, o, s) || 1;
	return [
		a / c,
		o / c,
		s / c
	];
}
function be(e, t, n = 1.2) {
	return 1 - ye(e, t, n)[1];
}
function F(e, t, n = 0) {
	let r = j.platform;
	return e > r.x0 - n && e < r.x1 + n && t > r.z0 - n && t < r.z1 + n;
}
function xe(e, t) {
	return Math.min(w(e, t, le).d, se(e, t));
}
//#endregion
//#region src/world/terrain_baked.ts
function Se(e, t, n, r, i, a, o) {
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
	let d = Math.abs(e + 3) < 30 && Math.abs(n) < 44 && Math.abs(t - j.platform.y) < .55, f = .32 + b(Math.floor(e / 1.35), Math.floor(n / .78)) * .14;
	u([
		f,
		f * .99,
		f * .91
	], Math.max(+!!d, 1 - h(.15, .55, i)) * (1 - h(.5, .9, r)));
	let g = (1 - h(.43, .73, (C(e * .011 + 3.2, n * .011 + 3.2) + 1) * .5) * .21) * m(.62, 1, o);
	for (let e = 0; e < 3; e++) l[e] *= g;
	return l;
}
var I = null, L = null, Ce = null, we = null, Te = null;
function Ee() {
	if (Te) return Te;
	let t = new e.TextureLoader(), n = async (n, r) => {
		let i = new URL(`./assets/lingyin/temple-textures/${n}.jpg`, document.baseURI).href + "?v=1", a = await t.loadAsync(i);
		return a.name = `lingyin-${n}`, a.colorSpace = r ? e.SRGBColorSpace : e.NoColorSpace, a.wrapS = a.wrapT = e.RepeatWrapping, a.repeat.set(1 / 2.8, 1 / 2.8), a.minFilter = e.LinearMipmapLinearFilter, a.magFilter = e.LinearFilter, a.anisotropy = 8, a;
	};
	return Te = Promise.all([n("forest-ground-albedo", !0), n("forest-ground-normal", !1)]).then(([e, t]) => {
		Ce = e, we = t;
	}), Te;
}
function De() {
	if (Ce && we) return new e.MeshStandardMaterial({
		name: "terrain-scanned-forest-floor",
		map: Ce,
		normalMap: we,
		normalScale: new e.Vector2(.29, .29),
		color: new e.Color().setRGB(1.38, 1.38, 1.38),
		vertexColors: !0,
		roughness: .97,
		metalness: 0
	});
	if (!I) {
		let t = document.createElement("canvas");
		t.width = t.height = 512;
		let n = t.getContext("2d"), r = n.createImageData(512, 512), i = new Float32Array(512 * 512);
		for (let e = 0; e < 512; e++) for (let t = 0; t < 512; t++) {
			let n = C(t * .035, e * .035, 3), a = b(t, e) - .5, o = p(.91 + n * .075 + a * .065, .77, 1);
			i[e * 512 + t] = o;
			let s = (e * 512 + t) * 4;
			r.data[s] = Math.round(o * 255), r.data[s + 1] = Math.round(o * 253), r.data[s + 2] = Math.round(o * 247), r.data[s + 3] = 255;
		}
		n.putImageData(r, 0, 0), I = new e.CanvasTexture(t), I.name = "terrain-baked-grain", I.colorSpace = e.SRGBColorSpace, I.wrapS = I.wrapT = e.RepeatWrapping, I.repeat.set(1 / 3, 1 / 3), I.minFilter = e.LinearMipmapLinearFilter, I.magFilter = e.LinearFilter, I.anisotropy = 8;
		let a = document.createElement("canvas");
		a.width = a.height = 512;
		let o = a.getContext("2d"), s = o.createImageData(512, 512), c = (e, t) => i[(t + 512 & 511) * 512 + (e + 512 & 511)];
		for (let e = 0; e < 512; e++) for (let t = 0; t < 512; t++) {
			let n = (c(t + 1, e) - c(t - 1, e)) * 1.9, r = (c(t, e + 1) - c(t, e - 1)) * 1.9, i = 1 / Math.hypot(n, r, 1), a = (e * 512 + t) * 4;
			s.data[a] = Math.round((-.5 * n * i + .5) * 255), s.data[a + 1] = Math.round((-.5 * r * i + .5) * 255), s.data[a + 2] = Math.round((.5 * i + .5) * 255), s.data[a + 3] = 255;
		}
		o.putImageData(s, 0, 0), L = new e.CanvasTexture(a), L.name = "terrain-baked-normal", L.wrapS = L.wrapT = e.RepeatWrapping, L.repeat.copy(I.repeat), L.minFilter = e.LinearMipmapLinearFilter, L.magFilter = e.LinearFilter, L.anisotropy = 8;
	}
	return new e.MeshStandardMaterial({
		name: "terrain-baked-pbr",
		map: I,
		normalMap: L,
		normalScale: new e.Vector2(.7, .7),
		vertexColors: !0,
		roughness: .91,
		metalness: 0
	});
}
//#endregion
//#region src/world/terrain.ts
var Oe = class {
	group = new e.Group();
	mesh;
	material;
	constructor(t = 1) {
		let n = j.size, r = Math.round(260 * p(t, .5, 1)), i = n / 2, a = r + 1, o = new Float32Array(a * a * 3), s = new Float32Array(a * a * 2), c = new Float32Array(a * a * 3), l = [], u = n / r;
		for (let e = 0; e < a; e++) {
			let t = -i + e * u;
			for (let n = 0; n < a; n++) {
				let r = -i + n * u, l = P(r, t, u), d = e * a + n;
				o[d * 3] = r, o[d * 3 + 1] = l, o[d * 3 + 2] = t, s[d * 2] = r, s[d * 2 + 1] = t;
				let f = 1 - ye(r, t, 1.4)[1], m = 0;
				m += N(r + 3, t), m += N(r - 3, t), m += N(r, t + 3), m += N(r, t - 3);
				let h = p((m / 4 - l) / 3.5, -.4, 1), g = Se(r, l, t, f, p(xe(r, t) / 6, 0, 1), p(me(r, t), -4, 18), p(.35 + f * .9 - h * .55, 0, 1));
				c[d * 3] = g[0], c[d * 3 + 1] = g[1], c[d * 3 + 2] = g[2];
			}
		}
		for (let e = 0; e < r; e++) for (let t = 0; t < r; t++) {
			let n = e * a + t, r = n + 1, i = n + a, o = i + 1;
			l.push(n, i, r, r, i, o);
		}
		let d = new e.BufferGeometry();
		d.setAttribute("position", new e.BufferAttribute(o, 3)), d.setAttribute("uv", new e.BufferAttribute(s, 2)), d.setAttribute("color", new e.BufferAttribute(c, 3)), d.setIndex(l), d.computeVertexNormals(), d.computeBoundingSphere(), this.material = De(), this.mesh = new e.Mesh(d, this.material), this.mesh.name = "terrain", this.mesh.receiveShadow = !0, this.mesh.castShadow = !1, this.group.add(this.mesh);
	}
};
//#endregion
//#region src/world/geom.ts
function ke(t) {
	if (!t.getAttribute("uv")) {
		let n = t.getAttribute("position").count;
		t.setAttribute("uv", new e.BufferAttribute(new Float32Array(n * 2), 2));
	}
	return t;
}
function R(t, n, r, i = 0, a = 0, o = 0, s = 0) {
	let c = new e.BoxGeometry(t, n, r);
	return s && c.rotateY(s), c.translate(i, a, o), ke(c);
}
function z(t, n, r, i, a = 0, o = 0, s = 0) {
	let c = new e.CylinderGeometry(t, n, r, i, 1, !1);
	return c.translate(a, o, s), ke(c);
}
function B(e) {
	let n = e.filter((e) => e && e.getAttribute("position")?.count), r = n.every((e) => e.index !== null), i = t(n.map((e) => ke(r ? e : e.index ? e.toNonIndexed() : e)), !1);
	if (!i) throw Error("merge failed");
	return i.computeBoundingSphere(), i;
}
function V(t, n) {
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
function Ae(t) {
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
function je(t) {
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
function Me(t, n, r, i, a) {
	let o = new e.Shape();
	o.moveTo(-t / 2, 0), o.lineTo(t / 2, 0), o.lineTo(t / 2, n), o.lineTo(-t / 2, n), o.lineTo(-t / 2, 0);
	let s = new e.Path();
	s.moveTo(-i, .2), s.lineTo(-i, a), s.absarc(0, a, i, Math.PI, 0, !0), s.lineTo(i, .2), s.lineTo(-i, .2), o.holes.push(s);
	let c = new e.ExtrudeGeometry(o, {
		depth: r,
		bevelEnabled: !1,
		curveSegments: 16
	});
	return c.translate(0, 0, -r / 2), ke(c);
}
function Ne(e, t, n = .19, r = .055, i = 0) {
	let a = [];
	for (let o = -e / 2; o <= e / 2 + .001; o += n) a.push(R(r, t, .06, o, t / 2, i));
	for (let o = 0; o <= t + .001; o += n * 1.35) a.push(R(e, r, .055, 0, o, i));
	return {
		bars: B(a),
		backing: R(e, t, .04, 0, t / 2, i - .06)
	};
}
function Pe(t, n = 512, r = 160, i = {}) {
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
var Fe = null, H = null, U = null, W = null, G = {}, K = null;
function Ie() {
	if (K) return K;
	let t = [
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
	], n = new e.TextureLoader();
	return K = Promise.all(t.map(async (t) => {
		let r = new URL(`./assets/lingyin/temple-textures/${t}.webp`, document.baseURI).href + "?v=3", i = await n.loadAsync(r);
		i.name = `lingyin-${t}`, i.colorSpace = t.endsWith("albedo") || t.startsWith("plaque-") ? e.SRGBColorSpace : e.NoColorSpace, i.wrapS = i.wrapT = t.startsWith("plaque-") ? e.ClampToEdgeWrapping : e.RepeatWrapping, i.minFilter = e.LinearMipmapLinearFilter, i.magFilter = e.LinearFilter, i.anisotropy = 8, G[t] = i;
	})).then(() => {}), K;
}
function Le(e) {
	return G[`plaque-${e}`];
}
var Re = null;
function ze() {
	if (Re) return Re;
	let t = G["courtyard-albedo"], n = G["courtyard-normal"], r = G["courtyard-roughness"];
	if (!t || !n || !r) throw Error("Lingyin courtyard maps must be preloaded");
	for (let e of [
		t,
		n,
		r
	]) e.repeat.set(48 / 5.1, 32 / 5.1);
	return Re = new e.MeshStandardMaterial({
		name: "courtyard-photogrammetry",
		map: t,
		normalMap: n,
		roughnessMap: r,
		normalScale: new e.Vector2(.34, .34),
		roughness: 1,
		metalness: 0
	}), Re;
}
function Be(t, n, r, i, a, o) {
	let s = G[n];
	return s ? new e.MeshStandardMaterial({
		name: t,
		map: s,
		normalMap: G[r],
		normalScale: new e.Vector2(o, o),
		roughnessMap: G[i],
		roughness: a,
		metalness: 0
	}) : null;
}
function Ve() {
	if (U) return U;
	let t = document.createElement("canvas");
	t.width = t.height = 256;
	let n = t.getContext("2d"), r = n.createImageData(256, 256), i = 1919509349, a = () => ((i = Math.imul(i, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
	for (let e = 0; e < 256; e++) for (let t = 0; t < 256; t++) {
		let n = Math.sin(t * .36 + e * .015) * .012, i = Math.max(.78, Math.min(.96, .88 + (a() - .5) * .065 + n)), o = (e * 256 + t) * 4;
		r.data[o] = Math.round(i * 255), r.data[o + 1] = Math.round(i * 248), r.data[o + 2] = Math.round(i * 230), r.data[o + 3] = 255;
	}
	return n.putImageData(r, 0, 0), U = new e.CanvasTexture(t), U.colorSpace = e.SRGBColorSpace, U.minFilter = e.LinearMipmapLinearFilter, U.magFilter = e.LinearFilter, U.anisotropy = 8, U;
}
function He() {
	if (H) return H;
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
	return n.putImageData(r, 0, 0), H = new e.CanvasTexture(t), H.colorSpace = e.SRGBColorSpace, H.wrapS = H.wrapT = e.RepeatWrapping, H.minFilter = e.LinearMipmapLinearFilter, H.magFilter = e.LinearFilter, H.anisotropy = 8, H;
}
function Ue() {
	if (Fe) return Fe;
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
	return d.colorSpace = e.SRGBColorSpace, d.wrapS = d.wrapT = e.RepeatWrapping, d.minFilter = e.LinearMipmapLinearFilter, d.magFilter = e.LinearFilter, d.anisotropy = 8, Fe = new e.MeshStandardMaterial({
		name: "weathered-stone-slabs",
		map: d,
		bumpMap: d,
		bumpScale: .048,
		roughness: .94,
		metalness: 0,
		vertexColors: !0
	}), Fe;
}
function We(t, n) {
	let r = t.getAttribute("position").count, i = new Float32Array(r * 3);
	for (let e = 0; e < r; e++) {
		let t = n * (.96 + e % 3 * .04);
		i[e * 3] = t, i[e * 3 + 1] = t * .992, i[e * 3 + 2] = t * .978;
	}
	return t.setAttribute("color", new e.BufferAttribute(i, 3)), t;
}
function q(e = 0) {
	let t = Be("stone-photogrammetry", "stone-albedo", "stone-normal", "stone-roughness", .98, .23);
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
function Ge() {
	let t = G["roof-albedo"], n = G["roof-normal"];
	if (t && n) return t.repeat.set(1 / 5, 1 / 5), n.repeat.set(1 / 5, 1 / 5), new e.MeshStandardMaterial({
		name: "roof-tile-photogrammetry",
		map: t,
		normalMap: n,
		normalScale: new e.Vector2(.28, .28),
		roughness: .86,
		metalness: .02,
		side: e.DoubleSide
	});
	if (!W) {
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
		n.putImageData(r, 0, 0), W = new e.CanvasTexture(t), W.name = "baked-weathered-roof-tiles", W.colorSpace = e.SRGBColorSpace, W.wrapS = W.wrapT = e.RepeatWrapping, W.repeat.set(1 / (12 * .34), 1 / (8 * .52)), W.minFilter = e.LinearMipmapLinearFilter, W.magFilter = e.LinearFilter, W.anisotropy = 8;
	}
	return new e.MeshStandardMaterial({
		name: "roof-tile-baked",
		map: W,
		bumpMap: W,
		bumpScale: .045,
		roughness: .82,
		metalness: .02,
		side: e.DoubleSide
	});
}
function Ke() {
	let e = Be("plaster-photogrammetry", "plaster-albedo", "plaster-normal", "plaster-roughness", .98, .18);
	if (e) return e;
	let t = He();
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
function J(e = !1) {
	return Be(e ? "aged-wood" : "red-lacquer-wood", e ? "wood-albedo" : "wood-red-albedo", "wood-normal", "wood-roughness", .82, .16) || s({
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
function qe() {
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
function Je() {
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
function Ye() {
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
function Xe() {
	return Be("teal-painted-wood", "wood-teal-albedo", "wood-normal", "wood-roughness", .9, .12) || s({
		name: "dougong",
		params: {
			color: 16777215,
			roughness: .6,
			metalness: .02
		},
		color: "\n      float n = cgNoise2(cgP.xz * 5.0 + cgP.y * 2.0);\n      vec3 teal = mix(vec3(0.035,0.095,0.085), vec3(0.09,0.17,0.145), n);\n      float gold = smoothstep(0.75, 0.95, cgNoise2(cgP.xz * 9.0));\n      vec3 c = mix(teal, vec3(0.55,0.40,0.16), gold * 0.55);\n      diffuseColor.rgb = c;\n    "
	});
}
function Ze() {
	return new e.MeshStandardMaterial({
		color: new e.Color("#2a1a0c"),
		emissive: new e.Color("#8a4a1e"),
		emissiveIntensity: .03,
		roughness: .9
	});
}
function Qe() {
	return new e.MeshStandardMaterial({
		color: new e.Color("#7e1e18"),
		emissive: new e.Color("#ff5a2a"),
		emissiveIntensity: .3,
		roughness: .7
	});
}
function $e() {
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
var et = j.platform.y, Y = (t, n, r) => new e.Vector3(t, n, r);
function tt(t, n, r = .16, i = .14) {
	let a = n.clone().sub(t), o = new e.BoxGeometry(r, i, a.length());
	return o.applyQuaternion(new e.Quaternion().setFromUnitVectors(Y(0, 0, 1), a.clone().normalize())), o.translate((t.x + n.x) / 2, (t.y + n.y) / 2, (t.z + n.z) / 2), o;
}
var nt = class {
	group = new e.Group();
	constructor() {
		this.group.name = "hillside-pilgrimage-trail";
		let t = q(.3), n = J(!0), r = [], i = [], a = [], o = [], s = [], c = (e, t) => Math.max(N(e, t) + O, ve(e, t) + .055);
		for (let e of T) {
			let t = A(e), n = r.length / 3;
			for (let [e, o] of t.entries()) {
				for (let e of [
					-1,
					0,
					1
				]) {
					let t = o.x + o.nx * E * e, n = o.z + o.nz * E * e;
					r.push(t, c(t, n), n), i.push(o.along / 2.2, (e + 1) * 1.1);
				}
				if (e < t.length - 1) {
					let t = n + e * 3;
					a.push(t, t + 1, t + 3, t + 1, t + 4, t + 3, t + 1, t + 2, t + 4, t + 2, t + 5, t + 4);
				}
			}
		}
		for (let t = 0; t < T.length; t++) for (let n of ae(t)) {
			let t = -Infinity;
			for (let [r, i] of n.points.entries()) {
				let a = Y(i.x, et + i.y, i.z);
				if (r === 0 || r === n.points.length - 1 || i.along - t >= 2.25) {
					let n = new e.BoxGeometry(.2, 1.76, .2);
					n.translate(a.x, a.y + .7, a.z), o.push(n);
					let r = new e.BoxGeometry(.36, .28, .36);
					r.translate(a.x, a.y - .05, a.z), s.push(r), t = i.along;
				}
				if (r > 0) {
					let e = n.points[r - 1], t = Y(e.x, et + e.y, e.z);
					s.push(tt(t.clone().add(Y(0, -.055, 0)), a.clone().add(Y(0, -.055, 0)), .31, .18));
					for (let e of [1.03, 1.45]) o.push(tt(t.clone().add(Y(0, e, 0)), a.clone().add(Y(0, e, 0))));
				}
			}
		}
		let l = new e.BufferGeometry();
		l.setAttribute("position", new e.Float32BufferAttribute(r, 3)), l.setAttribute("uv", new e.Float32BufferAttribute(i, 2)), l.setIndex(a), l.computeVertexNormals();
		let u = new e.Mesh(l, t);
		u.name = "graded-mountain-stone-path", u.receiveShadow = !0, this.group.add(u);
		for (let [r, i] of k.entries()) {
			let a = et + i.y, o = new e.Mesh(new e.BoxGeometry(i.hx * 2, .18, i.hz * 2), t);
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
			};
			l(i.x - i.hx, i.z, .34, i.hz * 2), l(i.x + i.hx, i.z, .34, i.hz * 2), l(i.x, i.z - i.hz, i.hx * 2, .34);
			let u = i.z + i.hz, d = i.x - i.hx, f = i.x + i.hx, p = Math.max(d, i.entryX - 1.5), m = Math.min(f, i.entryX + 1.5);
			p - d > .2 && l((d + p) / 2, u, p - d, .34), f - m > .2 && l((m + f) / 2, u, f - m, .34);
			let h = new e.Mesh(B(s), t);
			h.castShadow = !0, h.receiveShadow = !0, h.name = `overlook-stone-parapet-${r + 1}`, this.group.add(h);
			let g = new e.Mesh(B(c), n);
			g.castShadow = !0, g.name = `overlook-open-rail-${r + 1}`, this.group.add(g);
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
			let t = new e.Mesh(B(i), a);
			t.name = r, t.castShadow = !0, t.receiveShadow = !0, this.group.add(t);
		}
		let d = new e.Mesh(new e.BoxGeometry(.16, 2.25, .16), n);
		d.position.set(3.35, N(3.35, 47) + 1.125, 47), d.castShadow = !0, this.group.add(d);
		let f = new e.Mesh(new e.PlaneGeometry(1.65, .5), new e.MeshStandardMaterial({
			map: Pe("登山道", 512, 160, {
				bg: "#302923",
				fg: "#d4b674",
				border: "#8f7755"
			}),
			side: e.DoubleSide,
			roughness: .9
		}));
		f.rotation.y = Math.PI, f.position.set(3.35, N(3.35, 47) + 2.02, 46.9), this.group.add(f);
	}
}, rt = class {
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
		wood: [],
		woodDark: [],
		dougong: [],
		roof: [],
		gold: [],
		bronze: [],
		lattice: [],
		lantern: [],
		dark: [],
		window: []
	};
	constructor() {
		this.group.name = "temple";
		let t = j.platform.y;
		this.materials = {
			stone: q(.2),
			floor: Ue(),
			wall: Ke(),
			paper: new e.MeshStandardMaterial({
				color: 12958628,
				map: Ve(),
				bumpMap: Ve(),
				bumpScale: .009,
				roughness: .96,
				metalness: 0,
				side: e.DoubleSide
			}),
			wood: J(!1),
			woodDark: J(!0),
			dougong: Xe(),
			roof: Ge(),
			gold: qe(),
			bronze: Ye(),
			lattice: J(!0),
			lantern: Qe(),
			window: Ze(),
			dark: new e.MeshStandardMaterial({
				color: 1183500,
				roughness: 1
			})
		}, this.buildPlatform(t), this.buildHall({
			x: -2,
			z: 40,
			w: 15,
			d: 8.5,
			eave: 5.4,
			rise: 2.9,
			plinth: .8,
			name: "gate",
			openFront: !0,
			plaque: "靈隱寺"
		}), this.buildHall({
			x: -2,
			z: -12,
			w: 27,
			d: 17,
			eave: 8,
			rise: 5,
			plinth: 1.1,
			double: !0,
			name: "main",
			plaque: "大雄寶殿"
		}), this.buildHall({
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
		}), this.buildPagoda(-31, 33, t), this.buildEnclosure(t), this.buildBuddha(t), this.finalize();
	}
	add(e, t) {
		this.roles[e].push(t);
	}
	addAt(e, t, n, r, i, a = 0) {
		a && t.rotateY(a), t.translate(n, r, i), this.roles[e].push(t);
	}
	buildPlatform(e) {
		let t = j.platform;
		this.add("stone", R(2.2, .5, 1, t.x0, e - .05, 0, 0)), this.add("stone", R(2.2, .5, 1, t.x1, e - .05, 0, 0)), this.add("stone", R(t.x1 - t.x0 + 2.2, .5, 1.2, (t.x0 + t.x1) / 2, e - .05, t.z1)), this.add("stone", R(t.x1 - t.x0 + 2.2, .5, 1.2, (t.x0 + t.x1) / 2, e - .05, t.z0));
		for (let n = 0; n < 6; n++) this.add("stone", R(9 - n * .25, .19, .5, -2, e - .2 - n * .19, t.z1 + .6 + n * .48));
		for (let n = 0; n < 5; n++) this.add("stone", R(.55, .2, 5.2, t.x1 + .4 + n * .5, e - .2 - n * .2, 28));
		for (let n of [-1, 1]) {
			let r = n < 0 ? t.x0 + 1 : 6, i = n < 0 ? -8 : t.x1 - 1;
			this.balustrade(r, i, t.z1 - .3, e + .1, "x");
		}
		this.balustrade(-8, -5, t.z1 - .3, e + .1, "x"), this.balustrade(1, 6, t.z1 - .3, e + .1, "x");
		for (let n of [-5, 1]) this.add("stone", R(.55, 1.22, .55, n, e + .62, t.z1 - .3));
	}
	balustrade(e, t, n, r, i, a = !1) {
		let o = Math.abs(t - e);
		if (o < 1) return;
		let s = Math.max(2, Math.round(o / 2.4));
		for (let a = 0; a <= s; a++) {
			let c = a / s, l = e + (t - e) * c, u = i === "x" ? l : n, d = i === "x" ? n : l;
			if (this.add("stone", R(.24, .95, .24, u, r + .475, d)), this.add("stone", R(.34, .12, .34, u, r + .98, d)), a < s) {
				let c = (a + .5) / s, l = e + (t - e) * c, u = i === "x" ? l : n, d = i === "x" ? n : l, f = i === "x" ? o / s : .14, p = i === "x" ? .14 : o / s;
				this.add("stone", R(f, .16, p, u, r + .74, d));
			}
		}
	}
	buildHall(t) {
		let n = t.eave - t.plinth, r = t.w / 2, i = t.d / 2, a = {
			stone: [],
			floor: [],
			wall: [],
			paper: [],
			wood: [],
			woodDark: [],
			dougong: [],
			roof: [],
			gold: [],
			bronze: [],
			lattice: [],
			lantern: [],
			dark: [],
			window: []
		}, o = (e, t) => a[e].push(t);
		o("stone", R(t.w + 2.4, t.plinth + .25, t.d + 2.4, 0, (t.plinth + .25) / 2, 0)), o("stone", R(t.w + 2.9, .16, t.d + 2.9, 0, .1, 0));
		for (let e = 0; e < 5; e++) o("stone", R(5, .16, .42, 0, .16 + e * .16, i + 1.35 + (4 - e) * .4 + (t.plinth - .8) * .25)), t.name === "gate" && o("stone", R(5, .16, .42, 0, .16 + e * .16, -i - 1.35 - (4 - e) * .4));
		let s = Math.max(3, Math.round(t.w / 3.4)), c = Math.max(2, Math.round(t.d / 3.6)), l = n - .35;
		for (let e of [-1, 1]) for (let n = 0; n <= s; n++) {
			let o = -r + 1 + (t.w - 2) * n / s;
			t.name === "main" && e === 1 && Math.abs(o) < 1.6 || t.name === "gate" && Math.abs(o) < 1 || this.column(a, o, .25, e * (i - .9), l);
		}
		for (let e of [-1, 1]) for (let n = 1; n < c; n++) {
			let o = -i + 1 + (t.d - 2) * n / c;
			this.column(a, e * (r - .9), .25, o, l);
		}
		let u = l - .4, d = .3, f = .25 + u / 2, p = 1.35, m = (e, n, r, i) => o("stone", R(e + .04, .22, n + .085, r, t.plinth + .3, i));
		if (t.openFront) o("wall", R(2.4, u, d, -r + 1 + 1.2, f, i - p)), o("wall", R(2.4, u, d, r - 1 - 1.2, f, i - p)), m(2.4, d, -r + 2.2, i - p), m(2.4, d, r - 2.2, i - p);
		else {
			let e = t.name === "main" ? 5.4 : t.name === "rear" ? 4.6 : 3.4, n = (t.w - p * 2 - e) / 2;
			o("wall", R(n, u, d, -(e / 2 + n / 2), f, i - p)), o("wall", R(n, u, d, e / 2 + n / 2, f, i - p)), m(n, d, -(e / 2 + n / 2), i - p), m(n, d, e / 2 + n / 2, i - p), o("wood", R(e + .3, .35, d + .1, 0, .25 + u, i - p));
		}
		if (t.openFront || t.name === "west") {
			let e = t.name === "west" ? 3.4 : 4.6, n = (t.w - p * 2 - e) / 2;
			for (let t of [-1, 1]) o("wall", R(n, u, d, t * (e / 2 + n / 2), f, -i + p));
			for (let t of [-1, 1]) m(n, d, t * (e / 2 + n / 2), -i + p);
			o("wood", R(e + .3, .35, .42, 0, .25 + u, -i + p));
		} else o("wall", R(t.w - p * 2, u, d, 0, f, -i + p)), m(t.w - p * 2, d, 0, -i + p);
		for (let e of [-1, 1]) {
			o("wall", R(d, u, t.d - p * 2, e * (r - p), f, 0)), m(d, t.d - p * 2, e * (r - p), 0);
			let n = Math.min(1.7, u * .5), i = Ne(Math.min(3.4, t.d * .32), n, .22, .05, .02);
			i.bars.rotateY(e * Math.PI / 2), i.backing.rotateY(e * Math.PI / 2), i.bars.translate(e * (r - p + .18), f + .15, 0), i.backing.translate(e * (r - p + .1), f + .15, 0), o("lattice", i.bars), o("window", i.backing);
		}
		if (!t.openFront) {
			let n = t.w > 20 ? 5 : 3, a = (t.w - 2.2) / n, s = Math.floor(n / 2), c = Array.from({ length: n }, (e, t) => t);
			for (let t of c) {
				let n = -r + 1.1 + a * (t + .5), c = a - .35, l = Math.min(u - .55, 3.5);
				if (t === s) {
					o("gold", R(.16, l, .2, n - c / 2 - .1, .25 + l / 2, i - p + .2)), o("gold", R(.16, l, .2, n + c / 2 + .1, .25 + l / 2, i - p + .2)), o("gold", R(c + .2, .18, .2, n, .25 + l + .12, i - p + .2));
					continue;
				}
				let d = Ne(c, l, .17, .055, i - p + .18);
				d.bars.translate(n, 0, 0), d.backing.translate(n, 0, 0), o("lattice", d.bars), o("woodDark", d.backing), o("wood", R(c + .18, .16, .24, n, .25 + l + .1, i - p + .18)), o("wood", R(.16, l + .2, .24, n - c / 2 - .09, .25 + l / 2, i - p + .18)), o("wood", R(.16, l + .2, .24, n + c / 2 + .09, .25 + l / 2, i - p + .18)), o("woodDark", R(c, l * .34, .1, n, .25 + l * .17, i - p + .1));
				for (let t = -2; t <= 2; t++) for (let r = 0; r < 2; r++) o("gold", new e.SphereGeometry(.035, 6, 4).translate(n + t * .62, 1 + r * .32, i - p + .06));
			}
		}
		if (t.name === "main") {
			let e = .45, n = t.w / 2 + 1.2, r = t.d / 2 + 1.45;
			for (let t = 0; t <= 14; t++) {
				let i = -n + 2 * n * t / 14;
				Math.abs(i) < 3.6 || (o("stone", R(.24, .9, .24, i, e + .45, r)), o("stone", R(.26, .1, .26, i, e + .92, r)));
			}
			for (let t = 0; t <= 10; t++) {
				let i = -r + 2 * r * t / 10;
				for (let t of [-1, 1]) o("stone", R(.24, .9, .24, t * n, e + .45, i)), o("stone", R(.26, .1, .26, t * n, e + .92, i));
			}
			for (let t of [-1, 1]) o("stone", R(.16, .16, 2 * r, t * n, e + .8, 0));
			for (let t of [-1, 1]) o("stone", R(n - 3.6, .16, .16, t * (n + 3.6) / 2, e + .8, r));
		}
		let h = t.w - p * 2 - .55, g = t.d - p * 2 - .55, _ = t.plinth + .25, v = 1.35, y = Math.floor(h / v), b = Math.floor(g / v);
		for (let e = 0; e < b; e++) for (let t = 0; t < y; t++) {
			let n = -h / 2 + (t + .5) * h / y, r = -g / 2 + (e + .5) * g / b, i = (t * 11 + e * 7) % 7 * .002;
			o("floor", We(R(h / y - .018, .045, g / b - .018, n, _ + .005 + i, r), .82 + (t * 13 + e * 7) % 11 * .022));
		}
		for (let e of [-1, 1]) {
			o("woodDark", R(.11, .44, g, e * h / 2, _ + .22, 0)), o("bronze", R(.025, .035, g, e * h / 2, _ + .45, 0));
			for (let t of [-g * .24, g * .24]) {
				let n = Ne(Math.min(2.5, g * .32), 2.1, .26, .055, 0);
				n.bars.rotateY(Math.PI / 2), n.backing.rotateY(Math.PI / 2), n.bars.translate(e * (r - p - .23), _ + .77, t), n.backing.translate(e * (r - p - .27), _ + .77, t), o("lattice", n.bars), o("paper", n.backing);
			}
		}
		for (let e of [-g / 2, g / 2]) if (e > 0 || t.name === "gate" || t.name === "west") {
			let n = t.name === "main" ? 5.4 : t.name === "rear" || t.name === "gate" ? 4.6 : 3.4, r = (h - n) / 2;
			for (let t of [-1, 1]) {
				let i = t * (n / 2 + r / 2);
				o("woodDark", R(r, .44, .11, i, _ + .22, e)), o("bronze", R(r, .035, .025, i, _ + .45, e));
			}
		} else o("woodDark", R(h, .44, .11, 0, _ + .22, e)), o("bronze", R(h, .035, .025, 0, _ + .45, e));
		let x = Math.max(_ + 2.9, n - .35);
		for (let e = 0; e < Math.max(2, Math.floor(g / 3.4)); e++) {
			let t = -g / 2 + (e + .5) * g / Math.max(2, Math.floor(g / 3.4));
			o("wood", R(h + .2, .2, .24, 0, x, t));
			for (let e of [-h / 3, h / 3]) o("dougong", R(.4, .32, .4, e, x - .25, t));
		}
		if (t.name !== "gate" && t.name !== "main" && t.name !== "west") {
			let t = -i + 2.7, n = Math.min(5.5, h * .62);
			o("woodDark", R(n, .16, 1.22, 0, _ + .93, t)), o("bronze", R(n + .12, .07, 1.3, 0, _ + 1.04, t)), o("woodDark", R(n - .35, .13, 1.05, 0, _ + .26, t));
			for (let e of [-1, 1]) for (let r of [-1, 1]) {
				let i = e * (n / 2 - .24), a = t + r * .42;
				o("wood", R(.22, .78, .22, i, _ + .45, a)), o("bronze", R(.24, .06, .24, i, _ + .83, a));
			}
			o("gold", R(n - .4, .055, .055, 0, _ + .73, t + .59)), o("wood", R(n + .3, 2.7, .22, 0, _ + 2.35, t - .72)), o("gold", z(.5, .58, .13, 20, 0, _ + 1.2, t)), o("gold", z(.34, .51, .63, 20, 0, _ + 1.58, t)), o("gold", new e.SphereGeometry(.29, 18, 14).translate(0, _ + 2.03, t)), o("gold", new e.TorusGeometry(.44, .045, 8, 28).translate(0, _ + 1.99, t - .24));
			for (let r of [-1, 1]) o("bronze", z(.085, .11, .55, 10, r * Math.min(1.75, n * .32), _ + 1.24, t + .1)), o("lantern", new e.SphereGeometry(.12, 10, 8).translate(r * Math.min(1.75, n * .32), _ + 1.56, t + .1));
			for (let e of [-1, 1]) {
				let r = e * n * .34;
				o("bronze", z(.14, .22, .28, 12, r, _ + 1.2, t + .3));
				for (let e = 0; e < 3; e++) o("woodDark", z(.012, .015, .55 + e * .08, 6, r + (e - 1) * .045, _ + 1.56, t + .3));
			}
		}
		o("wood", R(t.w + .4, .42, .42, 0, n - .2, i - .9)), o("wood", R(t.w + .4, .42, .42, 0, n - .2, -i + .9));
		for (let e of [-1, 1]) o("wood", R(.42, .42, t.d - 1.6, e * (r - .9), n - .2, 0));
		o("wood", R(t.w + 1.4, .34, .7, 0, n + .05, i - .3)), o("wood", R(t.w + 1.4, .34, .7, 0, n + .05, -i + .3));
		let S = this.dougongCluster(), C = Math.max(3, Math.round(t.w / 2.3));
		for (let e = 0; e <= C; e++) {
			let a = -r + .9 + (t.w - 1.8) * e / C;
			for (let e of [-1, 1]) {
				let t = S.clone();
				t.translate(a, n - .05, e * (i - .75)), o("dougong", t);
			}
		}
		let ee = Math.max(2, Math.round(t.d / 2.5));
		for (let e = 1; e < ee; e++) {
			let a = -i + .9 + (t.d - 1.8) * e / ee;
			for (let e of [-1, 1]) {
				let t = S.clone();
				t.rotateY(Math.PI / 2), t.translate(e * (r - .75), n - .05, a), o("dougong", t);
			}
		}
		let w = Math.round((t.w + 2) / .42);
		for (let e = 0; e <= w; e++) {
			let a = -r - .8 + (t.w + 1.6) * e / w;
			for (let t of [-1, 1]) {
				let r = R(.1, .12, 1.45, a, n + .02, t * (i + .45));
				r.rotateX(.12 * t), o(e % 2 ? "wood" : "dougong", r);
			}
		}
		let T = Math.round((t.d + 2) / .42);
		for (let e = 0; e <= T; e++) {
			let a = -i - .8 + (t.d + 1.6) * e / T;
			for (let t of [-1, 1]) {
				let i = R(1.45, .12, .1, t * (r + .45), n + .02, a);
				i.rotateZ(-.12 * t), o(e % 2 ? "wood" : "dougong", i);
			}
		}
		let E = Math.max(2, Math.round(t.w / 6));
		for (let a = 0; a <= E; a++) {
			let s = -r + 1.4 + (t.w - 2.8) * a / E, c = n - 1.05, l = i + .15, u = new e.SphereGeometry(.17, 10, 8);
			u.scale(1, 1.18, 1), u.translate(s, c, l), o("lantern", u), o("gold", z(.09, .09, .08, 8, s, c + .3, l)), o("gold", z(.09, .09, .08, 8, s, c - .3, l)), o("gold", z(.012, .012, .55, 4, s, c + .6, l));
		}
		if (t.double) {
			o("roof", je({
				wOuter: t.w + 3.4,
				dOuter: t.d + 3.4,
				wInner: t.w - 1.2,
				dInner: t.d - 1.2,
				eaveY: n + .1,
				rise: 1.15,
				cornerLift: .55,
				nu: 34,
				nv: 8
			}));
			let e = n + 3;
			o("wall", R(t.w - 2.2, 3, t.d - 2.2, 0, n + 1.5, 0));
			for (let e = 0; e <= 12; e++) o("wood", R(.1, .7, .1, -r + 1.2 + (t.w - 2.4) * e / 12, n + .55, i - 1.05));
			o("wood", R(t.w - 2.4, .12, .14, 0, n + .9, i - 1.05));
			for (let e = 0; e < 5; e++) {
				let a = -r + 1.6 + (t.w - 3.2) * (e + .5) / 5, s = Ne((t.w - 3.2) / 5 - .25, 1.4, .24, .07, i - .95);
				s.bars.translate(a, n + 1.55, 0), s.backing.translate(a, n + 1.55, 0), o("lattice", s.bars), o("window", s.backing);
				for (let e = 0; e <= 4; e++) o("wood", R(.08, 1.4, .12, a - (t.w - 3.2) / 10 + e * ((t.w - 3.2) / 20), n + 1.55 + .7, i - .88));
			}
			o("wood", R(t.w + .6, .35, .5, 0, e, i - .7)), o("wood", R(t.w + .6, .35, .5, 0, e, -i + .7)), o("roof", Ae({
				w: t.w - 1.4,
				d: t.d - 1.4,
				eaveY: e + .2,
				rise: t.rise + .4,
				cornerLift: .95,
				overhang: 1.45,
				nu: 38,
				nv: 16
			})), this.ridgeAndTips(a, t.w - 1.4, t.d - 1.4, e + .2 + t.rise + .4, e + .2);
		} else o("roof", Ae({
			w: t.w,
			d: t.d,
			eaveY: n + .15,
			rise: t.rise,
			cornerLift: .9,
			overhang: 1.25,
			nu: 36,
			nv: 15
		})), this.ridgeAndTips(a, t.w, t.d, n + .15 + t.rise, n + .15);
		let D = t.double ? n + 2.1 : n + .15, te = t.w / 2 + 1.1, ne = Math.round(te * 2 / .34);
		for (let n = 0; n <= ne; n++) {
			let r = -te + 2 * te * n / ne;
			for (let n of [-1, 1]) {
				let i = new e.CylinderGeometry(.075, .075, .05, 8);
				i.rotateX(Math.PI / 2), i.translate(r, D - .06, n * (t.d / 2 + 1.1)), o("roof", i);
			}
		}
		for (let t of [-1, 1]) for (let a of [-1, 1]) o("bronze", z(.14, .2, .5, 8, t * (r + 1.15), n - .55, a * (i + 1.15))), o("bronze", new e.SphereGeometry(.09, 8, 6).translate(t * (r + 1.15), n - .85, a * (i + 1.15)));
		if (t.plaque) {
			let n = t.name === "gate" || t.name === "main" ? Le(t.name) : void 0, r = n ?? Pe(t.plaque, 512, 150, {
				bg: "#17130f",
				fg: "#d9b46b",
				border: "#7b5a2a"
			}), a = n ? new e.MeshStandardMaterial({
				name: `lingyin-${t.name}-gilded-plaque`,
				map: r,
				roughness: .86,
				metalness: .02,
				side: e.DoubleSide
			}) : new e.MeshStandardMaterial({
				map: r,
				roughness: .55,
				metalness: .15,
				emissive: new e.Color("#3a2a12"),
				emissiveIntensity: .18
			}), s = t.name === "gate" ? .15 : 1.45, c = j.platform.y + .25 + Math.min(u - .55, 3.5) + s, l = new e.Mesh(new e.PlaneGeometry(4.2, 1.2), a);
			l.position.set(t.x, c, t.z + i - .35), l.castShadow = !1, l.name = `plaque-${t.name}`, this.group.add(l), o("gold", R(4.5, 1.45, .16, 0, .25 + Math.min(u - .55, 3.5) + s, i - .48));
		}
		let O = t.rotY ?? 0, re = Math.cos(O), k = Math.sin(O);
		for (let e of Object.keys(a)) for (let n of a[e]) O && n.rotateY(O), n.translate(t.x, j.platform.y, t.z), this.roles[e].push(n);
		let A = new e.PointLight(16758647, t.name === "main" ? 6 : 2.8, t.name === "main" ? 18 : 10, 2);
		A.position.set(t.x, j.platform.y + Math.max(3.2, t.plinth + 2.3), t.z), this.group.add(A), this.anchors.eaves.push(new e.Vector3(t.x + k * (i + 1), j.platform.y + n, t.z + re * (i + 1))), t.name === "main" && this.anchors.door.set(t.x, j.platform.y + 1.6, t.z + i + 1.5);
	}
	column(e, t, n, r, i) {
		e.stone.push(z(.4, .46, .24, 10, t, n + .06, r)), e.wood.push(z(.27, .33, i - .24, 12, t, n + .24 + (i - .24) / 2, r)), e.gold.push(z(.31, .31, .08, 12, t, n + i - .16, r)), e.bronze.push(z(.33, .33, .05, 12, t, n + .36, r));
	}
	dougongCluster() {
		let e = [];
		return e.push(R(.42, .36, .42, 0, .18, 0)), e.push(R(1.5, .2, .3, 0, .46, 0)), e.push(R(.3, .2, 1.1, 0, .46, .2)), e.push(R(.46, .22, .46, -.45, .67, 0)), e.push(R(.46, .22, .46, 0, .67, 0)), e.push(R(.46, .22, .46, .45, .67, 0)), e.push(R(.22, .2, .9, 0, .67, 0)), B(e);
	}
	ridgeAndTips(t, n, r, i, a) {
		let o = n * .52 / 2;
		t.roof.push(R(o * 2 + .6, .42, .42, 0, i + .18, 0));
		for (let e of [-1, 1]) {
			t.roof.push(R(.34, 1.15, .4, e * (o + .35), i + .55, 0));
			let n = R(.28, .9, .34, e * (o + .55), i + 1.05, .1);
			n.rotateZ(-e * .35), t.roof.push(n);
		}
		let s = n / 2 + 1.15, c = r / 2 + 1.15;
		for (let n of [-1, 1]) for (let r of [-1, 1]) {
			let l = new e.Vector3(n * o, i + .1, 0), u = new e.Vector3(n * s, a + .35, r * c).clone().sub(l), d = u.length(), f = new e.BoxGeometry(.34, d, .28);
			f.translate(0, d / 2, 0);
			let p = new e.Quaternion().setFromUnitVectors(new e.Vector3(0, 1, 0), u.normalize());
			f.applyQuaternion(p), f.translate(l.x, l.y, l.z), t.roof.push(f);
		}
		let l = n / 2 + 1.15, u = r / 2 + 1.15;
		for (let n of [-1, 1]) for (let r of [-1, 1]) {
			let i = z(.05, .2, 1.15, 6, 0, 0, 0);
			i.rotateZ(-n * .55), i.rotateX(r * .3), i.translate(n * l, a + .45, r * u), t.roof.push(i), t.gold.push(new e.SphereGeometry(.11, 8, 6).translate(n * l, a + .95, r * u));
		}
	}
	buildPagoda(t, n, r) {
		this.addAt("stone", z(3.1, 3.4, .7, 8), t, r + .35, n);
		let i = r + .7, a = 2.1;
		for (let e = 0; e < 5; e++) {
			let r = 2.25 - e * .1;
			this.addAt("stone", z(a - .12, a, r, 8), t, i + r / 2, n), this.addAt("dark", R(.7, 1.25, .2, 0, 0, 0), t, i + .75, n + a - .02), this.addAt("stone", z(a + .85, a + .2, .36, 8), t, i + r + .18, n), this.addAt("stone", z(a + .1, a + .1, .16, 8), t, i + r + .42, n);
			for (let e = 0; e < 8; e++) {
				let o = e / 8 * Math.PI * 2 + Math.PI / 8, s = z(.03, .1, .55, 5, 0, 0, 0);
				s.rotateZ(.7), s.rotateY(-o), s.translate(t + Math.cos(o) * (a + .85), i + r + .45, n + Math.sin(o) * (a + .85)), this.add("stone", s);
			}
			i += r + .5, a *= .87;
		}
		this.addAt("gold", z(.12, .3, 1.6, 8), t, i + .8, n);
		for (let r = 0; r < 4; r++) this.addAt("gold", new e.SphereGeometry(.22 - r * .03, 10, 8), t, i + .4 + r * .3, n);
		this.addAt("gold", new e.SphereGeometry(.16, 8, 6), t, i + 1.7, n);
	}
	buildEnclosure(t) {
		let n = j.platform, r = 1.5, i = .38, a = (e, n, a, o) => {
			let s = Math.hypot(a - e, o - n), c = Math.atan2(a - e, o - n);
			this.add("stone", R(.55, .35, s, (e + a) / 2, t + .17, (n + o) / 2, c)), this.add("wall", R(i, r, s, (e + a) / 2, t + .35 + r / 2, (n + o) / 2, c)), this.add("roof", R(i + .55, .18, s, (e + a) / 2, t + .35 + r + .09, (n + o) / 2, c)), this.add("roof", R(i + .2, .16, s, (e + a) / 2, t + .35 + r + .24, (n + o) / 2, c));
		};
		a(n.x0 + .5, n.z0 + 1, n.x0 + .5, 3.8), a(n.x0 + .5, 10.2, n.x0 + .5, n.z1 - 1);
		for (let e of [3.8, 10.2]) this.add("stone", R(.75, 3.7, .75, n.x0 + .5, t + 1.85, e));
		this.add("roof", R(1.25, .35, 7.1, n.x0 + .5, t + 4, 7)), this.add("wood", R(.22, .4, 2, n.x0 + .05, t + 3.45, 7));
		let o = new e.Mesh(new e.PlaneGeometry(1.76, .34), new e.MeshStandardMaterial({
			map: Pe("西山道", 512, 128, {
				bg: "#302923",
				fg: "#d4b674",
				border: "#8f7755"
			}),
			roughness: .88,
			side: e.DoubleSide
		}));
		o.rotation.y = Math.PI / 2, o.position.set(n.x0 + .2, t + 3.45, 7), this.group.add(o), this.add("stone", R(4.25, .95, 3.2, -34.25, t + .475, 7)), this.add("floor", We(R(4.3, .06, 3.25, -34.25, t + .98, 7), .92)), a(n.x0 + .5, n.z0 + 1, n.x1 - .5, n.z0 + 1), a(n.x1 - .5, n.z0 + 1, n.x1 - .5, 23), a(n.x1 - .5, 33, n.x1 - .5, n.z1 - 1), this.add("wood", R(.4, 3.2, 1, n.x1 - .5, t + 2, 23.4)), this.add("wood", R(.4, 3.2, 1, n.x1 - .5, t + 2, 32.6)), this.add("roof", R(1.9, .3, 10.4, n.x1 - .5, t + 3.75, 28));
		for (let r of [-1, 1]) {
			let i = 28 + r * 2.2;
			this.add("wood", R(.22, 2.72, 4.38, n.x1 - .5, t + 1.71, i));
			for (let e of [-1.98, 1.98]) this.add("bronze", R(.3, 2.8, .13, n.x1 - .63, t + 1.71, i + e));
			for (let e of [
				.64,
				1.55,
				2.48
			]) this.add("bronze", R(.3, .15, 4.25, n.x1 - .63, t + e, i));
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
			this.add("bronze", z(.09, .09, .055, 8, n.x1 - .72, t + 1.55, i - r * 1.62));
		}
	}
	buildBuddha(t) {
		let n = -10.85, r = t + 1.1;
		this.add("bronze", z(1.58, 1.72, .18, 36).translate(-2, r + .09, n)), this.add("bronze", z(1.43, 1.55, .38, 36).translate(-2, r + .37, n)), this.add("gold", z(1.48, 1.52, .055, 36).translate(-2, r + .19, n)), this.add("gold", z(1.34, 1.4, .07, 36).translate(-2, r + .57, n)), this.add("bronze", z(1.17, 1.3, .15, 36).translate(-2, r + .67, n));
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
			let r = B(n), i = {
				stone: 1.4,
				wall: 2,
				wood: .75,
				woodDark: .75,
				dougong: .7,
				lattice: .75
			}, a = i[t] ? V(r, i[t]) : r, o = new e.Mesh(a, this.materials[t]);
			o.name = `temple-${t}`, o.castShadow = t === "stone" || t === "wall" || t === "roof" || t === "wood" || t === "dougong" || t === "bronze", o.receiveShadow = !0, this.group.add(o), n.length = 0;
		}
		this.group.traverse((t) => {
			t instanceof e.Mesh && t.name.startsWith("plaque") && (t.castShadow = !1);
		});
	}
}, it = [
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
], at = 1024, ot = -2, st = -8, X = 256, Z = null, ct = null;
function lt() {
	if (ct) return ct;
	let e = (e) => new Promise((t, n) => {
		let r = new Image();
		r.onload = () => t(r), r.onerror = () => n(/* @__PURE__ */ Error(`Lingyin foliage image failed: ${e}`)), r.src = new URL(`./assets/lingyin/temple-textures/${e}`, document.baseURI).href + "?v=1";
	});
	return ct = Promise.all([
		e("pine-foliage-albedo.jpg"),
		e("pine-foliage-alpha.png"),
		e("broad-foliage-albedo.jpg"),
		e("broad-foliage-alpha.png")
	]).then(([e, t, n, r]) => {
		Z = {
			pine: {
				diffuse: e,
				alpha: t
			},
			broad: {
				diffuse: n,
				alpha: r
			}
		};
	}), ct;
}
function ut(e) {
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
function dt() {
	let t = document.createElement("canvas");
	t.width = at, t.height = at;
	let n = t.getContext("2d");
	if (!n) throw Error("no 2d");
	n.clearRect(0, 0, at, at);
	let r = new v("foliage-atlas"), i = (e, t) => {
		let { col: r, row: i } = ut(e), a = r * X, o = i * X;
		n.save(), n.translate(a, o), n.beginPath(), n.rect(0, 0, X, X), n.clip(), t(n), n.restore();
	};
	if (i("pine", (e) => {
		let t = X / 2, n = X * .62, i = e.createRadialGradient(t, n - 20, 10, t, n - 20, 190);
		i.addColorStop(0, "rgba(22,36,24,0.55)"), i.addColorStop(.6, "rgba(22,36,24,0.22)"), i.addColorStop(1, "rgba(22,36,24,0)"), e.fillStyle = i, e.fillRect(0, 0, X, X);
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
		let t = X / 2, n = X * .6, i = e.createRadialGradient(t, n, 8, t, n, 180);
		i.addColorStop(0, "rgba(24,40,22,0.5)"), i.addColorStop(.65, "rgba(24,40,22,0.18)"), i.addColorStop(1, "rgba(24,40,22,0)"), e.fillStyle = i, e.fillRect(0, 0, X, X);
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
			let n = r.range(30, X - 30), i = r.range(30, X - 30), a = r.range(16, 30);
			e.save(), e.translate(n, i), e.rotate(r.range(0, Math.PI * 2)), e.fillStyle = t[r.int(0, t.length - 1)], e.beginPath();
			for (let t = 0; t < 5; t++) {
				let n = -Math.PI / 2 + (t - 2) * .62, r = Math.cos(n) * a, i = Math.sin(n) * a;
				e.lineTo(r, i), e.lineTo(Math.cos(n + .28) * a * .45, Math.sin(n + .28) * a * .45);
			}
			e.closePath(), e.fill(), e.restore();
		}
	}), i("bamboo", (e) => {
		for (let t = 0; t < 5; t++) {
			let t = r.range(30, X - 30), n = r.range(40, X - 40);
			for (let i = 0; i < 12; i++) {
				let i = r.range(-Math.PI, Math.PI), a = r.range(30, 68);
				e.save(), e.translate(t + r.range(-10, 10), n + r.range(-10, 10)), e.rotate(i), e.fillStyle = `rgba(${70 + r.int(0, 25)},${100 + r.int(0, 30)},${48 + r.int(0, 20)},0.9)`, e.beginPath(), e.ellipse(a * .5, 0, a * .5, 3.2, 0, 0, Math.PI * 2), e.fill(), e.restore();
			}
		}
	}), i("grass", (e) => {
		for (let t = 0; t < 46; t++) {
			let t = X / 2 + r.range(-70, 70), n = -Math.PI / 2 + r.range(-.55, .55), i = r.range(80, 210);
			e.strokeStyle = `rgba(${72 + r.int(0, 35)},${94 + r.int(0, 35)},${44 + r.int(0, 22)},0.95)`, e.lineWidth = r.range(1.5, 3.4), e.beginPath(), e.moveTo(t, X - 4), e.quadraticCurveTo(t + Math.cos(n) * i * .45, X - i * .55, t + Math.cos(n) * i, X - 4 - Math.sin(-n) * i), e.stroke();
		}
	}), i("fern", (e) => {
		for (let t = 0; t < 5; t++) {
			let t = -Math.PI / 2 + r.range(-.8, .8), n = r.range(120, 210), i = X / 2, a = X - 10;
			e.strokeStyle = "#3f5a34", e.lineWidth = 2.2, e.beginPath(), e.moveTo(i, a), e.quadraticCurveTo(i + Math.cos(t) * n * .6, a - n * .6, i + Math.cos(t) * n, a - n * .85), e.stroke();
			for (let o = 4; o < 20; o++) {
				let s = o / 20, c = i + Math.cos(t) * n * s, l = a - n * .85 * s - Math.sin(Math.abs(t)) * 6;
				for (let t of [-1, 1]) e.strokeStyle = `rgba(${54 + r.int(0, 20)},${80 + r.int(0, 22)},${40 + r.int(0, 18)},0.95)`, e.lineWidth = 1.2, e.beginPath(), e.moveTo(c, l), e.lineTo(c + t * 18 * (1 - s), l + 8), e.stroke();
			}
		}
	}), Z) {
		let e = (e, t, r, i, a, o, s = !1) => {
			let c = document.createElement("canvas"), l = document.createElement("canvas");
			c.width = c.height = X, l.width = l.height = X;
			let u = c.getContext("2d"), d = l.getContext("2d");
			u.drawImage(t.diffuse, r, i, a, o, 0, 0, X, X), d.drawImage(t.alpha, r, i, a, o, 0, 0, X, X);
			let f = u.getImageData(0, 0, X, X), p = d.getImageData(0, 0, X, X);
			for (let e = 0; e < f.data.length; e += 4) f.data[e + 3] = p.data[e], s && (f.data[e] = Math.min(255, f.data[e] * 1.5 + 52), f.data[e + 1] = Math.min(255, f.data[e + 1] * .68 + 12), f.data[e + 2] = Math.min(255, f.data[e + 2] * .52));
			u.putImageData(f, 0, 0);
			let { col: m, row: h } = ut(e);
			n.clearRect(m * X, h * X, X, X), n.drawImage(c, m * X, h * X);
		};
		e("pine", Z.pine, 700, 340, 280, 185), e("broad", Z.broad, 20, 35, 440, 545), e("maple", Z.broad, 20, 35, 440, 545, !0);
	}
	let a = new e.CanvasTexture(t);
	return a.colorSpace = e.SRGBColorSpace, a.anisotropy = 8, a.needsUpdate = !0, a;
}
function ft(t, n, r) {
	let { col: i, row: a } = ut(t), o = i / 4, s = 1 - (a + 1) / 4, c = new e.PlaneGeometry(n, r), l = c.getAttribute("uv");
	for (let e = 0; e < l.count; e++) l.setXY(e, o + l.getX(e) * .25, s + l.getY(e) * .25);
	return c;
}
function Q(e, t, n, r, i, a = 0, o = !0, s = 0, c = 0) {
	let l = ft(e, t, n);
	return o && l.translate(0, n / 2, 0), l.rotateX(a), l.rotateY(i), l.translate(s, r, c), l;
}
var pt = class {
	trunk;
	cards;
	blobs;
	constructor(e, t, n) {
		this.trunk = e, this.cards = t, this.blobs = n;
	}
};
function mt(n) {
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
		c.push(Q("pine", n.range(3.2, 4.6), n.range(2, 2.8), e.y - .9 + n.range(-.4, .4), t / 8 * Math.PI + n.range(-.3, .3), .1, !0, r, i));
	}
	for (let e = 0; e < 6; e++) {
		let t = e / 6 * Math.PI * 2;
		c.push(Q("pine", 3.6, 2.3, r * .82, t, .02, !0, Math.cos(t) * .7, Math.sin(t) * .7));
	}
	return new pt(t(i, !1), t(c, !1), l.length ? t(l, !1) : new e.BufferGeometry());
}
function $(n, r) {
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
		c.push(Q(r, 4.8, 3.3, s - 1.7, t, e % 2 ? .12 : -.12, !0, Math.cos(t * 2) * .24, Math.sin(t * 2) * .24));
	}
	for (let e = 0; e < 72; e++) {
		let e = n.range(0, Math.PI * 2), t = n.range(.3, 2.9), i = s + n.range(-1.5, 1.9), a = n.range(2, 3.4);
		c.push(Q(r, a, a * n.range(.65, .95), i, e, n.range(-.5, .5), !0, Math.cos(e) * t, Math.sin(e) * t));
	}
	for (let e of o) c.push(Q(r, 2, 1.4, e.y, n.range(0, Math.PI), n.range(-.3, .3), !0, e.x, e.z));
	return new pt(t(a, !1), t(c, !1), new e.BufferGeometry());
}
function ht(n) {
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
		o.push(Q("bamboo", n.range(1, 1.7), n.range(.5, .9), t, e, n.range(-.4, .4), !0, Math.cos(e) * i, Math.sin(e) * i));
	}
	return new pt(a, t(o, !1), new e.BufferGeometry());
}
var gt = class {
	group = new e.Group();
	tiles = [];
	atlas;
	bark;
	leafMat;
	grassGeo;
	fernGeo;
	time = n.time;
	constructor() {
		this.group.name = "vegetation", this.atlas = dt(), this.bark = s({
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
		for (let e = 0; e < 3; e++) r.push(Q("grass", 1.1, .85, 0, e / 3 * Math.PI, 0, !0));
		this.grassGeo = t(r, !1);
		let i = [];
		for (let e = 0; e < 4; e++) i.push(Q("fern", 1.3, .9, 0, e / 4 * Math.PI * 2, .1, !0));
		this.fernGeo = t(i, !1), this.populate();
	}
	canPlace(e, t, n) {
		if (F(e, t, n)) return !1;
		for (let r of it) {
			let i = r.pos[0], a = r.pos[2], o = r.target[0], s = r.target[2], c = o - i, l = s - a, u = c * c + l * l || 1, d = ((e - i) * c + (t - a) * l) / u;
			if (d > -.05 && d < .5) {
				let r = i + c * d, o = a + l * d;
				if (Math.hypot(e - r, t - o) < 9 + n) return !1;
			}
		}
		return !(xe(e, t) < n + 1.6 || se(e, t) < 2.72 + n + .35 || me(e, t) < n || be(e, t) > .8);
	}
	populate() {
		let t = new v("vegetation"), n = [
			mt(new v("pine-a")),
			mt(new v("pine-b")),
			mt(new v("pine-c"))
		], r = [$(new v("broad-a"), "broad"), $(new v("broad-b"), "broad")], i = [$(new v("maple-a"), "maple"), $(new v("maple-b"), "maple")], a = ht(new v("bamboo")), o = [], s = [], c = [], l = [], u = new e.Quaternion(), d = new e.Euler(), f = new e.Vector3(), p = (t, n, r, i, a) => (d.set(0, a, 0), u.setFromEuler(d), f.set(i, i, i), new e.Matrix4().compose(new e.Vector3(t, n, r), u, f)), m = 0;
		for (; o.length < 190 && m < 12e3;) {
			m++;
			let r = t.range(-250, 250), i = t.range(-250, 220);
			this.canPlace(r, i, 3.5) && (this.cragDistance(r, i) < 22 || be(r, i) < .08 && t.chance(.7) || o.push({
				v: t.int(0, n.length - 1),
				m: p(r, N(r, i) - .25, i, t.range(.75, 1.25), t.range(0, 6.28)),
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
			m: p(n, N(n, r) + 17 * i, r, i, t.range(0, 6.28)),
			c: new e.Color("#3d5135")
		});
		for (m = 0; s.length < 120 && m < 7e3;) {
			m++;
			let n = t.range(-210, 210), i = t.range(-190, 200);
			this.canPlace(n, i, 3) && (this.cragDistance(n, i) < 20 || Math.abs(n + 2) > 90 && t.chance(.5) || s.push({
				v: t.int(0, r.length - 1),
				m: p(n, N(n, i) - .2, i, t.range(.8, 1.3), t.range(0, 6.28)),
				c: new e.Color().setHSL(.27 + t.range(-.03, .03), .1, .74 + t.range(-.08, .06))
			}));
		}
		for (m = 0; c.length < 30 && m < 3e3;) {
			m++;
			let n = t.range(-90, 80), r = t.range(-70, 90);
			this.canPlace(n, r, 3) && (F(n, r, 5) || c.push({
				v: t.int(0, i.length - 1),
				m: p(n, N(n, r) - .2, r, t.range(.75, 1.15), t.range(0, 6.28)),
				c: new e.Color().setHSL(.05 + t.range(-.02, .02), .12, .82 + t.range(-.06, .05))
			}));
		}
		for (let n = 0; n < 170; n++) {
			let n = t.range(-62, -38), r = t.range(-10, 52);
			this.canPlace(n, r, 1.2) && l.push({
				m: p(n, N(n, r) - .1, r, t.range(.8, 1.2), t.range(0, 6.28)),
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
			this.canPlace(e, n, .5) && (F(e, n, 1.5) || h.push(p(e, N(e, n) - .02, n, t.range(.7, 1.4), t.range(0, 6.28))));
		}
		for (m = 0; g.length < 800 && m < 7e3;) {
			m++;
			let e = t.range(-95, 90), n = t.range(-70, 95);
			this.canPlace(e, n, 1.2) && g.push(p(e, N(e, n) - .02, n, t.range(.7, 1.2), t.range(0, 6.28)));
		}
		this.addInstanced(this.grassGeo, this.leafMat, h, !1, "grass"), this.addInstanced(this.fernGeo, this.leafMat, g, !1, "fern"), this.farForest(t), this.shrubsAndRocks(t);
	}
	shrubsAndRocks(n) {
		let r = [];
		for (let e = 0; e < 5; e++) {
			let t = e * Math.PI / 5;
			r.push(Q("broad", n.range(1.55, 2.15), n.range(1.1, 1.6), 0, t, n.range(-.16, .16), !0, Math.cos(t * 2) * .28, Math.sin(t * 2) * .28));
		}
		let i = t(r, !1), a = [], o = 0;
		for (; a.length < 260 && o < 4e3;) {
			o++;
			let t = n.range(-140, 130), r = n.range(-100, 120);
			if (!this.canPlace(t, r, 1.7)) continue;
			let i = n.range(.7, 1.7);
			a.push(new e.Matrix4().compose(new e.Vector3(t, N(t, r) - .15, r), new e.Quaternion().setFromEuler(new e.Euler(0, n.range(0, 6.28), 0)), new e.Vector3(i, i * n.range(.8, 1.2), i)));
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
			if (F(t, r, 2)) continue;
			let i = n.range(.5, 2.2);
			xe(t, r) < 3 || se(t, r) < 2.72 + 1.8 * i + .35 || l.push(new e.Matrix4().compose(new e.Vector3(t, N(t, r) - .35 * i, r), new e.Quaternion().setFromEuler(new e.Euler(n.range(-.2, .2), n.range(0, 6.28), n.range(-.2, .2))), new e.Vector3(i, i * n.range(.6, 1.1), i)));
		}
		this.addInstanced(c, $e(), l, !0, "boulder");
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
			if (Math.hypot(t - ot, r - st) < 185 || F(t, r, 6) || me(t, r) < 3 || be(t, r) > .85) continue;
			let i = n.range(.9, 1.9), a = new e.Matrix4().compose(new e.Vector3(t, N(t, r) - .3, r), new e.Quaternion().setFromEuler(new e.Euler(0, n.range(0, 6.28), 0)), new e.Vector3(i, i, i));
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
}, _t = class {
	group = new e.Group();
	smokeOrigin = new e.Vector3(-2, 7.4, 22);
	lanterns = [];
	constructor() {
		this.group.name = "details", this.bridge(), this.lanternsAlongPath(), this.censer(), this.lions(), this.stele(), this.pavilion(), this.streamRailing(), this.prayerRibbons(), this.paving(), this.puddles();
	}
	paving() {
		let t = new e.Mesh(new e.PlaneGeometry(48, 32), ze());
		t.rotation.x = -Math.PI / 2, t.position.set(-2, j.platform.y + .025, 18), t.receiveShadow = !0, t.name = "courtyard-photographic-paving", this.group.add(t);
		let n = Ue(), r = [], i = new v("paving");
		for (let e = 46; e < 58; e += 1.3) for (let t = -4; t < 4; t += 1.9) r.push(We(R(1.7, .09, 1.15, t, N(t, e) + .02, e), .81 + i.range(0, .23)));
		let a = new e.Mesh(B(r), n);
		a.receiveShadow = !0, this.group.add(a);
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
			c.rotateX(-Math.PI / 2), c.scale(1, 1, n.range(.45, .8)), c.translate(i, j.platform.y + .035, a);
			let l = new e.Mesh(c, t);
			l.receiveShadow = !0, this.group.add(l);
		}
	}
	bridge() {
		let t = q(.35), n = [], r = Me(13.4, 3.3, .45, 3.15, 1.05);
		for (let e of [26.1, 29.9]) n.push(r.clone().translate(36, .45, e));
		n.push(R(13.6, .34, 4.6, 36, 3.66, 28)), n.push(R(13.9, .18, 4.9, 36, 3.86, 28));
		for (let e of [-1, 1]) {
			for (let t = 0; t <= 12; t++) {
				let r = 29.5 + t * 1.1;
				n.push(R(.2, 1, .2, r, 4.45, 28 + e * 2.05)), t < 12 && n.push(R(1.1, .15, .16, r + .55, 4.88, 28 + e * 2.05));
			}
			n.push(R(13.4, .18, .26, 36, 4.95, 28 + e * 2.05));
		}
		for (let e of [-1, 1]) for (let t = 0; t < 3; t++) n.push(R(1.2, .18, 4.2, 36 + e * (7 + t * .5), 3.4 - t * .18, 28));
		let i = new e.Mesh(V(B(n), 1.4), t);
		i.castShadow = !0, i.receiveShadow = !0, this.group.add(i);
	}
	lanternsAlongPath() {
		let t = q(.5), n = [];
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
			let i = N(t, r);
			n.push(R(.75, .22, .75, t, i + .11, r)), n.push(z(.16, .2, 1.15, 8, t, i + .78, r)), n.push(R(.55, .55, .55, t, i + 1.62, r)), n.push(new e.ConeGeometry(.62, .42, 6).translate(t, i + 2.1, r)), n.push(new e.SphereGeometry(.09, 6, 4).translate(t, i + 2.38, r)), this.lanterns.push(new e.Vector3(t, i + 1.62, r));
		}
		let r = new e.Mesh(V(B(n), 1.4), t);
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
		a.position.set(-2, j.platform.y + 4.3, 22), this.group.add(a);
	}
	censer() {
		let t = Ye(), n = [], r = j.platform.y;
		for (let t = 0; t < 3; t++) {
			let r = t / 3 * Math.PI * 2, i = new e.Vector3(Math.cos(r) * 1.9, .19, Math.sin(r) * 1.9), a = new e.Vector3(Math.cos(r) * 1.55, 1.96, Math.sin(r) * 1.55);
			n.push(z(.23, .29, .18, 10, i.x, .105, i.z));
			let o = a.clone().sub(i), s = new e.CylinderGeometry(.13, .18, o.length(), 10);
			s.applyQuaternion(new e.Quaternion().setFromUnitVectors(new e.Vector3(0, 1, 0), o.normalize())), s.translate((i.x + a.x) / 2, (i.y + a.y) / 2, (i.z + a.z) / 2), n.push(s);
		}
		n.push(z(1.55, 1.4, .16, 20, 0, 1.91, 0));
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
		n.push(z(1.1, 1.25, .22, 20, 0, 3.17, 0)), n.push(new e.SphereGeometry(.22, 10, 8).translate(0, 3.5, 0)), n.push(new e.ConeGeometry(.2, .55, 8).translate(0, 3.8, 0));
		let o = new e.Mesh(B(n), t);
		o.position.set(-2, r, 22), o.castShadow = !0, o.receiveShadow = !0, this.group.add(o), this.smokeOrigin.set(-2, r + 4.15, 22);
	}
	lions() {
		let t = q(.55), n = [];
		for (let t of [-10.5, 6.5]) {
			let r = 41.5, i = N(t, r);
			n.push(R(1.4, .5, 1.8, t, i + .25, r)), n.push(new e.SphereGeometry(.55, 12, 10).scale(1, 1.15, 1.25).translate(t, i + 1.1, r)), n.push(new e.SphereGeometry(.42, 12, 10).translate(t, i + 1.75, r + .45));
			for (let a of [-1, 1]) n.push(new e.SphereGeometry(.28, 8, 6).translate(t + a * .38, i + 2, r + .4)), n.push(new e.CylinderGeometry(.12, .15, .8, 6).translate(t + a * .35, i + .65, r + .5));
			n.push(new e.CylinderGeometry(.1, .16, .9, 6).translate(t, i + .9, r + 1.05));
		}
		let r = new e.Mesh(V(B(n), 1.4), t);
		r.castShadow = !0, r.receiveShadow = !0, this.group.add(r);
	}
	stele() {
		let t = q(.7), n = Pe("冷泉", 256, 512, {
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
		s.position.y = 2.82, i.add(a, o, s), i.position.set(7.5, N(7.5, 33), 33), i.rotation.y = -.35, i.traverse((t) => {
			t instanceof e.Mesh && (t.castShadow = !0, t.receiveShadow = !0);
		}), this.group.add(i);
	}
	pavilion() {
		let t = J(!1), n = Ge(), r = q(.4), i = new e.Group(), a = Math.max(N(29, 51), he) + .15, o = new e.Mesh(new e.CylinderGeometry(3.8, 4.1, .5, 6), r);
		o.position.y = .25, o.castShadow = !0, o.receiveShadow = !0, i.add(o);
		for (let n = 0; n < 6; n++) {
			let r = n / 6 * Math.PI * 2 + Math.PI / 6, a = new e.Mesh(new e.CylinderGeometry(.13, .16, 3.1, 8), t);
			a.position.set(Math.cos(r) * 3.1, 2.05, Math.sin(r) * 3.1), a.castShadow = !0, i.add(a);
			let o = new e.Mesh(new e.CylinderGeometry(.18, .18, .08, 8), qe());
			o.position.set(Math.cos(r) * 3.1, 3.5, Math.sin(r) * 3.1), i.add(o);
		}
		let s = new e.Mesh(new e.CylinderGeometry(.25, 4.6, 1.7, 6), n);
		s.position.y = 4.4, s.castShadow = !0, i.add(s);
		let c = new e.Mesh(new e.ConeGeometry(.18, .8, 8), qe());
		c.position.y = 5.55, i.add(c);
		for (let t = 0; t < 6; t++) {
			let r = t / 6 * Math.PI * 2 + Math.PI / 6, a = new e.Mesh(new e.CylinderGeometry(.02, .09, .7, 5), n);
			a.position.set(Math.cos(r) * 4.5, 4.95, Math.sin(r) * 4.5), a.rotation.z = .9, a.rotation.y = -r, i.add(a);
		}
		i.position.set(29, a, 51), this.group.add(i);
	}
	streamRailing() {
		let t = q(.4), n = [];
		for (let e = 0; e < 14; e++) {
			let t = 34 + e * 1.6, r = 31.6 - e * .06, i = N(r, t);
			n.push(R(.18, 1, .18, r, i + .5, t)), e < 13 && n.push(R(.14, .14, 1.6, r - .03, i + .9, t + .8));
		}
		let r = new e.Mesh(V(B(n), 1.4), t);
		r.castShadow = !0, r.receiveShadow = !0, this.group.add(r);
	}
	prayerRibbons() {
		let t = J(!0), n = new e.Group();
		for (let [r, i] of [[-12, 37], [8, 37]]) {
			let a = N(r, i), o = new e.Mesh(new e.CylinderGeometry(.08, .1, 4.2, 6), t);
			o.position.set(r, a + 2.1, i), n.add(o);
		}
		let r = N(0, 37) + 3.9, i = new e.MeshStandardMaterial({
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
}, vt = "\nattribute float aDepth;\nattribute float aFlow;\nvarying float vDepth;\nvarying float vFlow;\nvarying vec2 vUvW;\nvoid main(){\n  vDepth = aDepth;\n  vFlow = aFlow;\n  vUvW = uv;\n  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n}\n", yt = class {
	group = new e.Group();
	material;
	waterfall;
	fallMat;
	constructor() {
		this.group.name = "water", this.material = this.makeWaterMaterial();
		let n = [], r = ce, i = [], a = [], o = [], s = [], c = [], l = r.length, u = 0;
		for (let e = 0; e < l; e++) {
			let [t, n] = r[e], d = r[Math.max(0, e - 1)], f = r[Math.min(l - 1, e + 1)], m = f[0] - d[0], h = f[1] - d[1], g = Math.hypot(m, h) || 1;
			m /= g, h /= g;
			let _ = -h, v = m;
			e > 0 && (u += Math.hypot(t - r[e - 1][0], n - r[e - 1][1]));
			let y = e / (l - 1), b = de(y) * .54, x = fe(y);
			for (let e of [-1, 1]) {
				let r = t + _ * b * e, c = n + v * b * e, l = x - N(r, c);
				i.push(r, x + .015, c), a.push(e < 0 ? 0 : 1, u / 4.5), o.push(p(l, 0, 4)), s.push(.7 + y * .6);
			}
			if (e < l - 1) {
				let t = e * 2;
				c.push(t, t + 2, t + 1, t + 1, t + 2, t + 3);
			}
		}
		let d = new e.BufferGeometry();
		d.setAttribute("position", new e.Float32BufferAttribute(i, 3)), d.setAttribute("uv", new e.Float32BufferAttribute(a, 2)), d.setAttribute("aDepth", new e.Float32BufferAttribute(o, 1)), d.setAttribute("aFlow", new e.Float32BufferAttribute(s, 1)), d.setIndex(c), d.computeVertexNormals(), n.push(d);
		let f = new e.CircleGeometry(j.pond.r, 64, 0, Math.PI * 2);
		f.rotateX(-Math.PI / 2);
		let m = f.getAttribute("position"), h = [], g = [];
		for (let e = 0; e < m.count; e++) {
			let t = m.getX(e) + j.pond.x, n = m.getZ(e) + j.pond.z;
			m.setX(e, t), m.setZ(e, n), m.setY(e, he), h.push(p(he - N(t, n), 0, 4)), g.push(.28);
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
			vertexShader: vt,
			fragmentShader: "\n        uniform float uTime;\n        varying float vDepth;\n        varying float vFlow;\n        varying vec2 vUvW;\n        float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }\n        float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h12(i),h12(i+vec2(1,0)),f.x), mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),f.x), f.y); }\n        void main(){\n          float t = uTime;\n          float streak = n2(vec2(vUvW.x * 8.0, vUvW.y * 2.0 - t * 1.8));\n          streak *= n2(vec2(vUvW.x * 22.0 + 3.0, vUvW.y * 4.0 - t * 3.1));\n          float edge = smoothstep(0.0, 0.18, vUvW.x) * smoothstep(1.0, 0.82, vUvW.x);\n          float top = smoothstep(0.0, 0.08, vUvW.y);\n          float a = edge * top * (0.55 + streak * 0.65);\n          vec3 c = mix(vec3(0.55,0.68,0.68), vec3(0.95,0.97,0.94), streak);\n          gl_FragColor = vec4(c, clamp(a, 0.0, 0.9));\n        }\n      ",
			transparent: !0,
			depthWrite: !1,
			side: e.DoubleSide
		});
	}
	update(e) {
		this.fallMat.uniforms.uTime = n.time;
	}
}, bt = [
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
function xt(t) {
	let n = new e.SphereGeometry(1, 52, 36), r = n.getAttribute("position"), i = new e.Vector3();
	for (let e = 0; e < r.count; e++) {
		i.set(r.getX(e), r.getY(e), r.getZ(e));
		let n = i.clone().normalize(), a = Math.atan2(n.z, n.x), o = C(n.x * 3.1 + t.seed, n.y * 2.3 + n.z * 1.7 - t.seed, 4), s = C(n.x * 9 - t.seed, n.y * 7 + n.z * 8 + t.seed, 3), c = Math.sin(a * 13 + o * 7) * .045 + Math.sin(a * 29 + s * 3) * .018, l = 1 - Math.abs(n.y) * .35, u = 1 + o * .16 + s * .055 + c * l, d = Math.max(0, n.y), f = i.x * t.rx * u, p = (i.y * t.ry * (1 - d * .08) + d * d * 1.2) * (1 + s * .04), m = i.z * t.rz * u;
		r.setXYZ(e, f, p, m);
	}
	return n.computeVertexNormals(), n.rotateY(t.rot), n.translate(t.x, N(t.x, t.z) - 1.8, t.z), n;
}
var St = class {
	group = new e.Group();
	buddhaMaterial = qe();
	constructor() {
		this.group.name = "feilaifeng";
		let n = t(bt.map(xt), !1);
		if (!n) throw Error("crag merge failed");
		let r = new e.Mesh(n, $e());
		r.name = "crag-rock", r.castShadow = !0, r.receiveShadow = !0, this.group.add(r), this.buildNiches();
	}
	buildNiches() {
		let t = q(.4), n = this.buddhaMaterial, r = N(47, 3), i = new e.Group();
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
function Ct(t) {
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
var wt = "\nattribute vec3 aPos;\nattribute vec2 aScale;\nattribute float aRot;\nattribute float aAlpha;\nvarying vec2 vUv;\nvarying float vAlpha;\n", Tt = `
${wt}
void main(){
  float c = cos(aRot), s = sin(aRot);
  vec2 p = mat2(c, -s, s, c) * position.xy;
  vec3 wp = aPos + vec3(p.x * aScale.x, 0.0, p.y * aScale.y);
  vUv = uv;
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`, Et = `
${wt}
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
`, Dt = "\nuniform sampler2D uMap;\nuniform vec3 uTint;\nvarying vec2 vUv;\nvarying float vAlpha;\nvoid main(){\n  float a = texture2D(uMap, vUv).a;\n  if (a < 0.002) discard;\n  gl_FragColor = vec4(uTint, a * vAlpha);\n}\n", Ot = class {
	group = new e.Group();
	tex = Ct("mist");
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
		this.uniforms.uMap.value = this.tex, this.ground = this.makeLayer(this.banks.length, Tt), this.billboard = this.makeLayer(this.puffs.length, Et);
		let r = new e.Mesh(this.ground.geo, new e.ShaderMaterial({
			uniforms: this.uniforms,
			vertexShader: Tt,
			fragmentShader: Dt,
			transparent: !0,
			depthWrite: !1,
			side: e.DoubleSide
		}));
		r.frustumCulled = !1, r.renderOrder = 18, this.group.add(r);
		let i = new e.Mesh(this.billboard.geo, new e.ShaderMaterial({
			uniforms: this.uniforms,
			vertexShader: Et,
			fragmentShader: Dt,
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
export { n as ATMO, f as Backdrop, St as Crag, _t as Details, nt as HillsideTrail, Ot as Mist, d as Sky, rt as Temple, Oe as Terrain, gt as Vegetation, j as WORLD, yt as Water, Je as buddhaMaterial, N as heightAt, lt as preloadFoliagePhotos, Ie as preloadTempleTextures, Ee as preloadTerrainTextures };
