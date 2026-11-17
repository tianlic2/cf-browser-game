import * as THREE from 'three';
import { createVentFans } from './transport_motion.js';

// World-space centres of the four clear openings in the ship's two bulkheads.
// On each end one sliding leaf already covers part of its opening.
const exits = [
  { x: -4.91, z: 36.60, halfWidth: 1.32, sign: '01' },
  { x: 6.88, z: 36.60, halfWidth: 1.68, sign: '02' },
  { x: 5.13, z: -37.91, halfWidth: 1.32, sign: '03' },
  { x: -6.66, z: -37.91, halfWidth: 1.68, sign: '04' },
];

function instancedParts(name, geometry, material, parts) {
  const mesh = new THREE.InstancedMesh(geometry, material, parts.length);
  mesh.name = name;
  for (const [i, part] of parts.entries()) {
    mesh.setMatrixAt(i, part.matrix);
    if (part.color) mesh.setColorAt(i, part.color);
  }
  mesh.computeBoundingSphere();
  mesh.receiveShadow = true;
  return mesh;
}

function addBox(parts, x, y, z, width, height, depth, yaw, angle, color) {
  const transform = new THREE.Object3D();
  transform.position.set(x, y, z);
  transform.rotation.set(0, yaw, angle, 'YXZ');
  transform.scale.set(width, height, depth);
  transform.updateMatrix();
  parts.push({ matrix: transform.matrix, color: new THREE.Color(color) });
}

function timberBatten() {
  // Local X follows the grain. Both eased shoulders are cut inside the old
  // batten envelope. The hidden back sits just below the case panel.
  const section=[[-.50,-.32],[-.40,.46],[0,.50],[.40,.46],[.50,-.32]];
  const positions=[],normals=[],uv=[],colors=[],indices=[];
  function vertex(x,point,normal,worn){
    const [y,z]=section[point];
    positions.push(x,y,z);
    normals.push(...normal);
    uv.push(.311+(.5-y)*.035,.12+(x+.5)*.73);
    colors.push(1+worn,1+.84*worn,1+.61*worn);
  }
  for(let i=0;i<section.length-1;i++){
    for(const [x,point] of [[-.5,i],[-.5,i+1],[.5,i],[.5,i+1]]){
      const n=new THREE.Vector3(0,[-8,-1.85,0,1.85,8][point],1).normalize();
      vertex(x,point,n.toArray(),[0,.38,.025,.38,0][point]);
    }
    const j=i*4;
    indices.push(j,j+2,j+1,j+2,j+3,j+1);
  }
  for(const side of [-1,1]){
    const j=positions.length/3;
    for(let i=0;i<section.length;i++)vertex(side*.5,i,[side,0,0],-.06);
    for(let i=1;i<section.length-1;i++){
      if(side<0)indices.push(j,j+i,j+i+1);
      else indices.push(j,j+i+1,j+i);
    }
  }
  const shape=new THREE.BufferGeometry();
  for(const [key,values,size] of [['position',positions,3],['normal',normals,3],['uv',uv,2],['color',colors,3]])
    shape.setAttribute(key,new THREE.Float32BufferAttribute(values,size));
  shape.setIndex(indices);
  return shape;
}

function battenContacts(parts){
  // A centimetre of occluded ambient light fades onto the receiving board.
  // Leave its grain visible. Only the solid wood participates in hit queries.
  const vertices=[],colors=[],indices=[];
  for(const sign of [-1,1]){
    const j=vertices.length/3;
    for(const [x,d,alpha] of [[-.5,.49,.38],[.5,.49,.38],[-.5,.605,0],[.5,.605,0]]){
      vertices.push(x,sign*d,-.14);colors.push(0,0,0,alpha);
    }
    if(sign>0)indices.push(j,j+1,j+2,j+1,j+3,j+2);
    else indices.push(j,j+2,j+1,j+1,j+2,j+3);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));
  geo.setIndex(indices);
  const material=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,
    toneMapped:false,fog:false});
  return instancedParts('transport-batten-contact',geo,material,parts);
}

