import * as THREE from 'three';
import { waterMaps } from './map.js';

const BASE = new URL('../assets/classic/', import.meta.url).href;
export async function buildClassicMap(scene) {
  const response = await fetch(BASE+'transport/map.json');
  if (!response.ok) throw new Error('经典地图资源缺失');
  const data = await response.json();
  // Reflect across the ship's long axis, keeping the teams at their own ends.
  // Geometry, brush halfspaces, spawns and radar must use the same transform.
  for (const c of data.colliders) {
    c.x = -c.x;
    for (const plane of c.planes) plane[0] = -plane[0];
  }
  for (const team of Object.values(data.spawns)) for (const p of team) p[0] = -p[0];
  for (const face of data.topdown) face.x = -face.x;
  data.floorY = Math.min(0, ...data.colliders.map(c => c.h));
  const binary = await fetch(BASE+'transport/map.bin').then(r => { if (!r.ok) throw new Error('地图网格缺失'); return r.arrayBuffer(); });
  const loader=new THREE.TextureLoader();
  const texture=async(path,repeat=false) => {
    const t=await loader.loadAsync(BASE+path);t.colorSpace=THREE.SRGBColorSpace;
    if (repeat) t.wrapS=t.wrapT=THREE.RepeatWrapping;
    t.anisotropy=8;return t;
  };
  const [light,sky,textures]=await Promise.all([
    texture('transport/lightmap.png'),
    // Source face names differ from WebGL's +X,-X,+Y,-Y,+Z,-Z order.
    // ft.right meets lf.left; swapping the last pair keeps all sky edges continuous.
    new THREE.CubeTextureLoader().loadAsync(['ft','bk','up','dn','rt','lf'].map(f=>BASE+data.sky[f])),
    Promise.all(data.parts.map(p=>p.material.map ? texture(p.material.map,true) : null)),
  ]);
  sky.colorSpace=THREE.SRGBColorSpace;
  const group=new THREE.Group();group.name='classic-transport-ship';
  group.scale.x=-1;
  const obstacles=[];
  data.parts.forEach((p,i)=>{
    const buffer=new THREE.InterleavedBuffer(new Float32Array(binary,p.offset,p.count*7),7);
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.InterleavedBufferAttribute(buffer,3,0));
    g.setAttribute('uv',new THREE.InterleavedBufferAttribute(buffer,2,3));
    g.setAttribute('uv1',new THREE.InterleavedBufferAttribute(buffer,2,5));
    const mat=new THREE.MeshBasicMaterial({map:textures[i],lightMap:light,lightMapIntensity:1,
      color:textures[i]?0xffffff:0x6d7a7d,side:THREE.DoubleSide,alphaTest:p.material.alphaTest||0,
      toneMapped:false});
    mat.name=p.material.name; mat.lightMap.channel=1;
    const mesh=new THREE.Mesh(g,mat);mesh.name=p.material.name;group.add(mesh);
    obstacles.push(mesh);
  });
  // The source sky is already the classic ship's sea horizon. No procedural
  // cranes, buildings or bridge are placed over the imported map.
  scene.add(group);scene.background=sky;scene.environment=sky;scene.fog=null;
  const water=waterMaps();
  for(const k of ['map','normalMap','roughnessMap'])water[k].repeat.set(1600/14,1600/14);
  const sea=new THREE.Mesh(new THREE.PlaneGeometry(1600,1600),new THREE.MeshStandardMaterial({
    map:water.map,normalMap:water.normalMap,roughnessMap:water.roughnessMap,normalScale:water.normalScale,
    color:0xffffff,roughness:1,metalness:.06,
  }));
  sea.rotation.x=-Math.PI/2;sea.position.y=-3.42;scene.add(sea);
  return {...data, obstacles, source:'cf-transportship-source-port', update(t){
    for(const k of ['map','normalMap','roughnessMap'])water[k].offset.set(t*.008,t*.004);
  }};
}
