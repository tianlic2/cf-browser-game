import * as THREE from 'three';

// Inward-facing runs of skinned steel on the upper tiers of this BSP. A run
// spans several brush cells, but is one container with one set of markings.
const upperRuns=[
  [-11.52,-21.53,-12.02,3.05,6.07,0x98acaf],
  [-11.52,17.01,26.52,3.05,6.10,0xb78368],
  [-11.52,-19.94,-10.43,6.07,9.12,0xad7362],
  [-11.52,-5.68,3.83,6.17,9.02,0x79959a],
  [11.74,3.80,10.14,3.05,6.10,0x839689],
  [11.74,-2.54,6.97,6.17,9.02,0xabb1a6],
  [11.74,11.20,20.71,6.12,9.17,0x738d9d],
];

// Footprints of the six continuous lower-tier steel loads, measured on the
// imported brush faces. Paint travels around each unit onto its actual doors.
const workingContainers = [
  { x0:-14.68, x1:-11.51, z0:-24.70, z1:-15.19, color:0x728a94 },
  { x0:-14.68, x1:-11.51, z0:26.55, z1:36.06, color:0x70958b },
  { x0:11.73, x1:14.90, z0:-37.37, z1:-27.87, color:0xa6aba2 },
  { x0:11.73, x1:14.90, z0:-8.85, z1:-2.54, color:0x7a8a90 },
  { x0:-2.00, x1:7.51, z0:-28.66, z1:-25.49, color:0x668884 },
  { x0:-4.94, x1:4.57, z0:-18.36, z1:-15.19, color:0xad7662 },
];
const rows = upperRuns.length + workingContainers.length;

function lowerUnit(x, y, z) {
  if (y < -.03 || y > 3.075) return -1;
  return workingContainers.findIndex(b =>
    x >= b.x0-.045 && x <= b.x1+.045 && z >= b.z0-.045 && z <= b.z1+.045);
}

function paintBytes(color, base) {
  const c = new THREE.Color(color);
  return ['r','g','b'].map(k => Math.min(255, Math.round(64*c[k]/base[k])));
}

function markingsAtlas() {
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=160*rows;
  const ctx=canvas.getContext('2d');
  for (let index=0;index<rows;index++) {
    const y=index*160;
    ctx.save();ctx.translate(0,y);ctx.scale(1,160/256);
    // White paint lies on folded steel, with missed spots at corrugations.
    const fleet=index%3;
    ctx.fillStyle=['#d9ccb1','#d7cbb0','#b8c5c1'][fleet];
    // Keep several nearer boxes as plain working containers with a small
    // operator stencil. Others have the full owner's mark on the paint.
    ctx.save();
    if(index>=upperRuns.length && index%3!==0) {
      ctx.translate(28,24);
      ctx.scale(.55,.55);
    }
    // Each fleet carries its own silhouette, legible even on the far tier.
    if(fleet===0){
      for(let n=0;n<3;n++){
        const x=51+n*22;
        ctx.beginPath();ctx.moveTo(x,126);ctx.lineTo(x+29,62);ctx.lineTo(x+44,62);ctx.lineTo(x+15,126);ctx.fill();
      }
    }else if(fleet===1){
      ctx.beginPath();ctx.moveTo(51,125);ctx.lineTo(93,57);ctx.lineTo(139,125);ctx.lineTo(120,125);
      ctx.lineTo(93,86);ctx.lineTo(70,125);ctx.fill();
    }else{
      for(let n=0;n<3;n++){
        ctx.beginPath();ctx.moveTo(54,75+17*n);ctx.quadraticCurveTo(78,55+17*n,96,75+17*n);
        ctx.quadraticCurveTo(115,86+17*n,143,67+17*n);ctx.lineWidth=7;ctx.strokeStyle=ctx.fillStyle;ctx.stroke();
      }
    }
    ctx.font='bold 62px sans-serif';ctx.fillText(['SEAWAY','NORTH PORT','ATLANTIC'][fleet],155,120);
    ctx.fillRect(157,133,174,4);
    ctx.font='bold 17px monospace';ctx.fillText('INTERMODAL',157,160);
    ctx.restore();
    // Door serials are part of the original paint. Use handling instructions
    // here so a new side label cannot contradict the number on the doors.
    ctx.font='bold 16px monospace';ctx.fillText('TOP LIFT ONLY',752,48);
    ctx.font='13px monospace';ctx.fillText('USE FOUR LUGS',753,69);
    ctx.fillStyle='#d3ad63';
    for(const x of [22,967])for(let i=0;i<3;i++){
      ctx.beginPath();ctx.moveTo(x+i*8,10);ctx.lineTo(x+5+i*8,10);
      ctx.lineTo(x+11+i*8,23);ctx.lineTo(x+6+i*8,23);ctx.fill();
    }
    if(index>=upperRuns.length) {
      // One plate per sheeted side, independent of the three source UV tiles.
      ctx.fillStyle='#636d6c';ctx.fillRect(847,201,59,29);
      ctx.fillStyle='#a9b1a8';ctx.fillRect(849,203,55,25);
      ctx.fillStyle='#394446';ctx.font='bold 7px monospace';
      ctx.fillText('CSC SAFETY',852,214);ctx.fillText('APPROVED',852,223);
    }
    let seed=index+33;
    const random=()=>((seed=Math.imul(1664525,seed)+1013904223|0)>>>0)/4294967296;
    for(let i=0;i<1300;i++)ctx.clearRect(random()*1024,random()*256,random()*6+1,random()*2+.4);
    ctx.restore();
  }
  const map=new THREE.CanvasTexture(canvas);
  map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;
  return map;
}