function crateBracing(colliders, pine) {
  const parts = [];
  const wood = new THREE.MeshStandardMaterial({
    map:pine.map, normalMap:pine.normalMap, normalScale:new THREE.Vector2(.57,.57),
    roughnessMap:pine.roughnessMap, roughness:1, envMapIntensity:pine.envMapIntensity,vertexColors:true,
  });
  for (const c of colliders) {
    const painted = c.textures.includes('transportship/texture_80');
    if (!(painted || c.textures.includes('transportship/texture_234')) ||
        !c.roundedFootprint || Math.min(c.hx, c.hz) < .45 || c.h - c.y0 < .85) continue;
    const tone = painted ? 0xa1b0a3 : 0xf0e7d8;
    // Alternate joinery across the working deck. All battens lie against
    // the original case faces, including on stacked and walkable cases.
    const pattern=Math.abs(Math.round(c.x*11)+Math.round(c.z*7))%4;
    const height = c.h - c.y0;
    const mid = (c.y0 + c.h) / 2;
    for (let side = 0; side < 4; side++) {
      const yaw = side * Math.PI / 2;
      const nx = Math.sin(yaw), nz = Math.cos(yaw);
      const radius = side % 2 ? c.hx : c.hz;
      const width = 2 * (side % 2 ? c.hz : c.hx);
      const x = c.x + nx * (radius + .006), z = c.z + nz * (radius + .006);
      const rail = .115;
      for (const y of [c.y0 + .11, c.h - .11])
        addBox(parts, x, y, z, width - .035, rail, .027, yaw, 0, tone);
      const run = width - .24, rise = height - .34;
      const flip = (side + Math.floor(c.x + c.z)) % 2 === 0 ? 1 : -1;
      if (pattern===0 || pattern===3) {
        addBox(parts,x,mid,z,Math.hypot(run,rise),rail,.025,yaw,flip*Math.atan2(rise,run),tone);
      } else if(pattern===1) {
        for(const u of [-.29,.29])
          addBox(parts,x+Math.cos(yaw)*u*run,mid,z-Math.sin(yaw)*u*run,
            rise,.14,.029,yaw,Math.PI/2,tone);
      } else {
        // Two short battens meet in a chevron to brace a heavier panel.
        for(const sign of [-1,1])
          addBox(parts,x+Math.cos(yaw)*sign*run/4,mid,z-Math.sin(yaw)*sign*run/4,
            Math.hypot(run/2,rise),rail,.029,yaw,sign*flip*Math.atan2(rise,run/2),tone);
      }
    }
  }
  const braces=instancedParts('transport-timber-braces',timberBatten(),wood,parts);
  braces.add(battenContacts(parts));
  return braces;
}

function exitSign(number) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#364843'; ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#afb4a0'; ctx.lineWidth = 3; ctx.strokeRect(6, 6, 500, 116);
  ctx.fillStyle = '#ddd9c4';
  ctx.font = 'bold 78px sans-serif'; ctx.fillText('DECK', 28, 95);
  ctx.fillStyle = '#d9ba74';
  ctx.font = 'bold 82px monospace'; ctx.fillText(number, 354, 94);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return map;
}

// Stencilled compartment IDs are applied directly to the inboard wall.
function compartmentMark(facing) {
  const canvas=document.createElement('canvas');
  canvas.width=768;canvas.height=384;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#344947';
  ctx.font='bold 44px sans-serif';
  ctx.fillText('TWEEN DECK',19,62);
  ctx.fillRect(20,83,620,7);
  ctx.font='bold 184px sans-serif';
  ctx.fillText(facing>0?'A–01':'B–04',9,249);
  ctx.fillStyle='#9d743a';
  ctx.fillRect(21,277,58,25);
  ctx.fillStyle='#344947';
  ctx.font='bold 31px monospace';
  ctx.fillText('CARGO ACCESS',96,300);
  for(const x of [69,193,350])ctx.clearRect(x,125,5,126);
  let seed=279;
  const random=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  for(let i=0;i<3500;i++)ctx.clearRect(random()*canvas.width,random()*canvas.height,1+random()*5,1+random()*3);
  const ink=new THREE.CanvasTexture(canvas);
  ink.colorSpace=THREE.SRGBColorSpace;
  ink.anisotropy=8;
  const material=new THREE.MeshStandardMaterial({map:ink,alphaTest:.45,roughness:.92});
  return new THREE.Mesh(new THREE.PlaneGeometry(2.18,1.09),material);
}

