import * as THREE from 'three';

// Surveyed apertures in the original forward deckhouse. The central opening is
// one long ribbon; split its glazing at a practical pane width.
const ports=[[-8.442,-7.120],[-5.768,-4.446],[-2.795,3.776],[5.691,7.013],[8.728,10.050]];
const sill=7.62, head=8.636;

export function createDeckhouseWindowFrames() {
  const parts=[];
  function bar(x,y,z,w,h,d,tint) { parts.push([x,y,z,w,h,d,tint]); }
  for(const [left,right] of ports) {
    const mid=(left+right)/2, w=right-left;
    const panes=Math.max(1,Math.round(w/1.34));
    // The frame fills the space between the glass and the original steel.
    // A dark glazing bead sits just inside the weathered aluminium reveal.
    for(const y of [sill,head]) {
      bar(mid,y,-37.17,w+.094,.083,.256,0x747d78);
      bar(mid,y+(y===sill?.043:-.043),-37.043,w,.029,.029,0x354445);
    }
    for(const x of [left,right])bar(x,(sill+head)/2,-37.17,.072,head-sill,.256,0x78827e);
    for(let i=1;i<panes;i++) {
      const x=left+w*i/panes;
      bar(x,(sill+head)/2,-37.102,.089,head-sill,.132,0x3d4947);
      bar(x,(sill+head)/2,-37.026,.046,head-sill,.027,0x929992);
    }
    bar(mid,head+.047,-37.068,w+.18,.033,.20,0xacafa2);
    bar(mid,sill-.019,-37.098,w+.12,.035,.195,0x979d92);
  }
  const mat=new THREE.MeshStandardMaterial({metalness:.34,roughness:.51});
  const frames=new THREE.InstancedMesh(new THREE.BoxGeometry(),mat,parts.length);
  const matrix=new THREE.Matrix4(),colour=new THREE.Color();
  parts.forEach(([x,y,z,w,h,d,tint],i)=>{
    frames.setMatrixAt(i,matrix.makeScale(w,h,d).setPosition(x,y,z));
    frames.setColorAt(i,colour.setHex(tint));
  });
  frames.name='transport-deckhouse-window-frames';
  frames.receiveShadow=true;frames.computeBoundingSphere();
  return frames;
}

// The import has opaque, untextured grey polygons over these openings. Use
// the existing harbour radiance for the outer glass and a view-dependent
// recessed wheelhouse lining behind it. No transparency sorting or extra pass.
export function createDeckhouseGlass() {
  const mat=new THREE.MeshPhysicalMaterial({color:0x526663,metalness:.10,roughness:.24,
    clearcoat:.88,clearcoatRoughness:.16,envMapIntensity:.85,side:THREE.DoubleSide});
  mat.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      if(vShipLightPosition.z< -36. && vShipLightPosition.y>7.4){
        vec3 sight=normalize(vShipLightPosition-cameraPosition);
        // Refracted ray intercepts the rear surface and the overhead of a
        // shallow cabin. The parallax is shared across the mullioned ribbon.
        vec3 ray=refract(sight,vec3(0.,0.,1.),.76);
        float backDepth=1.32/max(.12,-ray.z);
        float topDepth=ray.y>.001?(8.86-vShipLightPosition.y)/ray.y:30.;
        float floorDepth=ray.y<-.001?(7.38-vShipLightPosition.y)/ray.y:30.;
        float t=max(0.,min(backDepth,min(topDepth,floorDepth)));
        vec3 inside=vShipLightPosition+ray*t;
        float bay=abs(fract((inside.x+.62)/2.62)-.5);
        float column=smoothstep(.458,.49,bay);
        vec3 lining=vec3(.044,.066,.064);
        if(topDepth<backDepth && topDepth<floorDepth) {
          lining=vec3(.105,.130,.122);
          float lamp=(1.-smoothstep(.117,.137,abs(inside.z+37.85)))*(1.-smoothstep(.28,.31,bay));
          lining+=vec3(.26,.235,.167)*lamp;
        } else if(floorDepth<backDepth)lining=vec3(.036,.051,.047);
        else lining*=1.-.4*smoothstep(7.65,8.02,inside.y);
        diffuseColor.rgb=mix(lining,lining*.42,column);
      }`);
  };
  mat.customProgramCacheKey=()=>'transport-recessed-deckhouse-glass';
  return mat;
}
