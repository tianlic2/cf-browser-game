import * as THREE from 'three';
import { addCompartmentIrradiance } from './transport_compartments.js';

// The brightest opening in the display panorama is at 16 degrees elevation.
export const transportSunPosition=[-40.28,27.56,87.28];

// Atlas of sky visibility at 0.6 m intervals. Red integrates the entire
// upper hemisphere; green weights rays toward the bright break in the clouds.
export function lightTransportSurfaces(roots,atlas,roomLight) {
  const materials=new Set(), interiorMaterials=new Set();
  const box=new THREE.Box3();
  for(const root of roots) {
    root.updateWorldMatrix(true,true);
    root.traverse(o=>{
      if(!o.material?.isMeshStandardMaterial)return;
      materials.add(o.material);
      if(interiorMaterials.has(o.material))return;
      box.setFromObject(o);
      if(box.min.y<3.49 && box.max.y>-.12 &&
          ((box.min.z<45.25 && box.max.z>36.35) || (box.min.z< -37.66 && box.max.z> -46.56)))
        interiorMaterials.add(o.material);
    });
  }
  for(const material of materials){
    const compile=material.onBeforeCompile, key=material.customProgramCacheKey();
    material.onBeforeCompile=function(shader,renderer){
      compile.call(this,shader,renderer);
      shader.uniforms.uShipSkyAccess={value:atlas};
      shader.vertexShader='varying vec3 vShipLightPosition;\n'+shader.vertexShader.replace(
        '#include <worldpos_vertex>',`#include <worldpos_vertex>
        vec4 samplePos=vec4(transformed,1.);
        #ifdef USE_INSTANCING
          samplePos=instanceMatrix*samplePos;
        #endif
        vShipLightPosition=(modelMatrix*samplePos).xyz;`);
      shader.fragmentShader=`varying vec3 vShipLightPosition;
        uniform sampler2D uShipSkyAccess;
        vec2 skyLayer(vec2 cell,float layer){
          vec2 tile=vec2(mod(layer,8.),floor(layer/8.))*vec2(61.,161.);
          return texture2D(uShipSkyAccess,(tile+cell+.5)/vec2(488.,805.)).rg;
        }
        `+shader.fragmentShader.replace('#include <lights_fragment_maps>',`
        #include <lights_fragment_maps>
        vec3 outward=inverseTransformDirection(nonPerturbedNormal,viewMatrix);
        vec3 probe=clamp((vShipLightPosition+.26*outward-vec3(-18.,-6.,-48.))/.6,
                         vec3(0.),vec3(60.,34.,160.));
        float layer=floor(probe.y);
        vec2 access=mix(skyLayer(probe.xz,layer),skyLayer(probe.xz,min(34.,layer+1.)),fract(probe.y));
        float sky=smoothstep(0.,.85,access.r);
        float facing=max(0.,dot(outward,vec3(-.4028,.2756,.8728)));
        // Interior bounce provides a floor. The warm sky lobe is visible only
        // where the surface faces the opening and rays can escape towards it.
        irradiance*=mix(vec3(.45,.46,.47),vec3(.96,1.0,1.07),sky);
        irradiance+=vec3(.72,.45,.22)*access.g*(.23+.77*facing);
        #ifdef USE_ENVMAP
          radiance*=mix(.32,1.,sky);
          iblIrradiance*=mix(.45,1.,sky);
        #endif`);
      if(interiorMaterials.has(material))addCompartmentIrradiance(shader,roomLight);
    };
    material.customProgramCacheKey=()=>key+'-directional-sky-access'+(interiorMaterials.has(material)?'-tween-deck':'');
  }
}

// Sample the same ambient visibility as the hull at the player's eye. Called
// alongside the sun test on movement, with smoothing applied by the viewmodel.
export function createTransportSkyProbe(atlas) {
  const canvas=document.createElement('canvas');
  const {width,height}=atlas.image;
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(atlas.image,0,0);
  const pixels=ctx.getImageData(0,0,width,height).data;
  function red(x,y,z){
    return pixels[((Math.floor(y/8)*161+z)*width+(y%8)*61+x)*4]/255;
  }
  return (wx,wy,wz)=>{
    const x=THREE.MathUtils.clamp((wx+18)/.6,0,60),y=THREE.MathUtils.clamp((wy+6)/.6,0,34);
    const z=THREE.MathUtils.clamp((wz+48)/.6,0,160);
    const x0=Math.floor(x),y0=Math.floor(y),z0=Math.floor(z);
    const x1=Math.min(60,x0+1),z1=Math.min(160,z0+1);
    const mix=THREE.MathUtils.lerp;
    const plane=k=>mix(mix(red(x0,k,z0),red(x1,k,z0),x-x0),
                       mix(red(x0,k,z1),red(x1,k,z1),x-x0),z-z0);
    return mix(plane(y0),plane(Math.min(34,y0+1)),y-y0);
  };
}

