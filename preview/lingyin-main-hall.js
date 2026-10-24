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
var m = (e, t, n) => e + (t - e) * n, h = Object.freeze({
	name: "main",
	x: -2,
	z: -26,
	w: 31.5,
	d: 24,
	eave: 11,
	plinth: 1.1,
	rot: 0
}), g = Object.freeze({
	x: h.w / 27,
	z: h.d / 17
});
function _(e, t) {
	return {
		x: h.x + e * g.x,
		z: h.z + t * g.z
	};
}
//#endregion
//#region ../scripts/lingyin_hillside_route.js
var v = 2.45;
v + .27, v + 1.45;
//#endregion
//#region src/world/heightfield.ts
var y = {
	size: 170,
	terrainSegments: 180,
	center: [0, 0],
	temple: {
		x: h.x,
		z: h.z
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
}, b = [
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
	for (let t = 0; t < b.length - 1; t++) {
		let n = b[t], r = b[t + 1];
		for (let t = 0; t < 12; t++) e.push([m(n[0], r[0], t / 12), m(n[1], r[1], t / 12)]);
	}
	return e.push(b[b.length - 1]), e;
})(), y.pond.y;
//#endregion
//#region src/core/materials.ts
var x = "\nfloat cgHash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }\nfloat cgHash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }\nvec3 cgHash33(vec3 p3){ p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }\nfloat cgNoise2(vec2 p){\n  vec2 i = floor(p), f = fract(p);\n  f = f * f * (3.0 - 2.0 * f);\n  float a = cgHash12(i), b = cgHash12(i + vec2(1,0)), c = cgHash12(i + vec2(0,1)), d = cgHash12(i + vec2(1,1));\n  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);\n}\nfloat cgNoise3(vec3 p){\n  vec3 i = floor(p), f = fract(p);\n  f = f * f * (3.0 - 2.0 * f);\n  float n000 = cgHash12(i.xy + i.z * 19.19);\n  float n100 = cgHash12(i.xy + vec2(1,0) + i.z * 19.19);\n  float n010 = cgHash12(i.xy + vec2(0,1) + i.z * 19.19);\n  float n110 = cgHash12(i.xy + vec2(1,1) + i.z * 19.19);\n  float n001 = cgHash12(i.xy + (i.z + 1.0) * 19.19);\n  float n101 = cgHash12(i.xy + vec2(1,0) + (i.z + 1.0) * 19.19);\n  float n011 = cgHash12(i.xy + vec2(0,1) + (i.z + 1.0) * 19.19);\n  float n111 = cgHash12(i.xy + vec2(1,1) + (i.z + 1.0) * 19.19);\n  return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y), mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);\n}\nfloat cgFbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i=0;i<5;i++){ s += a * cgNoise2(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }\nfloat cgFbm3(vec3 p){ float s = 0.0, a = 0.5; for (int i=0;i<4;i++){ s += a * cgNoise3(p); p = p * 2.05 + 7.3; a *= 0.5; } return s; }\nfloat cgRidge2(vec2 p){ float s = 0.0, a = 0.55; for (int i=0;i<4;i++){ float n = 1.0 - abs(cgNoise2(p) * 2.0 - 1.0); s += a * n * n; p = p * 2.1 + 3.1; a *= 0.5; } return s; }\n// anti-aliased thin line: distance d in world units, width w, pixel footprint aa\nfloat cgLine(float d, float w, float aa){ return 1.0 - smoothstep(w, w + aa, abs(d)); }\n", S = "\nvarying vec3 vCgWorld;\nvarying vec3 vCgNormalW;\nvarying vec3 vCgObj;\nvarying float vCgSeed;\n", C = "\n{\n  vec4 cgP = vec4(transformed, 1.0);\n  vec3 cgN = objectNormal;\n  float cgSeedV = 0.0;\n  #ifdef USE_INSTANCING\n    cgP = instanceMatrix * cgP;\n    cgN = mat3(instanceMatrix) * cgN;\n    cgSeedV = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);\n  #endif\n  vCgWorld = (modelMatrix * cgP).xyz;\n  vCgNormalW = normalize(mat3(modelMatrix) * cgN);\n  vCgObj = transformed;\n  vCgSeed = cgSeedV;\n}\n";
function w(t = {}) {
	let n = new e.MeshStandardMaterial(t.params ?? {});
	t.name && (n.name = t.name);
	let r = t.uniforms ?? {}, i = "proc:" + T([
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
		n = n.replace("#include <common>", `#include <common>\n${S}\n${t.vertexHead ?? ""}`), t.vertexPre && (n = n.replace("#include <begin_vertex>", `#include <begin_vertex>\n{\n${t.vertexPre}\n}`)), n = n.replace("#include <worldpos_vertex>", `#include <worldpos_vertex>\n${C}`), i = i.replace("#include <common>", `#include <common>\n${S}\n${x}\n${t.head ?? ""}`), i = i.replace("void main() {", "void main() {\nvec3 cgP = vCgWorld; vec3 cgN = normalize(vCgNormalW); vec3 cgO = vCgObj; float cgSeed = vCgSeed; vec3 cgBump = vec3(0.0); float cgAO = 1.0;"), t.color && (i = i.replace("#include <color_fragment>", `#include <color_fragment>\n{\n${t.color}\n}`)), t.roughness && (i = i.replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>\n{\n${t.roughness}\n}`)), t.metalness && (i = i.replace("#include <metalnessmap_fragment>", `#include <metalnessmap_fragment>\n{\n${t.metalness}\n}`)), t.normal && (i = i.replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\n{\n${t.normal}\n}\nnormal = normalize(normal + (viewMatrix * vec4(cgBump, 0.0)).xyz);`)), t.emissive && (i = i.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n{\n${t.emissive}\n}`)), t.ao && (i = i.replace("#include <aomap_fragment>", `#include <aomap_fragment>\n{\n${t.ao}\n}\nreflectedLight.indirectDiffuse *= cgAO; reflectedLight.indirectSpecular *= mix(1.0, cgAO, 0.7);`)), e.vertexShader = n, e.fragmentShader = i;
	}, n;
}
function T(e) {
	let t = 2166136261;
	for (let n = 0; n < e.length; n++) t ^= e.charCodeAt(n), t = Math.imul(t, 16777619);
	return (t >>> 0).toString(36);
}
//#endregion
//#region src/world/materials.ts
var E = null, D = null, O = null, k = null, A = null, j = {}, M = /* @__PURE__ */ new Map(), ee = [
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
function te(t) {
	let n = M.get(t);
	if (n) return n;
	let r = new URL(`./assets/lingyin/temple-textures/${t}.webp`, document.baseURI).href + "?v=3", i = new e.TextureLoader().loadAsync(r).then((n) => {
		n.name = `lingyin-${t}`, n.colorSpace = t.endsWith("albedo") || t.startsWith("plaque-") ? e.SRGBColorSpace : e.NoColorSpace, n.wrapS = n.wrapT = t.startsWith("plaque-") ? e.ClampToEdgeWrapping : e.RepeatWrapping, n.minFilter = e.LinearMipmapLinearFilter, n.magFilter = e.LinearFilter, n.anisotropy = 16, j[t] = n;
	});
	return M.set(t, i), i;
}
function N() {
	return Promise.all(ee.map(te)).then(() => {});
}
function ne(e) {
	return j[`plaque-${e}`];
}
function P(t, n, r, i, a, o) {
	let s = j[n];
	return s ? new e.MeshStandardMaterial({
		name: t,
		map: s,
		normalMap: j[r],
		normalScale: new e.Vector2(o, o),
		roughnessMap: j[i],
		roughness: a,
		metalness: 0
	}) : null;
}
function F(e, t = !1) {
	let n = P(`gate-photographic-${e}${t ? "-dark" : ""}`, e === "wood" ? "wood-albedo" : "plaster-albedo", e === "wood" ? "wood-normal" : "plaster-normal", e === "wood" ? "wood-roughness" : "plaster-roughness", .94, e === "wood" ? .22 : .2);
	return n && n.color.set(e === "plaster" ? "#b9a276" : t ? "#978575" : "#b39a80"), n;
}
function re() {
	if (O) return O;
	let t = document.createElement("canvas");
	t.width = t.height = 256;
	let n = t.getContext("2d"), r = n.createImageData(256, 256), i = 1919509349, a = () => ((i = Math.imul(i, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
	for (let e = 0; e < 256; e++) for (let t = 0; t < 256; t++) {
		let n = Math.sin(t * .36 + e * .015) * .012, i = Math.max(.78, Math.min(.96, .88 + (a() - .5) * .065 + n)), o = (e * 256 + t) * 4;
		r.data[o] = Math.round(i * 255), r.data[o + 1] = Math.round(i * 248), r.data[o + 2] = Math.round(i * 230), r.data[o + 3] = 255;
	}
	return n.putImageData(r, 0, 0), O = new e.CanvasTexture(t), O.colorSpace = e.SRGBColorSpace, O.wrapS = O.wrapT = e.RepeatWrapping, O.minFilter = e.LinearMipmapLinearFilter, O.magFilter = e.LinearFilter, O.anisotropy = 8, O;
}
function ie() {
	if (D) return D;
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
	return n.putImageData(r, 0, 0), D = new e.CanvasTexture(t), D.colorSpace = e.SRGBColorSpace, D.wrapS = D.wrapT = e.RepeatWrapping, D.minFilter = e.LinearMipmapLinearFilter, D.magFilter = e.LinearFilter, D.anisotropy = 8, D;
}
function ae() {
	if (E) return E;
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
	return d.colorSpace = e.SRGBColorSpace, d.wrapS = d.wrapT = e.RepeatWrapping, d.minFilter = e.LinearMipmapLinearFilter, d.magFilter = e.LinearFilter, d.anisotropy = 8, E = new e.MeshStandardMaterial({
		name: "weathered-stone-slabs",
		map: d,
		bumpMap: d,
		bumpScale: .048,
		roughness: .94,
		metalness: 0,
		vertexColors: !0
	}), E;
}
function I(t, n) {
	let r = t.getAttribute("position").count, i = new Float32Array(r * 3);
	for (let e = 0; e < r; e++) {
		let t = n * (.96 + e % 3 * .04);
		i[e * 3] = t, i[e * 3 + 1] = t * .992, i[e * 3 + 2] = t * .978;
	}
	return t.setAttribute("color", new e.BufferAttribute(i, 3)), t;
}
function L(e = 0) {
	return oe(e) || w({
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
function oe(e = 0) {
	let t = P("stone-photogrammetry", "stone-albedo", "stone-normal", "stone-roughness", .96, .32);
	return t && t.color.set(e > .5 ? 14076600 : 16777215), t;
}
function R() {
	let t = j["roof-albedo"], n = j["roof-normal"];
	if (t && n) return t.repeat.set(1 / 5, 1 / 5), n.repeat.set(1 / 5, 1 / 5), new e.MeshStandardMaterial({
		name: "roof-tile-photogrammetry",
		map: t,
		normalMap: n,
		normalScale: new e.Vector2(.28, .28),
		roughness: .86,
		metalness: .02,
		side: e.DoubleSide
	});
	if (!k) {
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
		n.putImageData(r, 0, 0), k = new e.CanvasTexture(t), k.name = "baked-weathered-roof-tiles", k.colorSpace = e.SRGBColorSpace, k.wrapS = k.wrapT = e.RepeatWrapping, k.repeat.set(1 / (12 * .34), 1 / (8 * .52)), k.minFilter = e.LinearMipmapLinearFilter, k.magFilter = e.LinearFilter, k.anisotropy = 8;
	}
	return new e.MeshStandardMaterial({
		name: "roof-tile-baked",
		map: k,
		bumpMap: k,
		bumpScale: .045,
		roughness: .82,
		metalness: .02,
		side: e.DoubleSide
	});
}
function z() {
	let e = R();
	return e.name = "main-hall-weathered-red-roof", e.color.set(10178883), e.roughness = .91, e.metalness = 0, e.normalScale && e.normalScale.set(.36, .36), e;
}
function B() {
	let e = le();
	return e.name = "main-hall-cool-grey-plaster", e.color.set(12170669), e.roughness = 1, e.normalScale && e.normalScale.set(.24, .24), e;
}
function se() {
	let e = L(0);
	return e.name = "main-hall-grey-stone-plinth", e.color.set(11119270), e.roughness = .98, e;
}
function V(e = !1) {
	let t = W(e);
	return t.name = e ? "main-hall-dark-red-joinery" : "main-hall-weathered-red-timber", t.color.set(e ? 10716535 : 14136229), t.roughness = e ? .9 : .86, t.normalScale && t.normalScale.set(.22, .22), t;
}
function H() {
	if (A) return A;
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
	return A = new e.CanvasTexture(t), A.name = "main-hall-painted-beam-pattern", A.colorSpace = e.SRGBColorSpace, A.wrapS = A.wrapT = e.RepeatWrapping, A.repeat.set(2.5, 1), A.minFilter = e.LinearMipmapLinearFilter, A.magFilter = e.LinearFilter, A.anisotropy = 8, A;
}
function U() {
	let t = H();
	return new e.MeshStandardMaterial({
		name: "main-hall-blue-green-painted-beams",
		map: t,
		bumpMap: t,
		bumpScale: .018,
		roughness: .88,
		metalness: .01
	});
}
function ce() {
	return new e.MeshStandardMaterial({
		name: "main-hall-dark-teal-window",
		color: 1191213,
		emissive: new e.Color(463121),
		emissiveIntensity: .03,
		roughness: .92
	});
}
function le() {
	let e = P("plaster-photogrammetry", "plaster-albedo", "plaster-normal", "plaster-roughness", .98, .18);
	if (e) return e;
	let t = ie();
	return w({
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
function W(e = !1) {
	return P(e ? "aged-wood" : "red-lacquer-wood", e ? "wood-albedo" : "wood-red-albedo", "wood-normal", "wood-roughness", .82, .16) || w({
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
function ue() {
	return w({
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
function de() {
	return w({
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
function fe() {
	return w({
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
function pe() {
	return P("teal-painted-wood", "wood-teal-albedo", "wood-normal", "wood-roughness", .9, .12) || w({
		name: "dougong",
		params: {
			color: 16777215,
			roughness: .6,
			metalness: .02
		},
		color: "\n      float n = cgNoise2(cgP.xz * 5.0 + cgP.y * 2.0);\n      vec3 teal = mix(vec3(0.035,0.095,0.085), vec3(0.09,0.17,0.145), n);\n      float gold = smoothstep(0.75, 0.95, cgNoise2(cgP.xz * 9.0));\n      vec3 c = mix(teal, vec3(0.55,0.40,0.16), gold * 0.55);\n      diffuseColor.rgb = c;\n    "
	});
}
function me() {
	return new e.MeshStandardMaterial({
		color: new e.Color("#2a1a0c"),
		emissive: new e.Color("#8a4a1e"),
		emissiveIntensity: .03,
		roughness: .9
	});
}
function he() {
	return new e.MeshStandardMaterial({
		color: new e.Color("#7e1e18"),
		emissive: new e.Color("#ff5a2a"),
		emissiveIntensity: .3,
		roughness: .7
	});
}
//#endregion
//#region src/gate-kit/core/materials.ts
var ge = "\nfloat cgHash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }\nfloat cgHash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }\nvec3 cgHash33(vec3 p3){ p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }\nfloat cgNoise2(vec2 p){\n  vec2 i = floor(p), f = fract(p);\n  f = f * f * (3.0 - 2.0 * f);\n  float a = cgHash12(i), b = cgHash12(i + vec2(1,0)), c = cgHash12(i + vec2(0,1)), d = cgHash12(i + vec2(1,1));\n  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);\n}\nfloat cgNoise3(vec3 p){\n  vec3 i = floor(p), f = fract(p);\n  f = f * f * (3.0 - 2.0 * f);\n  float n000 = cgHash12(i.xy + i.z * 19.19);\n  float n100 = cgHash12(i.xy + vec2(1,0) + i.z * 19.19);\n  float n010 = cgHash12(i.xy + vec2(0,1) + i.z * 19.19);\n  float n110 = cgHash12(i.xy + vec2(1,1) + i.z * 19.19);\n  float n001 = cgHash12(i.xy + (i.z + 1.0) * 19.19);\n  float n101 = cgHash12(i.xy + vec2(1,0) + (i.z + 1.0) * 19.19);\n  float n011 = cgHash12(i.xy + vec2(0,1) + (i.z + 1.0) * 19.19);\n  float n111 = cgHash12(i.xy + vec2(1,1) + (i.z + 1.0) * 19.19);\n  return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y), mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);\n}\nfloat cgFbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i=0;i<5;i++){ s += a * cgNoise2(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }\nfloat cgFbm3(vec3 p){ float s = 0.0, a = 0.5; for (int i=0;i<4;i++){ s += a * cgNoise3(p); p = p * 2.05 + 7.3; a *= 0.5; } return s; }\nfloat cgRidge2(vec2 p){ float s = 0.0, a = 0.55; for (int i=0;i<4;i++){ float n = 1.0 - abs(cgNoise2(p) * 2.0 - 1.0); s += a * n * n; p = p * 2.1 + 3.1; a *= 0.5; } return s; }\n// anti-aliased thin line: distance d in world units, width w, pixel footprint aa\nfloat cgLine(float d, float w, float aa){ return 1.0 - smoothstep(w, w + aa, abs(d)); }\n", _e = "\nvarying vec3 vCgWorld;\nvarying vec3 vCgNormalW;\nvarying vec3 vCgObj;\nvarying float vCgSeed;\n", ve = "\n{\n  vec4 cgP = vec4(transformed, 1.0);\n  vec3 cgN = objectNormal;\n  float cgSeedV = 0.0;\n  #ifdef USE_INSTANCING\n    cgP = instanceMatrix * cgP;\n    cgN = mat3(instanceMatrix) * cgN;\n    cgSeedV = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);\n  #endif\n  vCgWorld = (modelMatrix * cgP).xyz;\n  vCgNormalW = normalize(mat3(modelMatrix) * cgN);\n  vCgObj = transformed;\n  vCgSeed = cgSeedV;\n}\n";
function ye(t = {}) {
	let n = new e.MeshStandardMaterial(t.params ?? {});
	t.name && (n.name = t.name);
	let r = t.uniforms ?? {}, i = "proc:" + be([
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
		n = n.replace("#include <common>", `#include <common>\n${_e}\n${t.vertexHead ?? ""}`), t.vertexPre && (n = n.replace("#include <begin_vertex>", `#include <begin_vertex>\n{\n${t.vertexPre}\n}`)), n = n.replace("#include <worldpos_vertex>", `#include <worldpos_vertex>\n${ve}`), i = i.replace("#include <common>", `#include <common>\n${_e}\n${ge}\n${t.head ?? ""}`), i = i.replace("void main() {", "void main() {\nvec3 cgP = vCgWorld; vec3 cgN = normalize(vCgNormalW); vec3 cgO = vCgObj; float cgSeed = vCgSeed; vec3 cgBump = vec3(0.0); float cgAO = 1.0;"), t.color && (i = i.replace("#include <color_fragment>", `#include <color_fragment>\n{\n${t.color}\n}`)), t.roughness && (i = i.replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>\n{\n${t.roughness}\n}`)), t.metalness && (i = i.replace("#include <metalnessmap_fragment>", `#include <metalnessmap_fragment>\n{\n${t.metalness}\n}`)), t.normal && (i = i.replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\n{\n${t.normal}\n}\nnormal = normalize(normal + (viewMatrix * vec4(cgBump, 0.0)).xyz);`)), t.emissive && (i = i.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n{\n${t.emissive}\n}`)), t.ao && (i = i.replace("#include <aomap_fragment>", `#include <aomap_fragment>\n{\n${t.ao}\n}\nreflectedLight.indirectDiffuse *= cgAO; reflectedLight.indirectSpecular *= mix(1.0, cgAO, 0.7);`)), e.vertexShader = n, e.fragmentShader = i;
	}, n;
}
function be(e) {
	let t = 2166136261;
	for (let n = 0; n < e.length; n++) t ^= e.charCodeAt(n), t = Math.imul(t, 16777619);
	return (t >>> 0).toString(36);
}
//#endregion
//#region src/gate-kit/world/materials.ts
var xe = new e.DataTexture(new Uint8Array([
	255,
	255,
	255,
	255
]), 1, 1);
xe.needsUpdate = !0;
function Se(e = 0) {
	return F("wood", e > .5) || ye({
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
function Ce() {
	return F("plaster") || ye({
		name: "plaster",
		params: {
			color: 16777215,
			roughness: .9
		},
		color: "\n      float n = cgFbm2(vec2(cgP.x * 0.9 + cgP.z * 0.9, cgP.y * 0.7));\n      float fine = cgNoise2(vec2(cgP.x * 8.0 + cgP.z * 4.0, cgP.y * 6.0));\n      vec3 c = mix(vec3(0.18, 0.13, 0.052), vec3(0.30, 0.215, 0.09), n * 0.8 + fine * 0.2);\n      // vertical rain wash and hairline cracks\n      float streak = smoothstep(0.6, 0.9, cgNoise2(vec2(cgP.x * 4.0 + cgP.z * 2.0, cgP.y * 0.15)));\n      c *= 1.0 - streak * 0.28;\n      float crack = smoothstep(0.7, 0.9, cgRidge2(vec2((cgP.x + cgP.z) * 5.0, cgP.y * 0.25)));\n      c *= 1.0 - crack * 0.3;\n      c = mix(c, vec3(0.30, 0.245, 0.16), (1.0 - smoothstep(0.35, 1.4, cgP.y - 0.35)) * 0.5);\n      float algae = smoothstep(0.4, 0.85, cgFbm2(vec2(cgP.x * 1.8 + cgP.z, cgP.y * 1.1) + 6.0));\n      c = mix(c, vec3(0.12, 0.15, 0.065), algae * (1.0 - smoothstep(0.3, 1.2, cgP.y - 0.3)) * 0.55);\n      diffuseColor.rgb = c;\n    "
	});
}
//#endregion
//#region src/world/surface_finish.ts
function we(t, n, r) {
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
var Te = [
	[-7.7, -4.75],
	[7.7, -4.75],
	[-7.7, -2],
	[7.7, -2],
	[-5.5, .5],
	[5.5, .5]
], Ee = [
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
], G = {
	x: 0,
	z: -.55,
	scale: .66
}, De = [
	[.43, 0],
	[.72, .14],
	[.92, .48],
	[1.02, .78],
	[.92, .86],
	[.74, .77],
	[.66, .52],
	[.3, .47]
], Oe = [
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
function ke(e) {
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
var Ae = class {
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
		let n = y.platform.y;
		this.materials = {
			stone: L(.2),
			floor: ae(),
			wall: le(),
			paper: new e.MeshStandardMaterial({
				color: 12958628,
				map: re(),
				bumpMap: re(),
				bumpScale: .009,
				roughness: .96,
				metalness: 0,
				side: e.DoubleSide
			}),
			gatePlaster: Ce(),
			wood: W(!1),
			woodDark: Se(1),
			dougong: pe(),
			roof: R(),
			mainRoof: z(),
			gateRoof: R(),
			gold: ue(),
			bronze: fe(),
			lattice: W(!0),
			lantern: he(),
			window: me(),
			mainStone: se(),
			mainWall: B(),
			mainWood: V(!1),
			mainWoodDark: V(!0),
			mainDougong: U(),
			mainLattice: V(!0),
			mainWindow: ce(),
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
			...h,
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
		let t = y.platform;
		this.add("stone", o(2.2, .5, 1, t.x0, e - .05, 0, 0)), this.add("stone", o(2.2, .5, 1, t.x1, e - .05, 0, 0)), this.add("stone", o(t.x1 - t.x0 + 2.2, .5, 1.2, (t.x0 + t.x1) / 2, e - .05, t.z1)), this.add("stone", o(t.x1 - t.x0 + 2.2, .5, 1.2, (t.x0 + t.x1) / 2, e - .05, t.z0));
		for (let n = 0; n < 6; n++) this.add("stone", o(9 - n * .25, .19, .5, -2, e - .2 - n * .19, t.z1 + .6 + n * .48));
		for (let n = 0; n < 5; n++) this.add("stone", o(.55, .2, 5.2, t.x1 + .4 + n * .5, e - .2 - n * .2, 28));
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
			window: [],
			mainStone: [],
			mainWall: [],
			mainWood: [],
			mainWoodDark: [],
			mainDougong: [],
			mainLattice: [],
			mainWindow: []
		}, l = !0, m = {
			stone: "mainStone",
			wall: "mainWall",
			wood: "mainWood",
			woodDark: "mainWoodDark",
			dougong: "mainDougong",
			lattice: "mainLattice",
			window: "mainWindow",
			roof: "mainRoof"
		}, h = (e) => l && t.name === "main" ? m[e] ?? e : e, g = (e, t) => c[h(e)].push(t);
		g("stone", o(t.w + 2.4, t.plinth + .25, t.d + 2.4, 0, (t.plinth + .25) / 2, 0)), g("stone", o(t.w + 2.9, .16, t.d + 2.9, 0, .1, 0));
		for (let e = 0; e < 5; e++) g("stone", o(5, .16, .42, 0, .16 + e * .16, a + 1.35 + (4 - e) * .4 + (t.plinth - .8) * .25)), t.name === "gate" && g("stone", o(5, .16, .42, 0, .16 + e * .16, -a - 1.35 - (4 - e) * .4));
		let _ = r - .35;
		for (let e of ke(t)) this.column(c, e.x, .25, e.z, e.height, h);
		let v = n ? 3.55 : _ - .4, b = .3, x = .25 + v / 2, S = 1.35, C = (e, n, r, i) => g("stone", o(e + .04, .22, n + .085, r, t.plinth + .3, i));
		if (t.openFront) {
			let e = i - 2.05;
			for (let t of [-1, 1]) g("wall", o(3.8, v, b, t * e, x, a - S)), C(3.8, b, t * e, a - S);
		} else {
			let e = t.name === "main" ? 5.4 : t.name === "rear" ? 4.6 : 3.4, n = (t.w - S * 2 - e) / 2;
			g("wall", o(n, v, b, -(e / 2 + n / 2), x, a - S)), g("wall", o(n, v, b, e / 2 + n / 2, x, a - S)), C(n, b, -(e / 2 + n / 2), a - S), C(n, b, e / 2 + n / 2, a - S), t.name === "main" && t.studyFacade || g("wood", o(e + .3, .35, b + .1, 0, .25 + v, a - S));
		}
		if (t.openFront || t.name === "west") {
			let e = t.name === "west" ? 3.4 : 4.6, n = (t.w - S * 2 - e) / 2;
			for (let t of [-1, 1]) g("wall", o(n, v, b, t * (e / 2 + n / 2), x, -a + S));
			for (let t of [-1, 1]) C(n, b, t * (e / 2 + n / 2), -a + S);
			g("wood", o(e + .3, .35, .42, 0, .25 + v, -a + S));
		} else g("wall", o(t.w - S * 2, v, b, 0, x, -a + S)), C(t.w - S * 2, b, 0, -a + S);
		for (let e of [-1, 1]) {
			g("wall", o(b, v, t.d - S * 2, e * (i - S), x, 0)), C(b, t.d - S * 2, e * (i - S), 0);
			let n = Math.min(1.7, v * .5), r = f(Math.min(3.4, t.d * .32), n, .22, .05, .02);
			r.bars.rotateY(e * Math.PI / 2), r.backing.rotateY(e * Math.PI / 2), r.bars.translate(e * (i - S + .18), x + .15, 0), r.backing.translate(e * (i - S + .1), x + .15, 0), g("lattice", r.bars), g("window", r.backing);
		}
		if (!t.openFront) {
			let n = t.w > 20 ? 5 : 3, r = (t.w - 2.2) / n, s = Math.floor(n / 2), c = Array.from({ length: n }, (e, t) => t);
			for (let n of c) {
				let c = -i + 1.1 + r * (n + .5), l = r - .35, u = Math.min(v - .55, 3.5);
				if (n === s) {
					g("gold", o(.16, u, .2, c - l / 2 - .1, .25 + u / 2, a - S + .2)), g("gold", o(.16, u, .2, c + l / 2 + .1, .25 + u / 2, a - S + .2)), t.name === "main" && t.studyFacade || g("gold", o(l + .2, .18, .2, c, .25 + u + .12, a - S + .2));
					continue;
				}
				let d = f(l, u, .17, .055, a - S + .18);
				d.bars.translate(c, 0, 0), d.backing.translate(c, 0, 0), g("lattice", d.bars), g("woodDark", d.backing), g("wood", o(l + .18, .16, .24, c, .25 + u + .1, a - S + .18)), g("wood", o(.16, u + .2, .24, c - l / 2 - .09, .25 + u / 2, a - S + .18)), g("wood", o(.16, u + .2, .24, c + l / 2 + .09, .25 + u / 2, a - S + .18)), g("woodDark", o(l, u * .34, .1, c, .25 + u * .17, a - S + .1));
				for (let t = -2; t <= 2; t++) for (let n = 0; n < 2; n++) g("gold", new e.SphereGeometry(.035, 6, 4).translate(c + t * .62, 1 + n * .32, a - S + .06));
			}
		}
		if (t.name === "main") {
			let e = .45, n = t.w / 2 + 1.2, r = t.d / 2 + 1.45;
			for (let t = 0; t <= 14; t++) {
				let i = -n + 2 * n * t / 14;
				Math.abs(i) < 3.6 || (g("stone", o(.24, .9, .24, i, e + .45, r)), g("stone", o(.26, .1, .26, i, e + .92, r)));
			}
			for (let t = 0; t <= 10; t++) {
				let i = -r + 2 * r * t / 10;
				for (let t of [-1, 1]) g("stone", o(.24, .9, .24, t * n, e + .45, i)), g("stone", o(.26, .1, .26, t * n, e + .92, i));
			}
			for (let t of [-1, 1]) g("stone", o(.16, .16, 2 * r, t * n, e + .8, 0));
			for (let t of [-1, 1]) g("stone", o(n - 3.6, .16, .16, t * (n + 3.6) / 2, e + .8, r));
		}
		if (l = !1, !(this.enrichedSmallHalls && [
			"west",
			"east",
			"rear"
		].includes(t.name ?? ""))) {
			let c = t.w - S * 2 - .55, l = t.d - S * 2 - .55, u = t.plinth + .25, d = 1.35, p = Math.floor(c / d), m = Math.floor(l / d);
			for (let e = 0; e < m; e++) for (let t = 0; t < p; t++) {
				let n = -c / 2 + (t + .5) * c / p, r = -l / 2 + (e + .5) * l / m, i = (t * 11 + e * 7) % 7 * .002;
				g("floor", I(o(c / p - .018, .045, l / m - .018, n, u + .005 + i, r), .82 + (t * 13 + e * 7) % 11 * .022));
			}
			for (let e of [-1, 1]) {
				g("woodDark", o(.11, .44, l, e * c / 2, u + .22, 0)), g("bronze", o(.025, .035, l, e * c / 2, u + .45, 0));
				for (let t of [-l * .24, l * .24]) {
					let n = f(Math.min(2.5, l * .32), 2.1, .26, .055, 0);
					n.bars.rotateY(Math.PI / 2), n.backing.rotateY(Math.PI / 2), n.bars.translate(e * (i - S - .23), u + .77, t), n.backing.translate(e * (i - S - .27), u + .77, t), g("lattice", n.bars), g("paper", n.backing);
				}
			}
			for (let e of [-l / 2, l / 2]) if (e > 0 || t.name === "gate" || t.name === "west") {
				let n = t.name === "main" ? 5.4 : t.name === "rear" || t.name === "gate" ? 4.6 : 3.4, r = (c - n) / 2;
				for (let t of [-1, 1]) {
					let i = t * (n / 2 + r / 2);
					g("woodDark", o(r, .44, .11, i, u + .22, e)), g("bronze", o(r, .035, .025, i, u + .45, e));
				}
			} else g("woodDark", o(c, .44, .11, 0, u + .22, e)), g("bronze", o(c, .035, .025, 0, u + .45, e));
			let h = Math.max(u + 2.9, r - .35);
			for (let e = 0; !n && e < Math.max(2, Math.floor(l / 3.4)); e++) {
				let t = -l / 2 + (e + .5) * l / Math.max(2, Math.floor(l / 3.4));
				g("wood", o(c + .2, .2, .24, 0, h, t));
				for (let e of [-c / 3, c / 3]) g("dougong", o(.4, .32, .4, e, h - .25, t));
			}
			if (t.name !== "gate" && t.name !== "main" && t.name !== "west") {
				let t = -a + 2.7, n = Math.min(5.5, c * .62);
				g("woodDark", o(n, .16, 1.22, 0, u + .93, t)), g("bronze", o(n + .12, .07, 1.3, 0, u + 1.04, t)), g("woodDark", o(n - .35, .13, 1.05, 0, u + .26, t));
				for (let e of [-1, 1]) for (let r of [-1, 1]) {
					let i = e * (n / 2 - .24), a = t + r * .42;
					g("wood", o(.22, .78, .22, i, u + .45, a)), g("bronze", o(.24, .06, .24, i, u + .83, a));
				}
				g("gold", o(n - .4, .055, .055, 0, u + .73, t + .59)), g("wood", o(n + .3, 2.7, .22, 0, u + 2.35, t - .72)), g("gold", s(.5, .58, .13, 20, 0, u + 1.2, t)), g("gold", s(.34, .51, .63, 20, 0, u + 1.58, t)), g("gold", new e.SphereGeometry(.29, 18, 14).translate(0, u + 2.03, t)), g("gold", new e.TorusGeometry(.44, .045, 8, 28).translate(0, u + 1.99, t - .24));
				for (let r of [-1, 1]) g("bronze", s(.085, .11, .55, 10, r * Math.min(1.75, n * .32), u + 1.24, t + .1)), g("lantern", new e.SphereGeometry(.12, 10, 8).translate(r * Math.min(1.75, n * .32), u + 1.56, t + .1));
				for (let e of [-1, 1]) {
					let r = e * n * .34;
					g("bronze", s(.14, .22, .28, 12, r, u + 1.2, t + .3));
					for (let e = 0; e < 3; e++) g("woodDark", s(.012, .015, .55 + e * .08, 6, r + (e - 1) * .045, u + 1.56, t + .3));
				}
			}
		}
		if (l = !0, !n) {
			g("wood", o(t.w + .4, .42, .42, 0, r - .2, a - .9)), g("wood", o(t.w + .4, .42, .42, 0, r - .2, -a + .9));
			for (let e of [-1, 1]) g("wood", o(.42, .42, t.d - 1.6, e * (i - .9), r - .2, 0));
			g("wood", o(t.w + 1.4, .34, .7, 0, r + .05, a - .3)), g("wood", o(t.w + 1.4, .34, .7, 0, r + .05, -a + .3));
			let n = this.dougongCluster(), c = Math.max(3, Math.round(t.w / 2.3));
			for (let e = 0; e <= c; e++) {
				let o = -i + .9 + (t.w - 1.8) * e / c;
				for (let e of [-1, 1]) {
					let t = n.clone();
					t.translate(o, r - .05, e * (a - .75)), g("dougong", t);
				}
			}
			let l = Math.max(2, Math.round(t.d / 2.5));
			for (let e = 1; e < l; e++) {
				let o = -a + .9 + (t.d - 1.8) * e / l;
				for (let e of [-1, 1]) {
					let t = n.clone();
					t.rotateY(Math.PI / 2), t.translate(e * (i - .75), r - .05, o), g("dougong", t);
				}
			}
			let u = Math.round((t.w + 2) / .42);
			for (let e = 0; e <= u; e++) {
				let n = -i - .8 + (t.w + 1.6) * e / u;
				for (let t of [-1, 1]) {
					let i = o(.1, .12, 1.45, n, r + .02, t * (a + .45));
					i.rotateX(.12 * t), g(e % 2 ? "wood" : "dougong", i);
				}
			}
			let d = Math.round((t.d + 2) / .42);
			for (let e = 0; e <= d; e++) {
				let n = -a - .8 + (t.d + 1.6) * e / d;
				for (let t of [-1, 1]) {
					let a = o(1.45, .12, .1, t * (i + .45), r + .02, n);
					a.rotateZ(-.12 * t), g(e % 2 ? "wood" : "dougong", a);
				}
			}
			let f = Math.max(2, Math.round(t.w / 6));
			for (let n = 0; n <= f; n++) {
				let o = -i + 1.4 + (t.w - 2.8) * n / f, c = r - 1.05, l = a + .15, u = new e.SphereGeometry(.17, 10, 8);
				u.scale(1, 1.18, 1), u.translate(o, c, l), g("lantern", u), g("gold", s(.09, .09, .08, 8, o, c + .3, l)), g("gold", s(.09, .09, .08, 8, o, c - .3, l)), g("gold", s(.012, .012, .55, 4, o, c + .6, l));
			}
		}
		if (n) {
			let e = 9.1, n = r + .16;
			g("gateRoof", u({
				w: e,
				d: t.d,
				eaveY: n,
				rise: 3.05,
				cornerLift: .88,
				overhang: 1.25,
				nu: 34,
				nv: 14
			})), this.ridgeAndTips(c, e, t.d, n + 3.05, n), g("wood", o(8.9, .14, t.d + .35, 0, r - .1, 0));
			for (let e of [
				-3.45,
				-1.72,
				0,
				1.72,
				3.45
			]) g("woodDark", o(8.9, .2, .24, 0, r - .28, e));
			for (let e of [-3.65, 3.65]) g("woodDark", o(.22, .2, t.d + .35, e, r - .28, 0));
			g("woodDark", o(8.9, 2.1, .32, 0, r - 1.07, -a + 1.35));
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
				n.translate(e * 5.15, 0, 0), g("gateRoof", n), g("woodDark", o(6.1, .28, .42, e * 5.15, 3.62, a - .25)), g("woodDark", o(6.1, .28, .42, e * 5.15, 3.62, -a + .25));
			}
			for (let e of [-1, 1]) {
				for (let t of [-a + .82, a - .82]) g("woodDark", o(.62, r - .35, .7, e * 3.22, (r - .35) / 2 + .25, t));
				g("dougong", o(1.22, .29, 1.55, e * 3.22, r - .25, a - .25));
			}
			g("woodDark", o(8.9, .7, .7, 0, r - .63, a - .35)), g("wood", o(9.5, .3, .62, 0, r + .02, a - .3)), g("wood", o(9.5, .3, .62, 0, r + .02, -a + .3)), g("bronze", o(8.75, .05, .75, 0, r - .27, a - .35));
		} else if (t.double) {
			let e = t.name === "main" ? "mainRoof" : "roof";
			g(e, d({
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
			g("wall", o(t.w - 2.2, 3, t.d - 2.2, 0, r + 1.5, 0));
			for (let e = 0; e <= 12; e++) g("wood", o(.1, .7, .1, -i + 1.2 + (t.w - 2.4) * e / 12, r + .55, a - 1.05));
			g("wood", o(t.w - 2.4, .12, .14, 0, r + .9, a - 1.05));
			for (let e = 0; e < 5; e++) {
				let n = -i + 1.6 + (t.w - 3.2) * (e + .5) / 5, s = f((t.w - 3.2) / 5 - .25, 1.4, .24, .07, a - .95);
				s.bars.translate(n, r + 1.55, 0), s.backing.translate(n, r + 1.55, 0), g("lattice", s.bars), g("window", s.backing);
				for (let e = 0; e <= 4; e++) g("wood", o(.08, 1.4, .12, n - (t.w - 3.2) / 10 + e * ((t.w - 3.2) / 20), r + 1.55 + .7, a - .88));
			}
			g("wood", o(t.w + .6, .35, .5, 0, n, a - .7)), g("wood", o(t.w + .6, .35, .5, 0, n, -a + .7)), g(e, u({
				w: t.w - 1.4,
				d: t.d - 1.4,
				eaveY: n + .2,
				rise: t.rise + .4,
				cornerLift: .95,
				overhang: 1.45,
				nu: 38,
				nv: 16
			})), this.ridgeAndTips(c, t.w - 1.4, t.d - 1.4, n + .2 + t.rise + .4, n + .2, e);
		} else g("roof", u({
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
				a.rotateX(Math.PI / 2), a.translate(i, t.y, t.z), g("gateRoof", a);
			}
		}
		else if (!t.studyFacade) {
			let n = t.double ? r + 2.1 : r + .15, i = t.w / 2 + 1.1, a = Math.round(i * 2 / .34);
			for (let r = 0; r <= a; r++) {
				let o = -i + 2 * i * r / a;
				for (let r of [-1, 1]) {
					let i = new e.CylinderGeometry(.075, .075, .05, 8);
					i.rotateX(Math.PI / 2), i.translate(o, n - .06, r * (t.d / 2 + 1.1)), g("roof", i);
				}
			}
		}
		for (let t of n ? [] : [-1, 1]) for (let n of [-1, 1]) {
			let o = 1.15;
			g("bronze", s(.14, .2, .5, 8, t * (i + o), r - .55, n * (a + o))), g("bronze", new e.SphereGeometry(.09, 8, 6).translate(t * (i + o), r - .85, n * (a + o)));
		}
		if (n) {
			for (let e of [-1, 1]) {
				let t = e * (i - 2.2), n = a - S + .23;
				g("gatePlaster", o(2.42, 2.57, .045, t, 2.02, n - .08));
				let r = f(1.64, 1.67, .21, .065, n + .05);
				r.bars.translate(t, 1.25, 0), r.backing.translate(t, 1.25, 0), g("lattice", r.bars), g("woodDark", r.backing);
				for (let e of [-1.23, 1.23]) g("woodDark", o(.13, 2.72, .16, t + e, 1.98, n + .025));
				for (let e of [.63, 3.34]) g("woodDark", o(2.58, .13, .16, t, e, n + .025));
			}
			g("woodDark", o(8.9, .5, .22, 0, r - 1.06, a + .3));
		}
		if (t.plaque) {
			let n = t.name === "gate" || t.name === "main" ? ne(t.name) : void 0, i = n ?? p(t.plaque, 512, 150, {
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
			}), c = t.name === "main" && t.studyFacade, l = t.name === "gate" ? 1.18 : 1.45, u = c ? r + 2.03 : .25 + Math.min(v - .55, 3.5) + l, d = c ? a - .71 : a + (t.name === "gate" ? .62 : -.35), f = c ? 5.5 : 4.2, m = c ? 1.52 : 1.2, h = new e.Mesh(new e.PlaneGeometry(f, m), s);
			if (h.position.set(t.x, y.platform.y + u, t.z + d), h.castShadow = !1, h.name = `plaque-${t.name}`, this.group.add(h), c) {
				g("woodDark", o(f + .36, m + .3, .17, 0, u, d - .16));
				for (let e of [-1, 1]) g("gold", o(f + .34, .055, .05, 0, u + e * (m / 2 + .11), d - .055)), g("gold", o(.055, m + .22, .05, e * (f / 2 + .12), u, d - .055));
			} else g("gold", o(4.5, 1.45, .16, 0, u, a + (t.name === "gate" ? .48 : -.48)));
		}
		let w = t.rotY ?? 0, T = Math.cos(w), E = Math.sin(w);
		for (let e of Object.keys(c)) for (let n of c[e]) w && n.rotateY(w), n.translate(t.x, y.platform.y, t.z), this.roles[e].push(n);
		let D = this.enrichedSmallHalls && [
			"west",
			"east",
			"rear"
		].includes(t.name ?? ""), O = new e.PointLight(D ? 16768432 : 16758647, t.name === "main" ? 6 : n ? 4.4 : D ? t.name === "rear" ? 14 : 10 : 2.8, t.name === "main" ? 18 : n ? 12 : D ? 13 : 10, 2);
		O.name = `temple-${t.name}-existing-room-light`, O.position.set(t.x, y.platform.y + (n ? 4.1 : D ? r - .88 : Math.max(3.2, t.plinth + 2.3)), t.z), this.group.add(O), this.anchors.eaves.push(new e.Vector3(t.x + E * (a + 1), y.platform.y + r, t.z + T * (a + 1))), t.name === "main" && this.anchors.door.set(t.x, y.platform.y + 1.6, t.z + a + 1.5);
	}
	column(e, t, n, r, i, a = (e) => e) {
		e[a("stone")].push(s(.4, .46, .24, 10, t, n + .06, r)), e[a("wood")].push(s(.27, .33, i - .24, 12, t, n + .24 + (i - .24) / 2, r)), e.gold.push(s(.31, .31, .08, 12, t, n + i - .16, r)), e.bronze.push(s(.33, .33, .05, 12, t, n + .36, r));
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
		let n = y.platform, r = (n, r, i, a) => {
			let s = i - n, c = a - r, l = Math.hypot(s, c), u = (n + i) / 2, d = (r + a) / 2, f = Math.atan2(s, c), p = Math.cos(f), m = -Math.sin(f), h = -.02, g = 1.11, _ = 1.03, v = 3.33;
			this.add("stone", o(.86, g - h, l + .25, u, t + (h + g) / 2, d, f)), this.add("gatePlaster", o(.34, v - _, l - .08, u, t + (_ + v) / 2, d, f)), this.add("woodDark", o(.5, .18, l + .22, u, t + v + .015, d, f));
			for (let n of [-1, 1]) {
				this.add("woodDark", o(.1, .16, l + .48, u + n * p * .88, t + v + .06, d + n * m * .88, f));
				let r = new e.BoxGeometry(.95, .1, l + .5);
				r.rotateZ(n * .34), r.rotateY(f), r.translate(u + p * n * .38, t + v + .2, d + m * n * .38), this.add("dark", r);
			}
			this.add("dark", o(.18, .14, l + .52, u, t + v + .36, d, f));
			let y = Math.max(2, Math.ceil(l / 6.4));
			for (let e = 0; e <= y; e++) {
				let i = e / y;
				this.add("woodDark", o(.46, v - _ + .12, .46, n + s * i, t + (_ + v) / 2, r + c * i, f));
			}
		};
		r(n.x0 + .5, n.z0 + 1, n.x0 + .5, 3.8), r(n.x0 + .5, 10.2, n.x0 + .5, n.z1 - 1);
		for (let e of [3.8, 10.2]) this.add("stone", o(.75, 3.7, .75, n.x0 + .5, t + 1.85, e));
		this.add("roof", o(1.25, .35, 7.1, n.x0 + .5, t + 4, 7)), this.add("wood", o(.22, .4, 2, n.x0 + .05, t + 3.45, 7));
		let i = new e.Mesh(new e.PlaneGeometry(1.76, .34), new e.MeshStandardMaterial({
			map: p("西山道", 512, 128, {
				bg: "#302923",
				fg: "#d4b674",
				border: "#8f7755"
			}),
			roughness: .88,
			side: e.DoubleSide
		}));
		i.rotation.y = Math.PI / 2, i.position.set(n.x0 + .2, t + 3.45, 7), this.group.add(i), this.add("stone", o(4.25, .95, 3.2, -34.25, t + .475, 7)), this.add("floor", I(o(4.3, .06, 3.25, -34.25, t + .98, 7), .92)), this.balustrade(4.1, 9.9, n.x0 + .5, t + .98, "z"), r(n.x0 + .5, n.z0 + 1, n.x1 - .5, n.z0 + 1), r(n.x1 - .5, n.z0 + 1, n.x1 - .5, 23), r(n.x1 - .5, 33, n.x1 - .5, n.z1 - 1), this.add("wood", o(.4, 3.2, 1, n.x1 - .5, t + 2, 23.4)), this.add("wood", o(.4, 3.2, 1, n.x1 - .5, t + 2, 32.6)), this.add("roof", o(1.9, .3, 10.4, n.x1 - .5, t + 3.75, 28));
		for (let r of [-1, 1]) {
			let i = 28 + r * 4.58, a = n.x1 + 1.68;
			this.add("wood", o(4.38, 2.72, .22, a, t + 1.71, i));
			for (let e of [-1.98, 1.98]) this.add("bronze", o(.13, 2.8, .3, a + e, t + 1.71, i));
			for (let e of [
				.64,
				1.55,
				2.48
			]) this.add("bronze", o(4.25, .15, .3, a, t + e, i));
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
			let c = s(.09, .09, .055, 8, a - 1.62, t + 1.55, i - .16);
			c.rotateX(Math.PI / 2), this.add("bronze", c);
		}
		let a = [
			.34,
			.52,
			.66,
			.52,
			.34
		];
		for (let e = 0; e < a.length; e++) this.add("stone", o(2.55, .28, 4.6, 30.9 + e * 2.55, t + a[e] - .14, 28));
		for (let e = 0; e < 3; e++) {
			let n = .11 + e * .11;
			this.add("stone", o(.72, .18, 4.75, 28.38 + e * .72, t + n - .09, 28));
		}
		for (let e of [25.9, 30.1]) {
			for (let n = 0; n < a.length; n++) {
				let r = 30.9 + n * 2.55, i = t + a[n];
				this.add("stone", o(2.58, .17, .22, r, i + .93, e));
			}
			for (let n = 0; n <= 10; n++) {
				let r = n / 10, i = Math.min(4, Math.floor(r * 5));
				this.add("stone", o(.18, 1.02, .18, 29.2 + r * 14, t + a[i] + .48, e));
			}
		}
		for (let e of [31.3, 40.9]) this.add("stone", o(.78, 2.2, 3.8, e, t - .78, 28));
	}
	buildBuddha(t) {
		let n = h.x, r = h.z + 1.15, i = t + 1.1;
		this.add("bronze", s(1.58, 1.72, .18, 36).translate(n, i + .09, r)), this.add("bronze", s(1.43, 1.55, .38, 36).translate(n, i + .37, r)), this.add("gold", s(1.48, 1.52, .055, 36).translate(n, i + .19, r)), this.add("gold", s(1.34, 1.4, .07, 36).translate(n, i + .57, r)), this.add("bronze", s(1.17, 1.3, .15, 36).translate(n, i + .67, r));
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
		o.position.set(n, i + 2.8, h.z + .6), this.group.add(o);
	}
	finalize() {
		for (let t of Object.keys(this.roles)) {
			let n = this.roles[t];
			if (!n.length) continue;
			let r = c(n), i = {
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
			}, a = i[t] ? l(r, i[t]) : r, o = {
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
			o[t] && (we(a, o[t], o[t] === "plaster" ? void 0 : y.platform.y), this.materials[t].vertexColors = !0);
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
function je(t, n = 28) {
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
function Me(t) {
	let n = t.clone(!0), r = /* @__PURE__ */ new Map();
	return n.traverse((t) => {
		if (!(t instanceof e.Mesh)) return;
		let n = r.get(t.geometry);
		n || (n = je(t.geometry), r.set(t.geometry, n)), t.geometry = n;
	}), n;
}
function Ne(t, n = 75) {
	let r = new e.PerspectiveCamera(), i = t.update.bind(t);
	t.update = (e) => {
		let t = e, a = Number.isFinite(t.fov) ? Math.max(1, Math.tan(n * Math.PI / 360) / Math.tan(t.fov * Math.PI / 360)) : 1;
		r.matrixWorld.copy(e.matrixWorld), r.zoom = (t.zoom || 1) * a, i(r);
	};
}
//#endregion
//#region src/world/main_hall_study.ts
function Pe(t, n) {
	let r = new e.Group();
	r.name = "lingyin-main-hall-interior";
	let i = y.temple.x, a = y.temple.z, u = y.platform.y + 1.35, d = y.platform.y + 9.72, f = (h.w - 3.25) / g.x, p = (h.d - 3.25) / g.z, m = y.platform.y + 9.9;
	function _() {
		let o = t.materials.mainRoof;
		o instanceof e.MeshStandardMaterial && (o.map = n.redRoof, o.normalMap = null, o.bumpMap = n.redRoof, o.bumpScale = .035, o.color.set("#f3dfd4"), o.roughness = .88, o.needsUpdate = !0);
		let s = m + 1.55;
		E("darkWood", 24, 2.5, .09, 0, s, 7.45);
		for (let e of [
			-9.2,
			-5.1,
			5.1,
			9.2
		]) {
			E("teal", 3.5, 1.45, .055, e, s, 7.52);
			for (let t = -4; t <= 4; t++) E("darkWood", .055, 1.43, .06, e + t * .39, s, 7.57);
			for (let t = -1; t <= 1; t++) E("gilt", 3.5, .035, .06, e, s + t * .48, 7.58);
		}
		for (let e of [
			-12,
			-7.15,
			-3.25,
			3.25,
			7.15,
			12
		]) E("lacquer", .36, 2.56, .32, e, s, 7.69), E("gilt", .47, .07, .37, e, m + .29, 7.69);
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
			E("teal", t + .1, n + .06, .16, 0, r, o - .1), E("gilt", t + .12, .035, .17, 0, r - n / 2 - .04, o - .09), E("gilt", t + .12, .035, .17, 0, r + n / 2 + .04, o - .09);
			let s = new e.PlaneGeometry(t, n);
			s.translate(i, r, a + o), f.push(s);
		}
		let p = new e.Mesh(c(f), d);
		p.name = "hall-exterior-painted-eaves", r.add(p);
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
			E("darkWood", 3.65, 5.25, .085, e, u + 3.05, 7.51);
			for (let t of [-1.87, 1.87]) E("lacquer", .16, 5.48, .12, e + t, u + 3.05, 7.59);
			for (let t of [-2.7, 2.7]) E("lacquer", 3.95, .16, .12, e, u + 3.05 + t, 7.59);
			for (let t of [
				-1.15,
				-.58,
				0,
				.58,
				1.15
			]) E("teal", .055, 5.1, .09, e + t, u + 3.05, 7.61);
			for (let t of [
				-1.8,
				-.9,
				0,
				.9,
				1.8
			]) E("teal", 3.55, .055, .09, e, u + 3.05 + t, 7.61);
		}
	}
	let v = new e.MeshStandardMaterial({
		name: "hall-worn-cinnabar-lacquer",
		map: n.redLacquer,
		roughness: .51,
		metalness: .02
	}), b = W(!0);
	b.name = "hall-carved-dark-wood", b.color.set("#aa9381"), b.roughness = .9;
	let x = pe();
	x.name = "hall-painted-dougong", x.color.set("#8bafa7"), x.roughness = .92;
	let S = new e.MeshStandardMaterial({
		name: "hall-aged-gilt",
		color: "#b98737",
		metalness: .54,
		roughness: .39,
		emissive: "#2d1907",
		emissiveIntensity: .12
	}), C = new e.MeshStandardMaterial({
		name: "hall-cast-bronze",
		color: "#77603d",
		metalness: .57,
		roughness: .48
	}), w = {
		lacquer: v,
		darkWood: b,
		teal: x,
		gilt: S,
		bronze: C
	}, T = {
		lacquer: [],
		darkWood: [],
		teal: [],
		gilt: [],
		bronze: []
	}, E = (e, t, n, r, s, c, l) => T[e].push(o(t, n, r, i + s, c, a + l)), D = (e, t, n, r, o, c, l, u = 24) => T[e].push(s(t, n, r, u, i + o, c, a + l));
	_();
	let O = t.materials.stone.clone();
	O.name = "hall-weathered-stone-floor", O.vertexColors = !1, O.color.set("#e3dfd6"), O.roughness = .9, O.map = n.stoneFloor, O.map.wrapS = O.map.wrapT = e.RepeatWrapping, O.map.repeat.set(7 * g.x, 4 * g.z), O.map.needsUpdate = !0, O.normalMap = null, O.roughnessMap = null, O.bumpMap = n.stoneFloor, O.bumpScale = .024;
	let k = new e.Mesh(new e.PlaneGeometry(f - .08, p - .08), O);
	k.name = "hall-stone-floor", k.rotation.x = -Math.PI / 2, k.position.set(i, u + .04, a), k.receiveShadow = !0, r.add(k), E("darkWood", f - .08, .16, p - .08, 0, d, 0);
	for (let e of [
		-5.55,
		-2,
		1.55,
		5.35
	]) E("teal", f - .2, .72, .54, 0, d - .38, e), E("gilt", f - .2, .045, .62, 0, d - .76, e);
	for (let e of [
		-10,
		-7.7,
		-3.8,
		3.8,
		7.7,
		10
	]) E("teal", .54, .55, p - .2, e, d - .28, 0);
	for (let e of [-10.7, 10.7]) E("gilt", .035, .06, p - .2, e, d - .58, 0);
	let A = n.paintedBeam.clone();
	A.wrapS = e.RepeatWrapping, A.repeat.set(8, 1), A.needsUpdate = !0;
	let j = new e.MeshStandardMaterial({
		name: "hall-painted-beam-art",
		map: A,
		roughness: .74,
		metalness: .03,
		side: e.DoubleSide
	}), M = [];
	for (let t of [
		-5.55,
		-2,
		1.55,
		5.35
	]) {
		let n = new e.PlaneGeometry(f - .25, .61);
		n.translate(i, d - .37, a + t + .286), M.push(n);
	}
	let ee = new e.Mesh(c(M), j);
	ee.name = "hall-painted-crossbeams", r.add(ee);
	let te = new e.MeshStandardMaterial({
		name: "hall-dragon-coffer-art",
		map: n.coffer,
		roughness: .76,
		side: e.DoubleSide,
		emissive: "#45301d",
		emissiveIntensity: .08
	}), N = new e.Mesh(new e.PlaneGeometry(6.75, 6.15), te);
	N.name = "hall-central-dragon-coffer", N.rotation.x = Math.PI / 2, N.position.set(i, d - .11, a + .1), r.add(N);
	for (let e of [-1, 1]) E("gilt", .09, .045, 6.48, e * 3.43, d - .12, .1), E("gilt", 6.95, .045, .09, 0, d - .12, .1 + e * 3.15);
	for (let [e, t] of Te) {
		for (let n of Ee) D(n.role, n.rt, n.rb, n.h, e, y.platform.y + n.y, t, n.segments);
		for (let n = 0; n < 3; n++) {
			let r = d - .44 + n * .16, i = .85 + n * .25;
			E("teal", 2 * i, .16, .58, e, r, t), E("teal", .62, .16, 2 * i, e, r + .07, t), E("gilt", 2 * i, .025, .06, e, r - .09, t + .29);
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
	]) E("teal", 1.42, .16, .38, e, d - .82, t), E("teal", .47, .22, .9, e, d - .68, t), E("gilt", 1.32, .035, .04, e, d - .92, t + .22);
	let ne = new e.MeshStandardMaterial({
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
		for (let e of [-1.39, 1.39]) E("darkWood", .12, 5.7, .13, r - t * .08, o, n + e);
		for (let e of [-2.82, 2.82]) E("darkWood", .12, .14, 2.85, r - t * .08, o + e, n);
		for (let e = -3; e <= 3; e++) E("darkWood", .045, 5.5, .045, r - t * .13, o, n + e * .36);
		for (let e = -6; e <= 6; e++) E("darkWood", .045, .045, 2.7, r - t * .13, o + e * .4, n);
	}
	let F = new e.Mesh(c(P), ne);
	F.name = "hall-daylit-lattice-windows", r.add(F);
	for (let e of [-1, 1]) E("darkWood", .18, 1.05, p - .25, e * (f / 2 - .12), u + .57, 0), E("gilt", .035, .035, p - .25, e * (f / 2 - .19), u + 1.12, 0);
	for (let e of Oe) E(e.role, e.w, e.h, e.d, e.x, u + e.y, e.z);
	E("teal", 18, .8, .42, 0, d - .65, -6.23);
	for (let e of [
		-6.9,
		-2.3,
		2.3,
		6.9
	]) E("lacquer", .18, 6.95, .13, e, u + 4.1, -6.48), E("gilt", .035, 6.9, .04, e + .13, u + 4.1, -6.4);
	for (let e of [u + 5.5, u + 7.15]) E("teal", 17.1, .24, .2, 0, e, -6.45), E("gilt", 17.1, .035, .22, 0, e - .13, -6.45);
	for (let e of [-8.75, 8.75]) E("lacquer", .4, 4.8, .36, e, u + 2.5, -6.35), E("gilt", .07, 4.4, .04, e + (e < 0 ? .23 : -.23), u + 2.52, -6.12);
	let re = Ie(), ie = new e.MeshBasicMaterial({
		name: "hall-gilt-halos",
		map: re,
		transparent: !0,
		depthWrite: !1,
		side: e.DoubleSide
	}), ae = Me(n.buddhaSideLod);
	for (let t of [
		-4.6,
		0,
		4.6
	]) {
		let o = t === 0, s = new e.Mesh(new e.PlaneGeometry(o ? 4.5 : 3.55, o ? 4.5 : 3.55), ie);
		s.name = "hall-statue-halo", s.position.set(i + t, u + (o ? 4.05 : 3.56), a - 6.37), r.add(s);
		let c = new e.LOD();
		c.position.set(i + t, u + .9, a - 4.82), c.addLevel(Fe(o ? n.buddhaScan : n.buddhaSideLod, S, o ? 1.35 : 1.05, 0, 0, 0), 0), o && c.addLevel(Fe(n.buddhaSideLod, S, 1.35, 0, 0, 0), 20, .12), c.addLevel(Fe(ae, S, o ? 1.35 : 1.05, 0, 0, 0), 40, .12), Ne(c), c.name = o ? "hall-central-buddha" : "hall-flanking-buddha", r.add(c);
	}
	E("gilt", 13.4, .035, .06, 0, u + 1.07, -1.3), E("gilt", 13.4, .035, .06, 0, u + .59, -1.3);
	let I = n.carvedAltar.clone();
	I.wrapS = e.RepeatWrapping, I.repeat.set(5, 1), I.needsUpdate = !0;
	let L = new e.Mesh(new e.PlaneGeometry(13.26, .7), new e.MeshStandardMaterial({
		name: "hall-carved-altar-front",
		map: I,
		roughness: .68,
		metalness: .04,
		side: e.DoubleSide
	}));
	L.name = "hall-carved-altar-front", L.position.set(i, u + .84, a - 1.31), r.add(L);
	for (let e of [
		-6.3,
		-3.2,
		0,
		3.2,
		6.3
	]) E("gilt", .08, .45, .08, e, u + .87, -1.15);
	let oe = [];
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
		D("bronze", .13, .2, .25, t, u + 1.45, -2.04, 12), D("gilt", .045, .07, .28, t, u + 1.72, -2.04, 10);
		let n = new e.SphereGeometry(.08, 10, 8);
		n.scale(.75, 1.7, .75), n.translate(i + t, u + 1.93, a - 2.04), oe.push(n);
	}
	let R = new e.Mesh(c(oe), new e.MeshBasicMaterial({ color: "#ffd185" }));
	R.name = "hall-altar-flames", r.add(R);
	let z = new e.Mesh(new e.PlaneGeometry(3.65, 11.6), new e.MeshStandardMaterial({
		name: "hall-woven-carpet",
		map: Le(),
		roughness: .94,
		metalness: 0
	}));
	z.name = "hall-processional-carpet", z.rotation.x = -Math.PI / 2, z.position.set(i, u + .055, a + 1.38), r.add(z);
	let B = Re(C, S, i + G.x, u, a + G.z);
	B.scale.setScalar(G.scale), B.position.set((i + G.x) * (1 - G.scale), u * (1 - G.scale), (a + G.z) * (1 - G.scale)), r.add(B);
	let se = new e.PointLight(16759920, 13, 16, 2);
	se.position.set(i, u + 3.6, a - 3), r.add(se);
	for (let t of [-1, 1]) {
		let n = new e.PointLight(16770494, 6, 8, 2);
		n.position.set(i + t * 9, u + 3.2, a + .2), r.add(n);
	}
	for (let t of Object.keys(T)) {
		if (!T[t].length) continue;
		let n = c(T[t]), i = t === "lacquer" ? l(n, 2.4) : t === "darkWood" || t === "teal" ? l(n, .9) : n;
		(t === "lacquer" || t === "darkWood" || t === "teal") && (we(i, "wood", u), w[t].vertexColors = !0);
		let a = new e.Mesh(i, w[t]);
		a.name = "hall-structure-" + t, a.receiveShadow = !0, r.add(a);
	}
	let V = new e.Group();
	V.name = "main-hall-expanded-layout";
	let { x: H, z: U } = g, ce = (t, n) => {
		let i = new e.Group();
		i.name = `${t.name}-proportion-pivot`, i.position.copy(n), i.scale.set(1 / H, 1, 1 / U), t.position.sub(n), r.remove(t), i.add(t), r.add(i);
	};
	for (let t of [...r.children]) (t instanceof e.LOD || t.name === "hall-statue-halo" || t.name === "hall-exterior-round-window" || t instanceof e.Mesh && t.geometry.type === "RingGeometry") && ce(t, t.position.clone());
	ce(B, new e.Vector3(i + G.x, u, a + G.z));
	for (let e of [...r.children]) r.remove(e), V.add(e);
	return V.scale.set(H, 1, U), V.position.set(i * (1 - H), 0, a * (1 - U)), r.add(V), r.userData.expandedLayout = {
		width: h.w,
		depth: h.d,
		centerZ: a,
		statueProportionsPreserved: !0
	}, r;
}
function Fe(t, n, r, i, a, o) {
	let s = t.clone(!0);
	s.rotation.x = Math.PI / 2, s.scale.setScalar(.027 * r), s.position.set(0, 0, 0), s.traverse((t) => {
		t instanceof e.Mesh && (t.material = n);
	}), s.updateMatrixWorld(!0);
	let c = new e.Box3().setFromObject(s);
	return s.position.set(i - (c.min.x + c.max.x) / 2, a - c.min.y, o - (c.min.z + c.max.z) / 2), s;
}
function Ie() {
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
function Le() {
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
function Re(t, n, r, i, a) {
	let o = new e.Group();
	o.name = "hall-tripod-incense-burner";
	let s = De.map(([t, n]) => new e.Vector2(t, n)), c = new e.Mesh(new e.LatheGeometry(s, 28), t);
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
var K = document.querySelector("#hall-canvas"), q = document.querySelector("#hall-status"), ze = document.querySelector("#hall-metrics"), Be = document.querySelector("#study-toggle");
if (!K || !q || !ze || !Be) throw Error("Main hall preview controls are missing");
var J = new e.WebGLRenderer({
	canvas: K,
	antialias: !0,
	powerPreference: "high-performance"
});
J.outputColorSpace = e.SRGBColorSpace, J.toneMapping = e.ACESFilmicToneMapping, J.toneMappingExposure = 1.15, J.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
var Y = new e.Scene();
Y.background = new e.Color("#9bacae"), Y.fog = new e.Fog("#9bacae", 45, 100);
var X = new e.PerspectiveCamera(72, 1, .06, 120), Z = new t(X, K);
Z.enableDamping = !0, Z.dampingFactor = .08, Z.minDistance = .5, Z.maxDistance = 70, Z.maxPolarAngle = Math.PI * .94;
var Ve = !1;
function Q() {
	Ve || (Ve = !0, requestAnimationFrame(() => {
		Ve = !1, Z.update(), J.render(Y, X), ze.textContent = `${J.info.render.calls} draw calls · ${Math.round(J.info.render.triangles / 1e3)}k triangles`;
	}));
}
Z.addEventListener("change", Q), Y.add(new e.HemisphereLight(14280685, 6705468, 1.55));
var He = new e.DirectionalLight(16772040, 2.15);
He.position.set(-12, 28, 19), Y.add(He);
var $ = new e.Mesh(new e.PlaneGeometry(68, 110), new e.MeshStandardMaterial({
	color: "#77756d",
	roughness: .96
}));
$.rotation.x = -Math.PI / 2, $.position.set(-2, y.platform.y - .18, 0), $.name = "preview-only-ground", Y.add($);
var Ue = {
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
function We(e) {
	let t = Ue[e];
	if (!t) return;
	let n = _(t.position[0] + 2, t.position[2] + 12);
	X.position.set(n.x, t.position[1], n.z), X.fov = t.fov ?? 72, X.updateProjectionMatrix();
	let r = _(t.target[0] + 2, t.target[2] + 12);
	Z.target.set(r.x, t.target[1], r.z), Z.update(), Q();
	for (let t of document.querySelectorAll("[data-view]")) t.setAttribute("aria-pressed", String(t.dataset.view === e));
}
for (let e of document.querySelectorAll("[data-view]")) e.addEventListener("click", () => We(e.dataset.view || "front"));
We("exterior");
function Ge() {
	let e = K.clientWidth, t = K.clientHeight;
	J.setSize(e, t, !1), X.aspect = e / t, X.updateProjectionMatrix(), Q();
}
new ResizeObserver(Ge).observe(K), Ge();
async function Ke() {
	q.textContent = "正在载入大殿贴图…", await N(), q.textContent = "正在载入彩绘与佛像…";
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
	u.wrapS = u.wrapT = e.RepeatWrapping, p.wrapS = p.wrapT = e.RepeatWrapping, p.repeat.set(.2, .2), p.needsUpdate = !0, q.textContent = "正在构建三佛殿内空间…";
	let m = new Ae({
		onlyMainHall: !0,
		omitMainHallShrine: !0,
		studyHallEave: 11,
		studyFacade: !0
	});
	Y.add(m.group);
	let h = Pe(m, {
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
	let g = null;
	async function _() {
		if (!g) {
			q.textContent = "正在载入原版供对照…";
			let t = await a.loadAsync(new URL("./assets/lingyin/lotus-mural.jpg", document.baseURI).href);
			t.colorSpace = e.SRGBColorSpace;
			let n = new e.Group();
			n.name = "main-hall-original-comparison", n.add(new Ae({ onlyMainHall: !0 }).group);
			let r = new e.Group();
			r.position.set(-2, y.platform.y + 1.78, -10.85);
			let i = o.scene.clone(!0);
			i.rotation.x = Math.PI / 2, i.scale.setScalar(.027), i.position.set(-1.607, 0, -.413), i.traverse((t) => {
				t instanceof e.Mesh && (t.material = de());
			}), r.add(i), n.add(r);
			let s = new e.Mesh(new e.PlaneGeometry(6.5, 4.2), new e.MeshStandardMaterial({
				map: t,
				roughness: .91
			}));
			s.position.set(-2, y.platform.y + 4.1, -11.28), n.add(s);
			let c = new e.PointLight(16765850, 14, 10, 2);
			c.position.set(-5, y.platform.y + 4.7, -6), n.add(c), g = n, Y.add(n);
		}
		m.group.visible = !1, g.visible = !0, q.textContent = "正在查看旧版 · 勾选开关返回重做版", Q();
	}
	Be.addEventListener("change", () => {
		Be.checked ? (g && (g.visible = !1), m.group.visible = !0, q.textContent = "正在查看三佛殿重做版", Q()) : _().catch((e) => {
			console.error(e), q.textContent = "原版对照载入失败";
		});
	}), q.textContent = "三佛殿已载入 · 拖动旋转、滚轮缩放，切换机位检查细节", document.body.classList.add("hall-ready"), Q();
}
Ke().catch((e) => {
	console.error("Main hall preview failed", e), q.textContent = `预览载入失败：${e instanceof Error ? e.message : String(e)}`;
});
//#endregion
