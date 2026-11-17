import * as THREE from 'three';
export async function finishHallAltar(world,hallProbe) {
  world.traverse(o=>{
    if(o.name==='hall-statue-halo'){
      o.traverse(mesh=>{
        if(!mesh.isMesh)return;
        mesh.material.envMap=hallProbe;mesh.material.envMapIntensity=.78;
        mesh.material.userData.envLock=true;mesh.receiveShadow=true;
      });
    }
    if(o.isLOD && (o.name==='hall-central-buddha'||o.name==='hall-flanking-buddha')){
      for(const level of o.levels)level.object.traverse(mesh=>{
        if(!mesh.isMesh)return;
        mesh.material.envMap=hallProbe;
        mesh.material.envMapIntensity=1.02;
        mesh.material.userData.envLock=true;
      });
    }
  });

  const burner=world.getObjectByName('hall-tripod-incense-burner');
  const bowl=burner.children.find(o=>o.geometry?.type==='LatheGeometry');
  if(bowl){
    const mat=bowl.material.clone();
    mat.name='hall-cast-censer-basin';mat.color.setHex(0x826840);
    mat.roughness=.46;mat.metalness=.69;
    mat.onBeforeCompile=shader=>{
      shader.vertexShader='varying vec3 vCasting;\n'+shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvCasting=position;');
      shader.fragmentShader='varying vec3 vCasting;\n'+shader.fragmentShader.replace('#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         float variation=sin(7.*vCasting.x+3.1*vCasting.z)*sin(3.*vCasting.z-2.*vCasting.y);
         float shoulder=smoothstep(.53,.77,vCasting.y)*(1.-smoothstep(.77,.84,vCasting.y));
         float worn=clamp(.37*shoulder+.62*smoothstep(.75,.86,vCasting.y)+.09*variation,0.,1.);
         float ring=.5+.5*cos(65.*vCasting.y+.4*variation);
         float patina=(1.-worn)*(.47+.29*variation);
         diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.42,.71,.59),patina);
         diffuseColor.rgb*=.76+.29*worn+.025*ring;
         roughnessFactor+=.30*patina-.19*worn;`);
    };
    mat.customProgramCacheKey=()=>'lingyin-cast-basin-v2';bowl.material=mat;
    const edge=new THREE.MeshStandardMaterial({name:'hall-censer-burnished-bronze',color:0xa07a4d,
      metalness:.77,roughness:.35,envMap:hallProbe,envMapIntensity:.96});
    edge.userData.envLock=true;
    const feet=edge.clone();
    feet.name='hall-censer-cast-feet';feet.color.setHex(0x6c583e);feet.roughness=.53;
    for(const piece of burner.children){
      if(piece.geometry?.type==='TorusGeometry')piece.material=edge;
      if(piece.geometry?.type==='CylinderGeometry')piece.material=feet;
    }
  }
}
