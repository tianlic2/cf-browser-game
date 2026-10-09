import * as THREE from 'three';

// Original CF first-person AK: hands, fingers and gun share the authored rig.
// The world/drop model stays separate; this rig only renders in the view scene.
export class ClassicView {
  static async load(asset='ak/view') {
    try {
      const base=new URL(`../assets/classic/${asset}/`,import.meta.url);
      const r=await fetch(new URL('view.json',base));if(!r.ok)throw new Error('view.json');
      const data=await r.json(), response=await fetch(new URL('view.bin',base));
      if(!response.ok)throw new Error('view.bin');
      const bytes=await response.arrayBuffer();
      const textures=await Promise.all(data.parts.map(p=>new THREE.TextureLoader().loadAsync(new URL(p.map,base).href)));
      return new ClassicView(data,bytes,textures);
    } catch(e) { console.warn('CF 视模加载失败，使用握点回退',e);return null; }
  }
  constructor(data,bytes,textures) {
    this.root=new THREE.Group();this.root.name='cf-authored-first-person';
    const rig=new THREE.Group(), bones=data.bones.map(b=>{
      const o=new THREE.Bone();o.name=b.name;o.position.fromArray(b.pose);o.quaternion.fromArray(b.pose,3);return o;
    });
    data.bones.forEach((b,i)=>(b.parent<0?rig:bones[b.parent]).add(bones[i]));
    rig.updateMatrixWorld(true);const skeleton=new THREE.Skeleton(bones);
    data.parts.forEach((p,i)=>{
      const a=new Float32Array(bytes,p.offset,p.count*16),g=new THREE.BufferGeometry();
      const attr=(n,start,size,Type=Float32Array)=>{
        const v=new Type(p.count*size);for(let j=0;j<p.count;j++)for(let k=0;k<size;k++)v[j*size+k]=a[j*16+start+k];
        g.setAttribute(n,new THREE.BufferAttribute(v,size));
      };
      attr('position',0,3);attr('normal',3,3);attr('uv',6,2);attr('skinIndex',8,4,Uint16Array);attr('skinWeight',12,4);
      for(let j=0;j<p.count;j++)g.attributes.uv.setY(j,1-g.attributes.uv.getY(j));
      // UVs above already flip the SMD V axis; TextureLoader must not flip it again.
      textures[i].flipY=false;textures[i].colorSpace=THREE.SRGBColorSpace;textures[i].anisotropy=8;
      const mesh=new THREE.SkinnedMesh(g,new THREE.MeshStandardMaterial({map:textures[i],roughness:.85,metalness:.04}));
      mesh.frustumCulled=false;rig.add(mesh);mesh.bind(skeleton,new THREE.Matrix4());
      if(i===0)this.gun=mesh;
      if(p.map==='FVIEW_HAND_GR.png')this.hands=mesh;
      if(p.map==='FVIEW_ARM_GR.png')this.sleeves=mesh;
    });
    // SMD camera: X right, -Y forward, Z up. Its units are centimetres.
    rig.matrixAutoUpdate=false;rig.matrix.set(.01,0,0,0, 0,0,.01,0, 0,.01,0,0, 0,0,0,1);
    this.root.add(rig);this.bones=bones;this.skeleton=skeleton;this.clips={};
    for(const [name,c] of Object.entries(data.clips))this.clips[name]={times:c.times,values:new Float32Array(bytes,c.offset,c.count*bones.length*7)};
    this.sleeveExtension=new SleeveExtension(this.sleeves,this.root);
    this.q=new THREE.Quaternion();this.sample('idle_0',0);
    const v=new THREE.Vector3();let front=Infinity;this.tip=0;
    for(let i=0;i<this.gun.geometry.attributes.position.count;i++) {
      this.gun.getVertexPosition(i,v);if(v.y<front){front=v.y;this.tip=i;}
    }
  }
  sample(name,seconds) {
    const c=this.clips[name]||this.clips.idle_0,ts=c.times,nb=this.bones.length;
    const t=Math.max(0,Math.min(seconds,ts[ts.length-1]));let a=0;
    while(a<ts.length-2&&ts[a+1]<t)a++;
    const b=Math.min(a+1,ts.length-1),f=ts[b]>ts[a]?(t-ts[a])/(ts[b]-ts[a]):0;
    this.bones.forEach((bone,i)=>{
      const x=(a*nb+i)*7,y=(b*nb+i)*7,v=c.values;
      bone.position.set(v[x]+(v[y]-v[x])*f,v[x+1]+(v[y+1]-v[x+1])*f,v[x+2]+(v[y+2]-v[x+2])*f);
      bone.quaternion.fromArray(v,x+3).slerp(this.q.fromArray(v,y+3),f);
    });
    this.root.updateMatrixWorld(true);this.skeleton.update();this.clip=name;this.seconds=t;
    this.sleeveExtension.update();
  }
  duration(name) {const t=this.clips[name].times;return t[t.length-1];}
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
  muzzle(out) {this.gun.getVertexPosition(this.tip,out);return this.gun.localToWorld(out);}
}

// The imported view model ends at two open upper-arm rings. Continue those
// rings below the camera instead of moving the authored hands or gun. Wrists
// remain untouched. Both sleeves share one small dynamic mesh/material.
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
        // Preserve the exact animated seam; continue its cross section toward
        // a camera-relative shoulder whose entire open rim stays below frame.
        this.point.copy(r.shoulder).sub(this.center).multiplyScalar(row/2).add(r.points[j]);
        p.setXYZ(r.offset+row*n+j,this.point.x,this.point.y,this.point.z);
      }
    }
    p.needsUpdate=true;this.mesh.geometry.computeVertexNormals();
  }
}
