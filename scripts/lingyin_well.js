// Geometry adapted from the local temple-dusk-diorama old well. Placement and
// collision dimensions live in lingyin_well_layout.js; no lighting is added.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LINGYIN_WELL } from './lingyin_well_layout.js?v=1';
function mesh(geometry, material, x = 0, y = 0, z = 0, opts = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = opts.castShadow ?? true;
  m.receiveShadow = opts.receiveShadow ?? true;
  if (opts.name) m.name = opts.name;
  if (opts.rotation) m.rotation.set(...opts.rotation);
  if (opts.scale) m.scale.set(...opts.scale);
  if (opts.noMerge) m.userData.noMerge = true;
  if (opts.renderOrder !== undefined) m.renderOrder = opts.renderOrder;
  return m;
}

function box(w, h, d, material, x = 0, y = 0, z = 0, opts = {}) {
  return mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z, opts);
}

function cylinder(radiusTop, radiusBottom, height, material, x = 0, y = 0, z = 0, segments = 16, opts = {}) {
  return mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material, x, y, z, opts);
}

function sphere(radius, material, x = 0, y = 0, z = 0, widthSegments = 16, heightSegments = 12, opts = {}) {
  return mesh(new THREE.SphereGeometry(radius, widthSegments, heightSegments), material, x, y, z, opts);
}

function group(name = '') {
  const g = new THREE.Group();
  g.name = name;
  return g;
}

function easeOut(t) {
  return 1 - Math.pow(1 - t, 2);
}

