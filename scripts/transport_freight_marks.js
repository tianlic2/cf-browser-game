import * as THREE from 'three';

// Each mark belongs to one shipping unit and one exposed face. UVs are
// projected after cloth forming, so the ink bends with the drawn fabric.
const consignments = [
  {x:7.56,z:-3.64,nx:.5,nz:-.866,code:'M 27',kind:'MACHINE PARTS'},
  {x:-6.97,z:-4.17,nx:-.5,nz:-.866,code:'F 06',kind:'FILTERS'},
  {x:3.80,z:14.87,nx:0,nz:1,code:'P 18',kind:'PUMP ASSEMBLY'},
  {x:-6.53,z:-18.09,nx:1,nz:0,code:'S 04',kind:'SPARE GEAR'},
];

function stencilAtlas() {
  const tile=512,canvas=document.createElement('canvas');
  canvas.width=tile;canvas.height=tile*consignments.length;
  const ctx=canvas.getContext('2d');
  consignments.forEach(({code,kind},i)=>{
    ctx.save();
    ctx.translate(0,i*tile);
    ctx.fillStyle='#d2c9ae';
    ctx.font='bold 126px sans-serif';
    ctx.fillText(code,34,233,425);
    ctx.fillRect(41,254,411,6);
    ctx.font='bold 37px monospace';
    ctx.fillText(kind,39,305,416);
    // Interrupted bridges in the stencil, plus worn ink where fibres are exposed.
    for(const x of [76,162,285,374])ctx.clearRect(x,130,5,113);
    let seed=827+i;
    const random=()=>((seed=Math.imul(1664525,seed)+1013904223|0)>>>0)/4294967296;
    for(let j=0;j<4300;j++)ctx.clearRect(36+random()*420,132+random()*180,1+random()*5,1+random()*3);
    ctx.restore();
  });
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=8;
  return texture;
}

export function markTransportFreight(mesh) {
  const position=mesh.geometry.attributes.position;
  const uv=new Float32Array(position.count*2);
  let marked=0;
  for(let i=0;i<position.count;i+=3) {
    let x=0,z=0;
    for(let j=i;j<i+3;j++){x-=position.getX(j)/3;z+=position.getZ(j)/3;}
    const index=consignments.findIndex(c=>{
      const dx=x-c.x,dz=z-c.z;
      const depth=dx*c.nx+dz*c.nz;
      return depth>1.45 && depth<1.70 && Math.abs(-dx*c.nz+dz*c.nx)<1.57;
    });
    if(index<0)continue;
    const c=consignments[index];
    marked++;
    for(let j=i;j<i+3;j++) {
      const along=(-position.getX(j)-c.x)*c.nz-(position.getZ(j)-c.z)*c.nx;
      // Use the whole face as a continuous tile. Clear margins clip ink at its edges.
      uv[j*2]=THREE.MathUtils.clamp(.50+along/2.65,0,1);
      const height=THREE.MathUtils.clamp((position.getY(j)-1.36)/1.45,0,1);
      uv[j*2+1]=(consignments.length-1-index+height)/consignments.length;
    }
  }
  mesh.userData.markedFreightTriangles=marked;
  mesh.geometry.setAttribute('freightUv',new THREE.BufferAttribute(uv,2));
  const material=mesh.material,compile=material.onBeforeCompile,key=material.customProgramCacheKey();
  const atlas=stencilAtlas();
  material.onBeforeCompile=shader=>{
    compile(shader);
    shader.uniforms.uFreightInk={value:atlas};
    shader.vertexShader='attribute vec2 freightUv; varying vec2 vFreightUv;\n'+shader.vertexShader.replace(
      '#include <begin_vertex>','#include <begin_vertex>\nvFreightUv=freightUv;');
    shader.fragmentShader='uniform sampler2D uFreightInk; varying vec2 vFreightUv;\n'+shader.fragmentShader.replace(
      '#include <map_fragment>',`#include <map_fragment>
      vec4 ink=texture2D(uFreightInk,vFreightUv);
      diffuseColor.rgb=mix(diffuseColor.rgb,ink.rgb,ink.a*.73);`);
  };
  material.customProgramCacheKey=()=>key+'-consignment-ink';
}