export function paintTransportStacks(mesh) {
  const geometry=mesh.geometry,position=geometry.attributes.position;
  const marks=new Float32Array(position.count*2);
  const colors=new Uint8Array(position.count*3);
  // Normalized bytes store a 0..4 linear paint multiplier. Neutral vertices
  // use 64 and the unused atlas coordinate points to a clear padding texel.
  colors.fill(64);
  const blue=new THREE.Color(0x586f7c);
  const tints=[...upperRuns.map(run=>run[5]),...workingContainers.map(box=>box.color)]
    .map(color=>paintBytes(color,blue));
  for(let i=0;i<position.count;i+=3) {
    let cx=0,y=0,z=0;
    for(let j=i;j<i+3;j++){cx-=position.getX(j)/3;y+=position.getY(j)/3;z+=position.getZ(j)/3;}
    let index=upperRuns.findIndex(([x,z0,z1,y0,y1])=>
      Math.abs(cx-x)<.06 && z>z0-.01 && z<z1+.01 && y>y0+.008 && y<y1-.008);
    let alongX=false, reverse=false, start, length, floor, height;
    if(index>=0) {
      const [x,z0,z1,y0,y1]=upperRuns[index];
      start=z0;length=z1-z0;floor=y0;height=y1-y0;reverse=x<0;
    } else {
      const unit=lowerUnit(cx,y,z);
      if(unit<0)continue;
      const b=workingContainers[unit];
      index=upperRuns.length+unit;
      for(let j=i;j<i+3;j++)colors.set(tints[index],3*j);
      alongX=b.x1-b.x0>b.z1-b.z0;
      const near=alongX?Math.abs(z-b.z0)<.055:Math.abs(cx-b.x0)<.055;
      const far=alongX?Math.abs(z-b.z1)<.055:Math.abs(cx-b.x1)<.055;
      if(!near&&!far)continue;
      reverse=alongX?near:far;
      start=alongX?b.x0:b.z0;length=alongX?b.x1-b.x0:b.z1-b.z0;
      floor=.025;height=3.03;
    }
    for(let j=i;j<i+3;j++) {
      const s=((alongX?-position.getX(j):position.getZ(j))-start)/length;
      const v=THREE.MathUtils.clamp((position.getY(j)-floor)/height,.002,.998);
      marks.set([reverse?1-s:s,(rows-index-1+v)/rows],2*j);
      colors.set(tints[index],3*j);
    }
  }
  for(const map of [mesh.material.map,mesh.material.normalMap,mesh.material.roughnessMap])
    map.repeat.set(1/3,1);
  geometry.setAttribute('stackMark',new THREE.BufferAttribute(marks,2));
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3,true));
  mesh.material.vertexColors=true;
  const atlas=markingsAtlas();
  const original=mesh.material.onBeforeCompile;
  const oldKey=mesh.material.customProgramCacheKey();
  mesh.material.onBeforeCompile=shader=>{
    original(shader);
    shader.uniforms.uStackMarkings={value:atlas};
    shader.vertexShader='attribute vec2 stackMark; varying vec2 vStackMark;\n'+shader.vertexShader.replace(
      '#include <begin_vertex>','#include <begin_vertex>\nvStackMark=stackMark;');
    shader.fragmentShader='uniform sampler2D uStackMarkings; varying vec2 vStackMark;\n'+shader.fragmentShader.replace(
      '#include <color_fragment>',`#include <color_fragment>
      diffuseColor.rgb*=255.0/64.0;
      vec4 paint=texture2D(uStackMarkings,vStackMark);
      diffuseColor.rgb=mix(diffuseColor.rgb,paint.rgb,paint.a*.78);`).replace(
      '#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      diffuseColor.rgb=mix(diffuseColor.rgb,sampledDiffuseColor.rgb,texelRoughness.r);`).replace(
      '#include <metalnessmap_fragment>',`#include <metalnessmap_fragment>
      metalnessFactor=mix(.016,.78,texelRoughness.b);`).replace(
      '#include <aomap_fragment>',`#include <aomap_fragment>
      // The BSP lightmap was baked when these walls were perfectly flat. The
      // recessed channels see less sky than the crowns of the pressed sheet.
      // Use the same 16 folds per source tile as the actual formed geometry.
      {
      float phase=abs(fract(vMapUv.x*48.+.5)-.5)*2.;
      float border=min(fract(vMapUv.y),1.-fract(vMapUv.y));
      float side=1.-smoothstep(.45,.75,abs(inverseTransformDirection(nonPerturbedNormal,viewMatrix).y));
      float band=side*smoothstep(.01,.025,border)*(1.-smoothstep(.20,.55,fwidth(vMapUv.x*48.)));
      float valley=smoothstep(.16,.70,phase);
      float foldAccess=1.-.32*valley*band;
      reflectedLight.indirectDiffuse*=foldAccess;
      reflectedLight.indirectSpecular*=mix(1.,foldAccess,.7);
      }`);
  };
  mesh.material.customProgramCacheKey=()=>oldKey+'-stack-lettering-freight-steel';
}