function buildSlopeGeometry({ halfWidth, ridgeFrac, depth, rise, lift, side, isEnd = false, widthSegments = 16, depthSegments = 10 }) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let iy = 0; iy <= depthSegments; iy += 1) {
    const v = iy / depthSegments;
    for (let ix = 0; ix <= widthSegments; ix += 1) {
      const u = ix / widthSegments;
      let x;
      let y;
      let z;
      if (isEnd) {
        const a = u * 2 - 1;
        x = side * (halfWidth * ridgeFrac + (halfWidth - halfWidth * ridgeFrac) * v);
        z = a * depth * v;
        const corner = Math.pow(Math.abs(a), 5.0) * Math.pow(v, 2.8) * lift;
        y = rise * Math.pow(1 - v, 1.5) + corner;
        x += side * Math.pow(Math.abs(a), 6) * Math.pow(v, 3) * 0.12;
      } else {
        const a = u * 2 - 1;
        const eaveX = a * halfWidth;
        const ridgeX = a * halfWidth * ridgeFrac;
        const blend = easeOut(v);
        x = THREE.MathUtils.lerp(ridgeX, eaveX, blend);
        z = side * depth * v;
        const corner = Math.pow(Math.abs(a), 4.4) * Math.pow(v, 2.6) * lift;
        y = rise * Math.pow(1 - v, 1.5) + corner;
        x += Math.sign(a) * Math.pow(Math.abs(a), 6) * Math.pow(v, 3) * 0.16;
      }
      positions.push(x, y, z);
      uvs.push(u * (halfWidth * 2) / 3.6, v * depth / 3.4);
    }
  }
  for (let iy = 0; iy < depthSegments; iy += 1) {
    for (let ix = 0; ix < widthSegments; ix += 1) {
      const a = iy * (widthSegments + 1) + ix;
      const b = a + 1;
      const c = a + widthSegments + 1;
      const d = c + 1;
      if (isEnd) indices.push(a, c, b, b, c, d);
      else indices.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function eavePoints({ halfWidth, depth, lift, side, count = 24 }) {
  const pts = [];
  for (let i = 0; i < count; i += 1) {
    const u = i / (count - 1);
    const a = u * 2 - 1;
    const corner = Math.pow(Math.abs(a), 4.4) * lift;
    pts.push(new THREE.Vector3(a * halfWidth + Math.sign(a) * Math.pow(Math.abs(a), 6) * 0.16, corner + 0.02, side * depth));
  }
  return pts;
}

function sideEavePoints({ halfWidth, depth, lift, side, count = 20 }) {
  const pts = [];
  for (let i = 0; i < count; i += 1) {
    const u = i / (count - 1);
    const a = u * 2 - 1;
    const corner = Math.pow(Math.abs(a), 4.0) * lift;
    pts.push(new THREE.Vector3(side * halfWidth + Math.sign(a) * Math.pow(Math.abs(a), 6) * 0.12, corner + 0.02, a * depth));
  }
  return pts;
}

function createRoof(materials, {
  width = 8,
  depth = 5,
  rise = 2.4,
  overhang = 0.8,
  lift = 0.42,
  ridgeFrac = 0.56,
  gable = true,
  insetGable = false,
  accent = true,
} = {}) {
  const root = group('curved-roof');
  const halfWidth = width / 2 + overhang;
  const halfDepth = depth / 2 + overhang;
  const geoOpts = { halfWidth, ridgeFrac, depth: halfDepth, rise, lift };
  for (const [side, isEnd] of [[1, false], [-1, false], [-1, true], [1, true]]) {
    const m = mesh(buildSlopeGeometry({ ...geoOpts, side, isEnd }), materials.roof);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
  }

  const curveFront = new THREE.CatmullRomCurve3(eavePoints({ halfWidth, depth: halfDepth, lift, side: 1 }));
  const curveBack = new THREE.CatmullRomCurve3(eavePoints({ halfWidth, depth: halfDepth, lift, side: -1 }));
  const curveLeft = new THREE.CatmullRomCurve3(sideEavePoints({ halfWidth, depth: halfDepth, lift, side: -1 }));
  const curveRight = new THREE.CatmullRomCurve3(sideEavePoints({ halfWidth, depth: halfDepth, lift, side: 1 }));
  for (const curve of [curveFront, curveBack, curveLeft, curveRight]) {
    root.add(mesh(new THREE.TubeGeometry(curve, 26, 0.08, 5, false), materials.roofEdge));
  }

  const capGeo = new THREE.CylinderGeometry(0.055, 0.065, 0.14, 7);
  capGeo.rotateX(Math.PI / 2);
  const capCount = Math.max(10, Math.round(width * 2.1));
  for (let i = 0; i < capCount; i += 1) {
    const u = capCount === 1 ? 0.5 : i / (capCount - 1);
    const a = u * 2 - 1;
    const corner = Math.pow(Math.abs(a), 4.4) * lift;
    const x = a * halfWidth;
    for (const side of [-1, 1]) {
      const cap = mesh(capGeo, materials.roofDark, x, corner + 0.025, side * (halfDepth + 0.045));
      if (side < 0) cap.rotation.y = Math.PI;
      cap.castShadow = false;
      root.add(cap);
    }
  }
  const sideCapCount = Math.max(8, Math.round(depth * 1.6));
  for (let i = 0; i < sideCapCount; i += 1) {
    const u = sideCapCount === 1 ? 0.5 : i / (sideCapCount - 1);
    const a = u * 2 - 1;
    const corner = Math.pow(Math.abs(a), 4.0) * lift;
    const z = a * halfDepth;
    for (const side of [-1, 1]) {
      const cap = mesh(capGeo, materials.roofDark, side * (halfWidth + 0.045), corner + 0.025, z);
      cap.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      cap.castShadow = false;
      root.add(cap);
    }
  }

  const ridgeLen = halfWidth * ridgeFrac * 2 + 0.3;
  const ridge = cylinder(0.15, 0.15, ridgeLen, materials.roofDark, 0, rise + 0.08, 0, 12);
  ridge.rotateZ(Math.PI / 2);
  root.add(ridge);
  const ridge2 = cylinder(0.075, 0.075, ridgeLen + 0.1, materials.roofEdge, 0, rise + 0.22, 0, 9);
  ridge2.rotateZ(Math.PI / 2);
  root.add(ridge2);
  for (const side of [-1, 1]) {
    const cap = cylinder(0.1, 0.13, 0.09, materials.goldSoft, side * (halfWidth * ridgeFrac + 0.16), rise + 0.08, 0, 8);
    cap.rotateZ(Math.PI / 2);
    root.add(cap);
  }
  if (accent) {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        root.add(sphere(0.05, materials.goldSoft, sx * halfWidth, lift + 0.06, sz * halfDepth, 6, 4));
      }
    }
  }
  if (insetGable) {
    // A small vertical 歇山 gable sits over the lower hip, giving the roof its
    // characteristic broken silhouette without adding heavy ornament.
    const gw = Math.min(halfDepth * 0.43, 1.7);
    const gh = rise * 0.23;
    const gx = halfWidth * 0.73;
    const yBase = rise * 0.62;
    const shape = new THREE.Shape();
    shape.moveTo(-gw, 0);
    shape.lineTo(gw, 0);
    shape.lineTo(0, gh);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: false });
    for (const side of [-1, 1]) {
      const panel = mesh(geo, materials.creamShade, side * gx, yBase, 0);
      panel.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      root.add(panel);
      const faceX = side * (gx + 0.06);
      for (const z of [-gw, gw]) {
        root.add(makeBeamBetween(
          new THREE.Vector3(faceX, yBase, z),
          new THREE.Vector3(faceX, yBase + gh, 0),
          0.055, materials.woodDark, 5,
        ));
      }
      root.add(makeBeamBetween(
        new THREE.Vector3(faceX, yBase, -gw),
        new THREE.Vector3(faceX, yBase, gw),
        0.05, materials.woodDark, 5,
      ));
      // louvered vent inside the gable
      for (let i = 1; i <= 3; i += 1) {
        const yy = yBase + gh * (i / 4);
        const ww = gw * (1 - i / 4.2);
        root.add(box(side * 0.04, 0.035, ww * 2, materials.woodDark, faceX + side * 0.01, yy, 0));
      }
      root.add(sphere(0.055, materials.goldSoft, faceX, yBase + gh, 0, 6, 4));
    }
  }

  root.userData.dimensions = { width, depth, rise, halfWidth, halfDepth };
  return root;
}


