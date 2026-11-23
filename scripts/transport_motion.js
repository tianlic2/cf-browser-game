import * as THREE from 'three';
import { harbourSwellGLSL } from './transport_dynamics.js';
import { freightGust } from './transport_wind.js';

// Twin impellers share the existing rectangular vent opening. Their shallow
// pitched blades fit between the dark back plate and the fixed louvres.
export function createVentFans(mounts) {
  const vertices=[];
  for(let i=0;i<5;i++){
    const a=i*Math.PI*2/5;
    const blade=[[.036,-.20,.003],[.197,.02,.004],[.225,.50,-.003],[.048,.64,-.003]];
    for(const k of [0,1,2,0,2,3]){
      const [r,angle,z]=blade[k];
      vertices.push(r*Math.cos(a+angle),r*Math.sin(a+angle),z);
    }
    vertices.push(0,0,.005,.050*Math.cos(a),.050*Math.sin(a),.005,
      .050*Math.cos(a+Math.PI*2/5),.050*Math.sin(a+Math.PI*2/5),.005);
  }
  const shape=new THREE.BufferGeometry();
  shape.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  shape.computeVertexNormals();
  const fans=new THREE.InstancedMesh(shape,new THREE.MeshStandardMaterial({
    color:0xb8bab1,metalness:.16,roughness:.76,side:THREE.DoubleSide,
  }),mounts.length);
  fans.name='transport-vent-impellers';
  fans.receiveShadow=true;
  const pose=new THREE.Object3D();
  fans.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  fans.userData.turn=t=>{
    mounts.forEach(([x,z,facing],i)=>{
      pose.position.set(x,1.90,z);
      pose.rotation.set(0,facing>0?0:Math.PI,t*(1.75+.09*(i%3))+i*.62,'YXZ');
      pose.updateMatrix();
      fans.setMatrixAt(i,pose.matrix);
    });
    fans.instanceMatrix.needsUpdate=true;
  };
  fans.userData.turn(0);
  fans.computeBoundingSphere();
  return fans;
}

// Local +Z points out of the buckle. A curled free end can lift and settle
// without swinging back through the underlying crate or its taut webbing.
export function createBuckleTail(clipPose) {
  const pos=[],colors=[],indices=[];
  const rows=12;
  for(let i=0;i<=rows;i++){
    const u=i/rows;
    for(let side=0;side<3;side++){
      pos.push(.094*u+(side-1)*.029,-.34*u,.009+.10*u+.026*Math.sin(Math.PI*u));
      const k=side===1?.82:1.16;
      colors.push(k,k,k);
    }
    if(i<rows)for(let side=0;side<2;side++){
      const j=3*i+side;
      indices.push(j,j+3,j+1,j+1,j+3,j+4);
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geo.setIndex(indices);geo.computeVertexNormals();
  const tail=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({
    color:0x81735a,roughness:.93,side:THREE.DoubleSide,vertexColors:true,
  }));
  tail.name='transport-loose-buckle-tail';
  const face=new THREE.Vector3(0,0,1).applyQuaternion(clipPose.quaternion);
  tail.position.copy(clipPose.position).addScaledVector(face,.012);
  tail.position.y-=.026;
  tail.rotation.order='YXZ';
  tail.rotation.y=clipPose.rotation.y;
  tail.receiveShadow=true;
  let since=-Infinity,peak=0;
  function swing(t) {
    const age=t-since;
    if(age<0 || age>1.25)return 0;
    return peak*Math.exp(-3.9*age)*Math.sin(15*age);
  }
  tail.userData.impulse=(point,radius,strength,time)=>{
    const proximity=1-point.distanceTo(tail.position)/radius;
    if(proximity<=0)return;
    peak=Math.min(1.05,Math.abs(swing(time))+strength*proximity);
    since=time;
  };
  tail.userData.setTime=t=>{
    const wind=.022*Math.sin(t*2.6)+freightGust(t-.9)*(.12+.045*Math.sin(t*8.4));
    const angle=swing(t)+wind;
    tail.rotation.x=-Math.max(-.13,angle);
    tail.rotation.z=.19*angle;
  };
  return tail;
}

// Sample the same seamless wave field at two scales. Rotate the slopes of
// the short waves back into the tangent frame used for the broad swell.
export function animateShipWater(material,clock={value:0}) {
  const drift={value:new THREE.Vector2()};
  material.onBeforeCompile=shader=>{
    shader.uniforms.uShipRippleDrift=drift;
    shader.uniforms.uHarbourTime=clock;
    shader.vertexShader=harbourSwellGLSL+'\n'+shader.vertexShader
      .replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
        vec3 swellNormal=harbourSwell(vec2(position.x,-position.y));
        objectNormal=normalize(vec3(-swellNormal.y,swellNormal.z,1.));`)
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        transformed.z+=harbourSwell(vec2(position.x,-position.y)).x;`);
    const normals=THREE.ShaderChunk.normal_fragment_maps.replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;\n\tmapN.xy *= normalScale;',`
      mat2 rippleBasis=mat2(.8,.6,-.6,.8);
      vec2 swellUV=vNormalMapUv+shipWaveWarp(vNormalMapUv);
      vec3 mapN=texture2D(normalMap,swellUV).xyz*2.-1.;
      vec2 rippleUV=rippleBasis*swellUV*3.1+uShipRippleDrift;
      vec3 fine=texture2D(normalMap,rippleUV).xyz*2.-1.;
      mat2 toTangent=mat2(.8,-.6,.6,.8);
      mapN.xy=(mapN.xy*.82 + toTangent*fine.xy*.37)*normalScale;`);
    shader.fragmentShader=`uniform vec2 uShipRippleDrift;
      vec2 shipWaveWarp(vec2 uv){
        return .20*vec2(sin(dot(uv,vec2(1.7,.78))),sin(dot(uv,vec2(-.83,1.41))))+
               .11*vec2(sin(dot(uv,vec2(.48,-2.04))),cos(dot(uv,vec2(1.23,.58))));
      }
      `+shader.fragmentShader.replace('#include <normal_fragment_maps>',normals)
      .replace('#include <map_fragment>',`
        float crest=texture2D(map,vMapUv+shipWaveWarp(vMapUv)).g;
        diffuseColor.rgb*=mix(vec3(.041,.091,.108),vec3(.086,.157,.173),smoothstep(.045,.32,crest));
      `).replace('#include <roughnessmap_fragment>',`
        float roughnessFactor=.26+.43*texture2D(roughnessMap,vRoughnessMapUv+shipWaveWarp(vRoughnessMapUv)).g;
      `);
  };
  material.customProgramCacheKey=()=>'transport-crossing-swell-2';
  return t=>{
    clock.value=t;
    for(const tex of [material.map,material.roughnessMap,material.normalMap])
      tex.offset.set(t*.008,t*.004);
    drift.value.set(-t*.039,t*.012);
  };
}