export function matchTransportDoorPaint(mesh) {
  const position=mesh.geometry.getAttribute('position');
  const colors=new Uint8Array(position.count*3).fill(64);
  const base=new THREE.Color(0x687778);
  const tints=workingContainers.map(box=>paintBytes(box.color,base));
  for(let i=0;i<position.count;i+=3) {
    let x=0,y=0,z=0;
    for(let j=i;j<i+3;j++){x-=position.getX(j)/3;y+=position.getY(j)/3;z+=position.getZ(j)/3;}
    const unit=lowerUnit(x,y,z);
    if(unit>=0)for(let j=i;j<i+3;j++)colors.set(tints[unit],3*j);
  }
  mesh.geometry.setAttribute('color',new THREE.BufferAttribute(colors,3,true));
  const mat=mesh.material, compile=mat.onBeforeCompile, key=mat.customProgramCacheKey();
  mat.vertexColors=true;
  mat.onBeforeCompile=function(shader,renderer) {
    compile.call(this,shader,renderer);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
      // Keep inspection plates and white door stencils their original shade.
      float coating=1.-smoothstep(.32,.56,sampledDiffuseColor.g);
      diffuseColor.rgb*=mix(vec3(1.),vColor*(255./64.),coating);`);
  };
  mat.customProgramCacheKey=()=>key+'-matching-freight-doors';
}

// Combine only complete, contiguous rows of original brushes. The hull and
// projectile geometry retain their original parts; only freight hardware uses
// this list to place corner castings at the actual ends of the steel unit.
export function containerFrameEnvelopes(modules) {
  const claimed=new Set(), frames=[];
  const raised=upperRuns.map(([x,z0,z1,y0,y1])=>{
    const outside=x+Math.sign(x)*3.17;
    return {x0:Math.min(x,outside),x1:Math.max(x,outside),z0,z1,y0,y1};
  });
  for(const b of [...workingContainers,...raised]) {
    const alongX=b.x1-b.x0>b.z1-b.z0;
    const centre=alongX?'x':'z', half=alongX?'hx':'hz';
    const start=alongX?b.x0:b.z0,end=alongX?b.x1:b.z1;
    const matches=modules.filter(c=>!claimed.has(c) && Math.abs(c.y0-(b.y0??.025))<.12 &&
      c.x-c.hx>b.x0-.09 && c.x+c.hx<b.x1+.09 && c.z-c.hz>b.z0-.09 && c.z+c.hz<b.z1+.09
    ).sort((a,b)=>a[centre]-b[centre]);
    if(matches.length<2)continue;
    const first=matches[0],last=matches.at(-1);
    if(Math.abs(first[centre]-first[half]-start)>.09 || Math.abs(last[centre]+last[half]-end)>.09)continue;
    if(matches.some((c,i)=>Math.abs(c.h-first.h)>.045 || (i>0 && Math.abs(c[centre]-c[half]-
      matches[i-1][centre]-matches[i-1][half])>.06)))continue;
    const x0=Math.min(...matches.map(c=>c.x-c.hx)),x1=Math.max(...matches.map(c=>c.x+c.hx));
    const z0=Math.min(...matches.map(c=>c.z-c.hz)),z1=Math.max(...matches.map(c=>c.z+c.hz));
    frames.push({x:(x0+x1)/2,z:(z0+z1)/2,hx:(x1-x0)/2,hz:(z1-z0)/2,y0:first.y0,h:first.h});
    matches.forEach(c=>claimed.add(c));
  }
  return [...frames,...modules.filter(c=>!claimed.has(c))];
}
