import * as THREE from 'three';

// Print and hardware positions use the dimensions of each individual case.
// Separate BSP faces on the same case consequently share the same artwork.
function caseAtlas() {
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=1024;
  const ctx=canvas.getContext('2d');
  for(let tile=0;tile<4;tile++){
    ctx.save();
    ctx.translate((tile%2)*512,Math.floor(tile/2)*512);
    let seed=1227+tile;
    const rand=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
    // Offset the markings into the open panel between the battens.
    ctx.fillStyle=tile===2?'#d8cbb0':'#333b39';
    if(tile!==3){
      for(const x of [53,86]){
        ctx.beginPath();ctx.moveTo(x,235);ctx.lineTo(x+10,216);ctx.lineTo(x+20,235);
        ctx.lineTo(x+13,234);ctx.lineTo(x+13,260);ctx.lineTo(x+7,260);ctx.lineTo(x+7,234);ctx.fill();
      }
      ctx.fillRect(51,265,57,4);
    }
    ctx.font='bold 34px monospace';
    ctx.fillText(['P–04','C–18','H–32','R–06'][tile],277,349);
    ctx.font='bold 15px monospace';
    ctx.fillText(['PUMP / SPARES','VALVE BODY','SHIP STORES','RETURN'][tile],278,371);
    for(let i=0;i<3700;i++)ctx.clearRect(rand()*500,180+rand()*208,1+rand()*4,1+rand()*2);
    // Galvanised edge straps extend around the corner on the adjoining face.
    for(const side of [-1,1]){
      ctx.save();ctx.translate(side<0?0:512,0);ctx.scale(side<0?1:-1,1);
      for(const cy of [90,410]){
        const w=tile%2?38:26;
        ctx.beginPath();ctx.moveTo(0,cy-17);ctx.lineTo(w-5,cy-17);
        ctx.lineTo(w,cy-11);ctx.lineTo(w,cy+12);ctx.lineTo(w-5,cy+17);ctx.lineTo(0,cy+17);
        ctx.fillStyle='#5b6059';ctx.fill();ctx.strokeStyle='#40483f';ctx.lineWidth=2;ctx.stroke();
        ctx.fillStyle='#9b9b87';ctx.fillRect(1,cy-16,w-6,2);
        for(let k=0;k<95;k++){
          ctx.fillStyle=rand()<.5?'#716a56':'#87877a';
          ctx.fillRect(2+rand()*(w-5),cy-14+rand()*28,1+rand()*2,1.2);
        }
        ctx.beginPath();ctx.arc(w-10,cy,4.3,0,Math.PI*2);ctx.fillStyle='#353e39';ctx.fill();
        ctx.beginPath();ctx.arc(w-11,cy-1,3,0,Math.PI*2);ctx.fillStyle='#9f9c88';ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }
  const map=new THREE.CanvasTexture(canvas);
  map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;
  return map;
}

export function dressTimberCases(mesh,colliders,atlas) {
  const boxes=colliders.filter(c=>c.roundedFootprint && c.textures.includes(mesh.name) &&
    Math.min(c.hx,c.hz)>.45 && c.h-c.y0>.85);
  const p=mesh.geometry.attributes.position, coords=new Float32Array(2*p.count);
  for(let i=0;i<p.count;i+=3){
    const center=axis=>(p[axis](i)+p[axis](i+1)+p[axis](i+2))/3;
    const x=-center('getX'),y=center('getY'),z=center('getZ');
    if(Math.abs(mesh.geometry.attributes.normal.getY(i))>.25)continue;
    const faceX=Math.abs(mesh.geometry.attributes.normal.getX(i))>.9;
    const box=boxes.find(c=>y>=c.y0-.005 && y<=c.h+.005 &&
      Math.abs(x-c.x)<=c.hx+.015 && Math.abs(z-c.z)<=c.hz+.015 &&
      Math.abs(faceX?Math.abs(x-c.x)-c.hx:Math.abs(z-c.z)-c.hz)<.015);
    if(!box)continue;
    const tile=Math.abs(Math.round(box.x*9+box.z*13))%4;
    for(let j=i;j<i+3;j++){
      const along=faceX?(p.getZ(j)-box.z)*Math.sign(box.x-x)/box.hz:
        (-p.getX(j)-box.x)*Math.sign(z-box.z)/box.hx;
      const u=THREE.MathUtils.clamp(.5+along*.5,.001,.999);
      const v=THREE.MathUtils.clamp((p.getY(j)-box.y0)/(box.h-box.y0),.001,.999);
      coords.set([(tile%2+u)*.5,(1-Math.floor(tile/2)+v)*.5],2*j);
    }
  }
  mesh.geometry.setAttribute('caseUv',new THREE.BufferAttribute(coords,2));
  const material=mesh.material,compile=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=shader=>{
    compile(shader);shader.uniforms.uCaseInk={value:atlas};
    shader.vertexShader='attribute vec2 caseUv; varying vec2 vCaseUv;\n'+shader.vertexShader.replace(
      '#include <begin_vertex>','#include <begin_vertex>\nvCaseUv=caseUv;');
    shader.fragmentShader='uniform sampler2D uCaseInk; varying vec2 vCaseUv;\n'+shader.fragmentShader.replace(
      '#include <map_fragment>',`#include <map_fragment>
      vec4 caseMark=texture2D(uCaseInk,vCaseUv);
      float strap=step(.42,abs(fract(vCaseUv.x*2.)-.5))*caseMark.a;
      diffuseColor.rgb=mix(diffuseColor.rgb,caseMark.rgb,caseMark.a*mix(.76,1.,strap));`)
      .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.59,strap);')
      .replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=mix(metalnessFactor,.44,strap);');
  };
  material.customProgramCacheKey=()=>key+'-case-hardware';
}

export { caseAtlas };
