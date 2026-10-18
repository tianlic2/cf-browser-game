import * as THREE from 'three';
import { fetchJoinedAsset } from './chunked_asset.js?v=github-publish-1';

// Original CF first-person AK: hands, fingers and gun share the authored rig.
// The world/drop model stays separate; this rig only renders in the view scene.
export class ClassicView {
  static async load(asset='ak/view') {
    try {
      const base=new URL(`../assets/classic/${asset}/`,import.meta.url);
      const version='kukri-scoped-vfx-1';
      const assetUrl=name=>{const u=new URL(name,base);u.searchParams.set('v',version);return u;};
      const r=await fetch(assetUrl('view.json'));if(!r.ok)throw new Error('view.json');
      const data=await r.json();
      const bytes=await fetchJoinedAsset(data.binaryParts||['view.bin'],assetUrl,'视模');
      const loader=new THREE.TextureLoader();
      const textures=await Promise.all(data.parts.map(async p=>{
        const load=async name=>name?loader.loadAsync(assetUrl(name).href):null;
        return {map:await load(p.map),normalMap:await load(p.normalMap),
          metalnessMap:await load(p.metalnessMap),aoMap:await load(p.aoMap),
          emissiveMap:await load(p.emissiveMap),reflectionMap:await load(p.reflectionMap)};
      }));
      return new ClassicView(data,bytes,textures,asset!=='m4_ironbeast');
    } catch(e) { console.warn('CF 视模加载失败，使用握点回退',e);return null; }
  }
  constructor(data,bytes,textures,extendSleeves=true) {
    this.root=new THREE.Group();this.root.name='cf-authored-first-person';
    this.effects=[];
    const rigData=data.rigs||[{bones:data.bones,clips:data.clips}],rigStates=rigData.map((spec,index)=>{
      const rig=new THREE.Group();rig.name=`cf-authored-rig-${index}`;
      const bones=spec.bones.map(b=>{const o=new THREE.Bone();o.name=b.name;o.position.fromArray(b.pose);o.quaternion.fromArray(b.pose,3);return o;});
      // Each imported source part keeps its own original reference hierarchy.
      rig.matrixAutoUpdate=false;
      if(data.transform)rig.matrix.set(...data.transform);
      else rig.matrix.set(.01,0,0,0, 0,0,.01,0, 0,.01,0,0, 0,0,0,1);
      spec.bones.forEach((b,i)=>(b.parent<0?rig:bones[b.parent]).add(bones[i]));
      rig.updateMatrixWorld(true);const skeleton=new THREE.Skeleton(bones);
      this.root.add(rig);
      const clips={};for(const [name,c] of Object.entries(spec.clips))
        clips[name]={times:c.times,values:new Float32Array(bytes,c.offset,c.count*bones.length*7)};
      return {rig,bones,skeleton,clips,clip:'idle_0',seconds:0};
    });
    data.parts.forEach((p,i)=>{
      const state=rigStates[p.rig||0],{rig,skeleton}=state;
      const a=new Float32Array(bytes,p.offset,p.count*16),g=new THREE.BufferGeometry();
      const attr=(n,start,size,Type=Float32Array)=>{
        const v=new Type(p.count*size);for(let j=0;j<p.count;j++)for(let k=0;k<size;k++)v[j*size+k]=a[j*16+start+k];
        g.setAttribute(n,new THREE.BufferAttribute(v,size));
      };
      attr('position',0,3);attr('normal',3,3);attr('uv',6,2);attr('skinIndex',8,4,Uint16Array);attr('skinWeight',12,4);
      if(p.weapon&&data.weaponScale>1) {
        const grip=state.bones.find(b=>b.name===data.weaponPivotBone)?.position;
        if(grip) {
          const position=g.attributes.position;
          for(let j=0;j<position.count;j++)position.setXYZ(j,
            grip.x+(position.getX(j)-grip.x)*data.weaponScale,
            grip.y+(position.getY(j)-grip.y)*data.weaponScale,
            grip.z+(position.getZ(j)-grip.z)*data.weaponScale);
          position.needsUpdate=true;
        }
      }
      for(let j=0;j<p.count;j++)g.attributes.uv.setY(j,1-g.attributes.uv.getY(j));
      // UVs above already flip the SMD V axis; TextureLoader must not flip it again.
      const maps=textures[i],map=maps.map;
      for(const texture of Object.values(maps))if(texture){texture.flipY=false;texture.anisotropy=8;}
      // Additive colour-space is asset-authored.  Most existing imported views
      // (including Iron Beast) use the established sRGB path; only assets that
      // explicitly opt in, such as Kukri's w4/0 cards, bypass the conversion.
      map.colorSpace=p.linearAdditive?THREE.NoColorSpace:THREE.SRGBColorSpace;
      if(maps.emissiveMap)maps.emissiveMap.colorSpace=THREE.SRGBColorSpace;
      let material;
      if(p.additive) {
        // GoldSrc's compiled MDL marks both the S_ bodygroup and every VFX
        // texture STUDIO_NF_ADDITIVE. Preserve that independent overlay instead
        // of interpreting the S_ bitmap as a modern PBR metalness mask.
        material=new THREE.MeshBasicMaterial({map,transparent:true,depthTest:true,depthWrite:false,
          blending:THREE.AdditiveBlending,side:THREE.DoubleSide,toneMapped:false});
      } else if(p.unlit) {
        // Several CF conversions bake the intended diffuse colour and contrast
        // directly into the Source sheet.  Rendering that through the level's
        // blue IBL changes gold into black/blue, so preserve the authored base
        // and apply its $envmapmask as a separate low-energy overlay below.
        material=new THREE.MeshBasicMaterial({map,toneMapped:false});
      } else {
        material=new THREE.MeshStandardMaterial({map,
          normalMap:maps.normalMap||null,metalnessMap:maps.metalnessMap||null,
          aoMap:maps.aoMap||null,emissiveMap:maps.emissiveMap||null,
          roughness:p.roughness??.85,metalness:p.metalness??.04,
          envMapIntensity:p.envMapIntensity??1,
          emissive:p.emissive?new THREE.Color(p.emissive):new THREE.Color(0),
          emissiveIntensity:p.emissiveIntensity??0});
        if(maps.aoMap&&!g.attributes.uv1)g.setAttribute('uv1',g.attributes.uv.clone());
      }
      const mesh=new THREE.SkinnedMesh(g,material);
      mesh.frustumCulled=false;rig.add(mesh);mesh.bind(skeleton,rig.matrixWorld);
      if(maps.reflectionMap) {
        maps.reflectionMap.colorSpace=THREE.NoColorSpace;
        const reflectionMaterial=new THREE.MeshBasicMaterial({map:maps.reflectionMap,
          transparent:true,opacity:p.reflectionOpacity??.18,depthTest:true,depthWrite:false,
          blending:THREE.AdditiveBlending,side:THREE.FrontSide,toneMapped:false,
          polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
        const reflection=new THREE.SkinnedMesh(g,reflectionMaterial);
        reflection.frustumCulled=false;reflection.renderOrder=1;rig.add(reflection);
        reflection.bind(skeleton,rig.matrixWorld);
      }
      if(p.specular)mesh.renderOrder=1;
      if(p.effect){mesh.renderOrder=2;this.effects.push(mesh);}
      if(i===0||p.weapon)this.gun=mesh;
      if(p.map==='FVIEW_HAND_GR.png'||p.textureName==='FVIEW_HAND_GR.bmp')this.hands=mesh;
      if(p.map==='FVIEW_ARM_GR.png'||p.textureName==='FVIEW_ARM_GR.bmp')this.sleeves=mesh;
    });
    this.rigStates=rigStates;this.bones=rigStates[0].bones;this.skeleton=rigStates[0].skeleton;
    this.clips=rigStates[0].clips;this.events=data.events||{};
    this.muzzleBone=data.muzzleBone?this.bones.find(b=>b.name===data.muzzleBone):null;
    this.q=new THREE.Quaternion();this.sample('idle_0',0);
    this.sleeveExtension=extendSleeves&&this.sleeves?new SleeveExtension(this.sleeves,this.root):null;
    const v=new THREE.Vector3(),sign=data.muzzleSign||-1;let front=sign>0?-Infinity:Infinity;this.tip=0;
    for(let i=0;i<this.gun.geometry.attributes.position.count;i++) {
      this.gun.getVertexPosition(i,v);
      const axis=data.muzzleAxis==='x'?v.x:data.muzzleAxis==='z'?v.z:v.y;
      if(sign*axis>sign*front){front=axis;this.tip=i;}
    }
  }
  sample(name,seconds) {
    for(const state of this.rigStates) {
      const c=state.clips[name]||state.clips.idle_0,ts=c.times,nb=state.bones.length;
      const t=Math.max(0,Math.min(seconds,ts[ts.length-1]));let a=0;
      while(a<ts.length-2&&ts[a+1]<t)a++;
      const b=Math.min(a+1,ts.length-1),f=ts[b]>ts[a]?(t-ts[a])/(ts[b]-ts[a]):0;
      state.bones.forEach((bone,i)=>{
        const x=(a*nb+i)*7,y=(b*nb+i)*7,v=c.values;
        bone.position.set(v[x]+(v[y]-v[x])*f,v[x+1]+(v[y+1]-v[x+1])*f,v[x+2]+(v[y+2]-v[x+2])*f);
        bone.quaternion.fromArray(v,x+3).slerp(this.q.fromArray(v,y+3),f);
      });
      state.rig.updateMatrixWorld(true);state.skeleton.update();state.clip=name;state.seconds=t;
    }
    this.root.updateMatrixWorld(true);this.clip=name;this.seconds=seconds;
    this.sleeveExtension?.update();
  }
  duration(name) {const t=this.clips[name].times;return t[t.length-1];}
  eventTime(clip,eventName) {
    const event=(this.events[clip]||[]).find(item=>item.name===eventName);
    return event?.time;
  }
  projectile() {
    if(!this.projectileMesh) {
      const g=this.gun.geometry.clone(),p=g.attributes.position,v=new THREE.Vector3();
      // Bake only the weapon at rest, without either hand or a live skeleton.
      const clip=this.clip,t=this.seconds;this.sample('idle_0',0);
      for(let i=0;i<p.count;i++){this.gun.getVertexPosition(i,v);this.gun.localToWorld(v);this.root.worldToLocal(v);p.setXYZ(i,v.x,v.y,v.z);}
      for(let i=0;i<p.count;i+=3)for(const name of ['position','uv']) {
        const a=g.attributes[name],size=a.itemSize;
        for(let k=0;k<size;k++){const x=a.array[(i+1)*size+k];a.array[(i+1)*size+k]=a.array[(i+2)*size+k];a.array[(i+2)*size+k]=x;}
      }
      g.deleteAttribute('skinIndex');g.deleteAttribute('skinWeight');g.computeVertexNormals();g.computeBoundingBox();
      const center=g.boundingBox.getCenter(v);g.translate(-center.x,-center.y,-center.z);
      const size=g.boundingBox.getSize(new THREE.Vector3());g.scale(.16/size.y,.16/size.y,.16/size.y);
      this.projectileMesh=new THREE.Mesh(g,this.gun.material);this.sample(clip,t);
    }
    return this.projectileMesh.clone();
  }
  muzzle(out) {
    if(this.muzzleBone)return this.muzzleBone.getWorldPosition(out);
    this.gun.getVertexPosition(this.tip,out);return this.gun.localToWorld(out);
  }
}
// The stock AK view ends at two open upper-arm rings. Its separate shared-arm
// baker uses these continuations; the Iron Beast keeps its source silhouette.
class SleeveExtension {
  constructor(source,root) {
    this.source=source;this.root=root;
    const g=source.geometry,p=g.attributes.position,skin=g.attributes.skinIndex;
    const welded=new Map(),ids=[],vertices=[],edges=new Map();
    for(let i=0;i<p.count;i++) {
      const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>v.toFixed(4)).join(',');
      if(!welded.has(key)){welded.set(key,vertices.length);vertices.push(i);}
      ids.push(welded.get(key));
    }
    for(let i=0;i<ids.length;i+=3)for(let j=0;j<3;j++) {
      const a=ids[i+j],b=ids[i+(j+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(',');
      const e=edges.get(key);if(e)e.count++;else edges.set(key,{a,b,count:1});
    }
    const neighbours=new Map();
    for(const e of edges.values())if(e.count===1)for(const [a,b] of [[e.a,e.b],[e.b,e.a]]) {
      if(!neighbours.has(a))neighbours.set(a,[]);neighbours.get(a).push(b);
    }
    this.rings=[];const seen=new Set();
    for(const start of neighbours.keys()) {
      if(seen.has(start))continue;
      const ring=[];let at=start;
      while(at!==undefined&&!seen.has(at)) {
        seen.add(at);ring.push(vertices[at]);at=neighbours.get(at).find(v=>!seen.has(v));
      }
      const bone=source.skeleton.bones[skin.getX(ring[0])].name;
      if(!bone.endsWith('UpperArm'))continue;
      this.rings.push({indices:ring,points:ring.map(()=>new THREE.Vector3()),
        shoulder:new THREE.Vector3(bone.includes(' L ')?-.20:.48,-.72,-.16)});
    }
    const count=this.rings.reduce((n,r)=>n+r.indices.length*3,0),geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3).setUsage(THREE.DynamicDrawUsage));
    const uv=new Float32Array(count*2),triangles=[];let offset=0;
    for(const r of this.rings) {
      r.offset=offset;const n=r.indices.length;
      for(let row=0;row<3;row++)for(let j=0;j<n;j++) {
        const v=offset+row*n+j,k=r.indices[j];
        uv[v*2]=g.attributes.uv.getX(k);uv[v*2+1]=g.attributes.uv.getY(k)+row*.27;
        if(row<2){const next=offset+row*n+(j+1)%n;triangles.push(v,next,v+n,next,next+n,v+n);}
      }
      offset+=n*3;
    }
    geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setIndex(triangles);
    const material=source.material.clone();material.side=THREE.DoubleSide;
    this.mesh=new THREE.Mesh(geometry,material);this.mesh.name='cf-sleeve-continuation';
    this.mesh.frustumCulled=false;root.add(this.mesh);
    this.center=new THREE.Vector3();this.point=new THREE.Vector3();this.transform=new THREE.Matrix4();
  }
  update() {
    this.transform.copy(this.root.matrixWorld).invert().multiply(this.source.matrixWorld);
    const p=this.mesh.geometry.attributes.position;
    for(const r of this.rings) {
      const n=r.indices.length;this.center.set(0,0,0);
      r.indices.forEach((index,j)=>{this.source.getVertexPosition(index,r.points[j]).applyMatrix4(this.transform);this.center.add(r.points[j]);});
      this.center.multiplyScalar(1/n);
      for(let row=0;row<3;row++)for(let j=0;j<n;j++) {
        this.point.copy(r.shoulder).sub(this.center).multiplyScalar(row/2).add(r.points[j]);
        p.setXYZ(r.offset+row*n+j,this.point.x,this.point.y,this.point.z);
      }
    }
    p.needsUpdate=true;this.mesh.geometry.computeVertexNormals();
  }
}