// Separate nearby blockers from elevated ones in the cached sun map. Looking
// for tall beams over the whole penumbra also catches light just outside a
// thin beam, where a blocker search at the centre would otherwise miss it.
export function softenTransportCargoShadow(shader) {
  const helper = `
    #if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
    float shipShadow(sampler2D depths, vec2 size, float bias, float unusedRadius, vec4 projected) {
      vec3 p = projected.xyz / projected.w;
      vec3 dx = dFdx(p), dy = dFdy(p);
      float det = dx.x*dy.y-dx.y*dy.x;
      vec2 slope = abs(det)>1e-10
        ? vec2(dx.z*dy.y-dx.y*dy.z,dx.x*dy.z-dx.z*dy.x)/det : vec2(0.);
      if(any(lessThan(p,vec3(0.))) || any(greaterThan(p,vec3(1.)))) return 1.;
      // The ship's orthographic shadow camera covers 106 x 75 metres and
      // 239.5 metres in depth. Compare against the receiving plane at each tap.
      vec2 slopePerTexel = clamp(slope/size,vec2(-.0015),vec2(.0015));
      vec2 uv = p.xy*size-.5;
      vec2 f = fract(uv);
      float contact = 0.;
      for(int i=0;i<4;i++){
        vec2 corner=vec2(float(i%2),float(i/2));
        vec2 offset=corner-f;
        float depth=unpackRGBAToDepth(texture2D(depths,p.xy+offset/size));
        float gap=(p.z+bias+dot(slopePerTexel,offset)-depth)*239.5;
        vec2 w=mix(1.-f,f,corner);
        contact+=w.x*w.y*step(0.,gap)*(1.-smoothstep(1.2,12.,gap));
      }
      if(contact>.999) return 0.;
      float distant=0.,weight=0.;
      for(int i=0;i<24;i++){
        float angle=float(i)*2.39996323;
        float r=sqrt((float(i)+.5)/24.);
        vec2 offset=vec2(cos(angle),sin(angle))*r*.55/vec2(106.,75.);
        float depth=unpackRGBAToDepth(texture2D(depths,p.xy+offset));
        float gap=(p.z+bias+dot(slopePerTexel,offset*size)-depth)*239.5;
        float w=1.-.85*r*r;
        distant+=w*smoothstep(1.2,12.,gap);
        weight+=w;
      }
      return 1.-min(1.,contact+distant/weight);
    }
    #endif`;
  shader.fragmentShader=shader.fragmentShader.replace('#include <shadowmap_pars_fragment>',
    '#include <shadowmap_pars_fragment>\n'+helper).replace('#include <lights_fragment_begin>',
    THREE.ShaderChunk.lights_fragment_begin.replace('getShadow( directionalShadowMap','shipShadow( directionalShadowMap'));
}

// A single capped ray from the eye toward the sun sets the key-light level
// for both hands and weapon. Clip against actual convex hulls (including the
// recently reshaped cargo roofs). The renderer smooths transitions at edges.
export function createTransportSunProbe(colliders) {
  const dir=new THREE.Vector3(...transportSunPosition).normalize();
  const solids=colliders.filter(c=>c.h-c.y0>.045 && c.h>-.4 && c.planes?.length);
  const reach=90;
  return (x,y,z)=>{
    for(const c of solids) {
      if(c.h<y || c.y0>y+reach*dir.y ||
        c.x-c.hx>x || c.x+c.hx<x+reach*dir.x ||
        c.z+c.hz<z || c.z-c.hz>z+reach*dir.z)continue;
      let enter=.03,exit=reach;
      for(const [nx,ny,nz,d] of c.planes) {
        const room=d-nx*x-ny*y-nz*z;
        const rate=nx*dir.x+ny*dir.y+nz*dir.z;
        if(Math.abs(rate)<1e-7) {
          if(room<0){exit=-1;break;}
        } else if(rate>0)exit=Math.min(exit,room/rate);
        else enter=Math.max(enter,room/rate);
        if(exit<enter)break;
      }
      if(exit>=enter)return 0;
    }
    return 1;
  };
}