export function createLingyinWell(world, stoneFallback) {
 const find=(name)=>{let material;world.traverse(o=>{if(!material&&o.isMesh){const list=Array.isArray(o.material)?o.material:[o.material];material=list.find(m=>m?.name===name)}});return material};
 const copy=(source,fallback)=>{const m=(source||fallback).clone();m.vertexColors=false;return m};
 const stone=copy(find('stone-photogrammetry'),stoneFallback);
 const roof=copy(find('roof-tile-photogrammetry'),stoneFallback);
 const wood=copy(find('aged-wood')||find('wood-dark'),stoneFallback);
 const dark=wood.clone();dark.color.multiplyScalar(.58);
 const water=new THREE.MeshStandardMaterial({color:0x27372f,roughness:.4,metalness:.05});
 const materials={stone,stoneLight:stone,stoneDamp:stone,lacquerBlack:dark,woodDark:dark,woodMid:wood,water,roof,roofEdge:roof,roofDark:roof,goldSoft:wood};
  const well = group('old-well');

  well.add(cylinder(0.62, 0.72, 0.58, materials.stone, 0, 0.29, 0, 16));
  well.add(mesh(new THREE.TorusGeometry(0.58, 0.09, 6, 16), materials.stoneLight, 0, 0.6, 0).rotateX(Math.PI / 2));
  well.add(cylinder(0.5, 0.5, 0.03, materials.stoneDamp, 0, 0.58, 0, 16));
  well.add(cylinder(0.44, 0.44, 0.03, materials.lacquerBlack, 0, 0.595, 0, 16));
  for (const side of [-1, 1]) {
    well.add(cylinder(0.06, 0.075, 1.3, materials.woodDark, side * 0.58, 1.2, 0, 8));
  }
  well.add(cylinder(0.08, 0.08, 1.15, materials.woodMid, 0, 1.82, 0, 8).rotateZ(Math.PI / 2));
  const wellRoof = createRoof(materials, { width: 1.6, depth: 1.25, rise: 0.48, overhang: 0.26, lift: 0.12, gable: false, accent: false });
  wellRoof.position.y = 1.86;
  well.add(wellRoof);
  // rope and bucket
  well.add(cylinder(0.008, 0.008, 0.72, materials.woodMid, 0, 1.46, 0, 4));
  well.add(cylinder(0.17, 0.13, 0.26, materials.woodMid, 0, 1.02, 0, 10));
  well.add(cylinder(0.145, 0.145, 0.02, materials.water, 0, 1.13, 0, 10));

 well.name='lingyin-old-well';
 well.updateMatrixWorld(true);
 const buckets=new Map();
 well.traverse(o=>{if(!o.isMesh)return;let geo=o.geometry.clone();geo.applyMatrix4(o.matrixWorld);if(geo.index)geo=geo.toNonIndexed();for(const k of Object.keys(geo.attributes))if(!['position','normal','uv'].includes(k))geo.deleteAttribute(k);if(!geo.attributes.uv)geo.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));if(!geo.attributes.normal)geo.computeVertexNormals();if(!buckets.has(o.material))buckets.set(o.material,[]);buckets.get(o.material).push(geo)});
 const result=new THREE.Group();result.name='lingyin-old-well';
 for(const [material,geometries] of buckets){const combined=mergeGeometries(geometries,false);if(!combined)throw new Error('Failed to merge well geometry');const m=new THREE.Mesh(combined,material);m.castShadow=false;m.receiveShadow=true;result.add(m);geometries.forEach(g=>g.dispose())}
 result.position.set(LINGYIN_WELL.x,0,LINGYIN_WELL.z);return result;
}
