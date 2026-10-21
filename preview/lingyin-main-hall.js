import * as e from "three";
import { OrbitControls as t } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader as n } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader as r } from "three/addons/loaders/DRACOLoader.js";
import { mergeGeometries as i } from "three/addons/utils/BufferGeometryUtils.js";
//#region src/world/geom.ts
function a(t) {
	if (!t.getAttribute("uv")) {
		let n = t.getAttribute("position").count;
		t.setAttribute("uv", new e.BufferAttribute(new Float32Array(n * 2), 2));
	}
	return t;
}
function o(t, n, r, i = 0, o = 0, s = 0, c = 0) {
	let l = new e.BoxGeometry(t, n, r);
	return c && l.rotateY(c), l.translate(i, o, s), a(l);
}
function s(t, n, r, i, o = 0, s = 0, c = 0) {
	let l = new e.CylinderGeometry(t, n, r, i, 1, !1);
	return l.translate(o, s, c), a(l);
}
function c(e) {
	let t = e.filter((e) => e && e.getAttribute("position")?.count), n = t.every((e) => e.index !== null), r = i(t.map((e) => a(n ? e : e.index ? e.toNonIndexed() : e)), !1);
	if (!r) throw Error("merge failed");
	return r.computeBoundingSphere(), r;
}
function l(t, n) {
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
function u(t) {
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
function d(t) {
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
function f(e, t, n = .19, r = .055, i = 0) {
	let a = [];
	for (let s = -e / 2; s <= e / 2 + .001; s += n) a.push(o(r, t, .06, s, t / 2, i));
	for (let s = 0; s <= t + .001; s += n * 1.35) a.push(o(e, r, .055, 0, s, i));
	return {
		bars: c(a),
		backing: o(e, t, .04, 0, t / 2, i - .06)
	};
}
function p(t, n = 512, r = 160, i = {}) {
	let a = document.createElement("canvas");
	a.width = n, a.height = r;
	let o = a.getContext("2d");
	if (!o) throw Error("no 2d context");
	o.fillStyle = i.bg ?? "#221a14", o.fillRect(0, 0, n, r), i.border && (o.strokeStyle = i.border, o.lineWidth = 6, o.strokeRect(8, 8, n - 16, r - 16)), o.fillStyle = i.fg ?? "#d8b268", o.font = `600 ${Math.floor(r * .56)}px "Songti SC", "STSong", "Noto Serif SC", serif`, o.textAlign = "center", o.textBaseline = "middle", o.fillText(t, n / 2, r / 2 + 3);
	let s = new e.CanvasTexture(a);
	return s.colorSpace = e.SRGBColorSpace, s.anisotropy = 4, s;
}
//#endregion
//#region src/core/math.ts
var m = (e, t, n) => e + (t - e) * n, h = 2.45;
h + .27, h + 1.45;
//#endregion
//#region src/world/heightfield.ts
var g = {
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
}, _ = [
	[46, -120],
	[43, -82],
	[40, -48],
	[37, -16],
	[36, 10],
	[35, 28],
	[31, 44],
	[24, 56],
	[18, 66]
];
(() => {
	let e = [];
	for (let t = 0; t < _.length - 1; t++) {
		let n = _[t], r = _[t + 1];
		for (let t = 0; t < 12; t++) e.push([m(n[0], r[0], t / 12), m(n[1], r[1], t / 12)]);
	}
	return e.push(_[_.length - 1]), e;
})(), g.pond.y;
//#endregion
//#region src/core/materials.ts
var v = "\nfloat cgHash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }\nfloat cgHash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }\nvec3 cgHash33(vec3 p3){ p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }\nfloat cgNoise2(vec2 p){\n  vec2 i = floor(p), f = fract(p);\n  f = f * f * (3.0 - 2.0 * f);\n  float a = cgHash12(i), b = cgHash12(i + vec2(1,0)), c = cgHash12(i + vec2(0,1)), d = cgHash12(i + vec2(1,1));\n  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);\n}\nfloat cgNoise3(vec3 p){\n  vec3 i = floor(p), f = fract(p);\n  f = f * f * (3.0 - 2.0 * f);\n  float n000 = cgHash12(i.xy + i.z * 19.19);\n  float n100 = cgHash12(i.xy + vec2(1,0) + i.z * 19.19);\n  float n010 = cgHash12(i.xy + vec2(0,1) + i.z * 19.19);\n  float n110 = cgHash12(i.xy + vec2(1,1) + i.z * 19.19);\n  float n001 = cgHash12(i.xy + (i.z + 1.0) * 19.19);\n  float n101 = cgHash12(i.xy + vec2(1,0) + (i.z + 1.0) * 19.19);\n  float n011 = cgHash12(i.xy + vec2(0,1) + (i.z + 1.0) * 19.19);\n  float n111 = cgHash12(i.xy + vec2(1,1) + (i.z + 1.0) * 19.19);\n  return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y), mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);\n}\nfloat cgFbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i=0;i<5;i++){ s += a * cgNoise2(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }\nfloat cgFbm3(vec3 p){ float s = 0.0, a = 0.5; for (int i=0;i<4;i++){ s += a * cgNoise3(p); p = p * 2.05 + 7.3; a *= 0.5; } return s; }\nfloat cgRidge2(vec2 p){ float s = 0.0, a = 0.55; for (int i=0;i<4;i++){ float n = 1.0 - abs(cgNoise2(p) * 2.0 - 1.0); s += a * n * n; p = p * 2.1 + 3.1; a *= 0.5; } return s; }\n// anti-aliased thin line: distance d in world units, width w, pixel footprint aa\nfloat cgLine(float d, float w, float aa){ return 1.0 - smoothstep(w, w + aa, abs(d)); }\n", y = "\nvarying vec3 vCgWorld;\nvarying vec3 vCgNormalW;\nvarying vec3 vCgObj;\nvarying float vCgSeed;\n", b = "\n{\n  vec4 cgP = vec4(transformed, 1.0);\n  vec3 cgN = objectNormal;\n  float cgSeedV = 0.0;\n  #ifdef USE_INSTANCING\n    cgP = instanceMatrix * cgP;\n    cgN = mat3(instanceMatrix) * cgN;\n    cgSeedV = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);\n  #endif\n  vCgWorld = (modelMatrix * cgP).xyz;\n  vCgNormalW = normalize(mat3(modelMatrix) * cgN);\n  vCgObj = transformed;\n  vCgSeed = cgSeedV;\n}\n";
function x(t = {}) {
	let n = new e.MeshStandardMaterial(t.params ?? {});
	t.name && (n.name = t.name);
	let r = t.uniforms ?? {}, i = "proc:" + S([
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
		n = n.replace("#include <common>", `#include <common>\n${y}\n${t.vertexHead ?? ""}`), t.vertexPre && (n = n.replace("#include <begin_vertex>", `#include <begin_vertex>\n{\n${t.vertexPre}\n}`)), n = n.replace("#include <worldpos_vertex>", `#include <worldpos_vertex>\n${b}`), i = i.replace("#include <common>", `#include <common>\n${y}\n${v}\n${t.head ?? ""}`), i = i.replace("void main() {", "void main() {\nvec3 cgP = vCgWorld; vec3 cgN = normalize(vCgNormalW); vec3 cgO = vCgObj; float cgSeed = vCgSeed; vec3 cgBump = vec3(0.0); float cgAO = 1.0;"), t.color && (i = i.replace("#include <color_fragment>", `#include <color_fragment>\n{\n${t.color}\n}`)), t.roughness && (i = i.replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>\n{\n${t.roughness}\n}`)), t.metalness && (i = i.replace("#include <metalnessmap_fragment>", `#include <metalnessmap_fragment>\n{\n${t.metalness}\n}`)), t.normal && (i = i.replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\n{\n${t.normal}\n}\nnormal = normalize(normal + (viewMatrix * vec4(cgBump, 0.0)).xyz);`)), t.emissive && (i = i.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n{\n${t.emissive}\n}`)), t.ao && (i = i.replace("#include <aomap_fragment>", `#include <aomap_fragment>\n{\n${t.ao}\n}\nreflectedLight.indirectDiffuse *= cgAO; reflectedLight.indirectSpecular *= mix(1.0, cgAO, 0.7);`)), e.vertexShader = n, e.fragmentShader = i;
	}, n;
}
function S(e) {
	let t = 2166136261;
	for (let n = 0; n < e.length; n++) t ^= e.charCodeAt(n), t = Math.imul(t, 16777619);
	return (t >>> 0).toString(36);
}
//#endregion
//#region src/world/materials.ts
var C = null, w = null, T = null, E = null, D = {}, O = /* @__PURE__ */ new Map(), k = [
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
].filter((e) => !e.startsWith("courtyard-") && e !== "plaque-gate");
function A(t) {
	let n = O.get(t);
	if (n) return n;
	let r = new URL(`./assets/lingyin/temple-textures/${t}.webp`, document.baseURI).href + "?v=3", i = new e.TextureLoader().loadAsync(r).then((n) => {
		n.name = `lingyin-${t}`, n.colorSpace = t.endsWith("albedo") || t.startsWith("plaque-") ? e.SRGBColorSpace : e.NoColorSpace, n.wrapS = n.wrapT = t.startsWith("plaque-") ? e.ClampToEdgeWrapping : e.RepeatWrapping, n.minFilter = e.LinearMipmapLinearFilter, n.magFilter = e.LinearFilter, n.anisotropy = 8, D[t] = n;
	});
	return O.set(t, i), i;
}
function j() {
	return Promise.all(k.map(A)).then(() => {});
}
function ee(e) {
	return D[`plaque-${e}`];
}
function M(t, n, r, i, a, o) {
	let s = D[n];
	return s ? new e.MeshStandardMaterial({
		name: t,
		map: s,
		normalMap: D[r],
		normalScale: new e.Vector2(o, o),
		roughnessMap: D[i],
		roughness: a,
		metalness: 0
	}) : null;
}
function N() {
	if (T) return T;
	let t = document.createElement("canvas");
	t.width = t.height = 256;
	let n = t.getContext("2d"), r = n.createImageData(256, 256), i = 1919509349, a = () => ((i = Math.imul(i, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
	for (let e = 0; e < 256; e++) for (let t = 0; t < 256; t++) {
		let n = Math.sin(t * .36 + e * .015) * .012, i = Math.max(.78, Math.min(.96, .88 + (a() - .5) * .065 + n)), o = (e * 256 + t) * 4;
		r.data[o] = Math.round(i * 255), r.data[o + 1] = Math.round(i * 248), r.data[o + 2] = Math.round(i * 230), r.data[o + 3] = 255;
	}
	return n.putImageData(r, 0, 0), T = new e.CanvasTexture(t), T.colorSpace = e.SRGBColorSpace, T.minFilter = e.LinearMipmapLinearFilter, T.magFilter = e.LinearFilter, T.anisotropy = 8, T;
}
function P() {
	if (w) return w;
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
	return n.putImageData(r, 0, 0), w = new e.CanvasTexture(t), w.colorSpace = e.SRGBColorSpace, w.wrapS = w.wrapT = e.RepeatWrapping, w.minFilter = e.LinearMipmapLinearFilter, w.magFilter = e.LinearFilter, w.anisotropy = 8, w;
}
function F() {
	if (C) return C;
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
	return d.colorSpace = e.SRGBColorSpace, d.wrapS = d.wrapT = e.RepeatWrapping, d.minFilter = e.LinearMipmapLinearFilter, d.magFilter = e.LinearFilter, d.anisotropy = 8, C = new e.MeshStandardMaterial({
		name: "weathered-stone-slabs",
		map: d,
		bumpMap: d,
		bumpScale: .048,
		roughness: .94,
		metalness: 0,
		vertexColors: !0
	}), C;
}
function I(t, n) {
	let r = t.getAttribute("position").count, i = new Float32Array(r * 3);
	for (let e = 0; e < r; e++) {
		let t = n * (.96 + e % 3 * .04);
		i[e * 3] = t, i[e * 3 + 1] = t * .992, i[e * 3 + 2] = t * .978;
	}
	return t.setAttribute("color", new e.BufferAttribute(i, 3)), t;
}
function te(e = 0) {
	let t = M("stone-photogrammetry", "stone-albedo", "stone-normal", "stone-roughness", .98, .23);
	return t ? (t.color.set(e > .5 ? 14076600 : 16777215), t) : x({
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
function L() {
	let t = D["roof-albedo"], n = D["roof-normal"];
	if (t && n) return t.repeat.set(1 / 5, 1 / 5), n.repeat.set(1 / 5, 1 / 5), new e.MeshStandardMaterial({
		name: "roof-tile-photogrammetry",
		map: t,
		normalMap: n,
		normalScale: new e.Vector2(.28, .28),
		roughness: .86,
		metalness: .02,
		side: e.DoubleSide
	});
	if (!E) {
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
		n.putImageData(r, 0, 0), E = new e.CanvasTexture(t), E.name = "baked-weathered-roof-tiles", E.colorSpace = e.SRGBColorSpace, E.wrapS = E.wrapT = e.RepeatWrapping, E.repeat.set(1 / (12 * .34), 1 / (8 * .52)), E.minFilter = e.LinearMipmapLinearFilter, E.magFilter = e.LinearFilter, E.anisotropy = 8;
	}
	return new e.MeshStandardMaterial({
		name: "roof-tile-baked",
		map: E,
		bumpMap: E,
		bumpScale: .045,
		roughness: .82,
		metalness: .02,
		side: e.DoubleSide
	});
}
function R() {
	let e = M("plaster-photogrammetry", "plaster-albedo", "plaster-normal", "plaster-roughness", .98, .18);
	if (e) return e;
	let t = P();
	return x({
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
function z(e = !1) {
	return M(e ? "aged-wood" : "red-lacquer-wood", e ? "wood-albedo" : "wood-red-albedo", "wood-normal", "wood-roughness", .82, .16) || x({
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
function B() {
	return x({
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
function V() {
	return x({
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
function H() {
	return x({
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
function U() {
	return M("teal-painted-wood", "wood-teal-albedo", "wood-normal", "wood-roughness", .9, .12) || x({
		name: "dougong",
		params: {
			color: 16777215,
			roughness: .6,
			metalness: .02
		},
		color: "\n      float n = cgNoise2(cgP.xz * 5.0 + cgP.y * 2.0);\n      vec3 teal = mix(vec3(0.035,0.095,0.085), vec3(0.09,0.17,0.145), n);\n      float gold = smoothstep(0.75, 0.95, cgNoise2(cgP.xz * 9.0));\n      vec3 c = mix(teal, vec3(0.55,0.40,0.16), gold * 0.55);\n      diffuseColor.rgb = c;\n    "
	});
}
function ne() {
	return new e.MeshStandardMaterial({
		color: new e.Color("#2a1a0c"),
		emissive: new e.Color("#8a4a1e"),
		emissiveIntensity: .03,
		roughness: .9
	});
}
function re() {
	return new e.MeshStandardMaterial({
		color: new e.Color("#7e1e18"),
		emissive: new e.Color("#ff5a2a"),
		emissiveIntensity: .3,
		roughness: .7
	});
}
//#endregion
//#region src/world/temple.ts
var ie = class {
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
		let n = g.platform.y;
		this.materials = {
			stone: te(.2),
			floor: F(),
			wall: R(),
			paper: new e.MeshStandardMaterial({
				color: 12958628,
				map: N(),
				bumpMap: N(),
				bumpScale: .009,
				roughness: .96,
				metalness: 0,
				side: e.DoubleSide
			}),
			gatePlaster: new e.MeshStandardMaterial({
				color: 12946786,
				map: N(),
				roughness: .96,
				metalness: 0,
				emissive: 5122580,
				emissiveIntensity: .16
			}),
			wood: z(!1),
			woodDark: z(!0),
			dougong: U(),
			roof: L(),
			mainRoof: L(),
			gateRoof: L(),
			gold: B(),
			bronze: H(),
			lattice: z(!0),
			lantern: re(),
			window: ne(),
			dark: new e.MeshStandardMaterial({
				color: 1183500,
				roughness: 1
			})
		}, this.materials.gateRoof.color.set("#aab89a"), t.onlyMainHall || (this.buildPlatform(n), this.buildHall({
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
		let t = g.platform;
		this.add("stone", o(2.2, .5, 1, t.x0, e - .05, 0, 0)), this.add("stone", o(2.2, .5, 1, t.x1, e - .05, 0, 0)), this.add("stone", o(t.x1 - t.x0 + 2.2, .5, 1.2, (t.x0 + t.x1) / 2, e - .05, t.z1)), this.add("stone", o(t.x1 - t.x0 + 2.2, .5, 1.2, (t.x0 + t.x1) / 2, e - .05, t.z0));
		for (let n = 0; n < 6; n++) this.add("stone", o(9 - n * .25, .19, .5, -2, e - .2 - n * .19, t.z1 + .6 + n * .48));
		for (let n = 0; n < 5; n++) this.add("stone", o(.55, .2, 5.2, t.x1 + .4 + n * .5, e - .2 - n * .2, 28));
		for (let n of [-1, 1]) {
			let r = n < 0 ? t.x0 + 1 : 6, i = n < 0 ? -8 : t.x1 - 1;
			this.balustrade(r, i, t.z1 - .3, e + .1, "x");
		}
		this.balustrade(-8, -5, t.z1 - .3, e + .1, "x"), this.balustrade(1, 6, t.z1 - .3, e + .1, "x");
		for (let n of [-5, 1]) this.add("stone", o(.55, 1.22, .55, n, e + .62, t.z1 - .3));
	}
	balustrade(e, t, n, r, i, a = !1) {
		let s = Math.abs(t - e);
		if (s < 1) return;
		let c = Math.max(2, Math.round(s / 2.4));
		for (let a = 0; a <= c; a++) {
			let l = a / c, u = e + (t - e) * l, d = i === "x" ? u : n, f = i === "x" ? n : u;
			if (this.add("stone", o(.24, .95, .24, d, r + .475, f)), this.add("stone", o(.34, .12, .34, d, r + .98, f)), a < c) {
				let l = (a + .5) / c, u = e + (t - e) * l, d = i === "x" ? u : n, f = i === "x" ? n : u, p = i === "x" ? s / c : .14, m = i === "x" ? .14 : s / c;
				this.add("stone", o(p, .16, m, d, r + .74, f));
			}
		}
	}
	buildHall(t) {
		let n = t.name === "gate", r = t.eave - t.plinth, i = t.w / 2, a = t.d / 2, c = {
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
		}, l = (e, t) => c[e].push(t);
		l("stone", o(t.w + 2.4, t.plinth + .25, t.d + 2.4, 0, (t.plinth + .25) / 2, 0)), l("stone", o(t.w + 2.9, .16, t.d + 2.9, 0, .1, 0));
		for (let e = 0; e < 5; e++) l("stone", o(5, .16, .42, 0, .16 + e * .16, a + 1.35 + (4 - e) * .4 + (t.plinth - .8) * .25)), t.name === "gate" && l("stone", o(5, .16, .42, 0, .16 + e * .16, -a - 1.35 - (4 - e) * .4));
		let m = Math.max(3, Math.round(t.w / 3.4)), h = Math.max(2, Math.round(t.d / 3.6)), _ = r - .35;
		for (let e of [-1, 1]) for (let r = 0; r <= m; r++) {
			let o = -i + 1 + (t.w - 2) * r / m;
			t.name === "main" && e === 1 && Math.abs(o) < 1.6 || t.name === "gate" && Math.abs(o) < 1 || this.column(c, o, .25, e * (a - .9), n && Math.abs(o) > 4 ? 3.7 : _);
		}
		for (let e of [-1, 1]) for (let r = 1; r < h; r++) {
			let o = -a + 1 + (t.d - 2) * r / h;
			this.column(c, e * (i - .9), .25, o, n ? 3.7 : _);
		}
		let v = n ? 3.55 : _ - .4, y = .3, b = .25 + v / 2, x = 1.35, S = (e, n, r, i) => l("stone", o(e + .04, .22, n + .085, r, t.plinth + .3, i));
		if (t.openFront) {
			let e = i - 2.05;
			for (let t of [-1, 1]) l("wall", o(3.8, v, y, t * e, b, a - x)), S(3.8, y, t * e, a - x);
		} else {
			let e = t.name === "main" ? 5.4 : t.name === "rear" ? 4.6 : 3.4, n = (t.w - x * 2 - e) / 2;
			l("wall", o(n, v, y, -(e / 2 + n / 2), b, a - x)), l("wall", o(n, v, y, e / 2 + n / 2, b, a - x)), S(n, y, -(e / 2 + n / 2), a - x), S(n, y, e / 2 + n / 2, a - x), t.name === "main" && t.studyFacade || l("wood", o(e + .3, .35, y + .1, 0, .25 + v, a - x));
		}
		if (t.openFront || t.name === "west") {
			let e = t.name === "west" ? 3.4 : 4.6, n = (t.w - x * 2 - e) / 2;
			for (let t of [-1, 1]) l("wall", o(n, v, y, t * (e / 2 + n / 2), b, -a + x));
			for (let t of [-1, 1]) S(n, y, t * (e / 2 + n / 2), -a + x);
			l("wood", o(e + .3, .35, .42, 0, .25 + v, -a + x));
		} else l("wall", o(t.w - x * 2, v, y, 0, b, -a + x)), S(t.w - x * 2, y, 0, -a + x);
		for (let e of [-1, 1]) {
			l("wall", o(y, v, t.d - x * 2, e * (i - x), b, 0)), S(y, t.d - x * 2, e * (i - x), 0);
			let n = Math.min(1.7, v * .5), r = f(Math.min(3.4, t.d * .32), n, .22, .05, .02);
			r.bars.rotateY(e * Math.PI / 2), r.backing.rotateY(e * Math.PI / 2), r.bars.translate(e * (i - x + .18), b + .15, 0), r.backing.translate(e * (i - x + .1), b + .15, 0), l("lattice", r.bars), l("window", r.backing);
		}
		if (!t.openFront) {
			let n = t.w > 20 ? 5 : 3, r = (t.w - 2.2) / n, s = Math.floor(n / 2), c = Array.from({ length: n }, (e, t) => t);
			for (let n of c) {
				let c = -i + 1.1 + r * (n + .5), u = r - .35, d = Math.min(v - .55, 3.5);
				if (n === s) {
					l("gold", o(.16, d, .2, c - u / 2 - .1, .25 + d / 2, a - x + .2)), l("gold", o(.16, d, .2, c + u / 2 + .1, .25 + d / 2, a - x + .2)), t.name === "main" && t.studyFacade || l("gold", o(u + .2, .18, .2, c, .25 + d + .12, a - x + .2));
					continue;
				}
				let p = f(u, d, .17, .055, a - x + .18);
				p.bars.translate(c, 0, 0), p.backing.translate(c, 0, 0), l("lattice", p.bars), l("woodDark", p.backing), l("wood", o(u + .18, .16, .24, c, .25 + d + .1, a - x + .18)), l("wood", o(.16, d + .2, .24, c - u / 2 - .09, .25 + d / 2, a - x + .18)), l("wood", o(.16, d + .2, .24, c + u / 2 + .09, .25 + d / 2, a - x + .18)), l("woodDark", o(u, d * .34, .1, c, .25 + d * .17, a - x + .1));
				for (let t = -2; t <= 2; t++) for (let n = 0; n < 2; n++) l("gold", new e.SphereGeometry(.035, 6, 4).translate(c + t * .62, 1 + n * .32, a - x + .06));
			}
		}
		if (t.name === "main") {
			let e = .45, n = t.w / 2 + 1.2, r = t.d / 2 + 1.45;
			for (let t = 0; t <= 14; t++) {
				let i = -n + 2 * n * t / 14;
				Math.abs(i) < 3.6 || (l("stone", o(.24, .9, .24, i, e + .45, r)), l("stone", o(.26, .1, .26, i, e + .92, r)));
			}
			for (let t = 0; t <= 10; t++) {
				let i = -r + 2 * r * t / 10;
				for (let t of [-1, 1]) l("stone", o(.24, .9, .24, t * n, e + .45, i)), l("stone", o(.26, .1, .26, t * n, e + .92, i));
			}
			for (let t of [-1, 1]) l("stone", o(.16, .16, 2 * r, t * n, e + .8, 0));
			for (let t of [-1, 1]) l("stone", o(n - 3.6, .16, .16, t * (n + 3.6) / 2, e + .8, r));
		}
		let C = t.w - x * 2 - .55, w = t.d - x * 2 - .55, T = t.plinth + .25, E = 1.35, D = Math.floor(C / E), O = Math.floor(w / E);
		for (let e = 0; e < O; e++) for (let t = 0; t < D; t++) {
			let n = -C / 2 + (t + .5) * C / D, r = -w / 2 + (e + .5) * w / O, i = (t * 11 + e * 7) % 7 * .002;
			l("floor", I(o(C / D - .018, .045, w / O - .018, n, T + .005 + i, r), .82 + (t * 13 + e * 7) % 11 * .022));
		}
		for (let e of [-1, 1]) {
			l("woodDark", o(.11, .44, w, e * C / 2, T + .22, 0)), l("bronze", o(.025, .035, w, e * C / 2, T + .45, 0));
			for (let t of [-w * .24, w * .24]) {
				let n = f(Math.min(2.5, w * .32), 2.1, .26, .055, 0);
				n.bars.rotateY(Math.PI / 2), n.backing.rotateY(Math.PI / 2), n.bars.translate(e * (i - x - .23), T + .77, t), n.backing.translate(e * (i - x - .27), T + .77, t), l("lattice", n.bars), l("paper", n.backing);
			}
		}
		for (let e of [-w / 2, w / 2]) if (e > 0 || t.name === "gate" || t.name === "west") {
			let n = t.name === "main" ? 5.4 : t.name === "rear" || t.name === "gate" ? 4.6 : 3.4, r = (C - n) / 2;
			for (let t of [-1, 1]) {
				let i = t * (n / 2 + r / 2);
				l("woodDark", o(r, .44, .11, i, T + .22, e)), l("bronze", o(r, .035, .025, i, T + .45, e));
			}
		} else l("woodDark", o(C, .44, .11, 0, T + .22, e)), l("bronze", o(C, .035, .025, 0, T + .45, e));
		let k = Math.max(T + 2.9, r - .35);
		for (let e = 0; !n && e < Math.max(2, Math.floor(w / 3.4)); e++) {
			let t = -w / 2 + (e + .5) * w / Math.max(2, Math.floor(w / 3.4));
			l("wood", o(C + .2, .2, .24, 0, k, t));
			for (let e of [-C / 3, C / 3]) l("dougong", o(.4, .32, .4, e, k - .25, t));
		}
		if (t.name !== "gate" && t.name !== "main" && t.name !== "west") {
			let t = -a + 2.7, n = Math.min(5.5, C * .62);
			l("woodDark", o(n, .16, 1.22, 0, T + .93, t)), l("bronze", o(n + .12, .07, 1.3, 0, T + 1.04, t)), l("woodDark", o(n - .35, .13, 1.05, 0, T + .26, t));
			for (let e of [-1, 1]) for (let r of [-1, 1]) {
				let i = e * (n / 2 - .24), a = t + r * .42;
				l("wood", o(.22, .78, .22, i, T + .45, a)), l("bronze", o(.24, .06, .24, i, T + .83, a));
			}
			l("gold", o(n - .4, .055, .055, 0, T + .73, t + .59)), l("wood", o(n + .3, 2.7, .22, 0, T + 2.35, t - .72)), l("gold", s(.5, .58, .13, 20, 0, T + 1.2, t)), l("gold", s(.34, .51, .63, 20, 0, T + 1.58, t)), l("gold", new e.SphereGeometry(.29, 18, 14).translate(0, T + 2.03, t)), l("gold", new e.TorusGeometry(.44, .045, 8, 28).translate(0, T + 1.99, t - .24));
			for (let r of [-1, 1]) l("bronze", s(.085, .11, .55, 10, r * Math.min(1.75, n * .32), T + 1.24, t + .1)), l("lantern", new e.SphereGeometry(.12, 10, 8).translate(r * Math.min(1.75, n * .32), T + 1.56, t + .1));
			for (let e of [-1, 1]) {
				let r = e * n * .34;
				l("bronze", s(.14, .22, .28, 12, r, T + 1.2, t + .3));
				for (let e = 0; e < 3; e++) l("woodDark", s(.012, .015, .55 + e * .08, 6, r + (e - 1) * .045, T + 1.56, t + .3));
			}
		}
		if (!n) {
			l("wood", o(t.w + .4, .42, .42, 0, r - .2, a - .9)), l("wood", o(t.w + .4, .42, .42, 0, r - .2, -a + .9));
			for (let e of [-1, 1]) l("wood", o(.42, .42, t.d - 1.6, e * (i - .9), r - .2, 0));
			l("wood", o(t.w + 1.4, .34, .7, 0, r + .05, a - .3)), l("wood", o(t.w + 1.4, .34, .7, 0, r + .05, -a + .3));
			let n = this.dougongCluster(), c = Math.max(3, Math.round(t.w / 2.3));
			for (let e = 0; e <= c; e++) {
				let o = -i + .9 + (t.w - 1.8) * e / c;
				for (let e of [-1, 1]) {
					let t = n.clone();
					t.translate(o, r - .05, e * (a - .75)), l("dougong", t);
				}
			}
			let u = Math.max(2, Math.round(t.d / 2.5));
			for (let e = 1; e < u; e++) {
				let o = -a + .9 + (t.d - 1.8) * e / u;
				for (let e of [-1, 1]) {
					let t = n.clone();
					t.rotateY(Math.PI / 2), t.translate(e * (i - .75), r - .05, o), l("dougong", t);
				}
			}
			let d = Math.round((t.w + 2) / .42);
			for (let e = 0; e <= d; e++) {
				let n = -i - .8 + (t.w + 1.6) * e / d;
				for (let t of [-1, 1]) {
					let i = o(.1, .12, 1.45, n, r + .02, t * (a + .45));
					i.rotateX(.12 * t), l(e % 2 ? "wood" : "dougong", i);
				}
			}
			let f = Math.round((t.d + 2) / .42);
			for (let e = 0; e <= f; e++) {
				let n = -a - .8 + (t.d + 1.6) * e / f;
				for (let t of [-1, 1]) {
					let a = o(1.45, .12, .1, t * (i + .45), r + .02, n);
					a.rotateZ(-.12 * t), l(e % 2 ? "wood" : "dougong", a);
				}
			}
			let p = Math.max(2, Math.round(t.w / 6));
			for (let n = 0; n <= p; n++) {
				let o = -i + 1.4 + (t.w - 2.8) * n / p, c = r - 1.05, u = a + .15, d = new e.SphereGeometry(.17, 10, 8);
				d.scale(1, 1.18, 1), d.translate(o, c, u), l("lantern", d), l("gold", s(.09, .09, .08, 8, o, c + .3, u)), l("gold", s(.09, .09, .08, 8, o, c - .3, u)), l("gold", s(.012, .012, .55, 4, o, c + .6, u));
			}
		}
		if (n) {
			let e = 9.1, n = r + .16;
			l("gateRoof", u({
				w: e,
				d: t.d,
				eaveY: n,
				rise: 3.05,
				cornerLift: .88,
				overhang: 1.25,
				nu: 34,
				nv: 14
			})), this.ridgeAndTips(c, e, t.d, n + 3.05, n), l("wood", o(8.9, .14, t.d + .35, 0, r - .1, 0));
			for (let e of [
				-3.45,
				-1.72,
				0,
				1.72,
				3.45
			]) l("woodDark", o(8.9, .2, .24, 0, r - .28, e));
			for (let e of [-3.65, 3.65]) l("woodDark", o(.22, .2, t.d + .35, e, r - .28, 0));
			l("woodDark", o(8.9, 2.1, .32, 0, r - 1.07, -a + 1.35));
			for (let e of [-1, 1]) {
				let n = u({
					w: 5.6,
					d: t.d,
					eaveY: 3.84,
					rise: 1.45,
					cornerLift: .52,
					overhang: 1.1,
					nu: 24,
					nv: 11
				});
				n.translate(e * 5.15, 0, 0), l("gateRoof", n), l("woodDark", o(6.1, .28, .42, e * 5.15, 3.62, a - .25)), l("woodDark", o(6.1, .28, .42, e * 5.15, 3.62, -a + .25));
			}
			for (let e of [-1, 1]) {
				for (let t of [-a + .82, a - .82]) l("woodDark", o(.62, r - .35, .7, e * 3.22, (r - .35) / 2 + .25, t));
				l("dougong", o(1.22, .29, 1.55, e * 3.22, r - .25, a - .25));
			}
			l("woodDark", o(8.9, .7, .7, 0, r - .63, a - .35)), l("wood", o(9.5, .3, .62, 0, r + .02, a - .3)), l("wood", o(9.5, .3, .62, 0, r + .02, -a + .3)), l("bronze", o(8.75, .05, .75, 0, r - .27, a - .35));
		} else if (t.double) {
			let e = t.studyFacade ? "mainRoof" : "roof";
			l(e, d({
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
			l("wall", o(t.w - 2.2, 3, t.d - 2.2, 0, r + 1.5, 0));
			for (let e = 0; e <= 12; e++) l("wood", o(.1, .7, .1, -i + 1.2 + (t.w - 2.4) * e / 12, r + .55, a - 1.05));
			l("wood", o(t.w - 2.4, .12, .14, 0, r + .9, a - 1.05));
			for (let e = 0; e < 5; e++) {
				let n = -i + 1.6 + (t.w - 3.2) * (e + .5) / 5, s = f((t.w - 3.2) / 5 - .25, 1.4, .24, .07, a - .95);
				s.bars.translate(n, r + 1.55, 0), s.backing.translate(n, r + 1.55, 0), l("lattice", s.bars), l("window", s.backing);
				for (let e = 0; e <= 4; e++) l("wood", o(.08, 1.4, .12, n - (t.w - 3.2) / 10 + e * ((t.w - 3.2) / 20), r + 1.55 + .7, a - .88));
			}
			l("wood", o(t.w + .6, .35, .5, 0, n, a - .7)), l("wood", o(t.w + .6, .35, .5, 0, n, -a + .7)), l(e, u({
				w: t.w - 1.4,
				d: t.d - 1.4,
				eaveY: n + .2,
				rise: t.rise + .4,
				cornerLift: .95,
				overhang: 1.45,
				nu: 38,
				nv: 16
			})), this.ridgeAndTips(c, t.w - 1.4, t.d - 1.4, n + .2 + t.rise + .4, n + .2, e);
		} else l("roof", u({
			w: t.w,
			d: t.d,
			eaveY: r + .15,
			rise: t.rise,
			cornerLift: .9,
			overhang: 1.25,
			nu: 36,
			nv: 15
		})), this.ridgeAndTips(c, t.w, t.d, r + .15 + t.rise, r + .15);
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
				a.rotateX(Math.PI / 2), a.translate(i, t.y, t.z), l("gateRoof", a);
			}
		}
		else if (!t.studyFacade) {
			let n = t.double ? r + 2.1 : r + .15, i = t.w / 2 + 1.1, a = Math.round(i * 2 / .34);
			for (let r = 0; r <= a; r++) {
				let o = -i + 2 * i * r / a;
				for (let r of [-1, 1]) {
					let i = new e.CylinderGeometry(.075, .075, .05, 8);
					i.rotateX(Math.PI / 2), i.translate(o, n - .06, r * (t.d / 2 + 1.1)), l("roof", i);
				}
			}
		}
		for (let t of n ? [] : [-1, 1]) for (let n of [-1, 1]) {
			let o = 1.15;
			l("bronze", s(.14, .2, .5, 8, t * (i + o), r - .55, n * (a + o))), l("bronze", new e.SphereGeometry(.09, 8, 6).translate(t * (i + o), r - .85, n * (a + o)));
		}
		if (n) {
			for (let e of [-1, 1]) {
				let t = e * (i - 2.2), n = a - x + .23;
				l("gatePlaster", o(2.42, 2.57, .045, t, 2.02, n - .08));
				let r = f(1.64, 1.67, .21, .065, n + .05);
				r.bars.translate(t, 1.25, 0), r.backing.translate(t, 1.25, 0), l("lattice", r.bars), l("woodDark", r.backing);
				for (let e of [-1.23, 1.23]) l("woodDark", o(.13, 2.72, .16, t + e, 1.98, n + .025));
				for (let e of [.63, 3.34]) l("woodDark", o(2.58, .13, .16, t, e, n + .025));
			}
			l("woodDark", o(8.9, .5, .22, 0, r - 1.06, a + .3));
		}
		if (t.plaque) {
			let n = t.name === "gate" || t.name === "main" ? ee(t.name) : void 0, i = n ?? p(t.plaque, 512, 150, {
				bg: "#17130f",
				fg: "#d9b46b",
				border: "#7b5a2a"
			}), s = n ? new e.MeshStandardMaterial({
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
			}), c = t.name === "main" && t.studyFacade, u = t.name === "gate" ? 1.18 : 1.45, d = c ? r + 2.03 : .25 + Math.min(v - .55, 3.5) + u, f = c ? a - .71 : a + (t.name === "gate" ? .62 : -.35), m = c ? 5.5 : 4.2, h = c ? 1.52 : 1.2, _ = new e.Mesh(new e.PlaneGeometry(m, h), s);
			if (_.position.set(t.x, g.platform.y + d, t.z + f), _.castShadow = !1, _.name = `plaque-${t.name}`, this.group.add(_), c) {
				l("woodDark", o(m + .36, h + .3, .17, 0, d, f - .16));
				for (let e of [-1, 1]) l("gold", o(m + .34, .055, .05, 0, d + e * (h / 2 + .11), f - .055)), l("gold", o(.055, h + .22, .05, e * (m / 2 + .12), d, f - .055));
			} else l("gold", o(4.5, 1.45, .16, 0, d, a + (t.name === "gate" ? .48 : -.48)));
		}
		let A = t.rotY ?? 0, j = Math.cos(A), M = Math.sin(A);
		for (let e of Object.keys(c)) for (let n of c[e]) A && n.rotateY(A), n.translate(t.x, g.platform.y, t.z), this.roles[e].push(n);
		let N = new e.PointLight(16758647, t.name === "main" ? 6 : n ? 4.4 : 2.8, t.name === "main" ? 18 : n ? 12 : 10, 2);
		N.position.set(t.x, g.platform.y + (n ? 4.1 : Math.max(3.2, t.plinth + 2.3)), t.z), this.group.add(N), this.anchors.eaves.push(new e.Vector3(t.x + M * (a + 1), g.platform.y + r, t.z + j * (a + 1))), t.name === "main" && this.anchors.door.set(t.x, g.platform.y + 1.6, t.z + a + 1.5);
	}
	column(e, t, n, r, i) {
		e.stone.push(s(.4, .46, .24, 10, t, n + .06, r)), e.wood.push(s(.27, .33, i - .24, 12, t, n + .24 + (i - .24) / 2, r)), e.gold.push(s(.31, .31, .08, 12, t, n + i - .16, r)), e.bronze.push(s(.33, .33, .05, 12, t, n + .36, r));
	}
	dougongCluster() {
		let e = [];
		return e.push(o(.42, .36, .42, 0, .18, 0)), e.push(o(1.5, .2, .3, 0, .46, 0)), e.push(o(.3, .2, 1.1, 0, .46, .2)), e.push(o(.46, .22, .46, -.45, .67, 0)), e.push(o(.46, .22, .46, 0, .67, 0)), e.push(o(.46, .22, .46, .45, .67, 0)), e.push(o(.22, .2, .9, 0, .67, 0)), c(e);
	}
	ridgeAndTips(t, n, r, i, a, c = "roof") {
		let l = n * .52 / 2;
		t[c].push(o(l * 2 + .6, .42, .42, 0, i + .18, 0));
		for (let e of [-1, 1]) {
			t[c].push(o(.34, 1.15, .4, e * (l + .35), i + .55, 0));
			let n = o(.28, .9, .34, e * (l + .55), i + 1.05, .1);
			n.rotateZ(-e * .35), t[c].push(n);
		}
		let u = n / 2 + 1.15, d = r / 2 + 1.15;
		for (let n of [-1, 1]) for (let r of [-1, 1]) {
			let o = new e.Vector3(n * l, i + .1, 0), s = new e.Vector3(n * u, a + .35, r * d).clone().sub(o), f = s.length(), p = new e.BoxGeometry(.34, f, .28);
			p.translate(0, f / 2, 0);
			let m = new e.Quaternion().setFromUnitVectors(new e.Vector3(0, 1, 0), s.normalize());
			p.applyQuaternion(m), p.translate(o.x, o.y, o.z), t[c].push(p);
		}
		let f = n / 2 + 1.15, p = r / 2 + 1.15;
		for (let n of [-1, 1]) for (let r of [-1, 1]) {
			let i = s(.05, .2, 1.15, 6, 0, 0, 0);
			i.rotateZ(-n * .55), i.rotateX(r * .3), i.translate(n * f, a + .45, r * p), t[c].push(i), t.gold.push(new e.SphereGeometry(.11, 8, 6).translate(n * f, a + .95, r * p));
		}
	}
	buildPagoda(t, n, r) {
		this.addAt("stone", s(3.1, 3.4, .7, 8), t, r + .35, n);
		let i = r + .7, a = 2.1;
		for (let e = 0; e < 5; e++) {
			let r = 2.25 - e * .1;
			this.addAt("stone", s(a - .12, a, r, 8), t, i + r / 2, n), this.addAt("dark", o(.7, 1.25, .2, 0, 0, 0), t, i + .75, n + a - .02), this.addAt("stone", s(a + .85, a + .2, .36, 8), t, i + r + .18, n), this.addAt("stone", s(a + .1, a + .1, .16, 8), t, i + r + .42, n);
			for (let e = 0; e < 8; e++) {
				let o = e / 8 * Math.PI * 2 + Math.PI / 8, c = s(.03, .1, .55, 5, 0, 0, 0);
				c.rotateZ(.7), c.rotateY(-o), c.translate(t + Math.cos(o) * (a + .85), i + r + .45, n + Math.sin(o) * (a + .85)), this.add("stone", c);
			}
			i += r + .5, a *= .87;
		}
		this.addAt("gold", s(.12, .3, 1.6, 8), t, i + .8, n);
		for (let r = 0; r < 4; r++) this.addAt("gold", new e.SphereGeometry(.22 - r * .03, 10, 8), t, i + .4 + r * .3, n);
		this.addAt("gold", new e.SphereGeometry(.16, 8, 6), t, i + 1.7, n);
	}
	buildEnclosure(t) {
		let n = g.platform, r = 1.5, i = .38, a = (e, n, a, s) => {
			let c = Math.hypot(a - e, s - n), l = Math.atan2(a - e, s - n);
			this.add("stone", o(.55, .35, c, (e + a) / 2, t + .17, (n + s) / 2, l)), this.add("wall", o(i, r, c, (e + a) / 2, t + .35 + r / 2, (n + s) / 2, l)), this.add("roof", o(i + .55, .18, c, (e + a) / 2, t + .35 + r + .09, (n + s) / 2, l)), this.add("roof", o(i + .2, .16, c, (e + a) / 2, t + .35 + r + .24, (n + s) / 2, l));
		};
		a(n.x0 + .5, n.z0 + 1, n.x0 + .5, 3.8), a(n.x0 + .5, 10.2, n.x0 + .5, n.z1 - 1);
		for (let e of [3.8, 10.2]) this.add("stone", o(.75, 3.7, .75, n.x0 + .5, t + 1.85, e));
		this.add("roof", o(1.25, .35, 7.1, n.x0 + .5, t + 4, 7)), this.add("wood", o(.22, .4, 2, n.x0 + .05, t + 3.45, 7));
		let c = new e.Mesh(new e.PlaneGeometry(1.76, .34), new e.MeshStandardMaterial({
			map: p("西山道", 512, 128, {
				bg: "#302923",
				fg: "#d4b674",
				border: "#8f7755"
			}),
			roughness: .88,
			side: e.DoubleSide
		}));
		c.rotation.y = Math.PI / 2, c.position.set(n.x0 + .2, t + 3.45, 7), this.group.add(c), this.add("stone", o(4.25, .95, 3.2, -34.25, t + .475, 7)), this.add("floor", I(o(4.3, .06, 3.25, -34.25, t + .98, 7), .92)), a(n.x0 + .5, n.z0 + 1, n.x1 - .5, n.z0 + 1), a(n.x1 - .5, n.z0 + 1, n.x1 - .5, 23), a(n.x1 - .5, 33, n.x1 - .5, n.z1 - 1), this.add("wood", o(.4, 3.2, 1, n.x1 - .5, t + 2, 23.4)), this.add("wood", o(.4, 3.2, 1, n.x1 - .5, t + 2, 32.6)), this.add("roof", o(1.9, .3, 10.4, n.x1 - .5, t + 3.75, 28));
		for (let r of [-1, 1]) {
			let i = 28 + r * 2.2;
			this.add("wood", o(.22, 2.72, 4.38, n.x1 - .5, t + 1.71, i));
			for (let e of [-1.98, 1.98]) this.add("bronze", o(.3, 2.8, .13, n.x1 - .63, t + 1.71, i + e));
			for (let e of [
				.64,
				1.55,
				2.48
			]) this.add("bronze", o(.3, .15, 4.25, n.x1 - .63, t + e, i));
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
			this.add("bronze", s(.09, .09, .055, 8, n.x1 - .72, t + 1.55, i - r * 1.62));
		}
	}
	buildBuddha(t) {
		let n = -10.85, r = t + 1.1;
		this.add("bronze", s(1.58, 1.72, .18, 36).translate(-2, r + .09, n)), this.add("bronze", s(1.43, 1.55, .38, 36).translate(-2, r + .37, n)), this.add("gold", s(1.48, 1.52, .055, 36).translate(-2, r + .19, n)), this.add("gold", s(1.34, 1.4, .07, 36).translate(-2, r + .57, n)), this.add("bronze", s(1.17, 1.3, .15, 36).translate(-2, r + .67, n));
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
			let r = c(n), i = {
				stone: 1.4,
				wall: 2,
				wood: .75,
				woodDark: .75,
				dougong: .7,
				lattice: .75
			}, a = i[t] ? l(r, i[t]) : r, o = new e.Mesh(a, this.materials[t]);
			o.name = `temple-${t}`, o.castShadow = t === "stone" || t === "wall" || t === "roof" || t === "mainRoof" || t === "wood" || t === "dougong" || t === "bronze", o.receiveShadow = !0, this.group.add(o), n.length = 0;
		}
		this.group.traverse((t) => {
			t instanceof e.Mesh && t.name.startsWith("plaque") && (t.castShadow = !1);
		});
	}
};
//#endregion
//#region src/world/main_hall_study.ts
function ae(t, n) {
	let r = new e.Group();
	r.name = "lingyin-main-hall-interior";
	let i = g.temple.x, a = g.temple.z, u = g.platform.y + 1.35, d = g.platform.y + 9.72, f = 23.75, p = 13.75, m = g.platform.y + 9.9;
	function h() {
		let o = t.materials.mainRoof;
		o instanceof e.MeshStandardMaterial && (o.map = n.redRoof, o.normalMap = null, o.color.set("#f3dfd4"), o.roughness = .79, o.needsUpdate = !0);
		let s = m + 1.55;
		w("darkWood", 24, 2.5, .09, 0, s, 7.45);
		for (let e of [
			-9.2,
			-5.1,
			5.1,
			9.2
		]) {
			w("teal", 3.5, 1.45, .055, e, s, 7.52);
			for (let t = -4; t <= 4; t++) w("darkWood", .055, 1.43, .06, e + t * .39, s, 7.57);
			for (let t = -1; t <= 1; t++) w("gilt", 3.5, .035, .06, e, s + t * .48, 7.58);
		}
		for (let e of [
			-12,
			-7.15,
			-3.25,
			3.25,
			7.15,
			12
		]) w("lacquer", .36, 2.56, .32, e, s, 7.69), w("gilt", .47, .07, .37, e, m + .29, 7.69);
		let c = n.paintedBeam.clone();
		c.wrapS = e.RepeatWrapping, c.repeat.set(9, 1), c.needsUpdate = !0;
		let l = new e.MeshStandardMaterial({
			name: "hall-exterior-blue-gold-caihua",
			map: c,
			roughness: .78,
			metalness: .02,
			side: e.DoubleSide
		});
		for (let [t, n, o, s] of [
			[
				27.8,
				.72,
				m - .48,
				9.58
			],
			[
				26.5,
				.62,
				m + 2.85,
				8.77
			],
			[
				23.9,
				.38,
				m + .33,
				7.82
			]
		]) {
			w("teal", t + .1, n + .06, .16, 0, o, s - .1), w("gilt", t + .12, .035, .17, 0, o - n / 2 - .04, s - .09), w("gilt", t + .12, .035, .17, 0, o + n / 2 + .04, s - .09);
			let c = new e.Mesh(new e.PlaneGeometry(t, n), l);
			c.name = "hall-exterior-painted-eaves", c.position.set(i, o, a + s), r.add(c);
		}
		for (let t of [-9.2, 9.2]) {
			let n = new e.Mesh(new e.CircleGeometry(1.28, 32), new e.MeshStandardMaterial({
				color: "#244448",
				roughness: .82,
				metalness: .06,
				side: e.DoubleSide
			}));
			n.name = "hall-exterior-round-window", n.position.set(i + t, u + 3.95, a + 7.47), r.add(n);
			let o = new e.Mesh(new e.RingGeometry(1.2, 1.34, 48), new e.MeshStandardMaterial({
				color: "#ae8542",
				roughness: .58,
				metalness: .4,
				side: e.DoubleSide
			}));
			o.position.set(i + t, u + 3.95, a + 7.49), r.add(o);
		}
		for (let e of [-5.75, 5.75]) {
			w("darkWood", 3.65, 5.25, .085, e, u + 3.05, 7.51);
			for (let t of [-1.87, 1.87]) w("lacquer", .16, 5.48, .12, e + t, u + 3.05, 7.59);
			for (let t of [-2.7, 2.7]) w("lacquer", 3.95, .16, .12, e, u + 3.05 + t, 7.59);
			for (let t of [
				-1.15,
				-.58,
				0,
				.58,
				1.15
			]) w("teal", .055, 5.1, .09, e + t, u + 3.05, 7.61);
			for (let t of [
				-1.8,
				-.9,
				0,
				.9,
				1.8
			]) w("teal", 3.55, .055, .09, e, u + 3.05 + t, 7.61);
		}
	}
	let _ = new e.MeshStandardMaterial({
		name: "hall-worn-cinnabar-lacquer",
		map: n.redLacquer,
		roughness: .51,
		metalness: .02
	}), v = new e.MeshStandardMaterial({
		name: "hall-carved-dark-wood",
		color: "#44251d",
		roughness: .68
	}), y = new e.MeshStandardMaterial({
		name: "hall-painted-dougong",
		color: "#2b4b4d",
		roughness: .72
	}), b = new e.MeshStandardMaterial({
		name: "hall-aged-gilt",
		color: "#b98737",
		metalness: .54,
		roughness: .39,
		emissive: "#2d1907",
		emissiveIntensity: .12
	}), x = new e.MeshStandardMaterial({
		name: "hall-cast-bronze",
		color: "#77603d",
		metalness: .57,
		roughness: .48
	}), S = {
		lacquer: _,
		darkWood: v,
		teal: y,
		gilt: b,
		bronze: x
	}, C = {
		lacquer: [],
		darkWood: [],
		teal: [],
		gilt: [],
		bronze: []
	}, w = (e, t, n, r, s, c, l) => C[e].push(o(t, n, r, i + s, c, a + l)), T = (e, t, n, r, o, c, l, u = 24) => C[e].push(s(t, n, r, u, i + o, c, a + l));
	h();
	let E = t.materials.stone.clone();
	E.name = "hall-weathered-stone-floor", E.color.set("#e3dfd6"), E.roughness = .72, E.map = n.stoneFloor, E.map.wrapS = E.map.wrapT = e.RepeatWrapping, E.map.repeat.set(7, 4), E.map.needsUpdate = !0, E.normalMap && (E.normalMap = E.normalMap.clone(), E.normalMap.wrapS = E.normalMap.wrapT = e.RepeatWrapping, E.normalMap.repeat.set(8, 5), E.normalMap.needsUpdate = !0);
	let D = new e.Mesh(new e.PlaneGeometry(f - .08, p - .08), E);
	D.name = "hall-stone-floor", D.rotation.x = -Math.PI / 2, D.position.set(i, u + .04, a), D.receiveShadow = !0, r.add(D), w("darkWood", f - .08, .16, p - .08, 0, d, 0);
	for (let e of [
		-5.55,
		-2,
		1.55,
		5.35
	]) w("teal", f - .2, .72, .54, 0, d - .38, e), w("gilt", f - .2, .045, .62, 0, d - .76, e);
	for (let e of [
		-10,
		-7.7,
		-3.8,
		3.8,
		7.7,
		10
	]) w("teal", .54, .55, p - .2, e, d - .28, 0);
	for (let e of [-10.7, 10.7]) w("gilt", .035, .06, p - .2, e, d - .58, 0);
	let O = n.paintedBeam.clone();
	O.wrapS = e.RepeatWrapping, O.repeat.set(8, 1), O.needsUpdate = !0;
	let k = new e.MeshStandardMaterial({
		name: "hall-painted-beam-art",
		map: O,
		roughness: .74,
		metalness: .03,
		side: e.DoubleSide
	}), A = [];
	for (let t of [
		-5.55,
		-2,
		1.55,
		5.35
	]) {
		let n = new e.PlaneGeometry(f - .25, .61);
		n.translate(i, d - .37, a + t + .286), A.push(n);
	}
	let j = new e.Mesh(c(A), k);
	j.name = "hall-painted-crossbeams", r.add(j);
	let ee = new e.MeshStandardMaterial({
		name: "hall-dragon-coffer-art",
		map: n.coffer,
		roughness: .76,
		side: e.DoubleSide,
		emissive: "#45301d",
		emissiveIntensity: .08
	}), M = new e.Mesh(new e.PlaneGeometry(6.75, 6.15), ee);
	M.name = "hall-central-dragon-coffer", M.rotation.x = Math.PI / 2, M.position.set(i, d - .11, a + .1), r.add(M);
	for (let e of [-1, 1]) w("gilt", .09, .045, 6.48, e * 3.43, d - .12, .1), w("gilt", 6.95, .045, .09, 0, d - .12, .1 + e * 3.15);
	for (let [e, t] of [
		[-7.7, -4.75],
		[7.7, -4.75],
		[-7.7, -2],
		[7.7, -2],
		[-5.5, .5],
		[5.5, .5]
	]) {
		T("bronze", .79, .85, .24, e, u + .12, t, 32), T("lacquer", .58, .66, d - u - .7, e, u + (d - u) / 2, t, 32), T("gilt", .63, .63, .075, e, u + .38, t, 32), T("gilt", .66, .62, .12, e, d - .53, t, 32);
		for (let n = 0; n < 3; n++) {
			let r = d - .44 + n * .16, i = .85 + n * .25;
			w("teal", 2 * i, .16, .58, e, r, t), w("teal", .62, .16, 2 * i, e, r + .07, t), w("gilt", 2 * i, .025, .06, e, r - .09, t + .29);
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
	]) w("teal", 1.42, .16, .38, e, d - .82, t), w("teal", .47, .22, .9, e, d - .68, t), w("gilt", 1.32, .035, .04, e, d - .92, t + .22);
	let N = new e.MeshStandardMaterial({
		name: "hall-daylit-paper",
		color: "#e4d5b7",
		roughness: 1,
		emissive: "#fff0d0",
		emissiveIntensity: .76,
		side: e.DoubleSide
	}), P = [];
	for (let t of [-1, 1]) for (let n of [
		-3.75,
		0,
		3.75
	]) {
		let r = t * (f / 2 - .22), o = u + 4.18, s = new e.PlaneGeometry(2.7, 5.5);
		s.rotateY(-t * Math.PI / 2), s.translate(i + r, o, a + n), P.push(s);
		for (let e of [-1.39, 1.39]) w("darkWood", .12, 5.7, .13, r - t * .08, o, n + e);
		for (let e of [-2.82, 2.82]) w("darkWood", .12, .14, 2.85, r - t * .08, o + e, n);
		for (let e = -3; e <= 3; e++) w("darkWood", .045, 5.5, .045, r - t * .13, o, n + e * .36);
		for (let e = -6; e <= 6; e++) w("darkWood", .045, .045, 2.7, r - t * .13, o + e * .4, n);
	}
	let F = new e.Mesh(c(P), N);
	F.name = "hall-daylit-lattice-windows", r.add(F);
	for (let e of [-1, 1]) w("darkWood", .18, 1.05, p - .25, e * (f / 2 - .12), u + .57, 0), w("gilt", .035, .035, p - .25, e * (f / 2 - .19), u + 1.12, 0);
	w("darkWood", 17.4, 7.65, .22, 0, u + 3.89, -6.67), w("teal", 18, .8, .42, 0, d - .65, -6.23);
	for (let e of [
		-6.9,
		-2.3,
		2.3,
		6.9
	]) w("lacquer", .18, 6.95, .13, e, u + 4.1, -6.48), w("gilt", .035, 6.9, .04, e + .13, u + 4.1, -6.4);
	for (let e of [u + 5.5, u + 7.15]) w("teal", 17.1, .24, .2, 0, e, -6.45), w("gilt", 17.1, .035, .22, 0, e - .13, -6.45);
	w("darkWood", 16.2, .38, 3.5, 0, u + .19, -4.72), w("darkWood", 14.4, .28, 2.8, 0, u + .48, -4.8);
	for (let e of [-8.75, 8.75]) w("lacquer", .4, 4.8, .36, e, u + 2.5, -6.35), w("gilt", .07, 4.4, .04, e + (e < 0 ? .23 : -.23), u + 2.52, -6.12);
	for (let e of [
		-4.6,
		0,
		4.6
	]) {
		let t = e === 0;
		w("bronze", t ? 3.85 : 3, .24, 2.1, e, u + .71, -4.85), w("gilt", t ? 3.7 : 2.88, .07, 2, e, u + .87, -4.85);
	}
	let I = se(), te = new e.MeshBasicMaterial({
		name: "hall-gilt-halos",
		map: I,
		transparent: !0,
		depthWrite: !1,
		side: e.DoubleSide
	});
	for (let t of [
		-4.6,
		0,
		4.6
	]) {
		let o = t === 0, s = new e.Mesh(new e.PlaneGeometry(o ? 4.5 : 3.55, o ? 4.5 : 3.55), te);
		s.name = "hall-statue-halo", s.position.set(i + t, u + (o ? 4.05 : 3.56), a - 6.37), r.add(s);
		let c = oe(o ? n.buddhaScan : n.buddhaSideLod, b, o ? 1.35 : 1.05, i + t, u + .9, a - 4.82);
		c.name = o ? "hall-central-buddha" : "hall-flanking-buddha", r.add(c);
	}
	w("darkWood", 13.5, .2, 1.25, 0, u + 1.2, -2.06), w("darkWood", 13.3, .48, .22, 0, u + .84, -1.44), w("gilt", 13.4, .035, .06, 0, u + 1.07, -1.3), w("gilt", 13.4, .035, .06, 0, u + .59, -1.3);
	let L = n.carvedAltar.clone();
	L.wrapS = e.RepeatWrapping, L.repeat.set(5, 1), L.needsUpdate = !0;
	let R = new e.Mesh(new e.PlaneGeometry(13.26, .7), new e.MeshStandardMaterial({
		name: "hall-carved-altar-front",
		map: L,
		roughness: .68,
		metalness: .04,
		side: e.DoubleSide
	}));
	R.position.set(i, u + .84, a - 1.31), r.add(R);
	for (let e of [
		-6.3,
		-3.2,
		0,
		3.2,
		6.3
	]) w("lacquer", .34, 1, .37, e, u + .57, -2.55), w("gilt", .08, .45, .08, e, u + .87, -1.15);
	let z = [];
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
		T("bronze", .13, .2, .25, t, u + 1.45, -2.04, 12), T("gilt", .045, .07, .28, t, u + 1.72, -2.04, 10);
		let n = new e.SphereGeometry(.08, 10, 8);
		n.scale(.75, 1.7, .75), n.translate(i + t, u + 1.93, a - 2.04), z.push(n);
	}
	let B = new e.Mesh(c(z), new e.MeshBasicMaterial({ color: "#ffd185" }));
	B.name = "hall-altar-flames", r.add(B);
	let V = new e.Mesh(new e.PlaneGeometry(3.65, 11.6), new e.MeshStandardMaterial({
		name: "hall-woven-carpet",
		map: ce(),
		roughness: .94,
		metalness: 0
	}));
	V.name = "hall-processional-carpet", V.rotation.x = -Math.PI / 2, V.position.set(i, u + .055, a + 1.38), r.add(V);
	let H = le(x, b, i, u, a - .55);
	H.scale.setScalar(.66), H.position.set(i * .34, u * .34, (a - .55) * .34), r.add(H);
	let U = new e.PointLight(16759920, 13, 16, 2);
	U.position.set(i, u + 3.6, a - 3), r.add(U);
	for (let t of [-1, 1]) {
		let n = new e.PointLight(16770494, 6, 8, 2);
		n.position.set(i + t * 9, u + 3.2, a + .2), r.add(n);
	}
	for (let t of Object.keys(C)) {
		if (!C[t].length) continue;
		let n = c(C[t]), i = t === "lacquer" ? l(n, 2.4) : t === "darkWood" ? l(n, .9) : n, a = new e.Mesh(i, S[t]);
		a.name = "hall-structure-" + t, a.receiveShadow = !0, r.add(a);
	}
	return r;
}
function oe(t, n, r, i, a, o) {
	let s = t.clone(!0);
	s.rotation.x = Math.PI / 2, s.scale.setScalar(.027 * r), s.position.set(0, 0, 0), s.traverse((t) => {
		t instanceof e.Mesh && (t.material = n);
	}), s.updateMatrixWorld(!0);
	let c = new e.Box3().setFromObject(s);
	return s.position.set(i - (c.min.x + c.max.x) / 2, a - c.min.y, o - (c.min.z + c.max.z) / 2), s;
}
function se() {
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
function ce() {
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
function le(t, n, r, i, a) {
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
//#region src/main-hall-preview.ts
var W = document.querySelector("#hall-canvas"), G = document.querySelector("#hall-status"), ue = document.querySelector("#hall-metrics"), K = document.querySelector("#study-toggle");
if (!W || !G || !ue || !K) throw Error("Main hall preview controls are missing");
var q = new e.WebGLRenderer({
	canvas: W,
	antialias: !0,
	powerPreference: "high-performance"
});
q.outputColorSpace = e.SRGBColorSpace, q.toneMapping = e.ACESFilmicToneMapping, q.toneMappingExposure = 1.15, q.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
var J = new e.Scene();
J.background = new e.Color("#9bacae"), J.fog = new e.Fog("#9bacae", 45, 100);
var Y = new e.PerspectiveCamera(72, 1, .06, 120), X = new t(Y, W);
X.enableDamping = !0, X.dampingFactor = .08, X.minDistance = .5, X.maxDistance = 70, X.maxPolarAngle = Math.PI * .94;
var Z = !1;
function Q() {
	Z || (Z = !0, requestAnimationFrame(() => {
		Z = !1, X.update(), q.render(J, Y), ue.textContent = `${q.info.render.calls} draw calls · ${Math.round(q.info.render.triangles / 1e3)}k triangles`;
	}));
}
X.addEventListener("change", Q), J.add(new e.HemisphereLight(14280685, 6705468, 1.55));
var de = new e.DirectionalLight(16772040, 2.15);
de.position.set(-12, 28, 19), J.add(de);
var $ = new e.Mesh(new e.PlaneGeometry(58, 90), new e.MeshStandardMaterial({
	color: "#77756d",
	roughness: .96
}));
$.rotation.x = -Math.PI / 2, $.position.set(-2, g.platform.y - .18, 12), $.name = "preview-only-ground", J.add($);
var fe = {
	exterior: {
		position: [
			-2,
			9.5,
			19.5
		],
		target: [
			-2,
			11.8,
			-12
		],
		fov: 50
	},
	front: {
		position: [
			-2,
			6.15,
			-5.5
		],
		target: [
			-2,
			7.9,
			-14.5
		]
	},
	entrance: {
		position: [
			-9.1,
			6.15,
			-5.75
		],
		target: [
			-2,
			7.7,
			-14.5
		]
	},
	side: {
		position: [
			6.8,
			6.35,
			-8.8
		],
		target: [
			-2,
			7.7,
			-14.5
		]
	},
	ceiling: {
		position: [
			-5.1,
			6.55,
			-8.25
		],
		target: [
			-2,
			11.7,
			-12
		]
	}
};
function pe(e) {
	let t = fe[e];
	if (t) {
		Y.position.set(...t.position), Y.fov = t.fov ?? 72, Y.updateProjectionMatrix(), X.target.set(...t.target), X.update(), Q();
		for (let t of document.querySelectorAll("[data-view]")) t.setAttribute("aria-pressed", String(t.dataset.view === e));
	}
}
for (let e of document.querySelectorAll("[data-view]")) e.addEventListener("click", () => pe(e.dataset.view || "front"));
pe("exterior");
function me() {
	let e = W.clientWidth, t = W.clientHeight;
	q.setSize(e, t, !1), Y.aspect = e / t, Y.updateProjectionMatrix(), Q();
}
new ResizeObserver(me).observe(W), me();
async function he() {
	G.textContent = "正在载入大殿贴图…", await j(), G.textContent = "正在载入彩绘与佛像…";
	let t = new r();
	t.setDecoderPath(new URL("./vendor/three/examples/jsm/libs/draco/", document.baseURI).href);
	let i = new n().setDRACOLoader(t), a = new e.TextureLoader(), [o, s, c, l, u, d, f, p] = await Promise.all([
		i.loadAsync(new URL("./assets/lingyin/buddha-clay-scan.glb", document.baseURI).href),
		i.loadAsync(new URL("./assets/lingyin/buddha-clay-scan-lod.glb", document.baseURI).href),
		a.loadAsync(new URL("./assets/lingyin/hall-preview/dragon-coffer.webp", document.baseURI).href),
		a.loadAsync(new URL("./assets/lingyin/hall-preview/painted-beam.webp", document.baseURI).href),
		a.loadAsync(new URL("./assets/lingyin/hall-preview/worn-red-lacquer.webp", document.baseURI).href),
		a.loadAsync(new URL("./assets/lingyin/hall-preview/aged-stone-floor.webp", document.baseURI).href),
		a.loadAsync(new URL("./assets/lingyin/hall-preview/carved-altar.webp", document.baseURI).href),
		a.loadAsync(new URL("./assets/lingyin/hall-preview/red-ceramic-roof.webp", document.baseURI).href)
	]);
	t.dispose();
	for (let t of [
		c,
		l,
		u,
		d,
		f,
		p
	]) t.colorSpace = e.SRGBColorSpace, t.anisotropy = 8;
	u.wrapS = u.wrapT = e.RepeatWrapping, p.wrapS = p.wrapT = e.RepeatWrapping, p.repeat.set(.2, .2), p.needsUpdate = !0, G.textContent = "正在构建三佛殿内空间…";
	let m = new ie({
		onlyMainHall: !0,
		omitMainHallShrine: !0,
		studyHallEave: 11,
		studyFacade: !0
	});
	J.add(m.group);
	let h = ae(m, {
		coffer: c,
		paintedBeam: l,
		redLacquer: u,
		stoneFloor: d,
		carvedAltar: f,
		redRoof: p,
		buddhaScan: o.scene,
		buddhaSideLod: s.scene
	});
	m.group.add(h);
	let _ = null;
	async function v() {
		if (!_) {
			G.textContent = "正在载入原版供对照…";
			let t = await a.loadAsync(new URL("./assets/lingyin/lotus-mural.jpg", document.baseURI).href);
			t.colorSpace = e.SRGBColorSpace;
			let n = new e.Group();
			n.name = "main-hall-original-comparison", n.add(new ie({ onlyMainHall: !0 }).group);
			let r = new e.Group();
			r.position.set(-2, g.platform.y + 1.78, -10.85);
			let i = o.scene.clone(!0);
			i.rotation.x = Math.PI / 2, i.scale.setScalar(.027), i.position.set(-1.607, 0, -.413), i.traverse((t) => {
				t instanceof e.Mesh && (t.material = V());
			}), r.add(i), n.add(r);
			let s = new e.Mesh(new e.PlaneGeometry(6.5, 4.2), new e.MeshStandardMaterial({
				map: t,
				roughness: .91
			}));
			s.position.set(-2, g.platform.y + 4.1, -11.28), n.add(s);
			let c = new e.PointLight(16765850, 14, 10, 2);
			c.position.set(-5, g.platform.y + 4.7, -6), n.add(c), _ = n, J.add(n);
		}
		m.group.visible = !1, _.visible = !0, G.textContent = "正在查看旧版 · 勾选开关返回重做版", Q();
	}
	K.addEventListener("change", () => {
		K.checked ? (_ && (_.visible = !1), m.group.visible = !0, G.textContent = "正在查看三佛殿重做版", Q()) : v().catch((e) => {
			console.error(e), G.textContent = "原版对照载入失败";
		});
	}), G.textContent = "三佛殿已载入 · 拖动旋转、滚轮缩放，切换机位检查细节", document.body.classList.add("hall-ready"), Q();
}
he().catch((e) => {
	console.error("Main hall preview failed", e), G.textContent = `预览载入失败：${e instanceof Error ? e.message : String(e)}`;
});
//#endregion