export function createTransportOutfitting(colliders, pine) {
  const group = new THREE.Group();
  group.name = 'transport-outfitting';
  group.add(crateBracing(colliders, pine));
  const steel = [], glass = [], fanMounts = [];
  const box = new THREE.BoxGeometry(1, 1, 1);
  const signFace = new THREE.PlaneGeometry(.87, .218);
  for (const exit of exits) {
    const { x, z, halfWidth, sign } = exit;
    const facing = Math.sign(z), yaw = facing > 0 ? 0 : Math.PI;
    const mount = (parts, u, y, inset, w, h, d, color) =>
      addBox(parts, x + facing*u, y, z + facing*inset, w, h, d, yaw, 0, color);
    // Welded trim hugs the solid jambs. The threshold stays clear.
    for (const edge of [-1, 1]) {
      mount(steel, edge*(halfWidth+.052), 1.47, .014, .085, 2.75, .046, 0x58625c);
      mount(steel, edge*(halfWidth+.10), .35, .028, .16, .48, .05, 0x787663);
    }
    mount(steel, 0, 2.89, .018, halfWidth*2+.19, .08, .06, 0x56615b);
    // A compact caged strip light next to the enamel identification plate.
    mount(steel, -.48, 3.044, .051, .86, .177, .105, 0x444c49);
    mount(glass, -.48, 3.045, .112, .71, .085, .039, 0xffdfa9);
    for (const u of [-.77, -.56, -.37, -.19])
      mount(steel, u, 3.045, .139, .014, .123, .015, 0x77796d);
    mount(steel, .51, 3.047, .036, .93, .252, .07, 0x454941);
    const plate = new THREE.Mesh(signFace, new THREE.MeshStandardMaterial({
      map: exitSign(sign), roughness: .78, envMapIntensity: .25,
    }));
    plate.rotation.y = yaw;
    plate.position.set(x + facing*.51, 3.047, z + facing*.074);
    group.add(plate);
  }
  // Vent trunks and clipped conduits run on the fixed wall sections inside
  // each cabin. The sliding leaves and all four exit openings remain free.
  for (const facing of [1, -1]) {
    const wallZ = facing > 0 ? 36.60 : -37.91;
    const yaw = facing > 0 ? 0 : Math.PI;
    const marking=compartmentMark(facing);
    marking.position.set(-11.70*facing,1.69,wallZ+facing*.012);
    marking.rotation.y=yaw;
    marking.receiveShadow=true;
    group.add(marking);
    const panel = (u, y, offset, w, h, d, color) =>
      addBox(steel, facing*u, y, wallZ+facing*offset, w, h, d, yaw, 0, color);
    for (const [left, right] of [[-14.7,-8.53],[-3.40,4.82],[8.78,14.7]]) {
      const mid = (left+right)/2;
      for (const y of [2.48,2.58])
        panel(mid,y,.056,right-left,.033,.045,0x858780);
      for (let u=left+.16; u<right; u+=1.1)
        panel(u,2.53,.079,.043,.168,.028,0x555e58);
      const u = left+.92;
      panel(u,2.52,.08,.31,.25,.12,0x6a7168);
      panel(u,2.51,.152,.24,.17,.023,0x8d9082);
    }
    // The louvre opening sits behind raised, overlapping slats. Side flanges
    // and folded lips catch the light even at a shallow angle to the wall.
    for (const u of [-9.45,2.38]) {
      panel(u,1.90,.04,1.20,.67,.085,0x646c65);
      panel(u,1.90,.095,1.10,.56,.03,0x272e2e);
      for(const offset of [-.26,.26])fanMounts.push([facing*(u+offset),wallZ+facing*.123,facing]);
      for (let row=0; row<6; row++) {
        const y=1.68+row*.087;
        panel(u,y,.158,1.04,.054,.044,0x686e68);
        panel(u,y+.023,.181,1.04,.012,.018,0x919387);
      }
      for (const edge of [-1,1]) panel(u+edge*.562,1.90,.109,.031,.585,.048,0x82867d);
    }
  }
  group.add(createVentFans(fanMounts));
  group.add(instancedParts('transport-bulkhead-frames', box, new THREE.MeshStandardMaterial({
    metalness: .32, roughness: .65,
  }), steel));
  group.add(instancedParts('transport-bulkhead-lamps', box, new THREE.MeshStandardMaterial({
    emissive: 0xffdb99, emissiveIntensity: 1.45, roughness: .45,
  }), glass));
  return group;
}

