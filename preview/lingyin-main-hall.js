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
//#region ../scripts/lingyin_main_hall.js
var m = Object.freeze({
	name: "main",
	x: -2,
	z: -26,
	w: 31.5,
	d: 24,
	eave: 12,
	plinth: 2.1,
	rot: 0
}), h = m.plinth + .25, g = Object.freeze({
	count: 12,
	width: 7.2,
	treadDepth: .42,
	treadHeight: .16,
	frontGap: 1.42,
	railWidth: .32,
	railHeight: .72
}), _ = Object.freeze({
	halfClear: g.width / 2,
	jambWidth: .34,
	leafThickness: .22,
	leafDepth: g.width / 2,
	clearHeight: 5.95,
	flankX: 6.76,
	wallZ: m.d / 2 - 1.35
}), v = _.halfClear + _.jambWidth;
function y() {
	let { halfClear: e, jambWidth: t, leafThickness: n, leafDepth: r, clearHeight: i, wallZ: a } = _, o = [], s = (e, t, n, r, i, a, s, c) => o.push({
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
function b(e) {
	let t = Math.max(0, Math.min(g.count - 1, e));
	return {
		z: m.d / 2 + g.frontGap + (g.count - 1 - t) * g.treadDepth,
		top: .24 + t * g.treadHeight
	};
}
var x = Object.freeze({
	x: m.w / 27,
	z: m.d / 17
});
function S(e, t) {
	return {
		x: m.x + e * x.x,
		z: m.z + t * x.z
	};
}
var C = Object.freeze({
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
	landingZ: m.d / 2 + 1.05,
	endX: m.w / 2 + 1
}), ee = g.width / 2 + C.halfPost;
//#endregion
//#region src/world/main_hall_stonework.ts
function w(t) {
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
function T(t) {
	let { z: n, top: r } = b(t), i = (g.treadDepth + .02) / 2, a = [], o = (e, t, n, r) => a.push(...e, ...t, ...r, ...t, ...n, ...r), s = (e) => {
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
	}, c = s(-g.width / 2);
	for (let e = 1; e <= 28; e++) {
		let t = s(g.width * (e / 28 - .5));
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
function E() {
	let t = [], n = /* @__PURE__ */ new Map();
	function r(n, r) {
		n.getAttribute("color") || n.setAttribute("color", new e.Float32BufferAttribute(new Float32Array(n.getAttribute("position").count * 3).fill(r), 3)), t.push(n);
	}
	function i(t) {
		let n = C.halfPost * 2;
		r(o(n, .18, n, t.x, t.y + .09, t.z), .85), r(o(n - .07, .65, n - .07, t.x, t.y + .48, t.z), .97), r(o(n - .026, .072, n - .026, t.x, t.y + .81, t.z), .9), r(o(n, .05, n, t.x, t.y + C.postShoulder - .025, t.z), .98);
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
		i.computeVertexNormals(), i.translate(t.x, t.y + C.postShoulder, t.z), r(i, 1);
	}
	function a(e, t) {
		let i = t.x - e.x, a = t.z - e.z, s = Math.hypot(i, a), c = (e.y + t.y) / 2, l = s - .335, u = (t.y - e.y) / s, d = -Math.atan2(a, i);
		function f(n, i) {
			let a = n.getAttribute("position");
			for (let e = 0; e < a.count; e++) a.setY(e, a.getY(e) + a.getX(e) * u);
			n.computeVertexNormals(), n.rotateY(d), n.translate((e.x + t.x) / 2, c, (e.z + t.z) / 2), r(n, i);
		}
		f(o(l, .19, .255, 0, .115, 0), .87), f(o(l, .405, .15, 0, .402, 0), .87), f(o(l, .055, .214, 0, .61, 0), .91), f(o(l, .052, C.capWidth, 0, C.capTop - .063, 0), .97), f(o(l, .048, C.capWidth - .042, 0, C.capTop - .024, 0), 1);
		let p = Math.round(l * 1e4);
		n.has(p) || n.set(p, w(l));
		for (let e of [-1, 1]) {
			let t = n.get(p).clone();
			e < 0 && t.rotateY(Math.PI), t.translate(0, .405, e * .077), f(t, 1);
		}
	}
	for (let e of [-1, 1]) {
		let t = e * ee;
		for (let e = 0; e < g.count; e++) {
			let n = b(e);
			r(o(.29, n.top + .09, g.treadDepth + .003, t, (n.top + .09) / 2, n.z), .84);
		}
		let n = C.postSteps.map((e) => ({
			x: t,
			z: b(e).z,
			y: b(e).top
		}));
		n.forEach(i);
		for (let e = 1; e < n.length; e++) a(n[e - 1], n[e]);
		let s = Math.abs(t), c = Array.from({ length: C.landingBays + 1 }, (t, n) => ({
			x: e * (s + (C.endX - s) * n / C.landingBays),
			y: h,
			z: C.landingZ
		})), l = n[n.length - 1], u = c[0];
		r(o(.285, .52, Math.abs(l.z - u.z), t, u.y + .27, (l.z + u.z) / 2), .92), c.forEach(i);
		for (let e = 1; e < c.length; e++) a(c[e - 1], c[e]);
	}
	let s = l(c(t), .9), u = new e.MeshStandardMaterial({
		name: "main-hall-carved-balustrade",
		color: 12830403,
		roughness: .86,
		metalness: 0,
		vertexColors: !0
	}), d = new e.Mesh(s, u);
	return d.name = "main-hall-stair-carving", d.castShadow = !0, d.receiveShadow = !0, d;
}
//#endregion
//#region src/world/main_hall_roof.ts
var D = e.MathUtils.lerp, O = .49, k = .315;
function A(t, n, r) {
	return (i, a) => {
		let o = t.upper ? Math.min(a / O, 1) : a, s = D(t.halfWidth, t.innerWidth, o), c = D(t.halfDepth, t.innerDepth, a), l = Math.abs(i) ** 7 * (1 - o) ** 2, u = t.lift * l;
		return new e.Vector3(n ? i * (s + .49 * l) : r * (s + .49 * l), t.eave + t.rise * a ** 1.47 + u, n ? r * (c + .49 * l) : i * (c + .49 * l));
	};
}
function j(t, n, r, i, a) {
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
function M(t, n) {
	return new e.TubeGeometry(new e.CatmullRomCurve3(t), t.length * 2, n, 8, !1);
}
function te(t, n, r, i) {
	let a = o(r, i, n.clone().sub(t).length(), 0, 0, 0), s = new e.Matrix4().lookAt(n, t, new e.Vector3(0, 1, 0));
	return a.applyMatrix4(s).translate((t.x + n.x) / 2, (t.y + n.y) / 2, (t.z + n.z) / 2);
}
function N(t, n, r) {
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
function P(e) {
	let t = e.getAttribute("position").count;
	e.setIndex(Array.from({ length: t }, (e, t) => t - t % 3 + [
		0,
		2,
		1
	][t % 3])), e.computeVertexNormals();
}
function F() {
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
function ne(t, n, r, i) {
	let a = [], s = [], c = [], l = [], u = {
		halfWidth: t / 2 + 2.8,
		halfDepth: n / 2 + 2.8,
		innerWidth: t / 2 - .6,
		innerDepth: n / 2 - .6,
		eave: r + .1,
		rise: 1.5,
		lift: 1.65,
		upper: !1
	}, d = {
		halfWidth: t / 2 - .08,
		halfDepth: n / 2 - .08,
		innerWidth: t * .356,
		innerDepth: 0,
		eave: r + 3.24,
		rise: i + 2.8,
		lift: 1.83,
		upper: !0
	};
	for (let t of [u, d]) for (let n of [!0, !1]) for (let r of [-1, 1]) {
		let i = A(t, n, r), o = 2 * (n ? t.halfWidth : t.halfDepth), d = Math.round(o / k), f = t.upper && !n ? O : 1, p = t.upper ? t.halfDepth : u.halfDepth - u.innerDepth;
		a.push(j(i, d, Math.hypot(p, t.rise), f, n ? r < 0 : r > 0));
		let m = Array.from({ length: 31 }, (e, t) => i(t / 15 - 1, 0));
		c.push(M(m, .077));
		let h = t.upper ? .3 : .94, g = (t, n, r) => i(t * 2 - 1, n).add(new e.Vector3(0, -r, 0));
		for (let e = 0; e < 5; e++) {
			let t = h * e / 5, n = h * (e + 1) / 5, r = N((e) => g(e, t, .115), (e) => g(e, n, .115), 56);
			r.getAttribute("normal").getY(0) > 0 && P(r), s.push(r);
		}
		for (let t = 0; t < d; t++) {
			let a = (t + .5) / d, o = i(2 * a - 1, 0), s = new e.CylinderGeometry(.09, .093, .1, 10);
			if (n ? s.rotateX(r * Math.PI / 2) : s.rotateZ(-r * Math.PI / 2), c.push(s.translate(o.x, o.y + .004, o.z)), t % 2 == 0) for (let e = 0; e < 3; e++) {
				let t = g(a, D(.016, h, e / 3), .19), n = g(a, D(.016, h, (e + 1) / 3), .19);
				l.push(te(t, n, .13, .16));
			}
		}
		if (n) for (let n of [-1, 1]) {
			let a = t.upper ? O : 1, o = Array.from({ length: 15 }, (t, r) => i(n, a * r / 14).add(new e.Vector3(0, .12, 0)));
			c.push(M(o, t.upper ? .16 : .14));
			let s = o[0], l = new e.Vector3(n, 0, r).normalize(), u = new e.Shape();
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
			for (let t = 0; t < f.count; t++) f.setZ(t, f.getZ(t) * D(1, .26, e.MathUtils.smoothstep(f.getX(t), -.12, .6)));
			d.computeVertexNormals(), d.rotateY(-Math.atan2(l.z, l.x)), c.push(d.translate(s.x, s.y, s.z));
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
				c.push(o.translate(r.x, r.y + .19, r.z));
			}
		}
	}
	for (let t of [-1, 1]) {
		let n = N((e) => {
			let n = O + (1 - O) * (1 - Math.abs(2 * e - 1));
			return A(d, !0, e < .5 ? -1 : 1)(t, n);
		}, (n) => new e.Vector3(t * d.innerWidth, d.eave + d.rise * O ** 1.47, (2 * n - 1) * d.halfDepth * (1 - O)), 32);
		n.getAttribute("normal").getX(0) * t < 0 && P(n), s.push(n);
		for (let n of [-1, 1]) {
			let r = Array.from({ length: 17 }, (r, i) => A(d, !0, n)(t, O + (1 - O) * i / 16).add(new e.Vector3(.055 * t, .08, 0)));
			c.push(M(r, .148));
		}
	}
	let f = d.eave + d.rise, p = d.innerWidth;
	c.push(o(2 * p + .36, .36, .54, 0, f + .19, 0)), c.push(M([
		-p,
		0,
		p
	].map((t) => new e.Vector3(t, f + .47, 0)), .2));
	for (let t = -Math.floor(p / .84); t <= Math.floor(p / .84); t++) {
		let n = new e.CylinderGeometry(.216, .216, .056, 12).rotateZ(Math.PI / 2);
		c.push(n.translate(t * .84, f + .47, 0));
	}
	for (let e of [-1, 1]) {
		let t = F();
		e < 0 && t.rotateY(Math.PI), c.push(t.translate(e * p, f + .37, 0));
	}
	for (let e of c) {
		let t = e.getAttribute("uv");
		for (let e = 0; e < t.count; e++) t.setXY(e, .195 + .04 * t.getX(e), .31 + .05 * t.getY(e));
	}
	return {
		tiles: a.concat(c),
		timber: s,
		rafters: l
	};
}
//#endregion
//#region src/core/math.ts
var I = (e, t, n) => e + (t - e) * n, re = 2.45;
re + .27, re + 1.45;
//#endregion
//#region src/world/heightfield.ts
var L = {
	size: 170,
	terrainSegments: 180,
	center: [0, 0],
	temple: {
		x: m.x,
		z: m.z
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
}, R = [
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
	for (let t = 0; t < R.length - 1; t++) {
		let n = R[t], r = R[t + 1];
		for (let t = 0; t < 12; t++) e.push([I(n[0], r[0], t / 12), I(n[1], r[1], t / 12)]);
	}
	return e.push(R[R.length - 1]), e;
})(), L.pond.y;
//#endregion
//#region src/core/materials.ts
var ie = "\nfloat cgHash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }\nfloat cgHash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }\nvec3 cgHash33(vec3 p3){ p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }\nfloat cgNoise2(vec2 p){\n  vec2 i = floor(p), f = fract(p);\n  f = f * f * (3.0 - 2.0 * f);\n  float a = cgHash12(i), b = cgHash12(i + vec2(1,0)), c = cgHash12(i + vec2(0,1)), d = cgHash12(i + vec2(1,1));\n  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);\n}\nfloat cgNoise3(vec3 p){\n  vec3 i = floor(p), f = fract(p);\n  f = f * f * (3.0 - 2.0 * f);\n  float n000 = cgHash12(i.xy + i.z * 19.19);\n  float n100 = cgHash12(i.xy + vec2(1,0) + i.z * 19.19);\n  float n010 = cgHash12(i.xy + vec2(0,1) + i.z * 19.19);\n  float n110 = cgHash12(i.xy + vec2(1,1) + i.z * 19.19);\n  float n001 = cgHash12(i.xy + (i.z + 1.0) * 19.19);\n  float n101 = cgHash12(i.xy + vec2(1,0) + (i.z + 1.0) * 19.19);\n  float n011 = cgHash12(i.xy + vec2(0,1) + (i.z + 1.0) * 19.19);\n  float n111 = cgHash12(i.xy + vec2(1,1) + (i.z + 1.0) * 19.19);\n  return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y), mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);\n}\nfloat cgFbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i=0;i<5;i++){ s += a * cgNoise2(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }\nfloat cgFbm3(vec3 p){ float s = 0.0, a = 0.5; for (int i=0;i<4;i++){ s += a * cgNoise3(p); p = p * 2.05 + 7.3; a *= 0.5; } return s; }\nfloat cgRidge2(vec2 p){ float s = 0.0, a = 0.55; for (int i=0;i<4;i++){ float n = 1.0 - abs(cgNoise2(p) * 2.0 - 1.0); s += a * n * n; p = p * 2.1 + 3.1; a *= 0.5; } return s; }\n// anti-aliased thin line: distance d in world units, width w, pixel footprint aa\nfloat cgLine(float d, float w, float aa){ return 1.0 - smoothstep(w, w + aa, abs(d)); }\n", ae = "\nvarying vec3 vCgWorld;\nvarying vec3 vCgNormalW;\nvarying vec3 vCgObj;\nvarying float vCgSeed;\n", oe = "\n{\n  vec4 cgP = vec4(transformed, 1.0);\n  vec3 cgN = objectNormal;\n  float cgSeedV = 0.0;\n  #ifdef USE_INSTANCING\n    cgP = instanceMatrix * cgP;\n    cgN = mat3(instanceMatrix) * cgN;\n    cgSeedV = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);\n  #endif\n  vCgWorld = (modelMatrix * cgP).xyz;\n  vCgNormalW = normalize(mat3(modelMatrix) * cgN);\n  vCgObj = transformed;\n  vCgSeed = cgSeedV;\n}\n";
function z(t = {}) {
	let n = new e.MeshStandardMaterial(t.params ?? {});
	t.name && (n.name = t.name);
	let r = t.uniforms ?? {}, i = "proc:" + se([
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
		n = n.replace("#include <common>", `#include <common>\n${ae}\n${t.vertexHead ?? ""}`), t.vertexPre && (n = n.replace("#include <begin_vertex>", `#include <begin_vertex>\n{\n${t.vertexPre}\n}`)), n = n.replace("#include <worldpos_vertex>", `#include <worldpos_vertex>\n${oe}`), i = i.replace("#include <common>", `#include <common>\n${ae}\n${ie}\n${t.head ?? ""}`), i = i.replace("void main() {", "void main() {\nvec3 cgP = vCgWorld; vec3 cgN = normalize(vCgNormalW); vec3 cgO = vCgObj; float cgSeed = vCgSeed; vec3 cgBump = vec3(0.0); float cgAO = 1.0;"), t.color && (i = i.replace("#include <color_fragment>", `#include <color_fragment>\n{\n${t.color}\n}`)), t.roughness && (i = i.replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>\n{\n${t.roughness}\n}`)), t.metalness && (i = i.replace("#include <metalnessmap_fragment>", `#include <metalnessmap_fragment>\n{\n${t.metalness}\n}`)), t.normal && (i = i.replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\n{\n${t.normal}\n}\nnormal = normalize(normal + (viewMatrix * vec4(cgBump, 0.0)).xyz);`)), t.emissive && (i = i.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n{\n${t.emissive}\n}`)), t.ao && (i = i.replace("#include <aomap_fragment>", `#include <aomap_fragment>\n{\n${t.ao}\n}\nreflectedLight.indirectDiffuse *= cgAO; reflectedLight.indirectSpecular *= mix(1.0, cgAO, 0.7);`)), e.vertexShader = n, e.fragmentShader = i;
	}, n;
}
function se(e) {
	let t = 2166136261;
	for (let n = 0; n < e.length; n++) t ^= e.charCodeAt(n), t = Math.imul(t, 16777619);
	return (t >>> 0).toString(36);
}
//#endregion
//#region src/world/materials.ts
var ce = null, B = null, V = null, H = null, U = null, le = {}, ue = /* @__PURE__ */ new Map(), de = [
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
function fe(t) {
	let n = ue.get(t);
	if (n) return n;
	let r = new URL(`./assets/lingyin/temple-textures/${t}.webp`, document.baseURI).href + "?v=3", i = new e.TextureLoader().loadAsync(r).then((n) => {
		n.name = `lingyin-${t}`, n.colorSpace = t.endsWith("albedo") || t.startsWith("plaque-") ? e.SRGBColorSpace : e.NoColorSpace, n.wrapS = n.wrapT = t.startsWith("plaque-") ? e.ClampToEdgeWrapping : e.RepeatWrapping, n.minFilter = e.LinearMipmapLinearFilter, n.magFilter = e.LinearFilter, n.anisotropy = 16, le[t] = n;
	});
	return ue.set(t, i), i;
}
function pe() {
	return Promise.all(de.map(fe)).then(() => {});
}
function me(e) {
	return le[`plaque-${e}`];
}
function he(t, n, r, i, a, o) {
	let s = le[n];
	return s ? new e.MeshStandardMaterial({
		name: t,
		map: s,
		normalMap: le[r],
		normalScale: new e.Vector2(o, o),
		roughnessMap: le[i],
		roughness: a,
		metalness: 0
	}) : null;
}
function ge(e, t = !1) {
	let n = he(`gate-photographic-${e}${t ? "-dark" : ""}`, e === "wood" ? "wood-albedo" : "plaster-albedo", e === "wood" ? "wood-normal" : "plaster-normal", e === "wood" ? "wood-roughness" : "plaster-roughness", .94, e === "wood" ? .22 : .2);
	return n && n.color.set(e === "plaster" ? "#b9a276" : t ? "#978575" : "#b39a80"), n;
}
function _e() {
	if (V) return V;
	let t = document.createElement("canvas");
	t.width = t.height = 256;
	let n = t.getContext("2d"), r = n.createImageData(256, 256), i = 1919509349, a = () => ((i = Math.imul(i, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
	for (let e = 0; e < 256; e++) for (let t = 0; t < 256; t++) {
		let n = Math.sin(t * .36 + e * .015) * .012, i = Math.max(.78, Math.min(.96, .88 + (a() - .5) * .065 + n)), o = (e * 256 + t) * 4;
		r.data[o] = Math.round(i * 255), r.data[o + 1] = Math.round(i * 248), r.data[o + 2] = Math.round(i * 230), r.data[o + 3] = 255;
	}
	return n.putImageData(r, 0, 0), V = new e.CanvasTexture(t), V.colorSpace = e.SRGBColorSpace, V.wrapS = V.wrapT = e.RepeatWrapping, V.minFilter = e.LinearMipmapLinearFilter, V.magFilter = e.LinearFilter, V.anisotropy = 8, V;
}
function ve() {
	if (B) return B;
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
	return n.putImageData(r, 0, 0), B = new e.CanvasTexture(t), B.colorSpace = e.SRGBColorSpace, B.wrapS = B.wrapT = e.RepeatWrapping, B.minFilter = e.LinearMipmapLinearFilter, B.magFilter = e.LinearFilter, B.anisotropy = 8, B;
}
function ye() {
	if (ce) return ce;
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
	return d.colorSpace = e.SRGBColorSpace, d.wrapS = d.wrapT = e.RepeatWrapping, d.minFilter = e.LinearMipmapLinearFilter, d.magFilter = e.LinearFilter, d.anisotropy = 8, ce = new e.MeshStandardMaterial({
		name: "weathered-stone-slabs",
		map: d,
		bumpMap: d,
		bumpScale: .048,
		roughness: .94,
		metalness: 0,
		vertexColors: !0
	}), ce;
}
function be(t, n) {
	let r = t.getAttribute("position").count, i = new Float32Array(r * 3);
	for (let e = 0; e < r; e++) {
		let t = n * (.96 + e % 3 * .04);
		i[e * 3] = t, i[e * 3 + 1] = t * .992, i[e * 3 + 2] = t * .978;
	}
	return t.setAttribute("color", new e.BufferAttribute(i, 3)), t;
}
function xe(e = 0) {
	return Se(e) || z({
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
function Se(e = 0) {
	let t = he("stone-photogrammetry", "stone-albedo", "stone-normal", "stone-roughness", .96, .32);
	return t && t.color.set(e > .5 ? 14076600 : 16777215), t;
}
function Ce() {
	let t = le["roof-albedo"], n = le["roof-normal"];
	if (t && n) return t.repeat.set(1 / 5, 1 / 5), n.repeat.set(1 / 5, 1 / 5), new e.MeshStandardMaterial({
		name: "roof-tile-photogrammetry",
		map: t,
		normalMap: n,
		normalScale: new e.Vector2(.28, .28),
		roughness: .86,
		metalness: .02,
		side: e.DoubleSide
	});
	if (!H) {
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
		n.putImageData(r, 0, 0), H = new e.CanvasTexture(t), H.name = "baked-weathered-roof-tiles", H.colorSpace = e.SRGBColorSpace, H.wrapS = H.wrapT = e.RepeatWrapping, H.repeat.set(1 / (12 * .34), 1 / (8 * .52)), H.minFilter = e.LinearMipmapLinearFilter, H.magFilter = e.LinearFilter, H.anisotropy = 8;
	}
	return new e.MeshStandardMaterial({
		name: "roof-tile-baked",
		map: H,
		bumpMap: H,
		bumpScale: .045,
		roughness: .82,
		metalness: .02,
		side: e.DoubleSide
	});
}
function we() {
	let e = Ce();
	return e.name = "main-hall-weathered-red-roof", e.color.set(10178883), e.roughness = .91, e.metalness = 0, e.normalScale && e.normalScale.set(.36, .36), e;
}
function Te() {
	let e = je();
	return e.name = "main-hall-cool-grey-plaster", e.color.set(12170669), e.roughness = 1, e.normalScale && e.normalScale.set(.24, .24), e;
}
function Ee() {
	let e = xe(0);
	return e.name = "main-hall-grey-stone-plinth", e.color.set(11119270), e.roughness = .98, e;
}
function De(e = !1) {
	let t = Me(e);
	return t.name = e ? "main-hall-dark-red-joinery" : "main-hall-weathered-red-timber", t.color.set(e ? 10716535 : 14136229), t.roughness = e ? .9 : .86, t.normalScale && t.normalScale.set(.22, .22), t;
}
function Oe() {
	if (U) return U;
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
	return U = new e.CanvasTexture(t), U.name = "main-hall-painted-beam-pattern", U.colorSpace = e.SRGBColorSpace, U.wrapS = U.wrapT = e.RepeatWrapping, U.repeat.set(2.5, 1), U.minFilter = e.LinearMipmapLinearFilter, U.magFilter = e.LinearFilter, U.anisotropy = 8, U;
}
function ke() {
	let t = Oe();
	return new e.MeshStandardMaterial({
		name: "main-hall-blue-green-painted-beams",
		map: t,
		bumpMap: t,
		bumpScale: .018,
		roughness: .88,
		metalness: .01
	});
}
function Ae() {
	return new e.MeshStandardMaterial({
		name: "main-hall-dark-teal-window",
		color: 1191213,
		emissive: new e.Color(463121),
		emissiveIntensity: .03,
		roughness: .92
	});
}
function je() {
	let e = he("plaster-photogrammetry", "plaster-albedo", "plaster-normal", "plaster-roughness", .98, .18);
	if (e) return e;
	let t = ve();
	return z({
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
function Me(e = !1) {
	return he(e ? "aged-wood" : "red-lacquer-wood", e ? "wood-albedo" : "wood-red-albedo", "wood-normal", "wood-roughness", .82, .16) || z({
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
function Ne() {
	return z({
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
function Pe() {
	return z({
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
function Fe() {
	return z({
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
function Ie() {
	return he("teal-painted-wood", "wood-teal-albedo", "wood-normal", "wood-roughness", .9, .12) || z({
		name: "dougong",
		params: {
			color: 16777215,
			roughness: .6,
			metalness: .02
		},
		color: "\n      float n = cgNoise2(cgP.xz * 5.0 + cgP.y * 2.0);\n      vec3 teal = mix(vec3(0.035,0.095,0.085), vec3(0.09,0.17,0.145), n);\n      float gold = smoothstep(0.75, 0.95, cgNoise2(cgP.xz * 9.0));\n      vec3 c = mix(teal, vec3(0.55,0.40,0.16), gold * 0.55);\n      diffuseColor.rgb = c;\n    "
	});
}
function Le() {
	return new e.MeshStandardMaterial({
		color: new e.Color("#2a1a0c"),
		emissive: new e.Color("#8a4a1e"),
		emissiveIntensity: .03,
		roughness: .9
	});
}
function Re() {
	return new e.MeshStandardMaterial({
		color: new e.Color("#7e1e18"),
		emissive: new e.Color("#ff5a2a"),
		emissiveIntensity: .3,
		roughness: .7
	});
}
//#endregion
//#region src/gate-kit/core/materials.ts
var ze = "\nfloat cgHash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }\nfloat cgHash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }\nvec3 cgHash33(vec3 p3){ p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }\nfloat cgNoise2(vec2 p){\n  vec2 i = floor(p), f = fract(p);\n  f = f * f * (3.0 - 2.0 * f);\n  float a = cgHash12(i), b = cgHash12(i + vec2(1,0)), c = cgHash12(i + vec2(0,1)), d = cgHash12(i + vec2(1,1));\n  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);\n}\nfloat cgNoise3(vec3 p){\n  vec3 i = floor(p), f = fract(p);\n  f = f * f * (3.0 - 2.0 * f);\n  float n000 = cgHash12(i.xy + i.z * 19.19);\n  float n100 = cgHash12(i.xy + vec2(1,0) + i.z * 19.19);\n  float n010 = cgHash12(i.xy + vec2(0,1) + i.z * 19.19);\n  float n110 = cgHash12(i.xy + vec2(1,1) + i.z * 19.19);\n  float n001 = cgHash12(i.xy + (i.z + 1.0) * 19.19);\n  float n101 = cgHash12(i.xy + vec2(1,0) + (i.z + 1.0) * 19.19);\n  float n011 = cgHash12(i.xy + vec2(0,1) + (i.z + 1.0) * 19.19);\n  float n111 = cgHash12(i.xy + vec2(1,1) + (i.z + 1.0) * 19.19);\n  return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y), mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);\n}\nfloat cgFbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i=0;i<5;i++){ s += a * cgNoise2(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }\nfloat cgFbm3(vec3 p){ float s = 0.0, a = 0.5; for (int i=0;i<4;i++){ s += a * cgNoise3(p); p = p * 2.05 + 7.3; a *= 0.5; } return s; }\nfloat cgRidge2(vec2 p){ float s = 0.0, a = 0.55; for (int i=0;i<4;i++){ float n = 1.0 - abs(cgNoise2(p) * 2.0 - 1.0); s += a * n * n; p = p * 2.1 + 3.1; a *= 0.5; } return s; }\n// anti-aliased thin line: distance d in world units, width w, pixel footprint aa\nfloat cgLine(float d, float w, float aa){ return 1.0 - smoothstep(w, w + aa, abs(d)); }\n", Be = "\nvarying vec3 vCgWorld;\nvarying vec3 vCgNormalW;\nvarying vec3 vCgObj;\nvarying float vCgSeed;\n", Ve = "\n{\n  vec4 cgP = vec4(transformed, 1.0);\n  vec3 cgN = objectNormal;\n  float cgSeedV = 0.0;\n  #ifdef USE_INSTANCING\n    cgP = instanceMatrix * cgP;\n    cgN = mat3(instanceMatrix) * cgN;\n    cgSeedV = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);\n  #endif\n  vCgWorld = (modelMatrix * cgP).xyz;\n  vCgNormalW = normalize(mat3(modelMatrix) * cgN);\n  vCgObj = transformed;\n  vCgSeed = cgSeedV;\n}\n";
function He(t = {}) {
	let n = new e.MeshStandardMaterial(t.params ?? {});
	t.name && (n.name = t.name);
	let r = t.uniforms ?? {}, i = "proc:" + Ue([
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
		n = n.replace("#include <common>", `#include <common>\n${Be}\n${t.vertexHead ?? ""}`), t.vertexPre && (n = n.replace("#include <begin_vertex>", `#include <begin_vertex>\n{\n${t.vertexPre}\n}`)), n = n.replace("#include <worldpos_vertex>", `#include <worldpos_vertex>\n${Ve}`), i = i.replace("#include <common>", `#include <common>\n${Be}\n${ze}\n${t.head ?? ""}`), i = i.replace("void main() {", "void main() {\nvec3 cgP = vCgWorld; vec3 cgN = normalize(vCgNormalW); vec3 cgO = vCgObj; float cgSeed = vCgSeed; vec3 cgBump = vec3(0.0); float cgAO = 1.0;"), t.color && (i = i.replace("#include <color_fragment>", `#include <color_fragment>\n{\n${t.color}\n}`)), t.roughness && (i = i.replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>\n{\n${t.roughness}\n}`)), t.metalness && (i = i.replace("#include <metalnessmap_fragment>", `#include <metalnessmap_fragment>\n{\n${t.metalness}\n}`)), t.normal && (i = i.replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\n{\n${t.normal}\n}\nnormal = normalize(normal + (viewMatrix * vec4(cgBump, 0.0)).xyz);`)), t.emissive && (i = i.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n{\n${t.emissive}\n}`)), t.ao && (i = i.replace("#include <aomap_fragment>", `#include <aomap_fragment>\n{\n${t.ao}\n}\nreflectedLight.indirectDiffuse *= cgAO; reflectedLight.indirectSpecular *= mix(1.0, cgAO, 0.7);`)), e.vertexShader = n, e.fragmentShader = i;
	}, n;
}
function Ue(e) {
	let t = 2166136261;
	for (let n = 0; n < e.length; n++) t ^= e.charCodeAt(n), t = Math.imul(t, 16777619);
	return (t >>> 0).toString(36);
}
//#endregion
//#region src/gate-kit/world/materials.ts
var We = new e.DataTexture(new Uint8Array([
	255,
	255,
	255,
	255
]), 1, 1);
We.needsUpdate = !0;
function Ge(e = 0) {
	return ge("wood", e > .5) || He({
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
function Ke() {
	return ge("plaster") || He({
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
function qe(t, n, r) {
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
var Je = Object.freeze({
	x: -31,
	z: 33,
	segments: 8,
	baseH: .7,
	baseTop: 3.1,
	baseBottom: 3.4,
	tiers: 5,
	initialRadius: 2.1
});
function Ye() {
	let e = Je.baseH, t = Je.initialRadius;
	return Array.from({ length: Je.tiers }, (n, r) => {
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
var Xe = Object.freeze({
	name: "main",
	x: -2,
	z: -26,
	w: 31.5,
	d: 24,
	eave: 12,
	plinth: 2.1,
	rot: 0
});
Xe.plinth + .25;
var Ze = Object.freeze({
	count: 12,
	width: 7.2,
	treadDepth: .42,
	treadHeight: .16,
	frontGap: 1.42,
	railWidth: .32,
	railHeight: .72
}), Qe = Object.freeze({
	halfClear: Ze.width / 2,
	jambWidth: .34,
	leafThickness: .22,
	leafDepth: Ze.width / 2,
	clearHeight: 5.95,
	flankX: 6.76,
	wallZ: Xe.d / 2 - 1.35
});
Qe.halfClear + Qe.jambWidth, Object.freeze({
	x: Xe.w / 27,
	z: Xe.d / 17
});
var $e = Object.freeze({
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
	landingZ: Xe.d / 2 + 1.05,
	endX: Xe.w / 2 + 1
});
Ze.width / 2 + $e.halfPost;
//#endregion
//#region ../scripts/lingyin_columns.js
var et = [
	[-9.25, -4.75],
	[9.25, -4.75],
	[-9.25, -2],
	[9.25, -2],
	[-9.25, .5],
	[9.25, .5]
], tt = [
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
], W = Object.freeze({
	w: 4.74,
	d: .82,
	top: .64,
	z: -1.51,
	legX: 2.13,
	legZ: .29
}), nt = Object.freeze({
	z: -3.02,
	d: 1.06,
	wingX: 4.67,
	wingW: 4.64,
	wingTop: .86,
	centreTop: .71
}), G = {
	x: 0,
	z: W.z,
	scale: .4,
	baseY: W.top - .065 * .4
}, rt = {
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
}, it = [
	[.43, 0],
	[.72, .14],
	[.92, .48],
	[1.02, .78],
	[.92, .86],
	[.74, .77],
	[.66, .52],
	[.3, .47]
], K = Object.freeze({
	pitch: 5.3,
	scale: 1.27,
	statueZ: -5.1,
	seatY: 1.115,
	frontZ: -4.17,
	backZ: -6.46,
	postWidth: .2,
	sillY: .62,
	corniceY: 7.89
}), q = K, at = [
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
		w: W.w,
		h: .08,
		d: W.d,
		x: 0,
		y: W.top - .04,
		z: W.z,
		support: !0
	},
	{
		name: "altar-apron",
		role: "darkWood",
		w: 2 * W.legX,
		h: .15,
		d: .08,
		x: 0,
		y: W.top - .155,
		z: W.z + W.legZ,
		support: !1
	},
	...[-1, 1].flatMap((e) => [-1, 1].map((t) => ({
		name: "altar-leg-" + e + "-" + t,
		role: "darkWood",
		w: .2,
		h: W.top - .08,
		d: .19,
		x: e * W.legX,
		y: (W.top - .08) / 2,
		z: W.z + t * W.legZ,
		support: !1
	}))),
	...[
		-1,
		0,
		1
	].map((e) => {
		let t = nt, n = e ? t.wingTop : t.centreTop;
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
		w: 3 * q.pitch,
		h: .14,
		d: q.frontZ - q.backZ,
		x: 0,
		y: 7.75,
		z: (q.frontZ + q.backZ) / 2,
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
		w: q.postWidth,
		h: q.corniceY - q.sillY,
		d: q.frontZ - q.backZ,
		x: e * q.pitch,
		y: (q.corniceY + q.sillY) / 2,
		z: (q.frontZ + q.backZ) / 2,
		support: !1
	})),
	...[
		-q.pitch,
		0,
		q.pitch
	].flatMap((e, t) => [{
		name: `statue-pad-${t}`,
		role: "darkWood",
		w: 4.7,
		h: .39,
		d: 2.63,
		x: e,
		y: .815,
		z: q.statueZ,
		support: !0
	}, {
		name: `statue-pad-cap-${t}`,
		role: "bronze",
		w: 4.58,
		h: .105,
		d: 2.54,
		x: e,
		y: 1.0625,
		z: q.statueZ,
		support: !0
	}])
], ot = [
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
function st(e) {
	let t = [], n = e.w / 2, r = e.d / 2, i = Math.max(3, Math.round(e.w / 3.4)), a = Math.max(2, Math.round(e.d / 3.6)), o = e.eave - e.plinth - .35;
	for (let a of [-1, 1]) for (let s = 0; s <= i; s++) {
		let c = -n + 1 + (e.w - 2) * s / i;
		if (e.name === "main" && a === 1) {
			let e = Qe.halfClear + .46, t = n - 1, r = Math.abs(s - i / 2) - .5;
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
function ct(t, n, r) {
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
var lt = class {
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
		let n = L.platform.y;
		this.materials = {
			stone: xe(.2),
			floor: ye(),
			wall: je(),
			paper: new e.MeshStandardMaterial({
				color: 12958628,
				map: _e(),
				bumpMap: _e(),
				bumpScale: .009,
				roughness: .96,
				metalness: 0,
				side: e.DoubleSide
			}),
			gatePlaster: Ke(),
			wood: Me(!1),
			woodDark: Ge(1),
			dougong: Ie(),
			roof: Ce(),
			mainRoof: we(),
			gateRoof: Ce(),
			gold: Ne(),
			bronze: Fe(),
			lattice: Me(!0),
			lantern: Re(),
			window: Le(),
			mainStone: Ee(),
			mainWall: Te(),
			mainWood: De(!1),
			mainWoodDark: De(!0),
			mainDougong: ke(),
			mainLattice: De(!0),
			mainWindow: Ae(),
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
			...m,
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
		}), this.buildPagoda(Je.x, Je.z, n), this.buildEnclosure(n)), t.omitMainHallShrine || this.buildBuddha(n + 1), this.finalize();
	}
	add(e, t) {
		this.roles[e].push(t);
	}
	addAt(e, t, n, r, i, a = 0) {
		a && t.rotateY(a), t.translate(n, r, i), this.roles[e].push(t);
	}
	buildPlatform(e) {
		let t = L.platform;
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
		let n = t.name === "gate", r = +(t.name === "main"), i = t.plinth - r, a = t.eave - t.plinth, c = t.w / 2, l = t.d / 2, m = {
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
		}, h = !0, _ = {
			stone: "mainStone",
			wall: "mainWall",
			wood: "mainWood",
			woodDark: "mainWoodDark",
			dougong: "mainDougong",
			lattice: "mainLattice",
			window: "mainWindow",
			roof: "mainRoof"
		}, y = (e) => h && t.name === "main" ? _[e] ?? e : e, b = (e, t) => m[y(e)].push(t), x = /* @__PURE__ */ new Set(), S = (e, t) => {
			m[y(e)].push(t), x.add(t);
		};
		S("stone", o(t.w + 2.4, t.plinth + .25, t.d + 2.4, 0, (t.plinth + .25) / 2, 0)), S("stone", o(t.w + 2.9, .16, t.d + 2.9, 0, .1, 0));
		let C = t.name === "main" ? g.count : 5;
		for (let e = 0; e < C; e++) t.name === "main" ? S("stone", T(e)) : S("stone", o(5, .24 + e * .16, .42, 0, (.24 + e * .16) / 2, l + 1.35 + (4 - e) * .4 + (i - .8) * .25)), t.name === "gate" && S("stone", o(5, .24 + e * .16, .42, 0, (.24 + e * .16) / 2, -l - 1.35 - (4 - e) * .4));
		let ee = a - .35;
		for (let n of st(t)) if (this.column(m, n.x, .25, n.z, n.height, y), t.name === "main" && n.z === l - .9) {
			let r = ot.map((t) => new e.Vector2(t.r, t.y));
			r.push(new e.Vector2(0, r[r.length - 1].y)), S("stone", new e.LatheGeometry(r, 32).translate(n.x, t.plinth + .25, n.z));
		}
		let w = n ? 3.55 : ee - .4, D = .3, O = .25 + w / 2, k = 1.35, A = (e, t, n, r) => b("stone", o(e + .04, .22, t + .085, n, i + .3, r));
		if (t.openFront) {
			let e = c - 2.05;
			for (let t of [-1, 1]) b("wall", o(3.8, w, D, t * e, O, l - k)), A(3.8, D, t * e, l - k);
		} else {
			let e = t.name === "main" ? 2 * v : t.name === "rear" ? 4.6 : 3.4, n = (t.w - k * 2 - e) / 2;
			b("wall", o(n, w, D, -(e / 2 + n / 2), O, l - k)), b("wall", o(n, w, D, e / 2 + n / 2, O, l - k)), A(n, D, -(e / 2 + n / 2), l - k), A(n, D, e / 2 + n / 2, l - k), t.name === "main" && t.studyFacade || b("wood", o(e + .3, .35, D + .1, 0, .25 + w, l - k));
		}
		if (t.openFront || t.name === "west") {
			let e = t.name === "west" ? 3.4 : 4.6, n = (t.w - k * 2 - e) / 2;
			for (let t of [-1, 1]) b("wall", o(n, w, D, t * (e / 2 + n / 2), O, -l + k));
			for (let t of [-1, 1]) A(n, D, t * (e / 2 + n / 2), -l + k);
			b("wood", o(e + .3, .35, .42, 0, .25 + w, -l + k));
		} else b("wall", o(t.w - k * 2, w, D, 0, O, -l + k)), A(t.w - k * 2, D, 0, -l + k);
		for (let e of [-1, 1]) {
			b("wall", o(D, w, t.d - k * 2, e * (c - k), O, 0)), A(D, t.d - k * 2, e * (c - k), 0);
			let n = Math.min(1.7, w * .5), r = f(Math.min(3.4, t.d * .32), n, .22, .05, .02);
			r.bars.rotateY(e * Math.PI / 2), r.backing.rotateY(e * Math.PI / 2), r.bars.translate(e * (c - k + .18), O + .15, 0), r.backing.translate(e * (c - k + .1), O + .15, 0), b("lattice", r.bars), b("window", r.backing);
		}
		if (!t.openFront) {
			let n = t.w > 20 ? 5 : 3, r = (t.w - 2.2) / n, i = Math.floor(n / 2), a = Array.from({ length: n }, (e, t) => t);
			for (let n of a) {
				let a = -c + 1.1 + r * (n + .5), s = r - .35, u = Math.min(w - .55, 3.5);
				if (t.name === "main" && t.studyFacade) continue;
				if (n === i) {
					b("gold", o(.16, u, .2, a - s / 2 - .1, .25 + u / 2, l - k + .2)), b("gold", o(.16, u, .2, a + s / 2 + .1, .25 + u / 2, l - k + .2)), t.name === "main" && t.studyFacade || b("gold", o(s + .2, .18, .2, a, .25 + u + .12, l - k + .2));
					continue;
				}
				let d = f(s, u, .17, .055, l - k + .18);
				d.bars.translate(a, 0, 0), d.backing.translate(a, 0, 0), b("lattice", d.bars), b("woodDark", d.backing), b("wood", o(s + .18, .16, .24, a, .25 + u + .1, l - k + .18)), b("wood", o(.16, u + .2, .24, a - s / 2 - .09, .25 + u / 2, l - k + .18)), b("wood", o(.16, u + .2, .24, a + s / 2 + .09, .25 + u / 2, l - k + .18)), b("woodDark", o(s, u * .34, .1, a, .25 + u * .17, l - k + .1));
				for (let t = -2; t <= 2; t++) for (let n = 0; n < 2; n++) b("gold", new e.SphereGeometry(.035, 6, 4).translate(a + t * .62, 1 + n * .32, l - k + .06));
			}
		}
		if (t.name === "main") {
			let e = .45, n = t.w / 2 + 1.2, r = t.d / 2 + 1.45, i = E();
			i.position.set(t.x, L.platform.y, t.z), this.group.add(i);
			for (let t = 0; t <= 10; t++) {
				let i = -r + 2 * r * t / 10;
				for (let t of [-1, 1]) b("stone", o(.24, .9, .24, t * n, e + .45, i)), b("stone", o(.26, .1, .26, t * n, e + .92, i));
			}
			for (let t of [-1, 1]) b("stone", o(.16, .16, 2 * r, t * n, e + .8, 0));
		}
		if (h = !1, !(this.enrichedSmallHalls && [
			"west",
			"east",
			"rear"
		].includes(t.name ?? ""))) {
			let r = t.w - k * 2 - .55, u = t.d - k * 2 - .55, d = i + .25, p = 1.35, m = Math.floor(r / p), h = Math.floor(u / p);
			for (let e = 0; e < h; e++) for (let t = 0; t < m; t++) {
				let n = -r / 2 + (t + .5) * r / m, i = -u / 2 + (e + .5) * u / h, a = (t * 11 + e * 7) % 7 * .002;
				b("floor", be(o(r / m - .018, .045, u / h - .018, n, d + .005 + a, i), .82 + (t * 13 + e * 7) % 11 * .022));
			}
			for (let e of [-1, 1]) {
				b("woodDark", o(.11, .44, u, e * r / 2, d + .22, 0)), b("bronze", o(.025, .035, u, e * r / 2, d + .45, 0));
				for (let t of [-u * .24, u * .24]) {
					let n = f(Math.min(2.5, u * .32), 2.1, .26, .055, 0);
					n.bars.rotateY(Math.PI / 2), n.backing.rotateY(Math.PI / 2), n.bars.translate(e * (c - k - .23), d + .77, t), n.backing.translate(e * (c - k - .27), d + .77, t), b("lattice", n.bars), b("paper", n.backing);
				}
			}
			for (let e of [-u / 2, u / 2]) if (e > 0 || t.name === "gate" || t.name === "west") {
				let n = t.name === "main" ? 2 * v : t.name === "rear" || t.name === "gate" ? 4.6 : 3.4, i = (r - n) / 2;
				for (let t of [-1, 1]) {
					let r = t * (n / 2 + i / 2);
					b("woodDark", o(i, .44, .11, r, d + .22, e)), b("bronze", o(i, .035, .025, r, d + .45, e));
				}
			} else b("woodDark", o(r, .44, .11, 0, d + .22, e)), b("bronze", o(r, .035, .025, 0, d + .45, e));
			let g = Math.max(d + 2.9, a - .35), _ = !n && !(t.name === "main" && t.studyFacade);
			for (let e = 0; _ && e < Math.max(2, Math.floor(u / 3.4)); e++) {
				let t = -u / 2 + (e + .5) * u / Math.max(2, Math.floor(u / 3.4));
				b("wood", o(r + .2, .2, .24, 0, g, t));
				for (let e of [-r / 3, r / 3]) b("dougong", o(.4, .32, .4, e, g - .25, t));
			}
			if (t.name !== "gate" && t.name !== "main" && t.name !== "west") {
				let t = -l + 2.7, n = Math.min(5.5, r * .62);
				b("woodDark", o(n, .16, 1.22, 0, d + .93, t)), b("bronze", o(n + .12, .07, 1.3, 0, d + 1.04, t)), b("woodDark", o(n - .35, .13, 1.05, 0, d + .26, t));
				for (let e of [-1, 1]) for (let r of [-1, 1]) {
					let i = e * (n / 2 - .24), a = t + r * .42;
					b("wood", o(.22, .78, .22, i, d + .45, a)), b("bronze", o(.24, .06, .24, i, d + .83, a));
				}
				b("gold", o(n - .4, .055, .055, 0, d + .73, t + .59)), b("wood", o(n + .3, 2.7, .22, 0, d + 2.35, t - .72)), b("gold", s(.5, .58, .13, 20, 0, d + 1.2, t)), b("gold", s(.34, .51, .63, 20, 0, d + 1.58, t)), b("gold", new e.SphereGeometry(.29, 18, 14).translate(0, d + 2.03, t)), b("gold", new e.TorusGeometry(.44, .045, 8, 28).translate(0, d + 1.99, t - .24));
				for (let r of [-1, 1]) b("bronze", s(.085, .11, .55, 10, r * Math.min(1.75, n * .32), d + 1.24, t + .1)), b("lantern", new e.SphereGeometry(.12, 10, 8).translate(r * Math.min(1.75, n * .32), d + 1.56, t + .1));
				for (let e of [-1, 1]) {
					let r = e * n * .34;
					b("bronze", s(.14, .22, .28, 12, r, d + 1.2, t + .3));
					for (let e = 0; e < 3; e++) b("woodDark", s(.012, .015, .55 + e * .08, 6, r + (e - 1) * .045, d + 1.56, t + .3));
				}
			}
		}
		if (h = !0, !n) {
			b("wood", o(t.w + .4, .42, .42, 0, a - .2, l - .9)), b("wood", o(t.w + .4, .42, .42, 0, a - .2, -l + .9));
			for (let e of [-1, 1]) b("wood", o(.42, .42, t.d - 1.6, e * (c - .9), a - .2, 0));
			b("wood", o(t.w + 1.4, .34, .7, 0, a + .05, l - .3)), b("wood", o(t.w + 1.4, .34, .7, 0, a + .05, -l + .3));
			let n = this.dougongCluster(), r = Math.max(3, Math.round(t.w / 2.3));
			for (let e = 0; e <= r; e++) {
				let i = -c + .9 + (t.w - 1.8) * e / r;
				for (let e of [-1, 1]) {
					let t = n.clone();
					t.translate(i, a - .05, e * (l - .75)), b("dougong", t);
				}
			}
			let i = Math.max(2, Math.round(t.d / 2.5));
			for (let e = 1; e < i; e++) {
				let r = -l + .9 + (t.d - 1.8) * e / i;
				for (let e of [-1, 1]) {
					let t = n.clone();
					t.rotateY(Math.PI / 2), t.translate(e * (c - .75), a - .05, r), b("dougong", t);
				}
			}
			for (let e of ct(t.w, t.d, a)) b("wood", e);
			let u = Math.max(2, Math.round(t.w / 6));
			for (let n = 0; n <= u; n++) {
				let r = -c + 1.4 + (t.w - 2.8) * n / u, i = a - 1.05, o = l + .15, d = new e.SphereGeometry(.17, 10, 8);
				d.scale(1, 1.18, 1), d.translate(r, i, o), b("lantern", d), b("gold", s(.09, .09, .08, 8, r, i + .3, o)), b("gold", s(.09, .09, .08, 8, r, i - .3, o)), b("gold", s(.012, .012, .55, 4, r, i + .6, o));
			}
		}
		if (n) {
			let e = 9.1, n = a + .16;
			b("gateRoof", u({
				w: e,
				d: t.d,
				eaveY: n,
				rise: 3.05,
				cornerLift: .88,
				overhang: 1.25,
				nu: 34,
				nv: 14
			})), this.ridgeAndTips(m, e, t.d, n + 3.05, n), b("wood", o(8.9, .14, t.d + .35, 0, a - .1, 0));
			for (let e of [
				-3.45,
				-1.72,
				0,
				1.72,
				3.45
			]) b("woodDark", o(8.9, .2, .24, 0, a - .28, e));
			for (let e of [-3.65, 3.65]) b("woodDark", o(.22, .2, t.d + .35, e, a - .28, 0));
			b("woodDark", o(8.9, 2.1, .32, 0, a - 1.07, -l + 1.35));
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
				n.translate(e * 5.15, 0, 0), b("gateRoof", n), b("woodDark", o(6.1, .28, .42, e * 5.15, 3.62, l - .25)), b("woodDark", o(6.1, .28, .42, e * 5.15, 3.62, -l + .25));
			}
			for (let e of [-1, 1]) {
				for (let t of [-l + .82, l - .82]) b("woodDark", o(.62, a - .35, .7, e * 3.22, (a - .35) / 2 + .25, t));
				b("dougong", o(1.22, .29, 1.55, e * 3.22, a - .25, l - .25));
			}
			b("woodDark", o(8.9, .7, .7, 0, a - .63, l - .35)), b("wood", o(9.5, .3, .62, 0, a + .02, l - .3)), b("wood", o(9.5, .3, .62, 0, a + .02, -l + .3)), b("bronze", o(8.75, .05, .75, 0, a - .27, l - .35));
		} else if (t.double) {
			let e = t.name === "main" ? "mainRoof" : "roof";
			if (t.studyFacade) {
				let n = ne(t.w, t.d, a, t.rise);
				for (let t of n.tiles) b(e, t);
				for (let e of n.timber) b("woodDark", e);
				for (let e of n.rafters) b("flyingRafters", e);
			} else b(e, d({
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
			b("wall", o(t.w - 2.2, 3, t.d - 2.2, 0, a + 1.5, 0));
			for (let e = 0; e <= 12; e++) b("wood", o(.1, .7, .1, -c + 1.2 + (t.w - 2.4) * e / 12, a + .55, l - 1.05));
			b("wood", o(t.w - 2.4, .12, .14, 0, a + .9, l - 1.05));
			for (let e = 0; e < 5; e++) {
				let n = -c + 1.6 + (t.w - 3.2) * (e + .5) / 5, r = f((t.w - 3.2) / 5 - .25, 1.4, .24, .07, l - .95);
				r.bars.translate(n, a + 1.55, 0), r.backing.translate(n, a + 1.55, 0), b("lattice", r.bars), b("window", r.backing);
				for (let e = 0; e <= 4; e++) b("wood", o(.08, 1.4, .12, n - (t.w - 3.2) / 10 + e * ((t.w - 3.2) / 20), a + 1.55 + .7, l - .88));
			}
			b("wood", o(t.w + .6, .35, .5, 0, n, l - .7)), b("wood", o(t.w + .6, .35, .5, 0, n, -l + .7)), t.studyFacade || (b(e, u({
				w: t.w - 1.4,
				d: t.d - 1.4,
				eaveY: n + .2,
				rise: t.rise + .4,
				cornerLift: .95,
				overhang: 1.45,
				nu: 38,
				nv: 16
			})), this.ridgeAndTips(m, t.w - 1.4, t.d - 1.4, n + .2 + t.rise + .4, n + .2, e));
		} else b("roof", u({
			w: t.w,
			d: t.d,
			eaveY: a + .15,
			rise: t.rise,
			cornerLift: .9,
			overhang: 1.25,
			nu: 36,
			nv: 15
		})), this.ridgeAndTips(m, t.w, t.d, a + .15 + t.rise, a + .15);
		if (n) for (let t of [
			{
				x: 0,
				half: 5.75,
				y: a + .12,
				z: l + 1.25
			},
			{
				x: -5.15,
				half: 3.9,
				y: 3.81,
				z: l + 1.1
			},
			{
				x: 5.15,
				half: 3.9,
				y: 3.81,
				z: l + 1.1
			}
		]) {
			let n = Math.round(t.half * 2 / .32);
			for (let r = 0; r <= n; r++) {
				let i = t.x - t.half + 2 * t.half * r / n, a = new e.CylinderGeometry(.065, .065, .075, 8);
				a.rotateX(Math.PI / 2), a.translate(i, t.y, t.z), b("gateRoof", a);
			}
		}
		else if (!t.studyFacade) {
			let n = t.double ? a + 2.1 : a + .15, r = t.w / 2 + 1.1, i = Math.round(r * 2 / .34);
			for (let a = 0; a <= i; a++) {
				let o = -r + 2 * r * a / i;
				for (let r of [-1, 1]) {
					let i = new e.CylinderGeometry(.075, .075, .05, 8);
					i.rotateX(Math.PI / 2), i.translate(o, n - .06, r * (t.d / 2 + 1.1)), b("roof", i);
				}
			}
		}
		for (let t of n ? [] : [-1, 1]) for (let n of [-1, 1]) {
			let r = 1.15;
			b("bronze", s(.14, .2, .5, 8, t * (c + r), a - .55, n * (l + r))), b("bronze", new e.SphereGeometry(.09, 8, 6).translate(t * (c + r), a - .85, n * (l + r)));
		}
		if (n) {
			for (let e of [-1, 1]) {
				let t = e * (c - 2.2), n = l - k + .23;
				b("gatePlaster", o(2.42, 2.57, .045, t, 2.02, n - .08));
				let r = f(1.64, 1.67, .21, .065, n + .05);
				r.bars.translate(t, 1.25, 0), r.backing.translate(t, 1.25, 0), b("lattice", r.bars), b("woodDark", r.backing);
				for (let e of [-1.23, 1.23]) b("woodDark", o(.13, 2.72, .16, t + e, 1.98, n + .025));
				for (let e of [.63, 3.34]) b("woodDark", o(2.58, .13, .16, t, e, n + .025));
			}
			b("woodDark", o(8.9, .5, .22, 0, a - 1.06, l + .3));
		}
		if (t.plaque) {
			let n = t.name === "gate" || t.name === "main" ? me(t.name) : void 0, i = n ?? p(t.plaque, 512, 150, {
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
			}), c = t.name === "main" && t.studyFacade, u = t.name === "gate" ? 1.18 : 1.45, d = c ? a + 2.03 : .25 + Math.min(w - .55, 3.5) + u, f = c ? l - .71 : l + (t.name === "gate" ? .62 : -.35), m = c ? 5.5 : 4.2, h = c ? 1.52 : 1.2, g = new e.Mesh(new e.PlaneGeometry(m, h), s);
			if (g.position.set(t.x, L.platform.y + d + r, t.z + f), g.castShadow = !1, g.name = `plaque-${t.name}`, this.group.add(g), c) {
				b("woodDark", o(m + .36, h + .3, .17, 0, d, f - .16));
				for (let e of [-1, 1]) b("gold", o(m + .34, .055, .05, 0, d + e * (h / 2 + .11), f - .055)), b("gold", o(.055, h + .22, .05, e * (m / 2 + .12), d, f - .055));
			} else b("gold", o(4.5, 1.45, .16, 0, d, l + (t.name === "gate" ? .48 : -.48)));
		}
		let j = t.rotY ?? 0, M = Math.cos(j), te = Math.sin(j);
		for (let e of Object.keys(m)) for (let n of m[e]) r && !x.has(n) && n.translate(0, r, 0), j && n.rotateY(j), n.translate(t.x, L.platform.y, t.z), this.roles[e].push(n);
		let N = this.enrichedSmallHalls && [
			"west",
			"east",
			"rear"
		].includes(t.name ?? ""), P = new e.PointLight(N ? 16768432 : 16758647, t.name === "main" ? 6 : n ? 4.4 : N ? t.name === "rear" ? 14 : 10 : 2.8, t.name === "main" ? 18 : n ? 12 : N ? 13 : 10, 2);
		P.name = `temple-${t.name}-existing-room-light`, P.position.set(t.x, L.platform.y + (n ? 4.1 : N ? a - .88 : Math.max(3.2, t.plinth + 2.3)), t.z), this.group.add(P), this.anchors.eaves.push(new e.Vector3(t.x + te * (l + 1), L.platform.y + a + r, t.z + M * (l + 1))), t.name === "main" && this.anchors.door.set(t.x, L.platform.y + 1.6 + r, t.z + l + 1.5);
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
		this.addAt("stone", s(Je.baseTop, Je.baseBottom, Je.baseH, 8), t, r + Je.baseH / 2, n), this.addAt("stone", s(3.12, 3.18, .12, 8), t, r + .63, n);
		let i = r + Je.baseH;
		for (let e of Ye()) {
			let a = r + e.base, c = e.radius, l = e.height;
			this.addAt("stone", s(c - .12, c, l, 8), t, a + l / 2, n);
			let u = (c - .08) * Math.cos(Math.PI / 8);
			for (let e = 0; e < 8; e++) {
				let r = (e + .5) * Math.PI / 4, i = o(.52, l * .44, .025, 0, 0, 0);
				i.rotateY(r), i.translate(t + Math.sin(r) * u, a + l * .46, n + Math.cos(r) * u), this.add("dark", i);
				for (let e of [-1, 1]) {
					let i = o(.055, l * .48, .045, e * .31, 0, 0);
					i.rotateY(r), i.translate(t + Math.sin(r) * (u + .012), a + l * .46, n + Math.cos(r) * (u + .012)), this.add("stone", i);
				}
			}
			this.addAt("stone", s(c + .85, c + .2, .36, 8), t, a + l + .18, n), this.addAt("stone", s(c + .1, c + .1, .16, 8), t, a + l + .42, n), i = a + l + .5;
		}
		this.addAt("gold", s(.12, .3, 1.6, 8), t, i + .8, n);
		for (let r = 0; r < 4; r++) this.addAt("gold", new e.SphereGeometry(.22 - r * .03, 10, 8), t, i + .4 + r * .3, n);
		this.addAt("gold", new e.SphereGeometry(.16, 8, 6), t, i + 1.7, n);
	}
	buildEnclosure(t) {
		let n = L.platform, r = (n, r, i, a) => {
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
		i.rotation.y = Math.PI / 2, i.position.set(n.x0 + .2, t + 3.45, 7), this.group.add(i), this.add("stone", o(4.25, .95, 3.2, -34.25, t + .475, 7)), this.add("floor", be(o(4.3, .06, 3.25, -34.25, t + .98, 7), .92)), this.balustrade(4.1, 9.9, n.x0 + .5, t + .98, "z"), r(n.x0 + .5, n.z0 + 1, n.x1 - .5, n.z0 + 1), r(n.x1 - .5, n.z0 + 1, n.x1 - .5, 23), r(n.x1 - .5, 33, n.x1 - .5, n.z1 - 1), this.add("wood", o(.4, 3.2, 1, n.x1 - .5, t + 2, 23.4)), this.add("wood", o(.4, 3.2, 1, n.x1 - .5, t + 2, 32.6)), this.add("roof", o(1.9, .3, 10.4, n.x1 - .5, t + 3.75, 28));
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
		for (let e = 0; e < a.length; e++) this.add("stone", o(2.55, .28, 8.2, 30.9 + e * 2.55, t + a[e] - .14, 28));
		for (let e = 0; e < 3; e++) {
			let n = .11 + e * .11;
			this.add("stone", o(.72, .18, 8.2, 28.38 + e * .72, t + n - .09, 28));
		}
		for (let e of [24.05, 31.95]) {
			for (let n = 0; n < a.length; n++) {
				let r = 30.9 + n * 2.55, i = t + a[n];
				this.add("stone", o(2.58, .17, .22, r, i + .93, e));
			}
			for (let n = 0; n <= 10; n++) {
				let r = n / 10, i = Math.min(4, Math.floor(r * 5));
				this.add("stone", o(.18, 1.02, .18, 29.2 + r * 14, t + a[i] + .48, e));
			}
		}
		for (let e of [31.3, 40.9]) this.add("stone", o(.78, 2.2, 7.8, e, t - .78, 28));
	}
	buildBuddha(t) {
		let n = m.x, r = m.z + 1.15, i = t + 1.1;
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
		o.position.set(n, i + 2.8, m.z + .6), this.group.add(o);
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
			o[t] && (qe(a, o[t], o[t] === "plaster" ? void 0 : L.platform.y), this.materials[t].vertexColors = !0);
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
function ut(t) {
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
function dt(t, n, r, i) {
	let a = [], s = r - n, l = "#365970", u = "#4f796d", d = "#668d79", f = "#8d503d";
	function p(t, n) {
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
	function m(e, t, n, r, i, a, s) {
		p(o(r, i, a, e, t, n), s);
	}
	function h(t, n, r, i, a, o, s) {
		let c = new e.ExtrudeGeometry(t, {
			depth: n,
			bevelEnabled: !1,
			curveSegments: 5
		});
		c.translate(0, 0, -n / 2), c.rotateY(o), c.translate(r, i, a), p(c, s);
	}
	function g(t, n, r, i, a, o, s) {
		let c = new e.Shape();
		c.moveTo(-i, .21), c.lineTo(i, .21), c.lineTo(i, .08), c.quadraticCurveTo(i * .86, .08, i * .84, .01), c.quadraticCurveTo(i * .8, -.09, i * .55, -.07), c.quadraticCurveTo(i * .38, -.09, i * .32, -.17), c.lineTo(-i * .32, -.17), c.quadraticCurveTo(-i * .38, -.09, -i * .55, -.07), c.quadraticCurveTo(-i * .8, -.09, -i * .84, .01), c.quadraticCurveTo(-i * .86, .08, -i, .08), c.closePath(), h(c, a, t, n, r, o, s);
	}
	function _(t, n, r, i, a) {
		let o = new e.CylinderGeometry(1, .73, .14, 4).rotateY(Math.PI / 4).scale(i / Math.SQRT2, 1, a / Math.SQRT2);
		o.translate(t, n + .07, r), p(o, l), m(t, n + .162, r, i, .045, a, f), m(t, n + .22, r, i + .018, .076, a + .018, d);
	}
	function v(t, n) {
		let r = s - .13, i = s * .55;
		_(t, -.61, .12, .57, .66), g(t, -.22, i * .53, i * .64, .34, -Math.PI / 2, l), _(t, -.025, i, .45, .43), g(t, .38, i, n ? .62 : .91, .34, 0, u);
		let a = n ? .43 : .65;
		for (let e of [-1, 1]) {
			let n = t + e * a;
			_(n, .585, i, .33, .36), g(n, .96, (i + r) / 2, (r - i) / 2 + .19, .24, -Math.PI / 2, l), m(n, 1.185, r, .29, .1, .34, d), m(n, 1.245, r, .28, .025, .32, "#c4a16a");
		}
		let o = new e.Shape();
		o.moveTo(-.35, .18), o.lineTo(.32, .28), o.lineTo(.59, .095), o.lineTo(.51, -.032), o.lineTo(.12, .02), o.lineTo(-.35, .01), o.closePath(), h(o, .22, t, .49, r - .42, -Math.PI / 2, f), m(t, .61, r - .49, .25, .2, r - i + .38, u), g(t, 1.29, r, n ? .63 : .92, .31, 0, d);
	}
	for (let e = 0; e < t.length; e++) v(t[e], !1), e + 1 < t.length && v((t[e] + t[e + 1]) / 2, !0);
	let y = new e.Mesh(c(a), new e.MeshStandardMaterial({
		name: "main-hall-porch-bracket-paint",
		vertexColors: !0,
		roughness: .88,
		metalness: 0,
		bumpMap: i,
		bumpScale: .003
	}));
	return y.name = "main-hall-porch-brackets", y.receiveShadow = !0, y.castShadow = !0, y;
}
//#endregion
//#region src/world/sanctum_atlas.ts
function ft(t, n) {
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
function pt(t, n, r) {
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
	let u = W;
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
function mt(t, n, r, i, a, s, l, u, d) {
	t = ft(t, r);
	let f = new e.Group();
	f.position.set(i, s, a), f.name = "hall-sanctum-joinery";
	let p = [], m = [], h = [], g = [], v = l - s;
	function y(t, n) {
		let r = new e.Color(n), i = new Float32Array(t.getAttribute("position").count * 3);
		for (let e = 0; e < i.length; e += 3) i[e] = r.r, i[e + 1] = r.g, i[e + 2] = r.b;
		return t.setAttribute("color", new e.BufferAttribute(i, 3)), t;
	}
	function b(e, t, n, r, i, a, s) {
		m.push(y(o(e, t, n, r, i, a), s));
	}
	function S(e, t, n = "#ffffff") {
		let r = e.getAttribute("uv");
		for (let e = 0; e < r.count; e++) r.setXY(e, (t % 4 + .004 + .992 * r.getX(e)) / 4, (1 - Math.floor(t / 4) + .004 + .992 * r.getY(e)) / 2);
		p.push(y(e, n));
	}
	function C(t, n, r, i, a, o, s = 0) {
		let c = new e.PlaneGeometry(t, n, 4, 4).rotateY(s).translate(r, i, a);
		S(c, o);
		let l = c.getAttribute("color"), u = c.getAttribute("position");
		for (let t = 0; t < u.count; t++) {
			let r = u.getY(t), a = u.getX(t), s = o === 1 ? .85 : 1;
			if (o === 2) {
				let t = a / K.pitch + .5, n = t - Math.floor(t) - .5;
				s = .22 + .46 * Math.sin(Math.PI * (n + .5)) * (1 - .42 * e.MathUtils.smoothstep(r, 4.4, 6.1));
			}
			if (o === 4) {
				let t = i + n * .5 - r;
				s = .62 + .38 * e.MathUtils.smoothstep(t, 0, .093);
			}
			l.setXYZ(t, s, s, s);
		}
	}
	function ee(t, n, r, i, a, o) {
		let s = Math.min(1, Math.abs(r) / (u * .5)), c = new e.Color().setScalar(o === 0 ? .66 + .17 * s : .63);
		S(new e.PlaneGeometry(t, n).rotateX(Math.PI / 2).translate(r, i, a), o, "#" + c.getHexString());
	}
	let w = "#a8583d", T = u / 18, E = d / 14;
	for (let e = 0; e < 18; e++) for (let t = 0; t < 14; t++) {
		if (e >= 6 && e < 12 && t >= 4 && t < 10) continue;
		let n = (e + .5 - 18 / 2) * T, r = (t + .5 - 14 / 2) * E;
		ee(T - .036, E - .036, n, v - .14, r, 0);
	}
	for (let e = 0; e <= 18; e++) {
		let t = (e - 18 / 2) * T;
		if (e < 6 || e > 12) b(.055, .1, d, t, v - .15, 0, w);
		else for (let e of [-1, 1]) b(.055, .1, 4 * E, t, v - .15, e * 5 * E, w);
	}
	for (let e = 0; e <= 14; e++) {
		let t = (e - 14 / 2) * E;
		if (e < 4 || e > 10) b(u, .1, .055, 0, v - .15, t, w);
		else for (let e of [-1, 1]) b(6 * T, .1, .055, e * 6 * T, v - .15, t, w);
	}
	let D = 6 * T, O = 6 * E;
	ee(D, O, 0, v - .05, 0, 5);
	let k = (t, n, r) => new e.Vector3(Math.cos((t + .5) * Math.PI / 4) * D * n, r, Math.sin((t + .5) * Math.PI / 4) * O * n), A = [
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
	for (let t = 1; t < A.length; t++) {
		let [n, r] = A[t - 1], [i, a, o] = A[t], s = [];
		for (let e = 0; e < 8; e++) for (let t of [
			k(e, n, v + r),
			k(e + 1, n, v + r),
			k(e, i, v + a),
			k(e + 1, n, v + r),
			k(e + 1, i, v + a),
			k(e, i, v + a)
		]) s.push(t.x, t.y, t.z);
		let c = new e.BufferGeometry();
		c.setAttribute("position", new e.Float32BufferAttribute(s, 3)), c.computeVertexNormals(), m.push(y(c, o));
	}
	let j = new e.CircleGeometry(1, 8, Math.PI / 8).rotateX(Math.PI / 2).scale(D * .381, 1, O * .381), M = j.getAttribute("uv");
	for (let e = 0; e < M.count; e++) M.setXY(e, .14 + .72 * M.getX(e), .14 + .72 * M.getY(e));
	let te = new e.Mesh(j, new e.MeshStandardMaterial({
		name: "hall-dragon-coffer-art",
		map: n,
		emissive: 16777215,
		emissiveMap: n,
		emissiveIntensity: .16,
		roughness: .76
	}));
	te.name = "hall-central-dragon-coffer", te.position.y = v - .09, f.add(te);
	for (let [e, t] of [
		[0, w],
		[.1, "#71a293"],
		[.21, "#b99a62"]
	]) for (let n of [-1, 1]) b(D - 2 * e, .16, .085, 0, v - .19 + e * .25, n * (O / 2 - e), t), b(.085, .16, O - 2 * e, n * (D / 2 - e), v - .19 + e * .25, 0, t);
	let { pitch: N, frontZ: P, backZ: F, postWidth: ne } = K, I = (N - ne) / 2;
	for (let t of [
		-N,
		0,
		N
	]) {
		let n = P;
		for (let e = 0; e < 7; e++) for (let n = 0; n < 7; n++) C(2 * I / 7, .93, t + (n - 3) * 2 * I / 7, 1.38 + e * .93, F + .01, 2);
		for (let e of [-1, 1]) {
			let r = P - F;
			for (let n = 0; n < 7; n++) for (let i = 0; i < 3; i++) C(r / 3, .93, t + e * (I - .006), 1.38 + n * .93, F + r * (i + .5) / 3, 2, -e * Math.PI / 2);
			b(.035, 6.72, .045, t + e * (I - .025), 4.26, n + .02, "#675a48");
		}
		for (let n = 0; n < 3; n++) S(new e.PlaneGeometry(I * 2, (P - F) / 3).rotateX(Math.PI / 2).translate(t, 7.675, F + (n + .5) * (P - F) / 3), 1, "#6d6255");
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
			for (let e = 0; e < c.length; e += 2) l.push(t + c[e] * I, c[e + 1], n + .025), u.push((i % 8 + +(c[e] === o)) / 8, (c[e + 1] - 5.46) / 2.22);
			let d = new e.BufferGeometry();
			d.setAttribute("position", new e.Float32BufferAttribute(l, 3)), d.setAttribute("uv", new e.Float32BufferAttribute(u, 2)), d.computeVertexNormals(), S(d, 1);
			let f = [
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
			], p = [
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
				let [a, o] = f[i], s = (r(e + 1e-4) - r(e - 1e-4)) / (2e-4 * I), c = Math.hypot(s, 1);
				return [
					t + e * I - a * s / c,
					r(e) + a / c,
					n + o
				];
			};
			for (let t = 0; t < p.length; t++) {
				let n = new e.BufferGeometry();
				n.setAttribute("position", new e.Float32BufferAttribute([
					...h(a, t),
					...h(o, t),
					...h(a, t + 1),
					...h(o, t),
					...h(o, t + 1),
					...h(a, t + 1)
				], 3)), n.computeVertexNormals(), m.push(y(n, p[t]));
			}
		}
		for (let e = 0; e < 3; e++) C(N / 3, .4, t + (e - 1) * N / 3, 7.96, n + .018, 1);
		for (let e of [7.7, 8.19]) b(N, .09, .36, t, e, n - .14, "#383331");
		for (let e = 0; e < 3; e++) C(N / 3, .58, t + (e - 1) * N / 3, .34, -2.96, 4);
	}
	let re = new e.OctahedronGeometry(.024), L = nt, R = L.z + L.d / 2 + .004;
	for (let e of [
		-1,
		0,
		1
	]) {
		let t = e ? L.wingW : 2 * L.wingX - L.wingW, n = e ? L.wingTop : L.centreTop, r = e * L.wingX, i = e ? 4 : 5;
		for (let e = 0; e < i; e++) {
			let a = r + t * ((e + .5) / i - .5);
			C(t / i - .016, n - .12, a, n * .5 - .006, R, 4);
		}
		b(t, .062, .115, r, n - .034, R - .048, "#c3b8a4"), b(t, .048, .086, r, .04, R - .033, "#a49b89");
	}
	for (let t of [-1, 1]) {
		let n = t * rt.x, r = rt.z, i = rt.profile;
		m.push(y(new e.LatheGeometry(i.map(([t, n]) => new e.Vector2(t, n)), 24).translate(n, 0, r), "#a6753d"));
		for (let t = 0; t < 27; t++) {
			let i = .33 - t * .0072, a = 1.21 + t * .111;
			h.push(new e.TorusGeometry(i, .018, 5, 24).rotateX(Math.PI / 2).translate(n, a, r));
			for (let e = 0; e < 12; e++) {
				let o = e * 2 * Math.PI / 12 + t * .07;
				g.push(re.clone().translate(n + i * Math.sin(o), a + .037, r + i * Math.cos(o)));
			}
		}
	}
	for (let t of [-1, 1]) {
		let n = t * (_.halfClear + .025) / x.x, r = (_.wallZ + .17) / x.z;
		for (let e = 0; e < 6; e++) C(.5, 1.13, n, .65 + e * 1.13, r - .1, 3, -t * Math.PI / 2);
		b(.105, 6.9, .11, n, 3.43, r + .18, "#ae673a");
		let i = (i, a, o) => new e.Vector3(n - t * o, a, r - .1 + t * i);
		for (let t = 0; t < 6; t++) {
			let n = .65 + t * 1.13, r = Array.from({ length: 25 }, (e, t) => {
				let r = t / 24;
				return i(.16 * Math.sin(r * 2 * Math.PI), n - .49 + r * .98, .015);
			});
			h.push(new e.TubeGeometry(new e.CatmullRomCurve3(r), 36, .012, 6, !1));
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
				s.setAttribute("position", new e.Float32BufferAttribute(a, 3)), s.computeVertexNormals(), s.setAttribute("uv", new e.Float32BufferAttribute(new Float32Array(a.length / 3 * 2), 2)), h.push(s);
			}
		}
	}
	function ie(t, n, r) {
		let i = new e.CylinderGeometry(r, r, t.distanceTo(n), 6);
		i.applyQuaternion(new e.Quaternion().setFromUnitVectors(new e.Vector3(0, 1, 0), n.clone().sub(t).normalize()));
		let a = t.clone().lerp(n, .5);
		h.push(i.translate(a.x, a.y, a.z));
	}
	let ae = -.68, oe = v - .22, z = (t, n, r) => new e.Vector3(t, n, r + ae);
	ie(z(0, oe, 0), z(0, oe - 2.9, 0), .033);
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
		let i = oe - n - .16;
		h.push(new e.TorusGeometry(.17, .029, 6, 22).rotateX(Math.PI / 2).translate(0, i, ae));
		for (let a = 0; a < t; a++) {
			let o = 2 * Math.PI * a / t + n, s = r * Math.cos(o), c = r * Math.sin(o), l = z(0, i, 0), u = z(.67 * s, i - .18, .67 * c), d = z(s, i + .21, c);
			ie(l, u, .018), ie(u, d, .018), h.push(new e.CylinderGeometry(.071, .045, .085, 8).translate(d.x, d.y, d.z)), g.push(new e.SphereGeometry(.099, 10, 8).scale(.94, 1.11, .94).translate(d.x, d.y + .119, d.z));
		}
	}
	g.push(new e.SphereGeometry(.15, 12, 8).translate(0, oe - 2.97, ae));
	let se = [
		"#785294",
		"#b09ac9",
		"#a862ae",
		"#806cad"
	];
	function ce(t, n, r, i) {
		let a = Math.sin(i * 2.399), o = new e.Vector3(t + .08 * a, n + .16 + .05 * Math.cos(i), r + .03 * a), s = new e.CylinderGeometry(.007, .011, o.y - n, 5);
		m.push(y(s.translate(o.x, n + (o.y - n) * .5, o.z), "#546342"));
		for (let t = 0; t < 5; t++) {
			let n = t * 2 * Math.PI / 5 + .68 * a, r = new e.SphereGeometry(1, 8, 5).scale(.03, .052, .012);
			r.rotateX(-.5).rotateZ(-n).translate(o.x + .034 * Math.sin(n), o.y + .03 * Math.cos(n), o.z), m.push(y(r, se[(t + i) % 4]));
		}
		m.push(y(new e.SphereGeometry(.017, 6, 4).translate(o.x, o.y, o.z + .014), "#e5bb76"));
		let c = new e.SphereGeometry(1, 6, 4).scale(.028, .11, .012).rotateZ(a * 1.1);
		m.push(y(c.translate(t, n + .075, r), "#43583a"));
	}
	function B(t, n, r, i, a) {
		m.push(y(new e.CylinderGeometry(1, .86, .072, 28).scale(i / 2, 1, .18).translate(t, n + .036, r), "#645241"));
		for (let e = 0; e < 15; e++) {
			let o = e / 14, s = e * 2.39996 + a;
			ce(t + (o - .5) * i * .91, n + .077 + .038 * Math.sin(Math.PI * o), r + .107 * Math.sin(s), a + e);
		}
	}
	for (let e of [-1, 1]) B(e * 2.95, L.wingTop, L.z + .1, .93, e < 0 ? 13 : 37), B(e * .99, L.centreTop, L.z + .34, 1.48, e < 0 ? 49 : 65);
	for (let t of [
		-5.55,
		-2.68,
		2.68,
		5.55
	]) {
		let n = L.wingTop, r = L.z - .24;
		h.push(new e.CylinderGeometry(.086, .153, .075, 20).translate(t, n + .0375, r)), h.push(new e.CylinderGeometry(.052, .076, .16, 16).translate(t, n + .155, r)), h.push(new e.CylinderGeometry(.117, .057, .063, 20).translate(t, n + .2665, r)), m.push(y(new e.CylinderGeometry(.063, .073, .86, 18).translate(t, n + .728, r), "#a53228")), g.push(new e.SphereGeometry(.03, 8, 6).scale(.67, 1.66, .67).translate(t, n + 1.195, r));
	}
	function V(t, n, r) {
		let i = new e.Mesh(c(t), n);
		i.receiveShadow = !0, i.name = r, f.add(i);
	}
	return V(p, new e.MeshStandardMaterial({
		name: "hall-sanctum-painted-carving",
		map: t,
		vertexColors: !0,
		side: e.DoubleSide,
		bumpMap: t,
		bumpScale: .0028,
		roughness: .81
	}), "hall-painted-ceiling-and-niches"), V(m, new e.MeshStandardMaterial({
		vertexColors: !0,
		name: "hall-sanctum-woodwork",
		side: e.DoubleSide,
		roughness: .68
	}), "hall-sanctum-mouldings"), V(h, new e.MeshStandardMaterial({
		name: "hall-sanctum-lamp-brass",
		color: 12229736,
		metalness: .68,
		roughness: .32
	}), "hall-pendant-brass"), V(g, new e.MeshStandardMaterial({
		name: "hall-opal-globes",
		color: 16774105,
		emissive: 16771519,
		emissiveIntensity: 1.45,
		roughness: .32
	}), "hall-pendant-globes"), f;
}
//#endregion
//#region src/world/flame_aureole.ts
function ht(t) {
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
	let l = new e.MeshStandardMaterial({
		name: "hall-gilded-aureole-field",
		map: t,
		bumpMap: t,
		bumpScale: .0038,
		color: 11768164,
		metalness: .49,
		roughness: .59
	}), u = new e.Mesh(a, l);
	function d(t, r, i = !1) {
		n.push(new e.TubeGeometry(new e.CatmullRomCurve3(t, i), i ? 144 : 24, r, 5, i));
	}
	let f = [
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
	], p = [], m = [], h = [];
	for (let t = 0; t < 456; t++) for (let [n, i, a] of f) {
		let o = t / 456, s = r(o, n, !1), c = r(o, n, !0);
		s.lerp(c, Math.max(0, 1 - n / .21)), p.push(s.x, s.y, i);
		let l = new e.Color(a);
		m.push(l.r, l.g, l.b);
	}
	for (let e = 0; e < 456; e++) for (let t = 0; t < f.length - 1; t++) {
		let n = e * f.length + t, r = (e + 1) % 456 * f.length + t;
		h.push(n, n + 1, r, n + 1, r + 1, r);
	}
	let g = new e.BufferGeometry();
	g.setIndex(h), g.setAttribute("position", new e.Float32BufferAttribute(p, 3)), g.setAttribute("color", new e.Float32BufferAttribute(m, 3)), g.computeVertexNormals();
	let _ = new e.Mesh(g, new e.MeshStandardMaterial({
		name: "hall-aureole-cast-border",
		vertexColors: !0,
		metalness: .61,
		roughness: .45
	}));
	d(Array.from({ length: 120 }, (t, n) => {
		let i = r(n / 120, .44, !1);
		return new e.Vector3(i.x, i.y, .08);
	}), .016, !0);
	for (let t of [-1, 1]) for (let n = 0; n < 16; n++) {
		let i = .16 + n * .181, a = r(i / (2 * Math.PI), .29, !1);
		d(Array.from({ length: 19 }, (n, r) => {
			let o = r / 18, s = o * 1.62 * Math.PI, c = .18 * (1 - .79 * o);
			return new e.Vector3(t * (a.x + c * Math.cos(s) * Math.cos(i) + .14 * Math.sin(s) * Math.sin(i)), a.y + .21 * Math.cos(s) * Math.sin(i) - c * Math.sin(s) * Math.cos(i), .091 + .035 * Math.sin(o * Math.PI));
		}), .014);
	}
	let v = new e.Mesh(c(n), new e.MeshStandardMaterial({
		name: "hall-chased-aureole-rims",
		color: 13673298,
		metalness: .62,
		roughness: .43
	})), y = new e.Group();
	return y.name = "hall-statue-halo", y.add(u, _, v), y;
}
//#endregion
//#region src/world/sculpture_occlusion.ts
var gt = [
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
], _t = 144, vt = 25;
function yt(t, n) {
	let r = new e.Vector3(...n).normalize(), i = new e.Vector3(0, 1, 0).cross(r).normalize(), a = r.clone().cross(i), o = new Float32Array(_t * _t).fill(-Infinity);
	function s(e, t, n, o) {
		return t -= 2.35, o.set(_t / 2 + vt * (e * i.x + t * i.y + n * i.z), _t / 2 + vt * (e * a.x + t * a.y + n * a.z), e * r.x + t * r.y + n * r.z);
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
			let u = Math.max(0, Math.ceil(Math.min(r.x, i.x, a.x))), d = Math.min(_t - 1, Math.floor(Math.max(r.x, i.x, a.x))), f = Math.max(0, Math.ceil(Math.min(r.y, i.y, a.y))), p = Math.min(_t - 1, Math.floor(Math.max(r.y, i.y, a.y)));
			for (let e = f; e <= p; e++) for (let t = u; t <= d; t++) {
				let n = ((i.y - a.y) * (t - a.x) + (a.x - i.x) * (e - a.y)) / l, s = ((a.y - r.y) * (t - a.x) + (r.x - a.x) * (e - a.y)) / l;
				if (n >= 0 && s >= 0 && n + s <= 1) {
					let c = e * _t + t;
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
function bt(t) {
	let n = t.levels[1].object.children, r = gt.map((e) => yt(n, e)), i = new e.Vector3(), a = new e.Vector3(), o = new e.Vector3(), s = /* @__PURE__ */ new Map();
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
					let s = Math.round(o.x) + _t * Math.round(o.y);
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
function xt(t, n = 75) {
	let r = new e.PerspectiveCamera(), i = t.update.bind(t);
	t.update = (e) => {
		let t = e, a = Number.isFinite(t.fov) ? Math.max(1, Math.tan(n * Math.PI / 360) / Math.tan(t.fov * Math.PI / 360)) : 1;
		r.matrixWorld.copy(e.matrixWorld), r.zoom = (t.zoom || 1) * a, i(r);
	};
}
//#endregion
//#region src/world/lotus_buddha_face.ts
var St = [
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
function Ct(e, t) {
	let n = 0;
	for (; n < St.length - 2 && e > St[n + 1][0];) n++;
	let r = St[n], i = St[n + 1], a = St[Math.max(0, n - 1)], o = St[Math.min(St.length - 1, n + 2)], s = i[0] - r[0], c = Math.max(0, Math.min(1, (e - r[0]) / s)), l = s * (i[t] - a[t]) / (i[0] - a[0]), u = s * (o[t] - r[t]) / (o[0] - r[0]);
	return (1 - c) * r[t] + c * i[t] + c * (1 - c) * ((1 - c) * (l - i[t] + r[t]) + c * (i[t] - r[t] - u));
}
var J = (e, t) => Math.exp(-(e * e) / (t * t)), Y = (e, t, n, r) => J(e, n) * J(t, r), wt = (e) => Math.max(0, Math.min(1, e));
function Tt(e, t) {
	let n = Math.abs(e), r = wt((n - .053) / .296), i = Math.sin(Math.PI * r), a = i ** .68, o = 3.89 + .051 * r - .024 * i, s = 3.948 + .035 * r + .09 * Math.sin(Math.PI * r) ** .82, c = .014 + .059 * i, l = t - o, u = t - s, d = .061 * Y(n - .245, t - 3.76, .15, .15) - .036 * Y(n - .2, t - 3.942, .145, .084);
	d += a * (.051 * J(l - .52 * c, c * .85) + .023 * J(l + .024, .031) - .022 * J(l, .012 + .005 * i) + .022 * J(u + .007, .043) - .009 * J(u - .026, .029));
	let f = a * (.92 * J(l, .012 + .004 * i) + 1.05 * J(u, .014 + .009 * i)), p = .046 + .019 * J(t - 3.76, .13);
	d += .116 * Math.exp(-((n / p) ** 2.3)) * J(t - 3.856, .184) + .082 * Y(e, t - 3.728, .08, .054) + .043 * Y(n - .07, t - 3.724, .038, .042) + .035 * Y(e, t - 3.693, .029, .033) - .033 * Y(n - .051, t - 3.699, .025, .012) - .024 * Y(n - .103, t - 3.715, .02, .041), f += .79 * Y(n - .051, t - 3.699, .025, .011) + .2 * Y(e, t - 3.692, .085, .02);
	let m = wt(1 - (n / .151) ** 2) ** 1.35, h = t - (3.581 + .02 * (n / .151) ** 2 + .007 * J(n - .047, .034));
	return d += m * (.047 * J(h - .02, .021) + .052 * J(h + .024, .028) - .018 * J(h, .009)) - .02 * Y(n - .149, t - 3.577, .017, .02) - .012 * Y(e, t - 3.627, .022, .035) + .018 * Y(n - .033, t - 3.625, .023, .038), f += m * (.84 * J(h, .007) + .28 * J(h + .05, .012)), d += .033 * Y(e, t - 3.443, .174, .074) - .009 * Y(e, t - 3.496, .115, .023), [d, wt(f)];
}
function Et(e, t) {
	let n = e * Math.PI * 2, r = n - .57 * Math.sin(n), i = 3.29 + 1.13 * t, a = Math.cos(r), o = Ct(i, 1) * Math.sin(r), s = Math.max(0, a), [c, l] = s > 0 ? Tt(o, i) : [0, 0];
	return {
		x: o,
		y: i,
		z: -.17 + (a < 0 ? Ct(i, 3) * a : Ct(i, 2) * s ** .77) + c * s ** 1.65,
		patina: l * s
	};
}
//#endregion
//#region src/world/central_robe.js
var Dt = (e) => Math.max(0, Math.min(1, e));
function X(e, t, n) {
	let r = Dt((n - e) / (t - e));
	return r * r * (3 - 2 * r);
}
function Z(e, t, n) {
	return Math.exp(-((e - t) ** 2) / (n * n));
}
var Ot = 2 * Math.PI;
function kt(e, t) {
	let n = Dt(t) * (e.length - 1), r = Math.min(e.length - 2, Math.floor(n)), i = n - r, a = e[Math.max(0, r - 1)], o = e[r], s = e[r + 1], c = e[Math.min(e.length - 1, r + 2)];
	return o.map((e, t) => .5 * (2 * e + (-a[t] + s[t]) * i + (2 * a[t] - 5 * e + 4 * s[t] - c[t]) * i * i + (-a[t] + 3 * e - 3 * s[t] + c[t]) * i * i * i));
}
var At = [
	[.72, .48],
	[.82, .54],
	[.84, .53],
	[.78, .5],
	[.84, .48],
	[.92, .45],
	[.91, .4],
	[.71, .34],
	[.3, .27]
], jt = [
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
], Mt = [
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
], Nt = [
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
function Pt(e, t, n, r) {
	let i = X(.16, .72, t), a = Math.cos(e), o = n * (.13 + .77 * i) + (r ? .13 : -.1) * Math.sin(Math.PI * t), s = 0;
	for (let [n, r, a] of Nt) {
		let c = n + .64 * o - .33 * i * Math.sin(n) + .16 * Math.sin(Math.PI * t + n), l = Math.atan2(Math.sin(e - c), Math.cos(e - c)), u = X(.008, .13 + .025 * Math.cos(n), t) * (1 - X(.52 + .09 * Math.sin(n), .76, t));
		s += u * (a * Z(l, 0, r) - .037 * Z(l, r * 1.21, r * .79));
	}
	let c = t + .062 * a + .04 * n * Math.sin(e), l = (.047 * Z(c, .595, .059) - .021 * Z(c, .66, .039) + .041 * Z(c, .744, .052)) * (.77 + .23 * Math.cos(e - n * .63));
	return s + l + .035 * Z(c, .856, .042) + .029 * Z(t, .948, .033);
}
function Ft(e, t, n, r = !1, i = !1) {
	let a = Ot * t, o = Math.cos(a), s = Math.sin(a);
	if (e === 0) {
		let e = 1.03 + 2.26 * n, [t, i] = kt(At, n), a = t * s, c = (Math.abs(a + .018 * Math.sin(2.4 * e)) ** 2.6 + (Math.max(0, 3.08 - e) * .49) ** 2.6) ** (1 / 2.6), l = Z(a, 0, .42) * Z(e, 2.74, .52), u = i * o - .19, d = [
			.49,
			.575,
			.665,
			.785,
			.9
		];
		for (let t = 0; t < d.length; t++) {
			let n = c - d[t] - .014 * Math.sin(4.6 * e + t * .95 + a * 3);
			u += Math.max(0, o) * (.042 * Z(n, 0, .029) - .027 * Z(n, .042, .024));
		}
		return u += Math.max(0, o) * (.065 * l - .031 * Z(a, 0, .07) * Z(e, 2.75, .31) - .037 * Z(e, 2.4, .05) * Z(a, 0, .38)), r && (u += .0038 * Math.cos(236 * c + 1.6 * Math.sin(e * 6)) * X(.45, .59, c) * Math.max(0, o)), [
			a,
			e,
			u
		];
	}
	let c = e === 1 || e === 2, l = e === 1 || e === 3 ? -1 : 1, u = c ? jt : Mt, d = kt(u, n), f = kt(u, n - .001), p = kt(u, n + .001), m = l * (p[0] - f[0]), h = p[1] - f[1], g = p[2] - f[2], _ = Math.hypot(m, h, g);
	m /= _, h /= _, g /= _;
	let v = c ? g : h, y = -v * m, b = +!c - v * h, x = +!!c - v * g, S = Math.hypot(y, b, x);
	y /= S, b /= S, x /= S;
	let C = h * x - g * b, ee = g * y - m * x, w = m * b - h * y, T = 0;
	if (c) T = Pt(a, n, l, i), r && (T += .0018 * Math.sin(19 * a + 4.8 * n) * X(.04, .21, n) * (1 - X(.63, .84, n)));
	else {
		let e = n + .083 * Math.sin(a + l * .48) + .028 * o;
		T = .037 * Z(e, .44, .081) - .016 * Z(e, .528, .055) + .046 * Z(e, .63, .072) + .029 * Z(e, .82, .054), r && (T += .0018 * Math.cos(82 * e) * X(.22, .51, n));
	}
	let E = c ? (.34 + .66 * X(0, .18, n)) * (1 - .26 * X(.973, 1, n)) : .42 + .58 * X(0, .12, n), D = (d[3] + T) * E, O = (d[4] + T) * E, k = c ? 0 : l * .1 * X(.47, .94, n), A = i && e === 2 ? X(.72, 1, n) : 0;
	return [
		l * d[0] + .115 * A + y * D * o + C * O * s,
		d[1] + k + .062 * A + b * D * o + ee * O * s,
		d[2] - .035 * A + x * D * o + w * O * s
	];
}
//#endregion
//#region src/world/buddha_sculpture.ts
var Q = e.MathUtils.smoothstep, $ = (e, t, n, r, i, a) => Math.exp(-(((e - n) / i) ** 2 + ((t - r) / a) ** 2));
function It(t, n, r, i, a) {
	let o = t === 1, s = {
		gold: [],
		lap: [],
		crease: [],
		hair: []
	}, u = Math.max(12, Math.round(48 * n));
	function d(t, n = "gold") {
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
				for (let e = 0; e < s.count; e++) i ? n[e] = .58 + .38 * Q(s.getY(e), .66, .93) : n[e] = t.userData.finish ?? 0;
				t.setAttribute("robeFinish", new e.BufferAttribute(n, 1));
			}
			t.setAttribute("uv1", new e.BufferAttribute(c, 2));
		}
		s[n].push(t);
	}
	function f(r, i, a, o, s, c, l = "gold") {
		d(new e.SphereGeometry(1, l === "hair" ? n > .5 && t !== 1 ? 8 : 6 : Math.max(8, u / 2), l === "hair" ? n > .5 && t !== 1 ? 6 : 4 : Math.max(5, u / 3)).scale(o, s, c).translate(r, i, a), l);
	}
	function p(t, r, i = "gold", a = 7) {
		let o = new e.CatmullRomCurve3(t.map((t) => new e.Vector3(...t)));
		d(new e.TubeGeometry(o, Math.max(3, Math.round(t.length * 4 * n)), r, n < .3 ? 4 : a, !1), i);
	}
	function m(t, r, i, a = "gold", o = 5, s = 0) {
		let c = [], l = [], u = [];
		t = Math.max(3, Math.round(t * n)), r = Math.max(3, Math.round(r * n));
		for (let e = 0; e <= r; e++) for (let n = 0; n <= t; n++) {
			let a = i(n / t, e / r);
			if (c.push(a.x, a.y, a.z), l.push(n / t, e / r), n < t && e < r) {
				let r = e * (t + 1) + n, i = r + 1, a = r + t + 1, o = a + 1;
				u.push(r, i, a, i, o, a);
			}
		}
		let f = new e.BufferGeometry();
		return f.setAttribute("position", new e.Float32BufferAttribute(c, 3)), f.setAttribute("uv", new e.Float32BufferAttribute(l, 2)), f.setIndex(u), f.computeVertexNormals(), f.userData.chart = o, f.userData.finish = s, d(f, a), f;
	}
	let h = new e.LatheGeometry([
		[0, 0],
		[1.65, 0],
		[1.8, .08],
		[1.89, .19],
		[1.84, .3],
		[1.66, .4],
		[0, .4]
	].map(([t, n]) => new e.Vector2(t, n)), u * 2);
	h.scale(1, 1, .64), d(h);
	let g = Math.max(12, Math.round(26 * n));
	for (let t of [0, 1]) for (let n = 0; n < g; n++) {
		let r = (n + t * .5) * Math.PI * 2 / g;
		m(10, 12, (n, i) => {
			let a = (n - .5) * .24, o = Math.sin(Math.PI * i) * a, s = 1.74 + .17 * Math.sin(Math.PI * i), c = t ? .19 + .2 * i : .2 - .16 * i;
			return new e.Vector3(Math.sin(r + o) * s, c + .035 * Math.sin(Math.PI * i) * (1 - (2 * n - 1) ** 2), Math.cos(r + o) * s * .64);
		});
	}
	let _ = t === 1 ? -1 : +(t === 2);
	[
		[134, 118],
		[60, 74],
		[60, 74],
		[68, 82],
		[68, 82]
	].forEach(([t, n], r) => {
		m(t, n, (t, n) => {
			let i = new e.Vector3().fromArray(Ft(r, t, n, !1, o));
			if (r === 1 && _ === -1 || r === 2 && _ === 1) {
				let e = Q(n, .58, 1);
				i.x += _ * .6 * e, i.y -= .13 * e;
			}
			if (o) {
				if (r <= 2) {
					let e = $(Math.abs(i.x), i.y, .73, 2.98, .46, .37);
					if (i.y -= .16 * e, r > 0) {
						let e = .14 * Math.exp(-((n - .18) ** 2) / .032);
						i.x *= 1 - e;
					}
				}
				if (r === 1) {
					let e = Q(n, .54, .93);
					i.y -= .072 * e, i.z += .095 * e;
				}
			}
			return i;
		}, "gold", r);
	});
	let v = _ || 1;
	function y(e, t, n) {
		let r = e / t;
		return n * (Math.exp(-r * r * (r > 0 ? .86 : 3.2)) - .29 * Math.exp(-((r + 1.02) ** 2) / .26));
	}
	m(128, 74, (t, n) => {
		let r = 2 * Math.PI * t, i = -Math.cos(Math.PI * n), a = Math.sin(Math.PI * n) ** .46, o = Math.abs(i), s = Math.exp(-((o - .76) ** 2) / .085), c = v * i, l = .72 + .13 * s + .053 * c, u = -Math.sin(r), d = Math.cos(r), f = .43 + .13 * s, p = l - .31, m = l + (u > 0 ? f : p) * a * u, h = 1.04 + .18 * s + .08 * c, g = .21 * o ** 1.65 + .058 * c, b = .87 + .16 * s + .08 * c, x = (m - g - .53) / b + .53, S = $(i, m, _ * .57, 1.08, .22, .17), C = y(x - .434, .093, .111) + y(x - .65 - .025 * i, .109, .16) + y(x - .896 + .029 * i, .092, .126) * (1 - .6 * S), ee = 1.96 * i, w = Math.max(0, d);
		return new e.Vector3(ee, m, -.01 + .14 * s + a * d * (h + C * w));
	}, "lap"), o ? m(86, 44, (t, n) => {
		let r = -1.32 + 2.07 * t + .1 * (1 - n) * Math.sin(2 * Math.PI * t), i = Math.sin(Math.PI * t), a = .88 - .47 * i + .15 * t, o = 1.26 - .18 * i + .2 * t - .065 * $(r, 0, -1.05, 0, .22, 1), s = e.MathUtils.lerp(a, o, n) + .029 * Math.sin(Math.PI * n) * Math.cos(3 * Math.PI * t), c = $(r, s, -1.06, 1.18, .25, .17), l = n + .11 * Math.sin(Math.PI * t * 1.7) + .19 * i, u = y(l - .374, .174, .181) + y(l - .77, .166, .106), d = 1.17 + .17 * i - .12 * r * r + .044 * Math.sin(Math.PI * n) + u * (1 - .78 * c) - .09 * c - .105 * (1 - Q(n, 0, .17)), f = .23 * Q(n, .8, 1) + .14 * (1 - Q(t, 0, .14)) + .14 * Q(t, .88, 1);
		return new e.Vector3(r, s, d - f);
	}, "lap", 5, -1) : m(76, 54, (t, n) => {
		let r = 2 * t - 1, i = 1 - r * r, a = .55 + .22 * n, o = .17 * r * r + .044 * v * r, s = .48 + .83 * n + o, c = n - .22 * r * r + .047 * v * r, l = y(c - .22, .16, .161) + y(c - .59, .155, .118), u = .15 * (1 - Q(n, 0, .145)) + .13 * Q(n, .8, 1);
		return new e.Vector3(a * r, s, 1.18 + .1 * i + .062 * Math.sin(Math.PI * n) + l - u);
	}, "lap", 5, 1);
	let b = (e, t) => {
		let n = (t - 1.03) / 2.26, r = 0, i = .22;
		for (let t = 0; t < 12; t++) {
			let t = (r + i) * .5;
			Ft(0, t, n)[0] < Math.abs(e) ? r = t : i = t;
		}
		return Ft(0, (r + i) * .5, n)[2];
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
				b(r, i) + .012
			];
		});
		for (let t = 1; t < r.length; t++) {
			let n = new e.Vector3(...r[t - 1]), i = new e.Vector3(...r[t]), a = new e.BoxGeometry(.024, n.distanceTo(i) + .01, .02);
			a.applyQuaternion(new e.Quaternion().setFromUnitVectors(new e.Vector3(0, 1, 0), i.clone().sub(n).normalize()));
			let o = n.lerp(i, .5);
			d(a.translate(o.x, o.y, o.z));
		}
	}
	o ? m(76, 32, (t, n) => {
		let r = 2 * Math.PI * t, i = .315 + .255 * (1 - Q(n, 0, .58)) + .042 * Q(n, .64, 1), a = .25 + .07 * Q(n, 0, .34) - .054 * Q(n, .34, .64);
		return new e.Vector3(i * Math.sin(r), 2.94 + .54 * n, -.18 + a * Math.cos(r));
	}) : f(0, 3.23, -.16, .29, .35, .28);
	for (let e of [-1, 1]) {
		let t = e === _;
		o || f(e * (t ? 1.06 : .49), t ? 1.35 : 1.47, .64, .155, .12, .14);
	}
	let x = {
		gold: s.gold.length,
		crease: s.crease.length,
		hair: s.hair.length
	}, S = (t, n) => {
		let r = 3.29 + n * 1.13, i = 2 * Math.PI * t, a = Math.PI * n, o = Math.sin(a) ** .44 * (.94 + .06 * Q(n, .32, .65)), s = .485 * Math.sin(i) * o, c = Math.max(0, Math.cos(i)), l = -.17 + .365 * Math.cos(i) * Math.sin(a) ** .45, u = (r - 3.29) / 1.13, d = .155 * $(s, u, 0, .52, .078, .2) + .079 * $(s, u, 0, .41, .087, .052), f = .054 * ($(s, u, -.23, .39, .12, .16) + $(s, u, .23, .39, .12, .16)), p = -.041 * ($(s, u, -.17, .59, .12, .055) + $(s, u, .17, .59, .12, .055)), m = .039 * $(s, u, 0, .255, .122, .026) + .032 * ($(s, u, -.052, .291, .06, .021) + $(s, u, .052, .291, .06, .021)) - .018 * $(s, u, 0, .218, .11, .022), h = .04 * $(s, u, 0, .14, .22, .095), g = .042 * ($(s, u, -.17, .65, .145, .05) + $(s, u, .17, .65, .145, .05)), _ = .047 * ($(s, u, -.16, .57, .11, .037) + $(s, u, .16, .57, .11, .037)), v = .048 * $(Math.abs(s), u, .082, .407, .043, .042), y = -.021 * $(s, u, 0, .335, .023, .038), b = -.023 * $(Math.abs(s), u, .127, .277, .037, .034), x = .069 * $(s, u, 0, .146, .17, .07), S = .046 * $(Math.abs(s), u, .234, .45, .105, .088) - .029 * $(Math.abs(s), u, .164, .315, .052, .067);
		return l += (d + f + p + m + h + g + _ + v + y + b + x + S) * c ** 5, new e.Vector3(s, r, l);
	};
	if (o) {
		let t = m(194, 184, (t, n) => {
			let { x: r, y: i, z: a } = Et(t, n);
			return new e.Vector3(r, i, a);
		}), n = t.getAttribute("uv"), r = t.getAttribute("normal"), i = t.getAttribute("robeFinish"), a = 25e-5, o = new e.Vector3(), s = new e.Vector3();
		for (let e = 0; e < n.count; e++) {
			let t = n.getX(e), c = n.getY(e), l = Et(t - a, c), u = Et(t + a, c), d = Et(t, Math.max(0, c - a)), f = Et(t, Math.min(1, c + a));
			o.set(u.x - l.x, u.y - l.y, u.z - l.z), s.set(f.x - d.x, f.y - d.y, f.z - d.z), o.cross(s).normalize(), r.setXYZ(e, o.x, o.y, o.z), i.setX(e, 2 + Et(t, c).patina);
		}
		let c = Et(0, .7539999999999996 / 1.13);
		f(0, c.y, c.z + .002, .011, .012, .006);
		for (let t of [-1, 1]) m(50, 42, (n, r) => {
			let i = 2 * Math.PI * (t > 0 ? n : 1 - n), a = Math.sin(Math.PI * r) ** .44, o = .063 + .025 * Math.exp(-((r - .77) ** 2) / .038) + .013 * Math.exp(-((r - .14) ** 2) / .022), s = Math.sin(i), c = Math.cos(i), l = Math.exp(-((s - .67) ** 2) / .041), u = Math.exp(-((r - .68) ** 2) / .046);
			return new e.Vector3(t * (.469 + .025 * r + o * a * s), 3.475 + .644 * r, -.13 + a * (.092 * c + Math.max(c, 0) * u * (.038 * l - .065)));
		});
	} else {
		m(144, 112, S);
		let t = (t, n) => {
			let r = e.MathUtils.clamp((n - 3.29) / 1.13, .01, .99), i = .485 * Math.sin(Math.PI * r) ** .44 * (.94 + .06 * Q(r, .32, .65));
			return S(Math.asin(e.MathUtils.clamp(t / i, -.99, .99)) / (2 * Math.PI), r).z;
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
			p(r, .0095, "crease", 5), m(22, 8, (r, i) => {
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
			p(i, .0115, "crease", 6), f(n * .064, 3.745, t(n * .064, 3.745) + .003, .019, .01, .009, "crease"), f(n * .473, 3.83, -.125, .086, .29, .085), f(n * .492, 3.87, -.041, .035, .16, .014);
			let a = [];
			for (let e = 0; e <= 20; e++) {
				let t = e / 20 * Math.PI * 2;
				a.push([
					n * (.489 + .048 * Math.sin(t)),
					3.83 + .244 * Math.cos(t),
					-.035
				]);
			}
			p(a, .013), f(n * .484, 3.58, -.084, .058, .085, .058);
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
		p(n, .007, "crease"), p(n.map(([e, n]) => [
			e,
			n - .014,
			t(e, n - .014) + .004
		]), .008), f(0, 4.015, t(0, 4.015) + .008, .019, .019, .01);
	}
	if (o) {
		let t = (t, n) => {
			let r = 2 * Math.PI * t, i = 4.07 + .09 * Math.cos(r), a = n * Math.PI / 2, o = Math.cos(a), s = Math.cos(r);
			return new e.Vector3(.476 * o * Math.sin(r), i + (4.505 - i) * Math.sin(a), -.17 + o * (s < 0 ? .398 * s : .388 * s ** .77));
		};
		m(90, 34, t, "hair"), f(0, 4.474, -.17, .148, .086, .139, "hair");
		let r = Math.max(3, Math.round(14 * n));
		for (let e = 0; e < r; e++) {
			let i = (e + .5) / r, a = Math.cos(i * Math.PI * .5), o = Math.max(5, Math.round(66 * a * n));
			for (let n = 0; n < o; n++) {
				let r = t((n + e % 2 * .5) / o, i);
				f(r.x, r.y, r.z, .033, .031, .034, "hair");
			}
		}
	} else {
		f(0, 4.23, -.18, .479, .26, .38, "hair"), f(0, 4.44, -.18, .19, .14, .19, "hair");
		let e = Math.max(3, Math.round(10 * n));
		for (let t = 0; t < e; t++) {
			let r = (t + .5) / e * Math.PI * .57, i = Math.sin(r), a = Math.max(6, Math.round(42 * i * n));
			for (let e = 0; e < a; e++) {
				let n = (e + t % 2 * .5) * Math.PI * 2 / a;
				f(.48 * i * Math.sin(n), 4.19 + .3 * Math.cos(r), -.18 + .374 * i * Math.cos(n), .038, .037, .038, "hair");
			}
		}
	}
	for (let e of Object.keys(x)) for (let t of s[e].slice(x[e])) t.translate(0, -3.28, .16), o && t.scale(1.09, 1.045, 1.07), t.rotateX(o ? .072 : .11).translate(0, o ? 3.235 : 3.28, -.16);
	function C(t) {
		let n = t === _, r = n ? 1.34 : t < 0 ? 1.46 : 1.54, i = s.gold.length;
		d(new e.SphereGeometry(1, u, u / 2).scale(.24, .083, .17).translate(t * .23, r, .71));
		for (let n = 0; n < 4; n++) {
			let i = [
				.19,
				.24,
				.22,
				.16
			][n];
			m(12, 16, (a, o) => {
				let s = -t * a * 2 * Math.PI, c = (.041 - .012 * o) * (1 - Q(o, .81, 1)) + .002;
				return new e.Vector3(t * (.15 - (.13 + i) * o), r + .015 - .033 * o * o + c * .79 * Math.cos(s), .835 - .077 * n + .038 * Math.sin(Math.PI * o) + c * Math.sin(s));
			});
		}
		if (p([
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
	if (o || (C(-1), C(1)), o) {
		let t = (t, n) => {
			let r = new e.CatmullRomCurve3(t.map((t) => new e.Vector3(...t)));
			m(12, 22, (t, i) => {
				let a = r.getPoint(i), o = r.getTangent(i), s = new e.Vector3(0, 1, 0).cross(o).normalize(), c = o.clone().cross(s), l = 2 * Math.PI * t, u = n * (1 - .24 * i) * (1 - Q(i, .83, 1));
				return a.addScaledVector(s, u * Math.cos(l)).addScaledVector(c, .84 * u * Math.sin(l));
			}, "gold", 5, t[0][0] > 0 ? -2 : 0);
		}, n = (t, n, r, i) => {
			let a = new e.SphereGeometry(1, u, u / 2).scale(...n).rotateX(r).rotateY(i).translate(...t);
			a.userData.finish = t[0] > 0 ? -2 : 0, d(a);
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
		d(new e.LatheGeometry([
			[0, 0],
			[.074, .002],
			[.113, .044],
			[.168, .099],
			[.204, .157],
			[.181, .154],
			[.107, .067],
			[0, .048]
		].map(([t, n]) => new e.Vector2(t, n)), u).translate(r, i, a));
		for (let t = 0; t < 2; t++) for (let n = 0; n < 8; n++) {
			let o = (n + t * .5) * Math.PI / 4;
			m(10, 14, (n, s) => {
				let c = 2 * n - 1, l = c * (.012 + .092 * Math.sin(Math.PI * s) ** .75), u = .092 + .105 * s + .033 * Math.sin(Math.PI * s) + .026 * c * c - .03 * t;
				return new e.Vector3(r + u * Math.sin(o) + l * Math.cos(o), i + .04 + .195 * s + .035 * t - .025 * c * c, a + u * Math.cos(o) - l * Math.sin(o));
			});
		}
	} else t === 2 && f(-.16, 1.69, .73, .16, .157, .15);
	let ee = new e.Group();
	for (let n of Object.keys(s)) {
		if (!s[n].length) continue;
		let u = new e.MeshStandardMaterial({
			name: "hall-authored-buddha-" + n,
			color: n === "lap" ? 13739106 : n === "gold" ? 12684105 : n === "hair" ? o ? 9925444 : 4730908 : 5846307,
			metalness: n === "lap" ? .57 : n === "gold" ? .77 : .55,
			roughness: n === "lap" ? .51 : n === "gold" ? .7 : o ? .4 : .56
		});
		(n === "gold" || n === "lap") && (u.roughnessMap = r, u.bumpMap = r, u.bumpScale = 65e-5, u.normalMap = a, u.normalScale.set(.82, .82));
		let d = o && n === "gold";
		u.onBeforeCompile = (e) => {
			e.uniforms.uChasedDetail = { value: i }, e.vertexShader = "attribute float sculptVisibility; varying float vVisibility; varying vec3 vSculpt;\n" + e.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvVisibility=sculptVisibility; vSculpt=position;"), e.fragmentShader = "uniform sampler2D uChasedDetail; varying float vVisibility; varying vec3 vSculpt;\n" + e.fragmentShader.replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n          #ifdef USE_ROUGHNESSMAP\n            vec2 detailUV=vec2(vSculpt.x/4.1+.5,vSculpt.y/4.7);\n            #ifdef CENTRAL_CARVING\n              if(vSculpt.y>3.36){\n                vec2 yz=vSculpt.yz-vec2(3.28,-.16);\n                detailUV.y=(3.28+cos(.11)*yz.x+sin(.11)*yz.y)/4.7;\n              }\n            #endif\n            float chased=(texture2D(uChasedDetail,detailUV).r-.502)*2.55;\n            float face=smoothstep(3.29,3.47,vSculpt.y)*(1.-smoothstep(4.11,4.24,vSculpt.y));\n            float mantle=smoothstep(1.48,1.68,vSculpt.y)*(1.-smoothstep(3.07,3.22,vSculpt.y));\n            float front=smoothstep(-.04,.16,vSculpt.z);\n            float widthFade=1.-smoothstep(.33,.47,abs(vSculpt.x));\n            diffuseColor.rgb*=exp(chased*front*(.95*face*widthFade+.65*mantle));\n            float oxide=texture2D(roughnessMap,vRoughnessMapUv).b;\n            float lap=1.-smoothstep(1.2,1.6,vSculpt.y);\n            float carvedHem=smoothstep(.36,.52,vSculpt.y)*(1.-smoothstep(1.21,1.42,vSculpt.y));\n            diffuseColor.rgb*=exp(.19*chased*front*carvedHem);\n            float chinShade=1.-vVisibility;\n            diffuseColor.rgb *= mix(vec3(1.),vec3(.56,.36,.27),clamp(oxide+.70*chinShade+.13*lap,0.,1.));\n            roughnessFactor=clamp(roughnessFactor+.12*chinShade-.045*smoothstep(3.3,3.7,vSculpt.y),.27,.64);\n            #ifdef CENTRAL_CARVING\n              float cheek=smoothstep(3.42,3.72,vSculpt.y)*(1.-smoothstep(4.12,4.28,vSculpt.y));\n              float breast=exp(-pow(abs(vSculpt.x)/.49,2.)-pow(abs(vSculpt.y-2.73)/.51,2.));\n              float hand=exp(-pow(abs(vSculpt.x)/.54,2.)-pow(abs(vSculpt.y-1.48)/.14,2.))*front;\n              roughnessFactor=clamp(roughnessFactor+.165*breast+.065*(1.-cheek)-.080*cheek-.047*hand,.24,.69);\n              diffuseColor.rgb*=mix(vec3(.98,.94,.91),vec3(1.20,1.16,1.09),cheek);\n              roughnessFactor-=.055*hand;\n              diffuseColor.rgb*=1.+.09*cheek*front;\n            #endif\n            #ifdef LOTUS_BEARER\n              // Smoother gold leaf across the face, with darker rubbed recesses in the lap.\n              float skin=face*widthFade*front;\n              diffuseColor.rgb*=exp(-chased*front*(.72*face*widthFade+.43*mantle));\n              diffuseColor.rgb*=mix(vec3(1.07,1.11,1.02),vec3(1.20,1.22,1.04),skin);\n              roughnessFactor=mix(roughnessFactor,.43,.66*skin);\n              roughnessFactor=mix(roughnessFactor,.51,.55*breast);\n            #endif\n          #endif").replace("#include <aomap_fragment>", "#include <aomap_fragment>\n          reflectedLight.indirectDiffuse*=.29+.55*vVisibility;\n          reflectedLight.indirectSpecular*=.19+.76*vVisibility;\n          // The indoor probe includes vermilion columns. Soften the red\n          // contribution on worn gilding, especially below the cheek and knees.\n          float warmRebound=max(0.,reflectedLight.indirectSpecular.r-2.20*reflectedLight.indirectSpecular.g);\n          reflectedLight.indirectSpecular+=warmRebound*vec3(-.38,.22,.055);\n          reflectedLight.directDiffuse*=.63+.37*vVisibility;\n          reflectedLight.directSpecular*=.33+.67*vVisibility;"), n === "lap" && (e.vertexShader = "varying float vFoldCrown;\n" + e.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvFoldCrown=smoothstep(.10,.63,normal.y)*(1.-smoothstep(.81,1.,normal.y))*smoothstep(.0,.47,normal.z);"), e.fragmentShader = "varying float vFoldCrown;\n" + e.fragmentShader.replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\n            float crown=clamp(vFoldCrown,0.,1.);\n            // Gold leaf stays cleaner on the rolled lip; oxidation collects in the return.\n            float leaf=texture2D(roughnessMap,vRoughnessMapUv*.68).g;\n            float worn=crown*crown*(.43+.48*smoothstep(.18,.79,leaf));\n            diffuseColor.rgb=mix(diffuseColor.rgb,diffuse*vec3(1.19,1.12,1.01),.06+.58*worn);\n            diffuseColor.rgb*=.98+.12*worn+.18*(leaf-.5);\n            roughnessFactor=mix(.54,.39,worn)+.10*(leaf-.5)+.05*(1.-vVisibility);\n            metalnessFactor=mix(.70,.50,worn);")), n === "lap" && (e.vertexShader = "attribute vec2 apronUv; varying vec2 vApronUv;\n" + e.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvApronUv=apronUv;"), e.fragmentShader = "varying vec2 vApronUv;\n" + e.fragmentShader.replace("#include <normal_fragment_begin>", "\n            #ifdef FLANKING_LAP\n              if(vApronUv.x>=0. || vSculpt.z>.12){\n            #else\n              if(vApronUv.x>=0.){\n            #endif\n              // Lay the leaf along the two curved hems. Sample the existing finish at\n              // two physical scales so broad losses survive minification at the door.\n              float lateral=2.*vApronUv.x-1.;\n              vec2 cloth=vec2(vApronUv.x,vApronUv.y-.22*lateral*lateral+.047*lateral);\n              vec2 patchScale=vec2(1.35,1.11),flakeScale=vec2(6.1,7.3),offset=vec2(.29,.17);\n              float wearBias=0.,polish=1.;\n              #ifdef FLANKING_LAP\n                bool panel=vApronUv.x>=0.;\n                #ifdef LOTUS_BEARER\n                  // Short breaks in the folded breadth pinched beneath the resting palm.\n                  cloth.y=vApronUv.y+.11*sin(5.34*vApronUv.x)+.19*sin(3.14159*vApronUv.x);\n                  patchScale=vec2(1.62,1.14);flakeScale=vec2(8.1,6.6);offset=vec2(.67,.34);\n                  float pinched=exp(-dot((vSculpt.xy-vec2(-.96,1.06))*vec2(2.25,3.4),\n                                         (vSculpt.xy-vec2(-.96,1.06))*vec2(2.25,3.4)));\n                  wearBias=.014+.047*pinched;\n                  polish=.84+.15*(1.-pinched);\n                #else\n                  // Longer intact arcs towards the outside of the raised knee.\n                  patchScale=vec2(.98,1.65);flakeScale=vec2(5.4,9.6);offset=vec2(.13,.81);\n                  wearBias=.018-.058*smoothstep(.22,1.63,vSculpt.x);\n                  polish=.90+.31*smoothstep(-.25,1.45,vSculpt.x);\n                #endif\n                if(!panel){\n                  float sweep=vSculpt.y-.20*pow(abs(vSculpt.x)/1.96,1.65);\n                  cloth=vec2(.53*vSculpt.x+.18*vSculpt.z,sweep+.11*vSculpt.z);\n                }\n              #endif\n              vec3 islands=texture2D(roughnessMap,cloth*patchScale+offset).rgb;\n              vec3 flakes=texture2D(roughnessMap,cloth*flakeScale+vec2(.17,.68)).rgb;\n              float coverage=.60*islands.b+.40*flakes.b+.37*(flakes.r-.50);\n              float missing=smoothstep(.217,.335,coverage+wearBias);\n              float crest=clamp(vFoldCrown,0.,1.);\n              float intact=(1.-missing)*crest*polish;\n              float abrasion=missing*(.32+.68*crest);\n              diffuseColor.rgb*=mix(vec3(1.),vec3(.62,.58,.51),abrasion);\n              diffuseColor.rgb*=1.+intact*(.11+.31*flakes.r);\n              roughnessFactor=clamp(roughnessFactor+.14*abrasion-.064*intact,.28,.79);\n              metalnessFactor=mix(metalnessFactor,.49,abrasion);\n            }\n            #include <normal_fragment_begin>")), d && (e.vertexShader = "attribute float robeFinish; varying float vRobeFinish;\n" + e.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvRobeFinish=robeFinish;"), e.fragmentShader = "varying float vRobeFinish;\n" + e.fragmentShader.replace("#include <aomap_fragment>", "#include <aomap_fragment>\n            // Cut and darkened lines in gilding return much less of the hall\n            // reflection than the rounded lid, even along a grazing view.\n            float cutPatina=smoothstep(.065,.85,clamp(vRobeFinish-2.,0.,1.));\n            reflectedLight.directSpecular*=1.-.94*cutPatina;\n            reflectedLight.indirectSpecular*=1.-.95*cutPatina;\n            reflectedLight.directDiffuse*=1.-.48*cutPatina;\n          ").replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\n            float faceSurface=step(1.5,vRobeFinish);\n            float sleeveFinish=clamp(vRobeFinish,0.,1.)*(1.-faceSurface);\n            float engraving=clamp(vRobeFinish-2.,0.,1.);\n            diffuseColor.rgb*=mix(vec3(1.),vec3(.092,.058,.034),engraving);\n            diffuseColor.rgb*=mix(vec3(1.),vec3(1.25,1.29,1.10),faceSurface*(1.-engraving));\n            roughnessFactor=mix(roughnessFactor,.45+.15*engraving,.82*faceSurface);\n            metalnessFactor=mix(metalnessFactor,.67-.22*engraving,faceSurface);\n            float hemFinish=1.-min(1.,abs(vRobeFinish+1.));\n            float handFinish=max(0.,-vRobeFinish-1.);\n            diffuseColor.rgb*=mix(vec3(1.),vec3(.76,.71,.64),sleeveFinish);\n            diffuseColor.rgb*=exp(-.15*chased*front*carvedHem*hemFinish);\n            diffuseColor.rgb*=mix(vec3(1.),vec3(1.16,1.12,1.02),hemFinish);\n            roughnessFactor=mix(roughnessFactor,.57,.64*sleeveFinish+.48*hemFinish);\n            diffuseColor.rgb*=mix(vec3(1.),vec3(1.48,1.40,1.16),handFinish);\n            roughnessFactor=mix(roughnessFactor,.36,handFinish);\n            metalnessFactor=mix(metalnessFactor,.60,handFinish);\n          "));
		}, u.defines = {
			...u.defines ?? {},
			CENTRAL_CARVING: 1,
			...n === "lap" && t !== 0 ? { FLANKING_LAP: 1 } : {},
			...o ? { LOTUS_BEARER: 1 } : {}
		}, u.customProgramCacheKey = () => n === "lap" ? t === 0 ? "hall-central-apron-leaf-1" : "hall-flanking-apron-leaf-1" : d ? "hall-lotus-face-1" : "hall-gilding-visibility-1";
		let f = new e.Mesh(l(c(s[n]), .72), u);
		f.castShadow = !0, f.receiveShadow = !0, ee.add(f);
	}
	return ee;
}
function Lt(t, n, r, i) {
	let a = new e.LOD();
	return a.addLevel(It(t, .76, n, r, i), 0), a.addLevel(It(t, .38, n, r, i), 20, .12), a.addLevel(It(t, .12, n, r, i), 40, .12), bt(a), xt(a), a;
}
//#endregion
//#region src/world/main_hall_study.ts
function Rt(t, n) {
	let r = new e.Group();
	r.name = "lingyin-main-hall-interior";
	let i = L.temple.x, a = L.temple.z, u = L.platform.y + h, d = L.platform.y + 9.72 + 1, f = (m.w - 3.25) / x.x, p = (m.d - 3.25) / x.z, g = L.platform.y + 9.9 + 1;
	function v() {
		let o = t.materials.mainRoof;
		o instanceof e.MeshStandardMaterial && (o.map = n.redRoof, o.normalMap = null, o.bumpMap = n.redRoof, o.bumpScale = .035, o.color.set("#c5a89f"), o.roughness = .88, o.needsUpdate = !0);
		let s = g + 1.55;
		k("darkWood", 24, 2.5, .09, 0, s, 7.45);
		for (let e of [
			-9.2,
			-5.1,
			5.1,
			9.2
		]) {
			k("teal", 3.5, 1.45, .055, e, s, 7.52);
			for (let t = -4; t <= 4; t++) k("darkWood", .055, 1.43, .06, e + t * .39, s, 7.57);
			for (let t = -1; t <= 1; t++) k("gilt", 3.5, .035, .06, e, s + t * .48, 7.58);
		}
		for (let e of [
			-12,
			-7.15,
			-3.25,
			3.25,
			7.15,
			12
		]) k("lacquer", .36, 2.56, .32, e, s, 7.69), k("gilt", .47, .07, .37, e, g + .29, 7.69);
		let l = ut(n.paintedBeam), d = new e.MeshStandardMaterial({
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
				g - .48,
				9.58
			],
			[
				26.5,
				.62,
				g + 2.85,
				8.77
			],
			[
				23.9,
				.38,
				g + .33,
				7.82
			]
		]) {
			k("teal", t + .1, n + .06, .16, 0, r, o - .1), k("gilt", t + .12, .035, .17, 0, r - n / 2 - .04, o - .09), k("gilt", t + .12, .035, .17, 0, r + n / 2 + .04, o - .09);
			let s = new e.PlaneGeometry(t, n), c = s.getAttribute("uv");
			for (let e = 0; e < c.count; e++) c.setX(e, c.getX(e) * Math.round(t / 3.1));
			s.translate(i, r, a + o), f.push(s);
		}
		let { x: p, z: h } = x, v = (m.d / 2 - 1.35 + .15) / h, b = v + .064, C = st(m).filter((e) => e.z > 0 && e.z === m.d / 2 - .9), w = (m.d / 2 - .9) / h, T = g - 1.33;
		k("darkWood", m.w / p, .94, .63, 0, T, w);
		let E = 9.58 * h, D = dt(C.map((e) => e.x), w * h, E, l);
		D.scale.set(1 / p, 1, 1 / h), D.position.set(i, T, a + w), r.add(D);
		for (let t = 0; t < C.length; t++) {
			let n = C[t].x / p;
			if (t + 1 === C.length) continue;
			let r = (C[t + 1].x - C[t].x) / p, o = n + r / 2, s = new e.PlaneGeometry(r - .21, .69);
			s.translate(i + o, T, a + w + .325), f.push(s);
			let c = new e.PlaneGeometry(r - .21, .69);
			c.rotateY(Math.PI), c.translate(i + o, T, a + w - .319);
			let l = new e.PlaneGeometry(r - .14, .56);
			l.rotateX(Math.PI / 2), l.translate(i + o, T - .473, a + w), f.push(c, l);
			let u = new e.PlaneGeometry(r - .05, .46);
			u.rotateX(Math.PI / 2), u.translate(i + o, g - .929, a + 9.52), k("darkWood", r, .16, .49, o, g - .845, 9.52), f.push(u);
			for (let e of [-.395, .395]) k("teal", r, .075, .075, o, T + e, w + .34);
			k("gilt", .075, .74, .07, n + .09, T, w + .34);
		}
		for (let t of [-1, 1]) {
			let n = new e.PlaneGeometry(25.4 / h, .7), r = n.getAttribute("uv");
			for (let e = 0; e < r.count; e++) r.setX(e, r.getX(e) * 7);
			n.rotateY(t * Math.PI / 2);
			let o = t * (m.w / 2 + .38) / p;
			n.translate(i + o, g - .48, a), f.push(n), k("teal", .14, .82, 25.4 / h, o - t * .085, g - .48, 0);
		}
		let A = new e.Mesh(c(f), d);
		A.name = "hall-exterior-painted-eaves", A.receiveShadow = !0, r.add(A);
		for (let t of [-9.2, 9.2]) {
			let n = u + 3.18, o = v + .037, s = new e.Mesh(new e.CircleGeometry(1.16, 48), S);
			s.name = "hall-exterior-round-window", s.position.set(i + t, n, a + o), r.add(s);
			let c = new e.Mesh(new e.RingGeometry(1.12, 1.25, 48), ee);
			c.position.set(i + t, n, a + o + .066), r.add(c);
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
				k("teal", .042, r, .044, t + e / p, n, o + .041), k("teal", r / p, .045, .042, t, n + e, o + .032);
			}
		}
		let j = (e, t, n, r, i, a, o) => k(e, t / p, n, r / h, i / p, u + a, o / h);
		for (let e of y()) j(e.role === "lacquer" ? "portalWood" : e.role, e.w, e.h, e.d, e.x, e.y, e.z);
		let { halfClear: M, clearHeight: te, wallZ: N, leafDepth: P } = _;
		j("gilt", 2 * M + .84, .044, .674, 0, te + .13, N);
		for (let t of [-1, 1]) {
			for (let e = 0; e < 6; e++) {
				let n = M / 6, r = t * (e + .5) * n, i = te + .795;
				j("teal", .055, .81, .1, r, i, N), j("teal", n - .055, .064, .1, r + t * n / 2, i + .14, N), j("portalWood", .062, .29, .12, r + t * n * .7, i - .005, N), j("teal", n * .31, .057, .11, r + t * n * .55, i - .15, N);
			}
			let n = t * M, r = N - .08 - P / 2;
			for (let o of [-1, 1]) {
				let s = n + t * (o === 1 ? _.leafThickness + .022 : -.022);
				for (let e of [
					.25,
					2.08,
					4.95,
					te - .22
				]) j("darkWood", .045, .14, P - .14, s, e, r);
				for (let e of [-1.62, 1.62]) j("darkWood", .046, te - .2, .13, s, te / 2, r + e);
				for (let t = 0; t < 3; t++) for (let n = 0; n < 5; n++) {
					let o = new e.SphereGeometry(.058, 10, 7).scale(.56 / p, 1, 1 / h);
					o.translate(i + s / p, u + 2.5 + t * .8, a + (r + (n - 2) * .62) / h), O.bronze.push(o);
				}
			}
			let o = N - P + .47;
			j("bronze", .048, .32, .24, n - t * .044, 1.65, o);
			let s = new e.TorusGeometry(.108, .022, 8, 24).rotateY(Math.PI / 2).scale(1 / p, 1, 1 / h);
			s.translate(i + (n - t * .085) / p, u + 1.54, a + o / h), O.bronze.push(s);
		}
		for (let e of [-1, 1]) {
			let t = e * _.flankX / p, n = .96;
			for (let e = 0; e < 4; e++) {
				let r = t + (e - 1.5) * n;
				k("darkWood", n - .012, 5.04, .1, r, u + 2.54, b);
				for (let e of [-.445, .445]) k("lacquer", .072, 5.04, .09, r + e, u + 2.54, b + .063);
				for (let e of [
					.12,
					1.48,
					1.98,
					4.96
				]) k("lacquer", n - .11, .14, .085, r, u + e, b + .066);
				k("lacquer", .66, 1.08, .065, r, u + .81, b + .057), k("lacquer", .67, .28, .063, r, u + 1.73, b + .055);
				for (let e of [
					-.28,
					-.14,
					0,
					.14,
					.28
				]) k("lacquer", .035, 2.83, .04, r + e, u + 3.48, b + .076);
				for (let e = 0; e < 12; e++) k("lacquer", .8, .033, .04, r, u + 2.15 + e * .236, b + .062);
			}
			for (let e of [-2.01, 2.01]) k("lacquer", .17, 5.3, .18, t + e, u + 2.65, b + .016);
			k("lacquer", 4.18, .2, .19, t, u + 5.24, b + .016);
		}
	}
	let b = new e.MeshStandardMaterial({
		name: "hall-worn-cinnabar-lacquer",
		map: n.redLacquer,
		roughness: .51,
		metalness: .02
	}), S = Me(!0);
	S.name = "hall-carved-dark-wood", S.color.set("#aa9381"), S.roughness = .9;
	let C = Ie();
	C.name = "hall-painted-dougong", C.color.set("#8bafa7"), C.roughness = .92;
	let ee = new e.MeshStandardMaterial({
		name: "hall-aged-gilt",
		color: "#b98737",
		metalness: .54,
		roughness: .39,
		emissive: "#2d1907",
		emissiveIntensity: .12
	}), w = new e.MeshStandardMaterial({
		name: "hall-cast-bronze",
		color: "#77603d",
		metalness: .57,
		roughness: .48
	}), T = new e.MeshStandardMaterial({
		name: "hall-portal-cinnabar",
		map: n.redLacquer,
		color: 16777215,
		roughness: .59,
		metalness: .045
	});
	T.onBeforeCompile = (e) => {
		e.fragmentShader = e.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\n      float woodValue=dot(diffuseColor.rgb,vec3(.27,.62,.11));\n      diffuseColor.rgb=vec3(.235,.034,.017)*(.80+.46*sqrt(clamp(woodValue,0.,1.)));\n    ");
	}, T.customProgramCacheKey = () => "hall-portal-painted-timber";
	let E = S.clone();
	E.name = "hall-rubbed-altar-hardwood", E.color.setHex(14794917), E.roughness = .51, E.onBeforeCompile = (e) => {
		e.fragmentShader = e.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\ndiffuseColor.rgb=vec3(.060,.023,.011)+diffuseColor.rgb*.76;");
	}, E.customProgramCacheKey = () => "hall-altar-waxed-hardwood";
	let D = {
		lacquer: b,
		darkWood: S,
		teal: C,
		gilt: ee,
		bronze: w,
		portalWood: T,
		altarTimber: E,
		altarStone: new e.MeshStandardMaterial({
			name: "hall-honed-altar-limestone",
			map: n.altarStone,
			color: 14800573,
			roughness: .77
		})
	}, O = {
		lacquer: [],
		darkWood: [],
		teal: [],
		gilt: [],
		bronze: [],
		portalWood: [],
		altarTimber: [],
		altarStone: []
	}, k = (e, t, n, r, s, c, l) => O[e].push(o(t, n, r, i + s, c, a + l)), A = (e, t, n, r, o, c, l, u = 24) => O[e].push(s(t, n, r, u, i + o, c, a + l));
	v();
	let j = pt(n.altarStone, f - .08, p - .08);
	j.vertexColors = !1;
	let M = new e.Mesh(new e.PlaneGeometry(f - .08, p - .08), j);
	M.name = "hall-stone-floor", M.rotation.x = -Math.PI / 2, M.position.set(i, u + .04, a), M.receiveShadow = !0, r.add(M), k("darkWood", f - .08, .16, p - .08, 0, d + .12, 0), r.add(mt(n.sanctumCraft, n.coffer, n.altarStone, i, a, u, d, f, p));
	for (let [e, t] of et) {
		for (let n of tt) A(n.role, n.rt, n.rb, n.h, e, L.platform.y + 1 + n.y, t, n.segments);
		for (let n = 0; n < 3; n++) {
			let r = d - .44 + n * .16, i = .85 + n * .25;
			k("teal", 2 * i, .16, .58, e, r, t), k("teal", .62, .16, 2 * i, e, r + .07, t), k("gilt", 2 * i, .025, .06, e, r - .09, t + .29);
		}
	}
	let te = new e.MeshStandardMaterial({
		name: "hall-daylit-paper",
		color: "#e4d5b7",
		roughness: 1,
		emissive: "#fff0d0",
		emissiveIntensity: .76,
		side: e.DoubleSide
	}), N = [];
	for (let t of [-1, 1]) for (let n of [
		-3.75,
		0,
		3.75
	]) {
		let r = t * (f / 2 - .22), o = u + 4.18, s = new e.PlaneGeometry(2.7, 5.5);
		s.rotateY(-t * Math.PI / 2), s.translate(i + r, o, a + n), N.push(s);
		for (let e of [-1.39, 1.39]) k("darkWood", .12, 5.7, .13, r - t * .08, o, n + e);
		for (let e of [-2.82, 2.82]) k("darkWood", .12, .14, 2.85, r - t * .08, o + e, n);
		for (let e = -3; e <= 3; e++) k("darkWood", .045, 5.5, .045, r - t * .13, o, n + e * .36);
		for (let e = -6; e <= 6; e++) k("darkWood", .045, .045, 2.7, r - t * .13, o + e * .4, n);
	}
	let P = new e.Mesh(c(N), te);
	P.name = "hall-daylit-lattice-windows", r.add(P);
	for (let e of [-1, 1]) k("darkWood", .18, 1.05, p - .25, e * (f / 2 - .12), u + .57, 0), k("gilt", .035, .035, p - .25, e * (f / 2 - .19), u + 1.12, 0);
	for (let e of at) k(e.name.startsWith("altar-stone-") ? "altarStone" : e.name.startsWith("altar-") ? "altarTimber" : e.role, e.w, e.h, e.d, e.x, u + e.y, e.z);
	k("teal", 18, .8, .42, 0, d - .65, -6.23);
	for (let e of [
		-K.pitch,
		0,
		K.pitch
	]) {
		let t = e === 0, o = ht(n.aureoleArt);
		o.position.set(i + e, u + 5.06, a + K.backZ + .43), r.add(o);
		let s = Lt(e === 0 ? 0 : e < 0 ? 1 : 2, n.giltLeaf, n.chasedDetail, n.centralRobe);
		s.scale.setScalar(K.scale), s.position.set(i + e, u + K.seatY, a + K.statueZ), s.name = t ? "hall-central-buddha" : "hall-flanking-buddha", r.add(s);
	}
	let F = W;
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
		t > 0 && r.rotateY(Math.PI), r.translate(i + t * F.legX, u + F.top - .188, a + F.z + F.legZ + (t > 0 ? .039 : -.039)), O.altarTimber.push(r), k("altarTimber", .08, .14, 2 * F.legZ, t * F.legX, u + F.top - .15, F.z);
		for (let e of [-1, 1]) {
			let n = t * F.legX, r = F.z + e * F.legZ;
			k("altarTimber", .24, .072, .22, n, u + .08, r), k("altarTimber", .215, .045, .204, n, u + F.top - .26, r);
		}
	}
	k("altarTimber", F.w - .06, .036, .041, 0, u + F.top - .065, F.z + F.d / 2);
	let ne = n.carvedAltar.clone();
	ne.wrapS = e.RepeatWrapping, ne.repeat.set(2, 1), ne.needsUpdate = !0;
	let I = new e.Mesh(new e.PlaneGeometry(2 * F.legX - .2, .14), new e.MeshStandardMaterial({
		name: "hall-carved-altar-front",
		map: ne,
		color: 15850691,
		bumpMap: ne,
		bumpScale: .006,
		roughness: .56,
		metalness: .025,
		side: e.DoubleSide
	}));
	I.name = "hall-carved-altar-front", I.position.set(i, u + F.top - .155, a + F.z + F.legZ + .041), r.add(I);
	for (let e of [
		-1.74,
		-.99,
		.99,
		1.74
	]) A("bronze", .095, .13, .054, e, u + F.top + .027, F.z - .06, 20), A("gilt", .075, .051, .091, e, u + F.top + .0995, F.z - .06, 16), A("bronze", .134, .072, .091, e, u + F.top + .1905, F.z - .06, 24);
	for (let e of [
		-K.pitch,
		0,
		K.pitch
	]) {
		let t = K.statueZ + 1.315;
		k("darkWood", 4.66, .052, .072, e, u + .976, t), k("bronze", 4.48, .022, .042, e, u + .927, t + .006), k("darkWood", 4.52, .066, .058, e, u + .674, t);
	}
	let re = zt(w, ee, i + G.x, u, a + G.z);
	re.scale.setScalar(G.scale), re.position.set((i + G.x) * (1 - G.scale), u * (1 - G.scale) + G.baseY, (a + G.z) * (1 - G.scale)), r.add(re);
	for (let t of [
		-K.pitch,
		0,
		K.pitch
	]) {
		let n = new e.SpotLight(t > 0 ? 16771020 : 16768951, t === 0 ? 51 : 46, 13, .59, .83, 2);
		n.name = "hall-statue-wash", n.position.set(i + t - 1.42, u + 7.62, a - 2.32), n.target.position.set(i + t, u + 4.69, a + K.statueZ), t === 0 && (n.position.set(i - 1.58, u + 7.68, a - 2.06), n.target.position.set(i, u + 5.58, a + K.statueZ), n.angle = .615, n.penumbra = .8, n.intensity = 61), t < 0 && (n.position.set(i + t - 1.94, u + 7.84, a - 1.96), n.target.position.set(i + t, u + 5.58, a + K.statueZ), n.angle = .65, n.penumbra = .88, n.intensity = 82), r.add(n, n.target);
	}
	for (let t of Object.keys(O)) {
		if (!O[t].length) continue;
		let n = c(O[t]), i = t === "lacquer" || t === "portalWood" ? l(n, 2.4) : t === "altarStone" ? l(n, 1.36) : t === "darkWood" || t === "teal" || t === "altarTimber" ? l(n, .9) : n;
		(t === "lacquer" || t === "darkWood" || t === "teal") && (qe(i, "wood", u), D[t].vertexColors = !0);
		let a = new e.Mesh(i, D[t]);
		a.name = "hall-structure-" + t, a.receiveShadow = !0, r.add(a);
	}
	let R = new e.Group();
	R.name = "main-hall-expanded-layout";
	let { x: ie, z: ae } = x, oe = (t, n) => {
		let i = new e.Group();
		i.name = `${t.name}-proportion-pivot`, i.position.copy(n), i.scale.set(1 / ie, 1, 1 / ae), t.position.sub(n), r.remove(t), i.add(t), r.add(i);
	};
	for (let t of [...r.children]) (t instanceof e.LOD || t.name === "hall-statue-halo" || t.name === "hall-exterior-round-window" || t instanceof e.Mesh && t.geometry.type === "RingGeometry") && oe(t, t.position.clone());
	oe(re, new e.Vector3(i + G.x, u, a + G.z));
	for (let e of [...r.children]) r.remove(e), R.add(e);
	return R.scale.set(ie, 1, ae), R.position.set(i * (1 - ie), 0, a * (1 - ae)), r.add(R), r.userData.expandedLayout = {
		width: m.w,
		depth: m.d,
		centerZ: a,
		statueProportionsPreserved: !0
	}, r;
}
function zt(t, n, r, i, a) {
	let o = new e.Group();
	o.name = "hall-tripod-incense-burner";
	let s = it.map(([t, n]) => new e.Vector2(t, n)), c = new e.Mesh(new e.LatheGeometry(s, 28), t);
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
var Bt = document.querySelector("#hall-canvas"), Vt = document.querySelector("#hall-status"), Ht = document.querySelector("#hall-metrics"), Ut = document.querySelector("#study-toggle");
if (!Bt || !Vt || !Ht || !Ut) throw Error("Main hall preview controls are missing");
var Wt = new e.WebGLRenderer({
	canvas: Bt,
	antialias: !0,
	powerPreference: "high-performance"
});
Wt.outputColorSpace = e.SRGBColorSpace, Wt.toneMapping = e.ACESFilmicToneMapping, Wt.toneMappingExposure = 1.15, Wt.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
var Gt = new e.Scene();
Gt.background = new e.Color("#9bacae"), Gt.fog = new e.Fog("#9bacae", 45, 100);
var Kt = new e.PerspectiveCamera(72, 1, .06, 120), qt = new t(Kt, Bt);
qt.enableDamping = !0, qt.dampingFactor = .08, qt.minDistance = .5, qt.maxDistance = 70, qt.maxPolarAngle = Math.PI * .94;
var Jt = !1;
function Yt() {
	Jt || (Jt = !0, requestAnimationFrame(() => {
		Jt = !1, qt.update(), Wt.render(Gt, Kt), Ht.textContent = `${Wt.info.render.calls} draw calls · ${Math.round(Wt.info.render.triangles / 1e3)}k triangles`;
	}));
}
qt.addEventListener("change", Yt), Gt.add(new e.HemisphereLight(14280685, 6705468, 1.55));
var Xt = new e.DirectionalLight(16772040, 2.15);
Xt.position.set(-12, 28, 19), Gt.add(Xt);
var Zt = new e.Mesh(new e.PlaneGeometry(68, 110), new e.MeshStandardMaterial({
	color: "#77756d",
	roughness: .96
}));
Zt.rotation.x = -Math.PI / 2, Zt.position.set(-2, L.platform.y - .18, 0), Zt.name = "preview-only-ground", Gt.add(Zt);
var Qt = {
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
function $t(e) {
	let t = Qt[e];
	if (!t) return;
	let n = S(t.position[0] + 2, t.position[2] + 12);
	Kt.position.set(n.x, t.position[1], n.z), Kt.fov = t.fov ?? 72, Kt.updateProjectionMatrix();
	let r = S(t.target[0] + 2, t.target[2] + 12);
	qt.target.set(r.x, t.target[1], r.z), qt.update(), Yt();
	for (let t of document.querySelectorAll("[data-view]")) t.setAttribute("aria-pressed", String(t.dataset.view === e));
}
for (let e of document.querySelectorAll("[data-view]")) e.addEventListener("click", () => $t(e.dataset.view || "front"));
$t("exterior");
function en() {
	let e = Bt.clientWidth, t = Bt.clientHeight;
	Wt.setSize(e, t, !1), Kt.aspect = e / t, Kt.updateProjectionMatrix(), Yt();
}
new ResizeObserver(en).observe(Bt), en();
async function tn() {
	Vt.textContent = "正在载入大殿贴图…", await pe(), Vt.textContent = "正在载入彩绘与佛像…";
	let t = new r();
	t.setDecoderPath(new URL("./vendor/three/examples/jsm/libs/draco/", document.baseURI).href);
	let i = new n().setDRACOLoader(t), a = new e.TextureLoader(), [o, s, c, l, u, d, f, p, m, h, g, _, v] = await Promise.all([
		i.loadAsync(new URL("./assets/lingyin/buddha-clay-scan.glb", document.baseURI).href),
		a.loadAsync(new URL("./assets/lingyin/hall-preview/dragon-coffer.webp", document.baseURI).href),
		a.loadAsync(new URL("./assets/lingyin/hall-preview/painted-beam.webp", document.baseURI).href),
		a.loadAsync(new URL("./assets/lingyin/hall-preview/worn-red-lacquer.webp", document.baseURI).href),
		a.loadAsync(new URL("./assets/lingyin/hall-preview/aged-stone-floor.webp", document.baseURI).href),
		a.loadAsync(new URL("./assets/lingyin/hall-preview/carved-altar.webp", document.baseURI).href),
		a.loadAsync(new URL("./assets/lingyin/hall-preview/red-ceramic-roof.webp", document.baseURI).href),
		a.loadAsync(new URL("./assets/lingyin/hall-preview/sanctum-craft.webp", document.baseURI).href),
		a.loadAsync(new URL("./assets/lingyin/hall-preview/gilt-leaf-finish.webp", document.baseURI).href),
		a.loadAsync(new URL("./assets/lingyin/hall-preview/altar-veined-stone.webp", document.baseURI).href),
		a.loadAsync(new URL("./assets/lingyin/hall-preview/three-buddha-incisions.webp", document.baseURI).href),
		a.loadAsync(new URL("./assets/lingyin/hall-preview/central-robe-normal.png?v=seated-folds-1", document.baseURI).href),
		a.loadAsync(new URL("./assets/lingyin/hall-preview/aureole-scrollwork.webp", document.baseURI).href)
	]);
	t.dispose(), v.colorSpace = e.SRGBColorSpace, v.anisotropy = 8, _.channel = 1, _.anisotropy = 8, m.wrapS = m.wrapT = e.RepeatWrapping, m.anisotropy = 8;
	for (let t of [
		h,
		s,
		c,
		l,
		u,
		d,
		f,
		p
	]) t.colorSpace = e.SRGBColorSpace, t.anisotropy = 8;
	l.wrapS = l.wrapT = e.RepeatWrapping, f.wrapS = f.wrapT = e.RepeatWrapping, f.repeat.set(.2, .2), f.needsUpdate = !0, Vt.textContent = "正在构建三佛殿内空间…";
	let y = new lt({
		onlyMainHall: !0,
		omitMainHallShrine: !0,
		studyHallEave: 11,
		studyFacade: !0
	});
	Gt.add(y.group);
	let b = Rt(y, {
		coffer: s,
		paintedBeam: c,
		redLacquer: l,
		stoneFloor: u,
		carvedAltar: d,
		redRoof: f,
		sanctumCraft: p,
		giltLeaf: m,
		altarStone: h,
		chasedDetail: g,
		centralRobe: _,
		aureoleArt: v
	});
	y.group.add(b);
	let x = null;
	async function S() {
		if (!x) {
			Vt.textContent = "正在载入原版供对照…";
			let t = await a.loadAsync(new URL("./assets/lingyin/lotus-mural.jpg", document.baseURI).href);
			t.colorSpace = e.SRGBColorSpace;
			let n = new e.Group();
			n.name = "main-hall-original-comparison", n.add(new lt({ onlyMainHall: !0 }).group);
			let r = new e.Group();
			r.position.set(-2, L.platform.y + 1.78, -10.85);
			let i = o.scene.clone(!0);
			i.rotation.x = Math.PI / 2, i.scale.setScalar(.027), i.position.set(-1.607, 0, -.413), i.traverse((t) => {
				t instanceof e.Mesh && (t.material = Pe());
			}), r.add(i), n.add(r);
			let s = new e.Mesh(new e.PlaneGeometry(6.5, 4.2), new e.MeshStandardMaterial({
				map: t,
				roughness: .91
			}));
			s.position.set(-2, L.platform.y + 4.1, -11.28), n.add(s);
			let c = new e.PointLight(16765850, 14, 10, 2);
			c.position.set(-5, L.platform.y + 4.7, -6), n.add(c), x = n, Gt.add(n);
		}
		y.group.visible = !1, x.visible = !0, Vt.textContent = "正在查看旧版 · 勾选开关返回重做版", Yt();
	}
	Ut.addEventListener("change", () => {
		Ut.checked ? (x && (x.visible = !1), y.group.visible = !0, Vt.textContent = "正在查看三佛殿重做版", Yt()) : S().catch((e) => {
			console.error(e), Vt.textContent = "原版对照载入失败";
		});
	}), Vt.textContent = "三佛殿已载入 · 拖动旋转、滚轮缩放，切换机位检查细节", document.body.classList.add("hall-ready"), Yt();
}
tn().catch((e) => {
	console.error("Main hall preview failed", e), Vt.textContent = `预览载入失败：${e instanceof Error ? e.message : String(e)}`;
});
//#endregion