// Diffuse spill is fixed in ship space. Limit it to the interior side of the
// bulkhead so an exterior surface never glows through the steel.
export function addBulkheadLight(shader) {
  shader.uniforms.uExitLamps = { value: exits.map(e =>
    new THREE.Vector3(e.x - Math.sign(e.z)*.48, 3.045, e.z + Math.sign(e.z)*.18)) };
  shader.fragmentShader = 'uniform vec3 uExitLamps[4];\n' + shader.fragmentShader.replace(
    '#include <aomap_fragment>', `#include <aomap_fragment>
    if (abs(vTransportWorld.z) > 35.8) {
      for (int i = 0; i < 4; ++i) {
        vec3 toLamp = uExitLamps[i] - vTransportWorld;
        float inside = smoothstep(-.24, -.11, -toLamp.z * sign(uExitLamps[i].z));
        float radius = dot(toLamp, toLamp);
        float incidence = max(0., dot(normalize(toLamp + vec3(0.,.0001,0.)), -normalize(vTransportNormal)));
        float falloff = (1. - smoothstep(2., 13., radius)) / (.64 + radius);
        // The fixture is inside this compartment. Outdoor sky occlusion
        // must not extinguish its local contribution under the lintel.
        reflectedLight.directDiffuse += diffuseColor.rgb * vec3(1.14,.80,.47)
          * inside * falloff * (.16 + .95 * incidence);
      }
    }`);
}

// Orthographic ambient-occlusion mask for the upper deck. Rasterize the real
// footprints once. An angled cargo brush also exports cardinal bounds, so use
// its diagonal planes to recover the actual face axes.
export function createDeckContactMap(colliders) {
  const canvas = document.createElement('canvas');
  canvas.width = 384; canvas.height = 1152;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const footprints=[];
  for (const c of colliders) {
    if (Math.abs(c.y0) > .09 || c.h < .75 || Math.min(c.hx,c.hz) < .42) continue;
    const oblique = c.planes.filter(([nx,ny,nz]) => Math.abs(ny) < .001 && Math.abs(nx*nz) > .03);
    let yaw = 0, a = c.hx, b = c.hz;
    if (oblique.length) {
      if (oblique.length !== 4) continue;
      const [nx,,nz,d] = oblique[0];
      const cross = oblique.find(([u,,v]) => Math.abs(u*nx+v*nz) < .01);
      if (!cross) continue;
      yaw = Math.atan2(nz,nx);
      a = d - nx*c.x - nz*c.z;
      b = cross[3] - cross[0]*c.x - cross[2]*c.z;
    }
    footprints.push({x:c.x,z:c.z,yaw,a,b,cargo:c.textures.some(t=>/texture_(78|80|83|234)$/.test(t))});
  }
  for (const blur of [6, 2]) {
    ctx.filter = 'blur(' + blur + 'px)';
    ctx.fillStyle = blur === 6 ? '#a5a5a5' : '#686868';
    for(const {x,z,yaw,a,b} of footprints){
      ctx.save();
      ctx.translate(192 + x*12, 576 + z*12);
      ctx.rotate(yaw);
      ctx.fillRect(-12*a,-12*b,24*a,24*b);
      ctx.restore();
    }
  }
  // Pack two world-space wear layers beside the contact channel. Marks are
  // authored in metres and can cross UV islands without repeating per plate.
  const work = document.createElement('canvas');
  const ppm = 24;
  work.width=32*ppm; work.height=96*ppm;
  const paint=work.getContext('2d');
  paint.drawImage(canvas,0,0,work.width,work.height);
  const pixels=paint.getImageData(0,0,work.width,work.height);
  paint.setTransform(ppm,0,0,ppm,work.width/2,work.height/2);
  let seed=317;
  const random=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  function pack(channel) {
    const layer=paint.getImageData(0,0,work.width,work.height).data;
    for(let i=0;i<layer.length;i+=4) pixels.data[i+channel]=layer[i+3];
    paint.clearRect(-16,-48,32,96);
  }
  paint.clearRect(-16,-48,32,96);
  // The loaded trucks turn out of the two hatch areas in paired wheel tracks.
  for (const [x,z,bend,length] of [[7.35,-17,-2.2,9],[-7.9,18,2.6,-11],
    [8.9,-24,-1.3,12],[-6.7,-15,-1.2,8],[5.9,18,2,-8]]) {
    for (const wheel of [-.69,.69]) {
      for(let pass=0;pass<22;pass++) {
        const jitter=(random()-.5)*.26, start=random()*.42, end=.65+random()*.35;
        paint.beginPath();
        for(let i=0;i<=26;i++){
          const t=start+(end-start)*i/26, turn=t*t*(3-2*t);
          const px=x+wheel+jitter+bend*turn;
          const pz=z+length*t;
          if(i===0) paint.moveTo(px,pz); else paint.lineTo(px,pz);
        }
        paint.lineWidth=.035+random()*.075;
        paint.strokeStyle='rgba(0,0,0,.13)'; paint.stroke();
      }
    }
  }
  pack(1);
  // Faded loading-bay numbers and short end bars lie alongside the cargo.
  for(const [x,z,angle,number] of [[8.1,-10.3,0,'04'],[-7.9,12.4,Math.PI,'07'],
    [1.4,-15.2,0,'03'],[-1.5,20.8,Math.PI,'08']]){
    paint.save(); paint.translate(x,z); paint.rotate(angle);
    paint.fillStyle='rgba(255,255,255,.77)';
    paint.font='bold 0.78px monospace'; paint.textAlign='center';
    paint.fillText(number,0,0);
    paint.fillRect(-.59,.11,1.18,.062);
    paint.globalCompositeOperation='destination-out';
    for(let i=0;i<80;i++)paint.fillRect(random()*1.26-.63,random()*.94-.68,.035+random()*.12,.025+random()*.055);
    paint.restore();
  }
  pack(2);

  // Broad, overlapping traffic corridors bend around the diagonal stacks.
  // Vary the width along the walks so they do not read as parallel tyres.
  paint.lineCap='round';
  paint.filter='blur(10px)';
  for(const sign of [-1,1]){
    paint.save();
    paint.scale(sign,sign);
    for(let pass=0;pass<8;pass++){
      const offset=(random()-.5)*1.3;
      paint.strokeStyle='rgba(0,0,0,.25)';
      paint.lineWidth=.52+random()*1.15;
      paint.beginPath();paint.moveTo(6.2+offset,-31);
      paint.bezierCurveTo(6.7+offset,-23,8+offset,-15,6.8+offset,-11);
      paint.bezierCurveTo(6.5+offset,-8,3.65+offset,-6.1,2.4+offset,-1.2);
      paint.bezierCurveTo(1.2+offset,1.5,1.4+offset,5.7,2+offset,9.3);
      paint.stroke();
    }
    paint.restore();
  }
  const walked=paint.getImageData(0,0,work.width,work.height).data;
  paint.clearRect(-16,-48,32,96);
  // Wind-blown grit collects at sheltered feet; nearby crates share one
  // deposit. Soft margins follow the real oblique edges rather than an AABB.
  for(const {x,z,yaw,a,b,cargo} of footprints){
    if(!cargo)continue;
    paint.save();paint.translate(x,z);paint.rotate(yaw);
    paint.filter='blur(3px)';paint.fillStyle='#fff';
    const lee=.12+random()*.16;
    paint.fillRect(-a-.12,-b-.10,a*2+.22,b*2+.10+lee);
    // Soft wedges of settled grit fan out from individual sheltered corners.
    // Use metric lengths so a stack of small boxes does not get huge halos.
    for(const [sx,sz] of [[-1,-1],[1,1]]){
      const width=.14+random()*.18, run=.32+random()*.54;
      paint.save();paint.translate(sx*a,sz*b);paint.scale(sx,sz);
      paint.beginPath();paint.moveTo(-run,-.08);
      paint.quadraticCurveTo(-run*.5,width*.48,-.05,width);
      paint.quadraticCurveTo(width*.8,width*.86,width*.62,.02);
      paint.quadraticCurveTo(width*.24,-run*.50,.04,-run);
      paint.lineTo(-.07,-run);paint.closePath();paint.fill();paint.restore();
    }
    paint.restore();
  }
  // A shallow fan of loose cargo dust extends past the front corner of
  // the receipt crate, far enough for a passing boot to reach it.
  paint.save();
  paint.translate(-.22,-10.72);
  paint.rotate(.18);
  paint.scale(1.03,.62);
  const spill=paint.createRadialGradient(0,0,.04,0,0,1);
  spill.addColorStop(0,'rgba(255,255,255,.87)');
  spill.addColorStop(.48,'rgba(255,255,255,.68)');
  spill.addColorStop(1,'rgba(255,255,255,0)');
  paint.fillStyle=spill;paint.fillRect(-1,-1,2,2);
  paint.restore();
  const dust=paint.getImageData(0,0,work.width,work.height).data;
  for(let i=3;i<pixels.data.length;i+=4){
    const deposit=dust[i]/255;
    pixels.data[i]=128+.49*walked[i]*(1-deposit)-127*deposit;
  }
  // Upload raw channels: canvas premultiplication would erase the RGB
  // values where the independent, signed wear channel approaches zero.
  const mask=new THREE.DataTexture(new Uint8Array(pixels.data.buffer),work.width,work.height);
  mask.flipY=true;
  mask.generateMipmaps=true;
  mask.minFilter=THREE.LinearMipmapLinearFilter;
  mask.magFilter=THREE.LinearFilter;
  mask.needsUpdate=true;
  mask.anisotropy=8;
  mask.name = 'transport-deck-contact';
  return mask;
}

export function deckStencil() {
  const canvas=document.createElement('canvas');
  canvas.width=512;canvas.height=256;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff';
  ctx.font='bold 88px Arial';ctx.fillText('CARGO',40,125);
  ctx.fillRect(42,148,291,5);
  ctx.font='bold 37px monospace';ctx.fillText('TRANSIT',42,194);
  ctx.beginPath();ctx.moveTo(365,166);ctx.lineTo(365,108);ctx.lineTo(340,108);
  ctx.lineTo(384,53);ctx.lineTo(428,108);ctx.lineTo(403,108);ctx.lineTo(403,166);ctx.fill();
  let seed=73;
  const rand=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  for(let i=0;i<1900;i++) ctx.clearRect(rand()*512,rand()*256,1+rand()*6,1+rand()*3);
  const map=new THREE.CanvasTexture(canvas);
  map.anisotropy=8;
  return map;
}
